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

#define ST_CONTAINER_GET_PRIVATE(obj) (G_TYPE_INSTANCE_GET_PRIVATE ((obj),ST_TYPE_CONTAINER, StContainerPrivate))

struct _StContainerPrivate
{
  GList *children;
  ClutterActor *first_child;
  ClutterActor *last_child;
  gboolean block_update_pseudo_classes;
};

static void clutter_container_iface_init (ClutterContainerIface *iface);

G_DEFINE_ABSTRACT_TYPE_WITH_CODE (StContainer, st_container, ST_TYPE_WIDGET,
                                  G_IMPLEMENT_INTERFACE (CLUTTER_TYPE_CONTAINER,
                                                         clutter_container_iface_init));

static void
st_container_update_pseudo_classes (StContainer *container)
{
  GList *first_item, *last_item;
  ClutterActor *first_child, *last_child;
  StContainerPrivate *priv = container->priv;

  if (priv->block_update_pseudo_classes)
    return;

  first_item = priv->children;
  first_child = first_item ? first_item->data : NULL;
  if (first_child != priv->first_child)
    {
      if (priv->first_child && ST_IS_WIDGET (priv->first_child))
        st_widget_remove_style_pseudo_class (ST_WIDGET (priv->first_child),
                                             "first-child");
      if (priv->first_child)
        {
          g_object_unref (priv->first_child);
          priv->first_child = NULL;
        }

      if (first_child && ST_IS_WIDGET (first_child))
        st_widget_add_style_pseudo_class (ST_WIDGET (first_child),
                                          "first-child");
      if (first_child)
        priv->first_child = g_object_ref (first_child);
    }

  last_item = g_list_last (priv->children);
  last_child = last_item ? last_item->data : NULL;
  if (last_child != priv->last_child)
    {
      if (priv->last_child && ST_IS_WIDGET (priv->last_child))
        st_widget_remove_style_pseudo_class (ST_WIDGET (priv->last_child),
                                             "last-child");
      if (priv->last_child)
        {
          g_object_unref (priv->last_child);
          priv->last_child = NULL;
        }

      if (last_child && ST_IS_WIDGET (last_child))
        st_widget_add_style_pseudo_class (ST_WIDGET (last_child),
                                          "last-child");
      if (last_child)
        priv->last_child = g_object_ref (last_child);
    }
}

/**
 * st_container_destroy_children:
 * @container: An #StContainer
 *
 * Destroys all child actors from @container.
 */
void
st_container_destroy_children (StContainer *container)
{
  StContainerPrivate *priv = container->priv;

  priv->block_update_pseudo_classes = TRUE;

  while (priv->children)
    clutter_actor_destroy (priv->children->data);

  priv->block_update_pseudo_classes = FALSE;

  st_container_update_pseudo_classes (container);
}

void
st_container_move_child (StContainer  *container,
                         ClutterActor *actor,
                         int           pos)
{
  StContainerPrivate *priv = container->priv;
  GList *item = NULL;

  item = g_list_find (priv->children, actor);

  if (item == NULL)
    {
      g_warning ("Actor of type '%s' is not a child of the %s container",
                 g_type_name (G_OBJECT_TYPE (actor)),
                 g_type_name (G_OBJECT_TYPE (container)));
      return;
    }

  priv->children = g_list_delete_link (priv->children, item);
  priv->children = g_list_insert (priv->children, actor, pos);

  st_container_update_pseudo_classes (container);

  clutter_actor_queue_relayout ((ClutterActor*) container);
}

void
st_container_move_before (StContainer  *container,
                          ClutterActor *actor,
                          ClutterActor *sibling)
{
  StContainerPrivate *priv = container->priv;
  GList *actor_item = NULL;
  GList *sibling_item = NULL;

  actor_item = g_list_find (priv->children, actor);
  sibling_item = g_list_find (priv->children, sibling);

  g_return_if_fail (actor_item != NULL);
  g_return_if_fail (sibling_item != NULL);

  priv->children = g_list_delete_link (priv->children, actor_item);
  priv->children = g_list_insert_before (priv->children, sibling_item, actor);

  st_container_update_pseudo_classes (container);

  clutter_actor_queue_relayout (CLUTTER_ACTOR (container));
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
  g_return_val_if_fail (ST_IS_CONTAINER (container), NULL);

  return container->priv->children;
}

