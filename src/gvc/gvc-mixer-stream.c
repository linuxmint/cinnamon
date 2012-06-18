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

#include "gvc-mixer-stream.h"
#include "gvc-mixer-stream-private.h"
#include "gvc-channel-map-private.h"

#define GVC_MIXER_STREAM_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), GVC_TYPE_MIXER_STREAM, GvcMixerStreamPrivate))

static guint32 stream_serial = 1;

struct GvcMixerStreamPrivate
{
        pa_context    *pa_context;
        guint          id;
        guint          index;
        gint           card_index;
        GvcChannelMap *channel_map;
        char          *name;
        char          *description;
        char          *application_id;
        char          *icon_name;
        gboolean       is_muted;
        gboolean       can_decibel;
        gboolean       is_event_stream;
        gboolean       is_virtual;
        pa_volume_t    base_volume;
        pa_operation  *change_volume_op;
        char          *port;
        char          *human_port;
        GList         *ports;
};

enum
{
        PROP_0,
        PROP_ID,
        PROP_PA_CONTEXT,
        PROP_CHANNEL_MAP,
        PROP_INDEX,
        PROP_NAME,
        PROP_DESCRIPTION,
        PROP_APPLICATION_ID,
        PROP_ICON_NAME,
        PROP_VOLUME,
        PROP_DECIBEL,
        PROP_IS_MUTED,
        PROP_CAN_DECIBEL,
        PROP_IS_EVENT_STREAM,
        PROP_IS_VIRTUAL,
        PROP_CARD_INDEX,
        PROP_PORT,
};

static void     gvc_mixer_stream_class_init (GvcMixerStreamClass *klass);
static void     gvc_mixer_stream_init       (GvcMixerStream      *mixer_stream);
static void     gvc_mixer_stream_finalize   (GObject            *object);

G_DEFINE_ABSTRACT_TYPE (GvcMixerStream, gvc_mixer_stream, G_TYPE_OBJECT)

static guint32
get_next_stream_serial (void)
{
        guint32 serial;

        serial = stream_serial++;

        if ((gint32)stream_serial < 0) {
                stream_serial = 1;
        }

        return serial;
}

pa_context *
gvc_mixer_stream_get_pa_context (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), 0);
        return stream->priv->pa_context;
}

guint
gvc_mixer_stream_get_index (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), 0);
        return stream->priv->index;
}

guint
gvc_mixer_stream_get_id (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), 0);
        return stream->priv->id;
}

const GvcChannelMap *
gvc_mixer_stream_get_channel_map (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        return stream->priv->channel_map;
}

/**
 * gvc_mixer_stream_get_volume:
 * @stream:
 *
 * Returns: (type guint32) (transfer none):
 */
pa_volume_t
gvc_mixer_stream_get_volume (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), 0);

        return (pa_volume_t) gvc_channel_map_get_volume(stream->priv->channel_map)[VOLUME];
}

gdouble
gvc_mixer_stream_get_decibel (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), 0);

        return pa_sw_volume_to_dB(
                        (pa_volume_t) gvc_channel_map_get_volume(stream->priv->channel_map)[VOLUME]);
}

/**
 * gvc_mixer_stream_set_volume:
 * @stream:
 * @volume: (type guint32):
 *
 * Returns:
 */
gboolean
gvc_mixer_stream_set_volume (GvcMixerStream *stream,
                              pa_volume_t     volume)
{
        pa_cvolume cv;

        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        cv = *gvc_channel_map_get_cvolume(stream->priv->channel_map);
        pa_cvolume_scale(&cv, volume);

        if (!pa_cvolume_equal(gvc_channel_map_get_cvolume(stream->priv->channel_map), &cv)) {
                gvc_channel_map_volume_changed(stream->priv->channel_map, &cv, FALSE);
                g_object_notify (G_OBJECT (stream), "volume");
                return TRUE;
        }

        return FALSE;
}

gboolean
gvc_mixer_stream_set_decibel (GvcMixerStream *stream,
                              gdouble         db)
{
        pa_cvolume cv;

        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        cv = *gvc_channel_map_get_cvolume(stream->priv->channel_map);
        pa_cvolume_scale(&cv, pa_sw_volume_from_dB(db));

        if (!pa_cvolume_equal(gvc_channel_map_get_cvolume(stream->priv->channel_map), &cv)) {
                gvc_channel_map_volume_changed(stream->priv->channel_map, &cv, FALSE);
                g_object_notify (G_OBJECT (stream), "volume");
        }

        return TRUE;
}

