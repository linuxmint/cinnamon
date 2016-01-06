/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-theme-node-transition.c: Theme node transitions for StWidget.
 *
 * Copyright 2010 Florian Müllner
 * Copyright 2010 Adel Gadllah
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

#include "st-theme-node-transition.h"
#include "st-cogl-wrapper.h"

enum {
  COMPLETED,
  NEW_FRAME,
  LAST_SIGNAL
};

#define ST_THEME_NODE_TRANSITION_GET_PRIVATE(obj) (G_TYPE_INSTANCE_GET_PRIVATE ((obj), ST_TYPE_THEME_NODE_TRANSITION, StThemeNodeTransitionPrivate))

struct _StThemeNodeTransitionPrivate {
  StThemeNode *old_theme_node;
  StThemeNode *new_theme_node;

  CoglHandle old_texture;
  CoglHandle new_texture;

  CoglHandle old_offscreen;
  CoglHandle new_offscreen;

  CoglHandle material;

  ClutterAlpha    *alpha;
  ClutterTimeline *timeline;

  guint timeline_completed_id;
  guint timeline_new_frame_id;

  ClutterActorBox last_allocation;
  ClutterActorBox offscreen_box;

  gboolean needs_setup;
};

static guint signals[LAST_SIGNAL] = { 0 };

G_DEFINE_TYPE (StThemeNodeTransition, st_theme_node_transition, G_TYPE_OBJECT);


static void
on_timeline_completed (ClutterTimeline       *timeline,
                       StThemeNodeTransition *transition)
{
  g_signal_emit (transition, signals[COMPLETED], 0);
}

static void
on_timeline_new_frame (ClutterTimeline       *timeline,
                       gint                   frame_num,
                       StThemeNodeTransition *transition)
{
  g_signal_emit (transition, signals[NEW_FRAME], 0);
}

StThemeNodeTransition *
st_theme_node_transition_new (StThemeNode *from_node,
                              StThemeNode *to_node,
                              guint        duration)
{
  StThemeNodeTransition *transition;

  g_return_val_if_fail (ST_IS_THEME_NODE (from_node), NULL);
  g_return_val_if_fail (ST_IS_THEME_NODE (to_node), NULL);

  duration = st_theme_node_get_transition_duration (to_node);

  transition = g_object_new (ST_TYPE_THEME_NODE_TRANSITION,
                             NULL);

  transition->priv->old_theme_node = g_object_ref (from_node);
  transition->priv->new_theme_node = g_object_ref (to_node);

  transition->priv->alpha = clutter_alpha_new ();
  transition->priv->timeline = clutter_timeline_new (duration);

  transition->priv->timeline_completed_id =
    g_signal_connect (transition->priv->timeline, "completed",
                      G_CALLBACK (on_timeline_completed), transition);
  transition->priv->timeline_new_frame_id =
    g_signal_connect (transition->priv->timeline, "new-frame",
                      G_CALLBACK (on_timeline_new_frame), transition);

  clutter_alpha_set_mode (transition->priv->alpha, CLUTTER_EASE_IN_OUT_QUAD);
  clutter_alpha_set_timeline (transition->priv->alpha,
                              transition->priv->timeline);

  clutter_timeline_start (transition->priv->timeline);

  return transition;
}

