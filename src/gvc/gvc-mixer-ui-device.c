/* -*- Mode: C; indent-tabs-mode: t; c-basic-offset: 4; tab-width: 4 -*- */
/*
 * gvc-mixer-ui-device.c
 * Copyright (C) Conor Curran 2011 <conor.curran@canonical.com>
 * Copyright (C) 2012 David Henningsson, Canonical Ltd. <david.henningsson@canonical.com>
 *
 * gvc-mixer-ui-device.c is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * gvc-mixer-ui-device.c is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#include <string.h>

#include "gvc-mixer-ui-device.h"
#include "gvc-mixer-card.h"

#define GVC_MIXER_UI_DEVICE_GET_PRIVATE(obj) (G_TYPE_INSTANCE_GET_PRIVATE ((obj), GVC_TYPE_MIXER_UI_DEVICE, GvcMixerUIDevicePrivate))

struct GvcMixerUIDevicePrivate
{
        gchar                      *first_line_desc;
        gchar                      *second_line_desc;

        GvcMixerCard               *card;
        gchar                      *port_name;
        gint                        stream_id;
        guint                       id;
        gboolean                    port_available;

        /* These two lists contain pointers to GvcMixerCardProfile objects. Those objects are owned by GvcMixerCard. *
         * TODO: Do we want to add a weak reference to the GvcMixerCard for this reason? */
        GList                      *supported_profiles; /* all profiles supported by this port.*/
        GList                      *profiles; /* profiles to be added to combobox, subset of supported_profiles. */
        GvcMixerUIDeviceDirection   type;
        gboolean                    disable_profile_swapping;
        gchar                      *user_preferred_profile;
};

enum
{
        PROP_0,
        PROP_DESC_LINE_1,
        PROP_DESC_LINE_2,
        PROP_CARD,
        PROP_PORT_NAME,
        PROP_STREAM_ID,
        PROP_UI_DEVICE_TYPE,
        PROP_PORT_AVAILABLE,
};

static void     gvc_mixer_ui_device_class_init (GvcMixerUIDeviceClass *klass);
static void     gvc_mixer_ui_device_init       (GvcMixerUIDevice      *device);
static void     gvc_mixer_ui_device_finalize   (GObject               *object);

G_DEFINE_TYPE (GvcMixerUIDevice, gvc_mixer_ui_device, G_TYPE_OBJECT);

static guint32
get_next_output_serial (void)
{
        static guint32 output_serial = 1;
        guint32 serial;

        serial = output_serial++;

        if ((gint32)output_serial < 0)
                output_serial = 1;

        return serial;
}

static void
gvc_mixer_ui_device_get_property  (GObject       *object,
                                   guint         property_id,
                                   GValue        *value,
                                   GParamSpec    *pspec)
{
        GvcMixerUIDevice *self = GVC_MIXER_UI_DEVICE (object);

        switch (property_id) {
        case PROP_DESC_LINE_1:
                g_value_set_string (value, self->priv->first_line_desc);
                break;
        case PROP_DESC_LINE_2:
                g_value_set_string (value, self->priv->second_line_desc);
                break;
        case PROP_CARD:
                g_value_set_pointer (value, self->priv->card);
                break;
        case PROP_PORT_NAME:
                g_value_set_string (value, self->priv->port_name);
                break;
        case PROP_STREAM_ID:
                g_value_set_int (value, self->priv->stream_id);
                break;
        case PROP_UI_DEVICE_TYPE:
                g_value_set_uint (value, (guint)self->priv->type);
                break;
        case PROP_PORT_AVAILABLE:
                g_value_set_boolean (value, self->priv->port_available);
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
                break;
        }
}

