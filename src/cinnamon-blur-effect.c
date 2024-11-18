/* cinnamon-blur-effect.c
 *
 * Copyright 2019 Georges Basile Stavracas Neto <georges.stavracas@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include "cinnamon-blur-effect.h"

#include "cinnamon-enum-types.h"

/**
 * SECTION:cinnamon-blur-effect
 * @short_description: Blur effect for actors
 *
 * #CinnamonBlurEffect is a moderately fast gaussian blur implementation. It also has
 * an optional brighness property.
 *
 * # Modes
 *
 * #CinnamonBlurEffect can work in @CINNAMON_BLUR_MODE_BACKGROUND and @CINNAMON_BLUR_MODE_ACTOR
 * modes. The actor mode blurs the actor itself, and all of its children. The
 * background mode blurs the pixels beneath the actor, but not the actor itself.
 *
 * @CINNAMON_BLUR_MODE_BACKGROUND can be computationally expensive, since the contents
 * beneath the actor cannot be cached, so beware of the performance implications
 * of using this blur mode.
 *
 * # Optimizations
 *
 * There are a number of optimizations in place to make this blur implementation
 * real-time. All in all, the implementation performs best when using large
 * blur-radii that allow downscaling the texture to smaller sizes, at small
 * radii where no downscaling is possible this can easily halve the framerate.
 *
 * ## Multipass
 *
 * It is implemented in 2 passes: vertical and horizontal.
 *
 * ## Downscaling
 *
 * #CinnamonBlurEffect uses dynamic downscaling to speed up blurring. Downscaling
 * happens in factors of 2 (the image is downscaled either by 2, 4, 8, 16, …) and
 * depends on the blur radius, the actor size, among others.
 *
 * The actor is drawn into a downscaled framebuffer; the blur passes are applied
 * on the downscaled actor contents; and finally, the blurred contents are drawn
 * upscaled again.
 *
 * ## Hardware Interpolation
 *
 * This blur implementation cuts down the number of sampling operations by
 * exploiting the hardware interpolation that is performed when sampling between
 * pixel boundaries. This technique is described at:
 *
 * http://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
 *
 * ## Incremental gauss-factor calculation
 *
 * The kernel values for the gaussian kernel are computed incrementally instead
 * of running the expensive calculations multiple times inside the blur shader.
 * The implementation is based on the algorithm presented by K. Turkowski in
 * GPU Gems 3, chapter 40:
 *
 * https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch40.html
 *
 */

static const gchar *gaussian_blur_glsl_declarations =
"uniform float sigma;                                                      \n"
"uniform float pixel_step;                                                 \n"
"uniform int vertical;                                                     \n";

static const gchar *gaussian_blur_glsl =
"  int horizontal = 1 - vertical;                                          \n"
"                                                                          \n"
"  vec2 uv = vec2 (cogl_tex_coord.st);                                     \n"
"                                                                          \n"
"  vec3 gauss_coefficient;                                                 \n"
"  gauss_coefficient.x = 1.0 / (sqrt (2.0 * 3.14159265) * sigma);          \n"
"  gauss_coefficient.y = exp (-0.5 / (sigma * sigma));                     \n"
"  gauss_coefficient.z = gauss_coefficient.y * gauss_coefficient.y;        \n"
"                                                                          \n"
"  float gauss_coefficient_total = gauss_coefficient.x;                    \n"
"                                                                          \n"
"  vec4 ret = texture2D (cogl_sampler, uv) * gauss_coefficient.x;          \n"
"  gauss_coefficient.xy *= gauss_coefficient.yz;                           \n"
"                                                                          \n"
"  int n_steps = int (ceil (3 * sigma));                                   \n"
"                                                                          \n"
"  for (int i = 1; i < n_steps; i += 2) {                                  \n"
"    float coefficient_subtotal = gauss_coefficient.x;                     \n"
"    gauss_coefficient.xy *= gauss_coefficient.yz;                         \n"
"    coefficient_subtotal += gauss_coefficient.x;                          \n"
"                                                                          \n"
"    float gauss_ratio = gauss_coefficient.x / coefficient_subtotal;       \n"
"                                                                          \n"
"    float foffset = float (i) + gauss_ratio;                              \n"
"    vec2 offset = vec2 (foffset * pixel_step * float (horizontal),        \n"
"                        foffset * pixel_step * float (vertical));         \n"
"                                                                          \n"
"    ret += texture2D (cogl_sampler, uv + offset) * coefficient_subtotal;  \n"
"    ret += texture2D (cogl_sampler, uv - offset) * coefficient_subtotal;  \n"
"                                                                          \n"
"    gauss_coefficient_total += 2.0 * coefficient_subtotal;                \n"
"    gauss_coefficient.xy *= gauss_coefficient.yz;                         \n"
"  }                                                                       \n"
"                                                                          \n"
"  cogl_texel = ret / gauss_coefficient_total;                             \n";

