/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * shell-jsapi-compat.h: Compatibility wrapper for older Spidermonkey
 *
 * Copyright 2010 Red Hat, Inc.
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
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St - Fifth Floor, Boston, MA 02110-1301 USA.
 * Boston, MA 02111-1307, USA.
 *
 */

#ifndef __SHELL_JSAPI_COMPAT_H__
#define __SHELL_JSAPI_COMPAT_H__

#include "config.h"

#ifndef HAVE_JS_NEWGLOBALOBJECT

/* The old JS_AddRoot accepted anything via void *, new
 * api is stricter.
 */
#define JS_AddValueRoot JS_AddRoot
#define JS_AddObjectRoot JS_AddRoot
#define JS_AddStringRoot JS_AddRoot
#define JS_AddGCThingRoot JS_AddRoot
#define JS_RemoveValueRoot JS_RemoveRoot
#define JS_RemoveObjectRoot JS_RemoveRoot
#define JS_RemoveStringRoot JS_RemoveRoot
#define JS_RemoveGCThingRoot JS_RemoveRoot

#endif

#endif
