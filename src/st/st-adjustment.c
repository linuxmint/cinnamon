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
#include <math.h>

#include "st-adjustment.h"
#include "st-private.h"

typedef struct _StAdjustmentPrivate StAdjustmentPrivate;

struct _StAdjustmentPrivate
{
  /* Do not sanity-check values while constructing,
   * not all properties may be set yet. */
  guint is_constructing : 1;

  GHashTable *transitions;

  gdouble  lower;
  gdouble  upper;
  gdouble  value;
  gdouble  step_increment;
  gdouble  page_increment;
  gdouble  page_size;
};

static void animatable_iface_init (ClutterAnimatableInterface *iface);

G_DEFINE_TYPE_WITH_CODE (StAdjustment, st_adjustment, G_TYPE_OBJECT,
                         G_ADD_PRIVATE (StAdjustment)
                         G_IMPLEMENT_INTERFACE (CLUTTER_TYPE_ANIMATABLE,
                                                animatable_iface_init));

enum
{
  PROP_0,

  PROP_LOWER,
  PROP_UPPER,
  PROP_VALUE,
  PROP_STEP_INC,
  PROP_PAGE_INC,
  PROP_PAGE_SIZE,

  N_PROPS
};

static GParamSpec *props[N_PROPS] = { NULL, };

enum
{
  CHANGED,

  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0, };

typedef struct _TransitionClosure
{
  StAdjustment *adjustment;
  ClutterTransition *transition;
  char *name;
  gulong completed_id;
} TransitionClosure;

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
animatable_iface_init (ClutterAnimatableInterface *iface)
{
}

static void
st_adjustment_constructed (GObject *object)
{
  GObjectClass *g_class;
  StAdjustment *self = ST_ADJUSTMENT (object);
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (self);

  g_class = G_OBJECT_CLASS (st_adjustment_parent_class);
  /* The docs say we're suppose to chain up, but would crash without
   * some extra care. */
  if (g_class && g_class->constructed &&
      g_class->constructed != st_adjustment_constructed)
    {
      g_class->constructed (object);
    }

  priv->is_constructing = FALSE;
  st_adjustment_clamp_page (self, priv->lower, priv->upper);
}

