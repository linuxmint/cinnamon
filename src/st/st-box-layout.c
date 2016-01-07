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

G_DEFINE_TYPE_WITH_CODE (StBoxLayout, st_box_layout, ST_TYPE_CONTAINER,
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
  PROP_ALIGN_END,

  PROP_HADJUST,
  PROP_VADJUST
};

struct _StBoxLayoutPrivate
{
  guint         spacing;

  guint         is_vertical : 1;
  guint         is_pack_start : 1;
  guint         is_align_end : 1;

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
  StAdjustment *adjustment;

  switch (property_id)
    {
    case PROP_VERTICAL:
      g_value_set_boolean (value, priv->is_vertical);
      break;

    case PROP_PACK_START:
      g_value_set_boolean (value, priv->is_pack_start);
      break;

    case PROP_ALIGN_END:
      g_value_set_boolean (value, priv->is_align_end);
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

    case PROP_ALIGN_END:
      st_box_layout_set_align_end (box, g_value_get_boolean (value));
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
get_content_preferred_width (StBoxLayout *self,
                             gfloat       for_height,
                             gfloat      *min_width_p,
                             gfloat      *natural_width_p)
{
  StBoxLayoutPrivate *priv = self->priv;
  gint n_children = 0;
  gint n_fixed = 0;
  gfloat min_width, natural_width;
  ClutterActor *child;

  min_width = 0;
  natural_width = 0;

  for (child = clutter_actor_get_first_child (CLUTTER_ACTOR (self));
       child != NULL;
       child = clutter_actor_get_next_sibling (child))
    {
      gfloat child_min = 0, child_nat = 0;
      gboolean child_fill;

      if (!CLUTTER_ACTOR_IS_VISIBLE (child))
        continue;

      n_children++;

      if (clutter_actor_get_fixed_position_set (child))
        {
          n_fixed++;
          continue;
        }

      if (priv->is_vertical)
        {
          _st_actor_get_preferred_width (child, -1, FALSE,
                                         &child_min, &child_nat);
          min_width = MAX (child_min, min_width);
          natural_width = MAX (child_nat, natural_width);
        }
      else
        {
          clutter_container_child_get (CLUTTER_CONTAINER (self), child,
                                       "y-fill", &child_fill,
                                       NULL);
          _st_actor_get_preferred_width (child, for_height, child_fill,
                                         &child_min, &child_nat);
          min_width += child_min;
          natural_width += child_nat;
        }
    }

  if (!priv->is_vertical && (n_children - n_fixed) > 1)
    {
      min_width += priv->spacing * (n_children - n_fixed - 1);
      natural_width += priv->spacing * (n_children - n_fixed - 1);
    }

  if (min_width_p)
    *min_width_p = min_width;

  if (natural_width_p)
    *natural_width_p = natural_width;
}

static void
st_box_layout_get_preferred_width (ClutterActor *actor,
                                   gfloat        for_height,
                                   gfloat       *min_width_p,
                                   gfloat       *natural_width_p)
{
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));

  st_theme_node_adjust_for_height (theme_node, &for_height);

  get_content_preferred_width (ST_BOX_LAYOUT (actor), for_height,
                               min_width_p, natural_width_p);

  st_theme_node_adjust_preferred_width (theme_node,
                                        min_width_p, natural_width_p);
}

