/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-scroll-bar.c: Scroll bar actor
 *
 * Copyright 2008 OpenedHand
 * Copyright 2008, 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2010 Maxim Ermilov
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
 * SECTION:st-scroll-bar
 * @short_description: a user interface element to control scrollable areas.
 *
 * The #StScrollBar allows users to scroll scrollable actors, either by
 * the step or page amount, or by manually dragging the handle.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <math.h>
#include <clutter/clutter.h>

#include "st-scroll-bar.h"
#include "st-bin.h"
#include "st-enum-types.h"
#include "st-private.h"
#include "st-button.h"

G_DEFINE_TYPE (StScrollBar, st_scroll_bar, ST_TYPE_WIDGET)

#define ST_SCROLL_BAR_GET_PRIVATE(o)  (G_TYPE_INSTANCE_GET_PRIVATE ((o), ST_TYPE_SCROLL_BAR, StScrollBarPrivate))

#define PAGING_INITIAL_REPEAT_TIMEOUT 500
#define PAGING_SUBSEQUENT_REPEAT_TIMEOUT 200

struct _StScrollBarPrivate
{
  StAdjustment *adjustment;

  gulong        capture_handler;
  gfloat        x_origin;
  gfloat        y_origin;

  ClutterActor *trough;
  ClutterActor *handle;

  gfloat        move_x;
  gfloat        move_y;

  /* Trough-click handling. */
  enum { NONE, UP, DOWN }  paging_direction;
  guint             paging_source_id;
  guint             paging_event_no;

  ClutterAnimation *paging_animation;

  guint             vertical : 1;
};

enum
{
  PROP_0,

  PROP_ADJUSTMENT,
  PROP_VERTICAL
};

enum
{
  SCROLL_START,
  SCROLL_STOP,

  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0, };

extern gfloat st_slow_down_factor;

static gboolean
handle_button_press_event_cb (ClutterActor       *actor,
                              ClutterButtonEvent *event,
                              StScrollBar        *bar);

static void stop_scrolling (StScrollBar *bar);

