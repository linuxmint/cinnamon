/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2006-2008 Lennart Poettering
 * Copyright (C) 2008 Sjoerd Simons <sjoerd@luon.net>
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
#include <pulse/glib-mainloop.h>
#include <pulse/ext-stream-restore.h>

#include "gvc-mixer-control.h"
#include "gvc-mixer-sink.h"
#include "gvc-mixer-source.h"
#include "gvc-mixer-sink-input.h"
#include "gvc-mixer-source-output.h"
#include "gvc-mixer-event-role.h"
#include "gvc-mixer-card.h"
#include "gvc-mixer-card-private.h"
#include "gvc-channel-map-private.h"
#include "gvc-mixer-control-private.h"

#define GVC_MIXER_CONTROL_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), GVC_TYPE_MIXER_CONTROL, GvcMixerControlPrivate))

#define RECONNECT_DELAY 5

enum {
        PROP_0,
        PROP_NAME
};

struct GvcMixerControlPrivate
{
        pa_glib_mainloop *pa_mainloop;
        pa_mainloop_api  *pa_api;
        pa_context       *pa_context;
        int               n_outstanding;
        guint             reconnect_id;
        char             *name;

        gboolean          default_sink_is_set;
        guint             default_sink_id;
        char             *default_sink_name;
        gboolean          default_source_is_set;
        guint             default_source_id;
        char             *default_source_name;

        gboolean          event_sink_input_is_set;
        guint             event_sink_input_id;

        GHashTable       *all_streams;
        GHashTable       *sinks; /* fixed outputs */
        GHashTable       *sources; /* fixed inputs */
        GHashTable       *sink_inputs; /* routable output streams */
        GHashTable       *source_outputs; /* routable input streams */
        GHashTable       *clients;
        GHashTable       *cards;

        GvcMixerStream   *new_default_stream; /* new default stream, used in gvc_mixer_control_set_default_sink () */

        GvcMixerControlState state;
};

enum {
        STATE_CHANGED,
        STREAM_ADDED,
        STREAM_REMOVED,
        CARD_ADDED,
        CARD_REMOVED,
        DEFAULT_SINK_CHANGED,
        DEFAULT_SOURCE_CHANGED,
        LAST_SIGNAL
};

static guint signals [LAST_SIGNAL] = { 0, };

static void     gvc_mixer_control_class_init (GvcMixerControlClass *klass);
static void     gvc_mixer_control_init       (GvcMixerControl      *mixer_control);
static void     gvc_mixer_control_finalize   (GObject              *object);

G_DEFINE_TYPE (GvcMixerControl, gvc_mixer_control, G_TYPE_OBJECT)

pa_context *
gvc_mixer_control_get_pa_context (GvcMixerControl *control)
{
        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);
        return control->priv->pa_context;
}

/**
 * gvc_mixer_control_get_event_sink_input:
 *
 * @control:
 *
 * Returns: (transfer none):
 */
GvcMixerStream *
gvc_mixer_control_get_event_sink_input (GvcMixerControl *control)
{
        GvcMixerStream *stream;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        stream = g_hash_table_lookup (control->priv->all_streams,
                                      GUINT_TO_POINTER (control->priv->event_sink_input_id));

        return stream;
}

static void
gvc_mixer_control_stream_restore_cb (pa_context *c,
                                     const pa_ext_stream_restore_info *info,
                                     int eol,
                                     void *userdata)
{
        pa_operation *o;
        GvcMixerControl *control = (GvcMixerControl *) userdata;
        pa_ext_stream_restore_info new_info;

        if (eol || control->priv->new_default_stream == NULL)
                return;

        new_info.name = info->name;
        new_info.channel_map = info->channel_map;
        new_info.volume = info->volume;
        new_info.mute = info->mute;

        new_info.device = gvc_mixer_stream_get_name (control->priv->new_default_stream);

        o = pa_ext_stream_restore_write (control->priv->pa_context,
                                         PA_UPDATE_REPLACE,
                                         &new_info, 1,
                                         TRUE, NULL, NULL);

        if (o == NULL) {
                g_warning ("pa_ext_stream_restore_write() failed: %s",
                           pa_strerror (pa_context_errno (control->priv->pa_context)));
                return;
        }

        g_debug ("Changed default device for %s to %s", info->name, info->device);

        pa_operation_unref (o);
}

gboolean
gvc_mixer_control_set_default_sink (GvcMixerControl *control,
                                    GvcMixerStream  *stream)
{
        pa_operation *o;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), FALSE);
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        o = pa_context_set_default_sink (control->priv->pa_context,
                                         gvc_mixer_stream_get_name (stream),
                                         NULL,
                                         NULL);
        if (o == NULL) {
                g_warning ("pa_context_set_default_sink() failed: %s",
                           pa_strerror (pa_context_errno (control->priv->pa_context)));
                return FALSE;
        }

        pa_operation_unref (o);

        control->priv->new_default_stream = stream;
        g_object_add_weak_pointer (G_OBJECT (stream), (gpointer *) &control->priv->new_default_stream);

        o = pa_ext_stream_restore_read (control->priv->pa_context,
                                        gvc_mixer_control_stream_restore_cb,
                                        control);

        if (o == NULL) {
                g_warning ("pa_ext_stream_restore_read() failed: %s",
                           pa_strerror (pa_context_errno (control->priv->pa_context)));
                return FALSE;
        }

        pa_operation_unref (o);

        return TRUE;
}

gboolean
gvc_mixer_control_set_default_source (GvcMixerControl *control,
                                      GvcMixerStream  *stream)
{
        pa_operation *o;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), FALSE);
        g_return_val_if_fail (GVC_IS_MIXER_STREAM (stream), FALSE);

        o = pa_context_set_default_source (control->priv->pa_context,
                                           gvc_mixer_stream_get_name (stream),
                                           NULL,
                                           NULL);
        if (o == NULL) {
                g_warning ("pa_context_set_default_source() failed");
                return FALSE;
        }

        pa_operation_unref (o);

        return TRUE;
}

/**
 * gvc_mixer_control_get_default_sink:
 *
 * @control:
 *
 * Returns: (transfer none):
 */
GvcMixerStream *
gvc_mixer_control_get_default_sink (GvcMixerControl *control)
{
        GvcMixerStream *stream;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        if (control->priv->default_sink_is_set) {
                stream = g_hash_table_lookup (control->priv->all_streams,
                                              GUINT_TO_POINTER (control->priv->default_sink_id));
        } else {
                stream = NULL;
        }

        return stream;
}

/**
 * gvc_mixer_control_get_default_source:
 *
 * @control:
 *
 * Returns: (transfer none):
 */
GvcMixerStream *
gvc_mixer_control_get_default_source (GvcMixerControl *control)
{
        GvcMixerStream *stream;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        if (control->priv->default_source_is_set) {
                stream = g_hash_table_lookup (control->priv->all_streams,
                                              GUINT_TO_POINTER (control->priv->default_source_id));
        } else {
                stream = NULL;
        }

        return stream;
}

static gpointer
gvc_mixer_control_lookup_id (GHashTable *hash_table,
                             guint       id)
{
        return g_hash_table_lookup (hash_table,
                                    GUINT_TO_POINTER (id));
}

/**
 * gvc_mixer_control_lookup_stream_id:
 *
 * @control:
 * @id:
 *
 * Returns: (transfer none):
 */
GvcMixerStream *
gvc_mixer_control_lookup_stream_id (GvcMixerControl *control,
                                    guint            id)
{
        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        return gvc_mixer_control_lookup_id (control->priv->all_streams, id);
}

/**
 * gvc_mixer_control_lookup_card_id:
 *
 * @control:
 * @id:
 *
 * Returns: (transfer none):
 */
GvcMixerCard *
gvc_mixer_control_lookup_card_id (GvcMixerControl *control,
                                  guint            id)
{
        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        return gvc_mixer_control_lookup_id (control->priv->cards, id);
}

