#include "st-background-effect.h"
#include "st-cogl-wrapper.h"
#define ST_BACKGROUND_EFFECT_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_BACKGROUND_EFFECT, StBackgroundEffectClass))
#define ST_IS_BACKGROUND_EFFECT_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_BACKGROUND_EFFECT))
#define ST_BACKGROUND_EFFECT_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_BACKGROUND_EFFECT, StBackgroundEffectClass))

G_DEFINE_TYPE (StBackgroundEffect, st_background_effect, CLUTTER_TYPE_OFFSCREEN_EFFECT);

#include <gio/gio.h>
#include <math.h>

enum
{
  PROP_0,

  PROP_BUMPMAP,

  PROP_LAST
};

static GParamSpec *obj_props[PROP_LAST];

static const gchar *box_blur_glsl_declarations =
  "uniform vec3 pixel_step;\n"
  "uniform vec2 bump_step;\n"
  "uniform sampler2D BumpTex;\n";
static const gchar *box_blur_glsl_shader =
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

static gboolean
st_background_effect_pre_paint (ClutterEffect *effect)
{
  StBackgroundEffect *self = ST_BACKGROUND_EFFECT (effect);
  ClutterEffectClass *parent_class;
  gfloat width;
  gfloat height;
  gfloat posx;
  gfloat posy;
  guchar *data;
  guint size;
  guint rowstride;
  glong new_time;
  gdouble time_used;
  ClutterActor *stage;
  gfloat stage_width;
  gfloat stage_height;

  if (self->bg_bumpmap == NULL)
    return FALSE;

  if (!clutter_actor_meta_get_enabled (CLUTTER_ACTOR_META (effect)))
    return FALSE;

  self->actor = clutter_actor_meta_get_actor (CLUTTER_ACTOR_META (effect));
  if (self->actor == NULL)
    return FALSE;

  if (!clutter_feature_available (CLUTTER_FEATURE_SHADERS_GLSL))
  {
    /* if we don't have support for GLSL shaders then we
     * forcibly disable the ActorMeta
     */
    g_warning ("Unable to use the ShaderEffect: the graphics hardware "
           "or the current GL driver does not implement support "
           "for the GLSL shading language.");
    clutter_actor_meta_set_enabled (CLUTTER_ACTOR_META (effect), FALSE);
    return FALSE;
  }

  new_time = clock();
  time_used = ((double) (new_time - self->old_time)*100) / (double) CLOCKS_PER_SEC;
  self->old_time = new_time;

  posx = 0.0f;
  posy = 0.0f;

  width = 0.0f;
  height = 0.0f;

  stage_width = 0.0f;
  stage_height = 0.0f;

  clutter_actor_get_transformed_position (self->actor, &posx, &posy);
  clutter_actor_get_transformed_size (self->actor, &width, &height);
  self->opacity = clutter_actor_get_paint_opacity (self->actor);
  stage = clutter_actor_get_stage (self->actor);
  clutter_actor_get_size (stage, &stage_width, &stage_height);

  if ((posx < 0) || (posy < 0) || ((posx + width) > stage_width) || ((posy + height) > stage_height))
    return FALSE;

  if  (( posx != self->posx_old)
       || ( posy != self->posy_old)
       || ( width != self->width_old)
       || ( height != self->height_old)
       || (time_used > 50.0))

  {
    self->posx_old = posx;
    self->posy_old = posy;
    self->width_old = width;
    self->height_old = height;

    self->bg_posx_i = round(posx)+2;
    self->bg_posy_i = round(posy)+2;
    self->bg_width_i = round(width)-4;
    self->bg_height_i = round(height)-4;

    size = (self->bg_width_i) * (self->bg_height_i) * 4;

    if (((self->opacity == 0xff) || (self->bg_texture == NULL)) && (size > 400))
      {
        rowstride = (self->bg_width_i) * 4;


        data = g_malloc (size);

        cogl_read_pixels (self->bg_posx_i,
                          self->bg_posy_i,
                          self->bg_width_i,
                          self->bg_height_i,
                          COGL_READ_PIXELS_COLOR_BUFFER,
                          COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                          data);

        if (data != NULL)
          {

            if (self->bg_texture != NULL)
              {
                cogl_handle_unref (self->bg_texture);
                self->bg_texture = NULL;
              }

            self->bg_texture = st_cogl_texture_new_from_data_wrapper  (self->bg_width_i,
                                                                       self->bg_height_i,
                                                                       COGL_TEXTURE_NO_SLICING,
                                                                       COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                                       COGL_PIXEL_FORMAT_RGBA_8888_PRE,
                                                                       rowstride,
                                                                       data);

            g_free (data);

          }
      }
  }

  parent_class = CLUTTER_EFFECT_CLASS (st_background_effect_parent_class);

  if (parent_class->pre_paint (effect))
    {
      ClutterOffscreenEffect *offscreen_effect =  CLUTTER_OFFSCREEN_EFFECT (effect);
      CoglHandle fg_texture;

      fg_texture = clutter_offscreen_effect_get_texture (offscreen_effect);

      if (fg_texture != COGL_INVALID_HANDLE)
        {
          self->fg_width_i = cogl_texture_get_width (fg_texture);
          self->fg_height_i = cogl_texture_get_height (fg_texture);

          if ((self->bg_texture != NULL) && (self->opacity == 0xff))
            {


              if (self->pixel_step_uniform0 > -1)
                {
                  gfloat pixel_step[3];

                  pixel_step[0] = 1.0f / (self->bg_width_i);
                  pixel_step[1] = 1.0f / (self->bg_height_i);
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

                  bump_step[0] = 1.0f / (self->bumptex_width_i);
                  bump_step[1] = 1.0f / (self->bumptex_height_i);

                  cogl_pipeline_set_uniform_float (self->pipeline0,
                                                   self->bump_step_uniform,
                                                   2,
                                                   1,
                                                   bump_step);
                }

              if (self->bg_sub_texture != NULL)
                {
                  cogl_handle_unref (self->bg_sub_texture);
                  self->bg_sub_texture = NULL;
                }

              self->bg_sub_texture = st_cogl_texture_new_with_size_wrapper (self->bg_width_i, self->bg_height_i,
                                                                            COGL_TEXTURE_NO_SLICING,
                                                                            COGL_PIXEL_FORMAT_RGBA_8888_PRE);

              cogl_pipeline_set_layer_texture (self->pipeline0, 0, self->bg_texture);

              if (self->pixel_step_uniform1 > -1)
                {
                  gfloat pixel_step[3];

                  pixel_step[0] = 1.0f / (self->bg_width_i);
                  pixel_step[1] = 1.0f / (self->bg_height_i);
                  pixel_step[2] = 1.0f;

                  cogl_pipeline_set_uniform_float (self->pipeline1,
                                                   self->pixel_step_uniform1,
                                                   3,
                                                   1,
                                                   pixel_step);
                }

              if (self->pixel_step_uniform2 > -1)
                {
                  gfloat pixel_step[3];

                  pixel_step[0] = 1.0f / (self->fg_width_i);
                  pixel_step[1] = 1.0f / (self->fg_height_i);
                  pixel_step[2] = 2.0f;

                  cogl_pipeline_set_uniform_float (self->pipeline3,
                                                   self->pixel_step_uniform2,
                                                   3,
                                                   1,
                                                   pixel_step);
                }

            }

          cogl_pipeline_set_layer_texture (self->pipeline2, 0, fg_texture);
          cogl_pipeline_set_layer_texture (self->pipeline3, 0, fg_texture);
          cogl_pipeline_set_layer_texture (self->pipeline4, 0, fg_texture);

        }
      return TRUE;
    }
  else
    {
      return FALSE;
    }
}

