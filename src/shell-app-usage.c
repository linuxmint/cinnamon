/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <string.h>
#include <stdlib.h>

#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <gdk/gdk.h>
#include <gdk/gdkx.h>
#include <glib.h>
#include <gio/gio.h>
#include <meta/display.h>
#include <meta/group.h>
#include <meta/window.h>

#include "shell-app-usage.h"
#include "shell-window-tracker.h"
#include "shell-global.h"
#include "shell-marshal.h"

/* This file includes modified code from
 * desktop-data-engine/engine-dbus/hippo-application-monitor.c
 * in the functions collecting application usage data.
 * Written by Owen Taylor, originally licensed under LGPL 2.1.
 * Copyright Red Hat, Inc. 2006-2008
 */

/**
 * SECTION:shell-app-usage
 * @short_description: Track application usage/state data
 *
 * This class maintains some usage and state statistics for
 * applications by keeping track of the approximate time an application's
 * windows are focused, as well as the last workspace it was seen on.
 * This time tracking is implemented by watching for focus notifications,
 * and computing a time delta between them.  Also we watch the
 * GNOME Session "StatusChanged" signal which by default is emitted after 5
 * minutes to signify idle.
 */

#define ENABLE_MONITORING_KEY "enable-app-monitoring"

#define FOCUS_TIME_MIN_SECONDS 7 /* Need 7 continuous seconds of focus */

#define USAGE_CLEAN_DAYS 7 /* If after 7 days we haven't seen an app, purge it */

/* Data is saved to file SHELL_CONFIG_DIR/DATA_FILENAME */
#define DATA_FILENAME "application_state"

#define IDLE_TIME_TRANSITION_SECONDS 30 /* If we transition to idle, only count
                                         * this many seconds of usage */

/* The ranking algorithm we use is: every time an app score reaches SCORE_MAX,
 * divide all scores by 2. Scores are raised by 1 unit every SAVE_APPS_TIMEOUT
 * seconds. This mechanism allows the list to update relatively fast when
 * a new app is used intensively.
 * To keep the list clean, and avoid being Big Brother, apps that have not been
 * seen for a week and whose score is below SCORE_MIN are removed.
 */

/* How often we save internally app data, in seconds */
#define SAVE_APPS_TIMEOUT_SECONDS (5 * 60)

/* With this value, an app goes from bottom to top of the
 * usage list in 50 hours of use */
#define SCORE_MAX (3600 * 50 / FOCUS_TIME_MIN_SECONDS)

/* If an app's score in lower than this and the app has not been used in a week,
 * remove it */
#define SCORE_MIN (SCORE_MAX >> 3)

/* http://www.gnome.org/~mccann/gnome-session/docs/gnome-session.html#org.gnome.SessionManager.Presence */
#define GNOME_SESSION_STATUS_IDLE 3

typedef struct UsageData UsageData;

struct _ShellAppUsage
{
  GObject parent;

  GFile *configfile;
  GDBusProxy *session_proxy;
  GdkDisplay *display;
  gulong last_idle;
  guint idle_focus_change_id;
  guint save_id;
  guint settings_notify;
  gboolean currently_idle;
  gboolean enable_monitoring;

  GSList *previously_running;

  long watch_start_time;
  ShellApp *watched_app;

  /* <char *context, GHashTable<char *appid, UsageData *usage>> */
  GHashTable *app_usages_for_context;
};

G_DEFINE_TYPE (ShellAppUsage, shell_app_usage, G_TYPE_OBJECT);

/* Represents an application record for a given context */
struct UsageData
{
  /* Whether the application we're tracking is "transient", see
   * shell_app_is_window_backed.
   */
  gboolean transient;

  gdouble score; /* Based on the number of times we'e seen the app and normalized */
  long last_seen; /* Used to clear old apps we've only seen a few times */
};

static void shell_app_usage_finalize (GObject *object);

static void on_session_status_changed (GDBusProxy *proxy, guint status, ShellAppUsage *self);
static void on_focus_app_changed (ShellWindowTracker *tracker, GParamSpec *spec, ShellAppUsage *self);
static void ensure_queued_save (ShellAppUsage *self);
static UsageData * get_app_usage_for_context_and_id (ShellAppUsage  *self,
                                                    const char     *context,
                                                    const char     *appid);

