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

#include "st-image-content.h"
#include "st-private.h"

struct _StImageContent
{
  /*< private >*/
  ClutterImage parent_instance;
};

typedef struct _StImageContentPrivate StImageContentPrivate;
struct _StImageContentPrivate
{
  int width;
  int height;
};

enum
{
  PROP_0,
  PROP_PREFERRED_WIDTH,
  PROP_PREFERRED_HEIGHT,
};

static void clutter_content_interface_init (ClutterContentInterface *iface);

G_DEFINE_TYPE_WITH_CODE (StImageContent, st_image_content, CLUTTER_TYPE_IMAGE,
                         G_ADD_PRIVATE (StImageContent)
                         G_IMPLEMENT_INTERFACE (CLUTTER_TYPE_CONTENT,
                                                clutter_content_interface_init))

static void
st_image_content_init (StImageContent *self)
{
}

static void
st_image_content_constructed (GObject *object)
{
  StImageContent *self = ST_IMAGE_CONTENT (object);
  StImageContentPrivate *priv = st_image_content_get_instance_private (self);

  if (priv->width < 0 || priv->height < 0)
    g_warning ("StImageContent initialized with invalid preferred size: %dx%d\n",
               priv->width, priv->height);
}

static void
st_image_content_get_property (GObject    *object,
                               guint       prop_id,
                               GValue     *value,
                               GParamSpec *pspec)
{
  StImageContent *self = ST_IMAGE_CONTENT (object);
  StImageContentPrivate *priv = st_image_content_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_PREFERRED_WIDTH:
      g_value_set_int (value, priv->width);
      break;

    case PROP_PREFERRED_HEIGHT:
      g_value_set_int (value, priv->height);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
st_image_content_set_property (GObject      *object,
                               guint         prop_id,
                               const GValue *value,
                               GParamSpec   *pspec)
{
  StImageContent *self = ST_IMAGE_CONTENT (object);
  StImageContentPrivate *priv = st_image_content_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_PREFERRED_WIDTH:
      priv->width = g_value_get_int (value);
      break;

    case PROP_PREFERRED_HEIGHT:
      priv->height = g_value_get_int (value);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
st_image_content_class_init (StImageContentClass *klass)
{
  GParamSpec *pspec;
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->constructed = st_image_content_constructed;
  object_class->get_property = st_image_content_get_property;
  object_class->set_property = st_image_content_set_property;

  pspec = g_param_spec_int ("preferred-width",
                            "Preferred Width",
                            "Preferred Width of the Content when painted",
                             -1, G_MAXINT, -1,
                             G_PARAM_CONSTRUCT_ONLY | ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_PREFERRED_WIDTH, pspec);

  pspec = g_param_spec_int ("preferred-height",
                            "Preferred Height",
                            "Preferred Height of the Content when painted",
                             -1, G_MAXINT, -1,
                             G_PARAM_CONSTRUCT_ONLY | ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_PREFERRED_HEIGHT, pspec);
}

static gboolean
st_image_content_get_preferred_size (ClutterContent *content,
                                     float          *width,
                                     float          *height)
{
  StImageContent *self = ST_IMAGE_CONTENT (content);
  StImageContentPrivate *priv = st_image_content_get_instance_private (self);
  CoglTexture *texture;

  texture = clutter_image_get_texture (CLUTTER_IMAGE (content));

  if (texture == NULL)
    return FALSE;

  g_assert_cmpint (priv->width, >, -1);
  g_assert_cmpint (priv->height, >, -1);

  if (width != NULL)
    *width = (float) priv->width;

  if (height != NULL)
    *height = (float) priv->height;

  return TRUE;
}

static void
clutter_content_interface_init (ClutterContentInterface *iface)
{
  iface->get_preferred_size = st_image_content_get_preferred_size;
}

/**
 * st_image_content_new_with_preferred_size:
 * @width: The preferred width to be used when drawing the content
 * @height: The preferred width to be used when drawing the content
 *
 * Creates a new #StImageContent, a simple content for sized images.
 *
 * Return value: (transfer full): the newly created #StImageContent content
 *   Use g_object_unref() when done.
 */
ClutterContent *
st_image_content_new_with_preferred_size (int width,
                                          int height)
{
  return g_object_new (ST_TYPE_IMAGE_CONTENT,
                       "preferred-width", width,
                       "preferred-height", height,
                       NULL);
}
