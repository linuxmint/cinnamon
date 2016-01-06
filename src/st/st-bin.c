/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-bin.c: Basic container actor
 *
 * Copyright 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
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
 * SECTION:st-bin
 * @short_description: a simple container with one actor
 *
 * #StBin is a simple container capable of having only one
 * #ClutterActor as a child.
 *
 * #StBin inherits from #StWidget, so it is fully themable.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <clutter/clutter.h>

#include "st-bin.h"
#include "st-enum-types.h"
#include "st-private.h"

#define ST_BIN_GET_PRIVATE(obj)       (G_TYPE_INSTANCE_GET_PRIVATE ((obj), ST_TYPE_BIN, StBinPrivate))

struct _StBinPrivate
{
  ClutterActor *child;

  StAlign       x_align;
  StAlign       y_align;

  guint         x_fill : 1;
  guint         y_fill : 1;
};

enum
{
  PROP_0,

  PROP_CHILD,
  PROP_X_ALIGN,
  PROP_Y_ALIGN,
  PROP_X_FILL,
  PROP_Y_FILL
};

static void clutter_container_iface_init (ClutterContainerIface *iface);

G_DEFINE_TYPE_WITH_CODE (StBin, st_bin, ST_TYPE_WIDGET,
                         G_IMPLEMENT_INTERFACE (CLUTTER_TYPE_CONTAINER,
                                                clutter_container_iface_init));

static void
st_bin_add (ClutterContainer *container,
            ClutterActor     *actor)
{
  st_bin_set_child (ST_BIN (container), actor);
}

static void
st_bin_remove (ClutterContainer *container,
               ClutterActor     *actor)
{
  StBinPrivate *priv = ST_BIN (container)->priv;

  if (priv->child == actor)
    st_bin_set_child (ST_BIN (container), NULL);
}

static void
st_bin_foreach (ClutterContainer *container,
                ClutterCallback   callback,
                gpointer          user_data)
{
  StBinPrivate *priv = ST_BIN (container)->priv;

  if (priv->child)
    callback (priv->child, user_data);
}

static void
clutter_container_iface_init (ClutterContainerIface *iface)
{
  iface->add = st_bin_add;
  iface->remove = st_bin_remove;
  iface->foreach = st_bin_foreach;
}

static void
st_bin_paint (ClutterActor *self)
{
  StBinPrivate *priv = ST_BIN (self)->priv;

  /* allow StWidget to paint the background */
  CLUTTER_ACTOR_CLASS (st_bin_parent_class)->paint (self);

  /* the pain our child */
  if (priv->child)
    clutter_actor_paint (priv->child);
}

static void
st_bin_pick (ClutterActor       *self,
             const ClutterColor *pick_color)
{
  StBinPrivate *priv = ST_BIN (self)->priv;

  /* get the default pick implementation */
  CLUTTER_ACTOR_CLASS (st_bin_parent_class)->pick (self, pick_color);

  if (priv->child)
    clutter_actor_paint (priv->child);
}

static void
st_bin_allocate (ClutterActor          *self,
                 const ClutterActorBox *box,
                 ClutterAllocationFlags flags)
{
  StBinPrivate *priv = ST_BIN (self)->priv;

  CLUTTER_ACTOR_CLASS (st_bin_parent_class)->allocate (self, box,
                                                       flags);

  if (priv->child)
    {
      StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));
      ClutterActorBox childbox;

      st_theme_node_get_content_box (theme_node, box, &childbox);
      _st_allocate_fill (ST_WIDGET (self), priv->child, &childbox,
                         priv->x_align, priv->y_align,
                         priv->x_fill, priv->y_fill);
      clutter_actor_allocate (priv->child, &childbox, flags);
    }
}

