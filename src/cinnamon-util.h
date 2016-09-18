/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#ifndef __CINNAMON_UTIL_H__
#define __CINNAMON_UTIL_H__

#include <gio/gio.h>
#include <clutter/clutter.h>
#include <libsoup/soup.h>

G_BEGIN_DECLS

char    *cinnamon_util_get_label_for_uri          (const char       *text_uri);
GIcon   *cinnamon_util_get_icon_for_uri           (const char       *text_uri);

void     cinnamon_util_set_hidden_from_pick       (ClutterActor     *actor,
                                                gboolean          hidden);

void     cinnamon_util_get_transformed_allocation (ClutterActor     *actor,
                                                ClutterActorBox  *box);

int      cinnamon_util_get_week_start             (void);

char    *cinnamon_util_normalize_and_casefold     (const char       *str);

char    *cinnamon_util_format_date                (const char       *format,
                                                gint64            time_ms);

ClutterModifierType
         cinnamon_get_event_state                 (ClutterEvent     *event);

void     cinnamon_write_soup_message_to_stream    (GOutputStream    *stream,
                                                SoupMessage      *message,
                                                GError          **error);

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

G_END_DECLS

#endif /* __CINNAMON_UTIL_H__ */
