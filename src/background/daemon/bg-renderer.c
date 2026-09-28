#include "bg-renderer.h"

static void
paint_color (cairo_t *cr, const BgRenderInput *in, const GdkRectangle *span)
{
    if (g_strcmp0 (in->shading, "solid") == 0) {
        gdk_cairo_set_source_rgba (cr, &in->primary);
        cairo_paint (cr);
        return;
    }

    cairo_pattern_t *g;
    if (g_strcmp0 (in->shading, "horizontal") == 0)
        g = cairo_pattern_create_linear (-span->x, 0,
                                         -span->x + span->width, 0);
    else
        g = cairo_pattern_create_linear (0, -span->y,
                                         0, -span->y + span->height);

    cairo_pattern_add_color_stop_rgba (g, 0, in->primary.red, in->primary.green,
                                       in->primary.blue, in->primary.alpha);
    cairo_pattern_add_color_stop_rgba (g, 1, in->secondary.red, in->secondary.green,
                                       in->secondary.blue, in->secondary.alpha);
    cairo_set_source (cr, g);
    cairo_paint (cr);
    cairo_pattern_destroy (g);
}

/* Paint this region, which sits at @span's origin within @span's size. Used
   for both an image surface (Wayland) and a cairo-xlib surface (X11).

   All geometry is in *logical* units and @scale converts them to the target's
   device pixels, so a region is expected to be round(width * scale) by
   round(height * scale) pixels.
*/
void
bg_renderer_paint (cairo_t *cr, const BgRenderInput *in,
                   const GdkRectangle *span,
                   double scale)
{
    cairo_scale (cr, scale, scale);

    paint_color (cr, in, span);

    if (g_strcmp0 (in->placement, "none") == 0 || in->source == NULL)
        return;

    int src_w = gdk_pixbuf_get_width (in->source);
    int src_h = gdk_pixbuf_get_height (in->source);

    if (g_strcmp0 (in->placement, "wallpaper") == 0) {
        /* tile from the span origin so multi-monitor tiling stays aligned */
        cairo_save (cr);
        cairo_translate (cr, -(span->x % src_w), -(span->y % src_h));
        gdk_cairo_set_source_pixbuf (cr, in->source, 0, 0);
        cairo_pattern_set_extend (cairo_get_source (cr), CAIRO_EXTEND_REPEAT);
        cairo_paint (cr);
        cairo_restore (cr);
        return;
    }

    cairo_rectangle_t r = bg_geometry_image_rect (in->placement, src_w, src_h, span);

    /* Clip to the image's own rect so placements that don't cover the region
       (centered, or scaled with a different aspect) leave the color painted
       above showing through, instead of EXTEND_PAD smearing the edge pixels. */
    cairo_save (cr);
    cairo_translate (cr, r.x, r.y);
    cairo_scale (cr, r.width / src_w, r.height / src_h);
    cairo_rectangle (cr, 0, 0, src_w, src_h);
    cairo_clip (cr);
    gdk_cairo_set_source_pixbuf (cr, in->source, 0, 0);
    cairo_pattern_set_extend (cairo_get_source (cr), CAIRO_EXTEND_PAD);
    cairo_paint (cr);
    cairo_restore (cr);
}
