/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-scrollable-wiget.c: a scrollable actor
 *
 * Copyright 2009 Intel Corporation.
 * Copyright 2009 Abderrahim Kitouni
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2010 Florian Muellner
 * Copyright 2019 Endless, Inc
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
 * SECTION:st-viewport
 * @short_description: a scrollable container
 *
 * The #StViewport is a generic #StScrollable implementation.
 *
 */

#include <stdlib.h>

#include "st-viewport.h"

#include "st-private.h"
#include "st-scrollable.h"


static void st_viewport_scrollable_interface_init (StScrollableInterface *iface);

enum {
  PROP_0,
  PROP_HADJUST,
  PROP_VADJUST
};

struct _StViewportPrivate
{
  StAdjustment *hadjustment;
  StAdjustment *vadjustment;
};

G_DEFINE_TYPE_WITH_CODE (StViewport, st_viewport, ST_TYPE_WIDGET,
                         G_ADD_PRIVATE (StViewport)
                         G_IMPLEMENT_INTERFACE (ST_TYPE_SCROLLABLE,
                                                st_viewport_scrollable_interface_init));

/*
 * StScrollable Interface Implementation
 */
static void
adjustment_value_notify_cb (StAdjustment *adjustment,
                            GParamSpec   *pspec,
                            StViewport   *viewport)
{
  clutter_actor_queue_relayout (CLUTTER_ACTOR (viewport));
}

static void
scrollable_set_adjustments (StScrollable *scrollable,
                            StAdjustment *hadjustment,
                            StAdjustment *vadjustment)
{
  StViewport *viewport = ST_VIEWPORT (scrollable);
  StViewportPrivate *priv =
    st_viewport_get_instance_private (viewport);

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
  StViewport *viewport = ST_VIEWPORT (scrollable);
  StViewportPrivate *priv =
    st_viewport_get_instance_private (viewport);

  if (hadjustment)
    *hadjustment = priv->hadjustment;

  if (vadjustment)
    *vadjustment = priv->vadjustment;
}

static void
st_viewport_scrollable_interface_init (StScrollableInterface *iface)
{
  iface->set_adjustments = scrollable_set_adjustments;
  iface->get_adjustments = scrollable_get_adjustments;
}

