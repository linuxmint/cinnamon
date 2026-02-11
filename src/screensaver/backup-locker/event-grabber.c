/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2004-2006 William Jon McCann <mccann@jhu.edu>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA
 * 02110-1335, USA.
 *
 * Authors: William Jon McCann <mccann@jhu.edu>
 *
 */

#include "config.h"
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <gdk/gdk.h>
#include <gdk/gdkx.h>
#include <gtk/gtk.h>
#include <xdo.h>
#include <X11/Xlib.h>
#include <X11/Xatom.h>

#ifdef HAVE_XF86MISCSETGRABKEYSSTATE
# include <X11/extensions/xf86misc.h>
#endif /* HAVE_XF86MISCSETGRABKEYSSTATE */

#include "event-grabber.h"

static void     cs_event_grabber_class_init (CsEventGrabberClass *klass);
static void     cs_event_grabber_init       (CsEventGrabber      *grab);
static void     cs_event_grabber_finalize   (GObject        *object);

typedef struct
{
        GDBusConnection *session_bus;

        guint      mouse_hide_cursor : 1;
        GdkWindow *mouse_grab_window;
        GdkWindow *keyboard_grab_window;
        GdkScreen *mouse_grab_screen;
        GdkScreen *keyboard_grab_screen;
        xdo_t     *xdo;

        GtkWidget *invisible;
} CsEventGrabberPrivate;

struct _CsEventGrabber
{
        GObject        parent_instance;
        CsEventGrabberPrivate *priv;
};

G_DEFINE_TYPE_WITH_PRIVATE (CsEventGrabber, cs_event_grabber, G_TYPE_OBJECT)

static gpointer grab_object = NULL;

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

static const char *
grab_string (int status)
{
        switch (status) {
        case GDK_GRAB_SUCCESS:          return "GrabSuccess";
        case GDK_GRAB_ALREADY_GRABBED:  return "AlreadyGrabbed";
        case GDK_GRAB_INVALID_TIME:     return "GrabInvalidTime";
        case GDK_GRAB_NOT_VIEWABLE:     return "GrabNotViewable";
        case GDK_GRAB_FROZEN:           return "GrabFrozen";
        default:
                {
                        static char foo [255];
                        sprintf (foo, "unknown status: %d", status);
                        return foo;
                }
        }
}

#ifdef HAVE_XF86MISCSETGRABKEYSSTATE
/* This function enables and disables the Ctrl-Alt-KP_star and
   Ctrl-Alt-KP_slash hot-keys, which (in XFree86 4.2) break any
   grabs and/or kill the grabbing client.  That would effectively
   unlock the screen, so we don't like that.

   The Ctrl-Alt-KP_star and Ctrl-Alt-KP_slash hot-keys only exist
   if AllowDeactivateGrabs and/or AllowClosedownGrabs are turned on
   in XF86Config.  I believe they are disabled by default.

   This does not affect any other keys (specifically Ctrl-Alt-BS or
   Ctrl-Alt-F1) but I wish it did.  Maybe it will someday.
 */
static void
xorg_lock_smasher_set_active (CsEventGrabber  *grab,
                              gboolean active)
{
        int status, event, error;

    if (!XF86MiscQueryExtension (GDK_DISPLAY_XDISPLAY (gdk_display_get_default ()), &event, &error)) {
        g_debug ("No XFree86-Misc extension present");
        return;
    }

        if (active) {
                g_debug ("Enabling the x.org grab smasher");
        } else {
                g_debug ("Disabling the x.org grab smasher");
        }

        gdk_error_trap_push ();

        status = XF86MiscSetGrabKeysState (GDK_DISPLAY_XDISPLAY (gdk_display_get_default ()), active);

        gdk_display_sync (gdk_display_get_default ());
        error = gdk_error_trap_pop ();

        if (active && status == MiscExtGrabStateAlready) {
                /* shut up, consider this success */
                status = MiscExtGrabStateSuccess;
        }

        if (error == Success) {
                g_debug ("XF86MiscSetGrabKeysState(%s) returned %s",
                          active ? "on" : "off",
                          (status == MiscExtGrabStateSuccess ? "MiscExtGrabStateSuccess" :
                           status == MiscExtGrabStateLocked  ? "MiscExtGrabStateLocked"  :
                           status == MiscExtGrabStateAlready ? "MiscExtGrabStateAlready" :
                           "unknown value"));
        } else {
                g_debug ("XF86MiscSetGrabKeysState(%s) failed with error code %d",
                          active ? "on" : "off", error);
        }
}
#else
static void
xorg_lock_smasher_set_active (CsEventGrabber  *grab,
                              gboolean active)
{
}
#endif /* HAVE_XF86MISCSETGRABKEYSSTATE */