static void
listify_hash_values_hfunc (gpointer key,
                           gpointer value,
                           gpointer user_data)
{
        GSList **list = user_data;

        *list = g_slist_prepend (*list, value);
}

static int
gvc_name_collate (const char *namea,
                  const char *nameb)
{
        if (nameb == NULL && namea == NULL)
                return 0;
        if (nameb == NULL)
                return 1;
        if (namea == NULL)
                return -1;

        return g_utf8_collate (namea, nameb);
}

static int
gvc_card_collate (GvcMixerCard *a,
                  GvcMixerCard *b)
{
        const char *namea;
        const char *nameb;

        g_return_val_if_fail (a == NULL || GVC_IS_MIXER_CARD (a), 0);
        g_return_val_if_fail (b == NULL || GVC_IS_MIXER_CARD (b), 0);

        namea = gvc_mixer_card_get_name (a);
        nameb = gvc_mixer_card_get_name (b);

        return gvc_name_collate (namea, nameb);
}

/**
 * gvc_mixer_control_get_cards:
 *
 * @control:
 *
 * Returns: (transfer container) (element-type Gvc.MixerCard):
 */
GSList *
gvc_mixer_control_get_cards (GvcMixerControl *control)
{
        GSList *retval;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        retval = NULL;
        g_hash_table_foreach (control->priv->cards,
                              listify_hash_values_hfunc,
                              &retval);
        return g_slist_sort (retval, (GCompareFunc) gvc_card_collate);
}

static int
gvc_stream_collate (GvcMixerStream *a,
                    GvcMixerStream *b)
{
        const char *namea;
        const char *nameb;

        g_return_val_if_fail (a == NULL || GVC_IS_MIXER_STREAM (a), 0);
        g_return_val_if_fail (b == NULL || GVC_IS_MIXER_STREAM (b), 0);

        namea = gvc_mixer_stream_get_name (a);
        nameb = gvc_mixer_stream_get_name (b);

        return gvc_name_collate (namea, nameb);
}

/**
 * gvc_mixer_control_get_streams:
 *
 * @control:
 *
 * Returns: (transfer container) (element-type Gvc.MixerStream):
 */
GSList *
gvc_mixer_control_get_streams (GvcMixerControl *control)
{
        GSList *retval;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        retval = NULL;
        g_hash_table_foreach (control->priv->all_streams,
                              listify_hash_values_hfunc,
                              &retval);
        return g_slist_sort (retval, (GCompareFunc) gvc_stream_collate);
}

/**
 * gvc_mixer_control_get_sinks:
 *
 * @control:
 *
 * Returns: (transfer container) (element-type Gvc.MixerSink):
 */
GSList *
gvc_mixer_control_get_sinks (GvcMixerControl *control)
{
        GSList *retval;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        retval = NULL;
        g_hash_table_foreach (control->priv->sinks,
                              listify_hash_values_hfunc,
                              &retval);
        return g_slist_sort (retval, (GCompareFunc) gvc_stream_collate);
}

/**
 * gvc_mixer_control_get_sources:
 *
 * @control:
 *
 * Returns: (transfer container) (element-type Gvc.MixerSource):
 */
GSList *
gvc_mixer_control_get_sources (GvcMixerControl *control)
{
        GSList *retval;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        retval = NULL;
        g_hash_table_foreach (control->priv->sources,
                              listify_hash_values_hfunc,
                              &retval);
        return g_slist_sort (retval, (GCompareFunc) gvc_stream_collate);
}

/**
 * gvc_mixer_control_get_sink_inputs:
 *
 * @control:
 *
 * Returns: (transfer container) (element-type Gvc.MixerSinkInput):
 */
GSList *
gvc_mixer_control_get_sink_inputs (GvcMixerControl *control)
{
        GSList *retval;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        retval = NULL;
        g_hash_table_foreach (control->priv->sink_inputs,
                              listify_hash_values_hfunc,
                              &retval);
        return g_slist_sort (retval, (GCompareFunc) gvc_stream_collate);
}

/**
 * gvc_mixer_control_get_source_outputs:
 *
 * @control:
 *
 * Returns: (transfer container) (element-type Gvc.MixerSourceOutput):
 */
GSList *
gvc_mixer_control_get_source_outputs (GvcMixerControl *control)
{
        GSList *retval;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), NULL);

        retval = NULL;
        g_hash_table_foreach (control->priv->source_outputs,
                              listify_hash_values_hfunc,
                              &retval);
        return g_slist_sort (retval, (GCompareFunc) gvc_stream_collate);
}

static void
dec_outstanding (GvcMixerControl *control)
{
        if (control->priv->n_outstanding <= 0) {
                return;
        }

        if (--control->priv->n_outstanding <= 0) {
                control->priv->state = GVC_STATE_READY;
                g_signal_emit (G_OBJECT (control), signals[STATE_CHANGED], 0, GVC_STATE_READY);
        }
}

GvcMixerControlState
gvc_mixer_control_get_state (GvcMixerControl *control)
{
        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), FALSE);

        return control->priv->state;
}


static void
_set_default_source (GvcMixerControl *control,
                     GvcMixerStream  *stream)
{
        guint new_id;

        if (stream == NULL) {
                control->priv->default_source_id = 0;
                control->priv->default_source_is_set = FALSE;
                g_signal_emit (control,
                               signals[DEFAULT_SOURCE_CHANGED],
                               0,
                               PA_INVALID_INDEX);
                return;
        }

        new_id = gvc_mixer_stream_get_id (stream);

        if (control->priv->default_source_id != new_id) {
                control->priv->default_source_id = new_id;
                control->priv->default_source_is_set = TRUE;
                g_signal_emit (control,
                               signals[DEFAULT_SOURCE_CHANGED],
                               0,
                               new_id);
        }
}

static void
_set_default_sink (GvcMixerControl *control,
                   GvcMixerStream  *stream)
{
        guint new_id;

        if (stream == NULL) {
                /* Don't tell front-ends about an unset default
                 * sink if it's already unset */
                if (control->priv->default_sink_is_set == FALSE)
                        return;
                control->priv->default_sink_id = 0;
                control->priv->default_sink_is_set = FALSE;
                g_signal_emit (control,
                               signals[DEFAULT_SINK_CHANGED],
                               0,
                               PA_INVALID_INDEX);
                return;
        }

        new_id = gvc_mixer_stream_get_id (stream);

        if (control->priv->default_sink_id != new_id) {
                control->priv->default_sink_id = new_id;
                control->priv->default_sink_is_set = TRUE;
                g_signal_emit (control,
                               signals[DEFAULT_SINK_CHANGED],
                               0,
                               new_id);
        }
}

static gboolean
_stream_has_name (gpointer        key,
                  GvcMixerStream *stream,
                  const char     *name)
{
        const char *t_name;

        t_name = gvc_mixer_stream_get_name (stream);

        if (t_name != NULL
            && name != NULL
            && strcmp (t_name, name) == 0) {
                return TRUE;
        }

        return FALSE;
}

static GvcMixerStream  *
find_stream_for_name (GvcMixerControl *control,
                      const char      *name)
{
        GvcMixerStream *stream;

        stream = g_hash_table_find (control->priv->all_streams,
                                    (GHRFunc)_stream_has_name,
                                    (char *)name);
        return stream;
}

static void
update_default_source_from_name (GvcMixerControl *control,
                                 const char      *name)
{
        gboolean changed = FALSE;

        if ((control->priv->default_source_name == NULL
             && name != NULL)
            || (control->priv->default_source_name != NULL
                && name == NULL)
            || (name != NULL && strcmp (control->priv->default_source_name, name) != 0)) {
                changed = TRUE;
        }

        if (changed) {
                GvcMixerStream *stream;

                g_free (control->priv->default_source_name);
                control->priv->default_source_name = g_strdup (name);

                stream = find_stream_for_name (control, name);
                _set_default_source (control, stream);
        }
}

