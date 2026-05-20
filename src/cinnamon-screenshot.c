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
  cairo_rectangle_int_t screenshot_area;

  gboolean include_cursor;
  gboolean include_frame;

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

static void
on_screenshot_written (GObject *source,
                       GAsyncResult *result,
                       gpointer user_data)
{
  _screenshot_data *screenshot_data = (_screenshot_data*) user_data;
  if (screenshot_data->callback)
    screenshot_data->callback (screenshot_data->screenshot,
                               g_simple_async_result_get_op_res_gboolean (G_SIMPLE_ASYNC_RESULT (result)),
                               &screenshot_data->screenshot_area);

  cairo_surface_destroy (screenshot_data->image);
  g_object_unref (screenshot_data->screenshot);
  g_free (screenshot_data->filename);
  g_free (screenshot_data);
}

static void
write_screenshot_thread (GSimpleAsyncResult *result,
                         GObject *object,
                         GCancellable *cancellable)
{
  cairo_status_t status;
  _screenshot_data *screenshot_data = g_async_result_get_user_data (G_ASYNC_RESULT (result));
  g_assert (screenshot_data != NULL);

  status = cairo_surface_write_to_png (screenshot_data->image, screenshot_data->filename);
  g_simple_async_result_set_op_res_gboolean (result, status == CAIRO_STATUS_SUCCESS);
}

static void
do_grab_screenshot (_screenshot_data    *screenshot_data,
                    ClutterPaintContext *paint_context,
                    int                  x,
                    int                  y,
                    int                  width,
                    int                  height)
{
  CoglBitmap *bitmap;
  ClutterBackend *backend;
  CoglContext *context;
  int stride;
  guchar *data;

  backend = clutter_get_default_backend ();
  context = clutter_backend_get_cogl_context (backend);

  screenshot_data->image = cairo_image_surface_create (CAIRO_FORMAT_ARGB32,
                                                       width, height);


  data = cairo_image_surface_get_data (screenshot_data->image);
  stride = cairo_image_surface_get_stride (screenshot_data->image);
  
  stride = cairo_format_stride_for_width (CAIRO_FORMAT_RGB24, width);

  bitmap = cogl_bitmap_new_for_data (context,
                                     width,
                                     height,
                                     CLUTTER_CAIRO_FORMAT_ARGB32,
                                     stride,
                                     data);

  cogl_framebuffer_read_pixels_into_bitmap (clutter_paint_context_get_framebuffer (paint_context),
                                            x, y,
                                            COGL_READ_PIXELS_COLOR_BUFFER,
                                            bitmap);

  cairo_surface_mark_dirty (screenshot_data->image);
  cogl_object_unref (bitmap);
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
grab_screenshot (ClutterActor        *stage,
                 ClutterPaintContext *paint_context,
                 _screenshot_data    *screenshot_data)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot_data->screenshot->global);
  int width, height, n_monitors;
  GSimpleAsyncResult *result;

  meta_display_get_size (display, &width, &height);

  do_grab_screenshot (screenshot_data, paint_context, 0, 0, width, height);

  n_monitors = meta_display_get_n_monitors (display);
  if (n_monitors > 1)
    {
      cairo_region_t *screen_region = cairo_region_create ();
      cairo_region_t *stage_region;
      MetaRectangle monitor_rect;
      cairo_rectangle_int_t stage_rect;
      int i;
      cairo_t *cr;

      for (i = n_monitors - 1; i >= 0; i--)
        {
          meta_display_get_monitor_geometry (display, i, &monitor_rect);
          cairo_region_union_rectangle (screen_region, (const cairo_rectangle_int_t *) &monitor_rect);
        }

      stage_rect.x = 0;
      stage_rect.y = 0;
      stage_rect.width = width;
      stage_rect.height = height;

      stage_region = cairo_region_create_rectangle ((const cairo_rectangle_int_t *) &stage_rect);
      cairo_region_xor (stage_region, screen_region);
      cairo_region_destroy (screen_region);

      cr = cairo_create (screenshot_data->image);

      for (i = 0; i < cairo_region_num_rectangles (stage_region); i++)
        {
          cairo_rectangle_int_t rect;
          cairo_region_get_rectangle (stage_region, i, &rect);
          cairo_rectangle (cr, (double) rect.x, (double) rect.y, (double) rect.width, (double) rect.height);
          cairo_fill (cr);
        }

      cairo_destroy (cr);
      cairo_region_destroy (stage_region);
    }

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
grab_area_screenshot (ClutterActor *stage,
                      ClutterPaintContext *paint_context,
                      _screenshot_data *screenshot_data)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot_data->screenshot->global);
  GSimpleAsyncResult *result;

  do_grab_screenshot (screenshot_data,
                      paint_context,
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

  if (has_frame && screenshot_data->include_frame)
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
      if (!has_frame && screenshot_data->include_frame)
        {
          // CSD with frame — use buffer_rect to capture the full shadow
          meta_window_get_buffer_rect (screenshot_data->window, &rect);

          screenshot_data->screenshot_area.x = rect.x;
          screenshot_data->screenshot_area.y = rect.y;

          clip.x = 0;
          clip.y = 0;
        }
      else if (!has_frame && !screenshot_data->include_frame)
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
          // SSD without frame
          MetaRectangle frame_rect;
          meta_window_get_frame_rect (screenshot_data->window, &frame_rect);
          meta_window_frame_rect_to_client_rect (screenshot_data->window, &frame_rect, &rect);

          screenshot_data->screenshot_area.x = rect.x;
          screenshot_data->screenshot_area.y = rect.y;

          clip.x = rect.x - (gint) actor_x;
          clip.y = rect.y - (gint) actor_y;
        }

      clip.width = screenshot_data->screenshot_area.width = rect.width;
      clip.height = screenshot_data->screenshot_area.height = rect.height;

      stex = META_SHAPED_TEXTURE (meta_window_actor_get_texture (META_WINDOW_ACTOR (window_actor)));
      screenshot_data->image = meta_shaped_texture_get_image (stex, &clip);

      if (screenshot_data->image && !has_frame && !screenshot_data->include_frame)
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
grab_pixel (ClutterActor *stage,
            ClutterPaintContext *paint_context,
            _screenshot_data *screenshot_data)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot_data->screenshot->global);
  GSimpleAsyncResult *result;

  do_grab_screenshot (screenshot_data,
                      paint_context,
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
                             CinnamonScreenshotCallback callback)
{
  MetaDisplay *display;
  ClutterActor *stage;
  _screenshot_data *data = g_new0 (_screenshot_data, 1);

  data->screenshot = g_object_ref (screenshot);
  data->filename = g_strdup (filename);
  data->callback = callback;
  data->include_cursor = include_cursor;

  display = cinnamon_global_get_display (screenshot->global);
  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

  meta_disable_unredirect_for_display (display);
  g_signal_connect_after (stage, "paint", G_CALLBACK (grab_screenshot), (gpointer)data);
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

  display = cinnamon_global_get_display (screenshot->global);
  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

  meta_disable_unredirect_for_display (display);
  g_signal_connect_after (stage, "paint", G_CALLBACK (grab_area_screenshot), (gpointer)data);

  clutter_actor_queue_redraw (stage);
}

