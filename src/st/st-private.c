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
#include "st-cogl-wrapper.h"

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
  gchar *font_string;
  StTextAlign align;

  st_theme_node_get_foreground_color (theme_node, &color);
  clutter_text_set_color (text, &color);

  font = st_theme_node_get_font (theme_node);
  font_string = pango_font_description_to_string (font);
  clutter_text_set_font_name (text, font_string);
  g_free (font_string);

  decoration = st_theme_node_get_text_decoration (theme_node);

  if (decoration)
    {
      attribs = pango_attr_list_new ();

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
 * _st_create_texture_material:
 * @src_texture: The CoglTexture for the material
 *
 * Creates a simple material which contains the given texture as a
 * single layer.
 */
CoglHandle
_st_create_texture_material (CoglHandle src_texture)
{
  static CoglHandle texture_material_template = COGL_INVALID_HANDLE;
  CoglHandle material;

  g_return_val_if_fail (src_texture != COGL_INVALID_HANDLE,
                        COGL_INVALID_HANDLE);

  /* We use a material that has a dummy texture as a base for all
     texture materials. The idea is that only the Cogl texture object
     would be different in the children so it is likely that Cogl will
     be able to share GL programs between all the textures. */
  if (G_UNLIKELY (texture_material_template == COGL_INVALID_HANDLE))
    {
      static const guint8 white_pixel[] = { 0xff, 0xff, 0xff, 0xff };
      CoglHandle dummy_texture;

      dummy_texture = st_cogl_texture_new_from_data_wrapper (1, 1,
                                                             COGL_TEXTURE_NONE,
                                                             COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                             COGL_PIXEL_FORMAT_ANY,
                                                             4, white_pixel);

      texture_material_template = cogl_material_new ();
      cogl_material_set_layer (texture_material_template, 0, dummy_texture);
      cogl_handle_unref (dummy_texture);
    }

  material = cogl_material_copy (texture_material_template);

  cogl_material_set_layer (material, 0, src_texture);

  return material;
}

/*****
 * Shadows
 *****/

static gdouble *
calculate_gaussian_kernel (float   sigma,
                           gint     n_values)
{
  gdouble *ret, sum;
  gdouble exp_divisor;
  gint half, i;

  g_return_val_if_fail (sigma > 0, NULL);

  half = n_values / 2;

  ret = g_malloc (n_values * sizeof (gdouble));
  sum = 0.0;

  exp_divisor = 2 * sigma * sigma;

  /* n_values of 1D Gauss function */
  for (i = 0; i < n_values; i++)
    {
      ret[i] = exp (-(i - half) * (i - half) / exp_divisor);
      sum += ret[i];
    }

  /* normalize */
  for (i = 0; i < n_values; i++)
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
  float   sigma;

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
      gint     x_in, y_in, x_out, y_out, i;

      n_values = (gint) 5 * sigma;
      half = n_values / 2;

      *width_out  = width_in  + 2 * half;
      *height_out = height_in + 2 * half;
      *rowstride_out = (*width_out + 3) & ~3;

      pixels_out = g_malloc0 (*rowstride_out * *height_out);
      line       = g_malloc0 (*rowstride_out);

      kernel = calculate_gaussian_kernel (sigma, n_values);

      /* vertical blur */
      for (x_in = 0; x_in < width_in; x_in++)
        for (y_out = 0; y_out < *height_out; y_out++)
          {
            guchar *pixel_in, *pixel_out;
            gint i0, i1;

            y_in = y_out - half;

            /* We read from the source at 'y = y_in + i - half'; clamp the
             * full i range [0, n_values) so that y is in [0, height_in).
             */
            i0 = MAX (half - y_in, 0);
            i1 = MIN (height_in + half - y_in, n_values);

            pixel_in  =  pixels_in + (y_in + i0 - half) * rowstride_in + x_in;
            pixel_out =  pixels_out + y_out * *rowstride_out + (x_in + half);

            for (i = i0; i < i1; i++)
              {
                *pixel_out += *pixel_in * kernel[i];
                pixel_in += rowstride_in;
              }
          }

      /* horizontal blur */
      for (y_out = 0; y_out < *height_out; y_out++)
        {
          memcpy (line, pixels_out + y_out * *rowstride_out, *rowstride_out);

          for (x_out = 0; x_out < *width_out; x_out++)
            {
              gint i0, i1;
              guchar *pixel_out, *pixel_in;

              /* We read from the source at 'x = x_out + i - half'; clamp the
               * full i range [0, n_values) so that x is in [0, width_out).
               */
              i0 = MAX (half - x_out, 0);
              i1 = MIN (*width_out + half - x_out, n_values);

              pixel_in  = line + x_out + i0 - half;
              pixel_out = pixels_out + *rowstride_out * y_out + x_out;

              *pixel_out = 0;
              for (i = i0; i < i1; i++)
                {
                  *pixel_out += *pixel_in * kernel[i];
                  pixel_in++;
                }
            }
        }
      g_free (kernel);
      g_free (line);
    }

  return pixels_out;
}