static void
maybe_cancel_ui_grab (CsEventGrabber *grab)
{
    if (grab->priv->xdo == NULL)
    {
        return;
    }

    xdo_send_keysequence_window (grab->priv->xdo, CURRENTWINDOW, "Escape", 12000); // 12ms as suggested in xdo.h
    xdo_send_keysequence_window (grab->priv->xdo, CURRENTWINDOW, "Escape", 12000);
}

static int
cs_event_grabber_get_keyboard (CsEventGrabber    *grab,
                      GdkWindow *window,
                      GdkScreen *screen)
{
        GdkGrabStatus status;

        g_return_val_if_fail (window != NULL, FALSE);
        g_return_val_if_fail (screen != NULL, FALSE);

        g_debug ("Grabbing keyboard widget=0x%lx", (gulong) GDK_WINDOW_XID (window));
        status = gdk_keyboard_grab (window, FALSE, GDK_CURRENT_TIME);

        if (status == GDK_GRAB_SUCCESS) {
                if (grab->priv->keyboard_grab_window != NULL) {
                        g_object_remove_weak_pointer (G_OBJECT (grab->priv->keyboard_grab_window),
                                                      (gpointer *) &grab->priv->keyboard_grab_window);
                }
                grab->priv->keyboard_grab_window = window;

                g_object_add_weak_pointer (G_OBJECT (grab->priv->keyboard_grab_window),
                                           (gpointer *) &grab->priv->keyboard_grab_window);

                grab->priv->keyboard_grab_screen = screen;
        } else {
                g_debug ("Couldn't grab keyboard!  (%s)", grab_string (status));
        }

        return status;
}

static int
cs_event_grabber_get_mouse (CsEventGrabber    *grab,
                   GdkWindow *window,
                   GdkScreen *screen,
                   gboolean   hide_cursor)
{
        GdkGrabStatus status;
        GdkCursor    *cursor;

        g_return_val_if_fail (window != NULL, FALSE);
        g_return_val_if_fail (screen != NULL, FALSE);

        cursor = gdk_cursor_new (GDK_BLANK_CURSOR);

        g_debug ("Grabbing mouse widget=0x%lx", (gulong) GDK_WINDOW_XID (window));
        status = gdk_pointer_grab (window, TRUE, 0, NULL,
                                   (hide_cursor ? cursor : NULL),
                                   GDK_CURRENT_TIME);

        if (status == GDK_GRAB_SUCCESS) {
                if (grab->priv->mouse_grab_window != NULL) {
                        g_object_remove_weak_pointer (G_OBJECT (grab->priv->mouse_grab_window),
                                                      (gpointer *) &grab->priv->mouse_grab_window);
                }
                grab->priv->mouse_grab_window = window;

                g_object_add_weak_pointer (G_OBJECT (grab->priv->mouse_grab_window),
                                           (gpointer *) &grab->priv->mouse_grab_window);

                grab->priv->mouse_grab_screen = screen;
                grab->priv->mouse_hide_cursor = hide_cursor;
        }

        g_object_unref (cursor);

        return status;
}

void
cs_event_grabber_keyboard_reset (CsEventGrabber *grab)
{
        if (grab->priv->keyboard_grab_window != NULL) {
                g_object_remove_weak_pointer (G_OBJECT (grab->priv->keyboard_grab_window),
                                              (gpointer *) &grab->priv->keyboard_grab_window);
        }
        grab->priv->keyboard_grab_window = NULL;
        grab->priv->keyboard_grab_screen = NULL;
}

static gboolean
cs_event_grabber_release_keyboard (CsEventGrabber *grab)
{
        g_debug ("Ungrabbing keyboard");
        gdk_keyboard_ungrab (GDK_CURRENT_TIME);

        cs_event_grabber_keyboard_reset (grab);

        return TRUE;
}

void
cs_event_grabber_mouse_reset (CsEventGrabber *grab)
{
        if (grab->priv->mouse_grab_window != NULL) {
                g_object_remove_weak_pointer (G_OBJECT (grab->priv->mouse_grab_window),
                                              (gpointer *) &grab->priv->mouse_grab_window);
        }

        grab->priv->mouse_grab_window = NULL;
        grab->priv->mouse_grab_screen = NULL;
}

