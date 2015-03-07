/* -*- Mode: C; indent-tabs-mode: t; c-basic-offset: 4; tab-width: 4 -*- */
/*
 * Copyright (C) Conor Curran 2011 <conor.curran@canonical.com>
 *
 * This is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * gvc-mixer-ui-device.h is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef _GVC_MIXER_UI_DEVICE_H_
#define _GVC_MIXER_UI_DEVICE_H_

#include <glib-object.h>

G_BEGIN_DECLS

#define GVC_TYPE_MIXER_UI_DEVICE             (gvc_mixer_ui_device_get_type ())
#define GVC_MIXER_UI_DEVICE(obj)             (G_TYPE_CHECK_INSTANCE_CAST ((obj), GVC_TYPE_MIXER_UI_DEVICE, GvcMixerUIDevice))
#define GVC_MIXER_UI_DEVICE_CLASS(klass)     (G_TYPE_CHECK_CLASS_CAST ((klass), GVC_TYPE_MIXER_UI_DEVICE, GvcMixerUIDeviceClass))
#define GVC_IS_MIXER_UI_DEVICE(obj)          (G_TYPE_CHECK_INSTANCE_TYPE ((obj), GVC_TYPE_MIXER_UI_DEVICE))
#define GVC_IS_MIXER_UI_DEVICE_CLASS(klass)  (G_TYPE_CHECK_CLASS_TYPE ((klass), GVC_TYPE_MIXER_UI_DEVICE))
#define GVC_MIXER_UI_DEVICE_GET_CLASS(obj)   (G_TYPE_INSTANCE_GET_CLASS ((obj), GVC_TYPE_MIXER_UI_DEVICE, GvcMixerUIDeviceClass))

#define GVC_MIXER_UI_DEVICE_INVALID          -1

typedef struct GvcMixerUIDevicePrivate GvcMixerUIDevicePrivate;

typedef struct
{
        GObjectClass parent_class;
} GvcMixerUIDeviceClass;

typedef struct
{
        GObject parent_instance;
        GvcMixerUIDevicePrivate *priv;
} GvcMixerUIDevice;

typedef enum
{
        UIDeviceInput,
        UIDeviceOutput,
} GvcMixerUIDeviceDirection;

GType gvc_mixer_ui_device_get_type (void) G_GNUC_CONST;

guint          gvc_mixer_ui_device_get_id                      (GvcMixerUIDevice *dev);
gint           gvc_mixer_ui_device_get_stream_id               (GvcMixerUIDevice *dev);
const gchar *  gvc_mixer_ui_device_get_description             (GvcMixerUIDevice *dev);
const gchar *  gvc_mixer_ui_device_get_origin                  (GvcMixerUIDevice *dev);
const gchar *  gvc_mixer_ui_device_get_port                    (GvcMixerUIDevice *dev);
const gchar *  gvc_mixer_ui_device_get_best_profile            (GvcMixerUIDevice *dev,
                                                                const gchar      *selected,
                                                                const gchar      *current);
const gchar *  gvc_mixer_ui_device_get_active_profile          (GvcMixerUIDevice* device);
const gchar *  gvc_mixer_ui_device_get_matching_profile        (GvcMixerUIDevice *dev,
                                                                const gchar      *profile);
const gchar *  gvc_mixer_ui_device_get_user_preferred_profile  (GvcMixerUIDevice *dev);
const gchar *  gvc_mixer_ui_device_get_top_priority_profile    (GvcMixerUIDevice *dev);
GList *        gvc_mixer_ui_device_get_profiles                (GvcMixerUIDevice *dev);
GList *        gvc_mixer_ui_device_get_supported_profiles      (GvcMixerUIDevice *device);
gboolean       gvc_mixer_ui_device_should_profiles_be_hidden   (GvcMixerUIDevice *device);
void           gvc_mixer_ui_device_set_profiles                (GvcMixerUIDevice *device,
                                                                const GList      *profiles);
void           gvc_mixer_ui_device_set_user_preferred_profile  (GvcMixerUIDevice *device,
                                                                const gchar      *profile);
void           gvc_mixer_ui_device_invalidate_stream           (GvcMixerUIDevice *dev);
gboolean       gvc_mixer_ui_device_has_ports                   (GvcMixerUIDevice *dev);
gboolean       gvc_mixer_ui_device_is_output                   (GvcMixerUIDevice *dev);

G_END_DECLS

#endif /* _GVC_MIXER_UI_DEVICE_H_ */
