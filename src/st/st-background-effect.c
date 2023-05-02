#include "st-background-effect.h"
#include <gio/gio.h>
#include <math.h>

 /*
  * Blur effect declarations
  */

#define ST_BACKGROUND_BLUR_EFFECT_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_BACKGROUND_BLUR_EFFECT, StBackgroundBlurEffectClass))
#define ST_IS_BACKGROUND_BLUR_EFFECT_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_BACKGROUND_BLUR_EFFECT))
#define ST_BACKGROUND_BLUR_EFFECT_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_BACKGROUND_BLUR_EFFECT, StBackgroundBlurEffectClass))

G_DEFINE_TYPE (StBackgroundBlurEffect, st_background_blur_effect, CLUTTER_TYPE_OFFSCREEN_EFFECT);

static const gchar *box_blur_glsl_declarations =
  "uniform vec2 pixel_step;\n";
#define SAMPLE(offx, offy) \
  "cogl_texel += texture2D (cogl_sampler, cogl_tex_coord.st + pixel_step * " \
  "vec2 (" G_STRINGIFY (offx) ", " G_STRINGIFY (offy) ") * 2.0);\n"
static const gchar *box_blur_glsl_shader =
    "  cogl_texel = texture2D (cogl_sampler, cogl_tex_coord.st);\n"
    SAMPLE (-1.0, -1.0)
    SAMPLE ( 0.0, -1.0)
    SAMPLE (+1.0, -1.0)
    SAMPLE (-1.0,  0.0)
    SAMPLE ( 0.0,  0.0)
    SAMPLE (+1.0,  0.0)
    SAMPLE (-1.0, +1.0)
    SAMPLE ( 0.0, +1.0)
    SAMPLE (+1.0, +1.0)
    "  cogl_texel /= 10.0;\n";
#undef SAMPLE

/*
 * bumpmap effect declarations
 */

#define ST_BACKGROUND_BUMPMAP_EFFECT_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_BACKGROUND_BUMPMAP_EFFECT, StBackgroundBumpmapEffectClass))
#define ST_IS_BACKGROUND_BUMPMAP_EFFECT_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_BACKGROUND_BUMPMAP_EFFECT))
#define ST_BACKGROUND_BUMPMAP_EFFECT_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_BACKGROUND_BUMPMAP_EFFECT, StBackgroundBumpmapEffectClass))

G_DEFINE_TYPE (StBackgroundBumpmapEffect, st_background_bumpmap_effect, CLUTTER_TYPE_OFFSCREEN_EFFECT);

static const gchar *box_bumpmap_glsl_declarations =
  "uniform vec3 pixel_step;\n"
  "uniform vec2 bump_step;\n"
  "uniform sampler2D BumpTex;\n";
static const gchar *box_bumpmap_glsl_shader =
  "vec2 vTexCoord = cogl_tex_coord.st;\n"
  "vec4 displtex = vec4(0.0);\n"
  "if (pixel_step.z > 1.5) {\n"
  "  vec4 previous = texture2D(cogl_sampler, vec2(vTexCoord.x, vTexCoord.y));\n"
  "  if (previous.w > 0.004) {\n"
  "    displtex += texture2D(cogl_sampler, vec2(vTexCoord.x - pixel_step.x, vTexCoord.y - pixel_step.y));\n"
  "    displtex -= previous;\n"
  "  }\n"
  "  cogl_texel = displtex;\n"
  "} else if (pixel_step.z > 0.5) {\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x - pixel_step.x, vTexCoord.y + pixel_step.y));\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x, vTexCoord.y + pixel_step.y)) * 2.0;\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x + pixel_step.x, vTexCoord.y + pixel_step.y));\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x - pixel_step.x, vTexCoord.y)) * 2.0;\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x, vTexCoord.y)) * 4.0;\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x + pixel_step.x, vTexCoord.y)) * 2.0;\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x - pixel_step.x, vTexCoord.y - pixel_step.y));\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x, vTexCoord.y - pixel_step.y)) * 2.0;\n"
  "  displtex += texture2D(cogl_sampler, vec2(vTexCoord.x + pixel_step.x, vTexCoord.y - pixel_step.y));\n"
  "  cogl_texel = displtex / 16.0;\n"
  "} else {\n"
  "  float factx = bump_step.x / pixel_step.x;\n"
  "  float facty = bump_step.y / pixel_step.y;\n"
  "  vec4 bump = texture2D(BumpTex, vec2(vTexCoord.x * factx, vTexCoord.y * facty));\n"
  "  float displx = (bump.r - 0.5) * pixel_step.x * 256.0;\n"
  "  float disply = (bump.g - 0.5) * pixel_step.y * 256.0;\n"
  "  displtex = texture2D(cogl_sampler, vec2(vTexCoord.x + displx, vTexCoord.y + disply)) * bump.b;\n"
  "  cogl_texel =  displtex;\n"
  "}\n";

