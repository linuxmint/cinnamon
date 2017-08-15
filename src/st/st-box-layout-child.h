/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-box-layout-child.h: box layout child actor
 *
 * Copyright 2009 Intel Corporation
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

#ifndef _ST_BOX_LAYOUT_CHILD_H
#define _ST_BOX_LAYOUT_CHILD_H

#include <clutter/clutter.h>
#include "st-enum-types.h"
#include "st-box-layout.h"

G_BEGIN_DECLS

#define ST_TYPE_BOX_LAYOUT_CHILD st_box_layout_child_get_type()

#define ST_BOX_LAYOUT_CHILD(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), \
  ST_TYPE_BOX_LAYOUT_CHILD, StBoxLayoutChild))

#define ST_BOX_LAYOUT_CHILD_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), \
  ST_TYPE_BOX_LAYOUT_CHILD, StBoxLayoutChildClass))

#define ST_IS_BOX_LAYOUT_CHILD(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), \
  ST_TYPE_BOX_LAYOUT_CHILD))

#define ST_IS_BOX_LAYOUT_CHILD_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), \
  ST_TYPE_BOX_LAYOUT_CHILD))

#define ST_BOX_LAYOUT_CHILD_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), \
  ST_TYPE_BOX_LAYOUT_CHILD, StBoxLayoutChildClass))

typedef struct _StBoxLayoutChild StBoxLayoutChild;
typedef struct _StBoxLayoutChildClass StBoxLayoutChildClass;
typedef struct _StBoxLayoutChildPrivate StBoxLayoutChildPrivate;

/**
 * StBoxLayoutChild:
 *
 * The contents of this structure are private and should only be accessed
 * through the public API.
 */
struct _StBoxLayoutChild
{
  /*< private >*/
  ClutterChildMeta parent;

  gboolean x_fill_set;
  gboolean y_fill_set;
};

struct _StBoxLayoutChildClass
{
  ClutterChildMetaClass parent_class;
};

GType st_box_layout_child_get_type (void);

G_END_DECLS

#endif /* _ST_BOX_LAYOUT_CHILD_H */
