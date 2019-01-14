/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include "cinnamon-app-system.h"
#include <string.h>

#include <gio/gio.h>
#include <glib/gi18n.h>

#include "cinnamon-app-private.h"
#include "cinnamon-window-tracker-private.h"
#include "cinnamon-app-system-private.h"
#include "cinnamon-global.h"
#include "cinnamon-util.h"

/* Vendor prefixes are something that can be preprended to a .desktop
 * file name.  Undo this.
 */
static const char*const vendor_prefixes[] = { "gnome-",
                                              "fedora-",
                                              "mozilla-",
                                              NULL };

enum {
   PROP_0,

};

enum {
  APP_STATE_CHANGED,
  INSTALLED_CHANGED,
  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0 };

struct _CinnamonAppSystemPrivate {
  GHashTable *running_apps;
  GHashTable *id_to_app;
  GHashTable *startup_wm_class_to_id;
};

static void cinnamon_app_system_finalize (GObject *object);
gchar *strip_extension (gchar *wm_class);
gboolean case_insensitive_search (const char *key,
                                  const char *value,
                                  gpointer user_data);

G_DEFINE_TYPE(CinnamonAppSystem, cinnamon_app_system, G_TYPE_OBJECT);

static void cinnamon_app_system_class_init(CinnamonAppSystemClass *klass)
{
  GObjectClass *gobject_class = (GObjectClass *)klass;

  gobject_class->finalize = cinnamon_app_system_finalize;

  signals[APP_STATE_CHANGED] = g_signal_new ("app-state-changed",
                                             CINNAMON_TYPE_APP_SYSTEM,
                                             G_SIGNAL_RUN_LAST,
                                             0,
                                             NULL, NULL, NULL,
                                             G_TYPE_NONE, 1,
                                             CINNAMON_TYPE_APP);
  signals[INSTALLED_CHANGED] =
    g_signal_new ("installed-changed",
		  CINNAMON_TYPE_APP_SYSTEM,
		  G_SIGNAL_RUN_LAST,
		  G_STRUCT_OFFSET (CinnamonAppSystemClass, installed_changed),
		  NULL, NULL, NULL,
		  G_TYPE_NONE, 0);

  g_type_class_add_private (gobject_class, sizeof (CinnamonAppSystemPrivate));
}

static void
scan_startup_wm_class_to_id (CinnamonAppSystem *self)
{
  CinnamonAppSystemPrivate *priv = self->priv;
  GList *apps, *l;

  g_hash_table_remove_all (priv->startup_wm_class_to_id);

  apps = g_app_info_get_all ();
  for (l = apps; l != NULL; l = l->next)
    {
      GAppInfo *info = l->data;
      const char *startup_wm_class, *id;

      id = g_app_info_get_id (info);
      startup_wm_class = g_desktop_app_info_get_startup_wm_class (G_DESKTOP_APP_INFO (info));
      if (startup_wm_class != NULL)
        g_hash_table_insert (priv->startup_wm_class_to_id, (char *) startup_wm_class, (char *) id);
    }

  g_list_free_full (apps, g_object_unref);
}

static void
installed_changed (GAppInfoMonitor *monitor,
                   gpointer         user_data)
{
  CinnamonAppSystem *self = user_data;

  scan_startup_wm_class_to_id (self);

  g_signal_emit (self, signals[INSTALLED_CHANGED], 0, NULL);
}

static void
cinnamon_app_system_init (CinnamonAppSystem *self)
{
  CinnamonAppSystemPrivate *priv;
  GAppInfoMonitor *monitor;

  self->priv = priv = G_TYPE_INSTANCE_GET_PRIVATE (self,
                                                   CINNAMON_TYPE_APP_SYSTEM,
                                                   CinnamonAppSystemPrivate);

  priv->running_apps = g_hash_table_new_full (NULL, NULL, (GDestroyNotify) g_object_unref, NULL);
  priv->id_to_app = g_hash_table_new_full (g_str_hash, g_str_equal,
                                           NULL,
                                           (GDestroyNotify)g_object_unref);

  priv->startup_wm_class_to_id = g_hash_table_new (g_str_hash, g_str_equal);

  monitor = g_app_info_monitor_get ();
  g_signal_connect (monitor, "changed", G_CALLBACK (installed_changed), self);
  installed_changed (monitor, self);
}

