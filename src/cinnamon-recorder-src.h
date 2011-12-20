/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_RECORDER_SRC_H__
#define __CINNAMON_RECORDER_SRC_H__

#include <gst/gst.h>

G_BEGIN_DECLS

/**
 * CinnamonRecorderSrc:
 *
 * cinnamonrecordersrc a custom source element is pretty much like a very
 * simple version of the stander GStreamer 'appsrc' element, without
 * any of the provisions for seeking, generating data on demand,
 * etc. In both cases, the application supplies the buffers and the
 * element pushes them into the pipeline. The main reason for not using
 * appsrc is that it wasn't a supported element until gstreamer 0.10.22,
 * and as of 2009-03, many systems still have 0.10.21.
 */
typedef struct _CinnamonRecorderSrc      CinnamonRecorderSrc;
typedef struct _CinnamonRecorderSrcClass CinnamonRecorderSrcClass;

#define CINNAMON_TYPE_RECORDER_SRC              (cinnamon_recorder_src_get_type ())
#define CINNAMON_RECORDER_SRC(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_RECORDER_SRC, CinnamonRecorderSrc))
#define CINNAMON_RECORDER_SRC_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_RECORDER_SRC, CinnamonRecorderSrcClass))
#define CINNAMON_IS_RECORDER_SRC(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_RECORDER_SRC))
#define CINNAMON_IS_RECORDER_SRC_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_RECORDER_SRC))
#define CINNAMON_RECORDER_SRC_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_RECORDER_SRC, CinnamonRecorderSrcClass))

GType              cinnamon_recorder_src_get_type     (void) G_GNUC_CONST;

void cinnamon_recorder_src_register (void);

void cinnamon_recorder_src_add_buffer (CinnamonRecorderSrc *src,
				    GstBuffer        *buffer);
void cinnamon_recorder_src_close      (CinnamonRecorderSrc *src);

G_END_DECLS

#endif /* __CINNAMON_RECORDER_SRC_H__ */
