/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-box-layout.h: box layout actor
 *
 * Copyright 2009 Intel Corporation.
 * Copyright 2009 Abderrahim Kitouni
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2010 Florian Muellner
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

/* Portions copied from Clutter:
 * Clutter.
 *
 * An OpenGL based 'interactive canvas' library.
 *
 * Authored By Matthew Allum  <mallum@openedhand.com>
 *
 * Copyright (C) 2006 OpenedHand
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 */

/**
 * SECTION:st-box-layout
 * @short_description: a layout container arranging children in a single line
 *
 * The #StBoxLayout arranges its children along a single line, where each
 * child can be allocated either its preferred size or larger if the expand
 * option is set. If the fill option is set, the actor will be allocated more
 * than its requested size. If the fill option is not set, but the expand option
 * is enabled, then the position of the actor within the available space can
 * be determined by the alignment child property.
 *
 */

#include <stdlib.h>

#include "st-box-layout.h"

#include "st-private.h"
#include "st-scrollable.h"
#include "st-box-layout-child.h"


static void st_box_container_iface_init (ClutterContainerIface *iface);

enum {
  PROP_0,

  PROP_VERTICAL,
  PROP_PACK_START,
};

struct _StBoxLayoutPrivate
{
  StAdjustment *hadjustment;
  StAdjustment *vadjustment;
};

G_DEFINE_TYPE_WITH_CODE (StBoxLayout, st_box_layout, ST_TYPE_VIEWPORT,
                         G_ADD_PRIVATE (StBoxLayout)
                         G_IMPLEMENT_INTERFACE (CLUTTER_TYPE_CONTAINER,
                                                st_box_container_iface_init));

static void
st_box_container_iface_init (ClutterContainerIface *iface)
{
  iface->child_meta_type = ST_TYPE_BOX_LAYOUT_CHILD;
}


