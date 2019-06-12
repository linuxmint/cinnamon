/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-scroll-view-fade.h: Edge fade effect for StScrollView
 *
 * Copyright 2010 Intel Corporation.
 * Copyright 2011 Adel Gadllah
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


#define ST_SCROLL_VIEW_FADE_CLASS(klass)        (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_SCROLL_VIEW_FADE, StScrollViewFadeClass))
#define ST_IS_SCROLL_VIEW_FADE_CLASS(klass)     (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_SCROLL_VIEW_FADE))
#define ST_SCROLL_VIEW_FADE_GET_CLASS(obj)      (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_SCROLL_VIEW_FADE, StScrollViewFadeClass))

#include "st-scroll-view-fade.h"
#include "st-scroll-view.h"
#include "st-widget.h"
#include "st-theme-node.h"
#include "st-scroll-bar.h"
#include "st-scrollable.h"
#include "st-cogl-wrapper.h"

#include <clutter/clutter.h>
#include <cogl/cogl.h>

typedef struct _StScrollViewFadeClass  StScrollViewFadeClass;

#define DEFAULT_FADE_OFFSET 68.0f

static const gchar *fade_glsl_shader =
"uniform sampler2D tex;\n"
"uniform float height;\n"
"uniform float width;\n"
"uniform float offset_bottom;\n"
"uniform float offset_top;\n"
/*
 * Used to pass the fade area to the shader
 *
 * [0][0] = x1
 * [0][1] = y1
 * [1][0] = x2
 * [1][1] = y2
 *
 */
"uniform mat2 fade_area;\n"
"\n"
"void main ()\n"
"{\n"
" vec4 color = cogl_color_in * texture2D (tex, vec2 (cogl_tex_coord_in[0].xy));\n"
" float y = height * cogl_tex_coord_in[0].y;\n"
" float x = width * cogl_tex_coord_in[0].x;\n"
" float ratio = 1.0;\n"
" float fade_bottom_start = fade_area[1][1] - offset_bottom;\n"
" float ratio_top = y / offset_top;\n"
" float ratio_bottom = (fade_area[1][1] - y)/(fade_area[1][1] - fade_bottom_start);\n"
" bool in_scroll_area = fade_area[0][0] <= x && fade_area[1][0] >= x;\n"
" bool fade_top = y < offset_top && in_scroll_area && (y >= fade_area[0][1]);\n"
" bool fade_bottom = y > fade_bottom_start && in_scroll_area && (y <= fade_area[1][1]);\n"
"\n"
" if (fade_top) {\n"
"  ratio *= ratio_top;\n"
" }\n"
"\n"
" if (fade_bottom) {\n"
"  ratio *= ratio_bottom;\n"
" }\n"
"\n"
"  cogl_color_out = color * ratio;\n"
"}";

struct _StScrollViewFade
{
  ClutterOffscreenEffect parent_instance;

  /* a back pointer to our actor, so that we can query it */
  ClutterActor *actor;

  CoglHandle shader;
  CoglHandle program;

  gint tex_uniform;
  gint height_uniform;
  gint width_uniform;
  gint fade_area_uniform;
  gint offset_top_uniform;
  gint offset_bottom_uniform;

  StAdjustment *vadjustment;

  guint is_attached : 1;

  float fade_offset;
};

struct _StScrollViewFadeClass
{
  ClutterOffscreenEffectClass parent_class;
};

G_DEFINE_TYPE (StScrollViewFade,
               st_scroll_view_fade,
               CLUTTER_TYPE_OFFSCREEN_EFFECT);

enum {
  PROP_0,

  PROP_FADE_OFFSET,
};

