/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_GLOBAL_H__
#define __CINNAMON_GLOBAL_H__

#include <clutter/clutter.h>
#include <glib-object.h>
#include <gdk-pixbuf/gdk-pixbuf.h>
#include <gtk/gtk.h>
#include <meta/meta-plugin.h>

G_BEGIN_DECLS

typedef struct _CinnamonGlobal      CinnamonGlobal;
typedef struct _CinnamonGlobalClass CinnamonGlobalClass;

#define CINNAMON_TYPE_GLOBAL              (cinnamon_global_get_type ())
#define CINNAMON_GLOBAL(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_GLOBAL, CinnamonGlobal))
#define CINNAMON_GLOBAL_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_GLOBAL, CinnamonGlobalClass))
#define CINNAMON_IS_GLOBAL(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_GLOBAL))
#define CINNAMON_IS_GLOBAL_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_GLOBAL))
#define CINNAMON_GLOBAL_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_GLOBAL, CinnamonGlobalClass))

struct _CinnamonGlobalClass
{
  GObjectClass parent_class;
};

GType cinnamon_global_get_type (void) G_GNUC_CONST;

CinnamonGlobal   *cinnamon_global_get                       (void);

ClutterStage  *cinnamon_global_get_stage                 (CinnamonGlobal *global);
MetaScreen    *cinnamon_global_get_screen                (CinnamonGlobal *global);
GdkScreen     *cinnamon_global_get_gdk_screen            (CinnamonGlobal *global);
MetaDisplay   *cinnamon_global_get_display               (CinnamonGlobal *global);
GList         *cinnamon_global_get_window_actors         (CinnamonGlobal *global);
GSettings     *cinnamon_global_get_settings              (CinnamonGlobal *global);
guint32        cinnamon_global_get_current_time          (CinnamonGlobal *global);
pid_t          cinnamon_global_get_pid                   (CinnamonGlobal *global);
gchar         *cinnamon_global_get_md5_for_string        (CinnamonGlobal *global, const gchar *string);
void           cinnamon_global_dump_gjs_stack            (CinnamonGlobal *global);

/* Input/event handling */
gboolean cinnamon_global_begin_modal            (CinnamonGlobal         *global,
                                              guint32              timestamp,
                                              MetaModalOptions    options);
void     cinnamon_global_end_modal              (CinnamonGlobal         *global,
                                              guint32              timestamp);

typedef enum {
  CINNAMON_STAGE_INPUT_MODE_NONREACTIVE,
  CINNAMON_STAGE_INPUT_MODE_NORMAL,
  CINNAMON_STAGE_INPUT_MODE_FOCUSED,
  CINNAMON_STAGE_INPUT_MODE_FULLSCREEN
} CinnamonStageInputMode;

void     cinnamon_global_set_stage_input_mode   (CinnamonGlobal         *global,
                                              CinnamonStageInputMode  mode);
void     cinnamon_global_set_stage_input_region (CinnamonGlobal         *global,
                                              GSList              *rectangles);

/* X utilities */
typedef enum {
  CINNAMON_CURSOR_DND_IN_DRAG,
  CINNAMON_CURSOR_DND_UNSUPPORTED_TARGET,
  CINNAMON_CURSOR_DND_MOVE,
  CINNAMON_CURSOR_DND_COPY,
  CINNAMON_CURSOR_POINTING_HAND,
  CINNAMON_CURSOR_RESIZE_BOTTOM,
  CINNAMON_CURSOR_RESIZE_TOP,
  CINNAMON_CURSOR_RESIZE_LEFT,
  CINNAMON_CURSOR_RESIZE_RIGHT,
  CINNAMON_CURSOR_RESIZE_BOTTOM_RIGHT,
  CINNAMON_CURSOR_RESIZE_BOTTOM_LEFT,
  CINNAMON_CURSOR_RESIZE_TOP_RIGHT,
  CINNAMON_CURSOR_RESIZE_TOP_LEFT,
  CINNAMON_CURSOR_CROSSHAIR,
  CINNAMON_CURSOR_TEXT
} CinnamonCursor;

void    cinnamon_global_set_cursor              (CinnamonGlobal         *global,
                                              CinnamonCursor          type);
void    cinnamon_global_unset_cursor            (CinnamonGlobal         *global);

guint32 cinnamon_global_create_pointer_barrier  (CinnamonGlobal         *global,
                                              int                  x1,
                                              int                  y1,
                                              int                  x2,
                                              int                  y2,
                                              int                  directions);
void    cinnamon_global_destroy_pointer_barrier (CinnamonGlobal         *global,
                                              guint32              barrier);

void    cinnamon_global_get_pointer             (CinnamonGlobal         *global,
                                              int                 *x,
                                              int                 *y,
                                              ClutterModifierType *mods);
void    cinnamon_global_set_pointer             (CinnamonGlobal         *global,
                                              int                 x,
                                              int                 y);

/* Run-at-leisure API */
void cinnamon_global_begin_work     (CinnamonGlobal          *global);
void cinnamon_global_end_work       (CinnamonGlobal          *global);

typedef void (*CinnamonLeisureFunction) (gpointer data);

void cinnamon_global_run_at_leisure (CinnamonGlobal          *global,
                                  CinnamonLeisureFunction  func,
                                  gpointer              user_data,
                                  GDestroyNotify        notify);


/* Misc utilities / Cinnamon API */

void     cinnamon_global_sync_pointer              (CinnamonGlobal  *global);

GAppLaunchContext *
         cinnamon_global_create_app_launch_context (CinnamonGlobal  *global);

void     cinnamon_global_notify_error              (CinnamonGlobal  *global,
                                                 const char   *msg,
                                                 const char   *details);

void     cinnamon_global_init_xdnd                 (CinnamonGlobal  *global);

void     cinnamon_global_shutdown                  (void);
void     cinnamon_global_reexec_self               (CinnamonGlobal  *global);

void     cinnamon_global_segfault                  (CinnamonGlobal  *global);

G_END_DECLS

#endif /* __CINNAMON_GLOBAL_H__ */
