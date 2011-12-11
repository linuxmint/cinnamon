/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
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
 */

#ifndef __SHELL_MIME_SNIFFER_H__
#define __SHELL_MIME_SNIFFER_H__

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

#define SHELL_TYPE_MIME_SNIFFER            (shell_mime_sniffer_get_type ())
#define SHELL_MIME_SNIFFER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_MIME_SNIFFER, ShellMimeSniffer))
#define SHELL_IS_MIME_SNIFFER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_MIME_SNIFFER))
#define SHELL_MIME_SNIFFER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  SHELL_TYPE_MIME_SNIFFER, ShellMimeSnifferClass))
#define SHELL_IS_MIME_SNIFFER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  SHELL_TYPE_MIME_SNIFFER))
#define SHELL_MIME_SNIFFER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  SHELL_TYPE_MIME_SNIFFER, ShellMimeSnifferClass))

typedef struct _ShellMimeSniffer          ShellMimeSniffer;
typedef struct _ShellMimeSnifferPrivate   ShellMimeSnifferPrivate;
typedef struct _ShellMimeSnifferClass     ShellMimeSnifferClass;

struct _ShellMimeSniffer
{
  GObject parent_instance;

  ShellMimeSnifferPrivate *priv;
};

struct _ShellMimeSnifferClass
{
  GObjectClass parent_class;
};

GType    shell_mime_sniffer_get_type     (void) G_GNUC_CONST;

ShellMimeSniffer *shell_mime_sniffer_new (GFile *file);

void shell_mime_sniffer_sniff_async (ShellMimeSniffer *self,
                                     GAsyncReadyCallback callback,
                                     gpointer user_data);

gchar ** shell_mime_sniffer_sniff_finish (ShellMimeSniffer *self,
                                          GAsyncResult *res,
                                          GError **error);

G_END_DECLS

#endif /* __SHELL_MIME_SNIFFER_H__ */