static const gchar *brightness_glsl_declarations =
"uniform float brightness;                                                 \n";

static const gchar *brightness_glsl =
"  cogl_color_out.rgb *= brightness;                                       \n";

#define MIN_DOWNSCALE_SIZE 256.f
#define MAX_SIGMA 6.f

typedef enum
{
  VERTICAL,
  HORIZONTAL,
} BlurType;

typedef enum
{
  ACTOR_PAINTED = 1 << 0,
  BLUR_APPLIED = 1 << 1,
} CacheFlags;

typedef struct
{
  CoglFramebuffer *framebuffer;
  CoglPipeline *pipeline;
  CoglTexture *texture;
} FramebufferData;

typedef struct
{
  FramebufferData data;
  BlurType type;
  int sigma_uniform;
  int pixel_step_uniform;
  int vertical_uniform;
} BlurData;

struct _CinnamonBlurEffect
{
  ClutterEffect parent_instance;

  ClutterActor *actor;
  int old_opacity_override;

  BlurData blur[2];

  unsigned int tex_width;
  unsigned int tex_height;

  /* The cached contents */
  FramebufferData actor_fb;
  CacheFlags cache_flags;

  FramebufferData background_fb;
  FramebufferData brightness_fb;
  int brightness_uniform;

  CinnamonBlurMode mode;
  float downscale_factor;
  float brightness;
  int sigma;
};

G_DEFINE_TYPE (CinnamonBlurEffect, cinnamon_blur_effect, CLUTTER_TYPE_EFFECT)

enum {
  PROP_0,
  PROP_SIGMA,
  PROP_BRIGHTNESS,
  PROP_MODE,
  N_PROPS
};

static GParamSpec *properties [N_PROPS] = { NULL, };

static CoglPipeline*
create_base_pipeline (void)
{
  static CoglPipeline *base_pipeline = NULL;

  if (G_UNLIKELY (base_pipeline == NULL))
    {
      CoglContext *ctx =
        clutter_backend_get_cogl_context (clutter_get_default_backend ());

      base_pipeline = cogl_pipeline_new (ctx);
      cogl_pipeline_set_layer_null_texture (base_pipeline, 0);
      cogl_pipeline_set_layer_filters (base_pipeline,
                                       0,
                                       COGL_PIPELINE_FILTER_LINEAR,
                                       COGL_PIPELINE_FILTER_LINEAR);
      cogl_pipeline_set_layer_wrap_mode (base_pipeline,
                                         0,
                                         COGL_PIPELINE_WRAP_MODE_CLAMP_TO_EDGE);
    }

  return cogl_pipeline_copy (base_pipeline);
}

static CoglPipeline*
create_blur_pipeline (void)
{
  static CoglPipeline *blur_pipeline = NULL;

  if (G_UNLIKELY (blur_pipeline == NULL))
    {
      CoglSnippet *snippet;

      blur_pipeline = create_base_pipeline ();

      snippet = cogl_snippet_new (COGL_SNIPPET_HOOK_TEXTURE_LOOKUP,
                                  gaussian_blur_glsl_declarations,
                                  NULL);
      cogl_snippet_set_replace (snippet, gaussian_blur_glsl);
      cogl_pipeline_add_layer_snippet (blur_pipeline, 0, snippet);
      cogl_object_unref (snippet);
    }

  return cogl_pipeline_copy (blur_pipeline);
}


static CoglPipeline*
create_brightness_pipeline (void)
{
  static CoglPipeline *brightness_pipeline = NULL;

  if (G_UNLIKELY (brightness_pipeline == NULL))
    {
      CoglSnippet *snippet;

      brightness_pipeline = create_base_pipeline ();

      snippet = cogl_snippet_new (COGL_SNIPPET_HOOK_FRAGMENT,
                                  brightness_glsl_declarations,
                                  brightness_glsl);
      cogl_pipeline_add_snippet (brightness_pipeline, snippet);
      cogl_object_unref (snippet);
    }

  return cogl_pipeline_copy (brightness_pipeline);
}

