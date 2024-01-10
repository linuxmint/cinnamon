/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-clipboard.c: clipboard object
 *
 * Copyright 2009 Intel Corporation.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms and conditions of the GNU Lesser General Public License,
 * version 2.1, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * SECTION:st-clipboard
 * @short_description: a simple representation of the clipboard
 *
 * #StCliboard is a very simple object representation of the clipboard
 * available to applications. Text is always assumed to be UTF-8 and non-text
 * items are not handled.
 */

#include "config.h"

#include "st-clipboard.h"

#include <meta/display.h>
#include <meta/meta-selection-source-memory.h>
#include <meta/meta-selection.h>

G_DEFINE_TYPE (StClipboard, st_clipboard, G_TYPE_OBJECT)

typedef struct _TransferData TransferData;
struct _TransferData
{
  StClipboard            *clipboard;
  StClipboardCallbackFunc callback;
  gpointer                user_data;
  GOutputStream          *stream;
};

const char *supported_mimetypes[] = {
  "text/plain;charset=utf-8",
  "UTF8_STRING",
  "text/plain",
  "STRING",
};

static MetaSelection *meta_selection = NULL;

static void
st_clipboard_class_init (StClipboardClass *klass)
{
}

static void
st_clipboard_init (StClipboard *self)
{
}

/**
 * st_clipboard_get_default:
 *
 * Get the global #StClipboard object that represents the clipboard.
 *
 * Returns: (transfer none): a #StClipboard owned by St and must not be
 * unrefferenced or freed.
 */
StClipboard*
st_clipboard_get_default (void)
{
  static StClipboard *default_clipboard = NULL;

  if (!default_clipboard)
    {
      default_clipboard = g_object_new (ST_TYPE_CLIPBOARD, NULL);
    }

  return default_clipboard;
}

static gboolean
convert_type (StClipboardType    type,
              MetaSelectionType *type_out)
{
  if (type == ST_CLIPBOARD_TYPE_PRIMARY)
    *type_out = META_SELECTION_PRIMARY;
  else if (type == ST_CLIPBOARD_TYPE_CLIPBOARD)
    *type_out = META_SELECTION_CLIPBOARD;
  else
    return FALSE;

  return TRUE;
}

static const char *
pick_mimetype (MetaSelection     *meta_selection,
               MetaSelectionType  selection_type)
{
  const char *selected_mimetype = NULL;
  GList *mimetypes;
  int i;

  mimetypes = meta_selection_get_mimetypes (meta_selection, selection_type);

  for (i = 0; i < G_N_ELEMENTS (supported_mimetypes); i++)
    {
      if (g_list_find_custom (mimetypes, supported_mimetypes[i],
                              (GCompareFunc) g_strcmp0))
        {
          selected_mimetype = supported_mimetypes[i];
          break;
        }
    }

  g_list_free_full (mimetypes, g_free);
  return selected_mimetype;
}

static void
transfer_cb (MetaSelection *selection,
             GAsyncResult  *res,
             TransferData  *data)
{
  gchar *text = NULL;

  if (meta_selection_transfer_finish (selection, res, NULL))
    {
      gsize data_size;

      data_size =
        g_memory_output_stream_get_data_size (G_MEMORY_OUTPUT_STREAM (data->stream));
      text = g_new0 (char, data_size + 1);
      memcpy (text, g_memory_output_stream_get_data (G_MEMORY_OUTPUT_STREAM (data->stream)), data_size);
    }

  data->callback (data->clipboard, text, data->user_data);
  g_object_unref (data->stream);
  g_free (data);
  g_free (text);
}

/**
 * st_clipboard_get_text:
 * @clipboard: A #StCliboard
 * @type: The type of clipboard data you want
 * @callback: (scope async): function to be called when the text is retreived
 * @user_data: data to be passed to the callback
 *
 * Request the data from the clipboard in text form. @callback is executed
 * when the data is retreived.
 *
 */
void
st_clipboard_get_text (StClipboard            *clipboard,
                       StClipboardType         type,
                       StClipboardCallbackFunc callback,
                       gpointer                user_data)
{
  MetaSelectionType selection_type;
  TransferData *data;
  const char *mimetype = NULL;

  g_return_if_fail (ST_IS_CLIPBOARD (clipboard));
  g_return_if_fail (meta_selection != NULL);
  g_return_if_fail (callback != NULL);

  if (convert_type (type, &selection_type))
    mimetype = pick_mimetype (meta_selection, selection_type);

  if (!mimetype)
    {
      callback (clipboard, NULL, user_data);
      return;
    }

  data = g_new0 (TransferData, 1);
  data->clipboard = clipboard;
  data->callback = callback;
  data->user_data = user_data;
  data->stream = g_memory_output_stream_new_resizable ();

  meta_selection_transfer_async (meta_selection,
                                 selection_type,
                                 mimetype, -1,
                                 data->stream, NULL,
                                 (GAsyncReadyCallback) transfer_cb,
                                 data);
}

/**
 * st_clipboard_set_content:
 * @clipboard: A #StClipboard
 * @type: The type of clipboard that you want to set
 * @mimetype: content mimetype
 * @bytes: content data
 *
 * Sets the clipboard content.
 **/
void
st_clipboard_set_content (StClipboard     *clipboard,
                          StClipboardType  type,
                          const gchar     *mimetype,
                          GBytes          *bytes)
{
  MetaSelectionType selection_type;
  MetaSelectionSource *source;

  g_return_if_fail (ST_IS_CLIPBOARD (clipboard));
  g_return_if_fail (meta_selection != NULL);
  g_return_if_fail (bytes != NULL);

  if (!convert_type (type, &selection_type))
    return;

  source = meta_selection_source_memory_new (mimetype, bytes);
  meta_selection_set_owner (meta_selection, selection_type, source);
  g_object_unref (source);
}

/**
 * st_clipboard_set_text:
 * @clipboard: A #StClipboard
 * @type: The type of clipboard that you want to set
 * @text: text to copy to the clipboard
 *
 * Sets text as the current contents of the clipboard.
 */
void
st_clipboard_set_text (StClipboard     *clipboard,
                       StClipboardType  type,
                       const gchar     *text)
{
  GBytes *bytes;

  g_return_if_fail (ST_IS_CLIPBOARD (clipboard));
  g_return_if_fail (meta_selection != NULL);
  g_return_if_fail (text != NULL);

  bytes = g_bytes_new_take (g_strdup (text), strlen (text));
  st_clipboard_set_content (clipboard, type, "text/plain;charset=utf-8", bytes);
  g_bytes_unref (bytes);
}

void
st_clipboard_set_selection (MetaSelection *selection)
{
  meta_selection = selection;
}
