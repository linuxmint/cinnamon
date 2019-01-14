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

#ifndef __G_ACTION_OBSERVABLE_H__
#define __G_ACTION_OBSERVABLE_H__

#include "gactionobserver.h"

G_BEGIN_DECLS

#define G_TYPE_ACTION_OBSERVABLE                            (g_action_observable_get_type ())
#define G_ACTION_OBSERVABLE(inst)                           (G_TYPE_CHECK_INSTANCE_CAST ((inst),                     \
                                                             G_TYPE_ACTION_OBSERVABLE, GActionObservable))
#define G_IS_ACTION_OBSERVABLE(inst)                        (G_TYPE_CHECK_INSTANCE_TYPE ((inst),                     \
                                                             G_TYPE_ACTION_OBSERVABLE))
#define G_ACTION_OBSERVABLE_GET_IFACE(inst)                 (G_TYPE_INSTANCE_GET_INTERFACE ((inst),                  \
                                                             G_TYPE_ACTION_OBSERVABLE, GActionObservableInterface))

typedef struct _GActionObservableInterface                  GActionObservableInterface;

struct _GActionObservableInterface
{
  GTypeInterface g_iface;

  void (* register_observer)   (GActionObservable *observable,
                                const gchar       *action_name,
                                GActionObserver   *observer);
  void (* unregister_observer) (GActionObservable *observable,
                                const gchar       *action_name,
                                GActionObserver   *observer);
};

G_GNUC_INTERNAL
GType                   g_action_observable_get_type                    (void);
G_GNUC_INTERNAL
void                    g_action_observable_register_observer           (GActionObservable  *observable,
                                                                         const gchar        *action_name,
                                                                         GActionObserver    *observer);
G_GNUC_INTERNAL
void                    g_action_observable_unregister_observer         (GActionObservable  *observable,
                                                                         const gchar        *action_name,
                                                                         GActionObserver    *observer);

G_END_DECLS

#endif /* __G_ACTION_OBSERVABLE_H__ */