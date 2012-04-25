/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_XFIXES_CURSOR_H__
#define __CINNAMON_XFIXES_CURSOR_H__

#include <clutter/clutter.h>
#include <gdk-pixbuf/gdk-pixbuf.h>

G_BEGIN_DECLS

typedef struct _CinnamonXFixesCursor        CinnamonXFixesCursor;
typedef struct _CinnamonXFixesCursorClass   CinnamonXFixesCursorClass;

#define CINNAMON_TYPE_XFIXES_CURSOR             (cinnamon_xfixes_cursor_get_type ())
#define CINNAMON_XFIXES_CURSOR(object)          (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_XFIXES_CURSOR, CinnamonXFixesCursor))
#define CINNAMON_XFIXES_CURSOR_CLASS(klass)     (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_XFIXES_CURSOR, CinnamonXFixesCursorClass))
#define CINNAMON_IS_XFIXES_CURSOR(object)       (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_XFIXES_CURSOR))
#define CINNAMON_IS_XFIXES_CURSOR_CLASS(klass)  (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_XFIXES_CURSOR))
#define CINNAMON_XFIXES_CURSOR_GET_CLASS(obj)   (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_XFIXES_CURSOR, CinnamonXFixesCursorClass))

GType               cinnamon_xfixes_cursor_get_type     (void) G_GNUC_CONST;

CinnamonXFixesCursor   *cinnamon_xfixes_cursor_get_for_stage (ClutterStage *stage);

void                cinnamon_xfixes_cursor_show (CinnamonXFixesCursor *xfixes_cursor);
void                cinnamon_xfixes_cursor_hide (CinnamonXFixesCursor *xfixes_cursor);
int                 cinnamon_xfixes_cursor_get_hot_x (CinnamonXFixesCursor *xfixes_cursor);
int                 cinnamon_xfixes_cursor_get_hot_y (CinnamonXFixesCursor *xfixes_cursor);
void                cinnamon_xfixes_cursor_update_texture_image (CinnamonXFixesCursor *xfixes_cursor,
                                                              ClutterTexture *texture);

G_END_DECLS

#endif /* __CINNAMON_XFIXES_CURSOR_H__ */
