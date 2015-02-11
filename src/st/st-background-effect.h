#ifndef __ST_BACKGROUND_EFFECT_H__
#define __ST_BACKGROUND_EFFECT_H__

#include <clutter/clutter.h>
G_BEGIN_DECLS
#define ST_TYPE_BACKGROUND_EFFECT        (st_background_effect_get_type ())
#define ST_BACKGROUND_EFFECT(obj)        (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_BACKGROUND_EFFECT, StBackgroundEffect))
#define ST_IS_BACKGROUND_EFFECT(obj)     (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_BACKGROUND_EFFECT))

typedef struct _StBackgroundEffect        StBackgroundEffect;
typedef struct _StBackgroundEffectClass   StBackgroundEffectClass;

/* object */

struct _StBackgroundEffect
{
    ClutterOffscreenEffect parent_instance;

    ClutterActor *actor;
    CoglHandle bg_texture;
    CoglHandle bg_sub_texture;
    CoglHandle bg_bumpmap;
    gchar* bumpmap_location;

    gint pixel_step_uniform0;
    gint pixel_step_uniform1;
    gint pixel_step_uniform2;
    gint BumpTex_uniform;
    gint bump_step_uniform;

    gint bg_posx_i;
    gint bg_posy_i;

    gint bg_width_i;
    gint bg_height_i;

    gint fg_width_i;
    gint fg_height_i;

    gint bumptex_width_i;
    gint bumptex_height_i;

    gfloat posx_old;
    gfloat posy_old;
    gfloat width_old;
    gfloat height_old;

    CoglPipeline *pipeline0;
    CoglPipeline *pipeline1;
    CoglPipeline *pipeline2;
    CoglPipeline *pipeline3;
    CoglPipeline *pipeline4;

    glong old_time;
    guint8 opacity;
};

/* class */

struct _StBackgroundEffectClass
{
    ClutterOffscreenEffectClass parent_class;
    CoglPipeline *base_pipeline;
};

GType   st_background_effect_get_type (void) G_GNUC_CONST;

ClutterEffect *st_background_effect_new (void);

G_END_DECLS
#endif /* __ST_BACKGROUND_EFFECT_H__ */

