/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_APP_USAGE_H__
#define __SHELL_APP_USAGE_H__

#include "shell-app.h"
#include "shell-window-tracker.h"

G_BEGIN_DECLS

typedef struct _ShellAppUsage ShellAppUsage;
typedef struct _ShellAppUsageClass ShellAppUsageClass;
typedef struct _ShellAppUsagePrivate ShellAppUsagePrivate;

#define SHELL_TYPE_APP_USAGE              (shell_app_usage_get_type ())
#define SHELL_APP_USAGE(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_APP_USAGE, ShellAppUsage))
#define SHELL_APP_USAGE_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_APP_USAGE, ShellAppUsageClass))
#define SHELL_IS_APP_USAGE(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_APP_USAGE))
#define SHELL_IS_APP_USAGE_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_APP_USAGE))
#define SHELL_APP_USAGE_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_APP_USAGE, ShellAppUsageClass))

struct _ShellAppUsageClass
{
  GObjectClass parent_class;
};

GType shell_app_usage_get_type (void) G_GNUC_CONST;

ShellAppUsage* shell_app_usage_get_default(void);

GSList *shell_app_usage_get_most_used (ShellAppUsage *usage,
                                       const char    *context,
                                       gint           max_count);
int shell_app_usage_compare (ShellAppUsage *self,
                             const char    *context,
                             ShellApp      *app_a,
                             ShellApp      *app_b);

G_END_DECLS

#endif /* __SHELL_APP_USAGE_H__ */
