/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_GLOBAL_H__
#define __SHELL_GLOBAL_H__

#include <clutter/clutter.h>
#include <glib-object.h>
#include <gdk-pixbuf/gdk-pixbuf.h>
#include <gtk/gtk.h>
#include <meta/meta-plugin.h>

G_BEGIN_DECLS

typedef struct _ShellGlobal      ShellGlobal;
typedef struct _ShellGlobalClass ShellGlobalClass;

#define SHELL_TYPE_GLOBAL              (shell_global_get_type ())
#define SHELL_GLOBAL(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_GLOBAL, ShellGlobal))
#define SHELL_GLOBAL_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_GLOBAL, ShellGlobalClass))
#define SHELL_IS_GLOBAL(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_GLOBAL))
#define SHELL_IS_GLOBAL_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_GLOBAL))
#define SHELL_GLOBAL_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_GLOBAL, ShellGlobalClass))

struct _ShellGlobalClass
{
  GObjectClass parent_class;
};

GType shell_global_get_type (void) G_GNUC_CONST;

ShellGlobal   *shell_global_get                       (void);

MetaScreen    *shell_global_get_screen                (ShellGlobal *global);
GdkScreen     *shell_global_get_gdk_screen            (ShellGlobal *global);
MetaDisplay   *shell_global_get_display               (ShellGlobal *global);
GList         *shell_global_get_window_actors         (ShellGlobal *global);
GSettings     *shell_global_get_settings              (ShellGlobal *global);
guint32        shell_global_get_current_time          (ShellGlobal *global);


/* Input/event handling */
gboolean shell_global_begin_modal            (ShellGlobal         *global,
                                              guint32              timestamp);
void     shell_global_end_modal              (ShellGlobal         *global,
                                              guint32              timestamp);

typedef enum {
  SHELL_STAGE_INPUT_MODE_NONREACTIVE,
  SHELL_STAGE_INPUT_MODE_NORMAL,
  SHELL_STAGE_INPUT_MODE_FOCUSED,
  SHELL_STAGE_INPUT_MODE_FULLSCREEN
} ShellStageInputMode;

void     shell_global_set_stage_input_mode   (ShellGlobal         *global,
                                              ShellStageInputMode  mode);
void     shell_global_set_stage_input_region (ShellGlobal         *global,
                                              GSList              *rectangles);

/* X utilities */
typedef enum {
  SHELL_CURSOR_DND_IN_DRAG,
  SHELL_CURSOR_DND_UNSUPPORTED_TARGET,
  SHELL_CURSOR_DND_MOVE,
  SHELL_CURSOR_DND_COPY,
  SHELL_CURSOR_POINTING_HAND
} ShellCursor;

void    shell_global_set_cursor              (ShellGlobal         *global,
                                              ShellCursor          type);
void    shell_global_unset_cursor            (ShellGlobal         *global);

guint32 shell_global_create_pointer_barrier  (ShellGlobal         *global,
                                              int                  x1,
                                              int                  y1,
                                              int                  x2,
                                              int                  y2,
                                              int                  directions);
void    shell_global_destroy_pointer_barrier (ShellGlobal         *global,
                                              guint32              barrier);

void    shell_global_get_pointer             (ShellGlobal         *global,
                                              int                 *x,
                                              int                 *y,
                                              ClutterModifierType *mods);


/* JavaScript utilities */
void     shell_global_gc                   (ShellGlobal *global);
void     shell_global_maybe_gc             (ShellGlobal *global);

typedef struct {
  guint glibc_uordblks;

  guint js_bytes;

  guint gjs_boxed;
  guint gjs_gobject;
  guint gjs_function;
  guint gjs_closure;

  /* 32 bit to avoid js conversion problems with 64 bit */
  guint  last_gc_seconds_ago;
} ShellMemoryInfo;

void     shell_global_get_memory_info      (ShellGlobal     *global,
                                            ShellMemoryInfo *meminfo);


/* Run-at-leisure API */
void shell_global_begin_work     (ShellGlobal          *global);
void shell_global_end_work       (ShellGlobal          *global);

typedef void (*ShellLeisureFunction) (gpointer data);

void shell_global_run_at_leisure (ShellGlobal          *global,
                                  ShellLeisureFunction  func,
                                  gpointer              user_data,
                                  GDestroyNotify        notify);


/* Misc utilities / Shell API */
gboolean shell_global_add_extension_importer    (ShellGlobal  *global,
                                                 const char   *target_object_script,
                                                 const char   *target_property,
                                                 const char   *directory,
                                                 GError      **error);

void     shell_global_sync_pointer              (ShellGlobal  *global);

GAppLaunchContext *
         shell_global_create_app_launch_context (ShellGlobal  *global);

void     shell_global_play_theme_sound          (ShellGlobal  *global,
                                                 guint         id,
                                                 const char   *name);
void     shell_global_cancel_theme_sound        (ShellGlobal  *global,
                                                 guint         id);

void     shell_global_notify_error              (ShellGlobal  *global,
                                                 const char   *msg,
                                                 const char   *details);

void     shell_global_init_xdnd                 (ShellGlobal  *global);

void     shell_global_reexec_self               (ShellGlobal  *global);

void     shell_global_launch_calendar_server    (ShellGlobal  *global);

typedef void (*ShellGlobalScreenshotCallback)  (ShellGlobal *global, gboolean success);

void    shell_global_screenshot_area           (ShellGlobal  *global,
                                                int x,
                                                int y,
                                                int width,
                                                int height,
                                                const char *filename,
                                                ShellGlobalScreenshotCallback callback);

gboolean shell_global_screenshot_window         (ShellGlobal  *global,
                                                gboolean include_frame,
                                                const char *filename);

void    shell_global_screenshot                (ShellGlobal  *global,
                                                const char *filename,
                                                ShellGlobalScreenshotCallback callback);
typedef enum {
  SHELL_SESSION_USER,
  SHELL_SESSION_GDM
} ShellSessionType;

ShellSessionType shell_global_get_session_type  (ShellGlobal  *global);

G_END_DECLS

#endif /* __SHELL_GLOBAL_H__ */