static GList *
st_container_get_focus_chain (StWidget *widget)
{
  StContainer *container = ST_CONTAINER (widget);
  GList *chain, *children;

  chain = NULL;
  for (children = container->priv->children; children; children = children->next)
    {
      ClutterActor *child = children->data;

      if (CLUTTER_ACTOR_IS_VISIBLE (child))
        chain = g_list_prepend (chain, child);
    }

  return g_list_reverse (chain);
}

static gint
sort_z_order (gconstpointer a,
              gconstpointer b)
{
  float depth_a, depth_b;

  depth_a = clutter_actor_get_depth (CLUTTER_ACTOR (a));
  depth_b = clutter_actor_get_depth (CLUTTER_ACTOR (b));

  if (depth_a < depth_b)
    return -1;
  if (depth_a > depth_b)
    return 1;
  return 0;
}

static void
st_container_add (ClutterContainer *container,
                  ClutterActor     *actor)
{
  StContainerPrivate *priv = ST_CONTAINER (container)->priv;

  g_object_ref (actor);

  priv->children = g_list_append (priv->children, actor);
  clutter_actor_add_child (CLUTTER_ACTOR (container), actor);

  /* queue a relayout, to get the correct positioning inside
   * the ::actor-added signal handlers
   */
  clutter_actor_queue_relayout (CLUTTER_ACTOR (container));

  g_signal_emit_by_name (container, "actor-added", actor);

  clutter_container_sort_depth_order (container);
  st_container_update_pseudo_classes (ST_CONTAINER (container));

  g_object_unref (actor);
}

static void
st_container_remove (ClutterContainer *container,
                     ClutterActor     *actor)
{
  StContainerPrivate *priv = ST_CONTAINER (container)->priv;

  g_object_ref (actor);

  priv->children = g_list_remove (priv->children, actor);
  clutter_actor_unparent (actor);

  /* queue a relayout, to get the correct positioning inside
   * the ::actor-removed signal handlers
   */
  clutter_actor_queue_relayout (CLUTTER_ACTOR (container));

  /* at this point, the actor passed to the "actor-removed" signal
   * handlers is not parented anymore to the container but since we
   * are holding a reference on it, it's still valid
   */
  g_signal_emit_by_name (container, "actor-removed", actor);

  st_container_update_pseudo_classes (ST_CONTAINER (container));

  if (CLUTTER_ACTOR_IS_VISIBLE (container))
    clutter_actor_queue_redraw (CLUTTER_ACTOR (container));

  g_object_unref (actor);
}

static void
st_container_foreach (ClutterContainer *container,
                      ClutterCallback   callback,
                      gpointer          user_data)
{
  StContainerPrivate *priv = ST_CONTAINER (container)->priv;

  /* Using g_list_foreach instead of iterating the list manually
   * because it has better protection against the current node being
   * removed. This will happen for example if someone calls
   * clutter_container_foreach(container, clutter_actor_destroy)
   */
  g_list_foreach (priv->children, (GFunc) callback, user_data);
}

static void
st_container_raise (ClutterContainer *container,
                    ClutterActor     *actor,
                    ClutterActor     *sibling)
{
  StContainerPrivate *priv = ST_CONTAINER (container)->priv;

  priv->children = g_list_remove (priv->children, actor);

  /* Raise at the top */
  if (!sibling)
    {
      GList *last_item;

      last_item = g_list_last (priv->children);

      if (last_item)
        sibling = last_item->data;

      priv->children = g_list_append (priv->children, actor);
    }
  else
    {
      gint pos;

      pos = g_list_index (priv->children, sibling) + 1;

      priv->children = g_list_insert (priv->children, actor, pos);
    }

  /* set Z ordering a value below, this will then call sort
   * as values are equal ordering shouldn't change but Z
   * values will be correct.
   *
   * FIXME: optimise
   */
  if (sibling &&
      clutter_actor_get_depth (sibling) != clutter_actor_get_depth (actor))
    {
      clutter_actor_set_depth (actor, clutter_actor_get_depth (sibling));
    }

  st_container_update_pseudo_classes (ST_CONTAINER (container));

  if (CLUTTER_ACTOR_IS_VISIBLE (container))
    clutter_actor_queue_redraw (CLUTTER_ACTOR (container));
}