gboolean
cs_event_grabber_release_mouse (CsEventGrabber *grab)
{
        g_debug ("Ungrabbing pointer");
        gdk_pointer_ungrab (GDK_CURRENT_TIME);

        cs_event_grabber_mouse_reset (grab);

        return TRUE;
}

static gboolean
cs_event_grabber_move_mouse (CsEventGrabber    *grab,
                    GdkWindow *window,
                    GdkScreen *screen,
                    gboolean   hide_cursor)
{
        gboolean   result;
        GdkWindow *old_window;
        GdkScreen *old_screen;
        gboolean   old_hide_cursor;

        /* if the pointer is not grabbed and we have a
           mouse_grab_window defined then we lost the grab */
        if (! gdk_pointer_is_grabbed ()) {
                cs_event_grabber_mouse_reset (grab);
        }

        if (grab->priv->mouse_grab_window == window) {
                g_debug ("Window 0x%lx is already grabbed, skipping",
                          (gulong) GDK_WINDOW_XID (grab->priv->mouse_grab_window));
                return TRUE;
        }

#if 0
        g_debug ("Intentionally skipping move pointer grabs");
        /* FIXME: GTK doesn't like having the pointer grabbed */
        return TRUE;
#else
        if (grab->priv->mouse_grab_window) {
                g_debug ("Moving pointer grab from 0x%lx to 0x%lx",
                          (gulong) GDK_WINDOW_XID (grab->priv->mouse_grab_window),
                          (gulong) GDK_WINDOW_XID (window));
        } else {
                g_debug ("Getting pointer grab on 0x%lx",
                          (gulong) GDK_WINDOW_XID (window));
        }
#endif

        g_debug ("*** doing X server grab");
        gdk_x11_grab_server ();

        old_window = grab->priv->mouse_grab_window;
        old_screen = grab->priv->mouse_grab_screen;
        old_hide_cursor = grab->priv->mouse_hide_cursor;

        if (old_window) {
                cs_event_grabber_release_mouse (grab);
        }

        result = cs_event_grabber_get_mouse (grab, window, screen, hide_cursor);

        if (result != GDK_GRAB_SUCCESS) {
                sleep (1);
                result = cs_event_grabber_get_mouse (grab, window, screen, hide_cursor);
        }

        if ((result != GDK_GRAB_SUCCESS) && old_window) {
                g_debug ("Could not grab mouse for new window.  Resuming previous grab.");
                cs_event_grabber_get_mouse (grab, old_window, old_screen, old_hide_cursor);
        }

        g_debug ("*** releasing X server grab");
        gdk_x11_ungrab_server ();
        gdk_flush ();

        return (result == GDK_GRAB_SUCCESS);
}

static gboolean
cs_event_grabber_move_keyboard (CsEventGrabber    *grab,
                       GdkWindow *window,
                       GdkScreen *screen)
{
        gboolean   result;
        GdkWindow *old_window;
        GdkScreen *old_screen;

        if (grab->priv->keyboard_grab_window == window) {
                g_debug ("Window 0x%lx is already grabbed, skipping",
                          (gulong) GDK_WINDOW_XID (grab->priv->keyboard_grab_window));
                return TRUE;
        }

        if (grab->priv->keyboard_grab_window != NULL) {
                g_debug ("Moving keyboard grab from 0x%lx to 0x%lx",
                          (gulong) GDK_WINDOW_XID (grab->priv->keyboard_grab_window),
                          (gulong) GDK_WINDOW_XID (window));
        } else {
                g_debug ("Getting keyboard grab on 0x%lx",
                          (gulong) GDK_WINDOW_XID (window));

        }

        g_debug ("*** doing X server grab");
        gdk_x11_grab_server ();

        old_window = grab->priv->keyboard_grab_window;
        old_screen = grab->priv->keyboard_grab_screen;

        if (old_window) {
                cs_event_grabber_release_keyboard (grab);
        }

        result = cs_event_grabber_get_keyboard (grab, window, screen);

        if (result != GDK_GRAB_SUCCESS) {
                sleep (1);
                result = cs_event_grabber_get_keyboard (grab, window, screen);
        }

        if ((result != GDK_GRAB_SUCCESS) && old_window) {
                g_debug ("Could not grab keyboard for new window.  Resuming previous grab.");
                cs_event_grabber_get_keyboard (grab, old_window, old_screen);
        }

        g_debug ("*** releasing X server grab");
        gdk_x11_ungrab_server ();
        gdk_flush ();

        return (result == GDK_GRAB_SUCCESS);
}