gboolean
gvc_mixer_stream_get_is_muted  (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);
        return stream->priv->is_muted;
}

gboolean
gvc_mixer_stream_get_can_decibel (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);
        return stream->priv->can_decibel;
}

gboolean
gvc_mixer_stream_set_is_muted  (GvcMixerStream *stream,
                                gboolean        is_muted)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        if (is_muted != stream->priv->is_muted) {
                stream->priv->is_muted = is_muted;
                g_object_notify (G_OBJECT (stream), "is-muted");
        }

        return TRUE;
}

gboolean
gvc_mixer_stream_set_can_decibel  (GvcMixerStream *stream,
                                   gboolean        can_decibel)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        if (can_decibel != stream->priv->can_decibel) {
                stream->priv->can_decibel = can_decibel;
                g_object_notify (G_OBJECT (stream), "can-decibel");
        }

        return TRUE;
}

const char *
gvc_mixer_stream_get_name (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        return stream->priv->name;
}

const char *
gvc_mixer_stream_get_description (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        return stream->priv->description;
}

gboolean
gvc_mixer_stream_set_name (GvcMixerStream *stream,
                           const char     *name)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        g_free (stream->priv->name);
        stream->priv->name = g_strdup (name);
        g_object_notify (G_OBJECT (stream), "name");

        return TRUE;
}

gboolean
gvc_mixer_stream_set_description (GvcMixerStream *stream,
                                  const char     *description)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        g_free (stream->priv->description);
        stream->priv->description = g_strdup (description);
        g_object_notify (G_OBJECT (stream), "description");

        return TRUE;
}

gboolean
gvc_mixer_stream_is_event_stream (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        return stream->priv->is_event_stream;
}

gboolean
gvc_mixer_stream_set_is_event_stream (GvcMixerStream *stream,
                                      gboolean is_event_stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        stream->priv->is_event_stream = is_event_stream;
        g_object_notify (G_OBJECT (stream), "is-event-stream");

        return TRUE;
}

gboolean
gvc_mixer_stream_is_virtual (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        return stream->priv->is_virtual;
}

gboolean
gvc_mixer_stream_set_is_virtual (GvcMixerStream *stream,
                                 gboolean is_virtual)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        stream->priv->is_virtual = is_virtual;
        g_object_notify (G_OBJECT (stream), "is-virtual");

        return TRUE;
}

const char *
gvc_mixer_stream_get_application_id (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        return stream->priv->application_id;
}

gboolean
gvc_mixer_stream_set_application_id (GvcMixerStream *stream,
                                     const char *application_id)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        g_free (stream->priv->application_id);
        stream->priv->application_id = g_strdup (application_id);
        g_object_notify (G_OBJECT (stream), "application-id");

        return TRUE;
}

static void
on_channel_map_volume_changed (GvcChannelMap  *channel_map,
                               gboolean        set,
                               GvcMixerStream *stream)
{
        if (set == TRUE)
                gvc_mixer_stream_push_volume (stream);

        g_object_notify (G_OBJECT (stream), "volume");
}

static gboolean
gvc_mixer_stream_set_channel_map (GvcMixerStream *stream,
                                  GvcChannelMap  *channel_map)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        if (channel_map != NULL) {
                g_object_ref (channel_map);
        }

        if (stream->priv->channel_map != NULL) {
                g_signal_handlers_disconnect_by_func (stream->priv->channel_map,
                                                      on_channel_map_volume_changed,
                                                      stream);
                g_object_unref (stream->priv->channel_map);
        }

        stream->priv->channel_map = channel_map;

        if (stream->priv->channel_map != NULL) {
                g_signal_connect (stream->priv->channel_map,
                                  "volume-changed",
                                  G_CALLBACK (on_channel_map_volume_changed),
                                  stream);

                g_object_notify (G_OBJECT (stream), "channel-map");
        }

        return TRUE;
}

const char *
gvc_mixer_stream_get_icon_name (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        return stream->priv->icon_name;
}

