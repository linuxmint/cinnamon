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

typedef struct _CinnamonAppSystemPrivate CinnamonAppSystemPrivate;

struct _CinnamonAppSystem
{
  GObject parent;

  CinnamonAppSystemPrivate *priv;
};

struct _CinnamonAppSystemPrivate {
  GMenuTree *apps_tree;

  GHashTable *running_apps;
  GHashTable *id_to_app;
  GHashTable *startup_wm_class_to_app;
};

static void cinnamon_app_system_finalize (GObject *object);
gboolean case_insensitive_search (const char *key,
                                  const char *value,
                                  gpointer user_data);

G_DEFINE_TYPE_WITH_PRIVATE (CinnamonAppSystem, cinnamon_app_system, G_TYPE_OBJECT);

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
		  0,
		  NULL, NULL, NULL,
		  G_TYPE_NONE, 0);
}

static void
get_flattened_entries_recurse (GMenuTreeDirectory *dir,
                               GHashTable         *entry_set)
{
  GMenuTreeIter *iter = gmenu_tree_directory_iter (dir);
  GMenuTreeItemType next_type;

  while ((next_type = gmenu_tree_iter_next (iter)) != GMENU_TREE_ITEM_INVALID)
    {
      gpointer item = NULL;

      switch (next_type)
        {
        case GMENU_TREE_ITEM_ENTRY:
          {
            GMenuTreeEntry *entry;
            item = entry = gmenu_tree_iter_get_entry (iter);
            /* Key is owned by entry */
            g_hash_table_replace (entry_set,
                                  (char*)gmenu_tree_entry_get_desktop_file_id (entry),
                                  gmenu_tree_item_ref (entry));
          }
          break;
        case GMENU_TREE_ITEM_DIRECTORY:
          {
            item = gmenu_tree_iter_get_directory (iter);
            get_flattened_entries_recurse ((GMenuTreeDirectory*)item, entry_set);
          }
          break;
        case GMENU_TREE_ITEM_INVALID:
        case GMENU_TREE_ITEM_SEPARATOR:
        case GMENU_TREE_ITEM_HEADER:
        case GMENU_TREE_ITEM_ALIAS:
          break;
        default:
          break;
        }
      if (item != NULL)
        gmenu_tree_item_unref (item);
    }

  gmenu_tree_iter_unref (iter);
}

static GHashTable *
get_flattened_entries_from_tree (GMenuTree *tree)
{
  GHashTable *table;
  GMenuTreeDirectory *root;

  table = g_hash_table_new_full (g_str_hash, g_str_equal,
                                 (GDestroyNotify) NULL,
                                 (GDestroyNotify) gmenu_tree_item_unref);

  root = gmenu_tree_get_root_directory (tree);

  if (root != NULL)
    get_flattened_entries_recurse (root, table);

  gmenu_tree_item_unref (root);

  return table;
}

static void
installed_change (GMenuTree *tree,
                  gpointer   user_data)
{
  CinnamonAppSystem *self = CINNAMON_APP_SYSTEM (user_data);
  GError *error = NULL;
  GHashTable *new_apps;
  GHashTableIter iter;
  gpointer key, value;

  g_assert (tree == self->priv->apps_tree);

  if (!gmenu_tree_load_sync (self->priv->apps_tree, &error))
    {
      if (error)
        {
          g_warning ("Failed to load apps: %s", error->message);
          g_error_free (error);
        }
      else
        {
          g_warning ("Failed to load apps");
        }
      return;
    }

  new_apps = get_flattened_entries_from_tree (self->priv->apps_tree);
  g_hash_table_iter_init (&iter, new_apps);
  while (g_hash_table_iter_next (&iter, &key, &value))
    {
      const char *id = key;
      GMenuTreeEntry *entry = value;
      CinnamonApp *app;

      GDesktopAppInfo *info;
      const char *startup_wm_class;

      info = gmenu_tree_entry_get_app_info (entry);

      app = g_hash_table_lookup (self->priv->id_to_app, id);
      if (app != NULL)
        {
          GDesktopAppInfo *old_info;
          const gchar *old_startup_wm_class;

          old_info = cinnamon_app_get_app_info (app);
          old_startup_wm_class = g_desktop_app_info_get_startup_wm_class (old_info);

          if (old_startup_wm_class)
            g_hash_table_remove (self->priv->startup_wm_class_to_app, old_startup_wm_class);

          _cinnamon_app_set_app_info (app, info);
          g_object_ref (app);  /* Extra ref, removed in _replace below */
        }
      else
        {
          app = _cinnamon_app_new (info);
        }

      g_hash_table_replace (self->priv->id_to_app, (char*)id, app);

      startup_wm_class = g_desktop_app_info_get_startup_wm_class (info);
      if (startup_wm_class)
        g_hash_table_replace (self->priv->startup_wm_class_to_app,
                              (char*)startup_wm_class, g_object_ref (app));

    }
  /* Now iterate over the apps again; we need to unreference any apps
   * which have been removed.  The JS code may still be holding a
   * reference; that's fine.
   */
  g_hash_table_iter_init (&iter, self->priv->id_to_app);
  while (g_hash_table_iter_next (&iter, &key, &value))
    {
      const char *id = key;

      if (!g_hash_table_lookup (new_apps, id))
        g_hash_table_iter_remove (&iter);
    }

  g_hash_table_destroy (new_apps);

  g_signal_emit (self, signals[INSTALLED_CHANGED], 0);
}

