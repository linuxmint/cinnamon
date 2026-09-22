#include "cinnamon-bg-list.h"
#include "cinnamon-bg-private.h"
#include "cinnamon-bg-enum-types.h"

/**
 * SECTION:cinnamon-bg-list
 * @title: CinnamonBgList
 * @short_description: What every monitor should show
 * @see_also: #CinnamonBgItem, #CinnamonBgMonitorInfo
 *
 * A #GListModel over the `picture-uri-list` and `background-mode` keys of
 * `org.cinnamon.desktop.background`, holding exactly what should be presented:
 * one #CinnamonBgItem per connected monitor in %CINNAMON_BG_MODE_INDEPENDENT,
 * exactly one in mirror and spanned, and nothing until the layout has loaded.
 *
 * There is no stored-versus-resolved split: the items are the configuration.
 * Read them, set properties on them, and call cinnamon_bg_list_save().
 *
 * The model is rederived whenever either key or the layout moves, matching each
 * monitor to a stored entry by connector, then by logical index, then by
 * inheriting its nearest matched neighbour. Items are reused across rebuilds,
 * so a reference a consumer holds stays live and notifies in place.
 *
 * ::config-changed says the configuration moved, ::picture-uri-changed says a
 * rotating wallpaper advanced and nothing else did. A rebuild that changed
 * nothing is silent.
 *
 * The layout is shared process-wide, so a list built once it has already loaded
 * arrives fully populated and emits nothing afterwards.
 */

struct _CinnamonBgList {
    GObject parent_instance;
    GSettings *settings;
    CinnamonBgMode mode;
    GPtrArray *stored;         /* CinnamonBgItem, parsed from picture-uri-list;
                                  the model is derived from these */
    GPtrArray *items;          /* CinnamonBgItem, the presented model */
    CinnamonBgMonitors *monitors;   /* the shared layout, built on construction */
    gulong monitors_changed_id; /* forwards it as ::monitors-changed */
    gulong changed_id;          /* changed::picture-uri-list */
    gulong changed_mode_id;     /* changed::background-mode */
};

static void cinnamon_bg_list_model_init (GListModelInterface *iface);

G_DEFINE_FINAL_TYPE_WITH_CODE (CinnamonBgList, cinnamon_bg_list, G_TYPE_OBJECT,
                               G_IMPLEMENT_INTERFACE (G_TYPE_LIST_MODEL,
                                                      cinnamon_bg_list_model_init))

enum {
    PROP_0,
    PROP_MODE,
    N_PROPS
};
static GParamSpec *props[N_PROPS];

enum {
    MONITORS_CHANGED,
    CONFIG_CHANGED,
    PICTURE_URI_CHANGED,
    N_SIGS
};
static guint sigs[N_SIGS];

static CinnamonBgItem *find_item (GPtrArray *items, const char *connector);
static void derive_independent (CinnamonBgList *self, GPtrArray *monitors,
                                GPtrArray *old, GPtrArray *out,
                                CinnamonBgChange *changed, gboolean *set_moved);
static void rebuild_items (CinnamonBgList *self, gboolean mode_moved);
static void rebuild_against (CinnamonBgList *self, GPtrArray *monitors,
                             gboolean mode_moved);
static CinnamonBgMonitors *get_monitors (CinnamonBgList *self);

/* GListModel */

static GType
cinnamon_bg_list_get_item_type (GListModel *model)
{
    return CINNAMON_TYPE_BG_ITEM;
}

static guint
cinnamon_bg_list_get_n_items (GListModel *model)
{
    return CINNAMON_BG_LIST (model)->items->len;
}

static gpointer
cinnamon_bg_list_get_item (GListModel *model, guint position)
{
    CinnamonBgList *self = CINNAMON_BG_LIST (model);

    if (position >= self->items->len)
        return NULL;

    return g_object_ref (g_ptr_array_index (self->items, position));
}

static void
cinnamon_bg_list_model_init (GListModelInterface *iface)
{
    iface->get_item_type = cinnamon_bg_list_get_item_type;
    iface->get_n_items = cinnamon_bg_list_get_n_items;
    iface->get_item = cinnamon_bg_list_get_item;
}

