#pragma once

#include <gio/gio.h>

G_BEGIN_DECLS

/**
 * CinnamonBgMonitorInfo:
 * @connector: the monitor's connector, for example `eDP-1`. The primary key a
 *   monitor is matched to a stored entry on.
 * @display_name: a human-readable name for the monitor: its own name where it
 *   has one, else its model, else @connector. Never empty, so a consumer
 *   labelling a UI needs no fallback of its own.
 * @x: the monitor's x position in the layout.
 * @y: the monitor's y position in the layout.
 * @width: the monitor's width in the layout, with its scale and rotation
 *   already applied.
 * @height: the monitor's height in the layout.
 * @index: the window manager's logical-monitor index.
 * @primary: whether this is the primary monitor.
 */
typedef struct {
    char *connector;
    char *display_name;
    int x;
    int y;
    int width;
    int height;
    int index;
    gboolean primary;
} CinnamonBgMonitorInfo;

#define CINNAMON_TYPE_BG_MONITOR_INFO (cinnamon_bg_monitor_info_get_type ())

GType                  cinnamon_bg_monitor_info_get_type (void) G_GNUC_CONST;
CinnamonBgMonitorInfo *cinnamon_bg_monitor_info_copy     (CinnamonBgMonitorInfo *self);
void                   cinnamon_bg_monitor_info_free     (CinnamonBgMonitorInfo *self);

G_DEFINE_AUTOPTR_CLEANUP_FUNC (CinnamonBgMonitorInfo, cinnamon_bg_monitor_info_free)

G_END_DECLS
