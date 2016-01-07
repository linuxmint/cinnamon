/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-container.c: Base class for St container actors
 *
 * Copyright 2007 OpenedHand
 * Copyright 2008, 2009 Intel Corporation.
 * Copyright 2010 Florian Müllner
 * Copyright 2010 Red Hat, Inc.
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

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <stdlib.h>

#include "st-container.h"

G_DEFINE_ABSTRACT_TYPE (StContainer, st_container, ST_TYPE_WIDGET);

void
st_container_move_child (StContainer  *container,
                         ClutterActor *actor,
                         int           pos)
{
  clutter_actor_set_child_at_index (CLUTTER_ACTOR (container),
                                    actor, pos);
}

void
st_container_move_before (StContainer  *container,
                          ClutterActor *actor,
                          ClutterActor *sibling)
{
  clutter_actor_set_child_below_sibling (CLUTTER_ACTOR (container),
                                         actor, sibling);
}

/**
 * st_container_get_children_list:
 * @container: An #StContainer
 *
 * Get the internal list of @container's child actors. This function
 * should only be used by subclasses of StContainer
 *
 * Returns: (element-type Clutter.Actor) (transfer none): list of @container's child actors
 */
GList *
st_container_get_children_list (StContainer *container)
{
  return clutter_actor_get_children (CLUTTER_ACTOR (container));
}

static gboolean
st_container_get_paint_volume (ClutterActor *actor,
                               ClutterPaintVolume *volume)
{
  if (!CLUTTER_ACTOR_CLASS (st_container_parent_class)->get_paint_volume (actor, volume))
    return FALSE;

  if (!clutter_actor_get_clip_to_allocation (actor))
    {
      ClutterActor *child;

      for (child = clutter_actor_get_first_child (actor);
           child != NULL;
           child = clutter_actor_get_next_sibling (child))
        {
          const ClutterPaintVolume *child_volume;

          child_volume = clutter_actor_get_transformed_paint_volume (child, actor);
          if (!child_volume)
            return FALSE;

          clutter_paint_volume_union (volume, child_volume);
        }
    }

  return TRUE;
}

static void
st_container_init (StContainer *container)
{
}

static void
st_container_class_init (StContainerClass *klass)
{
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);

  actor_class->get_paint_volume = st_container_get_paint_volume;
}