static void
load_single (CinnamonBgList *self)
{
    if (self->stored->len > 0)
        return;

    /* Migration only: an empty list means a pre-list config, so seed the single
       item from the legacy keys. Retires itself on the first save. */
    GVariantBuilder b;

    g_variant_builder_init (&b, G_VARIANT_TYPE ("a{sv}"));

    g_autofree char *uri = g_settings_get_string (self->settings, "picture-uri");
    g_autofree char *pc = g_settings_get_string (self->settings, "primary-color");
    g_autofree char *sc = g_settings_get_string (self->settings, "secondary-color");
    g_autoptr(GVariant) po = g_settings_get_value (self->settings, "picture-options");
    g_autoptr(GVariant) cs = g_settings_get_value (self->settings, "color-shading-type");

    g_variant_builder_add (&b, "{sv}", "picture-uri", g_variant_new_string (uri));
    g_variant_builder_add (&b, "{sv}", "picture-options", po);
    g_variant_builder_add (&b, "{sv}", "color-shading-type", cs);
    g_variant_builder_add (&b, "{sv}", "primary-color", g_variant_new_string (pc));
    g_variant_builder_add (&b, "{sv}", "secondary-color", g_variant_new_string (sc));

    g_autoptr(GSettings) slideshow =
        g_settings_new ("org.cinnamon.desktop.background.slideshow");
    g_autoptr(GVariant) sl = g_settings_get_value (slideshow, "slideshow-enabled");
    g_autoptr(GVariant) ss = g_settings_get_value (slideshow, "image-source");

    g_variant_builder_add (&b, "{sv}", "slideshow", sl);
    g_variant_builder_add (&b, "{sv}", "slideshow-source", ss);

    /* Spanning was a placement and is a mode now, so an old 'spanned' desktop
       arrives here. Written through to the key rather than cached, because this
       only runs while the list is empty.

       The guard is "the mode key has never been set", not a value comparison:
       nothing clears the legacy picture-options key, so comparing values would
       re-migrate the moment the user picks any other mode. */
    g_autoptr(GVariant) stored_mode = g_settings_get_user_value (self->settings,
                                                                 "background-mode");

    if (!stored_mode && g_strcmp0 (g_variant_get_string (po, NULL), "spanned") == 0) {
        self->mode = CINNAMON_BG_MODE_SPANNED;

        if (self->changed_mode_id)
            g_signal_handler_block (self->settings, self->changed_mode_id);

        if (!g_settings_set_enum (self->settings, "background-mode",
                                  CINNAMON_BG_MODE_SPANNED))
            g_warning ("Could not migrate the legacy spanned background to background-mode");

        if (self->changed_mode_id)
            g_signal_handler_unblock (self->settings, self->changed_mode_id);
    }

    g_autoptr(GVariant) v = g_variant_ref_sink (g_variant_builder_end (&b));

    g_ptr_array_add (self->stored, cinnamon_bg_item_new_from_variant (v));
}

/* Reloads from GSettings, discarding unsaved changes. Called by constructed()
   and whenever a watched key changes. */
void
cinnamon_bg_list_load (CinnamonBgList *self)
{
    CinnamonBgMode was = self->mode;

    self->mode = g_settings_get_enum (self->settings, "background-mode");

    g_ptr_array_set_size (self->stored, 0);

    g_autoptr(GVariant) list = g_settings_get_value (self->settings, "picture-uri-list");
    GVariantIter it;
    GVariant *child;

    g_variant_iter_init (&it, list);
    while ((child = g_variant_iter_next_value (&it))) {
        g_ptr_array_add (self->stored, cinnamon_bg_item_new_from_variant (child));
        g_variant_unref (child);
    }

    /* Seed the representative from the flat keys if the list is empty. */
    load_single (self);

    rebuild_items (self, self->mode != was);

    if (self->mode != was)
        g_object_notify_by_pspec (G_OBJECT (self), props[PROP_MODE]);
}

