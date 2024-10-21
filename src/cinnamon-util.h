/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#ifndef __CINNAMON_UTIL_H__
#define __CINNAMON_UTIL_H__

#include <gio/gio.h>
#include <clutter/clutter.h>
#include <meta/meta-window-actor.h>

G_BEGIN_DECLS

char    *cinnamon_util_get_label_for_uri          (const char       *text_uri);
GIcon   *cinnamon_util_get_icon_for_uri           (const char       *text_uri);

void     cinnamon_util_set_hidden_from_pick       (ClutterActor     *actor,
                                                gboolean          hidden);

void     cinnamon_util_get_transformed_allocation (ClutterActor     *actor,
                                                ClutterActorBox  *box);

int      cinnamon_util_get_week_start             (void);

char    *cinnamon_util_format_date                (const char       *format,
                                                gint64            time_ms);

ClutterModifierType
         cinnamon_get_event_state                 (ClutterEvent     *event);

gboolean cinnamon_write_string_to_stream          (GOutputStream    *stream,
                                                const char       *str,
                                                GError          **error);

char    *cinnamon_get_file_contents_utf8_sync     (const char       *path,
                                                GError          **error);
/**
 * CinnamonFileContentsCallback:
 * @utf8_contents: The contents of the file
 * @user_data: (closure): Data passed to cinnamon_get_file_contents_utf8()
 *
 * Callback type for cinnamon_get_file_contents_utf8()
 *
 * Since: 3.1
 */
typedef void (* CinnamonFileContentsCallback) (const gchar *utf8_contents,
                                               gpointer     user_data);

void     cinnamon_get_file_contents_utf8         (const char                   *path,
                                                  CinnamonFileContentsCallback  callback,
                                                  gpointer                      user_data);

ClutterContent * cinnamon_util_get_content_for_window_actor (MetaWindowActor *window_actor,
                                                             MetaRectangle   *window_rect);

cairo_surface_t * cinnamon_util_composite_capture_images (ClutterCapture  *captures,
                                                          int              n_captures,
                                                          int              x,
                                                          int              y,
                                                          int              target_width,
                                                          int              target_height,
                                                          float            target_scale);

void     cinnamon_breakpoint                      (void);

gboolean cinnamon_parse_search_provider           (const char       *data,
                                                char            **name,
                                                char            **url,
                                                GList           **langs,
                                                char            **icon_data_uri,
                                                GError          **error);

void cinnamon_shader_effect_set_double_uniform (ClutterShaderEffect *effect,
                                             const gchar         *name,
                                             gdouble             value);

gboolean cinnamon_util_wifexited (int               status,
                                  int              *exit);

G_END_DECLS

#endif /* __CINNAMON_UTIL_H__ */
