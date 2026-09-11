#pragma once

/**
 * SECTION:cinnamon-bg-enums
 * @title: Enumerations
 * @short_description: Value types used across the background model
 */

/**
 * CinnamonBgMode:
 * @CINNAMON_BG_MODE_INDEPENDENT: Each monitor is matched to its own entry, so
 *   monitors can show different backgrounds.
 * @CINNAMON_BG_MODE_MIRROR: A single connector-less entry, shown on every
     monitor.
 * @CINNAMON_BG_MODE_SPANNED: A single entry, painted as one image across all
     monitors.
 *
 * How the background behaves, mirroring the `background-mode` GSettings key.
 * Mirror and spanned resolve identically and differ only in how the renderer
 * paints the result.
 */
typedef enum {
    CINNAMON_BG_MODE_INDEPENDENT,
    CINNAMON_BG_MODE_MIRROR,
    CINNAMON_BG_MODE_SPANNED
} CinnamonBgMode;
