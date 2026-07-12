/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include <clutter/clutter.h>
#include <cogl/cogl.h>
#include <meta/display.h>
#include <meta/util.h>
#include <meta/meta-plugin.h>
#include <meta/meta-shaped-texture.h>
#include <meta/meta-cursor-tracker.h>
#include <meta/meta-shadow-factory.h>
#include <meta/meta-window-shape.h>

#include "cinnamon-global.h"
#include "cinnamon-screenshot.h"
#include "st.h"

struct _CinnamonScreenshotClass
{
  GObjectClass parent_class;
};

struct _CinnamonScreenshot
{
  GObject parent_instance;

  CinnamonGlobal *global;
};

/* Used for async screenshot grabbing */
typedef struct _screenshot_data {
  CinnamonScreenshot  *screenshot;
  MetaWindow *window;

  char *filename;

  cairo_surface_t *image;
  GBytes *png_bytes;
  cairo_rectangle_int_t screenshot_area;

  gboolean include_cursor;
  gboolean include_shadow;
  gboolean copy_to_clipboard;

  CinnamonScreenshotCallback callback;

  CinnamonScreenshotPickColorCallback pick_callback;
  ClutterColor pick_color;
} _screenshot_data;

G_DEFINE_TYPE(CinnamonScreenshot, cinnamon_screenshot, G_TYPE_OBJECT);

static void
cinnamon_screenshot_class_init (CinnamonScreenshotClass *screenshot_class)
{
  (void) screenshot_class;
}

static void
cinnamon_screenshot_init (CinnamonScreenshot *screenshot)
{
  screenshot->global = cinnamon_global_get ();
}

static cairo_status_t
append_png_chunk (void                *closure,
                  const unsigned char *data,
                  unsigned int         length)
{
  g_byte_array_append ((GByteArray *) closure, data, length);
  return CAIRO_STATUS_SUCCESS;
}

static gboolean
encode_png_bytes (_screenshot_data *screenshot_data)
{
  GByteArray *buffer = g_byte_array_new ();

  if (cairo_surface_write_to_png_stream (screenshot_data->image,
                                         append_png_chunk, buffer) == CAIRO_STATUS_SUCCESS)
    {
      screenshot_data->png_bytes = g_byte_array_free_to_bytes (buffer);
      return TRUE;
    }

  g_byte_array_free (buffer, TRUE);
  return FALSE;
}

static void
on_screenshot_written (GObject *source,
                       GAsyncResult *result,
                       gpointer user_data)
{
  _screenshot_data *screenshot_data = (_screenshot_data*) user_data;
  gboolean success = g_simple_async_result_get_op_res_gboolean (G_SIMPLE_ASYNC_RESULT (result));

  if (success && screenshot_data->png_bytes)
    {
      st_clipboard_set_content (st_clipboard_get_default (),
                                ST_CLIPBOARD_TYPE_CLIPBOARD,
                                "image/png",
                                screenshot_data->png_bytes);
    }

  if (screenshot_data->callback)
    screenshot_data->callback (screenshot_data->screenshot,
                               success,
                               &screenshot_data->screenshot_area);

  cairo_surface_destroy (screenshot_data->image);
  g_clear_pointer (&screenshot_data->png_bytes, g_bytes_unref);
  g_object_unref (screenshot_data->screenshot);
  g_free (screenshot_data->filename);
  g_free (screenshot_data);
}

static void
write_screenshot_thread (GSimpleAsyncResult *result,
                         GObject *object,
                         GCancellable *cancellable)
{
  _screenshot_data *screenshot_data = g_async_result_get_user_data (G_ASYNC_RESULT (result));
  gboolean ok;
  g_assert (screenshot_data != NULL);

  ok = cairo_surface_write_to_png (screenshot_data->image,
                                   screenshot_data->filename) == CAIRO_STATUS_SUCCESS;

  /* Encode to PNG here (off the main loop); the actual clipboard hand-off
   * happens back on the main thread in on_screenshot_written, since St
   * touches the compositor's selection state. */
  if (ok && screenshot_data->copy_to_clipboard)
    ok = encode_png_bytes (screenshot_data);

  g_simple_async_result_set_op_res_gboolean (result, ok);
}