static void
cs_event_grabber_nuke_focus (void)
{
        Window focus = 0;
        int    rev = 0;

        g_debug ("Nuking focus");

        gdk_error_trap_push ();

        XGetInputFocus (GDK_DISPLAY_XDISPLAY (gdk_display_get_default ()), &focus, &rev);

        XSetInputFocus (GDK_DISPLAY_XDISPLAY (gdk_display_get_default ()), None, RevertToNone, CurrentTime);

        gdk_error_trap_pop_ignored ();
}

void
cs_event_grabber_release (CsEventGrabber *grab)
{
        g_debug ("Releasing all grabs");

        cs_event_grabber_release_mouse (grab);
        cs_event_grabber_release_keyboard (grab);

        /* FIXME: is it right to enable this ? */
        xorg_lock_smasher_set_active (grab, TRUE);

        gdk_display_sync (gdk_display_get_default ());
        gdk_flush ();
}

/* The Cinnamon Shell holds an X grab when we're in the overview;
 * ask it to bounce out before we try locking the screen.
 */
static void
request_shell_exit_overview (CsEventGrabber *grab)
{
        GDBusMessage *message;

        /* Shouldn't happen, but... */
        if (!grab->priv->session_bus)
                return;

        message = g_dbus_message_new_method_call ("org.Cinnamon",
                                                  "/org/Cinnamon",
                                                  "org.freedesktop.DBus.Properties",
                                                  "Set");
        g_dbus_message_set_body (message,
                                 g_variant_new ("(ssv)",
                                                "org.Cinnamon",
                                                "OverviewActive",
                                                g_variant_new ("b",
                                                               FALSE)));

        g_dbus_connection_send_message (grab->priv->session_bus,
                                        message,
                                        G_DBUS_SEND_MESSAGE_FLAGS_NONE,
                                        NULL,
                                        NULL);
        g_object_unref (message);


        message = g_dbus_message_new_method_call ("org.Cinnamon",
                                                  "/org/Cinnamon",
                                                  "org.freedesktop.DBus.Properties",
                                                  "Set");
        g_dbus_message_set_body (message,
                                 g_variant_new ("(ssv)",
                                                "org.Cinnamon",
                                                "ExpoActive",
                                                g_variant_new ("b",
                                                               FALSE)));

        g_dbus_connection_send_message (grab->priv->session_bus,
                                        message,
                                        G_DBUS_SEND_MESSAGE_FLAGS_NONE,
                                        NULL,
                                        NULL);
        g_object_unref (message);
}

gboolean
cs_event_grabber_grab_window (CsEventGrabber    *grab,
                     GdkWindow *window,
                     GdkScreen *screen,
                     gboolean   hide_cursor)
{
        gboolean mstatus = FALSE;
        gboolean kstatus = FALSE;
        int      i;
        int      retries = 4;
        gboolean focus_fuckus = FALSE;

        /* First, have stuff we control in GNOME un-grab */
        request_shell_exit_overview (grab);

 AGAIN:

        for (i = 0; i < retries; i++) {
                kstatus = cs_event_grabber_get_keyboard (grab, window, screen);
                if (kstatus == GDK_GRAB_SUCCESS) {
                        break;
                }

                /* else, wait a second and try to grab again. */
                sleep (1);
        }

        if (kstatus != GDK_GRAB_SUCCESS) {
                if (!focus_fuckus) {
                        focus_fuckus = TRUE;
                        maybe_cancel_ui_grab (grab);
                        cs_event_grabber_nuke_focus ();
                        goto AGAIN;
                }
        }

        for (i = 0; i < retries; i++) {
                mstatus = cs_event_grabber_get_mouse (grab, window, screen, hide_cursor);
                if (mstatus == GDK_GRAB_SUCCESS) {
                        break;
                }

                /* else, wait a second and try to grab again. */
                sleep (1);
        }

        if (mstatus != GDK_GRAB_SUCCESS) {
                g_debug ("Couldn't grab pointer!  (%s)",
                          grab_string (mstatus));
        }

#if 0
        /* FIXME: release the pointer grab so GTK will work */
        event_grabber_release_mouse (grab);
#endif

        /* When should we allow blanking to proceed?  The current theory
           is that both a keyboard grab and a mouse grab are mandatory

           - If we don't have a keyboard grab, then we won't be able to
           read a password to unlock, so the kbd grab is mandatory.

           - If we don't have a mouse grab, then we might not see mouse
           clicks as a signal to unblank, on-screen widgets won't work ideally,
           and event_grabber_move_to_window() will spin forever when it gets called.
        */

        if (kstatus != GDK_GRAB_SUCCESS || mstatus != GDK_GRAB_SUCCESS) {
                /* Do not blank without a keyboard and mouse grabs. */

                /* Release keyboard or mouse which was grabbed. */
                if (kstatus == GDK_GRAB_SUCCESS) {
                        cs_event_grabber_release_keyboard (grab);
                }
                if (mstatus == GDK_GRAB_SUCCESS) {
                        cs_event_grabber_release_mouse (grab);
                }

                return FALSE;
        }

        /* Grab is good, go ahead and blank.  */
        return TRUE;
}

