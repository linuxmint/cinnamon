/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-adjustment.c: Adjustment object
 *
 * Copyright 2008 OpenedHand
 * Copyright 2009 Intel Corporation.
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
 * SECTION:st-adjustment
 * @short_description: A GObject representing an adjustable bounded value
 *
 * The #StAdjustment object represents a range of values bounded between a
 * minimum and maximum, together with step and page increments and a page size.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <glib-object.h>
#include <clutter/clutter.h>

#include "st-adjustment.h"
#include "st-private.h"

G_DEFINE_TYPE (StAdjustment, st_adjustment, G_TYPE_OBJECT)

#define ADJUSTMENT_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), ST_TYPE_ADJUSTMENT, StAdjustmentPrivate))

struct _StAdjustmentPrivate
{
  /* Do not sanity-check values while constructing,
   * not all properties may be set yet. */
  gboolean is_constructing : 1;

  gdouble  lower;
  gdouble  upper;
  gdouble  value;
  gdouble  step_increment;
  gdouble  page_increment;
  gdouble  page_size;
};

enum
{
  PROP_0,

  PROP_LOWER,
  PROP_UPPER,
  PROP_VALUE,
  PROP_STEP_INC,
  PROP_PAGE_INC,
  PROP_PAGE_SIZE,
};

enum
{
  CHANGED,

  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0, };

static gboolean st_adjustment_set_lower          (StAdjustment *adjustment,
                                                  gdouble       lower);
static gboolean st_adjustment_set_upper          (StAdjustment *adjustment,
                                                  gdouble       upper);
static gboolean st_adjustment_set_step_increment (StAdjustment *adjustment,
                                                  gdouble       step);
static gboolean st_adjustment_set_page_increment (StAdjustment *adjustment,
                                                  gdouble       page);
static gboolean st_adjustment_set_page_size      (StAdjustment *adjustment,
                                                  gdouble       size);

static void
st_adjustment_constructed (GObject *object)
{
  GObjectClass *g_class;
  StAdjustment *self = ST_ADJUSTMENT (object);

  g_class = G_OBJECT_CLASS (st_adjustment_parent_class);
  /* The docs say we're suppose to chain up, but would crash without
   * some extra care. */
  if (g_class && g_class->constructed &&
      g_class->constructed != st_adjustment_constructed)
    {
      g_class->constructed (object);
    }

  ST_ADJUSTMENT (self)->priv->is_constructing = FALSE;
  st_adjustment_clamp_page (self, self->priv->lower, self->priv->upper);
}