static void
setup_blur (BlurData *blur,
            BlurType  type)
{
  blur->type = type;
  blur->data.pipeline = create_blur_pipeline ();

  blur->sigma_uniform =
    cogl_pipeline_get_uniform_location (blur->data.pipeline, "sigma");
  blur->pixel_step_uniform =
    cogl_pipeline_get_uniform_location (blur->data.pipeline, "pixel_step");
  blur->vertical_uniform =
    cogl_pipeline_get_uniform_location (blur->data.pipeline, "vertical");
}

static void
update_blur_uniforms (CinnamonBlurEffect *self,
                      BlurData        *blur)
{
  gboolean is_vertical = blur->type == VERTICAL;

  if (blur->pixel_step_uniform > -1)
    {
      float pixel_step;

      if (is_vertical)
        pixel_step = 1.f / cogl_texture_get_height (blur->data.texture);
      else
        pixel_step = 1.f / cogl_texture_get_width (blur->data.texture);

      cogl_pipeline_set_uniform_1f (blur->data.pipeline,
                                    blur->pixel_step_uniform,
                                    pixel_step);
    }

  if (blur->sigma_uniform > -1)
    {
      cogl_pipeline_set_uniform_1f (blur->data.pipeline,
                                    blur->sigma_uniform,
                                    self->sigma / self->downscale_factor);
    }

  if (blur->vertical_uniform > -1)
    {
      cogl_pipeline_set_uniform_1i (blur->data.pipeline,
                                    blur->vertical_uniform,
                                    is_vertical);
    }
}

static void
update_brightness_uniform (CinnamonBlurEffect *self)
{
  if (self->brightness_uniform > -1)
    {
      cogl_pipeline_set_uniform_1f (self->brightness_fb.pipeline,
                                    self->brightness_uniform,
                                    self->brightness);
    }
}

static void
setup_projection_matrix (CoglFramebuffer *framebuffer,
                         float            width,
                         float            height)
{
  CoglMatrix projection;

  cogl_matrix_init_identity (&projection);
  cogl_matrix_scale (&projection,
                     2.0 / width,
                     -2.0 / height,
                     1.f);
  cogl_matrix_translate (&projection,
                         -width / 2.0,
                         -height / 2.0,
                         0);

  cogl_framebuffer_set_projection_matrix (framebuffer, &projection);
}

static gboolean
update_fbo (FramebufferData *data,
            unsigned int     width,
            unsigned int     height,
            float            downscale_factor)
{
  CoglContext *ctx =
    clutter_backend_get_cogl_context (clutter_get_default_backend ());

  g_clear_pointer (&data->texture, cogl_object_unref);
  g_clear_pointer (&data->framebuffer, cogl_object_unref);

  float new_width = floorf (width / downscale_factor);
  float new_height = floorf (height / downscale_factor);

  data->texture = cogl_texture_2d_new_with_size (ctx, new_width, new_height);
  if (!data->texture)
    return FALSE;

  cogl_pipeline_set_layer_texture (data->pipeline, 0, data->texture);

  data->framebuffer = cogl_offscreen_new_with_texture (data->texture);
  if (!data->framebuffer)
    {
      g_warning ("%s: Unable to create an Offscreen buffer", G_STRLOC);
      return FALSE;
    }

  setup_projection_matrix (data->framebuffer, new_width, new_height);

  return TRUE;
}

static gboolean
update_actor_fbo (CinnamonBlurEffect *self,
                  unsigned int     width,
                  unsigned int     height,
                  float            downscale_factor)
{
  if (self->tex_width == width &&
      self->tex_height == height &&
      self->downscale_factor == downscale_factor &&
      self->actor_fb.framebuffer)
    {
      return TRUE;
    }

  self->cache_flags &= ~ACTOR_PAINTED;

  return update_fbo (&self->actor_fb, width, height, downscale_factor);
}