static gboolean idle_save_application_usage (gpointer data);

static void restore_from_file (ShellAppUsage *self);

static void update_enable_monitoring (ShellAppUsage *self);

static void on_enable_monitoring_key_changed (GSettings     *settings,
                                              const gchar   *key,
                                              ShellAppUsage *self);

static long
get_time (void)
{
  GTimeVal tv;
  g_get_current_time (&tv);
  return tv.tv_sec;
}

static void
shell_app_usage_class_init (ShellAppUsageClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->finalize = shell_app_usage_finalize;
}

static GHashTable *
get_usages_for_context (ShellAppUsage *self,
                        const char    *context)
{
  GHashTable *context_usages;

  context_usages = g_hash_table_lookup (self->app_usages_for_context, context);
  if (context_usages == NULL)
    {
      context_usages = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_free);
      g_hash_table_insert (self->app_usages_for_context, g_strdup (context),
                           context_usages);
    }
  return context_usages;
}

static UsageData *
get_app_usage_for_context_and_id (ShellAppUsage *self,
                                  const char    *context,
                                  const char    *appid)
{
  UsageData *usage;
  GHashTable *context_usages;

  context_usages = get_usages_for_context (self, context);

  usage = g_hash_table_lookup (context_usages, appid);
  if (usage)
    return usage;

  usage = g_new0 (UsageData, 1);
  g_hash_table_insert (context_usages, g_strdup (appid), usage);

  return usage;
}

static UsageData *
get_usage_for_app (ShellAppUsage *self,
                   ShellApp      *app)
{
  const char *context;

  context = _shell_window_tracker_get_app_context (shell_window_tracker_get_default (), app);

  return get_app_usage_for_context_and_id (self, context, shell_app_get_id (app));
}

typedef struct {
  gboolean in_context;
  GHashTableIter context_iter;
  const char *context_id;
  GHashTableIter usage_iter;
} UsageIterator;

static void
usage_iterator_init (ShellAppUsage *self,
                     UsageIterator *iter)
{
  iter->in_context = FALSE;
  g_hash_table_iter_init (&(iter->context_iter), self->app_usages_for_context);
}

static gboolean
usage_iterator_next (ShellAppUsage   *self,
                     UsageIterator   *iter,
                     const char     **context,
                     const char     **id,
                     UsageData       **usage)
{
  gpointer key, value;
  gboolean next_context;

  if (!iter->in_context)
    next_context = TRUE;
  else if (!g_hash_table_iter_next (&(iter->usage_iter), &key, &value))
    next_context = TRUE;
  else
    next_context = FALSE;

  while (next_context)
    {
      GHashTable *app_usages;

      if (!g_hash_table_iter_next (&(iter->context_iter), &key, &value))
        return FALSE;
      iter->in_context = TRUE;
      iter->context_id = key;
      app_usages = value;
      g_hash_table_iter_init (&(iter->usage_iter), app_usages);

      next_context = !g_hash_table_iter_next (&(iter->usage_iter), &key, &value);
    }

  *context = iter->context_id;
  *id = key;
  *usage = value;

  return TRUE;
}

static void
usage_iterator_remove (ShellAppUsage *self,
                       UsageIterator *iter)
{
  g_assert (iter->in_context);

  g_hash_table_iter_remove (&(iter->usage_iter));
}

/* Limit the score to a certain level so that most used apps can change */
static void
normalize_usage (ShellAppUsage *self)
{
  UsageIterator iter;
  const char *context;
  const char *id;
  UsageData *usage;

  usage_iterator_init (self, &iter);

  while (usage_iterator_next (self, &iter, &context, &id, &usage))
    {
      usage->score /= 2;
    }
}

static void
increment_usage_for_app_at_time (ShellAppUsage *self,
                                 ShellApp      *app,
                                 long           time)
{
  UsageData *usage;
  guint elapsed;
  guint usage_count;

  usage = get_usage_for_app (self, app);

  usage->last_seen = time;

  elapsed = time - self->watch_start_time;
  usage_count = elapsed / FOCUS_TIME_MIN_SECONDS;
  if (usage_count > 0)
    {
      usage->score += usage_count;
      if (usage->score > SCORE_MAX)
        normalize_usage (self);
      ensure_queued_save (self);
    }
}

