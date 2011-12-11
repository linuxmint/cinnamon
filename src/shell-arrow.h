/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_ARROW_H__
#define __SHELL_ARROW_H__

#include <clutter/clutter.h>
#include <gtk/gtk.h>

#define SHELL_TYPE_ARROW                 (shell_arrow_get_type ())
#define SHELL_ARROW(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_ARROW, ShellArrow))
#define SHELL_ARROW_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_ARROW, ShellArrowClass))
#define SHELL_IS_ARROW(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_ARROW))
#define SHELL_IS_ARROW_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_ARROW))
#define SHELL_ARROW_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_ARROW, ShellArrowClass))

typedef struct _ShellArrow        ShellArrow;
typedef struct _ShellArrowClass   ShellArrowClass;

typedef struct _ShellArrowPrivate ShellArrowPrivate;

struct _ShellArrow
{
    ClutterCairoTexture parent;

    ShellArrowPrivate *priv;
};

struct _ShellArrowClass
{
    ClutterCairoTextureClass parent_class;
};

GType shell_arrow_get_type (void) G_GNUC_CONST;

#endif /* __SHELL_ARROW_H__ */
