/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_GENERIC_CONTAINER_H__
#define __CINNAMON_GENERIC_CONTAINER_H__

#include "st.h"

#define CINNAMON_TYPE_GENERIC_CONTAINER                 (cinnamon_generic_container_get_type ())
#define CINNAMON_GENERIC_CONTAINER(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_GENERIC_CONTAINER, CinnamonGenericContainer))
#define CINNAMON_GENERIC_CONTAINER_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_GENERIC_CONTAINER, CinnamonGenericContainerClass))
#define CINNAMON_IS_GENERIC_CONTAINER(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_GENERIC_CONTAINER))
#define CINNAMON_IS_GENERIC_CONTAINER_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_GENERIC_CONTAINER))
#define CINNAMON_GENERIC_CONTAINER_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_GENERIC_CONTAINER, CinnamonGenericContainerClass))

typedef struct {
  float min_size;
  float natural_size;

  /* <private> */
  guint _refcount;
} CinnamonGenericContainerAllocation;

#define CINNAMON_TYPE_GENERIC_CONTAINER_ALLOCATION (cinnamon_generic_container_allocation_get_type ())
GType cinnamon_generic_container_allocation_get_type (void);

typedef struct _CinnamonGenericContainer        CinnamonGenericContainer;
typedef struct _CinnamonGenericContainerClass   CinnamonGenericContainerClass;

typedef struct _CinnamonGenericContainerPrivate CinnamonGenericContainerPrivate;

struct _CinnamonGenericContainer
{
    StWidget parent;

    CinnamonGenericContainerPrivate *priv;
};

struct _CinnamonGenericContainerClass
{
    StWidgetClass parent_class;
};

GType    cinnamon_generic_container_get_type         (void) G_GNUC_CONST;

guint    cinnamon_generic_container_get_n_skip_paint (CinnamonGenericContainer *self);

gboolean cinnamon_generic_container_get_skip_paint   (CinnamonGenericContainer *self,
                                                   ClutterActor          *child);
void     cinnamon_generic_container_set_skip_paint   (CinnamonGenericContainer *self,
                                                   ClutterActor          *child,
                                                   gboolean               skip);

#endif /* __CINNAMON_GENERIC_CONTAINER_H__ */