static void
gvc_mixer_ui_device_set_property  (GObject      *object,
                                   guint         property_id,
                                   const GValue *value,
                                   GParamSpec   *pspec)
{
        GvcMixerUIDevice *self = GVC_MIXER_UI_DEVICE (object);

        switch (property_id) {
        case PROP_DESC_LINE_1:
                g_free (self->priv->first_line_desc);
                self->priv->first_line_desc = g_value_dup_string (value);
                g_debug ("gvc-mixer-output-set-property - 1st line: %s\n",
                         self->priv->first_line_desc);
                break;
        case PROP_DESC_LINE_2:
                g_free (self->priv->second_line_desc);
                self->priv->second_line_desc = g_value_dup_string (value);
                g_debug ("gvc-mixer-output-set-property - 2nd line: %s\n",
                         self->priv->second_line_desc);
                break;
        case PROP_CARD:
                self->priv->card = g_value_get_pointer (value);
                g_debug ("gvc-mixer-output-set-property - card: %p\n",
                         self->priv->card);
                break;
        case PROP_PORT_NAME:
                g_free (self->priv->port_name);
                self->priv->port_name = g_value_dup_string (value);
                g_debug ("gvc-mixer-output-set-property - card port name: %s\n",
                         self->priv->port_name);
                break;
        case PROP_STREAM_ID:
                self->priv->stream_id = g_value_get_int (value);
                g_debug ("gvc-mixer-output-set-property - sink/source id: %i\n",
                         self->priv->stream_id);
                break;
        case PROP_UI_DEVICE_TYPE:
                self->priv->type = (GvcMixerUIDeviceDirection) g_value_get_uint (value);
                break;
        case PROP_PORT_AVAILABLE:
                self->priv->port_available = g_value_get_boolean (value);
                g_debug ("gvc-mixer-output-set-property - port available %i, value passed in %i \n",
                         self->priv->port_available, g_value_get_boolean (value));
                break;
        default:
                G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
                break;
        }
}

static GObject *
gvc_mixer_ui_device_constructor (GType                  type,
                                 guint                  n_construct_properties,
                                 GObjectConstructParam *construct_params)
{
        GObject           *object;
        GvcMixerUIDevice  *self;

        object = G_OBJECT_CLASS (gvc_mixer_ui_device_parent_class)->constructor (type, n_construct_properties, construct_params);

        self = GVC_MIXER_UI_DEVICE (object);
        self->priv->id = get_next_output_serial ();
        self->priv->stream_id = GVC_MIXER_UI_DEVICE_INVALID;
        return object;
}

static void
gvc_mixer_ui_device_init (GvcMixerUIDevice *device)
{
        device->priv = GVC_MIXER_UI_DEVICE_GET_PRIVATE (device);
}

static void
char_clear_pointer (gchar *pointer)
{
    if (pointer) {
        g_free (pointer);
        pointer = NULL;
    }
}

static void
list_clear_pointer (GList *pointer)
{
    if (pointer) {
        g_list_free (pointer);
        pointer = NULL;
    }
}




static void
gvc_mixer_ui_device_dispose (GObject *object)
{
        GvcMixerUIDevice *device;

        g_return_if_fail (object != NULL);
        g_return_if_fail (GVC_MIXER_UI_DEVICE (object));

        device = GVC_MIXER_UI_DEVICE (object);

        char_clear_pointer (device->priv->port_name);
        char_clear_pointer (device->priv->first_line_desc);
        char_clear_pointer (device->priv->second_line_desc);
        list_clear_pointer (device->priv->profiles);
        list_clear_pointer (device->priv->supported_profiles);
        char_clear_pointer (device->priv->user_preferred_profile);

        G_OBJECT_CLASS (gvc_mixer_ui_device_parent_class)->dispose (object);
}

static void
gvc_mixer_ui_device_finalize (GObject *object)
{
        G_OBJECT_CLASS (gvc_mixer_ui_device_parent_class)->finalize (object);
}

