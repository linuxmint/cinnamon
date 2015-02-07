/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-widget.c: Base class for St actors
 *
 * Copyright 2007 OpenedHand
 * Copyright 2008, 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2009 Abderrahim Kitouni
 * Copyright 2009, 2010 Florian Müllner
 * Copyright 2010 Adel Gadllah
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
#include <string.h>
#include <math.h>

#include <clutter/clutter.h>

#include "st-widget.h"

#include "st-background-effect.h"
#include "st-label.h"
#include "st-marshal.h"
#include "st-private.h"
#include "st-texture-cache.h"
#include "st-theme-context.h"
#include "st-tooltip.h"
#include "st-theme-node-transition.h"

#include "st-widget-accessible.h"

#include <gtk/gtk.h>

/*
 * Forward declaration for sake of StWidgetChild
 */
struct _StWidgetPrivate
{
  StTheme      *theme;
  StThemeNode  *theme_node;
  gchar        *pseudo_class;
  gchar        *style_class;
  gchar        *inline_style;

  StThemeNodeTransition *transition_animation;
  guint tooltip_timeout_id;

  gboolean      is_stylable : 1;
  gboolean      has_tooltip : 1;
  gboolean      show_tooltip : 1;
  gboolean      is_style_dirty : 1;
  gboolean      draw_bg_color : 1;
  gboolean      draw_border_internal : 1;
  gboolean      track_hover : 1;
  gboolean      hover : 1;
  gboolean      can_focus : 1;
  gboolean      important : 1;

  StTooltip    *tooltip;

  StTextDirection   direction;

  AtkObject *accessible;

  ClutterActor *label_actor;
};

/**
 * SECTION:st-widget
 * @short_description: Base class for stylable actors
 *
 * #StWidget is a simple abstract class on top of #ClutterActor. It
 * provides basic themeing properties.
 *
 * Actors in the St library should subclass #StWidget if they plan
 * to obey to a certain #StStyle.
 */

enum
{
  PROP_0,

  PROP_THEME,
  PROP_PSEUDO_CLASS,
  PROP_STYLE_CLASS,
  PROP_STYLE,
  PROP_STYLABLE,
  PROP_HAS_TOOLTIP,
  PROP_TOOLTIP_TEXT,
  PROP_TRACK_HOVER,
  PROP_HOVER,
  PROP_CAN_FOCUS,
  PROP_LABEL_ACTOR,
  PROP_IMPORTANT
};

enum
{
  STYLE_CHANGED,
  POPUP_MENU,

  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0, };

gfloat st_slow_down_factor = 1.0;

G_DEFINE_ABSTRACT_TYPE (StWidget, st_widget, CLUTTER_TYPE_ACTOR);

#define ST_WIDGET_GET_PRIVATE(obj)    (G_TYPE_INSTANCE_GET_PRIVATE ((obj), ST_TYPE_WIDGET, StWidgetPrivate))

static void st_widget_recompute_style (StWidget    *widget,
                                       StThemeNode *old_theme_node);
static gboolean st_widget_real_navigate_focus (StWidget         *widget,
                                               ClutterActor     *from,
                                               GtkDirectionType  direction);

static AtkObject * st_widget_get_accessible (ClutterActor *actor);

static void st_widget_start_tooltip_timeout (StWidget *widget);
static void st_widget_do_show_tooltip (StWidget *widget);
static void st_widget_do_hide_tooltip (StWidget *widget);

