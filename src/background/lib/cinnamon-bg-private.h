#pragma once

#include "cinnamon-bg-item.h"
#include "cinnamon-bg-list.h"
#include "cinnamon-bg-monitor-info.h"

G_BEGIN_DECLS

struct _CinnamonBgItem {
    GObject parent_instance;

    char *connector;
    char *picture_uri;
    char *primary_color;
    char *secondary_color;
    char *slideshow_source;
    char *monitor_label;
    char *picture_options;
    char *color_shading_type;
    gboolean slideshow;
    int index;
};

/* The monitor layout, read from the window manager's DisplayConfig. Entirely
 * internal: CinnamonBgList owns the one instance and hands out the infos, so
 * nothing outside the library needs the object. See
 * cinnamon_bg_list_get_monitor_infos() and ::monitors-changed. */
#define CINNAMON_TYPE_BG_MONITORS (cinnamon_bg_monitors_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonBgMonitors, cinnamon_bg_monitors, CINNAMON, BG_MONITORS, GObject)

CinnamonBgMonitors *cinnamon_bg_monitors_get_default  (void);
GPtrArray          *cinnamon_bg_monitors_get_infos    (CinnamonBgMonitors *self);

CinnamonBgItem     *cinnamon_bg_item_new              (void);
CinnamonBgItem     *cinnamon_bg_item_copy             (CinnamonBgItem *self);

typedef enum {
    CINNAMON_BG_CHANGE_NONE    = 0,
    CINNAMON_BG_CHANGE_PICTURE = 1 << 0,   /* picture-uri, and nothing else */
    CINNAMON_BG_CHANGE_CONFIG  = 1 << 1,   /* anything a slideshow tick cannot do */
} CinnamonBgChange;

CinnamonBgChange    cinnamon_bg_item_seed_from    (CinnamonBgItem *self,
                                                   CinnamonBgItem *source);

void                cinnamon_bg_item_set_identity     (CinnamonBgItem *self,
                                                       const char     *connector,
                                                       int             index,
                                                       const char     *label);

CinnamonBgItem     *cinnamon_bg_item_new_from_variant (GVariant *entry);
GVariant           *cinnamon_bg_item_to_variant       (CinnamonBgItem *self);

void                cinnamon_bg_list_load             (CinnamonBgList *self);

G_END_DECLS
