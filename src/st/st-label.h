/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-label.h: Plain label actor
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

#ifndef __ST_LABEL_H__
#define __ST_LABEL_H__

G_BEGIN_DECLS

#include "st-widget.h"

#define ST_TYPE_LABEL                (st_label_get_type ())
#define ST_LABEL(obj)                (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_LABEL, StLabel))
#define ST_IS_LABEL(obj)             (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_LABEL))
#define ST_LABEL_CLASS(klass)        (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_LABEL, StLabelClass))
#define ST_IS_LABEL_CLASS(klass)     (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_LABEL))
#define ST_LABEL_GET_CLASS(obj)      (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_LABEL, StLabelClass))

typedef struct _StLabel              StLabel;
typedef struct _StLabelPrivate       StLabelPrivate;
typedef struct _StLabelClass         StLabelClass;

/**
 * StLabel:
 *
 * The contents of this structure is private and should only be accessed using
 * the provided API.
 */
struct _StLabel
{
  /*< private >*/
  StWidget parent_instance;

  StLabelPrivate *priv;
};

struct _StLabelClass
{
  StWidgetClass parent_class;
};

GType st_label_get_type (void) G_GNUC_CONST;

StWidget *     st_label_new              (const gchar *text);
const gchar *  st_label_get_text         (StLabel     *label);
void           st_label_set_text         (StLabel     *label,
                                          const gchar *text);
ClutterActor * st_label_get_clutter_text (StLabel     *label);

G_END_DECLS

#endif /* __ST_LABEL_H__ */
