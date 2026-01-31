/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

/*
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

/*
 * This is a shim class to help compatibility with older (pre-5.2)
 * js code. MetaScreen no longer exists (global.screen), and its api
 * is distributed in MetaDisplay, MetaWorkspaceManager and elsewhere.
 * We should use new api when possible, especially in core cinnamon js.
 */

#include <config.h>
#include "cinnamon-screen.h"
#include <meta/meta-backend.h>
#include <meta/meta-enum-types.h>
#include <meta/meta-cursor-tracker.h>
#include <meta/compositor-muffin.h>
#include <meta/meta-monitor-manager.h>
#include <meta/window.h>

#include <locale.h>
#include <string.h>
#include <stdio.h>

enum
{
  PROP_N_WORKSPACES = 1,
  PROP_DISPLAY,
};

enum
{
  RESTACKED,
  WORKSPACE_ADDED,
  WORKSPACE_REMOVED,
  WORKSPACE_SWITCHED,
  WINDOW_ENTERED_MONITOR,
  WINDOW_LEFT_MONITOR,
  WORKAREAS_CHANGED,
  MONITORS_CHANGED,
  WINDOW_ADDED,
  WINDOW_REMOVED,
  WINDOW_MONITOR_CHANGED,
  WINDOW_WORKSPACE_CHANGED,
  WINDOW_SKIP_TASKBAR_CHANGED,
  IN_FULLSCREEN_CHANGED,

  LAST_SIGNAL
};

static guint screen_signals[LAST_SIGNAL] = { 0 };

struct _CinnamonScreen
{
    GObject parent_instance;

    MetaDisplay *display;
    MetaWorkspaceManager *ws_manager;
    MetaMonitorManager *monitor_manager;
};

G_DEFINE_TYPE (CinnamonScreen, cinnamon_screen, G_TYPE_OBJECT);

static void
cinnamon_screen_set_property (GObject      *object,
                          guint         prop_id,
                          const GValue *value,
                          GParamSpec   *pspec)
{
  CinnamonScreen *screen = CINNAMON_SCREEN (object);

  switch (prop_id)
    {
      case PROP_DISPLAY:
        screen->display = g_value_get_object (value);
        break;
      default:
        G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
        break;
    }
}

