/*
 * Copyright © 2011 Canonical Limited
 *
 * This program is free software: you can redistribute it and/or modify
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
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307,
 * USA.
 *
 * Authors: Ryan Lortie <desrt@desrt.ca>
 */

#ifndef __G_ACTION_OBSERVER_H__
#define __G_ACTION_OBSERVER_H__

#include <gio/gio.h>

G_BEGIN_DECLS

#define G_TYPE_ACTION_OBSERVER                              (g_action_observer_get_type ())
#define G_ACTION_OBSERVER(inst)                             (G_TYPE_CHECK_INSTANCE_CAST ((inst),                     \
                                                             G_TYPE_ACTION_OBSERVER, GActionObserver))
#define G_IS_ACTION_OBSERVER(inst)                          (G_TYPE_CHECK_INSTANCE_TYPE ((inst),                     \
                                                             G_TYPE_ACTION_OBSERVER))
#define G_ACTION_OBSERVER_GET_IFACE(inst)                   (G_TYPE_INSTANCE_GET_INTERFACE ((inst),                  \
                                                             G_TYPE_ACTION_OBSERVER, GActionObserverInterface))

typedef struct _GActionObserverInterface                    GActionObserverInterface;
typedef struct _GActionObservable                           GActionObservable;
typedef struct _GActionObserver                             GActionObserver;

struct _GActionObserverInterface
{
  GTypeInterface g_iface;

  void (* action_added)           (GActionObserver    *observer,
                                   GActionObservable  *observable,
                                   const gchar        *action_name,
                                   const GVariantType *parameter_type,
                                   gboolean            enabled,
                                   GVariant           *state);
  void (* action_enabled_changed) (GActionObserver    *observer,
                                   GActionObservable  *observable,
                                   const gchar        *action_name,
                                   gboolean            enabled);
  void (* action_state_changed)   (GActionObserver    *observer,
                                   GActionObservable  *observable,
                                   const gchar        *action_name,
                                   GVariant           *state);
  void (* action_removed)         (GActionObserver    *observer,
                                   GActionObservable  *observable,
                                   const gchar        *action_name);
};

G_GNUC_INTERNAL
GType                   g_action_observer_get_type                      (void);
G_GNUC_INTERNAL
void                    g_action_observer_action_added                  (GActionObserver    *observer,
                                                                         GActionObservable  *observable,
                                                                         const gchar        *action_name,
                                                                         const GVariantType *parameter_type,
                                                                         gboolean            enabled,
                                                                         GVariant           *state);
G_GNUC_INTERNAL
void                    g_action_observer_action_enabled_changed        (GActionObserver    *observer,
                                                                         GActionObservable  *observable,
                                                                         const gchar        *action_name,
                                                                         gboolean            enabled);
G_GNUC_INTERNAL
void                    g_action_observer_action_state_changed          (GActionObserver    *observer,
                                                                         GActionObservable  *observable,
                                                                         const gchar        *action_name,
                                                                         GVariant           *state);
G_GNUC_INTERNAL
void                    g_action_observer_action_removed                (GActionObserver    *observer,
                                                                         GActionObservable  *observable,
                                                                         const gchar        *action_name);

G_END_DECLS

#endif /* __G_ACTION_OBSERVER_H__ */