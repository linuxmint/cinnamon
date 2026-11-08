#include <math.h>

#include "cinnamon-bg-private.h"

/**
 * SECTION:cinnamon-bg-monitor-info
 * @title: CinnamonBgMonitorInfo
 * @short_description: One connected monitor
 * @see_also: #CinnamonBgList, #CinnamonBgItem
 *
 * One currently connected monitor, as reported by the window manager. Obtained
 * from cinnamon_bg_list_get_monitor_infos().
 *
 * The model is matched to stored entries on @connector and @index; @x is the
 * position in the layout, already sorted left-to-right. @display_name is for
 * labelling in a UI.
 */

/* CinnamonBgMonitorInfo */

G_DEFINE_BOXED_TYPE (CinnamonBgMonitorInfo, cinnamon_bg_monitor_info,
                     cinnamon_bg_monitor_info_copy, cinnamon_bg_monitor_info_free)

/**
 * cinnamon_bg_monitor_info_copy: (skip)
 * @self: a #CinnamonBgMonitorInfo
 *
 * Returns: (transfer full): a copy of @self
 */
CinnamonBgMonitorInfo *
cinnamon_bg_monitor_info_copy (CinnamonBgMonitorInfo *self)
{
    CinnamonBgMonitorInfo *copy = g_new0 (CinnamonBgMonitorInfo, 1);

    copy->connector = g_strdup (self->connector);
    copy->display_name = g_strdup (self->display_name);
    copy->x = self->x;
    copy->y = self->y;
    copy->width = self->width;
    copy->height = self->height;
    copy->index = self->index;
    copy->primary = self->primary;

    return copy;
}

/**
 * cinnamon_bg_monitor_info_free: (skip)
 * @self: a #CinnamonBgMonitorInfo
 */
void
cinnamon_bg_monitor_info_free (CinnamonBgMonitorInfo *self)
{
    g_free (self->connector);
    g_free (self->display_name);
    g_free (self);
}

static CinnamonBgMonitorInfo *
info_new (const char *connector,
          const char *model,
          const char *display_name,
          int         x,
          int         y,
          int         width,
          int         height,
          int         index,
          gboolean    primary)
{
    CinnamonBgMonitorInfo *self = g_new0 (CinnamonBgMonitorInfo, 1);

    self->connector = g_strdup (connector ? connector : "");

    if (display_name && display_name[0] != '\0')
        self->display_name = g_strdup (display_name);
    else if (model && model[0] != '\0')
        self->display_name = g_strdup (model);
    else
        self->display_name = g_strdup (self->connector);

    self->x = x;
    self->y = y;
    self->width = width;
    self->height = height;
    self->index = index;
    self->primary = primary;

    return self;
}

/* CinnamonBgMonitors */

/*
 * SECTION:cinnamon-bg-monitors
 * @title: CinnamonBgMonitors
 * @short_description: The current monitor layout
 * @see_also: CinnamonBgMonitorInfo, CinnamonBgList
 *
 * The currently connected monitors as an array of CinnamonBgMonitorInfo,
 * read from muffin's `DisplayConfig` D-Bus interface rather than from GDK,
 * so the library stays toolkit-free (we configure/manage in gtk3 but the
 * daemon uses gtk4).
 *
 * A CinnamonBgList builds one on construction, so construct this directly only
 * if you have no list of your own.
 *
 * Everything is asynchronous: a new object is empty, so read it from
 * CinnamonBgMonitors::changed rather than immediately.
 */

struct _CinnamonBgMonitors {
    GObject parent_instance;
    GPtrArray *monitors;
    GDBusProxy *proxy;
    GCancellable *cancellable;
};

/* A connector's slot in the layout, gathered from the logical monitors. @scale
   and @transform are carried because the size that goes with this slot lives
   on the monitor's current mode, which the second pass reads. */
typedef struct {
    int x;
    int y;
    double scale;
    guint transform;
    int index;
    gboolean primary;
} MonitorPos;

