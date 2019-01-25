/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <string.h>

#include <glib/gi18n-lib.h>

#include <meta/display.h>

#include "cinnamon-app-private.h"
#include "cinnamon-enum-types.h"
#include "cinnamon-global.h"
#include "cinnamon-util.h"
#include "cinnamon-app-system-private.h"
#include "cinnamon-window-tracker-private.h"
#include "st.h"

#ifdef HAVE_SYSTEMD
#include <systemd/sd-journal.h>
#include <errno.h>
#include <unistd.h>
#endif

typedef enum {
  MATCH_NONE,
  MATCH_SUBSTRING, /* Not prefix, substring */
  MATCH_PREFIX, /* Strict prefix */
} CinnamonAppSearchMatch;

/* This is mainly a memory usage optimization - the user is going to
 * be running far fewer of the applications at one time than they have
 * installed.  But it also just helps keep the code more logically
 * separated.
 */
typedef struct {
  guint refcount;

  /* Signal connection to dirty window sort list on workspace changes */
  guint workspace_switch_id;

  GSList *windows;

  /* Whether or not we need to resort the windows; this is done on demand */
  guint window_sort_stale : 1;

} CinnamonAppRunningState;

/**
 * SECTION:cinnamon-app
 * @short_description: Object representing an application
 *
 * This object wraps a #GDesktopAppInfo, providing methods and signals
 * primarily useful for running applications.
 */
struct _CinnamonApp
{
  GObject parent;

  int started_on_workspace;

  CinnamonAppState state;

  GDesktopAppInfo *info; /* If NULL, this app is backed by one or more
                          * MetaWindow.  For purposes of app title
                          * etc., we use the first window added,
                          * because it's most likely to be what we
                          * want (e.g. it will be of TYPE_NORMAL from
                          * the way cinnamon-window-tracker.c works).
                          */

  CinnamonAppRunningState *running_state;

  char *window_id_string;
  char *name_collation_key;
};

enum {
  PROP_0,
  PROP_STATE,
  PROP_ID,
  PROP_APP_INFO
};

enum {
  WINDOWS_CHANGED,
  LAST_SIGNAL
};

static guint cinnamon_app_signals[LAST_SIGNAL] = { 0 };

static void create_running_state (CinnamonApp *app);
static void unref_running_state (CinnamonAppRunningState *state);

G_DEFINE_TYPE (CinnamonApp, cinnamon_app, G_TYPE_OBJECT)