static void
st_scroll_bar_get_property (GObject    *gobject,
                            guint       prop_id,
                            GValue     *value,
                            GParamSpec *pspec)
{
  StScrollBarPrivate *priv = ST_SCROLL_BAR (gobject)->priv;

  switch (prop_id)
    {
    case PROP_ADJUSTMENT:
      g_value_set_object (value, priv->adjustment);
      break;

    case PROP_VERTICAL:
      g_value_set_boolean (value, priv->vertical);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_scroll_bar_set_property (GObject      *gobject,
                            guint         prop_id,
                            const GValue *value,
                            GParamSpec   *pspec)
{
  StScrollBar *bar = ST_SCROLL_BAR (gobject);

  switch (prop_id)
    {
    case PROP_ADJUSTMENT:
      st_scroll_bar_set_adjustment (bar, g_value_get_object (value));
      break;

    case PROP_VERTICAL:
      bar->priv->vertical = g_value_get_boolean (value);
      if (bar->priv->vertical)
        clutter_actor_set_name (CLUTTER_ACTOR (bar->priv->handle),
                                "vhandle");
      else
        clutter_actor_set_name (CLUTTER_ACTOR (bar->priv->handle),
                                "hhandle");
      clutter_actor_queue_relayout ((ClutterActor*) gobject);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_scroll_bar_dispose (GObject *gobject)
{
  StScrollBar *bar = ST_SCROLL_BAR (gobject);
  StScrollBarPrivate *priv = bar->priv;

  if (priv->adjustment)
    st_scroll_bar_set_adjustment (bar, NULL);

  if (priv->handle)
    {
      clutter_actor_destroy (priv->handle);
      priv->handle = NULL;
    }

  if (priv->trough)
    {
      clutter_actor_destroy (priv->trough);
      priv->trough = NULL;
    }

  G_OBJECT_CLASS (st_scroll_bar_parent_class)->dispose (gobject);
}

static void
st_scroll_bar_unmap (ClutterActor *actor)
{
  CLUTTER_ACTOR_CLASS (st_scroll_bar_parent_class)->unmap (actor);

  stop_scrolling (ST_SCROLL_BAR (actor));
}

static void
scroll_bar_allocate_children (StScrollBar           *bar,
                              const ClutterActorBox *box,
                              ClutterAllocationFlags flags)
{
  StScrollBarPrivate *priv = bar->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (bar));
  ClutterActorBox content_box, trough_box;

  st_theme_node_get_content_box (theme_node, box, &content_box);

  if (priv->vertical)
    {
      trough_box.x1 = content_box.x1;
      trough_box.y1 = content_box.y1;
      trough_box.x2 = content_box.x2;
      trough_box.y2 = content_box.y2;
      clutter_actor_allocate (priv->trough, &trough_box, flags);

    }
  else
    {
      trough_box.x1 = content_box.x1;
      trough_box.y1 = content_box.y1;
      trough_box.x2 = content_box.x2;
      trough_box.y2 = content_box.y2;
      clutter_actor_allocate (priv->trough, &trough_box, flags);
    }

  if (priv->adjustment)
    {
      float handle_size, position, avail_size;
      gdouble value, lower, upper, page_size, increment, min_size, max_size;
      ClutterActorBox handle_box = { 0, };

      st_adjustment_get_values (priv->adjustment,
                                &value,
                                &lower,
                                &upper,
                                NULL,
                                NULL,
                                &page_size);

      if ((upper == lower)
          || (page_size >= (upper - lower)))
        increment = 1.0;
      else
        increment = page_size / (upper - lower);

      min_size = 32.;
      st_theme_node_lookup_length (theme_node, "min-size", FALSE, &min_size);
      max_size = G_MAXINT16;
      st_theme_node_lookup_length (theme_node, "max-size", FALSE, &max_size);

      if (upper - lower - page_size <= 0)
        position = 0;
      else
        position = (value - lower) / (upper - lower - page_size);

      if (priv->vertical)
        {
          avail_size = content_box.y2 - content_box.y1;
          handle_size = increment * avail_size;
          handle_size = CLAMP (handle_size, min_size, max_size);

          handle_box.x1 = content_box.x1;
          handle_box.y1 = content_box.y1 + position * (avail_size - handle_size);

          handle_box.x2 = content_box.x2;
          handle_box.y2 = handle_box.y1 + handle_size;
        }
      else
        {
          avail_size = content_box.x2 - content_box.x1;
          handle_size = increment * avail_size;
          handle_size = CLAMP (handle_size, min_size, max_size);

          handle_box.x1 = content_box.x1 + position * (avail_size - handle_size);
          handle_box.y1 = content_box.y1;

          handle_box.x2 = handle_box.x1 + handle_size;
          handle_box.y2 = content_box.y2;
        }

      /* snap to pixel */
      handle_box.x1 = (int) handle_box.x1;
      handle_box.y1 = (int) handle_box.y1;
      handle_box.x2 = (int) handle_box.x2;
      handle_box.y2 = (int) handle_box.y2;

      clutter_actor_allocate (priv->handle,
                              &handle_box,
                              flags);
    }
}

static void
st_scroll_bar_get_preferred_width (ClutterActor *self,
                                   gfloat        for_height,
                                   gfloat       *min_width_p,
                                   gfloat       *natural_width_p)
{
  StScrollBar *bar = ST_SCROLL_BAR (self);
  StScrollBarPrivate *priv = bar->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));
  gfloat trough_min_width, trough_natural_width;
  gfloat handle_min_width, handle_natural_width;

  st_theme_node_adjust_for_height (theme_node, &for_height);

  _st_actor_get_preferred_width (priv->trough, for_height, TRUE,
                                 &trough_min_width, &trough_natural_width);

  _st_actor_get_preferred_width (priv->handle, for_height, TRUE,
                                 &handle_min_width, &handle_natural_width);

  if (priv->vertical)
    {
      if (min_width_p)
        *min_width_p = MAX (trough_min_width, handle_min_width);

      if (natural_width_p)
        *natural_width_p = MAX (trough_natural_width, handle_natural_width);
    }
  else
    {
      if (min_width_p)
        *min_width_p = trough_min_width + handle_min_width;

      if (natural_width_p)
        *natural_width_p = trough_natural_width + handle_natural_width;
    }

  st_theme_node_adjust_preferred_width (theme_node, min_width_p, natural_width_p);
}

static void
st_scroll_bar_get_preferred_height (ClutterActor *self,
                                    gfloat        for_width,
                                    gfloat       *min_height_p,
                                    gfloat       *natural_height_p)
{
  StScrollBar *bar = ST_SCROLL_BAR (self);
  StScrollBarPrivate *priv = bar->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));
  gfloat trough_min_height, trough_natural_height;
  gfloat handle_min_height, handle_natural_height;

  st_theme_node_adjust_for_width (theme_node, &for_width);

  _st_actor_get_preferred_height (priv->trough, for_width, TRUE,
                                  &trough_min_height, &trough_natural_height);

  _st_actor_get_preferred_height (priv->handle, for_width, TRUE,
                                  &handle_min_height, &handle_natural_height);

  if (priv->vertical)
    {
      if (min_height_p)
        *min_height_p = trough_min_height + handle_min_height;

      if (natural_height_p)
        *natural_height_p = trough_natural_height + handle_natural_height;
    }
  else
    {
      if (min_height_p)
        *min_height_p = MAX (trough_min_height, handle_min_height);

      if (natural_height_p)
        *natural_height_p = MAX (trough_natural_height, handle_natural_height);
    }

  st_theme_node_adjust_preferred_height (theme_node, min_height_p, natural_height_p);
}

