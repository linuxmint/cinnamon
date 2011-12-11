/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Copyright (C) 1999, 2000, 2001 Eazel, Inc.
 * Copyright (C) 2011 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *
 * The code for crawling the directory hierarchy is based on
 * nautilus/libnautilus-private/nautilus-directory-async.c, with
 * the following copyright and author:
 *
 * Copyright (C) 1999, 2000, 2001 Eazel, Inc.
 * Author: Darin Adler <darin@bentspoon.com>
 *
 */

#include "shell-mime-sniffer.h"
#include "hotplug-mimetypes.h"

#include <glib/gi18n.h>

#include <gdk-pixbuf/gdk-pixbuf.h>

#define LOADER_ATTRS                          \
  G_FILE_ATTRIBUTE_STANDARD_TYPE ","          \
  G_FILE_ATTRIBUTE_STANDARD_NAME ","          \
  G_FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE ","

#define WATCHDOG_TIMEOUT 1500
#define DIRECTORY_LOAD_ITEMS_PER_CALLBACK 100
#define HIGH_SCORE_RATIO 0.10

G_DEFINE_TYPE (ShellMimeSniffer, shell_mime_sniffer, G_TYPE_OBJECT);

enum {
  PROP_FILE = 1,
  NUM_PROPERTIES
};

static GHashTable *image_type_table = NULL;
static GHashTable *audio_type_table = NULL;
static GHashTable *video_type_table = NULL;
static GHashTable *docs_type_table = NULL;

static GParamSpec *properties[NUM_PROPERTIES] = { NULL, };

typedef struct {
  ShellMimeSniffer *self;

  GFile *file;
  GFileEnumerator *enumerator;
  GList *deep_count_subdirectories;

  gint audio_count;
  gint image_count;
  gint document_count;
  gint video_count;

  gint total_items;
} DeepCountState;

struct _ShellMimeSnifferPrivate {
  GFile *file;

  GCancellable *cancellable;
  guint watchdog_id;

  GSimpleAsyncResult *async_result;
  gchar **sniffed_mime;
};

static void deep_count_load (DeepCountState *state,
                             GFile *file);

static void
init_mimetypes (void)
{
  static gsize once_init = 0;

  if (g_once_init_enter (&once_init))
    {
      GSList *formats, *l;
      GdkPixbufFormat *format;
      gchar **types;
      gint idx;

      image_type_table = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, NULL);
      video_type_table = g_hash_table_new (g_str_hash, g_str_equal);
      audio_type_table = g_hash_table_new (g_str_hash, g_str_equal);
      docs_type_table = g_hash_table_new (g_str_hash, g_str_equal);

      formats = gdk_pixbuf_get_formats ();

      for (l = formats; l != NULL; l = l->next)
        {
          format = l->data;
          types = gdk_pixbuf_format_get_mime_types (format);

          for (idx = 0; types[idx] != NULL; idx++)
            g_hash_table_insert (image_type_table, g_strdup (types[idx]), GINT_TO_POINTER (1));

          g_strfreev (types);
        }

      g_slist_free (formats);

      for (idx = 0; audio_mimetypes[idx] != NULL; idx++)
        g_hash_table_insert (audio_type_table, (gpointer) audio_mimetypes[idx], GINT_TO_POINTER (1));

      for (idx = 0; video_mimetypes[idx] != NULL; idx++)
        g_hash_table_insert (video_type_table, (gpointer) video_mimetypes[idx], GINT_TO_POINTER (1));

      for (idx = 0; docs_mimetypes[idx] != NULL; idx++)
        g_hash_table_insert (docs_type_table, (gpointer) docs_mimetypes[idx], GINT_TO_POINTER (1));

      g_once_init_leave (&once_init, 1);
    }
}

static void
add_content_type_to_cache (DeepCountState *state,
                           const gchar *content_type)
{
  gboolean matched = TRUE;

  if (g_hash_table_lookup (image_type_table, content_type))
    state->image_count++;
  else if (g_hash_table_lookup (video_type_table, content_type))
    state->video_count++;
  else if (g_hash_table_lookup (docs_type_table, content_type))
    state->document_count++;
  else if (g_hash_table_lookup (audio_type_table, content_type))
    state->audio_count++;
  else
    matched = FALSE;

  if (matched)
    state->total_items++;
}

