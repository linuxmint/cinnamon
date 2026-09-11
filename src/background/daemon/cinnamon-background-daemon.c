#include "config.h"

#include <math.h>
#include <signal.h>

#ifdef __GLIBC__
#include <malloc.h>
#endif

#include <gio/gio.h>
#include <gdk/gdk.h>
#include <glib-unix.h>
#include <gtk/gtk.h>
#include <cairo.h>

#if defined(GDK_WINDOWING_WAYLAND) && HAVE_WAYLAND
#define BG_WITH_WAYLAND 1
#include <gdk/wayland/gdkwayland.h>
#endif

#include <cinnamon-bg-list.h>

#include "cinnamon-background-daemon.h"
#include "cinnamon-background.h"
#include "bg-accounts.h"
#include "bg-renderer.h"
#ifdef BG_WITH_WAYLAND
#include "bg-wayland.h"
#endif
#include "bg-x11.h"

#define BG_APPLICATION_ID "org.Cinnamon.Background"

typedef enum {
    BG_STATE_INITIALIZING = 0,
    BG_STATE_READY        = 1,
} BgState;

// Mirrors MetaX11BackgroundTransition and the `background-transition` key
typedef enum {
    BG_TRANSITION_NONE,
    BG_TRANSITION_FADE_IN,
    BG_TRANSITION_BLEND,
} BgTransition;

struct _CinnamonBackgroundDaemon
{
    GApplication parent_instance;

    CinnamonBackground *skeleton;

    CinnamonBgList *bglist;

    /* uri (char *) -> CachedImage *. Source pixbufs are only needed while
     * rendering. */
    GHashTable  *pixbuf_cache;
    guint        malloc_trim_id;

    /* connector (char *) -> BgRenderInput * (heap); rebuilt each draw */
    GHashTable  *resolved;

    /* connector (char *) -> content hash (GUINT); rebuilt alongside @resolved */
    GHashTable  *content;

    /* Published as RenderedLayout. Held separately from @resolved, which the
       idle cache release empties a few seconds after every draw. */
    GVariant    *layout;

    gboolean     spanned;       /* mode == CINNAMON_BG_MODE_SPANNED; refreshed each draw */

    /* NULL on X11, where bg_x11_set_background() needs no state of its own, and
       in a build without the Wayland backend at all */
    gpointer     wayland;
    gboolean     first_draw;

    /* published once the wallpaper is actually on screen */
    gboolean     ready;

    /* monitor hotplug */
    GListModel  *monitors_model;
    gulong       monitors_changed_id;

    /* coalesces the redraw signals that arrive together */
    guint        redraw_id;

    /* transition preference */
    GSettings   *muffin_settings;
    BgTransition transition;
};

G_DEFINE_TYPE (CinnamonBackgroundDaemon, cinnamon_background_daemon, G_TYPE_APPLICATION)

static void draw_background (CinnamonBackgroundDaemon *daemon);
static void set_empty_layout (CinnamonBackgroundDaemon *daemon);

/* pixbuf cache */

typedef struct {
    GdkPixbuf *pixbuf;
    gint64     mtime;
} CachedImage;

static void
cached_image_free (gpointer data)
{
    CachedImage *ci = data;
    g_clear_object (&ci->pixbuf);
    g_free (ci);
}

static void
render_input_clear (BgRenderInput *in)
{
    g_clear_object (&in->source);
    g_clear_pointer (&in->uri, g_free);
    g_clear_pointer (&in->placement, g_free);
    g_clear_pointer (&in->shading, g_free);
}

static void
render_input_free (gpointer data)
{
    BgRenderInput *in = data;

    render_input_clear (in);
    g_free (in);
}

static void
clear_pixbuf_cache (CinnamonBackgroundDaemon *daemon)
{
    if (daemon->pixbuf_cache)
        g_hash_table_remove_all (daemon->pixbuf_cache);
}

static gint64
file_mtime (const char *path)
{
    g_autoptr(GFile) file = g_file_new_for_path (path);
    g_autoptr(GFileInfo) info =
        g_file_query_info (file,
                           G_FILE_ATTRIBUTE_TIME_MODIFIED,
                           G_FILE_QUERY_INFO_NONE,
                           NULL, NULL);
    if (!info)
        return 0;

    return (gint64) g_file_info_get_attribute_uint64 (info, G_FILE_ATTRIBUTE_TIME_MODIFIED);
}

