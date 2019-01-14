/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_APP_H__
#define __CINNAMON_APP_H__

#include <clutter/clutter.h>
#include <gio/gio.h>
#include <gio/gdesktopappinfo.h>
#include <meta/window.h>

G_BEGIN_DECLS

#define CINNAMON_TYPE_APP (cinnamon_app_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonApp, cinnamon_app, CINNAMON, APP, GObject)

typedef enum {
  CINNAMON_APP_STATE_STOPPED,
  CINNAMON_APP_STATE_STARTING,
  CINNAMON_APP_STATE_RUNNING
} CinnamonAppState;

const char *cinnamon_app_get_id (CinnamonApp *app);

GDesktopAppInfo *cinnamon_app_get_app_info (CinnamonApp *app);

ClutterActor *cinnamon_app_create_icon_texture (CinnamonApp *app,
                                                int          size);
ClutterActor *cinnamon_app_create_icon_texture_for_window (CinnamonApp   *app,
                                                           int            size,
                                                           MetaWindow    *for_window);
const char *cinnamon_app_get_name (CinnamonApp *app);
const char *cinnamon_app_get_description (CinnamonApp *app);
const char * const *cinnamon_app_get_keywords (CinnamonApp *app);
gboolean cinnamon_app_is_window_backed (CinnamonApp *app);

void cinnamon_app_activate_window (CinnamonApp *app, MetaWindow *window, guint32 timestamp);

void cinnamon_app_activate (CinnamonApp      *app);

void cinnamon_app_activate_full (CinnamonApp      *app,
                              int            workspace,
                              guint32        timestamp);

void cinnamon_app_open_new_window (CinnamonApp *app,
                                int       workspace);

gboolean cinnamon_app_can_open_new_window (CinnamonApp *app);

CinnamonAppState cinnamon_app_get_state (CinnamonApp *app);

gboolean cinnamon_app_request_quit (CinnamonApp *app);

guint cinnamon_app_get_n_windows (CinnamonApp *app);

GSList *cinnamon_app_get_windows (CinnamonApp *app);

GSList *cinnamon_app_get_pids (CinnamonApp *app);

gboolean cinnamon_app_is_on_workspace (CinnamonApp *app, MetaWorkspace *workspace);

gboolean cinnamon_app_launch (CinnamonApp     *app,
                           guint         timestamp,
                           int           workspace,
                           gboolean      discrete_gpu,
                           GError      **error);

void cinnamon_app_launch_action (CinnamonApp  *app,
                              const char      *action_name,
                              guint            timestamp,
                              int              workspace);

int cinnamon_app_compare_by_name (CinnamonApp *app, CinnamonApp *other);

int cinnamon_app_compare (CinnamonApp *app, CinnamonApp *other);

gboolean cinnamon_app_get_busy          (CinnamonApp *app);

G_END_DECLS

#endif /* __CINNAMON_APP_H__ */