static void
st_widget_set_property (GObject      *gobject,
                        guint         prop_id,
                        const GValue *value,
                        GParamSpec   *pspec)
{
  StWidget *actor = ST_WIDGET (gobject);

  switch (prop_id)
    {
    case PROP_THEME:
      st_widget_set_theme (actor, g_value_get_object (value));
      break;

    case PROP_PSEUDO_CLASS:
      st_widget_set_style_pseudo_class (actor, g_value_get_string (value));
      break;

    case PROP_STYLE_CLASS:
      st_widget_set_style_class_name (actor, g_value_get_string (value));
      break;

    case PROP_STYLE:
      st_widget_set_style (actor, g_value_get_string (value));
      break;

    case PROP_STYLABLE:
      if (actor->priv->is_stylable != g_value_get_boolean (value))
        {
          actor->priv->is_stylable = g_value_get_boolean (value);
          clutter_actor_queue_relayout ((ClutterActor *) gobject);
        }
      break;

    case PROP_HAS_TOOLTIP:
      st_widget_set_has_tooltip (actor, g_value_get_boolean (value));
      break;

    case PROP_TOOLTIP_TEXT:
      st_widget_set_tooltip_text (actor, g_value_get_string (value));
      break;

    case PROP_TRACK_HOVER:
      st_widget_set_track_hover (actor, g_value_get_boolean (value));
      break;

    case PROP_HOVER:
      st_widget_set_hover (actor, g_value_get_boolean (value));
      break;

    case PROP_CAN_FOCUS:
      st_widget_set_can_focus (actor, g_value_get_boolean (value));
      break;

    case PROP_LABEL_ACTOR:
      st_widget_set_label_actor (actor, g_value_get_object (value));
      break;

    case PROP_IMPORTANT:
      actor->priv->important = g_value_get_boolean (value);
      clutter_actor_queue_relayout ((ClutterActor *) gobject);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_widget_get_property (GObject    *gobject,
                        guint       prop_id,
                        GValue     *value,
                        GParamSpec *pspec)
{
  StWidget *actor = ST_WIDGET (gobject);
  StWidgetPrivate *priv = actor->priv;

  switch (prop_id)
    {
    case PROP_THEME:
      g_value_set_object (value, priv->theme);
      break;

    case PROP_PSEUDO_CLASS:
      g_value_set_string (value, priv->pseudo_class);
      break;

    case PROP_STYLE_CLASS:
      g_value_set_string (value, priv->style_class);
      break;

    case PROP_STYLE:
      g_value_set_string (value, priv->inline_style);
      break;

    case PROP_STYLABLE:
      g_value_set_boolean (value, priv->is_stylable);
      break;

    case PROP_HAS_TOOLTIP:
      g_value_set_boolean (value, priv->has_tooltip);
      break;

    case PROP_TOOLTIP_TEXT:
      g_value_set_string (value, st_widget_get_tooltip_text (actor));
      break;

    case PROP_TRACK_HOVER:
      g_value_set_boolean (value, priv->track_hover);
      break;

    case PROP_HOVER:
      g_value_set_boolean (value, priv->hover);
      break;

    case PROP_CAN_FOCUS:
      g_value_set_boolean (value, priv->can_focus);
      break;

    case PROP_LABEL_ACTOR:
      g_value_set_object (value, priv->label_actor);
      break;

    case PROP_IMPORTANT:
      g_value_set_boolean (value, priv->important);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_widget_remove_transition (StWidget *widget)
{
  if (widget->priv->transition_animation)
    {
      g_object_run_dispose (G_OBJECT (widget->priv->transition_animation));
      g_object_unref (widget->priv->transition_animation);
      widget->priv->transition_animation = NULL;
    }
}

static void
st_widget_dispose (GObject *gobject)
{
  StWidget *actor = ST_WIDGET (gobject);
  StWidgetPrivate *priv = ST_WIDGET (actor)->priv;

  if (priv->theme)
    {
      g_object_unref (priv->theme);
      priv->theme = NULL;
    }

  if (priv->theme_node)
    {
      g_object_unref (priv->theme_node);
      priv->theme_node = NULL;
    }

  st_widget_remove_transition (actor);

  if (priv->tooltip_timeout_id)
    {
      g_source_remove (priv->tooltip_timeout_id);
      priv->tooltip_timeout_id = 0;
    }

  if (priv->tooltip)
    {
      clutter_actor_destroy (CLUTTER_ACTOR (priv->tooltip));
      g_object_unref (priv->tooltip);
      priv->tooltip = NULL;
    }

  /* The real dispose of this accessible is done on
   * AtkGObjectAccessible weak ref callback
   */
  if (priv->accessible)
    priv->accessible = NULL;

  if (priv->label_actor)
    {
      g_object_unref (priv->label_actor);
      priv->label_actor = NULL;
    }

  G_OBJECT_CLASS (st_widget_parent_class)->dispose (gobject);
}

static void
st_widget_finalize (GObject *gobject)
{
  StWidgetPrivate *priv = ST_WIDGET (gobject)->priv;

  g_free (priv->style_class);
  g_free (priv->pseudo_class);

  G_OBJECT_CLASS (st_widget_parent_class)->finalize (gobject);
}


static void
st_widget_get_preferred_width (ClutterActor *self,
                               gfloat        for_height,
                               gfloat       *min_width_p,
                               gfloat       *natural_width_p)
{
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));

  /* Most subclasses will override this and not chain down. However,
   * if they do not, then we need to override ClutterActor's default
   * behavior (request 0x0) to take CSS-specified minimums into
   * account (which st_theme_node_adjust_preferred_width() will do.)
   */

  if (min_width_p)
    *min_width_p = 0;

  if (natural_width_p)
    *natural_width_p = 0;

  st_theme_node_adjust_preferred_width (theme_node, min_width_p, natural_width_p);
}

static void
st_widget_get_preferred_height (ClutterActor *self,
                                gfloat        for_width,
                                gfloat       *min_height_p,
                                gfloat       *natural_height_p)
{
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (self));

  /* See st_widget_get_preferred_width() */

  if (min_height_p)
    *min_height_p = 0;

  if (natural_height_p)
    *natural_height_p = 0;

  st_theme_node_adjust_preferred_height (theme_node, min_height_p, natural_height_p);
}

static void
st_widget_allocate (ClutterActor          *actor,
                    const ClutterActorBox *box,
                    ClutterAllocationFlags flags)
{
  StWidget *self = ST_WIDGET (actor);
  StWidgetPrivate *priv = self->priv;
  ClutterActorClass *klass;
  ClutterGeometry area;
  ClutterVertex in_v, out_v;

  klass = CLUTTER_ACTOR_CLASS (st_widget_parent_class);
  klass->allocate (actor, box, flags);

  /* update tooltip position */
  if (priv->tooltip)
    {
      in_v.x = in_v.y = in_v.z = 0;
      clutter_actor_apply_transform_to_point (actor, &in_v, &out_v);
      area.x = out_v.x;
      area.y = out_v.y;

      in_v.x = box->x2 - box->x1;
      in_v.y = box->y2 - box->y1;
      clutter_actor_apply_transform_to_point (actor, &in_v, &out_v);
      area.width = out_v.x - area.x;
      area.height = out_v.y - area.y;

      st_tooltip_set_tip_area (priv->tooltip, &area);
    }
}

static void
st_widget_paint (ClutterActor *actor)
{
  StWidget *self = ST_WIDGET (actor);
  StThemeNode *theme_node;
  ClutterActorBox allocation;
  guint8 opacity;

  theme_node = st_widget_get_theme_node (self);

  clutter_actor_get_allocation_box (actor, &allocation);

  opacity = clutter_actor_get_paint_opacity (actor);

  if (self->priv->transition_animation)
    st_theme_node_transition_paint (self->priv->transition_animation,
                                    &allocation,
                                    opacity);
  else
    st_theme_node_paint (theme_node, &allocation, opacity);

  ClutterEffect *effect = clutter_actor_get_effect (actor, "background-effect");

  if (effect == NULL)
    {
      effect = st_background_effect_new ();
      clutter_actor_add_effect_with_name (actor, "background-effect", effect);
    }

  const char *bumpmap_path = st_theme_node_get_background_bumpmap(theme_node);

  g_object_set (effect,
                "bumpmap",
                bumpmap_path,
                NULL);
}

static void
st_widget_parent_set (ClutterActor *widget,
                      ClutterActor *old_parent)
{
  ClutterActorClass *parent_class;
  ClutterActor *new_parent;

  parent_class = CLUTTER_ACTOR_CLASS (st_widget_parent_class);
  if (parent_class->parent_set)
    parent_class->parent_set (widget, old_parent);

  new_parent = clutter_actor_get_parent (widget);

  /* don't send the style changed signal if we no longer have a parent actor */
  if (new_parent)
    st_widget_style_changed (ST_WIDGET (widget));
}

static void
st_widget_map (ClutterActor *actor)
{
  StWidget *self = ST_WIDGET (actor);

  CLUTTER_ACTOR_CLASS (st_widget_parent_class)->map (actor);

  st_widget_ensure_style (self);

  if (self->priv->show_tooltip)
    st_widget_do_show_tooltip (self);
}

static void
st_widget_unmap (ClutterActor *actor)
{
  StWidget *self = ST_WIDGET (actor);
  StWidgetPrivate *priv = self->priv;

  CLUTTER_ACTOR_CLASS (st_widget_parent_class)->unmap (actor);

  if (priv->track_hover && priv->hover)
    st_widget_set_hover (self, FALSE);

  st_widget_do_hide_tooltip (self);
}

static void notify_children_of_style_change (ClutterContainer *container);

static void
notify_children_of_style_change_foreach (ClutterActor *actor,
                                         gpointer      user_data)
{
  if (ST_IS_WIDGET (actor))
    st_widget_style_changed (ST_WIDGET (actor));
  else if (CLUTTER_IS_CONTAINER (actor))
    notify_children_of_style_change ((ClutterContainer *)actor);
}

static void
notify_children_of_style_change (ClutterContainer *container)
{
  /* notify our children that their parent stylable has changed */
  clutter_container_foreach (container,
                             notify_children_of_style_change_foreach,
                             NULL);
}

static void
st_widget_real_style_changed (StWidget *self)
{
  StWidgetPrivate *priv = ST_WIDGET (self)->priv;

  /* application has request this widget is not stylable */
  if (!priv->is_stylable)
    return;

  clutter_actor_queue_redraw ((ClutterActor *) self);

  if (CLUTTER_IS_CONTAINER (self))
    notify_children_of_style_change ((ClutterContainer *)self);
}

void
st_widget_style_changed (StWidget *widget)
{
  StThemeNode *old_theme_node = NULL;

  widget->priv->is_style_dirty = TRUE;
  if (widget->priv->theme_node)
    {
      old_theme_node = widget->priv->theme_node;
      widget->priv->theme_node = NULL;
    }

  /* update the style only if we are mapped */
  if (CLUTTER_ACTOR_IS_MAPPED (CLUTTER_ACTOR (widget)))
    st_widget_recompute_style (widget, old_theme_node);

  if (old_theme_node)
    g_object_unref (old_theme_node);
}

static void
on_theme_context_changed (StThemeContext *context,
                          ClutterStage      *stage)
{
  notify_children_of_style_change (CLUTTER_CONTAINER (stage));
}

static StThemeNode *
get_root_theme_node (ClutterStage *stage)
{
  StThemeContext *context = st_theme_context_get_for_stage (stage);

  if (!g_object_get_data (G_OBJECT (context), "st-theme-initialized"))
    {
      g_object_set_data (G_OBJECT (context), "st-theme-initialized", GUINT_TO_POINTER (1));
      g_signal_connect (G_OBJECT (context), "changed",
                        G_CALLBACK (on_theme_context_changed), stage);
    }

  return st_theme_context_get_root_node (context);
}

/**
 * st_widget_get_theme_node:
 * @widget: a #StWidget
 *
 * Gets the theme node holding style information for the widget.
 * The theme node is used to access standard and custom CSS
 * properties of the widget.
 *
 * Note: this should only be called on a widget that has been
 * added to the stage
 *
 * Return value: (transfer none): the theme node for the widget.
 *   This is owned by the widget. When attributes of the widget
 *   or the environment that affect the styling change (for example
 *   the style_class property of the widget), it will be recreated,
 *   and the ::style-changed signal will be emitted on the widget.
 */
StThemeNode *
st_widget_get_theme_node (StWidget *widget)
{
  StWidgetPrivate *priv = widget->priv;

  if (priv->theme_node == NULL)
    {
      StThemeNode *parent_node = NULL;
      ClutterStage *stage = NULL;
      ClutterActor *parent;
      StThemeContext *context;
      StThemeNode *tmp_node;
      char *pseudo_class, *direction_pseudo_class;

      parent = clutter_actor_get_parent (CLUTTER_ACTOR (widget));
      while (parent != NULL)
        {
          if (parent_node == NULL && ST_IS_WIDGET (parent))
            parent_node = st_widget_get_theme_node (ST_WIDGET (parent));
          else if (CLUTTER_IS_STAGE (parent))
            stage = CLUTTER_STAGE (parent);

          parent = clutter_actor_get_parent (parent);
        }

      if (stage == NULL)
        {
          g_critical ("st_widget_get_theme_node called on the widget %s which is not in the stage.",
                    st_describe_actor (CLUTTER_ACTOR (widget)));
          return g_object_new (ST_TYPE_THEME_NODE, NULL);
        }

      if (parent_node == NULL)
        parent_node = get_root_theme_node (CLUTTER_STAGE (stage));

      /* Always append a "magic" pseudo class indicating the text
       * direction, to allow to adapt the CSS when necessary without
       * requiring separate style sheets.
       */
      if (st_widget_get_direction (widget) == ST_TEXT_DIRECTION_RTL)
        direction_pseudo_class = "rtl";
      else
        direction_pseudo_class = "ltr";

      if (priv->pseudo_class)
        pseudo_class = g_strconcat(priv->pseudo_class, " ",
                                   direction_pseudo_class, NULL);
      else
        pseudo_class = direction_pseudo_class;

      context = st_theme_context_get_for_stage (stage);
      tmp_node = st_theme_node_new (context, parent_node, priv->theme,
                                    G_OBJECT_TYPE (widget),
                                    clutter_actor_get_name (CLUTTER_ACTOR (widget)),
                                    priv->style_class,
                                    pseudo_class,
                                    priv->inline_style,
                                    priv->important);

      if (pseudo_class != direction_pseudo_class)
        g_free (pseudo_class);

      priv->theme_node = g_object_ref (st_theme_context_intern_node (context,
                                                                     tmp_node));
      g_object_unref (tmp_node);
    }

  return priv->theme_node;
}

/**
 * st_widget_peek_theme_node:
 * @widget: a #StWidget
 *
 * Returns the theme node for the widget if it has already been
 * computed, %NULL if the widget hasn't been added to a  stage or the theme
 * node hasn't been computed. If %NULL is returned, then ::style-changed
 * will be reliably emitted before the widget is allocated or painted.
 *
 * Return value: (transfer none): the theme node for the widget.
 *   This is owned by the widget. When attributes of the widget
 *   or the environment that affect the styling change (for example
 *   the style_class property of the widget), it will be recreated,
 *   and the ::style-changed signal will be emitted on the widget.
 */
StThemeNode *
st_widget_peek_theme_node (StWidget *widget)
{
  StWidgetPrivate *priv = widget->priv;

  return priv->theme_node;
}

static gboolean
st_widget_enter (ClutterActor         *actor,
                 ClutterCrossingEvent *event)
{
  StWidgetPrivate *priv = ST_WIDGET (actor)->priv;

  if (priv->track_hover)
    {
      if (clutter_actor_contains (actor, event->source))
        st_widget_set_hover (ST_WIDGET (actor), TRUE);
      else
        {
          /* The widget has a grab and is being told about an
           * enter-event outside its hierarchy. Hopefully we already
           * got a leave-event, but if not, handle it now.
           */
          st_widget_set_hover (ST_WIDGET (actor), FALSE);
        }
    }

  if (CLUTTER_ACTOR_CLASS (st_widget_parent_class)->enter_event)
    return CLUTTER_ACTOR_CLASS (st_widget_parent_class)->enter_event (actor, event);
  else
    return FALSE;
}

static gboolean
st_widget_leave (ClutterActor         *actor,
                 ClutterCrossingEvent *event)
{
  StWidgetPrivate *priv = ST_WIDGET (actor)->priv;

  if (priv->track_hover)
    {
      if (!event->related || !clutter_actor_contains (actor, event->related))
        st_widget_set_hover (ST_WIDGET (actor), FALSE);
    }

  if (CLUTTER_ACTOR_CLASS (st_widget_parent_class)->leave_event)
    return CLUTTER_ACTOR_CLASS (st_widget_parent_class)->leave_event (actor, event);
  else
    return FALSE;
}

static gboolean
st_widget_motion (ClutterActor       *actor,
                  ClutterMotionEvent *motion)
{
  StWidget *widget = ST_WIDGET (actor);
  StWidgetPrivate *priv = widget->priv;

  if (priv->has_tooltip)
    st_widget_start_tooltip_timeout (widget);

  return FALSE;
}

static void
st_widget_key_focus_in (ClutterActor *actor)
{
  StWidget *widget = ST_WIDGET (actor);

  st_widget_add_style_pseudo_class (widget, "focus");
}

static void
st_widget_key_focus_out (ClutterActor *actor)
{
  StWidget *widget = ST_WIDGET (actor);

  st_widget_remove_style_pseudo_class (widget, "focus");
}

static gboolean
st_widget_key_press_event (ClutterActor    *actor,
                           ClutterKeyEvent *event)
{
  if (event->keyval == CLUTTER_KEY_Menu ||
      (event->keyval == CLUTTER_KEY_F10 &&
       (event->modifier_state & CLUTTER_SHIFT_MASK)))
    {
      g_signal_emit (actor, signals[POPUP_MENU], 0);
      return TRUE;
    }

  return FALSE;
}

static void
st_widget_hide (ClutterActor *actor)
{
  StWidget *widget = (StWidget *) actor;

  /* hide the tooltip, if there is one */
  if (widget->priv->tooltip)
    clutter_actor_hide (CLUTTER_ACTOR (widget->priv->tooltip));

  CLUTTER_ACTOR_CLASS (st_widget_parent_class)->hide (actor);
}

static gboolean
st_widget_get_paint_volume (ClutterActor *self, ClutterPaintVolume *volume)
{
  ClutterActorBox paint_box, alloc_box;
  StThemeNode *theme_node;
  StWidgetPrivate *priv;
  ClutterVertex origin;

  /* Setting the paint volume does not make sense when we don't have any allocation */
  if (!clutter_actor_has_allocation (self))
    return FALSE;

  priv = ST_WIDGET(self)->priv;

  theme_node = st_widget_get_theme_node (ST_WIDGET(self));
  clutter_actor_get_allocation_box (self, &alloc_box);

  if (priv->transition_animation)
    st_theme_node_transition_get_paint_box (priv->transition_animation,
                                            &alloc_box, &paint_box);
  else
    st_theme_node_get_paint_box (theme_node, &alloc_box, &paint_box);

  origin.x = paint_box.x1 - alloc_box.x1;
  origin.y = paint_box.y1 - alloc_box.y1;
  origin.z = 0.0f;

  clutter_paint_volume_set_origin (volume, &origin);
  clutter_paint_volume_set_width (volume, paint_box.x2 - paint_box.x1);
  clutter_paint_volume_set_height (volume, paint_box.y2 - paint_box.y1);

  return TRUE;
}


static void
st_widget_class_init (StWidgetClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  GParamSpec *pspec;

  g_type_class_add_private (klass, sizeof (StWidgetPrivate));

  gobject_class->set_property = st_widget_set_property;
  gobject_class->get_property = st_widget_get_property;
  gobject_class->dispose = st_widget_dispose;
  gobject_class->finalize = st_widget_finalize;

  actor_class->get_preferred_width = st_widget_get_preferred_width;
  actor_class->get_preferred_height = st_widget_get_preferred_height;
  actor_class->allocate = st_widget_allocate;
  actor_class->paint = st_widget_paint;
  actor_class->get_paint_volume = st_widget_get_paint_volume;
  actor_class->parent_set = st_widget_parent_set;
  actor_class->map = st_widget_map;
  actor_class->unmap = st_widget_unmap;

  actor_class->enter_event = st_widget_enter;
  actor_class->leave_event = st_widget_leave;
  actor_class->motion_event = st_widget_motion;
  actor_class->key_focus_in = st_widget_key_focus_in;
  actor_class->key_focus_out = st_widget_key_focus_out;
  actor_class->key_press_event = st_widget_key_press_event;
  actor_class->hide = st_widget_hide;

  actor_class->get_accessible = st_widget_get_accessible;

  klass->style_changed = st_widget_real_style_changed;
  klass->navigate_focus = st_widget_real_navigate_focus;
  klass->get_accessible_type = st_widget_accessible_get_type;

  /**
   * StWidget:pseudo-class:
   *
   * The pseudo-class of the actor. Typical values include "hover", "active",
   * "focus".
   */
  g_object_class_install_property (gobject_class,
                                   PROP_PSEUDO_CLASS,
                                   g_param_spec_string ("pseudo-class",
                                                        "Pseudo Class",
                                                        "Pseudo class for styling",
                                                        "",
                                                        ST_PARAM_READWRITE));
  /**
   * StWidget:style-class:
   *
   * The style-class of the actor for use in styling.
   */
  g_object_class_install_property (gobject_class,
                                   PROP_STYLE_CLASS,
                                   g_param_spec_string ("style-class",
                                                        "Style Class",
                                                        "Style class for styling",
                                                        "",
                                                        ST_PARAM_READWRITE));

  /**
   * StWidget:style:
   *
   * Inline style information for the actor as a ';'-separated list of
   * CSS properties.
   */
  g_object_class_install_property (gobject_class,
                                   PROP_STYLE,
                                   g_param_spec_string ("style",
                                                        "Style",
                                                        "Inline style string",
                                                        "",
                                                        ST_PARAM_READWRITE));

  /**
   * StWidget:theme:
   *
   * A theme set on this actor overriding the global theming for this actor
   * and its descendants
   */
  g_object_class_install_property (gobject_class,
                                   PROP_THEME,
                                   g_param_spec_object ("theme",
                                                        "Theme",
                                                        "Theme override",
                                                        ST_TYPE_THEME,
                                                        ST_PARAM_READWRITE));

  /**
   * StWidget:stylable:
   *
   * Enable or disable styling of the widget
   */
  pspec = g_param_spec_boolean ("stylable",
                                "Stylable",
                                "Whether the table should be styled",
                                TRUE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_STYLABLE,
                                   pspec);

  /**
   * StWidget:has-tooltip:
   *
   * Determines whether the widget has a tooltip. If set to %TRUE, causes the
   * widget to monitor hover state (i.e. sets #ClutterActor:reactive and
   * #StWidget:track-hover).
   */
  pspec = g_param_spec_boolean ("has-tooltip",
                                "Has Tooltip",
                                "Determines whether the widget has a tooltip",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_HAS_TOOLTIP,
                                   pspec);


  /**
   * StWidget:tooltip-text:
   *
   * text displayed on the tooltip
   */
  pspec = g_param_spec_string ("tooltip-text",
                               "Tooltip Text",
                               "Text displayed on the tooltip",
                               "",
                               ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_TOOLTIP_TEXT, pspec);

  /**
   * StWidget:track-hover:
   *
   * Determines whether the widget tracks pointer hover state. If
   * %TRUE (and the widget is visible and reactive), the
   * #StWidget:hover property and "hover" style pseudo class will be
   * adjusted automatically as the pointer moves in and out of the
   * widget.
   */
  pspec = g_param_spec_boolean ("track-hover",
                                "Track hover",
                                "Determines whether the widget tracks hover state",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_TRACK_HOVER,
                                   pspec);

  /**
   * StWidget:hover:
   *
   * Whether or not the pointer is currently hovering over the widget. This is
   * only tracked automatically if #StWidget:track-hover is %TRUE, but you can
   * adjust it manually in any case.
   */
  pspec = g_param_spec_boolean ("hover",
                                "Hover",
                                "Whether the pointer is hovering over the widget",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_HOVER,
                                   pspec);

  /**
   * StWidget:can-focus:
   *
   * Whether or not the widget can be focused via keyboard navigation.
   */
  pspec = g_param_spec_boolean ("can-focus",
                                "Can focus",
                                "Whether the widget can be focused via keyboard navigation",
                                FALSE,
                                ST_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_CAN_FOCUS,
                                   pspec);

  /**
   * StWidget:important:
   *
   * Whether or not the fallback theme should be used for lookups in case the user theme fails.
   */
  pspec = g_param_spec_boolean ("important",
                                "Important",
                                "Whether the widget styling should be looked up in the fallback theme",
                                FALSE,
                                ST_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY);
  g_object_class_install_property (gobject_class,
                                   PROP_IMPORTANT,
                                   pspec);

  /**
   * ClutterActor:label-actor:
   *
   * An actor that labels this widget.
   */
  g_object_class_install_property (gobject_class,
                                   PROP_LABEL_ACTOR,
                                   g_param_spec_object ("label-actor",
                                                        "Label",
                                                        "Label that identifies this widget",
                                                        CLUTTER_TYPE_ACTOR,
                                                        ST_PARAM_READWRITE));

  /**
   * StWidget::style-changed:
   * @widget: the #StWidget
   *
   * Emitted when the style information that the widget derives from the
   * theme changes
   */
  signals[STYLE_CHANGED] =
    g_signal_new ("style-changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StWidgetClass, style_changed),
                  NULL, NULL,
                  _st_marshal_VOID__VOID,
                  G_TYPE_NONE, 0);

  /**
   * StWidget::popup-menu:
   * @widget: the #StWidget
   *
   * Emitted when the user has requested a context menu (eg, via a
   * keybinding)
   */
  signals[POPUP_MENU] =
    g_signal_new ("popup-menu",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StWidgetClass, popup_menu),
                  NULL, NULL,
                  _st_marshal_VOID__VOID,
                  G_TYPE_NONE, 0);
}

