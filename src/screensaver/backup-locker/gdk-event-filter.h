#ifndef __GDK_EVENT_FILTER_H
#define __GDK_EVENT_FILTER_H

#include <gtk/gtk.h>
#include <gdk/gdk.h>

G_BEGIN_DECLS

#define CS_TYPE_GDK_EVENT_FILTER (cs_gdk_event_filter_get_type ())
G_DECLARE_FINAL_TYPE (CsGdkEventFilter, cs_gdk_event_filter, CS, GDK_EVENT_FILTER, GObject)

CsGdkEventFilter            *cs_gdk_event_filter_new (GtkWidget *managed_window);

void                         cs_gdk_event_filter_start (CsGdkEventFilter *filter);

void                         cs_gdk_event_filter_stop  (CsGdkEventFilter *filter);

G_END_DECLS

#endif /* __GDK_EVENT_FILTER_H */
