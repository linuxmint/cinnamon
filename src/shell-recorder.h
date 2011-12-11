/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_RECORDER_H__
#define __SHELL_RECORDER_H__

#include <clutter/clutter.h>

G_BEGIN_DECLS

/**
 * SECTION:ShellRecorder
 * short_description: Record from a #ClutterStage
 *
 * The #ShellRecorder object is used to make recordings ("screencasts")
 * of a #ClutterStage. Recording is done via #GStreamer. The default is
 * to encode as a Theora movie and write it to a file in the current
 * directory named after the date, but the encoding and output can
 * be configured.
 */
typedef struct _ShellRecorder      ShellRecorder;
typedef struct _ShellRecorderClass ShellRecorderClass;

#define SHELL_TYPE_RECORDER              (shell_recorder_get_type ())
#define SHELL_RECORDER(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_RECORDER, ShellRecorder))
#define SHELL_RECORDER_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_RECORDER, ShellRecorderClass))
#define SHELL_IS_RECORDER(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_RECORDER))
#define SHELL_IS_RECORDER_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_RECORDER))
#define SHELL_RECORDER_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_RECORDER, ShellRecorderClass))

GType              shell_recorder_get_type     (void) G_GNUC_CONST;

ShellRecorder     *shell_recorder_new (ClutterStage  *stage);

void               shell_recorder_set_framerate (ShellRecorder *recorder,
                                                 int framerate);
void               shell_recorder_set_filename (ShellRecorder *recorder,
						const char    *filename);
void               shell_recorder_set_pipeline (ShellRecorder *recorder,
						const char    *pipeline);
gboolean           shell_recorder_record       (ShellRecorder *recorder);
void               shell_recorder_close        (ShellRecorder *recorder);
void               shell_recorder_pause        (ShellRecorder *recorder);
gboolean           shell_recorder_is_recording (ShellRecorder *recorder);

G_END_DECLS

#endif /* __SHELL_RECORDER_H__ */
