/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_WM_H__
#define __CINNAMON_WM_H__

#include <glib-object.h>
#include <meta/meta-plugin.h>

G_BEGIN_DECLS

typedef struct _CinnamonWM      CinnamonWM;
typedef struct _CinnamonWMClass CinnamonWMClass;

#define CINNAMON_TYPE_WM              (cinnamon_wm_get_type ())
#define CINNAMON_WM(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_WM, CinnamonWM))
#define CINNAMON_WM_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_WM, CinnamonWMClass))
#define CINNAMON_IS_WM(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_WM))
#define CINNAMON_IS_WM_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_WM))
#define CINNAMON_WM_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_WM, CinnamonWMClass))

struct _CinnamonWMClass
{
  GObjectClass parent_class;

};

GType    cinnamon_wm_get_type                    (void) G_GNUC_CONST;

CinnamonWM *cinnamon_wm_new                        (MetaPlugin      *plugin);

void     cinnamon_wm_completed_minimize         (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_maximize         (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_tile             (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_unmaximize       (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_map              (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_destroy          (CinnamonWM         *wm,
                                              MetaWindowActor *actor);
void     cinnamon_wm_completed_switch_workspace (CinnamonWM         *wm);

G_END_DECLS

#endif /* __CINNAMON_WM_H__ */
