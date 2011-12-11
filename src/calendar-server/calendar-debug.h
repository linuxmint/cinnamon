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
 */

#ifndef __CALENDAR_DEBUG_H__
#define __CALENDAR_DEBUG_H__

#include <glib.h>

G_BEGIN_DECLS

#ifdef CALENDAR_ENABLE_DEBUG

#include <stdio.h>

#ifdef G_HAVE_ISO_VARARGS
#  define dprintf(...) fprintf (stderr, __VA_ARGS__);
#elif defined(G_HAVE_GNUC_VARARGS)
#  define dprintf(args...) fprintf (stderr, args);
#endif

#else /* if !defined (CALENDAR_DEBUG) */

#ifdef G_HAVE_ISO_VARARGS
#  define dprintf(...)
#elif defined(G_HAVE_GNUC_VARARGS)
#  define dprintf(args...)
#endif

#endif /* CALENDAR_ENABLE_DEBUG */

G_END_DECLS

#endif /* __CALENDAR_DEBUG_H__ */
