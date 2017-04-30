/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include "cinnamon-doc-system.h"

#include "cinnamon-global.h"


/**
 * SECTION:cinnamon-doc-system
 * @short_description: Track recently used documents
 *
 * Wraps #GtkRecentManager, caching recently used document information, and adds
 * APIs for asynchronous queries.
 */
enum {
  CHANGED,
  DELETED,
  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0 };

struct _CinnamonDocSystemPrivate {
  GtkRecentManager *manager;
  GHashTable *infos_by_uri;
  GSList *infos_by_timestamp;

  guint idle_recent_changed_id;

  GHashTable *deleted_infos;
  guint idle_emit_deleted_id;
};

G_DEFINE_TYPE(CinnamonDocSystem, cinnamon_doc_system, G_TYPE_OBJECT);

/**
 * cinnamon_doc_system_get_all:
 * @system: A #CinnamonDocSystem
 *
 * Returns the currently cached set of recent files. Recent files are read initially
 * from the underlying #GtkRecentManager, and updated when it changes.
 * This function does not perform I/O.
 *
 * Returns: (transfer none) (element-type GtkRecentInfo): Cached recent file infos
 */
GSList *
cinnamon_doc_system_get_all (CinnamonDocSystem    *self)
{
  return self->priv->infos_by_timestamp;
}

/**
 * cinnamon_doc_system_lookup_by_uri:
 * @system: A #CinnamonDocSystem
 * @uri: Url
 *
 * Returns: (transfer none): Recent file info corresponding to given @uri
 */
GtkRecentInfo *
cinnamon_doc_system_lookup_by_uri (CinnamonDocSystem  *self,
                                const char      *uri)
{
  return g_hash_table_lookup (self->priv->infos_by_uri, uri);
}

static gboolean
cinnamon_doc_system_idle_emit_deleted (gpointer data)
{
  CinnamonDocSystem *self = CINNAMON_DOC_SYSTEM (data);
  GHashTableIter iter;
  gpointer key, value;

  self->priv->idle_emit_deleted_id = 0;

  g_hash_table_iter_init (&iter, self->priv->deleted_infos);

  while (g_hash_table_iter_next (&iter, &key, &value))
    {
      GtkRecentInfo *info = key;
      g_signal_emit (self, signals[DELETED], 0, info);
    }

  g_signal_emit (self, signals[CHANGED], 0);

  return FALSE;
}

typedef struct {
  CinnamonDocSystem *self;
  GtkRecentInfo *info;
} CinnamonDocSystemRecentQueryData;

static void
on_recent_file_query_result (GObject       *source,
                             GAsyncResult  *result,
                             gpointer       user_data)
{
  CinnamonDocSystemRecentQueryData *data = user_data;
  CinnamonDocSystem *self = data->self;
  GError *error = NULL;
  GFileInfo *fileinfo;

  fileinfo = g_file_query_info_finish (G_FILE (source), result, &error);
  if (fileinfo)
    g_object_unref (fileinfo);
  /* This is a strict error check; we don't want to cause recent files to
   * vanish for anything potentially transient.
   */
  if (error != NULL && error->domain == G_IO_ERROR && error->code == G_IO_ERROR_NOT_FOUND)
    {
      self->priv->infos_by_timestamp = g_slist_remove (self->priv->infos_by_timestamp, data->info);
      g_hash_table_remove (self->priv->infos_by_uri, gtk_recent_info_get_uri (data->info));

      g_hash_table_insert (self->priv->deleted_infos, gtk_recent_info_ref (data->info), NULL);

      if (self->priv->idle_emit_deleted_id == 0)
        self->priv->idle_emit_deleted_id = g_timeout_add (0, cinnamon_doc_system_idle_emit_deleted, self);
    }
  g_clear_error (&error);

  gtk_recent_info_unref (data->info);
  g_free (data);
}

/**
 * cinnamon_doc_system_queue_existence_check:
 * @system: A #CinnamonDocSystem
 * @n_items: Count of items to check for existence, starting from most recent
 *
 * Asynchronously start a check of a number of recent file for existence;
 * any deleted files will be emitted from the #CinnamonDocSystem::deleted
 * signal.  Note that this function ignores non-local files; they
 * will simply always appear to exist (until they are removed from
 * the recent file list manually).
 *
 * The intent of this function is to be called after a #CinnamonDocSystem::changed
 * signal has been emitted, and a display has shown a subset of those files.
 */
