/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-bin.h: Basic container actor
 *
 * Copyright 2009, 2008 Intel Corporation.
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

#ifndef __ST_BIN_H__
#define __ST_BIN_H__

#include "st-types.h"
#include "st-widget.h"

G_BEGIN_DECLS

#define ST_TYPE_BIN                   (st_bin_get_type ())
#define ST_BIN(obj)                   (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_BIN, StBin))
#define ST_IS_BIN(obj)                (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_BIN))
#define ST_BIN_CLASS(klass)           (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_BIN, StBinClass))
#define ST_IS_BIN_CLASS(klass)        (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_BIN))
#define ST_BIN_GET_CLASS(obj)         (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_BIN, StBinClass))

typedef struct _StBin                 StBin;
typedef struct _StBinPrivate          StBinPrivate;
typedef struct _StBinClass            StBinClass;

/**
 * StBin:
 *
 * The #StBin struct contains only private data
 */
struct _StBin
{
  /*< private >*/
  StWidget parent_instance;

  StBinPrivate *priv;
};

/**
 * StBinClass:
 *
 * The #StBinClass struct contains only private data
 */
struct _StBinClass
{
  /*< private >*/
  StWidgetClass parent_class;
};

GType st_bin_get_type (void) G_GNUC_CONST;

StWidget   *  st_bin_new           (void);
void          st_bin_set_child     (StBin        *bin,
                                    ClutterActor *child);
ClutterActor *st_bin_get_child     (StBin        *bin);
void          st_bin_set_alignment (StBin        *bin,
                                    StAlign       x_align,
                                    StAlign       y_align);
void          st_bin_get_alignment (StBin        *bin,
                                    StAlign      *x_align,
                                    StAlign      *y_align);
void          st_bin_set_fill      (StBin        *bin,
                                    gboolean      x_fill,
                                    gboolean      y_fill);
void          st_bin_get_fill      (StBin        *bin,
                                    gboolean     *x_fill,
                                    gboolean     *y_fill);

G_END_DECLS

#endif /* __ST_BIN_H__ */
