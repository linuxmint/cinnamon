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
  float for_size;
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

/**
 * CinnamonGenericContainerAllocationCallback:
 * @content_box: (closure): Data passed to allocation functions
 * @flags: (closure): Allocation flags
 *
 * Callback type for CinnamonGenericContainer
 */
typedef void (* CinnamonGenericContainerAllocationCallback) (ClutterActorBox       *content_box,
                                                             ClutterAllocationFlags flags);

/**
 * CinnamonGenericContainerPreferredSizeCallback:
 * @alloc: (closure): allocation object
 *
 * Callback type for CinnamonGenericContainer
 */
typedef void (* CinnamonGenericContainerPreferredSizeCallback) (CinnamonGenericContainerAllocation *alloc);

GType    cinnamon_generic_container_get_type         (void) G_GNUC_CONST;

guint    cinnamon_generic_container_get_n_skip_paint (CinnamonGenericContainer *self);

gboolean cinnamon_generic_container_get_skip_paint   (CinnamonGenericContainer *self,
                                                   ClutterActor          *child);
void     cinnamon_generic_container_set_skip_paint   (CinnamonGenericContainer *self,
                                                   ClutterActor          *child,
                                                   gboolean               skip);

void cinnamon_generic_container_set_allocation_callback (CinnamonGenericContainer                  *self,
                                                         CinnamonGenericContainerAllocationCallback allocation_callback,
                                                         gpointer                                   user_data,
                                                         GDestroyNotify                             data_destroy);
void cinnamon_generic_container_set_preferred_width_callback (CinnamonGenericContainer                     *self,
                                                              CinnamonGenericContainerPreferredSizeCallback preferred_width_callback,
                                                              gpointer                                      user_data,
                                                              GDestroyNotify                                data_destroy);
void cinnamon_generic_container_set_preferred_height_callback (CinnamonGenericContainer                     *self,
                                                               CinnamonGenericContainerPreferredSizeCallback preferred_height_callback,
                                                               gpointer                                      user_data,
                                                               GDestroyNotify                                data_destroy);

#endif /* __CINNAMON_GENERIC_CONTAINER_H__ */