static void
cinnamon_screen_get_property (GObject      *object,
                          guint         prop_id,
                          GValue       *value,
                          GParamSpec   *pspec)
{
  CinnamonScreen *screen = CINNAMON_SCREEN (object);

  switch (prop_id)
    {
    case PROP_N_WORKSPACES:
      g_warning_once ("global.screen.n_workspaces is deprecated. Use global.workspace_manager.n_workspaces instead.");
      g_value_set_int (value, meta_workspace_manager_get_n_workspaces (screen->ws_manager));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
on_restacked (MetaDisplay    *display,
              CinnamonScreen *screen)
{
  g_debug ("screen: restacked");
  g_signal_emit (screen, screen_signals[RESTACKED], 0);
}

static void
on_workspace_added (MetaWorkspaceManager *ws_manager,
                    gint                  index,
                    CinnamonScreen       *screen)
{
  g_debug ("screen: workspace added");
  g_signal_emit (screen, screen_signals[WORKSPACE_ADDED], 0, index);
  g_object_notify (G_OBJECT (screen), "n-workspaces");
}

static void
on_workspace_removed (MetaWorkspaceManager *ws_manager,
                      gint                  index,
                      CinnamonScreen       *screen)
{
  g_debug ("screen: workspace removed");
  g_signal_emit (screen, screen_signals[WORKSPACE_REMOVED], 0, index);
  g_object_notify (G_OBJECT (screen), "n-workspaces");
}

static void
on_workspace_switched (MetaWorkspaceManager *ws_manager,
                       gint                  from,
                       gint                  to,
                       MetaMotionDirection   direction,
                       CinnamonScreen       *screen)
{
  g_debug ("screen: workspace switched");
  g_signal_emit (screen, screen_signals[WORKSPACE_SWITCHED], 0, from, to, direction);
}

static void
on_window_entered_monitor (MetaDisplay    *display,
                           gint            new_monitor,
                           MetaWindow     *window,
                           CinnamonScreen *screen)
{
  g_debug ("screen: window entered monitor");
  g_signal_emit (screen, screen_signals[WINDOW_ENTERED_MONITOR], 0, new_monitor, window);
  g_signal_emit (screen, screen_signals[WINDOW_MONITOR_CHANGED], 0, window, new_monitor);
}

static void
on_window_left_monitor (MetaDisplay    *display,
                        gint            old_monitor,
                        MetaWindow     *window,
                        CinnamonScreen *screen)
{
  g_debug ("screen: window left monitor");
  g_signal_emit (screen, screen_signals[WINDOW_LEFT_MONITOR], 0, old_monitor, window);
  g_signal_emit (screen, screen_signals[WINDOW_MONITOR_CHANGED], 0, window, old_monitor);
}

static void
on_workareas_changed (MetaDisplay    *display,
                      CinnamonScreen *screen)
{
  g_debug ("screen: workarea changed");
  g_signal_emit (screen, screen_signals[WORKAREAS_CHANGED], 0);
}

static void
on_window_unmanaged (MetaWindow     *window,
                     CinnamonScreen *screen)
{
  g_debug ("screen: window removed");
  g_signal_emit (screen, screen_signals[WINDOW_REMOVED], 0, window);
}

static void
on_window_workspace_changed (MetaWindow     *window,
                             CinnamonScreen *screen)
{
  g_debug ("screen: window workspace changed");
  g_signal_emit (screen, screen_signals[WINDOW_WORKSPACE_CHANGED], 0,
                 window, meta_window_get_workspace (window));
}

static void
on_window_skip_taskbar_changed (MetaWindow     *window,
                                GParamSpec     *pspec,
                                CinnamonScreen *screen)
{
  g_debug ("screen: window skip-taskbar prop changed");
  g_signal_emit (screen, screen_signals[WINDOW_SKIP_TASKBAR_CHANGED], 0,
                 window);
}

static void
on_window_created (MetaDisplay    *display,
                   MetaWindow     *window,
                   CinnamonScreen *screen)
{
  g_debug ("screen: window added");
  g_signal_connect_after (window, "unmanaged", G_CALLBACK (on_window_unmanaged), screen);
  g_signal_connect_after (window, "workspace-changed", G_CALLBACK (on_window_workspace_changed), screen);
  g_signal_connect_after (window, "notify::skip-taskbar", G_CALLBACK (on_window_skip_taskbar_changed), screen);
  g_signal_emit (screen, screen_signals[WINDOW_ADDED], 0, window, meta_window_get_monitor (window));
}

static void
on_monitors_changed (MetaMonitorManager *display,
                     CinnamonScreen     *screen)
{
  g_debug ("screen: monitors changed");
  g_signal_emit (screen, screen_signals[MONITORS_CHANGED], 0);
}

static void
on_fullscreen_changed (MetaMonitorManager *display,
                       CinnamonScreen     *screen)
{
  g_debug ("screen: fullscreen changed");
  g_signal_emit (screen, screen_signals[IN_FULLSCREEN_CHANGED], 0);
}

static void
cinnamon_screen_constructed (GObject *object)
{
  G_OBJECT_CLASS (cinnamon_screen_parent_class)->constructed (object);
  CinnamonScreen *screen = CINNAMON_SCREEN (object);

  screen->ws_manager = meta_display_get_workspace_manager (screen->display);
  screen->monitor_manager = meta_monitor_manager_get ();

  g_signal_connect (screen->display, "restacked", G_CALLBACK (on_restacked), screen);
  g_signal_connect (screen->ws_manager, "workspace-added", G_CALLBACK (on_workspace_added), screen);
  g_signal_connect (screen->ws_manager, "workspace-removed", G_CALLBACK (on_workspace_removed), screen);
  g_signal_connect (screen->ws_manager, "workspace-switched", G_CALLBACK (on_workspace_switched), screen);
  g_signal_connect (screen->display, "window-entered-monitor", G_CALLBACK (on_window_entered_monitor), screen);
  g_signal_connect (screen->display, "window-left-monitor", G_CALLBACK (on_window_left_monitor), screen);
  g_signal_connect (screen->display, "workareas-changed", G_CALLBACK (on_workareas_changed), screen);
  g_signal_connect (screen->display, "window-created", G_CALLBACK (on_window_created), screen);
  g_signal_connect (screen->monitor_manager, "monitors-changed", G_CALLBACK (on_monitors_changed), screen);
  g_signal_connect (screen->display, "in-fullscreen-changed", G_CALLBACK (on_fullscreen_changed), screen);
}

static void
cinnamon_screen_finalize (GObject *object)
{
  /* Actual freeing done in cinnamon_screen_free() for now */

  G_OBJECT_CLASS (cinnamon_screen_parent_class)->finalize (object);
}

static void
cinnamon_screen_class_init (CinnamonScreenClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GParamSpec   *pspec;

  object_class->get_property = cinnamon_screen_get_property;
  object_class->set_property = cinnamon_screen_set_property;
  object_class->constructed = cinnamon_screen_constructed;
  object_class->finalize = cinnamon_screen_finalize;

  screen_signals[RESTACKED] =
    g_signal_new ("restacked",
                  G_TYPE_FROM_CLASS (object_class),
                  G_SIGNAL_RUN_LAST,
                  0, NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  screen_signals[WORKSPACE_ADDED] =
    g_signal_new ("workspace-added",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE,
                  1,
                  G_TYPE_INT);

  screen_signals[WORKSPACE_REMOVED] =
    g_signal_new ("workspace-removed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE,
                  1,
                  G_TYPE_INT);

  screen_signals[WORKSPACE_SWITCHED] =
    g_signal_new ("workspace-switched",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE,
                  3,
                  G_TYPE_INT,
                  G_TYPE_INT,
                  META_TYPE_MOTION_DIRECTION);

  screen_signals[WINDOW_ENTERED_MONITOR] =
    g_signal_new ("window-entered-monitor",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 2,
                  G_TYPE_INT,
                  META_TYPE_WINDOW);

  screen_signals[WINDOW_LEFT_MONITOR] =
    g_signal_new ("window-left-monitor",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 2,
                  G_TYPE_INT,
                  META_TYPE_WINDOW);

  screen_signals[WORKAREAS_CHANGED] =
    g_signal_new ("workareas-changed",
                  G_TYPE_FROM_CLASS (object_class),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  screen_signals[MONITORS_CHANGED] =
    g_signal_new ("monitors-changed",
          G_TYPE_FROM_CLASS (object_class),
          G_SIGNAL_RUN_LAST,
          0,
          NULL, NULL, NULL,
          G_TYPE_NONE, 0);

  screen_signals[WINDOW_ADDED] =
    g_signal_new ("window-added",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 2,
                  META_TYPE_WINDOW,
                  G_TYPE_INT);

  screen_signals[WINDOW_REMOVED] =
    g_signal_new ("window-removed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW);

  screen_signals[WINDOW_MONITOR_CHANGED] =
    g_signal_new ("window-monitor-changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 2,
                  META_TYPE_WINDOW,
                  G_TYPE_INT);

  screen_signals[WINDOW_WORKSPACE_CHANGED] =
    g_signal_new ("window-workspace-changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 2,
                  META_TYPE_WINDOW,
                  META_TYPE_WORKSPACE);

  screen_signals[WINDOW_SKIP_TASKBAR_CHANGED] =
    g_signal_new ("window-skip-taskbar-changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  META_TYPE_WINDOW);

  screen_signals[IN_FULLSCREEN_CHANGED] =
    g_signal_new ("in-fullscreen-changed",
                  G_TYPE_FROM_CLASS (object_class),
                  G_SIGNAL_RUN_LAST,
                  0,
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  pspec = g_param_spec_int ("n-workspaces",
                            "N Workspaces",
                            "Number of workspaces",
                            1, G_MAXINT, 1,
                            G_PARAM_READABLE);

  g_object_class_install_property (object_class,
                                   PROP_N_WORKSPACES,
                                   pspec);

  g_object_class_install_property (object_class,
                                   PROP_DISPLAY,
                                   g_param_spec_object ("display",
                                                        "Display",
                                                        "Metacity display object for the shell",
                                                        META_TYPE_DISPLAY,
                                                        G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY));
}

static void
cinnamon_screen_init (CinnamonScreen *screen)
{
}

CinnamonScreen *
cinnamon_screen_new (MetaDisplay *display)
{
    return g_object_new (CINNAMON_TYPE_SCREEN, "display", display, NULL);
}

/**
 * cinnamon_screen_get_n_workspaces:
 * @screen: a #CinnamonScreen
 *
 * Returns: the number of workspaces
 *
 * Deprecated: 6.4: Use meta_workspace_manager_get_n_workspaces() via global.workspace_manager instead.
 */
int
cinnamon_screen_get_n_workspaces (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), 1);
  g_warning_once ("global.screen.get_n_workspaces() is deprecated. Use global.workspace_manager.get_n_workspaces() instead.");

  return meta_workspace_manager_get_n_workspaces (screen->ws_manager);
}

/**
 * cinnamon_screen_get_workspace_by_index:
 * @screen: a #CinnamonScreen
 * @index: index of one of the screen's workspaces
 *
 * Gets the workspace object for one of a screen's workspaces given the workspace
 * index. It's valid to call this function with an out-of-range index and it
 * will robustly return %NULL.
 *
 * Return value: (transfer none): the workspace object with specified index, or %NULL
 *   if the index is out of range.
 *
 * Deprecated: 6.4: Use meta_workspace_manager_get_workspace_by_index() via global.workspace_manager instead.
 */
MetaWorkspace*
cinnamon_screen_get_workspace_by_index (CinnamonScreen  *screen,
                                        int              idx)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), NULL);
  g_warning_once ("global.screen.get_workspace_by_index() is deprecated. Use global.workspace_manager.get_workspace_by_index() instead.");

  return meta_workspace_manager_get_workspace_by_index (screen->ws_manager, idx);
}

/**
 * cinnamon_screen_remove_workspace:
 * @screen: a #CinnamonScreen
 * @workspace: the workspace to remove
 * @timestamp: the timestamp for the operation
 *
 * Deprecated: 6.4: Use meta_workspace_manager_remove_workspace() via global.workspace_manager instead.
 */
void
cinnamon_screen_remove_workspace (CinnamonScreen *screen,
                                  MetaWorkspace  *workspace,
                                  guint32         timestamp)
{
  g_return_if_fail (CINNAMON_IS_SCREEN (screen));
  g_warning_once ("global.screen.remove_workspace() is deprecated. Use global.workspace_manager.remove_workspace() instead.");

  meta_workspace_manager_remove_workspace (screen->ws_manager, workspace, timestamp);
}

/**
 * cinnamon_screen_append_new_workspace:
 * @screen: a #CinnamonScreen
 * @activate: %TRUE if the workspace should be switched to after creation
 * @timestamp: if switching to a new workspace, timestamp to be used when
 *   focusing a window on the new workspace. (Doesn't hurt to pass a valid
 *   timestamp when available even if not switching workspaces.)
 *
 * Append a new workspace to the screen and (optionally) switch to that
 * screen.
 *
 * Return value: (transfer none): the newly appended workspace.
 *
 * Deprecated: 6.4: Use meta_workspace_manager_append_new_workspace() via global.workspace_manager instead.
 */
MetaWorkspace *
cinnamon_screen_append_new_workspace (CinnamonScreen *screen,
                                      gboolean        activate,
                                      guint32         timestamp)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), NULL);
  g_warning_once ("global.screen.append_new_workspace() is deprecated. Use global.workspace_manager.append_new_workspace() instead.");

  return meta_workspace_manager_append_new_workspace (screen->ws_manager, activate, timestamp);
}

