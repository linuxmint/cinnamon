/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-texture-cache.h: Object for loading and caching images as textures
 *
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2010, Maxim Ermilov
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __ST_TEXTURE_CACHE_H__
#define __ST_TEXTURE_CACHE_H__

#if !defined(ST_H_INSIDE) && !defined(ST_COMPILATION)
#error "Only <st/st.h> can be included directly.h"
#endif

#include <gio/gio.h>
#include <gtk/gtk.h>
#include <gdk-pixbuf/gdk-pixbuf.h>
#include <clutter/clutter.h>

#include "st-types.h"
#include "st-theme-node.h"

#define ST_TYPE_TEXTURE_CACHE                 (st_texture_cache_get_type ())
#define ST_TEXTURE_CACHE(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_TEXTURE_CACHE, StTextureCache))
#define ST_TEXTURE_CACHE_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_TEXTURE_CACHE, StTextureCacheClass))
#define ST_IS_TEXTURE_CACHE(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_TEXTURE_CACHE))
#define ST_IS_TEXTURE_CACHE_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_TEXTURE_CACHE))
#define ST_TEXTURE_CACHE_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_TEXTURE_CACHE, StTextureCacheClass))

typedef struct _StTextureCache StTextureCache;
typedef struct _StTextureCacheClass StTextureCacheClass;

typedef struct _StTextureCachePrivate StTextureCachePrivate;

struct _StTextureCache
{
  GObject parent;

  StTextureCachePrivate *priv;
};

struct _StTextureCacheClass
{
  GObjectClass parent_class;

};

typedef enum {
  ST_TEXTURE_CACHE_POLICY_NONE,
  ST_TEXTURE_CACHE_POLICY_FOREVER
} StTextureCachePolicy;

GType st_texture_cache_get_type (void) G_GNUC_CONST;

StTextureCache* st_texture_cache_get_default (void);

ClutterActor *
st_texture_cache_load_sliced_image (StTextureCache *cache,
                                    const gchar    *path,
                                    gint            grid_width,
                                    gint            grid_height,
                                    GFunc           load_callback,
                                    gpointer        user_data);

ClutterActor *st_texture_cache_load_from_pixbuf (GdkPixbuf *pixbuf,
                                                 int        size);

ClutterActor *st_texture_cache_load_gicon (StTextureCache *cache,
                                           StThemeNode    *theme_node,
                                           GIcon          *icon,
                                           gint            size);

ClutterActor *st_texture_cache_load_icon_name (StTextureCache    *cache,
                                 StThemeNode       *theme_node,
                                 const char        *name,
                                 StIconType         icon_type,
                                 gint               size);

ClutterActor *st_texture_cache_load_uri_async (StTextureCache    *cache,
                                               const gchar       *uri,
                                               int                available_width,
                                               int                available_height);

ClutterActor *st_texture_cache_load_uri_sync (StTextureCache       *cache,
                                              StTextureCachePolicy  policy,
                                              const gchar          *uri,
                                              int                   available_width,
                                              int                   available_height,
                                              GError              **error);

CoglTexture  *st_texture_cache_load_file_to_cogl_texture (StTextureCache *cache,
                                                          const gchar    *file_path);

cairo_surface_t *st_texture_cache_load_file_to_cairo_surface (StTextureCache *cache,
                                                              const gchar    *file_path);

ClutterActor *st_texture_cache_load_from_raw (StTextureCache    *cache,
                                              const guchar      *data,
                                              gsize              len,
                                              gboolean           has_alpha,
                                              int                width,
                                              int                height,
                                              int                rowstride,
                                              int                size,
                                              GError           **error);

ClutterActor *st_texture_cache_load_file_simple (StTextureCache *cache,
                                                 const gchar    *file_path);

/**
 * StTextureCacheLoadImageCallback
 * @cache: a #StTextureCache
 * @actor: the actor containing the loaded image
 * @gpointer: Callback data
 *
 * Callback from st_texture_cache_load_image_from_file_async
 */
typedef void (* StTextureCacheLoadImageCallback) (StTextureCache *cache,
                                                  ClutterActor   *actor,
                                                  gpointer        user_data);

void st_texture_cache_load_image_from_file_async (StTextureCache                    *cache,
                                                  const gchar                       *path,
                                                  gint                               width,
                                                  gint                               height,
                                                  StTextureCacheLoadImageCallback    callback,
                                                  gpointer                           user_data);

/**
 * StTextureCacheLoader: (skip)
 * @cache: a #StTextureCache
 * @key: Unique identifier for this texture
 * @data: Callback user data
 * @error: A #GError
 *
 * See st_texture_cache_load().  Implementations should return a
 * texture handle for the given key, or set @error.
 *
 */
typedef CoglTexture * (*StTextureCacheLoader) (StTextureCache *cache, const char *key, void *data, GError **error);

CoglTexture * st_texture_cache_load (StTextureCache       *cache,
                                     const char           *key,
                                     StTextureCachePolicy  policy,
                                     StTextureCacheLoader  load,
                                     void                 *data,
                                     GError              **error);

#endif /* __ST_TEXTURE_CACHE_H__ */
