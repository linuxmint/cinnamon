/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-widget-accessible.h: Accessible object for StWidget
 *
 * Copyright 2010 Igalia, S.L.
 * Author: Alejandro Piñeiro Iglesias <apinheiro@igalia.com>
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

#ifndef __ST_WIDGET_ACCESSIBLE_H__
#define __ST_WIDGET_ACCESSIBLE_H__

G_BEGIN_DECLS

#include <st/st-widget.h>
#include <cally/cally.h>

#define ST_TYPE_WIDGET_ACCESSIBLE st_widget_accessible_get_type ()

#define ST_WIDGET_ACCESSIBLE(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), \
  ST_TYPE_WIDGET_ACCESSIBLE, StWidgetAccessible))

#define ST_IS_WIDGET_ACCESSIBLE(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), \
  ST_TYPE_WIDGET_ACCESSIBLE))

#define ST_WIDGET_ACCESSIBLE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), \
  ST_TYPE_WIDGET_ACCESSIBLE, StWidgetAccessibleClass))

#define ST_IS_WIDGET_ACCESSIBLE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), \
  ST_TYPE_WIDGET_ACCESSIBLE))

#define ST_WIDGET_ACCESSIBLE_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), \
  ST_TYPE_WIDGET_ACCESSIBLE, StWidgetAccessibleClass))

typedef struct _StWidgetAccessible  StWidgetAccessible;
typedef struct _StWidgetAccessibleClass  StWidgetAccessibleClass;
typedef struct _StWidgetAccessiblePrivate  StWidgetAccessiblePrivate;

struct _StWidgetAccessible
{
  CallyActor parent;

  /*< private >*/
  StWidgetAccessiblePrivate *priv;
};

struct _StWidgetAccessibleClass
{
  CallyActorClass parent_class;
};

GType st_widget_accessible_get_type (void) G_GNUC_CONST;

G_END_DECLS

#endif /* __ST_WIDGET_ACCESSIBLE_H__ */
