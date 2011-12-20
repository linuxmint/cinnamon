/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_ARROW_H__
#define __CINNAMON_ARROW_H__

#include <clutter/clutter.h>
#include <gtk/gtk.h>

#define CINNAMON_TYPE_ARROW                 (cinnamon_arrow_get_type ())
#define CINNAMON_ARROW(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_ARROW, CinnamonArrow))
#define CINNAMON_ARROW_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_ARROW, CinnamonArrowClass))
#define CINNAMON_IS_ARROW(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_ARROW))
#define CINNAMON_IS_ARROW_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_ARROW))
#define CINNAMON_ARROW_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_ARROW, CinnamonArrowClass))

typedef struct _CinnamonArrow        CinnamonArrow;
typedef struct _CinnamonArrowClass   CinnamonArrowClass;

typedef struct _CinnamonArrowPrivate CinnamonArrowPrivate;

struct _CinnamonArrow
{
    ClutterCairoTexture parent;

    CinnamonArrowPrivate *priv;
};

struct _CinnamonArrowClass
{
    ClutterCairoTextureClass parent_class;
};

GType cinnamon_arrow_get_type (void) G_GNUC_CONST;

#endif /* __CINNAMON_ARROW_H__ */