/**
 * gvc_mixer_stream_get_gicon:
 * @stream: a #GvcMixerStream
 *
 * Returns: (transfer full): a new #GIcon
 */
GIcon *
gvc_mixer_stream_get_gicon (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        if (stream->priv->icon_name == NULL)
                return NULL;
        return g_themed_icon_new_with_default_fallbacks (stream->priv->icon_name);
}

gboolean
gvc_mixer_stream_set_icon_name (GvcMixerStream *stream,
                                const char     *icon_name)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        g_free (stream->priv->icon_name);
        stream->priv->icon_name = g_strdup (icon_name);
        g_object_notify (G_OBJECT (stream), "icon-name");

        return TRUE;
}

/**
 * gvc_mixer_stream_get_base_volume:
 * @stream:
 *
 * Returns: (type guint32) (transfer none):
 */
pa_volume_t
gvc_mixer_stream_get_base_volume (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), 0);

        return stream->priv->base_volume;
}

/**
 * gvc_mixer_stream_set_base_volume:
 * @stream:
 * @base_volume: (type guint32):
 *
 * Returns:
 */
gboolean
gvc_mixer_stream_set_base_volume (GvcMixerStream *stream,
                                  pa_volume_t base_volume)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        stream->priv->base_volume = base_volume;

        return TRUE;
}

const GvcMixerStreamPort *
gvc_mixer_stream_get_port (GvcMixerStream *stream)
{
        GList *l;

        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        g_return_val_if_fail (stream->priv->ports != NULL, NULL);

        for (l = stream->priv->ports; l != NULL; l = l->next) {
                GvcMixerStreamPort *p = l->data;
                if (g_strcmp0 (stream->priv->port, p->port) == 0) {
                        return p;
                }
        }

        g_assert_not_reached ();

        return NULL;
}

gboolean
gvc_mixer_stream_set_port (GvcMixerStream *stream,
                           const char     *port)
{
        GList *l;

        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);
        g_return_val_if_fail (stream->priv->ports != NULL, FALSE);

        g_free (stream->priv->port);
        stream->priv->port = g_strdup (port);

        g_free (stream->priv->human_port);
        stream->priv->human_port = NULL;

        for (l = stream->priv->ports; l != NULL; l = l->next) {
                GvcMixerStreamPort *p = l->data;
                if (g_str_equal (stream->priv->port, p->port)) {
                        stream->priv->human_port = g_strdup (p->human_port);
                        break;
                }
        }

        g_object_notify (G_OBJECT (stream), "port");

        return TRUE;
}

gboolean
gvc_mixer_stream_change_port (GvcMixerStream *stream,
                              const char     *port)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);
        return GVC_MIXER_STREAM_GET_CLASS (stream)->change_port (stream, port);
}

/**
 * gvc_mixer_stream_get_ports:
 *
 * Return value: (transfer none) (element-type GvcMixerStreamPort):
 */
const GList *
gvc_mixer_stream_get_ports (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), NULL);
        return stream->priv->ports;
}

static int
sort_ports (GvcMixerStreamPort *a,
            GvcMixerStreamPort *b)
{
        if (a->priority == b->priority)
                return 0;
        if (a->priority > b->priority)
                return 1;
        return -1;
}

/**
 * gvc_mixer_stream_set_ports:
 * @ports: (transfer full) (element-type GvcMixerStreamPort):
 */
gboolean
gvc_mixer_stream_set_ports (GvcMixerStream *stream,
                            GList          *ports)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);
        g_return_val_if_fail (stream->priv->ports == NULL, FALSE);

        stream->priv->ports = g_list_sort (ports, (GCompareFunc) sort_ports);

        return TRUE;
}

gint
gvc_mixer_stream_get_card_index (GvcMixerStream *stream)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), PA_INVALID_INDEX);
        return stream->priv->card_index;
}

gboolean
gvc_mixer_stream_set_card_index (GvcMixerStream *stream,
                                 gint            card_index)
{
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        stream->priv->card_index = card_index;
        g_object_notify (G_OBJECT (stream), "card-index");

        return TRUE;
}

