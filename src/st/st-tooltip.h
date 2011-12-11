/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-tooltip.h: Plain tooltip actor
 *
 * Copyright 2008, 2009 Intel Corporation.
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

#ifndef __ST_TOOLTIP_H__
#define __ST_TOOLTIP_H__

G_BEGIN_DECLS

#include <st/st-bin.h>

#define ST_TYPE_TOOLTIP                (st_tooltip_get_type ())
#define ST_TOOLTIP(obj)                (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_TOOLTIP, StTooltip))
#define ST_IS_TOOLTIP(obj)             (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_TOOLTIP))
#define ST_TOOLTIP_CLASS(klass)        (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_TOOLTIP, StTooltipClass))
#define ST_IS_TOOLTIP_CLASS(klass)     (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_TOOLTIP))
#define ST_TOOLTIP_GET_CLASS(obj)      (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_TOOLTIP, StTooltipClass))

typedef struct _StTooltip              StTooltip;
typedef struct _StTooltipPrivate       StTooltipPrivate;
typedef struct _StTooltipClass         StTooltipClass;

/**
 * StTooltip:
 *
 * The contents of this structure is private and should only be accessed using
 * the provided API.
 */
struct _StTooltip
{
  /*< private >*/
  StWidget parent_instance;

  StTooltipPrivate *priv;
};

struct _StTooltipClass
{
  StWidgetClass parent_class;
};

GType st_tooltip_get_type (void) G_GNUC_CONST;

const gchar * st_tooltip_get_label (StTooltip   *tooltip);
void          st_tooltip_set_label (StTooltip   *tooltip,
                                    const gchar *text);

void                   st_tooltip_set_tip_area (StTooltip             *tooltip,
                                                const ClutterGeometry *area);
const ClutterGeometry* st_tooltip_get_tip_area (StTooltip             *tooltip);

/**
 * StTooltipConstrainFunc:
 * @tooltip: the #StTooltip that is being positioned
 * @geometry: size and position of the tooltip without any constraints
 * @adjusted_geometry: (out): new position of the tooltip.
 *   The width and height fields will be ignored.
 * @data: (closure): user data passed to st_tooltip_set_constrain_func()
 */
typedef void (*StTooltipConstrainFunc) (StTooltip             *tooltip,
                                        const ClutterGeometry *geometry,
                                        ClutterGeometry       *adjusted_geometry,
                                        gpointer               data);

void st_tooltip_set_constrain_func (ClutterStage           *stage,
                                    StTooltipConstrainFunc  func,
                                    gpointer                data,
                                    GDestroyNotify          notify);

G_END_DECLS

#endif /* __ST_TOOLTIP_H__ */
