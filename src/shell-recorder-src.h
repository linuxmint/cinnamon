/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_RECORDER_SRC_H__
#define __SHELL_RECORDER_SRC_H__

#include <gst/gst.h>

G_BEGIN_DECLS

/**
 * ShellRecorderSrc:
 *
 * shellrecordersrc a custom source element is pretty much like a very
 * simple version of the stander GStreamer 'appsrc' element, without
 * any of the provisions for seeking, generating data on demand,
 * etc. In both cases, the application supplies the buffers and the
 * element pushes them into the pipeline. The main reason for not using
 * appsrc is that it wasn't a supported element until gstreamer 0.10.22,
 * and as of 2009-03, many systems still have 0.10.21.
 */
typedef struct _ShellRecorderSrc      ShellRecorderSrc;
typedef struct _ShellRecorderSrcClass ShellRecorderSrcClass;

#define SHELL_TYPE_RECORDER_SRC              (shell_recorder_src_get_type ())
#define SHELL_RECORDER_SRC(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_RECORDER_SRC, ShellRecorderSrc))
#define SHELL_RECORDER_SRC_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_RECORDER_SRC, ShellRecorderSrcClass))
#define SHELL_IS_RECORDER_SRC(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_RECORDER_SRC))
#define SHELL_IS_RECORDER_SRC_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_RECORDER_SRC))
#define SHELL_RECORDER_SRC_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_RECORDER_SRC, ShellRecorderSrcClass))

GType              shell_recorder_src_get_type     (void) G_GNUC_CONST;

void shell_recorder_src_register (void);

void shell_recorder_src_add_buffer (ShellRecorderSrc *src,
				    GstBuffer        *buffer);
void shell_recorder_src_close      (ShellRecorderSrc *src);

G_END_DECLS

#endif /* __SHELL_RECORDER_SRC_H__ */
