/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2008 William Jon McCann
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

#include "config.h"

#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>

#include <glib.h>
#include <glib/gi18n-lib.h>

#include <pulse/pulseaudio.h>

#include "gvc-channel-map.h"
#include "gvc-channel-map-private.h"

#define GVC_CHANNEL_MAP_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), GVC_TYPE_CHANNEL_MAP, GvcChannelMapPrivate))

struct GvcChannelMapPrivate
{
        pa_channel_map        pa_map;
        gboolean              pa_volume_is_set;
        pa_cvolume            pa_volume;
        gdouble               extern_volume[NUM_TYPES]; /* volume, balance, fade, lfe */
        gboolean              can_balance;
        gboolean              can_fade;
};

enum {
        VOLUME_CHANGED,
        LAST_SIGNAL
};

static guint signals [LAST_SIGNAL] = { 0, };

static void     gvc_channel_map_class_init (GvcChannelMapClass *klass);
static void     gvc_channel_map_init       (GvcChannelMap      *channel_map);
static void     gvc_channel_map_finalize   (GObject            *object);

G_DEFINE_TYPE (GvcChannelMap, gvc_channel_map, G_TYPE_OBJECT)

guint
gvc_channel_map_get_num_channels (const GvcChannelMap *map)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), 0);

        if (!pa_channel_map_valid(&map->priv->pa_map))
                return 0;

        return map->priv->pa_map.channels;
}

const gdouble *
gvc_channel_map_get_volume (GvcChannelMap *map)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), NULL);

        if (!pa_channel_map_valid(&map->priv->pa_map))
                return NULL;

        map->priv->extern_volume[VOLUME] = (gdouble) pa_cvolume_max (&map->priv->pa_volume);
        if (gvc_channel_map_can_balance (map))
                map->priv->extern_volume[BALANCE] = (gdouble) pa_cvolume_get_balance (&map->priv->pa_volume, &map->priv->pa_map);
        else
                map->priv->extern_volume[BALANCE] = 0;
        if (gvc_channel_map_can_fade (map))
                map->priv->extern_volume[FADE] = (gdouble) pa_cvolume_get_fade (&map->priv->pa_volume, &map->priv->pa_map);
        else
                map->priv->extern_volume[FADE] = 0;
        if (gvc_channel_map_has_lfe (map))
                map->priv->extern_volume[LFE] = (gdouble) pa_cvolume_get_position (&map->priv->pa_volume, &map->priv->pa_map, PA_CHANNEL_POSITION_LFE);
        else
                map->priv->extern_volume[LFE] = 0;

        return map->priv->extern_volume;
}

gboolean
gvc_channel_map_can_balance (const GvcChannelMap  *map)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), FALSE);

        return map->priv->can_balance;
}

gboolean
gvc_channel_map_can_fade (const GvcChannelMap  *map)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), FALSE);

        return map->priv->can_fade;
}

const char *
gvc_channel_map_get_mapping (const GvcChannelMap  *map)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), NULL);

        if (!pa_channel_map_valid(&map->priv->pa_map))
                return NULL;

        return pa_channel_map_to_pretty_name (&map->priv->pa_map);
}

/**
 * gvc_channel_map_has_position: (skip)
 * @map:
 * @position:
 *
 * Returns:
 */
gboolean
gvc_channel_map_has_position (const GvcChannelMap  *map,
                              pa_channel_position_t position)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), FALSE);

        return pa_channel_map_has_position (&(map->priv->pa_map), position);
}

const pa_channel_map *
gvc_channel_map_get_pa_channel_map (const GvcChannelMap  *map)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), NULL);

        if (!pa_channel_map_valid(&map->priv->pa_map))
                return NULL;

        return &map->priv->pa_map;
}

const pa_cvolume *
gvc_channel_map_get_cvolume (const GvcChannelMap  *map)
{
        g_return_val_if_fail (GVC_IS_CHANNEL_MAP (map), NULL);

        if (!pa_channel_map_valid(&map->priv->pa_map))
                return NULL;

        return &map->priv->pa_volume;
}

static void
gvc_channel_map_class_init (GvcChannelMapClass *klass)
{
        GObjectClass   *gobject_class = G_OBJECT_CLASS (klass);

        gobject_class->finalize = gvc_channel_map_finalize;

        signals [VOLUME_CHANGED] =
                g_signal_new ("volume-changed",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcChannelMapClass, volume_changed),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__BOOLEAN,
                              G_TYPE_NONE, 1, G_TYPE_BOOLEAN);

        g_type_class_add_private (klass, sizeof (GvcChannelMapPrivate));
}

void
gvc_channel_map_volume_changed (GvcChannelMap     *map,
                                const pa_cvolume  *cv,
                                gboolean           set)
{
        g_return_if_fail (GVC_IS_CHANNEL_MAP (map));
        g_return_if_fail (cv != NULL);
        g_return_if_fail (pa_cvolume_compatible_with_channel_map(cv, &map->priv->pa_map));

        if (pa_cvolume_equal(cv, &map->priv->pa_volume))
                return;

        map->priv->pa_volume = *cv;

        if (map->priv->pa_volume_is_set == FALSE) {
                map->priv->pa_volume_is_set = TRUE;
                return;
        }
        g_signal_emit (map, signals[VOLUME_CHANGED], 0, set);
}

static void
gvc_channel_map_init (GvcChannelMap *map)
{
        map->priv = GVC_CHANNEL_MAP_GET_PRIVATE (map);
        map->priv->pa_volume_is_set = FALSE;
}

static void
gvc_channel_map_finalize (GObject *object)
{
        GvcChannelMap *channel_map;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_IS_CHANNEL_MAP (object));

        channel_map = GVC_CHANNEL_MAP (object);

        g_return_if_fail (channel_map->priv != NULL);

        G_OBJECT_CLASS (gvc_channel_map_parent_class)->finalize (object);
}

GvcChannelMap *
gvc_channel_map_new (void)
{
        GObject *map;
        map = g_object_new (GVC_TYPE_CHANNEL_MAP, NULL);
        return GVC_CHANNEL_MAP (map);
}

static void
set_from_pa_map (GvcChannelMap        *map,
                 const pa_channel_map *pa_map)
{
        g_assert (pa_channel_map_valid(pa_map));

        map->priv->can_balance = pa_channel_map_can_balance (pa_map);
        map->priv->can_fade = pa_channel_map_can_fade (pa_map);

        map->priv->pa_map = *pa_map;
        pa_cvolume_set(&map->priv->pa_volume, pa_map->channels, PA_VOLUME_NORM);
}

GvcChannelMap *
gvc_channel_map_new_from_pa_channel_map (const pa_channel_map *pa_map)
{
        GObject *map;
        map = g_object_new (GVC_TYPE_CHANNEL_MAP, NULL);

        set_from_pa_map (GVC_CHANNEL_MAP (map), pa_map);

        return GVC_CHANNEL_MAP (map);
}