static void
get_content_preferred_height (StBoxLayout *self,
                              gfloat       for_width,
                              gfloat      *min_height_p,
                              gfloat      *natural_height_p)
{
  StBoxLayoutPrivate *priv = self->priv;
  gint n_children = 0;
  gint n_fixed = 0;
  gfloat min_height, natural_height;
  ClutterActor *child;

  min_height = 0;
  natural_height = 0;

  for (child = clutter_actor_get_first_child (CLUTTER_ACTOR (self));
       child != NULL;
       child = clutter_actor_get_next_sibling (child))
    {
      gfloat child_min = 0, child_nat = 0;
      gboolean child_fill = FALSE;

      if (!CLUTTER_ACTOR_IS_VISIBLE (child))
        continue;

      n_children++;

      if (clutter_actor_get_fixed_position_set (child))
        {
          n_fixed++;
          continue;
        }

      if (priv->is_vertical)
        {
          clutter_container_child_get ((ClutterContainer*) self, child,
                                       "x-fill", &child_fill,
                                       NULL);
        }
      _st_actor_get_preferred_height (child,
                                      (priv->is_vertical) ? for_width : -1,
                                      child_fill,
                                      &child_min,
                                      &child_nat);

      if (!priv->is_vertical)
        {
          min_height = MAX (child_min, min_height);
          natural_height = MAX (child_nat, natural_height);
        }
      else
        {
          min_height += child_min;
          natural_height += child_nat;
        }
    }

  if (priv->is_vertical && (n_children - n_fixed) > 1)
    {
      min_height += priv->spacing * (n_children - n_fixed - 1);
      natural_height += priv->spacing * (n_children - n_fixed - 1);
    }

  if (min_height_p)
    *min_height_p = min_height;

  if (natural_height_p)
    *natural_height_p = natural_height;
}

static void
st_box_layout_get_preferred_height (ClutterActor *actor,
                                    gfloat        for_width,
                                    gfloat       *min_height_p,
                                    gfloat       *natural_height_p)
{
  StBoxLayout *self = ST_BOX_LAYOUT (actor);
  StBoxLayoutPrivate *priv = self->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));

  st_theme_node_adjust_for_width (theme_node, &for_width);

  if (priv->hadjustment)
    {
      /* If we're scrolled, the parent calls us with the width that
       * we'll actually get, which can be smaller than the minimum
       * width that we give our contents.
       */
      gfloat min_width;

      get_content_preferred_width (self, -1, &min_width, NULL);
      for_width = MAX (for_width, min_width);
    }

  get_content_preferred_height (self, for_width,
                                min_height_p, natural_height_p);

  st_theme_node_adjust_preferred_height (theme_node,
                                         min_height_p, natural_height_p);
}

typedef struct {
  int child_index;
  gfloat shrink_amount;
} BoxChildShrink;

/* Sort with the greatest shrink amount first */
static int
compare_by_shrink_amount (const void *a,
                          const void *b)
{
  float diff = ((const BoxChildShrink *)a)->shrink_amount - ((const BoxChildShrink *)b)->shrink_amount;
  return diff < 0 ? 1 : (diff == 0 ? 0 : -1);
}

/* Sort in ascending order by child index */
static int
compare_by_child_index (const void *a,
                        const void *b)
{
  return ((const BoxChildShrink *)a)->child_index - ((const BoxChildShrink *)b)->child_index;
}