void
cinnamon_doc_system_queue_existence_check (CinnamonDocSystem   *self,
                                        guint             n_items)
{
  GSList *iter;
  guint i;

  for (i = 0, iter = self->priv->infos_by_timestamp; i < n_items && iter; i++, iter = iter->next)
    {
      GtkRecentInfo *info = iter->data;
      const char *uri;
      GFile *file;
      CinnamonDocSystemRecentQueryData *data;

      if (!gtk_recent_info_is_local (info))
        continue;

      data = g_new0 (CinnamonDocSystemRecentQueryData, 1);
      data->self = self;
      data->info = gtk_recent_info_ref (info);

      uri = gtk_recent_info_get_uri (info);
      file = g_file_new_for_uri (uri);

      g_file_query_info_async (file, "standard::type", G_FILE_QUERY_INFO_NONE,
                               G_PRIORITY_DEFAULT, NULL, on_recent_file_query_result, data);
      g_object_unref (file);
    }
}

static int
sort_infos_by_timestamp_descending (gconstpointer a,
                                    gconstpointer b)
{
  GtkRecentInfo *info_a = (GtkRecentInfo*)a;
  GtkRecentInfo *info_b = (GtkRecentInfo*)b;
  time_t modified_a, modified_b;

  modified_a = gtk_recent_info_get_modified (info_a);
  modified_b = gtk_recent_info_get_modified (info_b);

  return modified_b - modified_a;
}

static gboolean
idle_handle_recent_changed (gpointer data)
{
  CinnamonDocSystem *self = CINNAMON_DOC_SYSTEM (data);
  GList *items, *iter;

  self->priv->idle_recent_changed_id = 0;

  g_hash_table_remove_all (self->priv->deleted_infos);
  g_hash_table_remove_all (self->priv->infos_by_uri);
  g_slist_free (self->priv->infos_by_timestamp);
  self->priv->infos_by_timestamp = NULL;

  items = gtk_recent_manager_get_items (self->priv->manager);
  for (iter = items; iter; iter = iter->next)
    {
      GtkRecentInfo *info = iter->data;
      const char *uri = gtk_recent_info_get_uri (info);

      /* uri is owned by the info */
      g_hash_table_insert (self->priv->infos_by_uri, (char*) uri, info);

      self->priv->infos_by_timestamp = g_slist_prepend (self->priv->infos_by_timestamp, info);
    }
  g_list_free (items);

  self->priv->infos_by_timestamp = g_slist_sort (self->priv->infos_by_timestamp, sort_infos_by_timestamp_descending);

  g_signal_emit (self, signals[CHANGED], 0);

  return FALSE;
}

static void
cinnamon_doc_system_on_recent_changed (GtkRecentManager  *manager,
                                    CinnamonDocSystem    *self)
{
  if (self->priv->idle_recent_changed_id != 0)
    return;
  self->priv->idle_recent_changed_id = g_timeout_add (0, idle_handle_recent_changed, self);
}

/**
 * cinnamon_doc_system_open:
 * @system: A #CinnamonDocSystem
 * @info: A #GtkRecentInfo
 * @workspace: Open on this workspace, or -1 for default
 *
 * Launch the default application associated with the mime type of
 * @info, using its uri.
 */
