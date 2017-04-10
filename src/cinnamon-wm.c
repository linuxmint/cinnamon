/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <string.h>

#include <meta/keybindings.h>

#include "cinnamon-wm-private.h"
#include "cinnamon-global.h"

struct _CinnamonWM {
  GObject parent;

  MetaPlugin *plugin;
};

/* Signals */
enum
{
  MINIMIZE,
  MAXIMIZE,
  UNMAXIMIZE,
  TILE,
  MAP,
  DESTROY,
  SWITCH_WORKSPACE,
  SWITCH_WORKSPACE_COMPLETE,
  KILL_WINDOW_EFFECTS,
  SHOW_TILE_PREVIEW,
  HIDE_TILE_PREVIEW,
  SHOW_HUD_PREVIEW,
  HIDE_HUD_PREVIEW,

  LAST_SIGNAL
};

G_DEFINE_TYPE(CinnamonWM, cinnamon_wm, G_TYPE_OBJECT);

static guint cinnamon_wm_signals [LAST_SIGNAL] = { 0 };

static void
cinnamon_wm_init (CinnamonWM *wm)
{
}

static void
cinnamon_wm_finalize (GObject *object)
{
  G_OBJECT_CLASS (cinnamon_wm_parent_class)->finalize (object);
}

static void
cinnamon_wm_class_init (CinnamonWMClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->finalize = cinnamon_wm_finalize;

  cinnamon_wm_signals[MINIMIZE] =
    g_signal_new ("minimize",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[MAXIMIZE] =
    g_signal_new ("maximize",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 5,
                  META_TYPE_WINDOW_ACTOR, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT);
  cinnamon_wm_signals[UNMAXIMIZE] =
    g_signal_new ("unmaximize",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 5,
                  META_TYPE_WINDOW_ACTOR, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT);
  cinnamon_wm_signals[TILE] =
    g_signal_new ("tile",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 5,
                  META_TYPE_WINDOW_ACTOR, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT);
  cinnamon_wm_signals[MAP] =
    g_signal_new ("map",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[DESTROY] =
    g_signal_new ("destroy",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[SWITCH_WORKSPACE] =
    g_signal_new ("switch-workspace",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST,
		  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 3,
                  G_TYPE_INT, G_TYPE_INT, G_TYPE_INT);
  cinnamon_wm_signals[SWITCH_WORKSPACE_COMPLETE] =
    g_signal_new ("switch-workspace-complete",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST,
		  0,
		  NULL, NULL, NULL,
		  G_TYPE_NONE, 0);
  cinnamon_wm_signals[KILL_WINDOW_EFFECTS] =
    g_signal_new ("kill-window-effects",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST,
		  0,
		  NULL, NULL, NULL,
		  G_TYPE_NONE, 1,
		  META_TYPE_WINDOW_ACTOR);
    cinnamon_wm_signals[SHOW_TILE_PREVIEW] =
        g_signal_new ("show-tile-preview",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0, NULL, NULL, NULL,
                     G_TYPE_NONE, 4,
                     META_TYPE_WINDOW,
                     META_TYPE_RECTANGLE,
                     G_TYPE_INT,
                     G_TYPE_UINT);
    cinnamon_wm_signals[HIDE_TILE_PREVIEW] =
        g_signal_new ("hide-tile-preview",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0,
                     NULL, NULL, NULL,
                     G_TYPE_NONE, 0);
    cinnamon_wm_signals[SHOW_HUD_PREVIEW] =
        g_signal_new ("show-hud-preview",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0,
                     NULL, NULL, NULL,
                     G_TYPE_NONE, 3,
                     G_TYPE_UINT,
                     META_TYPE_RECTANGLE,
                     G_TYPE_UINT);
    cinnamon_wm_signals[HIDE_HUD_PREVIEW] =
        g_signal_new ("hide-hud-preview",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0,
                     NULL, NULL, NULL,
                     G_TYPE_NONE, 0);
}

void
_cinnamon_wm_switch_workspace (CinnamonWM      *wm,
                            gint          from,
                            gint          to,
                            MetaMotionDirection direction)
{
  g_signal_emit (wm, cinnamon_wm_signals[SWITCH_WORKSPACE], 0,
                 from, to, direction);
}

/**
 * cinnamon_wm_completed_switch_workspace:
 * @wm: the CinnamonWM
 *
 * The plugin must call this when it has finished switching the
 * workspace.
 **/
void
cinnamon_wm_completed_switch_workspace (CinnamonWM *wm)
{
  meta_plugin_switch_workspace_completed (wm->plugin);
  g_signal_emit (wm, cinnamon_wm_signals[SWITCH_WORKSPACE_COMPLETE], 0);
}

/**
 * cinnamon_wm_completed_minimize:
 * @wm: the CinnamonWM
 * @actor: the MetaWindowActor actor
 *
 * The plugin must call this when it has completed a window minimize effect.
 **/
void
cinnamon_wm_completed_minimize (CinnamonWM         *wm,
                             MetaWindowActor *actor)
{
  meta_plugin_minimize_completed (wm->plugin, actor);
}

/**
 * cinnamon_wm_completed_maximize:
 * @wm: the CinnamonWM
 * @actor: the MetaWindowActor actor
 *
 * The plugin must call this when it has completed a window maximize effect.
 **/
void
cinnamon_wm_completed_maximize (CinnamonWM         *wm,
                             MetaWindowActor *actor)
{
  meta_plugin_maximize_completed (wm->plugin, actor);
}

/**
 * cinnamon_wm_completed_tile:
 * @wm: the CinnamonWM
 * @actor: the MetaWindowActor actor
 *
 * The plugin must call this when it has completed a window tile effect.
 **/
void
cinnamon_wm_completed_tile  (CinnamonWM         *wm,
                             MetaWindowActor *actor)
{
  meta_plugin_tile_completed (wm->plugin, actor);
}


/**
 * cinnamon_wm_completed_unmaximize:
 * @wm: the CinnamonWM
 * @actor: the MetaWindowActor actor
 *
 * The plugin must call this when it has completed a window unmaximize effect.
 **/
void
cinnamon_wm_completed_unmaximize (CinnamonWM         *wm,
                               MetaWindowActor *actor)
{
  meta_plugin_unmaximize_completed (wm->plugin, actor);
}

/**
 * cinnamon_wm_completed_map:
 * @wm: the CinnamonWM
 * @actor: the MetaWindowActor actor
 *
 * The plugin must call this when it has completed a window map effect.
 **/
void
cinnamon_wm_completed_map (CinnamonWM         *wm,
                        MetaWindowActor *actor)
{
  meta_plugin_map_completed (wm->plugin, actor);
}

/**
 * cinnamon_wm_completed_destroy:
 * @wm: the CinnamonWM
 * @actor: the MetaWindowActor actor
 *
 * The plugin must call this when it has completed a window destroy effect.
 **/
void
cinnamon_wm_completed_destroy (CinnamonWM         *wm,
                            MetaWindowActor *actor)
{
  meta_plugin_destroy_completed (wm->plugin, actor);
}

void
_cinnamon_wm_kill_window_effects (CinnamonWM         *wm,
                               MetaWindowActor *actor)
{
  g_signal_emit (wm, cinnamon_wm_signals[KILL_WINDOW_EFFECTS], 0, actor);
}

void
_cinnamon_wm_show_tile_preview (CinnamonWM      *wm,
                                MetaWindow      *window,
                                MetaRectangle   *tile_rect,
                                int             tile_monitor,
                                guint           snap_queued)
{
    g_signal_emit (wm, cinnamon_wm_signals[SHOW_TILE_PREVIEW], 0,
                   window, tile_rect, tile_monitor, snap_queued);
}

void
_cinnamon_wm_hide_tile_preview (CinnamonWM *wm)
{
    g_signal_emit (wm, cinnamon_wm_signals[HIDE_TILE_PREVIEW], 0);
}

void
_cinnamon_wm_show_hud_preview (CinnamonWM       *wm,
                               guint            current_proximity_zone,
                               MetaRectangle    *work_area,
                               guint            snap_queued)
{
    g_signal_emit (wm, cinnamon_wm_signals[SHOW_HUD_PREVIEW], 0,
                   current_proximity_zone, work_area, snap_queued);
}

void
_cinnamon_wm_hide_hud_preview (CinnamonWM *wm)
{
    g_signal_emit (wm, cinnamon_wm_signals[HIDE_HUD_PREVIEW], 0);
}

void
_cinnamon_wm_minimize (CinnamonWM         *wm,
                    MetaWindowActor *actor)
{
  g_signal_emit (wm, cinnamon_wm_signals[MINIMIZE], 0, actor);
}

void
_cinnamon_wm_maximize (CinnamonWM         *wm,
                    MetaWindowActor *actor,
                    int              target_x,
                    int              target_y,
                    int              target_width,
                    int              target_height)
{
  g_signal_emit (wm, cinnamon_wm_signals[MAXIMIZE], 0, actor, target_x, target_y, target_width, target_height);
}

void
_cinnamon_wm_unmaximize (CinnamonWM         *wm,
                      MetaWindowActor *actor,
                      int              target_x,
                      int              target_y,
                      int              target_width,
                      int              target_height)
{
  g_signal_emit (wm, cinnamon_wm_signals[UNMAXIMIZE], 0, actor, target_x, target_y, target_width, target_height);
}

void
_cinnamon_wm_tile (CinnamonWM         *wm,
                   MetaWindowActor    *actor,
                   int                 target_x,
                   int                 target_y,
                   int                 target_width,
                   int                 target_height)
{
  g_signal_emit (wm, cinnamon_wm_signals[TILE], 0, actor, target_x, target_y, target_width, target_height);
}

void
_cinnamon_wm_map (CinnamonWM         *wm,
               MetaWindowActor *actor)
{
  g_signal_emit (wm, cinnamon_wm_signals[MAP], 0, actor);
}

void
_cinnamon_wm_destroy (CinnamonWM         *wm,
                   MetaWindowActor *actor)
{
  g_signal_emit (wm, cinnamon_wm_signals[DESTROY], 0, actor);
}

/**
 * cinnamon_wm_new:
 * @plugin: the #MetaPlugin
 *
 * Creates a new window management interface by hooking into @plugin.
 *
 * Return value: the new window-management interface
 **/
CinnamonWM *
cinnamon_wm_new (MetaPlugin *plugin)
{
  CinnamonWM *wm;

  wm = g_object_new (CINNAMON_TYPE_WM, NULL);
  wm->plugin = plugin;

  return wm;
}

