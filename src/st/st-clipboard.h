/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-clipboard.h: clipboard object
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

#if !defined(ST_H_INSIDE) && !defined(ST_COMPILATION)
#error "Only <st/st.h> can be included directly.h"
#endif

#ifndef _ST_CLIPBOARD_H
#define _ST_CLIPBOARD_H

#include <glib-object.h>

G_BEGIN_DECLS

#define ST_TYPE_CLIPBOARD st_clipboard_get_type()

#define ST_CLIPBOARD(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), \
  ST_TYPE_CLIPBOARD, StClipboard))

#define ST_CLIPBOARD_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), \
  ST_TYPE_CLIPBOARD, StClipboardClass))

#define ST_IS_CLIPBOARD(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), \
  ST_TYPE_CLIPBOARD))

#define ST_IS_CLIPBOARD_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), \
  ST_TYPE_CLIPBOARD))

#define ST_CLIPBOARD_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), \
  ST_TYPE_CLIPBOARD, StClipboardClass))

typedef struct _StClipboard StClipboard;
typedef struct _StClipboardClass StClipboardClass;
typedef struct _StClipboardPrivate StClipboardPrivate;

/**
 * StClipboard:
 *
 * The contents of this structure is private and should only be accessed using
 * the provided API.
 */
struct _StClipboard
{
  /*< private >*/
  GObject parent;
  StClipboardPrivate *priv;
};

struct _StClipboardClass
{
  GObjectClass parent_class;
};

/**
 * StClipboardCallbackFunc:
 * @clipboard: A #StClipboard
 * @text: text from the clipboard
 * @user_data: user data
 *
 * Callback function called when text is retrieved from the clipboard.
 */
typedef void (*StClipboardCallbackFunc) (StClipboard *clipboard,
                                         const gchar *text,
                                         gpointer     user_data);

GType st_clipboard_get_type (void);

StClipboard* st_clipboard_get_default (void);

void st_clipboard_get_text (StClipboard             *clipboard,
                            StClipboardCallbackFunc  callback,
                            gpointer                 user_data);
void st_clipboard_set_text (StClipboard             *clipboard,
                            const gchar             *text);

G_END_DECLS

#endif /* _ST_CLIPBOARD_H */
