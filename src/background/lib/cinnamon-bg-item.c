#include "cinnamon-bg-private.h"

/**
 * SECTION:cinnamon-bg-item
 * @title: CinnamonBgItem
 * @short_description: One monitor's background configuration
 * @see_also: #CinnamonBgList
 *
 * One entry of the `picture-uri-list` GSettings key: what to paint on one
 * or more monitor, plus the identity to recognise it across sessions. The color
 * properties always apply — they are the backdrop a picture is drawn over.
 *
 * Items come from a #CinnamonBgList and are live: setting a property changes
 * the configuration that list will write on cinnamon_bg_list_save().
 */

G_DEFINE_FINAL_TYPE (CinnamonBgItem, cinnamon_bg_item, G_TYPE_OBJECT)

enum {
    PROP_0,
    PROP_PICTURE_URI,
    PROP_PICTURE_OPTIONS,
    PROP_PRIMARY_COLOR,
    PROP_SECONDARY_COLOR,
    PROP_COLOR_SHADING_TYPE,
    PROP_SLIDESHOW,
    PROP_SLIDESHOW_SOURCE,
    PROP_CONNECTOR,
    PROP_INDEX,
    PROP_MONITOR_LABEL,
    N_PROPS
};
static GParamSpec *props[N_PROPS];

static void
set_string_field (CinnamonBgItem  *self,
                  char           **field,
                  const char      *value,
                  guint            prop)
{
    const char *new_value = value ? value : "";

    if (g_strcmp0 (*field, new_value) == 0)
        return;

    g_free (*field);
    *field = g_strdup (new_value);
    g_object_notify_by_pspec (G_OBJECT (self), props[prop]);
}

static const char * const PLACEMENTS[] = {
    "none", "wallpaper", "centered", "scaled", "stretched", "zoom", NULL
};

static const char * const SHADINGS[] = { "solid", "horizontal", "vertical", NULL };

static const char *
known_placement (const char *value)
{
    for (int i = 0; PLACEMENTS[i] != NULL; i++) {
        if (g_strcmp0 (value, PLACEMENTS[i]) == 0)
            return PLACEMENTS[i];
    }

    return "zoom";
}

static const char *
known_shading (const char *value)
{
    for (int i = 0; SHADINGS[i] != NULL; i++) {
        if (g_strcmp0 (value, SHADINGS[i]) == 0)
            return SHADINGS[i];
    }

    return "solid";
}

static void
cinnamon_bg_item_get_property (GObject *o, guint id, GValue *v, GParamSpec *pspec)
{
    CinnamonBgItem *self = CINNAMON_BG_ITEM (o);

    switch (id) {
    case PROP_PICTURE_URI:
        g_value_set_string (v, self->picture_uri);
        break;
    case PROP_PICTURE_OPTIONS:
        g_value_set_string (v, self->picture_options);
        break;
    case PROP_PRIMARY_COLOR:
        g_value_set_string (v, self->primary_color);
        break;
    case PROP_SECONDARY_COLOR:
        g_value_set_string (v, self->secondary_color);
        break;
    case PROP_COLOR_SHADING_TYPE:
        g_value_set_string (v, self->color_shading_type);
        break;
    case PROP_SLIDESHOW:
        g_value_set_boolean (v, self->slideshow);
        break;
    case PROP_SLIDESHOW_SOURCE:
        g_value_set_string (v, self->slideshow_source);
        break;
    case PROP_CONNECTOR:
        g_value_set_string (v, self->connector);
        break;
    case PROP_INDEX:
        g_value_set_int (v, self->index);
        break;
    case PROP_MONITOR_LABEL:
        g_value_set_string (v, self->monitor_label);
        break;
    default:
        G_OBJECT_WARN_INVALID_PROPERTY_ID (o, id, pspec);
    }
}

