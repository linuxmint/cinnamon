#include "bg-geometry.h"
#include <glib.h>

/* Monitor rects are always *logical* units. */

/* Bounding box of @mons (the spanned canvas). */
GdkRectangle
bg_geometry_union (const GdkRectangle *mons, guint n_mons)
{
    GdkRectangle u = { 0, 0, 0, 0 };

    if (n_mons == 0)
        return u;

    u = mons[0];
    for (guint i = 1; i < n_mons; i++)
        gdk_rectangle_union (&u, &mons[i], &u);

    return u;
}

/* The slice of the wallpaper a monitor paints: {x, y} is the span origin,
   {width, height} the span total. */
GdkRectangle
bg_geometry_span (gboolean spanned,
                  int monitor_x, int monitor_y,
                  int render_w, int render_h,
                  GdkRectangle canvas)
{
    if (spanned)
        return (GdkRectangle) { monitor_x - canvas.x, monitor_y - canvas.y,
                                 canvas.width, canvas.height };

    return (GdkRectangle) { 0, 0, render_w, render_h };
}


/* Destination rect for the image under `mode`, given the source pixbuf size and
   the *span* rect (for non-spanned modes the span rect equals the target: origin
   0,0 and size == the target's). */
cairo_rectangle_t
bg_geometry_image_rect (const char *mode,
                        int src_w, int src_h,
                        const GdkRectangle *span)
{
    cairo_rectangle_t r = { 0, 0, 0, 0 };

    if (src_w <= 0 || src_h <= 0)
        return r;

    if (g_strcmp0 (mode, "none") == 0 || g_strcmp0 (mode, "wallpaper") == 0) {
        return r;
    } else if (g_strcmp0 (mode, "stretched") == 0) {
        r.width = span->width;
        r.height = span->height;
    } else if (g_strcmp0 (mode, "centered") == 0) {
        r.width = src_w;
        r.height = src_h;
    } else if (g_strcmp0 (mode, "scaled") == 0) {
        double s = MIN ((double) span->width / src_w,
                        (double) span->height / src_h);

        r.width = src_w * s;
        r.height = src_h * s;
    } else {
        /* zoom, and anything the key holds that we do not know. */
        double s = MAX ((double) span->width / src_w,
                        (double) span->height / src_h);

        r.width = src_w * s;
        r.height = src_h * s;
    }

    /* center within the span total, then translate into this region's space */
    r.x = (span->width - r.width) / 2.0 - span->x;
    r.y = (span->height - r.height) / 2.0 - span->y;
    return r;
}
