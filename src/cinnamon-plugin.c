/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

/*
 * Copyright (c) 2008 Red Hat, Inc.
 * Copyright (c) 2008 Intel Corp.
 *
 * Based on plugin skeleton by:
 * Author: Tomas Frydrych <tf@linux.intel.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA
 * 02110-1335, USA.
 */

#include "config.h"

#include <stdlib.h>
#include <string.h>

#include <clutter/clutter.h>
#include <clutter/x11/clutter-x11.h>
#if defined (__arm__)
#else
#include <GL/glx.h>
#include <GL/glxext.h>
#endif
#include <cjs/gjs.h>
#include <meta/display.h>
#include <meta/meta-plugin.h>

#include "cinnamon-global-private.h"
#include "cinnamon-perf-log.h"
#include "cinnamon-wm-private.h"

static void gnome_cinnamon_plugin_dispose     (GObject *object);
static void gnome_cinnamon_plugin_finalize    (GObject *object);

static void gnome_cinnamon_plugin_start            (MetaPlugin          *plugin);
static void gnome_cinnamon_plugin_minimize         (MetaPlugin          *plugin,
                                                 MetaWindowActor     *actor);
static void gnome_cinnamon_plugin_maximize         (MetaPlugin          *plugin,
                                                 MetaWindowActor     *actor,
                                                 gint                 x,
                                                 gint                 y,
                                                 gint                 width,
                                                 gint                 height);
static void gnome_cinnamon_plugin_unmaximize       (MetaPlugin          *plugin,
                                                 MetaWindowActor     *actor,
                                                 gint                 x,
                                                 gint                 y,
                                                 gint                 width,
                                                 gint                 height);
static void gnome_cinnamon_plugin_tile             (MetaPlugin          *plugin,
                                                 MetaWindowActor     *actor,
                                                 gint                 x,
                                                 gint                 y,
                                                 gint                 width,
                                                 gint                 height);
static void gnome_cinnamon_plugin_map              (MetaPlugin          *plugin,
                                                 MetaWindowActor     *actor);
static void gnome_cinnamon_plugin_destroy          (MetaPlugin          *plugin,
                                                 MetaWindowActor     *actor);

static void gnome_cinnamon_plugin_switch_workspace (MetaPlugin          *plugin,
                                                 gint                 from,
                                                 gint                 to,
                                                 MetaMotionDirection  direction);

static void gnome_cinnamon_plugin_kill_window_effects   (MetaPlugin      *plugin,
                                                      MetaWindowActor *actor);
static void gnome_cinnamon_plugin_kill_switch_workspace (MetaPlugin      *plugin);


static gboolean              gnome_cinnamon_plugin_xevent_filter (MetaPlugin *plugin,
                                                               XEvent     *event);
static const MetaPluginInfo *gnome_cinnamon_plugin_plugin_info   (MetaPlugin *plugin);


#define GNOME_TYPE_CINNAMON_PLUGIN            (gnome_cinnamon_plugin_get_type ())
#define CINNAMON_PLUGIN(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), GNOME_TYPE_CINNAMON_PLUGIN, CinnamonPlugin))
#define CINNAMON_PLUGIN_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  GNOME_TYPE_CINNAMON_PLUGIN, CinnamonPluginClass))
#define GNOME_IS_CINNAMON_PLUGIN(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_PLUGIN_TYPE))
#define GNOME_IS_CINNAMON_PLUGIN_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  GNOME_TYPE_CINNAMON_PLUGIN))
#define CINNAMON_PLUGIN_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  GNOME_TYPE_CINNAMON_PLUGIN, CinnamonPluginClass))

typedef struct _CinnamonPlugin        CinnamonPlugin;
typedef struct _CinnamonPluginClass   CinnamonPluginClass;

struct _CinnamonPlugin
{
  MetaPlugin parent;

  Atom panel_action;
  Atom panel_action_run_dialog;
  Atom panel_action_main_menu;

  int glx_error_base;
  int glx_event_base;
  guint have_swap_event : 1;

  CinnamonGlobal *global;
};

struct _CinnamonPluginClass
{
  MetaPluginClass parent_class;
};

GType gnome_cinnamon_plugin_get_type (void);

G_DEFINE_TYPE (CinnamonPlugin, gnome_cinnamon_plugin, META_TYPE_PLUGIN)

