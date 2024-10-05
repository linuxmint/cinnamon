#pragma once

#include <clutter/clutter.h>
#include <glib.h>

G_BEGIN_DECLS

void st_debug_check_coord_rounding       (const gchar  *context,
                                          gfloat        x,
                                          gfloat        y,
                                          gfloat        width,
                                          gfloat        height);
void st_debug_check_actor_coord_rounding (ClutterActor *actor,
                                          const gchar  *context);
void st_debug_clear_coord_rounding_warning (const gchar *context);

G_END_DECLS