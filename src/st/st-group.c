/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-group.c: A fixed layout container based on ClutterGroup
 *
 * Copyright 2010 Florian Müllner
 * Copyright 2010 Intel Corporation
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
 * SECTION:st-group
 * SECTION:clutter-group
 * @short_description: A fixed layout container
 *
 * A #StGroup is an Actor which contains multiple child actors positioned
 * relative to the #StGroup position. Other operations such as scaling,
 * rotating and clipping of the group will apply to the child actors.
 *
 * A #StGroup's size is defined by the size and position of its children;
 * it will be the smallest non-negative size that covers the right and bottom
 * edges of all of its children.
 *
 * Setting the size on a Group using #ClutterActor methods like
 * clutter_actor_set_size() will override the natural size of the Group,
 * however this will not affect the size of the children and they may still
 * be painted outside of the allocation of the group. One way to constrain
 * the visible area of a #StGroup to a specified allocation is to
 * explicitly set the size of the #StGroup and then use the
 * #ClutterActor:clip-to-allocation property.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <clutter/clutter.h>

#include "st-group.h"
#include "st-enum-types.h"
#include "st-private.h"

G_DEFINE_TYPE (StGroup, st_group, ST_TYPE_CONTAINER);

static void
st_group_get_preferred_width (ClutterActor *actor,
                              gfloat        for_height,
                              gfloat       *min_width_p,
                              gfloat       *natural_width_p)
{
  StThemeNode *node = st_widget_get_theme_node (ST_WIDGET (actor));
  gdouble min_width, natural_width;
  gint css_width, css_min_width, css_max_width;
  GList *l, *children;

  css_width = st_theme_node_get_width (node);
  css_min_width = st_theme_node_get_min_width (node);
  css_max_width = st_theme_node_get_max_width (node);

  /* We will always be at least 0 sized (ie, if all of the actors are
   * to the left of the origin we won't return a negative size)
   */
  min_width = 0;
  natural_width = 0;

  children = st_container_get_children_list (ST_CONTAINER (actor));

  for (l = children; l != NULL; l = l->next)
    {
      ClutterActor *child = l->data;
      gfloat child_x, child_min, child_nat;

      child_x = clutter_actor_get_x (child);

      /* for_height is irrelevant to the fixed layout, so it's not used */
      _st_actor_get_preferred_width (child, -1, FALSE,
                                     &child_min, &child_nat);

      /* Track the rightmost edge */
      if (child_x + child_min > min_width)
        min_width = child_x + child_min;

      if (child_x + child_nat > natural_width)
        natural_width = child_x + child_nat;
    }

  /* The size is defined as the distance from the origin to the right-hand
   * edge of the rightmost actor, unless overridden with min-width
   */
  if (min_width_p)
    {
      if (css_min_width != -1)
        *min_width_p = css_min_width;
      else
        *min_width_p = min_width;
    }

  if (natural_width_p)
    {
      if (css_width != -1)
        natural_width = css_width;
      *natural_width_p = MIN (natural_width, css_max_width);
    }
}

static void
st_group_get_preferred_height (ClutterActor *actor,
                               gfloat        for_width,
                               gfloat       *min_height_p,
                               gfloat       *natural_height_p)
{
  StThemeNode *node = st_widget_get_theme_node (ST_WIDGET (actor));
  gdouble min_height, natural_height;
  gint css_height, css_min_height, css_max_height;
  GList *l, *children;

  css_height = st_theme_node_get_height (node);
  css_min_height = st_theme_node_get_min_height (node);
  css_max_height = st_theme_node_get_max_height (node);

  /* We will always be at least 0 sized (ie, if all of the actors are
   * above of the origin we won't return a negative size)
   */
  min_height = 0;
  natural_height = 0;

  children = st_container_get_children_list (ST_CONTAINER (actor));

  for (l = children; l != NULL; l = l->next)
    {
      ClutterActor *child = l->data;
      gfloat child_y, child_min, child_nat;

      child_y = clutter_actor_get_y (child);

      /* for_width is irrelevant to the fixed layout, so it's not used */
      _st_actor_get_preferred_height (child, -1, FALSE,
                                      &child_min, &child_nat);

      /* Track the bottommost edge */
      if (child_y + child_min > min_height)
        min_height = child_y + child_min;

      if (child_y + child_nat > natural_height)
        natural_height = child_y + child_nat;
    }

  /* The size is defined as the distance from the origin to the right-hand
   * edge of the rightmost actor, unless overridden with min-height
   */
  if (min_height_p)
    {
      if (css_min_height != -1)
        *min_height_p = css_min_height;
      else
        *min_height_p = min_height;
    }

  if (natural_height_p)
    {
      if (css_height != -1)
        natural_height = css_height;
      *natural_height_p = MIN (natural_height, css_max_height);
    }
}

static void
st_group_allocate (ClutterActor           *actor,
                   const ClutterActorBox  *box,
                   ClutterAllocationFlags  flags)
{
  GList *l, *children;

  CLUTTER_ACTOR_CLASS (st_group_parent_class)->allocate (actor, box, flags);

  children = st_container_get_children_list (ST_CONTAINER (actor));
  for (l = children; l != NULL; l = l->next)
    {
      ClutterActor *child = l->data;
      clutter_actor_allocate_preferred_size (child, flags);
    }
}

static void
st_group_show_all (ClutterActor *actor)
{
  clutter_container_foreach (CLUTTER_CONTAINER (actor),
                             CLUTTER_CALLBACK (clutter_actor_show),
                             NULL);
  clutter_actor_show (actor);
}

static void
st_group_hide_all (ClutterActor *actor)
{
  clutter_actor_hide (actor);
  clutter_container_foreach (CLUTTER_CONTAINER (actor),
                             CLUTTER_CALLBACK (clutter_actor_hide),
                             NULL);
}


static void
st_group_class_init (StGroupClass *klass)
{
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);

  actor_class->get_preferred_width = st_group_get_preferred_width;
  actor_class->get_preferred_height = st_group_get_preferred_height;
  actor_class->allocate = st_group_allocate;
  actor_class->show_all = st_group_show_all;
  actor_class->hide_all = st_group_hide_all;
}

static void
st_group_init (StGroup *self)
{
}

/**
 * st_group_new:
 *
 * Create a new  #StGroup.
 *
 * Return value: the newly created #StGroup actor
 */
StWidget *
st_group_new (void)
{
  return g_object_new (ST_TYPE_GROUP, NULL);
}