static void
cinnamon_app_system_finalize (GObject *object)
{
  CinnamonAppSystem *self = CINNAMON_APP_SYSTEM (object);
  CinnamonAppSystemPrivate *priv = self->priv;

  g_hash_table_destroy (priv->running_apps);
  g_hash_table_destroy (priv->id_to_app);
  g_hash_table_destroy (priv->startup_wm_class_to_id);

  G_OBJECT_CLASS (cinnamon_app_system_parent_class)->finalize (object);
}

/**
 * cinnamon_app_system_get_default:
 *
 * Return Value: (transfer none): The global #CinnamonAppSystem singleton
 */
CinnamonAppSystem *
cinnamon_app_system_get_default (void)
{
  static CinnamonAppSystem *instance = NULL;

  if (instance == NULL)
    instance = g_object_new (CINNAMON_TYPE_APP_SYSTEM, NULL);

  return instance;
}

gboolean
case_insensitive_search (const char *key,
                         const char *value,
                         gpointer user_data)
{
  char *given_id = (char *) user_data;

  if (g_ascii_strcasecmp(key, given_id) == 0) {
    return TRUE;
  } else {
    return FALSE;
  }
}

/**
 * cinnamon_app_system_lookup_app:
 *
 * Find a #CinnamonApp corresponding to an id.
 *
 * Return value: (transfer none): The #CinnamonApp for id, or %NULL if none
 */
CinnamonApp *
cinnamon_app_system_lookup_app (CinnamonAppSystem   *self,
                             const char       *id)
{
  CinnamonAppSystemPrivate *priv = self->priv;
  CinnamonApp *app;
  GDesktopAppInfo *info;

  app = g_hash_table_lookup (priv->id_to_app, id);
  if (app)
    return app;

  info = g_desktop_app_info_new (id);
  if (!info)
    return NULL;

  app = _cinnamon_app_new (info);
  g_hash_table_insert (priv->id_to_app, (char *) cinnamon_app_get_id (app), app);
  g_object_unref (info);
  return app;
}

/**
 * cinnamon_app_system_lookup_heuristic_basename:
 * @system: a #CinnamonAppSystem
 * @id: Probable application identifier
 *
 * Find a valid application corresponding to a given
 * heuristically determined application identifier
 * string, or %NULL if none.
 *
 * Returns: (transfer none): A #CinnamonApp for @name
 */
CinnamonApp *
cinnamon_app_system_lookup_heuristic_basename (CinnamonAppSystem *system,
                                            const char     *name)
{
  CinnamonApp *result;
  const char *const *prefix;

  result = cinnamon_app_system_lookup_app (system, name);
  if (result != NULL)
    return result;

  for (prefix = vendor_prefixes; *prefix != NULL; prefix++)
    {
      char *tmpid = g_strconcat (*prefix, name, NULL);
      result = cinnamon_app_system_lookup_app (system, tmpid);
      g_free (tmpid);
      if (result != NULL)
        return result;
    }

  return NULL;
}

gchar *
strip_extension (gchar *wm_class)
{
    char *result;
    if (g_str_has_suffix (wm_class, ".py") ||
        g_str_has_suffix (wm_class, ".sh")) {
            result = g_strndup (wm_class, strlen (wm_class) - 3);
    } else {
        result = g_strdup (wm_class);
    }
    return result;
}

/**
 * cinnamon_app_system_lookup_desktop_wmclass:
 * @system: a #CinnamonAppSystem
 * @wmclass: (allow-none): A WM_CLASS value
 *
 * Find a valid application whose .desktop file, without the extension
 * and properly canonicalized, matches @wmclass.
 *
 * Returns: (transfer none): A #CinnamonApp for @wmclass
 */
