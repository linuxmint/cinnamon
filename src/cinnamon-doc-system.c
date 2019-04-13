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
  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0 };

struct _CinnamonDocSystemPrivate {
  GtkRecentManager *manager;
  GSList *infos_by_timestamp;

  guint idle_recent_changed_id;
};

G_DEFINE_TYPE(CinnamonDocSystem, cinnamon_doc_system, G_TYPE_OBJECT);

// Showing all recent items isn't viable, GTK.RecentManager can contain
// up to 1000 items and this can significantly affect performance
// in the JS layer.
static const int MAX_RECENT_ITEMS = 20;

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

typedef struct {
  CinnamonDocSystem *self;
  GtkRecentInfo *info;
} CinnamonDocSystemRecentQueryData;

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

static void load_items (CinnamonDocSystem *self)
{
  CinnamonDocSystemPrivate *priv = self->priv;
  GList *items, *iter;
  int i;

  self->priv->infos_by_timestamp = NULL;
  items = (GList*) g_slist_sort ((GSList*) gtk_recent_manager_get_items (priv->manager),
                                 sort_infos_by_timestamp_descending);
  i = 0;
  for (iter = items; iter; iter = iter->next)
    {
      GtkRecentInfo *info = iter->data;
      if (i < MAX_RECENT_ITEMS) {
        priv->infos_by_timestamp = g_slist_prepend (priv->infos_by_timestamp, info);
      }
      else {
        gtk_recent_info_unref (info);
      }
      i++;
    }
  priv->infos_by_timestamp = g_slist_reverse (priv->infos_by_timestamp);
  g_list_free (items);
}

static gboolean
idle_handle_recent_changed (gpointer data)
{
  CinnamonDocSystem *self = CINNAMON_DOC_SYSTEM (data);
  self->priv->idle_recent_changed_id = 0;
  g_slist_free_full (self->priv->infos_by_timestamp, (GDestroyNotify) gtk_recent_info_unref);
  load_items(self);
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

  g_type_class_add_private (gobject_class, sizeof (CinnamonDocSystemPrivate));
}

static void
cinnamon_doc_system_init (CinnamonDocSystem *self)
{
  CinnamonDocSystemPrivate *priv;
  self->priv = priv = G_TYPE_INSTANCE_GET_PRIVATE (self,
                                                   CINNAMON_TYPE_DOC_SYSTEM,
                                                   CinnamonDocSystemPrivate);

  self->priv->manager = gtk_recent_manager_get_default ();
  load_items(self);
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
