/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <fcntl.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#define GST_USE_UNSTABLE_API
#include <gst/gst.h>

#include "cinnamon-recorder-src.h"
#include "cinnamon-recorder.h"

#include <clutter/x11/clutter-x11.h>
#include <X11/extensions/Xfixes.h>
#include "st.h"

typedef enum {
  RECORDER_STATE_CLOSED,
  RECORDER_STATE_PAUSED,
  RECORDER_STATE_RECORDING
} RecorderState;

typedef struct _RecorderPipeline RecorderPipeline;

struct _CinnamonRecorderClass
{
  GObjectClass parent_class;
};

struct _CinnamonRecorder {
  GObject parent;

  /* A "maximum" amount of memory to use for buffering. This is used
   * to alert the user that they are filling up memory rather than
   * any that actually affects recording. (In kB)
   */
  guint memory_target;
  guint memory_used; /* Current memory used. (In kB) */

  RecorderState state;
  char *unique; /* The unique string we are using for this recording */
  int count; /* How many times the recording has been started */

  ClutterStage *stage;
  gboolean custom_area;
  cairo_rectangle_int_t area;
  int stage_width;
  int stage_height;

  gboolean have_pointer;
  int pointer_x;
  int pointer_y;

  guint vertical_adjust; // Y adjustment from bottom panel, if any
  guint horizontal_adjust; // X adjustment to position on right edge of primary monitor

  gboolean have_xfixes;
  int xfixes_event_base;

  CoglHandle recording_icon; /* icon shown while playing */

  cairo_surface_t *cursor_image;
  int cursor_hot_x;
  int cursor_hot_y;

  gboolean only_paint; /* Used to temporarily suppress recording */

  int framerate;
  char *pipeline_description;
  char *filename;
  gboolean filename_has_count; /* %c used: handle pausing differently */

  /* We might have multiple pipelines that are finishing encoding
   * to go along with the current pipeline where we are recording.
   */
  RecorderPipeline *current_pipeline; /* current pipeline */
  GSList *pipelines; /* all pipelines */

  GstClockTime start_time; /* When we started recording (adjusted for pauses) */
  GstClockTime pause_time; /* When the pipeline was paused */

  /* GSource IDs for different timeouts and idles */
  guint redraw_timeout;
  guint redraw_idle;
  guint update_memory_used_timeout;
  guint update_pointer_timeout;
  guint repaint_hook_id;
};

struct _RecorderPipeline
{
  CinnamonRecorder *recorder;
  GstElement *pipeline;
  GstElement *src;
  int outfile;
};

static void recorder_set_stage    (CinnamonRecorder *recorder,
                                   ClutterStage  *stage);
static void recorder_set_framerate (CinnamonRecorder *recorder,
                                    int framerate);
static void recorder_set_pipeline (CinnamonRecorder *recorder,
                                   const char    *pipeline);
static void recorder_set_filename (CinnamonRecorder *recorder,
                                   const char    *filename);

static void recorder_pipeline_set_caps (RecorderPipeline *pipeline);
static void recorder_pipeline_closed   (RecorderPipeline *pipeline);

enum {
  PROP_0,
  PROP_STAGE,
  PROP_FRAMERATE,
  PROP_PIPELINE,
  PROP_FILENAME
};

G_DEFINE_TYPE(CinnamonRecorder, cinnamon_recorder, G_TYPE_OBJECT);

/* The number of frames per second we configure for the GStreamer pipeline.
 * (the number of frames we actually write into the GStreamer pipeline is
 * based entirely on how fast clutter is drawing.) Using 60fps seems high
 * but the observed smoothness is a lot better than for 30fps when encoding
 * as theora for a minimal size increase. This may be an artifact of the
 * encoding process.
 */
#define DEFAULT_FRAMES_PER_SECOND 15

/* The time (in milliseconds) between querying the server for the cursor
 * position.
 */
#define UPDATE_POINTER_TIME 100

/* The time we wait (in milliseconds) before redrawing when the memory used
 * changes.
 */
#define UPDATE_MEMORY_USED_DELAY 500

/* Maximum time between frames, in milliseconds. If we don't send data
 * for a long period of time, then when we send the next frame, a lot
 * of work can be created for the encoder to do, so we want to force a
 * periodic redraw when nothing happen.
 */
#define MAXIMUM_PAUSE_TIME 1000

/* The default pipeline. videorate is used to give a constant stream of
 * frames to theora even if there is a pause because nothing is moving.
 * (Theora does have some support for frames at non-uniform times, but
 * things seem to break down if there are large gaps.)
 */
#define DEFAULT_PIPELINE "vp8enc min_quantizer=13 max_quantizer=13 cpu-used=5 deadline=1000000 threads=%T ! queue ! webmmux"

/* The default filename pattern. Example cinnamon-20090311b-2.webm
 */
#define DEFAULT_FILENAME "cinnamon-%d%u-%c.webm"

/* If we can find the amount of memory on the machine, we use half
 * of that for memory_target, otherwise, we use this value, in kB.
 */
#define DEFAULT_MEMORY_TARGET (512*1024)

#define PANEL_HEIGHT_KEY "panel-bottom-height"
#define SCHEMA_CINNAMON "org.cinnamon"

/* Create an emblem to show at the lower-left corner of the stage while
 * recording. The emblem is drawn *after* we record the frame so doesn't
 * show up in the frame.
 */
static CoglHandle
create_recording_icon (void)
{
  cairo_surface_t *surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32, 32, 32);
  cairo_t *cr;
  cairo_pattern_t *pat;
  CoglHandle texture;

  cr = cairo_create (surface);

  /* clear to transparent */
  cairo_save (cr);
  cairo_set_operator (cr, CAIRO_OPERATOR_CLEAR);
  cairo_paint (cr);
  cairo_restore (cr);

  /* radial "glow" */
  pat = cairo_pattern_create_radial (16, 16, 6,
                                     16, 16, 14);
  cairo_pattern_add_color_stop_rgba (pat, 0.0,
                                     1, 0, 0, 1); /* opaque red */
  cairo_pattern_add_color_stop_rgba (pat, 1.0,
                                     1, 0, 0, 0); /* transparent red */

  cairo_set_source (cr, pat);
  cairo_paint (cr);
  cairo_pattern_destroy (pat);

  /* red circle */
  cairo_arc (cr, 16, 16, 8,
             0, 2 * M_PI);
  cairo_set_source_rgb (cr, 1, 0, 0);
  cairo_fill (cr);

  cairo_destroy (cr);

  texture = st_cogl_texture_new_from_data_wrapper (32, 32,
                                                   COGL_TEXTURE_NONE,
                                                   CLUTTER_CAIRO_FORMAT_ARGB32,
                                                   COGL_PIXEL_FORMAT_ANY,
                                                   cairo_image_surface_get_stride (surface),
                                                   cairo_image_surface_get_data (surface));
  cairo_surface_destroy (surface);

  return texture;
}

