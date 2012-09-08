#include "st-background-effect.h"
#define ST_BACKGROUND_EFFECT_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_BACKGROUND_EFFECT, StBackgroundEffectClass))
#define ST_IS_BACKGROUND_EFFECT_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_BACKGROUND_EFFECT))
#define ST_BACKGROUND_EFFECT_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_BACKGROUND_EFFECT, StBackgroundEffectClass))

G_DEFINE_TYPE (StBackgroundEffect, st_background_effect, CLUTTER_TYPE_OFFSCREEN_EFFECT);

#define CLUTTER_ENABLE_EXPERIMENTAL_API

#include "cogl/cogl.h"

typedef enum
{
    COGL_PIPELINE_CULL_FACE_MODE_NONE,
    COGL_PIPELINE_CULL_FACE_MODE_FRONT,
    COGL_PIPELINE_CULL_FACE_MODE_BACK,
    COGL_PIPELINE_CULL_FACE_MODE_BOTH
} CoglPipelineCullFaceMode;

typedef enum
{
    COGL_PIPELINE_FILTER_NEAREST = 0x2600,
    COGL_PIPELINE_FILTER_LINEAR = 0x2601,
    COGL_PIPELINE_FILTER_NEAREST_MIPMAP_NEAREST = 0x2700,
    COGL_PIPELINE_FILTER_LINEAR_MIPMAP_NEAREST = 0x2701,
    COGL_PIPELINE_FILTER_NEAREST_MIPMAP_LINEAR = 0x2702,
    COGL_PIPELINE_FILTER_LINEAR_MIPMAP_LINEAR = 0x2703
} CoglPipelineFilter;

typedef enum 
{
  COGL_PIPELINE_WRAP_MODE_REPEAT = 0x2901,
  COGL_PIPELINE_WRAP_MODE_MIRRORED_REPEAT = 0x8370,
  COGL_PIPELINE_WRAP_MODE_CLAMP_TO_EDGE = 0x812F,
  COGL_PIPELINE_WRAP_MODE_AUTOMATIC = 0x0207 /* GL_ALWAYS */
} CoglPipelineWrapMode;

extern void
cogl_pipeline_set_uniform_float (CoglPipeline *pipeline,
                                 int uniform_location,
                                 int n_components,
                                 int count,
                                 const float *value);
extern void
cogl_pipeline_set_layer_texture (CoglPipeline *pipeline,
                                 int           layer_index,
                                 CoglTexture  *texture);
extern void
cogl_pipeline_set_color4ub (CoglPipeline *pipeline,
			    guint8        red,
                            guint8        green,
                            guint8        blue,
                            guint8        alpha);

extern CoglContext *clutter_backend_get_cogl_context (ClutterBackend *backend);

extern CoglPipeline *cogl_pipeline_new (CoglContext *context);

extern CoglPipeline *cogl_pipeline_copy (CoglPipeline *source);

extern void
cogl_pipeline_add_layer_snippet (CoglPipeline *pipeline,
                                 int layer,
                                 CoglSnippet *snippet);

extern void 
cogl_pipeline_set_layer_wrap_mode (CoglPipeline *pipeline,
                                   int layer_index,
                                   CoglPipelineWrapMode mode);

extern void 
cogl_pipeline_set_cull_face_mode (CoglPipeline *pipeline,
                                  CoglPipelineCullFaceMode cull_face_mode);

extern void 
cogl_pipeline_set_layer_filters (CoglPipeline *pipeline,
                                 int layer_index,
                                 CoglPipelineFilter min_filter,
                                 CoglPipelineFilter mag_filter);

extern void
cogl_pipeline_set_layer_null_texture (CoglPipeline *pipeline,
                                      int layer_index,
                                      CoglTextureType texure_type);

extern int
cogl_pipeline_get_uniform_location (CoglPipeline *pipeline,
                                    const char *uniform_name);

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

    clutter_actor_get_transformed_position (self->actor, &posx, &posy);
    clutter_actor_get_transformed_size (self->actor, &width, &height);
    self->opacity = clutter_actor_get_paint_opacity (self->actor);

    if  (( posx != self->posx_old)
           || ( posy != self->posy_old)
           || ( width != self->width_old)
           || ( height != self->height_old)
           || (time_used > 50.0d)) 

    {
        self->posx_old = posx;
        self->posy_old = posy;
        self->width_old = width;
        self->height_old = height;

        self->bg_posx_i = posx+2;
        self->bg_posy_i = posy+2;
        self->bg_width_i = width-4;
        self->bg_height_i = height-4;

        size = (self->bg_width_i) * (self->bg_height_i) * 4;

        if (((self->opacity == 0xff) || (time_used > 50.0d)) && (size > 0))
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

                self->bg_texture = cogl_texture_new_from_data  (self->bg_width_i,
                                   self->bg_height_i,
                                   COGL_TEXTURE_NO_SLICING,
                                   COGL_PIXEL_FORMAT_RGBA_8888,
                                   COGL_PIXEL_FORMAT_ANY,
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

                if (self->pixel_step_uniform > -1)
                {
                    gfloat pixel_step[2];

                    pixel_step[0] = 1.0f / (self->bg_width_i);
                    pixel_step[1] = 1.0f / (self->bg_height_i);

                    cogl_pipeline_set_uniform_float (self->pipeline1,
                                                     self->pixel_step_uniform,
                                                     2,
                                                     1,
                                                     pixel_step);
                }

                cogl_pipeline_set_layer_texture (self->pipeline1, 0, self->bg_texture);

            }

            cogl_pipeline_set_layer_texture (self->pipeline2, 0, fg_texture);
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

    if (self->opacity == 0xff)
    {
        cogl_pipeline_set_color4ub (self->pipeline1,
                                    self->opacity,
                                    self->opacity,
                                    self->opacity,
                                    self->opacity);

        cogl_push_source (self->pipeline1);
        cogl_rectangle (4.0f, 4.0f, (self->bg_width_i) + 4.0f, 
                        (self->bg_height_i) + 4.0f);
        cogl_pop_source ();
    }

    cogl_pipeline_set_color4ub (self->pipeline2,
                                self->opacity,
                                self->opacity,
                                self->opacity,
                                self->opacity);

    cogl_push_source (self->pipeline2);
    cogl_rectangle (0.0f, 0.0f, (self->fg_width_i), (self->fg_height_i));
    cogl_pop_source ();

    clutter_actor_queue_redraw (self->actor);

}

