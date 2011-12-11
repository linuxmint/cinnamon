/*
 * Copyright (C) 2004 Free Software Foundation, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 * Authors:
 *     Mark McLoughlin  <mark@skynet.ie>
 *     William Jon McCann  <mccann@jhu.edu>
 *     Martin Grimme  <martin@pycage.de>
 *     Christian Kellner  <gicmo@xatom.net>
 */

#ifndef __CALENDAR_SOURCES_H__
#define __CALENDAR_SOURCES_H__

#include <glib-object.h>

G_BEGIN_DECLS

#define CALENDAR_TYPE_SOURCES        (calendar_sources_get_type ())
#define CALENDAR_SOURCES(o)          (G_TYPE_CHECK_INSTANCE_CAST ((o), CALENDAR_TYPE_SOURCES, CalendarSources))
#define CALENDAR_SOURCES_CLASS(k)    (G_TYPE_CHECK_CLASS_CAST ((k), CALENDAR_TYPE_SOURCES, CalendarSourcesClass))
#define CALENDAR_IS_SOURCES(o)       (G_TYPE_CHECK_INSTANCE_TYPE ((o), CALENDAR_TYPE_SOURCES))
#define CALENDAR_IS_SOURCES_CLASS(k) (G_TYPE_CHECK_CLASS_TYPE ((k), CALENDAR_TYPE_SOURCES))
#define CALENDAR_SOURCES_GET_CLASS(o)(G_TYPE_INSTANCE_GET_CLASS ((o), CALENDAR_TYPE_SOURCES, CalendarSourcesClass))

typedef struct _CalendarSources        CalendarSources;
typedef struct _CalendarSourcesClass   CalendarSourcesClass;
typedef struct _CalendarSourcesPrivate CalendarSourcesPrivate;

struct _CalendarSources
{
  GObject                 parent;
  CalendarSourcesPrivate *priv;
};

struct _CalendarSourcesClass
{
  GObjectClass    parent_class;

  void         (* appointment_sources_changed) (CalendarSources *sources);
  void         (* task_sources_changed)        (CalendarSources *sources);
};


GType            calendar_sources_get_type                (void) G_GNUC_CONST;
CalendarSources *calendar_sources_get                     (void);
GSList          *calendar_sources_get_appointment_sources (CalendarSources *sources);
GSList          *calendar_sources_get_task_sources        (CalendarSources *sources);

G_END_DECLS

#endif /* __CALENDAR_SOURCES_H__ */
