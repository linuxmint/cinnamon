/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#ifndef __CINNAMON_TRAY_MANAGER_H__
#define __CINNAMON_TRAY_MANAGER_H__

#include <clutter/clutter.h>
#include "st.h"

G_BEGIN_DECLS

#define CINNAMON_TYPE_TRAY_MANAGER			(cinnamon_tray_manager_get_type ())
#define CINNAMON_TRAY_MANAGER(obj)			(G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_TRAY_MANAGER, CinnamonTrayManager))
#define CINNAMON_TRAY_MANAGER_CLASS(klass)		(G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_TRAY_MANAGER, CinnamonTrayManagerClass))
#define CINNAMON_IS_TRAY_MANAGER(obj)		(G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_TRAY_MANAGER))
#define CINNAMON_IS_TRAY_MANAGER_CLASS(klass)	(G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_TRAY_MANAGER))
#define CINNAMON_TRAY_MANAGER_GET_CLASS(obj)	(G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_TRAY_MANAGER, CinnamonTrayManagerClass))
	
typedef struct _CinnamonTrayManager        CinnamonTrayManager;
typedef struct _CinnamonTrayManagerPrivate CinnamonTrayManagerPrivate;
typedef struct _CinnamonTrayManagerClass   CinnamonTrayManagerClass;

struct _CinnamonTrayManager
{
  GObject parent_instance;

  CinnamonTrayManagerPrivate *priv;
};

struct _CinnamonTrayManagerClass
{
  GObjectClass parent_class;

  void (* tray_icon_added)   (CinnamonTrayManager *manager,
			      ClutterActor     *icon,
			      const char       *lowercase_wm_class);
  void (* tray_icon_removed) (CinnamonTrayManager *manager,
			      ClutterActor     *icon);

};

GType             cinnamon_tray_manager_get_type     (void);

CinnamonTrayManager *cinnamon_tray_manager_new          (void);
void              cinnamon_tray_manager_manage_stage (CinnamonTrayManager *manager,
                                                   ClutterStage     *stage,
                                                   StWidget         *theme_widget);
void              cinnamon_tray_manager_redisplay (CinnamonTrayManager *manager);

G_END_DECLS

#endif /* __CINNAMON_TRAY_MANAGER_H__ */