static void
st_background_effect_dispose (GObject *gobject)
{
    StBackgroundEffect *self = ST_BACKGROUND_EFFECT (gobject);

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

    if (self->bg_texture != NULL)
    {
        cogl_handle_unref (self->bg_texture);
        self->bg_texture = NULL;
    }

    G_OBJECT_CLASS (st_background_effect_parent_class)->dispose (gobject);
}


static void
st_background_effect_class_init (StBackgroundEffectClass *klass)
{
    ClutterEffectClass *effect_class = CLUTTER_EFFECT_CLASS (klass);
    GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
    ClutterOffscreenEffectClass *offscreen_class;

    effect_class->pre_paint = st_background_effect_pre_paint;
    gobject_class->dispose = st_background_effect_dispose;

    offscreen_class = CLUTTER_OFFSCREEN_EFFECT_CLASS (klass);
    offscreen_class->paint_target = st_background_effect_paint_target;
}

static void
st_background_effect_init (StBackgroundEffect *self)
{
    CoglContext *ctx;
    StBackgroundEffectClass *klass = ST_BACKGROUND_EFFECT_GET_CLASS (self);

    if (G_UNLIKELY (klass->base_pipeline == NULL))
    {
        ctx = clutter_backend_get_cogl_context (clutter_get_default_backend ());

        klass->base_pipeline = cogl_pipeline_new (ctx);
    }

    self->pipeline1 = cogl_pipeline_copy (klass->base_pipeline);
    self->pipeline2 = cogl_pipeline_copy (klass->base_pipeline);

    CoglSnippet *snippet;
    snippet = cogl_snippet_new (COGL_SNIPPET_HOOK_TEXTURE_LOOKUP,
                                box_blur_glsl_declarations,
                                NULL);

    cogl_snippet_set_replace (snippet, box_blur_glsl_shader);
    cogl_pipeline_add_layer_snippet (self->pipeline1, 0, snippet);
    cogl_object_unref (snippet);

    cogl_pipeline_set_layer_wrap_mode (self->pipeline1, 0,
                                       COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

    cogl_pipeline_set_layer_wrap_mode (self->pipeline2, 0,
                                       COGL_MATERIAL_WRAP_MODE_CLAMP_TO_EDGE);

    cogl_pipeline_set_cull_face_mode (self->pipeline1,
                                      COGL_PIPELINE_CULL_FACE_MODE_NONE);

    cogl_pipeline_set_cull_face_mode (self->pipeline2,
                                      COGL_PIPELINE_CULL_FACE_MODE_NONE);

    cogl_pipeline_set_layer_filters (self->pipeline1, 0,
                                     COGL_PIPELINE_FILTER_LINEAR_MIPMAP_LINEAR,
                                     COGL_PIPELINE_FILTER_LINEAR_MIPMAP_LINEAR);

    cogl_pipeline_set_layer_filters (self->pipeline2, 0,
                                     COGL_PIPELINE_FILTER_LINEAR_MIPMAP_LINEAR,
                                     COGL_PIPELINE_FILTER_LINEAR_MIPMAP_LINEAR);

    cogl_pipeline_set_layer_null_texture (self->pipeline1,
                                          0,
                                          COGL_TEXTURE_TYPE_2D);

    cogl_pipeline_set_layer_null_texture (self->pipeline2,
                                          0,
                                          COGL_TEXTURE_TYPE_2D);

    self->pixel_step_uniform =
        cogl_pipeline_get_uniform_location (self->pipeline1, "pixel_step");

    self->bg_texture = NULL;

    self->old_time = 0;

    self->opacity = 0;

}


ClutterEffect *
st_background_effect_new ()
{
    return g_object_new (ST_TYPE_BACKGROUND_EFFECT,
                         NULL);
}