static void
do_grab_screenshot (_screenshot_data *screenshot_data,
                    ClutterActor     *stage,
                    int               x,
                    int               y,
                    int               width,
                    int               height)
{
  cairo_rectangle_int_t rect = { .x = x, .y = y, .width = width, .height = height };
  ClutterCapture *captures = NULL;
  int n_captures = 0;
  cairo_t *cr;
  int i;

  screenshot_data->image = cairo_image_surface_create (CAIRO_FORMAT_ARGB32,
                                                       width, height);

  cr = cairo_create (screenshot_data->image);

  /* Opaque black background so any gap not covered by a monitor (irregular
   * multi-monitor layouts) ends up black rather than transparent. */
  cairo_set_source_rgb (cr, 0, 0, 0);
  cairo_paint (cr);

  /* Capture every stage view that intersects the requested rect and
   * composite each one at its position. On the Wayland native backend
   * each monitor is a separate view with its own framebuffer, so reading
   * a single framebuffer (as we used to) only ever captured one monitor. */
  if (clutter_stage_capture (CLUTTER_STAGE (stage), FALSE, &rect,
                             &captures, &n_captures))
    {
      for (i = 0; i < n_captures; i++)
        {
          cairo_save (cr);
          cairo_translate (cr,
                           captures[i].rect.x - x,
                           captures[i].rect.y - y);
          cairo_rectangle (cr, 0, 0,
                           captures[i].rect.width, captures[i].rect.height);
          cairo_clip (cr);
          cairo_set_source_surface (cr, captures[i].image, 0, 0);
          cairo_paint (cr);
          cairo_restore (cr);

          cairo_surface_destroy (captures[i].image);
        }

      g_free (captures);
    }

  cairo_destroy (cr);
  cairo_surface_mark_dirty (screenshot_data->image);
}

static void
_draw_cursor_image (cairo_surface_t       *surface,
                   cairo_rectangle_int_t  area)
{
  CoglTexture *texture;
  int width, height;
  int stride;
  guint8 *data;
  MetaDisplay *display;
  MetaCursorTracker *tracker;
  cairo_surface_t *cursor_surface;
  cairo_region_t *screenshot_region;
  cairo_t *cr;
  int x, y;
  int xhot, yhot;
  double xscale, yscale;
  graphene_point_t point;

  display = cinnamon_global_get_display (cinnamon_global_get ());
  tracker = meta_cursor_tracker_get_for_display (display);
  texture = meta_cursor_tracker_get_sprite (tracker);

  if (!texture)
    return;

  screenshot_region = cairo_region_create_rectangle (&area);
  meta_cursor_tracker_get_pointer (tracker, &point, NULL);
  x = point.x;
  y = point.y;

  if (!cairo_region_contains_point (screenshot_region, x, y))
    {
      cairo_region_destroy (screenshot_region);
      return;
    }

  meta_cursor_tracker_get_hot (tracker, &xhot, &yhot);
  width = cogl_texture_get_width (texture);
  height = cogl_texture_get_height (texture);
  stride = 4 * width;
  data = g_new (guint8, stride * height);
  cogl_texture_get_data (texture, CLUTTER_CAIRO_FORMAT_ARGB32, stride, data);

  /* FIXME: cairo-gl? */
  cursor_surface = cairo_image_surface_create_for_data (data,
                                                        CAIRO_FORMAT_ARGB32,
                                                        width, height,
                                                        stride);

  cairo_surface_get_device_scale (surface, &xscale, &yscale);

  if (xscale != 1.0 || yscale != 1.0)
    {
      int monitor;
      float monitor_scale;
      MetaRectangle cursor_rect = {
        .x = x, .y = y, .width = width, .height = height
      };

      monitor = meta_display_get_monitor_index_for_rect (display, &cursor_rect);
      monitor_scale = meta_display_get_monitor_scale (display, monitor);

      cairo_surface_set_device_scale (cursor_surface, monitor_scale, monitor_scale);
    }

  cr = cairo_create (surface);
  cairo_set_source_surface (cr,
                            cursor_surface,
                            x - xhot - area.x,
                            y - yhot - area.y);
  cairo_paint (cr);

  cairo_destroy (cr);
  cairo_surface_destroy (cursor_surface);
  cairo_region_destroy (screenshot_region);
  g_free (data);
}