/* Load (or return cached) pixbuf for a uri, refreshing on mtime change. The
 * cache is keyed by uri so monitors sharing an image only load it once. */
static GdkPixbuf *
get_pixbuf_for_uri (CinnamonBackgroundDaemon *daemon, const char *uri)
{
    if (!uri || uri[0] == '\0')
        return NULL;

    g_autoptr(GError) uri_err = NULL;
    g_autofree char *path = g_filename_from_uri (uri, NULL, &uri_err);

    if (!path) {
        g_warning ("Not a local file:// uri, cannot use as a background: %s (%s)",
                   uri, uri_err ? uri_err->message : "unknown error");
        return NULL;
    }

    gint64 mtime = file_mtime (path);

    CachedImage *ci = g_hash_table_lookup (daemon->pixbuf_cache, uri);
    if (ci && ci->mtime == mtime)
        return ci->pixbuf;

    g_autoptr(GError) err = NULL;
    GdkPixbuf *pixbuf = gdk_pixbuf_new_from_file (path, &err);

    if (!pixbuf) {
        g_warning ("Failed to load background pixbuf from %s: %s",
                   path, err ? err->message : "unknown error");
        g_hash_table_remove (daemon->pixbuf_cache, uri);
        return NULL;
    }

    g_debug ("    Loaded background image %s (%dx%d)", path,
             gdk_pixbuf_get_width (pixbuf), gdk_pixbuf_get_height (pixbuf));

    ci = g_new0 (CachedImage, 1);
    ci->pixbuf = pixbuf;
    ci->mtime = mtime;
    g_hash_table_insert (daemon->pixbuf_cache, g_strdup (uri), ci);

    return pixbuf;
}

static void
parse_item_color (GdkRGBA *rgba, const char *color)
{
    if (!gdk_rgba_parse (rgba, color)) {
        g_warning ("cinnamon-background-daemon: invalid background color '%s', using black",
                   color ? color : "(null)");
        *rgba = (GdkRGBA) { 0.0, 0.0, 0.0, 1.0 };
    }
}

static void
item_to_render_input (CinnamonBgItem *item, BgRenderInput *in)
{
    g_autofree char *primary = NULL;
    g_autofree char *secondary = NULL;

    g_object_get (item,
                  "color-shading-type", &in->shading,
                  "primary-color", &primary,
                  "secondary-color", &secondary,
                  NULL);

    parse_item_color (&in->primary, primary);
    parse_item_color (&in->secondary, secondary);

    if (cinnamon_bg_item_has_picture (item)) {
        g_object_get (item,
                      "picture-options", &in->placement,
                      "picture-uri", &in->uri,
                      NULL);
        return;
    }

    in->placement = g_strdup ("none");
    in->uri = NULL;
    in->source = NULL;
}

static void
ensure_render_source (CinnamonBackgroundDaemon *daemon, BgRenderInput *in)
{
    if (in->source != NULL || in->uri == NULL)
        return;

    GdkPixbuf *pixbuf = get_pixbuf_for_uri (daemon, in->uri);
    in->source = pixbuf ? g_object_ref (pixbuf) : NULL;
}

static void
get_single_input (CinnamonBackgroundDaemon *daemon, BgRenderInput *in)
{
    g_autoptr(CinnamonBgItem) item = g_list_model_get_item (G_LIST_MODEL (daemon->bglist), 0);

    if (item == NULL) {
        /* Not really reachable in practice */
        in->placement = g_strdup ("none");
        in->shading = g_strdup ("solid");
        in->primary = (GdkRGBA) { 0.0, 0.0, 0.0, 1.0 };
        in->secondary = in->primary;
        in->uri = NULL;
        in->source = NULL;
        return;
    }

    item_to_render_input (item, in);
}

#define MALLOC_TRIM_IDLE_SECONDS 3

static gboolean
malloc_trim_cb (gpointer data)
{
    CinnamonBackgroundDaemon *daemon = data;

#ifdef __GLIBC__
    malloc_trim (0);
#endif

    daemon->malloc_trim_id = 0;
    return G_SOURCE_REMOVE;
}