/**
 * st_widget_set_theme:
 * @actor: a #StWidget
 * @theme: a new style class string
 *
 * Overrides the theme that would be inherited from the actor's parent
 * or the stage with an entirely new theme (set of stylesheets).
 */
void
st_widget_set_theme (StWidget  *actor,
                     StTheme   *theme)
{
  StWidgetPrivate *priv = actor->priv;

  g_return_if_fail (ST_IS_WIDGET (actor));

  priv = actor->priv;

  if (theme != priv->theme)
    {
      if (priv->theme)
        g_object_unref (priv->theme);
      priv->theme = g_object_ref (theme);

      st_widget_style_changed (actor);

      g_object_notify (G_OBJECT (actor), "theme");
    }
}

/**
 * st_widget_get_theme:
 * @actor: a #StWidget
 *
 * Gets the overriding theme set on the actor. See st_widget_set_theme()
 *
 * Return value: (transfer none): the overriding theme, or %NULL
 */
StTheme *
st_widget_get_theme (StWidget *actor)
{
  g_return_val_if_fail (ST_IS_WIDGET (actor), NULL);

  return actor->priv->theme;
}

static const gchar *
find_class_name (const gchar *class_list,
                 const gchar *class_name)
{
  gint len = strlen (class_name);
  const gchar *match;

  if (!class_list)
    return NULL;

  for (match = strstr (class_list, class_name); match; match = strstr (match + 1, class_name))
    {
      if ((match == class_list || g_ascii_isspace (match[-1])) &&
          (match[len] == '\0' || g_ascii_isspace (match[len])))
        return match;
    }

  return NULL;
}