static void
increment_usage_for_app (ShellAppUsage *self,
                         ShellApp      *app)
{
  long curtime = get_time ();
  increment_usage_for_app_at_time (self, app, curtime);
}

static void
on_app_state_changed (ShellAppSystem *app_system,
                      ShellApp       *app,
                      gpointer        user_data)
{
  ShellAppUsage *self = SHELL_APP_USAGE (user_data);
  UsageData *usage;
  gboolean running;

  if (shell_app_is_window_backed (app))
    return;

  usage = get_usage_for_app (self, app);

  running = shell_app_get_state (app) == SHELL_APP_STATE_RUNNING;

  if (running)
    usage->last_seen = get_time ();
}

static void
on_focus_app_changed (ShellWindowTracker *tracker,
                      GParamSpec         *spec,
                      ShellAppUsage      *self)
{
  if (self->watched_app != NULL)
    increment_usage_for_app (self, self->watched_app);

  if (self->watched_app)
    g_object_unref (self->watched_app);

  g_object_get (tracker, "focus-app", &(self->watched_app), NULL);
  self->watch_start_time = get_time ();
}

static void
on_session_status_changed (GDBusProxy      *proxy,
                           guint            status,
                           ShellAppUsage *self)
{
  gboolean idle;

  idle = (status >= GNOME_SESSION_STATUS_IDLE);
  if (self->currently_idle == idle)
    return;

  self->currently_idle = idle;
  if (idle)
    {
      long end_time;

      /* The GNOME Session signal we watch is 5 minutes, but that's a long
       * time for this purpose.  Instead, just add a base 30 seconds.
       */
      if (self->watched_app)
        {
          end_time = self->watch_start_time + IDLE_TIME_TRANSITION_SECONDS;
          increment_usage_for_app_at_time (self, self->watched_app, end_time);
        }
    }
  else
    {
      /* Transitioning to !idle, reset the start time */
      self->watch_start_time = get_time ();
    }
}

static void
session_proxy_signal (GDBusProxy *proxy, gchar *sender_name, gchar *signal_name, GVariant *parameters, gpointer user_data)
{
  if (g_str_equal (signal_name, "StatusChanged"))
    {
      guint status;
      g_variant_get (parameters, "(u)", &status);
      on_session_status_changed (proxy, status, SHELL_APP_USAGE (user_data));
    }
}

static void
shell_app_usage_init (ShellAppUsage *self)
{
  ShellGlobal *global;
  char *shell_userdata_dir, *path;
  GDBusConnection *session_bus;
  ShellWindowTracker *tracker;
  ShellAppSystem *app_system;

  global = shell_global_get ();

  self->app_usages_for_context = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, (GDestroyNotify) g_hash_table_destroy);

  tracker = shell_window_tracker_get_default ();
  g_signal_connect (tracker, "notify::focus-app", G_CALLBACK (on_focus_app_changed), self);

  app_system = shell_app_system_get_default ();
  g_signal_connect (app_system, "app-state-changed", G_CALLBACK (on_app_state_changed), self);

  session_bus = g_bus_get_sync (G_BUS_TYPE_SESSION, NULL, NULL);
  self->session_proxy = g_dbus_proxy_new_sync (session_bus,
                                               G_DBUS_PROXY_FLAGS_NONE,
                                               NULL, /* interface info */
                                               "org.gnome.SessionManager",
                                               "/org/gnome/SessionManager/Presence",
                                               "org.gnome.SessionManager",
                                               NULL, /* cancellable */
                                               NULL /* error */);
  g_signal_connect (self->session_proxy, "g-signal", G_CALLBACK (session_proxy_signal), self);
  g_object_unref (session_bus);

  self->last_idle = 0;
  self->currently_idle = FALSE;
  self->enable_monitoring = FALSE;

  g_object_get (shell_global_get(), "userdatadir", &shell_userdata_dir, NULL),
  path = g_build_filename (shell_userdata_dir, DATA_FILENAME, NULL);
  g_free (shell_userdata_dir);
  self->configfile = g_file_new_for_path (path);
  g_free (path);
  restore_from_file (self);


  self->settings_notify = g_signal_connect (shell_global_get_settings (global),
                                            "changed::" ENABLE_MONITORING_KEY,
                                            G_CALLBACK (on_enable_monitoring_key_changed),
                                            self);
  update_enable_monitoring (self);
}

