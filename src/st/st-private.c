/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-private.h: Private declarations and functions
 *
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2010 Florian Müllner
 * Copyright 2010 Intel Corporation
 * Copyright 2010 Giovanni Campagna
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
#include <math.h>
#include <string.h>

#include "st-private.h"

/**
 * _st_actor_get_preferred_width:
 * @actor: a #ClutterActor
 * @for_height: as with clutter_actor_get_preferred_width()
 * @y_fill: %TRUE if @actor will fill its allocation vertically
 * @min_width_p: as with clutter_actor_get_preferred_width()
 * @natural_width_p: as with clutter_actor_get_preferred_width()
 *
 * Like clutter_actor_get_preferred_width(), but if @y_fill is %FALSE,
 * then it will compute a width request based on the assumption that
 * @actor will be given an allocation no taller than its natural
 * height.
 */
void
_st_actor_get_preferred_width  (ClutterActor *actor,
                                gfloat        for_height,
                                gboolean      y_fill,
                                gfloat       *min_width_p,
                                gfloat       *natural_width_p)
{
  if (!y_fill && for_height != -1)
    {
      ClutterRequestMode mode;
      gfloat natural_height;

      mode = clutter_actor_get_request_mode (actor);
      if (mode == CLUTTER_REQUEST_WIDTH_FOR_HEIGHT)
        {
          clutter_actor_get_preferred_height (actor, -1, NULL, &natural_height);
          if (for_height > natural_height)
            for_height = natural_height;
        }
    }

  clutter_actor_get_preferred_width (actor, for_height, min_width_p, natural_width_p);
}

/**
 * _st_actor_get_preferred_height:
 * @actor: a #ClutterActor
 * @for_width: as with clutter_actor_get_preferred_height()
 * @x_fill: %TRUE if @actor will fill its allocation horizontally
 * @min_height_p: as with clutter_actor_get_preferred_height()
 * @natural_height_p: as with clutter_actor_get_preferred_height()
 *
 * Like clutter_actor_get_preferred_height(), but if @x_fill is
 * %FALSE, then it will compute a height request based on the
 * assumption that @actor will be given an allocation no wider than
 * its natural width.
 */
void
_st_actor_get_preferred_height (ClutterActor *actor,
                                gfloat        for_width,
                                gboolean      x_fill,
                                gfloat       *min_height_p,
                                gfloat       *natural_height_p)
{
  if (!x_fill && for_width != -1)
    {
      ClutterRequestMode mode;
      gfloat natural_width;

      mode = clutter_actor_get_request_mode (actor);
      if (mode == CLUTTER_REQUEST_HEIGHT_FOR_WIDTH)
        {
          clutter_actor_get_preferred_width (actor, -1, NULL, &natural_width);
          if (for_width > natural_width)
            for_width = natural_width;
        }
    }

  clutter_actor_get_preferred_height (actor, for_width, min_height_p, natural_height_p);
}

/**
 * _st_set_text_from_style:
 * @text: Target #ClutterText
 * @theme_node: Source #StThemeNode
 *
 * Set various GObject properties of the @text object using
 * CSS information from @theme_node.
 */
