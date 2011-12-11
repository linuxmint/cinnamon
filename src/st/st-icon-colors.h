/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __ST_ICON_COLORS__
#define __ST_ICON_COLORS__

#include <clutter/clutter.h>

G_BEGIN_DECLS

#define ST_TYPE_ICON_COLORS (st_icon_colors_get_type ())

typedef struct _StIconColors StIconColors;

/**
 * StIconColors:
 * @foreground: foreground color
 * @warning: color indicating a warning state
 * @error: color indicating an error state
 * @success: color indicating a successful operation
 *
 * The #StIconColors structure encapsulates colors for colorizing a symbolic
 * icon.
 */
struct _StIconColors {
  volatile guint ref_count;

  ClutterColor foreground;
  ClutterColor warning;
  ClutterColor error;
  ClutterColor success;
};

GType     st_icon_colors_get_type (void) G_GNUC_CONST;

StIconColors *st_icon_colors_new   (void);
StIconColors *st_icon_colors_ref   (StIconColors *colors);
void          st_icon_colors_unref (StIconColors *colors);
StIconColors *st_icon_colors_copy  (StIconColors *colors);

G_END_DECLS

#endif /* __ST_ICON_COLORS__ */
