/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_GTK_EMBED_H__
#define __CINNAMON_GTK_EMBED_H__

#include <clutter/x11/clutter-x11.h>

#include "cinnamon-embedded-window.h"

#define CINNAMON_TYPE_GTK_EMBED                 (cinnamon_gtk_embed_get_type ())
#define CINNAMON_GTK_EMBED(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_GTK_EMBED, CinnamonGtkEmbed))
#define CINNAMON_GTK_EMBED_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_GTK_EMBED, CinnamonGtkEmbedClass))
#define CINNAMON_IS_GTK_EMBED(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_GTK_EMBED))
#define CINNAMON_IS_GTK_EMBED_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_GTK_EMBED))
#define CINNAMON_GTK_EMBED_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_GTK_EMBED, CinnamonGtkEmbedClass))

typedef struct _CinnamonGtkEmbed        CinnamonGtkEmbed;
typedef struct _CinnamonGtkEmbedClass   CinnamonGtkEmbedClass;
typedef struct _CinnamonGtkEmbedPrivate CinnamonGtkEmbedPrivate;

struct _CinnamonGtkEmbed
{
    ClutterX11TexturePixmap parent;

    CinnamonGtkEmbedPrivate *priv;
};

struct _CinnamonGtkEmbedClass
{
    ClutterX11TexturePixmapClass parent_class;
};

GType cinnamon_gtk_embed_get_type (void) G_GNUC_CONST;
ClutterActor *cinnamon_gtk_embed_new (CinnamonEmbeddedWindow *window);

#endif /* __CINNAMON_GTK_EMBED_H__ */