static void
update_default_sink_from_name (GvcMixerControl *control,
                               const char      *name)
{
        gboolean changed = FALSE;

        if ((control->priv->default_sink_name == NULL
             && name != NULL)
            || (control->priv->default_sink_name != NULL
                && name == NULL)
            || (name != NULL && strcmp (control->priv->default_sink_name, name) != 0)) {
                changed = TRUE;
        }

        if (changed) {
                GvcMixerStream *stream;
                g_free (control->priv->default_sink_name);
                control->priv->default_sink_name = g_strdup (name);

                stream = find_stream_for_name (control, name);
                _set_default_sink (control, stream);
        }
}

static void
update_server (GvcMixerControl      *control,
               const pa_server_info *info)
{
        if (info->default_source_name != NULL) {
                update_default_source_from_name (control, info->default_source_name);
        }
        if (info->default_sink_name != NULL) {
                update_default_sink_from_name (control, info->default_sink_name);
        }
}

static void
remove_stream (GvcMixerControl *control,
               GvcMixerStream  *stream)
{
        guint id;

        g_object_ref (stream);

        id = gvc_mixer_stream_get_id (stream);

        if (id == control->priv->default_sink_id) {
                _set_default_sink (control, NULL);
        } else if (id == control->priv->default_source_id) {
                _set_default_source (control, NULL);
        }

        g_hash_table_remove (control->priv->all_streams,
                             GUINT_TO_POINTER (id));
        g_signal_emit (G_OBJECT (control),
                       signals[STREAM_REMOVED],
                       0,
                       gvc_mixer_stream_get_id (stream));
        g_object_unref (stream);
}

static void
add_stream (GvcMixerControl *control,
            GvcMixerStream  *stream)
{
        g_hash_table_insert (control->priv->all_streams,
                             GUINT_TO_POINTER (gvc_mixer_stream_get_id (stream)),
                             stream);
        g_signal_emit (G_OBJECT (control),
                       signals[STREAM_ADDED],
                       0,
                       gvc_mixer_stream_get_id (stream));
}

static void
set_icon_name_from_proplist (GvcMixerStream *stream,
                             pa_proplist    *l,
                             const char     *default_icon_name)
{
        const char *t;

        if ((t = pa_proplist_gets (l, PA_PROP_DEVICE_ICON_NAME))) {
                goto finish;
        }

        if ((t = pa_proplist_gets (l, PA_PROP_MEDIA_ICON_NAME))) {
                goto finish;
        }

        if ((t = pa_proplist_gets (l, PA_PROP_WINDOW_ICON_NAME))) {
                goto finish;
        }

        if ((t = pa_proplist_gets (l, PA_PROP_APPLICATION_ICON_NAME))) {
                goto finish;
        }

        if ((t = pa_proplist_gets (l, PA_PROP_MEDIA_ROLE))) {

                if (strcmp (t, "video") == 0 ||
                    strcmp (t, "phone") == 0) {
                        goto finish;
                }

                if (strcmp (t, "music") == 0) {
                        t = "audio";
                        goto finish;
                }

                if (strcmp (t, "game") == 0) {
                        t = "applications-games";
                        goto finish;
                }

                if (strcmp (t, "event") == 0) {
                        t = "dialog-information";
                        goto finish;
                }
        }

        t = default_icon_name;

 finish:
        gvc_mixer_stream_set_icon_name (stream, t);
}

static void
update_sink (GvcMixerControl    *control,
             const pa_sink_info *info)
{
        GvcMixerStream *stream;
        gboolean        is_new;
        pa_volume_t     max_volume;
        GvcChannelMap  *map;
        char            map_buff[PA_CHANNEL_MAP_SNPRINT_MAX];

        pa_channel_map_snprint (map_buff, PA_CHANNEL_MAP_SNPRINT_MAX, &info->channel_map);
#if 1
        g_debug ("Updating sink: index=%u name='%s' description='%s' map='%s'",
                 info->index,
                 info->name,
                 info->description,
                 map_buff);
#endif

        map = NULL;
        is_new = FALSE;
        stream = g_hash_table_lookup (control->priv->sinks,
                                      GUINT_TO_POINTER (info->index));
        if (stream == NULL) {
#if PA_MICRO > 15
                GList *list = NULL;
                guint i;
#endif /* PA_MICRO > 15 */

                map = gvc_channel_map_new_from_pa_channel_map (&info->channel_map);
                stream = gvc_mixer_sink_new (control->priv->pa_context,
                                             info->index,
                                             map);
#if PA_MICRO > 15
                for (i = 0; i < info->n_ports; i++) {
                        GvcMixerStreamPort *port;

                        port = g_new0 (GvcMixerStreamPort, 1);
                        port->port = g_strdup (info->ports[i]->name);
                        port->human_port = g_strdup (info->ports[i]->description);
                        port->priority = info->ports[i]->priority;
                        list = g_list_prepend (list, port);
                }
                gvc_mixer_stream_set_ports (stream, list);
#endif /* PA_MICRO > 15 */
                g_object_unref (map);
                is_new = TRUE;
        } else if (gvc_mixer_stream_is_running (stream)) {
                /* Ignore events if volume changes are outstanding */
                g_debug ("Ignoring event, volume changes are outstanding");
                return;
        }

        max_volume = pa_cvolume_max (&info->volume);
        gvc_mixer_stream_set_name (stream, info->name);
        gvc_mixer_stream_set_card_index (stream, info->card);
        gvc_mixer_stream_set_description (stream, info->description);
        set_icon_name_from_proplist (stream, info->proplist, "audio-card");
        gvc_mixer_stream_set_volume (stream, (guint)max_volume);
        gvc_mixer_stream_set_is_muted (stream, info->mute);
        gvc_mixer_stream_set_can_decibel (stream, !!(info->flags & PA_SINK_DECIBEL_VOLUME));
        gvc_mixer_stream_set_base_volume (stream, (guint32) info->base_volume);
#if PA_MICRO > 15
        if (info->active_port != NULL)
                gvc_mixer_stream_set_port (stream, info->active_port->name);
#endif /* PA_MICRO > 15 */

        if (is_new) {
                g_hash_table_insert (control->priv->sinks,
                                     GUINT_TO_POINTER (info->index),
                                     g_object_ref (stream));
                add_stream (control, stream);
        }

        if (control->priv->default_sink_name != NULL
            && info->name != NULL
            && strcmp (control->priv->default_sink_name, info->name) == 0) {
                _set_default_sink (control, stream);
        }

        if (map == NULL)
                map = (GvcChannelMap *) gvc_mixer_stream_get_channel_map (stream);
        gvc_channel_map_volume_changed (map, &info->volume, FALSE);
}