static void
grab_screenshot (ClutterActor     *stage,
                 _screenshot_data *screenshot_data)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot_data->screenshot->global);
  int width, height;
  GSimpleAsyncResult *result;

  meta_display_get_size (display, &width, &height);

  do_grab_screenshot (screenshot_data, stage, 0, 0, width, height);

  screenshot_data->screenshot_area.x = 0;
  screenshot_data->screenshot_area.y = 0;
  screenshot_data->screenshot_area.width = width;
  screenshot_data->screenshot_area.height = height;

  if (screenshot_data->include_cursor)
    _draw_cursor_image (screenshot_data->image, screenshot_data->screenshot_area);

  g_signal_handlers_disconnect_by_func (stage, (void *)grab_screenshot, (gpointer)screenshot_data);

  meta_enable_unredirect_for_display (display);

  result = g_simple_async_result_new (NULL, on_screenshot_written, (gpointer)screenshot_data, grab_screenshot);
  g_simple_async_result_run_in_thread (result, write_screenshot_thread, G_PRIORITY_DEFAULT, NULL);
  g_object_unref (result);
}

static void
grab_area_screenshot (ClutterActor     *stage,
                      _screenshot_data *screenshot_data)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot_data->screenshot->global);
  GSimpleAsyncResult *result;

  do_grab_screenshot (screenshot_data,
                      stage,
                      screenshot_data->screenshot_area.x,
                      screenshot_data->screenshot_area.y,
                      screenshot_data->screenshot_area.width,
                      screenshot_data->screenshot_area.height);

  if (screenshot_data->include_cursor)
    _draw_cursor_image (screenshot_data->image, screenshot_data->screenshot_area);

  g_signal_handlers_disconnect_by_func (stage, (void *)grab_area_screenshot, (gpointer)screenshot_data);

  meta_enable_unredirect_for_display (display);

  result = g_simple_async_result_new (NULL, on_screenshot_written, (gpointer)screenshot_data, grab_area_screenshot);
  g_simple_async_result_run_in_thread (result, write_screenshot_thread, G_PRIORITY_DEFAULT, NULL);
  g_object_unref (result);
}

static void
zero_corner_semitransparent_pixels (cairo_surface_t *surface)
{
  int width    = cairo_image_surface_get_width (surface);
  int height   = cairo_image_surface_get_height (surface);
  int stride   = cairo_image_surface_get_stride (surface);
  guchar *data = cairo_image_surface_get_data (surface);

  int corner_size  = MIN (10, MIN (width, height));
  guint8 threshold = 160;

  cairo_surface_flush (surface);

  for (int y = 0; y < corner_size; y++)
    {
      guint32 *top_row    = (guint32 *)(data + y * stride);
      guint32 *bottom_row = (guint32 *)(data + (height - 1 - y) * stride);

      for (int x = 0; x < corner_size; x++)
        {
          if (((top_row[x] >> 24) & 0xff) < threshold)
            top_row[x] = 0;
          if (((bottom_row[x] >> 24) & 0xff) < threshold)
            bottom_row[x] = 0;
        }

      for (int x = width - corner_size; x < width; x++)
        {
          if (((top_row[x] >> 24) & 0xff) < threshold)
            top_row[x] = 0;
          if (((bottom_row[x] >> 24) & 0xff) < threshold)
            bottom_row[x] = 0;
        }
    }

  cairo_surface_mark_dirty (surface);
}

