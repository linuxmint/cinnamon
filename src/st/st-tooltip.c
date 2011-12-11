/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-tooltip.c: Plain tooltip actor
 *
 * Copyright 2008, 2009 Intel Corporation
 * Copyright 2009 Red Hat, Inc.
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
 * SECTION:st-tooltip
 * @short_description: A tooltip widget
 *
 * #StTooltip implements a single tooltip. It should not normally be created
 * by the application but by the widget implementing tooltip capabilities, for
 * example, #st_button_set_tooltip().
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <math.h>
#include <stdlib.h>
#include <string.h>

#include <glib.h>

#include <clutter/clutter.h>

#include "st-tooltip.h"

#include "st-widget.h"
#include "st-label.h"
#include "st-private.h"

enum
{
  PROP_0,

  PROP_LABEL,
  PROP_TIP_AREA
};

#define ST_TOOLTIP_GET_PRIVATE(obj)    \
  (G_TYPE_INSTANCE_GET_PRIVATE ((obj), ST_TYPE_TOOLTIP, StTooltipPrivate))

struct _StTooltipPrivate
{
  StLabel         *label;

  ClutterGeometry *tip_area;
};

extern gfloat st_slow_down_factor;

G_DEFINE_TYPE (StTooltip, st_tooltip, ST_TYPE_WIDGET);

static void st_tooltip_show (ClutterActor *self);
static void st_tooltip_show_all (ClutterActor *self);
static void st_tooltip_hide_all (ClutterActor *self);

static void st_tooltip_constrain (StTooltip             *tooltip,
                                  const ClutterGeometry *geometry,
                                  ClutterGeometry       *adjusted_geometry);

static void
st_tooltip_set_property (GObject      *gobject,
                         guint         prop_id,
                         const GValue *value,
                         GParamSpec   *pspec)
{
  StTooltip *tooltip = ST_TOOLTIP (gobject);

  switch (prop_id)
    {
    case PROP_LABEL:
      st_tooltip_set_label (tooltip, g_value_get_string (value));
      break;

    case PROP_TIP_AREA:
      st_tooltip_set_tip_area (tooltip, g_value_get_boxed (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_tooltip_get_property (GObject    *gobject,
                         guint       prop_id,
                         GValue     *value,
                         GParamSpec *pspec)
{
  StTooltipPrivate *priv = ST_TOOLTIP (gobject)->priv;

  switch (prop_id)
    {
    case PROP_LABEL:
      g_value_set_string (value, st_label_get_text (priv->label));
      break;

    case PROP_TIP_AREA:
      g_value_set_boxed (value, priv->tip_area);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_tooltip_get_preferred_width (ClutterActor *self,
                                gfloat        for_height,
                                gfloat       *min_width_p,
                                gfloat       *natural_width_p)
{
  StTooltipPrivate *priv = ST_TOOLTIP (self)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));
  gfloat label_height;

  st_theme_node_adjust_for_height (theme_node, &for_height);

  if (for_height > -1)
    {
      label_height = for_height;
    }
  else
    {
      label_height = -1;
    }

  clutter_actor_get_preferred_width (CLUTTER_ACTOR (priv->label),
                                     label_height,
                                     min_width_p,
                                     natural_width_p);

  st_theme_node_adjust_preferred_width (theme_node, min_width_p, natural_width_p);
}

static void
st_tooltip_get_preferred_height (ClutterActor *self,
                                 gfloat        for_width,
                                 gfloat       *min_height_p,
                                 gfloat       *natural_height_p)
{
  StTooltipPrivate *priv = ST_TOOLTIP (self)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));
  gfloat min_label_h, natural_label_h;

  st_theme_node_adjust_for_width (theme_node, &for_width);

  clutter_actor_get_preferred_height (CLUTTER_ACTOR (priv->label),
                                      for_width,
                                      &min_label_h,
                                      &natural_label_h);
  if (min_height_p)
    *min_height_p = min_label_h;

  if (natural_height_p)
    *natural_height_p = natural_label_h;

  st_theme_node_adjust_preferred_height (theme_node, min_height_p, natural_height_p);
}

static void
st_tooltip_allocate (ClutterActor          *self,
                     const ClutterActorBox *box,
                     ClutterAllocationFlags flags)
{
  StTooltipPrivate *priv = ST_TOOLTIP (self)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));
  ClutterActorBox content_box, child_box;

  CLUTTER_ACTOR_CLASS (st_tooltip_parent_class)->allocate (self,
                                                           box,
                                                           flags);

  st_theme_node_get_content_box (theme_node, box, &content_box);

  child_box.x1 = child_box.y1 = 0;
  child_box.x2 = (box->x2 - box->x1);
  child_box.y2 = (box->y2 - box->y1);

  child_box = content_box;

  clutter_actor_allocate (CLUTTER_ACTOR (priv->label), &child_box, flags);
}

static void
st_tooltip_paint (ClutterActor *self)
{
  StTooltipPrivate *priv = ST_TOOLTIP (self)->priv;

  CLUTTER_ACTOR_CLASS (st_tooltip_parent_class)->paint (self);

  clutter_actor_paint (CLUTTER_ACTOR (priv->label));
}