static void
st_box_layout_get_property (GObject    *object,
                            guint       property_id,
                            GValue     *value,
                            GParamSpec *pspec)
{
  ClutterLayoutManager *layout;
  ClutterOrientation orientation;

  switch (property_id)
    {
    case PROP_VERTICAL:
      layout = clutter_actor_get_layout_manager (CLUTTER_ACTOR (object));
      orientation = clutter_box_layout_get_orientation (CLUTTER_BOX_LAYOUT (layout));
      g_value_set_boolean (value, orientation == CLUTTER_ORIENTATION_VERTICAL);
      break;

    case PROP_PACK_START:
      layout = clutter_actor_get_layout_manager (CLUTTER_ACTOR (object));
      g_value_set_boolean (value, clutter_box_layout_get_pack_start (CLUTTER_BOX_LAYOUT (layout)));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_box_layout_set_property (GObject      *object,
                            guint         property_id,
                            const GValue *value,
                            GParamSpec   *pspec)
{
  StBoxLayout *box = ST_BOX_LAYOUT (object);

  switch (property_id)
    {
    case PROP_VERTICAL:
      st_box_layout_set_vertical (box, g_value_get_boolean (value));
      break;

    case PROP_PACK_START:
      st_box_layout_set_pack_start (box, g_value_get_boolean (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_box_layout_style_changed (StWidget *self)
{
  StThemeNode *theme_node = st_widget_get_theme_node (self);
  ClutterBoxLayout *layout;
  double spacing;

  layout = CLUTTER_BOX_LAYOUT (clutter_actor_get_layout_manager (CLUTTER_ACTOR (self)));

  spacing = st_theme_node_get_length (theme_node, "spacing");
  clutter_box_layout_set_spacing (layout, (int)(spacing + 0.5));

  ST_WIDGET_CLASS (st_box_layout_parent_class)->style_changed (self);
}

static void
layout_notify (GObject    *object,
               GParamSpec *pspec,
               gpointer    user_data)
{
  GObject *self = user_data;
  const char *prop_name = g_param_spec_get_name (pspec);

  if (g_object_class_find_property (G_OBJECT_GET_CLASS (self), prop_name))
    g_object_notify (self, prop_name);
}

static void
on_layout_manager_notify (GObject    *object,
                          GParamSpec *pspec,
                          gpointer    user_data)
{
  ClutterActor *actor = CLUTTER_ACTOR (object);
  ClutterLayoutManager *layout = clutter_actor_get_layout_manager (actor);

  g_warn_if_fail (CLUTTER_IS_BOX_LAYOUT (layout));

  if (layout == NULL)
    return;

  g_signal_connect_swapped (layout, "layout-changed",
                            G_CALLBACK (clutter_actor_queue_relayout), actor);
  g_signal_connect (layout, "notify", G_CALLBACK (layout_notify), object);
}

static void
st_box_layout_class_init (StBoxLayoutClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);
  GParamSpec *pspec;

  object_class->get_property = st_box_layout_get_property;
  object_class->set_property = st_box_layout_set_property;

  widget_class->style_changed = st_box_layout_style_changed;

  pspec = g_param_spec_boolean ("vertical",
                                "Vertical",
                                "Whether the layout should be vertical, rather"
                                "than horizontal",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_VERTICAL, pspec);

  pspec = g_param_spec_boolean ("pack-start",
                                "Pack Start",
                                "Whether to pack items at the start of the box",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_PACK_START, pspec);
}

static void
st_box_layout_init (StBoxLayout *self)
{
  self->priv = st_box_layout_get_instance_private (self);

  g_signal_connect (self, "notify::layout-manager",
                    G_CALLBACK (on_layout_manager_notify), NULL);
  clutter_actor_set_layout_manager (CLUTTER_ACTOR (self), clutter_box_layout_new ());
}

/**
 * st_box_layout_new:
 *
 * Create a new #StBoxLayout.
 *
 * Returns: a newly allocated #StBoxLayout
 */
StWidget *
st_box_layout_new (void)
{
  return g_object_new (ST_TYPE_BOX_LAYOUT, NULL);
}

/**
 * st_box_layout_set_vertical:
 * @box: A #StBoxLayout
 * @vertical: %TRUE if the layout should be vertical
 *
 * Set the value of the #StBoxLayout::vertical property
 *
 */
void
st_box_layout_set_vertical (StBoxLayout *box,
                            gboolean     vertical)
{
  ClutterLayoutManager *layout;
  ClutterOrientation orientation;

  g_return_if_fail (ST_IS_BOX_LAYOUT (box));

  layout = clutter_actor_get_layout_manager (CLUTTER_ACTOR (box));
  orientation = vertical ? CLUTTER_ORIENTATION_VERTICAL
                         : CLUTTER_ORIENTATION_HORIZONTAL;

  if (clutter_box_layout_get_orientation (CLUTTER_BOX_LAYOUT (layout)) != orientation)
    {
      clutter_box_layout_set_orientation (CLUTTER_BOX_LAYOUT (layout), orientation);
      g_object_notify (G_OBJECT (box), "vertical");
    }
}

/**
 * st_box_layout_get_vertical:
 * @box: A #StBoxLayout
 *
 * Get the value of the #StBoxLayout::vertical property.
 *
 * Returns: %TRUE if the layout is vertical
 */
gboolean
st_box_layout_get_vertical (StBoxLayout *box)
{
  ClutterLayoutManager *layout;
  ClutterOrientation orientation;

  g_return_val_if_fail (ST_IS_BOX_LAYOUT (box), FALSE);

  layout = clutter_actor_get_layout_manager (CLUTTER_ACTOR (box));
  orientation = clutter_box_layout_get_orientation (CLUTTER_BOX_LAYOUT (layout));
  return orientation == CLUTTER_ORIENTATION_VERTICAL;
}

/**
 * st_box_layout_set_pack_start:
 * @box: A #StBoxLayout
 * @pack_start: %TRUE if the layout should use pack-start
 *
 * Set the value of the #StBoxLayout::pack-start property.
 *
 */
void
st_box_layout_set_pack_start (StBoxLayout *box,
                              gboolean     pack_start)
{
  ClutterBoxLayout *layout;

  g_return_if_fail (ST_IS_BOX_LAYOUT (box));

  layout = CLUTTER_BOX_LAYOUT (clutter_actor_get_layout_manager (CLUTTER_ACTOR (box)));

  if (clutter_box_layout_get_pack_start (layout) != pack_start)
    {
      clutter_box_layout_set_pack_start (layout, pack_start);
      g_object_notify (G_OBJECT (box), "pack-start");
    }
}

/**
 * st_box_layout_get_pack_start:
 * @box: A #StBoxLayout
 *
 * Get the value of the #StBoxLayout::pack-start property.
 *
 * Returns: %TRUE if pack-start is enabled
 */
gboolean
st_box_layout_get_pack_start (StBoxLayout *box)
{
  g_return_val_if_fail (ST_IS_BOX_LAYOUT (box), FALSE);

  return clutter_box_layout_get_pack_start (CLUTTER_BOX_LAYOUT (clutter_actor_get_layout_manager (CLUTTER_ACTOR (box))));
}

/**
 * st_box_layout_insert_actor:
 * @self: A #StBoxLayout
 * @actor: A #ClutterActor
 * @pos: position to insert actor
 *
 * Adds @actor to @self at position @pos.  If @pos is
 * negative or larger than the number of elements in the
 * list then @actor is added after all the others previously
 * added.
 */
void
st_box_layout_insert_actor (StBoxLayout  *self,
                            ClutterActor *actor,
                            int           pos)
{
  clutter_actor_insert_child_at_index (CLUTTER_ACTOR (self), actor, pos);
}

/**
 * st_box_layout_insert_before:
 * @self: A #StBoxLayout
 * @actor: A #ClutterActor
 * @sibling: A previously added #ClutterActor
 *
 * Adds @actor to @self at the position before @sibling.
 * @sibling cannot be %NULL and must be already a child
 * of @self.
 */
void
st_box_layout_insert_before (StBoxLayout  *self,
                             ClutterActor *actor,
                             ClutterActor *sibling)
{
  g_return_if_fail (ST_IS_BOX_LAYOUT (self));

  clutter_actor_insert_child_below (CLUTTER_ACTOR (self), actor, sibling);
}