static CoglTexture *
mask_out_corners (int rad1, int rad2, int rad3, int rad4,
                  CoglFramebuffer *fb,
                  const ClutterActorBox *box,
                  guint8 paint_opacity);

/**
 * st_paint_background_blur_effect:
 * @self: Source #StBackgroundBlurEffect
 * @fb: a #CoglFramebuffer
 * @box: a #ClutterActorBox
 *
 * paints a blur effect by snapshotting the screen and processing it
 *
 * Return value: %TRUE if successful
 */
gboolean
st_paint_background_blur_effect (StBackgroundBlurEffect *self,
                                 CoglFramebuffer *fb,
                                 const ClutterActorBox *box)
{
  gfloat tx, ty;

  clutter_actor_get_transformed_position (self->actor, &tx, &ty);

  self->bg_width = ceil(box->x2 - box->x1);
  self->bg_height = ceil(box->y2 - box->y1);
  self->bg_posx = ceil(tx);
  self->bg_posy = ceil(ty);

  if (!clutter_feature_available (CLUTTER_FEATURE_SHADERS_GLSL))
    {
      g_message ("Unable to use the ShaderEffect: the graphics hardware "
                 "or the current GL driver does not implement support "
                 "for the GLSL shading language.");
      return FALSE;
    }

    for (int i = 0; i < self->blur_size; i++)  /* process more blur as multiple repetitions */
    {
      uint8_t *data;
      guint size;
      guint rowstride;
      /* read and stash the section of background currently displayed under the actor */

      size = (self->bg_width) * (self->bg_height) * 4;

      if (size <= 0)
          return FALSE;

      rowstride = self->bg_width * 4;
      data = g_malloc (size);

      cogl_framebuffer_read_pixels (fb, self->bg_posx,
                            self->bg_posy,
                            self->bg_width,
                            self->bg_height,
                            COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                            data);
      if (data != NULL)
        {
          if (self->bg_texture != NULL)
            {
                cogl_object_unref (self->bg_texture);
                self->bg_texture = NULL;
            }

          self->bg_texture = cogl_texture_new_from_data (self->bg_width,
                                                         self->bg_height,
                                                         COGL_TEXTURE_NO_SLICING,
                                                         COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                         COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                         rowstride,
                                                         data);

          g_free (data);
        }

      if (self->bg_texture == NULL)
        {
          g_message("unable to create background texture");
          return FALSE;
        }

      if (self->pixel_step_uniform > -1)
        {
          gfloat pixel_step[2];

          pixel_step[0] = 1.0f / (self->bg_width);
          pixel_step[1] = 1.0f / (self->bg_height);

          cogl_pipeline_set_uniform_float (self->pipeline1,
                                           self->pixel_step_uniform,
                                           2,
                                           1,
                                           pixel_step);
        }


    /* if this theme node has radiused corners then mask them out
       as otherwise the efect will be square and show outside the actor
       note that the default blend is fine.  We should only need to do this
       once as the mask will be fine for repeat use */

    if (self->border_radius [0] > 0
        || self->border_radius [1] > 0
        || self->border_radius [2] > 0
        || self->border_radius [3] > 0)
      {
        if (self->corner_texture == NULL)
            self->corner_texture = mask_out_corners (self->border_radius[0],
                                                     self->border_radius[1],
                                                     self->border_radius[2],
                                                     self->border_radius[3],
                                                     fb,
                                                     box,
                                                     0);
        cogl_pipeline_set_layer_texture (self->pipeline1, 1, self->corner_texture);
      }

      cogl_pipeline_set_layer_texture (self->pipeline1, 0, self->bg_texture);

      cogl_framebuffer_draw_rectangle (fb, self->pipeline1, 0, 0, self->bg_width,self->bg_height);
    }

    return TRUE;
}

