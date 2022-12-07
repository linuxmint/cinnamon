/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_WM_PRIVATE_H__
#define __CINNAMON_WM_PRIVATE_H__

#include "cinnamon-wm.h"

G_BEGIN_DECLS

/* These forward along the different effects from CinnamonPlugin */

void _cinnamon_wm_minimize   (CinnamonWM         *wm,
                           MetaWindowActor *actor);
void _cinnamon_wm_unminimize (CinnamonWM         *wm,
                           MetaWindowActor *actor);
void _cinnamon_wm_size_changed(CinnamonWM         *wm,
                            MetaWindowActor *actor);
void _cinnamon_wm_size_change(CinnamonWM         *wm,
                           MetaWindowActor *actor,
                           MetaSizeChange   which_change,
                           MetaRectangle   *old_frame_rect,
                           MetaRectangle   *old_buffer_rect);
void _cinnamon_wm_map        (CinnamonWM         *wm,
                           MetaWindowActor *actor);
void _cinnamon_wm_destroy    (CinnamonWM         *wm,
                           MetaWindowActor *actor);

void _cinnamon_wm_switch_workspace      (CinnamonWM             *wm,
                                      gint                 from,
                                      gint                 to,
                                      MetaMotionDirection  direction);
void _cinnamon_wm_kill_window_effects   (CinnamonWM             *wm,
                                      MetaWindowActor     *actor);
void _cinnamon_wm_kill_switch_workspace (CinnamonWM             *wm);

void _cinnamon_wm_show_tile_preview     (CinnamonWM         *wm,
                                         MetaWindow         *window,
                                         MetaRectangle      *tile_rect,
                                      int                  tile_monitor);
void _cinnamon_wm_hide_tile_preview     (CinnamonWM         *wm);
void _cinnamon_wm_show_window_menu      (CinnamonWM             *wm,
                                      MetaWindow          *window,
                                      MetaWindowMenuType   menu,
                                      int                  x,
                                      int                  y);
void _cinnamon_wm_show_window_menu_for_rect (CinnamonWM             *wm,
                                          MetaWindow          *window,
                                          MetaWindowMenuType   menu,
                                          MetaRectangle       *rect);

gboolean _cinnamon_wm_filter_keybinding (CinnamonWM             *wm,
                                      MetaKeyBinding      *binding);

void _cinnamon_wm_confirm_display_change (CinnamonWM            *wm);

MetaCloseDialog * _cinnamon_wm_create_close_dialog (CinnamonWM     *wm,
                                                 MetaWindow  *window);

MetaInhibitShortcutsDialog * _cinnamon_wm_create_inhibit_shortcuts_dialog (CinnamonWM     *wm,
                                                                        MetaWindow  *window);

G_END_DECLS

#endif /* __CINNAMON_WM_PRIVATE_H__ */