G_DEFINE_FINAL_TYPE (CinnamonBgMonitors, cinnamon_bg_monitors, G_TYPE_OBJECT)

enum {
    CHANGED,
    N_SIGS
};
static guint sigs[N_SIGS];

// Left-to-right, top-to-bottom.
static int
compare_by_position (gconstpointer a, gconstpointer b)
{
    CinnamonBgMonitorInfo *ia = *(CinnamonBgMonitorInfo **) a;
    CinnamonBgMonitorInfo *ib = *(CinnamonBgMonitorInfo **) b;

    if (ia->x != ib->x)
        return ia->x - ib->x;

    return ia->y - ib->y;
}

static gboolean
infos_equal (GPtrArray *a, GPtrArray *b)
{
    if (a->len != b->len)
        return FALSE;

    for (guint i = 0; i < a->len; i++) {
        const CinnamonBgMonitorInfo *x = g_ptr_array_index (a, i);
        const CinnamonBgMonitorInfo *y = g_ptr_array_index (b, i);

        if (x->x != y->x || x->y != y->y ||
            x->width != y->width || x->height != y->height ||
            x->index != y->index ||
            x->primary != y->primary ||
            g_strcmp0 (x->connector, y->connector) != 0 ||
            g_strcmp0 (x->display_name, y->display_name) != 0)
            return FALSE;
    }

    return TRUE;
}

/* The layout size of the monitor running @modes' current mode. Only the current
   mode carries the size the monitor is actually showing; the rest of the array
   is what it could show. Left at zero when none is marked current, which is a
   monitor the window manager has not enabled. */
static void
current_mode_layout_size (GVariant *modes,
                          double    scale,
                          guint     transform,
                          int      *width,
                          int      *height)
{
    GVariantIter it;
    const char *id;
    int w, h;
    double refresh, preferred_scale;
    GVariant *supported_scales, *props;

    *width = 0;
    *height = 0;

    if (scale <= 0.0)
        return;

    g_variant_iter_init (&it, modes);
    while (g_variant_iter_next (&it, "(&siidd@ad@a{sv})", &id, &w, &h,
                                &refresh, &preferred_scale,
                                &supported_scales, &props)) {
        gboolean current = FALSE;

        g_variant_lookup (props, "is-current", "b", &current);
        g_variant_unref (supported_scales);
        g_variant_unref (props);

        if (!current)
            continue;

        if (transform % 2 != 0) {
            int turned = w;

            w = h;
            h = turned;
        }

        *width = (int) round (w / scale);
        *height = (int) round (h / scale);
        return;
    }
}

