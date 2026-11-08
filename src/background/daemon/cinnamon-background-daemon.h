#pragma once

#include <gio/gio.h>
#include <cairo.h>

G_BEGIN_DECLS

#define CINNAMON_TYPE_BACKGROUND_DAEMON (cinnamon_background_daemon_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonBackgroundDaemon, cinnamon_background_daemon,
                      CINNAMON, BACKGROUND_DAEMON, GApplication)

/* Render one region. Geometry is logical; the returned surface is
   round(width * scale) by round(height * scale) device pixels. */
cairo_surface_t *cinnamon_background_daemon_render_region (CinnamonBackgroundDaemon *daemon,
                                                           const char               *connector,
                                                           int                       width,
                                                           int                       height,
                                                           const GdkRectangle       *span,
                                                           double                    scale);

gboolean         cinnamon_background_daemon_is_spanned    (CinnamonBackgroundDaemon *daemon);

/* Identity of what @connector should currently be painting. Unchanged between
   two draws means the monitor needs no repaint. */
guint            cinnamon_background_daemon_content_hash  (CinnamonBackgroundDaemon *daemon,
                                                           const char               *connector);

void             cinnamon_background_daemon_notify_ready  (CinnamonBackgroundDaemon *daemon);

void             cinnamon_background_daemon_build_render_inputs   (CinnamonBackgroundDaemon *daemon);
void             cinnamon_background_daemon_release_render_inputs (CinnamonBackgroundDaemon *daemon);

G_END_DECLS