void
_st_set_text_from_style (ClutterText *text,
                         StThemeNode *theme_node)
{

  ClutterColor color;
  StTextDecoration decoration;
  PangoAttrList *attribs = NULL;
  const PangoFontDescription *font;
  PangoAttribute *foreground;
  StTextAlign align;
  gdouble spacing;
  gchar *font_features;

  font = st_theme_node_get_font (theme_node);
  clutter_text_set_font_description (text, (PangoFontDescription *) font);

  attribs = pango_attr_list_new ();

  st_theme_node_get_foreground_color (theme_node, &color);
  clutter_text_set_cursor_color (text, &color);
  foreground = pango_attr_foreground_new (color.red * 255,
                                          color.green * 255,
                                          color.blue * 255);
  pango_attr_list_insert (attribs, foreground);

  if (color.alpha != 255)
    {
      PangoAttribute *alpha;

      /* An alpha value of 0 means "system inherited", so the
       * minimum regular value is 1.
       */
      if (color.alpha == 0)
        alpha = pango_attr_foreground_alpha_new (1);
      else
        alpha = pango_attr_foreground_alpha_new (color.alpha * 255);

      pango_attr_list_insert (attribs, alpha);
    }

  decoration = st_theme_node_get_text_decoration (theme_node);
  if (decoration)
    {
      if (decoration & ST_TEXT_DECORATION_UNDERLINE)
        {
          PangoAttribute *underline = pango_attr_underline_new (PANGO_UNDERLINE_SINGLE);
          pango_attr_list_insert (attribs, underline);
        }
      if (decoration & ST_TEXT_DECORATION_LINE_THROUGH)
        {
          PangoAttribute *strikethrough = pango_attr_strikethrough_new (TRUE);
          pango_attr_list_insert (attribs, strikethrough);
        }
      /* Pango doesn't have an equivalent attribute for _OVERLINE, and we deliberately
       * skip BLINK (for now...)
       */
    }

  spacing = st_theme_node_get_letter_spacing (theme_node);
  if (spacing)
    {
      PangoAttribute *letter_spacing = pango_attr_letter_spacing_new ((int)(.5 + spacing) * PANGO_SCALE);
      pango_attr_list_insert (attribs, letter_spacing);
    }

  font_features = st_theme_node_get_font_features (theme_node);
  if (font_features)
    {
      pango_attr_list_insert (attribs, pango_attr_font_features_new (font_features));
      g_free (font_features);
    }

  clutter_text_set_attributes (text, attribs);

  if (attribs)
    pango_attr_list_unref (attribs);

  align = st_theme_node_get_text_align (theme_node);
  if(align == ST_TEXT_ALIGN_JUSTIFY) {
    clutter_text_set_justify (text, TRUE);
    clutter_text_set_line_alignment (text, PANGO_ALIGN_LEFT);
  } else {
    clutter_text_set_justify (text, FALSE);
    clutter_text_set_line_alignment (text, (PangoAlignment) align);
  }
}

/**
 * _st_create_texture_pipeline:
 * @src_texture: The CoglTexture for the pipeline
 *
 * Creates a simple pipeline which contains the given texture as a
 * single layer.
 */
CoglPipeline *
_st_create_texture_pipeline (CoglTexture *src_texture)
{
  static CoglPipeline *texture_pipeline_template = NULL;
  CoglPipeline *pipeline;

  g_return_val_if_fail (src_texture != NULL, NULL);

  /* The only state used in the pipeline that would affect the shader
     generation is the texture type on the layer. Therefore we create
     a template pipeline which sets this state and all texture
     pipelines are created as a copy of this. That way Cogl can find
     the shader state for the pipeline more quickly by looking at the
     pipeline ancestry instead of resorting to the shader cache. */
  if (G_UNLIKELY (texture_pipeline_template == NULL))
    {
      CoglContext *ctx =
        clutter_backend_get_cogl_context (clutter_get_default_backend ());

      texture_pipeline_template = cogl_pipeline_new (ctx);
      cogl_pipeline_set_layer_null_texture (texture_pipeline_template, 0);
    }

  pipeline = cogl_pipeline_copy (texture_pipeline_template);

  if (src_texture != NULL)
    cogl_pipeline_set_layer_texture (pipeline, 0, src_texture);

  return pipeline;
}

/*****
 * Shadows
 *****/

static gdouble *
calculate_gaussian_kernel (gdouble   sigma,
                           guint     n_values)
{
  gdouble *ret, sum;
  gdouble exp_divisor;
  int half, i;

  g_return_val_if_fail (sigma > 0, NULL);

  half = n_values / 2;

  ret = g_malloc (n_values * sizeof (gdouble));
  sum = 0.0;

  exp_divisor = 2 * sigma * sigma;

  /* n_values of 1D Gauss function */
  for (i = 0; i < (int)n_values; i++)
    {
      ret[i] = exp (-(i - half) * (i - half) / exp_divisor);
      sum += ret[i];
    }

  /* normalize */
  for (i = 0; i < (int)n_values; i++)
    ret[i] /= sum;

  return ret;
}