static gboolean
window_should_get_compositor_shadow (MetaWindow *window)
{
  // Mirror muffin's should_have_shadow() (meta-window-actor-x11.c) so we
  // don't paint a rectangular drop shadow around fullscreen, fully-
  // maximized, or tiled windows.
  MetaMaximizeFlags maximized = meta_window_get_maximized (window);

  if (maximized == META_MAXIMIZE_BOTH)
    return FALSE;
  if (meta_window_is_fullscreen (window))
    return FALSE;

  MetaTileMode tile_mode = META_TILE_NONE;
  g_object_get (window, "tile-mode", &tile_mode, NULL);
  if ((maximized & META_MAXIMIZE_VERTICAL) &&
      !(maximized & META_MAXIMIZE_HORIZONTAL) &&
      tile_mode != META_TILE_NONE)
    return FALSE;

  return TRUE;
}

static void
grab_window_screenshot (ClutterActor *stage,
                        ClutterPaintContext *paint_context,
                        _screenshot_data *screenshot_data)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot_data->screenshot->global);
  GSimpleAsyncResult *result;
  ClutterActor *window_actor;
  gfloat actor_x, actor_y;
  MetaShapedTexture *stex;
  MetaRectangle rect;
  cairo_rectangle_int_t clip;

  g_return_if_fail (META_IS_WINDOW (screenshot_data->window));

  window_actor = CLUTTER_ACTOR (meta_window_get_compositor_private (screenshot_data->window));
  clutter_actor_get_position (window_actor, &actor_x, &actor_y);

  gboolean has_frame = meta_window_get_frame (screenshot_data->window) != NULL;

  if (has_frame && screenshot_data->include_shadow &&
      window_should_get_compositor_shadow (screenshot_data->window))
    {
      // SSD with frame — capture the frame texture and add the compositor shadow beneath it
      meta_window_get_frame_rect (screenshot_data->window, &rect);

      // Determine shadow class, mirroring the logic in meta-window-actor-x11.c
      const char *shadow_class;
      MetaWindowType window_type = meta_window_get_window_type (screenshot_data->window);
      switch (window_type)
        {
        case META_WINDOW_DROPDOWN_MENU:
        case META_WINDOW_COMBO:
          shadow_class = "dropdown-menu";
          break;
        case META_WINDOW_POPUP_MENU:
          shadow_class = "popup-menu";
          break;
        default:
          shadow_class = meta_frame_type_to_string (meta_window_get_frame_type (screenshot_data->window));
          break;
        }

      gboolean appears_focused = meta_window_appears_focused (screenshot_data->window);
      MetaShadowFactory *factory = meta_shadow_factory_get_default ();
      MetaShadowParams params;
      meta_shadow_factory_get_params (factory, shadow_class, appears_focused, &params);

      cairo_rectangle_int_t frame_shape_rect = { 0, 0, rect.width, rect.height };
      cairo_region_t *shape_region = cairo_region_create_rectangle (&frame_shape_rect);
      MetaWindowShape *shape = meta_window_shape_new (shape_region);
      cairo_region_destroy (shape_region);

      MetaShadow *shadow = meta_shadow_factory_get_shadow (factory, shape,
                                                           rect.width, rect.height,
                                                           shadow_class, appears_focused);
      meta_window_shape_unref (shape);

      cairo_rectangle_int_t shadow_bounds;
      meta_shadow_get_bounds (shadow, params.x_offset, params.y_offset,
                              rect.width, rect.height, &shadow_bounds);

      int total_w = shadow_bounds.width;
      int total_h = shadow_bounds.height;
      int win_x_in_buf = params.x_offset - shadow_bounds.x;
      int win_y_in_buf = params.y_offset - shadow_bounds.y;

      // Capture the window frame texture
      cairo_rectangle_int_t win_clip;
      win_clip.x      = rect.x - (gint) actor_x;
      win_clip.y      = rect.y - (gint) actor_y;
      win_clip.width  = rect.width;
      win_clip.height = rect.height;

      stex = META_SHAPED_TEXTURE (meta_window_actor_get_texture (META_WINDOW_ACTOR (window_actor)));
      cairo_surface_t *win_image = meta_shaped_texture_get_image (stex, &win_clip);

      // Create offscreen buffer to render shadow into
      ClutterBackend *backend = clutter_get_default_backend ();
      CoglContext *cogl_ctx = clutter_backend_get_cogl_context (backend);
      CoglTexture2D *tex2d = cogl_texture_2d_new_with_size (cogl_ctx, total_w, total_h);
      CoglOffscreen *offscreen = cogl_offscreen_new_with_texture (COGL_TEXTURE (tex2d));
      CoglFramebuffer *shadow_fb = COGL_FRAMEBUFFER (offscreen);
      cogl_object_unref (tex2d);

      GError *fb_error = NULL;
      if (win_image != NULL && cogl_framebuffer_allocate (shadow_fb, &fb_error))
        {
          CoglColor clear_color;
          cogl_color_init_from_4ub (&clear_color, 0, 0, 0, 0);
          cogl_framebuffer_clear (shadow_fb, COGL_BUFFER_BIT_COLOR, &clear_color);
          cogl_framebuffer_orthographic (shadow_fb, 0, 0, total_w, total_h, 0, 1.0);

          meta_shadow_paint (shadow, shadow_fb,
                             win_x_in_buf, win_y_in_buf,
                             rect.width, rect.height,
                             params.opacity, NULL, FALSE);

          cairo_surface_t *result = cairo_image_surface_create (CAIRO_FORMAT_ARGB32, total_w, total_h);
          cogl_framebuffer_read_pixels (shadow_fb, 0, 0, total_w, total_h,
                                        CLUTTER_CAIRO_FORMAT_ARGB32,
                                        cairo_image_surface_get_data (result));
          cairo_surface_mark_dirty (result);

          cairo_t *cr = cairo_create (result);
          cairo_set_source_surface (cr, win_image, win_x_in_buf, win_y_in_buf);
          cairo_paint (cr);
          cairo_destroy (cr);
          cairo_surface_destroy (win_image);

          screenshot_data->image = result;
          screenshot_data->screenshot_area.x      = rect.x + shadow_bounds.x;
          screenshot_data->screenshot_area.y      = rect.y + shadow_bounds.y;
          screenshot_data->screenshot_area.width  = total_w;
          screenshot_data->screenshot_area.height = total_h;
        }
      else
        {
          if (fb_error)
            {
              g_warning ("cinnamon-screenshot: failed to allocate shadow framebuffer: %s",
                         fb_error->message);
              g_error_free (fb_error);
            }
          if (win_image)
            cairo_surface_destroy (win_image);
          screenshot_data->image = NULL;
          screenshot_data->screenshot_area.x      = rect.x;
          screenshot_data->screenshot_area.y      = rect.y;
          screenshot_data->screenshot_area.width  = rect.width;
          screenshot_data->screenshot_area.height = rect.height;
        }

      cogl_object_unref (shadow_fb);
      meta_shadow_unref (shadow);
    }
  else
    {
      if (!has_frame && screenshot_data->include_shadow)
        {
          // CSD with frame — use buffer_rect to capture the full shadow
          meta_window_get_buffer_rect (screenshot_data->window, &rect);

          screenshot_data->screenshot_area.x = rect.x;
          screenshot_data->screenshot_area.y = rect.y;

          clip.x = 0;
          clip.y = 0;
        }
      else if (!has_frame && !screenshot_data->include_shadow)
        {
          // CSD without frame — use frame_rect to exclude the shadow
          meta_window_get_frame_rect (screenshot_data->window, &rect);

          screenshot_data->screenshot_area.x = rect.x;
          screenshot_data->screenshot_area.y = rect.y;

          clip.x = rect.x - (gint) actor_x;
          clip.y = rect.y - (gint) actor_y;
        }
      else
        {
          // SSD with frame, no compositor shadow drawn — either because
          // the caller didn't ask for one, or because the window is
          // fullscreen/maximized/tiled and shouldn't have one anyway.
          meta_window_get_frame_rect (screenshot_data->window, &rect);

          screenshot_data->screenshot_area.x = rect.x;
          screenshot_data->screenshot_area.y = rect.y;

          clip.x = rect.x - (gint) actor_x;
          clip.y = rect.y - (gint) actor_y;
        }

      clip.width = screenshot_data->screenshot_area.width = rect.width;
      clip.height = screenshot_data->screenshot_area.height = rect.height;

      stex = META_SHAPED_TEXTURE (meta_window_actor_get_texture (META_WINDOW_ACTOR (window_actor)));
      screenshot_data->image = meta_shaped_texture_get_image (stex, &clip);

      if (screenshot_data->image && !screenshot_data->include_shadow)
        zero_corner_semitransparent_pixels (screenshot_data->image);
    }

  if (screenshot_data->include_cursor)
    _draw_cursor_image (screenshot_data->image, screenshot_data->screenshot_area);

  g_signal_handlers_disconnect_by_func (stage, (void *)grab_window_screenshot, (gpointer) screenshot_data);

  meta_enable_unredirect_for_display (display);

  result = g_simple_async_result_new (NULL, on_screenshot_written, (gpointer)screenshot_data, cinnamon_screenshot_screenshot_window);
  g_simple_async_result_run_in_thread (result, write_screenshot_thread, G_PRIORITY_DEFAULT, NULL);
  g_object_unref (result);
}

