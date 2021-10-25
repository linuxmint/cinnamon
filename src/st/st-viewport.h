/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-viewport.h: viewport actor
 *
 * Copyright 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2019 Endless, Inc.
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

#pragma once

#include <st-widget.h>

G_BEGIN_DECLS

#define ST_TYPE_VIEWPORT (st_viewport_get_type())
#define ST_VIEWPORT(obj)                   (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_VIEWPORT, StViewport))
#define ST_IS_VIEWPORT(obj)                (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_VIEWPORT))
#define ST_VIEWPORT_CLASS(klass)           (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_VIEWPORT, StViewportClass))
#define ST_IS_VIEWPORT_CLASS(klass)        (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_VIEWPORT))
#define ST_VIEWPORT_GET_CLASS(obj)         (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_VIEWPORT, StViewportClass))

typedef struct _StViewport                 StViewport;
typedef struct _StViewportPrivate          StViewportPrivate;
typedef struct _StViewportClass            StViewportClass;

/**
 * StViewport:
 *
 * The #StViewport struct contains only private data
 */
struct _StViewport
{
  /*< private >*/
  StWidget parent_instance;

  StViewportPrivate *priv;
};

/**
 * StViewportClass:
 *
 * The #StViewportClass struct contains only private data
 */
struct _StViewportClass
{
  /*< private >*/
  StWidgetClass parent_class;
};

GType st_viewport_get_type (void) G_GNUC_CONST;

G_END_DECLS