static gboolean
update_brightness_fbo (CinnamonBlurEffect *self,
                       unsigned int     width,
                       unsigned int     height,
                       float            downscale_factor)
{
  if (self->tex_width == width &&
      self->tex_height == height &&
      self->downscale_factor == downscale_factor &&
      self->brightness_fb.framebuffer)
    {
      return TRUE;
    }

  return update_fbo (&self->brightness_fb,
                     width, height,
                     downscale_factor);
}

static gboolean
update_blur_fbo (CinnamonBlurEffect *self,
                 BlurData        *blur,
                 unsigned int     width,
                 unsigned int     height,
                 float            downscale_factor)
{
  if (self->tex_width == width &&
      self->tex_height == height &&
      self->downscale_factor == downscale_factor &&
      blur->data.framebuffer)
    {
      return TRUE;
    }

  return update_fbo (&blur->data,
                     width, height,
                     downscale_factor);
}

static gboolean
update_background_fbo (CinnamonBlurEffect *self,
                       unsigned int     width,
                       unsigned int     height)
{
  if (self->tex_width == width &&
      self->tex_height == height &&
      self->background_fb.framebuffer)
    {
      return TRUE;
    }

  return update_fbo (&self->background_fb, width, height, 1.0);
}

static void
clear_framebuffer_data (FramebufferData *fb_data)
{
  g_clear_pointer (&fb_data->texture, cogl_object_unref);
  g_clear_pointer (&fb_data->framebuffer, cogl_object_unref);
}

static float
calculate_downscale_factor (float width,
                            float height,
                            float sigma)
{
  float downscale_factor = 1.0;
  float scaled_width = width;
  float scaled_height = height;
  float scaled_sigma = sigma;

  /* This is the algorithm used by Firefox; keep downscaling until either the
   * blur radius is lower than the threshold, or the downscaled texture is too
   * small.
   */
  while (scaled_sigma > MAX_SIGMA &&
         scaled_width > MIN_DOWNSCALE_SIZE &&
         scaled_height > MIN_DOWNSCALE_SIZE)
    {
      downscale_factor *= 2.f;

      scaled_width = width / downscale_factor;
      scaled_height = height / downscale_factor;
      scaled_sigma = sigma / downscale_factor;
    }

  return downscale_factor;
}

static void
clear_framebuffer (CoglFramebuffer *framebuffer)
{
  static CoglColor transparent;
  static gboolean initialized = FALSE;

  if (!initialized)
    {
      cogl_color_init_from_4ub (&transparent, 0, 0, 0, 0);
      initialized = TRUE;
    }

  cogl_framebuffer_clear (framebuffer, COGL_BUFFER_BIT_COLOR, &transparent);
}

static void
cinnamon_blur_effect_set_actor (ClutterActorMeta *meta,
                             ClutterActor     *actor)
{
  CinnamonBlurEffect *self = CINNAMON_BLUR_EFFECT (meta);
  ClutterActorMetaClass *meta_class;

  meta_class = CLUTTER_ACTOR_META_CLASS (cinnamon_blur_effect_parent_class);
  meta_class->set_actor (meta, actor);

  /* clear out the previous state */
  clear_framebuffer_data (&self->actor_fb);
  clear_framebuffer_data (&self->background_fb);
  clear_framebuffer_data (&self->brightness_fb);
  clear_framebuffer_data (&self->blur[VERTICAL].data);
  clear_framebuffer_data (&self->blur[HORIZONTAL].data);

  /* we keep a back pointer here, to avoid going through the ActorMeta */
  self->actor = clutter_actor_meta_get_actor (meta);
}

static void
update_actor_box (CinnamonBlurEffect     *self,
                  ClutterPaintContext *paint_context,
                  ClutterActorBox     *source_actor_box)
{
  ClutterStageView *stage_view;
  float box_scale_factor = 1.0f;
  float origin_x, origin_y;
  float width, height;

  switch (self->mode)
    {
    case CINNAMON_BLUR_MODE_ACTOR:
      clutter_actor_get_allocation_box (self->actor, source_actor_box);
      break;

    case CINNAMON_BLUR_MODE_BACKGROUND:
      stage_view = clutter_paint_context_get_stage_view (paint_context);

      clutter_actor_get_transformed_position (self->actor, &origin_x, &origin_y);
      clutter_actor_get_transformed_size (self->actor, &width, &height);

      if (stage_view)
        {
          cairo_rectangle_int_t stage_view_layout;

          box_scale_factor = clutter_stage_view_get_scale (stage_view);
          clutter_stage_view_get_layout (stage_view, &stage_view_layout);

          origin_x -= stage_view_layout.x;
          origin_y -= stage_view_layout.y;
        }
      else
        {
          /* If we're drawing off stage, just assume scale = 1, this won't work
           * with stage-view scaling though.
           */
        }

      clutter_actor_box_set_origin (source_actor_box, origin_x, origin_y);
      clutter_actor_box_set_size (source_actor_box, width, height);

      clutter_actor_box_scale (source_actor_box, box_scale_factor);
      break;
    }

  clutter_actor_box_clamp_to_pixel (source_actor_box);
}

