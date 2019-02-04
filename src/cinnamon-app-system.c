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
  GMenuTree *apps_tree;

  GHashTable *running_apps;
  GHashTable *id_to_app;
  GHashTable *startup_wm_class_to_app;

  GSList *known_vendor_prefixes;
};

static void cinnamon_app_system_finalize (GObject *object);
static void on_apps_tree_changed_cb (GMenuTree *tree, gpointer user_data);
CinnamonApp * lookup_heuristic_basename (CinnamonAppSystem *system, const char *name);
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
setup_merge_dir_symlink(void)
{
    gchar *user_config = (gchar *) g_get_user_config_dir();
    gchar *merge_path = g_build_filename (user_config, "menus", "applications-merged", NULL);
    GFile *merge_file = g_file_new_for_path (merge_path);
    gchar *sym_path;
    GFile *sym_file;

    g_file_make_directory_with_parents (merge_file, NULL, NULL);

    sym_path = g_build_filename (user_config, "menus", "cinnamon-applications-merged", NULL);
    sym_file = g_file_new_for_path (sym_path);
    if (!g_file_query_exists (sym_file, NULL)) {
        g_file_make_symbolic_link (sym_file, merge_path, NULL, NULL);
    }

    g_free (merge_path);
    g_free (sym_path);
    g_object_unref (merge_file);
    g_object_unref (sym_file);
}

static void
cinnamon_app_system_init (CinnamonAppSystem *self)
{
  CinnamonAppSystemPrivate *priv;

  self->priv = priv = G_TYPE_INSTANCE_GET_PRIVATE (self,
                                                   CINNAMON_TYPE_APP_SYSTEM,
                                                   CinnamonAppSystemPrivate);

  priv->running_apps = g_hash_table_new_full (NULL, NULL, (GDestroyNotify) g_object_unref, NULL);
  priv->id_to_app = g_hash_table_new_full (g_str_hash, g_str_equal,
                                           NULL,
                                           (GDestroyNotify)g_object_unref);

  priv->startup_wm_class_to_app = g_hash_table_new_full (g_str_hash, g_str_equal,
                                                         NULL,
                                                         (GDestroyNotify)g_object_unref);

/* According to desktop spec, since our menu file is called 'cinnamon-applications', our
 * merged menu folders need to be called 'cinnamon-applications-merged'.  We'll setup the folder
 * 'applications-merged' if it doesn't exist yet, and a symlink pointing to it in the
 * ~/.config/menus directory
 */
  setup_merge_dir_symlink();

  /* For now, we want to pick up Evince, Nemo, etc.  We'll
   * handle NODISPLAY semantics at a higher level or investigate them
   * case by case.
   */
  priv->apps_tree = gmenu_tree_new ("cinnamon-applications.menu", GMENU_TREE_FLAGS_INCLUDE_NODISPLAY);
  g_signal_connect (priv->apps_tree, "changed", G_CALLBACK (on_apps_tree_changed_cb), self);

  on_apps_tree_changed_cb (priv->apps_tree, self);
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
  g_slist_free_full (priv->known_vendor_prefixes, g_free);
  priv->known_vendor_prefixes = NULL;

  G_OBJECT_CLASS (cinnamon_app_system_parent_class)->finalize (object);
}