static void
update_source (GvcMixerControl      *control,
               const pa_source_info *info)
{
        GvcMixerStream *stream;
        gboolean        is_new;
        pa_volume_t     max_volume;

#if 1
        g_debug ("Updating source: index=%u name='%s' description='%s'",
                 info->index,
                 info->name,
                 info->description);
#endif

        /* completely ignore monitors, they're not real sources */
        if (info->monitor_of_sink != PA_INVALID_INDEX) {
                return;
        }

        is_new = FALSE;

        stream = g_hash_table_lookup (control->priv->sources,
                                      GUINT_TO_POINTER (info->index));
        if (stream == NULL) {
#if PA_MICRO > 15
                GList *list = NULL;
                guint i;
#endif /* PA_MICRO > 15 */
                GvcChannelMap *map;

                map = gvc_channel_map_new_from_pa_channel_map (&info->channel_map);
                stream = gvc_mixer_source_new (control->priv->pa_context,
                                               info->index,
                                               map);
#if PA_MICRO > 15
                for (i = 0; i < info->n_ports; i++) {
                        GvcMixerStreamPort *port;

                        port = g_new0 (GvcMixerStreamPort, 1);
                        port->port = g_strdup (info->ports[i]->name);
                        port->human_port = g_strdup (info->ports[i]->description);
                        port->priority = info->ports[i]->priority;
                        list = g_list_prepend (list, port);
                }
                gvc_mixer_stream_set_ports (stream, list);
#endif /* PA_MICRO > 15 */

                g_object_unref (map);
                is_new = TRUE;
        } else if (gvc_mixer_stream_is_running (stream)) {
                /* Ignore events if volume changes are outstanding */
                g_debug ("Ignoring event, volume changes are outstanding");
                return;
        }

        max_volume = pa_cvolume_max (&info->volume);

        gvc_mixer_stream_set_name (stream, info->name);
        gvc_mixer_stream_set_card_index (stream, info->card);
        gvc_mixer_stream_set_description (stream, info->description);
        set_icon_name_from_proplist (stream, info->proplist, "audio-input-microphone");
        gvc_mixer_stream_set_volume (stream, (guint)max_volume);
        gvc_mixer_stream_set_is_muted (stream, info->mute);
        gvc_mixer_stream_set_can_decibel (stream, !!(info->flags & PA_SOURCE_DECIBEL_VOLUME));
        gvc_mixer_stream_set_base_volume (stream, (guint32) info->base_volume);
#if PA_MICRO > 15
        if (info->active_port != NULL)
                gvc_mixer_stream_set_port (stream, info->active_port->name);
#endif /* PA_MICRO > 15 */

        if (is_new) {
                g_hash_table_insert (control->priv->sources,
                                     GUINT_TO_POINTER (info->index),
                                     g_object_ref (stream));
                add_stream (control, stream);
        }

        if (control->priv->default_source_name != NULL
            && info->name != NULL
            && strcmp (control->priv->default_source_name, info->name) == 0) {
                _set_default_source (control, stream);
        }
}

static void
set_is_event_stream_from_proplist (GvcMixerStream *stream,
                                   pa_proplist    *l)
{
        const char *t;
        gboolean is_event_stream;

        is_event_stream = FALSE;

        if ((t = pa_proplist_gets (l, PA_PROP_MEDIA_ROLE))) {
                if (g_str_equal (t, "event"))
                        is_event_stream = TRUE;
        }

        gvc_mixer_stream_set_is_event_stream (stream, is_event_stream);
}

static void
set_application_id_from_proplist (GvcMixerStream *stream,
                                  pa_proplist    *l)
{
        const char *t;

        if ((t = pa_proplist_gets (l, PA_PROP_APPLICATION_ID))) {
                gvc_mixer_stream_set_application_id (stream, t);
        }
}

static void
update_sink_input (GvcMixerControl          *control,
                   const pa_sink_input_info *info)
{
        GvcMixerStream *stream;
        gboolean        is_new;
        pa_volume_t     max_volume;
        const char     *name;

#if 0
        g_debug ("Updating sink input: index=%u name='%s' client=%u sink=%u",
                 info->index,
                 info->name,
                 info->client,
                 info->sink);
#endif

        is_new = FALSE;

        stream = g_hash_table_lookup (control->priv->sink_inputs,
                                      GUINT_TO_POINTER (info->index));
        if (stream == NULL) {
                GvcChannelMap *map;
                map = gvc_channel_map_new_from_pa_channel_map (&info->channel_map);
                stream = gvc_mixer_sink_input_new (control->priv->pa_context,
                                                   info->index,
                                                   map);
                g_object_unref (map);
                is_new = TRUE;
        } else if (gvc_mixer_stream_is_running (stream)) {
                /* Ignore events if volume changes are outstanding */
                g_debug ("Ignoring event, volume changes are outstanding");
                return;
        }

        max_volume = pa_cvolume_max (&info->volume);

        name = (const char *)g_hash_table_lookup (control->priv->clients,
                                                  GUINT_TO_POINTER (info->client));
        gvc_mixer_stream_set_name (stream, name);
        gvc_mixer_stream_set_description (stream, info->name);

        set_application_id_from_proplist (stream, info->proplist);
        set_is_event_stream_from_proplist (stream, info->proplist);
        set_icon_name_from_proplist (stream, info->proplist, "applications-multimedia");
        gvc_mixer_stream_set_volume (stream, (guint)max_volume);
        gvc_mixer_stream_set_is_muted (stream, info->mute);
        gvc_mixer_stream_set_is_virtual (stream, info->client == PA_INVALID_INDEX);

        if (is_new) {
                g_hash_table_insert (control->priv->sink_inputs,
                                     GUINT_TO_POINTER (info->index),
                                     g_object_ref (stream));
                add_stream (control, stream);
        }
}

static void
update_source_output (GvcMixerControl             *control,
                      const pa_source_output_info *info)
{
        GvcMixerStream *stream;
        gboolean        is_new;
        const char     *name;

#if 1
        g_debug ("Updating source output: index=%u name='%s' client=%u source=%u",
                 info->index,
                 info->name,
                 info->client,
                 info->source);
#endif

        is_new = FALSE;
        stream = g_hash_table_lookup (control->priv->source_outputs,
                                      GUINT_TO_POINTER (info->index));
        if (stream == NULL) {
                GvcChannelMap *map;
                map = gvc_channel_map_new_from_pa_channel_map (&info->channel_map);
                stream = gvc_mixer_source_output_new (control->priv->pa_context,
                                                      info->index,
                                                      map);
                g_object_unref (map);
                is_new = TRUE;
        }

        name = (const char *)g_hash_table_lookup (control->priv->clients,
                                                  GUINT_TO_POINTER (info->client));

        gvc_mixer_stream_set_name (stream, name);
        gvc_mixer_stream_set_description (stream, info->name);
        set_application_id_from_proplist (stream, info->proplist);
        set_is_event_stream_from_proplist (stream, info->proplist);
        set_icon_name_from_proplist (stream, info->proplist, "audio-input-microphone");

        if (is_new) {
                g_hash_table_insert (control->priv->source_outputs,
                                     GUINT_TO_POINTER (info->index),
                                     g_object_ref (stream));
                add_stream (control, stream);
        }
}

static void
update_client (GvcMixerControl      *control,
               const pa_client_info *info)
{
#if 1
        g_debug ("Updating client: index=%u name='%s'",
                 info->index,
                 info->name);
#endif
        g_hash_table_insert (control->priv->clients,
                             GUINT_TO_POINTER (info->index),
                             g_strdup (info->name));
}

static char *
card_num_streams_to_status (guint sinks,
                            guint sources)
{
        char *sinks_str;
        char *sources_str;
        char *ret;

        if (sinks == 0 && sources == 0) {
                /* translators:
                 * The device has been disabled */
                return g_strdup (_("Disabled"));
        }
        if (sinks == 0) {
                sinks_str = NULL;
        } else {
                /* translators:
                 * The number of sound outputs on a particular device */
                sinks_str = g_strdup_printf (ngettext ("%u Output",
                                                       "%u Outputs",
                                                       sinks),
                                             sinks);
        }
        if (sources == 0) {
                sources_str = NULL;
        } else {
                /* translators:
                 * The number of sound inputs on a particular device */
                sources_str = g_strdup_printf (ngettext ("%u Input",
                                                         "%u Inputs",
                                                         sources),
                                               sources);
        }
        if (sources_str == NULL)
                return sinks_str;
        if (sinks_str == NULL)
                return sources_str;
        ret = g_strdup_printf ("%s / %s", sinks_str, sources_str);
        g_free (sinks_str);
        g_free (sources_str);
        return ret;
}

