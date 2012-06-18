/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2008 William Jon McCann
 * Copyright (C) 2009 Bastien Nocera
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

#include "gvc-mixer-card.h"
#include "gvc-mixer-card-private.h"

#define GVC_MIXER_CARD_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), GVC_TYPE_MIXER_CARD, GvcMixerCardPrivate))

static guint32 card_serial = 1;

struct GvcMixerCardPrivate
{
        pa_context    *pa_context;
        guint          id;
        guint          index;
        char          *name;
        char          *icon_name;
        char          *profile;
        char          *target_profile;
        char          *human_profile;
        GList         *profiles;
        pa_operation  *profile_op;
};

enum
{
        PROP_0,
        PROP_ID,
        PROP_PA_CONTEXT,
        PROP_INDEX,
        PROP_NAME,
        PROP_ICON_NAME,
        PROP_PROFILE,
        PROP_HUMAN_PROFILE,
};

static void     gvc_mixer_card_class_init (GvcMixerCardClass *klass);
static void     gvc_mixer_card_init       (GvcMixerCard      *mixer_card);
static void     gvc_mixer_card_finalize   (GObject            *object);

G_DEFINE_TYPE (GvcMixerCard, gvc_mixer_card, G_TYPE_OBJECT)

static guint32
get_next_card_serial (void)
{
        guint32 serial;

        serial = card_serial++;

        if ((gint32)card_serial < 0) {
                card_serial = 1;
        }

        return serial;
}

pa_context *
gvc_mixer_card_get_pa_context (GvcMixerCard *card)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), 0);
        return card->priv->pa_context;
}

guint
gvc_mixer_card_get_index (GvcMixerCard *card)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), 0);
        return card->priv->index;
}

guint
gvc_mixer_card_get_id (GvcMixerCard *card)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), 0);
        return card->priv->id;
}

const char *
gvc_mixer_card_get_name (GvcMixerCard *card)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), NULL);
        return card->priv->name;
}

gboolean
gvc_mixer_card_set_name (GvcMixerCard *card,
                         const char     *name)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), FALSE);

        g_free (card->priv->name);
        card->priv->name = g_strdup (name);
        g_object_notify (G_OBJECT (card), "name");

        return TRUE;
}

const char *
gvc_mixer_card_get_icon_name (GvcMixerCard *card)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), NULL);
        return card->priv->icon_name;
}

gboolean
gvc_mixer_card_set_icon_name (GvcMixerCard *card,
                              const char     *icon_name)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), FALSE);

        g_free (card->priv->icon_name);
        card->priv->icon_name = g_strdup (icon_name);
        g_object_notify (G_OBJECT (card), "icon-name");

        return TRUE;
}

/**
 * gvc_mixer_card_get_profile: (skip)
 * @card:
 *
 * Returns:
 */
GvcMixerCardProfile *
gvc_mixer_card_get_profile (GvcMixerCard *card)
{
        GList *l;

        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), NULL);
        g_return_val_if_fail (card->priv->profiles != NULL, NULL);

        for (l = card->priv->profiles; l != NULL; l = l->next) {
                GvcMixerCardProfile *p = l->data;
                if (g_str_equal (card->priv->profile, p->profile)) {
                        return p;
                }
        }

        g_assert_not_reached ();

        return NULL;
}

gboolean
gvc_mixer_card_set_profile (GvcMixerCard *card,
                            const char     *profile)
{
        GList *l;

        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), FALSE);
        g_return_val_if_fail (card->priv->profiles != NULL, FALSE);

        g_free (card->priv->profile);
        card->priv->profile = g_strdup (profile);

        g_free (card->priv->human_profile);
        card->priv->human_profile = NULL;

        for (l = card->priv->profiles; l != NULL; l = l->next) {
                GvcMixerCardProfile *p = l->data;
                if (g_str_equal (card->priv->profile, p->profile)) {
                        card->priv->human_profile = g_strdup (p->human_profile);
                        break;
                }
        }

        g_object_notify (G_OBJECT (card), "profile");

        return TRUE;
}