static gboolean
set_class_list (gchar       **class_list,
                const gchar  *new_class_list)
{
  if (g_strcmp0 (*class_list, new_class_list) != 0)
    {
      g_free (*class_list);
      *class_list = g_strdup (new_class_list);
      return TRUE;
    }
  else
    return FALSE;
}

static gboolean
add_class_name (gchar       **class_list,
                const gchar  *class_name)
{
  gchar *new_class_list;

  if (*class_list)
    {
      if (find_class_name (*class_list, class_name))
        return FALSE;

      new_class_list = g_strdup_printf ("%s %s", *class_list, class_name);
      g_free (*class_list);
      *class_list = new_class_list;
    }
  else
    *class_list = g_strdup (class_name);

  return TRUE;
}

static gboolean
remove_class_name (gchar       **class_list,
                   const gchar  *class_name)
{
  const gchar *match, *end;
  gchar *new_class_list;

  if (!*class_list)
    return FALSE;

  if (strcmp (*class_list, class_name) == 0)
    {
      g_free (*class_list);
      *class_list = NULL;
      return TRUE;
    }

  match = find_class_name (*class_list, class_name);
  if (!match)
    return FALSE;
  end = match + strlen (class_name);

  /* Adjust either match or end to include a space as well.
   * (One or the other must be possible at this point.)
   */
  if (match != *class_list)
    match--;
  else
    end++;

  new_class_list = g_strdup_printf ("%.*s%s", (int)(match - *class_list),
                                    *class_list, end);
  g_free (*class_list);
  *class_list = new_class_list;

  return TRUE;
}

/**
 * st_widget_set_style_class_name:
 * @actor: a #StWidget
 * @style_class_list: (allow-none): a new style class list string
 *
 * Set the style class name list. @style_class_list can either be
 * %NULL, for no classes, or a space-separated list of style class
 * names. See also st_widget_add_style_class_name() and
 * st_widget_remove_style_class_name().
 */
void
st_widget_set_style_class_name (StWidget    *actor,
                                const gchar *style_class_list)
{
  g_return_if_fail (ST_IS_WIDGET (actor));

  if (set_class_list (&actor->priv->style_class, style_class_list))
    {
      st_widget_style_changed (actor);
      g_object_notify (G_OBJECT (actor), "style-class");
    }
}

/**
 * st_widget_add_style_class_name:
 * @actor: a #StWidget
 * @style_class: a style class name string
 *
 * Adds @style_class to @actor's style class name list, if it is not
 * already present.
 */
void
st_widget_add_style_class_name (StWidget    *actor,
                                const gchar *style_class)
{
  g_return_if_fail (ST_IS_WIDGET (actor));
  g_return_if_fail (style_class != NULL);

  if (add_class_name (&actor->priv->style_class, style_class))
    {
      st_widget_style_changed (actor);
      g_object_notify (G_OBJECT (actor), "style-class");
    }
}

/**
 * st_widget_remove_style_class_name:
 * @actor: a #StWidget
 * @style_class: a style class name string
 *
 * Removes @style_class from @actor's style class name, if it is
 * present.
 */
void
st_widget_remove_style_class_name (StWidget    *actor,
                                   const gchar *style_class)
{
  g_return_if_fail (ST_IS_WIDGET (actor));
  g_return_if_fail (style_class != NULL);

  if (remove_class_name (&actor->priv->style_class, style_class))
    {
      st_widget_style_changed (actor);
      g_object_notify (G_OBJECT (actor), "style-class");
    }
}

/**
 * st_widget_get_style_class_name:
 * @actor: a #StWidget
 *
 * Get the current style class name
 *
 * Returns: the class name string. The string is owned by the #StWidget and
 * should not be modified or freed.
 */
const gchar*
st_widget_get_style_class_name (StWidget *actor)
{
  g_return_val_if_fail (ST_IS_WIDGET (actor), NULL);

  return actor->priv->style_class;
}

/**
 * st_widget_has_style_class_name:
 * @actor: a #StWidget
 * @style_class: a style class string
 *
 * Tests if @actor's style class list includes @style_class.
 *
 * Returns: whether or not @actor's style class list includes
 * @style_class.
 */
gboolean
st_widget_has_style_class_name (StWidget    *actor,
                                const gchar *style_class)
{
  g_return_val_if_fail (ST_IS_WIDGET (actor), FALSE);

  return find_class_name (actor->priv->style_class, style_class) != NULL;
}

/**
 * st_widget_get_style_pseudo_class:
 * @actor: a #StWidget
 *
 * Get the current style pseudo class list.
 *
 * Note that an actor can have multiple pseudo classes; if you just
 * want to test for the presence of a specific pseudo class, use
 * st_widget_has_style_pseudo_class().
 *
 * Returns: the pseudo class list string. The string is owned by the
 * #StWidget and should not be modified or freed.
 */
const gchar*
st_widget_get_style_pseudo_class (StWidget *actor)
{
  g_return_val_if_fail (ST_IS_WIDGET (actor), NULL);

  return actor->priv->pseudo_class;
}

/**
 * st_widget_has_style_pseudo_class:
 * @actor: a #StWidget
 * @pseudo_class: a pseudo class string
 *
 * Tests if @actor's pseudo class list includes @pseudo_class.
 *
 * Returns: whether or not @actor's pseudo class list includes
 * @pseudo_class.
 */
