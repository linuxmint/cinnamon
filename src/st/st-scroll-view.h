/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-scroll-view.h: Container with scroll-bars
 *
 * Copyright 2008 OpenedHand
 * Copyright 2009 Intel Corporation.
 * Copyright 2010 Red Hat, Inc.
 * Copyright 2010 Maxim Ermilov
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

#ifndef __ST_SCROLL_VIEW_H__
#define __ST_SCROLL_VIEW_H__

#include "st-bin.h"

G_BEGIN_DECLS

#define ST_TYPE_SCROLL_VIEW            (st_scroll_view_get_type())
#define ST_SCROLL_VIEW(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_SCROLL_VIEW, StScrollView))
#define ST_IS_SCROLL_VIEW(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_SCROLL_VIEW))
#define ST_SCROLL_VIEW_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_SCROLL_VIEW, StScrollViewClass))
#define ST_IS_SCROLL_VIEW_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_SCROLL_VIEW))
#define ST_SCROLL_VIEW_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_SCROLL_VIEW, StScrollViewClass))

typedef struct _StScrollView          StScrollView;
typedef struct _StScrollViewPrivate   StScrollViewPrivate;
typedef struct _StScrollViewClass     StScrollViewClass;

/**
 * StScrollView:
 *
 * The contents of this structure are private and should only be accessed
 * through the public API.
 */
struct _StScrollView
{
  /*< private >*/
  StBin parent_instance;

  StScrollViewPrivate *priv;
};

struct _StScrollViewClass
{
  StBinClass parent_class;
};

GType st_scroll_view_get_type (void) G_GNUC_CONST;

StWidget *st_scroll_view_new (void);

ClutterActor *st_scroll_view_get_hscroll_bar     (StScrollView *scroll);
ClutterActor *st_scroll_view_get_vscroll_bar     (StScrollView *scroll);

gfloat        st_scroll_view_get_column_size     (StScrollView *scroll);
void          st_scroll_view_set_column_size     (StScrollView *scroll,
                                                  gfloat        column_size);

gfloat        st_scroll_view_get_row_size        (StScrollView *scroll);
void          st_scroll_view_set_row_size        (StScrollView *scroll,
                                                  gfloat        row_size);

void          st_scroll_view_set_mouse_scrolling (StScrollView *scroll,
                                                  gboolean      enabled);
gboolean      st_scroll_view_get_mouse_scrolling (StScrollView *scroll);

void          st_scroll_view_set_auto_scrolling (StScrollView *scroll,
                                                  gboolean      enabled);
gboolean      st_scroll_view_get_auto_scrolling (StScrollView *scroll);

void          st_scroll_view_set_policy          (StScrollView   *scroll,
                                                  GtkPolicyType   hscroll,
                                                  GtkPolicyType   vscroll);

G_END_DECLS

#endif /* __ST_SCROLL_VIEW_H__ */