typedef struct {
  const gchar *type;
  gdouble ratio;
} SniffedResult;

static gint
results_cmp_func (gconstpointer a,
                  gconstpointer b)
{
  const SniffedResult *sniffed_a = a;
  const SniffedResult *sniffed_b = b;

  if (sniffed_a->ratio < sniffed_b->ratio)
    return 1;

  if (sniffed_a->ratio > sniffed_b->ratio)
    return -1;

  return 0;
}

static void
prepare_async_result (DeepCountState *state)
{
  ShellMimeSniffer *self = state->self;
  GArray *results;
  GPtrArray *sniffed_mime;
  SniffedResult result;

  sniffed_mime = g_ptr_array_new ();
  results = g_array_new (TRUE, TRUE, sizeof (SniffedResult));

  if (state->total_items == 0)
    goto out;

  result.type = "x-content/video";
  result.ratio = (gdouble) state->video_count / (gdouble) state->total_items;
  g_array_append_val (results, result);

  result.type = "x-content/audio";
  result.ratio = (gdouble) state->audio_count / (gdouble) state->total_items;
  g_array_append_val (results, result);

  result.type = "x-content/pictures";
  result.ratio = (gdouble) state->image_count / (gdouble) state->total_items;
  g_array_append_val (results, result);

  result.type = "x-content/documents";
  result.ratio = (gdouble) state->document_count / (gdouble) state->total_items;
  g_array_append_val (results, result);

  g_array_sort (results, results_cmp_func);

  result = g_array_index (results, SniffedResult, 0);
  g_ptr_array_add (sniffed_mime, g_strdup (result.type));

  /* if other types score high in ratio, add them, up to three */
  result = g_array_index (results, SniffedResult, 1);
  if (result.ratio < HIGH_SCORE_RATIO)
    goto out;
  g_ptr_array_add (sniffed_mime, g_strdup (result.type));

  result = g_array_index (results, SniffedResult, 2);
  if (result.ratio < HIGH_SCORE_RATIO)
    goto out;
  g_ptr_array_add (sniffed_mime, g_strdup (result.type));

 out:
  g_ptr_array_add (sniffed_mime, NULL);
  self->priv->sniffed_mime = (gchar **) g_ptr_array_free (sniffed_mime, FALSE);

  g_array_free (results, TRUE);
  g_simple_async_result_complete_in_idle (self->priv->async_result);
}

/* adapted from nautilus/libnautilus-private/nautilus-directory-async.c */
static void
deep_count_one (DeepCountState *state,
		GFileInfo *info)
{
  GFile *subdir;
  const char *content_type;

  if (g_file_info_get_file_type (info) == G_FILE_TYPE_DIRECTORY)
    {
      /* record the fact that we have to descend into this directory */
      subdir = g_file_get_child (state->file, g_file_info_get_name (info));
      state->deep_count_subdirectories =
        g_list_append (state->deep_count_subdirectories, subdir);
    } 
  else
    {
      content_type = g_file_info_get_content_type (info);
      add_content_type_to_cache (state, content_type);
    }
}

static void
deep_count_finish (DeepCountState *state)
{
  prepare_async_result (state);

  if (state->enumerator)
    {
      if (!g_file_enumerator_is_closed (state->enumerator))
        g_file_enumerator_close_async (state->enumerator,
                                       0, NULL, NULL, NULL);

      g_object_unref (state->enumerator);
    }

  g_cancellable_reset (state->self->priv->cancellable);
  g_clear_object (&state->file);

  g_list_free_full (state->deep_count_subdirectories, g_object_unref);

  g_free (state);
}

static void
deep_count_next_dir (DeepCountState *state)
{
  GFile *new_file;

  g_clear_object (&state->file);

  if (state->deep_count_subdirectories != NULL)
    {
      /* Work on a new directory. */
      new_file = state->deep_count_subdirectories->data;
      state->deep_count_subdirectories =
        g_list_remove (state->deep_count_subdirectories, new_file);

      deep_count_load (state, new_file);
      g_object_unref (new_file);
    }
  else
    {
      deep_count_finish (state);
    }
}

