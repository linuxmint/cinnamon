/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-entry.h: Plain entry actor
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

#ifndef __ST_ENTRY_H__
#define __ST_ENTRY_H__

G_BEGIN_DECLS

#include "st-widget.h"

#define ST_TYPE_ENTRY                (st_entry_get_type ())
#define ST_ENTRY(obj)                (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_ENTRY, StEntry))
#define ST_IS_ENTRY(obj)             (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_ENTRY))
#define ST_ENTRY_CLASS(klass)        (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_ENTRY, StEntryClass))
#define ST_IS_ENTRY_CLASS(klass)     (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_ENTRY))
#define ST_ENTRY_GET_CLASS(obj)      (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_ENTRY, StEntryClass))

typedef struct _StEntry              StEntry;
typedef struct _StEntryPrivate       StEntryPrivate;
typedef struct _StEntryClass         StEntryClass;

/**
 * StEntry:
 *
 * The contents of this structure is private and should only be accessed using
 * the provided API.
 */
struct _StEntry
{
  /*< private >*/
  StWidget parent_instance;

  StEntryPrivate *priv;
};

struct _StEntryClass
{
  StWidgetClass parent_class;

  /* signals */
  void (*primary_icon_clicked)   (StEntry *entry);
  void (*secondary_icon_clicked) (StEntry *entry);
};

GType st_entry_get_type (void) G_GNUC_CONST;

StWidget *            st_entry_new              (const gchar *text);
const gchar *         st_entry_get_text         (StEntry     *entry);
void                  st_entry_set_text         (StEntry     *entry,
                                                 const gchar *text);
ClutterActor*         st_entry_get_clutter_text (StEntry     *entry);

void                  st_entry_set_hint_text    (StEntry     *entry,
                                                 const gchar *text);
const gchar *         st_entry_get_hint_text    (StEntry     *entry);

void st_entry_set_primary_icon             (StEntry      *entry,
                                            ClutterActor *icon);
void st_entry_set_secondary_icon           (StEntry      *entry,
                                            ClutterActor *icon);
void st_entry_set_primary_icon_from_file   (StEntry     *entry,
                                            const gchar *filename);
void st_entry_set_secondary_icon_from_file (StEntry     *entry,
                                            const gchar *filename);

G_END_DECLS

#endif /* __ST_ENTRY_H__ */
