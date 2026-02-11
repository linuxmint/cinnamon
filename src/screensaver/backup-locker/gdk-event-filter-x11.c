/*
 * CsGdkEventFilter: Establishes an X event trap for the backup-locker.
 * It watches for MapNotify/ConfigureNotify events that indicate other
 * windows appearing above us, and raises the backup-locker window to
 * stay on top. This handles override-redirect windows (native popups,
 * notifications, etc.) that could otherwise obscure the locker.
 */

#include "config.h"
#include "gdk-event-filter.h"

#include <X11/Xlib.h>
#include <X11/Xatom.h>

#ifdef HAVE_SHAPE_EXT
#include <X11/extensions/shape.h>
#endif
#include <gtk/gtkx.h>
#include <string.h>

enum {
        XSCREEN_SIZE,
        LAST_SIGNAL
};

static guint signals [LAST_SIGNAL] = { 0, };

struct _CsGdkEventFilter
{
    GObject        parent_instance;

    GdkDisplay    *display;
    GtkWidget     *managed_window;
    gulong         my_xid;

    int            shape_event_base;
};

G_DEFINE_TYPE (CsGdkEventFilter, cs_gdk_event_filter, G_TYPE_OBJECT)

static gchar *
get_net_wm_name (gulong xwindow)
{
    GdkDisplay *display = gdk_display_get_default ();
    Atom net_wm_name_atom;
    Atom type;
    int format;
    unsigned long nitems, after;
    unsigned char *data = NULL;
    gchar *name = NULL;

    net_wm_name_atom = XInternAtom(GDK_DISPLAY_XDISPLAY (display), "_NET_WM_NAME", False);

    XGetWindowProperty(GDK_DISPLAY_XDISPLAY (display),
                       xwindow,
                       net_wm_name_atom, 0, 256,
                       False, AnyPropertyType,
                       &type, &format, &nitems, &after,
                       &data);
    if (data) {
       name = g_strdup((char *) data);
       XFree(data);
    }

    return name;
}

static void
unshape_window (CsGdkEventFilter *filter)
{
    g_return_if_fail (CS_IS_GDK_EVENT_FILTER (filter));

    gdk_window_shape_combine_region (gtk_widget_get_window (GTK_WIDGET (filter->managed_window)),
                                     NULL,
                                     0,
                                     0);
}

static void
raise_self (CsGdkEventFilter *filter,
            Window            event_window,
            const gchar      *event_type)
{
    g_autofree gchar *net_wm_name = NULL;

    gdk_x11_display_error_trap_push (filter->display);

    net_wm_name = get_net_wm_name (event_window);

    if (g_strcmp0 (net_wm_name, "event-grabber-window") == 0)
    {
        g_debug ("(Ignoring %s from CsEventGrabber window)", event_type);
        gdk_x11_display_error_trap_pop_ignored (filter->display);
        return;
    }

    g_debug ("Received %s from window '%s' (0x%lx), raising ourselves.",
              event_type,
              net_wm_name,
              event_window);

    XRaiseWindow(GDK_DISPLAY_XDISPLAY (filter->display), filter->my_xid);
    XFlush (GDK_DISPLAY_XDISPLAY (filter->display));

    gdk_x11_display_error_trap_pop_ignored (filter->display);
}

static GdkFilterReturn
cs_gdk_event_filter_xevent (CsGdkEventFilter *filter,
                            GdkXEvent        *xevent)
{
    XEvent *ev;

    ev = xevent;
    /* MapNotify is used to tell us when new windows are mapped.
       ConfigureNofify is used to tell us when windows are raised. */
    switch (ev->xany.type) {
        case MapNotify:
          {
            XMapEvent *xme = &ev->xmap;

            if (xme->window == filter->my_xid)
            {
                break;
            }

            raise_self (filter, xme->window, "MapNotify");
            break;
          }
        case ConfigureNotify:
          {
            XConfigureEvent *xce = &ev->xconfigure;

            if (xce->window == GDK_ROOT_WINDOW ())
            {
                g_debug ("ConfigureNotify from root window (0x%lx), screen size may have changed.",
                             xce->window);
                g_signal_emit (filter, signals[XSCREEN_SIZE], 0);
                break;
            }

            if (xce->window == filter->my_xid)
            {
                break;
            }

            raise_self (filter, xce->window, "ConfigureNotify");
            break;
          }
        default:
          {
#ifdef HAVE_SHAPE_EXT
            if (ev->xany.type == (filter->shape_event_base + ShapeNotify)) {
                g_debug ("ShapeNotify event.");
                unshape_window (filter);
            }
#endif
          }
    }

    return GDK_FILTER_CONTINUE;
}