static void
shell_app_usage_finalize (GObject *object)
{
  ShellGlobal *global;
  ShellAppUsage *self = SHELL_APP_USAGE (object);

  if (self->save_id > 0)
    g_source_remove (self->save_id);

  global = shell_global_get ();
  g_signal_handler_disconnect (shell_global_get_settings (global),
                               self->settings_notify);

  g_object_unref (self->configfile);

  g_object_unref (self->session_proxy);

  G_OBJECT_CLASS (shell_app_usage_parent_class)->finalize(object);
}

typedef struct {
  ShellAppUsage *usage;
  GHashTable *context_usages;
} SortAppsByUsageData;

static int
sort_apps_by_usage (gconstpointer a,
                    gconstpointer b,
                    gpointer      datap)
{
  SortAppsByUsageData *data = datap;
  ShellApp *app_a, *app_b;
  UsageData *usage_a, *usage_b;

  app_a = (ShellApp*)a;
  app_b = (ShellApp*)b;

  usage_a = g_hash_table_lookup (data->context_usages, shell_app_get_id (app_a));
  usage_b = g_hash_table_lookup (data->context_usages, shell_app_get_id (app_b));

  return usage_b->score - usage_a->score;
}

/**
 * shell_app_usage_get_most_used:
 * @usage: the usage instance to request
 * @context: Activity identifier
 * @max_count: how many applications are requested. Note that the actual
 *     list size may be less, or NULL if not enough applications are registered.
 *
 * Get a list of most popular applications for a given context.
 *
 * Returns: (element-type ShellApp) (transfer full): List of applications
 */
GSList *
shell_app_usage_get_most_used (ShellAppUsage   *self,
                               const char      *context,
                               gint             max_count)
{
  GSList *apps;
  GList *appids, *iter;
  GHashTable *usages;
  ShellAppSystem *appsys;
  SortAppsByUsageData data;

  usages = g_hash_table_lookup (self->app_usages_for_context, context);
  if (usages == NULL)
    return NULL;

  appsys = shell_app_system_get_default ();

  appids = g_hash_table_get_keys (usages);
  apps = NULL;
  for (iter = appids; iter; iter = iter->next)
    {
      const char *appid = iter->data;
      ShellApp *app;

      app = shell_app_system_lookup_app (appsys, appid);
      if (!app)
        continue;

      apps = g_slist_prepend (apps, g_object_ref (app));
    }

  g_list_free (appids);

  data.usage = self;
  data.context_usages = usages;
  apps = g_slist_sort_with_data (apps, sort_apps_by_usage, &data);

  return apps;
}


/**
 * shell_app_usage_compare:
 * @self: the usage instance to request
 * @context: Activity identifier
 * @app_a: First app
 * @app_b: Second app
 *
 * Compare @app_a and @app_b based on frequency of use.
 *
 * Returns: -1 if @app_a ranks higher than @app_b, 1 if @app_b ranks higher
 *          than @app_a, and 0 if both rank equally.
 */
int
shell_app_usage_compare (ShellAppUsage *self,
                         const char    *context,
                         ShellApp      *app_a,
                         ShellApp      *app_b)
{
  GHashTable *usages;
  UsageData *usage_a, *usage_b;

  usages = g_hash_table_lookup (self->app_usages_for_context, context);
  if (usages == NULL)
    return 0;

  usage_a = g_hash_table_lookup (usages, shell_app_get_id (app_a));
  usage_b = g_hash_table_lookup (usages, shell_app_get_id (app_b));

  if (usage_a == NULL && usage_b == NULL)
    return 0;
  else if (usage_a == NULL)
    return 1;
  else if (usage_b == NULL)
    return -1;

  return usage_b->score - usage_a->score;
}