/**
 * cinnamon_bg_list_set_single_uri:
 * @uri: the picture URI to show on every monitor
 *
 * Replaces the entire configuration with one zoomed picture on every monitor.
 * The "set as wallpaper" path an external app reaches through the legacy
 * `picture-uri` key: it discards any per-monitor layout and resets the mode to
 * %CINNAMON_BG_MODE_MIRROR.
 *
 * Writes the keys and nothing else, so a caller that only ever sets a wallpaper
 * needs no #CinnamonBgList of its own.
 */
void
cinnamon_bg_list_set_single_uri (const char *uri)
{
    g_autoptr(GSettings) settings = g_settings_new ("org.cinnamon.desktop.background");
    g_autoptr(CinnamonBgItem) item = cinnamon_bg_item_new ();

    g_object_set (item,
                  "picture-uri", uri,
                  "picture-options", "zoom",
                  NULL);

    GVariantBuilder b;

    g_variant_builder_init (&b, G_VARIANT_TYPE ("aa{sv}"));
    g_variant_builder_add_value (&b, cinnamon_bg_item_to_variant (item));

    g_settings_delay (settings);
    g_settings_set_value (settings, "picture-uri-list", g_variant_builder_end (&b));
    g_settings_set_enum (settings, "background-mode", CINNAMON_BG_MODE_MIRROR);
    g_settings_apply (settings);
}

static CinnamonBgItem *
entry_for_connector (GPtrArray *entries, const char *connector)
{
    for (guint i = 0; i < entries->len; i++) {
        CinnamonBgItem *it = g_ptr_array_index (entries, i);

        if (g_strcmp0 (it->connector, connector) == 0)
            return it;
    }

    return NULL;
}

/**
 * cinnamon_bg_list_save_pictures:
 * @self: a #CinnamonBgList
 *
 * Writes back only the pictures the model is showing, leaving every other
 * stored entry exactly as it was.
 *
 * For a rotating wallpaper advancing, which moves a picture and nothing else.
 * Unlike cinnamon_bg_list_save(), this never changes which entries exist: one
 * the model cannot represent - a monitor that is not currently connected, or one
 * the mode does not present - is written back untouched, and one the model has
 * but the key does not is not added. Reshaping the key is what a deliberate edit
 * does, and a rotation is not one.
 */
void
cinnamon_bg_list_save_pictures (CinnamonBgList *self)
{
    GVariantBuilder b;

    g_return_if_fail (CINNAMON_IS_BG_LIST (self));

    if (self->items->len == 0) {
        g_debug ("Nothing to save until the monitor layout has loaded");
        return;
    }

    /* Overlay onto the stored entries rather than serialising the model, so which
       entries exist is left alone and only the pictures in them move. A monitor
       that arrived since the last save has no entry to update, so its rotation
       does not persist - it still shows an inherited wallpaper, and the first
       edit in the settings panel writes it properly. */
    GPtrArray *merged = g_ptr_array_new_with_free_func (g_object_unref);

    for (guint i = 0; i < self->stored->len; i++)
        g_ptr_array_add (merged,
                         cinnamon_bg_item_copy (g_ptr_array_index (self->stored, i)));

    for (guint i = 0; i < self->items->len; i++) {
        CinnamonBgItem *item = g_ptr_array_index (self->items, i);
        CinnamonBgItem *target = entry_for_connector (merged, item->connector);

        if (target == NULL)
            continue;

        g_object_set (target,
                      "picture-uri", item->picture_uri,
                      "picture-options", item->picture_options,
                      NULL);
    }

    if (self->changed_id)
        g_signal_handler_block (self->settings, self->changed_id);

    g_variant_builder_init (&b, G_VARIANT_TYPE ("aa{sv}"));
    for (guint i = 0; i < merged->len; i++)
        g_variant_builder_add_value (&b, cinnamon_bg_item_to_variant (g_ptr_array_index (merged, i)));
    g_settings_set_value (self->settings, "picture-uri-list", g_variant_builder_end (&b));

    if (self->changed_id)
        g_signal_handler_unblock (self->settings, self->changed_id);

    g_ptr_array_unref (self->stored);
    self->stored = merged;
}

