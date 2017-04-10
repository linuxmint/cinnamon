/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-polygon.c: A dynamically-sized Cairo drawing area
 *
 * Copyright 2009, 2010 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 2.1 of
 * the License, or (at your option) any later version.
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
 * SECTION:st-polygon
 * @short_description: A dynamically-sized Cairo drawing area
 *
 * #StPolygon is similar to #ClutterCairoTexture in that
 * it allows drawing via Cairo; the primary difference is that
 * it is dynamically sized.  To use, connect to the #StPolygon::repaint
 * signal, and inside the signal handler, call
 * st_polygon_get_context() to get the Cairo context to draw to.  The
 * #StPolygon::repaint signal will be emitted by default when the area is
 * resized or the CSS style changes; you can use the
 * st_polygon_queue_repaint() as well.
 */

#include "st-polygon.h"

#include <cairo.h>

G_DEFINE_TYPE(StPolygon, st_polygon, CLUTTER_TYPE_ACTOR);

struct _StPolygonPrivate {
  CoglHandle texture;
  CoglHandle material;
  cairo_t *context;
  guint needs_repaint : 1;
  guint in_repaint : 1;

  gfloat ulc_x;
  gfloat ulc_y;

  gfloat llc_x;
  gfloat llc_y;

  gfloat urc_x;
  gfloat urc_y;

  gfloat lrc_x;
  gfloat lrc_y;

  gboolean debug;
};

/* Signals */
enum
{
  REPAINT,
  LAST_SIGNAL
};

static guint st_polygon_signals [LAST_SIGNAL] = { 0 };

enum
{
  PROP_0,

  PROP_ULC_X,
  PROP_ULC_Y,

  PROP_LLC_X,
  PROP_LLC_Y,

  PROP_URC_X,
  PROP_URC_Y,

  PROP_LRC_X,
  PROP_LRC_Y,

  PROP_DEBUG,

  PROP_LAST
};

static GParamSpec *obj_props[PROP_LAST];