gboolean
st_widget_has_style_pseudo_class (StWidget    *actor,
                                  const gchar *pseudo_class)
{
  g_return_val_if_fail (ST_IS_WIDGET (actor), FALSE);

  return find_class_name (actor->priv->pseudo_class, pseudo_class) != NULL;
}

/**
 * st_widget_set_style_pseudo_class:
 * @actor: a #StWidget
 * @pseudo_class_list: (allow-none): a new pseudo class list string
 *
 * Set the style pseudo class list. @pseudo_class_list can either be
 * %NULL, for no classes, or a space-separated list of pseudo class
 * names. See also st_widget_add_style_pseudo_class() and
 * st_widget_remove_style_pseudo_class().
 */
void
st_widget_set_style_pseudo_class (StWidget    *actor,
                                  const gchar *pseudo_class_list)
{
  g_return_if_fail (ST_IS_WIDGET (actor));

  if (set_class_list (&actor->priv->pseudo_class, pseudo_class_list))
    {
      st_widget_style_changed (actor);
      g_object_notify (G_OBJECT (actor), "pseudo-class");
    }
}

/**
 * st_widget_add_style_pseudo_class:
 * @actor: a #StWidget
 * @pseudo_class: a pseudo class string
 *
 * Adds @pseudo_class to @actor's pseudo class list, if it is not
 * already present.
 */
void
st_widget_add_style_pseudo_class (StWidget    *actor,
                                  const gchar *pseudo_class)
{
  g_return_if_fail (ST_IS_WIDGET (actor));
  g_return_if_fail (pseudo_class != NULL);

  if (add_class_name (&actor->priv->pseudo_class, pseudo_class))
    {
      st_widget_style_changed (actor);
      g_object_notify (G_OBJECT (actor), "pseudo-class");
    }
}

/**
 * st_widget_remove_style_pseudo_class:
 * @actor: a #StWidget
 * @pseudo_class: a pseudo class string
 *
 * Removes @pseudo_class from @actor's pseudo class, if it is present.
 */
void
st_widget_remove_style_pseudo_class (StWidget    *actor,
                                     const gchar *pseudo_class)
{
  g_return_if_fail (ST_IS_WIDGET (actor));
  g_return_if_fail (pseudo_class != NULL);

  if (remove_class_name (&actor->priv->pseudo_class, pseudo_class))
    {
      st_widget_style_changed (actor);
      g_object_notify (G_OBJECT (actor), "pseudo-class");
    }
}

/**
 * st_widget_set_style:
 * @actor: a #StWidget
 * @style: (allow-none): a inline style string, or %NULL
 *
 * Set the inline style string for this widget. The inline style string is an
 * optional ';'-separated list of CSS properties that override the style as
 * determined from the stylesheets of the current theme.
 */
void
st_widget_set_style (StWidget  *actor,
                     const gchar *style)
{
  StWidgetPrivate *priv = actor->priv;

  g_return_if_fail (ST_IS_WIDGET (actor));

  priv = actor->priv;

  if (g_strcmp0 (style, priv->inline_style))
    {
      g_free (priv->inline_style);
      priv->inline_style = g_strdup (style);

      st_widget_style_changed (actor);

      g_object_notify (G_OBJECT (actor), "style");
    }
}

/**
 * st_widget_get_style:
 * @actor: a #StWidget
 *
 * Get the current inline style string. See st_widget_set_style().
 *
 * Returns: The inline style string, or %NULL. The string is owned by the
 * #StWidget and should not be modified or freed.
 */
const gchar*
st_widget_get_style (StWidget *actor)
{
  g_return_val_if_fail (ST_IS_WIDGET (actor), NULL);

  return actor->priv->inline_style;
}

static void
st_widget_name_notify (StWidget   *widget,
                       GParamSpec *pspec,
                       gpointer    data)
{
  st_widget_style_changed (widget);
}

static void
st_widget_init (StWidget *actor)
{
  StWidgetPrivate *priv;

  actor->priv = priv = ST_WIDGET_GET_PRIVATE (actor);
  priv->is_stylable = TRUE;
  priv->transition_animation = NULL;

  /* connect style changed */
  g_signal_connect (actor, "notify::name", G_CALLBACK (st_widget_name_notify), NULL);
}

static void
on_transition_completed (StThemeNodeTransition *transition,
                         StWidget              *widget)
{
  st_widget_remove_transition (widget);
}

static void
st_widget_recompute_style (StWidget    *widget,
                           StThemeNode *old_theme_node)
{
  StThemeNode *new_theme_node = st_widget_get_theme_node (widget);
  int transition_duration;
  gboolean paint_equal;

  if (new_theme_node == old_theme_node)
    {
      widget->priv->is_style_dirty = FALSE;
      return;
    }

  if (!old_theme_node ||
      !st_theme_node_geometry_equal (old_theme_node, new_theme_node))
    clutter_actor_queue_relayout ((ClutterActor *) widget);

  transition_duration = st_theme_node_get_transition_duration (new_theme_node);

  paint_equal = old_theme_node && st_theme_node_paint_equal (old_theme_node, new_theme_node);

  if (paint_equal)
    st_theme_node_copy_cached_paint_state (new_theme_node, old_theme_node);

  if (transition_duration > 0)
    {
      if (widget->priv->transition_animation != NULL)
        {
          st_theme_node_transition_update (widget->priv->transition_animation,
                                           new_theme_node);
        }
      else if (old_theme_node && !paint_equal)
        {
          /* Since our transitions are only of the painting done by StThemeNode, we
           * only want to start a transition when what is painted changes; if
           * other visual aspects like the foreground color of a label change,
           * we can't animate that anyways.
           */

          widget->priv->transition_animation =
            st_theme_node_transition_new (old_theme_node,
                                          new_theme_node,
                                          transition_duration);

          g_signal_connect (widget->priv->transition_animation, "completed",
                            G_CALLBACK (on_transition_completed), widget);
          g_signal_connect_swapped (widget->priv->transition_animation,
                                    "new-frame",
                                    G_CALLBACK (clutter_actor_queue_redraw),
                                    widget);
        }
    }
  else if (widget->priv->transition_animation)
    {
      st_widget_remove_transition (widget);
    }

  g_signal_emit (widget, signals[STYLE_CHANGED], 0);
  widget->priv->is_style_dirty = FALSE;
}

/**
 * st_widget_ensure_style:
 * @widget: A #StWidget
 *
 * Ensures that @widget has read its style information.
 *
 */
void
st_widget_ensure_style (StWidget *widget)
{
  g_return_if_fail (ST_IS_WIDGET (widget));

  if (widget->priv->is_style_dirty)
    st_widget_recompute_style (widget, NULL);
}

static StTextDirection default_direction = ST_TEXT_DIRECTION_LTR;

StTextDirection
st_widget_get_default_direction (void)
{
  return default_direction;
}

void
st_widget_set_default_direction (StTextDirection dir)
{
  g_return_if_fail (dir != ST_TEXT_DIRECTION_NONE);

  default_direction = dir;
}

StTextDirection
st_widget_get_direction (StWidget *self)
{
  g_return_val_if_fail (ST_IS_WIDGET (self), ST_TEXT_DIRECTION_LTR);

  if (self->priv->direction != ST_TEXT_DIRECTION_NONE)
    return self->priv->direction;
  else
    return default_direction;
}

void
st_widget_set_direction (StWidget *self, StTextDirection dir)
{
  StTextDirection old_direction;

  g_return_if_fail (ST_IS_WIDGET (self));

  old_direction = st_widget_get_direction (self);
  self->priv->direction = dir;

  if (old_direction != st_widget_get_direction (self))
    st_widget_style_changed (self);
}

static void
st_widget_ensure_tooltip_parented (StWidget *widget, ClutterStage *stage)
{
  StWidgetPrivate *priv;
  ClutterContainer *ui_root;
  ClutterActor *tooltip, *parent;

  priv = widget->priv;

  ui_root = st_get_ui_root (stage);

  tooltip = CLUTTER_ACTOR (priv->tooltip);
  parent = clutter_actor_get_parent (tooltip);

  if (G_UNLIKELY (parent != CLUTTER_ACTOR (ui_root)))
    {
      if (parent)
        clutter_container_remove_actor (CLUTTER_CONTAINER (parent), tooltip);

      clutter_container_add_actor (ui_root, tooltip);
    }
}

/**
 * st_widget_set_has_tooltip:
 * @widget: A #StWidget
 * @has_tooltip: %TRUE if the widget should display a tooltip
 *
 * Enables tooltip support on the #StWidget.
 *
 * Note that setting has-tooltip to %TRUE will cause
 * #ClutterActor:reactive and #StWidget:track-hover to be set %TRUE as
 * well, but you must clear these flags yourself (if appropriate) when
 * setting it %FALSE.
 */
