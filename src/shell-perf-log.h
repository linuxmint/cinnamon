/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_PERF_LOG_H__
#define __SHELL_PERF_LOG_H__

#include <glib-object.h>
#include <gio/gio.h>

G_BEGIN_DECLS

typedef struct _ShellPerfLog ShellPerfLog;
typedef struct _ShellPerfLogClass ShellPerfLogClass;

#define SHELL_TYPE_PERF_LOG              (shell_perf_log_get_type ())
#define SHELL_PERF_LOG(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_PERF_LOG, ShellPerfLog))
#define SHELL_PERF_LOG_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_PERF_LOG, ShellPerfLogClass))
#define SHELL_IS_PERF_LOG(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_PERF_LOG))
#define SHELL_IS_PERF_LOG_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_PERF_LOG))
#define SHELL_PERF_LOG_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_PERF_LOG, ShellPerfLogClass))

GType shell_perf_log_get_type (void) G_GNUC_CONST;

ShellPerfLog *shell_perf_log_get_default (void);

void shell_perf_log_set_enabled (ShellPerfLog *perf_log,
				 gboolean      enabled);

void shell_perf_log_define_event (ShellPerfLog *perf_log,
				  const char   *name,
				  const char   *description,
				  const char   *signature);
void shell_perf_log_event        (ShellPerfLog *perf_log,
				  const char   *name);
void shell_perf_log_event_i      (ShellPerfLog *perf_log,
				  const char   *name,
				  gint32        arg);
void shell_perf_log_event_x      (ShellPerfLog *perf_log,
				  const char   *name,
				  gint64        arg);
void shell_perf_log_event_s      (ShellPerfLog *perf_log,
				  const char   *name,
				  const char   *arg);

void shell_perf_log_define_statistic (ShellPerfLog *perf_log,
                                      const char   *name,
                                      const char   *description,
                                      const char   *signature);

void shell_perf_log_update_statistic_i (ShellPerfLog *perf_log,
                                        const char   *name,
                                        int           value);
void shell_perf_log_update_statistic_x (ShellPerfLog *perf_log,
                                        const char   *name,
                                        gint64        value);

typedef void (*ShellPerfStatisticsCallback) (ShellPerfLog *perf_log,
                                             gpointer      data);

void shell_perf_log_add_statistics_callback (ShellPerfLog               *perf_log,
                                             ShellPerfStatisticsCallback callback,
                                             gpointer                    user_data,
                                             GDestroyNotify              notify);

void shell_perf_log_collect_statistics (ShellPerfLog *perf_log);

typedef void (*ShellPerfReplayFunction) (gint64      time,
					 const char *name,
					 const char *signature,
					 GValue     *arg,
                                         gpointer    user_data);

void shell_perf_log_replay (ShellPerfLog            *perf_log,
			    ShellPerfReplayFunction  replay_function,
                            gpointer                 user_data);

gboolean shell_perf_log_dump_events (ShellPerfLog   *perf_log,
                                     GOutputStream  *out,
                                     GError        **error);
gboolean shell_perf_log_dump_log    (ShellPerfLog   *perf_log,
                                     GOutputStream  *out,
                                     GError        **error);

G_END_DECLS

#endif /* __SHELL_PERF_LOG_H__ */
