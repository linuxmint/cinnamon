/*
 * Copyright © 2011 Canonical Limited
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the licence, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 *
 * Author: Ryan Lortie <desrt@desrt.ca>
 */

#include "config.h"

#include "gactionmuxer.h"

#include "gactionobservable.h"
#include "gactionobserver.h"

#include <string.h>

/*
 * SECTION:gactionmuxer
 * @short_description: Aggregate and monitor several action groups
 *
 * #GActionMuxer is a #GActionGroup and #GActionObservable that is
 * capable of containing other #GActionGroup instances.
 *
 * The typical use is aggregating all of the actions applicable to a
 * particular context into a single action group, with namespacing.
 *
 * Consider the case of two action groups -- one containing actions
 * applicable to an entire application (such as 'quit') and one
 * containing actions applicable to a particular window in the
 * application (such as 'fullscreen').
 *
 * In this case, each of these action groups could be added to a
 * #GActionMuxer with the prefixes "app" and "win", respectively.  This
 * would expose the actions as "app.quit" and "win.fullscreen" on the
 * #GActionGroup interface presented by the #GActionMuxer.
 *
 * Activations and state change requests on the #GActionMuxer are wired
 * through to the underlying action group in the expected way.
 *
 * This class is typically only used at the site of "consumption" of
 * actions (eg: when displaying a menu that contains many actions on
 * different objects).
 */

static void     g_action_muxer_group_iface_init         (GActionGroupInterface      *iface);
static void     g_action_muxer_observable_iface_init    (GActionObservableInterface *iface);

typedef GObjectClass GActionMuxerClass;

struct _GActionMuxer
{
  GObject parent_instance;

  GHashTable *actions;
  GHashTable *groups;
};

G_DEFINE_TYPE_WITH_CODE (GActionMuxer, g_action_muxer, G_TYPE_OBJECT,
                         G_IMPLEMENT_INTERFACE (G_TYPE_ACTION_GROUP, g_action_muxer_group_iface_init)
                         G_IMPLEMENT_INTERFACE (G_TYPE_ACTION_OBSERVABLE, g_action_muxer_observable_iface_init))

typedef struct
{
  GActionMuxer *muxer;
  GSList       *watchers;
  gchar        *fullname;
} Action;

typedef struct
{
  GActionMuxer *muxer;
  GActionGroup *group;
  gchar        *prefix;
  gulong        handler_ids[4];
} Group;

static gchar **
g_action_muxer_list_actions (GActionGroup *action_group)
{
  GActionMuxer *muxer = G_ACTION_MUXER (action_group);

  return (gchar **) muxer->groups;
}

static Group *
g_action_muxer_find_group (GActionMuxer  *muxer,
                              const gchar     **name)
{
  const gchar *dot;
  gchar *prefix;
  Group *group;

  dot = strchr (*name, '.');

  if (!dot)
    return NULL;

  prefix = g_strndup (*name, dot - *name);
  group = g_hash_table_lookup (muxer->groups, prefix);
  g_free (prefix);

  *name = dot + 1;

  return group;
}

static Action *
g_action_muxer_lookup_action (GActionMuxer  *muxer,
                              const gchar   *prefix,
                              const gchar   *action_name,
                              gchar        **fullname)
{
  Action *action;

  *fullname = g_strconcat (prefix, ".", action_name, NULL);
  action = g_hash_table_lookup (muxer->actions, *fullname);

  return action;
}

static void
g_action_muxer_action_enabled_changed (GActionGroup *action_group,
                                       const gchar  *action_name,
                                       gboolean      enabled,
                                       gpointer      user_data)
{
  Group *group = user_data;
  gchar *fullname;
  Action *action;
  GSList *node;

  action = g_action_muxer_lookup_action (group->muxer, group->prefix, action_name, &fullname);
  for (node = action ? action->watchers : NULL; node; node = node->next)
    g_action_observer_action_enabled_changed (node->data, G_ACTION_OBSERVABLE (group->muxer), fullname, enabled);
  g_action_group_action_enabled_changed (G_ACTION_GROUP (group->muxer), fullname, enabled);
  g_free (fullname);
}

static void
g_action_muxer_action_state_changed (GActionGroup *action_group,
                                     const gchar  *action_name,
                                     GVariant     *state,
                                     gpointer      user_data)
{
  Group *group = user_data;
  gchar *fullname;
  Action *action;
  GSList *node;

  action = g_action_muxer_lookup_action (group->muxer, group->prefix, action_name, &fullname);
  for (node = action ? action->watchers : NULL; node; node = node->next)
    g_action_observer_action_state_changed (node->data, G_ACTION_OBSERVABLE (group->muxer), fullname, state);
  g_action_group_action_state_changed (G_ACTION_GROUP (group->muxer), fullname, state);
  g_free (fullname);
}