static void
st_bin_get_preferred_width (ClutterActor *self,
                            gfloat        for_height,
                            gfloat       *min_width_p,
                            gfloat       *natural_width_p)
{
  StBinPrivate *priv = ST_BIN (self)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));

  st_theme_node_adjust_for_height (theme_node, &for_height);

  if (priv->child == NULL)
    {
      if (min_width_p)
        *min_width_p = 0;

      if (natural_width_p)
        *natural_width_p = 0;
    }
  else
    {
      _st_actor_get_preferred_width (priv->child, for_height, priv->y_fill,
                                     min_width_p,
                                     natural_width_p);
    }

  st_theme_node_adjust_preferred_width (theme_node, min_width_p, natural_width_p);
}

static void
st_bin_get_preferred_height (ClutterActor *self,
                             gfloat        for_width,
                             gfloat       *min_height_p,
                             gfloat       *natural_height_p)
{
  StBinPrivate *priv = ST_BIN (self)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));

  st_theme_node_adjust_for_width (theme_node, &for_width);

  if (priv->child == NULL)
    {
      if (min_height_p)
        *min_height_p = 0;

      if (natural_height_p)
        *natural_height_p = 0;
    }
  else
    {
      _st_actor_get_preferred_height (priv->child, for_width, priv->x_fill,
                                      min_height_p,
                                      natural_height_p);
    }

  st_theme_node_adjust_preferred_height (theme_node, min_height_p, natural_height_p);
}

static void
st_bin_dispose (GObject *gobject)
{
  StBinPrivate *priv = ST_BIN (gobject)->priv;

  if (priv->child)
    clutter_actor_destroy (priv->child);
  g_assert (priv->child == NULL);

  G_OBJECT_CLASS (st_bin_parent_class)->dispose (gobject);
}

static gboolean
st_bin_navigate_focus (StWidget         *widget,
                       ClutterActor     *from,
                       GtkDirectionType  direction)
{
  StBinPrivate *priv = ST_BIN (widget)->priv;
  ClutterActor *bin_actor = CLUTTER_ACTOR (widget);

  if (st_widget_get_can_focus (widget))
    {
      if (from && clutter_actor_contains (bin_actor, from))
        return FALSE;

      clutter_actor_grab_key_focus (bin_actor);
      return TRUE;
    }
  else if (priv->child && ST_IS_WIDGET (priv->child))
    return st_widget_navigate_focus (ST_WIDGET (priv->child), from, direction, FALSE);
  else
    return FALSE;
}