static void
gnome_cinnamon_plugin_class_init (CinnamonPluginClass *klass)
{
  GObjectClass      *gobject_class = G_OBJECT_CLASS (klass);
  MetaPluginClass *plugin_class  = META_PLUGIN_CLASS (klass);

  gobject_class->dispose         = gnome_cinnamon_plugin_dispose;
  gobject_class->finalize        = gnome_cinnamon_plugin_finalize;

  plugin_class->start            = gnome_cinnamon_plugin_start;
  plugin_class->map              = gnome_cinnamon_plugin_map;
  plugin_class->minimize         = gnome_cinnamon_plugin_minimize;
  plugin_class->maximize         = gnome_cinnamon_plugin_maximize;
  plugin_class->tile             = gnome_cinnamon_plugin_tile;
  plugin_class->unmaximize       = gnome_cinnamon_plugin_unmaximize;
  plugin_class->destroy          = gnome_cinnamon_plugin_destroy;

  plugin_class->switch_workspace = gnome_cinnamon_plugin_switch_workspace;

  plugin_class->kill_window_effects   = gnome_cinnamon_plugin_kill_window_effects;
  plugin_class->kill_switch_workspace = gnome_cinnamon_plugin_kill_switch_workspace;

  plugin_class->xevent_filter    = gnome_cinnamon_plugin_xevent_filter;
  plugin_class->plugin_info      = gnome_cinnamon_plugin_plugin_info;
}

static void
gnome_cinnamon_plugin_init (CinnamonPlugin *cinnamon_plugin)
{
}

static void
gnome_cinnamon_plugin_start (MetaPlugin *plugin)
{
  CinnamonPlugin *cinnamon_plugin = CINNAMON_PLUGIN (plugin);
#if defined (__arm__)
#else
  MetaScreen *screen;
  MetaDisplay *display;
  Display *xdisplay;
#endif
  GError *error = NULL;
  int status;
#if defined (__arm__)
#else
  const char *glx_extensions;
#endif
  GjsContext *gjs_context;

#if defined (__arm__)
  cinnamon_plugin->have_swap_event = 0;
#else
  screen = meta_plugin_get_screen (plugin);
  display = meta_screen_get_display (screen);

  xdisplay = meta_display_get_xdisplay (display);

  glXQueryExtension (xdisplay,
                     &cinnamon_plugin->glx_error_base,
                     &cinnamon_plugin->glx_event_base);

  glx_extensions = glXQueryExtensionsString (xdisplay,
                                             meta_screen_get_screen_number (screen));
  cinnamon_plugin->have_swap_event = strstr (glx_extensions, "GLX_INTEL_swap_event") != NULL;
#endif

  cinnamon_perf_log_define_event (cinnamon_perf_log_get_default (),
                               "glx.swapComplete",
                               "GL buffer swap complete event received (with timestamp of completion)",
                               "x");

  cinnamon_plugin->global = cinnamon_global_get ();
  _cinnamon_global_set_plugin (cinnamon_plugin->global, META_PLUGIN (cinnamon_plugin));

  gjs_context = _cinnamon_global_get_gjs_context (cinnamon_plugin->global);

  if (!gjs_context_eval (gjs_context,
                         "imports.ui.environment.init();"
                         "imports.ui.main.start();",
                         -1,
                         "<main>",
                         &status,
                         &error))
    {
      g_message ("Execution of main.js threw exception: %s", error->message);
      g_error_free (error);
      /* We just exit() here, since in a development environment you'll get the
       * error in your cinnamon output, and it's way better than a busted WM,
       * which typically manifests as a white screen.
       *
       * In production, we shouldn't crash =)  But if we do, we should get
       * restarted by the session infrastructure, which is likely going
       * to be better than some undefined state.
       *
       * If there was a generic "hook into bug-buddy for non-C crashes"
       * infrastructure, here would be the place to put it.
       */
      exit (1);
    }
}

static void
gnome_cinnamon_plugin_dispose (GObject *object)
{
  G_OBJECT_CLASS(gnome_cinnamon_plugin_parent_class)->dispose (object);
}

static void
gnome_cinnamon_plugin_finalize (GObject *object)
{
  G_OBJECT_CLASS(gnome_cinnamon_plugin_parent_class)->finalize (object);
}

static CinnamonWM *
get_cinnamon_wm (void)
{
  CinnamonWM *wm;

  g_object_get (cinnamon_global_get (),
                "window-manager", &wm,
                NULL);
  /* drop extra ref added by g_object_get */
  g_object_unref (wm);

  return wm;
}

static void
gnome_cinnamon_plugin_minimize (MetaPlugin         *plugin,
			     MetaWindowActor    *actor)
{
  _cinnamon_wm_minimize (get_cinnamon_wm (),
                      actor);

}

static void
gnome_cinnamon_plugin_maximize (MetaPlugin         *plugin,
                             MetaWindowActor    *actor,
                             gint                x,
                             gint                y,
                             gint                width,
                             gint                height)
{
  _cinnamon_wm_maximize (get_cinnamon_wm (),
                      actor, x, y, width, height);
}

