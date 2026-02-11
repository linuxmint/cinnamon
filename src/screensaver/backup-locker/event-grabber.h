/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2004-2006 William Jon McCann <mccann@jhu.edu>
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
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA 02110-1335, USA.
 *
 * Authors: William Jon McCann <mccann@jhu.edu>
 *
 */

#ifndef __CS_EVENT_GRABBER_H
#define __CS_EVENT_GRABBER_H

#include <glib.h>
#include <gdk/gdk.h>

G_BEGIN_DECLS

#define CS_TYPE_EVENT_GRABBER         (cs_event_grabber_get_type ())
G_DECLARE_FINAL_TYPE (CsEventGrabber, cs_event_grabber, CS, EVENT_GRABBER, GObject)

CsEventGrabber  * cs_event_grabber_new              (gboolean debug);

void      cs_event_grabber_release          (CsEventGrabber    *grab);
gboolean  cs_event_grabber_release_mouse    (CsEventGrabber    *grab);

gboolean  cs_event_grabber_grab_window      (CsEventGrabber    *grab,
                                    GdkWindow *window,
                                    GdkScreen *screen,
                                    gboolean   hide_cursor);

gboolean  cs_event_grabber_grab_root        (CsEventGrabber    *grab,
                                    gboolean   hide_cursor);
gboolean  cs_event_grabber_grab_offscreen   (CsEventGrabber    *grab,
                                    gboolean   hide_cursor);

void      cs_event_grabber_move_to_window   (CsEventGrabber    *grab,
                                    GdkWindow *window,
                                    GdkScreen *screen,
                                    gboolean   hide_cursor);

void      cs_event_grabber_mouse_reset      (CsEventGrabber    *grab);
void      cs_event_grabber_keyboard_reset   (CsEventGrabber    *grab);

G_END_DECLS

#endif /* __CS_EVENT_GRABBER_H */