static void
st_scroll_bar_allocate (ClutterActor          *actor,
                        const ClutterActorBox *box,
                        ClutterAllocationFlags flags)
{
  StScrollBar *bar = ST_SCROLL_BAR (actor);

  /* Chain up */
  CLUTTER_ACTOR_CLASS (st_scroll_bar_parent_class)->allocate (actor, box, flags);

  scroll_bar_allocate_children (bar, box, flags);
}

static void
scroll_bar_update_positions (StScrollBar *bar)
{
  ClutterActorBox box;

  /* Due to a change in the adjustments, we need to reposition our
   * children; since adjustments changes can come from allocation
   * changes in the scrolled area, we can't just queue a new relayout -
   * we may already be in a relayout cycle. On the other hand, if
   * a relayout is already queued, we can't just go ahead and allocate
   * our children, since we don't have a valid allocation, and calling
   * clutter_actor_get_allocation_box() will trigger an immediate
   * stage relayout. So what we do is go ahead and immediately
   * allocate our children if we already have a valid allocation, and
   * otherwise just wait for the queued relayout.
   */
  if (!clutter_actor_has_allocation (CLUTTER_ACTOR (bar)))
    return;

  clutter_actor_get_allocation_box (CLUTTER_ACTOR (bar), &box);
  scroll_bar_allocate_children (bar, &box, CLUTTER_ALLOCATION_NONE);
}

static void
st_scroll_bar_style_changed (StWidget *widget)
{
  StScrollBarPrivate *priv = ST_SCROLL_BAR (widget)->priv;

  st_widget_style_changed (ST_WIDGET (priv->trough));
  st_widget_style_changed (ST_WIDGET (priv->handle));

  ST_WIDGET_CLASS (st_scroll_bar_parent_class)->style_changed (widget);
}

static void
bar_reactive_notify_cb (GObject    *gobject,
                        GParamSpec *arg1,
                        gpointer    user_data)
{
  StScrollBar *bar = ST_SCROLL_BAR (gobject);

  clutter_actor_set_reactive (bar->priv->handle,
                              clutter_actor_get_reactive (CLUTTER_ACTOR (bar)));
}

