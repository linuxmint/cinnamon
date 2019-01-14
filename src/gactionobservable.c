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

#include "config.h"

#include "gactionobservable.h"

G_DEFINE_INTERFACE (GActionObservable, g_action_observable, G_TYPE_OBJECT)

/*
 * SECTION:gactionobserable
 * @short_description: an interface implemented by objects that report
 *                     changes to actions
 */

void
g_action_observable_default_init (GActionObservableInterface *iface)
{
}

/*
 * g_action_observable_register_observer:
 * @observable: a #GActionObservable
 * @action_name: the name of the action
 * @observer: the #GActionObserver to which the events will be reported
 *
 * Registers @observer as being interested in changes to @action_name on
 * @observable.
 */
void
g_action_observable_register_observer (GActionObservable *observable,
                                       const gchar       *action_name,
                                       GActionObserver   *observer)
{
  g_return_if_fail (G_IS_ACTION_OBSERVABLE (observable));

  G_ACTION_OBSERVABLE_GET_IFACE (observable)
    ->register_observer (observable, action_name, observer);
}

/*
 * g_action_observable_unregister_observer:
 * @observable: a #GActionObservable
 * @action_name: the name of the action
 * @observer: the #GActionObserver to which the events will be reported
 *
 * Removes the registration of @observer as being interested in changes
 * to @action_name on @observable.
 *
 * If the observer was registered multiple times, it must be
 * unregistered an equal number of times.
 */
void
g_action_observable_unregister_observer (GActionObservable *observable,
                                         const gchar       *action_name,
                                         GActionObserver   *observer)
{
  g_return_if_fail (G_IS_ACTION_OBSERVABLE (observable));

  G_ACTION_OBSERVABLE_GET_IFACE (observable)
    ->unregister_observer (observable, action_name, observer);
}