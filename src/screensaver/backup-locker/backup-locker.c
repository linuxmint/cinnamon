#include "config.h"
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <glib/gi18n.h>
#include <glib-unix.h>
#include <gtk/gtk.h>
#include <gdk/gdkx.h>
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <X11/extensions/Xcomposite.h>

#include "gdk-event-filter.h"
#include "event-grabber.h"

#define BUS_NAME "org.cinnamon.BackupLocker"
#define BUS_PATH "/org/cinnamon/BackupLocker"

#define LAUNCHER_BUS_NAME "org.cinnamon.Launcher"
#define LAUNCHER_BUS_PATH "/org/cinnamon/Launcher"
#define LAUNCHER_INTERFACE "org.cinnamon.Launcher"

#define BACKUP_TYPE_LOCKER (backup_locker_get_type ())
G_DECLARE_FINAL_TYPE (BackupLocker, backup_locker, BACKUP, LOCKER, GtkApplication)

struct _BackupLocker
{
    GtkApplication parent_instance;

    GtkWidget *window;
    GtkWidget *fixed;
    GtkWidget *info_box;
    GtkWidget *stack;
    GtkWidget *recover_button;

    CsGdkEventFilter *event_filter;
    CsEventGrabber *grabber;

    GCancellable *monitor_cancellable;
    GMutex pretty_xid_mutex;

    gulong pretty_xid;
    guint activate_idle_id;
    guint sigterm_src_id;
    guint recover_timeout_id;
    guint can_restart_check_id;
    gint can_restart_retries;
    guint term_tty;
    guint session_tty;

    Display *cow_display;

    gboolean should_grab;
    gboolean hold_mode;
    gboolean locked;
};

G_DEFINE_TYPE (BackupLocker, backup_locker, GTK_TYPE_APPLICATION)

static GDBusNodeInfo *introspection_data = NULL;

static const gchar introspection_xml[] =
    "<node>"
    "  <interface name='org.cinnamon.BackupLocker'>"
    "    <method name='Lock'>"
    "      <arg type='t' name='xid' direction='in'/>"
    "      <arg type='u' name='term_tty' direction='in'/>"
    "      <arg type='u' name='session_tty' direction='in'/>"
    "    </method>"
    "    <method name='Unlock'/>"
    "    <method name='ReleaseGrabs'/>"
    "    <method name='Quit'/>"
    "  </interface>"
    "</node>";

static void create_window (BackupLocker *self);
static void setup_window_monitor (BackupLocker *self, gulong xid);
static void release_grabs_internal (BackupLocker *self);
static void check_can_restart (BackupLocker *self);

static void
acquire_cow (BackupLocker *self)
{
    if (self->cow_display != NULL)
        return;

    self->cow_display = XOpenDisplay (NULL);

    if (self->cow_display == NULL)
    {
        g_warning ("Failed to open X display for COW");
        return;
    }

    XCompositeGetOverlayWindow (self->cow_display,
                                DefaultRootWindow (self->cow_display));
    XSync (self->cow_display, False);

    g_debug ("acquire_cow: holding composite overlay window");
}

static void
release_cow (BackupLocker *self)
{
    if (self->cow_display == NULL)
        return;

    g_debug ("release_cow: releasing composite overlay window");

    XCompositeReleaseOverlayWindow (self->cow_display,
                                    DefaultRootWindow (self->cow_display));
    XCloseDisplay (self->cow_display);
    self->cow_display = NULL;
}

static void
set_net_wm_name (GdkWindow   *window,
                 const gchar *name)
{
    GdkDisplay *display = gdk_display_get_default ();
    Window xwindow = gdk_x11_window_get_xid (window);

    gdk_x11_display_error_trap_push (display);

    XChangeProperty (GDK_DISPLAY_XDISPLAY (display), xwindow,
                     gdk_x11_get_xatom_by_name_for_display (display, "_NET_WM_NAME"),
                     gdk_x11_get_xatom_by_name_for_display (display, "UTF8_STRING"), 8,
                     PropModeReplace, (guchar *)name, strlen (name));

    XFlush (GDK_DISPLAY_XDISPLAY (display));

    gdk_x11_display_error_trap_pop_ignored (display);
}

