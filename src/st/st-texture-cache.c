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

#include "config.h"

#include "st-image-content.h"
#include "st-texture-cache.h"
#include "st-private.h"
#include "st-settings.h"
#include "st-theme-context.h"
#include <gtk/gtk.h>
#include <math.h>
#include <string.h>
#include <glib.h>

#define CACHE_PREFIX_ICON "icon:"
#define CACHE_PREFIX_FILE "file:"
#define CACHE_PREFIX_FILE_FOR_CAIRO "file-for-cairo:"

struct _StTextureCachePrivate
{
  GtkIconTheme *icon_theme;
  GSettings *settings;

  /* Things that were loaded with a cache policy != NONE */
  GHashTable *keyed_cache; /* char * -> ClutterImage* */
  GHashTable *keyed_surface_cache; /* char * -> cairo_surface_t* */

  GHashTable *used_scales; /* Set: double */

  /* Presently this is used to de-duplicate requests for GIcons and async URIs. */
  GHashTable *outstanding_requests; /* char * -> AsyncTextureLoadData * */

  /* File monitors to evict cache data on changes */
  GHashTable *file_monitors; /* char * -> GFileMonitor * */

  GCancellable *cancellable;
};

static void st_texture_cache_dispose (GObject *object);
static void st_texture_cache_finalize (GObject *object);

enum
{
  ICON_THEME_CHANGED,
  TEXTURE_FILE_CHANGED,

  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0, };
G_DEFINE_TYPE(StTextureCache, st_texture_cache, G_TYPE_OBJECT);

/* We want to preserve the aspect ratio by default, also the default
 * pipeline for an empty texture is full opacity white, which we
 * definitely don't want.  Skip that by setting 0 opacity.
 */
static ClutterActor *
create_invisible_actor (void)
{
  return g_object_new (CLUTTER_TYPE_ACTOR,
                       "opacity", 0,
                       "request-mode", CLUTTER_REQUEST_CONTENT_SIZE,
                       NULL);
}

/* Reverse the opacity we added while loading */
static void
set_content_from_image (ClutterActor   *actor,
                        ClutterContent *image)
{
  g_assert (image && CLUTTER_IS_IMAGE (image));

  clutter_actor_set_content (actor, image);
  clutter_actor_set_opacity (actor, 255);
}

static void
st_texture_cache_class_init (StTextureCacheClass *klass)
{
  GObjectClass *gobject_class = (GObjectClass *)klass;

  gobject_class->dispose = st_texture_cache_dispose;
  gobject_class->finalize = st_texture_cache_finalize;

  signals[ICON_THEME_CHANGED] =
    g_signal_new ("icon-theme-changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0, /* no default handler slot */
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);

  signals[TEXTURE_FILE_CHANGED] =
    g_signal_new ("texture-file-changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0, /* no default handler slot */
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1, G_TYPE_FILE);
}

/* Evicts all cached textures for named icons */
static void
st_texture_cache_evict_icons (StTextureCache *cache)
{
  GHashTableIter iter;
  gpointer key;
  gpointer value;

  g_hash_table_iter_init (&iter, cache->priv->keyed_cache);
  while (g_hash_table_iter_next (&iter, &key, &value))
    {
      const char *cache_key = key;

      /* This is too conservative - it takes out all cached textures
       * for GIcons even when they aren't named icons, but it's not
       * worth the complexity of parsing the key and calling
       * g_icon_new_for_string(); icon theme changes aren't normal */
      if (g_str_has_prefix (cache_key, CACHE_PREFIX_ICON))
        g_hash_table_iter_remove (&iter);
    }
}

static void
on_icon_theme_changed (StSettings     *settings,
                       GParamSpec     *pspec,
                       StTextureCache *cache)
{
  g_autofree gchar *theme = NULL;

  g_cancellable_cancel (cache->priv->cancellable);
  g_cancellable_reset (cache->priv->cancellable);

  st_texture_cache_evict_icons (cache);

  g_object_get (settings, "gtk-icon-theme", &theme, NULL);
  gtk_icon_theme_set_custom_theme (cache->priv->icon_theme, theme);

  g_signal_emit (cache, signals[ICON_THEME_CHANGED], 0);
}

static void
on_gtk_icon_theme_changed (GtkIconTheme   *icon_theme,
                           StTextureCache *self)
{
  st_texture_cache_evict_icons (self);
  g_signal_emit (self, signals[ICON_THEME_CHANGED], 0);
}


static void
st_texture_cache_init (StTextureCache *self)
{
  StSettings *settings;

  self->priv = g_new0 (StTextureCachePrivate, 1);

  self->priv->icon_theme = gtk_icon_theme_new ();
  g_signal_connect (self->priv->icon_theme, "changed",
                    G_CALLBACK (on_gtk_icon_theme_changed), self);

  settings = st_settings_get ();
  g_signal_connect (settings, "notify::gtk-icon-theme",
                    G_CALLBACK (on_icon_theme_changed), self);

  self->priv->keyed_cache = g_hash_table_new_full (g_str_hash, g_str_equal,
                                                   g_free, g_object_unref);
  self->priv->keyed_surface_cache = g_hash_table_new_full (g_str_hash,
                                                           g_str_equal,
                                                           g_free,
                                                           (GDestroyNotify) cairo_surface_destroy);
  self->priv->used_scales = g_hash_table_new_full (g_double_hash, g_double_equal,
                                                   g_free, NULL);
  self->priv->outstanding_requests = g_hash_table_new_full (g_str_hash, g_str_equal,
                                                            g_free, NULL);
  self->priv->file_monitors = g_hash_table_new_full (g_file_hash, (GEqualFunc) g_file_equal,
                                                     g_object_unref, g_object_unref);

  self->priv->cancellable = g_cancellable_new ();

  on_icon_theme_changed (settings, NULL, self);
}

static void
st_texture_cache_dispose (GObject *object)
{
  StTextureCache *self = (StTextureCache*)object;

  g_cancellable_cancel (self->priv->cancellable);

  g_clear_object (&self->priv->settings);
  g_clear_object (&self->priv->icon_theme);
  g_clear_object (&self->priv->cancellable);

  g_clear_pointer (&self->priv->keyed_cache, g_hash_table_destroy);
  g_clear_pointer (&self->priv->keyed_surface_cache, g_hash_table_destroy);
  g_clear_pointer (&self->priv->used_scales, g_hash_table_destroy);
  g_clear_pointer (&self->priv->outstanding_requests, g_hash_table_destroy);
  g_clear_pointer (&self->priv->file_monitors, g_hash_table_destroy);

  G_OBJECT_CLASS (st_texture_cache_parent_class)->dispose (object);
}

static void
st_texture_cache_finalize (GObject *object)
{
  G_OBJECT_CLASS (st_texture_cache_parent_class)->finalize (object);
}

static void
compute_pixbuf_scale (gint      width,
                      gint      height,
                      gint      available_width,
                      gint      available_height,
                      gint     *new_width,
                      gint     *new_height)
{
  int scaled_width, scaled_height;

  if (width == 0 || height == 0)
    {
      *new_width = *new_height = 0;
      return;
    }

  if (available_width >= 0 && available_height >= 0)
    {
      /* This should keep the aspect ratio of the image intact, because if
       * available_width < (available_height * width) / height
       * then
       * (available_width * height) / width < available_height
       * So we are guaranteed to either scale the image to have an available_width
       * for width and height scaled accordingly OR have the available_height
       * for height and width scaled accordingly, whichever scaling results
       * in the image that can fit both available dimensions.
       */
      scaled_width = MIN (available_width, (available_height * width) / height);
      scaled_height = MIN (available_height, (available_width * height) / width);
    }
  else if (available_width >= 0)
    {
      scaled_width = available_width;
      scaled_height = (available_width * height) / width;
    }
  else if (available_height >= 0)
    {
      scaled_width = (available_height * width) / height;
      scaled_height = available_height;
    }
  else
    {
      scaled_width = scaled_height = 0;
    }

  /* Scale the image only if that will not increase its original dimensions. */
  if (scaled_width > 0 && scaled_height > 0 && scaled_width < width && scaled_height < height)
    {
      *new_width = scaled_width;
      *new_height = scaled_height;
    }
  else
    {
      *new_width = width;
      *new_height = height;
    }
}

static void
rgba_from_clutter (GdkRGBA      *rgba,
                   ClutterColor *color)
{
  rgba->red = color->red / 255.;
  rgba->green = color->green / 255.;
  rgba->blue = color->blue / 255.;
  rgba->alpha = color->alpha / 255.;
}

