/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_GLSL_QUAD_H__
#define __CINNAMON_GLSL_QUAD_H__

#include "st.h"
#include <gtk/gtk.h>

/**
 * CinnamonSnippetHook:
 * Temporary hack to work around Cogl not exporting CoglSnippetHook in
 * the 1.0 API. Don't use.
 */
typedef enum {
  /* Per pipeline vertex hooks */
  CINNAMON_SNIPPET_HOOK_VERTEX = 0,
  CINNAMON_SNIPPET_HOOK_VERTEX_TRANSFORM,

  /* Per pipeline fragment hooks */
  CINNAMON_SNIPPET_HOOK_FRAGMENT = 2048,

  /* Per layer vertex hooks */
  CINNAMON_SNIPPET_HOOK_TEXTURE_COORD_TRANSFORM = 4096,

  /* Per layer fragment hooks */
  CINNAMON_SNIPPET_HOOK_LAYER_FRAGMENT = 6144,
  CINNAMON_SNIPPET_HOOK_TEXTURE_LOOKUP
} CinnamonSnippetHook;

#define CINNAMON_TYPE_GLSL_QUAD (cinnamon_glsl_quad_get_type ())
G_DECLARE_DERIVABLE_TYPE (CinnamonGLSLQuad, cinnamon_glsl_quad, CINNAMON, GLSL_QUAD, ClutterActor)

struct _CinnamonGLSLQuadClass
{
  ClutterActorClass parent_class;

  CoglPipeline *base_pipeline;

  void (*build_pipeline) (CinnamonGLSLQuad *effect);
};

void cinnamon_glsl_quad_add_glsl_snippet (CinnamonGLSLQuad    *quad,
                                          CinnamonSnippetHook  hook,
                                          const char          *declarations,
                                          const char          *code,
                                          gboolean             is_replace);

int  cinnamon_glsl_quad_get_uniform_location (CinnamonGLSLQuad *quad,
                                              const char       *name);
void cinnamon_glsl_quad_set_uniform_float    (CinnamonGLSLQuad *quad,
                                              int               uniform,
                                              int               n_components,
                                              int               total_count,
                                              const float      *value);

#endif /* __CINNAMON_GLSL_QUAD_H__ */