static guint
get_memory_target (void)
{
  FILE *f;

  /* Really simple "get amount of memory on the machine" if it
   * doesn't work, you just get the default memory target.
   */
  f = fopen("/proc/meminfo", "r");
  if (!f)
    return DEFAULT_MEMORY_TARGET;

  while (!feof(f))
    {
      gchar line_buffer[1024];
      guint mem_total;
      if (fscanf(f, "MemTotal: %u", &mem_total) == 1)
        {
          fclose(f);
          return mem_total / 2;
        }
      /* Skip to the next line and discard what we read */
      if (fgets(line_buffer, sizeof(line_buffer), f) == NULL)
        break;
    }

  fclose(f);

  return DEFAULT_MEMORY_TARGET;
}

/*
 * Used to force full stage redraws during recording to avoid artifacts
 *
 * Note: That this will cause the stage to be repainted on
 * every animation frame even if the frame wouldn't normally cause any new
 * drawing
 */
static gboolean
recorder_repaint_hook (gpointer data)
{
  ClutterActor *stage = data;
  clutter_actor_queue_redraw (stage);

  return TRUE;
}

static void
cinnamon_recorder_init (CinnamonRecorder *recorder)
{
  GdkRectangle work_rect, geo_rect;
  GdkScreen *screen;
  gint primary;

  /* Calling gst_init() is a no-op if GStreamer was previously initialized */
  gst_init (NULL, NULL);

  cinnamon_recorder_src_register ();

  screen = gdk_screen_get_default ();
  primary = gdk_screen_get_primary_monitor (screen);
  gdk_screen_get_monitor_workarea (screen, primary, &work_rect);
  gdk_screen_get_monitor_geometry (screen, primary, &geo_rect);

  recorder->vertical_adjust = (geo_rect.y + geo_rect.height) - (work_rect.y + work_rect.height);
  recorder->horizontal_adjust = work_rect.x + work_rect.width;

  recorder->recording_icon = create_recording_icon ();
  recorder->memory_target = get_memory_target();

  recorder->state = RECORDER_STATE_CLOSED;
  recorder->framerate = DEFAULT_FRAMES_PER_SECOND;
}

static void
cinnamon_recorder_finalize (GObject  *object)
{
  CinnamonRecorder *recorder = CINNAMON_RECORDER (object);

  if (recorder->update_memory_used_timeout) {
    g_source_remove (recorder->update_memory_used_timeout);
    recorder->update_memory_used_timeout = 0;
  }

  if (recorder->cursor_image)
    cairo_surface_destroy (recorder->cursor_image);

  recorder_set_stage (recorder, NULL);
  recorder_set_pipeline (recorder, NULL);
  recorder_set_filename (recorder, NULL);

  cogl_handle_unref (recorder->recording_icon);

  G_OBJECT_CLASS (cinnamon_recorder_parent_class)->finalize (object);
}

static void
recorder_on_stage_destroy (ClutterActor  *actor,
                           CinnamonRecorder *recorder)
{
  recorder_set_stage (recorder, NULL);
}

/* Add together the memory used by all pipelines; both the
 * currently recording pipeline and pipelines finishing
 * recording asynchronously.
 */
static void
recorder_update_memory_used (CinnamonRecorder *recorder,
                             gboolean       repaint)
{
  guint memory_used = 0;
  GSList *l;

  for (l = recorder->pipelines; l; l = l->next)
    {
      RecorderPipeline *pipeline = l->data;
      guint pipeline_memory_used;

      g_object_get (pipeline->src,
                    "memory-used", &pipeline_memory_used,
                    NULL);
      memory_used += pipeline_memory_used;
    }

  if (memory_used != recorder->memory_used)
    {
      recorder->memory_used = memory_used;
      if (repaint)
        {
          /* In other cases we just queue a redraw even if we only need
           * to repaint and not redraw a frame, but having changes in
           * memory usage cause frames to be painted and memory used
           * seems like a bad idea.
           */
          recorder->only_paint = TRUE;
          clutter_stage_ensure_redraw (recorder->stage);
          recorder->only_paint = FALSE;
        }
    }
}

/* Timeout used to avoid not drawing for more than MAXIMUM_PAUSE_TIME
 */
static gboolean
recorder_redraw_timeout (gpointer data)
{
  CinnamonRecorder *recorder = data;

  recorder->redraw_timeout = 0;
  clutter_actor_queue_redraw (CLUTTER_ACTOR (recorder->stage));

  return FALSE;
}

static void
recorder_add_redraw_timeout (CinnamonRecorder *recorder)
{
  if (recorder->redraw_timeout == 0)
    {
      recorder->redraw_timeout = g_timeout_add (MAXIMUM_PAUSE_TIME,
                                                recorder_redraw_timeout,
                                                recorder);
    }
}

static void
recorder_remove_redraw_timeout (CinnamonRecorder *recorder)
{
  if (recorder->redraw_timeout != 0)
    {
      g_source_remove (recorder->redraw_timeout);
      recorder->redraw_timeout = 0;
    }
}

static void
recorder_fetch_cursor_image (CinnamonRecorder *recorder)
{
  XFixesCursorImage *cursor_image;
  guchar *data;
  int stride;
  int i, j;

  if (!recorder->have_xfixes)
    return;

  cursor_image = XFixesGetCursorImage (clutter_x11_get_default_display ());
  if (!cursor_image)
    return;

  recorder->cursor_hot_x = cursor_image->xhot;
  recorder->cursor_hot_y = cursor_image->yhot;

  recorder->cursor_image = cairo_image_surface_create (CAIRO_FORMAT_ARGB32,
                                                       cursor_image->width,
                                                       cursor_image->height);

  /* The pixel data (in typical Xlib breakage) is longs even on
   * 64-bit platforms, so we have to data-convert there. For simplicity,
   * just do it always
   */
  data = cairo_image_surface_get_data (recorder->cursor_image);
  stride = cairo_image_surface_get_stride (recorder->cursor_image);
  for (i = 0; i < cursor_image->height; i++)
    for (j = 0; j < cursor_image->width; j++)
      *(guint32 *)(data + i * stride + 4 * j) = cursor_image->pixels[i * cursor_image->width + j];

  cairo_surface_mark_dirty (recorder->cursor_image);

  XFree (cursor_image);
}

/* Overlay the cursor image on the frame. We draw the cursor image
 * into the host-memory buffer after  we've captured the frame. An
 * alternate approach would be to turn off the cursor while recording
 * and draw the cursor ourselves with GL, but then we'd need to figure
 * out what the cursor looks like, or hard-code a non-system cursor.
 */
static void
recorder_draw_cursor (CinnamonRecorder *recorder,
                      GstBuffer     *buffer)
{
  GstMapInfo info;
  cairo_surface_t *surface;
  cairo_t *cr;

  /* We don't show a cursor unless the hot spot is in the frame; this
   * means that sometimes we aren't going to draw a cursor even when
   * there is a little bit overlapping within the stage */
  if (recorder->pointer_x < recorder->area.x ||
      recorder->pointer_y < recorder->area.y ||
      recorder->pointer_x >= recorder->area.x + recorder->area.width ||
      recorder->pointer_y >= recorder->area.y + recorder->area.height)
    return;

  if (!recorder->cursor_image)
    recorder_fetch_cursor_image (recorder);

  if (!recorder->cursor_image)
    return;

  gst_buffer_map (buffer, &info, GST_MAP_WRITE);
  surface = cairo_image_surface_create_for_data (info.data,
                                                 CAIRO_FORMAT_ARGB32,
                                                 recorder->area.width,
                                                 recorder->area.height,
                                                 recorder->area.width * 4);

  cr = cairo_create (surface);
  cairo_set_source_surface (cr,
                            recorder->cursor_image,
                            recorder->pointer_x - recorder->cursor_hot_x - recorder->area.x,
                            recorder->pointer_y - recorder->cursor_hot_y - recorder->area.y);
  cairo_paint (cr);

  cairo_destroy (cr);
  cairo_surface_destroy (surface);
  gst_buffer_unmap (buffer, &info);
}

