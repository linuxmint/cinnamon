/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Copyright 2009 Intel Corporation.
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
#ifndef __ST_TYPES_H__
#define __ST_TYPES_H__

#if !defined(ST_H_INSIDE) && !defined(ST_COMPILATION)
#error "Only <st/st.h> can be included directly.h"
#endif

#include <glib-object.h>
#include <clutter/clutter.h>
#include <gtk/gtk.h>

G_BEGIN_DECLS

/**
 * SECTION:st-types
 * @short_description: type definitions used throughout St
 *
 * Common types for StWidgets.
 */

typedef enum {
  ST_ALIGN_START,
  ST_ALIGN_MIDDLE,
  ST_ALIGN_END
} StAlign;

typedef enum {
  ST_ICON_SYMBOLIC,
  ST_ICON_FULLCOLOR,
  ST_ICON_APPLICATION,
  ST_ICON_DOCUMENT,
  ST_ICON_FADED
} StIconType;

typedef enum {
  ST_BACKGROUND_SIZE_AUTO,
  ST_BACKGROUND_SIZE_CONTAIN,
  ST_BACKGROUND_SIZE_COVER,
  ST_BACKGROUND_SIZE_FIXED
} StBackgroundSize;

G_END_DECLS

#endif /* __ST_TYPES_H__ */