void
st_widget_set_has_tooltip (StWidget *widget,
                           gboolean  has_tooltip)
{
  StWidgetPrivate *priv;
  ClutterActor *stage;

  g_return_if_fail (ST_IS_WIDGET (widget));

  priv = widget->priv;

  priv->has_tooltip = has_tooltip;

  if (has_tooltip)
    {
      clutter_actor_set_reactive ((ClutterActor*) widget, TRUE);
      st_widget_set_track_hover (widget, TRUE);

      if (!priv->tooltip)
        {
          priv->tooltip = g_object_new (ST_TYPE_TOOLTIP, NULL);
          g_object_ref_sink (priv->tooltip);

          stage = clutter_actor_get_stage (CLUTTER_ACTOR (widget));
          if (stage != NULL)
            st_widget_ensure_tooltip_parented (widget, CLUTTER_STAGE (stage));
        }
    }
  else
    {
      if (priv->tooltip_timeout_id)
        {
          g_source_remove (priv->tooltip_timeout_id);
          priv->tooltip_timeout_id = 0;
        }

      if (priv->tooltip)
        {
          clutter_actor_destroy (CLUTTER_ACTOR (priv->tooltip));
          g_object_unref (priv->tooltip);
          priv->tooltip = NULL;
        }
    }
}

/**
 * st_widget_get_has_tooltip:
 * @widget: A #StWidget
 *
 * Returns the current value of the has-tooltip property. See
 * st_tooltip_set_has_tooltip() for more information.
 *
 * Returns: current value of has-tooltip on @widget
 */
gboolean
st_widget_get_has_tooltip (StWidget *widget)
{
  g_return_val_if_fail (ST_IS_WIDGET (widget), FALSE);

  return widget->priv->has_tooltip;
}

/**
 * st_widget_set_tooltip_text:
 * @widget: A #StWidget
 * @text: text to set as the tooltip
 *
 * Set the tooltip text of the widget. This will set StWidget::has-tooltip to
 * %TRUE. A value of %NULL will unset the tooltip and set has-tooltip to %FALSE.
 *
 */
void
st_widget_set_tooltip_text (StWidget    *widget,
                            const gchar *text)
{
  StWidgetPrivate *priv;

  g_return_if_fail (ST_IS_WIDGET (widget));

  priv = widget->priv;

  if (text == NULL)
    st_widget_set_has_tooltip (widget, FALSE);
  else
    {
      st_widget_set_has_tooltip (widget, TRUE);
      st_tooltip_set_label (priv->tooltip, text);
    }
}

/**
 * st_widget_get_tooltip_text:
 * @widget: A #StWidget
 *
 * Get the current tooltip string
 *
 * Returns: The current tooltip string, owned by the #StWidget
 */
const gchar*
st_widget_get_tooltip_text (StWidget *widget)
{
  StWidgetPrivate *priv;

  g_return_val_if_fail (ST_IS_WIDGET (widget), NULL);
  priv = widget->priv;

  if (!priv->has_tooltip)
    return NULL;

  return st_tooltip_get_label (widget->priv->tooltip);
}

/**
 * st_widget_show_tooltip:
 * @widget: A #StWidget
 *
 * Force the tooltip for @widget to be shown
 *
 */
void
st_widget_show_tooltip (StWidget *widget)
{
  g_return_if_fail (ST_IS_WIDGET (widget));

  widget->priv->show_tooltip = TRUE;
  if (CLUTTER_ACTOR_IS_MAPPED (widget))
    st_widget_do_show_tooltip (widget);
}

static void
st_widget_do_show_tooltip (StWidget *widget)
{
  ClutterActor *stage, *tooltip;

  stage = clutter_actor_get_stage (CLUTTER_ACTOR (widget));
  g_return_if_fail (stage != NULL);

  if (widget->priv->tooltip)
    {
      tooltip = CLUTTER_ACTOR (widget->priv->tooltip);
      st_widget_ensure_tooltip_parented (widget, CLUTTER_STAGE (stage));
      clutter_actor_raise (tooltip, NULL);
      clutter_actor_show_all (tooltip);
    }
}

/**
 * st_widget_hide_tooltip:
 * @widget: A #StWidget
 *
 * Hide the tooltip for @widget
 *
 */
void
st_widget_hide_tooltip (StWidget *widget)
{
  g_return_if_fail (ST_IS_WIDGET (widget));

  widget->priv->show_tooltip = FALSE;
  if (CLUTTER_ACTOR_IS_MAPPED (widget))
    st_widget_do_hide_tooltip (widget);
}

static void
st_widget_do_hide_tooltip (StWidget *widget)
{
  if (widget->priv->tooltip)
    clutter_actor_hide (CLUTTER_ACTOR (widget->priv->tooltip));
}

/**
 * st_widget_set_track_hover:
 * @widget: A #StWidget
 * @track_hover: %TRUE if the widget should track the pointer hover state
 *
 * Enables hover tracking on the #StWidget.
 *
 * If hover tracking is enabled, and the widget is visible and
 * reactive, then @widget's #StWidget:hover property will be updated
 * automatically to reflect whether the pointer is in @widget (or one
 * of its children), and @widget's #StWidget:pseudo-class will have
 * the "hover" class added and removed from it accordingly.
 *
 * Note that currently it is not possible to correctly track the hover
 * state when another actor has a pointer grab. You can use
 * st_widget_sync_hover() to update the property manually in this
 * case.
 */
void
st_widget_set_track_hover (StWidget *widget,
                           gboolean  track_hover)
{
  StWidgetPrivate *priv;

  g_return_if_fail (ST_IS_WIDGET (widget));

  priv = widget->priv;

  if (priv->track_hover != track_hover)
    {
      priv->track_hover = track_hover;
      g_object_notify (G_OBJECT (widget), "track-hover");

      if (priv->track_hover)
        st_widget_sync_hover (widget);
    }
}

/**
 * st_widget_get_track_hover:
 * @widget: A #StWidget
 *
 * Returns the current value of the track-hover property. See
 * st_tooltip_set_track_hover() for more information.
 *
 * Returns: current value of track-hover on @widget
 */
gboolean
st_widget_get_track_hover (StWidget *widget)
{
  g_return_val_if_fail (ST_IS_WIDGET (widget), FALSE);

  return widget->priv->track_hover;
}

static gboolean
tooltip_timeout (gpointer data)
{
  st_widget_show_tooltip (data);

  return FALSE;
}

static void
st_widget_start_tooltip_timeout (StWidget *widget)
{
  StWidgetPrivate *priv = widget->priv;
  GtkSettings *settings = gtk_settings_get_default ();
  guint timeout;

  if (priv->tooltip_timeout_id) {
    g_source_remove (priv->tooltip_timeout_id);
    priv->tooltip_timeout_id = 0;
  }

  g_object_get (settings, "gtk-tooltip-timeout", &timeout, NULL);
  priv->tooltip_timeout_id = g_timeout_add (timeout, tooltip_timeout, widget);
}

/**
 * st_widget_set_hover:
 * @widget: A #StWidget
 * @hover: whether the pointer is hovering over the widget
 *
 * Sets @widget's hover property and adds or removes "hover" from its
 * pseudo class accordingly. If #StWidget:has-tooltip is %TRUE, this
 * will also show or hide the tooltip, as appropriate.
 *
 * If you have set #StWidget:track-hover, you should not need to call
 * this directly. You can call st_widget_sync_hover() if the hover
 * state might be out of sync due to another actor's pointer grab.
 */
void
st_widget_set_hover (StWidget *widget,
                     gboolean  hover)
{
  StWidgetPrivate *priv;

  g_return_if_fail (ST_IS_WIDGET (widget));

  priv = widget->priv;

  if (priv->hover != hover)
    {
      priv->hover = hover;
      if (priv->hover)
        {
          st_widget_add_style_pseudo_class (widget, "hover");
          if (priv->has_tooltip)
            st_widget_start_tooltip_timeout (widget);
        }
      else
        {
          st_widget_remove_style_pseudo_class (widget, "hover");
          if (priv->has_tooltip)
            {
              if (priv->tooltip_timeout_id)
                {
                  g_source_remove (priv->tooltip_timeout_id);
                  priv->tooltip_timeout_id = 0;
                }

              st_widget_hide_tooltip (widget);
            }
        }
      g_object_notify (G_OBJECT (widget), "hover");
    }
}

/**
 * st_widget_sync_hover:
 * @widget: A #StWidget
 *
 * Sets @widget's hover state according to the current pointer
 * position. This can be used to ensure that it is correct after
 * (or during) a pointer grab.
 */
void
st_widget_sync_hover (StWidget *widget)
{
  ClutterDeviceManager *device_manager;
  ClutterInputDevice *pointer;
  ClutterActor *pointer_actor;
  
  if (widget->priv->track_hover) {
    device_manager = clutter_device_manager_get_default ();
    pointer = clutter_device_manager_get_core_device (device_manager,
                                                      CLUTTER_POINTER_DEVICE);
    pointer_actor = clutter_input_device_get_pointer_actor (pointer);
    if (pointer_actor)
      st_widget_set_hover (widget, clutter_actor_contains (CLUTTER_ACTOR (widget), pointer_actor));
    else
      st_widget_set_hover (widget, FALSE);
  }
}

/**
 * st_widget_get_hover:
 * @widget: A #StWidget
 *
 * If #StWidget:track-hover is set, this returns whether the pointer
 * is currently over the widget.
 *
 * Returns: current value of hover on @widget
 */
gboolean
st_widget_get_hover (StWidget *widget)
{
  g_return_val_if_fail (ST_IS_WIDGET (widget), FALSE);

  return widget->priv->hover;
}

