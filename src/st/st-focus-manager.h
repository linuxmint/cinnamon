/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-focus-manager.h: Keyboard focus manager
 *
 * Copyright 2010 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 2.1 of
 * the License, or (at your option) any later version.
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

#ifndef __ST_FOCUS_MANAGER_H__
#define __ST_FOCUS_MANAGER_H__

#include "st-types.h"
#include "st-widget.h"

G_BEGIN_DECLS

#define ST_TYPE_FOCUS_MANAGER                   (st_focus_manager_get_type ())
#define ST_FOCUS_MANAGER(obj)                   (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_FOCUS_MANAGER, StFocusManager))
#define ST_IS_FOCUS_MANAGER(obj)                (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_FOCUS_MANAGER))
#define ST_FOCUS_MANAGER_CLASS(klass)           (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_FOCUS_MANAGER, StFocusManagerClass))
#define ST_IS_FOCUS_MANAGER_CLASS(klass)        (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_FOCUS_MANAGER))
#define ST_FOCUS_MANAGER_GET_CLASS(obj)         (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_FOCUS_MANAGER, StFocusManagerClass))

typedef struct _StFocusManager                 StFocusManager;
typedef struct _StFocusManagerPrivate          StFocusManagerPrivate;
typedef struct _StFocusManagerClass            StFocusManagerClass;

/**
 * StFocusManager:
 *
 * The #StFocusManager struct contains only private data
 */
struct _StFocusManager
{
  /*< private >*/
  GObject parent_instance;

  StFocusManagerPrivate *priv;
};

/**
 * StFocusManagerClass:
 *
 * The #StFocusManagerClass struct contains only private data
 */
struct _StFocusManagerClass
{
  /*< private >*/
  GObjectClass parent_class;
};

GType st_focus_manager_get_type (void) G_GNUC_CONST;

StFocusManager *st_focus_manager_get_for_stage (ClutterStage *stage);

void            st_focus_manager_add_group     (StFocusManager *manager,
                                                StWidget       *root);
void            st_focus_manager_remove_group  (StFocusManager *manager,
                                                StWidget       *root);
StWidget       *st_focus_manager_get_group     (StFocusManager *manager,
                                                StWidget       *widget);

G_END_DECLS

#endif /* __ST_FOCUS_MANAGER_H__ */
