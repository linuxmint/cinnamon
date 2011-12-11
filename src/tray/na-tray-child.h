/* -*- Mode: C; tab-width: 8; indent-tabs-mode: t; c-basic-offset: 8 -*- */
/* na-tray-child.h
 * Copyright (C) 2002 Anders Carlsson <andersca@gnu.org>
 * Copyright (C) 2003-2006 Vincent Untz
 * Copyright (C) 2008 Red Hat, Inc.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 */

#ifndef __NA_TRAY_CHILD_H__
#define __NA_TRAY_CHILD_H__

#include <gtk/gtk.h>
#include <gtk/gtkx.h>

G_BEGIN_DECLS

#define NA_TYPE_TRAY_CHILD		(na_tray_child_get_type ())
#define NA_TRAY_CHILD(obj)		(G_TYPE_CHECK_INSTANCE_CAST ((obj), NA_TYPE_TRAY_CHILD, NaTrayChild))
#define NA_TRAY_CHILD_CLASS(klass)	(G_TYPE_CHECK_CLASS_CAST ((klass), NA_TYPE_TRAY_CHILD, NaTrayChildClass))
#define NA_IS_TRAY_CHILD(obj)		(G_TYPE_CHECK_INSTANCE_TYPE ((obj), NA_TYPE_TRAY_CHILD))
#define NA_IS_TRAY_CHILD_CLASS(klass)	(G_TYPE_CHECK_CLASS_TYPE ((klass), NA_TYPE_TRAY_CHILD))
#define NA_TRAY_CHILD_GET_CLASS(obj)	(G_TYPE_INSTANCE_GET_CLASS ((obj), NA_TYPE_TRAY_CHILD, NaTrayChildClass))

typedef struct _NaTrayChild	  NaTrayChild;
typedef struct _NaTrayChildClass  NaTrayChildClass;
typedef struct _NaTrayChildChild  NaTrayChildChild;

struct _NaTrayChild
{
  GtkSocket parent_instance;
  Window icon_window;
  guint has_alpha : 1;
  guint composited : 1;
  guint parent_relative_bg : 1;
};

struct _NaTrayChildClass
{
  GtkSocketClass parent_class;
};

GType           na_tray_child_get_type        (void);

GtkWidget      *na_tray_child_new            (GdkScreen    *screen,
                                              Window        icon_window);
char           *na_tray_child_get_title      (NaTrayChild  *child);
gboolean        na_tray_child_has_alpha      (NaTrayChild  *child);
void            na_tray_child_set_composited (NaTrayChild  *child,
                                              gboolean      composited);
void            na_tray_child_force_redraw   (NaTrayChild  *child);
void            na_tray_child_get_wm_class   (NaTrayChild  *child,
					      char        **res_name,
					      char        **res_class);

G_END_DECLS

#endif /* __NA_TRAY_CHILD_H__ */
