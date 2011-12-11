/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Copyright (C) 2011 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

#include "shell-mount-operation.h"

/* This is a dummy class; we would like to be able to subclass the
 * object from JS but we can't yet; the default GMountOperation impl
 * automatically calls g_mount_operation_reply(UNHANDLED) after an idle,
 * in interactive methods. We want to handle the reply outselves
 * instead, so we just override the default methods with empty ones,
 * except for ask-password, as we don't want to handle that.
 *
 * Also, we need to workaround the fact that gjs doesn't support type
 * annotations for signals yet (so we can't effectively forward e.g. 
 * the GPid array to JS).
 * See https://bugzilla.gnome.org/show_bug.cgi?id=645978
 */
G_DEFINE_TYPE (ShellMountOperation, shell_mount_operation, G_TYPE_MOUNT_OPERATION);

enum {
  SHOW_PROCESSES_2,
  NUM_SIGNALS
};

static guint signals[NUM_SIGNALS] = { 0, };

struct _ShellMountOperationPrivate {
  GArray *pids;
  gchar **choices;
  gchar *message;
};

static void
shell_mount_operation_init (ShellMountOperation *self)
{
  self->priv = G_TYPE_INSTANCE_GET_PRIVATE (self, SHELL_TYPE_MOUNT_OPERATION,
                                            ShellMountOperationPrivate);
}

static void
shell_mount_operation_ask_password (GMountOperation   *op,
                                    const char        *message,
                                    const char        *default_user,
                                    const char        *default_domain,
                                    GAskPasswordFlags  flags)
{
  /* do nothing */
}

static void
shell_mount_operation_ask_question (GMountOperation *op,
                                    const char      *message,
                                    const char      *choices[])
{
  /* do nothing */
}

static void
shell_mount_operation_show_processes (GMountOperation *operation,
                                      const gchar     *message,
                                      GArray          *processes,
                                      const gchar     *choices[])
{
  ShellMountOperation *self = SHELL_MOUNT_OPERATION (operation);

  if (self->priv->pids != NULL)
    {
      g_array_unref (self->priv->pids);
      self->priv->pids = NULL;
    }

  g_free (self->priv->message);
  g_strfreev (self->priv->choices);

  /* save the parameters */
  self->priv->pids = g_array_ref (processes);
  self->priv->choices = g_strdupv ((gchar **) choices);
  self->priv->message = g_strdup (message);

  g_signal_emit (self, signals[SHOW_PROCESSES_2], 0);
}

static void
shell_mount_operation_finalize (GObject *obj)
{
  ShellMountOperation *self = SHELL_MOUNT_OPERATION (obj);

  g_strfreev (self->priv->choices);
  g_free (self->priv->message);

  if (self->priv->pids != NULL)
    {
      g_array_unref (self->priv->pids);
      self->priv->pids = NULL;
    }

  G_OBJECT_CLASS (shell_mount_operation_parent_class)->finalize (obj);
}

static void
shell_mount_operation_class_init (ShellMountOperationClass *klass)
{
  GMountOperationClass *mclass;
  GObjectClass *oclass;

  mclass = G_MOUNT_OPERATION_CLASS (klass);
  mclass->show_processes = shell_mount_operation_show_processes;
  mclass->ask_question = shell_mount_operation_ask_question;
  mclass->ask_password = shell_mount_operation_ask_password;

  oclass = G_OBJECT_CLASS (klass);
  oclass->finalize = shell_mount_operation_finalize;

  signals[SHOW_PROCESSES_2] =
    g_signal_new ("show-processes-2",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0, NULL, NULL,
                  g_cclosure_marshal_VOID__VOID,
                  G_TYPE_NONE, 0);

  g_type_class_add_private (klass, sizeof (ShellMountOperationPrivate));
}

GMountOperation *
shell_mount_operation_new (void)
{
  return g_object_new (SHELL_TYPE_MOUNT_OPERATION, NULL);
}

/**
 * shell_mount_operation_get_show_processes_pids:
 * @self: a #ShellMountOperation
 *
 * Returns: (transfer full) (element-type GPid): a #GArray
 */
GArray *
shell_mount_operation_get_show_processes_pids (ShellMountOperation *self)
{
  return g_array_ref (self->priv->pids);
}

/**
 * shell_mount_operation_get_show_processes_choices:
 * @self: a #ShellMountOperation
 *
 * Returns: (transfer full):
 */
gchar **
shell_mount_operation_get_show_processes_choices (ShellMountOperation *self)
{
  return g_strdupv (self->priv->choices);
}

/**
 * shell_mount_operation_get_show_processes_message:
 * @self: a #ShellMountOperation
 *
 * Returns: (transfer full):
 */
gchar *
shell_mount_operation_get_show_processes_message (ShellMountOperation *self)
{
  return g_strdup (self->priv->message);
}