/**
 * cinnamon_screen_get_mouse_window:
 * @screen: a cinnamon-screen.
 * @not_this_one: (allow-none): window to be excluded
 *
 * Gets the #MetaWindow pointed by the mouse
 *
 * Return value: (transfer none): the #MetaWindow pointed by the mouse
 *  %NULL when window not found
 *
 * Deprecated: 6.4: Use Main.layoutManager.getWindowAtPointer() instead.
 */
MetaWindow*
cinnamon_screen_get_mouse_window (CinnamonScreen  *screen,
                                  MetaWindow      *not_this_one)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), NULL);
  g_warning_once ("global.screen.get_mouse_window() is deprecated. Use Main.layoutManager.getWindowAtPointer() instead.");

  MetaCursorTracker *cursor_tracker = meta_cursor_tracker_get_for_display (screen->display);
  GList *actors, *l;
  graphene_point_t coords;
  int mx, my;

  if (not_this_one)
    g_debug ("Focusing mouse window excluding %s", meta_window_get_description (not_this_one));

  meta_cursor_tracker_get_pointer (cursor_tracker, &coords, NULL);
  mx = (int) coords.x;
  my = (int) coords.y;

  /* Bottom to top */
  actors = meta_get_window_actors (screen->display);

  for (l = g_list_last (actors); l != NULL; l=l->prev)
    {
      ClutterActor *actor = CLUTTER_ACTOR (l->data);
      MetaWindow *mw = meta_window_actor_get_meta_window (META_WINDOW_ACTOR (actor));

      if (mw == not_this_one)
        {
          continue;
        }

      gfloat x, y, w, h;
      g_object_get (actor,
                    "x", &x,
                    "y", &y,
                    "width", &w,
                    "height", &h,
                    NULL);

      if (mx > (gint) x && mx < (gint) (x + w) && my > (gint) y && my < (gint) (y + h))
      {
        return mw;
      }
    }

  return NULL;;
}

