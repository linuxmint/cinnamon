/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2008 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 *
 */

#ifndef __GVC_CHANNEL_MAP_PRIVATE_H
#define __GVC_CHANNEL_MAP_PRIVATE_H

#include <glib-object.h>
#include <pulse/pulseaudio.h>

G_BEGIN_DECLS

GvcChannelMap *         gvc_channel_map_new_from_pa_channel_map (const pa_channel_map *map);
const pa_channel_map *  gvc_channel_map_get_pa_channel_map      (const GvcChannelMap  *map);

void                    gvc_channel_map_volume_changed          (GvcChannelMap    *map,
                                                                 const pa_cvolume *cv,
                                                                 gboolean          set);
const pa_cvolume *      gvc_channel_map_get_cvolume             (const GvcChannelMap  *map);

G_END_DECLS

#endif /* __GVC_CHANNEL_MAP_PRIVATE_H */
