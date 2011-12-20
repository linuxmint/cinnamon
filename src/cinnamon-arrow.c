/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include "cinnamon-arrow.h"

#include <clutter/clutter.h>
#include <gtk/gtk.h>
#include <cairo.h>

enum {
   PROP_0,

   PROP_DIRECTION
};

G_DEFINE_TYPE(CinnamonArrow, cinnamon_arrow, CLUTTER_TYPE_CAIRO_TEXTURE);

struct _CinnamonArrowPrivate {
  GtkArrowType direction;
};

static void cinnamon_arrow_redraw (CinnamonArrow *self);

static void
cinnamon_arrow_set_property (GObject         *object,
                          guint            prop_id,
                          const GValue    *value,
                          GParamSpec      *pspec)
{
  CinnamonArrow *self = CINNAMON_ARROW (object);

  switch (prop_id)
    {
    case PROP_DIRECTION:
      self->priv->direction = g_value_get_enum (value);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }

  cinnamon_arrow_redraw (self);
}

static void
cinnamon_arrow_get_property (GObject         *object,
                                     guint            prop_id,
                                     GValue          *value,
                                     GParamSpec      *pspec)
{
  CinnamonArrow *self = CINNAMON_ARROW (object);

  switch (prop_id)
    {
    case PROP_DIRECTION:
      g_value_set_enum (value, self->priv->direction);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_arrow_redraw (CinnamonArrow *self)
{
  cairo_t *cr;
  guint width, height;

  g_object_get (G_OBJECT (self), "surface-width", &width,
                                 "surface-height", &height,
                                 NULL);

  if (width == 0)
    return;

  cr = clutter_cairo_texture_create (CLUTTER_CAIRO_TEXTURE (self));

  cairo_set_source_rgb (cr, 1, 1, 1);

  switch (self->priv->direction)
  {
    case GTK_ARROW_RIGHT:
      cairo_move_to (cr, 0, 0);
      cairo_line_to (cr, width, height*0.5);
      cairo_line_to (cr, 0, height);
      break;
    case GTK_ARROW_LEFT:
      cairo_move_to (cr, width, 0);
      cairo_line_to (cr, 0, height*0.5);
      cairo_line_to (cr, width, height);
      break;
    case GTK_ARROW_UP:
      cairo_move_to (cr, 0, height);
      cairo_line_to (cr, width*0.5, 0);
      cairo_line_to (cr, width, height);
      break;
    case GTK_ARROW_DOWN:
      cairo_move_to (cr, 0, 0);
      cairo_line_to (cr, width*0.5, height);
      cairo_line_to (cr, width, height);
      break;
    case GTK_ARROW_NONE:
    default:
      break;
  }

  cairo_close_path (cr);
  cairo_fill (cr);

  cairo_destroy (cr);
}

static void
cinnamon_arrow_class_init (CinnamonArrowClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  g_type_class_add_private (klass, sizeof (CinnamonArrowPrivate));

  object_class->get_property = cinnamon_arrow_get_property;
  object_class->set_property = cinnamon_arrow_set_property;

  g_object_class_install_property (object_class,
                                   PROP_DIRECTION,
                                   g_param_spec_enum ("direction",
                                                      "Direction",
                                                      "Direction",
                                                      GTK_TYPE_ARROW_TYPE,
                                                      GTK_ARROW_NONE,
                                                      G_PARAM_READWRITE));
}

static void
cinnamon_arrow_init (CinnamonArrow *actor)
{
  actor->priv = G_TYPE_INSTANCE_GET_PRIVATE (actor, CINNAMON_TYPE_ARROW,
                                             CinnamonArrowPrivate);
  g_signal_connect (actor, "notify::surface-width", G_CALLBACK (cinnamon_arrow_redraw), NULL);
}