CinnamonApp *
cinnamon_app_system_lookup_desktop_wmclass (CinnamonAppSystem *system,
                                            const char        *wmclass)
{
  char *canonicalized;
  char *desktop_file;
  char *stripped_name;
  CinnamonApp *app;

  if (wmclass == NULL)
    return NULL;

  canonicalized = g_ascii_strdown (wmclass, -1);

  stripped_name = strip_extension(canonicalized);

  /* This handles "Fedora Eclipse", probably others.
   * Note g_strdelimit is modify-in-place. */
  g_strdelimit (stripped_name, " ", '-');

  desktop_file = g_strconcat (stripped_name, ".desktop", NULL);

  app = cinnamon_app_system_lookup_heuristic_basename (system, desktop_file);

  g_free (canonicalized);
  g_free (stripped_name);
  g_free (desktop_file);

  return app;
}

/**
 * cinnamon_app_system_lookup_startup_wmclass:
 * @system: a #CinnamonAppSystem
 * @wmclass: (allow-none): A WM_CLASS value
 *
 * Find a valid application whose .desktop file contains a
 * StartupWMClass entry matching @wmclass.
 *
 * Returns: (transfer none): A #CinnamonApp for @wmclass
 */
CinnamonApp *
cinnamon_app_system_lookup_startup_wmclass (CinnamonAppSystem *system,
                                            const char     *wmclass)
{
  const char *id;

  if (wmclass == NULL)
    return NULL;

  id = g_hash_table_lookup (system->priv->startup_wm_class_to_id, wmclass);
  if (id == NULL)
    return NULL;

  return cinnamon_app_system_lookup_app (system, id);
}

/**
 * cinnamon_app_system_get_all:
 * @system:
 *
 * Returns: (transfer container) (element-type CinnamonApp): All installed applications
 */
GSList *
cinnamon_app_system_get_all (CinnamonAppSystem  *self)
{
  GSList *result = NULL;
  GHashTableIter iter;
  gpointer key, value;

  g_hash_table_iter_init (&iter, self->priv->id_to_app);
  while (g_hash_table_iter_next (&iter, &key, &value))
    {
      CinnamonApp *app = value;
      
      if (!g_desktop_app_info_get_nodisplay (cinnamon_app_get_app_info (app)))
        result = g_slist_prepend (result, app);
    }
  return result;
}

void
_cinnamon_app_system_notify_app_state_changed (CinnamonAppSystem *self,
                                            CinnamonApp       *app)
{
  CinnamonAppState state = cinnamon_app_get_state (app);

  switch (state)
    {
    case CINNAMON_APP_STATE_RUNNING:
    case CINNAMON_APP_STATE_BUSY:
      g_hash_table_insert (self->priv->running_apps, g_object_ref (app), NULL);
      break;
    case CINNAMON_APP_STATE_STARTING:
      break;
    case CINNAMON_APP_STATE_STOPPED:
      g_hash_table_remove (self->priv->running_apps, app);
      break;
    default:
      g_warning("cinnamon_app_system_notify_app_state_changed: default case");
    break;
    }
  g_signal_emit (self, signals[APP_STATE_CHANGED], 0, app);
}

/**
 * cinnamon_app_system_get_running:
 * @self: A #CinnamonAppSystem
 *
 * Returns the set of applications which currently have at least one
 * open window in the given context.  The returned list will be sorted
 * by cinnamon_app_compare().
 *
 * Returns: (element-type CinnamonApp) (transfer container): Active applications
 */
GSList *
cinnamon_app_system_get_running (CinnamonAppSystem *self)
{
  gpointer key, value;
  GSList *ret;
  GHashTableIter iter;

  g_hash_table_iter_init (&iter, self->priv->running_apps);

  ret = NULL;
  while (g_hash_table_iter_next (&iter, &key, &value))
    {
      CinnamonApp *app = key;

      ret = g_slist_prepend (ret, app);
    }

  ret = g_slist_sort (ret, (GCompareFunc)cinnamon_app_compare);

  return ret;
}