static void
ensure_queued_save (ShellAppUsage *self)
{
  if (self->save_id != 0)
    return;
  self->save_id = g_timeout_add_seconds (SAVE_APPS_TIMEOUT_SECONDS, idle_save_application_usage, self);
}

/* Clean up apps we see rarely.
 * The logic behind this is that if an app was seen less than SCORE_MIN times
 * and not seen for a week, it can probably be forgotten about.
 * This should much reduce the size of the list and avoid 'pollution'. */
static gboolean
idle_clean_usage (ShellAppUsage *self)
{
  UsageIterator iter;
  const char *context;
  const char *id;
  UsageData *usage;
  long current_time;
  long week_ago;

  current_time = get_time ();
  week_ago = current_time - (7 * 24 * 60 * 60);

  usage_iterator_init (self, &iter);

  while (usage_iterator_next (self, &iter, &context, &id, &usage))
    {
      if ((usage->score < SCORE_MIN) &&
          (usage->last_seen < week_ago))
        usage_iterator_remove (self, &iter);
    }

  return FALSE;
}

static gboolean
write_escaped (GDataOutputStream   *stream,
               const char          *str,
               GError             **error)
{
  gboolean ret;
  char *quoted = g_markup_escape_text (str, -1);
  ret = g_data_output_stream_put_string (stream, quoted, NULL, error);
  g_free (quoted);
  return ret;
}

static gboolean
write_attribute_string (GDataOutputStream *stream,
                        const char        *elt_name,
                        const char        *str,
                        GError           **error)
{
  gboolean ret = FALSE;
  char *elt;

  elt = g_strdup_printf (" %s=\"", elt_name);
  ret = g_data_output_stream_put_string (stream, elt, NULL, error);
  g_free (elt);
  if (!ret)
    goto out;

  ret = write_escaped (stream, str, error);
  if (!ret)
    goto out;

  ret = g_data_output_stream_put_string (stream, "\"", NULL, error);

out:
  return ret;
}

static gboolean
write_attribute_uint (GDataOutputStream *stream,
                      const char        *elt_name,
                      guint              value,
                      GError           **error)
{
  gboolean ret;
  char *buf;

  buf = g_strdup_printf ("%u", value);
  ret = write_attribute_string (stream, elt_name, buf, error);
  g_free (buf);

  return ret;
}

static gboolean
write_attribute_double (GDataOutputStream *stream,
                        const char        *elt_name,
                        double             value,
                        GError           **error)
{
  gchar buf[G_ASCII_DTOSTR_BUF_SIZE];
  gboolean ret;

  g_ascii_dtostr (buf, sizeof (buf), value);
  ret = write_attribute_string (stream, elt_name, buf, error);

  return ret;
}