static void
paint_texture (CinnamonBlurEffect     *self,
               ClutterPaintContext *paint_context)
{
  CoglFramebuffer *framebuffer;
  float width, height;

  framebuffer = clutter_paint_context_get_framebuffer (paint_context);

  /* Use the untransformed actor size here, since the framebuffer itself already
   * has the actor transform matrix applied.
   */
  clutter_actor_get_size (self->actor, &width, &height);

  update_brightness_uniform (self);
  cogl_framebuffer_draw_rectangle (framebuffer,
                                   self->brightness_fb.pipeline,
                                   0, 0,
                                   width,
                                   height);
}

static void
apply_blur (CinnamonBlurEffect     *self,
            ClutterPaintContext *paint_context,
            FramebufferData     *from,
            uint8_t              paint_opacity)
{
  BlurData *vblur;
  BlurData *hblur;

  vblur = &self->blur[VERTICAL];
  hblur = &self->blur[HORIZONTAL];

  /* Copy the actor contents into the vblur framebuffer */
  clear_framebuffer (vblur->data.framebuffer);
  cogl_framebuffer_draw_rectangle (vblur->data.framebuffer,
                                   from->pipeline,
                                   0, 0,
                                   cogl_texture_get_width (vblur->data.texture),
                                   cogl_texture_get_height (vblur->data.texture));

  /* Pass 1:
   *
   * Draw the actor contents (which is in the vblur framebuffer
   * at this point) into the hblur framebuffer. This will run the
   * vertical blur fragment shader, and will output a vertically
   * blurred image.
   */
  update_blur_uniforms (self, vblur);

  clear_framebuffer (hblur->data.framebuffer);
  cogl_framebuffer_draw_rectangle (hblur->data.framebuffer,
                                   vblur->data.pipeline,
                                   0, 0,
                                   cogl_texture_get_width (hblur->data.texture),
                                   cogl_texture_get_height (hblur->data.texture));

  /* Pass 2:
   *
   * Now the opposite; draw the vertically blurred image using the
   * horizontal blur pipeline into the brightness framebuffer.
   */
  update_blur_uniforms (self, hblur);
  cogl_pipeline_set_color4ub (hblur->data.pipeline,
                              paint_opacity,
                              paint_opacity,
                              paint_opacity,
                              paint_opacity);

  clear_framebuffer (self->brightness_fb.framebuffer);
  cogl_framebuffer_draw_rectangle (self->brightness_fb.framebuffer,
                                   hblur->data.pipeline,
                                   0, 0,
                                   cogl_texture_get_width (self->brightness_fb.texture),
                                   cogl_texture_get_height (self->brightness_fb.texture));


  self->cache_flags |= BLUR_APPLIED;
}

static gboolean
paint_background (CinnamonBlurEffect     *self,
                  ClutterPaintContext *paint_context,
                  ClutterActorBox     *source_actor_box)
{
  g_autoptr (GError) error = NULL;
  CoglFramebuffer *framebuffer;
  float transformed_x;
  float transformed_y;
  float transformed_width;
  float transformed_height;

  framebuffer = clutter_paint_context_get_framebuffer (paint_context);

  clutter_actor_box_get_origin (source_actor_box,
                                &transformed_x,
                                &transformed_y);
  clutter_actor_box_get_size (source_actor_box,
                              &transformed_width,
                              &transformed_height);

  clear_framebuffer (self->background_fb.framebuffer);
  cogl_blit_framebuffer (framebuffer,
                         self->background_fb.framebuffer,
                         transformed_x,
                         transformed_y,
                         0, 0,
                         transformed_width,
                         transformed_height,
                         &error);

  if (error)
    {
      g_warning ("Error blitting overlay framebuffer: %s", error->message);
      return FALSE;
    }

  return TRUE;
}