static void
gvc_mixer_stream_set_property (GObject       *object,
                               guint          prop_id,
                               const GValue  *value,
                               GParamSpec    *pspec)
{
        GvcMixerStream *self = GVC_MIXER_STREAM (object);

        switch (prop_id) {
        case PROP_PA_CONTEXT:
                self->priv->pa_context = g_value_get_pointer (value);
                break;
        case PROP_INDEX:
                self->priv->index = g_value_get_ulong (value);
                break;
        case PROP_ID:
                self->priv->id = g_value_get_ulong (value);
                break;
        case PROP_CHANNEL_MAP:
                gvc_mixer_stream_set_channel_map (self, g_value_get_object (value));
                break;
        case PROP_NAME:
                gvc_mixer_stream_set_name (self, g_value_get_string (value));
                break;
        case PROP_DESCRIPTION:
                gvc_mixer_stream_set_description (self, g_value_get_string (value));
                break;
        case PROP_APPLICATION_ID:
                gvc_mixer_stream_set_application_id (self, g_value_get_string (value));
                break;
        case PROP_ICON_NAME:
                gvc_mixer_stream_set_icon_name (self, g_value_get_string (value));
                break;
        case PROP_VOLUME:
                gvc_mixer_stream_set_volume (self, g_value_get_ulong (value));
                break;
        case PROP_DECIBEL:
                gvc_mixer_stream_set_decibel (self, g_value_get_double (value));
                break;
        case PROP_IS_MUTED:
                gvc_mixer_stream_set_is_muted (self, g_value_get_boolean (value));
                break;
        case PROP_IS_EVENT_STREAM:
                gvc_mixer_stream_set_is_event_stream (self, g_value_get_boolean (value));
                break;
        case PROP_IS_VIRTUAL:
                gvc_mixer_stream_set_is_virtual (self, g_value_get_boolean (value));
                break;
        case PROP_CAN_DECIBEL:
                gvc_mixer_stream_set_can_decibel (self, g_value_get_boolean (value));
                break;
        case PROP_PORT:
                gvc_mixer_stream_set_port (self, g_value_get_string (value));
                break;
        case PROP_CARD_INDEX:
                self->priv->card_index = g_value_get_long (value);
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}

static void
gvc_mixer_stream_get_property (GObject     *object,
                               guint        prop_id,
                               GValue      *value,
                               GParamSpec  *pspec)
{
        GvcMixerStream *self = GVC_MIXER_STREAM (object);

        switch (prop_id) {
        case PROP_PA_CONTEXT:
                g_value_set_pointer (value, self->priv->pa_context);
                break;
        case PROP_INDEX:
                g_value_set_ulong (value, self->priv->index);
                break;
        case PROP_ID:
                g_value_set_ulong (value, self->priv->id);
                break;
        case PROP_CHANNEL_MAP:
                g_value_set_object (value, self->priv->channel_map);
                break;
        case PROP_NAME:
                g_value_set_string (value, self->priv->name);
                break;
        case PROP_DESCRIPTION:
                g_value_set_string (value, self->priv->description);
                break;
        case PROP_APPLICATION_ID:
                g_value_set_string (value, self->priv->application_id);
                break;
        case PROP_ICON_NAME:
                g_value_set_string (value, self->priv->icon_name);
                break;
        case PROP_VOLUME:
                g_value_set_ulong (value,
                                   pa_cvolume_max(gvc_channel_map_get_cvolume(self->priv->channel_map)));
                break;
        case PROP_DECIBEL:
                g_value_set_double (value,
                                    pa_sw_volume_to_dB(pa_cvolume_max(gvc_channel_map_get_cvolume(self->priv->channel_map))));
                break;
        case PROP_IS_MUTED:
                g_value_set_boolean (value, self->priv->is_muted);
                break;
        case PROP_IS_EVENT_STREAM:
                g_value_set_boolean (value, self->priv->is_event_stream);
                break;
        case PROP_IS_VIRTUAL:
                g_value_set_boolean (value, self->priv->is_virtual);
                break;
        case PROP_CAN_DECIBEL:
                g_value_set_boolean (value, self->priv->can_decibel);
                break;
        case PROP_PORT:
                g_value_set_string (value, self->priv->port);
                break;
        case PROP_CARD_INDEX:
                g_value_set_long (value, self->priv->card_index);
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}

static GObject *
gvc_mixer_stream_constructor (GType                  type,
                              guint                  n_construct_properties,
                              GObjectConstructParam *construct_params)
{
        GObject       *object;
        GvcMixerStream *self;

        object = G_OBJECT_CLASS (gvc_mixer_stream_parent_class)->constructor (type, n_construct_properties, construct_params);

        self = GVC_MIXER_STREAM (object);

        self->priv->id = get_next_stream_serial ();

        return object;
}

static gboolean
gvc_mixer_stream_real_change_port (GvcMixerStream *stream,
                                   const char     *port)
{
        return FALSE;
}

static gboolean
gvc_mixer_stream_real_push_volume (GvcMixerStream *stream, gpointer *op)
{
        return FALSE;
}

static gboolean
gvc_mixer_stream_real_change_is_muted (GvcMixerStream *stream,
                                       gboolean        is_muted)
{
        return FALSE;
}

gboolean
gvc_mixer_stream_push_volume (GvcMixerStream *stream)
{
        pa_operation *op;
        gboolean ret;

        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        if (stream->priv->is_event_stream != FALSE)
                return TRUE;

        g_debug ("Pushing new volume to stream '%s' (%s)",
                 stream->priv->description, stream->priv->name);

        ret = GVC_MIXER_STREAM_GET_CLASS (stream)->push_volume (stream, (gpointer *) &op);
        if (ret) {
                if (stream->priv->change_volume_op != NULL)
                        pa_operation_unref (stream->priv->change_volume_op);
                stream->priv->change_volume_op = op;
        }
        return ret;
}

gboolean
gvc_mixer_stream_change_is_muted (GvcMixerStream *stream,
                                  gboolean        is_muted)
{
        gboolean ret;
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);
        ret = GVC_MIXER_STREAM_GET_CLASS (stream)->change_is_muted (stream, is_muted);
        return ret;
}

gboolean
gvc_mixer_stream_is_running (GvcMixerStream *stream)
{
        if (stream->priv->change_volume_op == NULL)
                return FALSE;

        if ((pa_operation_get_state(stream->priv->change_volume_op) == PA_OPERATION_RUNNING))
                return TRUE;

        pa_operation_unref(stream->priv->change_volume_op);
        stream->priv->change_volume_op = NULL;

        return FALSE;
}

static void
gvc_mixer_stream_class_init (GvcMixerStreamClass *klass)
{
        GObjectClass   *gobject_class = G_OBJECT_CLASS (klass);

        gobject_class->constructor = gvc_mixer_stream_constructor;
        gobject_class->finalize = gvc_mixer_stream_finalize;
        gobject_class->set_property = gvc_mixer_stream_set_property;
        gobject_class->get_property = gvc_mixer_stream_get_property;

        klass->push_volume = gvc_mixer_stream_real_push_volume;
        klass->change_port = gvc_mixer_stream_real_change_port;
        klass->change_is_muted = gvc_mixer_stream_real_change_is_muted;

        g_object_class_install_property (gobject_class,
                                         PROP_INDEX,
                                         g_param_spec_ulong ("index",
                                                             "Index",
                                                             "The index for this stream",
                                                             0, G_MAXULONG, 0,
                                                             G_PARAM_READWRITE|G_PARAM_CONSTRUCT_ONLY));
        g_object_class_install_property (gobject_class,
                                         PROP_ID,
                                         g_param_spec_ulong ("id",
                                                             "id",
                                                             "The id for this stream",
                                                             0, G_MAXULONG, 0,
                                                             G_PARAM_READWRITE|G_PARAM_CONSTRUCT_ONLY));
        g_object_class_install_property (gobject_class,
                                         PROP_CHANNEL_MAP,
                                         g_param_spec_object ("channel-map",
                                                              "channel map",
                                                              "The channel map for this stream",
                                                              GVC_TYPE_CHANNEL_MAP,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_PA_CONTEXT,
                                         g_param_spec_pointer ("pa-context",
                                                               "PulseAudio context",
                                                               "The PulseAudio context for this stream",
                                                               G_PARAM_READWRITE|G_PARAM_CONSTRUCT_ONLY));
        g_object_class_install_property (gobject_class,
                                         PROP_VOLUME,
                                         g_param_spec_ulong ("volume",
                                                             "Volume",
                                                             "The volume for this stream",
                                                             0, G_MAXULONG, 0,
                                                             G_PARAM_READWRITE));
        g_object_class_install_property (gobject_class,
                                         PROP_DECIBEL,
                                         g_param_spec_double ("decibel",
                                                              "Decibel",
                                                              "The decibel level for this stream",
                                                              -G_MAXDOUBLE, G_MAXDOUBLE, 0,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));

        g_object_class_install_property (gobject_class,
                                         PROP_NAME,
                                         g_param_spec_string ("name",
                                                              "Name",
                                                              "Name to display for this stream",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_DESCRIPTION,
                                         g_param_spec_string ("description",
                                                              "Description",
                                                              "Description to display for this stream",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_APPLICATION_ID,
                                         g_param_spec_string ("application-id",
                                                              "Application identifier",
                                                              "Application identifier for this stream",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_ICON_NAME,
                                         g_param_spec_string ("icon-name",
                                                              "Icon Name",
                                                              "Name of icon to display for this stream",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_IS_MUTED,
                                         g_param_spec_boolean ("is-muted",
                                                               "is muted",
                                                               "Whether stream is muted",
                                                               FALSE,
                                                               G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_CAN_DECIBEL,
                                         g_param_spec_boolean ("can-decibel",
                                                               "can decibel",
                                                               "Whether stream volume can be converted to decibel units",
                                                               FALSE,
                                                               G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_IS_EVENT_STREAM,
                                         g_param_spec_boolean ("is-event-stream",
                                                               "is event stream",
                                                               "Whether stream's role is to play an event",
                                                               FALSE,
                                                               G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_IS_VIRTUAL,
                                         g_param_spec_boolean ("is-virtual",
                                                               "is virtual stream",
                                                               "Whether the stream is virtual",
                                                               FALSE,
                                                               G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_PORT,
                                         g_param_spec_string ("port",
                                                              "Port",
                                                              "The name of the current port for this stream",
                                                              NULL,
                                                              G_PARAM_READWRITE));
        g_object_class_install_property (gobject_class,
                                         PROP_CARD_INDEX,
                                         g_param_spec_long ("card-index",
                                                             "Card index",
                                                             "The index of the card for this stream",
                                                             PA_INVALID_INDEX, G_MAXLONG, PA_INVALID_INDEX,
                                                             G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_type_class_add_private (klass, sizeof (GvcMixerStreamPrivate));
}

static void
gvc_mixer_stream_init (GvcMixerStream *stream)
{
        stream->priv = GVC_MIXER_STREAM_GET_PRIVATE (stream);
}

static void
free_port (GvcMixerStreamPort *p)
{
        g_free (p->port);
        g_free (p->human_port);
        g_free (p);
}

static void
gvc_mixer_stream_finalize (GObject *object)
{
        GvcMixerStream *mixer_stream;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_IS_MIXER_STREAM (object));

        mixer_stream = GVC_MIXER_STREAM (object);

        g_return_if_fail (mixer_stream->priv != NULL);

        g_object_unref (mixer_stream->priv->channel_map);
        mixer_stream->priv->channel_map = NULL;

        g_free (mixer_stream->priv->name);
        mixer_stream->priv->name = NULL;

        g_free (mixer_stream->priv->description);
        mixer_stream->priv->description = NULL;

        g_free (mixer_stream->priv->application_id);
        mixer_stream->priv->application_id = NULL;

        g_free (mixer_stream->priv->icon_name);
        mixer_stream->priv->icon_name = NULL;

        g_free (mixer_stream->priv->port);
        mixer_stream->priv->port = NULL;

        g_free (mixer_stream->priv->human_port);
        mixer_stream->priv->human_port = NULL;

        g_list_foreach (mixer_stream->priv->ports, (GFunc) free_port, NULL);
        g_list_free (mixer_stream->priv->ports);
        mixer_stream->priv->ports = NULL;

       if (mixer_stream->priv->change_volume_op) {
               pa_operation_unref(mixer_stream->priv->change_volume_op);
               mixer_stream->priv->change_volume_op = NULL;
       }

        G_OBJECT_CLASS (gvc_mixer_stream_parent_class)->finalize (object);
}