static void
deep_count_more_files_callback (GObject *source_object,
				GAsyncResult *res,
				gpointer user_data)
{
  DeepCountState *state;
  GList *files, *l;
  GFileInfo *info;

  state = user_data;

  if (g_cancellable_is_cancelled (state->self->priv->cancellable))
    {
      deep_count_finish (state);
      return;
    }
	
  files = g_file_enumerator_next_files_finish (state->enumerator,
                                               res, NULL);
  
  for (l = files; l != NULL; l = l->next)
    {
      info = l->data;
      deep_count_one (state, info);
      g_object_unref (info);
    }

  if (files == NULL)
    {
      g_file_enumerator_close_async (state->enumerator, 0, NULL, NULL, NULL);
      g_object_unref (state->enumerator);
      state->enumerator = NULL;

      deep_count_next_dir (state);
    }
  else
    {
      g_file_enumerator_next_files_async (state->enumerator,
                                          DIRECTORY_LOAD_ITEMS_PER_CALLBACK,
                                          G_PRIORITY_LOW,
                                          state->self->priv->cancellable,
                                          deep_count_more_files_callback,
                                          state);
    }

  g_list_free (files);
}

static void
deep_count_callback (GObject *source_object,
		     GAsyncResult *res,
		     gpointer user_data)
{
  DeepCountState *state;
  GFileEnumerator *enumerator;

  state = user_data;

  if (g_cancellable_is_cancelled (state->self->priv->cancellable))
    {
      deep_count_finish (state);
      return;
    }

  enumerator = g_file_enumerate_children_finish (G_FILE (source_object),
                                                 res, NULL);
	
  if (enumerator == NULL)
    {
      deep_count_next_dir (state);
    }
  else
    {
      state->enumerator = enumerator;
      g_file_enumerator_next_files_async (state->enumerator,
                                          DIRECTORY_LOAD_ITEMS_PER_CALLBACK,
                                          G_PRIORITY_LOW,
                                          state->self->priv->cancellable,
                                          deep_count_more_files_callback,
                                          state);
    }
}

static void
deep_count_load (DeepCountState *state,
                 GFile *file)
{
  state->file = g_object_ref (file);

  g_file_enumerate_children_async (state->file,
                                   LOADER_ATTRS,
                                   G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS, /* flags */
                                   G_PRIORITY_LOW, /* prio */
                                   state->self->priv->cancellable,
                                   deep_count_callback,
                                   state);
}

static void
deep_count_start (ShellMimeSniffer *self)
{
  DeepCountState *state;

  state = g_new0 (DeepCountState, 1);
  state->self = self;

  deep_count_load (state, self->priv->file);
}

static void
query_info_async_ready_cb (GObject *source,
                           GAsyncResult *res,
                           gpointer user_data)
{
  GFileInfo *info;
  GError *error = NULL;
  ShellMimeSniffer *self = user_data;

  info = g_file_query_info_finish (G_FILE (source),
                                   res, &error);

  if (error != NULL)
    {
      g_simple_async_result_take_error (self->priv->async_result,
                                        error);
      g_simple_async_result_complete_in_idle (self->priv->async_result);

      return;
    }

  if (g_file_info_get_file_type (info) != G_FILE_TYPE_DIRECTORY)
    {
      g_simple_async_result_set_error (self->priv->async_result,
                                       G_IO_ERROR,
                                       G_IO_ERROR_NOT_DIRECTORY,
                                       "Not a directory");
      g_simple_async_result_complete_in_idle (self->priv->async_result);

      return;
    }

  deep_count_start (self);
}

static gboolean
watchdog_timeout_reached_cb (gpointer user_data)
{
  ShellMimeSniffer *self = user_data;

  self->priv->watchdog_id = 0;
  g_cancellable_cancel (self->priv->cancellable);

  return FALSE;
}

static void
start_loading_file (ShellMimeSniffer *self)
{
  g_file_query_info_async (self->priv->file,
                           LOADER_ATTRS,
                           G_FILE_QUERY_INFO_NONE,
                           G_PRIORITY_DEFAULT,
                           self->priv->cancellable,
                           query_info_async_ready_cb,
                           self);
}