static void
cinnamon_bg_item_set_property (GObject *o, guint id, const GValue *v, GParamSpec *pspec)
{
    CinnamonBgItem *self = CINNAMON_BG_ITEM (o);

    switch (id) {
    case PROP_PICTURE_URI:
        set_string_field (self, &self->picture_uri, g_value_get_string (v), PROP_PICTURE_URI);
        break;
    case PROP_PRIMARY_COLOR:
        set_string_field (self, &self->primary_color, g_value_get_string (v), PROP_PRIMARY_COLOR);
        break;
    case PROP_SECONDARY_COLOR:
        set_string_field (self, &self->secondary_color, g_value_get_string (v), PROP_SECONDARY_COLOR);
        break;
    case PROP_SLIDESHOW_SOURCE:
        set_string_field (self, &self->slideshow_source, g_value_get_string (v), PROP_SLIDESHOW_SOURCE);
        break;
    case PROP_PICTURE_OPTIONS:
        set_string_field (self, &self->picture_options,
                          known_placement (g_value_get_string (v)), PROP_PICTURE_OPTIONS);
        break;
    case PROP_COLOR_SHADING_TYPE:
        set_string_field (self, &self->color_shading_type,
                          known_shading (g_value_get_string (v)), PROP_COLOR_SHADING_TYPE);
        break;
    case PROP_SLIDESHOW:
        if (self->slideshow != g_value_get_boolean (v)) {
            self->slideshow = g_value_get_boolean (v);
            g_object_notify_by_pspec (o, props[PROP_SLIDESHOW]);
        }
        break;
    default:
        G_OBJECT_WARN_INVALID_PROPERTY_ID (o, id, pspec);
    }
}

static void
cinnamon_bg_item_finalize (GObject *o)
{
    CinnamonBgItem *self = CINNAMON_BG_ITEM (o);

    g_free (self->connector);
    g_free (self->picture_uri);
    g_free (self->primary_color);
    g_free (self->secondary_color);
    g_free (self->picture_options);
    g_free (self->color_shading_type);
    g_free (self->slideshow_source);
    g_free (self->monitor_label);

    G_OBJECT_CLASS (cinnamon_bg_item_parent_class)->finalize (o);
}