static void
update_card (GvcMixerControl      *control,
             const pa_card_info   *info)
{
        GvcMixerCard *card;
        gboolean      is_new = FALSE;
#if 1
        guint i;
        const char *key;
        void *state;

        g_debug ("Udpating card %s (index: %u driver: %s):",
                 info->name, info->index, info->driver);

        for (i = 0; i < info->n_profiles; i++) {
                struct pa_card_profile_info pi = info->profiles[i];
                gboolean is_default;

                is_default = (g_strcmp0 (pi.name, info->active_profile->name) == 0);
                g_debug ("\tProfile '%s': %d sources %d sinks%s",
                         pi.name, pi.n_sources, pi.n_sinks,
                         is_default ? " (Current)" : "");
        }
        state = NULL;
        key = pa_proplist_iterate (info->proplist, &state);
        while (key != NULL) {
                g_debug ("\tProperty: '%s' = '%s'",
                        key, pa_proplist_gets (info->proplist, key));
                key = pa_proplist_iterate (info->proplist, &state);
        }
#endif
        card = g_hash_table_lookup (control->priv->cards,
                                    GUINT_TO_POINTER (info->index));
        if (card == NULL) {
                GList *list = NULL;

                for (i = 0; i < info->n_profiles; i++) {
                        struct pa_card_profile_info pi = info->profiles[i];
                        GvcMixerCardProfile *profile;

                        profile = g_new0 (GvcMixerCardProfile, 1);
                        profile->profile = g_strdup (pi.name);
                        profile->human_profile = g_strdup (pi.description);
                        profile->status = card_num_streams_to_status (pi.n_sinks, pi.n_sources);
                        profile->n_sinks = pi.n_sinks;
                        profile->n_sources = pi.n_sources;
                        profile->priority = pi.priority;
                        list = g_list_prepend (list, profile);
                }
                card = gvc_mixer_card_new (control->priv->pa_context,
                                           info->index);
                gvc_mixer_card_set_profiles (card, list);
                is_new = TRUE;
        }

        gvc_mixer_card_set_name (card, pa_proplist_gets (info->proplist, "device.description"));
        gvc_mixer_card_set_icon_name (card, pa_proplist_gets (info->proplist, "device.icon_name"));
        gvc_mixer_card_set_profile (card, info->active_profile->name);

        if (is_new) {
                g_hash_table_insert (control->priv->cards,
                                     GUINT_TO_POINTER (info->index),
                                     g_object_ref (card));
        }
        g_signal_emit (G_OBJECT (control),
                       signals[CARD_ADDED],
                       0,
                       info->index);
}

static void
_pa_context_get_sink_info_cb (pa_context         *context,
                              const pa_sink_info *i,
                              int                 eol,
                              void               *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (eol < 0) {
                if (pa_context_errno (context) == PA_ERR_NOENTITY) {
                        return;
                }

                g_warning ("Sink callback failure");
                return;
        }

        if (eol > 0) {
                dec_outstanding (control);
                return;
        }

        update_sink (control, i);
}

static void
_pa_context_get_source_info_cb (pa_context           *context,
                                const pa_source_info *i,
                                int                   eol,
                                void                 *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (eol < 0) {
                if (pa_context_errno (context) == PA_ERR_NOENTITY) {
                        return;
                }

                g_warning ("Source callback failure");
                return;
        }

        if (eol > 0) {
                dec_outstanding (control);
                return;
        }

        update_source (control, i);
}

static void
_pa_context_get_sink_input_info_cb (pa_context               *context,
                                    const pa_sink_input_info *i,
                                    int                       eol,
                                    void                     *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (eol < 0) {
                if (pa_context_errno (context) == PA_ERR_NOENTITY) {
                        return;
                }

                g_warning ("Sink input callback failure");
                return;
        }

        if (eol > 0) {
                dec_outstanding (control);
                return;
        }

        update_sink_input (control, i);
}

static void
_pa_context_get_source_output_info_cb (pa_context                  *context,
                                       const pa_source_output_info *i,
                                       int                          eol,
                                       void                        *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (eol < 0) {
                if (pa_context_errno (context) == PA_ERR_NOENTITY) {
                        return;
                }

                g_warning ("Source output callback failure");
                return;
        }

        if (eol > 0)  {
                dec_outstanding (control);
                return;
        }

        update_source_output (control, i);
}

static void
_pa_context_get_client_info_cb (pa_context           *context,
                                const pa_client_info *i,
                                int                   eol,
                                void                 *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (eol < 0) {
                if (pa_context_errno (context) == PA_ERR_NOENTITY) {
                        return;
                }

                g_warning ("Client callback failure");
                return;
        }

        if (eol > 0) {
                dec_outstanding (control);
                return;
        }

        update_client (control, i);
}

static void
_pa_context_get_card_info_by_index_cb (pa_context *context,
                                       const pa_card_info *i,
                                       int eol,
                                       void *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (eol < 0) {
                if (pa_context_errno (context) == PA_ERR_NOENTITY)
                        return;

                g_warning ("Card callback failure");
                return;
        }

        if (eol > 0) {
                dec_outstanding (control);
                return;
        }

        update_card (control, i);
}

static void
_pa_context_get_server_info_cb (pa_context           *context,
                                const pa_server_info *i,
                                void                 *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (i == NULL) {
                g_warning ("Server info callback failure");
                return;
        }

        update_server (control, i);
        dec_outstanding (control);
}

static void
remove_event_role_stream (GvcMixerControl *control)
{
        g_debug ("Removing event role");
}

static void
update_event_role_stream (GvcMixerControl                  *control,
                          const pa_ext_stream_restore_info *info)
{
        GvcMixerStream *stream;
        gboolean        is_new;
        pa_volume_t     max_volume;

        if (strcmp (info->name, "sink-input-by-media-role:event") != 0) {
                return;
        }

#if 0
        g_debug ("Updating event role: name='%s' device='%s'",
                 info->name,
                 info->device);
#endif

        is_new = FALSE;

        if (!control->priv->event_sink_input_is_set) {
                pa_channel_map pa_map;
                GvcChannelMap *map;

                pa_map.channels = 1;
                pa_map.map[0] = PA_CHANNEL_POSITION_MONO;
                map = gvc_channel_map_new_from_pa_channel_map (&pa_map);

                stream = gvc_mixer_event_role_new (control->priv->pa_context,
                                                   info->device,
                                                   map);
                control->priv->event_sink_input_id = gvc_mixer_stream_get_id (stream);
                control->priv->event_sink_input_is_set = TRUE;

                is_new = TRUE;
        } else {
                stream = g_hash_table_lookup (control->priv->all_streams,
                                              GUINT_TO_POINTER (control->priv->event_sink_input_id));
        }

        max_volume = pa_cvolume_max (&info->volume);

        gvc_mixer_stream_set_name (stream, _("System Sounds"));
        gvc_mixer_stream_set_icon_name (stream, "multimedia-volume-control");
        gvc_mixer_stream_set_volume (stream, (guint)max_volume);
        gvc_mixer_stream_set_is_muted (stream, info->mute);

        if (is_new) {
                add_stream (control, stream);
        }
}

static void
_pa_ext_stream_restore_read_cb (pa_context                       *context,
                                const pa_ext_stream_restore_info *i,
                                int                               eol,
                                void                             *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        if (eol < 0) {
                g_debug ("Failed to initialized stream_restore extension: %s",
                         pa_strerror (pa_context_errno (context)));
                remove_event_role_stream (control);
                return;
        }

        if (eol > 0) {
                dec_outstanding (control);
                /* If we don't have an event stream to restore, then
                 * set one up with a default 100% volume */
                if (!control->priv->event_sink_input_is_set) {
                        pa_ext_stream_restore_info info;

                        memset (&info, 0, sizeof(info));
                        info.name = "sink-input-by-media-role:event";
                        info.volume.channels = 1;
                        info.volume.values[0] = PA_VOLUME_NORM;
                        update_event_role_stream (control, &info);
                }
                return;
        }

        update_event_role_stream (control, i);
}