void
cinnamon_doc_system_open (CinnamonDocSystem *system,
                       GtkRecentInfo  *info,
                       int             workspace)
{
  GFile *file;
  GAppInfo *app_info;
  gboolean needs_uri;
  GAppLaunchContext *context;

  context = cinnamon_global_create_app_launch_context (cinnamon_global_get ());
  if (workspace != -1)
    gdk_app_launch_context_set_desktop ((GdkAppLaunchContext *)context, workspace);

  file = g_file_new_for_uri (gtk_recent_info_get_uri (info));
  needs_uri = g_file_get_path (file) == NULL;
  g_object_unref (file);

  app_info = g_app_info_get_default_for_type (gtk_recent_info_get_mime_type (info), needs_uri);
  if (app_info != NULL)
    {
      GList *uris;
      uris = g_list_prepend (NULL, (gpointer)gtk_recent_info_get_uri (info));
      g_app_info_launch_uris (app_info, uris, context, NULL);
      g_list_free (uris);
    }
  else
    {
      char *app_name;
      const char *app_exec;
      char *app_exec_quoted;
      guint count;
      time_t time;

      app_name = gtk_recent_info_last_application (info);
      if (gtk_recent_info_get_application_info (info, app_name, &app_exec, &count, &time))
        {
          GRegex *regex;

          /* TODO: Change this once better support for creating
             GAppInfo is added to GtkRecentInfo, as right now
             this relies on the fact that the file uri is
             already a part of appExec, so we don't supply any
             files to app_info.launch().

             The 'command line' passed to
             create_from_command_line is allowed to contain
             '%<something>' macros that are expanded to file
             name / icon name, etc, so we need to escape % as %%
           */

          regex = g_regex_new ("%", 0, 0, NULL);
          app_exec_quoted = g_regex_replace (regex, app_exec, -1, 0, "%%", 0, NULL);
          g_regex_unref (regex);

          app_info = g_app_info_create_from_commandline (app_exec_quoted, NULL, 0, NULL);
          g_free (app_exec_quoted);

          /* The point of passing an app launch context to
             launch() is mostly to get startup notification and
             associated benefits like the app appearing on the
             right desktop; but it doesn't really work for now
             because with the way we create the appInfo we
             aren't reading the application's desktop file, and
             thus don't find the StartupNotify=true in it. So,
             despite passing the app launch context, no startup
             notification occurs.
           */
          g_app_info_launch (app_info, NULL, context, NULL);
        }

      g_free (app_name);
    }

  g_object_unref (context);
}

static void
cinnamon_doc_system_class_init(CinnamonDocSystemClass *klass)
{
  GObjectClass *gobject_class = (GObjectClass *)klass;

  signals[CHANGED] =
    g_signal_new ("changed",
		  CINNAMON_TYPE_DOC_SYSTEM,
		  G_SIGNAL_RUN_LAST,
		  0,
                 NULL, NULL, NULL,
		  G_TYPE_NONE, 0);

  signals[DELETED] =
    g_signal_new ("deleted",
		  CINNAMON_TYPE_DOC_SYSTEM,
		  G_SIGNAL_RUN_LAST,
		  0,
                 NULL, NULL, NULL,
		  G_TYPE_NONE, 1, GTK_TYPE_RECENT_INFO);

  g_type_class_add_private (gobject_class, sizeof (CinnamonDocSystemPrivate));
}

static void
cinnamon_doc_system_init (CinnamonDocSystem *self)
{
  CinnamonDocSystemPrivate *priv;
  GList *items, *iter;

  self->priv = priv = G_TYPE_INSTANCE_GET_PRIVATE (self,
                                                   CINNAMON_TYPE_DOC_SYSTEM,
                                                   CinnamonDocSystemPrivate);
  self->priv->manager = gtk_recent_manager_get_default ();

  self->priv->deleted_infos = g_hash_table_new_full (NULL, NULL, (GDestroyNotify)gtk_recent_info_unref, NULL);
  self->priv->infos_by_uri = g_hash_table_new_full (g_str_hash, g_str_equal, NULL, (GDestroyNotify)gtk_recent_info_unref);

  self->priv->infos_by_timestamp = NULL;
  items = gtk_recent_manager_get_items (self->priv->manager);
  for (iter = items; iter; iter = iter->next)
    {
      GtkRecentInfo *info = iter->data;
      const char *uri = gtk_recent_info_get_uri (info);
      /* uri is owned by the info */
      g_hash_table_insert (self->priv->infos_by_uri, (char*) uri, info);
      self->priv->infos_by_timestamp = g_slist_prepend (self->priv->infos_by_timestamp, info);
    }
  g_list_free (items);

  self->priv->infos_by_timestamp = g_slist_sort (self->priv->infos_by_timestamp, sort_infos_by_timestamp_descending);

  g_signal_connect (self->priv->manager, "changed", G_CALLBACK(cinnamon_doc_system_on_recent_changed), self);
}

/**
 * cinnamon_doc_system_get_default:
 *
 * Return Value: (transfer none): The global #CinnamonDocSystem singleton
 */
CinnamonDocSystem *
cinnamon_doc_system_get_default (void)
{
  static CinnamonDocSystem *instance = NULL;

  if (instance == NULL)
    instance = g_object_new (CINNAMON_TYPE_DOC_SYSTEM, NULL);

  return instance;
}