/**
 * cinnamon_screen_get_monitor_index_for_rect:
 * @screen: a #CinnamonScreen
 * @rect: the rectangle
 *
 * Returns: the monitor index for the rectangle
 *
 * Deprecated: 6.4: Use meta_display_get_monitor_index_for_rect() via global.display instead.
 */
int
cinnamon_screen_get_monitor_index_for_rect (CinnamonScreen    *screen,
                                            MetaRectangle *rect)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), 0);
  g_warning_once ("global.screen.get_monitor_index_for_rect() is deprecated. Use global.display.get_monitor_index_for_rect() instead.");

  return meta_display_get_monitor_index_for_rect (screen->display, rect);
}

/**
 * cinnamon_screen_get_current_monitor:
 * @screen: a #CinnamonScreen
 *
 * Gets the index of the monitor that currently has the mouse pointer.
 *
 * Return value: a monitor index
 *
 * Deprecated: 6.4: Use meta_display_get_current_monitor() via global.display instead.
 */
int
cinnamon_screen_get_current_monitor (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), 0);
  g_warning_once ("global.screen.get_current_monitor() is deprecated. Use global.display.get_current_monitor() instead.");

  return meta_display_get_current_monitor (screen->display);
}

/**
 * cinnamon_screen_get_n_monitors:
 * @screen: a #CinnamonScreen
 *
 * Gets the number of monitors that are joined together to form @screen.
 *
 * Return value: the number of monitors
 *
 * Deprecated: 6.4: Use meta_display_get_n_monitors() via global.display instead.
 */
