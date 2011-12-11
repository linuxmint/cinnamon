/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-overflow-box.h: A vertical box which paints as many actors as it can fit
 *
 * Copyright 2009 Red Hat, Inc.
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

#ifndef _ST_OVERFLOW_BOX_H
#define _ST_OVERFLOW_BOX_H

#include <st/st-box-layout.h>

G_BEGIN_DECLS

#define ST_TYPE_OVERFLOW_BOX st_overflow_box_get_type()

#define ST_OVERFLOW_BOX(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_OVERFLOW_BOX, StOverflowBox))
#define ST_OVERFLOW_BOX_CLASS(klass) (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_OVERFLOW_BOX, StOverflowBoxClass))
#define ST_IS_OVERFLOW_BOX(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_OVERFLOW_BOX))
#define ST_IS_OVERFLOW_BOX_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_OVERFLOW_BOX))
#define ST_OVERFLOW_BOX_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_OVERFLOW_BOX, StOverflowBoxClass))

typedef struct _StOverflowBox StOverflowBox;
typedef struct _StOverflowBoxClass StOverflowBoxClass;
typedef struct _StOverflowBoxPrivate StOverflowBoxPrivate;

/**
 * StOverflowBox:
 *
 * The contents of this structure are private and should only be accessed
 * through the public API.
 */
struct _StOverflowBox
{
  /*< private >*/
  StContainer parent;

  StOverflowBoxPrivate *priv;
};

struct _StOverflowBoxClass
{
  StContainerClass parent_class;
};

GType    st_overflow_box_get_type         (void);

void     st_overflow_box_set_min_children (StOverflowBox *self,  guint min_children);
guint    st_overflow_box_get_n_children   (StOverflowBox *box);
guint    st_overflow_box_get_n_visible    (StOverflowBox *box);
gboolean st_overflow_box_get_min_children (StOverflowBox *box);

G_END_DECLS

#endif /* _ST_OVERFLOW_BOX_H */
