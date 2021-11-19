/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-settings.h: Global settings
 *
 * Copyright 2019 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms and conditions of the GNU Lesser General Public License,
 * version 2.1, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#if !defined(ST_H_INSIDE) && !defined(ST_COMPILATION)
#error "Only <st/st.h> can be included directly.h"
#endif

#ifndef __ST_SETTINGS_H__
#define __ST_SETTINGS_H__

#include <glib-object.h>

G_BEGIN_DECLS

#define ST_TYPE_SETTINGS (st_settings_get_type ())
G_DECLARE_FINAL_TYPE (StSettings, st_settings, ST, SETTINGS, GObject)

StSettings * st_settings_get (void);

G_END_DECLS

#endif /* __ST_SETTINGS_H__ */
