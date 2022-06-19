/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <string.h>

#include <meta/meta-enum-types.h>
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
  UNMINIMIZE,
  SIZE_CHANGED,
  SIZE_CHANGE,
  MAP,
  DESTROY,
  SWITCH_WORKSPACE,
  SWITCH_WORKSPACE_COMPLETE,
  KILL_SWITCH_WORKSPACE,
  KILL_WINDOW_EFFECTS,
  SHOW_TILE_PREVIEW,
  HIDE_TILE_PREVIEW,
  SHOW_WINDOW_MENU,
  FILTER_KEYBINDING,
  CONFIRM_DISPLAY_CHANGE,
  CREATE_CLOSE_DIALOG,
  CREATE_INHIBIT_SHORTCUTS_DIALOG,

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
  cinnamon_wm_signals[UNMINIMIZE] =
    g_signal_new ("unminimize",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[SIZE_CHANGED] =
    g_signal_new ("size-changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[SIZE_CHANGE] =
    g_signal_new ("size-change",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 4,
                  META_TYPE_WINDOW_ACTOR, META_TYPE_SIZE_CHANGE, META_TYPE_RECTANGLE, META_TYPE_RECTANGLE);
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
  cinnamon_wm_signals[KILL_SWITCH_WORKSPACE] =
    g_signal_new ("kill-switch-workspace",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST,
		  0,
		  NULL, NULL, NULL,
		  G_TYPE_NONE, 0);
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
                     G_TYPE_NONE, 3,
                     META_TYPE_WINDOW,
                     META_TYPE_RECTANGLE,
                     G_TYPE_INT);
    cinnamon_wm_signals[HIDE_TILE_PREVIEW] =
        g_signal_new ("hide-tile-preview",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0,
                     NULL, NULL, NULL,
                     G_TYPE_NONE, 0);
    cinnamon_wm_signals[SHOW_WINDOW_MENU] =
        g_signal_new ("show-window-menu",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0, NULL, NULL, NULL,
                     G_TYPE_NONE, 3,
                     META_TYPE_WINDOW, G_TYPE_INT, META_TYPE_RECTANGLE);
    cinnamon_wm_signals[FILTER_KEYBINDING] =
        g_signal_new ("filter-keybinding",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0,
                     g_signal_accumulator_true_handled, NULL, NULL,
                     G_TYPE_BOOLEAN, 1,
                     META_TYPE_KEY_BINDING);
    cinnamon_wm_signals[CONFIRM_DISPLAY_CHANGE] =
    g_signal_new ("confirm-display-change",
                     G_TYPE_FROM_CLASS (klass),
                     G_SIGNAL_RUN_LAST,
                     0,
                     NULL, NULL, NULL,
                     G_TYPE_NONE, 0);
  /**
   * CinnamonWM::create-close-dialog:
   * @wm: The WM
   * @window: The window to create the dialog for
   *
   * Creates a close dialog for the given window.
   *
   * Returns: (transfer full): The close dialog instance.
   */
  cinnamon_wm_signals[CREATE_CLOSE_DIALOG] =
    g_signal_new ("create-close-dialog",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  META_TYPE_CLOSE_DIALOG, 1, META_TYPE_WINDOW);
  /**
   * CinnamonWM::create-inhibit-shortcuts-dialog:
   * @wm: The WM
   * @window: The window to create the dialog for
   *
   * Creates an inhibit shortcuts dialog for the given window.
   *
   * Returns: (transfer full): The inhibit shortcuts dialog instance.
   */
  cinnamon_wm_signals[CREATE_INHIBIT_SHORTCUTS_DIALOG] =
    g_signal_new ("create-inhibit-shortcuts-dialog",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  META_TYPE_INHIBIT_SHORTCUTS_DIALOG, 1, META_TYPE_WINDOW);
}

void
_cinnamon_wm_switch_workspace (CinnamonWM      *wm,
                            gint          from,
                            gint          to,
                            MetaMotionDirection direction)
{
  g_debug ("%s", G_STRFUNC);
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
  g_debug ("%s", G_STRFUNC);
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
  g_debug ("%s", G_STRFUNC);
  meta_plugin_minimize_completed (wm->plugin, actor);
}

/**
 * cinnamon_wm_completed_unminimize:
 * @wm: the CinnamonWM
 * @actor: the MetaWindowActor actor
 *
 * The plugin must call this when it has completed a window unminimize effect.
 **/
void
cinnamon_wm_completed_unminimize (CinnamonWM         *wm,
                             MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  meta_plugin_unminimize_completed (wm->plugin, actor);
}

