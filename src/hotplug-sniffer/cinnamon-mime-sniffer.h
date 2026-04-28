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
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

#ifndef __CINNAMON_MIME_SNIFFER_H__
#define __CINNAMON_MIME_SNIFFER_H__

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

#define CINNAMON_TYPE_MIME_SNIFFER (cinnamon_mime_sniffer_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonMimeSniffer, cinnamon_mime_sniffer,
                      CINNAMON, MIME_SNIFFER, GObject)

CinnamonMimeSniffer *cinnamon_mime_sniffer_new (GFile *file);

void cinnamon_mime_sniffer_sniff_async (CinnamonMimeSniffer *self,
                                     GAsyncReadyCallback callback,
                                     gpointer user_data);

gchar ** cinnamon_mime_sniffer_sniff_finish (CinnamonMimeSniffer *self,
                                          GAsyncResult *res,
                                          GError **error);

G_END_DECLS

#endif /* __CINNAMON_MIME_SNIFFER_H__ */