/**
 * st_widget_set_can_focus:
 * @widget: A #StWidget
 * @can_focus: %TRUE if the widget can receive keyboard focus
 *   via keyboard navigation
 *
 * Marks @widget as being able to receive keyboard focus via
 * keyboard navigation.
 */
void
st_widget_set_can_focus (StWidget *widget,
                         gboolean  can_focus)
{
  StWidgetPrivate *priv;

  g_return_if_fail (ST_IS_WIDGET (widget));

  priv = widget->priv;

  if (priv->can_focus != can_focus)
    {
      priv->can_focus = can_focus;
      g_object_notify (G_OBJECT (widget), "can-focus");
    }
}

/**
 * st_widget_get_can_focus:
 * @widget: A #StWidget
 *
 * Returns the current value of the can-focus property. See
 * st_widget_set_can_focus() for more information.
 *
 * Returns: current value of can-focus on @widget
 */
gboolean
st_widget_get_can_focus (StWidget *widget)
{
  g_return_val_if_fail (ST_IS_WIDGET (widget), FALSE);

  return widget->priv->can_focus;
}

static gboolean
st_widget_real_navigate_focus (StWidget         *widget,
                               ClutterActor     *from,
                               GtkDirectionType  direction)
{
  if (widget->priv->can_focus &&
      CLUTTER_ACTOR (widget) != from)
    {
      clutter_actor_grab_key_focus (CLUTTER_ACTOR (widget));
      return TRUE;
    }
  return FALSE;
}

/**
 * st_widget_navigate_focus:
 * @widget: the "top level" container
 * @from: (allow-none): the actor that the focus is coming from
 * @direction: the direction focus is moving in
 * @wrap_around: whether focus should wrap around
 *
 * Tries to update the keyboard focus within @widget in response to a
 * keyboard event.
 *
 * If @from is a descendant of @widget, this attempts to move the
 * keyboard focus to the next descendant of @widget (in the order
 * implied by @direction) that has the #StWidget:can-focus property
 * set. If @from is %NULL, or outside of @widget, this attempts to
 * focus either @widget itself, or its first descendant in the order
 * implied by @direction.
 *
 * If a container type is marked #StWidget:can-focus, the expected
 * behavior is that it will only take up a single slot on the focus
 * chain as a whole, rather than allowing navigation between its child
 * actors (or having a distinction between itself being focused and
 * one of its children being focused).
 *
 * Some widget classes might have slightly different behavior from the
 * above, where that would make more sense.
 *
 * If @wrap_around is %TRUE and @from is a child of @widget, but the
 * widget has no further children that can accept the focus in the
 * given direction, then st_widget_navigate_focus() will try a second
 * time, using a %NULL @from, which should cause it to reset the focus
 * to the first available widget in the given direction.
 *
 * Return value: %TRUE if clutter_actor_grab_key_focus() has been
 * called on an actor. %FALSE if not.
 */
gboolean
st_widget_navigate_focus (StWidget         *widget,
                          ClutterActor     *from,
                          GtkDirectionType  direction,
                          gboolean          wrap_around)
{
  g_return_val_if_fail (ST_IS_WIDGET (widget), FALSE);

  if (ST_WIDGET_GET_CLASS (widget)->navigate_focus (widget, from, direction))
    return TRUE;
  if (wrap_around && from && clutter_actor_contains (CLUTTER_ACTOR (widget), from))
    return ST_WIDGET_GET_CLASS (widget)->navigate_focus (widget, NULL, direction);
  return FALSE;
}

static gboolean
append_actor_text (GString      *desc,
                   ClutterActor *actor)
{
  if (CLUTTER_IS_TEXT (actor))
    {
      g_string_append_printf (desc, " (\"%s\")",
                              clutter_text_get_text (CLUTTER_TEXT (actor)));
      return TRUE;
    }
  else if (ST_IS_LABEL (actor))
    {
      g_string_append_printf (desc, " (\"%s\")",
                              st_label_get_text (ST_LABEL (actor)));
      return TRUE;
    }
  else
    return FALSE;
}

/**
 * st_describe_actor:
 * @actor: a #ClutterActor
 *
 * Creates a string describing @actor, for use in debugging. This
 * includes the class name and actor name (if any), plus if @actor
 * is an #StWidget, its style class and pseudo class names.
 *
 * Return value: the debug name.
 */
char *
st_describe_actor (ClutterActor *actor)
{
  GString *desc;
  const char *name;
  int i;

  if (!actor)
    return g_strdup ("[null]");

  desc = g_string_new (NULL);
  g_string_append_printf (desc, "[%p %s", actor,
                          G_OBJECT_TYPE_NAME (actor));

  if (ST_IS_WIDGET (actor))
    {
      const char *style_class = st_widget_get_style_class_name (ST_WIDGET (actor));
      const char *pseudo_class = st_widget_get_style_pseudo_class (ST_WIDGET (actor));
      char **classes;

      if (style_class)
        {
          classes = g_strsplit (style_class, ",", -1);
          for (i = 0; classes[i]; i++)
            {
              g_strchug (classes[i]);
              g_string_append_printf (desc, ".%s", classes[i]);
            }
          g_strfreev (classes);
        }

      if (pseudo_class)
        {
          classes = g_strsplit (pseudo_class, ",", -1);
          for (i = 0; classes[i]; i++)
            {
              g_strchug (classes[i]);
              g_string_append_printf (desc, ":%s", classes[i]);
            }
          g_strfreev (classes);
        }
    }

  name = clutter_actor_get_name (actor);
  if (name)
    g_string_append_printf (desc, " \"%s\"", name);

  if (!append_actor_text (desc, actor))
    {
      GList *children, *l;

      /* Do a limited search of @actor's children looking for a label */
      children = clutter_actor_get_children (actor);
      for (l = children, i = 0; l && i < 20; l = l->next, i++)
        {
          if (append_actor_text (desc, l->data))
            break;
          children = g_list_concat (children, clutter_actor_get_children (l->data));
        }
      g_list_free (children);
    }

  g_string_append_c (desc, ']');

  return g_string_free (desc, FALSE);
}

/**
 * st_set_slow_down_factor:
 * @factor: new slow-down factor
 *
 * Set a global factor applied to all animation durations
 */
void
st_set_slow_down_factor (gfloat factor)
{
  st_slow_down_factor = factor;
}

/**
 * st_get_slow_down_factor:
 *
 * Returns: the global factor applied to all animation durations
 */
gfloat
st_get_slow_down_factor ()
{
  return st_slow_down_factor;
}


/**
 * st_widget_get_label_actor:
 * @widget: a #StWidget
 *
 * Gets the label that identifies @widget if it is defined
 *
 * Return value: (transfer none): the label that identifies the widget
 */
ClutterActor *
st_widget_get_label_actor (StWidget *widget)
{
  g_return_val_if_fail (ST_IS_WIDGET (widget), NULL);

  return widget->priv->label_actor;
}

/**
 * st_widget_set_label_actor:
 * @widget: a #StWidget
 * @label: a #ClutterActor
 *
 * Sets @label as the #ClutterActor that identifies (labels)
 * @widget. @label can be %NULL to indicate that @widget is not
 * labelled any more
 */

void
st_widget_set_label_actor (StWidget     *widget,
                           ClutterActor *label)
{
  g_return_if_fail (ST_IS_WIDGET (widget));

  if (widget->priv->label_actor != label)
    {
      if (widget->priv->label_actor)
        g_object_unref (widget->priv->label_actor);

      if (label != NULL)
        widget->priv->label_actor = g_object_ref (label);
      else
        widget->priv->label_actor = NULL;

      g_object_notify (G_OBJECT (widget), "label-actor");
    }
}

/******************************************************************************/
/*************************** ACCESSIBILITY SUPPORT ****************************/
/******************************************************************************/

/* GObject */

static void st_widget_accessible_class_init (StWidgetAccessibleClass *klass);
static void st_widget_accessible_init       (StWidgetAccessible *widget);
static void st_widget_accessible_dispose    (GObject *gobject);

/* AtkObject */
static AtkStateSet *st_widget_accessible_ref_state_set (AtkObject *obj);
static void         st_widget_accessible_initialize    (AtkObject *obj,
                                                        gpointer   data);

/* Private methods */
static void on_pseudo_class_notify (GObject    *gobject,
                                    GParamSpec *pspec,
                                    gpointer    data);
static void on_can_focus_notify    (GObject    *gobject,
                                    GParamSpec *pspec,
                                    gpointer    data);
static void on_label_notify        (GObject    *gobject,
                                    GParamSpec *pspec,
                                    gpointer    data);
static void check_selected         (StWidgetAccessible *self,
                                    StWidget *widget);
static void check_labels           (StWidgetAccessible *self,
                                    StWidget *widget);

G_DEFINE_TYPE (StWidgetAccessible, st_widget_accessible, CALLY_TYPE_ACTOR)

#define ST_WIDGET_ACCESSIBLE_GET_PRIVATE(obj) \
  (G_TYPE_INSTANCE_GET_PRIVATE ((obj), ST_TYPE_WIDGET_ACCESSIBLE, \
                                StWidgetAccessiblePrivate))

struct _StWidgetAccessiblePrivate
{
  /* Cached values (used to avoid extra notifications) */
  gboolean selected;