static void
on_muffin_transition_changed (GSettings                *settings,
                              const char               *key,
                              CinnamonBackgroundDaemon *daemon)
{
    daemon->transition = g_settings_get_enum (settings, "background-transition");
}

static void
setup_transition_pref (CinnamonBackgroundDaemon *daemon)
{
    daemon->muffin_settings = g_settings_new ("org.cinnamon.muffin");
    daemon->transition = g_settings_get_enum (daemon->muffin_settings, "background-transition");

    g_signal_connect (daemon->muffin_settings, "changed::background-transition",
                      G_CALLBACK (on_muffin_transition_changed), daemon);
}

/* The wire spelling of CinnamonBgMode. Pinned here rather than taken from the
   enum's nicks: this one is a published interface. */
static const char *
mode_name (CinnamonBgMode mode)
{
    switch (mode) {
        case CINNAMON_BG_MODE_INDEPENDENT: return "independent";
        case CINNAMON_BG_MODE_MIRROR:      return "mirror";
        case CINNAMON_BG_MODE_SPANNED:     return "spanned";
        default:                           return "mirror";
    }
}

static const char *
transition_name (BgTransition t)
{
    switch (t) {
        case BG_TRANSITION_NONE:    return "none";
        case BG_TRANSITION_FADE_IN: return "fade-in";
        case BG_TRANSITION_BLEND:   return "blend";
        default:                    return "unknown";
    }
}

void
cinnamon_background_daemon_notify_ready (CinnamonBackgroundDaemon *daemon)
{
    if (daemon->ready)
        return;
    daemon->ready = TRUE;
    g_debug ("Background ready");

    if (daemon->skeleton)
        cinnamon_background_set_state (daemon->skeleton, BG_STATE_READY);
}

/* Cheap identity for what a monitor should be painting: an unchanged value
   needs no repaint, and two monitors sharing one can share a texture. */
static guint
content_hash (const BgRenderInput *in)
{
    const char *uri = in->uri;
    gint64 mtime = 0;

    if (uri && uri[0] != '\0') {
        g_autofree char *path = g_filename_from_uri (uri, NULL, NULL);

        if (path)
            mtime = file_mtime (path);
    }

    g_autofree char *primary = gdk_rgba_to_string (&in->primary);
    g_autofree char *secondary = gdk_rgba_to_string (&in->secondary);

    g_autofree char *sig = g_strdup_printf ("%s|%" G_GINT64_FORMAT "|%s|%s|%s|%s",
                                            uri ? uri : "", mtime,
                                            in->placement ? in->placement : "",
                                            in->shading ? in->shading : "",
                                            primary, secondary);
    return g_str_hash (sig);
}

static char *
describe_resolved (const BgRenderInput *in)
{
    if (in->uri && in->uri[0] != '\0')
        return g_strdup_printf ("image %s (%s)", in->uri, in->placement);

    const char *kind = g_strcmp0 (in->shading, "horizontal") == 0 ? "hgradient"
                     : g_strcmp0 (in->shading, "vertical") == 0   ? "vgradient" : "color";
    g_autofree char *p = gdk_rgba_to_string (&in->primary);
    if (g_strcmp0 (in->shading, "solid") == 0)
        return g_strdup_printf ("%s %s", kind, p);
    g_autofree char *s = gdk_rgba_to_string (&in->secondary);
    return g_strdup_printf ("%s %s -> %s", kind, p, s);
}

/**
 * cinnamon_background_daemon_build_render_inputs:
 *
 * Resolve a BgRenderInput per monitor, keyed by connector. CinnamonBgList does
 * the matching. Called at the start of every draw pass, by whoever runs it.
 */
