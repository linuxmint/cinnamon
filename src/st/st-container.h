/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-container.h: Base class for St container actors
 *
 * Copyright 2007 OpenedHand
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

#ifndef __ST_CONTAINER_H__
#define __ST_CONTAINER_H__

#include <st/st-widget.h>

G_BEGIN_DECLS

#define ST_TYPE_CONTAINER            (st_container_get_type ())
#define ST_CONTAINER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj),        ST_TYPE_CONTAINER, StContainer))
#define ST_IS_CONTAINER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj),        ST_TYPE_CONTAINER))
#define ST_CONTAINER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),         ST_TYPE_CONTAINER, StContainerClass))
#define ST_IS_CONTAINER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),         ST_TYPE_CONTAINER))
#define ST_CONTAINER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),         ST_TYPE_CONTAINER, StContainerClass))

typedef struct _StContainer        StContainer;
typedef struct _StContainerClass   StContainerClass;
typedef struct _StContainerPrivate StContainerPrivate;

struct _StContainer {
  StWidget parent;
  StContainerPrivate *priv;
};

struct _StContainerClass {
  StWidgetClass parent_class;
};

GType   st_container_get_type             (void) G_GNUC_CONST;

void    st_container_destroy_children     (StContainer *container);

/* Only to be used by subclasses of StContainer */
void    st_container_move_child           (StContainer  *container,
                                           ClutterActor *actor,
                                           int           pos);
void    st_container_move_before          (StContainer  *container,
                                           ClutterActor *actor,
                                           ClutterActor *sibling);
GList * st_container_get_children_list    (StContainer *container);

G_END_DECLS

#endif /* __ST_CONTAINER_H__ */