static void
g_action_muxer_action_added (GActionGroup *action_group,
                             const gchar  *action_name,
                             gpointer      user_data)
{
  const GVariantType *parameter_type;
  Group *group = user_data;
  gboolean enabled;
  GVariant *state;

  if (g_action_group_query_action (group->group, action_name, &enabled, &parameter_type, NULL, NULL, &state))
    {
      gchar *fullname;
      Action *action;
      GSList *node;

      action = g_action_muxer_lookup_action (group->muxer, group->prefix, action_name, &fullname);

      for (node = action ? action->watchers : NULL; node; node = node->next)
        g_action_observer_action_added (node->data,
                                        G_ACTION_OBSERVABLE (group->muxer),
                                        fullname, parameter_type, enabled, state);

      g_action_group_action_added (G_ACTION_GROUP (group->muxer), fullname);

      if (state)
        g_variant_unref (state);

      g_free (fullname);
    }
}

static void
g_action_muxer_action_removed (GActionGroup *action_group,
                               const gchar  *action_name,
                               gpointer      user_data)
{
  Group *group = user_data;
  gchar *fullname;
  Action *action;
  GSList *node;

  action = g_action_muxer_lookup_action (group->muxer, group->prefix, action_name, &fullname);
  for (node = action ? action->watchers : NULL; node; node = node->next)
    g_action_observer_action_removed (node->data, G_ACTION_OBSERVABLE (group->muxer), fullname);
  g_action_group_action_removed (G_ACTION_GROUP (group->muxer), fullname);
  g_free (fullname);
}

static gboolean
g_action_muxer_query_action (GActionGroup        *action_group,
                             const gchar         *action_name,
                             gboolean            *enabled,
                             const GVariantType **parameter_type,
                             const GVariantType **state_type,
                             GVariant           **state_hint,
                             GVariant           **state)
{
  GActionMuxer *muxer = G_ACTION_MUXER (action_group);
  Group *group;

  group = g_action_muxer_find_group (muxer, &action_name);

  if (!group)
    return FALSE;

  return g_action_group_query_action (group->group, action_name, enabled,
                                      parameter_type, state_type, state_hint, state);
}

static void
g_action_muxer_activate_action (GActionGroup *action_group,
                                const gchar  *action_name,
                                GVariant     *parameter)
{
  GActionMuxer *muxer = G_ACTION_MUXER (action_group);
  Group *group;

  group = g_action_muxer_find_group (muxer, &action_name);

  if (group)
    g_action_group_activate_action (group->group, action_name, parameter);
}

static void
g_action_muxer_change_action_state (GActionGroup *action_group,
                                    const gchar  *action_name,
                                    GVariant     *state)
{
  GActionMuxer *muxer = G_ACTION_MUXER (action_group);
  Group *group;

  group = g_action_muxer_find_group (muxer, &action_name);

  if (group)
    g_action_group_change_action_state (group->group, action_name, state);
}

static void
g_action_muxer_unregister_internal (Action   *action,
                                    gpointer  observer)
{
  GActionMuxer *muxer = action->muxer;
  GSList **ptr;

  for (ptr = &action->watchers; *ptr; ptr = &(*ptr)->next)
    if ((*ptr)->data == observer)
      {
        *ptr = g_slist_remove (*ptr, observer);

        if (action->watchers == NULL)
          {
            g_hash_table_remove (muxer->actions, action->fullname);
            g_free (action->fullname);

            g_slice_free (Action, action);

            g_object_unref (muxer);
          }

        break;
      }
}

static void
g_action_muxer_weak_notify (gpointer  data,
                            GObject  *where_the_object_was)
{
  Action *action = data;

  g_action_muxer_unregister_internal (action, where_the_object_was);
}

static void
g_action_muxer_register_observer (GActionObservable *observable,
                                  const gchar       *name,
                                  GActionObserver   *observer)
{
  GActionMuxer *muxer = G_ACTION_MUXER (observable);
  Action *action;

  action = g_hash_table_lookup (muxer->actions, name);

  if (action == NULL)
    {
      action = g_slice_new (Action);
      action->muxer = g_object_ref (muxer);
      action->fullname = g_strdup (name);
      action->watchers = NULL;

      g_hash_table_insert (muxer->actions, action->fullname, action);
    }

  action->watchers = g_slist_prepend (action->watchers, observer);
  g_object_weak_ref (G_OBJECT (observer), g_action_muxer_weak_notify, action);
}

static void
g_action_muxer_unregister_observer (GActionObservable *observable,
                                    const gchar       *name,
                                    GActionObserver   *observer)
{
  GActionMuxer *muxer = G_ACTION_MUXER (observable);
  Action *action;

  action = g_hash_table_lookup (muxer->actions, name);
  g_object_weak_unref (G_OBJECT (observer), g_action_muxer_weak_notify, action);
  g_action_muxer_unregister_internal (action, observer);
}

static void
g_action_muxer_free_group (gpointer data)
{
  Group *group = data;

  g_object_unref (group->group);
  g_free (group->prefix);

  g_slice_free (Group, group);
}

