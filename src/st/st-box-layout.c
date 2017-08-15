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
static void st_box_scrollable_interface_init (StScrollableInterface *iface);

G_DEFINE_TYPE_WITH_CODE (StBoxLayout, st_box_layout, ST_TYPE_WIDGET,
                         G_IMPLEMENT_INTERFACE (CLUTTER_TYPE_CONTAINER,
                                                st_box_container_iface_init)
                         G_IMPLEMENT_INTERFACE (ST_TYPE_SCROLLABLE,
                                                st_box_scrollable_interface_init));

#define BOX_LAYOUT_PRIVATE(o) \
  (G_TYPE_INSTANCE_GET_PRIVATE ((o), ST_TYPE_BOX_LAYOUT, StBoxLayoutPrivate))

enum {
  PROP_0,

  PROP_VERTICAL,
  PROP_PACK_START,

  PROP_HADJUST,
  PROP_VADJUST
};

struct _StBoxLayoutPrivate
{
  StAdjustment *hadjustment;
  StAdjustment *vadjustment;
};

/*
 * StScrollable Interface Implementation
 */
static void
adjustment_value_notify_cb (StAdjustment *adjustment,
                            GParamSpec   *pspec,
                            StBoxLayout  *box)
{
  clutter_actor_queue_redraw (CLUTTER_ACTOR (box));
}

static void
scrollable_set_adjustments (StScrollable *scrollable,
                            StAdjustment *hadjustment,
                            StAdjustment *vadjustment)
{
  StBoxLayoutPrivate *priv = ST_BOX_LAYOUT (scrollable)->priv;

  g_object_freeze_notify (G_OBJECT (scrollable));

  if (hadjustment != priv->hadjustment)
    {
      if (priv->hadjustment)
        {
          g_signal_handlers_disconnect_by_func (priv->hadjustment,
                                                adjustment_value_notify_cb,
                                                scrollable);
          g_object_unref (priv->hadjustment);
        }

      if (hadjustment)
        {
          g_object_ref (hadjustment);
          g_signal_connect (hadjustment, "notify::value",
                            G_CALLBACK (adjustment_value_notify_cb),
                            scrollable);
        }

      priv->hadjustment = hadjustment;
      g_object_notify (G_OBJECT (scrollable), "hadjustment");
    }

  if (vadjustment != priv->vadjustment)
    {
      if (priv->vadjustment)
        {
          g_signal_handlers_disconnect_by_func (priv->vadjustment,
                                                adjustment_value_notify_cb,
                                                scrollable);
          g_object_unref (priv->vadjustment);
        }

      if (vadjustment)
        {
          g_object_ref (vadjustment);
          g_signal_connect (vadjustment, "notify::value",
                            G_CALLBACK (adjustment_value_notify_cb),
                            scrollable);
        }

      priv->vadjustment = vadjustment;
      g_object_notify (G_OBJECT (scrollable), "vadjustment");
    }

  g_object_thaw_notify (G_OBJECT (scrollable));
}

static void
scrollable_get_adjustments (StScrollable  *scrollable,
                            StAdjustment **hadjustment,
                            StAdjustment **vadjustment)
{
  StBoxLayoutPrivate *priv;

  priv = (ST_BOX_LAYOUT (scrollable))->priv;

  if (hadjustment)
    *hadjustment = priv->hadjustment;

  if (vadjustment)
    *vadjustment = priv->vadjustment;
}



