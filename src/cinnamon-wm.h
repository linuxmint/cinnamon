/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_WM_H__
#define __CINNAMON_WM_H__

#include <glib-object.h>
#include <meta/meta-plugin.h>

G_BEGIN_DECLS


#define CINNAMON_TYPE_WM              (cinnamon_wm_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonWM, cinnamon_wm, CINNAMON, WM, GObject)

CinnamonWM *cinnamon_wm_new                        (MetaPlugin      *plugin);

void     cinnamon_wm_completed_minimize         (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_unminimize       (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_size_change      (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_map              (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_destroy          (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_switch_workspace (CinnamonWM         *wm);
void     cinnamon_wm_complete_display_change    (CinnamonWM         *wm,
                                              gboolean         ok);

G_END_DECLS

#endif /* __CINNAMON_WM_H__ */
