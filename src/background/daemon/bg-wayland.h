#pragma once

#include "cinnamon-background-daemon.h"

G_BEGIN_DECLS

typedef struct _BgWaylandBackend BgWaylandBackend;

BgWaylandBackend *bg_wayland_backend_new (CinnamonBackgroundDaemon *daemon);
void              bg_wayland_backend_free (BgWaylandBackend *self);
void              bg_wayland_backend_setup_monitors (BgWaylandBackend *self);
void              bg_wayland_backend_draw (BgWaylandBackend *self, gboolean animate);

G_END_DECLS
