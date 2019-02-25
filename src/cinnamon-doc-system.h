/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_DOC_SYSTEM_H__
#define __CINNAMON_DOC_SYSTEM_H__

#include <gio/gio.h>
#include <gtk/gtk.h>

#define CINNAMON_TYPE_DOC_SYSTEM                 (cinnamon_doc_system_get_type ())
#define CINNAMON_DOC_SYSTEM(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_DOC_SYSTEM, CinnamonDocSystem))
#define CINNAMON_DOC_SYSTEM_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_DOC_SYSTEM, CinnamonDocSystemClass))
#define CINNAMON_IS_DOC_SYSTEM(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_DOC_SYSTEM))
#define CINNAMON_IS_DOC_SYSTEM_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_DOC_SYSTEM))
#define CINNAMON_DOC_SYSTEM_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_DOC_SYSTEM, CinnamonDocSystemClass))

typedef struct _CinnamonDocSystem CinnamonDocSystem;
typedef struct _CinnamonDocSystemClass CinnamonDocSystemClass;
typedef struct _CinnamonDocSystemPrivate CinnamonDocSystemPrivate;

struct _CinnamonDocSystem
{
  GObject parent;

  CinnamonDocSystemPrivate *priv;
};

struct _CinnamonDocSystemClass
{
  GObjectClass parent_class;
};

GType cinnamon_doc_system_get_type (void) G_GNUC_CONST;

CinnamonDocSystem* cinnamon_doc_system_get_default (void);

GSList *cinnamon_doc_system_get_all (CinnamonDocSystem    *system);

#endif /* __CINNAMON_DOC_SYSTEM_H__ */
