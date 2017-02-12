/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-theme-node-private.h: private structures and functions for StThemeNode
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

#ifndef __ST_THEME_NODE_PRIVATE_H__
#define __ST_THEME_NODE_PRIVATE_H__

#include <gdk/gdk.h>

#include "st-theme-node.h"
#include <libcroco/libcroco.h>
#include "st-types.h"

G_BEGIN_DECLS

struct _StThemeNode {
  GObject parent;

  StThemeContext *context;
  StThemeNode *parent_node;
  StTheme *theme;

  PangoFontDescription *font_desc;

  ClutterColor background_color;
  /* If gradient is set, then background_color is the gradient start */
  StGradientType background_gradient_type;
  ClutterColor background_gradient_end;

  int background_position_x;
  int background_position_y;

  StBackgroundSize background_size;
  gint background_size_w;
  gint background_size_h;

  ClutterColor foreground_color;
  ClutterColor border_color[4];
  ClutterColor outline_color;

  int border_width[4];
  int border_radius[4];
  int outline_width;
  guint padding[4];
  guint margin[4];

  int width;
  int height;
  int min_width;
  int min_height;
  int max_width;
  int max_height;

  int transition_duration;

  char *background_image;
  char *background_bumpmap;
  StBorderImage *border_image;
  StShadow *box_shadow;
  StShadow *background_image_shadow;
  StShadow *text_shadow;
  StIconColors *icon_colors;

  GType element_type;
  char *element_id;
  GStrv element_classes;
  GStrv pseudo_classes;
  char *inline_style;
  gboolean important;

  CRDeclaration **properties;
  int n_properties;

  /* We hold onto these separately so we can destroy them on finalize */
  CRDeclaration *inline_properties;

  guint background_position_set : 1;
  guint background_repeat : 1;

  guint properties_computed : 1;
  guint geometry_computed : 1;
  guint background_computed : 1;
  guint foreground_computed : 1;
  guint border_image_computed : 1;
  guint box_shadow_computed : 1;
  guint background_image_shadow_computed : 1;
  guint text_shadow_computed : 1;
  guint link_type : 2;

  /* Graphics state */
  float alloc_width;
  float alloc_height;

  CoglHandle background_shadow_material;
  CoglHandle box_shadow_material;
  CoglHandle background_texture;
  CoglHandle background_material;
  CoglHandle border_slices_texture;
  CoglHandle border_slices_material;
  CoglHandle prerendered_texture;
  CoglHandle prerendered_material;
  CoglHandle corner_material[4];
};

struct _StThemeNodeClass {
  GObjectClass parent_class;

};

void _st_theme_node_ensure_background (StThemeNode *node);
void _st_theme_node_ensure_geometry (StThemeNode *node);
void _st_theme_node_apply_margins (StThemeNode *node,
                                   ClutterActor *actor);

void _st_theme_node_init_drawing_state (StThemeNode *node);
void _st_theme_node_free_drawing_state (StThemeNode *node);

G_END_DECLS

#endif /* __ST_THEME_NODE_PRIVATE_H__ */
