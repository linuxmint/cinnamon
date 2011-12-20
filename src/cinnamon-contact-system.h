/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_CONTACT_SYSTEM_H__
#define __CINNAMON_CONTACT_SYSTEM_H__

#include <clutter/clutter.h>
#include <gio/gio.h>
#include <folks/folks.h>

#define CINNAMON_TYPE_CONTACT_SYSTEM             (cinnamon_contact_system_get_type ())
#define CINNAMON_CONTACT_SYSTEM(obj)             (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_CONTACT_SYSTEM, CinnamonContactSystem))
#define CINNAMON_CONTACT_SYSTEM_CLASS(klass)     (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_CONTACT_SYSTEM, CinnamonContactSystemClass))
#define CINNAMON_IS_CONTACT_SYSTEM(obj)          (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_CONTACT_SYSTEM))
#define CINNAMON_IS_CONTACT_SYSTEM_CLASS(klass)  (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_CONTACT_SYSTEM))
#define CINNAMON_CONTACT_SYSTEM_GET_CLASS(obj)   (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_CONTACT_SYSTEM, CinnamonContactSystemClass))

typedef struct _CinnamonContactSystem CinnamonContactSystem;
typedef struct _CinnamonContactSystemClass CinnamonContactSystemClass;
typedef struct _CinnamonContactSystemPrivate CinnamonContactSystemPrivate;

struct _CinnamonContactSystem
{
  GObject parent;

  CinnamonContactSystemPrivate *priv;
};

struct _CinnamonContactSystemClass
{
  GObjectClass parent_class;
};

GType cinnamon_contact_system_get_type (void) G_GNUC_CONST;

/* Methods */

CinnamonContactSystem * cinnamon_contact_system_get_default (void);

GeeMap *cinnamon_contact_system_get_all (CinnamonContactSystem *self);

FolksIndividual *cinnamon_contact_system_get_individual (CinnamonContactSystem  *self,
                                                      gchar               *id);

char * cinnamon_contact_system_get_email_for_display (CinnamonContactSystem *self,
                                                   FolksIndividual    *individual);

GSList * cinnamon_contact_system_initial_search (CinnamonContactSystem  *cinnamon,
                                              GSList              *terms);

GSList * cinnamon_contact_system_subsearch (CinnamonContactSystem *cinnamon,
                                         GSList             *previous_results,
                                         GSList             *terms);

#endif /* __CINNAMON_CONTACT_SYSTEM_H__ */
