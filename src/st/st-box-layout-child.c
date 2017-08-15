/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-box-layout-child.c: box layout child actor
 *
 * Copyright 2009 Intel Corporation
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms and conditions of the GNU Lesser General Public License,
 * version 2.1, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * SECTION:st-box-layout-child
 * @short_description: meta data associated with a #StBoxLayout child.
 *
 * #StBoxLayoutChild is a #ClutterChildMeta implementation that stores the
 * child properties for children inside a #StBoxLayout.
 */

#include "st-box-layout-child.h"
#include "st-private.h"

G_DEFINE_TYPE (StBoxLayoutChild, st_box_layout_child, CLUTTER_TYPE_CHILD_META)

#define BOX_LAYOUT_CHILD_PRIVATE(o) \
  (G_TYPE_INSTANCE_GET_PRIVATE ((o), ST_TYPE_BOX_LAYOUT_CHILD, StBoxLayoutChildPrivate))


enum
{
  PROP_0,

  PROP_EXPAND,
  PROP_X_FILL,
  PROP_Y_FILL,
  PROP_X_ALIGN,
  PROP_Y_ALIGN
};

static ClutterLayoutMeta *
get_layout_meta (StBoxLayoutChild *self)
{
  ClutterChildMeta *meta = CLUTTER_CHILD_META (self);
  ClutterActor *actor = clutter_child_meta_get_actor (meta);
  ClutterContainer *container = clutter_child_meta_get_container (meta);
  ClutterLayoutManager *layout = clutter_actor_get_layout_manager (CLUTTER_ACTOR (container));
  return clutter_layout_manager_get_child_meta (layout, container, actor);
}

static void
st_box_layout_child_get_property (GObject    *object,
                                  guint       property_id,
                                  GValue     *value,
                                  GParamSpec *pspec)
{
  StBoxLayoutChild *child = ST_BOX_LAYOUT_CHILD (object);
  GObject *meta = G_OBJECT (get_layout_meta (child));
  gboolean expand, fill;
  ClutterBoxAlignment layout_align;
  StAlign align;

  switch (property_id)
    {
    case PROP_EXPAND:
      g_object_get (meta, "expand", &expand, NULL);
      g_value_set_boolean (value, expand);
      break;
    case PROP_X_FILL:
      g_object_get (meta, "x-fill", &fill, NULL);
      g_value_set_boolean (value, fill);
      break;
    case PROP_Y_FILL:
      g_object_get (meta, "y-fill", &fill, NULL);
      g_value_set_boolean (value, fill);
      break;
    case PROP_X_ALIGN:
    case PROP_Y_ALIGN:
      g_object_get (meta, g_param_spec_get_name (pspec), &layout_align, NULL);
      switch (layout_align)
        {
        case CLUTTER_BOX_ALIGNMENT_START:
          align = ST_ALIGN_START;
          break;
        case CLUTTER_BOX_ALIGNMENT_CENTER:
          align = ST_ALIGN_MIDDLE;
          break;
        case CLUTTER_BOX_ALIGNMENT_END:
          align = ST_ALIGN_END;
        }
      g_value_set_enum (value, align);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_box_layout_child_set_property (GObject      *object,
                                  guint         property_id,
                                  const GValue *value,
                                  GParamSpec   *pspec)
{
  StBoxLayoutChild *child = ST_BOX_LAYOUT_CHILD (object);
  GObject *meta = G_OBJECT (get_layout_meta (child));
  ClutterBoxAlignment align;

  switch (property_id)
    {
    case PROP_EXPAND:
      g_object_set (meta, "expand", g_value_get_boolean (value), NULL);
      break;
    case PROP_X_FILL:
      child->x_fill_set = TRUE;
      g_object_set (meta, "x-fill", g_value_get_boolean (value), NULL);
      break;
    case PROP_Y_FILL:
      child->y_fill_set = TRUE;
      g_object_set (meta, "y-fill", g_value_get_boolean (value), NULL);
      break;
    case PROP_X_ALIGN:

    case PROP_Y_ALIGN:
      switch (g_value_get_enum (value))
        {
        case ST_ALIGN_START:
          align = CLUTTER_BOX_ALIGNMENT_START;
          break;
        case ST_ALIGN_MIDDLE:
          align = CLUTTER_BOX_ALIGNMENT_CENTER;
          break;
        case ST_ALIGN_END:
          align = CLUTTER_BOX_ALIGNMENT_END;
        }
      g_object_set (meta, g_param_spec_get_name (pspec), align, NULL);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}
static void
st_box_layout_child_constructed (GObject *object)
{
  StBoxLayoutChild *child = ST_BOX_LAYOUT_CHILD (object);
  GObject *meta = G_OBJECT (get_layout_meta (child));

  if (!child->x_fill_set)
    g_object_set (meta, "x-fill", TRUE, NULL);

  if (!child->y_fill_set)
    g_object_set (meta, "y-fill", TRUE, NULL);

  G_OBJECT_CLASS (st_box_layout_child_parent_class)->constructed (object);
}

static void
st_box_layout_child_class_init (StBoxLayoutChildClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GParamSpec *pspec;

  object_class->get_property = st_box_layout_child_get_property;
  object_class->set_property = st_box_layout_child_set_property;
  object_class->constructed = st_box_layout_child_constructed;

  pspec = g_param_spec_boolean ("expand", "Expand",
                                "Allocate the child extra space",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_EXPAND, pspec);

  pspec = g_param_spec_boolean ("x-fill", "x-fill",
                                "Whether the child should receive priority "
                                "when the container is allocating spare space "
                                "on the horizontal axis",
                                TRUE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_X_FILL, pspec);

  pspec = g_param_spec_boolean ("y-fill", "y-fill",
                                "Whether the child should receive priority "
                                "when the container is allocating spare space "
                                "on the vertical axis",
                                TRUE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_Y_FILL, pspec);

  pspec = g_param_spec_enum ("x-align",
                             "X Alignment",
                             "X alignment of the widget within the cell",
                             ST_TYPE_ALIGN,
                             ST_ALIGN_MIDDLE,
                             ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_X_ALIGN, pspec);

  pspec = g_param_spec_enum ("y-align",
                             "Y Alignment",
                             "Y alignment of the widget within the cell",
                             ST_TYPE_ALIGN,
                             ST_ALIGN_MIDDLE,
                             ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_Y_ALIGN, pspec);
}

static void
st_box_layout_child_init (StBoxLayoutChild *self)
{

}

