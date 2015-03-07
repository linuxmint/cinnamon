/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2008-2009 Red Hat, Inc.
 * Copyright (C) Conor Curran 2011 <conor.curran@canonical.com>
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
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA 02110-1335, USA.
 *
 */

#ifndef __GVC_MIXER_CARD_H
#define __GVC_MIXER_CARD_H

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

#define GVC_TYPE_MIXER_CARD         (gvc_mixer_card_get_type ())
#define GVC_MIXER_CARD(o)           (G_TYPE_CHECK_INSTANCE_CAST ((o), GVC_TYPE_MIXER_CARD, GvcMixerCard))
#define GVC_MIXER_CARD_CLASS(k)     (G_TYPE_CHECK_CLASS_CAST((k), GVC_TYPE_MIXER_CARD, GvcMixerCardClass))
#define GVC_IS_MIXER_CARD(o)        (G_TYPE_CHECK_INSTANCE_TYPE ((o), GVC_TYPE_MIXER_CARD))
#define GVC_IS_MIXER_CARD_CLASS(k)  (G_TYPE_CHECK_CLASS_TYPE ((k), GVC_TYPE_MIXER_CARD))
#define GVC_MIXER_CARD_GET_CLASS(o) (G_TYPE_INSTANCE_GET_CLASS ((o), GVC_TYPE_MIXER_CARD, GvcMixerCardClass))

typedef struct GvcMixerCardPrivate GvcMixerCardPrivate;

typedef struct
{
        GObject                parent;
        GvcMixerCardPrivate   *priv;
} GvcMixerCard;

typedef struct
{
        GObjectClass           parent_class;

        /* vtable */
} GvcMixerCardClass;

typedef struct
{
        char  *profile;
        char  *human_profile;
        char  *status;
        guint  priority;
        guint  n_sinks, n_sources;
} GvcMixerCardProfile;

typedef struct
{
        char  *port;
        char  *human_port;
        guint  priority;
        gint   available;
        gint   direction;
        GList *profiles;
} GvcMixerCardPort;

GType                 gvc_mixer_card_get_type          (void);

guint                 gvc_mixer_card_get_id            (GvcMixerCard *card);
guint                 gvc_mixer_card_get_index         (GvcMixerCard *card);
const char *          gvc_mixer_card_get_name          (GvcMixerCard *card);
const char *          gvc_mixer_card_get_icon_name     (GvcMixerCard *card);
GvcMixerCardProfile * gvc_mixer_card_get_profile       (GvcMixerCard *card);
const GList *         gvc_mixer_card_get_profiles      (GvcMixerCard *card);
const GList *         gvc_mixer_card_get_ports         (GvcMixerCard *card);
gboolean              gvc_mixer_card_change_profile    (GvcMixerCard *card,
                                                        const char *profile);
GIcon *               gvc_mixer_card_get_gicon         (GvcMixerCard *card);

int                   gvc_mixer_card_profile_compare   (GvcMixerCardProfile *a,
                                                        GvcMixerCardProfile *b);

/* private */
gboolean              gvc_mixer_card_set_name          (GvcMixerCard *card,
                                                        const char   *name);
gboolean              gvc_mixer_card_set_icon_name     (GvcMixerCard *card,
                                                        const char   *name);
gboolean              gvc_mixer_card_set_profile       (GvcMixerCard *card,
                                                        const char   *profile);
gboolean              gvc_mixer_card_set_profiles      (GvcMixerCard *card,
                                                        GList        *profiles);
gboolean              gvc_mixer_card_set_ports         (GvcMixerCard *stream,
                                                        GList        *ports);

G_END_DECLS

#endif /* __GVC_MIXER_CARD_H */
