#pragma once

#include <gdk/gdk.h>
#include "cinnamon-background-daemon.h"

G_BEGIN_DECLS

void bg_x11_set_background (GdkDisplay *display, CinnamonBackgroundDaemon *daemon);

G_END_DECLS