/* A private structure for keeping width, height and scale. */
typedef struct {
  int width;
  int height;
  int scale;
} Dimensions;

/* This struct corresponds to a request for an texture.
 * It's creasted when something needs a new texture,
 * and destroyed when the texture data is loaded. */
typedef struct {
  StTextureCache *cache;
  StTextureCachePolicy policy;
  char *key;

  guint width;
  guint height;
  guint paint_scale;
  gfloat resource_scale;
  GSList *actors;

  GtkIconInfo *icon_info;
  StIconColors *colors;
  GFile *file;
} AsyncTextureLoadData;

static void
texture_load_data_free (gpointer p)
{
  AsyncTextureLoadData *data = p;

  if (data->icon_info)
    {
      g_object_unref (data->icon_info);
      if (data->colors)
        st_icon_colors_unref (data->colors);
    }
  else if (data->file)
    g_object_unref (data->file);

  if (data->key)
    g_free (data->key);

  if (data->actors)
    g_slist_free_full (data->actors, (GDestroyNotify) g_object_unref);

  g_slice_free (AsyncTextureLoadData, data);
}

/**
 * on_image_size_prepared:
 * @pixbuf_loader: #GdkPixbufLoader loading the image
 * @width: the original width of the image
 * @height: the original height of the image
 * @data: pointer to the #Dimensions sructure containing available width and height for the image,
 *        available width or height can be -1 if the dimension is not limited
 *
 * Private function.
 *
 * Sets the size of the image being loaded to fit the available width and height dimensions,
 * but never scales up the image beyond its actual size.
 * Intended to be used as a callback for #GdkPixbufLoader "size-prepared" signal.
 */
static void
on_image_size_prepared (GdkPixbufLoader *pixbuf_loader,
                        gint             width,
                        gint             height,
                        gpointer         data)
{
  Dimensions *available_dimensions = data;
  int available_width = available_dimensions->width;
  int available_height = available_dimensions->height;
  int scale_factor = available_dimensions->scale;
  int scaled_width;
  int scaled_height;

  compute_pixbuf_scale (width, height, available_width, available_height,
                        &scaled_width, &scaled_height);

  gdk_pixbuf_loader_set_size (pixbuf_loader,
                              scaled_width * scale_factor,
                              scaled_height * scale_factor);
}

static GdkPixbuf *
impl_load_pixbuf_data (const guchar   *data,
                       gsize           size,
                       int             available_width,
                       int             available_height,
                       int             scale,
                       GError        **error)
{
  GdkPixbufLoader *pixbuf_loader = NULL;
  GdkPixbuf *rotated_pixbuf = NULL;
  GdkPixbuf *pixbuf;
  gboolean success;
  Dimensions available_dimensions;
  int width_before_rotation, width_after_rotation;

  pixbuf_loader = gdk_pixbuf_loader_new ();

  available_dimensions.width = available_width;
  available_dimensions.height = available_height;
  available_dimensions.scale = scale;
  g_signal_connect (pixbuf_loader, "size-prepared",
                    G_CALLBACK (on_image_size_prepared), &available_dimensions);

  success = gdk_pixbuf_loader_write (pixbuf_loader, data, size, error);
  if (!success)
    goto out;
  success = gdk_pixbuf_loader_close (pixbuf_loader, error);
  if (!success)
    goto out;

  pixbuf = gdk_pixbuf_loader_get_pixbuf (pixbuf_loader);

  width_before_rotation = gdk_pixbuf_get_width (pixbuf);

  rotated_pixbuf = gdk_pixbuf_apply_embedded_orientation (pixbuf);
  width_after_rotation = gdk_pixbuf_get_width (rotated_pixbuf);

  /* There is currently no way to tell if the pixbuf will need to be rotated before it is loaded,
   * so we only check that once it is loaded, and reload it again if it needs to be rotated in order
   * to use the available width and height correctly.
   * See http://bugzilla.gnome.org/show_bug.cgi?id=579003
   */
  if (width_before_rotation != width_after_rotation)
    {
      g_object_unref (pixbuf_loader);
      g_object_unref (rotated_pixbuf);
      rotated_pixbuf = NULL;

      pixbuf_loader = gdk_pixbuf_loader_new ();

      /* We know that the image will later be rotated, so we reverse the available dimensions. */
      available_dimensions.width = available_height;
      available_dimensions.height = available_width;
      available_dimensions.scale = scale;
      g_signal_connect (pixbuf_loader, "size-prepared",
                        G_CALLBACK (on_image_size_prepared), &available_dimensions);

      success = gdk_pixbuf_loader_write (pixbuf_loader, data, size, error);
      if (!success)
        goto out;

      success = gdk_pixbuf_loader_close (pixbuf_loader, error);
      if (!success)
        goto out;

      pixbuf = gdk_pixbuf_loader_get_pixbuf (pixbuf_loader);

      rotated_pixbuf = gdk_pixbuf_apply_embedded_orientation (pixbuf);
    }

out:
  if (pixbuf_loader)
    g_object_unref (pixbuf_loader);
  return rotated_pixbuf;
}

static GdkPixbuf *
impl_load_pixbuf_file (GFile          *file,
                       int             available_width,
                       int             available_height,
                       int             paint_scale,
                       float           resource_scale,
                       GError        **error)
{
  GdkPixbuf *pixbuf = NULL;
  char *contents = NULL;
  gsize size;

  if (g_file_load_contents (file, NULL, &contents, &size, NULL, error))
    {
      int scale = ceilf (paint_scale * resource_scale);
      pixbuf = impl_load_pixbuf_data ((const guchar *) contents, size,
                                      available_width, available_height,
                                      scale,
                                      error);
    }

  g_free (contents);

  return pixbuf;
}

static void
load_pixbuf_thread (GTask        *result,
                    gpointer      source,
                    gpointer      task_data,
                    GCancellable *cancellable)
{
  GdkPixbuf *pixbuf;
  AsyncTextureLoadData *data = task_data;
  GError *error = NULL;

  g_assert (data != NULL);
  g_assert (data->file != NULL);

  pixbuf = impl_load_pixbuf_file (data->file, data->width, data->height,
                                  data->paint_scale, data->resource_scale,
                                  &error);

  if (error != NULL)
    g_task_return_error (result, error);
  else if (pixbuf)
    g_task_return_pointer (result, g_object_ref (pixbuf), g_object_unref);

  g_clear_object (&pixbuf);
}

static GdkPixbuf *
load_pixbuf_async_finish (StTextureCache *cache, GAsyncResult *result, GError **error)
{
  return g_task_propagate_pointer (G_TASK (result), error);
}

static ClutterContent *
pixbuf_to_st_content_image (GdkPixbuf *pixbuf,
                            int        width,
                            int        height,
                            int        paint_scale,
                            float      resource_scale)
{
  ClutterContent *image;
  g_autoptr(GError) error = NULL;

  float native_width, native_height;

  native_width = ceilf (gdk_pixbuf_get_width (pixbuf) / resource_scale);
  native_height = ceilf (gdk_pixbuf_get_height (pixbuf) / resource_scale);

  if (width < 0 && height < 0)
    {
      width = native_width;
      height = native_height;
    }
  else if (width < 0)
    {
      height *= paint_scale;
      width = native_width * (height / native_height);
    }
  else if (height < 0)
    {
      width *= paint_scale;
      height = native_height * (width / native_width);
    }
  else
    {
      width *= paint_scale;
      height *= paint_scale;
    }

  image = st_image_content_new_with_preferred_size (width, height);
  clutter_image_set_data (CLUTTER_IMAGE (image),
                          gdk_pixbuf_get_pixels (pixbuf),
                          gdk_pixbuf_get_has_alpha (pixbuf) ?
                            COGL_PIXEL_FORMAT_RGBA_8888 : COGL_PIXEL_FORMAT_RGB_888,
                          gdk_pixbuf_get_width (pixbuf),
                          gdk_pixbuf_get_height (pixbuf),
                          gdk_pixbuf_get_rowstride (pixbuf),
                          &error);

  if (error)
    {
      g_warning ("Failed to allocate texture: %s", error->message);
      g_clear_object (&image);
    }

  return image;
}