int
cinnamon_screen_get_n_monitors (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), 1);
  g_warning_once ("global.screen.get_n_monitors() is deprecated. Use global.display.get_n_monitors() instead.");

  return meta_display_get_n_monitors (screen->display);
}

/**
 * cinnamon_screen_get_primary_monitor:
 * @screen: a #CinnamonScreen
 *
 * Gets the index of the primary monitor on this @screen.
 *
 * Return value: a monitor index
 *
 * Deprecated: 6.4: Use meta_display_get_primary_monitor() via global.display instead.
 */
int
cinnamon_screen_get_primary_monitor (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), 0);
  g_warning_once ("global.screen.get_primary_monitor() is deprecated. Use global.display.get_primary_monitor() instead.");

  return meta_display_get_primary_monitor (screen->display);
}

/**
 * cinnamon_screen_get_monitor_geometry:
 * @screen: a #CinnamonScreen
 * @monitor: the monitor number
 * @geometry: (out): location to store the monitor geometry
 *
 * Stores the location and size of the indicated monitor in @geometry.
 *
 * Deprecated: 6.4: Use meta_display_get_monitor_geometry() via global.display instead.
 */
void
cinnamon_screen_get_monitor_geometry (CinnamonScreen    *screen,
                                      int                monitor,
                                      MetaRectangle     *geometry)
{
  g_return_if_fail (CINNAMON_IS_SCREEN (screen));
  g_return_if_fail (monitor >= 0 && monitor < meta_display_get_n_monitors (screen->display));
  g_return_if_fail (geometry != NULL);
  g_warning_once ("global.screen.get_monitor_geometry() is deprecated. Use global.display.get_monitor_geometry() instead.");

  meta_display_get_monitor_geometry (screen->display, monitor, geometry);
}

