/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_GLOBAL_PRIVATE_H__
#define __CINNAMON_GLOBAL_PRIVATE_H__

#include <errno.h>
#include <math.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>

#include "cinnamon-global.h"
#include <gio/gio.h>
#include <girepository.h>
#include <meta/meta-plugin.h>


#include "cinnamon-enum-types.h"
#include "cinnamon-global-private.h"
#include "cinnamon-perf-log.h"
#include "cinnamon-window-tracker.h"
#include "cinnamon-wm.h"
#include "st.h"

#include <cjs/gjs.h>

struct _CinnamonGlobal {
  GObject parent;

  ClutterStage *stage;
  GdkWindow *stage_gdk_window;

  MetaDisplay *meta_display;
  MetaWorkspaceManager *workspace_manager;
  GdkDisplay *gdk_display;
  Display *xdisplay;
  CinnamonScreen *cinnamon_screen;
  GdkScreen *gdk_screen;

  /* We use this window to get a notification from GTK+ when
   * a widget in our process does a GTK+ grab.  See
   * http://bugzilla.gnome.org/show_bug.cgi?id=570641
   *
   * This window is never mapped or shown.
   */
  GtkWindow *grab_notifier;
  gboolean gtk_grab_active;

  CinnamonStageInputMode input_mode;
  XserverRegion input_region;

  GjsContext *js_context;
  MetaPlugin *plugin;
  CinnamonWM *wm;
  GSettings *settings;
  GSettings *interface_settings;
  const char *datadir;
  const char *imagedir;
  const char *userdatadir;
  StFocusManager *focus_manager;

  guint work_count;
  GSList *leisure_closures;
  guint leisure_function_id;

  gint64 last_gc_end_time;
  guint ui_scale;
  gboolean session_running;
  gboolean has_modal;
};

void _cinnamon_global_init            (const char *first_property_name,
                                    ...);
void _cinnamon_global_set_plugin      (CinnamonGlobal  *global,
                                    MetaPlugin   *plugin);

GjsContext *_cinnamon_global_get_gjs_context (CinnamonGlobal  *global);

#endif /* __CINNAMON_GLOBAL_PRIVATE_H__ */
