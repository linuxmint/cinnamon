#include "config.h"

#include <math.h>

#include <gtk/gtk.h>
#include <cairo.h>
#include <gtk4-layer-shell/gtk4-layer-shell.h>

#include "bg-wayland.h"
#include "bg-geometry.h"

/* BgWaylandBackend
 *
 * Owns the per-monitor layer-shell windows and everything about presenting a
 * background on Wayland. It asks the daemon what to paint (via
 * cinnamon_background_daemon_render_region) and tells it when the wallpaper is up (via
 * cinnamon_background_daemon_notify_ready); the daemon knows nothing about layer shell.
*/

#define BG_FADE_DURATION_MS 1500

/* The identity of one render: its geometry, and the wallpaper it was painted
   from. A window's last params are compared against the current ones to skip a
   repaint that would come out identical, and two monitors whose params match
   share a single texture. */
typedef struct {
    int    width, height;
    GdkRectangle span;
    double scale;
    guint  content;    /* cinnamon_background_daemon_content_hash() for this monitor */
} BgRenderParams;

#define BG_TYPE_WAYLAND_WINDOW (bg_wayland_window_get_type ())
G_DECLARE_FINAL_TYPE (BgWaylandWindow, bg_wayland_window, BG, WAYLAND_WINDOW, GtkWindow)


/* BgFader: ease-out-cubic GPU crossfade between two paintables
 *
 * GtkStack's crossfade isn't as nice as ease-out-cubic that muffin uses for x11
 * transitions, so we do our own crossfade. The blend is still a single gsk_cross_fade_node,
 * so the textures stay zero-copy dmabuf. */

#define BG_TYPE_FADER (bg_fader_get_type ())
G_DECLARE_FINAL_TYPE (BgFader, bg_fader, BG, FADER, GtkWidget)

struct _BgFader
{
    GtkWidget     parent_instance;

    GdkPaintable *prev;
    GdkPaintable *cur;
    double        progress;     /* linear [0,1] */
    guint         duration_ms;
    gint64        start_time;
    guint         tick_id;
};

G_DEFINE_FINAL_TYPE (BgFader, bg_fader, GTK_TYPE_WIDGET)

/* From clutter-easing.c (Robert Penner, MIT) - the same curve muffin/clutter
 * use for the X11 background transition. */
static inline double
ease_out_cubic (double t)
{
    double p = t - 1.0;
    return p * p * p + 1.0;
}

static gboolean
bg_fader_tick (GtkWidget *widget, GdkFrameClock *clock, gpointer data)
{
    BgFader *self = BG_FADER (widget);
    gint64 now = gdk_frame_clock_get_frame_time (clock);

    if (self->start_time == 0)
        self->start_time = now;

    double t = (double) (now - self->start_time) / (self->duration_ms * 1000.0);

    if (t >= 1.0) {
        self->progress = 1.0;
        g_clear_object (&self->prev);
        self->tick_id = 0;
        gtk_widget_queue_draw (widget);
        return G_SOURCE_REMOVE;
    }

    self->progress = t;
    gtk_widget_queue_draw (widget);
    return G_SOURCE_CONTINUE;
}

static void
bg_fader_snapshot (GtkWidget *widget, GtkSnapshot *snapshot)
{
    BgFader *self = BG_FADER (widget);
    int w = gtk_widget_get_width (widget);
    int h = gtk_widget_get_height (widget);

    if (w <= 0 || h <= 0 || self->cur == NULL)
        return;

    if (self->prev == NULL || self->progress >= 1.0) {
        gdk_paintable_snapshot (self->cur, GDK_SNAPSHOT (snapshot), w, h);
        return;
    }

    gtk_snapshot_push_cross_fade (snapshot, ease_out_cubic (self->progress));
    gdk_paintable_snapshot (self->prev, GDK_SNAPSHOT (snapshot), w, h);
    gtk_snapshot_pop (snapshot);
    gdk_paintable_snapshot (self->cur, GDK_SNAPSHOT (snapshot), w, h);
    gtk_snapshot_pop (snapshot);
}

