/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_EMBEDDED_WINDOW_H__
#define __SHELL_EMBEDDED_WINDOW_H__

#include <gtk/gtk.h>
#include <clutter/clutter.h>

#define SHELL_TYPE_EMBEDDED_WINDOW                 (shell_embedded_window_get_type ())
#define SHELL_EMBEDDED_WINDOW(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_EMBEDDED_WINDOW, ShellEmbeddedWindow))
#define SHELL_EMBEDDED_WINDOW_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_EMBEDDED_WINDOW, ShellEmbeddedWindowClass))
#define SHELL_IS_EMBEDDED_WINDOW(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_EMBEDDED_WINDOW))
#define SHELL_IS_EMBEDDED_WINDOW_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_EMBEDDED_WINDOW))
#define SHELL_EMBEDDED_WINDOW_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_EMBEDDED_WINDOW, ShellEmbeddedWindowClass))

typedef struct _ShellEmbeddedWindow        ShellEmbeddedWindow;
typedef struct _ShellEmbeddedWindowClass   ShellEmbeddedWindowClass;

typedef struct _ShellEmbeddedWindowPrivate ShellEmbeddedWindowPrivate;

struct _ShellEmbeddedWindow
{
  GtkWindow parent;

  ShellEmbeddedWindowPrivate *priv;
};

struct _ShellEmbeddedWindowClass
{
  GtkWindowClass parent_class;
};

GType shell_embedded_window_get_type (void) G_GNUC_CONST;
GtkWidget *shell_embedded_window_new (ClutterStage *stage);

#endif /* __SHELL_EMBEDDED_WINDOW_H__ */
