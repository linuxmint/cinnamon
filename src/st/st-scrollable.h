/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-scrollable.h: Scrollable interface
 *
 * Copyright 2008 OpenedHand
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

#if !defined(ST_H_INSIDE) && !defined(ST_COMPILATION)
#error "Only <st/st.h> can be included directly.h"
#endif

#ifndef __ST_SCROLLABLE_H__
#define __ST_SCROLLABLE_H__

#include <glib-object.h>
#include "st-adjustment.h"

G_BEGIN_DECLS

#define ST_TYPE_SCROLLABLE                (st_scrollable_get_type ())
#define ST_SCROLLABLE(obj)                (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_SCROLLABLE, StScrollable))
#define ST_IS_SCROLLABLE(obj)             (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_SCROLLABLE))
#define ST_SCROLLABLE_GET_INTERFACE(inst) (G_TYPE_INSTANCE_GET_INTERFACE ((inst), ST_TYPE_SCROLLABLE, StScrollableInterface))

typedef struct _StScrollable StScrollable; /* Dummy object */
typedef struct _StScrollableInterface StScrollableInterface;

struct _StScrollableInterface
{
  GTypeInterface parent;

  void (* set_adjustments) (StScrollable  *scrollable,
                            StAdjustment  *hadjustment,
                            StAdjustment  *vadjustment);
  void (* get_adjustments) (StScrollable  *scrollable,
                            StAdjustment **hadjustment,
                            StAdjustment **vadjustment);
};

GType st_scrollable_get_type (void) G_GNUC_CONST;

void st_scrollable_set_adjustments (StScrollable  *scrollable,
                                    StAdjustment  *hadjustment,
                                    StAdjustment  *vadjustment);
void st_scrollable_get_adjustments (StScrollable  *scrollable,
                                    StAdjustment **hadjustment,
                                    StAdjustment **vadjustment);

G_END_DECLS

#endif /* __ST_SCROLLABLE_H__ */