/* Save app data lists to file */
static gboolean
idle_save_application_usage (gpointer data)
{
  ShellAppUsage *self = SHELL_APP_USAGE (data);
  UsageIterator iter;
  const char *current_context;
  const char *context;
  const char *id;
  UsageData *usage;
  GFileOutputStream *output;
  GOutputStream *buffered_output;
  GDataOutputStream *data_output;
  GError *error = NULL;

  self->save_id = 0;

  /* Parent directory is already created by shell-global */
  output = g_file_replace (self->configfile, NULL, FALSE, G_FILE_CREATE_NONE, NULL, &error);
  if (!output)
    {
      g_debug ("Could not save applications usage data: %s", error->message);
      g_error_free (error);
      return FALSE;
    }
  buffered_output = g_buffered_output_stream_new (G_OUTPUT_STREAM (output));
  g_object_unref (output);
  data_output = g_data_output_stream_new (G_OUTPUT_STREAM (buffered_output));
  g_object_unref (buffered_output);

  if (!g_data_output_stream_put_string (data_output, "<?xml version=\"1.0\"?>\n<application-state>\n", NULL, &error))
    goto out;

  usage_iterator_init (self, &iter);

  current_context = NULL;
  while (usage_iterator_next (self, &iter, &context, &id, &usage))
    {
      ShellApp *app;

      app = shell_app_system_lookup_app (shell_app_system_get_default(), id);

      if (!app)
        continue;

      if (context != current_context)
        {
          if (current_context != NULL)
            {
              if (!g_data_output_stream_put_string (data_output, "  </context>", NULL, &error))
                goto out;
            }
          current_context = context;
          if (!g_data_output_stream_put_string (data_output, "  <context", NULL, &error))
            goto out;
          if (!write_attribute_string (data_output, "id", context, &error))
            goto out;
          if (!g_data_output_stream_put_string (data_output, ">\n", NULL, &error))
            goto out;
        }
      if (!g_data_output_stream_put_string (data_output, "    <application", NULL, &error))
        goto out;
      if (!write_attribute_string (data_output, "id", id, &error))
        goto out;
      if (!write_attribute_uint (data_output, "open-window-count", shell_app_get_n_windows (app), &error))
        goto out;

      if (!write_attribute_double (data_output, "score", usage->score, &error))
        goto out;
      if (!write_attribute_uint (data_output, "last-seen", usage->last_seen, &error))
        goto out;
      if (!g_data_output_stream_put_string (data_output, "/>\n", NULL, &error))
        goto out;
    }
  if (current_context != NULL)
    {
      if (!g_data_output_stream_put_string (data_output, "  </context>\n", NULL, &error))
        goto out;
    }
  if (!g_data_output_stream_put_string (data_output, "</application-state>\n", NULL, &error))
    goto out;

out:
  if (!error)
    g_output_stream_close_async (G_OUTPUT_STREAM (data_output), 0, NULL, NULL, NULL);
  g_object_unref (data_output);
  if (error)
    {
      g_debug ("Could not save applications usage data: %s", error->message);
      g_error_free (error);
    }
  return FALSE;
}

typedef struct {
  ShellAppUsage *self;
  char *context;
} ParseData;

static void
shell_app_usage_start_element_handler  (GMarkupParseContext *context,
                                          const gchar         *element_name,
                                          const gchar        **attribute_names,
                                          const gchar        **attribute_values,
                                          gpointer             user_data,
                                          GError             **error)
{
  ParseData *data = user_data;

  if (strcmp (element_name, "application-state") == 0)
    {
    }
  else if (strcmp (element_name, "context") == 0)
    {
      char *context = NULL;
      const char **attribute;
      const char **value;

      for (attribute = attribute_names, value = attribute_values; *attribute; attribute++, value++)
        {
          if (strcmp (*attribute, "id") == 0)
            context = g_strdup (*value);
        }
      if (context < 0)
        {
          g_set_error (error,
                       G_MARKUP_ERROR,
                       G_MARKUP_ERROR_PARSE,
                       "Missing attribute id on <%s> element",
                       element_name);
          return;
        }
      data->context = context;
    }
  else if (strcmp (element_name, "application") == 0)
    {
      const char **attribute;
      const char **value;
      UsageData *usage;
      char *appid = NULL;
      GHashTable *usage_table;

      for (attribute = attribute_names, value = attribute_values; *attribute; attribute++, value++)
        {
          if (strcmp (*attribute, "id") == 0)
            appid = g_strdup (*value);
        }

      if (!appid)
        {
          g_set_error (error,
                       G_MARKUP_ERROR,
                       G_MARKUP_ERROR_PARSE,
                       "Missing attribute id on <%s> element",
                       element_name);
          return;
        }

      usage_table = get_usages_for_context (data->self, data->context);

      usage = g_new0 (UsageData, 1);
      g_hash_table_insert (usage_table, appid, usage);

      for (attribute = attribute_names, value = attribute_values; *attribute; attribute++, value++)
        {
          if (strcmp (*attribute, "open-window-count") == 0)
            {
              guint count = strtoul (*value, NULL, 10);
              if (count > 0)
                 data->self->previously_running = g_slist_prepend (data->self->previously_running,
                                                                   g_strdup (appid));
            }
          else if (strcmp (*attribute, "score") == 0)
            {
              usage->score = g_ascii_strtod (*value, NULL);
            }
          else if (strcmp (*attribute, "last-seen") == 0)
            {
              usage->last_seen = (guint) g_ascii_strtoull (*value, NULL, 10);
            }
        }
    }
  else
    {
      g_set_error (error,
                   G_MARKUP_ERROR,
                   G_MARKUP_ERROR_PARSE,
                   "Unknown element <%s>",
                   element_name);
    }
}

