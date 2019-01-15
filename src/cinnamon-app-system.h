/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_APP_SYSTEM_H__
#define __CINNAMON_APP_SYSTEM_H__

#include <gio/gio.h>
#include <clutter/clutter.h>
#include <meta/window.h>

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

CinnamonApp       *cinnamon_app_system_lookup_app                   (CinnamonAppSystem  *system,
                                                               const char      *id);

CinnamonApp       *cinnamon_app_system_lookup_heuristic_basename    (CinnamonAppSystem  *system,
                                                               const char      *id);

CinnamonApp       *cinnamon_app_system_lookup_startup_wmclass       (CinnamonAppSystem *system,
                                                                     const char     *wmclass);
CinnamonApp       *cinnamon_app_system_lookup_desktop_wmclass       (CinnamonAppSystem *system,
                                                                     const char     *wmclass);

GSList         *cinnamon_app_system_get_all                   (CinnamonAppSystem  *system);

GSList         *cinnamon_app_system_get_running               (CinnamonAppSystem  *self);

char         ***cinnamom_app_system_search                    (const char *search_string);

#endif /* __CINNAMON_APP_SYSTEM_H__ */
