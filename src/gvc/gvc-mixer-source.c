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

#include "gvc-mixer-source.h"
#include "gvc-mixer-stream-private.h"
#include "gvc-channel-map-private.h"

#define GVC_MIXER_SOURCE_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), GVC_TYPE_MIXER_SOURCE, GvcMixerSourcePrivate))

struct GvcMixerSourcePrivate
{
        gpointer dummy;
};

static void     gvc_mixer_source_class_init (GvcMixerSourceClass *klass);
static void     gvc_mixer_source_init       (GvcMixerSource      *mixer_source);
static void     gvc_mixer_source_finalize   (GObject            *object);

G_DEFINE_TYPE (GvcMixerSource, gvc_mixer_source, GVC_TYPE_MIXER_STREAM)

static gboolean
gvc_mixer_source_push_volume (GvcMixerStream *stream, gpointer *op)
{
        pa_operation        *o;
        guint                index;
        const GvcChannelMap *map;
        pa_context          *context;
        const pa_cvolume    *cv;

        index = gvc_mixer_stream_get_index (stream);

        map = gvc_mixer_stream_get_channel_map (stream);

        /* set the volume */
        cv = gvc_channel_map_get_cvolume (map);

        context = gvc_mixer_stream_get_pa_context (stream);

        o = pa_context_set_source_volume_by_index (context,
                                                   index,
                                                   cv,
                                                   NULL,
                                                   NULL);

        if (o == NULL) {
                g_warning ("pa_context_set_source_volume_by_index() failed: %s", pa_strerror(pa_context_errno(context)));
                return FALSE;
        }

        *op = o;

        return TRUE;
}

static gboolean
gvc_mixer_source_change_is_muted (GvcMixerStream *stream,
                                gboolean        is_muted)
{
        pa_operation *o;
        guint         index;
        pa_context   *context;

        index = gvc_mixer_stream_get_index (stream);
        context = gvc_mixer_stream_get_pa_context (stream);

        o = pa_context_set_source_mute_by_index (context,
                                                 index,
                                                 is_muted,
                                                 NULL,
                                                 NULL);

        if (o == NULL) {
                g_warning ("pa_context_set_source_mute_by_index() failed: %s", pa_strerror(pa_context_errno(context)));
                return FALSE;
        }

        pa_operation_unref(o);

        return TRUE;
}

static gboolean
gvc_mixer_source_change_port (GvcMixerStream *stream,
                              const char     *port)
{
#if PA_MICRO > 15
        pa_operation *o;
        guint         index;
        pa_context   *context;

        index = gvc_mixer_stream_get_index (stream);
        context = gvc_mixer_stream_get_pa_context (stream);

        o = pa_context_set_source_port_by_index (context,
                                                 index,
                                                 port,
                                                 NULL,
                                                 NULL);

        if (o == NULL) {
                g_warning ("pa_context_set_source_port_by_index() failed: %s", pa_strerror(pa_context_errno(context)));
                return FALSE;
        }

        pa_operation_unref(o);

        return TRUE;
#else
        return FALSE;
#endif /* PA_MICRO > 15 */
}

static void
gvc_mixer_source_class_init (GvcMixerSourceClass *klass)
{
        GObjectClass        *object_class = G_OBJECT_CLASS (klass);
        GvcMixerStreamClass *stream_class = GVC_MIXER_STREAM_CLASS (klass);

        object_class->finalize = gvc_mixer_source_finalize;

        stream_class->push_volume = gvc_mixer_source_push_volume;
        stream_class->change_is_muted = gvc_mixer_source_change_is_muted;
        stream_class->change_port = gvc_mixer_source_change_port;

        g_type_class_add_private (klass, sizeof (GvcMixerSourcePrivate));
}

static void
gvc_mixer_source_init (GvcMixerSource *source)
{
        source->priv = GVC_MIXER_SOURCE_GET_PRIVATE (source);
}

static void
gvc_mixer_source_finalize (GObject *object)
{
        GvcMixerSource *mixer_source;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_IS_MIXER_SOURCE (object));

        mixer_source = GVC_MIXER_SOURCE (object);

        g_return_if_fail (mixer_source->priv != NULL);
        G_OBJECT_CLASS (gvc_mixer_source_parent_class)->finalize (object);
}

/**
 * gvc_mixer_source_new: (skip)
 * @context:
 * @index:
 * @map:
 *
 * Returns:
 */
GvcMixerStream *
gvc_mixer_source_new (pa_context    *context,
                      guint          index,
                      GvcChannelMap *channel_map)

{
        GObject *object;

        object = g_object_new (GVC_TYPE_MIXER_SOURCE,
                               "pa-context", context,
                               "index", index,
                               "channel-map", channel_map,
                               NULL);

        return GVC_MIXER_STREAM (object);
}