static char *
get_prefix_for_entry (GMenuTreeEntry *entry)
{
  char *prefix = NULL, *file_prefix = NULL;
  const char *id;
  GFile *file;
  char *name;
  int i = 0;

  id = gmenu_tree_entry_get_desktop_file_id (entry);
  file = g_file_new_for_path (gmenu_tree_entry_get_desktop_file_path (entry));
  name = g_file_get_basename (file);

  if (!name)
    {
      g_object_unref (file);
      return NULL;
    }
  for (i = 0; vendor_prefixes[i]; i++)
    {
      if (g_str_has_prefix (name, vendor_prefixes[i]))
        {
          file_prefix = g_strdup (vendor_prefixes[i]);
          break;
        }
    }

  while (strcmp (name, id) != 0)
    {
      char *t;
      char *pname;
      GFile *parent = g_file_get_parent (file);

      if (!parent)
        {
          g_warn_if_reached ();
          break;
        }

      pname = g_file_get_basename (parent);
      if (!pname)
        {
          g_object_unref (parent);
          break;
        }
      if (!g_strstr_len (id, -1, pname))
        {
          /* handle <LegacyDir prefix="..."> */
          char *t1;
          size_t name_len = strlen (name);
          size_t id_len = strlen (id);
          char *t_id = g_strdup (id);

          t_id[id_len - name_len] = '\0';
          t1 = g_strdup(t_id);
          g_free (prefix);
          g_free (t_id);
          g_free (name);
          name = g_strdup (id);
          prefix = t1;

          g_object_unref (file);
          file = parent;
          g_free (pname);
          g_free (file_prefix);
          file_prefix = NULL;
          break;
        }

      t = g_strconcat (pname, "-", name, NULL);
      g_free (name);
      name = t;

      t = g_strconcat (pname, "-", prefix, NULL);
      g_free (prefix);
      prefix = t;

      g_object_unref (file);
      file = parent;
      g_free (pname);
    }

  if (file)
    g_object_unref (file);

  if (strcmp (name, id) == 0)
    {
      g_free (name);
      if (file_prefix && !prefix)
        return file_prefix;
      if (file_prefix)
        {
          char *t = g_strconcat (prefix, "-", file_prefix, NULL);
          g_free (prefix);
          g_free (file_prefix);
          prefix = t;
        }
      return prefix;
    }

  g_free (name);
  g_free (prefix);
  g_free (file_prefix);
  g_return_val_if_reached (NULL);
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
on_apps_tree_changed_cb (GMenuTree *tree,
                         gpointer   user_data)
{
  CinnamonAppSystem *self = CINNAMON_APP_SYSTEM (user_data);
  GError *error = NULL;
  GHashTable *new_apps;
  GHashTableIter iter;
  gpointer key, value;

  g_assert (tree == self->priv->apps_tree);

  g_slist_free_full (self->priv->known_vendor_prefixes, g_free);
  self->priv->known_vendor_prefixes = NULL;

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
      GMenuTreeEntry *old_entry;
      char *prefix;
      CinnamonApp *app;

      GDesktopAppInfo *info;
      const char *startup_wm_class;

      prefix = get_prefix_for_entry (entry);

      if (prefix != NULL
          && !g_slist_find_custom (self->priv->known_vendor_prefixes, prefix,
                                   (GCompareFunc)g_strcmp0))
        self->priv->known_vendor_prefixes = g_slist_append (self->priv->known_vendor_prefixes,
                                                            prefix);
      else
        g_free (prefix);

      app = g_hash_table_lookup (self->priv->id_to_app, id);
      if (app != NULL)
        {
          /* We hold a reference to the original entry temporarily,
           * because otherwise the hash table would be referencing
           * potentially free'd memory until we replace it below with
           * the new data.
           */
          old_entry = cinnamon_app_get_tree_entry (app);
          gmenu_tree_item_ref (old_entry);
          _cinnamon_app_set_entry (app, entry);
          g_object_ref (app);  /* Extra ref, removed in _replace below */
        }
      else
        {
          old_entry = NULL;
          app = _cinnamon_app_new (entry);
        }
      /* Note that "id" is owned by app->entry.  Since we're always
       * setting a new entry, even if the app already exists in the
       * hash table we need to replace the key so that the new id
       * string is pointed to.
       */
      g_hash_table_replace (self->priv->id_to_app, (char*)id, app);
      // if (!gmenu_tree_entry_get_is_nodisplay_recurse (entry))
      //    g_hash_table_replace (self->priv->visible_id_to_app, (char*)id, app);

      if (old_entry)
        {
          GDesktopAppInfo *old_info;
          const gchar *old_startup_wm_class;

          old_info = gmenu_tree_entry_get_app_info (old_entry);
          old_startup_wm_class = g_desktop_app_info_get_startup_wm_class (old_info);

          if (old_startup_wm_class)
            g_hash_table_remove (self->priv->startup_wm_class_to_app, old_startup_wm_class);
        }

      info = cinnamon_app_get_app_info (app);
      if (info)
        {
          startup_wm_class = g_desktop_app_info_get_startup_wm_class (info);
          if (startup_wm_class)
            g_hash_table_replace (self->priv->startup_wm_class_to_app,
                                  (char*)startup_wm_class, g_object_ref (app));
        }

      if (old_entry)
        gmenu_tree_item_unref (old_entry);
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
cinnamon_app_system_lookup_app (CinnamonAppSystem   *self,
                             const char       *id)
{
  CinnamonApp *result;

  result = g_hash_table_lookup (self->priv->id_to_app, id);
  if (result == NULL) {
    result = g_hash_table_find (self->priv->id_to_app, (GHRFunc) case_insensitive_search, (gpointer) id);
  }
  return result;
}

/**
 * Find a valid application corresponding to a given
 * heuristically determined application identifier
 * string, or %NULL if none.
 */
CinnamonApp *
lookup_heuristic_basename (CinnamonAppSystem *system,
                                            const char     *name)
{
  CinnamonApp *result;
  GSList *prefix;

  result = cinnamon_app_system_lookup_app (system, name);
  if (result != NULL)
    return result;

  for (prefix = system->priv->known_vendor_prefixes; prefix; prefix = g_slist_next (prefix))
    {
      char *tmpid = g_strconcat ((char*)prefix->data, name, NULL);
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

  app = lookup_heuristic_basename (system, desktop_file);

  g_free (canonicalized);
  g_free (stripped_name);
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
                                            const char     *wmclass)
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