static cairo_surface_t *
pixbuf_to_cairo_surface (GdkPixbuf *pixbuf)
{
  cairo_surface_t *dummy_surface;
  cairo_pattern_t *pattern;
  cairo_surface_t *surface;
  cairo_t *cr;

  dummy_surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32, 1, 1);

  cr = cairo_create (dummy_surface);
  gdk_cairo_set_source_pixbuf (cr, pixbuf, 0, 0);
  pattern = cairo_get_source (cr);
  cairo_pattern_get_surface (pattern, &surface);
  cairo_surface_reference (surface);
  cairo_destroy (cr);
  cairo_surface_destroy (dummy_surface);

  return surface;
}

static void
finish_texture_load (AsyncTextureLoadData *data,
                     GdkPixbuf            *pixbuf)
{
  g_autoptr(ClutterContent) image = NULL;
  GSList *iter;
  StTextureCache *cache;

  cache = data->cache;

  g_hash_table_remove (cache->priv->outstanding_requests, data->key);

  if (pixbuf == NULL)
    goto out;

  if (data->policy != ST_TEXTURE_CACHE_POLICY_NONE)
    {
      gpointer orig_key = NULL, value = NULL;

      if (!g_hash_table_lookup_extended (cache->priv->keyed_cache, data->key,
                                         &orig_key, &value))
        {
          image = pixbuf_to_st_content_image (pixbuf,
                                              data->width, data->height,
                                              data->paint_scale,
                                              data->resource_scale);
          if (!image)
            goto out;

          g_hash_table_insert (cache->priv->keyed_cache, g_strdup (data->key),
                               g_object_ref (image));
        }
      else
        {
          image = g_object_ref (value);
        }
    }
  else
    {
      image = pixbuf_to_st_content_image (pixbuf,
                                          data->width, data->height,
                                          data->paint_scale,
                                          data->resource_scale);
      if (!image)
        goto out;
    }

  for (iter = data->actors; iter; iter = iter->next)
    {
      ClutterActor *actor = iter->data;
      set_content_from_image (actor, image);
    }

out:
  texture_load_data_free (data);
}

static void
on_symbolic_icon_loaded (GObject      *source,
                         GAsyncResult *result,
                         gpointer      user_data)
{
  GdkPixbuf *pixbuf;
  pixbuf = gtk_icon_info_load_symbolic_finish (GTK_ICON_INFO (source), result, NULL, NULL);
  finish_texture_load (user_data, pixbuf);
  g_clear_object (&pixbuf);
}

static void
on_icon_loaded (GObject      *source,
                GAsyncResult *result,
                gpointer      user_data)
{
  GdkPixbuf *pixbuf;
  pixbuf = gtk_icon_info_load_icon_finish (GTK_ICON_INFO (source), result, NULL);
  finish_texture_load (user_data, pixbuf);
  g_clear_object (&pixbuf);
}

static void
on_pixbuf_loaded (GObject      *source,
                  GAsyncResult *result,
                  gpointer      user_data)
{
  GdkPixbuf *pixbuf;
  pixbuf = load_pixbuf_async_finish (ST_TEXTURE_CACHE (source), result, NULL);
  finish_texture_load (user_data, pixbuf);
  g_clear_object (&pixbuf);
}

static void
load_texture_async (StTextureCache       *cache,
                    AsyncTextureLoadData *data)
{
  if (data->file)
    {
      GTask *task = g_task_new (cache, NULL, on_pixbuf_loaded, data);
      g_task_set_task_data (task, data, NULL);
      g_task_run_in_thread (task, load_pixbuf_thread);
      g_object_unref (task);
    }
  else if (data->icon_info)
    {
      StIconColors *colors = data->colors;
      if (colors)
        {
          GdkRGBA foreground_color;
          GdkRGBA success_color;
          GdkRGBA warning_color;
          GdkRGBA error_color;

          rgba_from_clutter (&foreground_color, &colors->foreground);
          rgba_from_clutter (&success_color, &colors->success);
          rgba_from_clutter (&warning_color, &colors->warning);
          rgba_from_clutter (&error_color, &colors->error);

          gtk_icon_info_load_symbolic_async (data->icon_info,
                                             &foreground_color, &success_color,
                                             &warning_color, &error_color,
                                             cache->priv->cancellable,
                                             on_symbolic_icon_loaded, data);
        }
      else
        {
          gtk_icon_info_load_icon_async (data->icon_info,
                                         cache->priv->cancellable,
                                         on_icon_loaded, data);
        }
    }
  else
    g_assert_not_reached ();
}

typedef struct {
  StTextureCache *cache;
  ClutterActor *actor;
  gint size;
  GObject *source;
  gulong notify_signal_id;
  gboolean weakref_active;
} StTextureCachePropertyBind;

static void
st_texture_cache_reset_texture (StTextureCachePropertyBind *bind,
                                const char                 *propname)
{
  cairo_surface_t *surface;

  g_object_get (bind->source, propname, &surface, NULL);

  if (surface != NULL &&
      cairo_surface_get_type (surface) == CAIRO_SURFACE_TYPE_IMAGE &&
      (cairo_image_surface_get_format (surface) == CAIRO_FORMAT_ARGB32 ||
       cairo_image_surface_get_format (surface) == CAIRO_FORMAT_RGB24))
    {
      g_autoptr(ClutterContent) image = NULL;
      g_autoptr(GError) error = NULL;
      int size = bind->size;

      if (size < 0)
        clutter_actor_get_preferred_width (bind->actor, -1, NULL, (float *)&size);

      image = clutter_actor_get_content (bind->actor);
      if (!image || !CLUTTER_IS_IMAGE (image))
        image = st_image_content_new_with_preferred_size (size, size);
      else
        g_object_ref (image);

      clutter_image_set_data (CLUTTER_IMAGE (image),
                              cairo_image_surface_get_data (surface),
                              cairo_image_surface_get_format (surface) == CAIRO_FORMAT_ARGB32 ?
                              COGL_PIXEL_FORMAT_BGRA_8888 : COGL_PIXEL_FORMAT_BGR_888,
                              cairo_image_surface_get_width (surface),
                              cairo_image_surface_get_height (surface),
                              cairo_image_surface_get_stride (surface),
                              &error);

      if (image)
        clutter_actor_set_content (bind->actor, image);
      else if (error)
        g_warning ("Failed to allocate texture: %s", error->message);

      clutter_actor_set_opacity (bind->actor, 255);
    }
  else
    clutter_actor_set_opacity (bind->actor, 0);
}

static void
st_texture_cache_on_pixbuf_notify (GObject           *object,
                                   GParamSpec        *paramspec,
                                   gpointer           data)
{
  StTextureCachePropertyBind *bind = data;
  st_texture_cache_reset_texture (bind, paramspec->name);
}

static void
st_texture_cache_bind_weak_notify (gpointer     data,
                                   GObject     *source_location)
{
  StTextureCachePropertyBind *bind = data;
  bind->weakref_active = FALSE;
  g_signal_handler_disconnect (bind->source, bind->notify_signal_id);
}

static void
st_texture_cache_free_bind (gpointer data)
{
  StTextureCachePropertyBind *bind = data;
  if (bind->weakref_active)
    g_object_weak_unref (G_OBJECT (bind->actor), st_texture_cache_bind_weak_notify, bind);
  g_slice_free (StTextureCachePropertyBind, bind);
}

/**
 * st_texture_cache_bind_cairo_surface_property:
 * @cache:
 * @object: A #GObject with a property @property_name of type #GdkPixbuf
 * @property_name: Name of a property
 *
 * Create a #ClutterActor which tracks the #cairo_surface_t value of a GObject property
 * named by @property_name.  Unlike other methods in StTextureCache, the underlying
 * #CoglTexture is not shared by default with other invocations to this method.
 *
 * If the source object is destroyed, the texture will continue to show the last
 * value of the property.
 *
 * Return value: (transfer none): A new #StWidget
 */
StWidget *
st_texture_cache_bind_cairo_surface_property (StTextureCache    *cache,
                                              GObject           *object,
                                              const char        *property_name,
                                              gint               size)
{
  StWidget *widget;
  gchar *notify_key;
  StTextureCachePropertyBind *bind;

  widget = g_object_new (ST_TYPE_WIDGET,
                         "opacity", 0,
                         "width", (float)size,
                         "height", (float)size,
                         NULL);

  bind = g_slice_new0 (StTextureCachePropertyBind);
  bind->cache = cache;
  bind->actor = CLUTTER_ACTOR (widget);
  bind->size = size;
  bind->source = object;
  g_object_weak_ref (G_OBJECT (widget), st_texture_cache_bind_weak_notify, bind);
  bind->weakref_active = TRUE;

  st_texture_cache_reset_texture (bind, property_name);

  notify_key = g_strdup_printf ("notify::%s", property_name);
  bind->notify_signal_id = g_signal_connect_data (object, notify_key, G_CALLBACK(st_texture_cache_on_pixbuf_notify),
                                                  bind, (GClosureNotify)st_texture_cache_free_bind, 0);
  g_free (notify_key);

  return widget;
}