static void
on_pixel_grabbed (GObject      *source,
                  GAsyncResult *res,
                  gpointer      user_data)
{
  _screenshot_data *screenshot_data = (_screenshot_data *) user_data;

  if (screenshot_data->pick_callback)
    screenshot_data->pick_callback (screenshot_data->screenshot,
                                    TRUE,
                                    &screenshot_data->pick_color);

  cairo_surface_destroy (screenshot_data->image);
  g_object_unref (screenshot_data->screenshot);
  g_free (screenshot_data);
}

#if G_BYTE_ORDER == G_LITTLE_ENDIAN
#define INDEX_A 3
#define INDEX_R 2
#define INDEX_G 1
#define INDEX_B 0
#else
#define INDEX_A 0
#define INDEX_R 1
#define INDEX_G 2
#define INDEX_B 3
#endif

static void
grab_pixel (ClutterActor     *stage,
            _screenshot_data *screenshot_data)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot_data->screenshot->global);
  GSimpleAsyncResult *result;

  do_grab_screenshot (screenshot_data,
                      stage,
                      screenshot_data->screenshot_area.x,
                      screenshot_data->screenshot_area.y,
                      1,
                      1);

  g_signal_handlers_disconnect_by_func (stage, (void *) grab_pixel, (gpointer)screenshot_data);

  meta_enable_unredirect_for_display (display);

  uint8_t *data = cairo_image_surface_get_data (screenshot_data->image);

  screenshot_data->pick_color.alpha = data[INDEX_A];
  screenshot_data->pick_color.red   = data[INDEX_R];
  screenshot_data->pick_color.green = data[INDEX_G];
  screenshot_data->pick_color.blue  = data[INDEX_B];

  result = g_simple_async_result_new (NULL, on_pixel_grabbed, (gpointer) screenshot_data, grab_pixel);
  g_simple_async_result_complete_in_idle (result);
  g_object_unref (result);
}