static void
st_viewport_get_property (GObject    *object,
                          guint       property_id,
                          GValue     *value,
                          GParamSpec *pspec)
{
  StAdjustment *adjustment;

  switch (property_id)
    {
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
st_viewport_set_property (GObject      *object,
                          guint         property_id,
                          const GValue *value,
                          GParamSpec   *pspec)
{
  StViewport *viewport = ST_VIEWPORT (object);
  StViewportPrivate *priv =
    st_viewport_get_instance_private (viewport);

  switch (property_id)
    {
    case PROP_HADJUST:
      scrollable_set_adjustments (ST_SCROLLABLE (object),
                                  g_value_get_object (value),
                                  priv->vadjustment);
      break;

    case PROP_VADJUST:
      scrollable_set_adjustments (ST_SCROLLABLE (object),
                                  priv->hadjustment,
                                  g_value_get_object (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_viewport_dispose (GObject *object)
{
  StViewport *viewport = ST_VIEWPORT (object);
  StViewportPrivate *priv =
    st_viewport_get_instance_private (viewport);

  g_clear_object (&priv->hadjustment);
  g_clear_object (&priv->vadjustment);

  G_OBJECT_CLASS (st_viewport_parent_class)->dispose (object);
}

static void
st_viewport_allocate (ClutterActor           *actor,
                      const ClutterActorBox  *box,
                      ClutterAllocationFlags  flags)
{
  StViewport *viewport = ST_VIEWPORT (actor);
  StViewportPrivate *priv =
    st_viewport_get_instance_private (viewport);
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  ClutterLayoutManager *layout = clutter_actor_get_layout_manager (actor);
  ClutterActorBox viewport_box;
  ClutterActorBox content_box;
  float avail_width, avail_height;
  float min_width, natural_width;
  float min_height, natural_height;

  st_theme_node_get_content_box (theme_node, box, &viewport_box);
  clutter_actor_box_get_size (&viewport_box, &avail_width, &avail_height);

  clutter_layout_manager_get_preferred_width (layout, CLUTTER_CONTAINER (actor),
                                              avail_height,
                                              &min_width, &natural_width);
  clutter_layout_manager_get_preferred_height (layout, CLUTTER_CONTAINER (actor),
                                               MAX (avail_width, min_width),
                                               &min_height, &natural_height);

  /* Because StViewport implements StScrollable, the allocation box passed here
   * may not match the minimum sizes reported by the layout manager. When that
   * happens, the content box needs to be adjusted to match the reported minimum
   * sizes before being passed to clutter_layout_manager_allocate() */
  clutter_actor_set_allocation (actor, box, flags);

  content_box = viewport_box;
  content_box.x2 += MAX (0, min_width - avail_width);
  content_box.y2 += MAX (0, min_height - avail_height);

  clutter_layout_manager_allocate (layout, CLUTTER_CONTAINER (actor),
                                   &content_box, flags);

  /* update adjustments for scrolling */
  if (priv->vadjustment)
    {
      double prev_value;

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
      double prev_value;

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
st_viewport_apply_transform (ClutterActor *actor,
                             CoglMatrix   *matrix)
{
  StViewport *viewport = ST_VIEWPORT (actor);
  StViewportPrivate *priv = st_viewport_get_instance_private (viewport);
  ClutterActorClass *parent_class =
    CLUTTER_ACTOR_CLASS (st_viewport_parent_class);
  double x, y;

  parent_class->apply_transform (actor, matrix);

  if (priv->hadjustment)
    x = st_adjustment_get_value (priv->hadjustment);
  else
    x = 0;

  if (priv->vadjustment)
    y = st_adjustment_get_value (priv->vadjustment);
  else
    y = 0;

  cogl_matrix_translate (matrix, (int) -x, (int) -y, 0);
}

/* If we are translated, then we need to translate back before chaining
 * up or the background and borders will be drawn in the wrong place */
static void
get_border_paint_offsets (StViewport *viewport,
                          double     *x,
                          double     *y)
{
  StViewportPrivate *priv = st_viewport_get_instance_private (viewport);

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
st_viewport_paint (ClutterActor        *actor,
                   ClutterPaintContext *paint_context)
{
  StViewport *viewport = ST_VIEWPORT (actor);
  StViewportPrivate *priv = st_viewport_get_instance_private (viewport);
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  double x, y;
  ClutterActorBox allocation_box;
  ClutterActorBox content_box;
  ClutterActor *child;
  CoglFramebuffer *fb = clutter_paint_context_get_framebuffer (paint_context);

  get_border_paint_offsets (viewport, &x, &y);
  if (x != 0 || y != 0)
    {
      cogl_framebuffer_push_matrix (fb);
      cogl_framebuffer_translate (fb, (int)x, (int)y, 0);
    }

  st_widget_paint_background (ST_WIDGET (actor), paint_context);

  if (x != 0 || y != 0)
    cogl_framebuffer_pop_matrix (fb);

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
    {
      cogl_framebuffer_push_rectangle_clip (fb,
                                            (int)content_box.x1,
                                            (int)content_box.y1,
                                            (int)content_box.x2,
                                            (int)content_box.y2);
    }

  for (child = clutter_actor_get_first_child (actor);
       child != NULL;
       child = clutter_actor_get_next_sibling (child))
    clutter_actor_paint (child, paint_context);

  if (priv->hadjustment || priv->vadjustment)
    cogl_framebuffer_pop_clip (fb);
}

static void
st_viewport_pick (ClutterActor       *actor,
                  ClutterPickContext *pick_context)
{
  StViewport *viewport = ST_VIEWPORT (actor);
  StViewportPrivate *priv = st_viewport_get_instance_private (viewport);
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  double x, y;
  ClutterActorBox allocation_box;
  ClutterActorBox content_box;
  ClutterActor *child;
  CoglFramebuffer *fb = clutter_pick_context_get_framebuffer (pick_context);

  get_border_paint_offsets (viewport, &x, &y);
  if (x != 0 || y != 0)
    {
      cogl_framebuffer_push_matrix (fb);
      cogl_framebuffer_translate (fb, (int)x, (int)y, 0);
    }

  CLUTTER_ACTOR_CLASS (st_viewport_parent_class)->pick (actor, pick_context);

  if (x != 0 || y != 0)
    cogl_framebuffer_pop_matrix (fb);

  if (clutter_actor_get_n_children (actor) == 0)
    return;

  clutter_actor_get_allocation_box (actor, &allocation_box);
  st_theme_node_get_content_box (theme_node, &allocation_box, &content_box);

  content_box.x1 += x;
  content_box.y1 += y;
  content_box.x2 += x;
  content_box.y2 += y;

  if (priv->hadjustment || priv->vadjustment)
    {
      cogl_framebuffer_push_rectangle_clip (fb,
                                            (int)content_box.x1,
                                            (int)content_box.y1,
                                            (int)content_box.x2,
                                            (int)content_box.y2);
    }

  for (child = clutter_actor_get_first_child (actor);
       child != NULL;
       child = clutter_actor_get_next_sibling (child))
    clutter_actor_pick (child, pick_context);

  if (priv->hadjustment || priv->vadjustment)
    cogl_framebuffer_pop_clip (fb);
}

static gboolean
st_viewport_get_paint_volume (ClutterActor       *actor,
                              ClutterPaintVolume *volume)
{
  StViewport *viewport = ST_VIEWPORT (actor);
  StViewportPrivate *priv = st_viewport_get_instance_private (viewport);
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  ClutterActorBox allocation_box;
  ClutterActorBox content_box;
  graphene_point3d_t origin;
  double x, y, lower, upper;

  /* Setting the paint volume does not make sense when we don't have any allocation */
  if (!clutter_actor_has_allocation (actor))
    return FALSE;

  /* When have an adjustment we are clipped to the content box, so base
   * our paint volume on that. */
  if (priv->hadjustment || priv->vadjustment)
    {
      double width, height;

      clutter_actor_get_allocation_box (actor, &allocation_box);
      st_theme_node_get_content_box (theme_node, &allocation_box, &content_box);
      origin.x = content_box.x1 - allocation_box.x1;
      origin.y = content_box.y1 - allocation_box.y2;
      origin.z = 0.f;

      if (priv->hadjustment)
        {
          g_object_get (priv->hadjustment,
                        "lower", &lower,
                        "upper", &upper,
                        NULL);
          width = upper - lower;
        }
      else
        {
          width = content_box.x2 - content_box.x1;
        }

      if (priv->vadjustment)
        {
          g_object_get (priv->vadjustment,
                        "lower", &lower,
                        "upper", &upper,
                        NULL);
          height = upper - lower;
        }
      else
        {
          height = content_box.y2 - content_box.y1;
        }

      clutter_paint_volume_set_width (volume, width);
      clutter_paint_volume_set_height (volume, height);
    }
  else if (!CLUTTER_ACTOR_CLASS (st_viewport_parent_class)->get_paint_volume (actor, volume))
    {
      return FALSE;
    }

  /* When scrolled, st_viewport_apply_transform() includes the scroll offset
   * and affects paint volumes. This is right for our children, but our paint volume
   * is determined by our allocation and borders and doesn't scroll, so we need
   * to reverse-compensate here, the same as we do when painting.
   */
  get_border_paint_offsets (viewport, &x, &y);
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
st_viewport_class_init (StViewportClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);

  object_class->get_property = st_viewport_get_property;
  object_class->set_property = st_viewport_set_property;
  object_class->dispose = st_viewport_dispose;

  actor_class->allocate = st_viewport_allocate;
  actor_class->apply_transform = st_viewport_apply_transform;

  actor_class->paint = st_viewport_paint;
  actor_class->get_paint_volume = st_viewport_get_paint_volume;
  actor_class->pick = st_viewport_pick;

  /* StScrollable properties */
  g_object_class_override_property (object_class,
                                    PROP_HADJUST,
                                    "hadjustment");

  g_object_class_override_property (object_class,
                                    PROP_VADJUST,
                                    "vadjustment");

}

static void
st_viewport_init (StViewport *self)
{
}