static void
st_background_blur_effect_paint_target (ClutterOffscreenEffect *effect, ClutterPaintContext *paint_context)
{
  return;
}

static void
st_background_blur_effect_dispose (GObject *gobject)
{
  StBackgroundBlurEffect *self = ST_BACKGROUND_BLUR_EFFECT (gobject);

  if (self->pipeline1 != NULL)
    {
      cogl_object_unref (self->pipeline1);
      self->pipeline1 = NULL;
    }

  if (self->bg_texture != NULL)
    {
      cogl_object_unref (self->bg_texture);
      self->bg_texture = NULL;
    }

  if (self->corner_texture != NULL)
    {
      cogl_object_unref (self->corner_texture);
      self->corner_texture = NULL;
    }

  G_OBJECT_CLASS (st_background_blur_effect_parent_class)->dispose (gobject);
}

static void
st_background_blur_effect_class_init (StBackgroundBlurEffectClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterOffscreenEffectClass *offscreen_class;

  gobject_class->dispose = st_background_blur_effect_dispose;

  offscreen_class = CLUTTER_OFFSCREEN_EFFECT_CLASS (klass);
  offscreen_class->paint_target = st_background_blur_effect_paint_target;
}

static void
st_background_blur_effect_init (StBackgroundBlurEffect *self)
{
  CoglContext *ctx;
  CoglSnippet *snippet;
  StBackgroundBlurEffectClass *klass = ST_BACKGROUND_BLUR_EFFECT_GET_CLASS (self);

  if (G_UNLIKELY (klass->base_pipeline == NULL))
    {
      ctx = clutter_backend_get_cogl_context (clutter_get_default_backend ());
      klass->base_pipeline = cogl_pipeline_new (ctx);
    }

  self->pipeline1 = cogl_pipeline_copy (klass->base_pipeline);

  snippet = cogl_snippet_new (COGL_SNIPPET_HOOK_TEXTURE_LOOKUP,
                              box_blur_glsl_declarations,
                              NULL);

  cogl_snippet_set_replace (snippet, box_blur_glsl_shader);
  cogl_pipeline_add_layer_snippet (self->pipeline1, 0, snippet);
  cogl_object_unref (snippet);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline1, 0,
                                     COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

  self->pixel_step_uniform =
      cogl_pipeline_get_uniform_location (self->pipeline1, "pixel_step");

  self->bg_texture = NULL;
  self->corner_texture = NULL;
}

ClutterEffect *
st_background_blur_effect_new (ClutterActor *actor)
{
  StBackgroundBlurEffect *effect = g_object_new (ST_TYPE_BACKGROUND_BLUR_EFFECT, NULL);
  effect->actor = actor;

  return CLUTTER_EFFECT (effect);
}

static void
st_background_bumpmap_effect_paint_target (ClutterOffscreenEffect *effect, ClutterPaintContext *paint_context)
{
  return;
}
/**
 * st_paint_background_bumpmap_effect:
 * @self: Source #StBackgroundBumpmapEffect
 * @fb: a #CoglFramebuffer
 * @box: a #ClutterActorBox
 *
 * paints a bumpmap effect by snapshotting the screen and processing it
 *
 * Return value: %TRUE if successful
 */