static void
st_tooltip_dispose (GObject *self)
{
  StTooltipPrivate *priv = ST_TOOLTIP (self)->priv;

  if (priv->label)
    {
      clutter_actor_destroy (CLUTTER_ACTOR (priv->label));
      priv->label = NULL;
    }

  G_OBJECT_CLASS (st_tooltip_parent_class)->dispose (self);
}

static void
st_tooltip_class_init (StTooltipClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  GParamSpec *pspec;

  g_type_class_add_private (klass, sizeof (StTooltipPrivate));

  gobject_class->set_property = st_tooltip_set_property;
  gobject_class->get_property = st_tooltip_get_property;
  gobject_class->dispose = st_tooltip_dispose;

  actor_class->get_preferred_width = st_tooltip_get_preferred_width;
  actor_class->get_preferred_height = st_tooltip_get_preferred_height;
  actor_class->allocate = st_tooltip_allocate;
  actor_class->paint = st_tooltip_paint;
  actor_class->show = st_tooltip_show;
  actor_class->show_all = st_tooltip_show_all;
  actor_class->hide_all = st_tooltip_hide_all;

  pspec = g_param_spec_string ("label",
                               "Label",
                               "Label of the tooltip",
                               NULL, G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_LABEL, pspec);

  pspec = g_param_spec_boxed ("tip-area",
                              "Tip Area",
                              "Area on the stage the tooltip applies to",
                              CLUTTER_TYPE_GEOMETRY,
                              ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_TIP_AREA, pspec);
}

static void
st_tooltip_init (StTooltip *tooltip)
{
  tooltip->priv = ST_TOOLTIP_GET_PRIVATE (tooltip);

  tooltip->priv->label = ST_LABEL (st_label_new (NULL));

  tooltip->priv->tip_area = NULL;

  clutter_actor_set_parent (CLUTTER_ACTOR (tooltip->priv->label),
                            CLUTTER_ACTOR (tooltip));

  g_object_set (tooltip, "show-on-set-parent", FALSE, NULL);

  clutter_actor_set_reactive (CLUTTER_ACTOR (tooltip), FALSE);
}

static void
st_tooltip_update_position (StTooltip *tooltip)
{
  StTooltipPrivate *priv = tooltip->priv;
  ClutterGeometry *tip_area = tooltip->priv->tip_area;
  ClutterGeometry geometry;
  ClutterGeometry adjusted_geometry;
  gfloat tooltip_w, tooltip_h, tooltip_x, tooltip_y;

  /* if no area set, just position ourselves top left */
  if (!priv->tip_area)
    {
      clutter_actor_set_anchor_point ((ClutterActor*) tooltip, 0, 0);
      return;
    }

  /* we need to have a style in case there are padding/border values to take into
   * account when calculating width/height */
  st_widget_ensure_style ((StWidget *) tooltip);

  /* find out the tooltip's size */
  clutter_actor_get_size ((ClutterActor*) tooltip, &tooltip_w, &tooltip_h);

  /* attempt to place the tooltip */
  tooltip_x = (int)(tip_area->x + (tip_area->width / 2) - (tooltip_w / 2));
  tooltip_y = (int)(tip_area->y + tip_area->height);

  geometry.x = tooltip_x;
  geometry.y = tooltip_y;
  geometry.width = ceil (tooltip_w);
  geometry.height = ceil (tooltip_h);

  st_tooltip_constrain (tooltip, &geometry, &adjusted_geometry);

  tooltip_x = adjusted_geometry.x;
  tooltip_y = adjusted_geometry.y;

  /* Since we are updating the position out of st_widget_allocate(), we can't
   * call clutter_actor_set_position(), since that would trigger another
   * allocation cycle. Instead, we adjust the anchor position which moves
   * the tooltip actor on the screen without changing its allocation
   */
  clutter_actor_set_anchor_point ((ClutterActor*) tooltip, -tooltip_x, -tooltip_y);
}

/**
 * st_tooltip_get_label:
 * @tooltip: a #StTooltip
 *
 * Get the text displayed on the tooltip
 *
 * Returns: the text for the tooltip. This must not be freed by the application
 */
const gchar *
st_tooltip_get_label (StTooltip *tooltip)
{
  g_return_val_if_fail (ST_IS_TOOLTIP (tooltip), NULL);

  return st_label_get_text (tooltip->priv->label);
}

/**
 * st_tooltip_set_label:
 * @tooltip: a #StTooltip
 * @text: text to set the label to
 *
 * Sets the text displayed on the tooltip
 */
void
st_tooltip_set_label (StTooltip   *tooltip,
                      const gchar *text)
{
  StTooltipPrivate *priv;

  g_return_if_fail (ST_IS_TOOLTIP (tooltip));

  priv = tooltip->priv;

  st_label_set_text (priv->label, text);

  g_object_notify (G_OBJECT (tooltip), "label");
}

static void
st_tooltip_show (ClutterActor *self)
{
  StTooltip *tooltip = ST_TOOLTIP (self);

  st_tooltip_update_position (tooltip);

  /* finally show the tooltip... */
  CLUTTER_ACTOR_CLASS (st_tooltip_parent_class)->show (self);
}