static void
st_bin_set_property (GObject      *gobject,
                     guint         prop_id,
                     const GValue *value,
                     GParamSpec   *pspec)
{
  StBin *bin = ST_BIN (gobject);

  switch (prop_id)
    {
    case PROP_CHILD:
      st_bin_set_child (bin, g_value_get_object (value));
      break;

    case PROP_X_ALIGN:
      st_bin_set_alignment (bin,
                            g_value_get_enum (value),
                            bin->priv->y_align);
      break;

    case PROP_Y_ALIGN:
      st_bin_set_alignment (bin,
                            bin->priv->x_align,
                            g_value_get_enum (value));
      break;

    case PROP_X_FILL:
      st_bin_set_fill (bin,
                       g_value_get_boolean (value),
                       bin->priv->y_fill);
      break;

    case PROP_Y_FILL:
      st_bin_set_fill (bin,
                       bin->priv->y_fill,
                       g_value_get_boolean (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
    }
}

static void
st_bin_get_property (GObject    *gobject,
                     guint       prop_id,
                     GValue     *value,
                     GParamSpec *pspec)
{
  StBinPrivate *priv = ST_BIN (gobject)->priv;

  switch (prop_id)
    {
    case PROP_CHILD:
      g_value_set_object (value, priv->child);
      break;

    case PROP_X_FILL:
      g_value_set_boolean (value, priv->x_fill);
      break;

    case PROP_Y_FILL:
      g_value_set_boolean (value, priv->y_fill);
      break;

    case PROP_X_ALIGN:
      g_value_set_enum (value, priv->x_align);
      break;

    case PROP_Y_ALIGN:
      g_value_set_enum (value, priv->y_align);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
    }
}

static void
st_bin_class_init (StBinClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);
  GParamSpec *pspec;

  g_type_class_add_private (klass, sizeof (StBinPrivate));

  gobject_class->set_property = st_bin_set_property;
  gobject_class->get_property = st_bin_get_property;
  gobject_class->dispose = st_bin_dispose;

  actor_class->get_preferred_width = st_bin_get_preferred_width;
  actor_class->get_preferred_height = st_bin_get_preferred_height;
  actor_class->allocate = st_bin_allocate;
  actor_class->paint = st_bin_paint;
  actor_class->pick = st_bin_pick;

  widget_class->navigate_focus = st_bin_navigate_focus;

  /**
   * StBin:child:
   *
   * The child #ClutterActor of the #StBin container.
   */
  pspec = g_param_spec_object ("child",
                               "Child",
                               "The child of the Bin",
                               CLUTTER_TYPE_ACTOR,
                               ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_CHILD, pspec);

  /**
   * StBin:x-align:
   *
   * The horizontal alignment of the #StBin child.
   */
  pspec = g_param_spec_enum ("x-align",
                             "X Align",
                             "The horizontal alignment",
                             ST_TYPE_ALIGN,
                             ST_ALIGN_MIDDLE,
                             ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_X_ALIGN, pspec);

  /**
   * StBin:y-align:
   *
   * The vertical alignment of the #StBin child.
   */
  pspec = g_param_spec_enum ("y-align",
                             "Y Align",
                             "The vertical alignment",
                             ST_TYPE_ALIGN,
                             ST_ALIGN_MIDDLE,
                             ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_Y_ALIGN, pspec);

  /**
   * StBin:x-fill:
   *
   * Whether the child should fill the horizontal allocation
   */
  pspec = g_param_spec_boolean ("x-fill",
                                "X Fill",
                                "Whether the child should fill the "
                                "horizontal allocation",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_X_FILL, pspec);

  /**
   * StBin:y-fill:
   *
   * Whether the child should fill the vertical allocation
   */
  pspec = g_param_spec_boolean ("y-fill",
                                "Y Fill",
                                "Whether the child should fill the "
                                "vertical allocation",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_Y_FILL, pspec);
}

static void
st_bin_init (StBin *bin)
{
  bin->priv = ST_BIN_GET_PRIVATE (bin);

  bin->priv->x_align = ST_ALIGN_MIDDLE;
  bin->priv->y_align = ST_ALIGN_MIDDLE;
}

/**
 * st_bin_new:
 *
 * Creates a new #StBin, a simple container for one child.
 *
 * Return value: the newly created #StBin actor
 */
StWidget *
st_bin_new (void)
{
  return g_object_new (ST_TYPE_BIN, NULL);
}

/**
 * st_bin_set_child:
 * @bin: a #StBin
 * @child: (allow-none): a #ClutterActor, or %NULL
 *
 * Sets @child as the child of @bin.
 *
 * If @bin already has a child, the previous child is removed.
 */
void
st_bin_set_child (StBin        *bin,
                  ClutterActor *child)
{
  StBinPrivate *priv;

  g_return_if_fail (ST_IS_BIN (bin));
  g_return_if_fail (child == NULL || CLUTTER_IS_ACTOR (child));

  priv = bin->priv;

  if (priv->child == child)
    return;

  if (priv->child)
    clutter_actor_remove_child (CLUTTER_ACTOR (bin), priv->child);

  priv->child = NULL;

  if (child)
    {
      priv->child = child;
      clutter_actor_add_child (CLUTTER_ACTOR (bin), child);
    }

  clutter_actor_queue_relayout (CLUTTER_ACTOR (bin));

  g_object_notify (G_OBJECT (bin), "child");
}

/**
 * st_bin_get_child:
 * @bin: a #StBin
 *
 * Retrieves a pointer to the child of @bin.
 *
 * Return value: (transfer none): a #ClutterActor, or %NULL
 */
ClutterActor *
st_bin_get_child (StBin *bin)
{
  g_return_val_if_fail (ST_IS_BIN (bin), NULL);

  return bin->priv->child;
}

/**
 * st_bin_set_alignment:
 * @bin: a #StBin
 * @x_align: horizontal alignment
 * @y_align: vertical alignment
 *
 * Sets the horizontal and vertical alignment of the child
 * inside a #StBin.
 */
void
st_bin_set_alignment (StBin  *bin,
                      StAlign x_align,
                      StAlign y_align)
{
  StBinPrivate *priv;
  gboolean changed = FALSE;

  g_return_if_fail (ST_IS_BIN (bin));

  priv = bin->priv;

  g_object_freeze_notify (G_OBJECT (bin));

  if (priv->x_align != x_align)
    {
      priv->x_align = x_align;
      g_object_notify (G_OBJECT (bin), "x-align");
      changed = TRUE;
    }

  if (priv->y_align != y_align)
    {
      priv->y_align = y_align;
      g_object_notify (G_OBJECT (bin), "y-align");
      changed = TRUE;
    }

  if (changed)
    clutter_actor_queue_relayout (CLUTTER_ACTOR (bin));

  g_object_thaw_notify (G_OBJECT (bin));
}

/**
 * st_bin_get_alignment:
 * @bin: a #StBin
 * @x_align: return location for the horizontal alignment, or %NULL
 * @y_align: return location for the vertical alignment, or %NULL
 *
 * Retrieves the horizontal and vertical alignment of the child
 * inside a #StBin, as set by st_bin_set_alignment().
 */
void
st_bin_get_alignment (StBin   *bin,
                      StAlign *x_align,
                      StAlign *y_align)
{
  StBinPrivate *priv;

  g_return_if_fail (ST_IS_BIN (bin));

  priv = bin->priv;

  if (x_align)
    *x_align = priv->x_align;

  if (y_align)
    *y_align = priv->y_align;
}

/**
 * st_bin_set_fill:
 * @bin: a #StBin
 * @x_fill: %TRUE if the child should fill horizontally the @bin
 * @y_fill: %TRUE if the child should fill vertically the @bin
 *
 * Sets whether the child of @bin should fill out the horizontal
 * and/or vertical allocation of the parent
 */
void
st_bin_set_fill (StBin   *bin,
                 gboolean x_fill,
                 gboolean y_fill)
{
  StBinPrivate *priv;
  gboolean changed = FALSE;

  g_return_if_fail (ST_IS_BIN (bin));

  priv = bin->priv;

  g_object_freeze_notify (G_OBJECT (bin));

  if (priv->x_fill != x_fill)
    {
      priv->x_fill = x_fill;
      changed = TRUE;

      g_object_notify (G_OBJECT (bin), "x-fill");
    }

  if (priv->y_fill != y_fill)
    {
      priv->y_fill = y_fill;
      changed = TRUE;

      g_object_notify (G_OBJECT (bin), "y-fill");
    }

  if (changed)
    clutter_actor_queue_relayout (CLUTTER_ACTOR (bin));

  g_object_thaw_notify (G_OBJECT (bin));
}

/**
 * st_bin_get_fill:
 * @bin: a #StBin
 * @x_fill: (out): return location for the horizontal fill, or %NULL
 * @y_fill: (out): return location for the vertical fill, or %NULL
 *
 * Retrieves the horizontal and vertical fill settings
 */
void
st_bin_get_fill (StBin    *bin,
                 gboolean *x_fill,
                 gboolean *y_fill)
{
  g_return_if_fail (ST_IS_BIN (bin));

  if (x_fill)
    *x_fill = bin->priv->x_fill;

  if (y_fill)
    *y_fill = bin->priv->y_fill;
}
