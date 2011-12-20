/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_APP_USAGE_H__
#define __CINNAMON_APP_USAGE_H__

#include "cinnamon-app.h"
#include "cinnamon-window-tracker.h"

G_BEGIN_DECLS

typedef struct _CinnamonAppUsage CinnamonAppUsage;
typedef struct _CinnamonAppUsageClass CinnamonAppUsageClass;
typedef struct _CinnamonAppUsagePrivate CinnamonAppUsagePrivate;

#define CINNAMON_TYPE_APP_USAGE              (cinnamon_app_usage_get_type ())
#define CINNAMON_APP_USAGE(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_APP_USAGE, CinnamonAppUsage))
#define CINNAMON_APP_USAGE_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_APP_USAGE, CinnamonAppUsageClass))
#define CINNAMON_IS_APP_USAGE(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_APP_USAGE))
#define CINNAMON_IS_APP_USAGE_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_APP_USAGE))
#define CINNAMON_APP_USAGE_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_APP_USAGE, CinnamonAppUsageClass))

struct _CinnamonAppUsageClass
{
  GObjectClass parent_class;
};

GType cinnamon_app_usage_get_type (void) G_GNUC_CONST;

CinnamonAppUsage* cinnamon_app_usage_get_default(void);

GSList *cinnamon_app_usage_get_most_used (CinnamonAppUsage *usage,
                                       const char    *context,
                                       gint           max_count);
int cinnamon_app_usage_compare (CinnamonAppUsage *self,
                             const char    *context,
                             CinnamonApp      *app_a,
                             CinnamonApp      *app_b);

G_END_DECLS

#endif /* __CINNAMON_APP_USAGE_H__ */