gboolean
st_paint_background_bumpmap_effect (StBackgroundBumpmapEffect *self,
                                    CoglFramebuffer *fb,
                                    const ClutterActorBox *box)
{
  GFile *file;
  uint8_t *data;
  guint size;
  guint rowstride;
  gfloat tx, ty;

  clutter_actor_get_transformed_position (self->actor, &tx, &ty);

  self->bg_width = ceil(box->x2 - box->x1);
  self->bg_height = ceil(box->y2 - box->y1);
  self->bg_posx = ceil(tx);
  self->bg_posy = ceil(ty);

  if (!clutter_feature_available (CLUTTER_FEATURE_SHADERS_GLSL))
    {
      g_message ("Unable to use the ShaderEffect: the graphics hardware "
                 "or the current GL driver does not implement support "
                 "for the GLSL shading language.");

      return FALSE;
    }

  if (self->bumpmap_path == NULL)
    {
      g_message("bumpmap_path unexpectedly null");
      return FALSE;
    }

    /* the bumpmap effect is created without the bumpmap loaded
       so if this is the first time through we need to read the bumpmap in */

  if (self->bg_bumpmap == NULL )
    {
      file = g_file_new_for_path (self->bumpmap_path);
      if (g_file_query_exists (file, NULL))
        {
          self->bg_bumpmap = cogl_texture_new_from_file (self->bumpmap_path,
                                                         COGL_TEXTURE_NO_SLICING,
                                                         COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                         NULL);
        }

      g_object_unref (file);

      if (self->bg_bumpmap != NULL)
        {
          self->bumptex_width = cogl_texture_get_width (self->bg_bumpmap);
          self->bumptex_height = cogl_texture_get_height (self->bg_bumpmap);

          cogl_pipeline_set_layer_texture (self->pipeline0, 1, self->bg_bumpmap);
        }
      else
        {
          cogl_pipeline_set_layer_null_texture (self->pipeline0, 1);
        }
    }

    /* read and stash the section of background currently displayed under the actor */

    size = (self->bg_width) * (self->bg_height) * 4;

    if (size <= 0)
      {
        g_message("Negative size background encountered");
        return FALSE;
      }

    rowstride = self->bg_width * 4;
    data = g_malloc (size);

    cogl_framebuffer_read_pixels (fb, self->bg_posx,
                          self->bg_posy,
                          self->bg_width,
                          self->bg_height,
                          COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                          data);
    if (data != NULL)
      {
        if (self->bg_texture != NULL)
          {
            cogl_object_unref (self->bg_texture);
            self->bg_texture = NULL;
          }

        self->bg_texture = cogl_texture_new_from_data (self->bg_width,
                                                                  self->bg_height,
                                                                  COGL_TEXTURE_NO_SLICING,
                                                                  COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                                  COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                                  rowstride,
                                                                  data);
        g_free (data);
      }

    if (self->bg_texture == NULL)
      {
        g_message("unable to create background texture");
        return FALSE;
      }

    /* set uniforms i.e. the parameters into the GLSL code */

    if (self->pixel_step_uniform0 > -1)
      {
        gfloat pixel_step[3];

        pixel_step[0] = 1.0f / (self->bg_width);
        pixel_step[1] = 1.0f / (self->bg_height);
        pixel_step[2] = 0.0f;

        cogl_pipeline_set_uniform_float (self->pipeline0,
                                         self->pixel_step_uniform0,
                                         3,
                                         1,
                                         pixel_step);
      }

    if (self->BumpTex_uniform > -1)
      {
        cogl_pipeline_set_uniform_1i (self->pipeline0,
                                      self->BumpTex_uniform,
                                      1);
      }

    if (self->bump_step_uniform > -1)
      {
        gfloat bump_step[2];

        bump_step[0] = 1.0f / (self->bumptex_width);
        bump_step[1] = 1.0f / (self->bumptex_height);

        cogl_pipeline_set_uniform_float (self->pipeline0,
                                         self->bump_step_uniform,
                                         2,
                                         1,
                                         bump_step);
      }

    cogl_pipeline_set_layer_texture (self->pipeline0, 0, self->bg_texture);

    /* if this theme node has radiused corners then mask them out
       as otherwise the efect will be square and show outside the actor
       note that the default blend is fine.  We should only need to do this
       once as the mask will be fine for repeat use */

    if (self->border_radius [0] > 0
        || self->border_radius [1] > 0
        || self->border_radius [2] > 0
        || self->border_radius [3] > 0)
      {
        if (self->corner_texture == NULL)
            self->corner_texture = mask_out_corners (self->border_radius[0],
                                                     self->border_radius[1],
                                                     self->border_radius[2],
                                                     self->border_radius[3],
                                                     fb,
                                                     box,
                                                     0);
        cogl_pipeline_set_layer_texture (self->pipeline0, 2, self->corner_texture);
      }

    cogl_framebuffer_draw_rectangle (fb, self->pipeline0, 0, 0, self->bg_width,self->bg_height);

    return TRUE;
}