/**
 * cinnamon_screen_override_workspace_layout:
 * @screen: a #CinnamonScreen
 * @starting_corner: the corner at which the first workspace is found
 * @vertical_layout: if %TRUE the workspaces are laid out in columns rather than rows
 * @n_rows: number of rows of workspaces, or -1 to determine the number of rows from
 *   @n_columns and the total number of workspaces
 * @n_columns: number of columns of workspaces, or -1 to determine the number of columns from
 *   @n_rows and the total number of workspaces
 *
 * Explicitly set the layout of workspaces. Once this has been called, the contents of the
 * _NET_DESKTOP_LAYOUT property on the root window are completely ignored.
 *
 * Deprecated: 6.4: Use meta_workspace_manager_override_workspace_layout() via global.workspace_manager instead.
 */
void
cinnamon_screen_override_workspace_layout (CinnamonScreen      *screen,
                                           MetaDisplayCorner    starting_corner,
                                           gboolean             vertical_layout,
                                           int                  n_rows,
                                           int                  n_columns)
{
  g_return_if_fail (CINNAMON_IS_SCREEN (screen));
  g_return_if_fail (n_rows > 0 || n_columns > 0);
  g_return_if_fail (n_rows != 0 && n_columns != 0);
  g_warning_once ("global.screen.override_workspace_layout() is deprecated. Use global.workspace_manager.override_workspace_layout() instead.");

  meta_workspace_manager_override_workspace_layout (screen->ws_manager,
                                                    starting_corner,
                                                    vertical_layout,
                                                    n_rows,
                                                    n_columns);
}

/**
 * cinnamon_screen_toggle_desktop:
 * @screen: a #CinnamonScreen
 * @timestamp: the timestamp for the operation
 *
 * Deprecated: 6.4: Use meta_workspace_manager_toggle_desktop() via global.workspace_manager instead.
 */
void
cinnamon_screen_toggle_desktop (CinnamonScreen *screen,
                                guint32         timestamp)
{
  g_warning_once ("global.screen.toggle_desktop() is deprecated. Use global.workspace_manager.toggle_desktop() instead.");
  meta_workspace_manager_toggle_desktop (screen->ws_manager,
                                         timestamp);
}

/**
 * cinnamon_screen_show_desktop:
 * @screen: a #CinnamonScreen
 * @timestamp: the timestamp for the operation
 *
 * Deprecated: 6.4: Use meta_workspace_manager_show_desktop() via global.workspace_manager instead.
 */
void
cinnamon_screen_show_desktop (CinnamonScreen *screen,
                              guint32         timestamp)
{
  g_warning_once ("global.screen.show_desktop() is deprecated. Use global.workspace_manager.show_desktop() instead.");
  meta_workspace_manager_show_desktop (screen->ws_manager,
                                       timestamp);
}

/**
 * cinnamon_screen_unshow_desktop:
 * @screen: a #CinnamonScreen
 *
 * Deprecated: 6.4: Use meta_workspace_manager_unshow_desktop() via global.workspace_manager instead.
 */
void
cinnamon_screen_unshow_desktop (CinnamonScreen *screen)
{
  g_warning_once ("global.screen.unshow_desktop() is deprecated. Use global.workspace_manager.unshow_desktop() instead.");
  meta_workspace_manager_unshow_desktop (screen->ws_manager);
}

/**
 * cinnamon_screen_get_display:
 * @screen: A #CinnamonScreen
 *
 * Retrieve the display associated with screen.
 *
 * Returns: (transfer none): Display
 *
 * Deprecated: 6.4: Use global.display directly instead.
 */
MetaDisplay *
cinnamon_screen_get_display (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), NULL);
  g_warning_once ("global.screen.get_display() is deprecated. Use global.display directly instead.");

  return screen->display;
}

/**
 * cinnamon_screen_get_size:
 * @screen: A #CinnamonScreen
 * @width: (out): The width of the screen
 * @height: (out): The height of the screen
 *
 * Retrieve the size of the screen.
 *
 * Deprecated: 6.4: Use meta_display_get_size() via global.display instead.
 */
