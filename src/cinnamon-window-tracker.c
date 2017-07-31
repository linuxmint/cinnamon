/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <string.h>
#include <stdlib.h>

#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <gdk/gdk.h>
#include <gdk/gdkx.h>
#include <meta/display.h>
#include <meta/group.h>
#include <meta/util.h>
#include <meta/window.h>

#define SN_API_NOT_YET_FROZEN 1
#include <libsn/sn.h>

#include "cinnamon-window-tracker-private.h"
#include "cinnamon-app-private.h"
#include "cinnamon-global.h"
#include "st.h"

/* This file includes modified code from
 * desktop-data-engine/engine-dbus/hippo-application-monitor.c
 * in the functions collecting application usage data.
 * Written by Owen Taylor, originally licensed under LGPL 2.1.
 * Copyright Red Hat, Inc. 2006-2008
 */

/**
 * SECTION:cinnamon-window-tracker
 * @short_description: Associate windows with applications
 *
 * Maintains a mapping from windows to applications (.desktop file ids).
 * It currently implements this with some heuristics on the WM_CLASS X11
 * property (and some static override regexps); in the future, we want to
 * have it also track through startup-notification.
 */

struct _CinnamonWindowTracker
{
  GObject parent;

  CinnamonApp *focus_app;

  /* <MetaWindow * window, CinnamonApp *app> */
  GHashTable *window_to_app;

  /* <int, CinnamonApp *app> */
  GHashTable *launched_pid_to_app;
};

G_DEFINE_TYPE (CinnamonWindowTracker, cinnamon_window_tracker, G_TYPE_OBJECT);

enum {
  PROP_0,
  PROP_FOCUS_APP
};

enum {
  STARTUP_SEQUENCE_CHANGED,
  TRACKED_WINDOWS_CHANGED,

  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0 };

static void cinnamon_window_tracker_finalize (GObject *object);
static void set_focus_app (CinnamonWindowTracker  *tracker,
                           CinnamonApp            *new_focus_app);
static void on_focus_window_changed (MetaDisplay *display, GParamSpec *spec, CinnamonWindowTracker *tracker);

static void track_window (CinnamonWindowTracker *tracker, MetaWindow *window);
static void disassociate_window (CinnamonWindowTracker *tracker, MetaWindow *window);