#undef INDEX_A
#undef INDEX_R
#undef INDEX_G
#undef INDEX_B

/**
 * cinnamon_screenshot_screenshot:
 * @screenshot: the #CinnamonScreenshot
 * @include_cursor: Whether to include the cursor or not
 * @filename: The filename for the screenshot
 * @copy_to_clipboard: Whether to also copy the grab to the clipboard
 * @callback: (scope async): function to call returning success or failure
 * of the async grabbing
 *
 * Takes a screenshot of the whole screen
 * in @filename as png image.
 *
 */
void
cinnamon_screenshot_screenshot (CinnamonScreenshot *screenshot,
                             gboolean include_cursor,
                             const char *filename,
                             gboolean copy_to_clipboard,
                             CinnamonScreenshotCallback callback)
{
  MetaDisplay *display;
  ClutterActor *stage;
  _screenshot_data *data = g_new0 (_screenshot_data, 1);

  data->screenshot = g_object_ref (screenshot);
  data->filename = g_strdup (filename);
  data->callback = callback;
  data->include_cursor = include_cursor;
  data->copy_to_clipboard = copy_to_clipboard;

  display = cinnamon_global_get_display (screenshot->global);
  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

  meta_disable_unredirect_for_display (display);
  g_signal_connect_after (stage, "after-paint", G_CALLBACK (grab_screenshot), (gpointer)data);
  clutter_actor_queue_redraw (stage);
}