/**
 * cinnamon_bg_list_save:
 * @self: a #CinnamonBgList
 *
 * Writes the model to `picture-uri-list`.
 *
 * The model holds only what is on screen, so entries for monitors that are not
 * currently connected are not written back. Unplugging a monitor does not lose
 * its entry — the model is rebuilt from the key, which still holds it — but a
 * save taken while it is disconnected prunes it.
 */
void
cinnamon_bg_list_save (CinnamonBgList *self)
{
    GVariantBuilder b;

    g_return_if_fail (CINNAMON_IS_BG_LIST (self));

    if (self->items->len == 0) {
        g_debug ("Nothing to save until the monitor layout has loaded");
        return;
    }

    if (self->changed_id)
        g_signal_handler_block (self->settings, self->changed_id);

    g_variant_builder_init (&b, G_VARIANT_TYPE ("aa{sv}"));
    for (guint i = 0; i < self->items->len; i++) {
        CinnamonBgItem *it = g_ptr_array_index (self->items, i);

        g_variant_builder_add_value (&b, cinnamon_bg_item_to_variant (it));
    }
    g_settings_set_value (self->settings, "picture-uri-list", g_variant_builder_end (&b));

    if (self->changed_id)
        g_signal_handler_unblock (self->settings, self->changed_id);

    g_ptr_array_set_size (self->stored, 0);
    for (guint i = 0; i < self->items->len; i++)
        g_ptr_array_add (self->stored,
                         cinnamon_bg_item_copy (g_ptr_array_index (self->items, i)));
}

/**
 * cinnamon_bg_list_get_mode:
 * @self: a #CinnamonBgList
 *
 * Returns: how the background behaves, mirroring the `background-mode` key
 */
CinnamonBgMode
cinnamon_bg_list_get_mode (CinnamonBgList *self)
{
    g_return_val_if_fail (CINNAMON_IS_BG_LIST (self), CINNAMON_BG_MODE_MIRROR);

    return self->mode;
}

/**
 * cinnamon_bg_list_set_mode:
 * @self: a #CinnamonBgList
 * @mode: the mode to switch to
 *
 * Writes `background-mode`. The list reloads from the key and rebuilds the
 * model, which resizes it, so wait for #CinnamonBgList::config-changed rather
 * than reading back immediately.
 */
void
cinnamon_bg_list_set_mode (CinnamonBgList *self, CinnamonBgMode mode)
{
    g_return_if_fail (CINNAMON_IS_BG_LIST (self));

    if (self->mode == mode)
        return;

    g_settings_set_enum (self->settings, "background-mode", mode);
}

static CinnamonBgItem *
find_item (GPtrArray *items, const char *connector)
{
    guint n = items->len;

    for (guint i = 0; i < n; i++) {
        CinnamonBgItem *it = g_ptr_array_index (items, i);

        if (g_strcmp0 (it->connector, connector) == 0)
            return it;
    }

    return NULL;
}

/* An item already in the model for this connector, so a reference a consumer is
   holding stays live across a rebuild. */
static CinnamonBgItem *
take_existing (GPtrArray *old, const char *connector)
{
    for (guint i = 0; i < old->len; i++) {
        CinnamonBgItem *it = g_ptr_array_index (old, i);

        if (g_strcmp0 (it->connector, connector) == 0)
            return g_object_ref (it);
    }

    return NULL;
}

/* The representative for mirror and spanned, in decreasing order of how well
   each step identifies what the user chose: the connector-less entry, then the
   primary monitor's entry by connector, then by logical index for a connector
   the driver has renamed, then the first stored entry.

   NULL only when nothing is stored at all. That last step lands on the leftmost
   monitor: save() writes the model, which is ordered left-to-right. */