static gboolean
st_scroll_view_fade_pre_paint (ClutterEffect *effect)
{
  StScrollViewFade *self = ST_SCROLL_VIEW_FADE (effect);
  ClutterEffectClass *parent_class;

  if (self->shader == COGL_INVALID_HANDLE)
    return FALSE;

  if (!clutter_actor_meta_get_enabled (CLUTTER_ACTOR_META (effect)))
    return FALSE;

  if (self->actor == NULL)
    return FALSE;

  if (self->program == COGL_INVALID_HANDLE)
    self->program = cogl_create_program ();

  if (!self->is_attached)
    {
      g_assert (self->shader != COGL_INVALID_HANDLE);
      g_assert (self->program != COGL_INVALID_HANDLE);

      cogl_program_attach_shader (self->program, self->shader);
      cogl_program_link (self->program);

      cogl_handle_unref (self->shader);

      self->is_attached = TRUE;

      self->tex_uniform =
        cogl_program_get_uniform_location (self->program, "tex");
      self->height_uniform =
        cogl_program_get_uniform_location (self->program, "height");
      self->width_uniform =
        cogl_program_get_uniform_location (self->program, "width");
      self->fade_area_uniform =
        cogl_program_get_uniform_location (self->program, "fade_area");
      self->offset_top_uniform =
        cogl_program_get_uniform_location (self->program, "offset_top");
      self->offset_bottom_uniform =
        cogl_program_get_uniform_location (self->program, "offset_bottom");
    }

  parent_class = CLUTTER_EFFECT_CLASS (st_scroll_view_fade_parent_class);
  return parent_class->pre_paint (effect);
}

static CoglHandle
st_scroll_view_fade_create_texture (ClutterOffscreenEffect *effect,
                                    gfloat                  min_width,
                                    gfloat                  min_height)
{
  return st_cogl_texture_new_with_size_wrapper (min_width, min_height,
                                                COGL_TEXTURE_NO_SLICING,
                                                COGL_PIXEL_FORMAT_RGBA_8888_PRE);
}

static void
st_scroll_view_fade_paint_target (ClutterOffscreenEffect *effect)
{
  StScrollViewFade *self = ST_SCROLL_VIEW_FADE (effect);
  ClutterOffscreenEffectClass *parent;
  CoglHandle material;

  gdouble value, lower, upper, page_size;
  ClutterActor *vscroll = st_scroll_view_get_vscroll_bar (ST_SCROLL_VIEW (self->actor));
  ClutterActor *hscroll = st_scroll_view_get_hscroll_bar (ST_SCROLL_VIEW (self->actor));
  gboolean h_scroll_visible, v_scroll_visible;

  ClutterActorBox allocation, content_box, paint_box;

  /*
   * Used to pass the fade area to the shader
   *
   * [0][0] = x1
   * [0][1] = y1
   * [1][0] = x2
   * [1][1] = y2
   *
   */
  float fade_area[2][2];
  ClutterVertex verts[4];

  if (self->program == COGL_INVALID_HANDLE)
    goto out;

  clutter_actor_get_paint_box (self->actor, &paint_box);
  clutter_actor_get_abs_allocation_vertices (self->actor, verts);

  clutter_actor_get_allocation_box (self->actor, &allocation);
  st_theme_node_get_content_box (st_widget_get_theme_node (ST_WIDGET (self->actor)),
                                (const ClutterActorBox *)&allocation, &content_box);

  /*
   * The FBO is based on the paint_volume's size which can be larger then the actual
   * allocation, so we have to account for that when passing the positions
   */
  fade_area[0][0] = content_box.x1 + (verts[0].x - paint_box.x1);
  fade_area[0][1] = content_box.y1 + (verts[0].y - paint_box.y1);
  fade_area[1][0] = content_box.x2 + (verts[3].x - paint_box.x2);
  fade_area[1][1] = content_box.y2 + (verts[3].y - paint_box.y2);

  g_object_get (ST_SCROLL_VIEW (self->actor),
                "hscrollbar-visible", &h_scroll_visible,
                "vscrollbar-visible", &v_scroll_visible,
                NULL);

  if (v_scroll_visible)
    {
      if (st_widget_get_direction (ST_WIDGET (self->actor)) == ST_TEXT_DIRECTION_RTL)
          fade_area[0][0] += clutter_actor_get_width (vscroll);

      fade_area[1][0] -= clutter_actor_get_width (vscroll);
    }

  if (h_scroll_visible)
      fade_area[1][1] -= clutter_actor_get_height (hscroll);

  st_adjustment_get_values (self->vadjustment, &value, &lower, &upper, NULL, NULL, &page_size);

  if (self->offset_top_uniform > -1) {
    if (value > lower + 0.1)
      cogl_program_set_uniform_1f (self->program, self->offset_top_uniform, self->fade_offset);
    else
      cogl_program_set_uniform_1f (self->program, self->offset_top_uniform, 0.0f);
  }

  if (self->offset_bottom_uniform > -1) {
    if (value < upper - page_size - 0.1)
      cogl_program_set_uniform_1f (self->program, self->offset_bottom_uniform, self->fade_offset);
    else
      cogl_program_set_uniform_1f (self->program, self->offset_bottom_uniform, 0.0f);
  }

  if (self->tex_uniform > -1)
    cogl_program_set_uniform_1i (self->program, self->tex_uniform, 0);
  if (self->height_uniform > -1)
    cogl_program_set_uniform_1f (self->program, self->height_uniform, clutter_actor_get_height (self->actor));
  if (self->width_uniform > -1)
    cogl_program_set_uniform_1f (self->program, self->width_uniform, clutter_actor_get_width (self->actor));
  if (self->fade_area_uniform > -1)
    cogl_program_set_uniform_matrix (self->program, self->fade_area_uniform, 2, 1, FALSE, (const float *)fade_area);

  material = clutter_offscreen_effect_get_target (effect);
  cogl_material_set_user_program (material, self->program);

out:
  parent = CLUTTER_OFFSCREEN_EFFECT_CLASS (st_scroll_view_fade_parent_class);
  parent->paint_target (effect);
}

