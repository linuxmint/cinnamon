/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-box-layout.h: box layout actor
 *
 * Copyright 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
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

#ifndef _ST_BOX_LAYOUT_H
#define _ST_BOX_LAYOUT_H

#include "st-widget.h"

G_BEGIN_DECLS

#define ST_TYPE_BOX_LAYOUT st_box_layout_get_type()

#define ST_BOX_LAYOUT(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), \
  ST_TYPE_BOX_LAYOUT, StBoxLayout))

#define ST_BOX_LAYOUT_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), \
  ST_TYPE_BOX_LAYOUT, StBoxLayoutClass))

#define ST_IS_BOX_LAYOUT(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), \
  ST_TYPE_BOX_LAYOUT))

#define ST_IS_BOX_LAYOUT_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), \
  ST_TYPE_BOX_LAYOUT))

#define ST_BOX_LAYOUT_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), \
  ST_TYPE_BOX_LAYOUT, StBoxLayoutClass))

typedef struct _StBoxLayout StBoxLayout;
typedef struct _StBoxLayoutClass StBoxLayoutClass;
typedef struct _StBoxLayoutPrivate StBoxLayoutPrivate;

/**
 * StBoxLayout:
 *
 * The contents of this structure are private and should only be accessed
 * through the public API.
 */
struct _StBoxLayout
{
  /*< private >*/
  StWidget parent;

  StBoxLayoutPrivate *priv;
};

struct _StBoxLayoutClass
{
  StWidgetClass parent_class;
};

GType st_box_layout_get_type (void);

StWidget *st_box_layout_new (void);

void     st_box_layout_set_vertical   (StBoxLayout *box,
                                       gboolean     vertical);
gboolean st_box_layout_get_vertical   (StBoxLayout *box);

void     st_box_layout_set_pack_start (StBoxLayout *box,
                                       gboolean     pack_start);
gboolean st_box_layout_get_pack_start (StBoxLayout *box);

void     st_box_layout_insert_actor (StBoxLayout  *self,
                                     ClutterActor *actor,
                                     int           pos);

void     st_box_layout_insert_before (StBoxLayout  *self,
                                      ClutterActor *actor,
                                      ClutterActor *sibling);

G_END_DECLS

#endif /* _ST_BOX_LAYOUT_H */