static CinnamonBgItem *
find_representative (CinnamonBgList *self, GPtrArray *monitors)
{
    for (guint i = 0; i < self->stored->len; i++) {
        CinnamonBgItem *it = g_ptr_array_index (self->stored, i);

        if (it->connector == NULL || it->connector[0] == '\0')
            return it;
    }

    const CinnamonBgMonitorInfo *wanted = NULL;

    for (guint i = 0; i < monitors->len; i++) {
        const CinnamonBgMonitorInfo *info = g_ptr_array_index (monitors, i);

        if (wanted == NULL)
            wanted = info;
        if (info->primary) {
            wanted = info;
            break;
        }
    }

    if (wanted != NULL) {
        CinnamonBgItem *it = find_item (self->stored, wanted->connector);

        if (it != NULL)
            return it;

        if (wanted->index >= 0) {
            for (guint i = 0; i < self->stored->len; i++) {
                it = g_ptr_array_index (self->stored, i);

                if (it->index == wanted->index)
                    return it;
            }
        }
    }

    if (self->stored->len > 0)
        return g_ptr_array_index (self->stored, 0);

    return NULL;
}

/* Rebuild the presented model against @monitors: one item per monitor in
   independent mode, exactly one otherwise, and nothing at all until the layout
   has loaded. */
static void
rebuild_against (CinnamonBgList *self, GPtrArray *monitors, gboolean mode_moved)
{
    g_autoptr(GPtrArray) old = g_ptr_array_ref (self->items);
    guint old_n = old->len;
    GPtrArray *out = g_ptr_array_new_with_free_func (g_object_unref);
    CinnamonBgChange changed = CINNAMON_BG_CHANGE_NONE;
    gboolean set_moved = FALSE;

    if (monitors->len == 0) {
        /* Nothing to present until the layout lands. */
    } else if (self->mode == CINNAMON_BG_MODE_INDEPENDENT) {
        derive_independent (self, monitors, old, out, &changed, &set_moved);
    } else {
        CinnamonBgItem *item = take_existing (old, "");

        if (item == NULL) {
            item = cinnamon_bg_item_new ();
            set_moved = TRUE;
        }

        CinnamonBgItem *rep = find_representative (self, monitors);

        if (rep != NULL)
            changed |= cinnamon_bg_item_seed_from (item, rep);
        g_ptr_array_add (out, item);
    }

    if (old_n != out->len)
        set_moved = TRUE;

    g_ptr_array_unref (self->items);
    self->items = out;

    // The GListModel contract, not a notification for this library's own consumers.
    if (set_moved)
        g_list_model_items_changed (G_LIST_MODEL (self), 0, old_n, self->items->len);

    /* A rotating wallpaper moves the picture and nothing else, so that is the
       one change a consumer can subscribe away from. Everything else - a
       placement, a color, a slideshow being switched on, the monitors moving -
       is config. */
    if (set_moved || mode_moved || (changed & CINNAMON_BG_CHANGE_CONFIG))
        g_signal_emit (self, sigs[CONFIG_CHANGED], 0);
    else if (changed & CINNAMON_BG_CHANGE_PICTURE)
        g_signal_emit (self, sigs[PICTURE_URI_CHANGED], 0);
}

/* One presented item per connected monitor: matched by connector, else by
   logical index, else inherited from the nearest matched neighbor. Identity
   is stamped from the layout, never from the entry. */