static void
bg_fader_dispose (GObject *object)
{
    BgFader *self = BG_FADER (object);

    if (self->tick_id) {
        gtk_widget_remove_tick_callback (GTK_WIDGET (self), self->tick_id);
        self->tick_id = 0;
    }
    g_clear_object (&self->prev);
    g_clear_object (&self->cur);

    G_OBJECT_CLASS (bg_fader_parent_class)->dispose (object);
}

static void
bg_fader_class_init (BgFaderClass *klass)
{
    G_OBJECT_CLASS (klass)->dispose = bg_fader_dispose;
    GTK_WIDGET_CLASS (klass)->snapshot = bg_fader_snapshot;
}

static void
bg_fader_init (BgFader *self)
{
    self->duration_ms = BG_FADE_DURATION_MS;
    self->progress = 1.0;
}

static void
bg_fader_set_paintable (BgFader *self, GdkPaintable *paintable, gboolean animate)
{
    if (self->tick_id) {
        gtk_widget_remove_tick_callback (GTK_WIDGET (self), self->tick_id);
        self->tick_id = 0;
    }

    if (!animate || self->cur == NULL) {
        g_clear_object (&self->prev);
        g_set_object (&self->cur, paintable);
        self->progress = 1.0;
        gtk_widget_queue_draw (GTK_WIDGET (self));
        return;
    }

    g_clear_object (&self->prev);
    self->prev = self->cur;
    self->cur = NULL;
    g_set_object (&self->cur, paintable);
    self->progress = 0.0;
    self->start_time = 0;
    self->tick_id = gtk_widget_add_tick_callback (GTK_WIDGET (self),
                                                  bg_fader_tick, NULL, NULL);
    gtk_widget_queue_draw (GTK_WIDGET (self));
}

/* BgWaylandWindow */

static gboolean
bg_render_params_equal (const BgRenderParams *a, const BgRenderParams *b)
{
    return a->width  == b->width  && a->height == b->height &&
           gdk_rectangle_equal (&a->span, &b->span) &&
           a->scale  == b->scale  && a->content == b->content;
}

struct _BgWaylandWindow
{
    GtkWindow    parent_instance;

    GdkMonitor  *monitor;
    BgFader     *fader;
    gboolean     first_frame_done;
    gboolean     has_image;
    gboolean     creation_logged;
    gboolean     presented;

    BgRenderParams last_params;

    /* last layout we reported, to detect real changes */
    GdkRectangle last_geometry;
    double       last_scale;
};

enum { FIRST_FRAME, GEOMETRY_CHANGED, N_WIN_SIGNALS };
static guint win_signals[N_WIN_SIGNALS];

G_DEFINE_FINAL_TYPE (BgWaylandWindow, bg_wayland_window, GTK_TYPE_WINDOW)

static const char *
monitor_label (GdkMonitor *monitor)
{
    const char *connector = gdk_monitor_get_connector (monitor);

    return connector ? connector : "unnamed monitor";
}

static void
log_creation (BgWaylandWindow *win)
{
    const char *connector = gdk_monitor_get_connector (win->monitor);

    if (win->creation_logged || connector == NULL)
        return;

    win->creation_logged = TRUE;
    g_debug ("Created layer-shell background window for monitor %s", connector);
}

/* Emitted when the surface's logical size or scale actually changes - on the
 * initial configure, on a monitor resolution change, and on a live scale
 * change (which arrives as a surface property, not a monitors-changed). */
static void
notify_geometry_if_changed (BgWaylandWindow *win)
{
    GdkRectangle geometry;
    double scale = gdk_monitor_get_scale (win->monitor);

    log_creation (win);

    gdk_monitor_get_geometry (win->monitor, &geometry);

    if (geometry.width <= 0 || geometry.height <= 0 || !isfinite (scale) || scale <= 0.0)
        return;

    if (gdk_rectangle_equal (&geometry, &win->last_geometry) &&
        scale == win->last_scale)
        return;

    g_debug ("Monitor %s changed: (%d,%d) %dx%d at %.3gx",
             monitor_label (win->monitor),
             geometry.x, geometry.y, geometry.width, geometry.height, scale);

    win->last_geometry = geometry;
    win->last_scale = scale;

    g_signal_emit (win, win_signals[GEOMETRY_CHANGED], 0);
}

static void
on_monitor_geometry_changed (GdkMonitor *monitor G_GNUC_UNUSED,
                             GParamSpec *pspec   G_GNUC_UNUSED,
                             BgWaylandWindow *win)
{
    notify_geometry_if_changed (win);
}