static void
_pa_ext_stream_restore_subscribe_cb (pa_context *context,
                                     void       *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);
        pa_operation    *o;

        o = pa_ext_stream_restore_read (context,
                                        _pa_ext_stream_restore_read_cb,
                                        control);
        if (o == NULL) {
                g_warning ("pa_ext_stream_restore_read() failed");
                return;
        }

        pa_operation_unref (o);
}

static void
req_update_server_info (GvcMixerControl *control,
                        int              index)
{
        pa_operation *o;

        o = pa_context_get_server_info (control->priv->pa_context,
                                        _pa_context_get_server_info_cb,
                                        control);
        if (o == NULL) {
                g_warning ("pa_context_get_server_info() failed");
                return;
        }
        pa_operation_unref (o);
}

static void
req_update_client_info (GvcMixerControl *control,
                        int              index)
{
        pa_operation *o;

        if (index < 0) {
                o = pa_context_get_client_info_list (control->priv->pa_context,
                                                     _pa_context_get_client_info_cb,
                                                     control);
        } else {
                o = pa_context_get_client_info (control->priv->pa_context,
                                                index,
                                                _pa_context_get_client_info_cb,
                                                control);
        }

        if (o == NULL) {
                g_warning ("pa_context_client_info_list() failed");
                return;
        }
        pa_operation_unref (o);
}

static void
req_update_card (GvcMixerControl *control,
                 int              index)
{
        pa_operation *o;

        if (index < 0) {
                o = pa_context_get_card_info_list (control->priv->pa_context,
                                                   _pa_context_get_card_info_by_index_cb,
                                                   control);
        } else {
                o = pa_context_get_card_info_by_index (control->priv->pa_context,
                                                       index,
                                                       _pa_context_get_card_info_by_index_cb,
                                                       control);
        }

        if (o == NULL) {
                g_warning ("pa_context_get_card_info_by_index() failed");
                return;
        }
        pa_operation_unref (o);
}

static void
req_update_sink_info (GvcMixerControl *control,
                      int              index)
{
        pa_operation *o;

        if (index < 0) {
                o = pa_context_get_sink_info_list (control->priv->pa_context,
                                                   _pa_context_get_sink_info_cb,
                                                   control);
        } else {
                o = pa_context_get_sink_info_by_index (control->priv->pa_context,
                                                       index,
                                                       _pa_context_get_sink_info_cb,
                                                       control);
        }

        if (o == NULL) {
                g_warning ("pa_context_get_sink_info_list() failed");
                return;
        }
        pa_operation_unref (o);
}

static void
req_update_source_info (GvcMixerControl *control,
                        int              index)
{
        pa_operation *o;

        if (index < 0) {
                o = pa_context_get_source_info_list (control->priv->pa_context,
                                                     _pa_context_get_source_info_cb,
                                                     control);
        } else {
                o = pa_context_get_source_info_by_index(control->priv->pa_context,
                                                        index,
                                                        _pa_context_get_source_info_cb,
                                                        control);
        }

        if (o == NULL) {
                g_warning ("pa_context_get_source_info_list() failed");
                return;
        }
        pa_operation_unref (o);
}

static void
req_update_sink_input_info (GvcMixerControl *control,
                            int              index)
{
        pa_operation *o;

        if (index < 0) {
                o = pa_context_get_sink_input_info_list (control->priv->pa_context,
                                                         _pa_context_get_sink_input_info_cb,
                                                         control);
        } else {
                o = pa_context_get_sink_input_info (control->priv->pa_context,
                                                    index,
                                                    _pa_context_get_sink_input_info_cb,
                                                    control);
        }

        if (o == NULL) {
                g_warning ("pa_context_get_sink_input_info_list() failed");
                return;
        }
        pa_operation_unref (o);
}

static void
req_update_source_output_info (GvcMixerControl *control,
                               int              index)
{
        pa_operation *o;

        if (index < 0) {
                o = pa_context_get_source_output_info_list (control->priv->pa_context,
                                                            _pa_context_get_source_output_info_cb,
                                                            control);
        } else {
                o = pa_context_get_source_output_info (control->priv->pa_context,
                                                       index,
                                                       _pa_context_get_source_output_info_cb,
                                                       control);
        }

        if (o == NULL) {
                g_warning ("pa_context_get_source_output_info_list() failed");
                return;
        }
        pa_operation_unref (o);
}

static void
remove_client (GvcMixerControl *control,
               guint            index)
{
        g_hash_table_remove (control->priv->clients,
                             GUINT_TO_POINTER (index));
}

static void
remove_card (GvcMixerControl *control,
             guint            index)
{
        g_hash_table_remove (control->priv->cards,
                             GUINT_TO_POINTER (index));

        g_signal_emit (G_OBJECT (control),
                       signals[CARD_REMOVED],
                       0,
                       index);
}

static void
remove_sink (GvcMixerControl *control,
             guint            index)
{
        GvcMixerStream *stream;

#if 0
        g_debug ("Removing sink: index=%u", index);
#endif

        stream = g_hash_table_lookup (control->priv->sinks,
                                      GUINT_TO_POINTER (index));
        if (stream == NULL) {
                return;
        }
        g_hash_table_remove (control->priv->sinks,
                             GUINT_TO_POINTER (index));

        remove_stream (control, stream);
}

static void
remove_source (GvcMixerControl *control,
               guint            index)
{
        GvcMixerStream *stream;

#if 0
        g_debug ("Removing source: index=%u", index);
#endif

        stream = g_hash_table_lookup (control->priv->sources,
                                      GUINT_TO_POINTER (index));
        if (stream == NULL) {
                return;
        }
        g_hash_table_remove (control->priv->sources,
                             GUINT_TO_POINTER (index));

        remove_stream (control, stream);
}

static void
remove_sink_input (GvcMixerControl *control,
                   guint            index)
{
        GvcMixerStream *stream;

#if 0
        g_debug ("Removing sink input: index=%u", index);
#endif
        stream = g_hash_table_lookup (control->priv->sink_inputs,
                                      GUINT_TO_POINTER (index));
        if (stream == NULL) {
                return;
        }
        g_hash_table_remove (control->priv->sink_inputs,
                             GUINT_TO_POINTER (index));

        remove_stream (control, stream);
}

static void
remove_source_output (GvcMixerControl *control,
                      guint            index)
{
        GvcMixerStream *stream;

#if 0
        g_debug ("Removing source output: index=%u", index);
#endif

        stream = g_hash_table_lookup (control->priv->source_outputs,
                                      GUINT_TO_POINTER (index));
        if (stream == NULL) {
                return;
        }
        g_hash_table_remove (control->priv->source_outputs,
                             GUINT_TO_POINTER (index));

        remove_stream (control, stream);
}

