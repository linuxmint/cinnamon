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

#ifndef __ST_DRAWING_AREA_H__
#define __ST_DRAWING_AREA_H__

#include "st-widget.h"
#include <cairo.h>

#define ST_TYPE_DRAWING_AREA                 (st_drawing_area_get_type ())
#define ST_DRAWING_AREA(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_DRAWING_AREA, StDrawingArea))
#define ST_DRAWING_AREA_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_DRAWING_AREA, StDrawingAreaClass))
#define ST_IS_DRAWING_AREA(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_DRAWING_AREA))
#define ST_IS_DRAWING_AREA_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_DRAWING_AREA))
#define ST_DRAWING_AREA_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_DRAWING_AREA, StDrawingAreaClass))

typedef struct _StDrawingArea        StDrawingArea;
typedef struct _StDrawingAreaClass   StDrawingAreaClass;

typedef struct _StDrawingAreaPrivate StDrawingAreaPrivate;

struct _StDrawingArea
{
    StWidget parent;

    StDrawingAreaPrivate *priv;
};

struct _StDrawingAreaClass
{
    StWidgetClass parent_class;

    void (*repaint) (StDrawingArea *area);
};

GType st_drawing_area_get_type (void) G_GNUC_CONST;

void     st_drawing_area_queue_repaint    (StDrawingArea *area);
cairo_t *st_drawing_area_get_context      (StDrawingArea *area);
void     st_drawing_area_get_surface_size (StDrawingArea *area,
                                           guint         *width,
                                           guint         *height);

#endif /* __ST_DRAWING_AREA_H__ */
