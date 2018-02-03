/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-cogl-wrapper.h: compatibility wrappers for various cogl api calls
 *
 */

#ifndef __ST_COGL_WRAPPER_H__
#define __ST_COGL_WRAPPER_H__

#include <clutter/clutter.h>

G_BEGIN_DECLS

CoglContext * st_get_cogl_context(void);

CoglTexture * st_cogl_texture_new_from_data_wrapper                (int  width,
                                                                    int  height,
                                                       CoglTextureFlags  flags,
                                                        CoglPixelFormat  format,
                                                        CoglPixelFormat  internal_format,
                                                                    int  rowstride,
                                                          const uint8_t *data);

CoglTexture * st_cogl_texture_new_from_file_wrapper         (const char *filename,
                                                       CoglTextureFlags  flags,
                                                        CoglPixelFormat  internal_format);

CoglTexture * st_cogl_texture_new_with_size_wrapper                (int  width,
                                                                    int  height,
                                                       CoglTextureFlags  flags,
                                                        CoglPixelFormat  internal_format);

G_END_DECLS

#endif /* __ST_COGL_WRAPPER_H__ */
