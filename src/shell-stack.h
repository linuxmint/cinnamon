/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_STACK_H__
#define __SHELL_STACK_H__

#include "st.h"
#include <gtk/gtk.h>

#define SHELL_TYPE_STACK                 (shell_stack_get_type ())
#define SHELL_STACK(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_STACK, ShellStack))
#define SHELL_STACK_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_STACK, ShellStackClass))
#define SHELL_IS_STACK(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_STACK))
#define SHELL_IS_STACK_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_STACK))
#define SHELL_STACK_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_STACK, ShellStackClass))

typedef struct _ShellStack        ShellStack;
typedef struct _ShellStackClass   ShellStackClass;

typedef struct _ShellStackPrivate ShellStackPrivate;

struct _ShellStack
{
    StContainer parent;

    ShellStackPrivate *priv;
};

struct _ShellStackClass
{
    StContainerClass parent_class;
};

GType shell_stack_get_type (void) G_GNUC_CONST;

#endif /* __SHELL_STACK_H__ */