void
cinnamon_background_daemon_build_render_inputs (CinnamonBackgroundDaemon *daemon)
{
    g_hash_table_remove_all (daemon->resolved);
    g_hash_table_remove_all (daemon->content);

    GPtrArray *monitors = cinnamon_bg_list_get_monitor_infos (daemon->bglist);
    guint n = monitors->len;

    if (n == 0) {
        set_empty_layout (daemon);
        return;
    }

    GVariantBuilder layout;
    g_variant_builder_init (&layout, G_VARIANT_TYPE ("a(sssb)"));

    CinnamonBgMode mode = cinnamon_bg_list_get_mode (daemon->bglist);

    daemon->spanned = (mode == CINNAMON_BG_MODE_SPANNED);
    g_debug ("Resolving backgrounds: mode=%d, %u monitor(s)", mode, n);

    for (guint i = 0; i < n; i++) {
        const CinnamonBgMonitorInfo *info = g_ptr_array_index (monitors, i);
        const char *connector = info->connector;

        if (!connector || connector[0] == '\0')
            continue;

        g_autoptr(CinnamonBgItem) item = cinnamon_bg_list_get_item_for_monitor (daemon->bglist, i);

        if (item == NULL)
            continue;

        BgRenderInput *in = g_new0 (BgRenderInput, 1);
        item_to_render_input (item, in);

        g_hash_table_insert (daemon->resolved, g_strdup (connector), in);
        g_hash_table_insert (daemon->content, g_strdup (connector),
                             GUINT_TO_POINTER (content_hash (in)));

        gboolean slideshow = FALSE;

        g_object_get (item, "slideshow", &slideshow, NULL);
        g_variant_builder_add (&layout, "(sssb)", connector, info->display_name,
                               in->uri ? in->uri : "",
                               slideshow);

        g_autofree char *desc = describe_resolved (in);
        g_debug ("  %s: %s", connector, desc);
    }

    g_clear_pointer (&daemon->layout, g_variant_unref);
    daemon->layout = g_variant_ref_sink (g_variant_new ("(s@a(sssb))",
                                                        mode_name (mode),
                                                        g_variant_builder_end (&layout)));
}

/**
 * cinnamon_background_daemon_release_render_inputs:
 *
 * Called at the end of every draw pass, by whoever ran it. Both holders have to
 * go: the cache owns the reference from gdk_pixbuf_new_from_file() and @resolved
 * its own, so releasing one alone frees nothing.
 *
 * Pairs with cinnamon_background_daemon_build_render_inputs(), which every
 * draw pass runs first, so this costs a re-decode on a monitor move and
 * nothing else.
 */
void
cinnamon_background_daemon_release_render_inputs (CinnamonBackgroundDaemon *daemon)
{
    g_hash_table_remove_all (daemon->resolved);
    g_hash_table_remove_all (daemon->content);
    clear_pixbuf_cache (daemon);

    g_clear_handle_id (&daemon->malloc_trim_id, g_source_remove);
    daemon->malloc_trim_id = g_timeout_add_seconds (MALLOC_TRIM_IDLE_SECONDS,
                                                    malloc_trim_cb, daemon);
}

static void
set_empty_layout (CinnamonBackgroundDaemon *daemon)
{
    g_clear_pointer (&daemon->layout, g_variant_unref);
    daemon->layout = g_variant_ref_sink (
        g_variant_new ("(s@a(sssb))",
                       mode_name (cinnamon_bg_list_get_mode (daemon->bglist)),
                       g_variant_new_array (G_VARIANT_TYPE ("(sssb)"), NULL, 0)));
}

static void
publish_layout (CinnamonBackgroundDaemon *daemon)
{
    if (!daemon->skeleton || !daemon->layout)
        return;

    cinnamon_background_set_rendered_layout (daemon->skeleton, daemon->layout);
}

static void
draw_background (CinnamonBackgroundDaemon *daemon)
{
    BgRenderInput in = { 0 };

    if (g_list_model_get_n_items (G_LIST_MODEL (daemon->bglist)) == 0) {
        g_debug ("Model not populated yet, deferring first draw");

        set_empty_layout (daemon);
        publish_layout (daemon);
        return;
    }

    cinnamon_background_daemon_build_render_inputs (daemon);
    get_single_input (daemon, &in);

    gboolean animate = !daemon->first_draw && (daemon->transition != BG_TRANSITION_NONE);
    daemon->first_draw = FALSE;

    g_debug ("Drawing backgrounds: placement=%s transition=%s animate=%s",
             in.placement, transition_name (daemon->transition),
             animate ? "yes" : "no");

    render_input_clear (&in);

    if (daemon->wayland) {
#ifdef BG_WITH_WAYLAND
        bg_wayland_backend_draw (daemon->wayland, animate);
#endif
    } else {
        bg_x11_set_background (gdk_display_get_default (), daemon);
        cinnamon_background_daemon_notify_ready (daemon);
    }

    publish_layout (daemon);

    cinnamon_background_daemon_release_render_inputs (daemon);
}