static guchar *
blur_pixels (guchar  *pixels_in,
             gint     width_in,
             gint     height_in,
             gint     rowstride_in,
             gdouble  blur,
             gint    *width_out,
             gint    *height_out,
             gint    *rowstride_out)
{
  guchar *pixels_out;
  gdouble sigma;

  /* The CSS specification defines (or will define) the blur radius as twice
   * the Gaussian standard deviation. See:
   *
   * http://lists.w3.org/Archives/Public/www-style/2010Sep/0002.html
   */
  sigma = blur / 2.;

  if ((guint) blur == 0)
    {
      *width_out  = width_in;
      *height_out = height_in;
      *rowstride_out = rowstride_in;
      pixels_out = g_memdup (pixels_in, *rowstride_out * *height_out);
    }
  else
    {
      gdouble *kernel;
      guchar  *line;
      gint     n_values, half;
      gint     x, y_in, y_out, i;

      n_values = (gint) 5 * sigma;
      half = n_values / 2;

      *width_out  = width_in  + 2 * half;
      *height_out = height_in + 2 * half;
      *rowstride_out = (*width_out + 3) & ~3;

      pixels_out = g_malloc0 (*rowstride_out * *height_out);
      line       = g_malloc0 (*rowstride_out);

      kernel = calculate_gaussian_kernel (sigma, n_values);

      /* Both passes add up each pixel's taps in the same order as before,
       * but run along a row in the inner loop, so neighbouring pixels are
       * summed independently and memory is read in order. */

      /* vertical blur */
      for (y_out = 0; y_out < *height_out; y_out++)
        {
          guchar *row_out = pixels_out + y_out * *rowstride_out + half;
          gint i0, i1;

          y_in = y_out - half;

          /* We read from the source at 'y = y_in + i - half'; clamp the
           * full i range [0, n_values) so that y is in [0, height_in).
           */
          i0 = MAX (half - y_in, 0);
          i1 = MIN (height_in + half - y_in, n_values);

          for (i = i0; i < i1; i++)
            {
              guchar *row_in = pixels_in + (y_in + i - half) * rowstride_in;

              for (x = 0; x < width_in; x++)
                row_out[x] += row_in[x] * kernel[i];
            }
        }

      /* horizontal blur */
      for (y_out = 0; y_out < *height_out; y_out++)
        {
          guchar *row_out = pixels_out + y_out * *rowstride_out;

          memcpy (line, row_out, *rowstride_out);
          memset (row_out, 0, *width_out);

          for (i = 0; i < n_values; i++)
            {
              /* We read from the source at 'x = x_out + i - half'; clamp
               * x_out so that x is in [0, width_out).
               */
              gint x0 = MAX (half - i, 0);
              gint x1 = MIN (*width_out + half - i, *width_out);

              for (x = x0; x < x1; x++)
                row_out[x] += line[x + i - half] * kernel[i];
            }
        }
      g_free (kernel);
      g_free (line);
    }

  return pixels_out;
}

/* Largest number of taps the GPU blur shader loops over; GLSL ES requires a
 * constant loop bound. Bigger kernels use the CPU path. */
#define GPU_BLUR_MAX_TAPS 256

static const char *gpu_blur_declarations =
  "uniform vec2 blur_step;\n"
  "uniform float blur_n_values;\n"
  "uniform float blur_half;\n"
  "uniform float blur_exp_divisor;\n";

/* One-dimensional gaussian pass over blur_step. It weighs the taps exactly
 * like calculate_gaussian_kernel() does for the CPU path, and treats
 * everything outside the source texture as transparent. */
static const char *gpu_blur_code =
  "  vec4 sum = vec4 (0.0);\n"
  "  float weights = 0.0;\n"
  "  for (int i = 0; i < " G_STRINGIFY (GPU_BLUR_MAX_TAPS) "; i++)\n"
  "    {\n"
  "      if (float (i) >= blur_n_values)\n"
  "        break;\n"
  "      float d = float (i) - blur_half;\n"
  "      float w = exp (-d * d / blur_exp_divisor);\n"
  "      vec2 p = cogl_tex_coord.st + blur_step * d;\n"
  "      weights += w;\n"
  "      if (p.s >= 0.0 && p.s <= 1.0 && p.t >= 0.0 && p.t <= 1.0)\n"
  "        sum += texture2D (cogl_sampler, p) * w;\n"
  "    }\n"
  "  cogl_texel = sum / weights;\n";

