/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-drawing-area.c: A dynamically-sized Cairo drawing area
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
 * SECTION:st-drawing-area
 * @short_description: A dynamically-sized Cairo drawing area
 *
 * #StDrawingArea is similar to #ClutterCairoTexture in that
 * it allows drawing via Cairo; the primary difference is that
 * it is dynamically sized.  To use, connect to the #StDrawingArea::repaint
 * signal, and inside the signal handler, call
 * st_drawing_area_get_context() to get the Cairo context to draw to.  The
 * #StDrawingArea::repaint signal will be emitted by default when the area is
 * resized or the CSS style changes; you can use the
 * st_drawing_area_queue_repaint() as well.
 */

#include "st-drawing-area.h"
#include "st-cogl-wrapper.h"

#include <cairo.h>

G_DEFINE_TYPE(StDrawingArea, st_drawing_area, ST_TYPE_WIDGET);

struct _StDrawingAreaPrivate {
  CoglHandle texture;
  CoglHandle material;
  cairo_t *context;
  guint needs_repaint : 1;
  guint in_repaint : 1;
};

/* Signals */
enum
{
  REPAINT,
  LAST_SIGNAL
};

static guint st_drawing_area_signals [LAST_SIGNAL] = { 0 };

static void
st_drawing_area_dispose (GObject *object)
{
  StDrawingArea *area = ST_DRAWING_AREA (object);
  StDrawingAreaPrivate *priv = area->priv;

  if (priv->material != COGL_INVALID_HANDLE)
    {
      cogl_handle_unref (priv->material);
      priv->material = COGL_INVALID_HANDLE;
    }

  if (priv->texture != COGL_INVALID_HANDLE)
    {
      cogl_handle_unref (priv->texture);
      priv->texture = COGL_INVALID_HANDLE;
    }

  G_OBJECT_CLASS (st_drawing_area_parent_class)->dispose (object);
}

static void
st_drawing_area_paint (ClutterActor *self)
{
  StDrawingArea *area = ST_DRAWING_AREA (self);
  StDrawingAreaPrivate *priv = area->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));
  ClutterActorBox allocation_box;
  ClutterActorBox content_box;
  int width, height;
  CoglColor color;
  guint8 paint_opacity;

  (CLUTTER_ACTOR_CLASS (st_drawing_area_parent_class))->paint (self);

  clutter_actor_get_allocation_box (self, &allocation_box);
  st_theme_node_get_content_box (theme_node, &allocation_box, &content_box);

  width = (int)(0.5 + content_box.x2 - content_box.x1);
  height = (int)(0.5 + content_box.y2 - content_box.y1);

  if (priv->material == COGL_INVALID_HANDLE)
    priv->material = cogl_material_new ();

  if (priv->texture != COGL_INVALID_HANDLE &&
      (width != cogl_texture_get_width (priv->texture) ||
       height != cogl_texture_get_height (priv->texture)))
    {
      cogl_handle_unref (priv->texture);
      priv->texture = COGL_INVALID_HANDLE;
    }

  if (width > 0 && height > 0)
    {
      if (priv->texture == COGL_INVALID_HANDLE)
        {
          priv->texture = st_cogl_texture_new_with_size_wrapper (width, height,
                                                                 COGL_TEXTURE_NONE,
                                                                 CLUTTER_CAIRO_FORMAT_ARGB32);
          priv->needs_repaint = TRUE;
        }

      if (priv->needs_repaint)
        {
          cairo_surface_t *surface;

          surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32, width, height);
          priv->context = cairo_create (surface);
          priv->in_repaint = TRUE;
          priv->needs_repaint = FALSE;

          g_signal_emit ((GObject*)area, st_drawing_area_signals[REPAINT], 0);

          priv->in_repaint = FALSE;
          cairo_destroy (priv->context);
          priv->context = NULL;

          cogl_texture_set_region (priv->texture, 0, 0, 0, 0, width, height, width, height,
                                   CLUTTER_CAIRO_FORMAT_ARGB32,
                                   cairo_image_surface_get_stride (surface),
                                   cairo_image_surface_get_data (surface));

          cairo_surface_destroy (surface);
        }
    }

  cogl_material_set_layer (priv->material, 0, priv->texture);

  if (priv->texture)
    {
      paint_opacity = clutter_actor_get_paint_opacity (self);
      cogl_color_set_from_4ub (&color,
                               paint_opacity, paint_opacity, paint_opacity, paint_opacity);
      cogl_material_set_color (priv->material, &color);

      cogl_set_source (priv->material);
      cogl_rectangle_with_texture_coords (content_box.x1, content_box.y1,
                                          width, height,
                                          0.0f, 0.0f, 1.0f, 1.0f);
    }
}

