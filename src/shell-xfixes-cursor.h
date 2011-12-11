/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_XFIXES_CURSOR_H__
#define __SHELL_XFIXES_CURSOR_H__

#include <clutter/clutter.h>
#include <gdk-pixbuf/gdk-pixbuf.h>

G_BEGIN_DECLS

typedef struct _ShellXFixesCursor        ShellXFixesCursor;
typedef struct _ShellXFixesCursorClass   ShellXFixesCursorClass;

#define SHELL_TYPE_XFIXES_CURSOR             (shell_xfixes_cursor_get_type ())
#define SHELL_XFIXES_CURSOR(object)          (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_XFIXES_CURSOR, ShellXFixesCursor))
#define SHELL_XFIXES_CURSOR_CLASS(klass)     (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_XFIXES_CURSOR, ShellXFixesCursorClass))
#define SHELL_IS_XFIXES_CURSOR(object)       (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_XFIXES_CURSOR))
#define SHELL_IS_XFIXES_CURSOR_CLASS(klass)  (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_XFIXES_CURSOR))
#define SHELL_XFIXES_CURSOR_GET_CLASS(obj)   (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_XFIXES_CURSOR, ShellXFixesCursorClass))

GType               shell_xfixes_cursor_get_type     (void) G_GNUC_CONST;

ShellXFixesCursor   *shell_xfixes_cursor_get_default (void);

void                shell_xfixes_cursor_show (ShellXFixesCursor *xfixes_cursor);
void                shell_xfixes_cursor_hide (ShellXFixesCursor *xfixes_cursor);
int                 shell_xfixes_cursor_get_hot_x (ShellXFixesCursor *xfixes_cursor);
int                 shell_xfixes_cursor_get_hot_y (ShellXFixesCursor *xfixes_cursor);
void                shell_xfixes_cursor_update_texture_image (ShellXFixesCursor *xfixes_cursor,
                                                              ClutterTexture *texture);

G_END_DECLS

#endif /* __SHELL_XFIXES_CURSOR_H__ */