static CoglTexture *
gpu_blur_pass (CoglContext  *ctx,
               CoglPipeline *template,
               CoglTexture  *src,
               int           width_out,
               int           height_out,
               float         s1,
               float         t1,
               float         s2,
               float         t2,
               gboolean      horizontal,
               int           n_values,
               double        sigma)
{
  CoglTexture *dst;
  CoglOffscreen *offscreen;
  CoglFramebuffer *fb;
  CoglPipeline *pipeline;
  GError *error = NULL;
  int step_loc, n_loc, half_loc, div_loc;

  dst = cogl_texture_2d_new_with_size (ctx, width_out, height_out);
  if (dst == NULL)
    return NULL;

  offscreen = cogl_offscreen_new_with_texture (dst);
  fb = COGL_FRAMEBUFFER (offscreen);

  if (!cogl_framebuffer_allocate (fb, &error))
    {
      g_error_free (error);
      cogl_object_unref (offscreen);
      cogl_object_unref (dst);
      return NULL;
    }

  pipeline = cogl_pipeline_copy (template);
  cogl_pipeline_set_layer_texture (pipeline, 0, src);

  step_loc = cogl_pipeline_get_uniform_location (pipeline, "blur_step");
  n_loc = cogl_pipeline_get_uniform_location (pipeline, "blur_n_values");
  half_loc = cogl_pipeline_get_uniform_location (pipeline, "blur_half");
  div_loc = cogl_pipeline_get_uniform_location (pipeline, "blur_exp_divisor");

  {
    float step[2] = { 0, 0 };

    if (horizontal)
      step[0] = 1.0f / cogl_texture_get_width (src);
    else
      step[1] = 1.0f / cogl_texture_get_height (src);

    cogl_pipeline_set_uniform_float (pipeline, step_loc, 2, 1, step);
  }
  cogl_pipeline_set_uniform_1f (pipeline, n_loc, n_values);
  cogl_pipeline_set_uniform_1f (pipeline, half_loc, n_values / 2);
  cogl_pipeline_set_uniform_1f (pipeline, div_loc, 2 * sigma * sigma);

  cogl_framebuffer_orthographic (fb, 0, 0, width_out, height_out, 0, 1.0);
  cogl_framebuffer_clear4f (fb, COGL_BUFFER_BIT_COLOR, 0, 0, 0, 0);
  cogl_framebuffer_draw_textured_rectangle (fb, pipeline,
                                            0, 0, width_out, height_out,
                                            s1, t1, s2, t2);

  cogl_object_unref (pipeline);
  cogl_object_unref (offscreen);

  return dst;
}

/* Blurs the alpha channel of @src_texture on the GPU, in two separable
 * passes, without reading anything back. The result is padded on every side
 * by the same amount as the CPU blur_pixels() pads it, so the two are
 * interchangeable. Returns %NULL if that isn't possible, in which case the
 * caller should use the CPU path. */
static CoglTexture *
create_blurred_texture_gpu (CoglContext *ctx,
                            CoglTexture *src_texture,
                            gdouble      blur)
{
  static CoglPipeline *blur_pipeline_template = NULL;
  CoglTexture *tmp, *dst;
  gdouble sigma;
  int n_values, half, width_in, height_in, width_out, height_out;

  sigma = blur / 2.;
  n_values = (gint) 5 * sigma;
  half = n_values / 2;

  if (n_values < 1 || n_values > GPU_BLUR_MAX_TAPS)
    return NULL;

  width_in  = cogl_texture_get_width  (src_texture);
  height_in = cogl_texture_get_height (src_texture);
  width_out  = width_in  + 2 * half;
  height_out = height_in + 2 * half;

  if (G_UNLIKELY (blur_pipeline_template == NULL))
    {
      CoglSnippet *snippet;

      blur_pipeline_template = cogl_pipeline_new (ctx);

      snippet = cogl_snippet_new (COGL_SNIPPET_HOOK_TEXTURE_LOOKUP,
                                  gpu_blur_declarations, NULL);
      cogl_snippet_set_replace (snippet, gpu_blur_code);
      cogl_pipeline_add_layer_snippet (blur_pipeline_template, 0, snippet);
      cogl_object_unref (snippet);

      /* The passes write their result as is */
      cogl_pipeline_set_blend (blur_pipeline_template,
                               "RGBA = ADD (SRC_COLOR, 0)", NULL);
      cogl_pipeline_set_layer_filters (blur_pipeline_template, 0,
                                       COGL_PIPELINE_FILTER_NEAREST,
                                       COGL_PIPELINE_FILTER_NEAREST);
      cogl_pipeline_set_layer_wrap_mode (blur_pipeline_template, 0,
                                         COGL_PIPELINE_WRAP_MODE_CLAMP_TO_EDGE);
    }

  /* Horizontal pass: extends the width by the padding. The texture
   * coordinates reach beyond [0, 1]; the shader treats that as transparent. */
  tmp = gpu_blur_pass (ctx, blur_pipeline_template, src_texture,
                       width_out, height_in,
                       - (float) half / width_in, 0,
                       (float) (width_in + half) / width_in, 1,
                       TRUE, n_values, sigma);
  if (tmp == NULL)
    return NULL;

  /* Vertical pass */
  dst = gpu_blur_pass (ctx, blur_pipeline_template, tmp,
                       width_out, height_out,
                       0, - (float) half / height_in,
                       1, (float) (height_in + half) / height_in,
                       FALSE, n_values, sigma);
  cogl_object_unref (tmp);

  return dst;
}

