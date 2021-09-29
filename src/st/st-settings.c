/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-settings.c: Global settings
 *
 * Copyright 2019 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms and conditions of the GNU Lesser General Public License,
 * version 2.1, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <gio/gio.h>

#include "st-settings.h"
#include "st-private.h"

#define KEY_FONT_NAME "font-name"
#define KEY_GTK_ICON_THEME "icon-theme"


enum {
    PROP_0,
    PROP_FONT_NAME,
    PROP_GTK_ICON_THEME,
    N_PROPS
};

GParamSpec *props[N_PROPS] = { 0 };

struct _StSettings
{
  GObject parent_object;
  GSettings *interface_settings;

  gchar *font_name;
  gchar *gtk_icon_theme;
};

G_DEFINE_TYPE (StSettings, st_settings, G_TYPE_OBJECT)

static void
st_settings_finalize (GObject *object)
{
  StSettings *settings = ST_SETTINGS (object);

  g_object_unref (settings->interface_settings);
  g_free (settings->font_name);
  g_free (settings->gtk_icon_theme);

  G_OBJECT_CLASS (st_settings_parent_class)->finalize (object);
}

static void
st_settings_set_property (GObject      *object,
                          guint         prop_id,
                          const GValue *value,
                          GParamSpec   *pspec)
{
  G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
}

static void
st_settings_get_property (GObject    *object,
                          guint       prop_id,
                          GValue     *value,
                          GParamSpec *pspec)
{
  StSettings *settings = ST_SETTINGS (object);

  switch (prop_id)
    {
    case PROP_FONT_NAME:
      g_value_set_string (value, settings->font_name);
      break;
    case PROP_GTK_ICON_THEME:
      g_value_set_string (value, settings->gtk_icon_theme);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
st_settings_class_init (StSettingsClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = st_settings_finalize;
  object_class->set_property = st_settings_set_property;
  object_class->get_property = st_settings_get_property;

  props[PROP_FONT_NAME] = g_param_spec_string ("font-name",
                                               "font name",
                                               "font name",
                                               "",
                                               G_PARAM_READABLE);

  props[PROP_GTK_ICON_THEME] = g_param_spec_string ("gtk-icon-theme",
                                                    "GTK+ Icon Theme",
                                                    "GTK+ Icon Theme",
                                                    "",
                                                    ST_PARAM_READABLE);

  g_object_class_install_properties (object_class, N_PROPS, props);
}

static void
on_interface_settings_changed (GSettings   *g_settings,
                               const gchar *key,
                               StSettings  *settings)
{
  if (g_str_equal (key, KEY_FONT_NAME))
    {
      g_free (settings->font_name);
      settings->font_name = g_settings_get_string (g_settings, key);
      g_object_notify_by_pspec (G_OBJECT (settings), props[PROP_FONT_NAME]);
    }
  else if (g_str_equal (key, KEY_GTK_ICON_THEME))
    {
      g_free (settings->gtk_icon_theme);
      settings->gtk_icon_theme = g_settings_get_string (g_settings, key);
      g_object_notify_by_pspec (G_OBJECT (settings),
                                props[PROP_GTK_ICON_THEME]);
    }
}

static void
st_settings_init (StSettings *settings)
{
  settings->interface_settings = g_settings_new ("org.cinnamon.desktop.interface");
  g_signal_connect (settings->interface_settings, "changed",
                    G_CALLBACK (on_interface_settings_changed), settings);

  settings->font_name = g_settings_get_string (settings->interface_settings, KEY_FONT_NAME);
}

/**
 * st_settings_get:
 *
 * Gets the #StSettings
 *
 * Returns: (transfer none): a settings object
 **/
StSettings *
st_settings_get (void)
{
  static StSettings *settings = NULL;

  if (!settings)
    settings = g_object_new (ST_TYPE_SETTINGS, NULL);

  return settings;
}
