/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright © 2001 Ximian, Inc.
 * Copyright (C) 2007 William Jon McCann <mccann@jhu.edu>
 * Copyright 2007 Red Hat, Inc.
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

#include <sys/types.h>
#include <sys/wait.h>
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>

#include <locale.h>

#include <glib.h>
#include <glib/gi18n.h>
#include <gio/gio.h>
#include <gdk/gdk.h>
#include <gdk/gdkx.h>

#define GNOME_DESKTOP_USE_UNSTABLE_API
#include <libgnome-desktop/gnome-bg.h>
#include <X11/Xatom.h>

#include "cinnamon-background-manager.h"

#define CINNAMON_BACKGROUND_MANAGER_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), CINNAMON_TYPE_BACKGROUND_MANAGER, CinnamonBackgroundManagerPrivate))

struct CinnamonBackgroundManagerPrivate
{
        GSettings   *settings;
        GnomeBG     *bg;

        GnomeBGCrossfade *fade;

        GDBusProxy  *proxy;
        guint        proxy_signal_id;
};

static void     cinnamon_background_manager_class_init  (CinnamonBackgroundManagerClass *klass);
static void     cinnamon_background_manager_init        (CinnamonBackgroundManager      *background_manager);
static void     cinnamon_background_manager_finalize    (GObject             *object);

static void setup_bg (CinnamonBackgroundManager *manager);
static void connect_screen_signals (CinnamonBackgroundManager *manager);

G_DEFINE_TYPE (CinnamonBackgroundManager, cinnamon_background_manager, G_TYPE_OBJECT)

static gboolean
dont_draw_background (CinnamonBackgroundManager *manager)
{
        return !g_settings_get_boolean (manager->priv->settings,
                                        "draw-background");
}

static void
on_crossfade_finished (CinnamonBackgroundManager *manager)
{
        g_object_unref (manager->priv->fade);
        manager->priv->fade = NULL;
}

static void
draw_background (CinnamonBackgroundManager *manager,
                 gboolean              use_crossfade)
{
        GdkDisplay *display;
        int         n_screens;
        int         i;

        display = gdk_display_get_default ();
        n_screens = gdk_display_get_n_screens (display);

        for (i = 0; i < n_screens; ++i) {
                GdkScreen *screen;
                GdkWindow *root_window;
                cairo_surface_t *surface;

                screen = gdk_display_get_screen (display, i);

                root_window = gdk_screen_get_root_window (screen);

                surface = gnome_bg_create_surface (manager->priv->bg,
                                                   root_window,
                                                   gdk_screen_get_width (screen),
                                                   gdk_screen_get_height (screen),
                                                   TRUE);

                if (use_crossfade) {

                        if (manager->priv->fade != NULL) {
                                g_object_unref (manager->priv->fade);
                        }

                        manager->priv->fade = gnome_bg_set_surface_as_root_with_crossfade (screen, surface);
                        g_signal_connect_swapped (manager->priv->fade, "finished",
                                                  G_CALLBACK (on_crossfade_finished),
                                                  manager);
                } else {
                        gnome_bg_set_surface_as_root (screen, surface);
                }

                cairo_surface_destroy (surface);
        }
}

static void
on_bg_transitioned (GnomeBG              *bg,
                    CinnamonBackgroundManager *manager)
{
        draw_background (manager, FALSE);
}

static gboolean
settings_change_event_cb (GSettings            *settings,
                          gpointer              keys,
                          gint                  n_keys,
                          CinnamonBackgroundManager *manager)
{
        gnome_bg_load_from_preferences (manager->priv->bg,
                                        manager->priv->settings);
        return FALSE;
}

static void
on_screen_size_changed (GdkScreen            *screen,
                        CinnamonBackgroundManager *manager)
{
        draw_background (manager, FALSE);
}

static void
watch_bg_preferences (CinnamonBackgroundManager *manager)
{
        g_signal_connect (manager->priv->settings,
                          "change-event",
                          G_CALLBACK (settings_change_event_cb),
                          manager);
}

static void
on_bg_changed (GnomeBG              *bg,
               CinnamonBackgroundManager *manager)
{
        draw_background (manager, TRUE);
}

static void
setup_bg (CinnamonBackgroundManager *manager)
{
        g_return_if_fail (manager->priv->bg == NULL);

        manager->priv->bg = gnome_bg_new ();

        g_signal_connect (manager->priv->bg,
                          "changed",
                          G_CALLBACK (on_bg_changed),
                          manager);

        g_signal_connect (manager->priv->bg,
                          "transitioned",
                          G_CALLBACK (on_bg_transitioned),
                          manager);

        connect_screen_signals (manager);
        watch_bg_preferences (manager);
        gnome_bg_load_from_preferences (manager->priv->bg,
                                        manager->priv->settings);
}

static void
setup_bg_and_draw_background (CinnamonBackgroundManager *manager)
{
        setup_bg (manager);
        draw_background (manager, FALSE);
}

static void
disconnect_session_manager_listener (CinnamonBackgroundManager *manager)
{
        if (manager->priv->proxy && manager->priv->proxy_signal_id) {
                g_signal_handler_disconnect (manager->priv->proxy,
                                             manager->priv->proxy_signal_id);
                manager->priv->proxy_signal_id = 0;
        }
}

