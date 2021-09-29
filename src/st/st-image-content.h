/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-image-content.h: A content image with scaling support
 *
 * Copyright 2019 Canonical, Ltd
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

#ifndef __ST_IMAGE_CONTENT_H__
#define __ST_IMAGE_CONTENT_H__

#include <clutter/clutter.h>

#define ST_TYPE_IMAGE_CONTENT (st_image_content_get_type ())
G_DECLARE_FINAL_TYPE (StImageContent, st_image_content,
                      ST, IMAGE_CONTENT, ClutterImage)

ClutterContent *st_image_content_new_with_preferred_size (int width,
                                                          int height);

#endif /* __ST_IMAGE_CONTENT_H__ */
