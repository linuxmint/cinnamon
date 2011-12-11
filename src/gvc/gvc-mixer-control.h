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

#ifndef __GVC_MIXER_CONTROL_H
#define __GVC_MIXER_CONTROL_H

#include <glib-object.h>
#include "gvc-mixer-stream.h"
#include "gvc-mixer-card.h"

G_BEGIN_DECLS

typedef enum
{
        GVC_STATE_CLOSED,
        GVC_STATE_READY,
        GVC_STATE_CONNECTING,
        GVC_STATE_FAILED
} GvcMixerControlState;

#define GVC_TYPE_MIXER_CONTROL         (gvc_mixer_control_get_type ())
#define GVC_MIXER_CONTROL(o)           (G_TYPE_CHECK_INSTANCE_CAST ((o), GVC_TYPE_MIXER_CONTROL, GvcMixerControl))
#define GVC_MIXER_CONTROL_CLASS(k)     (G_TYPE_CHECK_CLASS_CAST((k), GVC_TYPE_MIXER_CONTROL, GvcMixerControlClass))
#define GVC_IS_MIXER_CONTROL(o)        (G_TYPE_CHECK_INSTANCE_TYPE ((o), GVC_TYPE_MIXER_CONTROL))
#define GVC_IS_MIXER_CONTROL_CLASS(k)  (G_TYPE_CHECK_CLASS_TYPE ((k), GVC_TYPE_MIXER_CONTROL))
#define GVC_MIXER_CONTROL_GET_CLASS(o) (G_TYPE_INSTANCE_GET_CLASS ((o), GVC_TYPE_MIXER_CONTROL, GvcMixerControlClass))

typedef struct GvcMixerControlPrivate GvcMixerControlPrivate;

typedef struct
{
        GObject                 parent;
        GvcMixerControlPrivate *priv;
} GvcMixerControl;

typedef struct
{
        GObjectClass            parent_class;

        void (*state_changed)          (GvcMixerControl      *control,
                                        GvcMixerControlState  new_state);
        void (*stream_added)           (GvcMixerControl *control,
                                        guint            id);
        void (*stream_removed)         (GvcMixerControl *control,
                                        guint            id);
        void (*card_added)             (GvcMixerControl *control,
                                        guint            id);
        void (*card_removed)           (GvcMixerControl *control,
                                        guint            id);
        void (*default_sink_changed)   (GvcMixerControl *control,
                                        guint            id);
        void (*default_source_changed) (GvcMixerControl *control,
                                        guint            id);
} GvcMixerControlClass;

GType               gvc_mixer_control_get_type            (void);

GvcMixerControl *   gvc_mixer_control_new                 (const char *name);

gboolean            gvc_mixer_control_open                (GvcMixerControl *control);
gboolean            gvc_mixer_control_close               (GvcMixerControl *control);

GSList *            gvc_mixer_control_get_cards           (GvcMixerControl *control);
GSList *            gvc_mixer_control_get_streams         (GvcMixerControl *control);
GSList *            gvc_mixer_control_get_sinks           (GvcMixerControl *control);
GSList *            gvc_mixer_control_get_sources         (GvcMixerControl *control);
GSList *            gvc_mixer_control_get_sink_inputs     (GvcMixerControl *control);
GSList *            gvc_mixer_control_get_source_outputs  (GvcMixerControl *control);

GvcMixerStream *    gvc_mixer_control_lookup_stream_id    (GvcMixerControl *control,
                                                           guint            id);
GvcMixerCard   *    gvc_mixer_control_lookup_card_id      (GvcMixerControl *control,
                                                           guint            id);

GvcMixerStream *    gvc_mixer_control_get_default_sink     (GvcMixerControl *control);
GvcMixerStream *    gvc_mixer_control_get_default_source   (GvcMixerControl *control);
GvcMixerStream *    gvc_mixer_control_get_event_sink_input (GvcMixerControl *control);

gboolean            gvc_mixer_control_set_default_sink     (GvcMixerControl *control,
                                                            GvcMixerStream  *stream);
gboolean            gvc_mixer_control_set_default_source   (GvcMixerControl *control,
                                                            GvcMixerStream  *stream);

gdouble             gvc_mixer_control_get_vol_max_norm      (GvcMixerControl *control);
gdouble             gvc_mixer_control_get_vol_max_amplified (GvcMixerControl *control);

GvcMixerControlState gvc_mixer_control_get_state            (GvcMixerControl *control);

G_END_DECLS

#endif /* __GVC_MIXER_CONTROL_H */