void
st_theme_node_transition_update (StThemeNodeTransition *transition,
                                 StThemeNode           *new_node)
{
  StThemeNodeTransitionPrivate *priv = transition->priv;
  StThemeNode *old_node;
  ClutterTimelineDirection direction;

  g_return_if_fail (ST_IS_THEME_NODE_TRANSITION (transition));
  g_return_if_fail (ST_IS_THEME_NODE (new_node));

  direction = clutter_timeline_get_direction (priv->timeline);
  old_node = (direction == CLUTTER_TIMELINE_FORWARD) ? priv->old_theme_node
                                                     : priv->new_theme_node;

  /* If the update is the reversal of the current transition,
   * we reverse the timeline.
   * Otherwise, we should initiate a new transition from the
   * current state to the new one; this is hard to do if the
   * transition is in an intermediate state, so we just cancel
   * the ongoing transition in that case.
   * Note that reversing a timeline before any time elapsed
   * results in the timeline's time position being set to the
   * full duration - this is not what we want, so we cancel the
   * transition as well in that case.
   */
  if (st_theme_node_equal (new_node, old_node))
    {
      if (clutter_timeline_get_elapsed_time (priv->timeline) > 0)
        {
          if (direction == CLUTTER_TIMELINE_FORWARD)
            clutter_timeline_set_direction (priv->timeline,
                                            CLUTTER_TIMELINE_BACKWARD);
          else
            clutter_timeline_set_direction (priv->timeline,
                                            CLUTTER_TIMELINE_FORWARD);
        }
      else
        {
          clutter_timeline_stop (priv->timeline);
          g_signal_emit (transition, signals[COMPLETED], 0);
        }
    }
  else
    {
      if (clutter_timeline_get_elapsed_time (priv->timeline) > 0)
        {
          clutter_timeline_stop (priv->timeline);
          g_signal_emit (transition, signals[COMPLETED], 0);
        }
      else
        {
          guint new_duration = st_theme_node_get_transition_duration (new_node);

          clutter_timeline_set_duration (priv->timeline, new_duration);

          /* If the change doesn't affect painting, we don't need to redraw,
           * but we still need to replace the node so that we properly share
           * caching with the painting that happens after the transition finishes.
           */
          if (!st_theme_node_paint_equal (priv->new_theme_node, new_node))
              priv->needs_setup = TRUE;

          g_object_unref (priv->new_theme_node);
          priv->new_theme_node = g_object_ref (new_node);
        }
    }
}

static void
calculate_offscreen_box (StThemeNodeTransition *transition,
                         const ClutterActorBox *allocation)
{
  ClutterActorBox paint_box;

  st_theme_node_transition_get_paint_box (transition,
                                          allocation,
                                          &paint_box);
  transition->priv->offscreen_box.x1 = paint_box.x1 - allocation->x1;
  transition->priv->offscreen_box.y1 = paint_box.y1 - allocation->y1;
  transition->priv->offscreen_box.x2 = paint_box.x2 - allocation->x1;
  transition->priv->offscreen_box.y2 = paint_box.y2 - allocation->y1;
}

void
st_theme_node_transition_get_paint_box (StThemeNodeTransition *transition,
                                        const ClutterActorBox *allocation,
                                        ClutterActorBox       *paint_box)
{
  StThemeNodeTransitionPrivate *priv = transition->priv;
  ClutterActorBox old_node_box, new_node_box;

  st_theme_node_get_paint_box (priv->old_theme_node,
                               allocation,
                               &old_node_box);

  st_theme_node_get_paint_box (priv->new_theme_node,
                               allocation,
                               &new_node_box);

  paint_box->x1 = MIN (old_node_box.x1, new_node_box.x1);
  paint_box->y1 = MIN (old_node_box.y1, new_node_box.y1);
  paint_box->x2 = MAX (old_node_box.x2, new_node_box.x2);
  paint_box->y2 = MAX (old_node_box.y2, new_node_box.y2);
}