static void
on_session_manager_signal (GDBusProxy   *proxy,
                           const gchar  *sender_name,
                           const gchar  *signal_name,
                           GVariant     *parameters,
                           gpointer      user_data)
{
        CinnamonBackgroundManager *manager = CINNAMON_BACKGROUND_MANAGER (user_data);

        if (g_strcmp0 (signal_name, "SessionRunning") == 0) {
                setup_bg_and_draw_background (manager);
                disconnect_session_manager_listener (manager);
        }
}

static void
disconnect_screen_signals (CinnamonBackgroundManager *manager)
{
        GdkDisplay *display;
        int         i;
        int         n_screens;

        display = gdk_display_get_default ();
        n_screens = gdk_display_get_n_screens (display);

        for (i = 0; i < n_screens; ++i) {
                GdkScreen *screen;
                screen = gdk_display_get_screen (display, i);
                g_signal_handlers_disconnect_by_func (screen,
                                                      G_CALLBACK (on_screen_size_changed),
                                                      manager);
        }
}

static void
connect_screen_signals (CinnamonBackgroundManager *manager)
{
        GdkDisplay *display;
        int         i;
        int         n_screens;

        display = gdk_display_get_default ();
        n_screens = gdk_display_get_n_screens (display);

        for (i = 0; i < n_screens; ++i) {
                GdkScreen *screen;
                screen = gdk_display_get_screen (display, i);
                g_signal_connect (screen,
                                  "monitors-changed",
                                  G_CALLBACK (on_screen_size_changed),
                                  manager);
                g_signal_connect (screen,
                                  "size-changed",
                                  G_CALLBACK (on_screen_size_changed),
                                  manager);
        }
}

static void
draw_background_changed (GSettings            *settings,
                         const char           *key,
                         CinnamonBackgroundManager *manager)
{
        if (dont_draw_background (manager) == FALSE)
                setup_bg_and_draw_background (manager);
}

gboolean
cinnamon_background_manager_start (CinnamonBackgroundManager *manager)
{
        manager->priv->settings = g_settings_new ("org.cinnamon.background");
        g_signal_connect (manager->priv->settings, "changed::draw-background",
                          G_CALLBACK (draw_background_changed), manager);

        setup_bg_and_draw_background (manager);

        return TRUE;
}

void
cinnamon_background_manager_stop (CinnamonBackgroundManager *manager)
{
        CinnamonBackgroundManagerPrivate *p = manager->priv;

        g_debug ("Stopping background manager");

        disconnect_screen_signals (manager);

        if (manager->priv->proxy) {
                disconnect_session_manager_listener (manager);
                g_object_unref (manager->priv->proxy);
        }

        g_signal_handlers_disconnect_by_func (manager->priv->settings,
                                              settings_change_event_cb,
                                              manager);

        if (p->settings != NULL) {
                g_object_unref (p->settings);
                p->settings = NULL;
        }

        if (p->bg != NULL) {
                g_object_unref (p->bg);
                p->bg = NULL;
        }
}

/**
 * cinnamon_background_manager_get_default:
 *
 * Return Value: (transfer none): The global #CinnamonBackgroundManager singleton
 */
CinnamonBackgroundManager *
cinnamon_background_manager_get_default ()
{
  static CinnamonBackgroundManager *instance = NULL;

  if (instance == NULL)
    instance = g_object_new (CINNAMON_TYPE_BACKGROUND_MANAGER, NULL);

  return instance;
}

static GObject *
cinnamon_background_manager_constructor (GType                  type,
                                    guint                  n_construct_properties,
                                    GObjectConstructParam *construct_properties)
{
        CinnamonBackgroundManager      *background_manager;

        background_manager = CINNAMON_BACKGROUND_MANAGER (G_OBJECT_CLASS (cinnamon_background_manager_parent_class)->constructor (type,
                                                                                                                        n_construct_properties,
                                                                                                                        construct_properties));

        return G_OBJECT (background_manager);
}

static void
cinnamon_background_manager_class_init (CinnamonBackgroundManagerClass *klass)
{
        GObjectClass   *object_class = G_OBJECT_CLASS (klass);

        object_class->constructor = cinnamon_background_manager_constructor;
        object_class->finalize = cinnamon_background_manager_finalize;

        g_type_class_add_private (klass, sizeof (CinnamonBackgroundManagerPrivate));
}

static void
cinnamon_background_manager_init (CinnamonBackgroundManager *manager)
{
        manager->priv = CINNAMON_BACKGROUND_MANAGER_GET_PRIVATE (manager);
        cinnamon_background_manager_start (manager);
}

static void
cinnamon_background_manager_finalize (GObject *object)
{
        CinnamonBackgroundManager *background_manager;

        g_return_if_fail (object != NULL);
        g_return_if_fail (CINNAMON_IS_BACKGROUND_MANAGER (object));

        background_manager = CINNAMON_BACKGROUND_MANAGER (object);

        g_return_if_fail (background_manager->priv != NULL);

        G_OBJECT_CLASS (cinnamon_background_manager_parent_class)->finalize (object);
}