static void
st_adjustment_get_property (GObject    *gobject,
                            guint       prop_id,
                            GValue     *value,
                            GParamSpec *pspec)
{
  StAdjustmentPrivate *priv = ST_ADJUSTMENT (gobject)->priv;

  switch (prop_id)
    {
    case PROP_LOWER:
      g_value_set_double (value, priv->lower);
      break;

    case PROP_UPPER:
      g_value_set_double (value, priv->upper);
      break;

    case PROP_VALUE:
      g_value_set_double (value, priv->value);
      break;

    case PROP_STEP_INC:
      g_value_set_double (value, priv->step_increment);
      break;

    case PROP_PAGE_INC:
      g_value_set_double (value, priv->page_increment);
      break;

    case PROP_PAGE_SIZE:
      g_value_set_double (value, priv->page_size);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_adjustment_set_property (GObject      *gobject,
                            guint         prop_id,
                            const GValue *value,
                            GParamSpec   *pspec)
{
  StAdjustment *adj = ST_ADJUSTMENT (gobject);

  switch (prop_id)
    {
    case PROP_LOWER:
      st_adjustment_set_lower (adj, g_value_get_double (value));
      break;

    case PROP_UPPER:
      st_adjustment_set_upper (adj, g_value_get_double (value));
      break;

    case PROP_VALUE:
      st_adjustment_set_value (adj, g_value_get_double (value));
      break;

    case PROP_STEP_INC:
      st_adjustment_set_step_increment (adj, g_value_get_double (value));
      break;

    case PROP_PAGE_INC:
      st_adjustment_set_page_increment (adj, g_value_get_double (value));
      break;

    case PROP_PAGE_SIZE:
      st_adjustment_set_page_size (adj, g_value_get_double (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_adjustment_class_init (StAdjustmentClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  g_type_class_add_private (klass, sizeof (StAdjustmentPrivate));

  object_class->constructed = st_adjustment_constructed;
  object_class->get_property = st_adjustment_get_property;
  object_class->set_property = st_adjustment_set_property;

  g_object_class_install_property (object_class,
                                   PROP_LOWER,
                                   g_param_spec_double ("lower",
                                                        "Lower",
                                                        "Lower bound",
                                                        -G_MAXDOUBLE,
                                                        G_MAXDOUBLE,
                                                        0.0,
                                                        ST_PARAM_READWRITE |
                                                        G_PARAM_CONSTRUCT));
  g_object_class_install_property (object_class,
                                   PROP_UPPER,
                                   g_param_spec_double ("upper",
                                                        "Upper",
                                                        "Upper bound",
                                                        -G_MAXDOUBLE,
                                                        G_MAXDOUBLE,
                                                        0.0,
                                                        ST_PARAM_READWRITE |
                                                        G_PARAM_CONSTRUCT));
  g_object_class_install_property (object_class,
                                   PROP_VALUE,
                                   g_param_spec_double ("value",
                                                        "Value",
                                                        "Current value",
                                                        -G_MAXDOUBLE,
                                                        G_MAXDOUBLE,
                                                        0.0,
                                                        ST_PARAM_READWRITE |
                                                        G_PARAM_CONSTRUCT));
  g_object_class_install_property (object_class,
                                   PROP_STEP_INC,
                                   g_param_spec_double ("step-increment",
                                                        "Step Increment",
                                                        "Step increment",
                                                        0.0,
                                                        G_MAXDOUBLE,
                                                        0.0,
                                                        ST_PARAM_READWRITE |
                                                        G_PARAM_CONSTRUCT));
  g_object_class_install_property (object_class,
                                   PROP_PAGE_INC,
                                   g_param_spec_double ("page-increment",
                                                        "Page Increment",
                                                        "Page increment",
                                                        0.0,
                                                        G_MAXDOUBLE,
                                                        0.0,
                                                        ST_PARAM_READWRITE |
                                                        G_PARAM_CONSTRUCT));
  g_object_class_install_property (object_class,
                                   PROP_PAGE_SIZE,
                                   g_param_spec_double ("page-size",
                                                        "Page Size",
                                                        "Page size",
                                                        0.0,
                                                        G_MAXDOUBLE,
                                                        0.0,
                                                        ST_PARAM_READWRITE |
                                                        G_PARAM_CONSTRUCT));
  /**
   * StAdjustment::changed:
   *
   * Emitted when any of the adjustment values have changed
   */
  signals[CHANGED] =
    g_signal_new ("changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StAdjustmentClass, changed),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);
}

static void
st_adjustment_init (StAdjustment *self)
{
  self->priv = ADJUSTMENT_PRIVATE (self);

  self->priv->is_constructing = TRUE;
}

StAdjustment *
st_adjustment_new (gdouble value,
                   gdouble lower,
                   gdouble upper,
                   gdouble step_increment,
                   gdouble page_increment,
                   gdouble page_size)
{
  return g_object_new (ST_TYPE_ADJUSTMENT,
                       "value", value,
                       "lower", lower,
                       "upper", upper,
                       "step-increment", step_increment,
                       "page-increment", page_increment,
                       "page-size", page_size,
                       NULL);
}

gdouble
st_adjustment_get_value (StAdjustment *adjustment)
{
  StAdjustmentPrivate *priv;

  g_return_val_if_fail (ST_IS_ADJUSTMENT (adjustment), 0);

  priv = adjustment->priv;

  return priv->value;
}

void
st_adjustment_set_value (StAdjustment *adjustment,
                         gdouble       value)
{
  StAdjustmentPrivate *priv;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));

  priv = adjustment->priv;

  /* Defer clamp until after construction. */
  if (!priv->is_constructing)
    {
      value = CLAMP (value,
                     priv->lower,
                     MAX (priv->lower, priv->upper - priv->page_size));
    }

  if (priv->value != value)
    {
      priv->value = value;

      g_object_notify (G_OBJECT (adjustment), "value");
    }
}

void
st_adjustment_clamp_page (StAdjustment *adjustment,
                          gdouble       lower,
                          gdouble       upper)
{
  StAdjustmentPrivate *priv;
  gboolean changed;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));

  priv = adjustment->priv;

  lower = CLAMP (lower, priv->lower, priv->upper - priv->page_size);
  upper = CLAMP (upper, priv->lower + priv->page_size, priv->upper);

  changed = FALSE;

  if (priv->value + priv->page_size > upper)
    {
      priv->value = upper - priv->page_size;
      changed = TRUE;
    }

  if (priv->value < lower)
    {
      priv->value = lower;
      changed = TRUE;
    }

  if (changed)
    g_object_notify (G_OBJECT (adjustment), "value");
}

static gboolean
st_adjustment_set_lower (StAdjustment *adjustment,
                         gdouble       lower)
{
  StAdjustmentPrivate *priv = adjustment->priv;

  if (priv->lower != lower)
    {
      priv->lower = lower;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify (G_OBJECT (adjustment), "lower");

      /* Defer clamp until after construction. */
      if (!priv->is_constructing)
        st_adjustment_clamp_page (adjustment, priv->lower, priv->upper);

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_adjustment_set_upper (StAdjustment *adjustment,
                         gdouble       upper)
{
  StAdjustmentPrivate *priv = adjustment->priv;

  if (priv->upper != upper)
    {
      priv->upper = upper;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify (G_OBJECT (adjustment), "upper");

      /* Defer clamp until after construction. */
      if (!priv->is_constructing)
        st_adjustment_clamp_page (adjustment, priv->lower, priv->upper);

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_adjustment_set_step_increment (StAdjustment *adjustment,
                                  gdouble       step)
{
  StAdjustmentPrivate *priv = adjustment->priv;

  if (priv->step_increment != step)
    {
      priv->step_increment = step;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify (G_OBJECT (adjustment), "step-increment");

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_adjustment_set_page_increment (StAdjustment *adjustment,
                                  gdouble       page)
{
  StAdjustmentPrivate *priv = adjustment->priv;

  if (priv->page_increment != page)
    {
      priv->page_increment = page;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify (G_OBJECT (adjustment), "page-increment");

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_adjustment_set_page_size (StAdjustment *adjustment,
                             gdouble       size)
{
  StAdjustmentPrivate *priv = adjustment->priv;

  if (priv->page_size != size)
    {
      priv->page_size = size;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify (G_OBJECT (adjustment), "page_size");

      /* Well explicitely clamp after construction. */
      if (!priv->is_constructing)
        st_adjustment_clamp_page (adjustment, priv->lower, priv->upper);

      return TRUE;
    }

  return FALSE;
}

void
st_adjustment_set_values (StAdjustment *adjustment,
                          gdouble       value,
                          gdouble       lower,
                          gdouble       upper,
                          gdouble       step_increment,
                          gdouble       page_increment,
                          gdouble       page_size)
{
  StAdjustmentPrivate *priv;
  gboolean emit_changed = FALSE;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));
  g_return_if_fail (page_size >= 0 && page_size <= G_MAXDOUBLE);
  g_return_if_fail (step_increment >= 0 && step_increment <= G_MAXDOUBLE);
  g_return_if_fail (page_increment >= 0 && page_increment <= G_MAXDOUBLE);

  priv = adjustment->priv;

  emit_changed = FALSE;

  g_object_freeze_notify (G_OBJECT (adjustment));

  emit_changed |= st_adjustment_set_lower (adjustment, lower);
  emit_changed |= st_adjustment_set_upper (adjustment, upper);
  emit_changed |= st_adjustment_set_step_increment (adjustment, step_increment);
  emit_changed |= st_adjustment_set_page_increment (adjustment, page_increment);
  emit_changed |= st_adjustment_set_page_size (adjustment, page_size);

  if (value != priv->value)
    {
      st_adjustment_set_value (adjustment, value);
      emit_changed = TRUE;
    }

  if (emit_changed)
    g_signal_emit (G_OBJECT (adjustment), signals[CHANGED], 0);

  g_object_thaw_notify (G_OBJECT (adjustment));
}

/**
 * st_adjustment_get_values:
 * @adjustment: an #StAdjustment
 * @value: (out): the current value
 * @lower: (out): the lower bound
 * @upper: (out): the upper bound
 * @step_increment: (out): the step increment
 * @page_increment: (out): the page increment
 * @page_size: (out): the page size
 *
 * Gets all of @adjustment's values at once.
 */
void
st_adjustment_get_values (StAdjustment *adjustment,
                          gdouble      *value,
                          gdouble      *lower,
                          gdouble      *upper,
                          gdouble      *step_increment,
                          gdouble      *page_increment,
                          gdouble      *page_size)
{
  StAdjustmentPrivate *priv;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));

  priv = adjustment->priv;

  if (lower)
    *lower = priv->lower;

  if (upper)
    *upper = priv->upper;

  if (value)
    *value = st_adjustment_get_value (adjustment);

  if (step_increment)
    *step_increment = priv->step_increment;

  if (page_increment)
    *page_increment = priv->page_increment;

  if (page_size)
    *page_size = priv->page_size;
}