static void
bg_wayland_window_dispose (GObject *object)
{
    BgWaylandWindow *win = BG_WAYLAND_WINDOW (object);

    g_clear_object (&win->monitor);

    G_OBJECT_CLASS (bg_wayland_window_parent_class)->dispose (object);
}

static void
bg_wayland_window_class_init (BgWaylandWindowClass *klass)
{
    G_OBJECT_CLASS (klass)->dispose = bg_wayland_window_dispose;

    /* Emitted once, after this monitor's surface has painted its first frame
     * with a wallpaper on it - this is used for timing during Cinnamon's startup
     * reveal. */
    win_signals[FIRST_FRAME] =
        g_signal_new ("first-frame",
                      G_TYPE_FROM_CLASS (klass),
                      G_SIGNAL_RUN_LAST,
                      0, NULL, NULL, NULL,
                      G_TYPE_NONE, 0);

    win_signals[GEOMETRY_CHANGED] =
        g_signal_new ("geometry-changed",
                      G_TYPE_FROM_CLASS (klass),
                      G_SIGNAL_RUN_LAST,
                      0, NULL, NULL, NULL,
                      G_TYPE_NONE, 0);
}

static void
bg_wayland_window_init (BgWaylandWindow *win G_GNUC_UNUSED)
{
}

static void
on_after_paint (GdkFrameClock *clock, BgWaylandWindow *win)
{
    if (win->first_frame_done || !win->has_image)
        return;
    win->first_frame_done = TRUE;
    g_signal_handlers_disconnect_by_func (clock, on_after_paint, win);
    g_signal_emit (win, win_signals[FIRST_FRAME], 0);
}

static void
log_compositor_diagnostics (GtkWindow *win)
{
    GdkDisplay *display = gtk_widget_get_display (GTK_WIDGET (win));

    g_message ("Compositor: gtk4-layer-shell %u.%u.%u, wlr-layer-shell protocol v%u",
               gtk_layer_get_major_version (),
               gtk_layer_get_minor_version (),
               gtk_layer_get_micro_version (),
               gtk_layer_get_protocol_version ());

    GdkDmabufFormats *formats = gdk_display_get_dmabuf_formats (display);
    gsize n_formats = formats ? gdk_dmabuf_formats_get_n_formats (formats) : 0;

    GskRenderer *renderer = gtk_native_get_renderer (GTK_NATIVE (win));
    const char *renderer_name = renderer ? G_OBJECT_TYPE_NAME (renderer) : "(none)";
    gboolean software = renderer == NULL ||
                        g_strcmp0 (renderer_name, "GskCairoRenderer") == 0;

    g_message ("Rendering: %s, %" G_GSIZE_FORMAT " compositor dmabuf format(s) -> %s",
               renderer_name, n_formats,
               (!software && n_formats > 0) ? "GPU buffers (zero-copy dmabuf)"
                                            : "software/shm fallback");
}

static void
on_window_map (GtkWidget *widget, gpointer user_data G_GNUC_UNUSED)
{
    BgWaylandWindow *win = BG_WAYLAND_WINDOW (widget);

    static gboolean logged = FALSE;
    if (!logged) {
        logged = TRUE;
        log_compositor_diagnostics (GTK_WINDOW (widget));
    }

    GdkFrameClock *clock = gtk_widget_get_frame_clock (widget);
    if (clock && !win->first_frame_done)
        g_signal_connect_object (clock, "after-paint", G_CALLBACK (on_after_paint), win, 0);

}