static GObject*
st_scroll_bar_constructor (GType                  type,
                           guint                  n_properties,
                           GObjectConstructParam *properties)
{
  GObjectClass *gobject_class;
  GObject *obj;
  StScrollBar *bar;

  gobject_class = G_OBJECT_CLASS (st_scroll_bar_parent_class);
  obj = gobject_class->constructor (type, n_properties, properties);

  bar  = ST_SCROLL_BAR (obj);

  g_signal_connect (bar, "notify::reactive",
                    G_CALLBACK (bar_reactive_notify_cb), NULL);

  return obj;
}

static gboolean
st_scroll_bar_scroll_event (ClutterActor       *actor,
                            ClutterScrollEvent *event)
{
  StScrollBarPrivate *priv = ST_SCROLL_BAR (actor)->priv;
  gdouble step, value, delta_x, delta_y;

  if (priv->adjustment)
    {
      g_object_get (priv->adjustment,
                    "step-increment", &step,
                    "value", &value,
                    NULL);
    }
  else
    {
      return FALSE;
    }

  switch (event->direction)
    {
    case CLUTTER_SCROLL_SMOOTH:
      clutter_event_get_scroll_delta ((ClutterEvent *)event,
                                      &delta_x, &delta_y);
      if (fabs (delta_x) > fabs(delta_y))
        st_adjustment_set_value (priv->adjustment, value + delta_x);
      else
        st_adjustment_set_value (priv->adjustment, value + delta_y);
      break;
    case CLUTTER_SCROLL_UP:
    case CLUTTER_SCROLL_LEFT:
      st_adjustment_set_value (priv->adjustment, value - step);
      break;
    case CLUTTER_SCROLL_DOWN:
    case CLUTTER_SCROLL_RIGHT:
      st_adjustment_set_value (priv->adjustment, value + step);
      break;
    }

  return TRUE;
}

static void
st_scroll_bar_class_init (StScrollBarClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);
  GParamSpec *pspec;

  g_type_class_add_private (klass, sizeof (StScrollBarPrivate));

  object_class->get_property = st_scroll_bar_get_property;
  object_class->set_property = st_scroll_bar_set_property;
  object_class->dispose      = st_scroll_bar_dispose;
  object_class->constructor  = st_scroll_bar_constructor;

  actor_class->get_preferred_width  = st_scroll_bar_get_preferred_width;
  actor_class->get_preferred_height = st_scroll_bar_get_preferred_height;
  actor_class->allocate       = st_scroll_bar_allocate;
  actor_class->scroll_event   = st_scroll_bar_scroll_event;
  actor_class->unmap          = st_scroll_bar_unmap;

  widget_class->style_changed = st_scroll_bar_style_changed;

  g_object_class_install_property
                 (object_class,
                 PROP_ADJUSTMENT,
                 g_param_spec_object ("adjustment",
                                      "Adjustment",
                                      "The adjustment",
                                      ST_TYPE_ADJUSTMENT,
                                      ST_PARAM_READWRITE));

  pspec = g_param_spec_boolean ("vertical",
                                "Vertical Orientation",
                                "Vertical Orientation",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_VERTICAL, pspec);

  signals[SCROLL_START] =
    g_signal_new ("scroll-start",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StScrollBarClass, scroll_start),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  signals[SCROLL_STOP] =
    g_signal_new ("scroll-stop",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StScrollBarClass, scroll_stop),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);
}

static void
move_slider (StScrollBar *bar,
             gfloat       x,
             gfloat       y)
{
  StScrollBarPrivate *priv = bar->priv;
  gdouble position, lower, upper, page_size;
  gfloat ux, uy, pos, size;

  if (!priv->adjustment)
    return;

  if (!clutter_actor_transform_stage_point (priv->trough, x, y, &ux, &uy))
    return;

  if (priv->vertical)
    size = clutter_actor_get_height (priv->trough)
           - clutter_actor_get_height (priv->handle);
  else
    size = clutter_actor_get_width (priv->trough)
           - clutter_actor_get_width (priv->handle);

  if (size == 0)
    return;

  if (priv->vertical)
    pos = uy - priv->y_origin;
  else
    pos = ux - priv->x_origin;
  pos = CLAMP (pos, 0, size);

  st_adjustment_get_values (priv->adjustment,
                            NULL,
                            &lower,
                            &upper,
                            NULL,
                            NULL,
                            &page_size);

  position = ((pos / size)
              * (upper - lower - page_size))
             + lower;

  st_adjustment_set_value (priv->adjustment, position);
}

