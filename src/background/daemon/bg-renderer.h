#pragma once

#include <gtk/gtk.h>
#include "bg-geometry.h"

typedef struct {
    char       *placement;
    char       *shading;
    GdkRGBA     primary;
    GdkRGBA     secondary;
    char       *uri;

    GdkPixbuf  *source;
} BgRenderInput;

void bg_renderer_paint (cairo_t *cr, const BgRenderInput *in,
                        const GdkRectangle *span,
                        double scale);