static void
position_info_box (BackupLocker *self)
{
    GdkDisplay *display;
    GdkMonitor *monitor;
    GdkRectangle rect;
    GtkRequisition natural_size;

    if (self->info_box == NULL)
        return;

    gtk_widget_get_preferred_size (self->info_box, NULL, &natural_size);

    if (natural_size.width == 0 || natural_size.height == 0)
        return;

    display = gdk_display_get_default ();
    monitor = gdk_display_get_primary_monitor (display);
    gdk_monitor_get_workarea (monitor, &rect);

    g_debug ("Positioning info box (%dx%d) to primary monitor (%d+%d+%dx%d)",
             natural_size.width, natural_size.height,
             rect.x, rect.y, rect.width, rect.height);

    gtk_fixed_move (GTK_FIXED (self->fixed), self->info_box,
                    rect.x + (rect.width / 2) - (natural_size.width / 2),
                    rect.y + (rect.height / 2) - (natural_size.height / 2));
}

static void
root_window_size_changed (CsGdkEventFilter *filter,
                          gpointer          user_data)
{
    BackupLocker *self = BACKUP_LOCKER (user_data);
    GdkWindow *gdk_win;
    Display *xdisplay;
    gint w, h, screen_num;

    gdk_win = gtk_widget_get_window (self->window);

    xdisplay = GDK_DISPLAY_XDISPLAY (gdk_window_get_display (gdk_win));
    screen_num = DefaultScreen (xdisplay);

    w = DisplayWidth (xdisplay, screen_num);
    h = DisplayHeight (xdisplay, screen_num);

    gdk_window_move_resize (gtk_widget_get_window (self->window),
                            0, 0, w, h);
    position_info_box (self);

    gtk_widget_queue_resize (self->window);
}

static void window_grab_broken (gpointer data);

static gboolean
activate_backup_window_cb (BackupLocker *self)
{
    g_debug ("activate_backup_window_cb: should_grab=%d", self->should_grab);

    if (self->should_grab)
    {
        if (cs_event_grabber_grab_root (self->grabber, FALSE))
        {
            guint32 user_time;
            cs_event_grabber_move_to_window (self->grabber,
                                          gtk_widget_get_window (self->window),
                                          gtk_widget_get_screen (self->window),
                                          FALSE);
            g_signal_connect_swapped (self->window, "grab-broken-event", G_CALLBACK (window_grab_broken), self);

            user_time = gdk_x11_display_get_user_time (gtk_widget_get_display (self->window));
            gdk_x11_window_set_user_time (gtk_widget_get_window (self->window), user_time);

            gtk_widget_set_sensitive (self->recover_button, FALSE);
            gtk_stack_set_visible_child_name (GTK_STACK (self->stack), "auto");
            gtk_widget_show (self->info_box);
            position_info_box (self);

            self->can_restart_retries = 0;
            g_clear_handle_id (&self->can_restart_check_id, g_source_remove);
            check_can_restart (self);
        }
        else
        {
            return G_SOURCE_CONTINUE;
        }
    }

    self->activate_idle_id = 0;
    return G_SOURCE_REMOVE;
}

static void
activate_backup_window (BackupLocker *self)
{
    g_clear_handle_id (&self->activate_idle_id, g_source_remove);
    self->activate_idle_id = g_timeout_add (20, (GSourceFunc) activate_backup_window_cb, self);
}

static void
ungrab (BackupLocker *self)
{
    cs_event_grabber_release (self->grabber);
    self->should_grab = FALSE;
}

static void
window_grab_broken (gpointer data)
{
    BackupLocker *self = BACKUP_LOCKER (data);

    g_signal_handlers_disconnect_by_func (self->window, window_grab_broken, self);

    if (self->should_grab)
    {
        g_debug ("Grab broken, retrying");
        activate_backup_window (self);
    }
}

static gboolean
update_for_compositing (BackupLocker *self)
{
    GdkVisual *visual;

    if (gdk_screen_is_composited (gdk_screen_get_default ()))
    {
        visual = gdk_screen_get_rgba_visual (gdk_screen_get_default ());
        if (!visual)
        {
            g_critical ("Can't get RGBA visual to paint backup window");
            return FALSE;
        }
    }
    else
    {
        visual = gdk_screen_get_system_visual (gdk_screen_get_default ());
    }

    g_debug ("update for compositing (composited: %s)",
             gdk_screen_is_composited (gdk_screen_get_default ()) ? "yes" : "no");

    gtk_widget_hide (self->window);
    gtk_widget_unrealize (self->window);
    gtk_widget_set_visual (self->window, visual);
    gtk_widget_realize (self->window);

    if (self->locked)
        gtk_widget_show (self->window);

    if (self->should_grab)
        activate_backup_window (self);

    return TRUE;
}