static void
st_adjustment_get_property (GObject    *gobject,
                            guint       prop_id,
                            GValue     *value,
                            GParamSpec *pspec)
{
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (ST_ADJUSTMENT (gobject));

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
st_adjustment_dispose (GObject *object)
{
  StAdjustmentPrivate *priv;

  priv = st_adjustment_get_instance_private (ST_ADJUSTMENT (object));
  g_clear_pointer (&priv->transitions, g_hash_table_unref);

  G_OBJECT_CLASS (st_adjustment_parent_class)->dispose (object);
}

static void
st_adjustment_class_init (StAdjustmentClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->constructed = st_adjustment_constructed;
  object_class->get_property = st_adjustment_get_property;
  object_class->set_property = st_adjustment_set_property;
  object_class->dispose = st_adjustment_dispose;

  props[PROP_LOWER] =
    g_param_spec_double ("lower", "Lower", "Lower bound",
                         -G_MAXDOUBLE,  G_MAXDOUBLE, 0.0,
                         ST_PARAM_READWRITE |
                         G_PARAM_CONSTRUCT |
                         G_PARAM_EXPLICIT_NOTIFY);

  props[PROP_UPPER] =
    g_param_spec_double ("upper", "Upper", "Upper bound",
                         -G_MAXDOUBLE, G_MAXDOUBLE, 0.0,
                         ST_PARAM_READWRITE |
                         G_PARAM_CONSTRUCT |
                         G_PARAM_EXPLICIT_NOTIFY);

  props[PROP_VALUE] =
    g_param_spec_double ("value", "Value", "Current value",
                         -G_MAXDOUBLE, G_MAXDOUBLE, 0.0,
                         ST_PARAM_READWRITE |
                         G_PARAM_CONSTRUCT |
                         G_PARAM_EXPLICIT_NOTIFY);

  props[PROP_STEP_INC] =
    g_param_spec_double ("step-increment", "Step Increment", "Step increment",
                         0.0, G_MAXDOUBLE, 0.0,
                         ST_PARAM_READWRITE |
                         G_PARAM_CONSTRUCT |
                         G_PARAM_EXPLICIT_NOTIFY);

  props[PROP_PAGE_INC] =
    g_param_spec_double ("page-increment", "Page Increment", "Page increment",
                         0.0, G_MAXDOUBLE, 0.0,
                         ST_PARAM_READWRITE |
                         G_PARAM_CONSTRUCT |
                         G_PARAM_EXPLICIT_NOTIFY);

  props[PROP_PAGE_SIZE] =
    g_param_spec_double ("page-size", "Page Size", "Page size",
                         0.0, G_MAXDOUBLE, 0.0,
                         ST_PARAM_READWRITE |
                         G_PARAM_CONSTRUCT |
                         G_PARAM_EXPLICIT_NOTIFY);

  g_object_class_install_properties (object_class, N_PROPS, props);

  /**
   * StAdjustment::changed:
   * @self: the #StAdjustment
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
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (self);
  priv->is_constructing = TRUE;
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
  g_return_val_if_fail (ST_IS_ADJUSTMENT (adjustment), 0);

  return ((StAdjustmentPrivate *)st_adjustment_get_instance_private (adjustment))->value;
}

void
st_adjustment_set_value (StAdjustment *adjustment,
                         gdouble       value)
{
  StAdjustmentPrivate *priv;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));

  priv = st_adjustment_get_instance_private (adjustment);

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

      g_object_notify_by_pspec (G_OBJECT (adjustment), props[PROP_VALUE]);
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

  priv = st_adjustment_get_instance_private (adjustment);

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
    g_object_notify_by_pspec (G_OBJECT (adjustment), props[PROP_VALUE]);
}

static gboolean
st_adjustment_set_lower (StAdjustment *adjustment,
                         gdouble       lower)
{
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (adjustment);

  if (priv->lower != lower)
    {
      priv->lower = lower;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify_by_pspec (G_OBJECT (adjustment), props[PROP_LOWER]);

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
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (adjustment);

  if (priv->upper != upper)
    {
      priv->upper = upper;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify_by_pspec (G_OBJECT (adjustment), props[PROP_UPPER]);

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
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (adjustment);

  if (priv->step_increment != step)
    {
      priv->step_increment = step;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify_by_pspec (G_OBJECT (adjustment), props[PROP_STEP_INC]);

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_adjustment_set_page_increment (StAdjustment *adjustment,
                                  gdouble       page)
{
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (adjustment);

  if (priv->page_increment != page)
    {
      priv->page_increment = page;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify_by_pspec (G_OBJECT (adjustment), props[PROP_PAGE_INC]);

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_adjustment_set_page_size (StAdjustment *adjustment,
                             gdouble       size)
{
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (adjustment);

  if (priv->page_size != size)
    {
      priv->page_size = size;

      g_signal_emit (adjustment, signals[CHANGED], 0);

      g_object_notify_by_pspec (G_OBJECT (adjustment), props[PROP_PAGE_SIZE]);

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

  priv = st_adjustment_get_instance_private (adjustment);

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

  priv = st_adjustment_get_instance_private (adjustment);

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

/**
 * st_adjustment_adjust_for_scroll_event:
 * @adjustment: An #StAdjustment
 * @delta: A delta, retrieved directly from clutter_event_get_scroll_delta()
 *   or similar.
 *
 * Adjusts the adjustment using delta values from a scroll event.
 * You should use this instead of using st_adjustment_set_value()
 * as this method will tweak the values directly using the same
 * math as GTK+, to ensure that scrolling is consistent across
 * the environment.
 */
void
st_adjustment_adjust_for_scroll_event (StAdjustment *adjustment,
                                       gdouble       delta)
{
  StAdjustmentPrivate *priv;
  gdouble new_value, scroll_unit;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));

  priv = st_adjustment_get_instance_private (adjustment);

  scroll_unit = pow (priv->page_size, 2.0 / 3.0);

  new_value = priv->value + delta * scroll_unit;
  st_adjustment_set_value (adjustment, new_value);
}