/* Draw an overlay indicating how much of the target memory is used
 * for buffering frames.
 */
static void
recorder_draw_buffer_meter (CinnamonRecorder *recorder)
{
  int fill_level;

  recorder_update_memory_used (recorder, FALSE);

  /* As the buffer gets more full, we go from green, to yellow, to red */
  if (recorder->memory_used > (recorder->memory_target * 3) / 4)
    cogl_set_source_color4f (1, 0, 0, 1);
  else if (recorder->memory_used > recorder->memory_target / 2)
    cogl_set_source_color4f (1, 1, 0, 1);
  else
    cogl_set_source_color4f (0, 1, 0, 1);

  fill_level = MIN (60, (recorder->memory_used * 60) / recorder->memory_target);

  /* A hollow rectangle filled from the left to fill_level */
  cogl_rectangle (recorder->horizontal_adjust - 64, recorder->stage_height - recorder->vertical_adjust - 10,
                  recorder->horizontal_adjust - 2,  recorder->stage_height - recorder->vertical_adjust - 9);
  cogl_rectangle (recorder->horizontal_adjust - 64, recorder->stage_height - recorder->vertical_adjust - 9,
                  recorder->horizontal_adjust - (63 - fill_level), recorder->stage_height - recorder->vertical_adjust - 3);
  cogl_rectangle (recorder->horizontal_adjust - 3,  recorder->stage_height - recorder->vertical_adjust - 9,
                  recorder->horizontal_adjust - 2,  recorder->stage_height - recorder->vertical_adjust - 3);
  cogl_rectangle (recorder->horizontal_adjust - 64, recorder->stage_height - recorder->vertical_adjust - 3,
                  recorder->horizontal_adjust - 2,  recorder->stage_height - recorder->vertical_adjust - 2);
}

static GstClockTime
get_wall_time (void)
{
  return g_get_real_time ();
}

/* Retrieve a frame and feed it into the pipeline
 */
static void
recorder_record_frame (CinnamonRecorder *recorder,
                       gboolean          paint)
{
  GstBuffer *buffer;
  ClutterCapture *captures;
  int n_captures;
  cairo_surface_t *image;
  guint size;
  uint8_t *data;
  GstMemory *memory;
  int i;
  GstClock *clock;
  GstClockTime now, base_time;

  g_return_if_fail (recorder->current_pipeline != NULL);

  /* If we get into the red zone, stop buffering new frames; 13/16 is
  * a bit more than the 3/4 threshold for a red indicator to keep the
  * indicator from flashing between red and yellow. */
  if (recorder->memory_used > (recorder->memory_target * 13) / 16)
    return;

  /* Drop frames to get down to something like the target frame rate; since frames
   * are generated with VBlank sync, we don't have full control anyways, so we just
   * drop frames if the interval since the last frame is less than 75% of the
   * desired inter-frame interval.
   */
  clock = gst_element_get_clock (recorder->current_pipeline->src);

  /* If we have no clock yet, the pipeline is not yet in PLAYING */
  if (!clock)
    return;

  base_time = gst_element_get_base_time (recorder->current_pipeline->src);
  now = gst_clock_get_time (clock) - base_time;
  gst_object_unref (clock);

  if (GST_CLOCK_TIME_IS_VALID (recorder->start_time) &&
      now - recorder->start_time < gst_util_uint64_scale_int (GST_SECOND, 3, 4 * recorder->framerate))
    return;
  recorder->start_time = now;

  clutter_stage_capture (recorder->stage, paint, &recorder->area,
                         &captures, &n_captures);

  if (n_captures == 0)
    return;

  /*
   * TODO: Deal with each capture region separately, instead of dropping
   * anything except the first one.
   */

  image = captures[0].image;
  data = cairo_image_surface_get_data (image);
  size = captures[0].rect.width * captures[0].rect.height * 4;

  /* TODO: Capture more than the first framebuffer. */
  for (i = 1; i < n_captures; i++)
    cairo_surface_destroy (captures[i].image);
  g_free (captures);

  buffer = gst_buffer_new();
  memory = gst_memory_new_wrapped (0, data, size, 0, size,
                                   image,
                                   (GDestroyNotify) cairo_surface_destroy);
  gst_buffer_insert_memory (buffer, -1, memory);

  GST_BUFFER_PTS(buffer) = now;

  recorder_draw_cursor (recorder, buffer);

  cinnamon_recorder_src_add_buffer (CINNAMON_RECORDER_SRC (recorder->current_pipeline->src), buffer);
  gst_buffer_unref (buffer);

  /* Reset the timeout that we used to avoid an overlong pause in the stream */
  recorder_remove_redraw_timeout (recorder);
  recorder_add_redraw_timeout (recorder);
}

/* We hook in by recording each frame right after the stage is painted
 * by clutter before glSwapBuffers() makes it visible to the user.
 */
static void
recorder_on_stage_paint (ClutterActor     *actor,
                         CinnamonRecorder *recorder)
{
  if (recorder->state == RECORDER_STATE_RECORDING)
    {
      if (!recorder->only_paint)
        recorder_record_frame (recorder, FALSE);

      cogl_set_source_texture (recorder->recording_icon);
      cogl_rectangle (recorder->horizontal_adjust - 32, recorder->stage_height - recorder->vertical_adjust - 42,
                      recorder->horizontal_adjust,      recorder->stage_height - recorder->vertical_adjust - 10);
    }

  if (recorder->state == RECORDER_STATE_RECORDING || recorder->memory_used != 0)
    recorder_draw_buffer_meter (recorder);
}

static void
recorder_update_size (CinnamonRecorder *recorder)
{
  ClutterActorBox allocation;

  clutter_actor_get_allocation_box (CLUTTER_ACTOR (recorder->stage), &allocation);
  recorder->stage_width = (int)(0.5 + allocation.x2 - allocation.x1);
  recorder->stage_height = (int)(0.5 + allocation.y2 - allocation.y1);

  if (!recorder->custom_area)
    {
      recorder->area.x = 0;
      recorder->area.y = 0;
      recorder->area.width = recorder->stage_width;
      recorder->area.height = recorder->stage_height;
    }
}

static void
recorder_on_stage_notify_size (GObject          *object,
                               GParamSpec       *pspec,
                               CinnamonRecorder    *recorder)
{
  recorder_update_size (recorder);

  /* This breaks the recording but tweaking the GStreamer pipeline a bit
   * might make it work, at least if the codec can handle a stream where
   * the frame size changes in the middle.
   */
  if (recorder->current_pipeline)
    recorder_pipeline_set_caps (recorder->current_pipeline);
}

static gboolean
recorder_idle_redraw (gpointer data)
{
  CinnamonRecorder *recorder = data;

  recorder->redraw_idle = 0;
  clutter_actor_queue_redraw (CLUTTER_ACTOR (recorder->stage));

  return FALSE;
}