static void
stop_scrolling (StScrollBar *bar)
{
  ClutterStage *stage;

  if (!bar->priv->capture_handler)
    return;

  stage = CLUTTER_STAGE (clutter_actor_get_stage (bar->priv->trough));
  g_signal_handler_disconnect (stage, bar->priv->capture_handler);
  bar->priv->capture_handler = 0;

  clutter_stage_set_motion_events_enabled (stage, TRUE);
  g_signal_emit (bar, signals[SCROLL_STOP], 0);
}

static gboolean
handle_capture_event_cb (ClutterActor *trough,
                         ClutterEvent *event,
                         StScrollBar  *bar)
{
  if (clutter_event_type (event) == CLUTTER_MOTION)
    {
      move_slider (bar,
                   ((ClutterMotionEvent*) event)->x,
                   ((ClutterMotionEvent*) event)->y);
    }
  else if (clutter_event_type (event) == CLUTTER_BUTTON_RELEASE
           && ((ClutterButtonEvent*) event)->button == 1)
    {
      ClutterActor *stage, *target;

      stop_scrolling (bar);

      /* check if the mouse pointer has left the handle during the drag and
       * remove the hover state if it has */
      stage = clutter_actor_get_stage (bar->priv->trough);
      target = clutter_stage_get_actor_at_pos ((ClutterStage*) stage,
                                               CLUTTER_PICK_REACTIVE,
                                               ((ClutterButtonEvent*) event)->x,
                                               ((ClutterButtonEvent*) event)->y);
      if (target != bar->priv->handle)
        {
          st_widget_remove_style_pseudo_class ((StWidget*) bar->priv->handle, "hover");
        }
    }

  return TRUE;
}

static gboolean
handle_button_press_event_cb (ClutterActor       *actor,
                              ClutterButtonEvent *event,
                              StScrollBar        *bar)
{
  ClutterStage *stage;
  StScrollBarPrivate *priv = bar->priv;

  if (event->button != 1)
    return FALSE;

  if (!clutter_actor_transform_stage_point (priv->handle,
                                            event->x,
                                            event->y,
                                            &priv->x_origin,
                                            &priv->y_origin))
    return FALSE;

  /* Account for the scrollbar-trough-handle nesting. */
  priv->x_origin += clutter_actor_get_x (priv->trough);
  priv->y_origin += clutter_actor_get_y (priv->trough);

  stage = CLUTTER_STAGE (clutter_actor_get_stage (bar->priv->trough));

  /* Turn off picking for motion events */
  clutter_stage_set_motion_events_enabled (stage, FALSE);

  priv->capture_handler = g_signal_connect_after (
    clutter_actor_get_stage (priv->trough),
    "captured-event",
    G_CALLBACK (handle_capture_event_cb),
    bar);
  g_signal_emit (bar, signals[SCROLL_START], 0);

  return TRUE;
}

static void
animation_completed_cb (ClutterAnimation   *animation,
                        StScrollBarPrivate *priv)
{
  g_object_unref (priv->paging_animation);
  priv->paging_animation = NULL;
}