static void
_pa_context_set_card_profile_by_index_cb (pa_context                       *context,
                                          int                               success,
                                          void                             *userdata)
{
        GvcMixerCard *card = GVC_MIXER_CARD (userdata);

        g_assert (card->priv->target_profile);

        if (success > 0) {
                gvc_mixer_card_set_profile (card, card->priv->target_profile);
        } else {
                g_debug ("Failed to switch profile on '%s' from '%s' to '%s'",
                         card->priv->name,
                         card->priv->profile,
                         card->priv->target_profile);
        }
        g_free (card->priv->target_profile);
        card->priv->target_profile = NULL;

        pa_operation_unref (card->priv->profile_op);
        card->priv->profile_op = NULL;
}

gboolean
gvc_mixer_card_change_profile (GvcMixerCard *card,
                               const char *profile)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), FALSE);
        g_return_val_if_fail (card->priv->profiles != NULL, FALSE);

        /* Same profile, or already requested? */
        if (g_strcmp0 (card->priv->profile, profile) == 0)
                return TRUE;
        if (g_strcmp0 (profile, card->priv->target_profile) == 0)
                return TRUE;
        if (card->priv->profile_op != NULL) {
                pa_operation_cancel (card->priv->profile_op);
                pa_operation_unref (card->priv->profile_op);
                card->priv->profile_op = NULL;
        }

        if (card->priv->profile != NULL) {
                g_free (card->priv->target_profile);
                card->priv->target_profile = g_strdup (profile);

                card->priv->profile_op = pa_context_set_card_profile_by_index (card->priv->pa_context,
                                                                               card->priv->index,
                                                                               card->priv->target_profile,
                                                                               _pa_context_set_card_profile_by_index_cb,
                                                                               card);

                if (card->priv->profile_op == NULL) {
                        g_warning ("pa_context_set_card_profile_by_index() failed");
                        return FALSE;
                }
        } else {
                g_assert (card->priv->human_profile == NULL);
                card->priv->profile = g_strdup (profile);
        }

        return TRUE;
}

/**
 * gvc_mixer_card_get_profiles:
 *
 * Return value: (transfer none) (element-type GvcMixerCardProfile):
 */
const GList *
gvc_mixer_card_get_profiles (GvcMixerCard *card)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), NULL);
        return card->priv->profiles;
}

static int
sort_profiles (GvcMixerCardProfile *a,
               GvcMixerCardProfile *b)
{
        if (a->priority == b->priority)
                return 0;
        if (a->priority > b->priority)
                return 1;
        return -1;
}

/**
 * gvc_mixer_card_set_profiles:
 * @profiles: (transfer full) (element-type GvcMixerCardProfile):
 */
gboolean
gvc_mixer_card_set_profiles (GvcMixerCard *card,
                             GList        *profiles)
{
        g_return_val_if_fail (GVC_IS_MIXER_CARD (card), FALSE);
        g_return_val_if_fail (card->priv->profiles == NULL, FALSE);

        card->priv->profiles = g_list_sort (profiles, (GCompareFunc) sort_profiles);

        return TRUE;
}

static void
gvc_mixer_card_set_property (GObject       *object,
                             guint          prop_id,
                             const GValue  *value,
                             GParamSpec    *pspec)
{
        GvcMixerCard *self = GVC_MIXER_CARD (object);

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
        case PROP_NAME:
                gvc_mixer_card_set_name (self, g_value_get_string (value));
                break;
        case PROP_ICON_NAME:
                gvc_mixer_card_set_icon_name (self, g_value_get_string (value));
                break;
        case PROP_PROFILE:
                gvc_mixer_card_set_profile (self, g_value_get_string (value));
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}

static void
gvc_mixer_card_get_property (GObject     *object,
                             guint        prop_id,
                             GValue      *value,
                             GParamSpec  *pspec)
{
        GvcMixerCard *self = GVC_MIXER_CARD (object);

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
        case PROP_NAME:
                g_value_set_string (value, self->priv->name);
                break;
        case PROP_ICON_NAME:
                g_value_set_string (value, self->priv->icon_name);
                break;
        case PROP_PROFILE:
                g_value_set_string (value, self->priv->profile);
                break;
        case PROP_HUMAN_PROFILE:
                g_value_set_string (value, self->priv->human_profile);
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
                break;
        }
}

static GObject *
gvc_mixer_card_constructor (GType                  type,
                            guint                  n_construct_properties,
                            GObjectConstructParam *construct_params)
{
        GObject       *object;
        GvcMixerCard *self;

        object = G_OBJECT_CLASS (gvc_mixer_card_parent_class)->constructor (type, n_construct_properties, construct_params);

        self = GVC_MIXER_CARD (object);

        self->priv->id = get_next_card_serial ();

        return object;
}