static void
recorder_queue_redraw (CinnamonRecorder *recorder)
{
  /* If we just queue a redraw on every mouse motion (for example), we
   * starve Clutter, which operates at a very low priority. So
   * we need to queue a "low priority redraw" after timeline updates
   */
  if (recorder->state == RECORDER_STATE_RECORDING && recorder->redraw_idle == 0)
    recorder->redraw_idle = g_idle_add_full (CLUTTER_PRIORITY_REDRAW + 1,
                                             recorder_idle_redraw, recorder, NULL);
}

/* We use an event filter on the stage to get the XFixesCursorNotifyEvent
 * and also to track cursor position (when the cursor is over the stage's
 * input area); tracking cursor position here rather than with ClutterEvent
 * allows us to avoid worrying about event propagation and competing
 * signal handlers.
 */
static ClutterX11FilterReturn
recorder_event_filter (XEvent        *xev,
                       ClutterEvent  *cev,
                       gpointer       data)
{
  CinnamonRecorder *recorder = data;

  if (xev->xany.window != clutter_x11_get_stage_window (recorder->stage))
    return CLUTTER_X11_FILTER_CONTINUE;

  if (xev->xany.type == recorder->xfixes_event_base + XFixesCursorNotify)
    {
      XFixesCursorNotifyEvent *notify_event = (XFixesCursorNotifyEvent *)xev;

      if (notify_event->subtype == XFixesDisplayCursorNotify)
        {
          if (recorder->cursor_image)
            {
              cairo_surface_destroy (recorder->cursor_image);
              recorder->cursor_image = NULL;
            }

          recorder_queue_redraw (recorder);
        }
    }
  else if (xev->xany.type == MotionNotify)
    {
      recorder->pointer_x = xev->xmotion.x;
      recorder->pointer_y = xev->xmotion.y;

      recorder_queue_redraw (recorder);
    }
  /* We want to track whether the pointer is over the stage
   * window itself, and not in a child window. A "virtual"
   * crossing is one that goes directly from ancestor to child.
   */
  else if (xev->xany.type == EnterNotify &&
           (xev->xcrossing.detail != NotifyVirtual &&
            xev->xcrossing.detail != NotifyNonlinearVirtual))
    {
      recorder->have_pointer = TRUE;
      recorder->pointer_x = xev->xcrossing.x;
      recorder->pointer_y = xev->xcrossing.y;

      recorder_queue_redraw (recorder);
    }
  else if (xev->xany.type == LeaveNotify &&
           (xev->xcrossing.detail != NotifyVirtual &&
            xev->xcrossing.detail != NotifyNonlinearVirtual))
    {
      recorder->have_pointer = FALSE;
      recorder->pointer_x = xev->xcrossing.x;
      recorder->pointer_y = xev->xcrossing.y;

      recorder_queue_redraw (recorder);
    }

  return CLUTTER_X11_FILTER_CONTINUE;
}

/* We optimize out querying the server for the pointer position if the
 * pointer is in the input area of the ClutterStage. We track changes to
 * that with Enter/Leave events, but we need to 100% accurate about the
 * initial condition, which is a little involved.
 */
static void
recorder_get_initial_cursor_position (CinnamonRecorder *recorder)
{
  Display *xdisplay = clutter_x11_get_default_display ();
  Window xwindow = clutter_x11_get_stage_window (recorder->stage);
  XWindowAttributes xwa;
  Window root, child, parent;
  Window *children;
  guint n_children;
  int root_x,root_y;
  int window_x, window_y;
  guint mask;

  XGrabServer(xdisplay);

  XGetWindowAttributes (xdisplay, xwindow, &xwa);
  XQueryTree (xdisplay, xwindow, &root, &parent, &children, &n_children);
  XFree (children);

  if (xwa.map_state == IsViewable &&
      XQueryPointer (xdisplay, parent,
                     &root, &child, &root_x, &root_y, &window_x, &window_y, &mask) &&
      child == xwindow)
    {
      /* The point of this call is not actually to translate the coordinates -
       * we could do that ourselves using xwa.{x,y} -  but rather to see if
       * the pointer is in a child of the window, which we count as "not in
       * window", because we aren't guaranteed to get pointer events.
       */
      XTranslateCoordinates(xdisplay, parent, xwindow,
                            window_x, window_y,
                            &window_x, &window_y, &child);
      if (child == None)
        {
          recorder->have_pointer = TRUE;
          recorder->pointer_x = window_x;
          recorder->pointer_y = window_y;
        }
    }
  else
    recorder->have_pointer = FALSE;

  XUngrabServer(xdisplay);
  XFlush(xdisplay);

  /* While we are at it, add mouse events to the event mask; they will
   * be there for the stage windows that Clutter creates by default, but
   * maybe this stage was created differently. Since we've already
   * retrieved the event mask, it's almost free.
   */
  XSelectInput(xdisplay, xwindow,
               xwa.your_event_mask | EnterWindowMask | LeaveWindowMask | PointerMotionMask);
}

/* When the cursor is not over the stage's input area, we query for the
 * pointer position in a timeout.
 */
static void
recorder_update_pointer (CinnamonRecorder *recorder)
{
  Display *xdisplay = clutter_x11_get_default_display ();
  Window xwindow = clutter_x11_get_stage_window (recorder->stage);
  Window root, child;
  int root_x,root_y;
  int window_x, window_y;
  guint mask;

  if (recorder->have_pointer)
    return;

  if (XQueryPointer (xdisplay, xwindow,
                     &root, &child, &root_x, &root_y, &window_x, &window_y, &mask))
    {
      if (window_x != recorder->pointer_x || window_y != recorder->pointer_y)
        {
          recorder->pointer_x = window_x;
          recorder->pointer_y = window_y;

          recorder_queue_redraw (recorder);
        }
    }
}

static gboolean
recorder_update_pointer_timeout (gpointer data)
{
  recorder_update_pointer (data);

  return TRUE;
}

static void
recorder_add_update_pointer_timeout (CinnamonRecorder *recorder)
{
  if (!recorder->update_pointer_timeout)
    recorder->update_pointer_timeout = g_timeout_add (UPDATE_POINTER_TIME,
                                                      recorder_update_pointer_timeout,
                                                      recorder);
}

static void
recorder_remove_update_pointer_timeout (CinnamonRecorder *recorder)
{
  if (recorder->update_pointer_timeout)
    {
      g_source_remove (recorder->update_pointer_timeout);
      recorder->update_pointer_timeout = 0;
    }
}