static void
shell_app_usage_end_element_handler (GMarkupParseContext *context,
                                       const gchar         *element_name,
                                       gpointer             user_data,
                                       GError             **error)
{
  ParseData *data = user_data;

  if (strcmp (element_name, "context") == 0)
    {
      g_free (data->context);
      data->context = NULL;
    }
}

static void
shell_app_usage_text_handler (GMarkupParseContext *context,
                                const gchar         *text,
                                gsize                text_len,
                                gpointer             user_data,
                                GError             **error)
{
  /* do nothing, very very fast */
}

static GMarkupParser app_state_parse_funcs =
{
  shell_app_usage_start_element_handler,
  shell_app_usage_end_element_handler,
  shell_app_usage_text_handler,
  NULL,
  NULL
};

/* Load data about apps usage from file */
static void
restore_from_file (ShellAppUsage *self)
{
  GFileInputStream *input;
  ParseData parse_data;
  GMarkupParseContext *parse_context;
  GError *error = NULL;
  char buf[1024];

  input = g_file_read (self->configfile, NULL, &error);
  if (error)
    {
      if (error->code != G_IO_ERROR_NOT_FOUND)
        g_warning ("Could not load applications usage data: %s", error->message);

      g_error_free (error);
      return;
    }

  memset (&parse_data, 0, sizeof (ParseData));
  parse_data.self = self;
  parse_data.context = NULL;
  parse_context = g_markup_parse_context_new (&app_state_parse_funcs, 0, &parse_data, NULL);

  while (TRUE)
    {
      gssize count = g_input_stream_read ((GInputStream*) input, buf, sizeof(buf), NULL, &error);
      if (count <= 0)
        goto out;
      if (!g_markup_parse_context_parse (parse_context, buf, count, &error))
        goto out;
     }

out:
  g_free (parse_data.context);
  g_markup_parse_context_free (parse_context);
  g_input_stream_close ((GInputStream*)input, NULL, NULL);
  g_object_unref (input);

  idle_clean_usage (self);

  if (error)
    {
      g_warning ("Could not load applications usage data: %s", error->message);
      g_error_free (error);
    }
}

/* Enable or disable the timers, depending on the value of ENABLE_MONITORING_KEY
 * and taking care of the previous state.  If selfing is disabled, we still
 * report apps usage based on (possibly) saved data, but don't collect data.
 */
static void
update_enable_monitoring (ShellAppUsage *self)
{
  ShellGlobal *global;
  gboolean enable;

  global = shell_global_get ();
  enable = g_settings_get_boolean (shell_global_get_settings (global),
                                   ENABLE_MONITORING_KEY);

  /* Be sure not to start the timers if they were already set */
  if (enable && !self->enable_monitoring)
    {
      on_focus_app_changed (shell_window_tracker_get_default (), NULL, self);
    }
  /* ...and don't try to stop them if they were not running */
  else if (!enable && self->enable_monitoring)
    {
      if (self->watched_app)
        g_object_unref (self->watched_app);
      self->watched_app = NULL;
      if (self->save_id)
        {
          g_source_remove (self->save_id);
          self->save_id = 0;
        }
    }

  self->enable_monitoring = enable;
}

/* Called when the ENABLE_MONITORING_KEY boolean has changed */
static void
on_enable_monitoring_key_changed (GSettings     *settings,
                                  const gchar   *key,
                                  ShellAppUsage *self)
{
  update_enable_monitoring (self);
}

/**
 * shell_app_usage_get_default:
 *
 * Return Value: (transfer none): The global #ShellAppUsage instance
 */
ShellAppUsage *
shell_app_usage_get_default ()
{
  static ShellAppUsage *instance;

  if (instance == NULL)
    instance = g_object_new (SHELL_TYPE_APP_USAGE, NULL);

  return instance;
}