/* A monitor change is a burst, not one event: a modeset arrives as a remove, an
   add and a geometry update across several dispatches, and on Wayland the new
   monitor's geometry lands on a later one still. An idle would fire between
   them. */
#define REDRAW_COALESCE_MS 100

static gboolean
redraw_cb (gpointer data)
{
    CinnamonBackgroundDaemon *daemon = data;

    daemon->redraw_id = 0;
    draw_background (daemon);

    return G_SOURCE_REMOVE;
}

/* Never paint straight out of a signal handler. GDK appends a monitor to its
   list before it sets that monitor's geometry, so a draw running inside
   items-changed reads a half-built layout - which produced a zero-sized root
   pixmap and a BadPixmap on the root window. Deferring also collapses the
   config-changed and items-changed that a hotplug delivers together into one
   draw, and rendering is the expensive half of this daemon. */
static void
queue_draw_background (CinnamonBackgroundDaemon *daemon)
{
    if (daemon->redraw_id == 0)
        daemon->redraw_id = g_timeout_add (REDRAW_COALESCE_MS, redraw_cb, daemon);
}

/* monitor hotplug */

static void
on_monitors_changed (GListModel               *model,
                     guint                     position,
                     guint                     removed,
                     guint                     added,
                     CinnamonBackgroundDaemon *daemon)
{
    g_debug ("Monitors changed, rebuilding backgrounds");

#ifdef BG_WITH_WAYLAND
    if (daemon->wayland)
        bg_wayland_backend_setup_monitors (daemon->wayland);
#endif

    queue_draw_background (daemon);
}

static void
connect_monitors_signal (CinnamonBackgroundDaemon *daemon)
{
    GdkDisplay *display = gdk_display_get_default ();
    if (!display)
        return;

    daemon->monitors_model = gdk_display_get_monitors (display);
    daemon->monitors_changed_id = g_signal_connect (daemon->monitors_model,
                                                    "items-changed",
                                                    G_CALLBACK (on_monitors_changed),
                                                    daemon);
}

// Accountsservice only accepts a single local path - use the primary monitor
// as the source when there are multiple monitors in 'independent' mode.
static void
publish_login_screen_background (CinnamonBackgroundDaemon *daemon)
{
    GPtrArray *monitors = cinnamon_bg_list_get_monitor_infos (daemon->bglist);
    guint n = monitors->len;

    if (n == 0)
        return;

    guint primary = 0;

    for (guint i = 0; i < n; i++) {
        const CinnamonBgMonitorInfo *info = g_ptr_array_index (monitors, i);

        if (info->primary) {
            primary = i;
            break;
        }
    }

    g_autoptr(CinnamonBgItem) item =
        cinnamon_bg_list_get_item_for_monitor (daemon->bglist, primary);

    if (item == NULL)
        return;

    g_autofree char *uri = NULL;

    g_object_get (item, "picture-uri", &uri, NULL);
    bg_accounts_set_background (uri);
}

static void
on_bglist_changed (CinnamonBgList           *list,
                   CinnamonBackgroundDaemon *daemon)
{
    publish_login_screen_background (daemon);
    queue_draw_background (daemon);
}

static void
on_picture_uri_changed (CinnamonBgList *list, CinnamonBackgroundDaemon *daemon)
{
    g_debug ("Picture uri changed");
    on_bglist_changed (list, daemon);
}

static void
on_config_changed (CinnamonBgList *list, CinnamonBackgroundDaemon *daemon)
{
    g_debug ("Config changed");
    on_bglist_changed (list, daemon);
}

static void
on_layout_changed (CinnamonBgList *list G_GNUC_UNUSED, CinnamonBackgroundDaemon *daemon)
{
    g_debug ("Monitor layout changed (DisplayConfig)");

    /* The primary monitor can move with no geometry change and no change to any
       item, which fires nothing else, so the greeter's wallpaper is republished
       either way. The redraw is X11-only: measured on Wayland, the per-window
       notify::scale and notify::geometry watches have already recreated the
       windows and repainted by the time this arrives, and every monitor then
       compares unchanged. On X11 there is no such watch, and muffin is the only
       thing that reports a scale change at all. */
    publish_login_screen_background (daemon);

    if (daemon->wayland == NULL)
        queue_draw_background (daemon);
}