static gboolean
setup_framebuffers (StThemeNodeTransition *transition,
                    const ClutterActorBox *allocation)
{
  StThemeNodeTransitionPrivate *priv = transition->priv;
  CoglColor clear_color = { 0, 0, 0, 0 };
  guint width, height;

  /* template material to avoid unnecessary shader compilation */
  static CoglHandle material_template = COGL_INVALID_HANDLE;

  width  = priv->offscreen_box.x2 - priv->offscreen_box.x1;
  height = priv->offscreen_box.y2 - priv->offscreen_box.y1;

  g_return_val_if_fail (width  > 0, FALSE);
  g_return_val_if_fail (height > 0, FALSE);

  if (priv->old_texture)
    cogl_handle_unref (priv->old_texture);

  priv->old_texture = st_cogl_texture_new_with_size_wrapper (width, height,
                                                             COGL_TEXTURE_NO_SLICING,
                                                             COGL_PIXEL_FORMAT_ANY);

  if (priv->new_texture)
    cogl_handle_unref (priv->new_texture);

  priv->new_texture = st_cogl_texture_new_with_size_wrapper (width, height,
                                                             COGL_TEXTURE_NO_SLICING,
                                                             COGL_PIXEL_FORMAT_ANY);

  g_return_val_if_fail (priv->old_texture != COGL_INVALID_HANDLE, FALSE);
  g_return_val_if_fail (priv->new_texture != COGL_INVALID_HANDLE, FALSE);

  if (priv->old_offscreen)
    cogl_handle_unref (priv->old_offscreen);
  priv->old_offscreen = cogl_offscreen_new_to_texture (priv->old_texture);

  if (priv->new_offscreen)
    cogl_handle_unref (priv->new_offscreen);
  priv->new_offscreen = cogl_offscreen_new_to_texture (priv->new_texture);

  g_return_val_if_fail (priv->old_offscreen != COGL_INVALID_HANDLE, FALSE);
  g_return_val_if_fail (priv->new_offscreen != COGL_INVALID_HANDLE, FALSE);

  if (priv->material == NULL)
    {
      if (G_UNLIKELY (material_template == COGL_INVALID_HANDLE))
        {
          material_template = cogl_material_new ();

          cogl_material_set_layer_combine (material_template, 0,
                                           "RGBA = REPLACE (TEXTURE)",
                                           NULL);
          cogl_material_set_layer_combine (material_template, 1,
                                           "RGBA = INTERPOLATE (PREVIOUS, "
                                                               "TEXTURE, "
                                                               "CONSTANT[A])",
                                           NULL);
          cogl_material_set_layer_combine (material_template, 2,
                                           "RGBA = MODULATE (PREVIOUS, "
                                                            "PRIMARY)",
                                           NULL);
        }
      priv->material = cogl_material_copy (material_template);
    }

  cogl_material_set_layer (priv->material, 0, priv->new_texture);
  cogl_material_set_layer (priv->material, 1, priv->old_texture);

  cogl_push_framebuffer (priv->old_offscreen);
  cogl_clear (&clear_color, COGL_BUFFER_BIT_COLOR);
  cogl_ortho (priv->offscreen_box.x1, priv->offscreen_box.x2,
              priv->offscreen_box.y2, priv->offscreen_box.y1,
              0.0, 1.0);
  st_theme_node_paint (priv->old_theme_node, allocation, 255);
  cogl_pop_framebuffer ();

  cogl_push_framebuffer (priv->new_offscreen);
  cogl_clear (&clear_color, COGL_BUFFER_BIT_COLOR);
  cogl_ortho (priv->offscreen_box.x1, priv->offscreen_box.x2,
              priv->offscreen_box.y2, priv->offscreen_box.y1,
              0.0, 1.0);
  st_theme_node_paint (priv->new_theme_node, allocation, 255);
  cogl_pop_framebuffer ();

  return TRUE;
}