static BgWaylandWindow *
bg_wayland_window_new (GdkMonitor *monitor)
{
    BgWaylandWindow *win = g_object_ref_sink (
        g_object_new (BG_TYPE_WAYLAND_WINDOW,
                      "decorated", FALSE,
                      NULL));

    gtk_layer_init_for_window (GTK_WINDOW (win));
    gtk_layer_set_layer (GTK_WINDOW (win), GTK_LAYER_SHELL_LAYER_BACKGROUND);
    gtk_layer_set_namespace (GTK_WINDOW (win), "cinnamon-background-daemon");
    gtk_layer_set_anchor (GTK_WINDOW (win), GTK_LAYER_SHELL_EDGE_TOP,    TRUE);
    gtk_layer_set_anchor (GTK_WINDOW (win), GTK_LAYER_SHELL_EDGE_BOTTOM, TRUE);
    gtk_layer_set_anchor (GTK_WINDOW (win), GTK_LAYER_SHELL_EDGE_LEFT,   TRUE);
    gtk_layer_set_anchor (GTK_WINDOW (win), GTK_LAYER_SHELL_EDGE_RIGHT,  TRUE);
    gtk_layer_set_exclusive_zone (GTK_WINDOW (win), -1);
    gtk_layer_set_keyboard_mode (GTK_WINDOW (win), GTK_LAYER_SHELL_KEYBOARD_MODE_NONE);
    gtk_layer_set_monitor (GTK_WINDOW (win), monitor);

    win->monitor = g_object_ref (monitor);
    g_signal_connect_object (monitor, "notify::scale",
                             G_CALLBACK (on_monitor_geometry_changed), win, 0);
    g_signal_connect_object (monitor, "notify::geometry",
                             G_CALLBACK (on_monitor_geometry_changed), win, 0);

    log_creation (win);

    win->fader = g_object_new (BG_TYPE_FADER, NULL);
    gtk_widget_set_hexpand (GTK_WIDGET (win->fader), TRUE);
    gtk_widget_set_vexpand (GTK_WIDGET (win->fader), TRUE);

    gtk_window_set_child (GTK_WINDOW (win), GTK_WIDGET (win->fader));

    g_signal_connect (win, "map", G_CALLBACK (on_window_map), NULL);

    return win;
}

static GdkMonitor *
bg_wayland_window_get_monitor (BgWaylandWindow *win)
{
    return win->monitor;
}

static gboolean
bg_wayland_window_get_render_geometry (BgWaylandWindow *win,
                                       int             *out_width,
                                       int             *out_height,
                                       double          *out_scale)
{
    GdkRectangle geo;
    double scale = gdk_monitor_get_scale (win->monitor);

    gdk_monitor_get_geometry (win->monitor, &geo);

    if (geo.width <= 0 || geo.height <= 0 || !isfinite (scale) || scale <= 0.0)
        return FALSE;

    *out_width = geo.width;
    *out_height = geo.height;
    *out_scale = scale;
    return TRUE;
}

static const BgRenderParams *
bg_wayland_window_get_last_params (BgWaylandWindow *win)
{
    return win->last_params.width > 0 ? &win->last_params : NULL;
}

static GdkTexture *
texture_from_surface (cairo_surface_t *surface, const char *connector)
{
    if (cairo_surface_status (surface) != CAIRO_STATUS_SUCCESS) {
        g_warning ("cinnamon-background-daemon: not updating monitor %s, keeping previous image: %s",
                   connector, cairo_status_to_string (cairo_surface_status (surface)));
        cairo_surface_destroy (surface);
        return NULL;
    }

    int w = cairo_image_surface_get_width (surface);
    int h = cairo_image_surface_get_height (surface);
    int stride = cairo_image_surface_get_stride (surface);

    cairo_surface_flush (surface);

    GBytes *bytes = g_bytes_new_with_free_func (
        cairo_image_surface_get_data (surface),
        (gsize) stride * h,
        (GDestroyNotify) cairo_surface_destroy,
        surface);
    GdkTexture *tex = GDK_TEXTURE (gdk_memory_texture_new (
        w, h, GDK_MEMORY_B8G8R8A8_PREMULTIPLIED, bytes, stride));
    g_bytes_unref (bytes);

    return tex;
}

static void
bg_wayland_window_set_texture (BgWaylandWindow      *win,
                               GdkTexture           *texture,
                               gboolean              animate,
                               const BgRenderParams *params)
{
    g_debug ("    Setting %dx%d image on monitor %s (animate=%s)",
             gdk_texture_get_width (texture), gdk_texture_get_height (texture),
             gdk_monitor_get_connector (win->monitor), animate ? "yes" : "no");

    bg_fader_set_paintable (win->fader, GDK_PAINTABLE (texture), animate);

    win->has_image = TRUE;
    win->last_params = *params;

    if (!win->presented) {
        win->presented = TRUE;
        gtk_window_present (GTK_WINDOW (win));
    }
}

