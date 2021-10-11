/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#ifndef __CINNAMON_TRAY_MANAGER_H__
#define __CINNAMON_TRAY_MANAGER_H__

#include <clutter/clutter.h>
#include "st.h"

G_BEGIN_DECLS

#define CINNAMON_TYPE_TRAY_MANAGER (cinnamon_tray_manager_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonTrayManager, cinnamon_tray_manager,
                      CINNAMON, TRAY_MANAGER, GObject)

CinnamonTrayManager *cinnamon_tray_manager_new          (void);
void              cinnamon_tray_manager_manage_screen (CinnamonTrayManager *manager,
                                                    StWidget         *theme_widget);
void              cinnamon_tray_manager_unmanage_screen (CinnamonTrayManager *manager);
void              cinnamon_tray_manager_redisplay (CinnamonTrayManager *manager);
void              cinnamon_tray_manager_set_orientation (CinnamonTrayManager *manager,
                                                         ClutterOrientation   orientation);
G_END_DECLS

#endif /* __CINNAMON_TRAY_MANAGER_H__ */