/**
 * st_texture_cache_load: (skip)
 * @cache: A #StTextureCache
 * @key: Arbitrary string used to refer to item
 * @policy: Caching policy
 * @load: Function to create the texture, if not already cached
 * @data: User data passed to @load
 * @error: A #GError
 *
 * Load an arbitrary texture, caching it.  The string chosen for @key
 * should be of the form "type-prefix:type-uuid".  For example,
 * "url:file:///usr/share/icons/hicolor/48x48/apps/firefox.png", or
 * "stock-icon:gtk-ok".
 *
 * Returns: (transfer full): A newly-referenced handle to the texture
 */
CoglTexture *
st_texture_cache_load (StTextureCache       *cache,
                       const char           *key,
                       StTextureCachePolicy  policy,
                       StTextureCacheLoader  load,
                       void                 *data,
                       GError              **error)
{
  CoglTexture *texture;

  texture = g_hash_table_lookup (cache->priv->keyed_cache, key);
  if (!texture)
    {
      texture = load (cache, key, data, error);
      if (texture && policy == ST_TEXTURE_CACHE_POLICY_FOREVER)
        g_hash_table_insert (cache->priv->keyed_cache, g_strdup (key), texture);
    }

  if (texture && policy == ST_TEXTURE_CACHE_POLICY_FOREVER)
    cogl_object_ref (texture);

  return texture;
}

/**
 * ensure_request:
 * @cache:
 * @key: A cache key
 * @policy: Cache policy
 * @request: (out): If no request is outstanding, one will be created and returned here
 * @texture: A texture to be added to the request
 *
 * Check for any outstanding load for the data represented by @key.  If there
 * is already a request pending, append it to that request to avoid loading
 * the data multiple times.
 *
 * Returns: %TRUE if there is already a request pending
 */
static gboolean
ensure_request (StTextureCache        *cache,
                const char            *key,
                StTextureCachePolicy   policy,
                AsyncTextureLoadData **request,
                ClutterActor          *actor)
{
  ClutterContent *image;
  AsyncTextureLoadData *pending;
  gboolean had_pending;

  image = g_hash_table_lookup (cache->priv->keyed_cache, key);

  if (image != NULL)
    {
      /* We had this cached already, just set the texture and we're done. */
      set_content_from_image (actor, image);
      return TRUE;
    }

  pending = g_hash_table_lookup (cache->priv->outstanding_requests, key);
  had_pending = pending != NULL;

  if (pending == NULL)
    {
      /* Not cached and no pending request, create it */
      *request = g_slice_new0 (AsyncTextureLoadData);
      if (policy != ST_TEXTURE_CACHE_POLICY_NONE)
        g_hash_table_insert (cache->priv->outstanding_requests, g_strdup (key), *request);
    }
  else
   *request = pending;

  /* Regardless of whether there was a pending request, prepend our texture here. */
  (*request)->actors = g_slist_prepend ((*request)->actors, g_object_ref (actor));

  return had_pending;
}

/**
 * st_texture_cache_load_gicon_with_scale:
 * @cache: The texture cache instance
 * @theme_node: (nullable): The #StThemeNode to use for colors, or NULL
 *                            if the icon must not be recolored
 * @icon: the #GIcon to load
 * @size: Size of themed
 * @paint_scale: Scale factor of display
 * @resource_scale: Resource scale factor
 *
 * This method returns a new #ClutterActor for a given #GIcon. If the
 * icon isn't loaded already, the texture will be filled
 * asynchronously.
 *
 * Return Value: (transfer none): A new #ClutterActor for the icon, or %NULL if not found
 */
ClutterActor *
st_texture_cache_load_gicon_with_scale (StTextureCache    *cache,
                                        StThemeNode       *theme_node,
                                        GIcon             *icon,
                                        gint               size,
                                        gint               paint_scale,
                                        gfloat             resource_scale)
{
  AsyncTextureLoadData *request;
  ClutterActor *actor;
  gint scale;
  char *gicon_string;
  char *key;
  float actor_size;
  GtkIconTheme *theme;
  GtkIconInfo *info;
  StTextureCachePolicy policy;
  StIconColors *colors = NULL;
  StIconStyle icon_style = ST_ICON_STYLE_REQUESTED;
  GtkIconLookupFlags lookup_flags;

  if (theme_node)
    {
      colors = st_theme_node_get_icon_colors (theme_node);
      icon_style = st_theme_node_get_icon_style (theme_node);
    }

  /* Do theme lookups in the main thread to avoid thread-unsafety */
  theme = cache->priv->icon_theme;

  lookup_flags = GTK_ICON_LOOKUP_USE_BUILTIN;

  if (icon_style == ST_ICON_STYLE_REGULAR)
    lookup_flags |= GTK_ICON_LOOKUP_FORCE_REGULAR;
  else if (icon_style == ST_ICON_STYLE_SYMBOLIC)
    lookup_flags |= GTK_ICON_LOOKUP_FORCE_SYMBOLIC;

  if (clutter_get_default_text_direction () == CLUTTER_TEXT_DIRECTION_RTL)
    lookup_flags |= GTK_ICON_LOOKUP_DIR_RTL;
  else
    lookup_flags |= GTK_ICON_LOOKUP_DIR_LTR;

  scale = ceilf (paint_scale * resource_scale);
  info = gtk_icon_theme_lookup_by_gicon_for_scale (theme, icon,
                                                   size, scale,
                                                   lookup_flags);
  if (info == NULL)
    return NULL;

  gicon_string = g_icon_to_string (icon);
  /* A return value of NULL indicates that the icon can not be serialized,
   * so don't have a unique identifier for it as a cache key, and thus can't
   * be cached. If it is cachable, we hardcode a policy of FOREVER here for
   * now; we should actually blow this away on icon theme changes probably */
  policy = gicon_string != NULL ? ST_TEXTURE_CACHE_POLICY_FOREVER
                                : ST_TEXTURE_CACHE_POLICY_NONE;
  if (colors)
    {
      /* This raises some doubts about the practice of using string keys */
      key = g_strdup_printf (CACHE_PREFIX_ICON "%s,size=%d,scale=%d,style=%d,colors=%2x%2x%2x%2x,%2x%2x%2x%2x,%2x%2x%2x%2x,%2x%2x%2x%2x",
                             gicon_string, size, scale, icon_style,
                             colors->foreground.red, colors->foreground.blue, colors->foreground.green, colors->foreground.alpha,
                             colors->warning.red, colors->warning.blue, colors->warning.green, colors->warning.alpha,
                             colors->error.red, colors->error.blue, colors->error.green, colors->error.alpha,
                             colors->success.red, colors->success.blue, colors->success.green, colors->success.alpha);
    }
  else
    {
      key = g_strdup_printf (CACHE_PREFIX_ICON "%s,size=%d,scale=%d,style=%d",
                             gicon_string, size, scale, icon_style);
    }
  g_free (gicon_string);

  actor = create_invisible_actor ();
  actor_size = size * paint_scale;
  clutter_actor_set_size (actor, actor_size, actor_size);
  if (ensure_request (cache, key, policy, &request, actor))
    {
      /* If there's an outstanding request, we've just added ourselves to it */
      g_object_unref (info);
      g_free (key);
    }
  else
    {
      /* Else, make a new request */

      request->cache = cache;
      /* Transfer ownership of key */
      request->key = key;
      request->policy = policy;
      request->colors = colors ? st_icon_colors_ref (colors) : NULL;
      request->icon_info = info;
      request->width = request->height = size;
      request->paint_scale = paint_scale;
      request->resource_scale = resource_scale;

      load_texture_async (cache, request);
    }

  return actor;
}