CoglHandle
_st_create_shadow_material (StShadow   *shadow_spec,
                            CoglHandle  src_texture)
{
  static CoglHandle shadow_material_template = COGL_INVALID_HANDLE;

  CoglHandle  material;
  CoglHandle  texture;
  guchar     *pixels_in, *pixels_out;
  gint        width_in, height_in, rowstride_in;
  gint        width_out, height_out, rowstride_out;

  g_return_val_if_fail (shadow_spec != NULL, COGL_INVALID_HANDLE);
  g_return_val_if_fail (src_texture != COGL_INVALID_HANDLE,
                        COGL_INVALID_HANDLE);

  width_in  = cogl_texture_get_width  (src_texture);
  height_in = cogl_texture_get_height (src_texture);
  rowstride_in = (width_in + 3) & ~3;

  pixels_in  = g_malloc0 (rowstride_in * height_in);

  cogl_texture_get_data (src_texture, COGL_PIXEL_FORMAT_A_8,
                         rowstride_in, pixels_in);

  pixels_out = blur_pixels (pixels_in, width_in, height_in, rowstride_in,
                            shadow_spec->blur,
                            &width_out, &height_out, &rowstride_out);
  g_free (pixels_in);

  texture = st_cogl_texture_new_from_data_wrapper (width_out, height_out,
                                                   COGL_TEXTURE_NONE,
                                                   COGL_PIXEL_FORMAT_A_8,
                                                   COGL_PIXEL_FORMAT_A_8,
                                                   rowstride_out,
                                                   pixels_out);

  g_free (pixels_out);

  if (G_UNLIKELY (shadow_material_template == COGL_INVALID_HANDLE))
    {
      shadow_material_template = cogl_material_new ();

      /* We set up the material to blend the shadow texture with the combine
       * constant, but defer setting the latter until painting, so that we can
       * take the actor's overall opacity into account. */
      cogl_material_set_layer_combine (shadow_material_template, 0,
                                       "RGBA = MODULATE (CONSTANT, TEXTURE[A])",
                                       NULL);
    }

  material = cogl_material_copy (shadow_material_template);

  cogl_material_set_layer (material, 0, texture);

  cogl_handle_unref (texture);

  return material;
}

