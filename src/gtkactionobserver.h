/*
 * Copyright © 2011 Canonical Limited
 *
 * This library is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * licence or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library. If not, see <http://www.gnu.org/licenses/>.
 *
 * Authors: Ryan Lortie <desrt@desrt.ca>
 */

#ifndef __GTK_ACTION_OBSERVER_H__
#define __GTK_ACTION_OBSERVER_H__

#include <gio/gio.h>

G_BEGIN_DECLS

#define GTK_TYPE_ACTION_OBSERVER                            (gtk_action_observer_get_type ())
#define GTK_ACTION_OBSERVER(inst)                           (G_TYPE_CHECK_INSTANCE_CAST ((inst),                     \
                                                             GTK_TYPE_ACTION_OBSERVER, GtkActionObserver))
#define GTK_IS_ACTION_OBSERVER(inst)                        (G_TYPE_CHECK_INSTANCE_TYPE ((inst),                     \
                                                             GTK_TYPE_ACTION_OBSERVER))
#define GTK_ACTION_OBSERVER_GET_IFACE(inst)                 (G_TYPE_INSTANCE_GET_INTERFACE ((inst),                  \
                                                             GTK_TYPE_ACTION_OBSERVER, GtkActionObserverInterface))

typedef struct _GtkActionObserverInterface                  GtkActionObserverInterface;
typedef struct _GtkActionObservable                         GtkActionObservable;
typedef struct _GtkActionObserver                           GtkActionObserver;

struct _GtkActionObserverInterface
{
  GTypeInterface g_iface;

  void (* action_added)           (GtkActionObserver    *observer,
                                   GtkActionObservable  *observable,
                                   const gchar          *action_name,
                                   const GVariantType   *parameter_type,
                                   gboolean              enabled,
                                   GVariant             *state);
  void (* action_enabled_changed) (GtkActionObserver    *observer,
                                   GtkActionObservable  *observable,
                                   const gchar          *action_name,
                                   gboolean              enabled);
  void (* action_state_changed)   (GtkActionObserver    *observer,
                                   GtkActionObservable  *observable,
                                   const gchar          *action_name,
                                   GVariant             *state);
  void (* action_removed)         (GtkActionObserver    *observer,
                                   GtkActionObservable  *observable,
                                   const gchar          *action_name);
};

GType                   gtk_action_observer_get_type                    (void);
void                    gtk_action_observer_action_added                (GtkActionObserver   *observer,
                                                                         GtkActionObservable *observable,
                                                                         const gchar         *action_name,
                                                                         const GVariantType  *parameter_type,
                                                                         gboolean             enabled,
                                                                         GVariant            *state);
void                    gtk_action_observer_action_enabled_changed      (GtkActionObserver   *observer,
                                                                         GtkActionObservable *observable,
                                                                         const gchar         *action_name,
                                                                         gboolean             enabled);
void                    gtk_action_observer_action_state_changed        (GtkActionObserver   *observer,
                                                                         GtkActionObservable *observable,
                                                                         const gchar         *action_name,
                                                                         GVariant            *state);
void                    gtk_action_observer_action_removed              (GtkActionObserver   *observer,
                                                                         GtkActionObservable *observable,
                                                                         const gchar         *action_name);

G_END_DECLS

#endif /* __GTK_ACTION_OBSERVER_H__ */