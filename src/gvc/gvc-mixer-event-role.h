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

#ifndef __GVC_MIXER_EVENT_ROLE_H
#define __GVC_MIXER_EVENT_ROLE_H

#include <glib-object.h>
#include "gvc-mixer-stream.h"

G_BEGIN_DECLS

#define GVC_TYPE_MIXER_EVENT_ROLE         (gvc_mixer_event_role_get_type ())
#define GVC_MIXER_EVENT_ROLE(o)           (G_TYPE_CHECK_INSTANCE_CAST ((o), GVC_TYPE_MIXER_EVENT_ROLE, GvcMixerEventRole))
#define GVC_MIXER_EVENT_ROLE_CLASS(k)     (G_TYPE_CHECK_CLASS_CAST((k), GVC_TYPE_MIXER_EVENT_ROLE, GvcMixerEventRoleClass))
#define GVC_IS_MIXER_EVENT_ROLE(o)        (G_TYPE_CHECK_INSTANCE_TYPE ((o), GVC_TYPE_MIXER_EVENT_ROLE))
#define GVC_IS_MIXER_EVENT_ROLE_CLASS(k)  (G_TYPE_CHECK_CLASS_TYPE ((k), GVC_TYPE_MIXER_EVENT_ROLE))
#define GVC_MIXER_EVENT_ROLE_GET_CLASS(o) (G_TYPE_INSTANCE_GET_CLASS ((o), GVC_TYPE_MIXER_EVENT_ROLE, GvcMixerEventRoleClass))

typedef struct GvcMixerEventRolePrivate GvcMixerEventRolePrivate;

typedef struct
{
        GvcMixerStream            parent;
        GvcMixerEventRolePrivate *priv;
} GvcMixerEventRole;

typedef struct
{
        GvcMixerStreamClass parent_class;
} GvcMixerEventRoleClass;

GType               gvc_mixer_event_role_get_type      (void);

GvcMixerStream *    gvc_mixer_event_role_new           (pa_context    *context,
                                                        const char    *device,
                                                        GvcChannelMap *channel_map);

G_END_DECLS

#endif /* __GVC_MIXER_EVENT_ROLE_H */