static void
st_drawing_area_style_changed (StWidget  *self)
{
  StDrawingArea *area = ST_DRAWING_AREA (self);
  StDrawingAreaPrivate *priv = area->priv;

  (ST_WIDGET_CLASS (st_drawing_area_parent_class))->style_changed (self);

  priv->needs_repaint = TRUE;
}

static void
st_drawing_area_class_init (StDrawingAreaClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);

  gobject_class->dispose = st_drawing_area_dispose;
  actor_class->paint = st_drawing_area_paint;
  widget_class->style_changed = st_drawing_area_style_changed;

  st_drawing_area_signals[REPAINT] =
    g_signal_new ("repaint",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StDrawingAreaClass, repaint),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  g_type_class_add_private (gobject_class, sizeof (StDrawingAreaPrivate));
}

static void
st_drawing_area_init (StDrawingArea *area)
{
  area->priv = G_TYPE_INSTANCE_GET_PRIVATE (area, ST_TYPE_DRAWING_AREA,
                                            StDrawingAreaPrivate);
  area->priv->texture = COGL_INVALID_HANDLE;
}

/**
 * st_drawing_area_queue_repaint:
 * @area: the #StDrawingArea
 *
 * Will cause the actor to emit a ::repaint signal before it is next
 * drawn to the scene. Useful if some parameters for the area being
 * drawn other than the size or style have changed. Note that
 * clutter_actor_queue_redraw() will simply result in the same
 * contents being drawn to the scene again.
 */
void
st_drawing_area_queue_repaint (StDrawingArea *area)
{
  StDrawingAreaPrivate *priv;

  g_return_if_fail (ST_IS_DRAWING_AREA (area));

  priv = area->priv;

  priv->needs_repaint = TRUE;
  clutter_actor_queue_redraw (CLUTTER_ACTOR (area));
}

/**
 * st_drawing_area_get_context:
 * @area: the #StDrawingArea
 *
 * Gets the Cairo context to paint to. This function must only be called
 * from a signal hander for the ::repaint signal.
 *
 * Return Value: (transfer none): the Cairo context for the paint operation
 */
cairo_t *
st_drawing_area_get_context (StDrawingArea *area)
{
  g_return_val_if_fail (ST_IS_DRAWING_AREA (area), NULL);
  g_return_val_if_fail (area->priv->in_repaint, NULL);

  return area->priv->context;
}

/**
 * st_drawing_area_get_surface_size:
 * @area: the #StDrawingArea
 * @width: (out): location to store the width of the painted area
 * @height: (out): location to store the height of the painted area
 *
 * Gets the size of the cairo surface being painted to, which is equal
 * to the size of the content area of the widget. This function must
 * only be called from a signal hander for the ::repaint signal.
 */
void
st_drawing_area_get_surface_size (StDrawingArea *area,
                                  guint         *width,
                                  guint         *height)
{
  StDrawingAreaPrivate *priv;

  g_return_if_fail (ST_IS_DRAWING_AREA (area));
  g_return_if_fail (area->priv->in_repaint);

  priv = area->priv;

  if (width)
    *width = cogl_texture_get_width (priv->texture);
  if (height)
    *height = cogl_texture_get_height (priv->texture);
}
