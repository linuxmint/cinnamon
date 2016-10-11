/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#define COGL_ENABLE_EXPERIMENTAL_API
#define CLUTTER_ENABLE_EXPERIMENTAL_API

#include <X11/extensions/Xfixes.h>
#include <clutter/x11/clutter-x11.h>
#include <clutter/clutter.h>
#include <cogl/cogl.h>
#include <meta/display.h>
#include <meta/util.h>
#include <meta/meta-plugin.h>
#include <meta/meta-shaped-texture.h>

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

  char *filename;

  cairo_surface_t *image;
  cairo_rectangle_int_t screenshot_area;

  gboolean include_cursor;

  CinnamonScreenshotCallback callback;
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
do_grab_screenshot (_screenshot_data *screenshot_data,
                    int               x,
                    int               y,
                    int               width,
                    int               height)
{
  CoglBitmap *bitmap;
  ClutterBackend *backend;
  CoglContext *context;
  int stride;
  guchar *data;

  backend = clutter_get_default_backend ();
  context = clutter_backend_get_cogl_context (backend);

  screenshot_data->image = cairo_image_surface_create (CAIRO_FORMAT_RGB24,
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
  cogl_framebuffer_read_pixels_into_bitmap (cogl_get_draw_framebuffer (),
                                            x, y,
                                            COGL_READ_PIXELS_COLOR_BUFFER,
                                            bitmap);
  cogl_object_unref (bitmap);
}

static void
_draw_cursor_image (cairo_surface_t *surface,
                    cairo_rectangle_int_t area)
{
  XFixesCursorImage *cursor_image;

  cairo_surface_t *cursor_surface;
  cairo_region_t *screenshot_region;
  cairo_t *cr;

  guchar *data;
  int stride;
  int i, j;

  cursor_image = XFixesGetCursorImage (clutter_x11_get_default_display ());

  if (!cursor_image)
    return;

  screenshot_region = cairo_region_create_rectangle (&area);

  if (!cairo_region_contains_point (screenshot_region, cursor_image->x, cursor_image->y))
    {
       XFree (cursor_image);
       cairo_region_destroy (screenshot_region);
       return;
    }

  cursor_surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32, cursor_image->width, cursor_image->height);

  /* The pixel data (in typical Xlib breakage) is longs even on
   * 64-bit platforms, so we have to data-convert there. For simplicity,
   * just do it always
   */
  data = cairo_image_surface_get_data (cursor_surface);
  stride = cairo_image_surface_get_stride (cursor_surface);
  for (i = 0; i < cursor_image->height; i++)
    for (j = 0; j < cursor_image->width; j++)
      *(guint32 *)(data + i * stride + 4 * j) = cursor_image->pixels[i * cursor_image->width + j];

  cairo_surface_mark_dirty (cursor_surface);

  cr = cairo_create (surface);
  cairo_set_source_surface (cr,
                            cursor_surface,
                            cursor_image->x - cursor_image->xhot - area.x,
                            cursor_image->y - cursor_image->yhot - area.y);
  cairo_paint (cr);

  cairo_destroy (cr);
  cairo_surface_destroy (cursor_surface);
  cairo_region_destroy (screenshot_region);
  XFree (cursor_image);
}

