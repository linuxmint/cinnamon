/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-drawing-area.h: A dynamically-sized Cairo drawing area
 *
 * Copyright 2009, 2010 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __ST_POLYGON_H__
#define __ST_POLYGON_H__

#include <clutter/clutter.h>
#include <cairo.h>

#define ST_TYPE_POLYGON                 (st_polygon_get_type ())
#define ST_POLYGON(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_POLYGON, StPolygon))
#define ST_POLYGON_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_POLYGON, StPolygonClass))
#define ST_IS_POLYGON(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_POLYGON))
#define ST_IS_POLYGON_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_POLYGON))
#define ST_POLYGON_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_POLYGON, StPolygonClass))

typedef struct _StPolygon        StPolygon;
typedef struct _StPolygonClass   StPolygonClass;

typedef struct _StPolygonPrivate StPolygonPrivate;

struct _StPolygon
{
    ClutterActor parent;

    StPolygonPrivate *priv;
};

struct _StPolygonClass
{
    ClutterActorClass parent_class;

    void (*repaint) (StPolygon *area);
};

GType st_polygon_get_type (void) G_GNUC_CONST;

void     st_polygon_queue_repaint    (StPolygon *area);

#endif /* __ST_POLYGON_H__ */
