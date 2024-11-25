/* -*- Mode: C; indent-tabs-mode: t; c-basic-offset: 8; tab-width: 8 -*- */
/* cinnamon-secure-text-buffer.c - secure memory clutter text buffer

   Copyright (C) 2009 Stefan Walter
   Copyright (C) 2012 Red Hat Inc.

   This program is free software; you can redistribute it and/or
   modify it under the terms of the GNU Library General Public License as
   published by the Free Software Foundation; either version 2 of the
   License, or (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
   Library General Public License for more details.

   You should have received a copy of the GNU Library General Public
   License along with the Gnome Library; see the file COPYING.LIB.  If not,
   see <http://www.gnu.org/licenses/>.

   Author: Stef Walter <stefw@gnome.org>
*/

#include "config.h"

#include "cinnamon-secure-text-buffer.h"

#define GCR_API_SUBJECT_TO_CHANGE
#include <gcr/gcr-base.h>

#include <string.h>

struct _CinnamonSecureTextBuffer {
  ClutterTextBuffer parent;
  gchar *text;
  gsize text_size;
  gsize text_bytes;
  guint text_chars;
};

/* Initial size of buffer, in bytes */
#define MIN_SIZE 16

G_DEFINE_TYPE (CinnamonSecureTextBuffer, cinnamon_secure_text_buffer, CLUTTER_TYPE_TEXT_BUFFER);

static const gchar *
cinnamon_secure_text_buffer_real_get_text (ClutterTextBuffer *buffer,
                                           gsize             *n_bytes)
{
  CinnamonSecureTextBuffer *self = CINNAMON_SECURE_TEXT_BUFFER (buffer);
  if (n_bytes)
    *n_bytes = self->text_bytes;
  if (!self->text)
    return "";
  return self->text;
}

static guint
cinnamon_secure_text_buffer_real_get_length (ClutterTextBuffer *buffer)
{
  CinnamonSecureTextBuffer *self = CINNAMON_SECURE_TEXT_BUFFER (buffer);
  return self->text_chars;
}

static guint
cinnamon_secure_text_buffer_real_insert_text (ClutterTextBuffer *buffer,
                                              guint              position,
                                              const gchar       *chars,
                                              guint              n_chars)
{
  CinnamonSecureTextBuffer *self = CINNAMON_SECURE_TEXT_BUFFER (buffer);
  gsize n_bytes;
  gsize at;

  n_bytes = g_utf8_offset_to_pointer (chars, n_chars) - chars;

  /* Need more memory */
  if (n_bytes + self->text_bytes + 1 > self->text_size)
    {
      /* Calculate our new buffer size */
      while (n_bytes + self->text_bytes + 1 > self->text_size)
        {
          if (self->text_size == 0)
            {
              self->text_size = MIN_SIZE;
            }
          else
            {
              if (2 * self->text_size < CLUTTER_TEXT_BUFFER_MAX_SIZE)
                {
                  self->text_size *= 2;
                }
              else
                {
                  self->text_size = CLUTTER_TEXT_BUFFER_MAX_SIZE;
                  if (n_bytes > self->text_size - self->text_bytes - 1)
                    {
                      n_bytes = self->text_size - self->text_bytes - 1;
                      n_bytes = g_utf8_find_prev_char (chars, chars + n_bytes + 1) - chars;
                      n_chars = g_utf8_strlen (chars, n_bytes);
                    }
                  break;
                }
            }
        }
      self->text = gcr_secure_memory_realloc (self->text, self->text_size);
    }

  /* Actual text insertion */
  at = g_utf8_offset_to_pointer (self->text, position) - self->text;
  memmove (self->text + at + n_bytes, self->text + at, self->text_bytes - at);
  memcpy (self->text + at, chars, n_bytes);

  /* Book keeping */
  self->text_bytes += n_bytes;
  self->text_chars += n_chars;
  self->text[self->text_bytes] = '\0';

  clutter_text_buffer_emit_inserted_text (buffer, position, chars, n_chars);
  return n_chars;
}

static guint
cinnamon_secure_text_buffer_real_delete_text (ClutterTextBuffer *buffer,
                                              guint              position,
                                              guint              n_chars)
{
  CinnamonSecureTextBuffer *self = CINNAMON_SECURE_TEXT_BUFFER (buffer);
  gsize start, end;

  if (position > self->text_chars)
    position = self->text_chars;
  if (position + n_chars > self->text_chars)
    n_chars = self->text_chars - position;

  if (n_chars > 0)
    {
      start = g_utf8_offset_to_pointer (self->text, position) - self->text;
      end = g_utf8_offset_to_pointer (self->text, position + n_chars) - self->text;

      memmove (self->text + start, self->text + end, self->text_bytes + 1 - end);
      self->text_chars -= n_chars;
      self->text_bytes -= (end - start);

      clutter_text_buffer_emit_deleted_text (buffer, position, n_chars);
    }

  return n_chars;
}

static void
cinnamon_secure_text_buffer_init (CinnamonSecureTextBuffer *self)
{

}

static void
cinnamon_secure_text_buffer_finalize (GObject *obj)
{
  CinnamonSecureTextBuffer *self = CINNAMON_SECURE_TEXT_BUFFER (obj);

  if (self->text)
    {
      gcr_secure_memory_strfree (self->text);
      self->text = NULL;
      self->text_bytes = self->text_size = 0;
      self->text_chars = 0;
    }

  G_OBJECT_CLASS (cinnamon_secure_text_buffer_parent_class)->finalize (obj);
}

static void
cinnamon_secure_text_buffer_class_init (CinnamonSecureTextBufferClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterTextBufferClass *buffer_class = CLUTTER_TEXT_BUFFER_CLASS (klass);

  gobject_class->finalize = cinnamon_secure_text_buffer_finalize;

  buffer_class->get_text = cinnamon_secure_text_buffer_real_get_text;
  buffer_class->get_length = cinnamon_secure_text_buffer_real_get_length;
  buffer_class->insert_text = cinnamon_secure_text_buffer_real_insert_text;
  buffer_class->delete_text = cinnamon_secure_text_buffer_real_delete_text;
}

ClutterTextBuffer *
cinnamon_secure_text_buffer_new (void)
{
  return g_object_new (CINNAMON_TYPE_SECURE_TEXT_BUFFER, NULL);
}