static void
cinnamon_bg_item_class_init (CinnamonBgItemClass *klass)
{
    GObjectClass *object_class = G_OBJECT_CLASS (klass);

    object_class->get_property = cinnamon_bg_item_get_property;
    object_class->set_property = cinnamon_bg_item_set_property;
    object_class->finalize = cinnamon_bg_item_finalize;

    /**
     * CinnamonBgItem:picture-uri:
     *
     * The picture to paint, or `""` for none. Only local `file://` URIs. On a
     * slideshow monitor the daemon rewrites this on every rotation, so it is
     * the current image rather than a user choice.
     */
    props[PROP_PICTURE_URI] = g_param_spec_string ("picture-uri",
                                                   "Picture URI",
                                                   "The picture to paint, or \"\" for none",
                                                   "",
                                                   G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:picture-options:
     *
     * How #CinnamonBgItem:picture-uri is fitted to the monitor:
     * `none`, `wallpaper`, `centered`, `scaled`, `stretched` or `zoom`.
     *
     * `none` paints no picture, only the color background. Anything
     * unrecognised is taken as `zoom`.
     */
    props[PROP_PICTURE_OPTIONS] = g_param_spec_string ("picture-options",
                                                       "Picture options",
                                                       "How the picture is fitted to the monitor",
                                                       "zoom",
                                                       G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:primary-color:
     *
     * The backdrop color, as a parse-able color string such as `#000000`.
     * Always painted underneath any picture.
     */
    props[PROP_PRIMARY_COLOR] = g_param_spec_string ("primary-color",
                                                     "Primary color",
                                                     "The backdrop color, painted under any picture",
                                                     "#000000",
                                                     G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:secondary-color:
     *
     * The second color of the gradient. Only used when
     * #CinnamonBgItem:color-shading-type is a gradient.
     */
    props[PROP_SECONDARY_COLOR] = g_param_spec_string ("secondary-color",
                                                       "Secondary color",
                                                       "The second color of the gradient",
                                                       "#000000",
                                                       G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:color-shading-type:
     *
     * How the color backdrop is drawn: `solid` for a flat
     * #CinnamonBgItem:primary-color, or `horizontal` or `vertical` for a
     * gradient between it and #CinnamonBgItem:secondary-color. Exactly as the
     * key stores it; anything unrecognized is taken as `solid`.
     */
    props[PROP_COLOR_SHADING_TYPE] = g_param_spec_string ("color-shading-type",
                                                          "Color shading type",
                                                          "How the color backdrop is drawn",
                                                          "solid",
                                                          G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:slideshow:
     *
     * Whether the slideshow daemon rotates this monitor's picture. Per-monitor;
     * the interval and ordering are global settings.
     */
    props[PROP_SLIDESHOW] = g_param_spec_boolean ("slideshow",
                                                  "Slideshow",
                                                  "Whether this monitor's picture rotates",
                                                  FALSE,
                                                  G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:slideshow-source:
     *
     * Where a slideshow draws its images from, as a `type://path` string:
     * `directory://` for a folder or `xml://` for a wallpaper collection.
     */
    props[PROP_SLIDESHOW_SOURCE] = g_param_spec_string ("slideshow-source",
                                                        "Slideshow source",
                                                        "Where a slideshow draws its images from, as type://path",
                                                        "",
                                                        G_PARAM_READWRITE | G_PARAM_EXPLICIT_NOTIFY | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:connector:
     *
     * The connector of the monitor this entry configures, for example `eDP-1`.
     * Empty on the representative entry used by mirror and spanned.
     */
    props[PROP_CONNECTOR] = g_param_spec_string ("connector",
                                                 "Connector",
                                                 "The connector of the monitor this entry configures",
                                                 "",
                                                 G_PARAM_READABLE | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:index:
     *
     * The logical-monitor index this entry was last seen at, or -1 if unknown.
     * The cross-session fallback when connector names differ.
     */
    props[PROP_INDEX] = g_param_spec_int ("index",
                                          "Index",
                                          "The logical-monitor index this entry was last seen at",
                                          -1,
                                          G_MAXINT,
                                          -1,
                                          G_PARAM_READABLE | G_PARAM_STATIC_STRINGS);

    /**
     * CinnamonBgItem:monitor-label:
     *
     * A human-readable name for the monitor, for labeling in a UI.
     */
    props[PROP_MONITOR_LABEL] = g_param_spec_string ("monitor-label",
                                                     "Monitor label",
                                                     "A human-readable name for the monitor",
                                                     "",
                                                     G_PARAM_READABLE | G_PARAM_STATIC_STRINGS);

    g_object_class_install_properties (object_class, N_PROPS, props);
}

static void
cinnamon_bg_item_init (CinnamonBgItem *self)
{
    self->connector = g_strdup ("");
    self->picture_uri = g_strdup ("");
    self->primary_color = g_strdup ("#000000");
    self->secondary_color = g_strdup ("#000000");
    self->slideshow_source = g_strdup ("");
    self->monitor_label = g_strdup ("");
    self->picture_options = g_strdup ("zoom");
    self->color_shading_type = g_strdup ("solid");
    self->slideshow = FALSE;
    self->index = -1;
}

/**
 * cinnamon_bg_item_set_identity:
 * @self: a #CinnamonBgItem
 * @connector: the monitor's connector
 * @index: the logical-monitor index
 * @label: the human-readable monitor name
 *
 * Stamps which monitor this item is for.
 */
void
cinnamon_bg_item_set_identity (CinnamonBgItem *self,
                               const char     *connector,
                               int             index,
                               const char     *label)
{
    g_return_if_fail (CINNAMON_IS_BG_ITEM (self));

    set_string_field (self, &self->connector, connector, PROP_CONNECTOR);
    set_string_field (self, &self->monitor_label, label, PROP_MONITOR_LABEL);

    if (self->index != index) {
        self->index = index;
        g_object_notify_by_pspec (G_OBJECT (self), props[PROP_INDEX]);
    }
}

/**
 * cinnamon_bg_item_new:
 *
 * Creates an item with default values: no picture,
 * `zoom`, a solid black backdrop, no slideshow, and no
 * monitor identity.
 *
 * Returns: (transfer full): a new #CinnamonBgItem
 */
CinnamonBgItem *
cinnamon_bg_item_new (void)
{
    return g_object_new (CINNAMON_TYPE_BG_ITEM, NULL);
}

/**
 * cinnamon_bg_item_copy:
 * @self: a #CinnamonBgItem
 *
 * Returns: (transfer full): a copy of @self, including its monitor identity
 */
CinnamonBgItem *
cinnamon_bg_item_copy (CinnamonBgItem *self)
{
    CinnamonBgItem *copy = cinnamon_bg_item_new ();

    g_return_val_if_fail (CINNAMON_IS_BG_ITEM (self), copy);

    cinnamon_bg_item_seed_from (copy, self);
    cinnamon_bg_item_set_identity (copy, self->connector, self->index, self->monitor_label);

    return copy;
}

static char *
lookup_str (GVariant *e, const char *key, const char *dflt)
{
    g_autoptr(GVariant) v = g_variant_lookup_value (e, key, G_VARIANT_TYPE_STRING);

    return v ? g_variant_dup_string (v, NULL) : g_strdup (dflt);
}

static gboolean
lookup_bool (GVariant *e, const char *key, gboolean dflt)
{
    g_autoptr(GVariant) v = g_variant_lookup_value (e, key, G_VARIANT_TYPE_BOOLEAN);

    return v ? g_variant_get_boolean (v) : dflt;
}

static int
lookup_int (GVariant *e, const char *key, int dflt)
{
    g_autoptr(GVariant) v = g_variant_lookup_value (e, key, G_VARIANT_TYPE_INT32);

    return v ? g_variant_get_int32 (v) : dflt;
}

/**
 * cinnamon_bg_item_new_from_variant:
 * @entry: an `a{sv}` vardict, one element of the `picture-uri-list` key
 *
 * Deserialises one stored entry.
 *
 * Returns: (transfer full): a new #CinnamonBgItem
 */
CinnamonBgItem *
cinnamon_bg_item_new_from_variant (GVariant *entry)
{
    g_return_val_if_fail (entry != NULL, NULL);

    CinnamonBgItem *self = cinnamon_bg_item_new ();

    g_free (self->connector);
    self->connector = lookup_str (entry, "connector", "");
    g_free (self->picture_uri);
    self->picture_uri = lookup_str (entry, "picture-uri", "");
    g_free (self->primary_color);
    self->primary_color = lookup_str (entry, "primary-color", "#000000");
    g_free (self->secondary_color);
    self->secondary_color = lookup_str (entry, "secondary-color", "#000000");
    g_free (self->slideshow_source);
    self->slideshow_source = lookup_str (entry, "slideshow-source", "");
    self->slideshow = lookup_bool (entry, "slideshow", FALSE);
    /* :index is read-only, so the pspec's range is never enforced on this path.
       Anything below the sentinel is one. */
    self->index = MAX (lookup_int (entry, "index", -1), -1);

    /* "spanned" was a placement before it was a mode, so it is not one of ours.
       load_single() migrates it to CINNAMON_BG_MODE_SPANNED; anywhere else
       known_placement() zooms it, which is what spanned always was once each
       monitor's slice of the union is accounted for. */
    g_autofree char *po = lookup_str (entry, "picture-options", "zoom");

    g_free (self->picture_options);
    self->picture_options = g_strdup (known_placement (po));

    g_autofree char *cs = lookup_str (entry, "color-shading-type", "solid");

    g_free (self->color_shading_type);
    self->color_shading_type = g_strdup (known_shading (cs));

    return self;
}

static void
add_str (GVariantBuilder *b, const char *key, const char *val)
{
    if (val && val[0] != '\0')
        g_variant_builder_add (b, "{sv}", key, g_variant_new_string (val));
}

static void
add_bool_if_true (GVariantBuilder *b, const char *key, gboolean val)
{
    if (val)
        g_variant_builder_add (b, "{sv}", key, g_variant_new_boolean (TRUE));
}

static void
add_int_if_nonneg (GVariantBuilder *b, const char *key, int val)
{
    if (val >= 0)
        g_variant_builder_add (b, "{sv}", key, g_variant_new_int32 (val));
}

/**
 * cinnamon_bg_item_to_variant:
 * @self: a #CinnamonBgItem
 *
 * Serializes the item into one `a{sv}` element of the `picture-uri-list` key.
 * Empty and default fields are omitted, so this is not a full dump — just what
 * cinnamon_bg_item_new_from_variant() needs.
 *
 * Returns: (transfer floating): a floating `a{sv}` #GVariant
 */
GVariant *
cinnamon_bg_item_to_variant (CinnamonBgItem *self)
{
    g_return_val_if_fail (CINNAMON_IS_BG_ITEM (self), NULL);

    GVariantBuilder b;

    g_variant_builder_init (&b, G_VARIANT_TYPE ("a{sv}"));
    add_str (&b, "connector", self->connector);
    add_int_if_nonneg (&b, "index", self->index);

    if (g_strcmp0 (self->picture_options, "none") == 0) {
        add_str (&b, "picture-options", self->picture_options);
    } else {
        add_str (&b, "picture-uri", self->picture_uri);
        add_str (&b, "picture-options", self->picture_options);
        add_str (&b, "slideshow-source", self->slideshow_source);
        add_bool_if_true (&b, "slideshow", self->slideshow);
    }

    add_str (&b, "color-shading-type", self->color_shading_type);
    add_str (&b, "primary-color", self->primary_color);
    add_str (&b, "secondary-color", self->secondary_color);

    return g_variant_builder_end (&b);
}

/**
 * cinnamon_bg_item_has_picture:
 * @self: a #CinnamonBgItem
 *
 * Whether this item has a picture to paint over its color backdrop: a
 * placement other than `none` *and* a set picture uri.
 *
 * Returns: %TRUE if @self has a picture to paint
 */
gboolean
cinnamon_bg_item_has_picture (CinnamonBgItem *self)
{
    g_return_val_if_fail (CINNAMON_IS_BG_ITEM (self), FALSE);

    return g_strcmp0 (self->picture_options, "none") != 0 &&
           self->picture_uri && self->picture_uri[0] != '\0';
}

/**
 * cinnamon_bg_item_seed_from:
 * @self: a #CinnamonBgItem
 * @source: the #CinnamonBgItem to take the appearance of
 *
 * Takes over everything @source paints with -- picture, placement, colors and
 * slideshow -- leaving @self's own monitor identity alone. What a monitor with
 * no stored entry of its own is built from.
 *
 * The picture is reported apart from the rest because a rotating wallpaper moves
 * it and nothing else, which is the one change the list can tell its consumers
 * to ignore.
 *
 * Returns: what moved
 */
CinnamonBgChange
cinnamon_bg_item_seed_from (CinnamonBgItem *self, CinnamonBgItem *source)
{
    g_return_val_if_fail (CINNAMON_IS_BG_ITEM (self), CINNAMON_BG_CHANGE_NONE);
    g_return_val_if_fail (CINNAMON_IS_BG_ITEM (source), CINNAMON_BG_CHANGE_NONE);

    CinnamonBgChange changed = CINNAMON_BG_CHANGE_NONE;

    if (g_strcmp0 (self->picture_uri, source->picture_uri) != 0)
        changed |= CINNAMON_BG_CHANGE_PICTURE;

    if (g_strcmp0 (self->color_shading_type, source->color_shading_type) != 0 ||
        g_strcmp0 (self->picture_options, source->picture_options) != 0 ||
        self->slideshow != source->slideshow ||
        g_strcmp0 (self->primary_color, source->primary_color) != 0 ||
        g_strcmp0 (self->secondary_color, source->secondary_color) != 0 ||
        g_strcmp0 (self->slideshow_source, source->slideshow_source) != 0)
        changed |= CINNAMON_BG_CHANGE_CONFIG;

    g_object_set (self,
                  "picture-uri", source->picture_uri,
                  "picture-options", source->picture_options,
                  "primary-color", source->primary_color,
                  "secondary-color", source->secondary_color,
                  "color-shading-type", source->color_shading_type,
                  "slideshow", source->slideshow,
                  "slideshow-source", source->slideshow_source,
                  NULL);

    return changed;
}