static void
derive_independent (CinnamonBgList   *self,
                    GPtrArray        *monitors,
                    GPtrArray        *old,
                    GPtrArray        *out,
                    CinnamonBgChange *changed,
                    gboolean         *set_moved)
{
    guint n = monitors->len;
    guint stored = self->stored->len;
    CinnamonBgItem **matched = g_new0 (CinnamonBgItem *, n);
    gboolean *claimed = g_new0 (gboolean, stored ? stored : 1);
    gboolean any = FALSE;

    /* Pass 1 runs to completion before pass 2 starts. Interleaving them lets a
       renamed connector's index match take an entry that a monitor still
       present owns by name, leaving two monitors sharing one entry. */
    for (guint i = 0; i < n; i++) {
        const CinnamonBgMonitorInfo *info = g_ptr_array_index (monitors, i);

        if (info->connector == NULL || info->connector[0] == '\0')
            continue;

        for (guint j = 0; j < stored; j++) {
            CinnamonBgItem *it = g_ptr_array_index (self->stored, j);

            if (g_strcmp0 (it->connector, info->connector) == 0) {
                matched[i] = it;
                claimed[j] = TRUE;
                any = TRUE;
                break;
            }
        }
    }

    for (guint i = 0; i < n; i++) {
        const CinnamonBgMonitorInfo *info = g_ptr_array_index (monitors, i);

        if (matched[i] || info->index < 0)
            continue;

        for (guint j = 0; j < stored; j++) {
            CinnamonBgItem *it = g_ptr_array_index (self->stored, j);

            if (claimed[j] || it->index != info->index)
                continue;

            matched[i] = it;
            claimed[j] = TRUE;
            any = TRUE;
            break;
        }
    }

    CinnamonBgItem **resolved = g_new0 (CinnamonBgItem *, n);

    if (any) {
        CinnamonBgItem *last = NULL;

        for (guint i = 0; i < n; i++) {
            if (matched[i])
                last = matched[i];
            resolved[i] = matched[i] ? matched[i] : last;
        }

        CinnamonBgItem *next = NULL;

        for (guint i = n; i-- > 0; ) {
            if (matched[i])
                next = matched[i];
            if (!resolved[i])
                resolved[i] = next;
        }
    } else {
        CinnamonBgItem *rep = find_representative (self, monitors);

        for (guint i = 0; i < n; i++)
            resolved[i] = rep;
    }

    /* Seeding notifies on live items, and a handler is free to save or reload,
       which clears `stored`, what every entry here points into. Hold the whole
       array before entering the loop rather than one entry at a time: the first
       iteration is enough to free what the rest still refer to. */
    for (guint i = 0; i < n; i++) {
        if (resolved[i] != NULL)
            g_object_ref (resolved[i]);
    }

    for (guint i = 0; i < n; i++) {
        const CinnamonBgMonitorInfo *info = g_ptr_array_index (monitors, i);
        CinnamonBgItem *item = take_existing (old, info->connector);

        if (item == NULL) {
            /* No page for this connector before, so the set moved. */
            item = cinnamon_bg_item_new ();
            *set_moved = TRUE;
        }

        if (resolved[i] != NULL)
            *changed |= cinnamon_bg_item_seed_from (item, resolved[i]);
        cinnamon_bg_item_set_identity (item, info->connector, info->index,
                                      info->display_name);
        g_ptr_array_add (out, item);
    }

    for (guint i = 0; i < n; i++) {
        if (resolved[i] != NULL)
            g_object_unref (resolved[i]);
    }

    g_free (matched);
    g_free (claimed);
    g_free (resolved);
}

/**
 * cinnamon_bg_list_get_item_for_monitor:
 * @self: a #CinnamonBgList
 * @monitor: a monitor's position in cinnamon_bg_list_get_monitor_infos()
 *
 * What one monitor should show. Mirror and spanned hold a single item, which
 * every monitor shows; independent holds one per monitor, so this indexes
 * straight into the model.
 *
 * Returns: (transfer full) (nullable): the item, or %NULL if the layout has not
 *   loaded or @monitor is out of range
 */
CinnamonBgItem *
cinnamon_bg_list_get_item_for_monitor (CinnamonBgList *self, guint monitor)
{
    g_return_val_if_fail (CINNAMON_IS_BG_LIST (self), NULL);

    if (self->items->len == 0
        || monitor >= cinnamon_bg_list_get_monitor_infos (self)->len)
        return NULL;

    if (self->items->len == 1)
        return g_object_ref (g_ptr_array_index (self->items, 0));

    return g_object_ref (g_ptr_array_index (self->items, monitor));
}

static void
rebuild_items (CinnamonBgList *self, gboolean mode_moved)
{
    rebuild_against (self, cinnamon_bg_list_get_monitor_infos (self), mode_moved);
}

static void
on_monitors_changed (CinnamonBgMonitors *monitors G_GNUC_UNUSED, CinnamonBgList *self)
{
    rebuild_items (self, FALSE);
    g_signal_emit (self, sigs[MONITORS_CHANGED], 0);
}

