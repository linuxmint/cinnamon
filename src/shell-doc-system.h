/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_DOC_SYSTEM_H__
#define __SHELL_DOC_SYSTEM_H__

#include <gio/gio.h>
#include <gtk/gtk.h>

#define SHELL_TYPE_DOC_SYSTEM                 (shell_doc_system_get_type ())
#define SHELL_DOC_SYSTEM(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_DOC_SYSTEM, ShellDocSystem))
#define SHELL_DOC_SYSTEM_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_DOC_SYSTEM, ShellDocSystemClass))
#define SHELL_IS_DOC_SYSTEM(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_DOC_SYSTEM))
#define SHELL_IS_DOC_SYSTEM_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_DOC_SYSTEM))
#define SHELL_DOC_SYSTEM_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_DOC_SYSTEM, ShellDocSystemClass))

typedef struct _ShellDocSystem ShellDocSystem;
typedef struct _ShellDocSystemClass ShellDocSystemClass;
typedef struct _ShellDocSystemPrivate ShellDocSystemPrivate;

struct _ShellDocSystem
{
  GObject parent;

  ShellDocSystemPrivate *priv;
};

struct _ShellDocSystemClass
{
  GObjectClass parent_class;
};

GType shell_doc_system_get_type (void) G_GNUC_CONST;

ShellDocSystem* shell_doc_system_get_default (void);

GSList *shell_doc_system_get_all (ShellDocSystem    *system);

GtkRecentInfo *shell_doc_system_lookup_by_uri (ShellDocSystem  *system,
                                               const char     *uri);

void shell_doc_system_queue_existence_check (ShellDocSystem   *system,
                                             guint             n_items);

void shell_doc_system_open (ShellDocSystem *system,
                            GtkRecentInfo  *info,
                            int             workspace);

#endif /* __SHELL_DOC_SYSTEM_H__ */
