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

#include "gvc-mixer-source-output.h"

#define GVC_MIXER_SOURCE_OUTPUT_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), GVC_TYPE_MIXER_SOURCE_OUTPUT, GvcMixerSourceOutputPrivate))

struct GvcMixerSourceOutputPrivate
{
        gpointer dummy;
};

static void     gvc_mixer_source_output_class_init (GvcMixerSourceOutputClass *klass);
static void     gvc_mixer_source_output_init       (GvcMixerSourceOutput      *mixer_source_output);
static void     gvc_mixer_source_output_finalize   (GObject            *object);

G_DEFINE_TYPE (GvcMixerSourceOutput, gvc_mixer_source_output, GVC_TYPE_MIXER_STREAM)

static gboolean
gvc_mixer_source_output_push_volume (GvcMixerStream *stream, gpointer *op)
{
        /* FIXME: */
        *op = NULL;
        return TRUE;
}

static gboolean
gvc_mixer_source_output_change_is_muted (GvcMixerStream *stream,
                                      gboolean        is_muted)
{
        /* FIXME: */
        return TRUE;
}

static void
gvc_mixer_source_output_class_init (GvcMixerSourceOutputClass *klass)
{
        GObjectClass        *object_class = G_OBJECT_CLASS (klass);
        GvcMixerStreamClass *stream_class = GVC_MIXER_STREAM_CLASS (klass);

        object_class->finalize = gvc_mixer_source_output_finalize;

        stream_class->push_volume = gvc_mixer_source_output_push_volume;
        stream_class->change_is_muted = gvc_mixer_source_output_change_is_muted;

        g_type_class_add_private (klass, sizeof (GvcMixerSourceOutputPrivate));
}

static void
gvc_mixer_source_output_init (GvcMixerSourceOutput *source_output)
{
        source_output->priv = GVC_MIXER_SOURCE_OUTPUT_GET_PRIVATE (source_output);

}

static void
gvc_mixer_source_output_finalize (GObject *object)
{
        GvcMixerSourceOutput *mixer_source_output;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_IS_MIXER_SOURCE_OUTPUT (object));

        mixer_source_output = GVC_MIXER_SOURCE_OUTPUT (object);

        g_return_if_fail (mixer_source_output->priv != NULL);
        G_OBJECT_CLASS (gvc_mixer_source_output_parent_class)->finalize (object);
}

/**
 * gvc_mixer_source_output_new: (skip)
 * @context:
 * @index:
 * @channel_map:
 *
 * Returns:
 */
GvcMixerStream *
gvc_mixer_source_output_new (pa_context    *context,
                             guint          index,
                             GvcChannelMap *channel_map)
{
        GObject *object;

        object = g_object_new (GVC_TYPE_MIXER_SOURCE_OUTPUT,
                               "pa-context", context,
                               "index", index,
                               "channel-map", channel_map,
                               NULL);

        return GVC_MIXER_STREAM (object);
}