/**
 * st_texture_cache_load_gicon:
 * @cache: The texture cache instance
 * @theme_node: (allow-none): The #StThemeNode to use for colors, or NULL
 *                            if the icon must not be recolored
 * @icon: the #GIcon to load
 * @size: Size of themed
 *
 * This method returns a new #ClutterActor for a given #GIcon. If the
 * icon isn't loaded already, the texture will be filled
 * asynchronously.
 *
 * Return Value: (transfer none): A new #ClutterActor for the icon, or an empty ClutterActor
 * if none was found.
 */
ClutterActor *
st_texture_cache_load_gicon (StTextureCache    *cache,
                             StThemeNode       *theme_node,
                             GIcon             *icon,
                             gint               size)
{
    return st_texture_cache_load_gicon_with_scale (cache, theme_node, icon, size,
                                                   st_theme_context_get_scale_for_stage (),
                                                   1.0);
}


static ClutterActor *
load_from_pixbuf (GdkPixbuf *pixbuf,
                  int        paint_scale,
                  float      resource_scale)
{
  g_autoptr(ClutterContent) image = NULL;
  ClutterActor *actor;

  image = pixbuf_to_st_content_image (pixbuf, -1, -1, paint_scale, resource_scale);

  actor = g_object_new (CLUTTER_TYPE_ACTOR,
                        "request-mode", CLUTTER_REQUEST_CONTENT_SIZE,
                        NULL);
  clutter_actor_set_content (actor, image);

  return actor;
}

/**
 * st_texture_cache_load_from_pixbuf:
 * @pixbuf: A #GdkPixbuf
 * @size: int
 *
 * Converts a #GdkPixbuf into a #ClutterTexture.
 *
 * Return value: (transfer none): A new #ClutterActor
 */
ClutterActor *
st_texture_cache_load_from_pixbuf (GdkPixbuf *pixbuf,
                                   int        size)
{

  g_autoptr(ClutterContent) image = NULL;
  ClutterActor *actor;
  gfloat resource_scale;

  actor = g_object_new (CLUTTER_TYPE_ACTOR,
                        "request-mode", CLUTTER_REQUEST_CONTENT_SIZE,
                        NULL);

  clutter_actor_get_resource_scale (actor, &resource_scale);

  image = pixbuf_to_st_content_image (pixbuf,
                                      size, size,
                                      st_theme_context_get_scale_for_stage (),
                                      resource_scale);

  clutter_actor_set_content (actor, image);
  g_object_unref (image);

  return actor;
}

static void
hash_table_remove_with_scales (GHashTable *hash,
                               GList      *scales,
                               const char *base_key)
{
  GList *l;

  for (l = scales; l; l = l->next)
    {
      double scale = *((double *)l->data);
      g_autofree char *key = NULL;
      key = g_strdup_printf ("%s%f", base_key, scale);
      g_hash_table_remove (hash, key);
    }
}

static void
hash_table_insert_scale (GHashTable *hash,
                         double      scale)
{
  double *saved_scale;

  if (g_hash_table_contains (hash, &scale))
    return;

  saved_scale = g_new (double, 1);
  *saved_scale = scale;

  g_hash_table_add (hash, saved_scale);
}

static void
file_changed_cb (GFileMonitor      *monitor,
                 GFile             *file,
                 GFile             *other,
                 GFileMonitorEvent  event_type,
                 gpointer           user_data)
{
  StTextureCache *cache = user_data;
  char *key;
  guint file_hash;
  g_autoptr (GList) scales = NULL;

  if (event_type != G_FILE_MONITOR_EVENT_CHANGES_DONE_HINT)
    return;

  file_hash = g_file_hash (file);
  scales = g_hash_table_get_keys (cache->priv->used_scales);

  key = g_strdup_printf (CACHE_PREFIX_FILE "%u", file_hash);
  g_hash_table_remove (cache->priv->keyed_cache, key);
  hash_table_remove_with_scales (cache->priv->keyed_cache, scales, key);
  g_free (key);

  key = g_strdup_printf (CACHE_PREFIX_FILE_FOR_CAIRO "%u", file_hash);
  g_hash_table_remove (cache->priv->keyed_surface_cache, key);
  hash_table_remove_with_scales (cache->priv->keyed_surface_cache, scales, key);
  g_free (key);

  g_signal_emit (cache, signals[TEXTURE_FILE_CHANGED], 0, file);
}

static void
ensure_monitor_for_file (StTextureCache *cache,
                         GFile          *file)
{
  StTextureCachePrivate *priv = cache->priv;

  /* No point in trying to monitor files that are part of a
   * GResource, since it does not support file monitoring.
   */
  if (g_file_has_uri_scheme (file, "resource"))
    return;

  if (g_hash_table_lookup (priv->file_monitors, file) == NULL)
    {
      GFileMonitor *monitor = g_file_monitor_file (file, G_FILE_MONITOR_NONE,
                                                   NULL, NULL);
      g_signal_connect (monitor, "changed",
                        G_CALLBACK (file_changed_cb), cache);
      g_hash_table_insert (priv->file_monitors, g_object_ref (file), monitor);
    }
}

typedef struct {
  GFile *gfile;
  gint   grid_width, grid_height;
  gint   paint_scale;
  gfloat resource_scale;
  ClutterActor *actor;
  GCancellable *cancellable;
  GFunc load_callback;
  gpointer load_callback_data;
} AsyncImageData;

static void
on_data_destroy (gpointer data)
{
  AsyncImageData *d = (AsyncImageData *)data;
  g_object_unref (d->gfile);
  g_object_unref (d->actor);
  g_object_unref (d->cancellable);
  g_slice_free (AsyncImageData, d);
}

static void
on_sliced_image_actor_destroyed (ClutterActor *actor,
                                 gpointer data)
{
  GTask *task = data;
  GCancellable *cancellable = g_task_get_cancellable (task);

  g_cancellable_cancel (cancellable);
}

static void
on_sliced_image_loaded (GObject *source_object,
                        GAsyncResult *res,
                        gpointer user_data)
{
  GObject *cache = source_object;
  AsyncImageData *data = (AsyncImageData *)user_data;
  GTask *task = G_TASK (res);
  GList *list, *pixbufs;

  if (g_task_had_error (task) || g_cancellable_is_cancelled (data->cancellable))
    return;

  pixbufs = g_task_propagate_pointer (task, NULL);

  for (list = pixbufs; list; list = list->next)
    {
      ClutterActor *actor = load_from_pixbuf (GDK_PIXBUF (list->data),
                                              data->paint_scale,
                                              data->resource_scale);
      clutter_actor_hide (actor);
      clutter_actor_add_child (data->actor, actor);
    }

  g_list_free_full (pixbufs, g_object_unref);

  g_signal_handlers_disconnect_by_func (data->actor,
                                        on_sliced_image_actor_destroyed,
                                        task);

  if (data->load_callback != NULL)
    data->load_callback (cache, data->load_callback_data);
}

static void
free_glist_unref_gobjects (gpointer p)
{
  g_list_free_full (p, g_object_unref);
}

static void
on_loader_size_prepared (GdkPixbufLoader *loader,
                         gint width,
                         gint height,
                         gpointer user_data)
{
  AsyncImageData *data = user_data;
  int scale = ceilf (data->paint_scale * data->resource_scale);

  gdk_pixbuf_loader_set_size (loader, width * scale, height * scale);
}

static void
load_sliced_image (GTask        *result,
                   gpointer      object,
                   gpointer      task_data,
                   GCancellable *cancellable)
{
  AsyncImageData *data;
  GList *res = NULL;
  GdkPixbuf *pix;
  gint width, height, y, x;
  gint scale_factor;
  GdkPixbufLoader *loader;
  GError *error = NULL;
  gchar *buffer = NULL;
  gsize length;

  g_assert (cancellable);

  data = task_data;
  g_assert (data);

  loader = gdk_pixbuf_loader_new ();
  g_signal_connect (loader, "size-prepared", G_CALLBACK (on_loader_size_prepared), data);

  if (!g_file_load_contents (data->gfile, cancellable, &buffer, &length, NULL, &error))
    {
      g_warning ("Failed to open sliced image: %s", error->message);
      goto out;
    }

  if (!gdk_pixbuf_loader_write (loader, (const guchar *) buffer, length, &error))
    {
      g_warning ("Failed to load image: %s", error->message);
      goto out;
    }

  if (!gdk_pixbuf_loader_close (loader, NULL))
    goto out;

  pix = gdk_pixbuf_loader_get_pixbuf (loader);
  width = gdk_pixbuf_get_width (pix);
  height = gdk_pixbuf_get_height (pix);
  scale_factor = ceilf (data->paint_scale * data->resource_scale);
  for (y = 0; y < height; y += data->grid_height * scale_factor)
    {
      for (x = 0; x < width; x += data->grid_width * scale_factor)
        {
          GdkPixbuf *pixbuf = gdk_pixbuf_new_subpixbuf (pix, x, y,
                                                        data->grid_width * scale_factor,
                                                        data->grid_height * scale_factor);
          g_assert (pixbuf != NULL);
          res = g_list_append (res, pixbuf);
        }
    }

 out:
  /* We don't need the original pixbuf anymore, which is owned by the loader,
   * though the subpixbufs will hold a reference. */
  g_object_unref (loader);
  g_free (buffer);
  g_clear_pointer (&error, g_error_free);
  g_task_return_pointer (result, res, free_glist_unref_gobjects);
}

