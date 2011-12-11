/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_APP_H__
#define __SHELL_APP_H__

#include <clutter/clutter.h>
#include <gio/gio.h>
#include <meta/window.h>
#define GMENU_I_KNOW_THIS_IS_UNSTABLE
#include <gmenu-tree.h>

G_BEGIN_DECLS

typedef struct _ShellApp ShellApp;
typedef struct _ShellAppClass ShellAppClass;
typedef struct _ShellAppPrivate ShellAppPrivate;

#define SHELL_TYPE_APP              (shell_app_get_type ())
#define SHELL_APP(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_APP, ShellApp))
#define SHELL_APP_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_APP, ShellAppClass))
#define SHELL_IS_APP(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_APP))
#define SHELL_IS_APP_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_APP))
#define SHELL_APP_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_APP, ShellAppClass))

struct _ShellAppClass
{
  GObjectClass parent_class;

};

typedef enum {
  SHELL_APP_STATE_STOPPED,
  SHELL_APP_STATE_STARTING,
  SHELL_APP_STATE_RUNNING
} ShellAppState;

GType shell_app_get_type (void) G_GNUC_CONST;

const char *shell_app_get_id (ShellApp *app);
GMenuTreeEntry *shell_app_get_tree_entry (ShellApp *app);
GDesktopAppInfo *shell_app_get_app_info (ShellApp *app);

ClutterActor *shell_app_create_icon_texture (ShellApp *app, int size);
ClutterActor *shell_app_get_faded_icon (ShellApp *app, int size);
const char *shell_app_get_name (ShellApp *app);
const char *shell_app_get_description (ShellApp *app);
gboolean shell_app_is_window_backed (ShellApp *app);

void shell_app_activate_window (ShellApp *app, MetaWindow *window, guint32 timestamp);

void shell_app_activate (ShellApp      *app);

void shell_app_activate_full (ShellApp      *app,
                              int            workspace,
                              guint32        timestamp);

void shell_app_open_new_window (ShellApp *app,
                                int       workspace);

ShellAppState shell_app_get_state (ShellApp *app);

gboolean shell_app_request_quit (ShellApp *app);

guint shell_app_get_n_windows (ShellApp *app);

GSList *shell_app_get_windows (ShellApp *app);

GSList *shell_app_get_pids (ShellApp *app);

gboolean shell_app_is_on_workspace (ShellApp *app, MetaWorkspace *workspace);

gboolean shell_app_launch (ShellApp     *app,
                           guint         timestamp,
                           GList        *uris,
                           int           workspace,
                           char        **startup_id,
                           GError      **error);

int shell_app_compare_by_name (ShellApp *app, ShellApp *other);

int shell_app_compare (ShellApp *app, ShellApp *other);

G_END_DECLS

#endif /* __SHELL_APP_H__ */