static CinnamonBgMonitors *
get_monitors (CinnamonBgList *self)
{
    if (!self->monitors) {
        self->monitors = cinnamon_bg_monitors_get_default ();
        self->monitors_changed_id = g_signal_connect (self->monitors, "changed",
                                                      G_CALLBACK (on_monitors_changed), self);
    }

    return self->monitors;
}

/**
 * cinnamon_bg_list_get_monitor_infos:
 * @self: a #CinnamonBgList
 *
 * The connected monitors, ordered left-to-right then top-to-bottom.
 *
 * The layout is built on first use and loads asynchronously, so this is empty
 * until the window manager answers. Read it from
 * #CinnamonBgList::monitors-changed rather than immediately.
 *
 * Returns: (transfer none) (element-type CinnamonBgMonitorInfo): the current
 * monitors.
 */
GPtrArray *
cinnamon_bg_list_get_monitor_infos (CinnamonBgList *self)
{
    g_return_val_if_fail (CINNAMON_IS_BG_LIST (self), NULL);

    return cinnamon_bg_monitors_get_infos (get_monitors (self));
}

/**
 * cinnamon_bg_list_has_slideshow:
 *
 * Whether anything in the stored configuration asks for a rotating wallpaper.
 *
 * Reads the keys rather than a model, so a caller deciding whether to start the
 * slideshow daemon needs no #CinnamonBgList of its own, and gets an answer
 * before any monitor layout has loaded.
 *
 * Returns: %TRUE if any stored entry has the slideshow flag set
 */
gboolean
cinnamon_bg_list_has_slideshow (void)
{
    g_autoptr(GSettings) settings = g_settings_new ("org.cinnamon.desktop.background");
    g_autoptr(GVariant) stored = g_settings_get_value (settings, "picture-uri-list");

    if (g_variant_n_children (stored) == 0) {
        g_autoptr(GSettings) slideshow =
            g_settings_new ("org.cinnamon.desktop.background.slideshow");

        return g_settings_get_boolean (slideshow, "slideshow-enabled");
    }

    GVariantIter it;
    GVariant *child;

    g_variant_iter_init (&it, stored);
    while ((child = g_variant_iter_next_value (&it))) {
        gboolean rotating = FALSE;

        g_variant_lookup (child, "slideshow", "b", &rotating);
        g_variant_unref (child);

        if (rotating)
            return TRUE;
    }

    return FALSE;
}

static void
on_settings_changed (GSettings *s, const char *key, CinnamonBgList *self)
{
    cinnamon_bg_list_load (self);
}

static void
cinnamon_bg_list_get_property (GObject *o, guint id, GValue *v, GParamSpec *p)
{
    CinnamonBgList *self = CINNAMON_BG_LIST (o);

    if (id == PROP_MODE)
        g_value_set_enum (v, self->mode);
    else
        G_OBJECT_WARN_INVALID_PROPERTY_ID (o, id, p);
}

static void
cinnamon_bg_list_set_property (GObject *o, guint id, const GValue *v, GParamSpec *p)
{
    if (id == PROP_MODE)
        cinnamon_bg_list_set_mode (CINNAMON_BG_LIST (o), g_value_get_enum (v));
    else
        G_OBJECT_WARN_INVALID_PROPERTY_ID (o, id, p);
}

/* In constructed rather than cinnamon_bg_list_new() so a List built with
   g_object_new — the path bindings can take — is fully set up too. */
static void
cinnamon_bg_list_constructed (GObject *o)
{
    CinnamonBgList *self = CINNAMON_BG_LIST (o);

    G_OBJECT_CLASS (cinnamon_bg_list_parent_class)->constructed (o);

    self->settings = g_settings_new ("org.cinnamon.desktop.background");
    self->changed_id = g_signal_connect (self->settings, "changed::picture-uri-list",
                                         G_CALLBACK (on_settings_changed), self);
    self->changed_mode_id = g_signal_connect (self->settings, "changed::background-mode",
                                              G_CALLBACK (on_settings_changed), self);

    get_monitors (self);
    cinnamon_bg_list_load (self);
}