/**
 * st_texture_cache_load_sliced_image_file:
 * @cache: A #StTextureCache
 * @file: A #GFile
 * @grid_width: Width in pixels
 * @grid_height: Height in pixels
 * @paint_scale: Scale factor of the display
 * @load_callback: (scope async) (nullable): Function called when the image is loaded, or %NULL
 * @user_data: Data to pass to the load callback
 *
 * This function reads a single image file which contains multiple images internally.
 * The image file will be divided using @grid_width and @grid_height;
 * note that the dimensions of the image loaded from @path
 * should be a multiple of the specified grid dimensions.
 *
 * Returns: (transfer none): A new #ClutterActor
 */
ClutterActor *
st_texture_cache_load_sliced_image_file (StTextureCache *cache,
                                    GFile          *file,
                                    gint            grid_width,
                                    gint            grid_height,
                                    gint            paint_scale,
                                    gfloat          resource_scale,
                                    GFunc           load_callback,
                                    gpointer        user_data)
{
  AsyncImageData *data;
  GTask *result;
  ClutterActor *actor = clutter_actor_new ();
  GCancellable *cancellable = g_cancellable_new ();

  g_return_val_if_fail (G_IS_FILE (file), NULL);
  g_assert (paint_scale > 0);
  g_assert (resource_scale > 0);

  data = g_slice_new0 (AsyncImageData);
  data->grid_width = grid_width;
  data->grid_height = grid_height;
  data->paint_scale = paint_scale;
  data->resource_scale = resource_scale;
  data->gfile = g_object_ref (file);
  data->actor = actor;
  data->cancellable = cancellable;
  data->load_callback = load_callback;
  data->load_callback_data = user_data;
  g_object_ref (G_OBJECT (actor));

  result = g_task_new (cache, cancellable, on_sliced_image_loaded, data);

  g_signal_connect (actor, "destroy",
                    G_CALLBACK (on_sliced_image_actor_destroyed), result);

  g_task_set_task_data (result, data, on_data_destroy);
  g_task_run_in_thread (result, load_sliced_image);

  g_object_unref (result);

  return actor;
}

/**
 * st_texture_cache_load_sliced_image:
 * @cache: A #StTextureCache
 * @path: Path to a filename
 * @grid_width: Width in pixels
 * @grid_height: Height in pixels
 * @load_callback: (scope async) (allow-none): Function called when the image is loaded, or %NULL
 * @user_data: Data to pass to the load callback
 *
 * This function reads a single image file which contains multiple images internally.
 * The image file will be divided using @grid_width and @grid_height;
 * note that the dimensions of the image loaded from @path
 * should be a multiple of the specified grid dimensions.
 *
 * Returns: (transfer none): A new #ClutterActor
 */
ClutterActor *
st_texture_cache_load_sliced_image (StTextureCache *cache,
                                    const gchar    *path,
                                    gint            grid_width,
                                    gint            grid_height,
                                    GFunc           load_callback,
                                    gpointer        user_data)
{
    ClutterActor *actor;
    GFile *file = g_file_new_for_path (path);

    actor = st_texture_cache_load_sliced_image_file (cache, file,
                                                     grid_height,
                                                     grid_height,
                                                     st_theme_context_get_scale_for_stage (),
                                                     1.0,
                                                     load_callback, user_data);

    g_object_unref (file);

    return actor;
}

/**
 * st_texture_cache_load_file_async:
 * @cache: The texture cache instance
 * @file: a #GFile of the image file from which to create a pixbuf
 * @available_width: available width for the image, can be -1 if not limited
 * @available_height: available height for the image, can be -1 if not limited
 * @paint_scale: scale factor of the display
 * @resource_scale: Resource scale factor
 *
 * Asynchronously load an image.   Initially, the returned texture will have a natural
 * size of zero.  At some later point, either the image will be loaded successfully
 * and at that point size will be negotiated, or upon an error, no image will be set.
 *
 * Return value: (transfer none): A new #ClutterActor with no image loaded initially.
 */
ClutterActor *
st_texture_cache_load_file_async (StTextureCache *cache,
                                  GFile          *file,
                                  int             available_width,
                                  int             available_height,
                                  int             paint_scale,
                                  gfloat          resource_scale)
{
  ClutterActor *actor;
  AsyncTextureLoadData *request;
  StTextureCachePolicy policy;
  gchar *key;
  int scale;

  scale = ceilf (paint_scale * resource_scale);
  key = g_strdup_printf (CACHE_PREFIX_FILE "%u%d", g_file_hash (file), scale);

  policy = ST_TEXTURE_CACHE_POLICY_NONE; /* XXX */

  actor = create_invisible_actor ();

  if (ensure_request (cache, key, policy, &request, actor))
    {
      /* If there's an outstanding request, we've just added ourselves to it */
      g_free (key);
    }
  else
    {
      /* Else, make a new request */

      request->cache = cache;
      /* Transfer ownership of key */
      request->key = key;
      request->file = g_object_ref (file);
      request->policy = policy;
      request->width = available_width;
      request->height = available_height;
      request->paint_scale = paint_scale;
      request->resource_scale = resource_scale;

      load_texture_async (cache, request);
    }

  ensure_monitor_for_file (cache, file);

  return actor;
}

typedef struct {
  gchar *path;
  gint   width, height;
  guint handle;
  StTextureCacheLoadImageCallback load_callback;
  gpointer load_callback_data;
} ImageFromFileAsyncData;

static void
on_image_from_file_data_destroy (gpointer data)
{
  ImageFromFileAsyncData *d = (ImageFromFileAsyncData *)data;
  g_free (d->path);
  g_free (d);
}

static void
on_image_from_file_loaded (GObject      *source,
                           GAsyncResult *res,
                           gpointer      user_data)
{
  GTask *task = G_TASK (res);
  GdkPixbuf *pixbuf;
  ClutterContent *content;
  ClutterActor *actor;
  GError *error;
  ImageFromFileAsyncData *data;
  gint width, height;

  data = (ImageFromFileAsyncData *)user_data;
  error = NULL;

  actor = clutter_actor_new ();

  pixbuf = g_task_propagate_pointer (task, &error);
  width = gdk_pixbuf_get_width (pixbuf);
  height = gdk_pixbuf_get_height (pixbuf);

  if (error)
    {
      g_warning ("Could not load image from file: %s\n", error->message);
      g_error_free (error);

      data->load_callback (ST_TEXTURE_CACHE (source), data->handle, actor, data->load_callback_data);

      return;
    }

  content = clutter_image_new ();

  clutter_image_set_data (CLUTTER_IMAGE (content),
                          gdk_pixbuf_get_pixels (pixbuf),
                          gdk_pixbuf_get_has_alpha (pixbuf)
                              ? COGL_PIXEL_FORMAT_RGBA_8888
                              : COGL_PIXEL_FORMAT_RGB_888,
                          gdk_pixbuf_get_width (pixbuf),
                          gdk_pixbuf_get_height (pixbuf),
                          gdk_pixbuf_get_rowstride (pixbuf),
                          &error);

  g_object_unref (pixbuf);

  clutter_actor_set_content (actor, content);
  clutter_actor_set_size (actor, width, height);

  g_object_unref (content);

  data->load_callback (ST_TEXTURE_CACHE (source), data->handle, actor, data->load_callback_data);
}

static void
load_image_from_file_thread (GTask        *task,
                             gpointer      source,
                             gpointer      task_data,
                             GCancellable *cancellable)
{
  ImageFromFileAsyncData *data;
  GdkPixbuf *pixbuf;
  GError *error;

  data = task_data;
  error = NULL;

  pixbuf = gdk_pixbuf_new_from_file_at_scale (data->path,
                                              data->width,
                                              data->height,
                                              TRUE,
                                              &error);

  if (error)
    {
      g_task_return_error (task, error);
      return;
    }

  g_task_return_pointer (task, pixbuf, g_object_unref);
}

