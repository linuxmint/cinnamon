/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_EMBEDDED_WINDOW_PRIVATE_H__
#define __CINNAMON_EMBEDDED_WINDOW_PRIVATE_H__

#include "cinnamon-embedded-window.h"
#include "cinnamon-gtk-embed.h"

void _cinnamon_embedded_window_set_actor (CinnamonEmbeddedWindow      *window,
				       CinnamonGtkEmbed            *embed);

void _cinnamon_embedded_window_allocate (CinnamonEmbeddedWindow *window,
				      int                  x,
				      int                  y,
				      int                  width,
				      int                  height);

void _cinnamon_embedded_window_map   (CinnamonEmbeddedWindow *window);
void _cinnamon_embedded_window_unmap (CinnamonEmbeddedWindow *window);

#endif /* __CINNAMON_EMBEDDED_WINDOW_PRIVATE_H__ */