static CoglTexture *
create_blurred_texture_cpu (CoglContext *ctx,
                            CoglTexture *src_texture,
                            gdouble      blur)
{
  GError *error = NULL;
  CoglTexture *texture;
  guchar *pixels_in, *pixels_out;
  gint width_in, height_in, rowstride_in;
  gint width_out, height_out, rowstride_out;

  width_in  = cogl_texture_get_width  (src_texture);
  height_in = cogl_texture_get_height (src_texture);
  rowstride_in = (width_in + 3) & ~3;

  pixels_in  = g_malloc0 (rowstride_in * height_in);

  cogl_texture_get_data (src_texture, COGL_PIXEL_FORMAT_A_8,
                         rowstride_in, pixels_in);

  pixels_out = blur_pixels (pixels_in, width_in, height_in, rowstride_in,
                            blur,
                            &width_out, &height_out, &rowstride_out);
  g_free (pixels_in);

  texture = COGL_TEXTURE (cogl_texture_2d_new_from_data (ctx, width_out, height_out,
                                                         COGL_PIXEL_FORMAT_A_8,
                                                         rowstride_out,
                                                         pixels_out,
                                                         &error));

  if (error)
    {
      g_warning ("Failed to allocate texture: %s", error->message);
      g_error_free (error);
    }

  g_free (pixels_out);

  return texture;
}

CoglPipeline *
_st_create_shadow_pipeline_at_scale (StShadow    *shadow_spec,
                                     CoglTexture *src_texture,
                                     float        resource_scale)
{
  ClutterBackend *backend = clutter_get_default_backend ();
  CoglContext *ctx = clutter_backend_get_cogl_context (backend);

  static CoglPipeline *shadow_pipeline_template = NULL;

  CoglPipeline *pipeline;
  CoglTexture *texture = NULL;
  gdouble blur;

  g_return_val_if_fail (shadow_spec != NULL, NULL);
  g_return_val_if_fail (src_texture != NULL, NULL);

  blur = shadow_spec->blur * resource_scale;

  if ((guint) blur == 0)
    {
      /* Nothing to blur, and the output has the size of the input. Only the
       * alpha channel is used by the pipeline below. */
      texture = cogl_object_ref (src_texture);
    }
  else
    {
      texture = create_blurred_texture_gpu (ctx, src_texture, blur);

      if (texture == NULL)
        texture = create_blurred_texture_cpu (ctx, src_texture, blur);
    }

  if (G_UNLIKELY (shadow_pipeline_template == NULL))
    {
      shadow_pipeline_template = cogl_pipeline_new (ctx);

      /* We set up the pipeline to blend the shadow texture with the combine
       * constant, but defer setting the latter until painting, so that we can
       * take the actor's overall opacity into account. */
      cogl_pipeline_set_layer_combine (shadow_pipeline_template, 0,
                                       "RGBA = MODULATE (CONSTANT, TEXTURE[A])",
                                       NULL);
    }

  pipeline = cogl_pipeline_copy (shadow_pipeline_template);
  cogl_pipeline_set_layer_texture (pipeline, 0, texture);

  if (texture)
    cogl_object_unref (texture);

  return pipeline;
}


CoglPipeline *
_st_create_shadow_pipeline (StShadow    *shadow_spec,
                            CoglTexture *src_texture)
{

  return _st_create_shadow_pipeline_at_scale (shadow_spec, src_texture, 1.0);
}

