/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-scroll-bar.h: Scroll bar actor
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

#ifndef __ST_SCROLL_BAR_H__
#define __ST_SCROLL_BAR_H__

#include "st-adjustment.h"
#include "st-widget.h"

G_BEGIN_DECLS

#define ST_TYPE_SCROLL_BAR            (st_scroll_bar_get_type())
#define ST_SCROLL_BAR(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_SCROLL_BAR, StScrollBar))
#define ST_IS_SCROLL_BAR(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_SCROLL_BAR))
#define ST_SCROLL_BAR_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_SCROLL_BAR, StScrollBarClass))
#define ST_IS_SCROLL_BAR_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_SCROLL_BAR))
#define ST_SCROLL_BAR_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_SCROLL_BAR, StScrollBarClass))

typedef struct _StScrollBar          StScrollBar;
typedef struct _StScrollBarPrivate   StScrollBarPrivate;
typedef struct _StScrollBarClass     StScrollBarClass;

/**
 * StScrollBar:
 *
 * The contents of this structure are private and should only be accessed
 * through the public API.
 */
struct _StScrollBar
{
  /*< private >*/
  StWidget parent_instance;

  StScrollBarPrivate *priv;
};

struct _StScrollBarClass
{
  StWidgetClass parent_class;

  /* signals */
  void (*scroll_start) (StScrollBar *bar);
  void (*scroll_stop)  (StScrollBar *bar);
};

GType st_scroll_bar_get_type (void) G_GNUC_CONST;

StWidget *st_scroll_bar_new (StAdjustment *adjustment);

void          st_scroll_bar_set_adjustment (StScrollBar  *bar,
                                            StAdjustment *adjustment);
StAdjustment *st_scroll_bar_get_adjustment (StScrollBar  *bar);

G_END_DECLS

#endif /* __ST_SCROLL_BAR_H__ */
