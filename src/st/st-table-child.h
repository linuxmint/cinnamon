/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-table-child.h: Table child implementation
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

#ifndef __ST_TABLE_CHILD_H__
#define __ST_TABLE_CHILD_H__

#include "st-types.h"
#include "st-widget.h"
#include "st-table.h"
#include <clutter/clutter.h>

G_BEGIN_DECLS

#define ST_TYPE_TABLE_CHILD          (st_table_child_get_type ())
#define ST_TABLE_CHILD(obj)          (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_TABLE_CHILD, StTableChild))
#define ST_IS_TABLE_CHILD(obj)       (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_TABLE_CHILD))
#define ST_TABLE_CHILD_CLASS(klass)        (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_TABLE_CHILD, StTableChildClass))
#define ST_IS_TABLE_CHILD_CLASS(klass)     (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_TABLE_CHILD))
#define ST_TABLE_CHILD_GET_CLASS(obj)      (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_TABLE_CHILD, StTableChildClass))

typedef struct _StTableChild         StTableChild;
typedef struct _StTableChildClass    StTableChildClass;

/**
 * StTableChild:
 *
 * The contents of the this structure are private and should only be accessed
 * through the public API.
 */
struct _StTableChild
{
  /*< private >*/
  ClutterChildMeta parent_instance;

  gint col;
  gint row;
  gint col_span;
  gint row_span;
  StAlign x_align;
  StAlign y_align;
  guint allocate_hidden : 1;
  guint x_expand : 1;
  guint y_expand : 1;
  guint x_fill : 1;
  guint y_fill : 1;
};


struct _StTableChildClass
{
  ClutterChildMetaClass parent_class;
};

GType st_table_child_get_type (void) G_GNUC_CONST;

gint     st_table_child_get_col_span        (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_col_span        (StTable      *table,
                                             ClutterActor *child,
                                             gint          span);
gint     st_table_child_get_row_span        (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_row_span        (StTable      *table,
                                             ClutterActor *child,
                                             gint          span);
gboolean st_table_child_get_x_fill          (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_x_fill          (StTable      *table,
                                             ClutterActor *child,
                                             gboolean      fill);
gboolean st_table_child_get_y_fill          (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_y_fill          (StTable      *table,
                                             ClutterActor *child,
                                             gboolean      fill);
gboolean st_table_child_get_x_expand        (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_x_expand        (StTable      *table,
                                             ClutterActor *child,
                                             gboolean      expand);
gboolean st_table_child_get_y_expand        (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_y_expand        (StTable      *table,
                                             ClutterActor *child,
                                             gboolean      expand);
StAlign  st_table_child_get_x_align         (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_x_align         (StTable      *table,
                                             ClutterActor *child,
                                             StAlign       align);
StAlign  st_table_child_get_y_align         (StTable      *table,
                                             ClutterActor *child);
void     st_table_child_set_y_align         (StTable      *table,
                                             ClutterActor *child,
                                             StAlign       align);
void     st_table_child_set_allocate_hidden (StTable      *table,
                                             ClutterActor *child,
                                             gboolean      value);
gboolean st_table_child_get_allocate_hidden (StTable      *table,
                                             ClutterActor *child);

G_END_DECLS

#endif /* __ST_TABLE_H__ */