static void
gvc_mixer_ui_device_class_init (GvcMixerUIDeviceClass *klass)
{
        GObjectClass* object_class = G_OBJECT_CLASS (klass);
        GParamSpec *pspec;

        object_class->constructor = gvc_mixer_ui_device_constructor;
        object_class->dispose = gvc_mixer_ui_device_dispose;
        object_class->finalize = gvc_mixer_ui_device_finalize;
        object_class->set_property = gvc_mixer_ui_device_set_property;
        object_class->get_property = gvc_mixer_ui_device_get_property;

        pspec = g_param_spec_string ("description",
                                     "Description construct prop",
                                     "Set first line description",
                                     "no-name-set",
                                     G_PARAM_READWRITE);
        g_object_class_install_property (object_class, PROP_DESC_LINE_1, pspec);

        pspec = g_param_spec_string ("origin",
                                     "origin construct prop",
                                     "Set second line description name",
                                     "no-name-set",
                                     G_PARAM_READWRITE);
        g_object_class_install_property (object_class, PROP_DESC_LINE_2, pspec);

        pspec = g_param_spec_pointer ("card",
                                      "Card from pulse",
                                      "Set/Get card",
                                      G_PARAM_READWRITE);

        g_object_class_install_property (object_class, PROP_CARD, pspec);

        pspec = g_param_spec_string ("port-name",
                                     "port-name construct prop",
                                     "Set port-name",
                                     NULL,
                                     G_PARAM_READWRITE);
        g_object_class_install_property (object_class, PROP_PORT_NAME, pspec);

        pspec = g_param_spec_int ("stream-id",
                                  "stream id assigned by gvc-stream",
                                  "Set/Get stream id",
                                  -1,
                                   G_MAXINT,
                                   GVC_MIXER_UI_DEVICE_INVALID,
                                   G_PARAM_READWRITE);
        g_object_class_install_property (object_class, PROP_STREAM_ID, pspec);

        pspec = g_param_spec_uint ("type",
                                   "ui-device type",
                                   "determine whether its an input and output",
                                   0, 1, 0, G_PARAM_READWRITE);
        g_object_class_install_property (object_class, PROP_UI_DEVICE_TYPE, pspec);

        pspec = g_param_spec_boolean ("port-available",
                                      "available",
                                      "determine whether this port is available",
                                      FALSE,
                                      G_PARAM_READWRITE);
        g_object_class_install_property (object_class, PROP_PORT_AVAILABLE, pspec);

        g_type_class_add_private (klass, sizeof (GvcMixerUIDevicePrivate));
}

/* Removes the part of the string that starts with skip_prefix
 * ie. corresponding to the other direction.
 * Normally either "input:" or "output:"
 *
 * Example: if given the input string "output:hdmi-stereo+input:analog-stereo" and
 * skip_prefix "input:", the resulting string is "output:hdmi-stereo".
 *
 * The returned string must be freed with g_free().
 */
static gchar *
get_profile_canonical_name (const gchar *profile_name, const gchar *skip_prefix)
{
        gchar *result = NULL;
        gchar **s;
        int i;

        /* optimisation for the simple case. */
        if (strstr (profile_name, skip_prefix) == NULL)
                return g_strdup (profile_name);

        s = g_strsplit (profile_name, "+", 0);
        for (i = 0; i < g_strv_length (s); i++) {
                if (g_str_has_prefix (s[i], skip_prefix))
                        continue;
                if (result == NULL)
                        result = g_strdup (s[i]);
                else {
                        gchar *c = g_strdup_printf("%s+%s", result, s[i]);
                        g_free(result);
                        result = c;
                }
        }

        g_strfreev(s);

        if (!result)
                return g_strdup("off");

        return result;
}

const gchar *
gvc_mixer_ui_device_get_matching_profile (GvcMixerUIDevice *device, const gchar *profile)
{
        gchar *skip_prefix = device->priv->type == UIDeviceInput ? "output:" : "input:";
        gchar *target_cname = get_profile_canonical_name (profile, skip_prefix);
        GList *l;
        gchar *result = NULL;

        for (l = device->priv->profiles; l != NULL; l = l->next) {
                gchar *canonical_name;
                GvcMixerCardProfile* p = l->data;
                canonical_name = get_profile_canonical_name (p->profile, skip_prefix);
                if (strcmp (canonical_name, target_cname) == 0)
                        result = p->profile;
                g_free (canonical_name);
        }

        g_free (target_cname);
        g_debug ("Matching profile for '%s' is '%s'", profile, result ? result : "(null)");
        return result;
}


static void
add_canonical_names_of_profiles (GvcMixerUIDevice *device,
                                 const GList      *in_profiles,
                                 GHashTable       *added_profiles,
                                 const gchar      *skip_prefix,
                                 gboolean          only_canonical)
{
        const GList *l;

        for (l = in_profiles; l != NULL; l = l->next) {
                gchar *canonical_name;
                GvcMixerCardProfile* p = l->data;

                canonical_name = get_profile_canonical_name (p->profile, skip_prefix);
                g_debug ("The canonical name for '%s' is '%s'", p->profile, canonical_name);

                /* Have we already added the canonical version of this profile? */
                if (g_hash_table_contains (added_profiles, canonical_name)) {
                        g_free (canonical_name);
                        continue;
                }

                if (only_canonical && strcmp (p->profile, canonical_name) != 0) {
                        g_free (canonical_name);
                        continue;
                }

                g_free (canonical_name);

                g_debug ("Adding profile to combobox: '%s' - '%s'", p->profile, p->human_profile);
                g_hash_table_insert (added_profiles, g_strdup (p->profile), p);
                device->priv->profiles = g_list_append (device->priv->profiles, p);
        }
}

