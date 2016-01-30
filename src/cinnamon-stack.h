/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_STACK_H__
#define __CINNAMON_STACK_H__

#include "st.h"
#include <gtk/gtk.h>

#define CINNAMON_TYPE_STACK                 (cinnamon_stack_get_type ())
#define CINNAMON_STACK(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_STACK, CinnamonStack))
#define CINNAMON_STACK_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_STACK, CinnamonStackClass))
#define CINNAMON_IS_STACK(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_STACK))
#define CINNAMON_IS_STACK_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_STACK))
#define CINNAMON_STACK_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_STACK, CinnamonStackClass))

typedef struct _CinnamonStack        CinnamonStack;
typedef struct _CinnamonStackClass   CinnamonStackClass;

typedef struct _CinnamonStackPrivate CinnamonStackPrivate;

struct _CinnamonStack
{
    StWidget parent;

    CinnamonStackPrivate *priv;
};

struct _CinnamonStackClass
{
    StWidgetClass parent_class;
};

GType cinnamon_stack_get_type (void) G_GNUC_CONST;

#endif /* __CINNAMON_STACK_H__ */