static BoxChildShrink *
compute_shrinks (StBoxLayout *self,
                 gfloat       for_length,
                 gfloat       total_shrink)
{
  StBoxLayoutPrivate *priv = self->priv;
  int n_children = clutter_actor_get_n_children (CLUTTER_ACTOR (self));
  BoxChildShrink *shrinks = g_new0 (BoxChildShrink, n_children);
  gfloat shrink_so_far;
  gfloat base_shrink = 0; /* the "= 0" is just to make gcc happy */
  int n_shrink_children;
  ClutterActor *child;
  int i = 0;

  /* The effect that we want is that all the children get an equal chance
   * to expand from their minimum size up to the natural size. Or to put
   * it a different way, we want to start by shrinking only the child that
   * can shrink most, then shrink that and the next most shrinkable child,
   * to the point where we are shrinking everything.
   */

  /* Find the amount of possible shrink for each child */
  int n_possible_shrink_children = 0;
  for (child = clutter_actor_get_first_child (CLUTTER_ACTOR (self));
       child != NULL;
       child = clutter_actor_get_next_sibling (child))
    {
      gfloat child_min, child_nat;
      gboolean child_fill;
      gboolean fixed;

      fixed = clutter_actor_get_fixed_position_set (child);

      shrinks[i].child_index = i;
      if (CLUTTER_ACTOR_IS_VISIBLE (child) && !fixed)
        {
          if (priv->is_vertical)
            {
              clutter_container_child_get ((ClutterContainer*) self, child,
                                           "x-fill", &child_fill,
                                           NULL);
              _st_actor_get_preferred_height (child,
                                              for_length, child_fill,
                                              &child_min, &child_nat);
            }
          else
            {
              clutter_container_child_get ((ClutterContainer*) self, child,
                                           "y-fill", &child_fill,
                                           NULL);
              _st_actor_get_preferred_width (child,
                                             for_length, child_fill,
                                             &child_min, &child_nat);
            }

          shrinks[i].shrink_amount = MAX (0., child_nat - child_min);
          n_possible_shrink_children++;
        }
      else
        {
          shrinks[i].shrink_amount = -1.;
        }

      i++;
    }

  /* We want to process children starting from the child with the maximum available
   * shrink, so sort in this order; !visible children end up at the end */
  qsort (shrinks, n_children, sizeof (BoxChildShrink), compare_by_shrink_amount);

  /*   +--+
   *   |  |
   *   |  | +--
   *   |  | | |
   *   |  | | | +-+
   * --+--+-+-+-+-+----------
   *   |  | | | | | +-+ +-+
   *   |  | | | | | | | | |
   * --+--+-+-+-+-+-+-+------
   *
   * We are trying to find the correct position for the upper line the "water mark"
   * so that total of the portion of the bars above the line is equal to the total
   * amount we want to shrink.
   */

  /* Start by moving the line downward, top-of-bar by top-of-bar */
  shrink_so_far = 0;
  for (n_shrink_children = 1; n_shrink_children <= n_possible_shrink_children; n_shrink_children++)
    {
      if (n_shrink_children < n_possible_shrink_children)
        base_shrink = shrinks[n_shrink_children].shrink_amount;
      else
        base_shrink = 0;
      shrink_so_far += n_shrink_children * (shrinks[n_shrink_children - 1].shrink_amount - base_shrink);

      if (shrink_so_far >= total_shrink || n_shrink_children == n_possible_shrink_children)
        break;
    }

  /* OK, we found enough shrinkage, move it back upwards to the right position */
  base_shrink += (shrink_so_far - total_shrink) / n_shrink_children;
  if (base_shrink < 0) /* can't shrink that much, probably round-off error */
    base_shrink = 0;

  /* Assign the portion above the base shrink line to the shrink_amount */
  for (i = 0; i < n_shrink_children; i++)
    shrinks[i].shrink_amount -= base_shrink;
  for (; i < n_children; i++)
    shrinks[i].shrink_amount = 0;

  /* And sort back to their original order */
  qsort (shrinks, n_children, sizeof (BoxChildShrink), compare_by_child_index);

  return shrinks;
}