static void
recorder_set_stage (CinnamonRecorder *recorder,
                    ClutterStage  *stage)
{
  if (recorder->stage == stage)
    return;

  if (recorder->current_pipeline)
    cinnamon_recorder_close (recorder);

  if (recorder->stage)
    {
      g_signal_handlers_disconnect_by_func (recorder->stage,
                                            (void *)recorder_on_stage_destroy,
                                            recorder);
      g_signal_handlers_disconnect_by_func (recorder->stage,
                                            (void *)recorder_on_stage_paint,
                                            recorder);
      g_signal_handlers_disconnect_by_func (recorder->stage,
                                            (void *)recorder_on_stage_notify_size,
                                            recorder);

      clutter_x11_remove_filter (recorder_event_filter, recorder);

      /* We don't don't deselect for cursor changes in case someone else just
       * happened to be selecting for cursor events on the same window; sending
       * us the events is close to free in any case.
       */

      if (recorder->redraw_idle)
        {
          g_source_remove (recorder->redraw_idle);
          recorder->redraw_idle = 0;
        }
    }

  recorder->stage = stage;

  if (recorder->stage)
    {
      int error_base;

      recorder->stage = stage;
      g_signal_connect (recorder->stage, "destroy",
                        G_CALLBACK (recorder_on_stage_destroy), recorder);
      g_signal_connect_after (recorder->stage, "paint",
                              G_CALLBACK (recorder_on_stage_paint), recorder);
      g_signal_connect (recorder->stage, "notify::width",
                        G_CALLBACK (recorder_on_stage_notify_size), recorder);
      g_signal_connect (recorder->stage, "notify::width",
                        G_CALLBACK (recorder_on_stage_notify_size), recorder);

      clutter_x11_add_filter (recorder_event_filter, recorder);

      recorder_update_size (recorder);

      recorder->have_xfixes = XFixesQueryExtension (clutter_x11_get_default_display (),
                                                    &recorder->xfixes_event_base,
                                                    &error_base);
      if (recorder->have_xfixes)
        XFixesSelectCursorInput (clutter_x11_get_default_display (),
                                   clutter_x11_get_stage_window (stage),
                                 XFixesDisplayCursorNotifyMask);

      clutter_stage_ensure_current (stage);

      recorder_get_initial_cursor_position (recorder);
    }
}

static void
recorder_set_framerate (CinnamonRecorder *recorder,
                        int framerate)
{
  if (framerate == recorder->framerate)
    return;

  if (recorder->current_pipeline)
    cinnamon_recorder_close (recorder);

  recorder->framerate = framerate;

  g_object_notify (G_OBJECT (recorder), "framerate");
}

static void
recorder_set_pipeline (CinnamonRecorder *recorder,
                       const char    *pipeline)
{
  if (pipeline == recorder->pipeline_description ||
      (pipeline && recorder->pipeline_description && strcmp (recorder->pipeline_description, pipeline) == 0))
    return;

  if (recorder->current_pipeline)
    cinnamon_recorder_close (recorder);

  if (recorder->pipeline_description)
    g_free (recorder->pipeline_description);

  recorder->pipeline_description = g_strdup (pipeline);

  g_object_notify (G_OBJECT (recorder), "pipeline");
}

static void
recorder_set_filename (CinnamonRecorder *recorder,
                       const char    *filename)
{
  if (filename == recorder->filename ||
      (filename && recorder->filename && strcmp (recorder->filename, filename) == 0))
    return;

  if (recorder->current_pipeline)
    cinnamon_recorder_close (recorder);

  if (recorder->filename)
    g_free (recorder->filename);

  recorder->filename = g_strdup (filename);

  g_object_notify (G_OBJECT (recorder), "filename");
}