/* BgWaylandBackend */

struct _BgWaylandBackend
{
    CinnamonBackgroundDaemon *daemon;
    GPtrArray                *windows;   /* BgWaylandWindow *, one per monitor */
    guint                     geometry_redraw_id;
};

static void backend_draw (BgWaylandBackend *self, gboolean animate);

/* Ready once every window we have given an image to has shown it. */
static gboolean
all_windows_painted (BgWaylandBackend *self)
{
    gboolean any = FALSE;

    for (guint i = 0; i < self->windows->len; i++) {
        BgWaylandWindow *win = g_ptr_array_index (self->windows, i);

        if (!win->has_image)
            continue;
        if (!win->first_frame_done)
            return FALSE;

        any = TRUE;
    }

    return any;
}

static GdkRectangle
compute_monitor_union (GPtrArray *windows)
{
    g_autofree GdkRectangle *rects = g_new0 (GdkRectangle, windows->len);

    for (guint i = 0; i < windows->len; i++) {
        BgWaylandWindow *win = g_ptr_array_index (windows, i);

        gdk_monitor_get_geometry (bg_wayland_window_get_monitor (win), &rects[i]);
    }

    return bg_geometry_union (rects, windows->len);
}

/* One rendered region within a single draw pass. Monitors whose BgRenderParams
   match paint identical pixels, so the region is rendered once and the texture
   handed to each of them. Mirror mode across same-sized monitors is what this
   saves. */
typedef struct {
    BgRenderParams  params;
    GdkTexture     *texture;
} RenderedRegion;

static void
rendered_region_clear (gpointer data)
{
    g_clear_object (&((RenderedRegion *) data)->texture);
}

static GdkTexture *
rendered_region_lookup (GArray *rendered, const BgRenderParams *params)
{
    for (guint i = 0; i < rendered->len; i++) {
        RenderedRegion *r = &g_array_index (rendered, RenderedRegion, i);

        if (bg_render_params_equal (&r->params, params))
            return r->texture;
    }

    return NULL;
}

static void
backend_draw (BgWaylandBackend *self, gboolean animate)
{
    if (!self->windows || self->windows->len == 0)
        return;

    g_autoptr(GArray) rendered = g_array_new (FALSE, FALSE, sizeof (RenderedRegion));
    g_array_set_clear_func (rendered, rendered_region_clear);

    GdkRectangle canvas = compute_monitor_union (self->windows);
    gboolean spanned = cinnamon_background_daemon_is_spanned (self->daemon);

    g_debug ("Drawing Wayland backgrounds on %u monitor(s): animate=%s",
             self->windows->len, animate ? "yes" : "no");

    for (guint i = 0; i < self->windows->len; i++) {
        BgWaylandWindow *win = g_ptr_array_index (self->windows, i);
        GdkMonitor *monitor = bg_wayland_window_get_monitor (win);
        const char *connector = gdk_monitor_get_connector (monitor);
        int width, height;
        double scale;

        if (!bg_wayland_window_get_render_geometry (win, &width, &height, &scale)) {
            g_debug ("  %s: monitor geometry not available yet, deferring",
                     monitor_label (monitor));
            continue;
        }

        GdkRectangle geo;
        gdk_monitor_get_geometry (monitor, &geo);

        BgRenderParams params = {
            .width = width, .height = height, .scale = scale,
            .content = cinnamon_background_daemon_content_hash (self->daemon, connector),
        };

        params.span = bg_geometry_span (spanned, geo.x, geo.y, width, height, canvas);

        const BgRenderParams *last = bg_wayland_window_get_last_params (win);
        if (last && bg_render_params_equal (last, &params)) {
            g_debug ("  %s: unchanged, skipping", connector);
            continue;
        }

        GdkTexture *texture = rendered_region_lookup (rendered, &params);

        if (texture) {
            g_debug ("  %s: identical to a monitor already drawn this pass, sharing its image",
                     connector);
        } else {
            g_debug ("  %s: %dx%d logical at %.3gx -> %d x %d px, span (%d,%d) of %dx%d",
                     connector, width, height, scale,
                     (int) round (width * scale), (int) round (height * scale),
                     params.span.x, params.span.y, params.span.width, params.span.height);

            cairo_surface_t *surface = cinnamon_background_daemon_render_region (
                self->daemon, connector, width, height, &params.span, scale);

            texture = texture_from_surface (surface, connector);
            if (texture == NULL)
                continue;

            RenderedRegion region = { .params = params, .texture = texture };
            g_array_append_val (rendered, region);   /* the pass owns the ref */
        }

        bg_wayland_window_set_texture (win, texture, animate, &params);
    }

    if (all_windows_painted (self))
        cinnamon_background_daemon_notify_ready (self->daemon);
}

