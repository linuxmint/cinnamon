/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-border-image.h: store information about an image with borders
 *
 * Copyright 2009, 2010 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __ST_BORDER_IMAGE_H__
#define __ST_BORDER_IMAGE_H__

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

/* A StBorderImage encapsulates an image with specified unscaled borders on each edge.
 */
typedef struct _StBorderImage      StBorderImage;
typedef struct _StBorderImageClass StBorderImageClass;

#define ST_TYPE_BORDER_IMAGE             (st_border_image_get_type ())
#define ST_BORDER_IMAGE(object)          (G_TYPE_CHECK_INSTANCE_CAST ((object), ST_TYPE_BORDER_IMAGE, StBorderImage))
#define ST_BORDER_IMAGE_CLASS(klass)     (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_BORDER_IMAGE, StBorderImageClass))
#define ST_IS_BORDER_IMAGE(object)       (G_TYPE_CHECK_INSTANCE_TYPE ((object), ST_TYPE_BORDER_IMAGE))
#define ST_IS_BORDER_IMAGE_CLASS(klass)  (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_BORDER_IMAGE))
#define ST_BORDER_IMAGE_GET_CLASS(obj)   (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_BORDER_IMAGE, StBorderImageClass))

GType             st_border_image_get_type          (void) G_GNUC_CONST;

StBorderImage *st_border_image_new (GFile      *file,
                                    int         border_top,
                                    int         border_right,
                                    int         border_bottom,
                                    int         border_left);

GFile      *st_border_image_get_file     (StBorderImage *image);
void        st_border_image_get_borders  (StBorderImage *image,
                                          int           *border_top,
                                          int           *border_right,
                                          int           *border_bottom,
                                          int           *border_left);

gboolean st_border_image_equal (StBorderImage *image,
                                StBorderImage *other);

G_END_DECLS

#endif /* __ST_BORDER_IMAGE_H__ */
