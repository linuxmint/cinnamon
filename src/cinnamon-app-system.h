/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_APP_SYSTEM_H__
#define __CINNAMON_APP_SYSTEM_H__

#include <gio/gio.h>
#include <clutter/clutter.h>
#include <meta/window.h>
#define GMENU_I_KNOW_THIS_IS_UNSTABLE
#include <gmenu-tree.h>

#include "cinnamon-app.h"

#define CINNAMON_TYPE_APP_SYSTEM                 (cinnamon_app_system_get_type ())
#define CINNAMON_APP_SYSTEM(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_APP_SYSTEM, CinnamonAppSystem))
#define CINNAMON_APP_SYSTEM_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_APP_SYSTEM, CinnamonAppSystemClass))
#define CINNAMON_IS_APP_SYSTEM(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_APP_SYSTEM))
#define CINNAMON_IS_APP_SYSTEM_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_APP_SYSTEM))
#define CINNAMON_APP_SYSTEM_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_APP_SYSTEM, CinnamonAppSystemClass))

typedef struct _CinnamonAppSystem CinnamonAppSystem;
typedef struct _CinnamonAppSystemClass CinnamonAppSystemClass;
typedef struct _CinnamonAppSystemPrivate CinnamonAppSystemPrivate;

struct _CinnamonAppSystem
{
  GObject parent;

  CinnamonAppSystemPrivate *priv;
};

struct _CinnamonAppSystemClass
{
  GObjectClass parent_class;

  void (*installed_changed)(CinnamonAppSystem *appsys, gpointer user_data);
  void (*favorites_changed)(CinnamonAppSystem *appsys, gpointer user_data);
};

GType           cinnamon_app_system_get_type    (void) G_GNUC_CONST;
CinnamonAppSystem *cinnamon_app_system_get_default (void);

GMenuTree      *cinnamon_app_system_get_tree                     (CinnamonAppSystem *system);

CinnamonApp       *cinnamon_app_system_lookup_app                   (CinnamonAppSystem  *system,
                                                               const char      *id);
CinnamonApp       *cinnamon_app_system_lookup_settings_app          (CinnamonAppSystem  *system,
                                                               const char      *id);


CinnamonApp       *cinnamon_app_system_lookup_app_by_tree_entry     (CinnamonAppSystem  *system,
                                                               GMenuTreeEntry  *entry);
CinnamonApp       *cinnamon_app_system_lookup_settings_app_by_tree_entry     (CinnamonAppSystem  *system,
                                                               GMenuTreeEntry  *entry);
CinnamonApp       *cinnamon_app_system_lookup_app_for_path          (CinnamonAppSystem  *system,
                                                               const char      *desktop_path);
CinnamonApp       *cinnamon_app_system_lookup_heuristic_basename    (CinnamonAppSystem  *system,
                                                               const char      *id);

CinnamonApp       *cinnamon_app_system_lookup_startup_wmclass       (CinnamonAppSystem *system,
                                                                     const char     *wmclass);
CinnamonApp       *cinnamon_app_system_lookup_desktop_wmclass       (CinnamonAppSystem *system,
                                                                     const char     *wmclass);


GSList         *cinnamon_app_system_get_all                   (CinnamonAppSystem  *system);

GSList         *cinnamon_app_system_get_running               (CinnamonAppSystem  *self);

GSList         *cinnamon_app_system_initial_search            (CinnamonAppSystem  *system,
                                                            GSList          *terms);
GSList         *cinnamon_app_system_subsearch                 (CinnamonAppSystem  *system,
                                                            GSList          *previous_results,
                                                            GSList          *terms);

GMenuTree      *cinnamon_app_system_get_settings_tree         (CinnamonAppSystem *system);

GSList         *cinnamon_app_system_search_settings           (CinnamonAppSystem *system,
                                                            GSList         *terms);
CinnamonApp       *cinnamon_app_system_lookup_setting            (CinnamonAppSystem *system,
                                                            const char     *id);

#endif /* __CINNAMON_APP_SYSTEM_H__ */