void
st_theme_node_transition_paint (StThemeNodeTransition *transition,
                                ClutterActorBox       *allocation,
                                guint8                 paint_opacity)
{
  StThemeNodeTransitionPrivate *priv = transition->priv;

  CoglColor constant;
  float tex_coords[] = {
    0.0, 0.0, 1.0, 1.0,
    0.0, 0.0, 1.0, 1.0,
  };

  g_return_if_fail (ST_IS_THEME_NODE (priv->old_theme_node));
  g_return_if_fail (ST_IS_THEME_NODE (priv->new_theme_node));

  if (!clutter_actor_box_equal (allocation, &priv->last_allocation))
    priv->needs_setup = TRUE;

  if (priv->needs_setup)
    {
      priv->last_allocation = *allocation;

      calculate_offscreen_box (transition, allocation);
      priv->needs_setup = !setup_framebuffers (transition, allocation);

      if (priv->needs_setup) /* setting up framebuffers failed */
        return;
    }

  cogl_color_set_from_4f (&constant, 0., 0., 0.,
                          clutter_alpha_get_alpha (priv->alpha));
  cogl_material_set_layer_combine_constant (priv->material, 1, &constant);

  cogl_material_set_color4ub (priv->material,
                              paint_opacity, paint_opacity,
                              paint_opacity, paint_opacity);

  cogl_set_source (priv->material);
  cogl_rectangle_with_multitexture_coords (priv->offscreen_box.x1,
                                           priv->offscreen_box.y1,
                                           priv->offscreen_box.x2,
                                           priv->offscreen_box.y2,
                                           tex_coords, 8);
}

static void
st_theme_node_transition_dispose (GObject *object)
{
  StThemeNodeTransitionPrivate *priv = ST_THEME_NODE_TRANSITION (object)->priv;

  if (priv->old_theme_node)
    {
      g_object_unref (priv->old_theme_node);
      priv->old_theme_node = NULL;
    }

  if (priv->new_theme_node)
    {
      g_object_unref (priv->new_theme_node);
      priv->new_theme_node = NULL;
    }

  if (priv->old_texture)
    {
      cogl_handle_unref (priv->old_texture);
      priv->old_texture = NULL;
    }

  if (priv->new_texture)
    {
      cogl_handle_unref (priv->new_texture);
      priv->new_texture = NULL;
    }

  if (priv->old_offscreen)
    {
      cogl_handle_unref (priv->old_offscreen);
      priv->old_offscreen = NULL;
    }

  if (priv->new_offscreen)
    {
      cogl_handle_unref (priv->new_offscreen);
      priv->new_offscreen = NULL;
    }

  if (priv->material)
    {
      cogl_handle_unref (priv->material);
      priv->material = NULL;
    }

  if (priv->timeline)
    {
      if (priv->timeline_completed_id != 0)
        g_signal_handler_disconnect (priv->timeline,
                                     priv->timeline_completed_id);
      if (priv->timeline_new_frame_id != 0)
        g_signal_handler_disconnect (priv->timeline,
                                     priv->timeline_new_frame_id);

      g_object_unref (priv->timeline);
      priv->timeline = NULL;
    }

  priv->timeline_completed_id = 0;
  priv->timeline_new_frame_id = 0;

  if (priv->alpha)
    {
      g_object_unref (priv->alpha);
      priv->alpha = NULL;
    }

  G_OBJECT_CLASS (st_theme_node_transition_parent_class)->dispose (object);
}

static void
st_theme_node_transition_init (StThemeNodeTransition *transition)
{
  transition->priv = ST_THEME_NODE_TRANSITION_GET_PRIVATE (transition);

  transition->priv->old_theme_node = NULL;
  transition->priv->new_theme_node = NULL;

  transition->priv->old_texture = NULL;
  transition->priv->new_texture = NULL;

  transition->priv->old_offscreen = NULL;
  transition->priv->new_offscreen = NULL;

  transition->priv->needs_setup = TRUE;

  transition->priv->alpha = NULL;
}

static void
st_theme_node_transition_class_init (StThemeNodeTransitionClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  g_type_class_add_private (klass, sizeof (StThemeNodeTransitionPrivate));

  object_class->dispose = st_theme_node_transition_dispose;

  signals[COMPLETED] =
    g_signal_new ("completed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StThemeNodeTransitionClass, completed),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  signals[NEW_FRAME] =
    g_signal_new ("new-frame",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StThemeNodeTransitionClass, new_frame),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);
}
