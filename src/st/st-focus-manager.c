/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-focus-manager.c: Keyboard focus manager
 *
 * Copyright 2010 Red Hat, Inc.
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

/**
 * SECTION:st-focus-manager
 * @short_description: Keyboard focus management
 *
 * #StFocusManager handles keyboard focus for all actors on the stage.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <clutter/clutter.h>

#include "st-focus-manager.h"

#define ST_FOCUS_MANAGER_GET_PRIVATE(obj) (G_TYPE_INSTANCE_GET_PRIVATE ((obj), ST_TYPE_FOCUS_MANAGER, StFocusManagerPrivate))

struct _StFocusManagerPrivate
{
  GHashTable *groups;
};

G_DEFINE_TYPE (StFocusManager, st_focus_manager, G_TYPE_OBJECT)

static void
st_focus_manager_dispose (GObject *object)
{
  StFocusManager *manager = ST_FOCUS_MANAGER (object);

  if (manager->priv->groups)
    {
      g_hash_table_destroy (manager->priv->groups);
      manager->priv->groups = NULL;
    }

  G_OBJECT_CLASS (st_focus_manager_parent_class)->dispose (object);
}

static void
st_focus_manager_class_init (StFocusManagerClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  g_type_class_add_private (klass, sizeof (StFocusManagerPrivate));

  object_class->dispose = st_focus_manager_dispose;
}

static void
st_focus_manager_init (StFocusManager *manager)
{
  manager->priv = ST_FOCUS_MANAGER_GET_PRIVATE (manager);
  manager->priv->groups = g_hash_table_new (NULL, NULL);
}

static gboolean
st_focus_manager_stage_event (ClutterActor *stage,
			      ClutterEvent *event,
			      gpointer      user_data)
{
  StFocusManager *manager = user_data;
  GtkDirectionType direction;
  gboolean wrap_around = FALSE;
  ClutterActor *focused, *group;

  if (event->type != CLUTTER_KEY_PRESS)
    return FALSE;

  switch (event->key.keyval)
    {
    case CLUTTER_KEY_Up:
      direction = GTK_DIR_UP;
      break;
    case CLUTTER_KEY_Down:
      direction = GTK_DIR_DOWN;
      break;
    case CLUTTER_KEY_Left:
      direction = GTK_DIR_LEFT;
      break;
    case CLUTTER_KEY_Right:
      direction = GTK_DIR_RIGHT;
      break;
    case CLUTTER_KEY_Tab:
      if (event->key.modifier_state & CLUTTER_SHIFT_MASK)
        direction = GTK_DIR_TAB_BACKWARD;
      else
        direction = GTK_DIR_TAB_FORWARD;
      wrap_around = TRUE;
      break;
    case CLUTTER_KEY_ISO_Left_Tab:
      direction = GTK_DIR_TAB_BACKWARD;
      wrap_around = TRUE;
      break;

    default:
      return FALSE;
    }

  focused = clutter_stage_get_key_focus (CLUTTER_STAGE (stage));
  if (!focused)
    return FALSE;

  for (group = focused; group != stage; group = clutter_actor_get_parent (group))
    {
      if (g_hash_table_lookup (manager->priv->groups, group))
        {
          return st_widget_navigate_focus (ST_WIDGET (group), focused,
                                           direction, wrap_around);
        }
    }
  return FALSE;
}

/**
 * st_focus_manager_get_for_stage:
 * @stage: a #ClutterStage
 *
 * Gets the #StFocusManager for @stage, creating it if necessary.
 *
 * Return value: (transfer none): the focus manager for @stage
 */
StFocusManager *
st_focus_manager_get_for_stage (ClutterStage *stage)
{
  StFocusManager *manager;

  manager = g_object_get_data (G_OBJECT (stage), "st-focus-manager");
  if (!manager)
    {
      manager = g_object_new (ST_TYPE_FOCUS_MANAGER, NULL);
      g_object_set_data_full (G_OBJECT (stage), "st-focus-manager",
			      manager, g_object_unref);

      g_signal_connect (stage, "event",
			G_CALLBACK (st_focus_manager_stage_event), manager);
    }

  return manager;
}

static void
remove_destroyed_group (ClutterActor *actor,
                        gpointer      user_data)
{
  StFocusManager *manager = user_data;

  st_focus_manager_remove_group (manager, ST_WIDGET (actor));
}

/**
 * st_focus_manager_add_group:
 * @manager: the #StFocusManager
 * @root: the root container of the group
 *
 * Adds a new focus group to @manager. When the focus is in an actor
 * that is a descendant of @root, @manager will handle moving focus
 * from one actor to another within @root based on keyboard events.
 */
void
st_focus_manager_add_group (StFocusManager *manager,
                            StWidget       *root)
{
  g_signal_connect (root, "destroy",
                    G_CALLBACK (remove_destroyed_group),
                    manager);
  g_hash_table_insert (manager->priv->groups, root, GINT_TO_POINTER (1));
}

/**
 * st_focus_manager_remove_group:
 * @manager: the #StFocusManager
 * @root: the root container of the group
 *
 * Removes the group rooted at @root from @manager
 */
void
st_focus_manager_remove_group (StFocusManager *manager,
                               StWidget       *root)
{
  g_hash_table_remove (manager->priv->groups, root);
}

/**
 * st_focus_manager_get_group:
 * @manager: the #StFocusManager
 * @widget: an #StWidget
 *
 * Checks if @widget is inside a focus group, and if so, returns
 * the root of that group.
 *
 * Return value: (transfer none): the focus group root, or %NULL if
 * @widget is not in a focus group
 */
StWidget *
st_focus_manager_get_group (StFocusManager *manager,
                            StWidget       *widget)
{
  ClutterActor *actor = CLUTTER_ACTOR (widget);

  while (actor && !g_hash_table_lookup (manager->priv->groups, actor))
    actor = clutter_actor_get_parent (actor);

  return ST_WIDGET (actor);
}