static void
cinnamon_bg_list_finalize (GObject *o)
{
    CinnamonBgList *self = CINNAMON_BG_LIST (o);

    if (self->settings && self->changed_id)
        g_clear_signal_handler (&self->changed_id, self->settings);
    if (self->settings && self->changed_mode_id)
        g_clear_signal_handler (&self->changed_mode_id, self->settings);

    g_clear_object (&self->settings);
    g_clear_pointer (&self->stored, g_ptr_array_unref);
    g_clear_pointer (&self->items, g_ptr_array_unref);

    if (self->monitors && self->monitors_changed_id)
        g_clear_signal_handler (&self->monitors_changed_id, self->monitors);

    g_clear_object (&self->monitors);

    G_OBJECT_CLASS (cinnamon_bg_list_parent_class)->finalize (o);
}

static void
cinnamon_bg_list_class_init (CinnamonBgListClass *klass)
{
    GObjectClass *oc = G_OBJECT_CLASS (klass);

    oc->constructed = cinnamon_bg_list_constructed;
    oc->finalize = cinnamon_bg_list_finalize;
    oc->get_property = cinnamon_bg_list_get_property;
    oc->set_property = cinnamon_bg_list_set_property;

    /**
     * CinnamonBgList:mode:
     *
     * How the background behaves, mirroring the `background-mode` GSettings
     * key. Setting it writes the key; the list then reloads and rebuilds the
     * model.
     */
    props[PROP_MODE] = g_param_spec_enum ("mode",
                                          "Mode",
                                          "How monitors are matched to entries when resolving",
                                          CINNAMON_TYPE_BG_MODE,
                                          CINNAMON_BG_MODE_MIRROR,
                                          G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);
    g_object_class_install_properties (oc, N_PROPS, props);

    /**
     * CinnamonBgList::monitors-changed:
     * @self: the #CinnamonBgList
     *
     * Emitted when the monitor layout has been reloaded: the initial
     * asynchronous load, a hotplug, or the window manager appearing on the bus.
     * The layout object's own settled signal, forwarded, so a component
     * connects to (and disconnects from) the list alone.
     *
     * The list starts the layout loading on construction, so this arrives on
     * its own without anything having to ask for it.
     */
    sigs[MONITORS_CHANGED] = g_signal_new ("monitors-changed", G_TYPE_FROM_CLASS (klass),
                                               G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                               G_TYPE_NONE, 0);

    /**
     * CinnamonBgList::config-changed:
     * @self: the #CinnamonBgList
     *
     * Emitted when the configuration moved: a placement, a color, a slideshow
     * being switched on or pointed elsewhere, the mode, or the set of monitors.
     *
     * Everything except a rotating wallpaper advancing, which is
     * #CinnamonBgList::picture-uri-changed. A component that reacts to what the
     * user configured wants this one and not that one, so a slideshow's own
     * writes stop coming back to it as though they were edits.
     */
    sigs[CONFIG_CHANGED] = g_signal_new ("config-changed", G_TYPE_FROM_CLASS (klass),
                                             G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                             G_TYPE_NONE, 0);

    /**
     * CinnamonBgList::picture-uri-changed:
     * @self: the #CinnamonBgList
     *
     * Emitted when the only thing that moved is which picture an item shows,
     * which is what a slideshow tick does.
     */
    sigs[PICTURE_URI_CHANGED] = g_signal_new ("picture-uri-changed", G_TYPE_FROM_CLASS (klass),
                                                  G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL,
                                                  G_TYPE_NONE, 0);
}

static void
cinnamon_bg_list_init (CinnamonBgList *self)
{
    self->stored = g_ptr_array_new_with_free_func (g_object_unref);
    self->items = g_ptr_array_new_with_free_func (g_object_unref);
    self->mode = CINNAMON_BG_MODE_MIRROR;
}

/**
 * cinnamon_bg_list_new:
 *
 * Returns: (transfer full): a new #CinnamonBgList
 */
CinnamonBgList *
cinnamon_bg_list_new (void)
{
    return g_object_new (CINNAMON_TYPE_BG_LIST, NULL);
}
