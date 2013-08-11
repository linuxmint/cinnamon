/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-adjustment.h: Adjustment object
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

#ifndef __ST_ADJUSTMENT_H__
#define __ST_ADJUSTMENT_H__

#include <glib-object.h>
#include <clutter/clutter.h>

G_BEGIN_DECLS

#define ST_TYPE_ADJUSTMENT            (st_adjustment_get_type())
#define ST_ADJUSTMENT(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_ADJUSTMENT, StAdjustment))
#define ST_IS_ADJUSTMENT(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_ADJUSTMENT))
#define ST_ADJUSTMENT_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_ADJUSTMENT, StAdjustmentClass))
#define ST_IS_ADJUSTMENT_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_ADJUSTMENT))
#define ST_ADJUSTMENT_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_ADJUSTMENT, StAdjustmentClass))

typedef struct _StAdjustment          StAdjustment;
typedef struct _StAdjustmentPrivate   StAdjustmentPrivate;
typedef struct _StAdjustmentClass     StAdjustmentClass;

/**
 * StAdjustment:
 *
 * Class for handling an interval between to values. The contents of
 * the #StAdjustment are private and should be accessed using the
 * public API.
 */
struct _StAdjustment
{
  /*< private >*/
  GObject parent_instance;

  StAdjustmentPrivate *priv;
};

/**
 * StAdjustmentClass:
 * @changed: Class handler for the ::changed signal.
 *
 * Base class for #StAdjustment.
 */
struct _StAdjustmentClass
{
  /*< private >*/
  GObjectClass parent_class;

  /*< public >*/
  void (* changed) (StAdjustment *adjustment);
};

GType st_adjustment_get_type (void) G_GNUC_CONST;

StAdjustment *st_adjustment_new         (gdouble       value,
                                         gdouble       lower,
                                         gdouble       upper,
                                         gdouble       step_increment,
                                         gdouble       page_increment,
                                         gdouble       page_size);
gdouble       st_adjustment_get_value   (StAdjustment *adjustment);
void          st_adjustment_set_value   (StAdjustment *adjustment,
                                         gdouble       value);
void          st_adjustment_clamp_page  (StAdjustment *adjustment,
                                         gdouble       lower,
                                         gdouble       upper);
void          st_adjustment_set_values  (StAdjustment *adjustment,
                                         gdouble       value,
                                         gdouble       lower,
                                         gdouble       upper,
                                         gdouble       step_increment,
                                         gdouble       page_increment,
                                         gdouble       page_size);
void          st_adjustment_get_values  (StAdjustment *adjustment,
                                         gdouble      *value,
                                         gdouble      *lower,
                                         gdouble      *upper,
                                         gdouble      *step_increment,
                                         gdouble      *page_increment,
                                         gdouble      *page_size);
G_END_DECLS

#endif /* __ST_ADJUSTMENT_H__ */