/**
 * cinnamon_screenshot_screenshot_area:
 * @screenshot: the #CinnamonScreenshot
 * @x: The X coordinate of the area
 * @y: The Y coordinate of the area
 * @width: The width of the area
 * @height: The height of the area
 * @filename: The filename for the screenshot
 * @copy_to_clipboard: Whether to also copy the grab to the clipboard
 * @callback: (scope async): function to call returning success or failure
 * of the async grabbing
 *
 * Takes a screenshot of the passed in area and saves it
 * in @filename as png image.
 *
 */
void
cinnamon_screenshot_screenshot_area (CinnamonScreenshot *screenshot,
                                  gboolean include_cursor,
                                  int x,
                                  int y,
                                  int width,
                                  int height,
                                  const char *filename,
                                  gboolean copy_to_clipboard,
                                  CinnamonScreenshotCallback callback)
{
  MetaDisplay *display;
  ClutterActor *stage;
  _screenshot_data *data = g_new0 (_screenshot_data, 1);

  data->screenshot = g_object_ref (screenshot);
  data->filename = g_strdup (filename);
  data->screenshot_area.x = x;
  data->screenshot_area.y = y;
  data->screenshot_area.width = width;
  data->screenshot_area.height = height;
  data->callback = callback;
  data->include_cursor = include_cursor;
  data->copy_to_clipboard = copy_to_clipboard;

  display = cinnamon_global_get_display (screenshot->global);
  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

  meta_disable_unredirect_for_display (display);
  g_signal_connect_after (stage, "after-paint", G_CALLBACK (grab_area_screenshot), (gpointer)data);

  clutter_actor_queue_redraw (stage);
}

static void
schedule_window_screenshot (CinnamonScreenshot *screenshot,
                            MetaWindow *window,
                            gboolean include_shadow,
                            gboolean include_cursor,
                            const char *filename,
                            gboolean copy_to_clipboard,
                            CinnamonScreenshotCallback callback)
{
  MetaDisplay *display;
  ClutterActor *stage;
  _screenshot_data *data = g_new0 (_screenshot_data, 1);

  data->window = window;
  data->screenshot = g_object_ref (screenshot);
  data->filename = g_strdup (filename);
  data->callback = callback;
  data->include_cursor = include_cursor;
  data->include_shadow = include_shadow;
  data->copy_to_clipboard = copy_to_clipboard;

  display = cinnamon_global_get_display (screenshot->global);
  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

  meta_disable_unredirect_for_display (display);
  g_signal_connect_after (stage, "paint", G_CALLBACK (grab_window_screenshot), (gpointer) data);

  clutter_actor_queue_redraw (stage);
}