static void
_pa_context_subscribe_cb (pa_context                  *context,
                          pa_subscription_event_type_t t,
                          uint32_t                     index,
                          void                        *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        switch (t & PA_SUBSCRIPTION_EVENT_FACILITY_MASK) {
        case PA_SUBSCRIPTION_EVENT_SINK:
                if ((t & PA_SUBSCRIPTION_EVENT_TYPE_MASK) == PA_SUBSCRIPTION_EVENT_REMOVE) {
                        remove_sink (control, index);
                } else {
                        req_update_sink_info (control, index);
                }
                break;

        case PA_SUBSCRIPTION_EVENT_SOURCE:
                if ((t & PA_SUBSCRIPTION_EVENT_TYPE_MASK) == PA_SUBSCRIPTION_EVENT_REMOVE) {
                        remove_source (control, index);
                } else {
                        req_update_source_info (control, index);
                }
                break;

        case PA_SUBSCRIPTION_EVENT_SINK_INPUT:
                if ((t & PA_SUBSCRIPTION_EVENT_TYPE_MASK) == PA_SUBSCRIPTION_EVENT_REMOVE) {
                        remove_sink_input (control, index);
                } else {
                        req_update_sink_input_info (control, index);
                }
                break;

        case PA_SUBSCRIPTION_EVENT_SOURCE_OUTPUT:
                if ((t & PA_SUBSCRIPTION_EVENT_TYPE_MASK) == PA_SUBSCRIPTION_EVENT_REMOVE) {
                        remove_source_output (control, index);
                } else {
                        req_update_source_output_info (control, index);
                }
                break;

        case PA_SUBSCRIPTION_EVENT_CLIENT:
                if ((t & PA_SUBSCRIPTION_EVENT_TYPE_MASK) == PA_SUBSCRIPTION_EVENT_REMOVE) {
                        remove_client (control, index);
                } else {
                        req_update_client_info (control, index);
                }
                break;

        case PA_SUBSCRIPTION_EVENT_SERVER:
                req_update_server_info (control, index);
                break;

        case PA_SUBSCRIPTION_EVENT_CARD:
                if ((t & PA_SUBSCRIPTION_EVENT_TYPE_MASK) == PA_SUBSCRIPTION_EVENT_REMOVE) {
                        remove_card (control, index);
                } else {
                        req_update_card (control, index);
                }
                break;
        }
}

static void
gvc_mixer_control_ready (GvcMixerControl *control)
{
        pa_operation *o;

        pa_context_set_subscribe_callback (control->priv->pa_context,
                                           _pa_context_subscribe_cb,
                                           control);
        o = pa_context_subscribe (control->priv->pa_context,
                                  (pa_subscription_mask_t)
                                  (PA_SUBSCRIPTION_MASK_SINK|
                                   PA_SUBSCRIPTION_MASK_SOURCE|
                                   PA_SUBSCRIPTION_MASK_SINK_INPUT|
                                   PA_SUBSCRIPTION_MASK_SOURCE_OUTPUT|
                                   PA_SUBSCRIPTION_MASK_CLIENT|
                                   PA_SUBSCRIPTION_MASK_SERVER|
                                   PA_SUBSCRIPTION_MASK_CARD),
                                  NULL,
                                  NULL);

        if (o == NULL) {
                g_warning ("pa_context_subscribe() failed");
                return;
        }
        pa_operation_unref (o);

        req_update_server_info (control, -1);
        req_update_client_info (control, -1);
        req_update_sink_info (control, -1);
        req_update_source_info (control, -1);
        req_update_sink_input_info (control, -1);
        req_update_source_output_info (control, -1);
        req_update_card (control, -1);

        control->priv->n_outstanding = 6;

        /* This call is not always supported */
        o = pa_ext_stream_restore_read (control->priv->pa_context,
                                        _pa_ext_stream_restore_read_cb,
                                        control);
        if (o != NULL) {
                pa_operation_unref (o);
                control->priv->n_outstanding++;

                pa_ext_stream_restore_set_subscribe_cb (control->priv->pa_context,
                                                        _pa_ext_stream_restore_subscribe_cb,
                                                        control);

                o = pa_ext_stream_restore_subscribe (control->priv->pa_context,
                                                     1,
                                                     NULL,
                                                     NULL);
                if (o != NULL) {
                        pa_operation_unref (o);
                }

        } else {
                g_debug ("Failed to initialized stream_restore extension: %s",
                         pa_strerror (pa_context_errno (control->priv->pa_context)));
        }
}

static void
gvc_mixer_new_pa_context (GvcMixerControl *self)
{
        pa_proplist     *proplist;

        g_return_if_fail (self);
        g_return_if_fail (!self->priv->pa_context);

        proplist = pa_proplist_new ();
        pa_proplist_sets (proplist,
                          PA_PROP_APPLICATION_NAME,
                          self->priv->name);
        pa_proplist_sets (proplist,
                          PA_PROP_APPLICATION_ID,
                          "org.gnome.VolumeControl");
        pa_proplist_sets (proplist,
                          PA_PROP_APPLICATION_ICON_NAME,
                          "multimedia-volume-control");
        pa_proplist_sets (proplist,
                          PA_PROP_APPLICATION_VERSION,
                          PACKAGE_VERSION);

        self->priv->pa_context = pa_context_new_with_proplist (self->priv->pa_api, NULL, proplist);

        pa_proplist_free (proplist);
        g_assert (self->priv->pa_context);
}

static void
remove_all_streams (GvcMixerControl *control, GHashTable *hash_table)
{
        GHashTableIter iter;
        gpointer key, value;

        g_hash_table_iter_init (&iter, hash_table);
        while (g_hash_table_iter_next (&iter, &key, &value)) {
                remove_stream (control, value);
                g_hash_table_iter_remove (&iter);
        }
}

static gboolean
idle_reconnect (gpointer data)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (data);
        GHashTableIter iter;
        gpointer key, value;

        g_return_val_if_fail (control, FALSE);

        if (control->priv->pa_context) {
                pa_context_unref (control->priv->pa_context);
                control->priv->pa_context = NULL;
                gvc_mixer_new_pa_context (control);
        }

        remove_all_streams (control, control->priv->sinks);
        remove_all_streams (control, control->priv->sources);
        remove_all_streams (control, control->priv->sink_inputs);
        remove_all_streams (control, control->priv->source_outputs);

        g_hash_table_iter_init (&iter, control->priv->clients);
        while (g_hash_table_iter_next (&iter, &key, &value))
                g_hash_table_iter_remove (&iter);

        gvc_mixer_control_open (control); /* cannot fail */

        control->priv->reconnect_id = 0;
        return FALSE;
}

static void
_pa_context_state_cb (pa_context *context,
                      void       *userdata)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (userdata);

        switch (pa_context_get_state (context)) {
        case PA_CONTEXT_UNCONNECTED:
        case PA_CONTEXT_CONNECTING:
        case PA_CONTEXT_AUTHORIZING:
        case PA_CONTEXT_SETTING_NAME:
                break;

        case PA_CONTEXT_READY:
                gvc_mixer_control_ready (control);
                break;

        case PA_CONTEXT_FAILED:
                control->priv->state = GVC_STATE_FAILED;
                g_signal_emit (control, signals[STATE_CHANGED], 0, GVC_STATE_FAILED);
                if (control->priv->reconnect_id == 0)
                        control->priv->reconnect_id = g_timeout_add_seconds (RECONNECT_DELAY, idle_reconnect, control);
                break;

        case PA_CONTEXT_TERMINATED:
        default:
                /* FIXME: */
                break;
        }
}

gboolean
gvc_mixer_control_open (GvcMixerControl *control)
{
        int res;

        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), FALSE);
        g_return_val_if_fail (control->priv->pa_context != NULL, FALSE);
        g_return_val_if_fail (pa_context_get_state (control->priv->pa_context) == PA_CONTEXT_UNCONNECTED, FALSE);

        pa_context_set_state_callback (control->priv->pa_context,
                                       _pa_context_state_cb,
                                       control);

        control->priv->state = GVC_STATE_CONNECTING;
        g_signal_emit (G_OBJECT (control), signals[STATE_CHANGED], 0, GVC_STATE_CONNECTING);
        res = pa_context_connect (control->priv->pa_context, NULL, (pa_context_flags_t) PA_CONTEXT_NOFAIL, NULL);
        if (res < 0) {
                g_warning ("Failed to connect context: %s",
                           pa_strerror (pa_context_errno (control->priv->pa_context)));
        }

        return res;
}

gboolean
gvc_mixer_control_close (GvcMixerControl *control)
{
        g_return_val_if_fail (GVC_IS_MIXER_CONTROL (control), FALSE);
        g_return_val_if_fail (control->priv->pa_context != NULL, FALSE);

        pa_context_disconnect (control->priv->pa_context);

        control->priv->state = GVC_STATE_CLOSED;
        g_signal_emit (G_OBJECT (control), signals[STATE_CHANGED], 0, GVC_STATE_CLOSED);
        return TRUE;
}

