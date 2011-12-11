/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#ifndef __SHELL_TRAY_MANAGER_H__
#define __SHELL_TRAY_MANAGER_H__

#include <clutter/clutter.h>
#include "st.h"

G_BEGIN_DECLS

#define SHELL_TYPE_TRAY_MANAGER			(shell_tray_manager_get_type ())
#define SHELL_TRAY_MANAGER(obj)			(G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_TRAY_MANAGER, ShellTrayManager))
#define SHELL_TRAY_MANAGER_CLASS(klass)		(G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_TRAY_MANAGER, ShellTrayManagerClass))
#define SHELL_IS_TRAY_MANAGER(obj)		(G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_TRAY_MANAGER))
#define SHELL_IS_TRAY_MANAGER_CLASS(klass)	(G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_TRAY_MANAGER))
#define SHELL_TRAY_MANAGER_GET_CLASS(obj)	(G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_TRAY_MANAGER, ShellTrayManagerClass))
	
typedef struct _ShellTrayManager        ShellTrayManager;
typedef struct _ShellTrayManagerPrivate ShellTrayManagerPrivate;
typedef struct _ShellTrayManagerClass   ShellTrayManagerClass;

struct _ShellTrayManager
{
  GObject parent_instance;

  ShellTrayManagerPrivate *priv;
};

struct _ShellTrayManagerClass
{
  GObjectClass parent_class;

  void (* tray_icon_added)   (ShellTrayManager *manager,
			      ClutterActor     *icon,
			      const char       *lowercase_wm_class);
  void (* tray_icon_removed) (ShellTrayManager *manager,
			      ClutterActor     *icon);

};

GType             shell_tray_manager_get_type     (void);

ShellTrayManager *shell_tray_manager_new          (void);
void              shell_tray_manager_manage_stage (ShellTrayManager *manager,
                                                   ClutterStage     *stage,
                                                   StWidget         *theme_widget);

G_END_DECLS

#endif /* __SHELL_TRAY_MANAGER_H__ */