static void
cinnamon_window_tracker_get_property (GObject    *gobject,
                            guint       prop_id,
                            GValue     *value,
                            GParamSpec *pspec)
{
  CinnamonWindowTracker *tracker = CINNAMON_WINDOW_TRACKER (gobject);

  switch (prop_id)
    {
    case PROP_FOCUS_APP:
      g_value_set_object (value, tracker->focus_app);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
cinnamon_window_tracker_class_init (CinnamonWindowTrackerClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->get_property = cinnamon_window_tracker_get_property;
  gobject_class->finalize = cinnamon_window_tracker_finalize;

  g_object_class_install_property (gobject_class,
                                   PROP_FOCUS_APP,
                                   g_param_spec_object ("focus-app",
                                                        "Focus App",
                                                        "Focused application",
                                                        CINNAMON_TYPE_APP,
                                                        G_PARAM_READABLE));

  signals[STARTUP_SEQUENCE_CHANGED] = g_signal_new ("startup-sequence-changed",
                                   CINNAMON_TYPE_WINDOW_TRACKER,
                                   G_SIGNAL_RUN_LAST,
                                   0,
                                   NULL, NULL, NULL,
                                   G_TYPE_NONE, 1, CINNAMON_TYPE_STARTUP_SEQUENCE);
  signals[TRACKED_WINDOWS_CHANGED] = g_signal_new ("tracked-windows-changed",
                                                   CINNAMON_TYPE_WINDOW_TRACKER,
                                                   G_SIGNAL_RUN_LAST,
                                                   0,
                                                   NULL, NULL, NULL,
                                                   G_TYPE_NONE, 0);
}

/**
 * cinnamon_window_tracker_is_window_interesting:
 * @tracker: the CinnamonWindowTracker
 * @window: a #MetaWindow
 *
 * The CinnamonWindowTracker associates certain kinds of windows with
 * applications; however, others we don't want to
 * appear in places where we want to give a list of windows
 * for an application, such as the alt-tab dialog.
 *
 * An example of a window we don't want to show is the root
 * desktop window.  We skip all override-redirect types, and also
 * exclude other window types like tooltip explicitly, though generally
 * most of these should be override-redirect.
 *
 * Returns: %TRUE if a window is "interesting"
 */
gboolean
cinnamon_window_tracker_is_window_interesting (CinnamonWindowTracker *tracker, MetaWindow *window)
{
  if (meta_window_is_override_redirect (window)
      || meta_window_is_skip_taskbar (window))
    return FALSE;

  switch (meta_window_get_window_type (window))
    {
      /* Definitely ignore these. */
      case META_WINDOW_DESKTOP:
      case META_WINDOW_DOCK:
      case META_WINDOW_SPLASHSCREEN:
      /* Should have already been handled by override_redirect above,
       * but explicitly list here so we get the "unhandled enum"
       * warning if in the future anything is added.*/
      case META_WINDOW_DROPDOWN_MENU:
      case META_WINDOW_POPUP_MENU:
      case META_WINDOW_TOOLTIP:
      case META_WINDOW_NOTIFICATION:
      case META_WINDOW_COMBO:
      case META_WINDOW_DND:
      case META_WINDOW_OVERRIDE_OTHER:
        return FALSE;
      case META_WINDOW_NORMAL:
      case META_WINDOW_DIALOG:
      case META_WINDOW_MODAL_DIALOG:
      case META_WINDOW_MENU:
      case META_WINDOW_TOOLBAR:
      case META_WINDOW_UTILITY:
        break;
      default:
        g_warning("cinnamon_window_tracker_is_window_interesting: default reached");
      break;
    }

  return TRUE;
}

/**
 * get_app_from_window_wmclass:
 *
 * Looks only at the given window, and attempts to determine
 * an application based on WM_CLASS.  If one can't be determined,
 * return %NULL.
 *
 * Return value: (transfer full): A newly-referenced #CinnamonApp, or %NULL
 */
static CinnamonApp *
get_app_from_window_wmclass (MetaWindow  *window)
{
  CinnamonApp *app;
  CinnamonAppSystem *appsys;
  const char *wm_class;
  const char *wm_instance;

  appsys = cinnamon_app_system_get_default ();

  /* Notes on the heuristics used here:
     much of the complexity here comes from the desire to support
     Chrome apps.

     From https://bugzilla.gnome.org/show_bug.cgi?id=673657#c13

     Currently chrome sets WM_CLASS as follows (the first string is the 'instance',
     the second one is the 'class':

     For the normal browser:
     WM_CLASS(STRING) = "chromium", "Chromium"

     For a bookmarked page (through 'Tools -> Create application shortcuts')
     WM_CLASS(STRING) = "wiki.gnome.org__GnomeShell_ApplicationBased", "Chromium"

     For an application from the chrome store (with a .desktop file created through
     right click, "Create shortcuts" from Chrome's apps overview)
     WM_CLASS(STRING) = "crx_blpcfgokakmgnkcojhhkbfbldkacnbeo", "Chromium"

     The .desktop file has a matching StartupWMClass, but the name differs, e.g. for
     the store app (youtube) there is

     .local/share/applications/chrome-blpcfgokakmgnkcojhhkbfbldkacnbeo-Default.desktop

     with

     StartupWMClass=crx_blpcfgokakmgnkcojhhkbfbldkacnbeo

     Note that chromium (but not google-chrome!) includes a StartupWMClass=chromium
     in their .desktop file, so we must match the instance first.

     Also note that in the good case (regular gtk+ app without hacks), instance and
     class are the same except for case and there is no StartupWMClass at all.
  */

  /* first try a match from WM_CLASS (instance part) to StartupWMClass */
  wm_instance = meta_window_get_wm_class_instance (window);
  app = cinnamon_app_system_lookup_startup_wmclass (appsys, wm_instance);
  if (app != NULL)
    return g_object_ref (app);

  /* then try a match from WM_CLASS to StartupWMClass */
  wm_class = meta_window_get_wm_class (window);
  app = cinnamon_app_system_lookup_startup_wmclass (appsys, wm_class);
  if (app != NULL)
    return g_object_ref (app);

  /* then try a match from WM_CLASS (instance part) to .desktop */
  app = cinnamon_app_system_lookup_desktop_wmclass (appsys, wm_instance);
  if (app != NULL)
    return g_object_ref (app);

  /* finally, try a match from WM_CLASS to .desktop */
  app = cinnamon_app_system_lookup_desktop_wmclass (appsys, wm_class);
  if (app != NULL)
    return g_object_ref (app);

  return NULL;
}

/**
 * get_app_from_gapplication_id:
 * @monitor: a #CinnamonWindowTracker
 * @window: a #MetaWindow
 *
 * Looks only at the given window, and attempts to determine
 * an application based on _GTK_APPLICATION_ID.  If one can't be determined,
 * return %NULL.
 *
 * Return value: (transfer full): A newly-referenced #CinnamonApp, or %NULL
 */
static CinnamonApp *
get_app_from_gapplication_id (MetaWindow  *window)
{
  CinnamonApp *app;
  CinnamonAppSystem *appsys;
  const char *id;
  char *desktop_file;

  appsys = cinnamon_app_system_get_default ();

  id = meta_window_get_gtk_application_id (window);
  if (!id)
    return NULL;

  desktop_file = g_strconcat (id, ".desktop", NULL);
  app = cinnamon_app_system_lookup_app (appsys, desktop_file);
  if (app)
    g_object_ref (app);

  g_free (desktop_file);
  return app;
}

/**
 * get_app_from_window_group:
 * @monitor: a #CinnamonWindowTracker
 * @window: a #MetaWindow
 *
 * Check other windows in the group for @window to see if we have
 * an application for one of them.
 *
 * Return value: (transfer full): A newly-referenced #CinnamonApp, or %NULL
 */
static CinnamonApp*
get_app_from_window_group (CinnamonWindowTracker  *tracker,
                           MetaWindow          *window)
{
  CinnamonApp *result;
  GSList *group_windows;
  MetaGroup *group;
  GSList *iter;

  group = meta_window_get_group (window);
  if (group == NULL)
    return NULL;

  group_windows = meta_group_list_windows (group);

  result = NULL;
  /* Try finding a window in the group of type NORMAL; if we
   * succeed, use that as our source. */
  for (iter = group_windows; iter; iter = iter->next)
    {
      MetaWindow *group_window = iter->data;

      if (meta_window_get_window_type (group_window) != META_WINDOW_NORMAL)
        continue;

      result = g_hash_table_lookup (tracker->window_to_app, group_window);
      if (result)
        break;
    }

  g_slist_free (group_windows);

  if (result)
    g_object_ref (result);

  return result;
}

/**
 * get_app_from_window_pid:
 * @tracker: a #CinnamonWindowTracker
 * @window: a #MetaWindow
 *
 * Check if the pid associated with @window corresponds to an
 * application we launched.
 *
 * Return value: (transfer full): A newly-referenced #CinnamonApp, or %NULL
 */
static CinnamonApp *
get_app_from_window_pid (CinnamonWindowTracker  *tracker,
                         MetaWindow          *window)
{
  CinnamonApp *result;
  int pid;

  if (meta_window_is_remote (window))
    return NULL;

  pid = meta_window_get_pid (window);

  if (pid == -1)
    return NULL;

  result = g_hash_table_lookup (tracker->launched_pid_to_app, GINT_TO_POINTER (pid));
  if (result != NULL)
    g_object_ref (result);

  return result;
}

/**
 * get_app_for_window:
 *
 * Determines the application associated with a window, using
 * all available information such as the window's MetaGroup,
 * and what we know about other windows.
 *
 * Returns: (transfer full): a #CinnamonApp, or NULL if none is found
 */
static CinnamonApp *
get_app_for_window (CinnamonWindowTracker    *tracker,
                    MetaWindow            *window)
{
  CinnamonApp *result = NULL;
  const char *startup_id;

  /* First, we check whether we already know about this window,
   * if so, just return that.
   */
  if (meta_window_get_window_type (window) == META_WINDOW_NORMAL
      || meta_window_is_remote (window))
    {
      result = g_hash_table_lookup (tracker->window_to_app, window);
      if (result != NULL)
        {
          g_object_ref (result);
          return result;
        }
    }

  if (meta_window_is_remote (window))
    return _cinnamon_app_new_for_window (window);

  /* Check if the window has a GApplication ID attached; this is
   * canonical if it does
   */
  result = get_app_from_gapplication_id (window);
  if (result != NULL)
    return result;

  /* Check if the app's WM_CLASS specifies an app; this is
   * canonical if it does.
   */
  result = get_app_from_window_wmclass (window);
  if (result != NULL)
    return result;

  result = get_app_from_window_pid (tracker, window);
  if (result != NULL)
    return result;

  /* Now we check whether we have a match through startup-notification */
  startup_id = meta_window_get_startup_id (window);
  if (startup_id)
    {
      GSList *iter, *sequences;

      sequences = cinnamon_window_tracker_get_startup_sequences (tracker);
      for (iter = sequences; iter; iter = iter->next)
        {
          CinnamonStartupSequence *sequence = iter->data;
          const char *id = cinnamon_startup_sequence_get_id (sequence);
          if (strcmp (id, startup_id) != 0)
            continue;

          result = cinnamon_startup_sequence_get_app (sequence);
          if (result)
            {
              result = g_object_ref (result);
              break;
            }
        }
    }

  /* If we didn't get a startup-notification match, see if we matched
   * any other windows in the group.
   */
  if (result == NULL)
    result = get_app_from_window_group (tracker, window);

  /* Our last resort - we create a fake app from the window */
  if (result == NULL)
    result = _cinnamon_app_new_for_window (window);

  return result;
}

const char *
_cinnamon_window_tracker_get_app_context (CinnamonWindowTracker *tracker, CinnamonApp *app)
{
  return "";
}

static void
update_focus_app (CinnamonWindowTracker *self)
{
  MetaWindow *new_focus_win;
  CinnamonApp *new_focus_app;

  new_focus_win = meta_display_get_focus_window (cinnamon_global_get_display (cinnamon_global_get ()));
  new_focus_app = new_focus_win ? cinnamon_window_tracker_get_window_app (self, new_focus_win) : NULL;

  set_focus_app (self, new_focus_app);
  g_clear_object (&new_focus_app);
}

static void
tracked_window_changed (CinnamonWindowTracker *self,
                        MetaWindow         *window)
{
  /* It's simplest to just treat this as a remove + add. */
  disassociate_window (self, window);
  track_window (self, window);
  /* also just recalculate the focused app, in case it was the focused
     window that changed */
  update_focus_app (self);
}

static void
on_wm_class_changed (MetaWindow  *window,
                     GParamSpec  *pspec,
                     gpointer     user_data)
{
  CinnamonWindowTracker *self = CINNAMON_WINDOW_TRACKER (user_data);
  tracked_window_changed (self, window);
}

static void
on_gtk_application_id_changed (MetaWindow  *window,
                               GParamSpec  *pspec,
                               gpointer     user_data)
{
  CinnamonWindowTracker *self = CINNAMON_WINDOW_TRACKER (user_data);
  tracked_window_changed (self, window);
}

static void
track_window (CinnamonWindowTracker *self,
              MetaWindow      *window)
{
  CinnamonApp *app;

  if (!cinnamon_window_tracker_is_window_interesting (self, window))
    return;

  app = get_app_for_window (self, window);
  if (!app)
    return;

  /* At this point we've stored the association from window -> application */
  g_hash_table_insert (self->window_to_app, window, app);

  g_signal_connect (window, "notify::wm-class", G_CALLBACK (on_wm_class_changed), self);
  g_signal_connect (window, "notify::gtk-application-id", G_CALLBACK (on_gtk_application_id_changed), self);

  _cinnamon_app_add_window (app, window);

  g_signal_emit (self, signals[TRACKED_WINDOWS_CHANGED], 0);
}

static void
cinnamon_window_tracker_on_window_added (MetaWorkspace   *workspace,
                                   MetaWindow      *window,
                                   gpointer         user_data)
{
  CinnamonWindowTracker *self = CINNAMON_WINDOW_TRACKER (user_data);

  track_window (self, window);
}

static void
disassociate_window (CinnamonWindowTracker   *self,
                     MetaWindow        *window)
{
  CinnamonApp *app;

  app = g_hash_table_lookup (self->window_to_app, window);
  if (!app)
    return;

  g_object_ref (app);

  g_hash_table_remove (self->window_to_app, window);

  if (cinnamon_window_tracker_is_window_interesting (self, window))
    {
      _cinnamon_app_remove_window (app, window);
      g_signal_handlers_disconnect_by_func (window, G_CALLBACK(on_wm_class_changed), self);
      g_signal_handlers_disconnect_by_func (window, G_CALLBACK (on_gtk_application_id_changed), self);
    }

  g_signal_emit (self, signals[TRACKED_WINDOWS_CHANGED], 0);

  g_object_unref (app);
}

static void
cinnamon_window_tracker_on_window_removed (MetaWorkspace   *workspace,
                                     MetaWindow      *window,
                                     gpointer         user_data)
{
  disassociate_window (CINNAMON_WINDOW_TRACKER (user_data), window);
}

static void
load_initial_windows (CinnamonWindowTracker *tracker)
{
  GList *workspaces, *iter;
  MetaScreen *screen = cinnamon_global_get_screen (cinnamon_global_get ());
  workspaces = meta_screen_get_workspaces (screen);

  for (iter = workspaces; iter; iter = iter->next)
    {
      MetaWorkspace *workspace = iter->data;
      GList *windows = meta_workspace_list_windows (workspace);
      GList *window_iter;

      for (window_iter = windows; window_iter; window_iter = window_iter->next)
        {
          MetaWindow *window = window_iter->data;
          track_window (tracker, window);
        }

      g_list_free (windows);
    }
}

static void
cinnamon_window_tracker_on_n_workspaces_changed (MetaScreen    *screen,
                                           GParamSpec    *pspec,
                                           gpointer       user_data)
{
  CinnamonWindowTracker *self = CINNAMON_WINDOW_TRACKER (user_data);
  GList *workspaces, *iter;

  workspaces = meta_screen_get_workspaces (screen);

  for (iter = workspaces; iter; iter = iter->next)
    {
      MetaWorkspace *workspace = iter->data;

      /* This pair of disconnect/connect is idempotent if we were
       * already connected, while ensuring we get connected for
       * new workspaces.
       */
      g_signal_handlers_disconnect_by_func (workspace,
                                            cinnamon_window_tracker_on_window_added,
                                            self);
      g_signal_handlers_disconnect_by_func (workspace,
                                            cinnamon_window_tracker_on_window_removed,
                                            self);

      g_signal_connect (workspace, "window-added",
                        G_CALLBACK (cinnamon_window_tracker_on_window_added), self);
      g_signal_connect (workspace, "window-removed",
                        G_CALLBACK (cinnamon_window_tracker_on_window_removed), self);
    }
}

static void
init_window_tracking (CinnamonWindowTracker *self)
{
  MetaDisplay *display;
  MetaScreen *screen = cinnamon_global_get_screen (cinnamon_global_get ());

  g_signal_connect (screen, "notify::n-workspaces",
                    G_CALLBACK (cinnamon_window_tracker_on_n_workspaces_changed), self);
  display = meta_screen_get_display (screen);
  g_signal_connect (display, "notify::focus-window",
                    G_CALLBACK (on_focus_window_changed), self);

  cinnamon_window_tracker_on_n_workspaces_changed (screen, NULL, self);
}

static void
on_startup_sequence_changed (MetaScreen            *screen,
                             SnStartupSequence     *sequence,
                             CinnamonWindowTracker    *self)
{
  CinnamonApp *app;

  app = cinnamon_startup_sequence_get_app ((CinnamonStartupSequence*)sequence);
  if (app)
    _cinnamon_app_handle_startup_sequence (app, sequence);

  g_signal_emit (G_OBJECT (self), signals[STARTUP_SEQUENCE_CHANGED], 0, sequence);
}

static void
cinnamon_window_tracker_init (CinnamonWindowTracker *self)
{
  MetaScreen *screen;

  self->window_to_app = g_hash_table_new_full (g_direct_hash, g_direct_equal,
                                               NULL, (GDestroyNotify) g_object_unref);

  self->launched_pid_to_app = g_hash_table_new_full (NULL, NULL, NULL, (GDestroyNotify) g_object_unref);

  screen = cinnamon_global_get_screen (cinnamon_global_get ());

  g_signal_connect (G_OBJECT (screen), "startup-sequence-changed",
                    G_CALLBACK (on_startup_sequence_changed), self);

  load_initial_windows (self);
  init_window_tracking (self);
}

static void
cinnamon_window_tracker_finalize (GObject *object)
{
  CinnamonWindowTracker *self = CINNAMON_WINDOW_TRACKER (object);

  g_hash_table_destroy (self->window_to_app);
  g_hash_table_destroy (self->launched_pid_to_app);

  G_OBJECT_CLASS (cinnamon_window_tracker_parent_class)->finalize(object);
}

/**
 * cinnamon_window_tracker_get_window_app:
 * @tracker: An app monitor instance
 * @metawin: A #MetaWindow
 *
 * Returns: (transfer full): Application associated with window
 */
CinnamonApp *
cinnamon_window_tracker_get_window_app (CinnamonWindowTracker *tracker,
                                     MetaWindow         *metawin)
{
  MetaWindow *transient_for;
  CinnamonApp *app;

  transient_for = meta_window_get_transient_for (metawin);
  if (transient_for != NULL)
    metawin = transient_for;

  app = g_hash_table_lookup (tracker->window_to_app, metawin);
  if (app)
    g_object_ref (app);

  return app;
}


/**
 * cinnamon_window_tracker_get_app_from_pid:
 * @self; A #CinnamonAppSystem
 * @pid: A Unix process identifier
 *
 * Look up the application corresponding to a process.
 *
 * Returns: (transfer none): A #CinnamonApp, or %NULL if none
 */
CinnamonApp *
cinnamon_window_tracker_get_app_from_pid (CinnamonWindowTracker *self, 
                                       int                 pid)
{
  GSList *running = cinnamon_app_system_get_running (cinnamon_app_system_get_default());
  GSList *iter;
  CinnamonApp *result = NULL;

  for (iter = running; iter; iter = iter->next)
    {
      CinnamonApp *app = iter->data;
      GSList *pids = cinnamon_app_get_pids (app);
      GSList *pids_iter;

      for (pids_iter = pids; pids_iter; pids_iter = pids_iter->next)
        {
          int app_pid = GPOINTER_TO_INT (pids_iter->data);
          if (app_pid == pid)
            {
              result = app;
              break;
            }
        }
      g_slist_free (pids);

      if (result != NULL)
        break;
    }

  g_slist_free (running);

  return result;
}

static void
on_child_exited (GPid      pid,
                 gint      status,
                 gpointer  unused_data)
{
  CinnamonWindowTracker *tracker;

  tracker = cinnamon_window_tracker_get_default ();

  g_hash_table_remove (tracker->launched_pid_to_app, GINT_TO_POINTER((gint)pid));
}

void
_cinnamon_window_tracker_add_child_process_app (CinnamonWindowTracker *tracker,
                                             GPid                pid,
                                             CinnamonApp           *app)
{
  gpointer pid_ptr = GINT_TO_POINTER((int)pid);

  if (g_hash_table_lookup (tracker->launched_pid_to_app,
                           &pid_ptr))
    return;

  g_hash_table_insert (tracker->launched_pid_to_app,
                       pid_ptr,
                       g_object_ref (app));
  g_child_watch_add (pid, on_child_exited, NULL);
  /* TODO: rescan unassociated windows
   * Unlikely in practice that the launched app gets ahead of us
   * enough to map an X window before we get scheduled after the fork(),
   * but adding this note for future reference.
   */
}

static void
set_focus_app (CinnamonWindowTracker  *tracker,
               CinnamonApp            *new_focus_app)
{
  if (new_focus_app == tracker->focus_app)
    return;

  if (tracker->focus_app != NULL)
    g_object_unref (tracker->focus_app);

  tracker->focus_app = new_focus_app;

  if (tracker->focus_app != NULL)
    g_object_ref (tracker->focus_app);

  g_object_notify (G_OBJECT (tracker), "focus-app");
}

static void
on_focus_window_changed (MetaDisplay        *display,
                         GParamSpec         *spec,
                         CinnamonWindowTracker *tracker)
{
  update_focus_app (tracker);
}

/**
 * cinnamon_window_tracker_get_startup_sequences:
 * @tracker:
 *
 * Returns: (transfer none) (element-type CinnamonStartupSequence): Currently active startup sequences
 */
GSList *
cinnamon_window_tracker_get_startup_sequences (CinnamonWindowTracker *self)
{
  CinnamonGlobal *global = cinnamon_global_get ();
  MetaScreen *screen = cinnamon_global_get_screen (global);
  return meta_screen_get_startup_sequences (screen);
}

/* sn_startup_sequence_ref returns void, so make a
 * wrapper which returns self */
static SnStartupSequence *
sequence_ref (SnStartupSequence *sequence)
{
  sn_startup_sequence_ref (sequence);
  return sequence;
}

GType
cinnamon_startup_sequence_get_type (void)
{
  static GType gtype = G_TYPE_INVALID;
  if (gtype == G_TYPE_INVALID)
    {
      gtype = g_boxed_type_register_static ("CinnamonStartupSequence",
          (GBoxedCopyFunc)sequence_ref,
          (GBoxedFreeFunc)sn_startup_sequence_unref);
    }
  return gtype;
}

const char *
cinnamon_startup_sequence_get_id (CinnamonStartupSequence *sequence)
{
  return sn_startup_sequence_get_id ((SnStartupSequence*)sequence);
}

/**
 * cinnamon_startup_sequence_get_app:
 * @sequence: A #CinnamonStartupSequence
 *
 * Returns: (transfer none): The application being launched, or %NULL if unknown.
 */
CinnamonApp *
cinnamon_startup_sequence_get_app (CinnamonStartupSequence *sequence)
{
  const char *appid;
  CinnamonAppSystem *appsys;
  CinnamonApp *app;

  appid = sn_startup_sequence_get_application_id ((SnStartupSequence*)sequence);
  if (!appid)
    return NULL;

  appsys = cinnamon_app_system_get_default ();
  app = cinnamon_app_system_lookup_app_for_path (appsys, appid);
  return app;
}

const char *
cinnamon_startup_sequence_get_name (CinnamonStartupSequence *sequence)
{
  return sn_startup_sequence_get_name ((SnStartupSequence*)sequence);
}

gboolean
cinnamon_startup_sequence_get_completed (CinnamonStartupSequence *sequence)
{
  return sn_startup_sequence_get_completed ((SnStartupSequence*)sequence);
}

/**
 * cinnamon_startup_sequence_create_icon:
 * @sequence:
 * @size: Size in pixels of icon
 *
 * Returns: (transfer none): A new #ClutterTexture containing an icon for the sequence
 */
ClutterActor *
cinnamon_startup_sequence_create_icon (CinnamonStartupSequence *sequence, guint size)
{
  GIcon *themed;
  const char *icon_name;
  ClutterActor *texture;

  icon_name = sn_startup_sequence_get_icon_name ((SnStartupSequence*)sequence);
  if (!icon_name)
    {
      gint scale;
      CinnamonGlobal *global;
      StThemeContext *context;

      texture = clutter_texture_new ();

      global = cinnamon_global_get ();
      context = st_theme_context_get_for_stage (cinnamon_global_get_stage (global));
      g_object_get (context, "scale-factor", &scale, NULL);

      clutter_actor_set_size (texture, size * scale, size * scale);
      return texture;
    }

  themed = g_themed_icon_new (icon_name);
  texture = g_object_new (ST_TYPE_ICON, "gicon", themed, "icon-size", size, NULL);
  g_object_unref (G_OBJECT (themed));
  return texture;
}


/**
 * cinnamon_window_tracker_get_default:
 *
 * Return Value: (transfer none): The global #CinnamonWindowTracker instance
 */
CinnamonWindowTracker *
cinnamon_window_tracker_get_default (void)
{
  static CinnamonWindowTracker *instance;

  if (instance == NULL)
    instance = g_object_new (CINNAMON_TYPE_WINDOW_TRACKER, NULL);

  return instance;
}