/**
 * cinnamon_screenshot_screenshot_window:
 * @screenshot: the #CinnamonScreenshot
 * @include_shadow: Whether to include the shadow or not
 * @include_cursor: Whether to include the cursor or not
 * @filename: The filename for the screenshot
 * @copy_to_clipboard: Whether to also copy the grab to the clipboard
 * @callback: (scope async): function to call returning success or failure
 * of the async grabbing
 *
 * Takes a screenshot of the focused window (optionally omitting the frame)
 * in @filename as png image.
 *
 */
void
cinnamon_screenshot_screenshot_window (CinnamonScreenshot *screenshot,
                                    gboolean include_shadow,
                                    gboolean include_cursor,
                                    const char *filename,
                                    gboolean copy_to_clipboard,
                                    CinnamonScreenshotCallback callback)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot->global);
  MetaWindow *window = meta_display_get_focus_window (display);

  if (window == NULL || meta_window_get_window_type (window) == META_WINDOW_DESKTOP)
  {
    cinnamon_screenshot_screenshot (screenshot, include_cursor, filename, copy_to_clipboard, callback);
    return;
  }

  schedule_window_screenshot (screenshot, window, include_shadow, include_cursor, filename, copy_to_clipboard, callback);
}

/**
 * cinnamon_screenshot_screenshot_window_by_id:
 * @screenshot: the #CinnamonScreenshot
 * @window_id: the id returned by meta_window_get_id() for the target window
 * @include_shadow: Whether to include the shadow or not
 * @include_cursor: Whether to include the cursor or not
 * @filename: The filename for the screenshot
 * @copy_to_clipboard: Whether to also copy the grab to the clipboard
 * @callback: (scope async): function to call returning success or failure
 * of the async grabbing
 *
 * Takes a screenshot of the window identified by @window_id. Invokes
 * @callback with success=FALSE synchronously if no live window matches.
 *
 */
void
cinnamon_screenshot_screenshot_window_by_id (CinnamonScreenshot *screenshot,
                                              guint64 window_id,
                                              gboolean include_shadow,
                                              gboolean include_cursor,
                                              const char *filename,
                                              gboolean copy_to_clipboard,
                                              CinnamonScreenshotCallback callback)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot->global);
  GSList *windows, *l;
  MetaWindow *target = NULL;

  windows = meta_display_list_windows (display, META_LIST_DEFAULT);
  for (l = windows; l != NULL; l = l->next)
    {
      MetaWindow *w = (MetaWindow *) l->data;
      if (meta_window_get_id (w) == window_id)
        {
          target = w;
          break;
        }
    }
  g_slist_free (windows);

  if (target == NULL)
    {
      callback (screenshot, FALSE, NULL);
      return;
    }

  schedule_window_screenshot (screenshot, target, include_shadow, include_cursor, filename, copy_to_clipboard, callback);
}

/**
 * cinnamon_screenshot_pick_color:
 * @screenshot: the #CinnamonScreenshot
 * @x: The X coordinate to pick
 * @y: The Y coordinate to pick
 * @callback: (scope async): function to call when finished
 *
 * Picks the pixel at @x, @y and returns its color as #ClutterColor in callback.
 */
void
cinnamon_screenshot_pick_color (CinnamonScreenshot *screenshot,
                                int x,
                                int y,
                                CinnamonScreenshotPickColorCallback callback)
{
  MetaDisplay *display;
  ClutterActor *stage;
  _screenshot_data *data = g_new0 (_screenshot_data, 1);

  data->screenshot = g_object_ref (screenshot);
  data->screenshot_area.x = x;
  data->screenshot_area.y = y;
  data->screenshot_area.width = 1;
  data->screenshot_area.height = 1;
  data->pick_callback = callback;

  display = cinnamon_global_get_display (screenshot->global);
  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

  meta_disable_unredirect_for_display (display);
  g_signal_connect_after (stage, "after-paint", G_CALLBACK (grab_pixel), (gpointer)data);

  clutter_actor_queue_redraw (stage);
}

CinnamonScreenshot *
cinnamon_screenshot_new (void)
{
  return g_object_new (CINNAMON_TYPE_SCREENSHOT, NULL);
}
