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

#include "config.h"

#include "gtkactionobservable.h"

G_DEFINE_INTERFACE (GtkActionObservable, gtk_action_observable, G_TYPE_OBJECT)

/*
 * SECTION:gtkactionobserable
 * @short_description: an interface implemented by objects that report
 *                     changes to actions
 */

void
gtk_action_observable_default_init (GtkActionObservableInterface *iface)
{
}

/**
 * gtk_action_observable_register_observer:
 * @observable: a #GtkActionObservable
 * @action_name: the name of the action
 * @observer: the #GtkActionObserver to which the events will be reported
 *
 * Registers @observer as being interested in changes to @action_name on
 * @observable.
 */
void
gtk_action_observable_register_observer (GtkActionObservable *observable,
                                         const gchar         *action_name,
                                         GtkActionObserver   *observer)
{
  g_return_if_fail (GTK_IS_ACTION_OBSERVABLE (observable));

  GTK_ACTION_OBSERVABLE_GET_IFACE (observable)
    ->register_observer (observable, action_name, observer);
}

/**
 * gtk_action_observable_unregister_observer:
 * @observable: a #GtkActionObservable
 * @action_name: the name of the action
 * @observer: the #GtkActionObserver to which the events will be reported
 *
 * Removes the registration of @observer as being interested in changes
 * to @action_name on @observable.
 *
 * If the observer was registered multiple times, it must be
 * unregistered an equal number of times.
 */
void
gtk_action_observable_unregister_observer (GtkActionObservable *observable,
                                           const gchar         *action_name,
                                           GtkActionObserver   *observer)
{
  g_return_if_fail (GTK_IS_ACTION_OBSERVABLE (observable));

  GTK_ACTION_OBSERVABLE_GET_IFACE (observable)
    ->unregister_observer (observable, action_name, observer);
}