CoglPipeline *
_st_create_shadow_pipeline_from_actor (StShadow     *shadow_spec,
                                       ClutterActor *actor)
{
  ClutterContent *image = NULL;
  CoglPipeline *shadow_pipeline = NULL;
  float resource_scale;
  float width, height;
  ClutterPaintContext *paint_context;

  g_return_val_if_fail (clutter_actor_has_allocation (actor), NULL);

  clutter_actor_get_size (actor, &width, &height);

  if (width == 0 || height == 0)
    return NULL;

  resource_scale = clutter_actor_get_resource_scale (actor);

  width = ceilf (width * resource_scale);
  height = ceilf (height * resource_scale);

  image = clutter_actor_get_content (actor);
  if (image && CLUTTER_IS_IMAGE (image))
    {
      CoglTexture *texture;

      texture = clutter_image_get_texture (CLUTTER_IMAGE (image));
      if (texture &&
          cogl_texture_get_width (texture) == width &&
          cogl_texture_get_height (texture) == height)
        shadow_pipeline = _st_create_shadow_pipeline_at_scale (shadow_spec, texture,
                                                               resource_scale);
    }

  if (shadow_pipeline == NULL)
    {
      CoglTexture *buffer;
      CoglOffscreen *offscreen;
      CoglFramebuffer *fb;
      CoglContext *ctx;
      CoglColor clear_color;
      GError *catch_error = NULL;
      float x, y;

      ctx = clutter_backend_get_cogl_context (clutter_get_default_backend ());
      buffer = cogl_texture_2d_new_with_size (ctx, width, height);

      if (buffer == NULL)
        return NULL;

      offscreen = cogl_offscreen_new_with_texture (buffer);
      fb = COGL_FRAMEBUFFER (offscreen);

      if (!cogl_framebuffer_allocate (fb, &catch_error))
        {
          g_error_free (catch_error);
          cogl_object_unref (offscreen);
          cogl_object_unref (buffer);
          return NULL;
        }

      cogl_color_init_from_4ub (&clear_color, 0, 0, 0, 0);
      clutter_actor_get_position (actor, &x, &y);
      x *= resource_scale;
      y *= resource_scale;

      cogl_framebuffer_clear (fb, COGL_BUFFER_BIT_COLOR, &clear_color);
      cogl_framebuffer_translate (fb, -x, -y, 0);
      cogl_framebuffer_orthographic (fb, 0, 0, width, height, 0, 1.0);
      cogl_framebuffer_scale (fb, resource_scale, resource_scale, 1);

      clutter_actor_set_opacity_override (actor, 255);

      paint_context = clutter_paint_context_new_for_framebuffer (fb);
      clutter_actor_paint (actor, paint_context);
      clutter_paint_context_destroy (paint_context);

      clutter_actor_set_opacity_override (actor, -1);

      cogl_object_unref (fb);

      shadow_pipeline = _st_create_shadow_pipeline_at_scale (shadow_spec, buffer,
                                                             resource_scale);

      cogl_object_unref (buffer);
    }

  return shadow_pipeline;
}

/**
 * _st_create_shadow_cairo_pattern:
 * @shadow_spec: the definition of the shadow
 * @src_pattern: surface pattern for which we create the shadow
 *               (must be a surface pattern)
 *
 * This is a utility function for creating shadows used by
 * st-theme-node.c; it's in this file to share the gaussian
 * blur implementation. The usage of this function is quite different
 * depending on whether shadow_spec->inset is %TRUE or not. If
 * shadow_spec->inset is %TRUE, the caller should pass in a @src_pattern
 * which is the <i>inverse</i> of what they want shadowed, and must take
 * care of the spread and offset from the shadow spec themselves. If
 * shadow_spec->inset is %FALSE then the caller should pass in what they
 * want shadowed directly, and this function takes care of the spread and
 * the offset.
 */
