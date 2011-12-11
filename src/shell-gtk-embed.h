/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_GTK_EMBED_H__
#define __SHELL_GTK_EMBED_H__

#include <clutter/x11/clutter-x11.h>

#include "shell-embedded-window.h"

#define SHELL_TYPE_GTK_EMBED                 (shell_gtk_embed_get_type ())
#define SHELL_GTK_EMBED(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_GTK_EMBED, ShellGtkEmbed))
#define SHELL_GTK_EMBED_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_GTK_EMBED, ShellGtkEmbedClass))
#define SHELL_IS_GTK_EMBED(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_GTK_EMBED))
#define SHELL_IS_GTK_EMBED_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_GTK_EMBED))
#define SHELL_GTK_EMBED_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_GTK_EMBED, ShellGtkEmbedClass))

typedef struct _ShellGtkEmbed        ShellGtkEmbed;
typedef struct _ShellGtkEmbedClass   ShellGtkEmbedClass;
typedef struct _ShellGtkEmbedPrivate ShellGtkEmbedPrivate;

struct _ShellGtkEmbed
{
    ClutterX11TexturePixmap parent;

    ShellGtkEmbedPrivate *priv;
};

struct _ShellGtkEmbedClass
{
    ClutterX11TexturePixmapClass parent_class;
};

GType shell_gtk_embed_get_type (void) G_GNUC_CONST;
ClutterActor *shell_gtk_embed_new (ShellEmbeddedWindow *window);

#endif /* __SHELL_GTK_EMBED_H__ */