static void
cinnamon_app_system_init (CinnamonAppSystem *self)
{
  CinnamonAppSystemPrivate *priv;
  GAppInfoMonitor *monitor;

  self->priv = priv = cinnamon_app_system_get_instance_private (self);

  priv->running_apps = g_hash_table_new_full (NULL, NULL, (GDestroyNotify) g_object_unref, NULL);
  priv->id_to_app = g_hash_table_new_full (g_str_hash, g_str_equal,
                                           NULL,
                                           (GDestroyNotify)g_object_unref);

  priv->startup_wm_class_to_app = g_hash_table_new_full (g_str_hash, g_str_equal,
                                                         NULL,
                                                         (GDestroyNotify)g_object_unref);

  priv->apps_tree = gmenu_tree_new ("cinnamon-applications.menu", GMENU_TREE_FLAGS_INCLUDE_NODISPLAY);
  g_signal_connect (priv->apps_tree, "changed", G_CALLBACK (installed_change), self);

  installed_change (priv->apps_tree, self);
}

static void
cinnamon_app_system_finalize (GObject *object)
{
  CinnamonAppSystem *self = CINNAMON_APP_SYSTEM (object);
  CinnamonAppSystemPrivate *priv = self->priv;

  g_object_unref (priv->apps_tree);
  g_hash_table_destroy (priv->running_apps);
  g_hash_table_destroy (priv->id_to_app);
  g_hash_table_destroy (priv->startup_wm_class_to_app);

  G_OBJECT_CLASS (cinnamon_app_system_parent_class)->finalize (object);
}

/**
 * cinnamon_app_system_get_tree:
 *
 * Return Value: (transfer none): The #GMenuTree for apps
 */
GMenuTree *
cinnamon_app_system_get_tree (CinnamonAppSystem *self)
{
  return self->priv->apps_tree;
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
cinnamon_app_system_lookup_app (CinnamonAppSystem *self,
                                const char        *id)
{
  return g_hash_table_lookup (self->priv->id_to_app, id);
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

/**
 * cinnamon_app_system_lookup_desktop_wmclass:
 * @system: a #CinnamonAppSystem
 * @wmclass: (nullable): A WM_CLASS value
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
  CinnamonApp *app;

  if (wmclass == NULL)
    return NULL;

  desktop_file = g_strconcat (wmclass, ".desktop", NULL);
  app = cinnamon_app_system_lookup_heuristic_basename (system, desktop_file);
  g_free (desktop_file);

  if (app)
    return app;

  canonicalized = g_ascii_strdown (wmclass, -1);

  /* This handles "Fedora Eclipse", probably others.
   * Note g_strdelimit is modify-in-place. */
  g_strdelimit (canonicalized, " ", '-');

  desktop_file = g_strconcat (canonicalized, ".desktop", NULL);

  app = cinnamon_app_system_lookup_heuristic_basename (system, desktop_file);

  g_free (canonicalized);
  g_free (desktop_file);

  return app;
}

/**
 * cinnamon_app_system_lookup_startup_wmclass:
 * @system: a #CinnamonAppSystem
 * @wmclass: (nullable): A WM_CLASS value
 *
 * Find a valid application whose .desktop file contains a
 * StartupWMClass entry matching @wmclass.
 *
 * Returns: (transfer none): A #CinnamonApp for @wmclass
 */
CinnamonApp *
cinnamon_app_system_lookup_startup_wmclass (CinnamonAppSystem *system,
                                            const char        *wmclass)
{
  if (wmclass == NULL)
    return NULL;

  return g_hash_table_lookup (system->priv->startup_wm_class_to_app, wmclass);
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

/**
 * cinnamon_app_system_search:
 * @search_string: the search string to use
 *
 * Wrapper around g_desktop_app_info_search() that replaces results that
 * don't validate as UTF-8 with the empty string.
 *
 * Returns: (array zero-terminated=1) (element-type GStrv) (transfer full): a
 *   list of strvs.  Free each item with g_strfreev() and free the outer
 *   list with g_free().
 */
char ***
cinnamon_app_system_search (const char *search_string)
{
  char ***results = g_desktop_app_info_search (search_string);
  char ***groups, **ids;

  for (groups = results; *groups; groups++)
    for (ids = *groups; *ids; ids++)
      if (!g_utf8_validate (*ids, -1, NULL))
        **ids = '\0';

  return results;
}