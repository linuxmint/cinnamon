/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-group.h: A fixed layout container based on ClutterGroup
 *
 * Copyright 2010 Florian Müllner
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

#ifndef __ST_GROUP_H__
#define __ST_GROUP_H__

#include <st/st-types.h>
#include <st/st-widget.h>

G_BEGIN_DECLS

#define ST_TYPE_GROUP                   (st_group_get_type ())
#define ST_GROUP(obj)                   (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_GROUP, StGroup))
#define ST_IS_GROUP(obj)                (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_GROUP))
#define ST_GROUP_CLASS(klass)           (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_GROUP, StGroupClass))
#define ST_IS_GROUP_CLASS(klass)        (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_GROUP))
#define ST_GROUP_GET_CLASS(obj)         (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_GROUP, StGroupClass))

typedef struct _StGroup                 StGroup;
typedef struct _StGroupPrivate          StGroupPrivate;
typedef struct _StGroupClass            StGroupClass;

/**
 * StGroup:
 *
 * The #StGroup struct contains only private data
 */
struct _StGroup
{
  /*< private >*/
  StWidget parent_instance;
};

/**
 * StGroupClass:
 *
 * The #StGroupClass struct contains only private data
 */
struct _StGroupClass
{
  /*< private >*/
  StWidgetClass parent_class;
};

GType         st_group_get_type        (void) G_GNUC_CONST;
StWidget     *st_group_new              (void);

G_END_DECLS

#endif /* __ST_GROUP_H__ */
