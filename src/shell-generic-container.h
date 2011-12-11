/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_GENERIC_CONTAINER_H__
#define __SHELL_GENERIC_CONTAINER_H__

#include "st.h"

#define SHELL_TYPE_GENERIC_CONTAINER                 (shell_generic_container_get_type ())
#define SHELL_GENERIC_CONTAINER(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_GENERIC_CONTAINER, ShellGenericContainer))
#define SHELL_GENERIC_CONTAINER_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_GENERIC_CONTAINER, ShellGenericContainerClass))
#define SHELL_IS_GENERIC_CONTAINER(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_GENERIC_CONTAINER))
#define SHELL_IS_GENERIC_CONTAINER_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_GENERIC_CONTAINER))
#define SHELL_GENERIC_CONTAINER_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_GENERIC_CONTAINER, ShellGenericContainerClass))

typedef struct {
  float min_size;
  float natural_size;

  /* <private> */
  guint _refcount;
} ShellGenericContainerAllocation;

#define SHELL_TYPE_GENERIC_CONTAINER_ALLOCATION (shell_generic_container_allocation_get_type ())
GType shell_generic_container_allocation_get_type (void);

typedef struct _ShellGenericContainer        ShellGenericContainer;
typedef struct _ShellGenericContainerClass   ShellGenericContainerClass;

typedef struct _ShellGenericContainerPrivate ShellGenericContainerPrivate;

struct _ShellGenericContainer
{
    StContainer parent;

    ShellGenericContainerPrivate *priv;
};

struct _ShellGenericContainerClass
{
    StContainerClass parent_class;
};

GType    shell_generic_container_get_type         (void) G_GNUC_CONST;

guint    shell_generic_container_get_n_skip_paint (ShellGenericContainer *self);

gboolean shell_generic_container_get_skip_paint   (ShellGenericContainer *self,
                                                   ClutterActor          *child);
void     shell_generic_container_set_skip_paint   (ShellGenericContainer *self,
                                                   ClutterActor          *child,
                                                   gboolean               skip);

#endif /* __SHELL_GENERIC_CONTAINER_H__ */