static void
gvc_mixer_card_class_init (GvcMixerCardClass *klass)
{
        GObjectClass   *gobject_class = G_OBJECT_CLASS (klass);

        gobject_class->constructor = gvc_mixer_card_constructor;
        gobject_class->finalize = gvc_mixer_card_finalize;

        gobject_class->set_property = gvc_mixer_card_set_property;
        gobject_class->get_property = gvc_mixer_card_get_property;

        g_object_class_install_property (gobject_class,
                                         PROP_INDEX,
                                         g_param_spec_ulong ("index",
                                                             "Index",
                                                             "The index for this card",
                                                             0, G_MAXULONG, 0,
                                                             G_PARAM_READWRITE|G_PARAM_CONSTRUCT_ONLY));
        g_object_class_install_property (gobject_class,
                                         PROP_ID,
                                         g_param_spec_ulong ("id",
                                                             "id",
                                                             "The id for this card",
                                                             0, G_MAXULONG, 0,
                                                             G_PARAM_READWRITE|G_PARAM_CONSTRUCT_ONLY));
        g_object_class_install_property (gobject_class,
                                         PROP_PA_CONTEXT,
                                         g_param_spec_pointer ("pa-context",
                                                               "PulseAudio context",
                                                               "The PulseAudio context for this card",
                                                               G_PARAM_READWRITE|G_PARAM_CONSTRUCT_ONLY));
        g_object_class_install_property (gobject_class,
                                         PROP_NAME,
                                         g_param_spec_string ("name",
                                                              "Name",
                                                              "Name to display for this card",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_ICON_NAME,
                                         g_param_spec_string ("icon-name",
                                                              "Icon Name",
                                                              "Name of icon to display for this card",
                                                              NULL,
                                                              G_PARAM_READWRITE|G_PARAM_CONSTRUCT));
        g_object_class_install_property (gobject_class,
                                         PROP_PROFILE,
                                         g_param_spec_string ("profile",
                                                              "Profile",
                                                              "Name of current profile for this card",
                                                              NULL,
                                                              G_PARAM_READWRITE));
        g_object_class_install_property (gobject_class,
                                         PROP_HUMAN_PROFILE,
                                         g_param_spec_string ("human-profile",
                                                              "Profile (Human readable)",
                                                              "Name of current profile for this card in human readable form",
                                                              NULL,
                                                              G_PARAM_READABLE));

        g_type_class_add_private (klass, sizeof (GvcMixerCardPrivate));
}

static void
gvc_mixer_card_init (GvcMixerCard *card)
{
        card->priv = GVC_MIXER_CARD_GET_PRIVATE (card);
}

GvcMixerCard *
gvc_mixer_card_new (pa_context *context,
                    guint       index)
{
        GObject *object;

        object = g_object_new (GVC_TYPE_MIXER_CARD,
                               "index", index,
                               "pa-context", context,
                               NULL);
        return GVC_MIXER_CARD (object);
}

static void
free_profile (GvcMixerCardProfile *p)
{
        g_free (p->profile);
        g_free (p->human_profile);
        g_free (p->status);
        g_free (p);
}

static void
gvc_mixer_card_finalize (GObject *object)
{
        GvcMixerCard *mixer_card;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_IS_MIXER_CARD (object));

        mixer_card = GVC_MIXER_CARD (object);

        g_return_if_fail (mixer_card->priv != NULL);

        g_free (mixer_card->priv->name);
        mixer_card->priv->name = NULL;

        g_free (mixer_card->priv->icon_name);
        mixer_card->priv->icon_name = NULL;

        g_free (mixer_card->priv->target_profile);
        mixer_card->priv->target_profile = NULL;

        g_free (mixer_card->priv->profile);
        mixer_card->priv->profile = NULL;

        g_free (mixer_card->priv->human_profile);
        mixer_card->priv->human_profile = NULL;

        g_list_foreach (mixer_card->priv->profiles, (GFunc) free_profile, NULL);
        g_list_free (mixer_card->priv->profiles);
        mixer_card->priv->profiles = NULL;

        G_OBJECT_CLASS (gvc_mixer_card_parent_class)->finalize (object);
}