static gboolean
trough_paging_cb (StScrollBar *self)
{
  gfloat handle_pos, event_pos, tx, ty;
  gdouble value;
  gdouble page_increment;
  gboolean ret;

  gulong mode;
  ClutterAnimation *a;
  GValue v = { 0, };
  ClutterTimeline *t;

  if (self->priv->paging_event_no == 0)
    {
      /* Scroll on after initial timeout. */
      mode = CLUTTER_EASE_OUT_CUBIC;
      ret = FALSE;
      self->priv->paging_event_no = 1;
      self->priv->paging_source_id = g_timeout_add (
        PAGING_INITIAL_REPEAT_TIMEOUT,
        (GSourceFunc) trough_paging_cb,
        self);
    }
  else if (self->priv->paging_event_no == 1)
    {
      /* Scroll on after subsequent timeout. */
      ret = FALSE;
      mode = CLUTTER_EASE_IN_CUBIC;
      self->priv->paging_event_no = 2;
      self->priv->paging_source_id = g_timeout_add (
        PAGING_SUBSEQUENT_REPEAT_TIMEOUT,
        (GSourceFunc) trough_paging_cb,
        self);
    }
  else
    {
      /* Keep scrolling. */
      ret = TRUE;
      mode = CLUTTER_LINEAR;
      self->priv->paging_event_no++;
    }

  /* Do the scrolling */
  st_adjustment_get_values (self->priv->adjustment,
                            &value, NULL, NULL,
                            NULL, &page_increment, NULL);

  if (self->priv->vertical)
    handle_pos = clutter_actor_get_y (self->priv->handle);
  else
    handle_pos = clutter_actor_get_x (self->priv->handle);

  clutter_actor_transform_stage_point (CLUTTER_ACTOR (self->priv->trough),
                                       self->priv->move_x,
                                       self->priv->move_y,
                                       &tx, &ty);

  if (self->priv->vertical)
    event_pos = ty;
  else
    event_pos = tx;

  if (event_pos > handle_pos)
    {
      if (self->priv->paging_direction == NONE)
        {
          /* Remember direction. */
          self->priv->paging_direction = DOWN;
        }
      if (self->priv->paging_direction == UP)
        {
          /* Scrolled far enough. */
          return FALSE;
        }
      value += page_increment;
    }
  else
    {
      if (self->priv->paging_direction == NONE)
        {
          /* Remember direction. */
          self->priv->paging_direction = UP;
        }
      if (self->priv->paging_direction == DOWN)
        {
          /* Scrolled far enough. */
          return FALSE;
        }
      value -= page_increment;
    }

  if (self->priv->paging_animation)
    {
      clutter_animation_completed (self->priv->paging_animation);
    }

  /* FIXME: Creating a new animation for each scroll is probably not the best
  * idea, but it's a lot less involved than extenind the current animation */
  a = self->priv->paging_animation = g_object_new (CLUTTER_TYPE_ANIMATION,
                                                   "object", self->priv->adjustment,
                                                   "duration", (guint)(PAGING_SUBSEQUENT_REPEAT_TIMEOUT * st_slow_down_factor),
                                                   "mode", mode,
                                                   NULL);
  g_value_init (&v, G_TYPE_DOUBLE);
  g_value_set_double (&v, value);
  clutter_animation_bind (self->priv->paging_animation, "value", &v);
  t = clutter_animation_get_timeline (self->priv->paging_animation);
  g_signal_connect (a, "completed", G_CALLBACK (animation_completed_cb),
                    self->priv);
  clutter_timeline_start (t);

  return ret;
}

static gboolean
trough_button_press_event_cb (ClutterActor       *actor,
                              ClutterButtonEvent *event,
                              StScrollBar        *self)
{
  g_return_val_if_fail (self, FALSE);

  if (event->button != 1)
    return FALSE;

  if (self->priv->adjustment == NULL)
    return FALSE;

  self->priv->move_x = event->x;
  self->priv->move_y = event->y;
  self->priv->paging_direction = NONE;
  self->priv->paging_event_no = 0;
  trough_paging_cb (self);

  return TRUE;
}

static gboolean
trough_button_release_event_cb (ClutterActor       *actor,
                                ClutterButtonEvent *event,
                                StScrollBar        *self)
{
  if (event->button != 1)
    return FALSE;

  if (self->priv->paging_source_id)
    {
      g_source_remove (self->priv->paging_source_id);
      self->priv->paging_source_id = 0;
    }

  return TRUE;
}

static gboolean
trough_leave_event_cb (ClutterActor *actor,
                       ClutterEvent *event,
                       StScrollBar  *self)
{
  if (self->priv->paging_source_id)
    {
      g_source_remove (self->priv->paging_source_id);
      self->priv->paging_source_id = 0;
      return TRUE;
    }

  return FALSE;
}

