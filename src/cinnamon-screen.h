/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

/*
 * Copyright (C) 2008 Iain Holmes
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
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA
 * 02110-1335, USA.
 */

#ifndef CINNAMON_SCREEN_H
#define CINNAMON_SCREEN_H

#include <glib-object.h>
#include <meta/types.h>
#include <meta/workspace.h>
#include <meta/display.h>
#include <meta/meta-workspace-manager.h>

#define CINNAMON_TYPE_SCREEN (cinnamon_screen_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonScreen, cinnamon_screen, CINNAMON, SCREEN, GObject)

CinnamonScreen *cinnamon_screen_new (MetaDisplay *display);

MetaDisplay *cinnamon_screen_get_display (CinnamonScreen *screen);

void cinnamon_screen_get_size (CinnamonScreen *screen,
                           int        *width,
                           int        *height);

GList *cinnamon_screen_get_workspaces (CinnamonScreen *screen);

int cinnamon_screen_get_n_workspaces (CinnamonScreen *screen);

MetaWorkspace* cinnamon_screen_get_workspace_by_index (CinnamonScreen    *screen,
                                                   int            index);
void cinnamon_screen_remove_workspace (CinnamonScreen    *screen,
                                   MetaWorkspace *workspace,
                                   guint32        timestamp);

MetaWorkspace *cinnamon_screen_append_new_workspace (CinnamonScreen    *screen,
                                                 gboolean       activate,
                                                 guint32        timestamp);

int cinnamon_screen_get_active_workspace_index (CinnamonScreen *screen);

MetaWorkspace * cinnamon_screen_get_active_workspace (CinnamonScreen *screen);

void cinnamon_screen_show_desktop (CinnamonScreen *screen,
                                   guint32         timestamp);

void cinnamon_screen_toggle_desktop (CinnamonScreen *screen,
                                     guint32         timestamp);
                                
void cinnamon_screen_unshow_desktop (CinnamonScreen *screen);

int  cinnamon_screen_get_n_monitors       (CinnamonScreen    *screen);
int  cinnamon_screen_get_primary_monitor  (CinnamonScreen    *screen);
int  cinnamon_screen_get_current_monitor  (CinnamonScreen    *screen);
void cinnamon_screen_get_monitor_geometry (CinnamonScreen    *screen,
                                       int            monitor,
                                       MetaRectangle *geometry);

gboolean cinnamon_screen_get_monitor_in_fullscreen (CinnamonScreen  *screen,
                                                int          monitor);

int cinnamon_screen_get_monitor_index_for_rect (CinnamonScreen    *screen,
                                            MetaRectangle *rect);

MetaWindow* cinnamon_screen_get_mouse_window (CinnamonScreen *screen,
                                              MetaWindow *not_this_one);

void cinnamon_screen_override_workspace_layout (CinnamonScreen      *screen,
                                                MetaDisplayCorner starting_corner,
                                                gboolean         vertical_layout,
                                                int              n_rows,
                                                int              n_columns);

unsigned long cinnamon_screen_get_xwindow_for_window (CinnamonScreen *screen,
                                                      MetaWindow     *window);

#endif