static void
st_box_scrollable_interface_init (StScrollableInterface *iface)
{
  iface->set_adjustments = scrollable_set_adjustments;
  iface->get_adjustments = scrollable_get_adjustments;
}

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
  StBoxLayoutPrivate *priv = ST_BOX_LAYOUT (object)->priv;
  ClutterLayoutManager *layout;
  StAdjustment *adjustment;
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

    case PROP_HADJUST:
      scrollable_get_adjustments (ST_SCROLLABLE (object), &adjustment, NULL);
      g_value_set_object (value, adjustment);
      break;

    case PROP_VADJUST:
      scrollable_get_adjustments (ST_SCROLLABLE (object), NULL, &adjustment);
      g_value_set_object (value, adjustment);
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

    case PROP_HADJUST:
      scrollable_set_adjustments (ST_SCROLLABLE (object),
                                  g_value_get_object (value),
                                  box->priv->vadjustment);
      break;

    case PROP_VADJUST:
      scrollable_set_adjustments (ST_SCROLLABLE (object),
                                  box->priv->hadjustment,
                                  g_value_get_object (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_box_layout_dispose (GObject *object)
{
  StBoxLayoutPrivate *priv = ST_BOX_LAYOUT (object)->priv;

  if (priv->hadjustment)
    {
      g_object_unref (priv->hadjustment);
      priv->hadjustment = NULL;
    }

  if (priv->vadjustment)
    {
      g_object_unref (priv->vadjustment);
      priv->vadjustment = NULL;
    }

  G_OBJECT_CLASS (st_box_layout_parent_class)->dispose (object);
}


static void
st_box_layout_allocate (ClutterActor          *actor,
                        const ClutterActorBox *box,
                        ClutterAllocationFlags flags)
{
  StBoxLayoutPrivate *priv = ST_BOX_LAYOUT (actor)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  ClutterLayoutManager *layout = clutter_actor_get_layout_manager (actor);
  ClutterActorBox content_box;
  gfloat avail_width, avail_height, min_width, natural_width, min_height, natural_height;

  ClutterActor *child;

  CLUTTER_ACTOR_CLASS (st_box_layout_parent_class)->allocate (actor, box, flags);

  st_theme_node_get_content_box (theme_node, box, &content_box);
  clutter_actor_box_get_size (&content_box, &avail_width, &avail_height);

  clutter_layout_manager_get_preferred_width (layout, CLUTTER_CONTAINER (actor),
                                              avail_height,
                                              &min_width, &natural_width);
  clutter_layout_manager_get_preferred_height (layout, CLUTTER_CONTAINER (actor),
                                               MAX (avail_width, min_width),
                                               &min_height, &natural_height);

  /* update adjustments for scrolling */
  if (priv->vadjustment)
    {
      gdouble prev_value;

      g_object_set (G_OBJECT (priv->vadjustment),
                    "lower", 0.0,
                    "upper", MAX (min_height, avail_height),
                    "page-size", avail_height,
                    "step-increment", avail_height / 6,
                    "page-increment", avail_height - avail_height / 6,
                    NULL);

      prev_value = st_adjustment_get_value (priv->vadjustment);
      st_adjustment_set_value (priv->vadjustment, prev_value);
    }

  if (priv->hadjustment)
    {
      gdouble prev_value;

      g_object_set (G_OBJECT (priv->hadjustment),
                    "lower", 0.0,
                    "upper", MAX (min_width, avail_width),
                    "page-size", avail_width,
                    "step-increment", avail_width / 6,
                    "page-increment", avail_width - avail_width / 6,
                    NULL);

      prev_value = st_adjustment_get_value (priv->hadjustment);
      st_adjustment_set_value (priv->hadjustment, prev_value);
    }
}

static void
st_box_layout_apply_transform (ClutterActor *a,
                               CoglMatrix   *m)
{
  StBoxLayoutPrivate *priv = ST_BOX_LAYOUT (a)->priv;
  gdouble x, y;

  CLUTTER_ACTOR_CLASS (st_box_layout_parent_class)->apply_transform (a, m);

  if (priv->hadjustment)
    x = st_adjustment_get_value (priv->hadjustment);
  else
    x = 0;

  if (priv->vadjustment)
    y = st_adjustment_get_value (priv->vadjustment);
  else
    y = 0;

  cogl_matrix_translate (m, (int) -x, (int) -y, 0);
}

/* If we are translated, then we need to translate back before chaining
 * up or the background and borders will be drawn in the wrong place */
static void
get_border_paint_offsets (StBoxLayout *self,
                          double      *x,
                          double      *y)
{
  StBoxLayoutPrivate *priv = self->priv;

  if (priv->hadjustment)
    *x = st_adjustment_get_value (priv->hadjustment);
  else
    *x = 0;

  if (priv->vadjustment)
    *y = st_adjustment_get_value (priv->vadjustment);
  else
    *y = 0;
}


static void
st_box_layout_paint (ClutterActor *actor)
{
  StBoxLayout *self = ST_BOX_LAYOUT (actor);
  StBoxLayoutPrivate *priv = self->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  gdouble x, y;
  ClutterActorBox allocation_box;
  ClutterActorBox content_box;
  ClutterActor *child;

  get_border_paint_offsets (self, &x, &y);
  if (x != 0 || y != 0)
    {
      cogl_push_matrix ();
      cogl_translate ((int)x, (int)y, 0);
    }

  st_widget_paint_background (ST_WIDGET (actor));

  if (x != 0 || y != 0)
    {
      cogl_pop_matrix ();
    }

  if (clutter_actor_get_n_children (actor) == 0)
    return;

  clutter_actor_get_allocation_box (actor, &allocation_box);
  st_theme_node_get_content_box (theme_node, &allocation_box, &content_box);

  content_box.x1 += x;
  content_box.y1 += y;
  content_box.x2 += x;
  content_box.y2 += y;

  /* The content area forms the viewport into the scrolled contents, while
   * the borders and background stay in place; after drawing the borders and
   * background, we clip to the content area */
  if (priv->hadjustment || priv->vadjustment)
    cogl_clip_push_rectangle ((int)content_box.x1,
                              (int)content_box.y1,
                              (int)content_box.x2,
                              (int)content_box.y2);

  for (child = clutter_actor_get_first_child (actor);
       child != NULL;
       child = clutter_actor_get_next_sibling (child))
    clutter_actor_paint (child);

  if (priv->hadjustment || priv->vadjustment)
    cogl_clip_pop ();
}

static void
st_box_layout_pick (ClutterActor       *actor,
                    const ClutterColor *color)
{
  StBoxLayout *self = ST_BOX_LAYOUT (actor);
  StBoxLayoutPrivate *priv = self->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  gdouble x, y;
  ClutterActorBox allocation_box;
  ClutterActorBox content_box;
  ClutterActor *child;

  get_border_paint_offsets (self, &x, &y);
  if (x != 0 || y != 0)
    {
      cogl_push_matrix ();
      cogl_translate ((int)x, (int)y, 0);
    }

  CLUTTER_ACTOR_CLASS (st_box_layout_parent_class)->pick (actor, color);

  if (x != 0 || y != 0)
    {
      cogl_pop_matrix ();
    }

  if (clutter_actor_get_n_children (actor) == 0)
    return;

  clutter_actor_get_allocation_box (actor, &allocation_box);
  st_theme_node_get_content_box (theme_node, &allocation_box, &content_box);

  content_box.x1 += x;
  content_box.y1 += y;
  content_box.x2 += x;
  content_box.y2 += y;

  if (priv->hadjustment || priv->vadjustment)
    cogl_clip_push_rectangle ((int)content_box.x1,
                              (int)content_box.y1,
                              (int)content_box.x2,
                              (int)content_box.y2);

  for (child = clutter_actor_get_first_child (actor);
       child != NULL;
       child = clutter_actor_get_next_sibling (child))
    clutter_actor_paint (child);

  if (priv->hadjustment || priv->vadjustment)
    cogl_clip_pop ();
}

static gboolean
st_box_layout_get_paint_volume (ClutterActor       *actor,
                                ClutterPaintVolume *volume)
{
  StBoxLayout *self = ST_BOX_LAYOUT (actor);
  gdouble x, y;
  StBoxLayoutPrivate *priv = self->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  ClutterActorBox allocation_box;
  ClutterActorBox content_box;
  ClutterVertex origin;

  /* Setting the paint volume does not make sense when we don't have any allocation */
  if (!clutter_actor_has_allocation (actor))
    return FALSE;

  /* When have an adjustment we are clipped to the content box, so base
   * our paint volume on that. */
  if (priv->hadjustment || priv->vadjustment)
    {
      clutter_actor_get_allocation_box (actor, &allocation_box);
      st_theme_node_get_content_box (theme_node, &allocation_box, &content_box);
      origin.x = content_box.x1 - allocation_box.x1;
      origin.y = content_box.y1 - allocation_box.y2;
      origin.z = 0.f;
      clutter_paint_volume_set_width (volume, content_box.x2 - content_box.x1);
      clutter_paint_volume_set_height (volume, content_box.y2 - content_box.y1);
    }
  else if (!CLUTTER_ACTOR_CLASS (st_box_layout_parent_class)->get_paint_volume (actor, volume))
    return FALSE;

  /* When scrolled, st_box_layout_apply_transform() includes the scroll offset
   * and affects paint volumes. This is right for our children, but our paint volume
   * is determined by our allocation and borders and doesn't scroll, so we need
   * to reverse-compensate here, the same as we do when painting.
   */
  get_border_paint_offsets (self, &x, &y);
  if (x != 0 || y != 0)
    {
      clutter_paint_volume_get_origin (volume, &origin);
      origin.x += x;
      origin.y += y;
      clutter_paint_volume_set_origin (volume, &origin);
    }

  return TRUE;
}

static void
st_box_layout_style_changed (StWidget *self)
{
  StBoxLayoutPrivate *priv = ST_BOX_LAYOUT (self)->priv;
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
st_box_layout_class_init (StBoxLayoutClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);
  GParamSpec *pspec;

  g_type_class_add_private (klass, sizeof (StBoxLayoutPrivate));

  object_class->get_property = st_box_layout_get_property;
  object_class->set_property = st_box_layout_set_property;
  object_class->dispose = st_box_layout_dispose;

  actor_class->allocate = st_box_layout_allocate;
  actor_class->apply_transform = st_box_layout_apply_transform;

  actor_class->paint = st_box_layout_paint;
  actor_class->get_paint_volume = st_box_layout_get_paint_volume;
  actor_class->pick = st_box_layout_pick;

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

  /* StScrollable properties */
  g_object_class_override_property (object_class,
                                    PROP_HADJUST,
                                    "hadjustment");

  g_object_class_override_property (object_class,
                                    PROP_VADJUST,
                                    "vadjustment");
}

static void
st_box_layout_init (StBoxLayout *self)
{
  ClutterLayoutManager *layout;
  self->priv = BOX_LAYOUT_PRIVATE (self);
  layout = clutter_box_layout_new ();
  g_signal_connect_swapped (layout, "layout-changed",
                            G_CALLBACK (clutter_actor_queue_relayout), self);
  g_signal_connect (layout, "notify", G_CALLBACK (layout_notify), self);
  clutter_actor_set_layout_manager (CLUTTER_ACTOR (self), layout);
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