static void
st_background_effect_paint_target (ClutterOffscreenEffect *effect)
{
  StBackgroundEffect *self = ST_BACKGROUND_EFFECT (effect);

  if ((self->bg_texture != NULL) && (self->opacity == 0xff))
    {
      CoglOffscreen *vertical_FBO;
      cogl_push_source (self->pipeline2);
      cogl_rectangle (0.0f, 0.0f, (self->fg_width_i), (self->fg_height_i));
      cogl_pop_source ();

      vertical_FBO = cogl_offscreen_new_to_texture (self->bg_sub_texture);
      cogl_push_framebuffer ((CoglFramebuffer*)vertical_FBO);
      cogl_push_source (self->pipeline0);
      cogl_rectangle (-1.0f, 1.0f, 1.0f, -1.0f);
      cogl_pop_source ();
      cogl_pop_framebuffer ();
      cogl_handle_unref (vertical_FBO);

      cogl_pipeline_set_layer_texture (self->pipeline1, 0, self->bg_sub_texture);
      cogl_push_source (self->pipeline1);
      cogl_rectangle (4.0f, 4.0f, (self->bg_width_i) + 4.0f,
                      (self->bg_height_i) + 4.0f);
      cogl_pop_source ();

    }

  cogl_pipeline_set_color4ub (self->pipeline3,
                              0x00,
                              0x00,
                              0x00,
                              0x80);

  cogl_push_source (self->pipeline3);
  cogl_rectangle (0.0f, 0.0f, (self->fg_width_i), (self->fg_height_i));
  cogl_pop_source ();

  clutter_actor_queue_redraw (self->actor);

  cogl_pipeline_set_color4ub (self->pipeline4,
                              self->opacity,
                              self->opacity,
                              self->opacity,
                              self->opacity);

  cogl_push_source (self->pipeline4);
  cogl_rectangle (0.0f, 0.0f, (self->fg_width_i), (self->fg_height_i));
  cogl_pop_source ();

  clutter_actor_queue_redraw (self->actor);

}

