/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_WM_H__
#define __SHELL_WM_H__

#include <glib-object.h>
#include <meta/meta-plugin.h>

G_BEGIN_DECLS

typedef struct _ShellWM      ShellWM;
typedef struct _ShellWMClass ShellWMClass;

#define SHELL_TYPE_WM              (shell_wm_get_type ())
#define SHELL_WM(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_WM, ShellWM))
#define SHELL_WM_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_WM, ShellWMClass))
#define SHELL_IS_WM(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_WM))
#define SHELL_IS_WM_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_WM))
#define SHELL_WM_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_WM, ShellWMClass))

struct _ShellWMClass
{
  GObjectClass parent_class;

};

GType    shell_wm_get_type                    (void) G_GNUC_CONST;

ShellWM *shell_wm_new                        (MetaPlugin      *plugin);

void     shell_wm_completed_minimize         (ShellWM         *wm,
                                              MetaWindowActor *actor);
void     shell_wm_completed_maximize         (ShellWM         *wm,
                                              MetaWindowActor *actor);
void     shell_wm_completed_unmaximize       (ShellWM         *wm,
                                              MetaWindowActor *actor);
void     shell_wm_completed_map              (ShellWM         *wm,
                                              MetaWindowActor *actor);
void     shell_wm_completed_destroy          (ShellWM         *wm,
                                              MetaWindowActor *actor);
void     shell_wm_completed_switch_workspace (ShellWM         *wm);

/* Keybinding stuff */
void shell_wm_takeover_keybinding (ShellWM    *wm,
				   const char *binding_name);

G_END_DECLS

#endif /* __SHELL_WM_H__ */