/* this is used to grab the keyboard and mouse to the root */
gboolean
cs_event_grabber_grab_root (CsEventGrabber  *grab,
                   gboolean hide_cursor)
{
        GdkDisplay *display;
        GdkWindow  *root;
        GdkScreen  *screen;
        gboolean    res;

        g_debug ("Grabbing the root window");

        display = gdk_display_get_default ();
        gdk_display_get_pointer (display, &screen, NULL, NULL, NULL);
        root = gdk_screen_get_root_window (screen);

        res = cs_event_grabber_grab_window (grab, root, screen, hide_cursor);

        return res;
}

/* this is used to grab the keyboard and mouse to an offscreen window */
gboolean
cs_event_grabber_grab_offscreen (CsEventGrabber *grab,
                        gboolean hide_cursor)
{
        GdkScreen *screen;
        gboolean   res;

        g_debug ("Grabbing an offscreen window");

        screen = gtk_invisible_get_screen (GTK_INVISIBLE (grab->priv->invisible));
        res = cs_event_grabber_grab_window (grab, gtk_widget_get_window (grab->priv->invisible), screen, hide_cursor);

        return res;
}

/* This is similar to cs_event_grabber_grab_window but doesn't fail */
void
cs_event_grabber_move_to_window (CsEventGrabber    *grab,
                        GdkWindow *window,
                        GdkScreen *screen,
                        gboolean   hide_cursor)
{
        gboolean result = FALSE;

        g_return_if_fail (CS_IS_EVENT_GRABBER (grab));

        xorg_lock_smasher_set_active (grab, FALSE);

        do {
                result = cs_event_grabber_move_keyboard (grab, window, screen);
                gdk_flush ();
        } while (!result);

        do {
                result = cs_event_grabber_move_mouse (grab, window, screen, hide_cursor);
                gdk_flush ();
        } while (!result);
}

static void
cs_event_grabber_class_init (CsEventGrabberClass *klass)
{
        GObjectClass   *object_class = G_OBJECT_CLASS (klass);

        object_class->finalize = cs_event_grabber_finalize;
}

static void
cs_event_grabber_init (CsEventGrabber *grab)
{
        grab->priv = cs_event_grabber_get_instance_private (grab);

        grab->priv->session_bus = g_bus_get_sync (G_BUS_TYPE_SESSION, NULL, NULL);

        grab->priv->xdo = xdo_new (NULL);
        if (grab->priv->xdo == NULL)
        {
            g_warning ("Xdo context could not be created.");
        }

        grab->priv->mouse_hide_cursor = FALSE;
        grab->priv->invisible = gtk_invisible_new ();

        set_net_wm_name (gtk_widget_get_window (grab->priv->invisible),
                         "event-grabber-window");

        gtk_widget_show (grab->priv->invisible);
}

static void
cs_event_grabber_finalize (GObject *object)
{
        CsEventGrabber *grab;

        g_return_if_fail (object != NULL);
        g_return_if_fail (CS_IS_EVENT_GRABBER (object));

        grab = CS_EVENT_GRABBER (object);

        g_object_unref (grab->priv->session_bus);

        g_return_if_fail (grab->priv != NULL);

        gtk_widget_destroy (grab->priv->invisible);

        xdo_free (grab->priv->xdo);

        G_OBJECT_CLASS (cs_event_grabber_parent_class)->finalize (object);
}

CsEventGrabber *
cs_event_grabber_new (void)
{
        if (grab_object) {
                g_object_ref (grab_object);
        } else {
                grab_object = g_object_new (CS_TYPE_EVENT_GRABBER, NULL);
                g_object_add_weak_pointer (grab_object,
                                           (gpointer *) &grab_object);
        }

        return CS_EVENT_GRABBER (grab_object);
}