/**
 * st_texture_cache_load_image_from_file_async:
 * @cache: A #StTextureCache
 * @path: Path to a filename
 * @width: Width in pixels (or -1 to leave unconstrained)
 * @height: Height in pixels (or -1 to leave unconstrained)
 * @callback: (scope async) (not nullable): Function called when the image is loaded (required)
 * @user_data: Data to pass to the load callback
 *
 * This function loads an image file into a clutter actor asynchronously.  This is
 * mostly useful for situations where you want to load an image asynchronously, but don't
 * want the actor back until it's fully loaded and sized (as opposed to load_uri_async,
 * which provides no callback function, and leaves size negotiation to its own devices.)
 * 
 * The image's aspect ratio is always maintained and if both width and height are > 0
 * the image will never exceed these dimensions.
 * 
 * Return Value: A handle that can be used to verify the actor issued in the callback
 * is the expected one.
 */
guint
st_texture_cache_load_image_from_file_async (StTextureCache                  *cache,
                                             const gchar                     *path,
                                             gint                             width,
                                             gint                             height,
                                             StTextureCacheLoadImageCallback  callback,
                                             gpointer                         user_data)
{
  gint scale;
  if (callback == NULL)
    {
      g_warning ("st_texture_cache_load_image_from_file_async callback cannot be NULL");
      return 0;
    }

  ImageFromFileAsyncData *data;
  GTask *result;
  scale = st_theme_context_get_scale_for_stage (),
  data = g_new0 (ImageFromFileAsyncData, 1);
  data->width = width == -1 ? -1 : width * scale;
  data->height = height == -1 ? -1 : height * scale;

  static gint handles = 1;
  data->handle = handles++;

  data->path = g_strdup (path);
  data->load_callback = callback;
  data->load_callback_data = user_data;

  result = g_task_new (cache, NULL, on_image_from_file_loaded, data);
  g_task_set_task_data (result, data, on_image_from_file_data_destroy);
  g_task_run_in_thread (result, load_image_from_file_thread);

  g_object_unref (result);

  return data->handle;
}

/**
 * st_texture_cache_load_from_raw:
 * @cache: a #StTextureCache
 * @data: (array length=len): raw pixel data
 * @len: the length of @data
 * @has_alpha: whether @data includes an alpha channel
 * @width: width in pixels of @data
 * @height: width in pixels of @data
 * @rowstride: rowstride of @data
 * @size: size of icon to return
 *
 * Creates (or retrieves from cache) an icon based on raw pixel data.
 *
 * Return value: (transfer none): a new #ClutterActor displaying a
 * pixbuf created from @data and the other parameters.
 **/
ClutterActor *
st_texture_cache_load_from_raw (StTextureCache    *cache,
                                const guchar      *data,
                                gsize              len,
                                gboolean           has_alpha,
                                int                width,
                                int                height,
                                int                rowstride,
                                int                size,
                                GError           **error)
{
  ClutterActor *actor;
  ClutterContent *image;

  size *= st_theme_context_get_scale_for_stage ();
  image = st_image_content_new_with_preferred_size (size, size);

  clutter_image_set_data (CLUTTER_IMAGE (image),
                          data,
                          has_alpha ? COGL_PIXEL_FORMAT_RGBA_8888 : COGL_PIXEL_FORMAT_RGB_888,
                          width,
                          height,
                          rowstride,
                          error);

  actor = g_object_new (CLUTTER_TYPE_ACTOR,
                        "request-mode", CLUTTER_REQUEST_CONTENT_SIZE,
                        NULL);

  if (*error)
    {
      g_clear_object (&image);
      return actor;
    }

  clutter_actor_set_content (actor, image);
  g_object_unref (image);

  return actor;
}

/**
 * st_texture_cache_load_file_simple:
 * @cache: A #StTextureCache
 * @file_path: Filesystem path
 *
 * Synchronously load an image into a texture.  The texture will be cached
 * indefinitely.  On error, this function returns an empty texture and prints a warning.
 *
 * Returns: (transfer none): A new #ClutterTexture
 */
ClutterActor *
st_texture_cache_load_file_simple (StTextureCache *cache,
                                   const gchar    *file_path)
{
  ClutterActor *actor;
  CoglTexture *texture;
  ClutterContent *image;

  texture = st_texture_cache_load_file_to_cogl_texture (cache, file_path);
  image = clutter_texture_content_new_from_texture (texture, NULL);
  cogl_object_unref (texture);

  actor = g_object_new (CLUTTER_TYPE_ACTOR,
                        "request-mode", CLUTTER_REQUEST_CONTENT_SIZE,
                        NULL);

  clutter_actor_set_content (actor, image);

  return actor;
}

static char *
symbolic_name_for_icon (const char *name)
{
    if (!name) {
        return NULL;
    }

    if (g_str_has_suffix (name, "-symbolic")) {
        return g_strdup (name);
    }

    return g_strdup_printf ("%s-symbolic", name);
}

/**
 * st_texture_cache_load_icon_name:
 * @cache: The texture cache instance
 * @theme_node: (allow-none): a #StThemeNode
 * @name: Name of a themed icon
 * @icon_type: the type of icon to load
 * @size: Size of themed
 *
 * Load a themed icon into a texture. See the #StIconType documentation
 * for an explanation of how @icon_type affects the returned icon. The
 * colors used for symbolic icons are derived from @theme_node.
 *
 * Return Value: (transfer none): A new #ClutterTexture for the icon
 */
ClutterActor *
st_texture_cache_load_icon_name (StTextureCache    *cache,
                                 StThemeNode       *theme_node,
                                 const char        *name,
                                 StIconType         icon_type,
                                 gint               size)
{
  ClutterActor *texture;
  GIcon *themed;
  char *symbolic_name;

  g_return_val_if_fail (!(icon_type == ST_ICON_SYMBOLIC && theme_node == NULL), NULL);

  switch (icon_type)
    {
    case ST_ICON_APPLICATION:
      themed = g_themed_icon_new (name);
      texture = st_texture_cache_load_gicon (cache, theme_node, themed, size);
      g_object_unref (themed);
      if (texture == NULL)
        {
          themed = g_themed_icon_new ("application-x-executable");
          texture = st_texture_cache_load_gicon (cache, theme_node, themed, size);
          g_object_unref (themed);
        }
      return CLUTTER_ACTOR (texture);
      break;
    case ST_ICON_DOCUMENT:
      themed = g_themed_icon_new (name);
      texture = st_texture_cache_load_gicon (cache, theme_node, themed, size);
      g_object_unref (themed);
      if (texture == NULL)
        {
          themed = g_themed_icon_new ("x-office-document");
          texture = st_texture_cache_load_gicon (cache, theme_node, themed, size);
          g_object_unref (themed);
        }

      return CLUTTER_ACTOR (texture);
      break;
    case ST_ICON_SYMBOLIC:
      symbolic_name = symbolic_name_for_icon (name);
      themed = g_themed_icon_new (symbolic_name);
      g_free (symbolic_name);
      texture = st_texture_cache_load_gicon (cache, theme_node, themed, size);
      g_object_unref (themed);

      return CLUTTER_ACTOR (texture);
      break;
    case ST_ICON_FULLCOLOR:
      themed = g_themed_icon_new (name);
      texture = st_texture_cache_load_gicon (cache, theme_node, themed, size);
      g_object_unref (themed);
      if (texture == NULL)
        {
          themed = g_themed_icon_new ("image-missing");
          texture = st_texture_cache_load_gicon (cache, theme_node, themed, size);
          g_object_unref (themed);
        }

      return CLUTTER_ACTOR (texture);
      break;
    default:
      g_assert_not_reached ();
    }
}

/**
 * st_texture_cache_load_uri_async:
 * @cache: The texture cache instance
 * @uri: uri of the image file from which to create a pixbuf
 * @available_width: available width for the image, can be -1 if not limited
 * @available_height: available height for the image, can be -1 if not limited
 *
 * Asynchronously load an image.   Initially, the returned texture will have a natural
 * size of zero.  At some later point, either the image will be loaded successfully
 * and at that point size will be negotiated, or upon an error, no image will be set.
 *
 * Return value: (transfer none): A new #ClutterActor with no image loaded initially.
 */