static void
on_get_current_state (GObject *source, GAsyncResult *res, gpointer user_data)
{
    g_autoptr(CinnamonBgMonitors) self = user_data;   /* ref taken at call site */
    g_autoptr(GError) e = NULL;
    g_autoptr(GVariant) ret = g_dbus_proxy_call_finish (G_DBUS_PROXY (source), res, &e);

    if (!ret) {
        if (!g_error_matches (e, G_IO_ERROR, G_IO_ERROR_CANCELLED))
            g_warning ("DisplayConfig GetCurrentState failed: %s", e->message);
        return;
    }

    g_autoptr(GVariant) monitors = g_variant_get_child_value (ret, 1);
    g_autoptr(GVariant) logical = g_variant_get_child_value (ret, 2);

    /* Pass 1: connector -> position/index, from the logical monitors. The
       logical-monitors array is in muffin's canonical order (primary-first,
       then by connector), so its iteration position is the logical index. That
       ordering is derived from the connector names, so the index survives a
       rename only when the rename leaves the sort order alone. The scale and
       transform travel to pass 2, which turns the current mode into a size. */
    g_autoptr(GHashTable) pos = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_free);
    GVariantIter li;
    gint lx, ly;
    gdouble lscale;
    guint transform;
    gboolean primary;
    GVariant *specs;
    int lindex = 0;

    g_variant_iter_init (&li, logical);
    while (g_variant_iter_next (&li, "(iidub@a(ssss)@a{sv})",
                               &lx, &ly, &lscale, &transform, &primary, &specs, NULL)) {
        GVariantIter si;
        const char *conn, *vendor, *product, *serial;

        g_variant_iter_init (&si, specs);
        while (g_variant_iter_next (&si, "(&s&s&s&s)", &conn, &vendor, &product, &serial)) {
            MonitorPos *mp = g_new (MonitorPos, 1);

            mp->x = lx;
            mp->y = ly;
            mp->scale = lscale;
            mp->transform = transform;
            mp->index = lindex;
            mp->primary = primary;
            g_hash_table_insert (pos, g_strdup (conn), mp);
        }
        g_variant_unref (specs);
        lindex++;
    }

    /* Pass 2: monitors -> identity. Collected and applied in one splice so
       ::changed carries one complete layout, never a half-built one. */
    g_autoptr(GPtrArray) infos =
        g_ptr_array_new_with_free_func ((GDestroyNotify) cinnamon_bg_monitor_info_free);
    GVariantIter mi;
    GVariant *spec, *modes, *mprops;

    g_variant_iter_init (&mi, monitors);
    while (g_variant_iter_next (&mi, "(@(ssss)@a(siiddada{sv})@a{sv})", &spec, &modes, &mprops)) {
        const char *conn, *vendor, *product, *serial;
        const char *display_name = NULL;
        MonitorPos *mp;

        g_variant_get (spec, "(&s&s&s&s)", &conn, &vendor, &product, &serial);
        g_variant_lookup (mprops, "display-name", "&s", &display_name);

        /* GetCurrentState lists every connected output, but only the enabled
           ones are assigned to a logical monitor — so a connector missing
           from pass 1 is switched off and has no place in the layout. */
        mp = g_hash_table_lookup (pos, conn);
        if (mp) {
            int width, height;

            current_mode_layout_size (modes, mp->scale, mp->transform,
                                      &width, &height);
            g_ptr_array_add (infos, info_new (conn, product, display_name,
                                              mp->x, mp->y, width, height,
                                              mp->index, mp->primary));
        }

        g_variant_unref (spec);
        g_variant_unref (modes);
        g_variant_unref (mprops);
    }

    g_ptr_array_sort (infos, compare_by_position);

    /* A reload that finds nothing moved costs a full repaint downstream, and on
       X11 that is the whole root pixmap re-rendered from freshly decoded
       images. Cheap to rule out, and keeping the old array keeps the infos a
       consumer is holding valid. */
    if (self->monitors != NULL && infos_equal (self->monitors, infos)) {
        g_debug ("Layout unchanged, nothing to re-emit");
        return;
    }

    g_clear_pointer (&self->monitors, g_ptr_array_unref);
    self->monitors = g_ptr_array_ref (infos);

    g_signal_emit (self, sigs[CHANGED], 0);
}

static void
reload (CinnamonBgMonitors *self)
{
    if (!self->proxy)
        return;

    g_autofree char *owner = g_dbus_proxy_get_name_owner (self->proxy);
    if (owner == NULL)
        return;

    g_cancellable_cancel (self->cancellable);
    g_clear_object (&self->cancellable);
    self->cancellable = g_cancellable_new ();

    g_dbus_proxy_call (self->proxy, "GetCurrentState", NULL,
                       G_DBUS_CALL_FLAGS_NO_AUTO_START, -1, self->cancellable,
                       on_get_current_state, g_object_ref (self));
}

static void
on_g_signal (GDBusProxy *proxy, const char *sender, const char *signal,
             GVariant *params, CinnamonBgMonitors *self)
{
    if (g_strcmp0 (signal, "MonitorsChanged") == 0)
        reload (self);
}

static void
on_name_owner_changed (GObject *proxy, GParamSpec *pspec, gpointer user_data)
{
    CinnamonBgMonitors *self = user_data;
    g_autofree char *owner = g_dbus_proxy_get_name_owner (G_DBUS_PROXY (proxy));

    if (owner != NULL)
        reload (self);
}

