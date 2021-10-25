/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-cogl-wrapper.c: compatibility wrappers for various cogl api calls
 *
 */

#include "st-cogl-wrapper.h"

static CoglContext *cogl_context = NULL;
static gboolean supports_npot = FALSE;

inline static gboolean
hardware_supports_npot_sizes (void)
{
    // if (cogl_context != NULL)
    //     return supports_npot;

    cogl_context = st_get_cogl_context();
    // supports_npot = cogl_has_feature (cogl_context, COGL_FEATURE_ID_TEXTURE_NPOT);

    // g_message ("cogl npot texture sizes %s", supports_npot ? "SUPPORTED" : "NOT supported");

    // return supports_npot;
    return TRUE;
}

/**
 * st_get_cogl_context: (skip)
 */
CoglContext *
st_get_cogl_context (void)
{
  if (G_UNLIKELY (cogl_context == NULL))
    cogl_context = clutter_backend_get_cogl_context (clutter_get_default_backend ());

  return cogl_context;
}

/**
 * st_cogl_texture_new_from_data_wrapper: (skip)
 *
 * Decides whether to use the newer (apparently safer)
 * cogl_texture_2d_new_from_data or the older cogl_texture_new_from_data
 * depending on if the GPU supports it.
 */

CoglTexture *
st_cogl_texture_new_from_data_wrapper                (int  width,
                                                      int  height,
                                         CoglTextureFlags  flags,
                                          CoglPixelFormat  format,
                                          CoglPixelFormat  internal_format,
                                                      int  rowstride,
                                            const uint8_t *data)
{
    CoglTexture *texture = NULL;

    if (hardware_supports_npot_sizes ())
      {
        GError *error = NULL;

        texture = COGL_TEXTURE (cogl_texture_2d_new_from_data (cogl_context, width, height,
                                                               format,
                                                               rowstride,
                                                               data,
                                                               &error));

        if (error)
          {
            g_debug ("(st) cogl_texture_2d_new_from_data failed: %s\n", error->message);
            g_error_free (error);
          }
      }
    else
      {
        texture = cogl_texture_new_from_data (width,
                                              height,
                                              flags,
                                              format,
                                              internal_format,
                                              rowstride,
                                              data);
      }

    return texture;
}

/**
 * st_cogl_texture_new_from_file_wrapper: (skip)
 *
 * Decides whether to use the newer (apparently safer)
 * cogl_texture_2d_new_from_file or the older cogl_texture_new_from_file
 * depending on if the GPU supports it.
 */

CoglTexture *
st_cogl_texture_new_from_file_wrapper         (const char *filename,
                                         CoglTextureFlags  flags,
                                          CoglPixelFormat  internal_format)
{
    CoglTexture *texture = NULL;
    GError *error = NULL;

    if (hardware_supports_npot_sizes ())
      {
        texture = COGL_TEXTURE (cogl_texture_2d_new_from_file (cogl_context,
                                                               filename,
                                                               &error));
      }
    else
      {
        texture = cogl_texture_new_from_file (filename,
                                              flags,
                                              internal_format,
                                              &error);
      }

    if (error)
      {
        g_debug ("cogl_texture_(2d)_new_from_file failed: %s\n", error->message);
        g_error_free (error);
      }

    return texture;
}

/**
 * st_cogl_texture_new_with_size_wrapper: (skip)
 *
 * Decides whether to use the newer (apparently safer)
 * cogl_texture_2d_new_with_size or the older cogl_texture_new_with_size
 * depending on if the GPU supports it.
 */

CoglTexture *
st_cogl_texture_new_with_size_wrapper           (int width,
                                                 int height,
                                    CoglTextureFlags flags,
                                     CoglPixelFormat internal_format)
{
    CoglTexture *texture = NULL;

    if (hardware_supports_npot_sizes ())
      {
        texture = COGL_TEXTURE (cogl_texture_2d_new_with_size (cogl_context,
                                                               width,
                                                               height));
      }
    else
      {
        texture = cogl_texture_new_with_size (width, height,
                                              flags,
                                              internal_format);
      }

    return texture;
}

