/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_CONTACT_SYSTEM_H__
#define __SHELL_CONTACT_SYSTEM_H__

#include <clutter/clutter.h>
#include <gio/gio.h>
#include <folks/folks.h>

#define SHELL_TYPE_CONTACT_SYSTEM             (shell_contact_system_get_type ())
#define SHELL_CONTACT_SYSTEM(obj)             (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_CONTACT_SYSTEM, ShellContactSystem))
#define SHELL_CONTACT_SYSTEM_CLASS(klass)     (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_CONTACT_SYSTEM, ShellContactSystemClass))
#define SHELL_IS_CONTACT_SYSTEM(obj)          (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_CONTACT_SYSTEM))
#define SHELL_IS_CONTACT_SYSTEM_CLASS(klass)  (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_CONTACT_SYSTEM))
#define SHELL_CONTACT_SYSTEM_GET_CLASS(obj)   (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_CONTACT_SYSTEM, ShellContactSystemClass))

typedef struct _ShellContactSystem ShellContactSystem;
typedef struct _ShellContactSystemClass ShellContactSystemClass;
typedef struct _ShellContactSystemPrivate ShellContactSystemPrivate;

struct _ShellContactSystem
{
  GObject parent;

  ShellContactSystemPrivate *priv;
};

struct _ShellContactSystemClass
{
  GObjectClass parent_class;
};

GType shell_contact_system_get_type (void) G_GNUC_CONST;

/* Methods */

ShellContactSystem * shell_contact_system_get_default (void);

GeeMap *shell_contact_system_get_all (ShellContactSystem *self);

FolksIndividual *shell_contact_system_get_individual (ShellContactSystem  *self,
                                                      gchar               *id);

char * shell_contact_system_get_email_for_display (ShellContactSystem *self,
                                                   FolksIndividual    *individual);

GSList * shell_contact_system_initial_search (ShellContactSystem  *shell,
                                              GSList              *terms);

GSList * shell_contact_system_subsearch (ShellContactSystem *shell,
                                         GSList             *previous_results,
                                         GSList             *terms);

#endif /* __SHELL_CONTACT_SYSTEM_H__ */
