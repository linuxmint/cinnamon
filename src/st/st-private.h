/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-private.h: Private declarations and functions
 *
 * Copyright 2007 OpenedHand
 * Copyright 2009 Intel Corporation.
 * Copyright 2010 Red Hat, Inc.
 * Copyright 2010 Florian Müllner
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

#ifndef __ST_PRIVATE_H__
#define __ST_PRIVATE_H__

#include <glib.h>
#include <cairo.h>
#include "st-widget.h"
#include "st-bin.h"
#include "st-shadow.h"
#include "st-theme-node-transition.h"

G_BEGIN_DECLS

#define I_(str)         (g_intern_static_string ((str)))

#define ST_PARAM_READABLE     \
        (G_PARAM_READABLE |     \
         G_PARAM_STATIC_NICK | G_PARAM_STATIC_NAME | G_PARAM_STATIC_BLURB)

#define ST_PARAM_READWRITE    \
        (G_PARAM_READABLE | G_PARAM_WRITABLE | \
         G_PARAM_STATIC_NICK | G_PARAM_STATIC_NAME | G_PARAM_STATIC_BLURB)

G_END_DECLS

ClutterActor *_st_widget_get_dnd_clone (StWidget *widget);

void _st_get_align_factors (StAlign   x_align,
                            StAlign   y_align,
                            gdouble  *x_align_out,
                            gdouble  *y_align_out);

void _st_actor_get_preferred_width  (ClutterActor *actor,
                                     gfloat        for_height,
                                     gboolean      y_fill,
                                     gfloat       *min_width_p,
                                     gfloat       *natural_width_p);
void _st_actor_get_preferred_height (ClutterActor *actor,
                                     gfloat        for_width,
                                     gboolean      x_fill,
                                     gfloat       *min_height_p,
                                     gfloat       *natural_height_p);

void _st_set_text_from_style (ClutterText *text,
                              StThemeNode *theme_node);

CoglPipeline * _st_create_texture_pipeline (CoglTexture *src_texture);

/* Helper for widgets which need to draw additional shadows */
CoglPipeline * _st_create_shadow_pipeline (StShadow    *shadow_spec,
                                           CoglTexture *src_texture);
CoglPipeline * _st_create_shadow_pipeline_from_actor (StShadow     *shadow_spec,
                                                      ClutterActor *actor);
cairo_pattern_t * _st_create_shadow_cairo_pattern (StShadow        *shadow_spec,
                                                   cairo_pattern_t *src_pattern);

void _st_paint_shadow_with_opacity (StShadow        *shadow_spec,
                                    CoglPipeline    *shadow_pipeline,
                                    ClutterActorBox *box,
                                    guint8           paint_opacity);

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

  guint      is_style_dirty : 1;
  guint      draw_bg_color : 1;
  guint      draw_border_internal : 1;
  guint      track_hover : 1;
  guint      hover : 1;
  guint      can_focus : 1;
  guint      important : 1;

  StTextDirection   direction;

  AtkObject *accessible;
  AtkRole accessible_role;
  AtkStateSet *local_state_set;

  ClutterActor *label_actor;
  gchar *accessible_name;

  /* Even though Clutter has first_child/last_child properties,
   * we need to keep track of the old first/last children so
   * that we can remove the pseudo classes on them. */
  StWidget *prev_last_child;
  StWidget *prev_first_child;

  StWidgetCallback style_changed_callback;
};

#endif /* __ST_PRIVATE_H__ */
