/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_APP_SYSTEM_H__
#define __CINNAMON_APP_SYSTEM_H__

#include <gio/gio.h>
#include <clutter/clutter.h>
#include <meta/window.h>
// TODO: Remove this silly check from cmenu
#define GMENU_I_KNOW_THIS_IS_UNSTABLE
#include <gmenu-tree.h>

#include "cinnamon-app.h"

#define CINNAMON_TYPE_APP_SYSTEM (cinnamon_app_system_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonAppSystem, cinnamon_app_system,
                      CINNAMON, APP_SYSTEM, GObject)

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

GMenuTree * cinnamon_app_system_get_tree (CinnamonAppSystem *self);

#endif /* __CINNAMON_APP_SYSTEM_H__ */