static void
st_scroll_bar_notify_reactive (StScrollBar *self)
{
  StScrollBarPrivate *priv = self->priv;

  gboolean reactive = CLUTTER_ACTOR_IS_REACTIVE (self);

  clutter_actor_set_reactive (CLUTTER_ACTOR (priv->trough), reactive);
  clutter_actor_set_reactive (CLUTTER_ACTOR (priv->handle), reactive);
}

static void
st_scroll_bar_init (StScrollBar *self)
{
  self->priv = ST_SCROLL_BAR_GET_PRIVATE (self);

  self->priv->trough = (ClutterActor *) st_bin_new ();
  clutter_actor_set_reactive ((ClutterActor *) self->priv->trough, TRUE);
  clutter_actor_set_name (CLUTTER_ACTOR (self->priv->trough), "trough");
  clutter_actor_add_child (CLUTTER_ACTOR (self),
                           CLUTTER_ACTOR (self->priv->trough));
  g_signal_connect (self->priv->trough, "button-press-event",
                    G_CALLBACK (trough_button_press_event_cb), self);
  g_signal_connect (self->priv->trough, "button-release-event",
                    G_CALLBACK (trough_button_release_event_cb), self);
  g_signal_connect (self->priv->trough, "leave-event",
                    G_CALLBACK (trough_leave_event_cb), self);

  self->priv->handle = (ClutterActor *) st_button_new ();
  clutter_actor_set_name (CLUTTER_ACTOR (self->priv->handle), "hhandle");
  clutter_actor_add_child (CLUTTER_ACTOR (self),
                           CLUTTER_ACTOR (self->priv->handle));
  g_signal_connect (self->priv->handle, "button-press-event",
                    G_CALLBACK (handle_button_press_event_cb), self);

  clutter_actor_set_reactive (CLUTTER_ACTOR (self), TRUE);

  g_signal_connect (self, "notify::reactive",
                    G_CALLBACK (st_scroll_bar_notify_reactive), NULL);
}

StWidget *
st_scroll_bar_new (StAdjustment *adjustment)
{
  return g_object_new (ST_TYPE_SCROLL_BAR,
                       "adjustment", adjustment,
                       NULL);
}

static void
on_notify_value (GObject     *object,
                 GParamSpec  *pspec,
                 StScrollBar *bar)
{
  scroll_bar_update_positions (bar);
}

static void
on_changed (StAdjustment *adjustment,
            StScrollBar  *bar)
{
  scroll_bar_update_positions (bar);
}

void
st_scroll_bar_set_adjustment (StScrollBar  *bar,
                              StAdjustment *adjustment)
{
  StScrollBarPrivate *priv;

  g_return_if_fail (ST_IS_SCROLL_BAR (bar));

  priv = bar->priv;

  if (adjustment == priv->adjustment)
    return;

  if (priv->adjustment)
    {
      g_signal_handlers_disconnect_by_func (priv->adjustment,
                                            on_notify_value,
                                            bar);
      g_signal_handlers_disconnect_by_func (priv->adjustment,
                                            on_changed,
                                            bar);
      g_object_unref (priv->adjustment);
      priv->adjustment = NULL;
    }

  if (adjustment)
    {
      priv->adjustment = g_object_ref (adjustment);

      g_signal_connect (priv->adjustment, "notify::value",
                        G_CALLBACK (on_notify_value),
                        bar);
      g_signal_connect (priv->adjustment, "changed",
                        G_CALLBACK (on_changed),
                        bar);

      clutter_actor_queue_relayout (CLUTTER_ACTOR (bar));
    }

  g_object_notify (G_OBJECT (bar), "adjustment");
}

/**
 * st_scroll_bar_get_adjustment:
 * @bar: a #StScrollbar
 *
 * Gets the adjustment object that stores the current position
 * of the scrollbar.
 *
 * Return value: (transfer none): the adjustment
 */
StAdjustment *
st_scroll_bar_get_adjustment (StScrollBar *bar)
{
  g_return_val_if_fail (ST_IS_SCROLL_BAR (bar), NULL);

  return bar->priv->adjustment;
}