static void
st_container_lower (ClutterContainer *container,
                    ClutterActor     *actor,
                    ClutterActor     *sibling)
{
  StContainerPrivate *priv = ST_CONTAINER (container)->priv;

  priv->children = g_list_remove (priv->children, actor);

  /* Push to bottom */
  if (!sibling)
    {
      GList *last_item;

      last_item = g_list_first (priv->children);

      if (last_item)
        sibling = last_item->data;

      priv->children = g_list_prepend (priv->children, actor);
    }
  else
    {
      gint pos;

      pos = g_list_index (priv->children, sibling);

      priv->children = g_list_insert (priv->children, actor, pos);
    }

  /* See comment in st_container_raise() for this */
  if (sibling &&
      clutter_actor_get_depth (sibling) != clutter_actor_get_depth (actor))
    {
      clutter_actor_set_depth (actor, clutter_actor_get_depth (sibling));
    }

  st_container_update_pseudo_classes (ST_CONTAINER (container));

  if (CLUTTER_ACTOR_IS_VISIBLE (container))
    clutter_actor_queue_redraw (CLUTTER_ACTOR (container));
}

static void
st_container_sort_depth_order (ClutterContainer *container)
{
  StContainerPrivate *priv = ST_CONTAINER (container)->priv;

  priv->children = g_list_sort (priv->children, sort_z_order);

  if (CLUTTER_ACTOR_IS_VISIBLE (container))
    clutter_actor_queue_redraw (CLUTTER_ACTOR (container));
}

static void
st_container_dispose (GObject *object)
{
  StContainerPrivate *priv = ST_CONTAINER (object)->priv;

  if (priv->children)
    {
      clutter_actor_destroy_all_children (CLUTTER_ACTOR (object));
      g_list_free (priv->children);

      priv->children = NULL;
    }

  if (priv->first_child)
    g_object_unref (priv->first_child);
  priv->first_child = NULL;

  if (priv->last_child)
    g_object_unref (priv->last_child);
  priv->last_child = NULL;

  G_OBJECT_CLASS (st_container_parent_class)->dispose (object);
}

static gboolean
st_container_get_paint_volume (ClutterActor *actor,
                               ClutterPaintVolume *volume)
{
  StContainerPrivate *priv = ST_CONTAINER (actor)->priv;
  GList *l;

  if (!CLUTTER_ACTOR_CLASS (st_container_parent_class)->get_paint_volume (actor, volume))
    return FALSE;

  if (!clutter_actor_get_clip_to_allocation (actor))
    {
      /* Based on ClutterGroup/ClutterBox; include the children's
       * paint volumes, since they may paint outside our allocation.
       */
      for (l = priv->children; l != NULL; l = l->next)
        {
          ClutterActor *child = l->data;
          const ClutterPaintVolume *child_volume;

          child_volume = clutter_actor_get_transformed_paint_volume (child, actor);
          if (!child_volume)
            return FALSE;

          clutter_paint_volume_union (volume, child_volume);
        }
    }

  return TRUE;
}

/* filter @children to contain only only actors that overlap @rbox
 * when moving in @direction. (Assuming no transformations.)
 */
