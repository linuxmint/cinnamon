/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_WINDOW_TRACKER_H__
#define __SHELL_WINDOW_TRACKER_H__

#include <glib-object.h>
#include <glib.h>
#include <meta/window.h>

#include "shell-app.h"
#include "shell-app-system.h"

G_BEGIN_DECLS

typedef struct _ShellWindowTracker ShellWindowTracker;
typedef struct _ShellWindowTrackerClass ShellWindowTrackerClass;
typedef struct _ShellWindowTrackerPrivate ShellWindowTrackerPrivate;

#define SHELL_TYPE_WINDOW_TRACKER              (shell_window_tracker_get_type ())
#define SHELL_WINDOW_TRACKER(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_WINDOW_TRACKER, ShellWindowTracker))
#define SHELL_WINDOW_TRACKER_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_WINDOW_TRACKER, ShellWindowTrackerClass))
#define SHELL_IS_WINDOW_TRACKER(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_WINDOW_TRACKER))
#define SHELL_IS_WINDOW_TRACKER_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_WINDOW_TRACKER))
#define SHELL_WINDOW_TRACKER_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_WINDOW_TRACKER, ShellWindowTrackerClass))

struct _ShellWindowTrackerClass
{
  GObjectClass parent_class;
};

GType shell_window_tracker_get_type (void) G_GNUC_CONST;

ShellWindowTracker* shell_window_tracker_get_default(void);

ShellApp *shell_window_tracker_get_window_app (ShellWindowTracker *tracker, MetaWindow *metawin);

ShellApp *shell_window_tracker_get_app_from_pid (ShellWindowTracker *tracker, int pid);

gboolean shell_window_tracker_is_window_interesting (MetaWindow *window);

const char *_shell_window_tracker_get_app_context (ShellWindowTracker *tracker, ShellApp *app);

GSList *shell_window_tracker_get_startup_sequences (ShellWindowTracker *tracker);

/* Hidden typedef for SnStartupSequence */
typedef struct _ShellStartupSequence ShellStartupSequence;
#define SHELL_TYPE_STARTUP_SEQUENCE (shell_startup_sequence_get_type ())
GType shell_startup_sequence_get_type (void);

const char *shell_startup_sequence_get_id (ShellStartupSequence *sequence);
ShellApp *shell_startup_sequence_get_app (ShellStartupSequence *sequence);
const char *shell_startup_sequence_get_name (ShellStartupSequence *sequence);
gboolean shell_startup_sequence_get_completed (ShellStartupSequence *sequence);
ClutterActor *shell_startup_sequence_create_icon (ShellStartupSequence *sequence, guint size);

G_END_DECLS

#endif /* __SHELL_WINDOW_TRACKER_H__ */
