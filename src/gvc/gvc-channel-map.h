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

#ifndef __GVC_CHANNEL_MAP_H
#define __GVC_CHANNEL_MAP_H

#include <glib-object.h>
#include <gvc-pulseaudio-fake.h>

G_BEGIN_DECLS

#define GVC_TYPE_CHANNEL_MAP         (gvc_channel_map_get_type ())
#define GVC_CHANNEL_MAP(o)           (G_TYPE_CHECK_INSTANCE_CAST ((o), GVC_TYPE_CHANNEL_MAP, GvcChannelMap))
#define GVC_CHANNEL_MAP_CLASS(k)     (G_TYPE_CHECK_CLASS_CAST((k), GVC_TYPE_CHANNEL_MAP, GvcChannelMapClass))
#define GVC_IS_CHANNEL_MAP(o)        (G_TYPE_CHECK_INSTANCE_TYPE ((o), GVC_TYPE_CHANNEL_MAP))
#define GVC_IS_CHANNEL_MAP_CLASS(k)  (G_TYPE_CHECK_CLASS_TYPE ((k), GVC_TYPE_CHANNEL_MAP))
#define GVC_CHANNEL_MAP_GET_CLASS(o) (G_TYPE_INSTANCE_GET_CLASS ((o), GVC_TYPE_CHANNEL_MAP, GvcChannelMapClass))

typedef struct GvcChannelMapPrivate GvcChannelMapPrivate;

typedef struct
{
        GObject               parent;
        GvcChannelMapPrivate *priv;
} GvcChannelMap;

typedef struct
{
        GObjectClass           parent_class;
        void (*volume_changed) (GvcChannelMap *channel_map, gboolean set);
} GvcChannelMapClass;

enum {
        VOLUME,
        BALANCE,
        FADE,
        LFE,
        NUM_TYPES
};

GType                   gvc_channel_map_get_type                (void);

GvcChannelMap *         gvc_channel_map_new                     (void);
guint                   gvc_channel_map_get_num_channels        (const GvcChannelMap  *map);
const gdouble *         gvc_channel_map_get_volume              (GvcChannelMap  *map);
gboolean                gvc_channel_map_can_balance             (const GvcChannelMap  *map);
gboolean                gvc_channel_map_can_fade                (const GvcChannelMap  *map);
gboolean                gvc_channel_map_has_position            (const GvcChannelMap  *map,
                                                                 pa_channel_position_t position);
#define                 gvc_channel_map_has_lfe(x)              gvc_channel_map_has_position (x, PA_CHANNEL_POSITION_LFE)

const char *            gvc_channel_map_get_mapping             (const GvcChannelMap  *map);

G_END_DECLS

#endif /* __GVC_CHANNEL_MAP_H */
