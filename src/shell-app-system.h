/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_APP_SYSTEM_H__
#define __SHELL_APP_SYSTEM_H__

#include <gio/gio.h>
#include <clutter/clutter.h>
#include <meta/window.h>
#define GMENU_I_KNOW_THIS_IS_UNSTABLE
#include <gmenu-tree.h>

#include "shell-app.h"

#define SHELL_TYPE_APP_SYSTEM                 (shell_app_system_get_type ())
#define SHELL_APP_SYSTEM(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_APP_SYSTEM, ShellAppSystem))
#define SHELL_APP_SYSTEM_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_APP_SYSTEM, ShellAppSystemClass))
#define SHELL_IS_APP_SYSTEM(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_APP_SYSTEM))
#define SHELL_IS_APP_SYSTEM_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_APP_SYSTEM))
#define SHELL_APP_SYSTEM_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_APP_SYSTEM, ShellAppSystemClass))

typedef struct _ShellAppSystem ShellAppSystem;
typedef struct _ShellAppSystemClass ShellAppSystemClass;
typedef struct _ShellAppSystemPrivate ShellAppSystemPrivate;

struct _ShellAppSystem
{
  GObject parent;

  ShellAppSystemPrivate *priv;
};

struct _ShellAppSystemClass
{
  GObjectClass parent_class;

  void (*installed_changed)(ShellAppSystem *appsys, gpointer user_data);
  void (*favorites_changed)(ShellAppSystem *appsys, gpointer user_data);
};

GType           shell_app_system_get_type    (void) G_GNUC_CONST;
ShellAppSystem *shell_app_system_get_default (void);

GMenuTree      *shell_app_system_get_tree                     (ShellAppSystem *system);

ShellApp       *shell_app_system_lookup_app                   (ShellAppSystem  *system,
                                                               const char      *id);
ShellApp       *shell_app_system_lookup_app_by_tree_entry     (ShellAppSystem  *system,
                                                               GMenuTreeEntry  *entry);
ShellApp       *shell_app_system_lookup_app_for_path          (ShellAppSystem  *system,
                                                               const char      *desktop_path);
ShellApp       *shell_app_system_lookup_heuristic_basename    (ShellAppSystem  *system,
                                                               const char      *id);


GSList         *shell_app_system_get_all                   (ShellAppSystem  *system);

GSList         *shell_app_system_get_running               (ShellAppSystem  *self);

GSList         *shell_app_system_initial_search            (ShellAppSystem  *system,
                                                            GSList          *terms);
GSList         *shell_app_system_subsearch                 (ShellAppSystem  *system,
                                                            GSList          *previous_results,
                                                            GSList          *terms);

GMenuTree      *shell_app_system_get_settings_tree         (ShellAppSystem *system);

GSList         *shell_app_system_search_settings           (ShellAppSystem *system,
                                                            GSList         *terms);

ShellApp       *shell_app_system_lookup_setting            (ShellAppSystem *system,
                                                            const char     *id);


#endif /* __SHELL_APP_SYSTEM_H__ */