static void
setup_and_draw (CinnamonBackgroundDaemon *daemon)
{
    g_debug ("Performing initial draw");

    daemon->first_draw = TRUE;

#ifdef BG_WITH_WAYLAND
    if (daemon->wayland)
        bg_wayland_backend_setup_monitors (daemon->wayland);
#endif

    draw_background (daemon);
}

static void
teardown (CinnamonBackgroundDaemon *daemon)
{
    if (daemon->monitors_model)
        g_clear_signal_handler (&daemon->monitors_changed_id, daemon->monitors_model);
    daemon->monitors_model = NULL;

    g_clear_object (&daemon->bglist);
    g_clear_object (&daemon->muffin_settings);

    g_clear_handle_id (&daemon->redraw_id, g_source_remove);
    g_clear_handle_id (&daemon->malloc_trim_id, g_source_remove);
    clear_pixbuf_cache (daemon);
#ifdef BG_WITH_WAYLAND
    g_clear_pointer (&daemon->wayland, bg_wayland_backend_free);
#endif
}

/* GApplication */

static gboolean
on_handle_start (CinnamonBackground    *skeleton,
                 GDBusMethodInvocation *invocation,
                 gpointer               user_data)
{
    g_debug ("Start() called");
    cinnamon_background_complete_start (skeleton, invocation);

    return TRUE;
}

static gboolean
cinnamon_background_daemon_dbus_register (GApplication    *app,
                                          GDBusConnection *connection,
                                          const char      *object_path,
                                          GError         **error)
{
    CinnamonBackgroundDaemon *daemon = CINNAMON_BACKGROUND_DAEMON (app);

    if (!G_APPLICATION_CLASS (cinnamon_background_daemon_parent_class)->dbus_register (app,
                                                                                       connection,
                                                                                       object_path,
                                                                                       error))
        return FALSE;

    daemon->skeleton = cinnamon_background_skeleton_new ();
    cinnamon_background_set_state (daemon->skeleton, BG_STATE_INITIALIZING);
    g_signal_connect (daemon->skeleton, "handle-start", G_CALLBACK (on_handle_start), NULL);

    g_autoptr(GError) export_error = NULL;

    if (!g_dbus_interface_skeleton_export (G_DBUS_INTERFACE_SKELETON (daemon->skeleton),
                                           connection, object_path, &export_error)) {
        g_warning ("Could not export the Background interface (%s); "
                   "continuing without the readiness handshake",
                   export_error->message);
        g_clear_object (&daemon->skeleton);
    }

    return TRUE;
}

static void
cinnamon_background_daemon_dbus_unregister (GApplication    *app,
                                            GDBusConnection *connection,
                                            const char      *object_path)
{
    CinnamonBackgroundDaemon *daemon = CINNAMON_BACKGROUND_DAEMON (app);

    if (daemon->skeleton) {
        g_dbus_interface_skeleton_unexport (G_DBUS_INTERFACE_SKELETON (daemon->skeleton));
        g_clear_object (&daemon->skeleton);
    }

    G_APPLICATION_CLASS (cinnamon_background_daemon_parent_class)->dbus_unregister (app,
                                                                                    connection,
                                                                                    object_path);
}

