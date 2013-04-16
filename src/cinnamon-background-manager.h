/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2007 William Jon McCann <mccann@jhu.edu>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 *
 */

#ifndef __CINNAMON_BACKGROUND_MANAGER_H
#define __CINNAMON_BACKGROUND_MANAGER_H

#include <glib-object.h>

G_BEGIN_DECLS

#define CINNAMON_TYPE_BACKGROUND_MANAGER         (cinnamon_background_manager_get_type ())
#define CINNAMON_BACKGROUND_MANAGER(o)           (G_TYPE_CHECK_INSTANCE_CAST ((o), CINNAMON_TYPE_BACKGROUND_MANAGER, CinnamonBackgroundManager))
#define CINNAMON_BACKGROUND_MANAGER_CLASS(k)     (G_TYPE_CHECK_CLASS_CAST((k), CINNAMON_TYPE_BACKGROUND_MANAGER, CinnamonBackgroundManagerClass))
#define CINNAMON_IS_BACKGROUND_MANAGER(o)        (G_TYPE_CHECK_INSTANCE_TYPE ((o), CINNAMON_TYPE_BACKGROUND_MANAGER))
#define CINNAMON_IS_BACKGROUND_MANAGER_CLASS(k)  (G_TYPE_CHECK_CLASS_TYPE ((k), CINNAMON_TYPE_BACKGROUND_MANAGER))
#define CINNAMON_BACKGROUND_MANAGER_GET_CLASS(o) (G_TYPE_INSTANCE_GET_CLASS ((o), CINNAMON_TYPE_BACKGROUND_MANAGER, CinnamonBackgroundManagerClass))

typedef struct CinnamonBackgroundManagerPrivate CinnamonBackgroundManagerPrivate;

typedef struct
{
        GObject                     parent;
        CinnamonBackgroundManagerPrivate *priv;
} CinnamonBackgroundManager;

typedef struct
{
        GObjectClass   parent_class;
} CinnamonBackgroundManagerClass;

GType                   cinnamon_background_manager_get_type            (void);

CinnamonBackgroundManager *cinnamon_background_manager_get_default (void);

gboolean                cinnamon_background_manager_start               (CinnamonBackgroundManager *manager);
void                    cinnamon_background_manager_stop                (CinnamonBackgroundManager *manager);

G_END_DECLS

#endif /* __CINNAMON_BACKGROUND_MANAGER_H */
