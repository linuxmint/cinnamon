/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_APP_PRIVATE_H__
#define __SHELL_APP_PRIVATE_H__

#include "shell-app.h"
#include "shell-app-system.h"

#define SN_API_NOT_YET_FROZEN 1
#include <libsn/sn.h>

G_BEGIN_DECLS

ShellApp* _shell_app_new_for_window (MetaWindow *window);

ShellApp* _shell_app_new (GMenuTreeEntry *entry);

void _shell_app_set_entry (ShellApp *app, GMenuTreeEntry *entry);

void _shell_app_handle_startup_sequence (ShellApp *app, SnStartupSequence *sequence);

void _shell_app_add_window (ShellApp *app, MetaWindow *window);

void _shell_app_remove_window (ShellApp *app, MetaWindow *window);

void _shell_app_do_match (ShellApp         *app,
                          GSList           *terms,
                          GSList          **prefix_results,
                          GSList          **substring_results);

G_END_DECLS

#endif /* __SHELL_APP_PRIVATE_H__ */
