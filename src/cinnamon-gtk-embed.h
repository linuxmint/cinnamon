/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_GTK_EMBED_H__
#define __CINNAMON_GTK_EMBED_H__

#include <clutter/clutter.h>

#include "cinnamon-embedded-window.h"

#define CINNAMON_TYPE_GTK_EMBED (cinnamon_gtk_embed_get_type ())
G_DECLARE_DERIVABLE_TYPE (CinnamonGtkEmbed, cinnamon_gtk_embed,
                          CINNAMON, GTK_EMBED, ClutterClone)

struct _CinnamonGtkEmbedClass
{
    ClutterCloneClass parent_class;
};

ClutterActor *cinnamon_gtk_embed_new (CinnamonEmbeddedWindow *window);

#endif /* __CINNAMON_GTK_EMBED_H__ */
