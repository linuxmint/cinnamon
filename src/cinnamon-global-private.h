/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_GLOBAL_PRIVATE_H__
#define __CINNAMON_GLOBAL_PRIVATE_H__

#include "cinnamon-global.h"

#include <cjs/gjs.h>

void _cinnamon_global_init            (const char *first_property_name,
                                    ...);
void _cinnamon_global_set_plugin      (CinnamonGlobal  *global,
                                    MetaPlugin   *plugin);

GjsContext *_cinnamon_global_get_gjs_context (CinnamonGlobal  *global);

gboolean _cinnamon_global_check_xdnd_event (CinnamonGlobal  *global,
                                         XEvent       *xev);

#endif /* __CINNAMON_GLOBAL_PRIVATE_H__ */