static void
gvc_mixer_control_dispose (GObject *object)
{
        GvcMixerControl *control = GVC_MIXER_CONTROL (object);

        if (control->priv->reconnect_id != 0) {
                g_source_remove (control->priv->reconnect_id);
                control->priv->reconnect_id = 0;
        }

        if (control->priv->pa_context != NULL) {
                pa_context_unref (control->priv->pa_context);
                control->priv->pa_context = NULL;
        }

        if (control->priv->default_source_name != NULL) {
                g_free (control->priv->default_source_name);
                control->priv->default_source_name = NULL;
        }
        if (control->priv->default_sink_name != NULL) {
                g_free (control->priv->default_sink_name);
                control->priv->default_sink_name = NULL;
        }

        if (control->priv->pa_mainloop != NULL) {
                pa_glib_mainloop_free (control->priv->pa_mainloop);
                control->priv->pa_mainloop = NULL;
        }

        if (control->priv->all_streams != NULL) {
                g_hash_table_destroy (control->priv->all_streams);
                control->priv->all_streams = NULL;
        }

        if (control->priv->sinks != NULL) {
                g_hash_table_destroy (control->priv->sinks);
                control->priv->sinks = NULL;
        }
        if (control->priv->sources != NULL) {
                g_hash_table_destroy (control->priv->sources);
                control->priv->sources = NULL;
        }
        if (control->priv->sink_inputs != NULL) {
                g_hash_table_destroy (control->priv->sink_inputs);
                control->priv->sink_inputs = NULL;
        }
        if (control->priv->source_outputs != NULL) {
                g_hash_table_destroy (control->priv->source_outputs);
                control->priv->source_outputs = NULL;
        }
        if (control->priv->clients != NULL) {
                g_hash_table_destroy (control->priv->clients);
                control->priv->clients = NULL;
        }
        if (control->priv->cards != NULL) {
                g_hash_table_destroy (control->priv->cards);
                control->priv->cards = NULL;
        }

        G_OBJECT_CLASS (gvc_mixer_control_parent_class)->dispose (object);
}

static void
gvc_mixer_control_set_property (GObject       *object,
                                guint          prop_id,
                                const GValue  *value,
                                GParamSpec    *pspec)
{
        GvcMixerControl *self = GVC_MIXER_CONTROL (object);

        switch (prop_id) {
        case PROP_NAME:
                g_free (self->priv->name);
                self->priv->name = g_value_dup_string (value);
                g_object_notify (G_OBJECT (self), "name");
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}

static void
gvc_mixer_control_get_property (GObject     *object,
                                guint        prop_id,
                                GValue      *value,
                                GParamSpec  *pspec)
{
        GvcMixerControl *self = GVC_MIXER_CONTROL (object);

        switch (prop_id) {
        case PROP_NAME:
                g_value_set_string (value, self->priv->name);
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}


static GObject *
gvc_mixer_control_constructor (GType                  type,
                               guint                  n_construct_properties,
                               GObjectConstructParam *construct_params)
{
        GObject         *object;
        GvcMixerControl *self;

        object = G_OBJECT_CLASS (gvc_mixer_control_parent_class)->constructor (type, n_construct_properties, construct_params);

        self = GVC_MIXER_CONTROL (object);

        gvc_mixer_new_pa_context (self);

        return object;
}

static void
gvc_mixer_control_class_init (GvcMixerControlClass *klass)
{
        GObjectClass   *object_class = G_OBJECT_CLASS (klass);

        object_class->constructor = gvc_mixer_control_constructor;
        object_class->dispose = gvc_mixer_control_dispose;
        object_class->finalize = gvc_mixer_control_finalize;
        object_class->set_property = gvc_mixer_control_set_property;
        object_class->get_property = gvc_mixer_control_get_property;

        g_object_class_install_property (object_class,
                                         PROP_NAME,
                                         g_param_spec_string ("name",
                                                              "Name",
                                                              "Name to display for this mixer control",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT_ONLY));

        signals [STATE_CHANGED] =
                g_signal_new ("state-changed",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcMixerControlClass, state_changed),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__UINT,
                              G_TYPE_NONE, 1, G_TYPE_UINT);
        signals [STREAM_ADDED] =
                g_signal_new ("stream-added",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcMixerControlClass, stream_added),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__UINT,
                              G_TYPE_NONE, 1, G_TYPE_UINT);
        signals [STREAM_REMOVED] =
                g_signal_new ("stream-removed",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcMixerControlClass, stream_removed),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__UINT,
                              G_TYPE_NONE, 1, G_TYPE_UINT);
        signals [CARD_ADDED] =
                g_signal_new ("card-added",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcMixerControlClass, card_added),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__UINT,
                              G_TYPE_NONE, 1, G_TYPE_UINT);
        signals [CARD_REMOVED] =
                g_signal_new ("card-removed",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcMixerControlClass, card_removed),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__UINT,
                              G_TYPE_NONE, 1, G_TYPE_UINT);
        signals [DEFAULT_SINK_CHANGED] =
                g_signal_new ("default-sink-changed",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcMixerControlClass, default_sink_changed),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__UINT,
                              G_TYPE_NONE, 1, G_TYPE_UINT);
        signals [DEFAULT_SOURCE_CHANGED] =
                g_signal_new ("default-source-changed",
                              G_TYPE_FROM_CLASS (klass),
                              G_SIGNAL_RUN_LAST,
                              G_STRUCT_OFFSET (GvcMixerControlClass, default_source_changed),
                              NULL, NULL,
                              g_cclosure_marshal_VOID__UINT,
                              G_TYPE_NONE, 1, G_TYPE_UINT);

        g_type_class_add_private (klass, sizeof (GvcMixerControlPrivate));
}

static void
gvc_mixer_control_init (GvcMixerControl *control)
{
        control->priv = GVC_MIXER_CONTROL_GET_PRIVATE (control);

        control->priv->pa_mainloop = pa_glib_mainloop_new (g_main_context_default ());
        g_assert (control->priv->pa_mainloop);

        control->priv->pa_api = pa_glib_mainloop_get_api (control->priv->pa_mainloop);
        g_assert (control->priv->pa_api);

        control->priv->all_streams = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify)g_object_unref);
        control->priv->sinks = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify)g_object_unref);
        control->priv->sources = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify)g_object_unref);
        control->priv->sink_inputs = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify)g_object_unref);
        control->priv->source_outputs = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify)g_object_unref);
        control->priv->cards = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify)g_object_unref);

        control->priv->clients = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify)g_free);

        control->priv->state = GVC_STATE_CLOSED;
}

static void
gvc_mixer_control_finalize (GObject *object)
{
        GvcMixerControl *mixer_control;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_IS_MIXER_CONTROL (object));

        mixer_control = GVC_MIXER_CONTROL (object);
        g_free (mixer_control->priv->name);
        mixer_control->priv->name = NULL;

        g_return_if_fail (mixer_control->priv != NULL);
        G_OBJECT_CLASS (gvc_mixer_control_parent_class)->finalize (object);
}

GvcMixerControl *
gvc_mixer_control_new (const char *name)
{
        GObject *control;
        control = g_object_new (GVC_TYPE_MIXER_CONTROL,
                                "name", name,
                                NULL);
        return GVC_MIXER_CONTROL (control);
}

/* FIXME: Remove when PA 0.9.23 is used */
#ifndef PA_VOLUME_UI_MAX
#define PA_VOLUME_UI_MAX pa_sw_volume_from_dB(+11.0)
#endif

gdouble
gvc_mixer_control_get_vol_max_norm (GvcMixerControl *control)
{
	return (gdouble) PA_VOLUME_NORM;
}

gdouble
gvc_mixer_control_get_vol_max_amplified (GvcMixerControl *control)
{
	return (gdouble) PA_VOLUME_UI_MAX;
}