static void
st_background_bumpmap_effect_dispose (GObject *gobject)
{
  StBackgroundBumpmapEffect *self = ST_BACKGROUND_BUMPMAP_EFFECT (gobject);

  if (self->pipeline0 != NULL)
    {
      cogl_object_unref (self->pipeline0);
      self->pipeline0 = NULL;
    }

  if (self->bg_texture != NULL)
    {
      cogl_object_unref (self->bg_texture);
      self->bg_texture = NULL;
    }

  if (self->bg_bumpmap != NULL)
    {
      cogl_object_unref (self->bg_bumpmap);
      self->bg_bumpmap = NULL;
    }
    
  if (self->corner_texture != NULL)
    {
      cogl_object_unref (self->corner_texture);
      self->corner_texture = NULL;
    }

  G_OBJECT_CLASS (st_background_bumpmap_effect_parent_class)->dispose (gobject);
}

static void
st_background_bumpmap_effect_class_init (StBackgroundBumpmapEffectClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterOffscreenEffectClass *offscreen_class;

  gobject_class->dispose = st_background_bumpmap_effect_dispose;

  offscreen_class = CLUTTER_OFFSCREEN_EFFECT_CLASS (klass);
  offscreen_class->paint_target = st_background_bumpmap_effect_paint_target;
}

static void
st_background_bumpmap_effect_init (StBackgroundBumpmapEffect *self)
{
  CoglContext *ctx;
  CoglSnippet *snippet;
  StBackgroundBumpmapEffectClass *klass = ST_BACKGROUND_BUMPMAP_EFFECT_GET_CLASS (self);

  if (G_UNLIKELY (klass->base_pipeline == NULL))
    {
      ctx = clutter_backend_get_cogl_context (clutter_get_default_backend ());
      klass->base_pipeline = cogl_pipeline_new (ctx);
    }

  self->pipeline0 = cogl_pipeline_copy (klass->base_pipeline);

  snippet = cogl_snippet_new (COGL_SNIPPET_HOOK_TEXTURE_LOOKUP,
                              box_bumpmap_glsl_declarations,
                              NULL);

  cogl_snippet_set_replace (snippet, box_bumpmap_glsl_shader);
  cogl_pipeline_add_layer_snippet (self->pipeline0, 0, snippet);
  cogl_object_unref (snippet);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline0,
                                     0,
                                     COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

  /* we need the bumpamp to be able to repeat over the effect area */
  cogl_pipeline_set_layer_wrap_mode (self->pipeline0,
                                     1,
                                     COGL_PIPELINE_WRAP_MODE_REPEAT);

  cogl_pipeline_set_layer_null_texture (self->pipeline0, 0);

  self->pixel_step_uniform0 =
    cogl_pipeline_get_uniform_location (self->pipeline0, "pixel_step");

  self->BumpTex_uniform =
    cogl_pipeline_get_uniform_location (self->pipeline0, "BumpTex");

  self->bump_step_uniform =
    cogl_pipeline_get_uniform_location (self->pipeline0, "bump_step");

  self->bg_texture = NULL;
  self->bg_bumpmap = NULL;
  self->corner_texture = NULL;

  /* note that as we are only working with one layer we don't care about a blend string
     however we do have to suppress the original bumpmap image layer from displaying
     over the top, just replace it with the previous layer */

  cogl_pipeline_set_layer_combine (self->pipeline0,
                                   1,
                                   "RGBA = REPLACE (PREVIOUS)",
                                   NULL);
}