static void
transition_closure_free (gpointer data)
{
  TransitionClosure *clos;
  ClutterTimeline *timeline;

  if (G_UNLIKELY (data == NULL))
    return;

  clos = data;
  timeline = CLUTTER_TIMELINE (clos->transition);

  g_clear_signal_handler (&clos->completed_id, clos->transition);

  if (clutter_timeline_is_playing (timeline))
    clutter_timeline_stop (timeline);

  g_object_unref (clos->transition);
  g_free (clos->name);
  g_free (clos);
}

static void
remove_transition (StAdjustment *adjustment,
                   const char   *name)
{
  StAdjustmentPrivate *priv = st_adjustment_get_instance_private (adjustment);

  g_hash_table_remove (priv->transitions, name);

  if (g_hash_table_size (priv->transitions) == 0)
    g_clear_pointer (&priv->transitions, g_hash_table_unref);
}

static void
on_transition_stopped (ClutterTransition *transition,
                       gboolean           is_finished,
                       TransitionClosure *clos)
{
  StAdjustment *adjustment = clos->adjustment;

  if (!clutter_transition_get_remove_on_complete (transition))
    return;

  /* Take a reference, because removing the closure will
   * release the reference on the transition, and we want
   * it to survive the signal emission; ClutterTransition's
   * own ::stopped signal closure will release it after all
   * other handlers have run.
   */
  g_object_ref (transition);

  remove_transition (adjustment, clos->name);
}

/**
 * st_adjustment_get_transition:
 * Returns: (transfer none) (nullable):
 */
ClutterTransition *
st_adjustment_get_transition (StAdjustment *adjustment,
                              const char   *name)
{
  StAdjustmentPrivate *priv;
  TransitionClosure *clos;

  g_return_val_if_fail (ST_IS_ADJUSTMENT (adjustment), NULL);

  priv = st_adjustment_get_instance_private (adjustment);

  if (priv->transitions == NULL)
    return NULL;

  clos = g_hash_table_lookup (priv->transitions, name);
  if (clos == NULL)
    return NULL;

  return clos->transition;
}

void
st_adjustment_add_transition (StAdjustment      *adjustment,
                              const char        *name,
                              ClutterTransition *transition)
{
  StAdjustmentPrivate *priv;
  TransitionClosure *clos;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));
  g_return_if_fail (name != NULL);
  g_return_if_fail (CLUTTER_IS_TRANSITION (transition));

  priv = st_adjustment_get_instance_private (adjustment);

  if (priv->transitions == NULL)
    priv->transitions = g_hash_table_new_full (g_str_hash, g_str_equal,
                                               NULL,
                                               transition_closure_free);

  if (g_hash_table_lookup (priv->transitions, name) != NULL)
    {
      g_warning ("A transition with name '%s' already exists for "
                 "adjustment '%p'", name, adjustment);
      return;
    }

  clutter_transition_set_animatable (transition, CLUTTER_ANIMATABLE (adjustment));

  clos = g_new (TransitionClosure, 1);
  clos->adjustment = adjustment;
  clos->transition = g_object_ref (transition);
  clos->name = g_strdup (name);
  clos->completed_id = g_signal_connect (transition, "stopped",
                                         G_CALLBACK (on_transition_stopped),
                                         clos);

  g_hash_table_insert (priv->transitions, clos->name, clos);
  clutter_timeline_start (CLUTTER_TIMELINE (transition));
}

void
st_adjustment_remove_transition (StAdjustment *adjustment,
                                 const char   *name)
{
  StAdjustmentPrivate *priv;
  TransitionClosure *clos;

  g_return_if_fail (ST_IS_ADJUSTMENT (adjustment));
  g_return_if_fail (name != NULL);

  priv = st_adjustment_get_instance_private (adjustment);

  if (priv->transitions == NULL)
    return;

  clos = g_hash_table_lookup (priv->transitions, name);
  if (clos == NULL)
    return;

  remove_transition (adjustment, name);
}
