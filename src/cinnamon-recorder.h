/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_RECORDER_H__
#define __CINNAMON_RECORDER_H__

#include <clutter/clutter.h>

G_BEGIN_DECLS

/**
 * SECTION:CinnamonRecorder
 * short_description: Record from a #ClutterStage
 *
 * The #CinnamonRecorder object is used to make recordings ("screencasts")
 * of a #ClutterStage. Recording is done via #GStreamer. The default is
 * to encode as a Theora movie and write it to a file in the current
 * directory named after the date, but the encoding and output can
 * be configured.
 */
typedef struct _CinnamonRecorder      CinnamonRecorder;
typedef struct _CinnamonRecorderClass CinnamonRecorderClass;

#define CINNAMON_TYPE_RECORDER              (cinnamon_recorder_get_type ())
#define CINNAMON_RECORDER(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_RECORDER, CinnamonRecorder))
#define CINNAMON_RECORDER_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_RECORDER, CinnamonRecorderClass))
#define CINNAMON_IS_RECORDER(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_RECORDER))
#define CINNAMON_IS_RECORDER_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_RECORDER))
#define CINNAMON_RECORDER_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_RECORDER, CinnamonRecorderClass))

GType              cinnamon_recorder_get_type     (void) G_GNUC_CONST;

CinnamonRecorder     *cinnamon_recorder_new (ClutterStage  *stage);

void               cinnamon_recorder_set_framerate (CinnamonRecorder *recorder,
                                                    int framerate);
void               cinnamon_recorder_set_file_template (CinnamonRecorder *recorder,
                                                        const char    *file_template);
void               cinnamon_recorder_set_pipeline (CinnamonRecorder *recorder,
                                                   const char    *pipeline);
void               cinnamon_recorder_set_draw_cursor (CinnamonRecorder *recorder,
                                                      gboolean       draw_cursor);
void cinnamon_recorder_set_area (CinnamonRecorder *recorder,
                                 int               x,
                                 int               y,
                                 int               width,
                                 int               height);
gboolean           cinnamon_recorder_record       (CinnamonRecorder  *recorder,
                                                   char          **filename_used);
void               cinnamon_recorder_close        (CinnamonRecorder *recorder);
gboolean           cinnamon_recorder_is_recording (CinnamonRecorder *recorder);

G_END_DECLS

#endif /* __CINNAMON_RECORDER_H__ */