static void
cinnamon_recorder_set_property (GObject      *object,
                             guint         prop_id,
                             const GValue *value,
                             GParamSpec   *pspec)
{
  CinnamonRecorder *recorder = CINNAMON_RECORDER (object);

  switch (prop_id)
    {
    case PROP_STAGE:
      recorder_set_stage (recorder, g_value_get_object (value));
      break;
    case PROP_FRAMERATE:
      recorder_set_framerate (recorder, g_value_get_int (value));
      break;
    case PROP_PIPELINE:
      recorder_set_pipeline (recorder, g_value_get_string (value));
      break;
    case PROP_FILENAME:
      recorder_set_filename (recorder, g_value_get_string (value));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_recorder_get_property (GObject         *object,
                             guint            prop_id,
                             GValue          *value,
                             GParamSpec      *pspec)
{
  CinnamonRecorder *recorder = CINNAMON_RECORDER (object);

  switch (prop_id)
    {
    case PROP_STAGE:
      g_value_set_object (value, G_OBJECT (recorder->stage));
      break;
    case PROP_FRAMERATE:
      g_value_set_int (value, recorder->framerate);
      break;
    case PROP_PIPELINE:
      g_value_set_string (value, recorder->pipeline_description);
      break;
    case PROP_FILENAME:
      g_value_set_string (value, recorder->filename);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_recorder_class_init (CinnamonRecorderClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->finalize = cinnamon_recorder_finalize;
  gobject_class->get_property = cinnamon_recorder_get_property;
  gobject_class->set_property = cinnamon_recorder_set_property;

  g_object_class_install_property (gobject_class,
                                   PROP_STAGE,
                                   g_param_spec_object ("stage",
                                                        "Stage",
                                                        "Stage to record",
                                                        CLUTTER_TYPE_STAGE,
                                                        G_PARAM_READWRITE));

  g_object_class_install_property (gobject_class,
                                   PROP_FRAMERATE,
                                   g_param_spec_int ("framerate",
                                                     "Framerate",
                                                     "Framerate used for resulting video in frames-per-second",
                                                      0,
                                                      G_MAXINT,
                                                      DEFAULT_FRAMES_PER_SECOND,
                                                      G_PARAM_READWRITE));

  g_object_class_install_property (gobject_class,
                                   PROP_PIPELINE,
                                   g_param_spec_string ("pipeline",
                                                        "Pipeline",
                                                        "GStreamer pipeline description to encode recordings",
                                                        NULL,
                                                        G_PARAM_READWRITE));

  g_object_class_install_property (gobject_class,
                                   PROP_FILENAME,
                                   g_param_spec_string ("filename",
                                                        "Filename",
                                                        "The filename template to use for output files",
                                                        NULL,
                                                        G_PARAM_READWRITE));
}

/* Sets the GstCaps (video format, in this case) on the stream
 */
static void
recorder_pipeline_set_caps (RecorderPipeline *pipeline)
{
  GstCaps *caps;

  /* The data is always native-endian xRGB; videoconvert
   * doesn't support little-endian xRGB, but does support
   * big-endian BGRx.
   */
  caps = gst_caps_new_simple ("video/x-raw",
#if G_BYTE_ORDER == G_LITTLE_ENDIAN
                              "format", G_TYPE_STRING, "BGRx",
#else
                              "format", G_TYPE_STRING, "xRGB",
#endif
                              "bpp", G_TYPE_INT, 32,
                              "depth", G_TYPE_INT, 24,
                              "framerate", GST_TYPE_FRACTION, pipeline->recorder->framerate, 1,
                              "width", G_TYPE_INT, pipeline->recorder->area.width,
                              "height", G_TYPE_INT, pipeline->recorder->area.height,
                              NULL);
  g_object_set (pipeline->src, "caps", caps, NULL);
  gst_caps_unref (caps);
}

/* Augments the supplied pipeline with the source elements: the actual
 * CinnamonRecorderSrc element where we inject frames then additional elements
 * to convert the output into something palatable.
 */
static gboolean
recorder_pipeline_add_source (RecorderPipeline *pipeline)
{
  GstPad *sink_pad = NULL, *src_pad = NULL;
  gboolean result = FALSE;
  GstElement *videoconvert;

  sink_pad = gst_bin_find_unlinked_pad (GST_BIN (pipeline->pipeline), GST_PAD_SINK);
  if (sink_pad == NULL)
    {
      g_warning("CinnamonRecorder: pipeline has no unlinked sink pad");
      goto out;
    }

  pipeline->src = gst_element_factory_make ("cinnamonrecordersrc", NULL);
  if (pipeline->src == NULL)
    {
      g_warning ("Can't create recorder source element");
      goto out;
    }
  gst_bin_add (GST_BIN (pipeline->pipeline), pipeline->src);

  recorder_pipeline_set_caps (pipeline);

  /* The videoconvert element is a generic converter; it will convert
   * our supplied fixed format data into whatever the encoder wants
   */
  videoconvert = gst_element_factory_make ("videoconvert", NULL);
  if (!videoconvert)
    {
      g_warning("Can't create videoconvert element");
      goto out;
    }
  gst_bin_add (GST_BIN (pipeline->pipeline), videoconvert);

  gst_element_link_many (pipeline->src, videoconvert, NULL);
  src_pad = gst_element_get_static_pad (videoconvert, "src");

  if (!src_pad)
    {
      g_warning("CinnamonRecorder: can't get src pad to link into pipeline");
      goto out;
    }

  if (gst_pad_link (src_pad, sink_pad) != GST_PAD_LINK_OK)
    {
      g_warning("CinnamonRecorder: can't link to sink pad");
      goto out;
    }

  result = TRUE;

 out:
  if (sink_pad)
    gst_object_unref (sink_pad);
  if (src_pad)
    gst_object_unref (src_pad);

  return result;
}

/* Counts '', 'a', ..., 'z', 'aa', ..., 'az', 'ba', ... */
static void
increment_unique (GString *unique)
{
  int i;

  for (i = unique->len - 1; i >= 0; i--)
    {
      if (unique->str[i] != 'z')
        {
          unique->str[i]++;
          return;
        }
      else
        unique->str[i] = 'a';
    }

  g_string_prepend_c (unique, 'a');
}

static char *
get_absolute_path (char *maybe_relative)
{
  char *path;

  if (g_path_is_absolute (maybe_relative))
    path = g_strdup (maybe_relative);
  else
    {
      char *cwd = g_get_current_dir ();
      path = g_build_filename (cwd, maybe_relative, NULL);
      g_free (cwd);
    }

  return path;
}

/* Open a file for writing. Opening the file ourselves and using fdsink has
 * the advantage over filesink of being able to use O_EXCL when we want to
 * avoid overwriting* an existing file. Returns -1 if the file couldn't
 * be opened.
 */
static int
recorder_open_outfile (CinnamonRecorder *recorder)
{
  GString *unique = g_string_new (NULL); /* add to filename to make it unique */
  const char *pattern;
  int flags;
  int outfile = -1;

  recorder->count++;

  pattern = recorder->filename;
  if (!pattern)
    pattern = DEFAULT_FILENAME;

  while (TRUE)
    {
      GString *filename = g_string_new (NULL);
      const char *p;

      for (p = pattern; *p; p++)
        {
          if (*p == '%')
            {
              switch (*(p + 1))
                {
                case '%':
                case '\0':
                  g_string_append_c (filename, '%');
                  break;
                case 'c':
                  {
                    /* Count distinguishing multiple files created in session */
                    g_string_append_printf (filename, "%d", recorder->count);
                    recorder->filename_has_count = TRUE;
                  }
                  break;
                case 'd':
                  {
                    /* Appends date as YYYYMMDD */
                    GDateTime *dt;
                    dt = g_date_time_new_now_local ();
                    g_string_append_printf (filename, "%04d%02d%02d",
                                            g_date_time_get_year (dt),
                                            g_date_time_get_month (dt),
                                            g_date_time_get_day_of_month (dt));
                  }
                  break;
                case 'u':
                  if (recorder->unique)
                    g_string_append (filename, recorder->unique);
                  else
                    g_string_append (filename, unique->str);
                  break;
                default:
                  g_warning ("Unknown escape %%%c in filename", *p);
                  g_string_free (filename, TRUE);
                  goto out;
                }

              p++;
            }
          else
            g_string_append_c (filename, *p);
        }

      /* If a filename is explicitly specified without %u then we assume the user
       * is fine with over-writing the old contents; putting %u in the default
       * should avoid problems with malicious symlinks.
       */
      flags = O_WRONLY | O_CREAT | O_TRUNC;
      if (recorder->filename_has_count)
        flags |= O_EXCL;

      outfile = open (filename->str, flags, 0666);
      if (outfile != -1)
        {
          char *path = get_absolute_path (filename->str);
          g_printerr ("Recording to %s\n", path);
          g_free (path);

          g_string_free (filename, TRUE);
          goto out;
        }

      if (outfile == -1 &&
          (errno != EEXIST || !recorder->filename_has_count))
        {
          g_warning ("Cannot open output file '%s': %s", filename->str, g_strerror (errno));
          g_string_free (filename, TRUE);
          goto out;
        }

      if (recorder->unique)
        {
          /* We've already picked a unique string based on count=1, and now we had a collision
           * for a subsequent count.
           */
          g_warning ("Name collision with existing file for '%s'", filename->str);
          g_string_free (filename, TRUE);
          goto out;
        }

      g_string_free (filename, TRUE);

      increment_unique (unique);
    }

 out:
  if (outfile != -1)
    recorder->unique = g_string_free (unique, FALSE);
  else
    g_string_free (unique, TRUE);

  return outfile;
}

/* Augments the supplied pipeline with a sink element to write to the output
 * file, if necessary.
 */
static gboolean
recorder_pipeline_add_sink (RecorderPipeline *pipeline)
{
  GstPad *sink_pad = NULL, *src_pad = NULL;
  GstElement *fdsink;
  gboolean result = FALSE;

  src_pad = gst_bin_find_unlinked_pad (GST_BIN (pipeline->pipeline), GST_PAD_SRC);
  if (src_pad == NULL)
    {
      /* Nothing to do - assume that we were given a complete pipeline */
      return TRUE;
    }

  pipeline->outfile = recorder_open_outfile (pipeline->recorder);
  if (pipeline->outfile == -1)
    goto out;

  fdsink = gst_element_factory_make ("fdsink", NULL);
  if (fdsink == NULL)
    {
      g_warning("Can't create fdsink element");
      goto out;
    }
  gst_bin_add (GST_BIN (pipeline->pipeline), fdsink);
  g_object_set (fdsink, "fd", pipeline->outfile, NULL);

  sink_pad = gst_element_get_static_pad (fdsink, "sink");
  if (!sink_pad)
    {
      g_warning("CinnamonRecorder: can't get sink pad to link pipeline output");
      goto out;
    }

  if (gst_pad_link (src_pad, sink_pad) != GST_PAD_LINK_OK)
    {
      g_warning("CinnamonRecorder: can't link to sink pad");
      goto out;
    }

  result = TRUE;

 out:
  if (src_pad)
    gst_object_unref (src_pad);
  if (sink_pad)
    gst_object_unref (sink_pad);

  return result;
}

static gboolean
recorder_update_memory_used_timeout (gpointer data)
{
  CinnamonRecorder *recorder = data;
  recorder->update_memory_used_timeout = 0;

  recorder_update_memory_used (recorder, TRUE);

  return FALSE;
}

/* We throttle down the frequency which we recompute memory usage
 * and draw the buffer indicator to avoid cutting into performance.
 */
static void
recorder_pipeline_on_memory_used_changed (CinnamonRecorderSrc *src,
                                          GParamSpec       *spec,
                                          RecorderPipeline *pipeline)
{
  CinnamonRecorder *recorder = pipeline->recorder;
  if (!recorder)
    return;

  if (recorder->update_memory_used_timeout == 0)
    recorder->update_memory_used_timeout = g_timeout_add (UPDATE_MEMORY_USED_DELAY,
                                                          recorder_update_memory_used_timeout,
                                                          recorder);
}

static void
recorder_pipeline_free (RecorderPipeline *pipeline)
{
  if (pipeline->pipeline != NULL)
    gst_object_unref (pipeline->pipeline);

  if (pipeline->outfile != -1)
    close (pipeline->outfile);

  g_clear_object (&pipeline->recorder);

  g_free (pipeline);
}

/* Function gets called on pipeline-global events; we use it to
 * know when the pipeline is finished.
 */
static gboolean
recorder_pipeline_bus_watch (GstBus     *bus,
                             GstMessage *message,
                             gpointer    data)
{
  RecorderPipeline *pipeline = data;

  if (message->type == GST_MESSAGE_EOS)
    {
      recorder_pipeline_closed (pipeline);
      return FALSE; /* remove watch */
    }
  else if (message->type == GST_MESSAGE_ERROR)
    {
        GError *error;

        gst_message_parse_error (message, &error, NULL);
        g_warning ("Error in recording pipeline: %s\n", error->message);
        g_error_free (error);
        recorder_pipeline_closed (pipeline);
        return FALSE; /* remove watch */
    }

  /* Leave the watch in place */
  return TRUE;
}

/* Clean up when the pipeline is finished
 */
static void
recorder_pipeline_closed (RecorderPipeline *pipeline)
{
  g_signal_handlers_disconnect_by_func (pipeline->src,
                                        (gpointer) recorder_pipeline_on_memory_used_changed,
                                        pipeline);

  gst_element_set_state (pipeline->pipeline, GST_STATE_NULL);

  if (pipeline->recorder)
    {
      CinnamonRecorder *recorder = pipeline->recorder;
      if (pipeline == recorder->current_pipeline)
        {
          /* Error case; force a close */
          recorder->current_pipeline = NULL;
          cinnamon_recorder_close (recorder);
        }

      recorder->pipelines = g_slist_remove (recorder->pipelines, pipeline);
    }

  recorder_pipeline_free (pipeline);
}

/*
 * Replaces '%T' in the passed pipeline with the thread count,
 * the maximum possible value is 64 (limit of what vp8enc supports)
 *
 * It is assumes that %T occurs only once.
 */
static char*
substitute_thread_count (const char *pipeline)
{
  char *tmp;
  int n_threads;
  GString *result;

  tmp = strstr (pipeline, "%T");

  if (!tmp)
    return g_strdup (pipeline);

#ifdef _SC_NPROCESSORS_ONLN
    {
      int n_processors = sysconf (_SC_NPROCESSORS_ONLN); /* includes hyper-threading */
      n_threads = MIN (MAX (1, n_processors - 1), 64);
    }
#else
    n_threads = 3;
#endif

  result = g_string_new (NULL);
  g_string_append_len (result, pipeline, tmp - pipeline);
  g_string_append_printf (result, "%d", n_threads);
  g_string_append (result, tmp + 2);

  return g_string_free (result, FALSE);;
}

static gboolean
recorder_open_pipeline (CinnamonRecorder *recorder)
{
  RecorderPipeline *pipeline;
  const char *pipeline_description;
  char *parsed_pipeline;
  GError *error = NULL;
  GstBus *bus;

  pipeline = g_new0(RecorderPipeline, 1);
  pipeline->recorder = g_object_ref (recorder);
  pipeline->outfile = - 1;

  pipeline_description = recorder->pipeline_description;
  if (!pipeline_description)
    pipeline_description = DEFAULT_PIPELINE;

  parsed_pipeline = substitute_thread_count (pipeline_description);

  pipeline->pipeline = gst_parse_launch_full (parsed_pipeline, NULL,
                                              GST_PARSE_FLAG_FATAL_ERRORS,
                                              &error);
  g_free (parsed_pipeline);

  if (pipeline->pipeline == NULL)
    {
      g_warning ("CinnamonRecorder: failed to parse pipeline: %s", error->message);
      g_error_free (error);
      goto error;
    }

  if (!recorder_pipeline_add_source (pipeline))
    goto error;

  if (!recorder_pipeline_add_sink (pipeline))
    goto error;

  gst_element_set_state (pipeline->pipeline, GST_STATE_PLAYING);

  bus = gst_pipeline_get_bus (GST_PIPELINE (pipeline->pipeline));
  gst_bus_add_watch (bus, recorder_pipeline_bus_watch, pipeline);
  gst_object_unref (bus);

  g_signal_connect (pipeline->src, "notify::memory-used",
                    G_CALLBACK (recorder_pipeline_on_memory_used_changed), pipeline);

  recorder->current_pipeline = pipeline;
  recorder->pipelines = g_slist_prepend (recorder->pipelines, pipeline);

  return TRUE;

 error:
  recorder_pipeline_free (pipeline);

  return FALSE;
}

static void
recorder_close_pipeline (CinnamonRecorder *recorder)
{
  if (recorder->current_pipeline != NULL)
    {
      /* This will send an EOS (end-of-stream) message after the last frame
       * is written. The bus watch for the pipeline will get it and do
       * final cleanup
       */
      cinnamon_recorder_src_close (CINNAMON_RECORDER_SRC (recorder->current_pipeline->src));

      recorder->current_pipeline = NULL;
      recorder->filename_has_count = FALSE;
    }
}

/**
 * cinnamon_recorder_new:
 * @stage: The #ClutterStage
 *
 * Create a new #CinnamonRecorder to record movies of a #ClutterStage
 *
 * Return value: The newly created #CinnamonRecorder object
 */
CinnamonRecorder     *
cinnamon_recorder_new (ClutterStage  *stage)
{
  return g_object_new (CINNAMON_TYPE_RECORDER,
                       "stage",    stage,
                       NULL);
}

/**
 * cinnamon_recorder_set_framerate:
 * @recorder: the #CinnamonRecorder
 * @framerate: Framerate used for resulting video in frames-per-second.
 *
 * Sets the number of frames per second we configure for the GStreamer pipeline.
 *
 * The default value is 15.
 */
void
cinnamon_recorder_set_framerate (CinnamonRecorder *recorder,
                             int framerate)
{
  g_return_if_fail (CINNAMON_IS_RECORDER (recorder));

  recorder_set_framerate (recorder, framerate);
}

/**
 * cinnamon_recorder_set_filename:
 * @recorder: the #CinnamonRecorder
 * @filename: the filename template to use for output files,
 *            or %NULL for the defalt value.
 *
 * Sets the filename that will be used when creating output
 * files. This is only used if the configured pipeline has an
 * unconnected source pad (as the default pipeline does). If
 * the pipeline is complete, then the filename is unused. The
 * provided string is used as a template.It can contain
 * the following escapes:
 *
 * %d: The current date as YYYYYMMDD
 * %u: A string added to make the filename unique.
 *     '', 'a', 'b', ... 'aa', 'ab', ..
 * %c: A counter that is updated (opening a new file) each
 *     time the recording stream is paused.
 * %%: A literal percent
 *
 * The default value is 'cinnamon-%d%u-%c.ogg'.
 */
void
cinnamon_recorder_set_filename (CinnamonRecorder *recorder,
                             const char    *filename)
{
  g_return_if_fail (CINNAMON_IS_RECORDER (recorder));

  recorder_set_filename (recorder, filename);

}

/**
 * cinnamon_recorder_set_pipeline:
 * @recorder: the #CinnamonRecorder
 * @pipeline: (allow-none): the GStreamer pipeline used to encode recordings
 *            or %NULL for the default value.
 *
 * Sets the GStreamer pipeline used to encode recordings.
 * It follows the syntax used for gst-launch. The pipeline
 * should have an unconnected sink pad where the recorded
 * video is recorded. It will normally have a unconnected
 * source pad; output from that pad will be written into the
 * output file. (See cinnamon_recorder_set_filename().) However
 * the pipeline can also take care of its own output - this
 * might be used to send the output to an icecast server
 * via shout2send or similar.
 *
 * The default value is 'vp8enc min_quantizer=13 max_quantizer=13 cpu-used=5 deadline=1000000 threads=%T ! queue ! webmmux'
 */
void
cinnamon_recorder_set_pipeline (CinnamonRecorder *recorder,
                             const char    *pipeline)
{
  g_return_if_fail (CINNAMON_IS_RECORDER (recorder));

  recorder_set_pipeline (recorder, pipeline);
}

void
cinnamon_recorder_set_area (CinnamonRecorder *recorder,
                            int               x,
                            int               y,
                            int               width,
                            int               height)
{
  g_return_if_fail (CINNAMON_IS_RECORDER (recorder));

  recorder->custom_area = TRUE;
  recorder->area.x = CLAMP (x, 0, recorder->stage_width);
  recorder->area.y = CLAMP (y, 0, recorder->stage_height);
  recorder->area.width = CLAMP (width,
                                0, recorder->stage_width - recorder->area.x);
  recorder->area.height = CLAMP (height,
                                 0, recorder->stage_height - recorder->area.y);

  /* This breaks the recording but tweaking the GStreamer pipeline a bit
   * might make it work, at least if the codec can handle a stream where
   * the frame size changes in the middle.
   */
  if (recorder->current_pipeline)
    recorder_pipeline_set_caps (recorder->current_pipeline);
}

/**
 * cinnamon_recorder_record:
 * @recorder: the #CinnamonRecorder
 *
 * Starts recording, or continues a recording that was previously
 * paused. Starting the recording may fail if the output file
 * cannot be opened, or if the output stream cannot be created
 * for other reasons. In that case a warning is printed to
 * stderr. There is no way currently to get details on how
 * recording failed to start.
 *
 * An extra reference count is added to the recorder if recording
 * is successfully started; the recording object will not be freed
 * until recording is stopped even if the creator no longer holds
 * a reference. Recording is automatically stopped if the stage
 * is destroyed.
 *
 * Return value: %TRUE if recording was successfully started
 */
gboolean
cinnamon_recorder_record (CinnamonRecorder *recorder)
{
  g_return_val_if_fail (CINNAMON_IS_RECORDER (recorder), FALSE);
  g_return_val_if_fail (recorder->stage != NULL, FALSE);
  g_return_val_if_fail (recorder->state != RECORDER_STATE_RECORDING, FALSE);

  if (recorder->current_pipeline)
    {
      /* Adjust the start time so that the times in the stream ignore the
       * pause
       */
      recorder->start_time = recorder->start_time + (get_wall_time() - recorder->pause_time);
    }
  else
    {
      if (!recorder_open_pipeline (recorder))
        return FALSE;

      recorder->start_time = get_wall_time();
    }

  recorder->state = RECORDER_STATE_RECORDING;
  recorder_add_update_pointer_timeout (recorder);

  /* Set up repaint hook */
  recorder->repaint_hook_id = clutter_threads_add_repaint_func(recorder_repaint_hook, recorder->stage, NULL);

  /* Record an initial frame and also redraw with the indicator */
  clutter_actor_queue_redraw (CLUTTER_ACTOR (recorder->stage));

  /* We keep a ref while recording to let a caller start a recording then
   * drop their reference to the recorder
   */
  g_object_ref (recorder);

  return TRUE;
}

/**
 * cinnamon_recorder_pause:
 * @recorder: the #CinnamonRecorder
 *
 * Temporarily stop recording. If the specified filename includes
 * the %c escape, then the stream is closed and a new stream with
 * an incremented counter will be created. Otherwise the stream
 * is paused and will be continued when cinnamon_recorder_record()
 * is next called.
 */
void
cinnamon_recorder_pause (CinnamonRecorder *recorder)
{
  g_return_if_fail (CINNAMON_IS_RECORDER (recorder));
  g_return_if_fail (recorder->state == RECORDER_STATE_RECORDING);

  recorder_remove_update_pointer_timeout (recorder);
  /* We want to record one more frame since some time may have
   * elapsed since the last frame
   */
  recorder_record_frame (recorder, TRUE);

  if (recorder->filename_has_count)
    recorder_close_pipeline (recorder);

  recorder->state = RECORDER_STATE_PAUSED;
  recorder->pause_time = get_wall_time();

  /* Queue a redraw to remove the recording indicator */
  clutter_actor_queue_redraw (CLUTTER_ACTOR (recorder->stage));

  if (recorder->repaint_hook_id != 0)
  {
    clutter_threads_remove_repaint_func (recorder->repaint_hook_id);
    recorder->repaint_hook_id = 0;
  }
}

/**
 * cinnamon_recorder_close:
 * @recorder: the #CinnamonRecorder
 *
 * Stops recording. It's possible to call cinnamon_recorder_record()
 * again to reopen a new recording stream, but unless change the
 * recording filename, this may result in the old recording being
 * overwritten.
 */
void
cinnamon_recorder_close (CinnamonRecorder *recorder)
{
  g_return_if_fail (CINNAMON_IS_RECORDER (recorder));
  g_return_if_fail (recorder->state != RECORDER_STATE_CLOSED);

  if (recorder->state == RECORDER_STATE_RECORDING)
    cinnamon_recorder_pause (recorder);

  recorder_remove_update_pointer_timeout (recorder);
  recorder_remove_redraw_timeout (recorder);
  recorder_close_pipeline (recorder);

  recorder->state = RECORDER_STATE_CLOSED;
  recorder->count = 0;
  g_free (recorder->unique);
  recorder->unique = NULL;

  /* Release the refcount we took when we started recording */
  g_object_unref (recorder);
}

/**
 * cinnamon_recorder_is_recording:
 *
 * Determine if recording is currently in progress. (The recorder
 * is not paused or closed.)
 *
 * Return value: %TRUE if the recorder is currently recording.
 */
gboolean
cinnamon_recorder_is_recording (CinnamonRecorder *recorder)
{
  g_return_val_if_fail (CINNAMON_IS_RECORDER (recorder), FALSE);

  return recorder->state == RECORDER_STATE_RECORDING;
}
