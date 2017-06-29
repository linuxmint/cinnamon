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

CoglHandle _st_create_texture_material (CoglHandle src_texture);

/* Helper for widgets which need to draw additional shadows */
CoglHandle _st_create_shadow_material (StShadow   *shadow_spec,
                                       CoglHandle  src_texture);
CoglHandle _st_create_shadow_material_from_actor (StShadow     *shadow_spec,
                                                  ClutterActor *actor);
cairo_pattern_t *_st_create_shadow_cairo_pattern (StShadow        *shadow_spec,
                                                  cairo_pattern_t *src_pattern);

void _st_paint_shadow_with_opacity (StShadow        *shadow_spec,
                                    CoglHandle       shadow_material,
                                    ClutterActorBox *box,
                                    guint8           paint_opacity);

#endif /* __ST_PRIVATE_H__ */
