/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_PERF_LOG_H__
#define __CINNAMON_PERF_LOG_H__

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

typedef struct _CinnamonPerfLog CinnamonPerfLog;
typedef struct _CinnamonPerfLogClass CinnamonPerfLogClass;

#define CINNAMON_TYPE_PERF_LOG              (cinnamon_perf_log_get_type ())
#define CINNAMON_PERF_LOG(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_PERF_LOG, CinnamonPerfLog))
#define CINNAMON_PERF_LOG_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_PERF_LOG, CinnamonPerfLogClass))
#define CINNAMON_IS_PERF_LOG(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_PERF_LOG))
#define CINNAMON_IS_PERF_LOG_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_PERF_LOG))
#define CINNAMON_PERF_LOG_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_PERF_LOG, CinnamonPerfLogClass))

GType cinnamon_perf_log_get_type (void) G_GNUC_CONST;

CinnamonPerfLog *cinnamon_perf_log_get_default (void);

void cinnamon_perf_log_set_enabled (CinnamonPerfLog *perf_log,
				 gboolean      enabled);

void cinnamon_perf_log_define_event (CinnamonPerfLog *perf_log,
				  const char   *name,
				  const char   *description,
				  const char   *signature);
void cinnamon_perf_log_event        (CinnamonPerfLog *perf_log,
				  const char   *name);
void cinnamon_perf_log_event_i      (CinnamonPerfLog *perf_log,
				  const char   *name,
				  gint32        arg);
void cinnamon_perf_log_event_x      (CinnamonPerfLog *perf_log,
				  const char   *name,
				  gint64        arg);
void cinnamon_perf_log_event_s      (CinnamonPerfLog *perf_log,
				  const char   *name,
				  const char   *arg);

void cinnamon_perf_log_define_statistic (CinnamonPerfLog *perf_log,
                                      const char   *name,
                                      const char   *description,
                                      const char   *signature);

void cinnamon_perf_log_update_statistic_i (CinnamonPerfLog *perf_log,
                                        const char   *name,
                                        int           value);
void cinnamon_perf_log_update_statistic_x (CinnamonPerfLog *perf_log,
                                        const char   *name,
                                        gint64        value);

typedef void (*CinnamonPerfStatisticsCallback) (CinnamonPerfLog *perf_log,
                                             gpointer      data);

void cinnamon_perf_log_add_statistics_callback (CinnamonPerfLog               *perf_log,
                                             CinnamonPerfStatisticsCallback callback,
                                             gpointer                    user_data,
                                             GDestroyNotify              notify);

void cinnamon_perf_log_collect_statistics (CinnamonPerfLog *perf_log);

typedef void (*CinnamonPerfReplayFunction) (gint64      time,
					 const char *name,
					 const char *signature,
					 GValue     *arg,
                                         gpointer    user_data);

void cinnamon_perf_log_replay (CinnamonPerfLog            *perf_log,
			    CinnamonPerfReplayFunction  replay_function,
                            gpointer                 user_data);

gboolean cinnamon_perf_log_dump_events (CinnamonPerfLog   *perf_log,
                                     GOutputStream  *out,
                                     GError        **error);
gboolean cinnamon_perf_log_dump_log    (CinnamonPerfLog   *perf_log,
                                     GOutputStream  *out,
                                     GError        **error);

G_END_DECLS

#endif /* __CINNAMON_PERF_LOG_H__ */