static void
g_action_muxer_finalize (GObject *object)
{
  GActionMuxer *muxer = G_ACTION_MUXER (object);

  g_assert_cmpint (g_hash_table_size (muxer->actions), ==, 0);
  g_hash_table_unref (muxer->actions);
  g_hash_table_unref (muxer->groups);

  G_OBJECT_CLASS (g_action_muxer_parent_class)
    ->finalize (object);
}

static void
g_action_muxer_init (GActionMuxer *muxer)
{
  muxer->actions = g_hash_table_new (g_str_hash, g_str_equal);
  muxer->groups = g_hash_table_new_full (g_str_hash, g_str_equal, NULL, g_action_muxer_free_group);
}

static void
g_action_muxer_observable_iface_init (GActionObservableInterface *iface)
{
  iface->register_observer = g_action_muxer_register_observer;
  iface->unregister_observer = g_action_muxer_unregister_observer;
}

static void
g_action_muxer_group_iface_init (GActionGroupInterface *iface)
{
  iface->list_actions = g_action_muxer_list_actions;
  iface->query_action = g_action_muxer_query_action;
  iface->activate_action = g_action_muxer_activate_action;
  iface->change_action_state = g_action_muxer_change_action_state;
}

static void
g_action_muxer_class_init (GObjectClass *class)
{
  class->finalize = g_action_muxer_finalize;
}

/*
 * g_action_muxer_insert:
 * @muxer: a #GActionMuxer
 * @prefix: the prefix string for the action group
 * @action_group: a #GActionGroup
 *
 * Adds the actions in @action_group to the list of actions provided by
 * @muxer.  @prefix is prefixed to each action name, such that for each
 * action <varname>x</varname> in @action_group, there is an equivalent
 * action @prefix<literal>.</literal><varname>x</varname> in @muxer.
 *
 * For example, if @prefix is "<literal>app</literal>" and @action_group
 * contains an action called "<literal>quit</literal>", then @muxer will
 * now contain an action called "<literal>app.quit</literal>".
 *
 * If any #GActionObservers are registered for actions in the group,
 * "action_added" notifications will be emitted, as appropriate.
 *
 * @prefix must not contain a dot ('.').
 */
void
g_action_muxer_insert (GActionMuxer *muxer,
                       const gchar  *prefix,
                       GActionGroup *action_group)
{
  gchar **actions;
  Group *group;
  gint i;

  /* TODO: diff instead of ripout and replace */
  g_action_muxer_remove (muxer, prefix);

  group = g_slice_new (Group);
  group->muxer = muxer;
  group->group = g_object_ref (action_group);
  group->prefix = g_strdup (prefix);

  g_hash_table_insert (muxer->groups, group->prefix, group);

  actions = g_action_group_list_actions (group->group);
  for (i = 0; actions[i]; i++)
    g_action_muxer_action_added (group->group, actions[i], group);
  g_strfreev (actions);

  group->handler_ids[0] = g_signal_connect (group->group, "action-added",
                                            G_CALLBACK (g_action_muxer_action_added), group);
  group->handler_ids[1] = g_signal_connect (group->group, "action-removed",
                                            G_CALLBACK (g_action_muxer_action_removed), group);
  group->handler_ids[2] = g_signal_connect (group->group, "action-enabled-changed",
                                            G_CALLBACK (g_action_muxer_action_enabled_changed), group);
  group->handler_ids[3] = g_signal_connect (group->group, "action-state-changed",
                                            G_CALLBACK (g_action_muxer_action_state_changed), group);
}

/*
 * g_action_muxer_remove:
 * @muxer: a #GActionMuxer
 * @prefix: the prefix of the action group to remove
 *
 * Removes a #GActionGroup from the #GActionMuxer.
 *
 * If any #GActionObservers are registered for actions in the group,
 * "action_removed" notifications will be emitted, as appropriate.
 */
void
g_action_muxer_remove (GActionMuxer *muxer,
                       const gchar  *prefix)
{
  Group *group;

  group = g_hash_table_lookup (muxer->groups, prefix);

  if (group != NULL)
    {
      gchar **actions;
      gint i;

      g_hash_table_steal (muxer->groups, prefix);

      actions = g_action_group_list_actions (group->group);
      for (i = 0; actions[i]; i++)
        g_action_muxer_action_removed (group->group, actions[i], group);
      g_strfreev (actions);

      /* 'for loop' or 'four loop'? */
      for (i = 0; i < 4; i++)
        g_signal_handler_disconnect (group->group, group->handler_ids[i]);

      g_action_muxer_free_group (group);
    }
}

/*
 * g_action_muxer_new:
 *
 * Creates a new #GActionMuxer.
 */
GActionMuxer *
g_action_muxer_new (void)
{
  return g_object_new (G_TYPE_ACTION_MUXER, NULL);
}