static void
st_polygon_set_property (GObject      *object,
                         guint         prop_id,
                         const GValue *value,
                         GParamSpec   *pspec)
{
  StPolygon *actor = ST_POLYGON (object);
  StPolygonPrivate *priv = actor->priv;

  switch (prop_id) {
    case PROP_ULC_X:
      priv->ulc_x = g_value_get_float (value);
      break;
    case PROP_ULC_Y:
      priv->ulc_y = g_value_get_float (value);
      break;
    case PROP_LLC_X:
      priv->llc_x = g_value_get_float (value);
      break;
    case PROP_LLC_Y:
      priv->llc_y = g_value_get_float (value);
      break;
    case PROP_URC_X:
      priv->urc_x = g_value_get_float (value);
      break;
    case PROP_URC_Y:
      priv->urc_y = g_value_get_float (value);
      break;
    case PROP_LRC_X:
      priv->lrc_x = g_value_get_float (value);
      break;
    case PROP_LRC_Y:
      priv->lrc_y = g_value_get_float (value);
      break;
    case PROP_DEBUG:
      priv->debug = g_value_get_boolean (value);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
st_polygon_get_property (GObject    *object,
                         guint       prop_id,
                         GValue     *value,
                         GParamSpec *pspec)
{
  StPolygon *actor = ST_POLYGON (object);
  StPolygonPrivate *priv = actor->priv;

  switch (prop_id)
    {
    case PROP_ULC_X:
      g_value_set_float (value, priv->ulc_x);
      break;
    case PROP_ULC_Y:
      g_value_set_float (value, priv->ulc_y);
      break;
    case PROP_LLC_X:
      g_value_set_float (value, priv->llc_x);
      break;
    case PROP_LLC_Y:
      g_value_set_float (value, priv->llc_y);
      break;
    case PROP_URC_X:
      g_value_set_float (value, priv->urc_x);
      break;
    case PROP_URC_Y:
      g_value_set_float (value, priv->urc_y);
      break;
    case PROP_LRC_X:
      g_value_set_float (value, priv->lrc_x);
      break;
    case PROP_LRC_Y:
      g_value_set_float (value, priv->lrc_y);
      break;
    case PROP_DEBUG:
      g_value_set_boolean (value, priv->debug);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
st_polygon_paint (ClutterActor *self)
{

    StPolygon *area = ST_POLYGON (self);
    StPolygonPrivate *priv = area->priv;
    if (priv->debug) {
        gfloat coords[8];
        cogl_set_source_color4f (.50,
                                 .50,
                                 .50,
                                 .50);

        coords[0] = priv->ulc_x;
        coords[1] = priv->ulc_y;
        coords[2] = priv->llc_x;
        coords[3] = priv->llc_y;
        coords[4] = priv->lrc_x;
        coords[5] = priv->lrc_y;
        coords[6] = priv->urc_x;
        coords[7] = priv->urc_y;

        cogl_path_polygon ((float *)coords, 4);
        cogl_path_fill ();
    }
}


static void
st_polygon_pick (ClutterActor       *self,
                 const ClutterColor *pick_color)
{
    StPolygon *area = ST_POLYGON (self);
    StPolygonPrivate *priv = area->priv;
    gfloat coords[8];

    if (!clutter_actor_should_pick_paint (self))
        return;

    coords[0] = priv->ulc_x;
    coords[1] = priv->ulc_y;
    coords[2] = priv->llc_x;
    coords[3] = priv->llc_y;
    coords[4] = priv->lrc_x;
    coords[5] = priv->lrc_y;
    coords[6] = priv->urc_x;
    coords[7] = priv->urc_y;

    cogl_set_source_color4ub (pick_color->red,
                              pick_color->green,
                              pick_color->blue,
                              pick_color->alpha);

    cogl_path_polygon ((float *)coords, 4);
    cogl_path_fill ();
}

static void
st_polygon_class_init (StPolygonClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);

  gobject_class->set_property = st_polygon_set_property;
  gobject_class->get_property = st_polygon_get_property;
  actor_class->paint = st_polygon_paint;
  actor_class->pick = st_polygon_pick;

  st_polygon_signals[REPAINT] =
    g_signal_new ("repaint",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StPolygonClass, repaint),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  obj_props[PROP_ULC_X] =
    g_param_spec_float ("ulc-x",
                        "Upper Left X coordinate",
                        "Upper Left X coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_ULC_X, obj_props[PROP_ULC_X]);

  obj_props[PROP_ULC_Y] =
    g_param_spec_float ("ulc-y",
                        "Upper Left Y coordinate",
                        "Upper Left Y coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_ULC_Y, obj_props[PROP_ULC_Y]);

  obj_props[PROP_LLC_X] =
    g_param_spec_float ("llc-x",
                        "Lower Left X coordinate",
                        "Lower Left X coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_LLC_X, obj_props[PROP_LLC_X]);

  obj_props[PROP_LLC_Y] =
    g_param_spec_float ("llc-y",
                        "Lower Left Y coordinate",
                        "Lower Left Y coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_LLC_Y, obj_props[PROP_LLC_Y]);

  obj_props[PROP_URC_X] =
    g_param_spec_float ("urc-x",
                        "Upper Right X coordinate",
                        "Upper Right X coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_URC_X, obj_props[PROP_URC_X]);

  obj_props[PROP_URC_Y] =
    g_param_spec_float ("urc-y",
                        "Upper Right Y coordinate",
                        "Upper Right Y coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_URC_Y, obj_props[PROP_URC_Y]);

  obj_props[PROP_LRC_X] =
    g_param_spec_float ("lrc-x",
                        "Lower Right X coordinate",
                        "Lower Right X coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_LRC_X, obj_props[PROP_LRC_X]);

  obj_props[PROP_LRC_Y] =
    g_param_spec_float ("lrc-y",
                        "Lower Right Y coordinate",
                        "Lower Right Y coordinate of the polygon",
                        -G_MAXFLOAT, G_MAXFLOAT,
                        0.0,
                        G_PARAM_READWRITE |
                        G_PARAM_STATIC_STRINGS |
                        G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_LRC_Y, obj_props[PROP_LRC_Y]);

    obj_props[PROP_DEBUG] =
    g_param_spec_boolean ("debug",
                          "Make polygon visible",
                          "Make polygon visible to assist in debugging",
                          FALSE,
                          G_PARAM_READWRITE |
                          G_PARAM_STATIC_STRINGS |
                          G_PARAM_CONSTRUCT);
  g_object_class_install_property (gobject_class, PROP_DEBUG, obj_props[PROP_DEBUG]);

  g_type_class_add_private (gobject_class, sizeof (StPolygonPrivate));
}

static void
st_polygon_init (StPolygon *area)
{
  area->priv = G_TYPE_INSTANCE_GET_PRIVATE (area, ST_TYPE_POLYGON,
                                            StPolygonPrivate);
  area->priv->texture = COGL_INVALID_HANDLE;
  area->priv->debug = FALSE;
}

/**
 * st_polygon_queue_repaint:
 * @area: the #StPolygon
 *
 * Will cause the actor to emit a ::repaint signal before it is next
 * drawn to the scene. Useful if some parameters for the area being
 * drawn other than the size or style have changed. Note that
 * clutter_actor_queue_redraw() will simply result in the same
 * contents being drawn to the scene again.
 */
void
st_polygon_queue_repaint (StPolygon *area)
{
  StPolygonPrivate *priv;

  g_return_if_fail (ST_IS_POLYGON (area));

  priv = area->priv;

  priv->needs_repaint = TRUE;
  clutter_actor_queue_redraw (CLUTTER_ACTOR (area));
}