static void
cinnamon_background_daemon_startup (GApplication *app)
{
    CinnamonBackgroundDaemon *daemon = CINNAMON_BACKGROUND_DAEMON (app);

    G_APPLICATION_CLASS (cinnamon_background_daemon_parent_class)->startup (app);

    g_debug ("Starting background daemon");

#ifdef BG_WITH_WAYLAND
    if (GDK_IS_WAYLAND_DISPLAY (gdk_display_get_default ()))
        daemon->wayland = bg_wayland_backend_new (daemon);
#endif

    g_debug ("Using %s backend",
             daemon->wayland ? "Wayland (layer-shell)" : "X11 (root pixmap)");

    setup_transition_pref (daemon);
    g_debug ("Transition mode: %s", transition_name (daemon->transition));

    connect_monitors_signal (daemon);

    daemon->bglist = cinnamon_bg_list_new ();

    g_signal_connect (daemon->bglist, "picture-uri-changed",
                      G_CALLBACK (on_picture_uri_changed), daemon);
    g_signal_connect (daemon->bglist, "config-changed",
                      G_CALLBACK (on_config_changed), daemon);

    /* GDK's items-changed cannot be relied on for a layout change: it fires when
       the output set churns, but a scale change that updates the monitor in place
       is silent. Measured on one 100%<->125% pair, GDK announced one direction and
       not the other. muffin reports both, so without this an X11 scale change can
       leave the root pixmap at its old size for X to tile across the larger screen. */
    g_signal_connect (daemon->bglist, "monitors-changed",
                      G_CALLBACK (on_layout_changed), daemon);

    setup_and_draw (daemon);
}

static void
cinnamon_background_daemon_shutdown (GApplication *app)
{
    g_message ("Shutting down");
    teardown (CINNAMON_BACKGROUND_DAEMON (app));

    G_APPLICATION_CLASS (cinnamon_background_daemon_parent_class)->shutdown (app);
}

static void
cinnamon_background_daemon_finalize (GObject *object)
{
    CinnamonBackgroundDaemon *daemon = CINNAMON_BACKGROUND_DAEMON (object);

    teardown (daemon);

    g_clear_pointer (&daemon->layout, g_variant_unref);
    g_clear_pointer (&daemon->pixbuf_cache, g_hash_table_destroy);
    g_clear_pointer (&daemon->resolved, g_hash_table_destroy);
    g_clear_pointer (&daemon->content, g_hash_table_destroy);

    G_OBJECT_CLASS (cinnamon_background_daemon_parent_class)->finalize (object);
}

static void
cinnamon_background_daemon_class_init (CinnamonBackgroundDaemonClass *klass)
{
    GObjectClass *object_class = G_OBJECT_CLASS (klass);
    GApplicationClass *app_class = G_APPLICATION_CLASS (klass);

    object_class->finalize = cinnamon_background_daemon_finalize;

    app_class->dbus_register = cinnamon_background_daemon_dbus_register;
    app_class->dbus_unregister = cinnamon_background_daemon_dbus_unregister;
    app_class->startup = cinnamon_background_daemon_startup;
    app_class->shutdown = cinnamon_background_daemon_shutdown;
}

static void
cinnamon_background_daemon_init (CinnamonBackgroundDaemon *daemon)
{
    daemon->pixbuf_cache = g_hash_table_new_full (g_str_hash, g_str_equal,
                                                  g_free, cached_image_free);
    daemon->resolved = g_hash_table_new_full (g_str_hash, g_str_equal, g_free,
                                              render_input_free);
    daemon->content = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, NULL);
}

cairo_surface_t *
cinnamon_background_daemon_render_region (CinnamonBackgroundDaemon  *daemon,
                          const char *connector,
                          int width, int height,
                          const GdkRectangle *span,
                          double scale)
{
    BgRenderInput *in = connector ? g_hash_table_lookup (daemon->resolved, connector) : NULL;
    BgRenderInput fallback = { 0 };
    if (!in) {
        /* No connector at all is the legitimate single-item path. A connector we
           have no entry for is not: @resolved is keyed by the connectors muffin
           reported, and the backends look it up with the one GDK reported, so a
           miss means those two views of the layout have diverged. The fallback
           paints the first item here, which is the wrong wallpaper for this
           monitor rather than no wallpaper. */
        if (connector != NULL)
            g_warning ("cinnamon-background-daemon: no resolved background for monitor %s, "
                       "painting the first item instead", connector);

        get_single_input (daemon, &fallback);
        in = &fallback;
    }

    ensure_render_source (daemon, in);

    int dev_w = (int) round (width * scale);
    int dev_h = (int) round (height * scale);

    cairo_surface_t *s =
        cairo_image_surface_create (CAIRO_FORMAT_ARGB32, dev_w, dev_h);
    if (cairo_surface_status (s) != CAIRO_STATUS_SUCCESS) {
        g_warning ("cinnamon-background-daemon: failed to create %dx%d surface for %s: %s",
                   dev_w, dev_h, connector ? connector : "(single)",
                   cairo_status_to_string (cairo_surface_status (s)));
        render_input_clear (&fallback);
        return s;
    }

    cairo_t *cr = cairo_create (s);
    bg_renderer_paint (cr, in, span, scale);

    /* The surface stays SUCCESS when the context errors, so a failed paint would
       otherwise publish a transparent region as a valid one. */
    if (cairo_status (cr) != CAIRO_STATUS_SUCCESS)
        g_warning ("cinnamon-background-daemon: failed to paint %s: %s",
                   connector ? connector : "(single)",
                   cairo_status_to_string (cairo_status (cr)));

    cairo_destroy (cr);
    render_input_clear (&fallback);
    return s;
}