static gboolean
update_framebuffers (CinnamonBlurEffect     *self,
                     ClutterPaintContext *paint_context,
                     ClutterActorBox     *source_actor_box)
{
  gboolean updated = FALSE;
  float downscale_factor;
  float height = -1;
  float width = -1;

  clutter_actor_box_get_size (source_actor_box, &width, &height);

  downscale_factor = calculate_downscale_factor (width, height, self->sigma);

  updated =
    update_actor_fbo (self, width, height, downscale_factor) &&
    update_blur_fbo (self, &self->blur[VERTICAL], width, height, downscale_factor) &&
    update_blur_fbo (self, &self->blur[HORIZONTAL], width, height, downscale_factor) &&
    update_brightness_fbo (self, width, height, downscale_factor);

  if (self->mode == CINNAMON_BLUR_MODE_BACKGROUND)
    updated = updated && update_background_fbo (self, width, height);

  self->tex_width = width;
  self->tex_height = height;
  self->downscale_factor = downscale_factor;

  return updated;
}

static void
paint_actor_offscreen (CinnamonBlurEffect         *self,
                       ClutterPaintContext     *paint_context,
                       ClutterEffectPaintFlags  flags)
{
  gboolean actor_dirty;

  actor_dirty = (flags & CLUTTER_EFFECT_PAINT_ACTOR_DIRTY) != 0;

  /* The actor offscreen framebuffer is updated already */
  if (!actor_dirty && (self->cache_flags & ACTOR_PAINTED))
    return;

  self->old_opacity_override = clutter_actor_get_opacity_override (self->actor);
  clutter_actor_set_opacity_override (self->actor, 0xff);

  /* Draw the actor contents into the actor offscreen framebuffer */
  clear_framebuffer (self->actor_fb.framebuffer);

  cogl_framebuffer_push_matrix (self->actor_fb.framebuffer);
  cogl_framebuffer_scale (self->actor_fb.framebuffer,
                          1.f / self->downscale_factor,
                          1.f / self->downscale_factor,
                          1.f);

  clutter_paint_context_push_framebuffer (paint_context,
                                          self->actor_fb.framebuffer);

  clutter_actor_continue_paint (self->actor, paint_context);

  cogl_framebuffer_pop_matrix (self->actor_fb.framebuffer);
  clutter_paint_context_pop_framebuffer (paint_context);

  clutter_actor_set_opacity_override (self->actor, self->old_opacity_override);

  self->cache_flags |= ACTOR_PAINTED;
}

static gboolean
needs_repaint (CinnamonBlurEffect         *self,
               ClutterEffectPaintFlags  flags)
{
  gboolean actor_cached;
  gboolean blur_cached;
  gboolean actor_dirty;

  actor_dirty = (flags & CLUTTER_EFFECT_PAINT_ACTOR_DIRTY) != 0;
  blur_cached = (self->cache_flags & BLUR_APPLIED) != 0;
  actor_cached = (self->cache_flags & ACTOR_PAINTED) != 0;

  switch (self->mode)
    {
    case CINNAMON_BLUR_MODE_ACTOR:
      return actor_dirty || !blur_cached || !actor_cached;

    case CINNAMON_BLUR_MODE_BACKGROUND:
      return TRUE;
    }

  return TRUE;
}