ClutterActor *
st_texture_cache_load_uri_async (StTextureCache *cache,
                                 const gchar    *uri,
                                 int             available_width,
                                 int             available_height)
{
    ClutterActor *actor;
    GFile *file = g_file_new_for_uri (uri);

    actor = st_texture_cache_load_file_async (cache, file,
                                              available_width, available_height,
                                              st_theme_context_get_scale_for_stage (),
                                              1.0);

    g_object_unref (file);
    return actor;
}

static CoglTexture *
st_texture_cache_load_file_sync_to_cogl_texture (StTextureCache *cache,
                                                 StTextureCachePolicy policy,
                                                 GFile          *file,
                                                 int             available_width,
                                                 int             available_height,
                                                 int             paint_scale,
                                                 gfloat          resource_scale,
                                                 GError         **error)
{
  ClutterContent *image;
  CoglTexture *texdata;
  GdkPixbuf *pixbuf;
  char *key;

  key = g_strdup_printf (CACHE_PREFIX_FILE "%u%f", g_file_hash (file), resource_scale);

  texdata = NULL;
  image = g_hash_table_lookup (cache->priv->keyed_cache, key);

  if (image == NULL)
    {
      pixbuf = impl_load_pixbuf_file (file, available_width, available_height,
                                      paint_scale, resource_scale, error);
      if (!pixbuf)
        goto out;

      image = pixbuf_to_st_content_image (pixbuf,
                                          available_height, available_width,
                                          paint_scale, resource_scale);
      g_object_unref (pixbuf);

      if (!image)
        goto out;

      if (policy == ST_TEXTURE_CACHE_POLICY_FOREVER)
        {
          g_hash_table_insert (cache->priv->keyed_cache, g_strdup (key), image);
          hash_table_insert_scale (cache->priv->used_scales, (double)resource_scale);
        }
    }

  /* Because the texture is loaded synchronously, we won't call
   * clutter_image_set_data(), so it's safe to use the texture
   * of ClutterImage here. */
  texdata = clutter_image_get_texture (CLUTTER_IMAGE (image));
  cogl_object_ref (texdata);

  ensure_monitor_for_file (cache, file);

out:
  g_free (key);
  return texdata;
}

static cairo_surface_t *
st_texture_cache_load_file_sync_to_cairo_surface (StTextureCache        *cache,
                                                  StTextureCachePolicy   policy,
                                                  GFile                 *file,
                                                  int                    available_width,
                                                  int                    available_height,
                                                  int                    paint_scale,
                                                  gfloat                 resource_scale,
                                                  GError               **error)
{
  cairo_surface_t *surface;
  GdkPixbuf *pixbuf;
  char *key;

  key = g_strdup_printf (CACHE_PREFIX_FILE_FOR_CAIRO "%u%f", g_file_hash (file), resource_scale);

  surface = g_hash_table_lookup (cache->priv->keyed_surface_cache, key);

  if (surface == NULL)
    {
      pixbuf = impl_load_pixbuf_file (file, available_width, available_height,
                                      paint_scale, resource_scale, error);
      if (!pixbuf)
        goto out;

      surface = pixbuf_to_cairo_surface (pixbuf);
      g_object_unref (pixbuf);

      if (policy == ST_TEXTURE_CACHE_POLICY_FOREVER)
        {
          cairo_surface_reference (surface);
          g_hash_table_insert (cache->priv->keyed_surface_cache,
                               g_strdup (key), surface);
          hash_table_insert_scale (cache->priv->used_scales, (double)resource_scale);
        }
    }
  else
    cairo_surface_reference (surface);

  ensure_monitor_for_file (cache, file);

out:
  g_free (key);
  return surface;
}

/**
 * st_texture_cache_load_gfile_to_cogl_texture: (skip)
 * @cache: A #StTextureCache
 * @file: A #GFile in supported image format
 * @paint_scale: Scale factor of the display
 * @resource_scale: Resource scale factor
 *
 * This function synchronously loads the given file path
 * into a COGL texture.  On error, a warning is emitted
 * and %NULL is returned.
 *
 * Returns: (transfer full): a new #CoglTexture
 */
CoglTexture *
st_texture_cache_load_gfile_to_cogl_texture (StTextureCache *cache,
                                            GFile          *file,
                                            gint            paint_scale,
                                            gfloat          resource_scale)
{
  CoglTexture *texture;
  GError *error = NULL;

  texture = st_texture_cache_load_file_sync_to_cogl_texture (cache, ST_TEXTURE_CACHE_POLICY_FOREVER,
                                                             file, -1, -1, paint_scale, resource_scale,
                                                             &error);

  if (texture == NULL)
    {
      char *uri = g_file_get_uri (file);
      g_warning ("Failed to load %s: %s", uri, error->message);
      g_clear_error (&error);
      g_free (uri);
    }

  return texture;
}

/**
 * st_texture_cache_load_file_to_cogl_texture: (skip)
 * @cache: A #StTextureCache
 * @file_path: Path to a file in supported image format
 *
 * This function synchronously loads the given file path
 * into a COGL texture.  On error, a warning is emitted
 * and %NULL is returned.
 *
 * Returns: (transfer full): a new #CoglTexture
 */
CoglTexture *
st_texture_cache_load_file_to_cogl_texture (StTextureCache *cache,
                                            const gchar    *file_path)
{
    GFile *file = g_file_new_for_path (file_path);
    CoglTexture *texture;

    texture = st_texture_cache_load_gfile_to_cogl_texture (cache, file,
                                                           st_theme_context_get_scale_for_stage (),
                                                           1.0);
    g_object_unref (file);

    return texture;
}

/**
 * st_texture_cache_load_gfile_to_cairo_surface:
 * @cache: A #StTextureCache
 * @file: A #GFile in supported image format
 * @paint_scale: Scale factor of the display
 * @resource_scale: Resource scale factor
 *
 * This function synchronously loads the given file path
 * into a cairo surface.  On error, a warning is emitted
 * and %NULL is returned.
 *
 * Returns: (transfer full): a new #cairo_surface_t
 */
cairo_surface_t *
st_texture_cache_load_gfile_to_cairo_surface (StTextureCache *cache,
                                             GFile          *file,
                                             gint            paint_scale,
                                             gfloat          resource_scale)
{
  cairo_surface_t *surface;
  GError *error = NULL;

  surface = st_texture_cache_load_file_sync_to_cairo_surface (cache, ST_TEXTURE_CACHE_POLICY_FOREVER,
                                                              file, -1, -1, paint_scale, resource_scale,
                                                              &error);

  if (surface == NULL)
    {
      char *uri = g_file_get_uri (file);
      g_warning ("Failed to load %s: %s", uri, error->message);
      g_clear_error (&error);
      g_free (uri);
    }

  return surface;
}

/**
 * st_texture_cache_load_file_to_cairo_surface:
 * @cache: A #StTextureCache
 * @file_path: Path to a file in supported image format
 *
 * This function synchronously loads the given file path
 * into a cairo surface.  On error, a warning is emitted
 * and %NULL is returned.
 *
 * Returns: (transfer full): a new #cairo_surface_t
 */
cairo_surface_t *
st_texture_cache_load_file_to_cairo_surface (StTextureCache *cache,
                                             const gchar    *file_path)
{
    GFile *file = g_file_new_for_path (file_path);

    cairo_surface_t *surface = st_texture_cache_load_gfile_to_cairo_surface (cache, file,
                                                                             st_theme_context_get_scale_for_stage (),
                                                                             1.0);
    g_object_unref (file);

    return surface;
}

static StTextureCache *instance = NULL;

/**
 * st_texture_cache_get_default:
 *
 * Return value: (transfer none): The global texture cache
 */
StTextureCache*
st_texture_cache_get_default (void)
{
  if (instance == NULL)
    instance = g_object_new (ST_TYPE_TEXTURE_CACHE, NULL);
  return instance;
}

gboolean
st_texture_cache_rescan_icon_theme (StTextureCache *cache)
{
  StTextureCachePrivate *priv = cache->priv;

  return gtk_icon_theme_rescan_if_needed (priv->icon_theme);
}

/**
 * st_texture_cache_get_icon_theme:
 *
 * Return value: (transfer none): The texture cache's icon theme
 */
GtkIconTheme *
st_texture_cache_get_icon_theme (StTextureCache *cache)
{
  StTextureCachePrivate *priv = cache->priv;

  return priv->icon_theme;
}