  /* The current_label. Right now there are the proper atk
   * relationships between this object and the label
   */
  AtkObject *current_label;
};


static AtkObject *
st_widget_get_accessible (ClutterActor *actor)
{
  StWidget *widget = NULL;

  g_return_val_if_fail (ST_IS_WIDGET (actor), NULL);

  widget = ST_WIDGET (actor);

  if (widget->priv->accessible == NULL)
    {
      widget->priv->accessible =
        g_object_new (ST_WIDGET_GET_CLASS (widget)->get_accessible_type (),
                      NULL);

      atk_object_initialize (widget->priv->accessible, actor);
    }

  return widget->priv->accessible;
}


static void
st_widget_accessible_class_init (StWidgetAccessibleClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  AtkObjectClass *atk_class = ATK_OBJECT_CLASS (klass);

  gobject_class->dispose = st_widget_accessible_dispose;

  atk_class->ref_state_set = st_widget_accessible_ref_state_set;
  atk_class->initialize = st_widget_accessible_initialize;

  g_type_class_add_private (gobject_class, sizeof (StWidgetAccessiblePrivate));
}

static void
st_widget_accessible_init (StWidgetAccessible *self)
{
  StWidgetAccessiblePrivate *priv = ST_WIDGET_ACCESSIBLE_GET_PRIVATE (self);

  self->priv = priv;
}

static void
st_widget_accessible_dispose (GObject *gobject)
{
  StWidgetAccessible *self = ST_WIDGET_ACCESSIBLE (gobject);

  if (self->priv->current_label)
    {
      g_object_unref (self->priv->current_label);
      self->priv->current_label = NULL;
    }

  G_OBJECT_CLASS (st_widget_accessible_parent_class)->dispose (gobject);
}


static void
st_widget_accessible_initialize (AtkObject *obj,
                                 gpointer   data)
{
  ATK_OBJECT_CLASS (st_widget_accessible_parent_class)->initialize (obj, data);

  g_signal_connect (data, "notify::pseudo-class",
                    G_CALLBACK (on_pseudo_class_notify),
                    obj);

  g_signal_connect (data, "notify::can-focus",
                    G_CALLBACK (on_can_focus_notify),
                    obj);

  g_signal_connect (data, "notify::label-actor",
                    G_CALLBACK (on_label_notify),
                    obj);

  /* Check the cached selected state and notify the first selection.
   * Ie: it is required to ensure a first notification when Alt+Tab
   * popup appears
   */
  check_selected (ST_WIDGET_ACCESSIBLE (obj), ST_WIDGET (data));
  check_labels (ST_WIDGET_ACCESSIBLE (obj), ST_WIDGET (data));
}

static AtkStateSet *
st_widget_accessible_ref_state_set (AtkObject *obj)
{
  AtkStateSet *result = NULL;
  ClutterActor *actor = NULL;
  StWidget *widget = NULL;
  StWidgetAccessible *self = NULL;

  result = ATK_OBJECT_CLASS (st_widget_accessible_parent_class)->ref_state_set (obj);

  actor = CLUTTER_ACTOR (atk_gobject_accessible_get_object (ATK_GOBJECT_ACCESSIBLE (obj)));

  if (actor == NULL) /* State is defunct */
    return result;

  widget = ST_WIDGET (actor);
  self = ST_WIDGET_ACCESSIBLE (obj);

  /* priv->selected should be properly updated on the
   * ATK_STATE_SELECTED notification callbacks
   */
  if (self->priv->selected)
    atk_state_set_add_state (result, ATK_STATE_SELECTED);

  /* On clutter there isn't any tip to know if a actor is focusable or
   * not, anyone can receive the key_focus. For this reason
   * cally_actor sets any actor as FOCUSABLE. This is not the case on
   * St, where we have can_focus. But this means that we need to
   * remove the state FOCUSABLE if it is not focusable
   */
  if (st_widget_get_can_focus (widget))
    atk_state_set_add_state (result, ATK_STATE_FOCUSABLE);
  else
    atk_state_set_remove_state (result, ATK_STATE_FOCUSABLE);

  return result;
}

static void
on_pseudo_class_notify (GObject    *gobject,
                        GParamSpec *pspec,
                        gpointer    data)
{
  check_selected (ST_WIDGET_ACCESSIBLE (data),
                  ST_WIDGET (gobject));
}

/*
 * This method checks if the widget is selected, and notify a atk
 * state change if required
 *
 * In order to decide if there was a selection, we use the current
 * pseudo-class of the widget searching for "selected", the current
 * homogeneus way to check if a item is selected (see bug 637830)
 *
 * In a ideal world we would have a more standard way to check if the
 * item is selected or not, like the widget-context (as in the case of
 * gtktreeview-cells), or something like the property "can-focus". But
 * for the moment this is enough, and we can update that in the future
 * if required.
 */
static void
check_selected (StWidgetAccessible *self,
                StWidget *widget)
{
  gboolean found = FALSE;

  found = st_widget_has_style_pseudo_class (widget,
                                            "selected");

  if (found != self->priv->selected)
    {
      self->priv->selected = found;
      atk_object_notify_state_change (ATK_OBJECT (self),
                                      ATK_STATE_SELECTED,
                                      found);
    }
}

static void
on_can_focus_notify (GObject    *gobject,
                     GParamSpec *pspec,
                     gpointer    data)
{
  gboolean can_focus = st_widget_get_can_focus (ST_WIDGET (gobject));

  atk_object_notify_state_change (ATK_OBJECT (data),
                                  ATK_STATE_FOCUSABLE, can_focus);
}

static GQuark
st_ui_root_quark (void)
{
  static GQuark value = 0;
  if (G_UNLIKELY (value == 0))
    value = g_quark_from_static_string ("st-ui-root");
  return value;
}

static void
st_ui_root_destroyed (ClutterActor *actor,
                      ClutterStage *stage)
{
  st_set_ui_root (stage, NULL);
  g_signal_handlers_disconnect_by_func (actor, st_ui_root_destroyed, stage);
}

/**
 * st_set_ui_root:
 * @stage: a #ClutterStage
 * @container: (allow-none): the new UI root
 *
 * Sets a #ClutterContainer to be the parent of all UI in the program.
 * This container is used when St needs to add new content outside the
 * widget hierarchy, for example, when it shows a tooltip over a widget.
 */
void
st_set_ui_root (ClutterStage     *stage,
                ClutterContainer *container)
{
  ClutterContainer *previous;

  g_return_if_fail (CLUTTER_IS_STAGE (stage));
  g_return_if_fail (CLUTTER_IS_CONTAINER (container));

  previous = st_get_ui_root (stage);
  if (previous)
    g_signal_handlers_disconnect_by_func (container, st_ui_root_destroyed, stage);

  if (container)
    {
      g_signal_connect (container, "destroy", G_CALLBACK (st_ui_root_destroyed), stage);
      g_object_set_qdata_full (G_OBJECT (stage), st_ui_root_quark (), g_object_ref (container), g_object_unref);
    }
}

/**
 * st_get_ui_root:
 * @stage: a #ClutterStage
 *
 * Returns: (transfer none): the container which should be the parent of all user interface,
 *   which can be set with st_set_ui_root(). If not set, returns @stage
 */
ClutterContainer *
st_get_ui_root (ClutterStage *stage)
{
  ClutterContainer *root;

  g_return_val_if_fail (CLUTTER_IS_STAGE (stage), NULL);

  root = g_object_get_qdata (G_OBJECT (stage), st_ui_root_quark ());

  if (root != NULL)
    return root;
  else
    return CLUTTER_CONTAINER (stage);
}

static void
on_label_notify (GObject    *gobject,
                 GParamSpec *pspec,
                 gpointer    data)
{
  check_labels (ST_WIDGET_ACCESSIBLE (data), ST_WIDGET (gobject));
}

static void
check_labels (StWidgetAccessible *widget_accessible,
              StWidget           *widget)
{
  ClutterActor *label = NULL;
  AtkObject *label_accessible = NULL;

  /* We only call this method at startup, and when the label changes,
   * so it is fine to remove the previous relationships if we have the
   * current_label by default
   */
  if (widget_accessible->priv->current_label != NULL)
    {
      AtkObject *previous_label = widget_accessible->priv->current_label;

      atk_object_remove_relationship (ATK_OBJECT (widget_accessible),
                                      ATK_RELATION_LABELLED_BY,
                                      previous_label);

      atk_object_remove_relationship (previous_label,
                                      ATK_RELATION_LABEL_FOR,
                                      ATK_OBJECT (widget_accessible));

      g_object_unref (previous_label);
    }

  label = st_widget_get_label_actor (widget);
  if (label == NULL)
    {
      widget_accessible->priv->current_label = NULL;
    }
  else
    {
      label_accessible = clutter_actor_get_accessible (label);
      widget_accessible->priv->current_label = g_object_ref (label_accessible);

      atk_object_add_relationship (ATK_OBJECT (widget_accessible),
                                   ATK_RELATION_LABELLED_BY,
                                   label_accessible);

      atk_object_add_relationship (label_accessible,
                                   ATK_RELATION_LABEL_FOR,
                                   ATK_OBJECT (widget_accessible));
    }
}
