/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-theme-private.h: Private StThemeMethods
 *
 * Copyright 2008, 2009 Red Hat, Inc.
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

#ifndef __ST_THEME_PRIVATE_H__
#define __ST_THEME_PRIVATE_H__

#include <libcroco/libcroco.h>
#include "st-theme.h"

G_BEGIN_DECLS

GPtrArray *_st_theme_get_matched_properties (StTheme       *theme,
                                             StThemeNode   *node);

/* Resolve an URL from the stylesheet to a filename */
char *_st_theme_resolve_url (StTheme      *theme,
                             CRStyleSheet *base_stylesheet,
                             const char   *url);

CRDeclaration *_st_theme_parse_declaration_list (const char *str);

G_END_DECLS

#endif /* __ST_THEME_PRIVATE_H__ */
