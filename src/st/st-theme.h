/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-theme.h: A set of CSS stylesheets used for rule matching
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
#ifndef __ST_THEME_H__
#define __ST_THEME_H__

#include <glib-object.h>

#include "st-theme-node.h"

G_BEGIN_DECLS

/**
 * SECTION:StTheme
 * @short_description: a set of stylesheets
 *
 * #StTheme holds a set of stylesheets. (The "cascade" of the name
 * Cascading Stylesheets.) A #StTheme can be set to apply to all the actors
 * in a stage using st_theme_context_set_theme() or applied to a subtree
 * of actors using st_widget_set_theme().
 */

typedef struct _StThemeClass StThemeClass;

#define ST_TYPE_THEME              (st_theme_get_type ())
#define ST_THEME(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), ST_TYPE_THEME, StTheme))
#define ST_THEME_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_THEME, StThemeClass))
#define ST_IS_THEME(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), ST_TYPE_THEME))
#define ST_IS_THEME_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_THEME))
#define ST_THEME_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_THEME, StThemeClass))

GType  st_theme_get_type (void) G_GNUC_CONST;

StTheme *st_theme_new (const char *application_stylesheet,
                       const char *theme_stylesheet,
                       const char *default_stylesheet);

gboolean  st_theme_load_stylesheet        (StTheme *theme, const char *path, GError **error);
void      st_theme_unload_stylesheet      (StTheme *theme, const char *path);
GSList   *st_theme_get_custom_stylesheets (StTheme *theme);

G_END_DECLS

#endif /* __ST_THEME_H__ */