/**
 * cinnamon_screenshot_screenshot_window:
 * @screenshot: the #CinnamonScreenshot
 * @include_frame: Whether to include the frame or not
 * @include_cursor: Whether to include the cursor or not
 * @filename: The filename for the screenshot
 * @callback: (scope async): function to call returning success or failure
 * of the async grabbing
 *
 * Takes a screenshot of the focused window (optionally omitting the frame)
 * in @filename as png image.
 *
 */
void
cinnamon_screenshot_screenshot_window (CinnamonScreenshot *screenshot,
                                    gboolean include_frame,
                                    gboolean include_cursor,
                                    const char *filename,
                                    CinnamonScreenshotCallback callback)
{
  MetaDisplay *display = cinnamon_global_get_display (screenshot->global);
  MetaWindow *window = meta_display_get_focus_window (display);
  ClutterActor *stage;

  if (window == NULL || meta_window_get_window_type (window) == META_WINDOW_DESKTOP)
  {
    cinnamon_screenshot_screenshot (screenshot, include_cursor, filename, callback);
    return;
  }

  _screenshot_data *data = g_new0 (_screenshot_data, 1);

  data->window = window;
  data->screenshot = g_object_ref (screenshot);
  data->filename = g_strdup (filename);
  data->callback = callback;
  data->include_cursor = include_cursor;
  data->include_frame = include_frame;

  display = cinnamon_global_get_display (screenshot->global);
  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

  meta_disable_unredirect_for_display (display);
  g_signal_connect_after (stage, "paint", G_CALLBACK (grab_window_screenshot), (gpointer) data);

  clutter_actor_queue_redraw (stage);
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
  g_signal_connect_after (stage, "paint", G_CALLBACK (grab_pixel), (gpointer)data);

  clutter_actor_queue_redraw (stage);
}

CinnamonScreenshot *
cinnamon_screenshot_new (void)
{
  return g_object_new (CINNAMON_TYPE_SCREENSHOT, NULL);
}
