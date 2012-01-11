/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <string.h>

#include <meta/keybindings.h>

#include "cinnamon-wm-private.h"
#include "cinnamon-global.h"
#include "cinnamon-marshal.h"

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
  MAP,
  DESTROY,
  SWITCH_WORKSPACE,
  KILL_SWITCH_WORKSPACE,
  KILL_WINDOW_EFFECTS,

  KEYBINDING,

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
                  NULL, NULL,
                  g_cclosure_marshal_VOID__OBJECT,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[MAXIMIZE] =
    g_signal_new ("maximize",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL,
                  _cinnamon_marshal_VOID__OBJECT_INT_INT_INT_INT,
                  G_TYPE_NONE, 5,
                  META_TYPE_WINDOW_ACTOR, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT);
  cinnamon_wm_signals[UNMAXIMIZE] =
    g_signal_new ("unmaximize",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL,
                  _cinnamon_marshal_VOID__OBJECT_INT_INT_INT_INT,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT, G_TYPE_INT);
  cinnamon_wm_signals[MAP] =
    g_signal_new ("map",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL,
                  g_cclosure_marshal_VOID__OBJECT,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[DESTROY] =
    g_signal_new ("destroy",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL,
                  g_cclosure_marshal_VOID__OBJECT,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW_ACTOR);
  cinnamon_wm_signals[SWITCH_WORKSPACE] =
    g_signal_new ("switch-workspace",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST,
		  0,
		  NULL, NULL,
		  _cinnamon_marshal_VOID__INT_INT_INT,
		  G_TYPE_NONE, 3,
                  G_TYPE_INT, G_TYPE_INT, G_TYPE_INT);
  cinnamon_wm_signals[KILL_SWITCH_WORKSPACE] =
    g_signal_new ("kill-switch-workspace",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST,
		  0,
		  NULL, NULL,
		  g_cclosure_marshal_VOID__VOID,
		  G_TYPE_NONE, 0);
  cinnamon_wm_signals[KILL_WINDOW_EFFECTS] =
    g_signal_new ("kill-window-effects",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST,
		  0,
		  NULL, NULL,
		  g_cclosure_marshal_VOID__OBJECT,
		  G_TYPE_NONE, 1,
		  META_TYPE_WINDOW_ACTOR);

  /**
   * CinnamonWM::keybinding:
   * @cinnamonwm: the #CinnamonWM
   * @binding: the keybinding name
   * @mask: the modifier mask used
   * @window: for window keybindings, the #MetaWindow
   * @backwards: for "reversible" keybindings, whether or not
   * the backwards (Shifted) variant was invoked
   *
   * Emitted when a keybinding captured via
   * cinnamon_wm_takeover_keybinding() is invoked. The keybinding name
   * (which has underscores, not hyphens) is also included as the
   * detail of the signal name, so you can connect just specific
   * keybindings.
   */
  cinnamon_wm_signals[KEYBINDING] =
    g_signal_new ("keybinding",
		  G_TYPE_FROM_CLASS (klass),
		  G_SIGNAL_RUN_LAST | G_SIGNAL_DETAILED,
		  0,
		  NULL, NULL,
		  _cinnamon_marshal_VOID__STRING_UINT_OBJECT_BOOLEAN,
		  G_TYPE_NONE, 4,
                  G_TYPE_STRING,
                  G_TYPE_UINT,
                  META_TYPE_WINDOW,
                  G_TYPE_BOOLEAN);
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
}

/**
 * cinnamon_wm_completed_minimize
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
 * cinnamon_wm_completed_maximize
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
 * cinnamon_wm_completed_unmaximize
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
 * cinnamon_wm_completed_map
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
 * cinnamon_wm_completed_destroy
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
_cinnamon_wm_kill_switch_workspace (CinnamonWM      *wm)
{
  g_signal_emit (wm, cinnamon_wm_signals[KILL_SWITCH_WORKSPACE], 0);
}

void
_cinnamon_wm_kill_window_effects (CinnamonWM         *wm,
                               MetaWindowActor *actor)
{
  g_signal_emit (wm, cinnamon_wm_signals[KILL_WINDOW_EFFECTS], 0, actor);
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

static void
cinnamon_wm_key_handler (MetaDisplay    *display,
                      MetaScreen     *screen,
                      MetaWindow     *window,
                      XEvent         *event,
                      MetaKeyBinding *binding,
                      gpointer        data)
{
  CinnamonWM *wm = data;
  gboolean backwards = (event->xkey.state & ShiftMask);

  g_signal_emit (wm, cinnamon_wm_signals[KEYBINDING],
                 g_quark_from_string (binding->name),
                 binding->name, binding->mask, window, backwards);
}

/**
 * cinnamon_wm_takeover_keybinding:
 * @wm: the #CinnamonWM
 * @binding_name: a meta keybinding name
 *
 * Tells muffin to forward keypresses for @binding_name to Cinnamon
 * rather than processing them internally. This will cause a
 * #CinnamonWM::keybinding signal to be emitted when that key is pressed.
 */
void
cinnamon_wm_takeover_keybinding (CinnamonWM      *wm,
                              const char   *binding_name)
{
  meta_keybindings_set_custom_handler (binding_name,
                                       cinnamon_wm_key_handler,
                                       wm, NULL);
}
