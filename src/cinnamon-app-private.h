/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_APP_PRIVATE_H__
#define __CINNAMON_APP_PRIVATE_H__

#include "cinnamon-app.h"
#include "cinnamon-app-system.h"

#define SN_API_NOT_YET_FROZEN 1
#include <libsn/sn.h>

G_BEGIN_DECLS

CinnamonApp* _cinnamon_app_new_for_window (MetaWindow *window);

CinnamonApp* _cinnamon_app_new (GMenuTreeEntry *entry);

void _cinnamon_app_set_entry (CinnamonApp *app, GMenuTreeEntry *entry);

void _cinnamon_app_handle_startup_sequence (CinnamonApp *app, SnStartupSequence *sequence);

void _cinnamon_app_add_window (CinnamonApp *app, MetaWindow *window);

void _cinnamon_app_remove_window (CinnamonApp *app, MetaWindow *window);

void _cinnamon_app_do_match (CinnamonApp         *app,
                          GSList           *terms,
                          GSList          **prefix_results,
                          GSList          **substring_results);

G_END_DECLS

#endif /* __CINNAMON_APP_PRIVATE_H__ */
