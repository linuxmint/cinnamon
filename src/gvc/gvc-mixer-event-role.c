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
#include <pulse/ext-stream-restore.h>

#include "gvc-mixer-event-role.h"
#include "gvc-mixer-stream-private.h"
#include "gvc-channel-map-private.h"

#define GVC_MIXER_EVENT_ROLE_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), GVC_TYPE_MIXER_EVENT_ROLE, GvcMixerEventRolePrivate))

struct GvcMixerEventRolePrivate
{
        char          *device;
};

enum
{
        PROP_0,
        PROP_DEVICE
};

static void     gvc_mixer_event_role_class_init (GvcMixerEventRoleClass *klass);
static void     gvc_mixer_event_role_init       (GvcMixerEventRole      *mixer_event_role);
static void     gvc_mixer_event_role_finalize   (GObject            *object);

G_DEFINE_TYPE (GvcMixerEventRole, gvc_mixer_event_role, GVC_TYPE_MIXER_STREAM)

static gboolean
update_settings (GvcMixerEventRole *role,
                 gboolean           is_muted,
                 gpointer          *op)
{
        pa_operation              *o;
        const GvcChannelMap       *map;
        pa_context                *context;
        pa_ext_stream_restore_info info;

        map = gvc_mixer_stream_get_channel_map (GVC_MIXER_STREAM(role));

        info.volume = *gvc_channel_map_get_cvolume(map);
        info.name = "sink-input-by-media-role:event";
        info.channel_map = *gvc_channel_map_get_pa_channel_map(map);
        info.device = role->priv->device;
        info.mute = is_muted;

        context = gvc_mixer_stream_get_pa_context (GVC_MIXER_STREAM (role));

        o = pa_ext_stream_restore_write (context,
                                         PA_UPDATE_REPLACE,
                                         &info,
                                         1,
                                         TRUE,
                                         NULL,
                                         NULL);

        if (o == NULL) {
                g_warning ("pa_ext_stream_restore_write() failed");
                return FALSE;
        }

        if (op != NULL)
                *op = o;

        return TRUE;
}

static gboolean
gvc_mixer_event_role_push_volume (GvcMixerStream *stream, gpointer *op)
{
        return update_settings (GVC_MIXER_EVENT_ROLE (stream),
                                gvc_mixer_stream_get_is_muted (stream), op);
}

static gboolean
gvc_mixer_event_role_change_is_muted (GvcMixerStream *stream,
                                      gboolean        is_muted)
{
        return update_settings (GVC_MIXER_EVENT_ROLE (stream),
                                is_muted, NULL);
}

static gboolean
gvc_mixer_event_role_set_device (GvcMixerEventRole *role,
                                 const char        *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_EVENT_ROLE (role), FALSE);

        g_free (role->priv->device);
        role->priv->device = g_strdup (device);
        g_object_notify (G_OBJECT (role), "device");

        return TRUE;
}

static void
gvc_mixer_event_role_set_property (GObject       *object,
                                   guint          prop_id,
                                   const GValue  *value,
                                   GParamSpec    *pspec)
{
        GvcMixerEventRole *self = GVC_MIXER_EVENT_ROLE (object);

        switch (prop_id) {
        case PROP_DEVICE:
                gvc_mixer_event_role_set_device (self, g_value_get_string (value));
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}

static void
gvc_mixer_event_role_get_property (GObject     *object,
                                   guint        prop_id,
                                   GValue      *value,
                                   GParamSpec  *pspec)
{
        GvcMixerEventRole *self = GVC_MIXER_EVENT_ROLE (object);

        switch (prop_id) {
        case PROP_DEVICE:
                g_value_set_string (value, self->priv->device);
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}

static void
gvc_mixer_event_role_class_init (GvcMixerEventRoleClass *klass)
{
        GObjectClass        *object_class = G_OBJECT_CLASS (klass);
        GvcMixerStreamClass *stream_class = GVC_MIXER_STREAM_CLASS (klass);

        object_class->finalize = gvc_mixer_event_role_finalize;
        object_class->set_property = gvc_mixer_event_role_set_property;
        object_class->get_property = gvc_mixer_event_role_get_property;

        stream_class->push_volume = gvc_mixer_event_role_push_volume;
        stream_class->change_is_muted = gvc_mixer_event_role_change_is_muted;

        g_object_class_install_property (object_class,
                                         PROP_DEVICE,
                                         g_param_spec_string ("device",
                                                              "Device",
                                                              "Device",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));

        g_type_class_add_private (klass, sizeof (GvcMixerEventRolePrivate));
}

static void
gvc_mixer_event_role_init (GvcMixerEventRole *event_role)
{
        event_role->priv = GVC_MIXER_EVENT_ROLE_GET_PRIVATE (event_role);

}

static void
gvc_mixer_event_role_finalize (GObject *object)
{
        GvcMixerEventRole *mixer_event_role;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_IS_MIXER_EVENT_ROLE (object));

        mixer_event_role = GVC_MIXER_EVENT_ROLE (object);

        g_return_if_fail (mixer_event_role->priv != NULL);

        g_free (mixer_event_role->priv->device);

        G_OBJECT_CLASS (gvc_mixer_event_role_parent_class)->finalize (object);
}

/**
 * gvc_mixer_event_role_new: (skip)
 * @context:
 * @device:
 * @channel_map:
 *
 * Returns:
 */
GvcMixerStream *
gvc_mixer_event_role_new (pa_context *context,
                          const char *device,
                          GvcChannelMap *channel_map)
{
        GObject *object;

        object = g_object_new (GVC_TYPE_MIXER_EVENT_ROLE,
                               "pa-context", context,
                               "index", 0,
                               "device", device,
                               "channel-map", channel_map,
                               NULL);

        return GVC_MIXER_STREAM (object);
}
