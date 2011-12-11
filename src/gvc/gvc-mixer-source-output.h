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

#ifndef __GVC_MIXER_SOURCE_OUTPUT_H
#define __GVC_MIXER_SOURCE_OUTPUT_H

#include <glib-object.h>
#include "gvc-mixer-stream.h"

G_BEGIN_DECLS

#define GVC_TYPE_MIXER_SOURCE_OUTPUT         (gvc_mixer_source_output_get_type ())
#define GVC_MIXER_SOURCE_OUTPUT(o)           (G_TYPE_CHECK_INSTANCE_CAST ((o), GVC_TYPE_MIXER_SOURCE_OUTPUT, GvcMixerSourceOutput))
#define GVC_MIXER_SOURCE_OUTPUT_CLASS(k)     (G_TYPE_CHECK_CLASS_CAST((k), GVC_TYPE_MIXER_SOURCE_OUTPUT, GvcMixerSourceOutputClass))
#define GVC_IS_MIXER_SOURCE_OUTPUT(o)        (G_TYPE_CHECK_INSTANCE_TYPE ((o), GVC_TYPE_MIXER_SOURCE_OUTPUT))
#define GVC_IS_MIXER_SOURCE_OUTPUT_CLASS(k)  (G_TYPE_CHECK_CLASS_TYPE ((k), GVC_TYPE_MIXER_SOURCE_OUTPUT))
#define GVC_MIXER_SOURCE_OUTPUT_GET_CLASS(o) (G_TYPE_INSTANCE_GET_CLASS ((o), GVC_TYPE_MIXER_SOURCE_OUTPUT, GvcMixerSourceOutputClass))

typedef struct GvcMixerSourceOutputPrivate GvcMixerSourceOutputPrivate;

typedef struct
{
        GvcMixerStream               parent;
        GvcMixerSourceOutputPrivate *priv;
} GvcMixerSourceOutput;

typedef struct
{
        GvcMixerStreamClass parent_class;
} GvcMixerSourceOutputClass;

GType               gvc_mixer_source_output_get_type      (void);

GvcMixerStream *    gvc_mixer_source_output_new           (pa_context    *context,
                                                           guint          index,
                                                           GvcChannelMap *map);

G_END_DECLS

#endif /* __GVC_MIXER_SOURCE_OUTPUT_H */