CoglHandle
_st_create_shadow_material_from_actor (StShadow     *shadow_spec,
                                       ClutterActor *actor)
{
  CoglHandle shadow_material = COGL_INVALID_HANDLE;

  if (CLUTTER_IS_TEXTURE (actor))
    {
      CoglHandle texture;

      texture = clutter_texture_get_cogl_texture (CLUTTER_TEXTURE (actor));
      shadow_material = _st_create_shadow_material (shadow_spec, texture);
    }
  else
    {
      CoglHandle buffer, offscreen;
      ClutterActorBox box;
      CoglColor clear_color;
      float width, height;

      clutter_actor_get_allocation_box (actor, &box);
      clutter_actor_box_get_size (&box, &width, &height);

      if (width == 0 || height == 0)
        return COGL_INVALID_HANDLE;

      buffer = st_cogl_texture_new_with_size_wrapper (width, height,
                                                      COGL_TEXTURE_NO_SLICING,
                                                      COGL_PIXEL_FORMAT_ANY);

      if (buffer == COGL_INVALID_HANDLE)
        return COGL_INVALID_HANDLE;

      offscreen = cogl_offscreen_new_to_texture (buffer);

      if (offscreen == COGL_INVALID_HANDLE)
        {
          cogl_handle_unref (buffer);
          return COGL_INVALID_HANDLE;
        }

      cogl_color_set_from_4ub (&clear_color, 0, 0, 0, 0);
      cogl_push_framebuffer (offscreen);
      cogl_clear (&clear_color, COGL_BUFFER_BIT_COLOR);
      cogl_translate (-box.x1, -box.y1, 0);
      cogl_ortho (0, width, height, 0, 0, 1.0);
      clutter_actor_paint (actor);
      cogl_pop_framebuffer ();
      cogl_handle_unref (offscreen);

      shadow_material = _st_create_shadow_material (shadow_spec, buffer);

      cogl_handle_unref (buffer);
    }

  return shadow_material;
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
_st_create_shadow_cairo_pattern (StShadow        *shadow_spec,
                                 cairo_pattern_t *src_pattern)
{
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
  int i, j;

  g_return_val_if_fail (shadow_spec != NULL, NULL);
  g_return_val_if_fail (src_pattern != NULL, NULL);

  cairo_pattern_get_surface (src_pattern, &src_surface);

  width_in  = cairo_image_surface_get_width  (src_surface);
  height_in = cairo_image_surface_get_height (src_surface);

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
  cairo_surface_set_user_data (surface_out, &shadow_pattern_user_data,
                               pixels_out, (cairo_destroy_func_t) g_free);

  dst_pattern = cairo_pattern_create_for_surface (surface_out);
  cairo_surface_destroy (surface_out);

  cairo_pattern_get_matrix (src_pattern, &shadow_matrix);

  if (shadow_spec->inset)
    {
      /* For inset shadows, offsets and spread radius have already been
       * applied to the original pattern, so all left to do is shift the
       * blurred image left, so that it aligns centered under the
       * unblurred one
       */
      cairo_matrix_translate (&shadow_matrix,
                              (width_out - width_in) / 2.0,
                              (height_out - height_in) / 2.0);
      cairo_pattern_set_matrix (dst_pattern, &shadow_matrix);
      return dst_pattern;
    }

  /* Read all the code from the cairo_pattern_set_matrix call
   * at the end of this function to here from bottom to top,
   * because each new affine transformation is applied in
   * front of all the previous ones */

  /* 6. Invert the matrix back */
  cairo_matrix_invert (&shadow_matrix);

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

  /* 1. Invert the matrix so we can work with it in pattern space
   */
  cairo_matrix_invert (&shadow_matrix);

  cairo_pattern_set_matrix (dst_pattern, &shadow_matrix);

  return dst_pattern;
}

void
_st_paint_shadow_with_opacity (StShadow        *shadow_spec,
                               CoglHandle       shadow_material,
                               ClutterActorBox *box,
                               guint8           paint_opacity)
{
  ClutterActorBox shadow_box;
  CoglColor       color;

  g_return_if_fail (shadow_spec != NULL);
  g_return_if_fail (shadow_material != COGL_INVALID_HANDLE);

  st_shadow_get_box (shadow_spec, box, &shadow_box);

  cogl_color_set_from_4ub (&color,
                           shadow_spec->color.red   * paint_opacity / 255,
                           shadow_spec->color.green * paint_opacity / 255,
                           shadow_spec->color.blue  * paint_opacity / 255,
                           shadow_spec->color.alpha * paint_opacity / 255);
  cogl_color_premultiply (&color);

  cogl_material_set_layer_combine_constant (shadow_material, 0, &color);

  cogl_set_source (shadow_material);
  cogl_rectangle_with_texture_coords (shadow_box.x1, shadow_box.y1,
                                      shadow_box.x2, shadow_box.y2,
                                      0, 0, 1, 1);
}