void
cinnamon_screen_get_size (CinnamonScreen *screen,
                      int        *width,
                      int        *height)
{
  g_return_if_fail (CINNAMON_IS_SCREEN (screen));
  g_warning_once ("global.screen.get_size() is deprecated. Use global.display.get_size() instead.");

  meta_display_get_size (screen->display, width, height);
  g_debug ("screen - size: %dx%d", *width, *height);
}

/**
 * cinnamon_screen_get_workspaces: (skip)
 * @screen: a #CinnamonScreen
 *
 * Returns: (transfer none) (element-type Meta.Workspace): The workspaces for @screen
 *
 * Deprecated: 6.4: Use meta_workspace_manager_get_workspaces() via global.workspace_manager instead.
 */
GList *
cinnamon_screen_get_workspaces (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), NULL);
  g_warning_once ("global.screen.get_workspaces() is deprecated. Use global.workspace_manager.get_workspaces() instead.");

  return meta_workspace_manager_get_workspaces (screen->ws_manager);
}

/**
 * cinnamon_screen_get_active_workspace_index:
 * @screen: a #CinnamonScreen
 *
 * Returns: the index of the active workspace
 *
 * Deprecated: 6.4: Use meta_workspace_manager_get_active_workspace_index() via global.workspace_manager instead.
 */
int
cinnamon_screen_get_active_workspace_index (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), 0);
  g_warning_once ("global.screen.get_active_workspace_index() is deprecated. Use global.workspace_manager.get_active_workspace_index() instead.");

  return meta_workspace_manager_get_active_workspace_index (screen->ws_manager);
}

/**
 * cinnamon_screen_get_active_workspace:
 * @screen: a #CinnamonScreen
 *
 * Returns: (transfer none): The current workspace
 *
 * Deprecated: 6.4: Use meta_workspace_manager_get_active_workspace() via global.workspace_manager instead.
 */
MetaWorkspace *
cinnamon_screen_get_active_workspace (CinnamonScreen *screen)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), NULL);
  g_warning_once ("global.screen.get_active_workspace() is deprecated. Use global.workspace_manager.get_active_workspace() instead.");

  return meta_workspace_manager_get_active_workspace (screen->ws_manager);
}

/**
 * cinnamon_screen_get_monitor_in_fullscreen:
 * @screen: a #CinnamonScreen
 * @monitor: the monitor number
 *
 * Determines whether there is a fullscreen window obscuring the specified
 * monitor. If there is a fullscreen window, the desktop environment will
 * typically hide any controls that might obscure the fullscreen window.
 *
 * You can get notification when this changes by connecting to
 * CinnamonScreen::in-fullscreen-changed.
 *
 * Returns: %TRUE if there is a fullscreen window covering the specified monitor.
 *
 * Deprecated: 6.4: Use meta_display_get_monitor_in_fullscreen() via global.display instead.
 */
gboolean
cinnamon_screen_get_monitor_in_fullscreen (CinnamonScreen  *screen,
                                       int          monitor)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), FALSE);
  g_return_val_if_fail (monitor >= 0 &&
                          monitor < meta_display_get_n_monitors (screen->display), FALSE);
  g_warning_once ("global.screen.get_monitor_in_fullscreen() is deprecated. Use global.display.get_monitor_in_fullscreen() instead.");

  return meta_display_get_monitor_in_fullscreen (screen->display, monitor);
}

/**
 * cinnamon_screen_get_xwindow_for_window:
 * @screen: a #CinnamonScreen
 * @window: the #MetaWindow
 *
 * Returns: the X window ID for the window
 *
 * Deprecated: 6.4: Use meta_window_get_xwindow() on the MetaWindow directly instead.
 */
unsigned long
cinnamon_screen_get_xwindow_for_window (CinnamonScreen *screen,
                                        MetaWindow     *window)
{
  g_return_val_if_fail (CINNAMON_IS_SCREEN (screen), 0);
  g_return_val_if_fail (META_IS_WINDOW (window), 0);
  g_warning_once ("global.screen.get_xwindow_for_window() is deprecated. Use metaWindow.get_xwindow() directly instead.");

  return meta_window_get_xwindow (window);
}