static void
on_vadjustment_changed (StAdjustment *adjustment,
                        ClutterEffect *effect)
{
  gdouble value, lower, upper, page_size;
  gboolean needs_fade;

  st_adjustment_get_values (adjustment, &value, &lower, &upper, NULL, NULL, &page_size);
  needs_fade = (value > lower + 0.1) || (value < upper - page_size - 0.1);

  clutter_actor_meta_set_enabled (CLUTTER_ACTOR_META (effect), needs_fade);
}

static void
st_scroll_view_fade_set_actor (ClutterActorMeta *meta,
                               ClutterActor *actor)
{
  StScrollViewFade *self = ST_SCROLL_VIEW_FADE (meta);
  ClutterActorMetaClass *parent;

  g_return_if_fail (actor == NULL || ST_IS_SCROLL_VIEW (actor));

  if (!clutter_feature_available (CLUTTER_FEATURE_SHADERS_GLSL))
    {
      /* if we don't have support for GLSL shaders then we
       * forcibly disable the ActorMeta
       */
      clutter_actor_meta_set_enabled (meta, FALSE);
      return;
    }

  if (self->shader == COGL_INVALID_HANDLE)
    {
      clutter_actor_meta_set_enabled (meta, FALSE);
      return;
    }

  if (self->vadjustment)
    {
      g_signal_handlers_disconnect_by_func (self->vadjustment,
                                            (gpointer)on_vadjustment_changed,
                                            self);
      self->vadjustment = NULL;
    }

  if (actor)
    {
        StScrollView *scroll_view = ST_SCROLL_VIEW (actor);
        StScrollBar *vscroll = ST_SCROLL_BAR (st_scroll_view_get_vscroll_bar (scroll_view));
        self->vadjustment = ST_ADJUSTMENT (st_scroll_bar_get_adjustment (vscroll));

        g_signal_connect (self->vadjustment, "changed",
                          G_CALLBACK (on_vadjustment_changed),
                          self);

        on_vadjustment_changed (self->vadjustment, CLUTTER_EFFECT (self));
    }

  parent = CLUTTER_ACTOR_META_CLASS (st_scroll_view_fade_parent_class);
  parent->set_actor (meta, actor);

  /* we keep a back pointer here, to avoid going through the ActorMeta */
  self->actor = clutter_actor_meta_get_actor (meta);
}

static void
st_scroll_view_fade_dispose (GObject *gobject)
{
  StScrollViewFade *self = ST_SCROLL_VIEW_FADE (gobject);

  if (self->program != COGL_INVALID_HANDLE)
    {
      cogl_handle_unref (self->program);

      self->program = COGL_INVALID_HANDLE;
      self->shader = COGL_INVALID_HANDLE;
    }

  if (self->vadjustment)
    {
      g_signal_handlers_disconnect_by_func (self->vadjustment,
                                            (gpointer)on_vadjustment_changed,
                                            self);
      self->vadjustment = NULL;
    }

  self->actor = NULL;

  G_OBJECT_CLASS (st_scroll_view_fade_parent_class)->dispose (gobject);
}

