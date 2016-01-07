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

G_DEFINE_TYPE (StGroup, st_group, ST_TYPE_WIDGET);

static void
st_group_class_init (StGroupClass *klass)
{
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
