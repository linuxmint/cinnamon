#pragma once

#include <gdk/gdk.h>
#include <cinnamon-bg-enums.h>

GdkRectangle bg_geometry_union (const GdkRectangle *mons, guint n_mons);
GdkRectangle bg_geometry_span (gboolean spanned,
                               int monitor_x, int monitor_y,
                               int render_w, int render_h,
                               GdkRectangle canvas);
cairo_rectangle_t bg_geometry_image_rect (const char *mode,
                                          int src_w, int src_h,
                                          const GdkRectangle *span);