static void
on_proxy_ready (GObject *source G_GNUC_UNUSED, GAsyncResult *res, gpointer user_data)
{
    g_autoptr(CinnamonBgMonitors) self = user_data;   /* ref taken at call site */
    g_autoptr(GError) e = NULL;
    GDBusProxy *proxy = g_dbus_proxy_new_for_bus_finish (res, &e);

    if (proxy == NULL) {
        g_debug ("No session bus, so no monitor layout: %s", e->message);
        return;
    }

    self->proxy = proxy;
    g_signal_connect (self->proxy, "g-signal", G_CALLBACK (on_g_signal), self);
    g_signal_connect (self->proxy, "notify::g-name-owner",
                      G_CALLBACK (on_name_owner_changed), self);
    reload (self);
}

static void
cinnamon_bg_monitors_constructed (GObject *o)
{
    CinnamonBgMonitors *self = CINNAMON_BG_MONITORS (o);

    G_OBJECT_CLASS (cinnamon_bg_monitors_parent_class)->constructed (o);

    g_dbus_proxy_new_for_bus (G_BUS_TYPE_SESSION,
                              G_DBUS_PROXY_FLAGS_DO_NOT_LOAD_PROPERTIES |
                              G_DBUS_PROXY_FLAGS_DO_NOT_AUTO_START, NULL,
                              "org.cinnamon.Muffin.DisplayConfig",
                              "/org/cinnamon/Muffin/DisplayConfig",
                              "org.cinnamon.Muffin.DisplayConfig", NULL,
                              on_proxy_ready, g_object_ref (self));
}

static void
cinnamon_bg_monitors_finalize (GObject *o)
{
    CinnamonBgMonitors *self = CINNAMON_BG_MONITORS (o);

    g_cancellable_cancel (self->cancellable);
    g_clear_object (&self->cancellable);
    g_clear_object (&self->proxy);
    g_clear_pointer (&self->monitors, g_ptr_array_unref);

    G_OBJECT_CLASS (cinnamon_bg_monitors_parent_class)->finalize (o);
}

static void
cinnamon_bg_monitors_class_init (CinnamonBgMonitorsClass *klass)
{
    G_OBJECT_CLASS (klass)->constructed = cinnamon_bg_monitors_constructed;
    G_OBJECT_CLASS (klass)->finalize = cinnamon_bg_monitors_finalize;

    /**
     * CinnamonBgMonitors::changed:
     * @self: the CinnamonBgMonitors
     *
     * Emitted when the monitor layout has been reloaded: the initial
     * asynchronous load, a hotplug, or the window manager appearing on the bus.
     */
    sigs[CHANGED] = g_signal_new ("changed", G_TYPE_FROM_CLASS (klass),
                                      G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                      G_TYPE_NONE, 0);
}

static void
cinnamon_bg_monitors_init (CinnamonBgMonitors *self)
{
    self->monitors = g_ptr_array_new_with_free_func ((GDestroyNotify) cinnamon_bg_monitor_info_free);
}

GPtrArray *
cinnamon_bg_monitors_get_infos (CinnamonBgMonitors *self)
{
    g_return_val_if_fail (CINNAMON_IS_BG_MONITORS (self), NULL);

    return self->monitors;
}

static CinnamonBgMonitors *
cinnamon_bg_monitors_new (void)
{
    return g_object_new (CINNAMON_TYPE_BG_MONITORS, NULL);
}

CinnamonBgMonitors *
cinnamon_bg_monitors_get_default (void)
{
    static CinnamonBgMonitors *singleton = NULL;

    if (singleton)
        return g_object_ref (singleton);

    singleton = cinnamon_bg_monitors_new ();
    g_object_add_weak_pointer (G_OBJECT (singleton), (gpointer *) &singleton);

    return singleton;
}
