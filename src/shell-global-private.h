/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_GLOBAL_PRIVATE_H__
#define __SHELL_GLOBAL_PRIVATE_H__

#include "shell-global.h"

#include <gjs/gjs.h>

void _shell_global_init            (const char *first_property_name,
                                    ...);
void _shell_global_set_plugin      (ShellGlobal  *global,
                                    MetaPlugin   *plugin);

GjsContext *_shell_global_get_gjs_context (ShellGlobal  *global);

gboolean _shell_global_check_xdnd_event (ShellGlobal  *global,
                                         XEvent       *xev);

void     _shell_global_set_session_type (ShellGlobal      *global,
                                         ShellSessionType  session_type);

/* Used for async screenshot grabbing */
typedef struct _screenshot_data {
  ShellGlobal  *global;

  char *filename;

  int x;
  int y;
  int width;
  int height;

  ShellGlobalScreenshotCallback callback;
} _screenshot_data;

#endif /* __SHELL_GLOBAL_PRIVATE_H__ */
