/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_EMBEDDED_WINDOW_PRIVATE_H__
#define __SHELL_EMBEDDED_WINDOW_PRIVATE_H__

#include "shell-embedded-window.h"
#include "shell-gtk-embed.h"

void _shell_embedded_window_set_actor (ShellEmbeddedWindow      *window,
				       ShellGtkEmbed            *embed);

void _shell_embedded_window_allocate (ShellEmbeddedWindow *window,
				      int                  x,
				      int                  y,
				      int                  width,
				      int                  height);

void _shell_embedded_window_realize   (ShellEmbeddedWindow *window);
void _shell_embedded_window_unrealize (ShellEmbeddedWindow *window);

#endif /* __SHELL_EMBEDDED_WINDOW_PRIVATE_H__ */
