#include "config.h"

#include "bg-x11.h"
#include "bg-geometry.h"

#include <gdk/x11/gdkx.h>
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <cairo-xlib.h>

static void
set_root_pixmap_id (Display *xdisplay, Window root, Pixmap pm)
{
    Atom esetroot_atom = XInternAtom (xdisplay, "ESETROOT_PMAP_ID", False);
    Atom rootpmap_atom = XInternAtom (xdisplay, "_XROOTPMAP_ID", False);

    Atom            type;
    int             format;
    unsigned long   nitems, bytes_after;
    unsigned char  *data = NULL;

    int result = XGetWindowProperty (xdisplay, root, esetroot_atom,
                                     0L, 1L, False, XA_PIXMAP,
                                     &type, &format, &nitems, &bytes_after,
                                     &data);

    if (data != NULL) {
        if (result == Success && type == XA_PIXMAP && format == 32 && nitems == 1) {
            GdkDisplay *gdk_display = gdk_display_get_default ();
            gdk_x11_display_error_trap_push (gdk_display);
            XKillClient (xdisplay, *(Pixmap *) data);
            gdk_x11_display_error_trap_pop_ignored (gdk_display);
        }
        XFree (data);
    }

    XChangeProperty (xdisplay, root, esetroot_atom, XA_PIXMAP,
                     32, PropModeReplace, (unsigned char *) &pm, 1);
    XChangeProperty (xdisplay, root, rootpmap_atom, XA_PIXMAP,
                     32, PropModeReplace, (unsigned char *) &pm, 1);
}

void
bg_x11_set_background (GdkDisplay *display, CinnamonBackgroundDaemon *daemon)
{
    Display *xdisplay = GDK_DISPLAY_XDISPLAY (display);
    int      screen   = DefaultScreen (xdisplay);
    Window   root     = gdk_x11_display_get_xrootwindow (display);

    GListModel *monitors = gdk_display_get_monitors (display);
    guint n = g_list_model_get_n_items (monitors);

    if (n == 0)
        return;

    /* X11 has a single screen-wide scale rather than a per-monitor one. GTK4's
       X11 backend divides RandR geometry by it, so monitor rects are logical,
       not device, pixels. */
    int scale = 1;
    {
        g_autoptr(GdkMonitor) first = g_list_model_get_item (monitors, 0);
        scale = gdk_monitor_get_scale_factor (first);
    }
    if (scale < 1)
        scale = 1;

    /* Size the pixmap from the X screen rather than by unioning GDK's monitor
       rects, the way gnome-bg did for years with gdk_screen_get_width(). The
       screen is the authority for the drawable every root-window consumer
       reads, and it is always valid -- GDK's monitor list is not, because GTK4
       appends a monitor before setting that monitor's geometry, so a union
       taken mid-rebuild can come out zero-sized. A zero pixmap is a protocol
       error whose invalid id only surfaces later as a BadPixmap on the root. */
    int dev_w = DisplayWidth (xdisplay, screen);
    int dev_h = DisplayHeight (xdisplay, screen);

    /* Logical, to match the monitor rects the compositing loop reads. The X
       screen origin is always 0,0. */
    GdkRectangle canvas = { 0, 0, dev_w / scale, dev_h / scale };
    int x1 = canvas.x;
    int y1 = canvas.y;

    gboolean spanned = cinnamon_background_daemon_is_spanned (daemon);

    g_debug ("    Setting X11 root pixmap: %dx%d across %u monitor(s) at %dx",
             dev_w, dev_h, n, scale);

    /* Create the pixmap on a throwaway connection set to RetainPermanent so the
     * server keeps it after we close that connection. XKillClient on the previous
     * pixmap then reaps only that throwaway client, never the main GDK connection. */
    const char *dname = gdk_display_get_name (display);
    Display *td = XOpenDisplay (dname);
    if (td == NULL) {
        g_warning ("cinnamon-background-daemon: could not open X display '%s' to create root pixmap",
                   dname ? dname : "NULL");
        return;
    }
    XSetCloseDownMode (td, RetainPermanent);
    Pixmap pm = XCreatePixmap (td, RootWindow (td, screen), dev_w, dev_h,
                               DefaultDepth (td, screen));
    XCloseDisplay (td);

    cairo_surface_t *xs = cairo_xlib_surface_create (xdisplay, pm,
                                                     DefaultVisual (xdisplay, screen),
                                                     dev_w, dev_h);
    if (cairo_surface_status (xs) != CAIRO_STATUS_SUCCESS) {
        g_warning ("cinnamon-background-daemon: cannot draw to %dx%d root pixmap: %s",
                   dev_w, dev_h, cairo_status_to_string (cairo_surface_status (xs)));
        cairo_surface_destroy (xs);

        /* Reap the orphaned RetainPermanent pixmap. */
        gdk_x11_display_error_trap_push (display);
        XKillClient (xdisplay, pm);
        gdk_x11_display_error_trap_pop_ignored (display);
        return;
    }

    for (guint i = 0; i < n; i++) {
        GdkMonitor *mon = g_list_model_get_item (monitors, i);
        GdkRectangle geo;
        gdk_monitor_get_geometry (mon, &geo);

        int w = geo.width;
        int h = geo.height;

        GdkRectangle span = bg_geometry_span (spanned, geo.x, geo.y, w, h, canvas);

        cairo_surface_t *region = cinnamon_background_daemon_render_region (
            daemon, gdk_monitor_get_connector (mon), w, h, &span, scale);

        cairo_t *cr = cairo_create (xs);

        if (cairo_surface_status (region) == CAIRO_STATUS_SUCCESS)
            cairo_set_source_surface (cr, region,
                                      (geo.x - x1) * scale, (geo.y - y1) * scale);
        else
            cairo_set_source_rgb (cr, 0.0, 0.0, 0.0);

        cairo_rectangle (cr, (geo.x - x1) * scale, (geo.y - y1) * scale,
                         w * scale, h * scale);
        cairo_fill (cr);
        cairo_destroy (cr);
        cairo_surface_destroy (region);
        g_object_unref (mon);
    }

    cairo_surface_flush (xs);

    gdk_x11_display_grab (display);

    /* These run on the main connection, so a trap works here - unlike around the
       XCreatePixmap above, which is issued on the throwaway one and whose serials
       belong to a different sequence space. Untrapped, a failure is a g_warning
       or a g_error depending on whether GTK was built with G_ENABLE_DEBUG, so
       catch it and say which monitor layout produced it. */
    gdk_x11_display_error_trap_push (display);

    set_root_pixmap_id (xdisplay, root, pm);

    XSetWindowBackgroundPixmap (xdisplay, root, pm);
    XClearWindow (xdisplay, root);

    gdk_display_flush (display);

    int error_code = gdk_x11_display_error_trap_pop (display);

    gdk_x11_display_ungrab (display);

    cairo_surface_destroy (xs);

    if (error_code != 0) {
        char buf[64];

        XGetErrorText (xdisplay, error_code, buf, sizeof buf);
        g_warning ("cinnamon-background-daemon: could not install the %dx%d root pixmap: %s",
                   dev_w, dev_h, buf);
        return;
    }

    g_debug ("X11 root pixmap installed");
}