/* Repaint every monitor. @animate crossfades from the current wallpaper. */
void
bg_wayland_backend_draw (BgWaylandBackend *self, gboolean animate)
{
    backend_draw (self, animate);
}

static void
window_free (gpointer p)
{
    gtk_window_destroy (GTK_WINDOW (p));
    g_object_unref (p);
}

static void
on_window_first_frame (BgWaylandWindow *win, BgWaylandBackend *self)
{
    g_debug ("Monitor %s painted first frame",
             monitor_label (bg_wayland_window_get_monitor (win)));

    if (all_windows_painted (self))
        cinnamon_background_daemon_notify_ready (self->daemon);
}

static gboolean
scale_changed (BgWaylandBackend *self)
{
    for (guint i = 0; i < self->windows->len; i++) {
        BgWaylandWindow *win = g_ptr_array_index (self->windows, i);
        const BgRenderParams *last = bg_wayland_window_get_last_params (win);
        int width, height;
        double scale;

        if (!last || !bg_wayland_window_get_render_geometry (win, &width, &height, &scale))
            continue;

        if (scale != last->scale)
            return TRUE;
    }

    return FALSE;
}

static gboolean
geometry_redraw_cb (gpointer data)
{
    BgWaylandBackend *self = data;

    self->geometry_redraw_id = 0;

    cinnamon_background_daemon_build_render_inputs (self->daemon);

    if (scale_changed (self)) {
        g_debug ("Monitor scale changed, recreating background windows");
        bg_wayland_backend_setup_monitors (self);
        backend_draw (self, FALSE);
        cinnamon_background_daemon_release_render_inputs (self->daemon);
        return G_SOURCE_REMOVE;
    }

    g_debug ("Monitor geometry changed, repainting");
    backend_draw (self, FALSE);
    cinnamon_background_daemon_release_render_inputs (self->daemon);
    return G_SOURCE_REMOVE;
}

static void
on_window_geometry_changed (BgWaylandWindow  *win G_GNUC_UNUSED,
                            BgWaylandBackend *self)
{
    if (self->geometry_redraw_id == 0)
        self->geometry_redraw_id = g_idle_add (geometry_redraw_cb, self);
}

/* (Re)create one window per monitor. Call on startup and on monitor hotplug. */
void
bg_wayland_backend_setup_monitors (BgWaylandBackend *self)
{
    g_ptr_array_set_size (self->windows, 0);

    GdkDisplay *display = gdk_display_get_default ();
    GListModel *monitors = gdk_display_get_monitors (display);
    guint n = g_list_model_get_n_items (monitors);

    for (guint i = 0; i < n; i++) {
        g_autoptr(GdkMonitor) monitor = g_list_model_get_item (monitors, i);
        BgWaylandWindow *win = bg_wayland_window_new (monitor);

        g_signal_connect (win, "first-frame",
                          G_CALLBACK (on_window_first_frame), self);
        g_signal_connect (win, "geometry-changed",
                          G_CALLBACK (on_window_geometry_changed), self);
        g_ptr_array_add (self->windows, win);
    }

    g_debug ("Set up %u Wayland background window(s)", self->windows->len);
}

BgWaylandBackend *
bg_wayland_backend_new (CinnamonBackgroundDaemon *daemon)
{
    BgWaylandBackend *self = g_new0 (BgWaylandBackend, 1);

    self->daemon = daemon;
    self->windows = g_ptr_array_new_with_free_func (window_free);

    return self;
}

void
bg_wayland_backend_free (BgWaylandBackend *self)
{
    if (self == NULL)
        return;

    g_clear_handle_id (&self->geometry_redraw_id, g_source_remove);
    g_clear_pointer (&self->windows, g_ptr_array_unref);
    g_free (self);
}
