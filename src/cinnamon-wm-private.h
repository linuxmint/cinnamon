/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_WM_PRIVATE_H__
#define __CINNAMON_WM_PRIVATE_H__

#include "cinnamon-wm.h"

G_BEGIN_DECLS

/* These forward along the different effects from CinnamonPlugin */

void _cinnamon_wm_minimize   (CinnamonWM         *wm,
                           MetaWindowActor *actor);
void _cinnamon_wm_maximize   (CinnamonWM         *wm,
                           MetaWindowActor *actor,
                           gint             x,
                           gint             y,
                           gint             width,
                           gint             height);
void _cinnamon_wm_unmaximize (CinnamonWM         *wm,
                           MetaWindowActor *actor,
                           gint             x,
                           gint             y,
                           gint             width,
                           gint             height);
void _cinnamon_wm_tile       (CinnamonWM         *wm,
                           MetaWindowActor *actor,
                           gint             x,
                           gint             y,
                           gint             width,
                           gint             height);
void _cinnamon_wm_map        (CinnamonWM         *wm,
                           MetaWindowActor *actor);
void _cinnamon_wm_destroy    (CinnamonWM         *wm,
                           MetaWindowActor *actor);

void _cinnamon_wm_switch_workspace      (CinnamonWM             *wm,
                                      gint                 from,
                                      gint                 to,
                                      MetaMotionDirection  direction);

void _cinnamon_wm_show_tile_preview     (CinnamonWM         *wm,
                                         MetaWindow         *window,
                                         MetaRectangle      *tile_rect,
                                         int                tile_monitor,
                                         guint              snap_queued);
void _cinnamon_wm_hide_tile_preview     (CinnamonWM         *wm);

void _cinnamon_wm_show_hud_preview     (CinnamonWM          *wm,
                                        guint               current_proximity_zone,
                                        MetaRectangle       *work_area,
                                        guint               snap_queued);

void _cinnamon_wm_hide_hud_preview     (CinnamonWM         *wm);

void _cinnamon_wm_kill_window_effects   (CinnamonWM             *wm,
                                      MetaWindowActor     *actor);

G_END_DECLS

#endif /* __CINNAMON_WM_PRIVATE_H__ */