static void
cinnamon_blur_effect_paint (ClutterEffect           *effect,
                         ClutterPaintContext     *paint_context,
                         ClutterEffectPaintFlags  flags)
{
  CinnamonBlurEffect *self = CINNAMON_BLUR_EFFECT (effect);
  uint8_t paint_opacity;

  g_assert (self->actor != NULL);

  if (self->sigma > 0)
    {
      if (needs_repaint (self, flags))
        {
          ClutterActorBox source_actor_box;

          update_actor_box (self, paint_context, &source_actor_box);

          /* Failing to create or update the offscreen framebuffers prevents
           * the entire effect to be applied.
           */
          if (!update_framebuffers (self, paint_context, &source_actor_box))
            goto fail;

          switch (self->mode)
            {
            case CINNAMON_BLUR_MODE_ACTOR:
              paint_opacity = clutter_actor_get_paint_opacity (self->actor);

              paint_actor_offscreen (self, paint_context, flags);
              apply_blur (self, paint_context, &self->actor_fb, paint_opacity);
              break;

            case CINNAMON_BLUR_MODE_BACKGROUND:
              if (!paint_background (self, paint_context, &source_actor_box))
                goto fail;

              apply_blur (self, paint_context, &self->background_fb, 255);
              break;
            }
        }

      paint_texture (self, paint_context);

      /* Background blur needs to paint the actor after painting the blurred
       * background.
       */
      switch (self->mode)
        {
        case CINNAMON_BLUR_MODE_ACTOR:
          break;

        case CINNAMON_BLUR_MODE_BACKGROUND:
          clutter_actor_continue_paint (self->actor, paint_context);
          break;
        }

      return;
    }

fail:
  /* When no blur is applied, or the offscreen framebuffers
   * couldn't be created, fallback to simply painting the actor.
   */
  clutter_actor_continue_paint (self->actor, paint_context);
}

static void
cinnamon_blur_effect_finalize (GObject *object)
{
  CinnamonBlurEffect *self = (CinnamonBlurEffect *)object;

  clear_framebuffer_data (&self->actor_fb);
  clear_framebuffer_data (&self->background_fb);
  clear_framebuffer_data (&self->brightness_fb);
  clear_framebuffer_data (&self->blur[VERTICAL].data);
  clear_framebuffer_data (&self->blur[HORIZONTAL].data);

  g_clear_pointer (&self->actor_fb.pipeline, cogl_object_unref);
  g_clear_pointer (&self->background_fb.pipeline, cogl_object_unref);
  g_clear_pointer (&self->brightness_fb.pipeline, cogl_object_unref);
  g_clear_pointer (&self->blur[VERTICAL].data.pipeline, cogl_object_unref);
  g_clear_pointer (&self->blur[HORIZONTAL].data.pipeline, cogl_object_unref);

  G_OBJECT_CLASS (cinnamon_blur_effect_parent_class)->finalize (object);
}