static void
on_composited_changed (BackupLocker *self)
{
    g_debug ("Received composited-changed (composited: %s)",
             gdk_screen_is_composited (gdk_screen_get_default ()) ? "yes" : "no");

    if (self->window == NULL || !self->locked)
        return;

    if (!update_for_compositing (self))
    {
        g_critical ("Error realizing backup-locker window - exiting");

        if (self->locked)
        {
            self->locked = FALSE;
            g_application_release (G_APPLICATION (self));
        }
    }
}

static void
on_window_realize (GtkWidget *widget, BackupLocker *self)
{
    GdkWindow *gdk_win = gtk_widget_get_window (widget);

    g_debug ("on_window_realize: window xid=0x%lx",
           (gulong) GDK_WINDOW_XID (gdk_win));

    set_net_wm_name (gdk_win, "backup-locker");

    root_window_size_changed (self->event_filter, self);
}

static void
show_manual_instructions (BackupLocker *self)
{
    g_clear_handle_id (&self->recover_timeout_id, g_source_remove);
    gtk_stack_set_visible_child_name (GTK_STACK (self->stack), "manual");
}

static gboolean
recover_timeout_cb (gpointer data)
{
    BackupLocker *self = BACKUP_LOCKER (data);

    g_debug ("Recovery timeout, showing manual instructions");

    self->recover_timeout_id = 0;
    show_manual_instructions (self);

    return G_SOURCE_REMOVE;
}

static gboolean
retry_can_restart_cb (gpointer data)
{
    BackupLocker *self = BACKUP_LOCKER (data);

    self->can_restart_check_id = 0;
    check_can_restart (self);

    return G_SOURCE_REMOVE;
}

static void
on_can_restart_reply (GObject      *source,
                      GAsyncResult *result,
                      gpointer      user_data)
{
    BackupLocker *self = BACKUP_LOCKER (user_data);
    GVariant *ret;
    GError *error = NULL;
    gboolean can_restart = FALSE;

    ret = g_dbus_connection_call_finish (G_DBUS_CONNECTION (source), result, &error);

    if (error != NULL)
    {
        g_debug ("CanRestart call failed: %s", error->message);
        g_error_free (error);
    }
    else
    {
        g_variant_get (ret, "(b)", &can_restart);
        g_variant_unref (ret);
    }

    if (can_restart)
    {
        gtk_widget_set_sensitive (self->recover_button, TRUE);
    }
    else if (self->can_restart_retries < 5)
    {
        self->can_restart_retries++;
        self->can_restart_check_id = g_timeout_add_seconds (1, retry_can_restart_cb, self);
    }
    else
    {
        show_manual_instructions (self);
    }
}

static void
check_can_restart (BackupLocker *self)
{
    self->can_restart_check_id = 0;

    g_dbus_connection_call (g_application_get_dbus_connection (G_APPLICATION (self)),
                            LAUNCHER_BUS_NAME,
                            LAUNCHER_BUS_PATH,
                            LAUNCHER_INTERFACE,
                            "CanRestart",
                            NULL,
                            G_VARIANT_TYPE ("(b)"),
                            G_DBUS_CALL_FLAGS_NONE,
                            -1,
                            NULL,
                            on_can_restart_reply,
                            self);
}
static void
on_recover_finished (GObject      *source,
                     GAsyncResult *result,
                     gpointer      user_data)
{
    BackupLocker *self = BACKUP_LOCKER (user_data);
    GVariant *ret;
    GError *error = NULL;
    gboolean success = FALSE;

    ret = g_dbus_connection_call_finish (G_DBUS_CONNECTION (source), result, &error);

    if (error != NULL)
    {
        g_warning ("TryRestart failed: %s", error->message);
        g_error_free (error);
        show_manual_instructions (self);
        return;
    }

    g_variant_get (ret, "(b)", &success);
    g_variant_unref (ret);

    if (!success)
    {
        show_manual_instructions (self);
    }
}

static void
on_recover_clicked (GtkButton *button, BackupLocker *self)
{
    g_debug ("Attempting automatic recovery");

    gtk_widget_set_sensitive (GTK_WIDGET (button), FALSE);

    g_dbus_connection_call (g_application_get_dbus_connection (G_APPLICATION (self)),
                            LAUNCHER_BUS_NAME,
                            LAUNCHER_BUS_PATH,
                            LAUNCHER_INTERFACE,
                            "TryRestart",
                            NULL,
                            G_VARIANT_TYPE ("(b)"),
                            G_DBUS_CALL_FLAGS_NONE,
                            -1,
                            NULL,
                            on_recover_finished,
                            self);

    self->recover_timeout_id = g_timeout_add_seconds (10, recover_timeout_cb, self);
}