void
cinnamon_wm_completed_size_change  (CinnamonWM         *wm,
                             MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  meta_plugin_size_change_completed (wm->plugin, actor);
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
  g_debug ("%s", G_STRFUNC);
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
  g_debug ("%s", G_STRFUNC);
  meta_plugin_destroy_completed (wm->plugin, actor);
}

/**
 * cinnamon_wm_complete_display_change:
 * @wm: the CinnamonWM
 * @ok: if the new configuration was OK
 *
 * The plugin must call this after the user responded to the confirmation dialog.
 */
void
cinnamon_wm_complete_display_change (CinnamonWM  *wm,
                                     gboolean  ok)
{
  g_debug ("%s", G_STRFUNC);
  meta_plugin_complete_display_change (wm->plugin, ok);
}

void
_cinnamon_wm_kill_switch_workspace (CinnamonWM      *wm)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[KILL_SWITCH_WORKSPACE], 0);
}

void
_cinnamon_wm_kill_window_effects (CinnamonWM         *wm,
                               MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[KILL_WINDOW_EFFECTS], 0, actor);
}

void
_cinnamon_wm_show_tile_preview (CinnamonWM      *wm,
                                MetaWindow      *window,
                                MetaRectangle   *tile_rect,
                                int            tile_monitor)
{
  g_debug ("%s", G_STRFUNC);
    g_signal_emit (wm, cinnamon_wm_signals[SHOW_TILE_PREVIEW], 0,
                   window, tile_rect, tile_monitor);
}

void
_cinnamon_wm_hide_tile_preview (CinnamonWM *wm)
{
  g_debug ("%s", G_STRFUNC);
    g_signal_emit (wm, cinnamon_wm_signals[HIDE_TILE_PREVIEW], 0);
}

void
_cinnamon_wm_show_window_menu (CinnamonWM            *wm,
                            MetaWindow         *window,
                            MetaWindowMenuType  menu,
                            int                 x,
                            int                 y)
{
  g_debug ("%s", G_STRFUNC);
  MetaRectangle rect;

  rect.x = x;
  rect.y = y;
  rect.width = rect.height = 0;

  _cinnamon_wm_show_window_menu_for_rect (wm, window, menu, &rect);
}

void
_cinnamon_wm_show_window_menu_for_rect (CinnamonWM            *wm,
                                     MetaWindow         *window,
                                     MetaWindowMenuType  menu,
                                     MetaRectangle      *rect)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[SHOW_WINDOW_MENU], 0, window, menu, rect);
}

void
_cinnamon_wm_minimize (CinnamonWM         *wm,
                    MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[MINIMIZE], 0, actor);
}

void
_cinnamon_wm_unminimize (CinnamonWM         *wm,
                      MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[UNMINIMIZE], 0, actor);
}

void
_cinnamon_wm_size_changed (CinnamonWM         *wm,
                        MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[SIZE_CHANGED], 0, actor);
}

void
_cinnamon_wm_size_change (CinnamonWM         *wm,
                   MetaWindowActor    *actor,
                       MetaSizeChange   which_change,
                       MetaRectangle   *old_frame_rect,
                       MetaRectangle   *old_buffer_rect)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[SIZE_CHANGE], 0, actor, which_change, old_frame_rect, old_buffer_rect);
}

void
_cinnamon_wm_map (CinnamonWM         *wm,
               MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[MAP], 0, actor);
}

void
_cinnamon_wm_destroy (CinnamonWM         *wm,
                   MetaWindowActor *actor)
{
  g_debug ("%s", G_STRFUNC);
  g_signal_emit (wm, cinnamon_wm_signals[DESTROY], 0, actor);
}

gboolean
_cinnamon_wm_filter_keybinding (CinnamonWM          *wm,
                                MetaKeyBinding      *binding)
{
  gboolean rv;

  g_signal_emit (wm, cinnamon_wm_signals[FILTER_KEYBINDING], 0, binding, &rv);

  return rv;
}

void
_cinnamon_wm_confirm_display_change (CinnamonWM *wm)
{
  g_signal_emit (wm, cinnamon_wm_signals[CONFIRM_DISPLAY_CHANGE], 0);
}

MetaCloseDialog *
_cinnamon_wm_create_close_dialog (CinnamonWM    *wm,
                                  MetaWindow *window)
{
  MetaCloseDialog *dialog;

  g_signal_emit (wm, cinnamon_wm_signals[CREATE_CLOSE_DIALOG], 0, window, &dialog);

  return dialog;
}

MetaInhibitShortcutsDialog *
_cinnamon_wm_create_inhibit_shortcuts_dialog (CinnamonWM    *wm,
                                              MetaWindow *window)
{
  MetaInhibitShortcutsDialog *dialog;

  g_signal_emit (wm, cinnamon_wm_signals[CREATE_INHIBIT_SHORTCUTS_DIALOG], 0, window, &dialog);

  return dialog;
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