static void
gnome_cinnamon_plugin_tile  (MetaPlugin         *plugin,
                             MetaWindowActor    *actor,
                             gint                x,
                             gint                y,
                             gint                width,
                             gint                height)
{
  _cinnamon_wm_tile (get_cinnamon_wm (),
                     actor, x, y, width, height);
}

static void
gnome_cinnamon_plugin_unmaximize (MetaPlugin         *plugin,
                               MetaWindowActor    *actor,
                               gint                x,
                               gint                y,
                               gint                width,
                               gint                height)
{
  _cinnamon_wm_unmaximize (get_cinnamon_wm (),
                        actor, x, y, width, height);
}

static void
gnome_cinnamon_plugin_map (MetaPlugin         *plugin,
                        MetaWindowActor    *actor)
{
  _cinnamon_wm_map (get_cinnamon_wm (),
                 actor);
}

static void
gnome_cinnamon_plugin_destroy (MetaPlugin         *plugin,
                            MetaWindowActor    *actor)
{
  _cinnamon_wm_destroy (get_cinnamon_wm (),
                     actor);
}

static void
gnome_cinnamon_plugin_switch_workspace (MetaPlugin         *plugin,
                                     gint                from,
                                     gint                to,
                                     MetaMotionDirection direction)
{
  _cinnamon_wm_switch_workspace (get_cinnamon_wm(), from, to, direction);
}

static void
gnome_cinnamon_plugin_kill_window_effects (MetaPlugin         *plugin,
                                        MetaWindowActor    *actor)
{
  _cinnamon_wm_kill_window_effects (get_cinnamon_wm(), actor);
}

static void
gnome_cinnamon_plugin_kill_switch_workspace (MetaPlugin         *plugin)
{
  _cinnamon_wm_kill_switch_workspace (get_cinnamon_wm());
}

static gboolean
gnome_cinnamon_plugin_xevent_filter (MetaPlugin *plugin,
                                  XEvent     *xev)
{
  MetaScreen *screen = meta_plugin_get_screen (plugin);
  ClutterStage *stage = CLUTTER_STAGE (meta_get_stage_for_screen (screen));

  CinnamonPlugin *cinnamon_plugin = CINNAMON_PLUGIN (plugin);
#ifdef GLX_INTEL_swap_event
  if (cinnamon_plugin->have_swap_event &&
      xev->type == (cinnamon_plugin->glx_event_base + GLX_BufferSwapComplete))
    {
      GLXBufferSwapComplete *swap_complete_event;
      swap_complete_event = (GLXBufferSwapComplete *)xev;

      /* Buggy early versions of the INTEL_swap_event implementation in Mesa
       * can send this with a ust of 0. Simplify life for consumers
       * by ignoring such events */
      if (swap_complete_event->ust != 0)
        cinnamon_perf_log_event_x (cinnamon_perf_log_get_default (),
                                "glx.swapComplete",
                                swap_complete_event->ust);
    }
#endif

  if ((xev->xany.type == EnterNotify || xev->xany.type == LeaveNotify)
      && xev->xcrossing.window == clutter_x11_get_stage_window (stage))
    {
      /* If the pointer enters a child of the stage window (eg, a
       * trayicon), we want to consider it to still be in the stage,
       * so don't let Clutter see the event.
       */
      if (xev->xcrossing.detail == NotifyInferior)
        return TRUE;

      /* If the pointer is grabbed by a window it is not currently in,
       * filter that out as well. In particular, if a trayicon grabs
       * the pointer after a click on its label, we don't want to hide
       * the message tray. Filtering out this event will leave Clutter
       * out of sync, but that happens fairly often with grabs, and we
       * can work around it. (Eg, cinnamon_global_sync_pointer().)
       */
      if (xev->xcrossing.mode == NotifyGrab &&
          (xev->xcrossing.detail == NotifyNonlinear ||
           xev->xcrossing.detail == NotifyNonlinearVirtual))
        return TRUE;
    }

  /*
   * Pass the event to cinnamon-global
   */
  if (_cinnamon_global_check_xdnd_event (cinnamon_plugin->global, xev))
    return TRUE;

  return clutter_x11_handle_event (xev) != CLUTTER_X11_FILTER_CONTINUE;
}

static const
MetaPluginInfo *gnome_cinnamon_plugin_plugin_info (MetaPlugin *plugin)
{
  static const MetaPluginInfo info = {
    .name = "Cinnamon",
    .version = "0.1",
    .author = "Various",
    .license = "GPLv2+",
    .description = "Provides Cinnamon core functionality"
  };

  return &info;
}
