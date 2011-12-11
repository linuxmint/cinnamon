/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-border-image.c: store information about an image with borders
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

#include <config.h>

#include <string.h>

#include "st-border-image.h"

struct _StBorderImage {
  GObject parent;

  char *filename;
  int border_top;
  int border_right;
  int border_bottom;
  int border_left;
};

struct _StBorderImageClass {
  GObjectClass parent_class;

};

G_DEFINE_TYPE (StBorderImage, st_border_image, G_TYPE_OBJECT)

static void
st_border_image_finalize (GObject *object)
{
  StBorderImage *image = ST_BORDER_IMAGE (object);

  g_free (image->filename);

  G_OBJECT_CLASS (st_border_image_parent_class)->finalize (object);
}

static void
st_border_image_class_init (StBorderImageClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = st_border_image_finalize;
}

static void
st_border_image_init (StBorderImage *image)
{
}

StBorderImage *
st_border_image_new (const char *filename,
                       int         border_top,
                       int         border_right,
                       int         border_bottom,
                       int         border_left)
{
  StBorderImage *image;

  image = g_object_new (ST_TYPE_BORDER_IMAGE, NULL);

  image->filename = g_strdup (filename);
  image->border_top = border_top;
  image->border_right = border_right;
  image->border_bottom = border_bottom;
  image->border_left = border_left;

  return image;
}

const char *
st_border_image_get_filename (StBorderImage *image)
{
  g_return_val_if_fail (ST_IS_BORDER_IMAGE (image), NULL);

  return image->filename;
}

void
st_border_image_get_borders (StBorderImage *image,
                             int           *border_top,
                             int           *border_right,
                             int           *border_bottom,
                             int           *border_left)
{
  g_return_if_fail (ST_IS_BORDER_IMAGE (image));

  if (border_top)
    *border_top = image->border_top;
  if (border_right)
    *border_right = image->border_right;
  if (border_bottom)
    *border_bottom = image->border_bottom;
  if (border_left)
    *border_left = image->border_left;
}

/**
 * st_border_image_equal:
 * @image: a #StBorder_Image
 * @other: a different #StBorder_Image
 *
 * Check if two border_image objects are identical.
 *
 * Return value: %TRUE if the two border image objects are identical
 */
gboolean
st_border_image_equal (StBorderImage *image,
                       StBorderImage *other)
{
  g_return_val_if_fail (ST_IS_BORDER_IMAGE (image), FALSE);
  g_return_val_if_fail (ST_IS_BORDER_IMAGE (other), FALSE);

  return (image->border_top == other->border_top &&
          image->border_right == other->border_right &&
          image->border_bottom == other->border_bottom &&
          image->border_left == other->border_left &&
          strcmp (image->filename, other->filename) == 0);
}
