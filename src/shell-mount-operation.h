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

#ifndef __SHELL_MOUNT_OPERATION_H__
#define __SHELL_MOUNT_OPERATION_H__

#include <gio/gio.h>

G_BEGIN_DECLS

#define SHELL_TYPE_MOUNT_OPERATION         (shell_mount_operation_get_type ())
#define SHELL_MOUNT_OPERATION(o)           (G_TYPE_CHECK_INSTANCE_CAST ((o), SHELL_TYPE_MOUNT_OPERATION, ShellMountOperation))
#define SHELL_MOUNT_OPERATION_CLASS(k)     (G_TYPE_CHECK_CLASS_CAST((k), SHELL_TYPE_MOUNT_OPERATION, ShellMountOperationClass))
#define SHELL_IS_MOUNT_OPERATION(o)        (G_TYPE_CHECK_INSTANCE_TYPE ((o), SHELL_TYPE_MOUNT_OPERATION))
#define SHELL_IS_MOUNT_OPERATION_CLASS(k)  (G_TYPE_CHECK_CLASS_TYPE ((k), SHELL_TYPE_MOUNT_OPERATION))
#define SHELL_MOUNT_OPERATION_GET_CLASS(o) (G_TYPE_INSTANCE_GET_CLASS ((o), SHELL_TYPE_MOUNT_OPERATION, ShellMountOperationClass))

typedef struct _ShellMountOperation         ShellMountOperation;
typedef struct _ShellMountOperationClass    ShellMountOperationClass;
typedef struct _ShellMountOperationPrivate  ShellMountOperationPrivate;

struct _ShellMountOperation
{
  GMountOperation parent_instance;

  ShellMountOperationPrivate *priv;
};

struct _ShellMountOperationClass
{
  GMountOperationClass parent_class;
};


GType            shell_mount_operation_get_type   (void);
GMountOperation *shell_mount_operation_new        (void);

GArray * shell_mount_operation_get_show_processes_pids (ShellMountOperation *self);
gchar ** shell_mount_operation_get_show_processes_choices (ShellMountOperation *self);
gchar * shell_mount_operation_get_show_processes_message (ShellMountOperation *self);

G_END_DECLS

#endif /* __SHELL_MOUNT_OPERATION_H__ */