cairo_pattern_t *
_st_create_shadow_cairo_pattern (StShadow        *shadow_spec_in,
                                 cairo_pattern_t *src_pattern)
{
  g_autoptr(StShadow) shadow_spec = NULL;
  static cairo_user_data_key_t shadow_pattern_user_data;
  cairo_t *cr;
  cairo_surface_t *src_surface;
  cairo_surface_t *surface_in;
  cairo_surface_t *surface_out;
  cairo_pattern_t *dst_pattern;
  guchar          *pixels_in, *pixels_out;
  gint             width_in, height_in, rowstride_in;
  gint             width_out, height_out, rowstride_out;
  cairo_matrix_t   shadow_matrix;
  double           xscale_in, yscale_in;
  int i, j;

  g_return_val_if_fail (shadow_spec_in != NULL, NULL);
  g_return_val_if_fail (src_pattern != NULL, NULL);

  if (cairo_pattern_get_surface (src_pattern, &src_surface) != CAIRO_STATUS_SUCCESS)
    /* The most likely reason we can't get the pattern is that sizing went hairwire
     * and the caller tried to create a surface too big for memory, leaving us with
     * a pattern in an error state; we return a transparent pattern for the shadow.
     */
    return cairo_pattern_create_rgba(1.0, 1.0, 1.0, 0.0);

  width_in  = cairo_image_surface_get_width  (src_surface);
  height_in = cairo_image_surface_get_height (src_surface);

  cairo_surface_get_device_scale (src_surface, &xscale_in, &yscale_in);

  if (xscale_in != 1.0 || yscale_in != 1.0)
    {
      /* Scale the shadow specifications in a temporary copy so that
       * we can work everywhere in absolute surface coordinates */
      double scale = (xscale_in + yscale_in) / 2.0;
      shadow_spec = st_shadow_new (&shadow_spec_in->color,
                                   shadow_spec_in->xoffset * xscale_in,
                                   shadow_spec_in->yoffset * yscale_in,
                                   shadow_spec_in->blur * scale,
                                   shadow_spec_in->spread * scale,
                                   shadow_spec_in->inset);
    }
  else
    {
      shadow_spec = st_shadow_ref (shadow_spec_in);
    }

  /* We want the output to be a color agnostic alpha mask,
   * so we need to strip the color channels from the input
   */
  if (cairo_image_surface_get_format (src_surface) != CAIRO_FORMAT_A8)
    {
      surface_in = cairo_image_surface_create (CAIRO_FORMAT_A8,
                                               width_in, height_in);

      cr = cairo_create (surface_in);
      cairo_set_source_surface (cr, src_surface, 0, 0);
      cairo_paint (cr);
      cairo_destroy (cr);
    }
  else
    {
      surface_in = cairo_surface_reference (src_surface);
    }

  pixels_in = cairo_image_surface_get_data (surface_in);
  rowstride_in = cairo_image_surface_get_stride (surface_in);

  pixels_out = blur_pixels (pixels_in, width_in, height_in, rowstride_in,
                            shadow_spec->blur,
                            &width_out, &height_out, &rowstride_out);
  cairo_surface_destroy (surface_in);

  /* Invert pixels for inset shadows */
  if (shadow_spec->inset)
    {
      for (j = 0; j < height_out; j++)
        {
          guchar *p = pixels_out + rowstride_out * j;
          for (i = 0; i < width_out; i++, p++)
            *p = ~*p;
        }
    }

  surface_out = cairo_image_surface_create_for_data (pixels_out,
                                                     CAIRO_FORMAT_A8,
                                                     width_out,
                                                     height_out,
                                                     rowstride_out);
  cairo_surface_set_device_scale (surface_out, xscale_in, yscale_in);
  cairo_surface_set_user_data (surface_out, &shadow_pattern_user_data,
                               pixels_out, (cairo_destroy_func_t) g_free);

  dst_pattern = cairo_pattern_create_for_surface (surface_out);
  cairo_surface_destroy (surface_out);

  cairo_pattern_get_matrix (src_pattern, &shadow_matrix);

  if (shadow_spec->inset)
    {
      /* Scale the matrix in surface absolute coordinates */
      cairo_matrix_scale (&shadow_matrix, 1.0 / xscale_in, 1.0 / yscale_in);

      /* For inset shadows, offsets and spread radius have already been
       * applied to the original pattern, so all left to do is shift the
       * blurred image left, so that it aligns centered under the
       * unblurred one
       */
      cairo_matrix_translate (&shadow_matrix,
                              (width_out - width_in) / 2.0,
                              (height_out - height_in) / 2.0);

      /* Scale back the matrix in original coordinates */
      cairo_matrix_scale (&shadow_matrix, xscale_in, yscale_in);

      cairo_pattern_set_matrix (dst_pattern, &shadow_matrix);
      return dst_pattern;
    }

  /* Read all the code from the cairo_pattern_set_matrix call
   * at the end of this function to here from bottom to top,
   * because each new affine transformation is applied in
   * front of all the previous ones */

  /* 6. Invert the matrix back */
  cairo_matrix_invert (&shadow_matrix);

  /* Scale the matrix in surface absolute coordinates */
  cairo_matrix_scale (&shadow_matrix, 1.0 / xscale_in, 1.0 / yscale_in);

  /* 5. Adjust based on specified offsets */
  cairo_matrix_translate (&shadow_matrix,
                          shadow_spec->xoffset,
                          shadow_spec->yoffset);

  /* 4. Recenter the newly scaled image */
  cairo_matrix_translate (&shadow_matrix,
                          - shadow_spec->spread,
                          - shadow_spec->spread);

  /* 3. Scale up the blurred image to fill the spread */
  cairo_matrix_scale (&shadow_matrix,
                      (width_in + 2.0 * shadow_spec->spread) / width_in,
                      (height_in + 2.0 * shadow_spec->spread) / height_in);

  /* 2. Shift the blurred image left, so that it aligns centered
   * under the unblurred one */
  cairo_matrix_translate (&shadow_matrix,
                          - (width_out - width_in) / 2.0,
                          - (height_out - height_in) / 2.0);

  /* Scale back the matrix in scaled coordinates */
  cairo_matrix_scale (&shadow_matrix, xscale_in, yscale_in);

  /* 1. Invert the matrix so we can work with it in pattern space
   */
  cairo_matrix_invert (&shadow_matrix);

  cairo_pattern_set_matrix (dst_pattern, &shadow_matrix);

  return dst_pattern;
}

