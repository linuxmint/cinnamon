#ifndef __ST_BACKGROUND_EFFECT_H__
#define __ST_BACKGROUND_EFFECT_H__

#include <clutter/clutter.h>

G_BEGIN_DECLS
#define ST_TYPE_BACKGROUND_BLUR_EFFECT        (st_background_blur_effect_get_type ())
#define ST_TYPE_BACKGROUND_BUMPMAP_EFFECT        (st_background_bumpmap_effect_get_type ())

#define ST_BACKGROUND_BLUR_EFFECT(obj)        (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_BACKGROUND_BLUR_EFFECT, StBackgroundBlurEffect))
#define ST_IS_BACKGROUND_BLUR_EFFECT(obj)     (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_BACKGROUND_EFFECT))

#define ST_BACKGROUND_BUMPMAP_EFFECT(obj)        (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_BACKGROUND_BUMPMAP_EFFECT, StBackgroundBumpmapEffect))
#define ST_IS_BACKGROUND_BUMPMAP_EFFECT(obj)     (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_BACKGROUND_BUMPMAP_EFFECT))

typedef struct _StBackgroundBlurEffect        StBackgroundBlurEffect;
typedef struct _StBackgroundBlurEffectClass   StBackgroundBlurEffectClass;

typedef struct _StBackgroundBumpmapEffect        StBackgroundBumpmapEffect;
typedef struct _StBackgroundBumpmapEffectClass   StBackgroundBumpmapEffectClass;
/* object */

struct _StBackgroundBlurEffect
{
    ClutterOffscreenEffect parent_instance;

    ClutterActor *actor;
    CoglTexture  *bg_texture;
    CoglTexture *corner_texture;

    gint pixel_step_uniform;
    gint blur_size;
    int border_radius[4];

    gint bg_posx;
    gint bg_posy;

    gint bg_width;
    gint bg_height;

    CoglPipeline *pipeline1;
};

struct _StBackgroundBumpmapEffect
{
    ClutterOffscreenEffect parent_instance;

    ClutterActor *actor;
    CoglTexture  *bg_texture;
    CoglTexture *corner_texture;
    CoglHandle    bg_bumpmap;
    char         *bumpmap_path;

    gint pixel_step_uniform0;
    gint BumpTex_uniform;
    gint bump_step_uniform;
    int border_radius[4];
    
    gint bg_posx;
    gint bg_posy;

    gint bg_width;
    gint bg_height;

    gint bumptex_width;
    gint bumptex_height;

    CoglPipeline *pipeline0;
};

/* class */

struct _StBackgroundBlurEffectClass
{
    ClutterOffscreenEffectClass parent_class;
    CoglPipeline *base_pipeline;
    gboolean changed;
};
struct _StBackgroundBumpmapEffectClass
{
    ClutterOffscreenEffectClass parent_class;
    CoglPipeline *base_pipeline;
    gboolean changed;
};

GType   st_background_blur_effect_get_type (void) G_GNUC_CONST;
GType   st_background_bumpmap_effect_get_type (void) G_GNUC_CONST;

ClutterEffect *st_background_blur_effect_new (ClutterActor *actor);
ClutterEffect *st_background_bumpmap_effect_new (ClutterActor *actor);

gboolean st_paint_background_blur_effect (StBackgroundBlurEffect *background_blur_effect,
                                     CoglFramebuffer     *fb,
                                     const ClutterActorBox *box);
gboolean st_paint_background_bumpmap_effect (StBackgroundBumpmapEffect *background_blur_effect,
                                     CoglFramebuffer     *fb,
                                     const ClutterActorBox *box);

G_END_DECLS
#endif /* __ST_BACKGROUND_EFFECT_H__ */