static void
st_background_effect_dispose (GObject *gobject)
{
  StBackgroundEffect *self = ST_BACKGROUND_EFFECT (gobject);

  if (self->pipeline0 != NULL)
    {
      cogl_object_unref (self->pipeline0);
      self->pipeline0 = NULL;
    }

  if (self->pipeline1 != NULL)
    {
      cogl_object_unref (self->pipeline1);
      self->pipeline1 = NULL;
    }

  if (self->pipeline2 != NULL)
    {
      cogl_object_unref (self->pipeline2);
      self->pipeline2 = NULL;
    }

  if (self->pipeline3 != NULL)
    {
      cogl_object_unref (self->pipeline3);
      self->pipeline3 = NULL;
    }

  if (self->pipeline4 != NULL)
    {
      cogl_object_unref (self->pipeline4);
      self->pipeline4 = NULL;
    }

  if (self->bg_texture != NULL)
    {
      cogl_handle_unref (self->bg_texture);
      self->bg_texture = NULL;
    }

  if (self->bg_sub_texture != NULL)
    {
      cogl_handle_unref (self->bg_sub_texture);
      self->bg_sub_texture = NULL;
    }

  if (self->bg_bumpmap != NULL)
    {
      cogl_handle_unref (self->bg_bumpmap);
      self->bg_bumpmap = NULL;
    }

  G_OBJECT_CLASS (st_background_effect_parent_class)->dispose (gobject);
}