static void
shell_mime_sniffer_set_file (ShellMimeSniffer *self,
                            GFile *file)
{
  g_clear_object (&self->priv->file);
  self->priv->file = g_object_ref (file);
}

static void
shell_mime_sniffer_dispose (GObject *object)
{
  ShellMimeSniffer *self = SHELL_MIME_SNIFFER (object);

  g_clear_object (&self->priv->file);
  g_clear_object (&self->priv->cancellable);
  g_clear_object (&self->priv->async_result);

  if (self->priv->watchdog_id != 0)
    {
      g_source_remove (self->priv->watchdog_id);
      self->priv->watchdog_id = 0;
    }

  G_OBJECT_CLASS (shell_mime_sniffer_parent_class)->dispose (object);
}

static void
shell_mime_sniffer_finalize (GObject *object)
{
  ShellMimeSniffer *self = SHELL_MIME_SNIFFER (object);

  g_strfreev (self->priv->sniffed_mime);

  G_OBJECT_CLASS (shell_mime_sniffer_parent_class)->finalize (object);
}

static void
shell_mime_sniffer_get_property (GObject *object,
                                guint       prop_id,
                                GValue     *value,
                                GParamSpec *pspec)
{
  ShellMimeSniffer *self = SHELL_MIME_SNIFFER (object);

  switch (prop_id) {
  case PROP_FILE:
    g_value_set_object (value, self->priv->file);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
shell_mime_sniffer_set_property (GObject *object,
                                guint       prop_id,
                                const GValue *value,
                                GParamSpec *pspec)
{
  ShellMimeSniffer *self = SHELL_MIME_SNIFFER (object);

  switch (prop_id) {
  case PROP_FILE:
    shell_mime_sniffer_set_file (self, g_value_get_object (value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
shell_mime_sniffer_class_init (ShellMimeSnifferClass *klass)
{
  GObjectClass *oclass;

  oclass = G_OBJECT_CLASS (klass);
  oclass->dispose = shell_mime_sniffer_dispose;
  oclass->finalize = shell_mime_sniffer_finalize;
  oclass->get_property = shell_mime_sniffer_get_property;
  oclass->set_property = shell_mime_sniffer_set_property;

  properties[PROP_FILE] =
    g_param_spec_object ("file",
                         "File",
                         "The loaded file",
                         G_TYPE_FILE,
                         G_PARAM_READWRITE);

  g_type_class_add_private (klass, sizeof (ShellMimeSnifferPrivate));
  g_object_class_install_properties (oclass, NUM_PROPERTIES, properties);
}

static void
shell_mime_sniffer_init (ShellMimeSniffer *self)
{
  self->priv =
    G_TYPE_INSTANCE_GET_PRIVATE (self,
                                 SHELL_TYPE_MIME_SNIFFER,
                                 ShellMimeSnifferPrivate);
  init_mimetypes ();
}

ShellMimeSniffer *
shell_mime_sniffer_new (GFile *file)
{
  return g_object_new (SHELL_TYPE_MIME_SNIFFER,
                       "file", file,
                       NULL);
}

void
shell_mime_sniffer_sniff_async (ShellMimeSniffer *self,
                                GAsyncReadyCallback callback,
                                gpointer user_data)
{
  g_assert (self->priv->watchdog_id == 0);
  g_assert (self->priv->async_result == NULL);

  self->priv->async_result = 
    g_simple_async_result_new (G_OBJECT (self),
                               callback, user_data,
                               shell_mime_sniffer_sniff_finish);
  
  self->priv->cancellable = g_cancellable_new ();

  self->priv->watchdog_id =
    g_timeout_add (WATCHDOG_TIMEOUT,
                   watchdog_timeout_reached_cb, self);

  start_loading_file (self);
}

gchar **
shell_mime_sniffer_sniff_finish (ShellMimeSniffer *self,
                                 GAsyncResult *res,
                                 GError **error)
{
  if (g_simple_async_result_propagate_error (self->priv->async_result, error))
    return NULL;

  return g_strdupv (self->priv->sniffed_mime);
}