/**
 * gvc_mixer_ui_device_set_profiles:
 * @in_profiles: a list of GvcMixerCardProfile
 *
 * Assigns value to
 *  - device->priv->profiles (profiles to be added to combobox)
 *  - device->priv->supported_profiles (all profiles of this port)
 *  - device->priv->disable_profile_swapping (whether to show the combobox)
 *
 * This method attempts to reduce the list of profiles visible to the user by figuring out
 * from the context of that device (whether it's an input or an output) what profiles
 * actually provide an alternative.
 *
 * It does this by the following.
 *  - It ignores off profiles.
 *  - It takes the canonical name of the profile. That name is what you get when you
 *    ignore the other direction.
 *  - In the first iteration, it only adds the names of canonical profiles - i e
 *    when the other side is turned off.
 *  - Normally the first iteration covers all cases, but sometimes (e g bluetooth)
 *    it doesn't, so add other profiles whose canonical name isn't already added
 *    in a second iteration.
 */
void
gvc_mixer_ui_device_set_profiles (GvcMixerUIDevice *device,
                                  const GList      *in_profiles)
{
        GHashTable *added_profiles;
        gchar *skip_prefix = device->priv->type == UIDeviceInput ? "output:" : "input:";

        g_debug ("Set profiles for '%s'", gvc_mixer_ui_device_get_description(device));

        if (in_profiles == NULL)
                return;

        device->priv->supported_profiles = g_list_copy ((GList*) in_profiles);

        added_profiles = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, NULL);

        /* Run two iterations: First, add profiles which are canonical themselves,
         * Second, add profiles for which the canonical name is not added already. */

        add_canonical_names_of_profiles(device, in_profiles, added_profiles, skip_prefix, TRUE);
        add_canonical_names_of_profiles(device, in_profiles, added_profiles, skip_prefix, FALSE);

        /* TODO: Consider adding the "Off" profile here */

        device->priv->disable_profile_swapping = g_hash_table_size (added_profiles) <= 1;
        g_hash_table_destroy (added_profiles);
}

/**
 * gvc_mixer_ui_device_get_best_profile:
 * @selected: The selected profile or its canonical name or %NULL for any profile
 * @current: The currently selected profile
 *
 * Returns: (transfer none): a profile name, valid as long as the UI device profiles are.
 */