static void
cinnamon_app_get_property (GObject    *gobject,
                        guint       prop_id,
                        GValue     *value,
                        GParamSpec *pspec)
{
  CinnamonApp *app = CINNAMON_APP (gobject);

  switch (prop_id)
    {
    case PROP_STATE:
      g_value_set_enum (value, app->state);
      break;
    case PROP_ID:
      g_value_set_string (value, cinnamon_app_get_id (app));
      break;
    case PROP_APP_INFO:
      if (app->info)
        g_value_set_object (value, app->info);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
cinnamon_app_set_property (GObject      *gobject,
                        guint         prop_id,
                        const GValue *value,
                        GParamSpec   *pspec)
{
  CinnamonApp *app = CINNAMON_APP (gobject);

  switch (prop_id)
    {
    case PROP_APP_INFO:
      _cinnamon_app_set_app_info (app, g_value_get_object (value));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

const char *
cinnamon_app_get_id (CinnamonApp *app)
{
  if (app->info)
    return g_app_info_get_id (G_APP_INFO (app->info));
  return app->window_id_string;
}

static MetaWindow *
window_backed_app_get_window (CinnamonApp     *app)
{
  g_assert (app->info == NULL);
  if (app->running_state)
    {
      g_assert (app->running_state->windows);
      return app->running_state->windows->data;
    }
  else
    return NULL;
}

static ClutterActor *
get_actor_for_icon_name (CinnamonApp *app,
                         const gchar *icon_name,
                         gint         size)
{
  ClutterActor *actor;
  GIcon *icon;

  icon = NULL;
  actor = NULL;

  if (g_path_is_absolute (icon_name))
    {
      GFile *icon_file;

      icon_file = g_file_new_for_path (icon_name);
      icon = g_file_icon_new (icon_file);

      g_object_unref (icon_file);
    }
  else
    {
      icon = g_themed_icon_new (icon_name);
    }

  if (icon != NULL)
  {
    actor = g_object_new (ST_TYPE_ICON, "gicon", icon, "icon-size", size, NULL);
    g_object_unref (icon);
  }

  return actor;
}

static ClutterActor *
window_backed_app_get_icon (CinnamonApp *app,
                            int          size)
{
  MetaWindow *window = NULL;
  ClutterActor *actor;
  gint scale;
  CinnamonGlobal *global;
  StThemeContext *context;

  actor = NULL;

  global = cinnamon_global_get ();
  context = st_theme_context_get_for_stage (cinnamon_global_get_stage (global));
  g_object_get (context, "scale-factor", &scale, NULL);

  /* During a state transition from running to not-running for
   * window-backend apps, it's possible we get a request for the icon.
   * Avoid asserting here and just return an empty image.
   */
  if (app->running_state != NULL)
    window = window_backed_app_get_window (app);

  if (window == NULL)
    {
      actor = clutter_texture_new ();
      g_object_set (actor, "opacity", 0, "width", (float) size, "height", (float) size, NULL);
      return actor;
    }

  size *= scale;

  actor = st_texture_cache_bind_pixbuf_property (st_texture_cache_get_default (),
                                                 G_OBJECT (window), "icon");
  g_object_set (actor, "width", (float) size, "height", (float) size, NULL);

  return actor;
}

/**
 * cinnamon_app_create_icon_texture:
 * @app: a #CinnamonApp
 * @size: the size of the icon to create
 *
 * Look up the icon for this application, and create a #ClutterTexture
 * for it at the given size.
 *
 * Return value: (transfer none): A floating #ClutterActor
 */
ClutterActor *
cinnamon_app_create_icon_texture (CinnamonApp   *app,
                                  int            size)
{
  GIcon *icon;
  ClutterActor *ret;

  ret = NULL;

  if (app->info == NULL)
    {
      return window_backed_app_get_icon (app, size);
    }

  icon = g_app_info_get_icon (G_APP_INFO (app->info));

  if (icon != NULL)
    {
      ret = g_object_new (ST_TYPE_ICON, "gicon", icon, "icon-size", size, NULL);
    }

  if (ret == NULL)
    {
      icon = g_themed_icon_new ("application-x-executable");
      ret = g_object_new (ST_TYPE_ICON, "gicon", icon, "icon-size", size, NULL);
      g_object_unref (icon);
    }

  return ret;
}

/**
 * cinnamon_app_create_icon_texture_for_window:
 * @app: a #CinnamonApp
 * @size: the size of the icon to create
 * @for_window: (nullable): Optional - the backing MetaWindow to look up for.
 *
 * Look up the icon for this application, and create a #ClutterTexture
 * for it at the given size.  If for_window is NULL, it bases the icon
 * off the most-recently-used window for the app, otherwise it attempts to
 * use for_window for determining the icon.
 *
 * Return value: (transfer none): A floating #ClutterActor
 */
ClutterActor *
cinnamon_app_create_icon_texture_for_window (CinnamonApp   *app,
                                             int            size,
                                             MetaWindow    *for_window)
{
  MetaWindow *window;

  window = NULL;

  if (app->running_state != NULL)
  {
    const gchar *icon_name;

    if (for_window != NULL)
      {
        if (g_slist_find (app->running_state->windows, for_window) != NULL)
          {
            window = for_window;
          }
        else
          {
            g_warning ("cinnamon_app_create_icon_texture: MetaWindow %p provided that does not match App %p",
                       for_window, app);
          }
      }

    if (window != NULL)
      {
        icon_name = meta_window_get_icon_name (window);

        if (icon_name != NULL)
          {
            return get_actor_for_icon_name (app, icon_name, size);
          }
      }
  }

  return cinnamon_app_create_icon_texture (app, size);
}

const char *
cinnamon_app_get_name (CinnamonApp *app)
{
  if (app->info)
    return g_app_info_get_name (G_APP_INFO (app->info));
  else if (app->running_state == NULL)
    return _("Unknown");
  else
    {
      MetaWindow *window = window_backed_app_get_window (app);
      const char *name = NULL;

      if (window)
        name = meta_window_get_wm_class (window);
      if (!name)
        name = _("Unknown");
      return name;
    }
}

const char *
cinnamon_app_get_description (CinnamonApp *app)
{
  if (app->info)
    return g_app_info_get_description (G_APP_INFO (app->info));
  else
    return NULL;
}

const char * const *
cinnamon_app_get_keywords (CinnamonApp *app)
{
  if (app->info)
    return g_desktop_app_info_get_keywords (app->info);
  else
    return NULL;
}

/**
 * cinnamon_app_is_window_backed:
 *
 * A window backed application is one which represents just an open
 * window, i.e. there's no .desktop file association, so we don't know
 * how to launch it again.
 */
gboolean
cinnamon_app_is_window_backed (CinnamonApp *app)
{
  return app->info == NULL;
}

typedef struct {
  MetaWorkspace *workspace;
  GSList **transients;
} CollectTransientsData;

static gboolean
collect_transients_on_workspace (MetaWindow *window,
                                 gpointer    datap)
{
  CollectTransientsData *data = datap;

  if (data->workspace && meta_window_get_workspace (window) != data->workspace)
    return TRUE;

  *data->transients = g_slist_prepend (*data->transients, window);
  return TRUE;
}

/* The basic idea here is that when we're targeting a window,
 * if it has transients we want to pick the most recent one
 * the user interacted with.
 * This function makes raising GEdit with the file chooser
 * open work correctly.
 */
static MetaWindow *
find_most_recent_transient_on_same_workspace (MetaDisplay *display,
                                              MetaWindow  *reference)
{
  GSList *transients, *transients_sorted, *iter;
  MetaWindow *result;
  CollectTransientsData data;

  transients = NULL;
  data.workspace = meta_window_get_workspace (reference);
  data.transients = &transients;

  meta_window_foreach_transient (reference, collect_transients_on_workspace, &data);

  transients_sorted = meta_display_sort_windows_by_stacking (display, transients);
  /* Reverse this so we're top-to-bottom (yes, we should probably change the order
   * returned from the sort_windows_by_stacking function)
   */
  transients_sorted = g_slist_reverse (transients_sorted);
  g_slist_free (transients);
  transients = NULL;

  result = NULL;
  for (iter = transients_sorted; iter; iter = iter->next)
    {
      MetaWindow *window = iter->data;
      MetaWindowType wintype = meta_window_get_window_type (window);

      /* Don't want to focus UTILITY types, like the Gimp toolbars */
      if (wintype == META_WINDOW_NORMAL ||
          wintype == META_WINDOW_DIALOG)
        {
          result = window;
          break;
        }
    }
  g_slist_free (transients_sorted);
  return result;
}

/**
 * cinnamon_app_activate_window:
 * @app: a #CinnamonApp
 * @window: (nullable): Window to be focused
 * @timestamp: Event timestamp
 *
 * Bring all windows for the given app to the foreground,
 * but ensure that @window is on top.  If @window is %NULL,
 * the window with the most recent user time for the app
 * will be used.
 *
 * This function has no effect if @app is not currently running.
 */
void
cinnamon_app_activate_window (CinnamonApp     *app,
                           MetaWindow   *window,
                           guint32       timestamp)
{
  GSList *windows;

  if (cinnamon_app_get_state (app) != CINNAMON_APP_STATE_RUNNING)
    return;

  windows = cinnamon_app_get_windows (app);
  if (window == NULL && windows)
    window = windows->data;

  if (!g_slist_find (windows, window))
    return;
  else
    {
      GSList *windows_reversed, *iter;
      CinnamonGlobal *global = cinnamon_global_get ();
      MetaScreen *screen = cinnamon_global_get_screen (global);
      MetaDisplay *display = meta_screen_get_display (screen);
      MetaWorkspace *active = meta_screen_get_active_workspace (screen);
      MetaWorkspace *workspace = meta_window_get_workspace (window);
      guint32 last_user_timestamp = meta_display_get_last_user_time (display);
      MetaWindow *most_recent_transient;

      if (meta_display_xserver_time_is_before (display, timestamp, last_user_timestamp))
        {
          meta_window_set_demands_attention (window);
          return;
        }

      /* Now raise all the other windows for the app that are on
       * the same workspace, in reverse order to preserve the stacking.
       */
      windows_reversed = g_slist_copy (windows);
      windows_reversed = g_slist_reverse (windows_reversed);
      for (iter = windows_reversed; iter; iter = iter->next)
        {
          MetaWindow *other_window = iter->data;

          if (other_window != window && meta_window_get_workspace (other_window) == workspace)
            meta_window_raise (other_window);
        }
      g_slist_free (windows_reversed);

      /* If we have a transient that the user's interacted with more recently than
       * the window, pick that.
       */
      most_recent_transient = find_most_recent_transient_on_same_workspace (display, window);
      if (most_recent_transient
          && meta_display_xserver_time_is_before (display,
                                                  meta_window_get_user_time (window),
                                                  meta_window_get_user_time (most_recent_transient)))
        window = most_recent_transient;

      if (active != workspace)
        meta_workspace_activate_with_focus (workspace, window, timestamp);
      else
        meta_window_activate (window, timestamp);
    }
}

/**
 * cinnamon_app_activate:
 * @app: a #CinnamonApp
 *
 * Like cinnamon_app_activate_full(), but using the default workspace and
 * event timestamp.
 */
void
cinnamon_app_activate (CinnamonApp      *app)
{
  return cinnamon_app_activate_full (app, -1, 0);
}

/**
 * cinnamon_app_activate_full:
 * @app: a #CinnamonApp
 * @workspace: launch on this workspace, or -1 for default. Ignored if
 *   activating an existing window
 * @timestamp: Event timestamp
 *
 * Perform an appropriate default action for operating on this application,
 * dependent on its current state.  For example, if the application is not
 * currently running, launch it.  If it is running, activate the most
 * recently used NORMAL window (or if that window has a transient, the most
 * recently used transient for that window).
 */
void
cinnamon_app_activate_full (CinnamonApp      *app,
                         int            workspace,
                         guint32        timestamp)
{
  CinnamonGlobal *global;

  global = cinnamon_global_get ();

  if (timestamp == 0)
    timestamp = cinnamon_global_get_current_time (global);

  switch (app->state)
    {
      case CINNAMON_APP_STATE_STOPPED:
        {
          GError *error = NULL;
          if (!cinnamon_app_launch (app, timestamp, workspace, FALSE, &error))
            {
              char *msg;
              msg = g_strdup_printf (_("Failed to launch '%s'"), cinnamon_app_get_name (app));
              cinnamon_global_notify_error (global,
                                         msg,
                                         error->message);
              g_free (msg);
              g_clear_error (&error);
            }
        }
        break;
      case CINNAMON_APP_STATE_STARTING:
        break;
      case CINNAMON_APP_STATE_RUNNING:
        cinnamon_app_activate_window (app, NULL, timestamp);
        break;
      default:
        g_warning("cinnamon_app_activate_full: default case");
        break;
    }
}

/**
 * cinnamon_app_open_new_window:
 * @app: a #CinnamonApp
 * @workspace: open on this workspace, or -1 for default
 *
 * Request that the application create a new window.
 */
void
cinnamon_app_open_new_window (CinnamonApp      *app,
                           int            workspace)
{
  GActionGroup *group = NULL;
  const char * const *actions;

  g_return_if_fail (app->info != NULL);

   /* First check whether the application provides a "new-window" desktop
   * action - it is a safe bet that it will open a new window, and activating
   * it will trigger startup notification if necessary
   */
  actions = g_desktop_app_info_list_actions (G_DESKTOP_APP_INFO (app->info));

  if (g_strv_contains (actions, "new-window"))
    {
      cinnamon_app_launch_action (app, "new-window", 0, workspace);
      return;
    }

  /* Lastly, just always launch the application again, even if we know
   * it was already running.  For most applications this
   * should have the effect of creating a new window, whether that's
   * a second process (in the case of Calculator) or IPC to existing
   * instance (Firefox).  There are a few less-sensical cases such
   * as say Pidgin.
   */
  cinnamon_app_launch (app, 0, workspace, FALSE, NULL);
}

/**
 * cinnamon_app_can_open_new_window:
 * @app: a #CinnamonApp
 *
 * Returns %TRUE if the app supports opening a new window through
 * cinnamon_app_open_new_window() (ie, if calling that function will
 * result in actually opening a new window and not something else,
 * like presenting the most recently active one)
 */
gboolean
cinnamon_app_can_open_new_window (CinnamonApp *app)
{
  CinnamonAppRunningState *state;

  /* Apps that are not running can always open new windows, because
     activating them would open the first one */
  if (!app->running_state)
    return TRUE;

  state = app->running_state;

  /* If the app doesn't have a desktop file, then nothing is possible */
  if (!app->info)
    return FALSE;

  /* If the app is explicitly telling us, then we know for sure */
  if (g_desktop_app_info_has_key (G_DESKTOP_APP_INFO (app->info),
                                  "X-GNOME-SingleWindow"))
    return !g_desktop_app_info_get_boolean (G_DESKTOP_APP_INFO (app->info),
                                            "X-GNOME-SingleWindow");

  /* In all other cases, we don't have a reliable source of information
     or a decent heuristic, so we err on the compatibility side and say
     yes.
  */
  return TRUE;
}

/**
 * cinnamon_app_get_state:
 * @app: a #CinnamonApp
 *
 * Returns: State of the application
 */
CinnamonAppState
cinnamon_app_get_state (CinnamonApp *app)
{
  return app->state;
}

typedef struct {
  CinnamonApp *app;
  MetaWorkspace *active_workspace;
} CompareWindowsData;

static int
cinnamon_app_compare_windows (gconstpointer   a,
                           gconstpointer   b,
                           gpointer        datap)
{
  MetaWindow *win_a = (gpointer)a;
  MetaWindow *win_b = (gpointer)b;
  CompareWindowsData *data = datap;
  gboolean ws_a, ws_b;
  gboolean vis_a, vis_b;

  ws_a = meta_window_get_workspace (win_a) == data->active_workspace;
  ws_b = meta_window_get_workspace (win_b) == data->active_workspace;

  if (ws_a && !ws_b)
    return -1;
  else if (!ws_a && ws_b)
    return 1;

  vis_a = meta_window_showing_on_its_workspace (win_a);
  vis_b = meta_window_showing_on_its_workspace (win_b);

  if (vis_a && !vis_b)
    return -1;
  else if (!vis_a && vis_b)
    return 1;

  return meta_window_get_user_time (win_b) - meta_window_get_user_time (win_a);
}

/**
 * cinnamon_app_get_windows:
 * @app:
 *
 * Get the windows which are associated with this application. The
 * returned list will be sorted first by whether they're on the
 * active workspace, then by whether they're visible, and finally
 * by the time the user last interacted with them.
 *
 * Returns: (transfer none) (element-type MetaWindow): List of windows
 */
GSList *
cinnamon_app_get_windows (CinnamonApp *app)
{
  if (app->running_state == NULL)
    return NULL;

  if (app->running_state->window_sort_stale)
    {
      CompareWindowsData data;
      data.app = app;
      data.active_workspace = meta_screen_get_active_workspace (cinnamon_global_get_screen (cinnamon_global_get ()));
      app->running_state->windows = g_slist_sort_with_data (app->running_state->windows, cinnamon_app_compare_windows, &data);
      app->running_state->window_sort_stale = FALSE;
    }

  return app->running_state->windows;
}

guint
cinnamon_app_get_n_windows (CinnamonApp *app)
{
  if (app->running_state == NULL)
    return 0;
  return g_slist_length (app->running_state->windows);
}

gboolean
cinnamon_app_is_on_workspace (CinnamonApp *app,
                           MetaWorkspace   *workspace)
{
  GSList *iter;

  if (cinnamon_app_get_state (app) == CINNAMON_APP_STATE_STARTING)
    {
      if (app->started_on_workspace == -1 ||
          meta_workspace_index (workspace) == app->started_on_workspace)
        return TRUE;
      else
        return FALSE;
    }

  if (app->running_state == NULL)
    return FALSE;

  for (iter = app->running_state->windows; iter; iter = iter->next)
    {
      if (meta_window_get_workspace (iter->data) == workspace)
        return TRUE;
    }

  return FALSE;
}

static int
cinnamon_app_get_last_user_time (CinnamonApp *app)
{
  GSList *iter;
  guint32 last_user_time;

  last_user_time = 0;

  if (app->running_state != NULL)
    {
      for (iter = app->running_state->windows; iter; iter = iter->next)
        last_user_time = MAX (last_user_time, meta_window_get_user_time (iter->data));
    }

  return (int)last_user_time;
}

static gboolean
cinnamon_app_is_minimized (CinnamonApp *app)
{
  GSList *iter;

  if (app->running_state == NULL)
    return FALSE;

  for (iter = app->running_state->windows; iter; iter = iter->next)
    {
      if (meta_window_showing_on_its_workspace (iter->data))
        return FALSE;
    }

  return TRUE;
}



/**
 * cinnamon_app_compare:
 * @app: A #CinnamonApp
 * @other: A #CinnamonApp
 *
 * Compare one #CinnamonApp instance to another, in the following way:
 *   - Running applications sort before not-running applications.
 *   - If one of them has non-minimized windows and the other does not,
 *     the one with visible windows is first.
 *   - Finally, the application which the user interacted with most recently
 *     compares earlier.
 */
int
cinnamon_app_compare (CinnamonApp *app,
                   CinnamonApp *other)
{
  gboolean min_app, min_other;

  if (app->state != other->state)
    {
      if (app->state == CINNAMON_APP_STATE_RUNNING)
        return -1;
      return 1;
    }

  min_app = cinnamon_app_is_minimized (app);
  min_other = cinnamon_app_is_minimized (other);

  if (min_app != min_other)
    {
      if (min_other)
        return -1;
      return 1;
    }

  if (app->state == CINNAMON_APP_STATE_RUNNING)
    {
      if (app->running_state->windows && !other->running_state->windows)
        return -1;
      else if (!app->running_state->windows && other->running_state->windows)
        return 1;

      return cinnamon_app_get_last_user_time (other) - cinnamon_app_get_last_user_time (app);
    }

  return 0;
}

CinnamonApp *
_cinnamon_app_new_for_window (MetaWindow      *window)
{
  CinnamonApp *app;

  app = g_object_new (CINNAMON_TYPE_APP, NULL);

  app->window_id_string = g_strdup_printf ("window:%d", meta_window_get_stable_sequence (window));

  _cinnamon_app_add_window (app, window);

  return app;
}

CinnamonApp *
_cinnamon_app_new (GDesktopAppInfo *info)
{
  CinnamonApp *app;

  app = g_object_new (CINNAMON_TYPE_APP,
                      "app-info", info,
                      NULL);

  return app;
}

void
_cinnamon_app_set_app_info (CinnamonApp       *app,
                            GDesktopAppInfo   *info)
{
  g_set_object (&app->info, info);

  g_clear_pointer (&app->name_collation_key, g_free);
  if (app->info)
    app->name_collation_key = g_utf8_collate_key (cinnamon_app_get_name (app), -1);
}

static void
cinnamon_app_state_transition (CinnamonApp      *app,
                            CinnamonAppState  state)
{
  if (app->state == state)
    return;
  g_return_if_fail (!(app->state == CINNAMON_APP_STATE_RUNNING &&
                      state == CINNAMON_APP_STATE_STARTING));
  app->state = state;

  _cinnamon_app_system_notify_app_state_changed (cinnamon_app_system_get_default (), app);

  g_object_notify (G_OBJECT (app), "state");
}

static void
cinnamon_app_on_unmanaged (MetaWindow      *window,
                        CinnamonApp *app)
{
  _cinnamon_app_remove_window (app, window);
}

static void
cinnamon_app_on_user_time_changed (MetaWindow *window,
                                GParamSpec *pspec,
                                CinnamonApp   *app)
{
  g_assert (app->running_state != NULL);

  /* Ideally we don't want to emit windows-changed if the sort order
   * isn't actually changing. This check catches most of those.
   */
  if (window != app->running_state->windows->data)
    {
      app->running_state->window_sort_stale = TRUE;
      g_signal_emit (app, cinnamon_app_signals[WINDOWS_CHANGED], 0);
    }
}

static void
cinnamon_app_on_ws_switch (MetaScreen         *screen,
                        int                 from,
                        int                 to,
                        MetaMotionDirection direction,
                        gpointer            data)
{
  CinnamonApp *app = CINNAMON_APP (data);

  g_assert (app->running_state != NULL);

  app->running_state->window_sort_stale = TRUE;

  g_signal_emit (app, cinnamon_app_signals[WINDOWS_CHANGED], 0);
}

void
_cinnamon_app_add_window (CinnamonApp        *app,
                       MetaWindow      *window)
{
  if (app->running_state && g_slist_find (app->running_state->windows, window))
    return;

  g_object_freeze_notify (G_OBJECT (app));

  if (!app->running_state)
      create_running_state (app);

  app->running_state->window_sort_stale = TRUE;
  app->running_state->windows = g_slist_prepend (app->running_state->windows, g_object_ref (window));
  g_signal_connect (window, "unmanaged", G_CALLBACK(cinnamon_app_on_unmanaged), app);
  g_signal_connect (window, "notify::user-time", G_CALLBACK(cinnamon_app_on_user_time_changed), app);

  if (app->state != CINNAMON_APP_STATE_STARTING)
    cinnamon_app_state_transition (app, CINNAMON_APP_STATE_RUNNING);

  g_object_thaw_notify (G_OBJECT (app));

  g_signal_emit (app, cinnamon_app_signals[WINDOWS_CHANGED], 0);
}

void
_cinnamon_app_remove_window (CinnamonApp   *app,
                          MetaWindow *window)
{
  g_assert (app->running_state != NULL);

  if (!g_slist_find (app->running_state->windows, window))
    return;

  g_signal_handlers_disconnect_by_func (window, G_CALLBACK(cinnamon_app_on_unmanaged), app);
  g_signal_handlers_disconnect_by_func (window, G_CALLBACK(cinnamon_app_on_user_time_changed), app);
  g_object_unref (window);
  app->running_state->windows = g_slist_remove (app->running_state->windows, window);

  if (app->running_state->windows == NULL)
    cinnamon_app_state_transition (app, CINNAMON_APP_STATE_STOPPED);

  if (app->running_state && app->running_state->windows == NULL)
    g_clear_pointer (&app->running_state, unref_running_state);

  g_signal_emit (app, cinnamon_app_signals[WINDOWS_CHANGED], 0);
}

/**
 * cinnamon_app_get_pids:
 * @app: a #CinnamonApp
 *
 * Returns: (transfer container) (element-type int): An unordered list of process identifiers associated with this application.
 */
GSList *
cinnamon_app_get_pids (CinnamonApp *app)
{
  GSList *result;
  GSList *iter;

  result = NULL;
  for (iter = cinnamon_app_get_windows (app); iter; iter = iter->next)
    {
      MetaWindow *window = iter->data;
      int pid = meta_window_get_pid (window);
      /* Note in the (by far) common case, app will only have one pid, so
       * we'll hit the first element, so don't worry about O(N^2) here.
       */
      if (!g_slist_find (result, GINT_TO_POINTER (pid)))
        result = g_slist_prepend (result, GINT_TO_POINTER (pid));
    }
  return result;
}

void
_cinnamon_app_handle_startup_sequence (CinnamonApp          *app,
                                    SnStartupSequence *sequence)
{
  gboolean starting = !sn_startup_sequence_get_completed (sequence);

  /* The Cinnamon design calls for on application launch, the app title
   * appears at top, and no X window is focused.  So when we get
   * a startup-notification for this app, transition it to STARTING
   * if it's currently stopped, set it as our application focus,
   * but focus the no_focus window.
   */
  if (starting && cinnamon_app_get_state (app) == CINNAMON_APP_STATE_STOPPED)
    {
      MetaScreen *screen = cinnamon_global_get_screen (cinnamon_global_get ());
      MetaDisplay *display = meta_screen_get_display (screen);

      cinnamon_app_state_transition (app, CINNAMON_APP_STATE_STARTING);
      meta_display_focus_the_no_focus_window (display, screen,
                                              sn_startup_sequence_get_timestamp (sequence));
      app->started_on_workspace = sn_startup_sequence_get_workspace (sequence);
    }

  if (!starting)
    {
      if (app->running_state && app->running_state->windows)
        cinnamon_app_state_transition (app, CINNAMON_APP_STATE_RUNNING);
      else /* application have > 1 .desktop file */
        cinnamon_app_state_transition (app, CINNAMON_APP_STATE_STOPPED);
    }
}

/**
 * cinnamon_app_request_quit:
 * @app: A #CinnamonApp
 *
 * Initiate an asynchronous request to quit this application.
 * The application may interact with the user, and the user
 * might cancel the quit request from the application UI.
 *
 * This operation may not be supported for all applications.
 *
 * Returns: %TRUE if a quit request is supported for this application
 */
gboolean
cinnamon_app_request_quit (CinnamonApp   *app)
{
  CinnamonGlobal *global;
  GSList *iter;

  if (cinnamon_app_get_state (app) != CINNAMON_APP_STATE_RUNNING)
    return FALSE;

  /* TODO - check for an XSMP connection; we could probably use that */

  global = cinnamon_global_get ();

  for (iter = app->running_state->windows; iter; iter = iter->next)
    {
      MetaWindow *win = iter->data;

      if (!meta_window_is_interesting (win))
        continue;

      meta_window_delete (win, cinnamon_global_get_current_time (global));
    }
  return TRUE;
}

#if !defined(HAVE_GIO_DESKTOP_LAUNCH_URIS_WITH_FDS) && defined(HAVE_SYSTEMD)
/* This sets up the launched application to log to the journal
 * using its own identifier, instead of just "cinnamon-session".
 */
static void
app_child_setup (gpointer user_data)
{
  const char *appid = user_data;
  int res;
  int journalfd = sd_journal_stream_fd (appid, LOG_INFO, FALSE);
  if (journalfd >= 0)
    {
      do
        res = dup2 (journalfd, 1);
      while (G_UNLIKELY (res == -1 && errno == EINTR));
      do
        res = dup2 (journalfd, 2);
      while (G_UNLIKELY (res == -1 && errno == EINTR));
      (void) close (journalfd);
    }
}
#endif

static void
wait_pid (GDesktopAppInfo *appinfo,
          GPid             pid,
          gpointer         user_data)
{
  g_child_watch_add (pid, (GChildWatchFunc) g_spawn_close_pid, NULL);
}

/**
 * cinnamon_app_launch:
 * @timestamp: Event timestamp, or 0 for current event timestamp
  * @workspace: Start on this workspace, or -1 for default
  * @discrete_gpu: Whether to start on the discrete GPU
  * @error: A #GError
 */
gboolean
cinnamon_app_launch (CinnamonApp     *app,
                  guint         timestamp,
                  int           workspace,
                  gboolean      discrete_gpu,
                  GError      **error)
{
  CinnamonGlobal *global;
  GAppLaunchContext *context;
  gboolean ret;
  GSpawnFlags flags;

  if (app->info == NULL)
    {
      MetaWindow *window = window_backed_app_get_window (app);
      /* We don't use an error return if there no longer any windows, because the
       * user attempting to activate a stale window backed app isn't something
       * we would expect the caller to meaningfully handle or display an error
       * message to the user.
       */
      if (window)
        meta_window_activate (window, timestamp);
      return TRUE;
    }

  global = cinnamon_global_get ();
  context = cinnamon_global_create_app_launch_context_for_workspace (global, timestamp, workspace);
  if (discrete_gpu)
    g_app_launch_context_setenv (context, "DRI_PRIME", "1");

  /* Set LEAVE_DESCRIPTORS_OPEN in order to use an optimized gspawn
   * codepath. The shell's open file descriptors should be marked CLOEXEC
   * so that they are automatically closed even with this flag set.
   */
  flags = G_SPAWN_SEARCH_PATH | G_SPAWN_DO_NOT_REAP_CHILD |
          G_SPAWN_LEAVE_DESCRIPTORS_OPEN;

#ifdef HAVE_GIO_DESKTOP_LAUNCH_URIS_WITH_FDS
  /* Optimized spawn path, avoiding a child_setup function */
  {
    int journalfd = -1;

#ifdef HAVE_SYSTEMD
    journalfd = sd_journal_stream_fd (cinnamon_app_get_id (app), LOG_INFO, FALSE);
#endif /* HAVE_SYSTEMD */

    ret = g_desktop_app_info_launch_uris_as_manager_with_fds (app->info, NULL,
                                                              context,
                                                              flags,
                                                              NULL, NULL,
                                                              wait_pid, NULL,
                                                              -1,
                                                              journalfd,
                                                              journalfd,
                                                              error);

    if (journalfd >= 0)
      (void) close (journalfd);
  }
#else /* !HAVE_GIO_DESKTOP_LAUNCH_URIS_WITH_FDS */
  ret = g_desktop_app_info_launch_uris_as_manager (app->info, NULL,
                                                   context,
                                                   flags,
#ifdef HAVE_SYSTEMD
                                                   app_child_setup, (gpointer)cinnamon_app_get_id (app),
#else
                                                   NULL, NULL,
#endif
                                                   wait_pid, NULL,
                                                   error);
#endif /* HAVE_GIO_DESKTOP_LAUNCH_URIS_WITH_FDS */
  g_object_unref (context);

  return ret;
}

/**
 * cinnamon_app_launch_action:
 * @app: the #CinnamonApp
 * @action_name: the name of the action to launch (as obtained by
 *               g_desktop_app_info_list_actions())
 * @timestamp: Event timestamp, or 0 for current event timestamp
 * @workspace: Start on this workspace, or -1 for default
 */
void
cinnamon_app_launch_action (CinnamonApp  *app,
                         const char      *action_name,
                         guint            timestamp,
                         int              workspace)
{
  CinnamonGlobal *global;
  GAppLaunchContext *context;

  global = cinnamon_global_get ();
  context = cinnamon_global_create_app_launch_context_for_workspace (global, timestamp, workspace);

  g_desktop_app_info_launch_action (G_DESKTOP_APP_INFO (app->info),
                                    action_name, context);

  g_object_unref (context);
}

/**
 * cinnamon_app_get_app_info:
 * @app: a #CinnamonApp
 *
 * Returns: (transfer none): The #GDesktopAppInfo for this app, or %NULL if backed by a window
 */
GDesktopAppInfo *
cinnamon_app_get_app_info (CinnamonApp *app)
{
  return app->info;
}

static void
create_running_state (CinnamonApp *app)
{
  MetaScreen *screen;

  g_assert (app->running_state == NULL);

  screen = cinnamon_global_get_screen (cinnamon_global_get ());
  app->running_state = g_slice_new0 (CinnamonAppRunningState);
  app->running_state->refcount = 1;
  app->running_state->workspace_switch_id =
    g_signal_connect (screen, "workspace-switched", G_CALLBACK(cinnamon_app_on_ws_switch), app);
}

static void
unref_running_state (CinnamonAppRunningState *state)
{
  MetaScreen *screen;

  g_assert (state->refcount > 0);

  state->refcount--;
  if (state->refcount > 0)
    return;

  screen = cinnamon_global_get_screen (cinnamon_global_get ());
  g_signal_handler_disconnect (screen, state->workspace_switch_id);

  g_slice_free (CinnamonAppRunningState, state);
}

/**
 * cinnamon_app_compare_by_name:
 * @app: One app
 * @other: The other app
 *
 * Order two applications by name.
 *
 * Returns: -1, 0, or 1; suitable for use as a comparison function
 * for e.g. g_slist_sort()
 */
int
cinnamon_app_compare_by_name (CinnamonApp *app, CinnamonApp *other)
{
  return strcmp (app->name_collation_key, other->name_collation_key);
}

static void
cinnamon_app_init (CinnamonApp *self)
{
  self->state = CINNAMON_APP_STATE_STOPPED;
}

static void
cinnamon_app_dispose (GObject *object)
{
  CinnamonApp *app = CINNAMON_APP (object);

  g_clear_object (&app->info);

  while (app->running_state)
    _cinnamon_app_remove_window (app, app->running_state->windows->data);


  /* We should have been transitioned when we removed all of our windows */
  g_assert (app->state == CINNAMON_APP_STATE_STOPPED);
  g_assert (app->running_state == NULL);

  G_OBJECT_CLASS(cinnamon_app_parent_class)->dispose (object);
}

static void
cinnamon_app_finalize (GObject *object)
{
  CinnamonApp *app = CINNAMON_APP (object);

  g_free (app->window_id_string);
  g_free (app->name_collation_key);

  G_OBJECT_CLASS(cinnamon_app_parent_class)->finalize (object);
}

static void
cinnamon_app_class_init(CinnamonAppClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->get_property = cinnamon_app_get_property;
  gobject_class->set_property = cinnamon_app_set_property;
  gobject_class->dispose = cinnamon_app_dispose;
  gobject_class->finalize = cinnamon_app_finalize;

  cinnamon_app_signals[WINDOWS_CHANGED] = g_signal_new ("windows-changed",
                                     CINNAMON_TYPE_APP,
                                     G_SIGNAL_RUN_LAST,
                                     0,
                                     NULL, NULL, NULL,
                                     G_TYPE_NONE, 0);

  /**
   * CinnamonApp:state:
   *
   * The high-level state of the application, effectively whether it's
   * running or not, or transitioning between those states.
   */
  g_object_class_install_property (gobject_class,
                                   PROP_STATE,
                                   g_param_spec_enum ("state",
                                                      "State",
                                                      "Application state",
                                                      CINNAMON_TYPE_APP_STATE,
                                                      CINNAMON_APP_STATE_STOPPED,
                                                      G_PARAM_READABLE));

  /**
   * CinnamonApp:id:
   *
   * The id of this application (a desktop filename, or a special string
   * like window:0xabcd1234)
   */
  g_object_class_install_property (gobject_class,
                                   PROP_ID,
                                   g_param_spec_string ("id",
                                                        "Application id",
                                                        "The desktop file id of this CinnamonApp",
                                                        NULL,
                                                        G_PARAM_READABLE | G_PARAM_STATIC_STRINGS));

    /**
   * CinnamonApp:app-info:
   *
   * The #GDesktopAppInfo associated with this CinnamonApp, if any.
   */
  g_object_class_install_property (gobject_class,
                                   PROP_APP_INFO,
                                   g_param_spec_object ("app-info",
                                                        "DesktopAppInfo",
                                                        "The DesktopAppInfo associated with this app",
                                                        G_TYPE_DESKTOP_APP_INFO,
                                                        G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY | G_PARAM_STATIC_STRINGS));



}