static void
select_popup_events (CsGdkEventFilter *filter)
{
    XWindowAttributes attr;
    unsigned long     events;

    gdk_x11_display_error_trap_push (filter->display);

    memset (&attr, 0, sizeof (attr));
    XGetWindowAttributes (GDK_DISPLAY_XDISPLAY (filter->display), GDK_ROOT_WINDOW (), &attr);

    events = SubstructureNotifyMask | attr.your_event_mask;
    XSelectInput (GDK_DISPLAY_XDISPLAY (filter->display), GDK_ROOT_WINDOW (), events);

    gdk_x11_display_error_trap_pop_ignored (filter->display);
}

static void
select_shape_events (CsGdkEventFilter *filter)
{
#ifdef HAVE_SHAPE_EXT
    unsigned long events;
    int           shape_error_base;

    gdk_x11_display_error_trap_push (filter->display);

    if (XShapeQueryExtension (GDK_DISPLAY_XDISPLAY (filter->display), &filter->shape_event_base, &shape_error_base)) {
        events = ShapeNotifyMask;

        XShapeSelectInput (GDK_DISPLAY_XDISPLAY (filter->display),
                           GDK_WINDOW_XID (gtk_widget_get_window (GTK_WIDGET (filter->managed_window))),
                           events);
    }

    gdk_x11_display_error_trap_pop_ignored (filter->display);
#endif
}

static GdkFilterReturn
xevent_filter (GdkXEvent *xevent,
               GdkEvent  *event,
               CsGdkEventFilter *filter)
{
    return cs_gdk_event_filter_xevent (filter, xevent);
}

static void
cs_gdk_event_filter_init (CsGdkEventFilter *filter)
{
    filter->shape_event_base = 0;
    filter->managed_window = NULL;
    filter->my_xid = 0;
}

static void
cs_gdk_event_filter_finalize (GObject *object)
{
    CsGdkEventFilter *filter;

    g_return_if_fail (object != NULL);
    g_return_if_fail (CS_IS_GDK_EVENT_FILTER (object));

    filter = CS_GDK_EVENT_FILTER (object);

    cs_gdk_event_filter_stop (filter);
    g_object_unref (filter->managed_window);

    G_OBJECT_CLASS (cs_gdk_event_filter_parent_class)->finalize (object);
}

static void
cs_gdk_event_filter_class_init (CsGdkEventFilterClass *klass)
{
        GObjectClass   *object_class = G_OBJECT_CLASS (klass);

        object_class->finalize     = cs_gdk_event_filter_finalize;

        signals[XSCREEN_SIZE] = g_signal_new ("xscreen-size",
                                              G_TYPE_FROM_CLASS (object_class),
                                              G_SIGNAL_RUN_LAST,
                                              0,
                                              NULL, NULL, NULL,
                                              G_TYPE_NONE, 0);
}

void
cs_gdk_event_filter_start (CsGdkEventFilter *filter,
                           gboolean          debug)
{
    select_popup_events (filter);
    select_shape_events (filter);

    if (debug)
    {
        g_setenv ("G_MESSAGES_DEBUG", "all", TRUE);
    }

    filter->my_xid = gdk_x11_window_get_xid (gtk_widget_get_window (GTK_WIDGET (filter->managed_window)));

    g_debug ("Starting event filter for backup-locker - 0x%lx", filter->my_xid);
    gdk_window_add_filter (NULL, (GdkFilterFunc) xevent_filter, filter);
}

void
cs_gdk_event_filter_stop (CsGdkEventFilter *filter)
{
    gdk_window_remove_filter (NULL, (GdkFilterFunc) xevent_filter, filter);
}

CsGdkEventFilter *
cs_gdk_event_filter_new (GtkWidget *managed_window)
{
    CsGdkEventFilter *filter;

    filter = g_object_new (CS_TYPE_GDK_EVENT_FILTER,
                           NULL);

    filter->display = gdk_display_get_default ();
    filter->managed_window = g_object_ref (managed_window);

    return filter;
}