static GList *
filter_by_position (GList            *children,
                    ClutterActorBox  *rbox,
                    GtkDirectionType  direction)
{
  ClutterActorBox cbox;
  GList *l, *ret;
  ClutterActor *child;

  for (l = children, ret = NULL; l; l = l->next)
    {
      child = l->data;
      clutter_actor_get_allocation_box (child, &cbox);

      /* Filter out children if they are in the wrong direction from
       * @rbox, or if they don't overlap it. To account for floating-
       * point imprecision, an actor is "down" (etc.) from an another
       * actor even if it overlaps it by up to 0.1 pixels.
       */
      switch (direction)
        {
        case GTK_DIR_UP:
          if (cbox.y2 > rbox->y1 + 0.1)
            continue;
          if (cbox.x1 >= rbox->x2 || cbox.x2 <= rbox->x1)
            continue;
          break;

        case GTK_DIR_DOWN:
          if (cbox.y1 < rbox->y2 - 0.1)
            continue;
          if (cbox.x1 >= rbox->x2 || cbox.x2 <= rbox->x1)
            continue;
          break;

        case GTK_DIR_LEFT:
          if (cbox.x2 > rbox->x1 + 0.1)
            continue;
          if (cbox.y1 >= rbox->y2 || cbox.y2 <= rbox->y1)
            continue;
          break;

        case GTK_DIR_RIGHT:
          if (cbox.x1 < rbox->x2 - 0.1)
            continue;
          if (cbox.y1 >= rbox->y2 || cbox.y2 <= rbox->y1)
            continue;
          break;

        default:
          g_return_val_if_reached (NULL);
        }

      ret = g_list_prepend (ret, child);
    }

  g_list_free (children);
  return ret;
}

typedef struct {
  GtkDirectionType direction;
  ClutterActorBox box;
} StContainerChildSortData;

static int
sort_by_position (gconstpointer  a,
                  gconstpointer  b,
                  gpointer       user_data)
{
  ClutterActor *actor_a = (ClutterActor *)a;
  ClutterActor *actor_b = (ClutterActor *)b;
  StContainerChildSortData *sort_data = user_data;
  GtkDirectionType direction = sort_data->direction;
  ClutterActorBox abox, bbox;
  int ax, ay, bx, by;
  int cmp, fmid;

  /* Determine the relationship, relative to motion in @direction, of
   * the center points of the two actors. Eg, for %GTK_DIR_UP, we
   * return a negative number if @actor_a's center is below @actor_b's
   * center, and postive if vice versa, which will result in an
   * overall list sorted bottom-to-top.
   */

  clutter_actor_get_allocation_box (actor_a, &abox);
  ax = (int)(abox.x1 + abox.x2) / 2;
  ay = (int)(abox.y1 + abox.y2) / 2;
  clutter_actor_get_allocation_box (actor_b, &bbox);
  bx = (int)(bbox.x1 + bbox.x2) / 2;
  by = (int)(bbox.y1 + bbox.y2) / 2;

  switch (direction)
    {
    case GTK_DIR_UP:
      cmp = by - ay;
      break;
    case GTK_DIR_DOWN:
      cmp = ay - by;
      break;
    case GTK_DIR_LEFT:
      cmp = bx - ax;
      break;
    case GTK_DIR_RIGHT:
      cmp = ax - bx;
      break;
    default:
      g_return_val_if_reached (0);
    }

  if (cmp)
    return cmp;

  /* If two actors have the same center on the axis being sorted,
   * prefer the one that is closer to the center of the current focus
   * actor on the other axis. Eg, for %GTK_DIR_UP, prefer whichever
   * of @actor_a and @actor_b has a horizontal center closest to the
   * current focus actor's horizontal center.
   *
   * (This matches GTK's behavior.)
   */
  switch (direction)
    {
    case GTK_DIR_UP:
    case GTK_DIR_DOWN:
      fmid = (int)(sort_data->box.x1 + sort_data->box.x2) / 2;
      return abs (ax - fmid) - abs (bx - fmid);
    case GTK_DIR_LEFT:
    case GTK_DIR_RIGHT:
      fmid = (int)(sort_data->box.y1 + sort_data->box.y2) / 2;
      return abs (ay - fmid) - abs (by - fmid);
    default:
      g_return_val_if_reached (0);
    }
}