static void
cinnamon_blur_effect_get_property (GObject    *object,
                                guint       prop_id,
                                GValue     *value,
                                GParamSpec *pspec)
{
  CinnamonBlurEffect *self = CINNAMON_BLUR_EFFECT (object);

  switch (prop_id)
    {
    case PROP_SIGMA:
      g_value_set_int (value, self->sigma);
      break;

    case PROP_BRIGHTNESS:
      g_value_set_float (value, self->brightness);
      break;

    case PROP_MODE:
      g_value_set_enum (value, self->mode);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
cinnamon_blur_effect_set_property (GObject      *object,
                                guint         prop_id,
                                const GValue *value,
                                GParamSpec   *pspec)
{
  CinnamonBlurEffect *self = CINNAMON_BLUR_EFFECT (object);

  switch (prop_id)
    {
    case PROP_SIGMA:
      cinnamon_blur_effect_set_sigma (self, g_value_get_int (value));
      break;

    case PROP_BRIGHTNESS:
      cinnamon_blur_effect_set_brightness (self, g_value_get_float (value));
      break;

    case PROP_MODE:
      cinnamon_blur_effect_set_mode (self, g_value_get_enum (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
cinnamon_blur_effect_class_init (CinnamonBlurEffectClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorMetaClass *meta_class = CLUTTER_ACTOR_META_CLASS (klass);
  ClutterEffectClass *effect_class = CLUTTER_EFFECT_CLASS (klass);

  object_class->finalize = cinnamon_blur_effect_finalize;
  object_class->get_property = cinnamon_blur_effect_get_property;
  object_class->set_property = cinnamon_blur_effect_set_property;

  meta_class->set_actor = cinnamon_blur_effect_set_actor;

  effect_class->paint = cinnamon_blur_effect_paint;

  properties[PROP_SIGMA] =
    g_param_spec_int ("sigma",
                      "Sigma",
                      "Sigma",
                      0, G_MAXINT, 0,
                      G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);

  properties[PROP_BRIGHTNESS] =
    g_param_spec_float ("brightness",
                        "Brightness",
                        "Brightness",
                        0.f, 1.f, 1.f,
                        G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);

  properties[PROP_MODE] =
    g_param_spec_enum ("mode",
                       "Blur mode",
                       "Blur mode",
                       CINNAMON_TYPE_BLUR_MODE,
                       CINNAMON_BLUR_MODE_ACTOR,
                       G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);

  g_object_class_install_properties (object_class, N_PROPS, properties);
}

static void
cinnamon_blur_effect_init (CinnamonBlurEffect *self)
{
  self->mode = CINNAMON_BLUR_MODE_ACTOR;
  self->sigma = 0;
  self->brightness = 1.f;

  self->actor_fb.pipeline = create_base_pipeline ();
  self->background_fb.pipeline = create_base_pipeline ();
  self->brightness_fb.pipeline = create_brightness_pipeline ();
  self->brightness_uniform =
    cogl_pipeline_get_uniform_location (self->brightness_fb.pipeline, "brightness");

  setup_blur (&self->blur[VERTICAL], VERTICAL);
  setup_blur (&self->blur[HORIZONTAL], HORIZONTAL);
}

CinnamonBlurEffect *
cinnamon_blur_effect_new (void)
{
  return g_object_new (CINNAMON_TYPE_BLUR_EFFECT, NULL);
}

int
cinnamon_blur_effect_get_sigma (CinnamonBlurEffect *self)
{
  g_return_val_if_fail (CINNAMON_IS_BLUR_EFFECT (self), -1);

  return self->sigma;
}

void
cinnamon_blur_effect_set_sigma (CinnamonBlurEffect *self,
                             int              sigma)
{
  g_return_if_fail (CINNAMON_IS_BLUR_EFFECT (self));

  if (self->sigma == sigma)
    return;

  self->sigma = sigma;
  self->cache_flags &= ~BLUR_APPLIED;

  if (self->actor)
    clutter_effect_queue_repaint (CLUTTER_EFFECT (self));

  g_object_notify_by_pspec (G_OBJECT (self), properties[PROP_SIGMA]);
}

float
cinnamon_blur_effect_get_brightness (CinnamonBlurEffect *self)
{
  g_return_val_if_fail (CINNAMON_IS_BLUR_EFFECT (self), FALSE);

  return self->brightness;
}

void
cinnamon_blur_effect_set_brightness (CinnamonBlurEffect *self,
                                  float            brightness)
{
  g_return_if_fail (CINNAMON_IS_BLUR_EFFECT (self));

  if (self->brightness == brightness)
    return;

  self->brightness = brightness;
  self->cache_flags &= ~BLUR_APPLIED;

  if (self->actor)
    clutter_effect_queue_repaint (CLUTTER_EFFECT (self));

  g_object_notify_by_pspec (G_OBJECT (self), properties[PROP_BRIGHTNESS]);
}

CinnamonBlurMode
cinnamon_blur_effect_get_mode (CinnamonBlurEffect *self)
{
  g_return_val_if_fail (CINNAMON_IS_BLUR_EFFECT (self), -1);

  return self->mode;
}

void
cinnamon_blur_effect_set_mode (CinnamonBlurEffect *self,
                            CinnamonBlurMode    mode)
{
  g_return_if_fail (CINNAMON_IS_BLUR_EFFECT (self));

  if (self->mode == mode)
    return;

  self->mode = mode;
  self->cache_flags &= ~BLUR_APPLIED;

  switch (mode)
    {
    case CINNAMON_BLUR_MODE_ACTOR:
      clear_framebuffer_data (&self->background_fb);
      break;

    case CINNAMON_BLUR_MODE_BACKGROUND:
    default:
      /* Do nothing */
      break;
    }

  if (self->actor)
    clutter_effect_queue_repaint (CLUTTER_EFFECT (self));

  g_object_notify_by_pspec (G_OBJECT (self), properties[PROP_MODE]);
}

void
cinnamon_blur_effect_new_for_actor (ClutterActor     *actor,
                                    CinnamonBlurMode  mode,
                                    const gchar      *name,
                                    float             brightness,
                                    int               sigma)
{
    g_return_if_fail (CLUTTER_IS_ACTOR (actor));

    CinnamonBlurEffect *blur = g_object_new (CINNAMON_TYPE_BLUR_EFFECT,
                                             "mode", mode,
                                             "brightness", brightness,
                                             "sigma", sigma,
                                             NULL);

    clutter_actor_add_effect_with_name (actor, name, CLUTTER_EFFECT (blur));
}