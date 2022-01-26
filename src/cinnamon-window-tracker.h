/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_WINDOW_TRACKER_H__
#define __CINNAMON_WINDOW_TRACKER_H__

#include <glib-object.h>
#include <glib.h>
#include <meta/window.h>

#include "cinnamon-app.h"
#include "cinnamon-app-system.h"

G_BEGIN_DECLS

typedef struct _CinnamonWindowTracker CinnamonWindowTracker;
typedef struct _CinnamonWindowTrackerClass CinnamonWindowTrackerClass;
typedef struct _CinnamonWindowTrackerPrivate CinnamonWindowTrackerPrivate;

#define CINNAMON_TYPE_WINDOW_TRACKER              (cinnamon_window_tracker_get_type ())
#define CINNAMON_WINDOW_TRACKER(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_WINDOW_TRACKER, CinnamonWindowTracker))
#define CINNAMON_WINDOW_TRACKER_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_WINDOW_TRACKER, CinnamonWindowTrackerClass))
#define CINNAMON_IS_WINDOW_TRACKER(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_WINDOW_TRACKER))
#define CINNAMON_IS_WINDOW_TRACKER_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_WINDOW_TRACKER))
#define CINNAMON_WINDOW_TRACKER_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_WINDOW_TRACKER, CinnamonWindowTrackerClass))

struct _CinnamonWindowTrackerClass
{
  GObjectClass parent_class;
};

GType cinnamon_window_tracker_get_type (void) G_GNUC_CONST;

CinnamonWindowTracker* cinnamon_window_tracker_get_default(void);

CinnamonApp *cinnamon_window_tracker_get_window_app (CinnamonWindowTracker *tracker, MetaWindow *metawin);

CinnamonApp *cinnamon_window_tracker_get_app_from_pid (CinnamonWindowTracker *tracker, int pid);

gboolean cinnamon_window_tracker_is_window_interesting (CinnamonWindowTracker *tracker, MetaWindow *window);

GSList *cinnamon_window_tracker_get_startup_sequences (CinnamonWindowTracker *tracker);

G_END_DECLS

#endif /* __CINNAMON_WINDOW_TRACKER_H__ */