guint
cinnamon_background_daemon_content_hash (CinnamonBackgroundDaemon *daemon, const char *connector)
{
    gpointer value;

    if (connector && g_hash_table_lookup_extended (daemon->content, connector, NULL, &value))
        return GPOINTER_TO_UINT (value);

    /* Same fallback as cinnamon_background_daemon_render_region(): the single item. */
    BgRenderInput fallback = { 0 };
    get_single_input (daemon, &fallback);
    guint hash = content_hash (&fallback);
    render_input_clear (&fallback);

    return hash;
}

gboolean
cinnamon_background_daemon_is_spanned (CinnamonBackgroundDaemon *daemon)
{
    return daemon->spanned;
}

static gboolean verbose = FALSE;

static const GOptionEntry entries[] = {
    { "verbose", 'v', 0, G_OPTION_ARG_NONE, &verbose, "Enable verbose logging", NULL },
    { NULL }
};

static gboolean
on_sigterm (gpointer data)
{
    g_debug ("Got SIGTERM, quitting");
    g_application_quit (G_APPLICATION (data));
    return G_SOURCE_REMOVE;
}

int
main (int argc, char **argv)
{
    g_set_prgname ("cinnamon-background-daemon");

    g_autoptr(GOptionContext) context = g_option_context_new (NULL);
    g_option_context_add_main_entries (context, entries, NULL);

    GError *error = NULL;
    if (!g_option_context_parse (context, &argc, &argv, &error)) {
        g_printerr ("cinnamon-background-daemon: %s\n", error->message);
        g_error_free (error);
        return 1;
    }

    if (verbose && !g_getenv ("G_MESSAGES_DEBUG"))
        g_setenv ("G_MESSAGES_DEBUG", G_LOG_DOMAIN, TRUE);

    g_message ("Starting up");

    /* Smaller resident footprint than Vulkan. */
    g_setenv ("GSK_RENDERER", "gl", FALSE);

    /* On Wayland GTK4 probes org.freedesktop.portal.Settings during init, which
     * can be delayed up to 25s if the portals fail to initialize (which can definitely
     * happen). Nothing we're doing here relies on anything the portal can give us.
     * Our own xdg-desktop-portal-xapp handles the Background portal but sets us via
     * gsettings (org.cinnamon.desktop.background picture-uri). */
    gtk_disable_portals ();

    if (!gtk_init_check ()) {
        g_critical ("cinnamon-background-daemon: could not initialize GTK");
        return 1;
    }

    g_autoptr(CinnamonBackgroundDaemon) daemon =
        g_object_new (CINNAMON_TYPE_BACKGROUND_DAEMON,
                      "application-id", BG_APPLICATION_ID,
                      "flags", G_APPLICATION_IS_SERVICE,
                      NULL);

    error = NULL;
    if (!g_application_register (G_APPLICATION (daemon), NULL, &error)) {
        if (g_error_matches (error, G_DBUS_ERROR, G_DBUS_ERROR_FAILED)) {
            g_message ("Another instance already owns %s, exiting", BG_APPLICATION_ID);
            g_clear_error (&error);
            return 0;
        }

        g_warning ("Could not register on the session bus: %s", error->message);
        g_clear_error (&error);
        return 1;
    }

    g_application_hold (G_APPLICATION (daemon));
    g_unix_signal_add (SIGTERM, on_sigterm, daemon);

    g_debug ("Entering main loop");
    return g_application_run (G_APPLICATION (daemon), 0, NULL);
}