static void
st_background_effect_set_property (GObject      *gobject,
                                   guint         prop_id,
                                   const GValue *value,
                                   GParamSpec   *pspec)
{
  StBackgroundEffect *self = ST_BACKGROUND_EFFECT (gobject);
  GFile *file;

  switch (prop_id)
    {
    case PROP_BUMPMAP:

      self->bumpmap_location = g_value_dup_string (value);

      if (self->bg_bumpmap != NULL)
        {
          cogl_handle_unref (self->bg_bumpmap);
          self->bg_bumpmap = NULL;
        }

      if (self->bumpmap_location == NULL)
        {
          break;
        }

      file = g_file_new_for_path (g_strdup (self->bumpmap_location));
      if (g_file_query_exists (file, NULL))
        {
          self->bg_bumpmap = st_cogl_texture_new_from_file_wrapper (self->bumpmap_location,
                                                                    COGL_TEXTURE_NO_SLICING,
                                                                    COGL_PIXEL_FORMAT_RGBA_8888_PRE);
        }

      g_object_unref (file);

      if (self->bg_bumpmap != NULL)
        {
          self->bumptex_width_i = cogl_texture_get_width (self->bg_bumpmap);
          self->bumptex_height_i = cogl_texture_get_height (self->bg_bumpmap);

          cogl_pipeline_set_layer_texture (self->pipeline0, 1, self->bg_bumpmap);
        }
      else
        {
          cogl_pipeline_set_layer_null_texture (self->pipeline0,
                                                1,
                                                COGL_TEXTURE_TYPE_2D);
        }

      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_background_effect_get_property (GObject    *gobject,
                                   guint       prop_id,
                                   GValue     *value,
                                   GParamSpec *pspec)
{
  StBackgroundEffect *self = ST_BACKGROUND_EFFECT (gobject);

  switch (prop_id)
    {
    case PROP_BUMPMAP:
      g_value_set_string (value, self->bumpmap_location);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_background_effect_class_init (StBackgroundEffectClass *klass)
{
  ClutterEffectClass *effect_class = CLUTTER_EFFECT_CLASS (klass);
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterOffscreenEffectClass *offscreen_class;

  effect_class->pre_paint = st_background_effect_pre_paint;
  gobject_class->set_property = st_background_effect_set_property;
  gobject_class->get_property = st_background_effect_get_property;
  gobject_class->dispose = st_background_effect_dispose;
  
  offscreen_class = CLUTTER_OFFSCREEN_EFFECT_CLASS (klass);
  offscreen_class->paint_target = st_background_effect_paint_target;

  obj_props[PROP_BUMPMAP] =
    g_param_spec_string ("bumpmap",
                         "Background effect construct prop",
                         "Set bumpmap path",
                         "/usr/share/cinnamon/bumpmaps/bumpmap.png",
                         G_PARAM_READWRITE);

  g_object_class_install_properties (gobject_class, PROP_LAST, obj_props);
}

static void
st_background_effect_init (StBackgroundEffect *self)
{
  CoglContext *ctx;
  CoglSnippet *snippet;
  StBackgroundEffectClass *klass = ST_BACKGROUND_EFFECT_GET_CLASS (self);

  if (G_UNLIKELY (klass->base_pipeline == NULL))
    {
      ctx = clutter_backend_get_cogl_context (clutter_get_default_backend ());

      klass->base_pipeline = cogl_pipeline_new (ctx);
    }
    
  self->pipeline0 = cogl_pipeline_copy (klass->base_pipeline);
  self->pipeline1 = cogl_pipeline_copy (klass->base_pipeline);
  self->pipeline2 = cogl_pipeline_copy (klass->base_pipeline);
  self->pipeline3 = cogl_pipeline_copy (klass->base_pipeline);
  self->pipeline4 = cogl_pipeline_copy (klass->base_pipeline);

  snippet = cogl_snippet_new (COGL_SNIPPET_HOOK_TEXTURE_LOOKUP,
                              box_blur_glsl_declarations,
                              NULL);

  cogl_snippet_set_replace (snippet, box_blur_glsl_shader);
  cogl_pipeline_add_layer_snippet (self->pipeline0, 0, snippet);
  cogl_pipeline_add_layer_snippet (self->pipeline1, 0, snippet);
  cogl_pipeline_add_layer_snippet (self->pipeline3, 0, snippet);
  cogl_object_unref (snippet);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline0, 0,
                                     COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline0, 1,
                                     COGL_PIPELINE_WRAP_MODE_REPEAT);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline1, 0,
                                     COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline2, 0,
                                     COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline3, 0,
                                     COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

  cogl_pipeline_set_layer_wrap_mode (self->pipeline4, 0,
                                     COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

  cogl_pipeline_set_cull_face_mode (self->pipeline0,
                                    COGL_PIPELINE_CULL_FACE_MODE_NONE);

  cogl_pipeline_set_cull_face_mode (self->pipeline1,
                                    COGL_PIPELINE_CULL_FACE_MODE_NONE);

  cogl_pipeline_set_cull_face_mode (self->pipeline2,
                                    COGL_PIPELINE_CULL_FACE_MODE_NONE);

  cogl_pipeline_set_cull_face_mode (self->pipeline3,
                                    COGL_PIPELINE_CULL_FACE_MODE_NONE);

  cogl_pipeline_set_cull_face_mode (self->pipeline4,
                                    COGL_PIPELINE_CULL_FACE_MODE_NONE);

  cogl_pipeline_set_layer_filters (self->pipeline0, 0,
                                   COGL_PIPELINE_FILTER_LINEAR,
                                   COGL_PIPELINE_FILTER_LINEAR);

  cogl_pipeline_set_layer_filters (self->pipeline0, 1,
                                   COGL_PIPELINE_FILTER_NEAREST,
                                   COGL_PIPELINE_FILTER_NEAREST);

  cogl_pipeline_set_layer_filters (self->pipeline1, 0,
                                   COGL_PIPELINE_FILTER_LINEAR,
                                   COGL_PIPELINE_FILTER_LINEAR);

  cogl_pipeline_set_layer_filters (self->pipeline2, 0,
                                   COGL_PIPELINE_FILTER_LINEAR,
                                   COGL_PIPELINE_FILTER_LINEAR);

  cogl_pipeline_set_layer_filters (self->pipeline3, 0,
                                   COGL_PIPELINE_FILTER_LINEAR,
                                   COGL_PIPELINE_FILTER_LINEAR);

  cogl_pipeline_set_layer_filters (self->pipeline4, 0,
                                   COGL_PIPELINE_FILTER_LINEAR,
                                   COGL_PIPELINE_FILTER_LINEAR);

  cogl_pipeline_set_layer_null_texture (self->pipeline0,
                                        0,
                                        COGL_TEXTURE_TYPE_2D);

  cogl_pipeline_set_layer_null_texture (self->pipeline1,
                                        0,
                                        COGL_TEXTURE_TYPE_2D);

  cogl_pipeline_set_layer_null_texture (self->pipeline2,
                                        0,
                                        COGL_TEXTURE_TYPE_2D);

  cogl_pipeline_set_layer_null_texture (self->pipeline3,
                                        0,
                                        COGL_TEXTURE_TYPE_2D);
  
  cogl_pipeline_set_layer_null_texture (self->pipeline4,
                                        0,
                                        COGL_TEXTURE_TYPE_2D);

  self->pixel_step_uniform0 =
    cogl_pipeline_get_uniform_location (self->pipeline0, "pixel_step");

  self->BumpTex_uniform =
    cogl_pipeline_get_uniform_location (self->pipeline0, "BumpTex");

  self->bump_step_uniform =
    cogl_pipeline_get_uniform_location (self->pipeline0, "bump_step");

  self->pixel_step_uniform1 =
    cogl_pipeline_get_uniform_location (self->pipeline1, "pixel_step");

  self->pixel_step_uniform2 =
    cogl_pipeline_get_uniform_location (self->pipeline3, "pixel_step");

  cogl_pipeline_set_blend (self->pipeline0,
                           "RGBA = ADD(SRC_COLOR, DST_COLOR*0)",
                           NULL);

  cogl_pipeline_set_blend (self->pipeline1,
                           "RGBA = ADD (SRC_COLOR*DST_COLOR[A], DST_COLOR*(1-DST_COLOR[A]))",
                           NULL);

  cogl_pipeline_set_color4ub (self->pipeline1,
                              0xff,
                              0xff,
                              0xff,
                              0xff);

  cogl_pipeline_set_alpha_test_function (self->pipeline2,
                                         COGL_PIPELINE_ALPHA_FUNC_LESS,
                                         0.004f);

  cogl_pipeline_set_color_mask (self->pipeline2,
                                COGL_COLOR_MASK_ALPHA);

  cogl_pipeline_set_blend (self->pipeline2,
                           "RGBA = ADD(SRC_COLOR, DST_COLOR*0)",
                           NULL);

  cogl_pipeline_set_alpha_test_function (self->pipeline3,
                                         COGL_PIPELINE_ALPHA_FUNC_GEQUAL,
                                         0.004f);
    
  cogl_pipeline_set_color_mask (self->pipeline3,
                                COGL_COLOR_MASK_ALL);

  cogl_pipeline_set_blend (self->pipeline3,
                           "RGBA = ADD (SRC_COLOR, DST_COLOR*(1-SRC_COLOR[A]))",
                           NULL);

  cogl_pipeline_set_alpha_test_function (self->pipeline4,
                                         COGL_PIPELINE_ALPHA_FUNC_GEQUAL,
                                         0.004f);
    
  cogl_pipeline_set_color_mask (self->pipeline4,
                                COGL_COLOR_MASK_ALL);

  cogl_pipeline_set_blend (self->pipeline4,
                           "RGBA = ADD (SRC_COLOR, DST_COLOR*(1-SRC_COLOR[A]))",
                           NULL);


  self->bg_texture = NULL;

  self->bg_sub_texture = NULL;

  self->bumpmap_location = "/usr/share/cinnamon/bumpmaps/frost.png";

  self->bg_bumpmap = st_cogl_texture_new_from_file_wrapper (self->bumpmap_location,
                                                            COGL_TEXTURE_NO_SLICING,
                                                            COGL_PIXEL_FORMAT_RGBA_8888_PRE);
  if (self->bg_bumpmap != NULL)
    {
      self->bumptex_width_i = cogl_texture_get_width (self->bg_bumpmap);
      self->bumptex_height_i = cogl_texture_get_height (self->bg_bumpmap);

      cogl_pipeline_set_layer_texture (self->pipeline0, 1, self->bg_bumpmap);
    }
  else
    {
      cogl_pipeline_set_layer_null_texture (self->pipeline0,
                                            1,
                                            COGL_TEXTURE_TYPE_2D);
    }

  cogl_pipeline_set_layer_combine (self->pipeline0,1,
                                   "RGBA = REPLACE (PREVIOUS)",
                                   NULL);

  self->old_time = 0;

  self->opacity = 0;

}

ClutterEffect *
st_background_effect_new ()
{
  return g_object_new (ST_TYPE_BACKGROUND_EFFECT,
                       NULL);
}