static void
create_window (BackupLocker *self)
{
    GtkWidget *box;
    GtkWidget *widget;
    GtkStyleContext *context;
    GtkCssProvider *provider;
    PangoAttrList *attrs;
    GdkVisual *visual;

    self->window = g_object_new (GTK_TYPE_WINDOW,
                                 "type", GTK_WINDOW_POPUP,
                                 NULL);

    gtk_widget_set_events (self->window,
                           gtk_widget_get_events (self->window)
                           | GDK_POINTER_MOTION_MASK
                           | GDK_BUTTON_PRESS_MASK
                           | GDK_BUTTON_RELEASE_MASK
                           | GDK_KEY_PRESS_MASK
                           | GDK_KEY_RELEASE_MASK
                           | GDK_EXPOSURE_MASK
                           | GDK_VISIBILITY_NOTIFY_MASK
                           | GDK_ENTER_NOTIFY_MASK
                           | GDK_LEAVE_NOTIFY_MASK);

    context = gtk_widget_get_style_context (self->window);
    gtk_style_context_remove_class (context, "background");
    provider = gtk_css_provider_new ();
    gtk_css_provider_load_from_data (provider, ".backup-active { background-color: black; }", -1, NULL);
    gtk_style_context_add_provider (context,
                                    GTK_STYLE_PROVIDER (provider),
                                    GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
    gtk_style_context_add_class (context, "backup-active");
    g_object_unref (provider);

    self->fixed = gtk_fixed_new ();
    gtk_container_add (GTK_CONTAINER (self->window), self->fixed);

    box = gtk_box_new (GTK_ORIENTATION_VERTICAL, 0);
    gtk_widget_set_valign (box, GTK_ALIGN_CENTER);

    widget = gtk_image_new_from_icon_name ("cinnamon-symbolic", GTK_ICON_SIZE_DIALOG);
    gtk_image_set_pixel_size (GTK_IMAGE (widget), 100);
    gtk_widget_set_halign (widget, GTK_ALIGN_CENTER);
    gtk_box_pack_start (GTK_BOX (box), widget, FALSE, FALSE, 6);
    // This is the first line of text for the backup-locker, explaining how to switch to tty
    // and run 'cinnamon-unlock-desktop' command.  This appears if the screensaver crashes.
    widget = gtk_label_new (_("Something went wrong with the screensaver."));
    attrs = pango_attr_list_new ();
    pango_attr_list_insert (attrs, pango_attr_size_new (20 * PANGO_SCALE));
    pango_attr_list_insert (attrs, pango_attr_foreground_new (65535, 65535, 65535));
    gtk_label_set_attributes (GTK_LABEL (widget), attrs);
    pango_attr_list_unref (attrs);
    gtk_widget_set_halign (widget, GTK_ALIGN_CENTER);
    gtk_box_pack_start (GTK_BOX (box), widget, FALSE, FALSE, 6);

    self->stack = gtk_stack_new ();
    gtk_stack_set_transition_type (GTK_STACK (self->stack), GTK_STACK_TRANSITION_TYPE_CROSSFADE);
    gtk_box_pack_start (GTK_BOX (box), self->stack, FALSE, FALSE, 6);

    // "auto" page: recovery button
    self->recover_button = gtk_button_new_with_label (_("Attempt to recover automatically"));
    gtk_widget_set_halign (self->recover_button, GTK_ALIGN_CENTER);
    gtk_widget_set_valign (self->recover_button, GTK_ALIGN_START);
    gtk_style_context_add_class (gtk_widget_get_style_context (self->recover_button), GTK_STYLE_CLASS_SUGGESTED_ACTION);
    g_signal_connect (self->recover_button, "clicked", G_CALLBACK (on_recover_clicked), self);
    gtk_stack_add_named (GTK_STACK (self->stack), self->recover_button, "auto");

    // "manual" page: subtitle, TTY instructions, bug report
    {
        GtkWidget *manual_box = gtk_box_new (GTK_ORIENTATION_VERTICAL, 0);

        widget = gtk_label_new (_("We'll help you get your desktop back"));
        attrs = pango_attr_list_new ();
        pango_attr_list_insert (attrs, pango_attr_size_new (12 * PANGO_SCALE));
        pango_attr_list_insert (attrs, pango_attr_foreground_new (65535, 65535, 65535));
        gtk_label_set_attributes (GTK_LABEL (widget), attrs);
        pango_attr_list_unref (attrs);
        gtk_widget_set_halign (widget, GTK_ALIGN_CENTER);
        gtk_box_pack_start (GTK_BOX (manual_box), widget, FALSE, FALSE, 6);

        const gchar *steps[] = {
            // Bulleted list of steps to take to unlock the desktop
            N_("Switch to a console using <Control-Alt-F%u>."),
            N_("Log in by typing your user name followed by your password."),
            N_("At the prompt, type 'cinnamon-unlock-desktop' and press Enter."),
            N_("Switch back to your unlocked desktop using <Control-Alt-F%u>.")
        };

        const gchar *bug_report[] = {
            N_("If you can reproduce this behavior, please file a report here:"),
            "https://github.com/linuxmint/cinnamon"
        };

        GString *str = g_string_new (NULL);
        gchar *tmp0 = NULL;
        gchar *tmp1 = NULL;

        tmp0 = g_strdup_printf (_(steps[0]), self->term_tty);
        tmp1 = g_strdup_printf ("\xe2\x80\xa2 %s\n", tmp0);
        g_string_append (str, tmp1);
        g_free (tmp0);
        g_free (tmp1);
        tmp1 = g_strdup_printf ("\xe2\x80\xa2 %s\n", _(steps[1]));
        g_string_append (str, tmp1);
        g_free (tmp1);
        tmp1 = g_strdup_printf ("\xe2\x80\xa2 %s\n", _(steps[2]));
        g_string_append (str, tmp1);
        g_free (tmp1);
        tmp0 = g_strdup_printf (_(steps[3]), self->session_tty);
        tmp1 = g_strdup_printf ("\xe2\x80\xa2 %s\n", tmp0);
        g_string_append (str, tmp1);
        g_free (tmp0);
        g_free (tmp1);

        g_string_append (str, "\n");

        for (int i = 0; i < G_N_ELEMENTS (bug_report); i++)
        {
            gchar *line = g_strdup_printf ("%s\n", _(bug_report[i]));
            g_string_append (str, line);
            g_free (line);
        }

        widget = gtk_label_new (str->str);
        g_string_free (str, TRUE);

        attrs = pango_attr_list_new ();
        pango_attr_list_insert (attrs, pango_attr_size_new (10 * PANGO_SCALE));
        pango_attr_list_insert (attrs, pango_attr_foreground_new (65535, 65535, 65535));
        gtk_label_set_attributes (GTK_LABEL (widget), attrs);
        pango_attr_list_unref (attrs);
        gtk_label_set_line_wrap (GTK_LABEL (widget), TRUE);
        gtk_widget_set_halign (widget, GTK_ALIGN_CENTER);
        gtk_box_pack_start (GTK_BOX (manual_box), widget, FALSE, FALSE, 6);

        gtk_widget_show_all (manual_box);
        gtk_stack_add_named (GTK_STACK (self->stack), manual_box, "manual");
    }

    gtk_widget_show_all (box);
    gtk_widget_set_no_show_all (box, TRUE);
    gtk_widget_hide (box);
    self->info_box = box;

    g_signal_connect_swapped (self->info_box, "realize", G_CALLBACK (position_info_box), self);

    gtk_fixed_put (GTK_FIXED (self->fixed), self->info_box, 0, 0);
    gtk_widget_show (self->fixed);

    self->event_filter = cs_gdk_event_filter_new (self->window);
    g_signal_connect (self->event_filter, "xscreen-size", G_CALLBACK (root_window_size_changed), self);
    self->grabber = cs_event_grabber_new ();

    g_signal_connect (self->window, "realize", G_CALLBACK (on_window_realize), self);

    g_signal_connect_object (gdk_screen_get_default (), "composited-changed",
                             G_CALLBACK (on_composited_changed), self, G_CONNECT_SWAPPED);

    visual = gdk_screen_get_rgba_visual (gdk_screen_get_default ());
    if (visual)
        gtk_widget_set_visual (self->window, visual);

    gtk_widget_realize (self->window);
    gtk_widget_show (self->window);
}

static void
window_monitor_thread (GTask        *task,
                       gpointer      source_object,
                       gpointer      task_data,
                       GCancellable *cancellable)
{
    GSubprocess *xprop_proc;
    GError *error;

    gulong xid = GDK_POINTER_TO_XID (task_data);
    gchar *xid_str = g_strdup_printf ("0x%lx", xid);
    error = NULL;

    xprop_proc = g_subprocess_new (G_SUBPROCESS_FLAGS_STDOUT_SILENCE,
                                   &error,
                                   "xprop",
                                   "-spy",
                                   "-id", (const gchar *) xid_str,
                                   NULL);

    g_free (xid_str);

    if (xprop_proc == NULL)
    {
        g_warning ("Unable to monitor window: %s", error->message);
    }
    else
    {
        g_debug ("xprop monitoring window 0x%lx - waiting", xid);
        g_subprocess_wait (xprop_proc, cancellable, &error);

        if (error != NULL)
        {
            if (error->code != G_IO_ERROR_CANCELLED)
            {
                g_warning ("xprop error: %s", error->message);
            }
            else
            {
                g_debug ("xprop cancelled");
            }
        }
        else
        {
            gint exit_status = g_subprocess_get_exit_status (xprop_proc);
            g_debug ("xprop exited (status=%d)", exit_status);
        }
    }
    g_clear_error (&error);
    g_task_return_boolean (task, TRUE);
}

static void
screensaver_window_gone (GObject      *source,
                         GAsyncResult *result,
                         gpointer      user_data)
{
    BackupLocker *self = BACKUP_LOCKER (user_data);
    GCancellable *task_cancellable = g_task_get_cancellable (G_TASK (result));
    gulong xid = GDK_POINTER_TO_XID (g_task_get_task_data (G_TASK (result)));

    g_task_propagate_boolean (G_TASK (result), NULL);

    g_debug ("screensaver_window_gone: xid=0x%lx, cancelled=%d",
           xid, g_cancellable_is_cancelled (task_cancellable));

    if (!g_cancellable_is_cancelled (task_cancellable))
    {
        g_mutex_lock (&self->pretty_xid_mutex);

        g_debug ("screensaver_window_gone: xid=0x%lx, pretty_xid=0x%lx, match=%d",
               xid, self->pretty_xid, xid == self->pretty_xid);

        if (xid == self->pretty_xid)
        {
            g_debug ("screensaver_window_gone: ACTIVATING - starting event filter and grabbing");
            cs_gdk_event_filter_stop (self->event_filter);
            cs_gdk_event_filter_start (self->event_filter);

            self->should_grab = TRUE;
            self->pretty_xid = 0;
            activate_backup_window (self);
        }

        g_mutex_unlock (&self->pretty_xid_mutex);
    }

    g_clear_object (&self->monitor_cancellable);
}

static void
setup_window_monitor (BackupLocker *self, gulong xid)
{
    GTask *task;

    g_debug ("setup_window_monitor: xid=0x%lx", xid);

    g_mutex_lock (&self->pretty_xid_mutex);

    self->should_grab = FALSE;
    self->pretty_xid = xid;

    self->monitor_cancellable = g_cancellable_new ();
    task = g_task_new (NULL, self->monitor_cancellable, screensaver_window_gone, self);

    g_task_set_return_on_cancel (task, TRUE);
    g_task_set_task_data (task, GDK_XID_TO_POINTER (xid), NULL);

    g_task_run_in_thread (task, window_monitor_thread);
    g_object_unref (task);
    g_mutex_unlock (&self->pretty_xid_mutex);
}

static void
release_grabs_internal (BackupLocker *self)
{
    g_clear_handle_id (&self->recover_timeout_id, g_source_remove);
    g_clear_handle_id (&self->can_restart_check_id, g_source_remove);

    if (!self->should_grab)
        return;

    g_debug ("release_grabs_internal: releasing grabs, stopping event filter");

    cs_gdk_event_filter_stop (self->event_filter);
    g_clear_handle_id (&self->activate_idle_id, g_source_remove);
    ungrab (self);

    if (self->info_box != NULL)
        gtk_widget_hide (self->info_box);
}

static void
handle_lock (BackupLocker          *self,
             GVariant              *parameters,
             GDBusMethodInvocation *invocation)
{
    guint64 xid64;

    g_variant_get (parameters, "(tuu)", &xid64, &self->term_tty, &self->session_tty);
    gulong xid = (gulong) xid64;

    g_debug ("handle_lock: xid=0x%lx, term=%u, session=%u",
           xid, self->term_tty, self->session_tty);

    if (self->window == NULL)
    {
        create_window (self);
    }
    else
    {
        release_grabs_internal (self);

        if (self->monitor_cancellable != NULL)
        {
            g_cancellable_cancel (self->monitor_cancellable);
            g_clear_object (&self->monitor_cancellable);
        }
    }

    if (!self->locked)
        g_application_hold (G_APPLICATION (self));

    self->locked = TRUE;

    acquire_cow (self);
    gtk_widget_show (self->window);

    setup_window_monitor (self, xid);

    g_dbus_method_invocation_return_value (invocation, NULL);
}

static void
handle_unlock (BackupLocker          *self,
               GDBusMethodInvocation *invocation)
{
    g_debug ("handle_unlock");

    if (self->monitor_cancellable != NULL)
    {
        g_cancellable_cancel (self->monitor_cancellable);
        g_clear_object (&self->monitor_cancellable);
    }

    release_grabs_internal (self);
    release_cow (self);

    if (self->window != NULL)
        gtk_widget_hide (self->window);

    g_dbus_method_invocation_return_value (invocation, NULL);

    if (self->locked)
    {
        self->locked = FALSE;
        g_application_release (G_APPLICATION (self));
    }
}

static void
handle_release_grabs (BackupLocker          *self,
                      GDBusMethodInvocation *invocation)
{
    g_debug ("handle_release_grabs");

    release_grabs_internal (self);
    release_cow (self);

    g_dbus_method_invocation_return_value (invocation, NULL);
}

static void
handle_quit (BackupLocker          *self,
             GDBusMethodInvocation *invocation)
{
    g_debug ("handle_quit");

    if (self->monitor_cancellable != NULL)
    {
        g_cancellable_cancel (self->monitor_cancellable);
        g_clear_object (&self->monitor_cancellable);
    }

    release_grabs_internal (self);
    release_cow (self);

    if (self->window != NULL)
    {
        gtk_widget_destroy (self->window);
        self->window = NULL;
        self->info_box = NULL;
        self->fixed = NULL;
        self->stack = NULL;
        self->recover_button = NULL;
    }

    g_dbus_method_invocation_return_value (invocation, NULL);

    if (self->locked)
    {
        self->locked = FALSE;
        g_application_release (G_APPLICATION (self));
    }
}

static void
handle_method_call (GDBusConnection       *connection,
                    const gchar           *sender,
                    const gchar           *object_path,
                    const gchar           *interface_name,
                    const gchar           *method_name,
                    GVariant              *parameters,
                    GDBusMethodInvocation *invocation,
                    gpointer               user_data)
{
    BackupLocker *self = BACKUP_LOCKER (user_data);

    g_debug ("D-Bus method call: %s", method_name);

    if (g_strcmp0 (method_name, "Lock") == 0)
        handle_lock (self, parameters, invocation);
    else if (g_strcmp0 (method_name, "Unlock") == 0)
        handle_unlock (self, invocation);
    else if (g_strcmp0 (method_name, "ReleaseGrabs") == 0)
        handle_release_grabs (self, invocation);
    else if (g_strcmp0 (method_name, "Quit") == 0)
        handle_quit (self, invocation);
    else
        g_dbus_method_invocation_return_error (invocation,
            G_DBUS_ERROR, G_DBUS_ERROR_UNKNOWN_METHOD,
            "Unknown method: %s", method_name);
}

static const GDBusInterfaceVTable interface_vtable =
{
    handle_method_call,
    NULL,
    NULL,
};

static gboolean
sigterm_received (gpointer data)
{
    BackupLocker *self = BACKUP_LOCKER (data);

    g_debug ("SIGTERM received, cleaning up");

    if (self->monitor_cancellable != NULL)
    {
        g_cancellable_cancel (self->monitor_cancellable);
        g_clear_object (&self->monitor_cancellable);
    }

    release_grabs_internal (self);
    release_cow (self);

    if (self->window != NULL)
    {
        gtk_widget_destroy (self->window);
        self->window = NULL;
    }

    self->sigterm_src_id = 0;
    g_application_quit (G_APPLICATION (self));

    return G_SOURCE_REMOVE;
}

static gboolean
backup_locker_dbus_register (GApplication    *application,
                             GDBusConnection *connection,
                             const gchar     *object_path,
                             GError         **error)
{
    BackupLocker *self = BACKUP_LOCKER (application);

    if (!G_APPLICATION_CLASS (backup_locker_parent_class)->dbus_register (application, connection, object_path, error))
        return FALSE;

    introspection_data = g_dbus_node_info_new_for_xml (introspection_xml, NULL);
    g_assert (introspection_data != NULL);

    g_dbus_connection_register_object (connection,
                                       BUS_PATH,
                                       introspection_data->interfaces[0],
                                       &interface_vtable,
                                       self,
                                       NULL,
                                       error);

    if (error != NULL && *error != NULL)
    {
        g_critical ("Error registering D-Bus object: %s", (*error)->message);
        return FALSE;
    }

    return TRUE;
}

static void
backup_locker_dbus_unregister (GApplication    *application,
                               GDBusConnection *connection,
                               const gchar     *object_path)
{
    g_clear_pointer (&introspection_data, g_dbus_node_info_unref);

    G_APPLICATION_CLASS (backup_locker_parent_class)->dbus_unregister (application, connection, object_path);
}

static void
backup_locker_startup (GApplication *application)
{
    BackupLocker *self = BACKUP_LOCKER (application);

    G_APPLICATION_CLASS (backup_locker_parent_class)->startup (application);

    self->sigterm_src_id = g_unix_signal_add (SIGTERM, (GSourceFunc) sigterm_received, self);

    g_application_hold (application);

    if (!self->hold_mode)
        g_application_release (application);
}

static void
backup_locker_activate (GApplication *application)
{
}

static gint
backup_locker_handle_local_options (GApplication *application,
                                    GVariantDict *options)
{
    BackupLocker *self = BACKUP_LOCKER (application);

    if (g_variant_dict_contains (options, "version"))
    {
        g_print ("%s %s\n", g_get_prgname (), VERSION);
        return 0;
    }

    if (g_variant_dict_contains (options, "hold"))
        self->hold_mode = TRUE;

    return -1;
}

static void
backup_locker_init (BackupLocker *self)
{
    g_mutex_init (&self->pretty_xid_mutex);
}

static void
backup_locker_finalize (GObject *object)
{
    BackupLocker *self = BACKUP_LOCKER (object);

    g_clear_handle_id (&self->sigterm_src_id, g_source_remove);
    g_clear_handle_id (&self->activate_idle_id, g_source_remove);
    g_clear_handle_id (&self->recover_timeout_id, g_source_remove);
    g_clear_handle_id (&self->can_restart_check_id, g_source_remove);

    if (self->monitor_cancellable != NULL)
    {
        g_cancellable_cancel (self->monitor_cancellable);
        g_clear_object (&self->monitor_cancellable);
    }

    if (self->grabber != NULL)
    {
        cs_event_grabber_release (self->grabber);
        g_clear_object (&self->grabber);
    }

    g_clear_object (&self->event_filter);
    release_cow (self);

    if (self->window != NULL)
    {
        gtk_widget_destroy (self->window);
        self->window = NULL;
    }

    g_mutex_clear (&self->pretty_xid_mutex);

    G_OBJECT_CLASS (backup_locker_parent_class)->finalize (object);
}

static void
backup_locker_class_init (BackupLockerClass *klass)
{
    GObjectClass *object_class = G_OBJECT_CLASS (klass);
    GApplicationClass *app_class = G_APPLICATION_CLASS (klass);

    object_class->finalize = backup_locker_finalize;
    app_class->dbus_register = backup_locker_dbus_register;
    app_class->dbus_unregister = backup_locker_dbus_unregister;
    app_class->startup = backup_locker_startup;
    app_class->activate = backup_locker_activate;
    app_class->handle_local_options = backup_locker_handle_local_options;
}

static void
update_debug_from_gsettings (void)
{
    GSettings *settings = g_settings_new ("org.cinnamon");
    gboolean debug = g_settings_get_boolean (settings, "debug-screensaver");
    g_object_unref (settings);

    if (debug)
    {
#if (GLIB_CHECK_VERSION(2,80,0))
        const gchar* const domains[] = { G_LOG_DOMAIN, NULL };
        g_log_writer_default_set_debug_domains (domains);
#else
        g_setenv ("G_MESSAGES_DEBUG", G_LOG_DOMAIN, TRUE);
#endif
    }
}

int
main (int    argc,
      char **argv)
{
    int status;
    BackupLocker *app;

    const GOptionEntry entries[] = {
        { "version", 0, 0, G_OPTION_ARG_NONE, NULL, "Version of this application", NULL },
        { "hold", 0, 0, G_OPTION_ARG_NONE, NULL, "Keep the process running", NULL },
        { NULL }
    };

    bindtextdomain (GETTEXT_PACKAGE, LOCALEDIR);
    bind_textdomain_codeset (GETTEXT_PACKAGE, "UTF-8");
    textdomain (GETTEXT_PACKAGE);

    update_debug_from_gsettings ();

    g_debug ("backup-locker: initializing (pid=%d)", getpid ());

    app = g_object_new (BACKUP_TYPE_LOCKER,
                        "application-id", BUS_NAME,
                        "flags", G_APPLICATION_DEFAULT_FLAGS,
                        "inactivity-timeout", 10000,
                        NULL);

    g_application_add_main_option_entries (G_APPLICATION (app), entries);

    status = g_application_run (G_APPLICATION (app), argc, argv);

    g_debug ("backup-locker: exit");

    g_object_unref (app);

    return status;
}