static void
grab_screenshot (ClutterActor *stage,
                 _screenshot_data *screenshot_data)
{
  MetaScreen *screen = cinnamon_global_get_screen (screenshot_data->screenshot->global);
  int width, height;
  GSimpleAsyncResult *result;

  meta_screen_get_size (screen, &width, &height);

  do_grab_screenshot (screenshot_data, 0, 0, width, height);

  if (meta_screen_get_n_monitors (screen) > 1)
    {
      cairo_region_t *screen_region = cairo_region_create ();
      cairo_region_t *stage_region;
      MetaRectangle monitor_rect;
      cairo_rectangle_int_t stage_rect;
      int i;
      cairo_t *cr;

      for (i = meta_screen_get_n_monitors (screen) - 1; i >= 0; i--)
        {
          meta_screen_get_monitor_geometry (screen, i, &monitor_rect);
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

  result = g_simple_async_result_new (NULL, on_screenshot_written, (gpointer)screenshot_data, grab_screenshot);
  g_simple_async_result_run_in_thread (result, write_screenshot_thread, G_PRIORITY_DEFAULT, NULL);
  g_object_unref (result);
}

static void
grab_area_screenshot (ClutterActor *stage,
                      _screenshot_data *screenshot_data)
{
  GSimpleAsyncResult *result;

  do_grab_screenshot (screenshot_data,
                      screenshot_data->screenshot_area.x,
                      screenshot_data->screenshot_area.y,
                      screenshot_data->screenshot_area.width,
                      screenshot_data->screenshot_area.height);

  if (screenshot_data->include_cursor)
    _draw_cursor_image (screenshot_data->image, screenshot_data->screenshot_area);

  g_signal_handlers_disconnect_by_func (stage, (void *)grab_area_screenshot, (gpointer)screenshot_data);
  result = g_simple_async_result_new (NULL, on_screenshot_written, (gpointer)screenshot_data, grab_area_screenshot);
  g_simple_async_result_run_in_thread (result, write_screenshot_thread, G_PRIORITY_DEFAULT, NULL);
  g_object_unref (result);
}

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
  ClutterActor *stage;
  _screenshot_data *data = g_new0 (_screenshot_data, 1);

  data->screenshot = g_object_ref (screenshot);
  data->filename = g_strdup (filename);
  data->callback = callback;
  data->include_cursor = include_cursor;

  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

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

  stage = CLUTTER_ACTOR (cinnamon_global_get_stage (screenshot->global));

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
  GSimpleAsyncResult *result;

  _screenshot_data *screenshot_data = g_new0 (_screenshot_data, 1);

  MetaScreen *screen = cinnamon_global_get_screen (screenshot->global);
  MetaDisplay *display = meta_screen_get_display (screen);
  MetaWindow *window = meta_display_get_focus_window (display);
  ClutterActor *window_actor;
  gfloat actor_x, actor_y;
  MetaShapedTexture *stex;
  MetaRectangle rect;
  cairo_rectangle_int_t clip;

  screenshot_data->screenshot = g_object_ref (screenshot);
  screenshot_data->filename = g_strdup (filename);
  screenshot_data->callback = callback;

  window_actor = CLUTTER_ACTOR (meta_window_get_compositor_private (window));
  clutter_actor_get_position (window_actor, &actor_x, &actor_y);

  if (include_frame || !meta_window_get_frame (window))
    {
      meta_window_get_outer_rect (window, &rect);

      screenshot_data->screenshot_area.x = rect.x;
      screenshot_data->screenshot_area.y = rect.y;

      clip.x = rect.x - (gint) actor_x;
      clip.y = rect.y - (gint) actor_y;
    }
  else
    {
      rect = *meta_window_get_rect (window);

      screenshot_data->screenshot_area.x = (gint) actor_x + rect.x;
      screenshot_data->screenshot_area.y = (gint) actor_y + rect.y;

      clip.x = rect.x;
      clip.y = rect.y;
    }

  clip.width = screenshot_data->screenshot_area.width = rect.width;
  clip.height = screenshot_data->screenshot_area.height = rect.height;

  stex = META_SHAPED_TEXTURE (meta_window_actor_get_texture (META_WINDOW_ACTOR (window_actor)));
  screenshot_data->image = meta_shaped_texture_get_image (stex, &clip);

  if (include_cursor)
    _draw_cursor_image (screenshot_data->image, screenshot_data->screenshot_area);

  result = g_simple_async_result_new (NULL, on_screenshot_written, (gpointer)screenshot_data, cinnamon_screenshot_screenshot_window);
  g_simple_async_result_run_in_thread (result, write_screenshot_thread, G_PRIORITY_DEFAULT, NULL);
  g_object_unref (result);
}

CinnamonScreenshot *
cinnamon_screenshot_new (void)
{
  return g_object_new (CINNAMON_TYPE_SCREENSHOT, NULL);
}
