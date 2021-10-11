/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_EMBEDDED_WINDOW_H__
#define __CINNAMON_EMBEDDED_WINDOW_H__

#include <gtk/gtk.h>
#include <clutter/clutter.h>

#define CINNAMON_TYPE_EMBEDDED_WINDOW (cinnamon_embedded_window_get_type ())
G_DECLARE_DERIVABLE_TYPE (CinnamonEmbeddedWindow, cinnamon_embedded_window,
                          CINNAMON, EMBEDDED_WINDOW, GtkWindow)

struct _CinnamonEmbeddedWindowClass
{
  GtkWindowClass parent_class;
};

GtkWidget *cinnamon_embedded_window_new (void);

#endif /* __CINNAMON_EMBEDDED_WINDOW_H__ */