static void
st_scroll_view_fade_set_offset (StScrollViewFade *self,
                                float fade_offset)
{
  if (self->fade_offset == fade_offset)
    return;

  g_object_freeze_notify (G_OBJECT (self));

  self->fade_offset = fade_offset;

  if (self->actor != NULL)
    clutter_actor_queue_redraw (self->actor);

  g_object_notify (G_OBJECT (self), "fade-offset");
  g_object_thaw_notify (G_OBJECT (self));
}

static void
st_scroll_view_fade_set_property (GObject *object,
                                  guint prop_id,
                                  const GValue *value,
                                  GParamSpec *pspec)
{
  StScrollViewFade *self = ST_SCROLL_VIEW_FADE (object);

  switch (prop_id)
    {
    case PROP_FADE_OFFSET:
      st_scroll_view_fade_set_offset (self, g_value_get_float (value));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
st_scroll_view_fade_get_property (GObject *object,
                                  guint prop_id,
                                  GValue *value,
                                  GParamSpec *pspec)
{
  StScrollViewFade *self = ST_SCROLL_VIEW_FADE (object);

  switch (prop_id)
    {
    case PROP_FADE_OFFSET:
      g_value_set_float (value, self->fade_offset);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
st_scroll_view_fade_class_init (StScrollViewFadeClass *klass)
{
  ClutterEffectClass *effect_class = CLUTTER_EFFECT_CLASS (klass);
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterOffscreenEffectClass *offscreen_class;
  ClutterActorMetaClass *meta_class = CLUTTER_ACTOR_META_CLASS (klass);

  gobject_class->dispose = st_scroll_view_fade_dispose;
  gobject_class->get_property = st_scroll_view_fade_get_property;
  gobject_class->set_property = st_scroll_view_fade_set_property;

  meta_class->set_actor = st_scroll_view_fade_set_actor;

  effect_class->pre_paint = st_scroll_view_fade_pre_paint;

  offscreen_class = CLUTTER_OFFSCREEN_EFFECT_CLASS (klass);
  offscreen_class->create_texture = st_scroll_view_fade_create_texture;
  offscreen_class->paint_target = st_scroll_view_fade_paint_target;

  g_object_class_install_property (gobject_class,
                                   PROP_FADE_OFFSET,
                                   g_param_spec_float ("fade-offset",
                                                       "Fade Offset",
                                                       "The height of the area which is faded at the edge",
                                                       0.f, G_MAXFLOAT, DEFAULT_FADE_OFFSET,
                                                       G_PARAM_READWRITE));

}

static void
st_scroll_view_fade_init (StScrollViewFade *self)
{
  static CoglHandle shader = COGL_INVALID_HANDLE;

  if (shader == COGL_INVALID_HANDLE)
    {
      if (clutter_feature_available (CLUTTER_FEATURE_SHADERS_GLSL))
        {
          shader = cogl_create_shader (COGL_SHADER_TYPE_FRAGMENT);
          cogl_shader_source (shader, fade_glsl_shader);
          cogl_shader_compile (shader);
          if (!cogl_shader_is_compiled (shader))
            {
              gchar *log_buf = cogl_shader_get_info_log (shader);

              g_warning (G_STRLOC ": Unable to compile the fade shader: %s",
                         log_buf);
              g_free (log_buf);

              cogl_handle_unref (shader);
              shader = COGL_INVALID_HANDLE;
          }
        }
    }

  self->shader = shader;
  self->is_attached = FALSE;
  self->tex_uniform = -1;
  self->height_uniform = -1;
  self->width_uniform = -1;
  self->fade_area_uniform = -1;
  self->offset_top_uniform = -1;
  self->offset_bottom_uniform = -1;
  self->fade_offset = DEFAULT_FADE_OFFSET;

  if (shader != COGL_INVALID_HANDLE)
    cogl_handle_ref (self->shader);
}

ClutterEffect *
st_scroll_view_fade_new (void)
{
  return g_object_new (ST_TYPE_SCROLL_VIEW_FADE, NULL);
}