void
_st_paint_shadow_with_opacity (StShadow        *shadow_spec,
                               CoglPipeline    *shadow_pipeline,
                               CoglFramebuffer *framebuffer,
                               ClutterActorBox *box,
                               guint8           paint_opacity)
{
  ClutterActorBox shadow_box;
  CoglColor color;

  g_return_if_fail (shadow_spec != NULL);
  g_return_if_fail (shadow_pipeline != NULL);

  st_shadow_get_box (shadow_spec, box, &shadow_box);

  cogl_color_init_from_4ub (&color,
                            shadow_spec->color.red   * paint_opacity / 255,
                            shadow_spec->color.green * paint_opacity / 255,
                            shadow_spec->color.blue  * paint_opacity / 255,
                            shadow_spec->color.alpha * paint_opacity / 255);
  cogl_color_premultiply (&color);
  cogl_pipeline_set_layer_combine_constant (shadow_pipeline, 0, &color);
  cogl_framebuffer_draw_rectangle (framebuffer,
                                   shadow_pipeline,
                                   shadow_box.x1, shadow_box.y1,
                                   shadow_box.x2, shadow_box.y2);
}

/**
 * _st_get_align_factors:
 * @x_align: an #StAlign
 * @y_align: an #StAlign
 * @x_align_out: (out) (allow-none): @x_align as a #gdouble
 * @y_align_out: (out) (allow-none): @y_align as a #gdouble
 *
 * Converts @x_align and @y_align to #gdouble values.
 */
void
_st_get_align_factors (StAlign   x_align,
                       StAlign   y_align,
                       gdouble  *x_align_out,
                       gdouble  *y_align_out)
{
  if (x_align_out)
    {
      switch (x_align)
        {
        case ST_ALIGN_START:
          *x_align_out = 0.0;
          break;

        case ST_ALIGN_MIDDLE:
          *x_align_out = 0.5;
          break;

        case ST_ALIGN_END:
          *x_align_out = 1.0;
          break;

        default:
          g_warn_if_reached ();
          break;
        }
    }

  if (y_align_out)
    {
      switch (y_align)
        {
        case ST_ALIGN_START:
          *y_align_out = 0.0;
          break;

        case ST_ALIGN_MIDDLE:
          *y_align_out = 0.5;
          break;

        case ST_ALIGN_END:
          *y_align_out = 1.0;
          break;

        default:
          g_warn_if_reached ();
          break;
        }
    }
}