const gchar *
gvc_mixer_ui_device_get_best_profile (GvcMixerUIDevice *device,
                                      const gchar      *selected,
                                      const gchar      *current)
{
        GList *candidates, *l;
        const gchar *result;
        gchar *skip_prefix;
        gchar *canonical_name_selected;

        if (device->priv->type == UIDeviceInput)
                skip_prefix = "output:";
        else
                skip_prefix = "input:";

        /* First make a list of profiles acceptable to switch to */
        canonical_name_selected = NULL;
        if (selected)
                canonical_name_selected = get_profile_canonical_name (selected, skip_prefix);

	candidates = NULL;
        for (l = device->priv->supported_profiles; l != NULL; l = l->next) {
                gchar *canonical_name;
                GvcMixerCardProfile* p = l->data;
                canonical_name = get_profile_canonical_name (p->profile, skip_prefix);
                if (!canonical_name_selected || strcmp (canonical_name, canonical_name_selected) == 0) {
                        candidates = g_list_append (candidates, p);
                        g_debug ("Candidate for profile switching: '%s'", p->profile);
                }
                g_free (canonical_name);
        }

        if (!candidates) {
                g_warning ("No suitable profile candidates for '%s'", selected ? selected : "(null)");
                g_free (canonical_name_selected);
                return current;
        }

        /* 1) Maybe we can skip profile switching altogether? */
        result = NULL;
        for (l = candidates; (result == NULL) && (l != NULL); l = l->next) {
                GvcMixerCardProfile* p = l->data;
                if (strcmp (current, p->profile) == 0)
                        result = p->profile;
        }

        /* 2) Try to keep the other side unchanged if possible */
        if (result == NULL) {
                guint prio = 0;
                gchar *skip_prefix_reverse = device->priv->type == UIDeviceInput ? "input:" : "output:";
                gchar *current_reverse = get_profile_canonical_name (current, skip_prefix_reverse);
                for (l = candidates; l != NULL; l = l->next) {
                        gchar *p_reverse;
                        GvcMixerCardProfile* p = l->data;
                        p_reverse = get_profile_canonical_name (p->profile, skip_prefix_reverse);
                        g_debug ("Comparing '%s' (from '%s') with '%s', prio %d", p_reverse, p->profile, current_reverse, p->priority); 
                        if (strcmp (p_reverse, current_reverse) == 0 && (!result || p->priority > prio)) {
                                result = p->profile;
                                prio = p->priority;
                        }
                        g_free (p_reverse);
                }
                g_free (current_reverse);
        }

        /* 3) All right, let's just pick the profile with highest priority.
         * TODO: We could consider asking a GUI question if this stops streams
         * in the other direction */
        if (result == NULL) {
                guint prio = 0;
                for (l = candidates; l != NULL; l = l->next) {
                        GvcMixerCardProfile* p = l->data;
                        if ((p->priority > prio) || !result) {
                                result = p->profile;
                                prio = p->priority;
                        }
                }
        }

        g_list_free (candidates);
        g_free (canonical_name_selected);
        return result;
}

const gchar *
gvc_mixer_ui_device_get_active_profile (GvcMixerUIDevice* device)
{
        GvcMixerCardProfile *profile;

        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        if (device->priv->card == NULL) {
                g_warning ("Device did not have an appropriate card");
                return NULL;
        }

        profile = gvc_mixer_card_get_profile (device->priv->card);
        return gvc_mixer_ui_device_get_matching_profile (device, profile->profile);
}

gboolean
gvc_mixer_ui_device_should_profiles_be_hidden (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), FALSE);

        return device->priv->disable_profile_swapping;
}

GList*
gvc_mixer_ui_device_get_profiles (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        return device->priv->profiles;
}

GList*
gvc_mixer_ui_device_get_supported_profiles (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        return device->priv->supported_profiles;
}

guint
gvc_mixer_ui_device_get_id (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), 0);

        return device->priv->id;
}

gint
gvc_mixer_ui_device_get_stream_id (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), 0);

        return device->priv->stream_id;
}

void
gvc_mixer_ui_device_invalidate_stream (GvcMixerUIDevice *self)
{
        g_return_if_fail (GVC_IS_MIXER_UI_DEVICE (self));

        self->priv->stream_id = GVC_MIXER_UI_DEVICE_INVALID;
}

const gchar *
gvc_mixer_ui_device_get_description (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        return device->priv->first_line_desc;
}

const gchar *
gvc_mixer_ui_device_get_origin (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        return device->priv->second_line_desc;
}

const gchar*
gvc_mixer_ui_device_get_user_preferred_profile (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        return device->priv->user_preferred_profile;
}

const gchar *
gvc_mixer_ui_device_get_top_priority_profile (GvcMixerUIDevice *device)
{
        GList *last;
        GvcMixerCardProfile *profile;

        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        last = g_list_last (device->priv->supported_profiles);
        profile = last->data;

        return profile->profile;
}

void
gvc_mixer_ui_device_set_user_preferred_profile (GvcMixerUIDevice *device,
                                                const gchar      *profile)
{
        g_return_if_fail (GVC_IS_MIXER_UI_DEVICE (device));

        g_free (device->priv->user_preferred_profile);
        device->priv->user_preferred_profile = g_strdup (profile);
}

const gchar *
gvc_mixer_ui_device_get_port (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), NULL);

        return device->priv->port_name;
}

gboolean
gvc_mixer_ui_device_has_ports (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), FALSE);

        return (device->priv->port_name != NULL);
}

gboolean
gvc_mixer_ui_device_is_output (GvcMixerUIDevice *device)
{
        g_return_val_if_fail (GVC_IS_MIXER_UI_DEVICE (device), FALSE);

        return (device->priv->type == UIDeviceOutput);
}
