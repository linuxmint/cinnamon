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
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA
 * 02110-1335, USA.
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

#ifndef __CINNAMON_MIME_SNIFFER_H__
#define __CINNAMON_MIME_SNIFFER_H__

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

#define CINNAMON_TYPE_MIME_SNIFFER            (cinnamon_mime_sniffer_get_type ())
#define CINNAMON_MIME_SNIFFER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_MIME_SNIFFER, CinnamonMimeSniffer))
#define CINNAMON_IS_MIME_SNIFFER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_MIME_SNIFFER))
#define CINNAMON_MIME_SNIFFER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  CINNAMON_TYPE_MIME_SNIFFER, CinnamonMimeSnifferClass))
#define CINNAMON_IS_MIME_SNIFFER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  CINNAMON_TYPE_MIME_SNIFFER))
#define CINNAMON_MIME_SNIFFER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  CINNAMON_TYPE_MIME_SNIFFER, CinnamonMimeSnifferClass))

typedef struct _CinnamonMimeSniffer          CinnamonMimeSniffer;
typedef struct _CinnamonMimeSnifferPrivate   CinnamonMimeSnifferPrivate;
typedef struct _CinnamonMimeSnifferClass     CinnamonMimeSnifferClass;

struct _CinnamonMimeSniffer
{
  GObject parent_instance;

  CinnamonMimeSnifferPrivate *priv;
};

struct _CinnamonMimeSnifferClass
{
  GObjectClass parent_class;
};

GType    cinnamon_mime_sniffer_get_type     (void) G_GNUC_CONST;

CinnamonMimeSniffer *cinnamon_mime_sniffer_new (GFile *file);

void cinnamon_mime_sniffer_sniff_async (CinnamonMimeSniffer *self,
                                     GAsyncReadyCallback callback,
                                     gpointer user_data);

gchar ** cinnamon_mime_sniffer_sniff_finish (CinnamonMimeSniffer *self,
                                          GAsyncResult *res,
                                          GError **error);

G_END_DECLS

#endif /* __CINNAMON_MIME_SNIFFER_H__ */