static void
st_tooltip_show_all (ClutterActor *self)
{
  CLUTTER_ACTOR_CLASS (st_tooltip_parent_class)->show_all (self);

  clutter_actor_show_all (CLUTTER_ACTOR (ST_TOOLTIP (self)->priv->label));
}

static void
st_tooltip_hide_all (ClutterActor *self)
{
  CLUTTER_ACTOR_CLASS (st_tooltip_parent_class)->hide_all (self);

  clutter_actor_hide_all (CLUTTER_ACTOR (ST_TOOLTIP (self)->priv->label));
}

/**
 * st_tooltip_set_tip_area:
 * @tooltip: A #StTooltip
 * @area: A #ClutterGeometry
 *
 * Set the area on the stage that the tooltip applies to.
 */
void
st_tooltip_set_tip_area (StTooltip             *tooltip,
                         const ClutterGeometry *area)
{
  g_return_if_fail (ST_IS_TOOLTIP (tooltip));

  if (tooltip->priv->tip_area)
    g_boxed_free (CLUTTER_TYPE_GEOMETRY, tooltip->priv->tip_area);
  tooltip->priv->tip_area = g_boxed_copy (CLUTTER_TYPE_GEOMETRY, area);

  if (clutter_actor_get_stage (CLUTTER_ACTOR (tooltip)))
    st_tooltip_update_position (tooltip);
}

/**
 * st_tooltip_get_tip_area:
 * @tooltip: A #StTooltip
 *
 * Retrieve the area on the stage that the tooltip currently applies to
 *
 * Returns: the #ClutterGeometry, owned by the tooltip which must not be freed
 * by the application.
 */
const ClutterGeometry*
st_tooltip_get_tip_area (StTooltip *tooltip)
{
  g_return_val_if_fail (ST_IS_TOOLTIP (tooltip), NULL);

  return tooltip->priv->tip_area;
}

typedef struct {
  StTooltipConstrainFunc func;
  gpointer data;
  GDestroyNotify notify;
} ConstrainFuncClosure;

static void
constrain_func_closure_free (gpointer data)
{
  ConstrainFuncClosure *closure = data;
  if (closure->notify)
    closure->notify (closure->data);
  g_slice_free (ConstrainFuncClosure, data);
}

static GQuark
st_tooltip_constrain_func_quark (void)
{
  static GQuark value = 0;
  if (G_UNLIKELY (value == 0))
    value = g_quark_from_static_string ("st-tooltip-constrain-func");
  return value;
}

/**
 * st_tooltip_set_constrain_func:
 * @stage: a #ClutterStage
 * @func: (allow-none): function to be called to constrain tooltip position
 * @data: (allow-none): user data to pass to @func
 * @notify: (allow-none): function to be called when @data is no longer needed
 *
 * Sets a callback function that will be used to constrain the position
 * of tooltips within @stage. This can be used, for example, if the stage
 * spans multiple monitors and tooltips should be positioned not to cross
 * monitors.
 */
void
st_tooltip_set_constrain_func (ClutterStage           *stage,
                               StTooltipConstrainFunc  func,
                               gpointer                data,
                               GDestroyNotify          notify)
{
  ConstrainFuncClosure *closure;

  g_return_if_fail (CLUTTER_IS_STAGE (stage));

  if (func)
    {
      closure = g_slice_new (ConstrainFuncClosure);
      closure->func = func;
      closure->data = data;
      closure->notify = notify;
    }
  else
    closure = NULL;

  g_object_set_qdata_full (G_OBJECT (stage), st_tooltip_constrain_func_quark (),
                           closure, constrain_func_closure_free);
}

static void
st_tooltip_constrain (StTooltip             *tooltip,
                      const ClutterGeometry *geometry,
                      ClutterGeometry       *adjusted_geometry)
{
  ConstrainFuncClosure *closure;

  ClutterActor *stage = clutter_actor_get_stage (CLUTTER_ACTOR (tooltip));

  *adjusted_geometry = *geometry;

  if (stage == NULL)
    return;

  closure = g_object_get_qdata (G_OBJECT (stage), st_tooltip_constrain_func_quark ());
  if (closure)
    {
      closure->func (tooltip, geometry, adjusted_geometry, closure->data);
    }
  else
    {
      ClutterActor *parent;
      gfloat parent_w, parent_h;

      parent = clutter_actor_get_parent ((ClutterActor *) tooltip);
      clutter_actor_get_size (parent, &parent_w, &parent_h);

      /* make sure the tooltip is not off parent horizontally */
      if (adjusted_geometry->x < 0)
        adjusted_geometry->x = 0;
      else if (adjusted_geometry->x + adjusted_geometry->width > parent_w)
        adjusted_geometry->x = (int)(parent_w) - adjusted_geometry->width;

      /* make sure the tooltip is not off parent vertically */
      if (adjusted_geometry->y + adjusted_geometry->height > parent_h)
        adjusted_geometry->y = parent_h - adjusted_geometry->height;
    }
}