static gboolean
st_container_navigate_focus (StWidget         *widget,
                             ClutterActor     *from,
                             GtkDirectionType  direction)
{
  StContainer *container = ST_CONTAINER (widget);
  ClutterActor *container_actor, *focus_child;
  GList *children, *l;

  container_actor = CLUTTER_ACTOR (widget);
  if (from == container_actor)
    return FALSE;

  /* Figure out if @from is a descendant of @container, and if so,
   * set @focus_child to the immediate child of @container that
   * contains (or *is*) @from.
   */
  focus_child = from;
  while (focus_child && clutter_actor_get_parent (focus_child) != container_actor)
    focus_child = clutter_actor_get_parent (focus_child);

  if (st_widget_get_can_focus (widget))
    {
      if (!focus_child)
        {
          /* Accept focus from outside */
          clutter_actor_grab_key_focus (container_actor);
          return TRUE;
        }
      else
        {
          /* Yield focus from within: since @container itself is
           * focusable we don't allow the focus to be navigated
           * within @container.
           */
          return FALSE;
        }
    }

  /* See if we can navigate within @focus_child */
  if (focus_child && ST_IS_WIDGET (focus_child))
    {
      if (st_widget_navigate_focus (ST_WIDGET (focus_child), from, direction, FALSE))
        return TRUE;
    }

  /* At this point we know that we want to navigate focus to one of
   * @container's immediate children; the next one after @focus_child,
   * or the first one if @focus_child is %NULL. (With "next" and
   * "first" being determined by @direction.)
   */

  children = st_widget_get_focus_chain (ST_WIDGET (container));
  if (direction == GTK_DIR_TAB_FORWARD ||
      direction == GTK_DIR_TAB_BACKWARD)
    {
      if (direction == GTK_DIR_TAB_BACKWARD)
        children = g_list_reverse (children);

      if (focus_child)
        {
          /* Remove focus_child and any earlier children */
          while (children && children->data != focus_child)
            children = g_list_delete_link (children, children);
          if (children)
            children = g_list_delete_link (children, children);
        }
    }
  else /* direction is an arrow key, not tab */
    {
      StContainerChildSortData sort_data;

      /* Compute the allocation box of the previous focused actor, in
       * @container's coordinate space. If there was no previous focus,
       * use the coordinates of the appropriate edge of @container.
       *
       * Note that all of this code assumes the actors are not
       * transformed (or at most, they are all scaled by the same
       * amount). If @container or any of its children is rotated, or
       * any child is inconsistently scaled, then the focus chain will
       * probably be unpredictable.
       */
      if (focus_child)
        {
          clutter_actor_get_allocation_box (focus_child, &sort_data.box);
        }
      else
        {
          clutter_actor_get_allocation_box (CLUTTER_ACTOR (container), &sort_data.box);
          switch (direction)
            {
            case GTK_DIR_UP:
              sort_data.box.y1 = sort_data.box.y2;
              break;
            case GTK_DIR_DOWN:
              sort_data.box.y2 = sort_data.box.y1;
              break;
            case GTK_DIR_LEFT:
              sort_data.box.x1 = sort_data.box.x2;
              break;
            case GTK_DIR_RIGHT:
              sort_data.box.x2 = sort_data.box.x1;
              break;
            default:
              g_warn_if_reached ();
            }
        }
      sort_data.direction = direction;

      if (focus_child)
        children = filter_by_position (children, &sort_data.box, direction);
      if (children)
        children = g_list_sort_with_data (children, sort_by_position, &sort_data);
    }

  /* Now try each child in turn */
  for (l = children; l; l = l->next)
    {
      if (ST_IS_WIDGET (l->data))
        {
          if (st_widget_navigate_focus (l->data, from, direction, FALSE))
            {
              g_list_free (children);
              return TRUE;
            }
        }
    }

  g_list_free (children);
  return FALSE;
}

static void
clutter_container_iface_init (ClutterContainerIface *iface)
{
  iface->add = st_container_add;
  iface->remove = st_container_remove;
  iface->foreach = st_container_foreach;
  iface->raise = st_container_raise;
  iface->lower = st_container_lower;
  iface->sort_depth_order = st_container_sort_depth_order;
}

static void
st_container_init (StContainer *container)
{
  container->priv = ST_CONTAINER_GET_PRIVATE (container);
}

static void
st_container_class_init (StContainerClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);

  g_type_class_add_private (klass, sizeof (StContainerPrivate));

  object_class->dispose = st_container_dispose;

  actor_class->get_paint_volume = st_container_get_paint_volume;

  widget_class->get_focus_chain = st_container_get_focus_chain;
  widget_class->navigate_focus = st_container_navigate_focus;
}
