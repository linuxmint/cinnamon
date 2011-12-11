/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_WM_PRIVATE_H__
#define __SHELL_WM_PRIVATE_H__

#include "shell-wm.h"

G_BEGIN_DECLS

/* These forward along the different effects from GnomeShellPlugin */

void _shell_wm_minimize   (ShellWM         *wm,
                           MetaWindowActor *actor);
void _shell_wm_maximize   (ShellWM         *wm,
                           MetaWindowActor *actor,
                           gint             x,
                           gint             y,
                           gint             width,
                           gint             height);
void _shell_wm_unmaximize (ShellWM         *wm,
                           MetaWindowActor *actor,
                           gint             x,
                           gint             y,
                           gint             width,
                           gint             height);
void _shell_wm_map        (ShellWM         *wm,
                           MetaWindowActor *actor);
void _shell_wm_destroy    (ShellWM         *wm,
                           MetaWindowActor *actor);

void _shell_wm_switch_workspace      (ShellWM             *wm,
                                      gint                 from,
                                      gint                 to,
                                      MetaMotionDirection  direction);
void _shell_wm_kill_window_effects   (ShellWM             *wm,
                                      MetaWindowActor     *actor);
void _shell_wm_kill_switch_workspace (ShellWM             *wm);

G_END_DECLS

#endif /* __SHELL_WM_PRIVATE_H__ */