ClutterEffect *
st_background_bumpmap_effect_new (ClutterActor *actor)
{
  StBackgroundBumpmapEffect *effect = g_object_new (ST_TYPE_BACKGROUND_BUMPMAP_EFFECT, NULL);
  effect->actor = actor;

  return CLUTTER_EFFECT (effect);
}

/*
 *  Common code for effects
 */
static CoglTexture *
mask_out_corners (int border_rad1,
                  int border_rad2,
                  int border_rad3,
                  int border_rad4,
                  CoglFramebuffer *fb,
                  const ClutterActorBox *box,
                  guint8 paint_opacity)
{
  gint bg_width, bg_height;

  CoglTexture *texture;
  cairo_t *cr;
  cairo_surface_t *surface;
  guint rowstride;
  guint8 *data;

  bg_width = ceil(box->x2 - box->x1);
  bg_height = ceil(box->y2 - box->y1);

  rowstride = cairo_format_stride_for_width (CAIRO_FORMAT_ARGB32,bg_width);

  data = g_try_new0 (guint8, rowstride*bg_height);

  if (!data) return NULL;

  surface = cairo_image_surface_create_for_data (data,
                                                 CAIRO_FORMAT_ARGB32,
                                                 bg_width,
                                                 bg_height,
                                                 rowstride);

  cr = cairo_create (surface);
  cairo_set_operator (cr, CAIRO_OPERATOR_SOURCE); // replace destination layer

  cairo_set_source_rgba (cr, 0.0, 1.0, 0.0,0.0);
  cairo_rectangle (cr, 0.0, 0.0, bg_width, bg_height);
  cairo_fill (cr);

  cairo_set_source_rgba (cr,
                         1.0,
                         1.0,
                         1.0,
                         1.0);

  cairo_arc (cr,
             border_rad1,
             border_rad1,
             border_rad1,
             M_PI,
             3 * M_PI / 2);
  cairo_line_to (cr,
                 bg_width - border_rad1,
                 0.0);
  cairo_arc (cr,
             bg_width - border_rad1,
             border_rad1,
             border_rad1,
             3 * M_PI / 2,
             2 * M_PI);
  cairo_line_to (cr,
                 bg_width,
                 bg_height - border_rad1);
  cairo_arc (cr,
             bg_width - border_rad1,
             bg_height - border_rad1,
             border_rad1,
             0,
             M_PI / 2);
  cairo_line_to (cr,
                 border_rad1,
                 bg_height);
  cairo_arc (cr,
             border_rad1,
             bg_height - border_rad1,
             border_rad1,
             M_PI / 2,
             M_PI);
  cairo_line_to (cr,
                 0,
                 border_rad1);
  cairo_fill (cr);  /* end result is a rectangle with rounded corners */

  cairo_destroy (cr);

  cairo_surface_destroy (surface);

  texture = cogl_texture_new_from_data (bg_width,
                                        bg_height,
                                        COGL_TEXTURE_NO_SLICING, // disable slicing
                                        CLUTTER_CAIRO_FORMAT_ARGB32,  // (COGL_PIXEL_FORMAT_BGRA_8888_PRE)
                                        COGL_PIXEL_FORMAT_RGBA_8888_PRE, // premultiplied 32 bit RGBA
                                        rowstride,
                                        data);

  g_free (data);

  return texture;
}
