/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-widget.h: Base class for St actors
 *
 * Copyright 2007 OpenedHand
 * Copyright 2008, 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2009 Abderrahim Kitouni
 * Copyright 2010 Florian Müllner
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

#ifndef __ST_WIDGET_H__
#define __ST_WIDGET_H__

#include <clutter/clutter.h>
#include "st-types.h"
#include "st-theme.h"
#include "st-theme-node.h"

G_BEGIN_DECLS

typedef enum {
  ST_TEXT_DIRECTION_NONE,
  ST_TEXT_DIRECTION_LTR,
  ST_TEXT_DIRECTION_RTL
} StTextDirection;

#define ST_TYPE_WIDGET                 (st_widget_get_type ())
#define ST_WIDGET(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), ST_TYPE_WIDGET, StWidget))
#define ST_IS_WIDGET(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), ST_TYPE_WIDGET))
#define ST_WIDGET_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), ST_TYPE_WIDGET, StWidgetClass))
#define ST_IS_WIDGET_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), ST_TYPE_WIDGET))
#define ST_WIDGET_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), ST_TYPE_WIDGET, StWidgetClass))

typedef struct _StWidget               StWidget;
typedef struct _StWidgetPrivate        StWidgetPrivate;
typedef struct _StWidgetClass          StWidgetClass;

/**
 * StWidget:
 *
 * Base class for stylable actors. The contents of the #StWidget
 * structure are private and should only be accessed through the
 * public API.
 */
struct _StWidget
{
  /*< private >*/
  ClutterActor parent_instance;

  StWidgetPrivate *priv;
};

/**
 * StWidgetClass:
 *
 * Base class for stylable actors.
 */
struct _StWidgetClass
{
  /*< private >*/
  ClutterActorClass parent_class;

  /* signals */
  void     (* style_changed)       (StWidget         *self);
  void     (* popup_menu)          (StWidget         *self);

  /* vfuncs */

  /**
   * StWidgetClass::navigate_focus
   * @self: the "top level" container
   * @from: (allow-none): the actor that the focus is coming from
   * @direction: the direction focus is moving in
   */
  gboolean (* navigate_focus)      (StWidget         *self,
                                    ClutterActor     *from,
                                    GtkDirectionType  direction);
  GType    (* get_accessible_type) (void);

  GList *  (* get_focus_chain)     (StWidget         *widget);
};

GType st_widget_get_type (void) G_GNUC_CONST;

void                  st_widget_set_style_pseudo_class    (StWidget        *actor,
                                                           const gchar     *pseudo_class_list);
void                  st_widget_change_style_pseudo_class (StWidget        *actor,
                                                           const gchar     *pseudo_class,
                                                           gboolean         add);
void                  st_widget_add_style_pseudo_class    (StWidget        *actor,
                                                           const gchar     *pseudo_class);
void                  st_widget_remove_style_pseudo_class (StWidget        *actor,
                                                           const gchar     *pseudo_class);
const gchar *         st_widget_get_style_pseudo_class    (StWidget        *actor);
gboolean              st_widget_has_style_pseudo_class    (StWidget        *actor,
                                                           const gchar     *pseudo_class);

void                  st_widget_set_style_class_name      (StWidget        *actor,
                                                           const gchar     *style_class_list);
void                  st_widget_add_style_class_name      (StWidget        *actor,
                                                           const gchar     *style_class);
void                  st_widget_remove_style_class_name   (StWidget        *actor,
                                                           const gchar     *style_class);
const gchar *         st_widget_get_style_class_name      (StWidget        *actor);
gboolean              st_widget_has_style_class_name      (StWidget        *actor,
                                                           const gchar     *style_class);

void                  st_widget_set_style                 (StWidget        *actor,
                                                           const gchar     *style);
const gchar *         st_widget_get_style                 (StWidget        *actor);

void                  st_widget_set_important             (StWidget *actor,
                                                           gboolean  important);
gboolean              st_widget_get_important             (StWidget        *actor);

void                  st_widget_set_theme                 (StWidget        *actor,
                                                           StTheme         *theme);
StTheme *             st_widget_get_theme                 (StWidget        *actor);

void                  st_widget_set_track_hover           (StWidget        *widget,
                                                           gboolean         track_hover);
gboolean              st_widget_get_track_hover           (StWidget        *widget);
void                  st_widget_set_hover                 (StWidget        *widget,
                                                           gboolean         hover);
void                  st_widget_sync_hover                (StWidget        *widget);
gboolean              st_widget_get_hover                 (StWidget        *widget);
void                  st_widget_popup_menu                (StWidget        *self);

void                  st_widget_ensure_style              (StWidget        *widget);

StTextDirection       st_widget_get_default_direction     (void);
void                  st_widget_set_default_direction     (StTextDirection  dir);

StTextDirection       st_widget_get_direction             (StWidget        *self);
void                  st_widget_set_direction             (StWidget        *self,
                                                           StTextDirection  dir);

void                  st_widget_set_can_focus             (StWidget        *widget,
                                                           gboolean         can_focus);
gboolean              st_widget_get_can_focus             (StWidget        *widget);
gboolean              st_widget_navigate_focus            (StWidget        *widget,
                                                           ClutterActor    *from,
                                                           GtkDirectionType direction,
                                                           gboolean         wrap_around);

ClutterActor *        st_widget_get_label_actor           (StWidget        *widget);
void                  st_widget_set_label_actor           (StWidget        *widget,
                                                           ClutterActor    *label);

/* Only to be used by sub-classes of StWidget */
void                  st_widget_style_changed             (StWidget        *widget);
StThemeNode *         st_widget_get_theme_node            (StWidget        *widget);
StThemeNode *         st_widget_peek_theme_node           (StWidget        *widget);

GList *               st_widget_get_focus_chain           (StWidget        *widget);
void                  st_widget_paint_background          (StWidget        *widget);

/* debug methods */
char  *st_describe_actor       (ClutterActor *actor);
void   st_set_slow_down_factor (gfloat factor);
gfloat st_get_slow_down_factor (void);

/* Compatibility methods */
void  st_widget_destroy_children (StWidget     *widget);
void  st_widget_move_child       (StWidget     *widget,
                                  ClutterActor *actor,
                                  int           pos);
void st_widget_move_before       (StWidget     *widget,
                                  ClutterActor *actor,
                                  ClutterActor *sibling);

/* accessibility methods */
void                  st_widget_set_accessible_role       (StWidget *widget,
                                                           AtkRole role);
AtkRole               st_widget_get_accessible_role       (StWidget *widget);
void                  st_widget_add_accessible_state      (StWidget *widget,
                                                           AtkStateType state);
void                  st_widget_remove_accessible_state   (StWidget *widget,
                                                           AtkStateType state);
void                  st_widget_set_accessible_name       (StWidget *widget,
                                                           const gchar *name);
const gchar *         st_widget_get_accessible_name       (StWidget *widget);

void                  st_widget_set_accessible           (StWidget    *widget,
                                                          AtkObject   *accessible);

G_END_DECLS

#endif /* __ST_WIDGET_H__ */
