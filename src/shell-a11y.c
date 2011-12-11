/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Copyright (C) 2010 Igalia, S.L.
 *
 * Author: Alejandro Piñeiro Iglesias <apinheiro@igalia.com>
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

#include <string.h>
#include <gmodule.h>
#include <clutter/clutter.h>

#include "shell-a11y.h"

#define INIT_METHOD "gnome_accessibility_module_init"
#define DESKTOP_SCHEMA "org.gnome.desktop.interface"
#define ACCESSIBILITY_ENABLED_KEY "toolkit-accessibility"
#define AT_SPI_SCHEMA "org.a11y.atspi"
#define ATK_BRIDGE_LOCATION_KEY "atk-bridge-location"

static gboolean
should_enable_a11y (void)
{
  GSettings *desktop_settings = NULL;
  gboolean value = FALSE;

  desktop_settings = g_settings_new (DESKTOP_SCHEMA);
  value = g_settings_get_boolean (desktop_settings, ACCESSIBILITY_ENABLED_KEY);

  g_object_unref (desktop_settings);

  return value;
}

static char*
get_atk_bridge_path (void)
{
  GSettings *atspi_settings = NULL;
  GVariant *variant = NULL;
  char *value = NULL;
  const char * const *schemas = NULL;
  gboolean found = FALSE;
  int i = 0;

  schemas = g_settings_list_schemas ();

  for (i = 0; schemas [i]; i++)
    {
      if (!strcmp (schemas[i], AT_SPI_SCHEMA))
        {
          found = TRUE;
          break;
        }
    }

  if (!found)
    {
      g_warning ("Accessibility: %s schema not found. Are you sure that at-spi or"
                 " at-spi2 is installed on your system?", AT_SPI_SCHEMA);
      return NULL;
    }

  atspi_settings = g_settings_new (AT_SPI_SCHEMA);
  variant = g_settings_get_value (atspi_settings, ATK_BRIDGE_LOCATION_KEY);
  value = g_variant_dup_bytestring (variant, NULL);
  g_variant_unref (variant);
  g_object_unref (atspi_settings);

  return value;
}

static gboolean
a11y_invoke_module (const char *module_path)
{
  GModule    *handle;
  void      (*invoke_fn) (void);

  if (!module_path)
    {
      g_warning ("Accessibility: invalid module path (NULL)");

      return FALSE;
    }

  if (!(handle = g_module_open (module_path, 0)))
    {
      g_warning ("Accessibility: failed to load module '%s': '%s'",
                 module_path, g_module_error ());

      return FALSE;
    }

  if (!g_module_symbol (handle, INIT_METHOD, (gpointer *)&invoke_fn))
    {
      g_warning ("Accessibility: error library '%s' does not include "
                 "method '%s' required for accessibility support",
                 module_path, INIT_METHOD);
      g_module_close (handle);

      return FALSE;
    }

  invoke_fn ();

  return TRUE;
}

/*
 * It loads the atk-bridge if required. It checks:
 *  * If the proper gsetting key is set
 *  * If clutter has already enabled the accessibility
 *
 * You need to ensure that the atk-bridge was not loaded before this
 * call, because in that case the application would be already
 * registered on at-spi using the AtkUtil implementation on that
 * moment (if any, although without anyone the application would
 * crash). Anyway this is the reason of NO_AT_BRIDGE.
 *
 */
void
shell_a11y_init (void)
{
  char *bridge_path = NULL;

  if (!should_enable_a11y ())
    return;

  if (clutter_get_accessibility_enabled () == FALSE)
    {
      g_warning ("Accessibility: clutter has no accessibility enabled"
                 " skipping the atk-bridge load");
      return;
    }

  bridge_path = get_atk_bridge_path ();

  if (a11y_invoke_module (bridge_path) == FALSE)
    {
      g_warning ("Accessibility: error loading the atk-bridge. Although the"
                 " accessibility on the system is enabled and clutter"
                 " accessibility is also enabled, accessibility support on"
                 " GNOME Shell will not work");
    }

  /* NOTE: We avoid to load gail module, as gail-cally interaction is
   * not fully supported right now.
   */

  g_free (bridge_path);
}