static void
st_box_layout_allocate (ClutterActor          *actor,
                        const ClutterActorBox *box,
                        ClutterAllocationFlags flags)
{
  StBoxLayoutPrivate *priv = ST_BOX_LAYOUT (actor)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  ClutterActorBox content_box;
  gfloat avail_width, avail_height, min_width, natural_width, min_height, natural_height;
  gfloat position, next_position;
  gint n_expand_children = 0, i;
  gfloat expand_amount, shrink_amount;
  BoxChildShrink *shrinks = NULL;
                 // Home-made logical xor
  gboolean flip = (!(st_widget_get_direction (ST_WIDGET (actor)) == ST_TEXT_DIRECTION_RTL) != !priv->is_align_end)
                   && (!priv->is_vertical);
  gboolean reverse_order = (!priv->is_align_end != !priv->is_pack_start);
  ClutterActor *child;

  clutter_actor_set_allocation (actor, box, flags);

  st_theme_node_get_content_box (theme_node, box, &content_box);

  avail_width  = content_box.x2 - content_box.x1;
  avail_height = content_box.y2 - content_box.y1;

  get_content_preferred_width (ST_BOX_LAYOUT (actor), avail_height,
                               &min_width, &natural_width);
  get_content_preferred_height (ST_BOX_LAYOUT (actor), MAX (avail_width, min_width),
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

  if (avail_height < min_height)
    {
      avail_height = min_height;
      content_box.y2 = content_box.y1 + avail_height;
    }

  if (avail_width < min_width)
    {
      avail_width = min_width;
      content_box.x2 = content_box.x1 + avail_width;
    }

  if (priv->is_vertical)
    {
      expand_amount = MAX (0, avail_height - natural_height);
      shrink_amount = MAX (0, natural_height - avail_height);
    }
  else
    {
      expand_amount = MAX (0, avail_width - natural_width);
      shrink_amount = MAX (0, natural_width - avail_width);
    }


  if (expand_amount > 0)
    {
      /* count the number of children with expand set to TRUE */
      n_expand_children = 0;
      for (child = clutter_actor_get_first_child (actor);
           child != NULL;
           child = clutter_actor_get_next_sibling (child))
        {
          gboolean expand;

          if (!CLUTTER_ACTOR_IS_VISIBLE (child) ||
              clutter_actor_get_fixed_position_set (child))
            continue;

          clutter_container_child_get ((ClutterContainer *) actor,
                                       child,
                                       "expand", &expand,
                                       NULL);
          if (expand)
            n_expand_children++;
        }

      if (n_expand_children == 0)
        expand_amount = 0;
    }
  else if (shrink_amount > 0)
    {
      shrinks = compute_shrinks (ST_BOX_LAYOUT (actor),
                                 priv->is_vertical ? avail_width : avail_height,
                                 shrink_amount);
     }

  if (priv->is_vertical)
    position = content_box.y1;
  else if (flip)
    position = content_box.x2;
  else
    position = content_box.x1;

  if (reverse_order)
    {
      child = clutter_actor_get_last_child (actor);
      i = clutter_actor_get_n_children (actor);
    }
  else
    {
      child = clutter_actor_get_first_child (actor);
      i = 0;
    }
    
  gfloat init_padding = (avail_width/2) - (natural_width/2);
  while (child != NULL)
    {
      ClutterActorBox child_box;
      gfloat child_min, child_nat, child_allocated;
      gboolean xfill, yfill, expand, fixed;
      StAlign xalign, yalign;

      if (!CLUTTER_ACTOR_IS_VISIBLE (child))
        goto next_child;

      fixed = clutter_actor_get_fixed_position_set (child);
      if (fixed)
        {
          clutter_actor_allocate_preferred_size (child, flags);
          goto next_child;
        }

      clutter_container_child_get ((ClutterContainer*) actor, child,
                                   "x-fill", &xfill,
                                   "y-fill", &yfill,
                                   "x-align", &xalign,
                                   "y-align", &yalign,
                                   "expand", &expand,
                                   NULL);

      if (priv->is_vertical)
        {
          _st_actor_get_preferred_height (child, avail_width, xfill,
                                          &child_min, &child_nat);
        }
      else
        {
          _st_actor_get_preferred_width (child, avail_height, yfill,
                                         &child_min, &child_nat);
        }

      child_allocated = child_nat;
      if (expand_amount > 0 && expand)
        child_allocated +=  expand_amount / n_expand_children;
      else if (shrink_amount > 0)
        child_allocated -= shrinks[i].shrink_amount;

      if (flip) {
        next_position = position - child_allocated;
      }
      else {
        next_position = position + child_allocated;
      }

      if (priv->is_vertical)
        {
          child_box.y1 = (int)(0.5 + position);
          child_box.y2 = (int)(0.5 + next_position);
          child_box.x1 = content_box.x1;
          child_box.x2 = content_box.x2;

          _st_allocate_fill (ST_WIDGET (actor), child, &child_box,
                             xalign, yalign, xfill, yfill);
          clutter_actor_allocate (child, &child_box, flags);

        }
      else
        {
          if (flip)
            {
              child_box.x1 = (int)(0.5 + next_position);
              child_box.x2 = (int)(0.5 + position);
            }
          else
            {
              child_box.x1 = (int)(0.5 + position);
              child_box.x2 = (int)(0.5 + next_position);
            }

          child_box.y1 = content_box.y1;
          child_box.y2 = content_box.y2;

          _st_allocate_fill (ST_WIDGET (actor), child, &child_box,
                             xalign, yalign, xfill, yfill);
          clutter_actor_allocate (child, &child_box, flags);
        }

      if (flip)
        position = next_position - priv->spacing;
      else
        position = next_position + priv->spacing;

    next_child:
      if (reverse_order)
        {
          child = clutter_actor_get_previous_sibling (child);
          i--;
        }
      else
        {
          child = clutter_actor_get_next_sibling (child);
          i++;
        }
    }

  if (shrinks)
    g_free (shrinks);
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
  int old_spacing = priv->spacing;
  double spacing;

  spacing = st_theme_node_get_length (theme_node, "spacing");
  priv->spacing = (int)(spacing + 0.5);
  if (priv->spacing != old_spacing)
    clutter_actor_queue_relayout (CLUTTER_ACTOR (self));

  ST_WIDGET_CLASS (st_box_layout_parent_class)->style_changed (self);
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
  actor_class->get_preferred_width = st_box_layout_get_preferred_width;
  actor_class->get_preferred_height = st_box_layout_get_preferred_height;
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

  pspec = g_param_spec_boolean ("align-end",
                                "Align End",
                                "Whether the children should be flushed to the end",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_ALIGN_END, pspec);

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
  self->priv = BOX_LAYOUT_PRIVATE (self);
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
  g_return_if_fail (ST_IS_BOX_LAYOUT (box));

  if (box->priv->is_vertical != vertical)
    {
      box->priv->is_vertical = vertical;
      clutter_actor_queue_relayout ((ClutterActor*) box);

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
  g_return_val_if_fail (ST_IS_BOX_LAYOUT (box), FALSE);

  return box->priv->is_vertical;
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
  g_return_if_fail (ST_IS_BOX_LAYOUT (box));

  if (box->priv->is_pack_start != pack_start)
    {
      box->priv->is_pack_start = pack_start;
      clutter_actor_queue_relayout ((ClutterActor*) box);

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

  return box->priv->is_pack_start;
}

/**
 * st_box_layout_set_align_end:
 * @box: A #StBoxLayout
 * @align_end: %TRUE if the layout should use align-end
 *
 * Set the value of the #StBoxLayout::align-end property.
 *
 */
void
st_box_layout_set_align_end (StBoxLayout *box,
                             gboolean     align_end)
{
  g_return_if_fail (ST_IS_BOX_LAYOUT (box));

  if (box->priv->is_align_end != align_end)
    {
      box->priv->is_align_end = align_end;
      clutter_actor_queue_relayout ((ClutterActor*) box);

      g_object_notify (G_OBJECT (box), "align-end");
    }
}

/**
 * st_box_layout_get_align_end:
 * @box: A #StBoxLayout
 *
 * Get the value of the #StBoxLayout::align-end property.
 *
 * Returns: %TRUE if align-end is enabled
 */
gboolean
st_box_layout_get_align_end (StBoxLayout *box)
{
  g_return_val_if_fail (ST_IS_BOX_LAYOUT (box), FALSE);

  return box->priv->is_align_end;
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
