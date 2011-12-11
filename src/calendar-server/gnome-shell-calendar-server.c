/*
 * Copyright (C) 2011 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 * Author: David Zeuthen <davidz@redhat.com>
 *
 * Based on code from gnome-panel's clock-applet, file calendar-client.c, with Authors:
 *
 *     Mark McLoughlin  <mark@skynet.ie>
 *     William Jon McCann  <mccann@jhu.edu>
 *     Martin Grimme  <martin@pycage.de>
 *     Christian Kellner  <gicmo@xatom.net>
 *
 */

#include "config.h"

#include <string.h>
#include <sys/types.h>
#include <unistd.h>

#include <gio/gio.h>

#define HANDLE_LIBICAL_MEMORY
#include <libecal/e-cal.h>
#include <libecal/e-cal-time-util.h>
#include <libecal/e-cal-recur.h>
#include <libecal/e-cal-system-timezone.h>

#define CALENDAR_CONFIG_PREFIX   "/apps/evolution/calendar"
#define CALENDAR_CONFIG_TIMEZONE CALENDAR_CONFIG_PREFIX "/display/timezone"

#include "calendar-sources.h"

/* Set the environment variable CALENDAR_SERVER_DEBUG to show debug */
static void print_debug (const gchar *str, ...);

#define BUS_NAME "org.gnome.Shell.CalendarServer"

static const gchar introspection_xml[] =
  "<node>"
  "  <interface name='org.gnome.Shell.CalendarServer'>"
  "    <method name='GetEvents'>"
  "      <arg type='x' name='since' direction='in'/>"
  "      <arg type='x' name='until' direction='in'/>"
  "      <arg type='b' name='force_reload' direction='in'/>"
  "      <arg type='a(sssbxxa{sv})' name='events' direction='out'/>"
  "    </method>"
  "    <signal name='Changed'/>"
  "    <property name='Since' type='x' access='read'/>"
  "    <property name='Until' type='x' access='read'/>"
  "  </interface>"
  "</node>";
static GDBusNodeInfo *introspection_data = NULL;

struct _App;
typedef struct _App App;

static GMainLoop    *loop = NULL;
static gboolean      opt_replace = FALSE;
static GOptionEntry  opt_entries[] = {
  {"replace", 0, 0, G_OPTION_ARG_NONE, &opt_replace, "Replace existing daemon", NULL},
  {NULL }
};
static App *_global_app = NULL;

/* ---------------------------------------------------------------------------------------------------- */

typedef struct
{
  time_t start_time;
  time_t end_time;
} CalendarOccurrence;

typedef struct
{
  char   *uid;
  char   *rid;
  char   *uri;
  char   *summary;
  char   *description;
  char   *color_string;
  time_t  start_time;
  time_t  end_time;
  guint   is_all_day : 1;

  /* Only used internally */
  GSList *occurrences;
} CalendarAppointment;

static time_t
get_time_from_property (icalcomponent         *ical,
                        icalproperty_kind      prop_kind,
                        struct icaltimetype (* get_prop_func) (const icalproperty *prop),
                        icaltimezone          *default_zone)
{
  icalproperty        *prop;
  struct icaltimetype  ical_time;
  icalparameter       *param;
  icaltimezone        *timezone = NULL;

  prop = icalcomponent_get_first_property (ical, prop_kind);
  if (!prop)
    return 0;

  ical_time = get_prop_func (prop);

  param = icalproperty_get_first_parameter (prop, ICAL_TZID_PARAMETER);
  if (param)
    timezone = icaltimezone_get_builtin_timezone_from_tzid (icalparameter_get_tzid (param));
  else if (icaltime_is_utc (ical_time))
    timezone = icaltimezone_get_utc_timezone ();
  else
    timezone = default_zone;

  return icaltime_as_timet_with_zone (ical_time, timezone);
}

static char *
get_ical_uid (icalcomponent *ical)
{
  return g_strdup (icalcomponent_get_uid (ical));
}

static char *
get_ical_rid (icalcomponent *ical)
{
  icalproperty        *prop;
  struct icaltimetype  ical_time;

  prop = icalcomponent_get_first_property (ical, ICAL_RECURRENCEID_PROPERTY);
  if (!prop)
    return NULL;

  ical_time = icalproperty_get_recurrenceid (prop);

  return icaltime_is_valid_time (ical_time) && !icaltime_is_null_time (ical_time) ?
    g_strdup (icaltime_as_ical_string (ical_time)) : NULL;
}

static char *
get_ical_summary (icalcomponent *ical)
{
  icalproperty *prop;

  prop = icalcomponent_get_first_property (ical, ICAL_SUMMARY_PROPERTY);
  if (!prop)
    return NULL;

  return g_strdup (icalproperty_get_summary (prop));
}

static char *
get_ical_description (icalcomponent *ical)
{
  icalproperty *prop;

  prop = icalcomponent_get_first_property (ical, ICAL_DESCRIPTION_PROPERTY);
  if (!prop)
    return NULL;

  return g_strdup (icalproperty_get_description (prop));
}

static inline time_t
get_ical_start_time (icalcomponent *ical,
                     icaltimezone  *default_zone)
{
  return get_time_from_property (ical,
                                 ICAL_DTSTART_PROPERTY,
                                 icalproperty_get_dtstart,
                                 default_zone);
}

static inline time_t
get_ical_end_time (icalcomponent *ical,
                   icaltimezone  *default_zone)
{
  return get_time_from_property (ical,
                                 ICAL_DTEND_PROPERTY,
                                 icalproperty_get_dtend,
                                 default_zone);
}

static gboolean
get_ical_is_all_day (icalcomponent *ical,
                     time_t         start_time,
                     icaltimezone  *default_zone)
{
  icalproperty            *prop;
  struct tm               *start_tm;
  time_t                   end_time;
  struct icaldurationtype  duration;
  struct icaltimetype      start_icaltime;

  start_icaltime = icalcomponent_get_dtstart (ical);
  if (start_icaltime.is_date)
    return TRUE;

  start_tm = gmtime (&start_time);
  if (start_tm->tm_sec  != 0 ||
      start_tm->tm_min  != 0 ||
      start_tm->tm_hour != 0)
    return FALSE;

  if ((end_time = get_ical_end_time (ical, default_zone)))
    return (end_time - start_time) % 86400 == 0;

  prop = icalcomponent_get_first_property (ical, ICAL_DURATION_PROPERTY);
  if (!prop)
    return FALSE;

  duration = icalproperty_get_duration (prop);

  return icaldurationtype_as_int (duration) % 86400 == 0;
}

static inline time_t
get_ical_due_time (icalcomponent *ical,
                   icaltimezone  *default_zone)
{
  return get_time_from_property (ical,
                                 ICAL_DUE_PROPERTY,
                                 icalproperty_get_due,
                                 default_zone);
}

static inline time_t
get_ical_completed_time (icalcomponent *ical,
                         icaltimezone  *default_zone)
{
  return get_time_from_property (ical,
                                 ICAL_COMPLETED_PROPERTY,
                                 icalproperty_get_completed,
                                 default_zone);
}

static char *
get_source_color (ECal *esource)
{
  ESource *source;

  g_return_val_if_fail (E_IS_CAL (esource), NULL);

  source = e_cal_get_source (esource);

  return g_strdup (e_source_peek_color_spec (source));
}

static gchar *
get_source_uri (ECal *esource)
{
    ESource *source;
    gchar   *string;
    gchar  **list;

    g_return_val_if_fail (E_IS_CAL (esource), NULL);

    source = e_cal_get_source (esource);
    string = g_strdup (e_source_get_uri (source));
    if (string) {
        list = g_strsplit (string, ":", 2);
        g_free (string);

        if (list[0]) {
            string = g_strdup (list[0]);
            g_strfreev (list);
            return string;
        }
        g_strfreev (list);
    }
    return NULL;
}

static inline int
null_safe_strcmp (const char *a,
                  const char *b)
{
  return (!a && !b) ? 0 : (a && !b) || (!a && b) ? 1 : strcmp (a, b);
}

static inline gboolean
calendar_appointment_equal (CalendarAppointment *a,
                            CalendarAppointment *b)
{
  GSList *la, *lb;

  if (g_slist_length (a->occurrences) != g_slist_length (b->occurrences))
      return FALSE;

  for (la = a->occurrences, lb = b->occurrences; la && lb; la = la->next, lb = lb->next)
    {
      CalendarOccurrence *oa = la->data;
      CalendarOccurrence *ob = lb->data;

      if (oa->start_time != ob->start_time ||
          oa->end_time   != ob->end_time)
        return FALSE;
    }

  return
    null_safe_strcmp (a->uid,          b->uid)          == 0 &&
    null_safe_strcmp (a->uri,          b->uri)          == 0 &&
    null_safe_strcmp (a->summary,      b->summary)      == 0 &&
    null_safe_strcmp (a->description,  b->description)  == 0 &&
    null_safe_strcmp (a->color_string, b->color_string) == 0 &&
    a->start_time == b->start_time                         &&
    a->end_time   == b->end_time                           &&
    a->is_all_day == b->is_all_day;
}

static void
calendar_appointment_free (CalendarAppointment *appointment)
{
  GSList *l;

  for (l = appointment->occurrences; l; l = l->next)
    g_free (l->data);
  g_slist_free (appointment->occurrences);
  appointment->occurrences = NULL;

  g_free (appointment->uid);
  appointment->uid = NULL;

  g_free (appointment->rid);
  appointment->rid = NULL;

  g_free (appointment->uri);
  appointment->uri = NULL;

  g_free (appointment->summary);
  appointment->summary = NULL;

  g_free (appointment->description);
  appointment->description = NULL;

  g_free (appointment->color_string);
  appointment->color_string = NULL;

  appointment->start_time = 0;
  appointment->is_all_day = FALSE;
}

static void
calendar_appointment_init (CalendarAppointment  *appointment,
                           icalcomponent        *ical,
                           ECal                 *cal,
                           icaltimezone         *default_zone)
{
  appointment->uid          = get_ical_uid (ical);
  appointment->rid          = get_ical_rid (ical);
  appointment->uri          = get_source_uri (cal);
  appointment->summary      = get_ical_summary (ical);
  appointment->description  = get_ical_description (ical);
  appointment->color_string = get_source_color (cal);
  appointment->start_time   = get_ical_start_time (ical, default_zone);
  appointment->end_time     = get_ical_end_time (ical, default_zone);
  appointment->is_all_day   = get_ical_is_all_day (ical,
                                                   appointment->start_time,
                                                   default_zone);
}

static icaltimezone *
resolve_timezone_id (const char *tzid,
                     ECal       *source)
{
  icaltimezone *retval;

  retval = icaltimezone_get_builtin_timezone_from_tzid (tzid);
  if (!retval)
    {
      e_cal_get_timezone (source, tzid, &retval, NULL);
    }

  return retval;
}

static gboolean
calendar_appointment_collect_occurrence (ECalComponent  *component,
                                         time_t          occurrence_start,
                                         time_t          occurrence_end,
                                         gpointer        data)
{
  CalendarOccurrence *occurrence;
  GSList **collect_loc = data;

  occurrence             = g_new0 (CalendarOccurrence, 1);
  occurrence->start_time = occurrence_start;
  occurrence->end_time   = occurrence_end;

  *collect_loc = g_slist_prepend (*collect_loc, occurrence);

  return TRUE;
}

static void
calendar_appointment_generate_occurrences (CalendarAppointment *appointment,
                                           icalcomponent       *ical,
                                           ECal                *cal,
                                           time_t               start,
                                           time_t               end,
                                           icaltimezone        *default_zone)
{
  ECalComponent *ecal;

  g_assert (appointment->occurrences == NULL);

  ecal = e_cal_component_new ();
  e_cal_component_set_icalcomponent (ecal,
                                     icalcomponent_new_clone (ical));

  e_cal_recur_generate_instances (ecal,
                                  start,
                                  end,
                                  calendar_appointment_collect_occurrence,
                                  &appointment->occurrences,
                                  (ECalRecurResolveTimezoneFn) resolve_timezone_id,
                                  cal,
                                  default_zone);

  g_object_unref (ecal);

  appointment->occurrences = g_slist_reverse (appointment->occurrences);
}

static CalendarAppointment *
calendar_appointment_new (icalcomponent        *ical,
                          ECal                 *cal,
                          icaltimezone         *default_zone)
{
  CalendarAppointment *appointment;

  appointment = g_new0 (CalendarAppointment, 1);

  calendar_appointment_init (appointment,
                             ical,
                             cal,
                             default_zone);
  return appointment;
}

/* ---------------------------------------------------------------------------------------------------- */

struct _App
{
  GDBusConnection *connection;

  time_t since;
  time_t until;

  icaltimezone *zone;

  CalendarSources *sources;
  gulong sources_signal_id;

  guint                zone_listener;
  GConfClient         *gconf_client;

  /* hash from uid to CalendarAppointment objects */
  GHashTable *appointments;

  gchar *timezone_location;

  guint changed_timeout_id;

  gboolean cache_invalid;

  GList *live_views;
};

static void
app_update_timezone (App *app)
{
  gchar *location;

  location = e_cal_system_timezone_get_location ();
  if (g_strcmp0 (location, app->timezone_location) != 0)
    {
      if (location == NULL)
        app->zone = icaltimezone_get_utc_timezone ();
      else
        app->zone = icaltimezone_get_builtin_timezone (location);
      g_free (app->timezone_location);
      app->timezone_location = location;
      print_debug ("Using timezone %s", app->timezone_location);
    }
}

static gboolean
on_app_schedule_changed_cb (gpointer user_data)
{
  App *app = user_data;
  print_debug ("Emitting changed");
  g_dbus_connection_emit_signal (app->connection,
                                 NULL, /* destination_bus_name */
                                 "/org/gnome/Shell/CalendarServer",
                                 "org.gnome.Shell.CalendarServer",
                                 "Changed",
                                 NULL, /* no params */
                                 NULL);
  app->changed_timeout_id = 0;
  return FALSE;
}

static void
app_schedule_changed (App *app)
{
  print_debug ("Scheduling changed");
  if (app->changed_timeout_id == 0)
    {
      app->changed_timeout_id = g_timeout_add (2000,
                                               on_app_schedule_changed_cb,
                                               app);
    }
}

static void
invalidate_cache (App *app)
{
  app->cache_invalid = TRUE;
}

static void
on_objects_added (ECalView *view,
                  GList    *objects,
                  gpointer  user_data)
{
  App *app = user_data;
  GList *l;

  print_debug ("%s for calendar", G_STRFUNC);

  for (l = objects; l != NULL; l = l->next)
    {
      icalcomponent *ical = l->data;
      const char *uid;

      uid = icalcomponent_get_uid (ical);

      if (g_hash_table_lookup (app->appointments, uid) == NULL)
        {
          /* new appointment we don't know about => changed signal */
          invalidate_cache (app);
          app_schedule_changed (app);
        }
    }
}

static void
on_objects_modified (ECalView *view,
                     GList    *objects,
                     gpointer  user_data)
{
  App *app = user_data;
  print_debug ("%s for calendar", G_STRFUNC);
  invalidate_cache (app);
  app_schedule_changed (app);
}

static void
on_objects_removed (ECalView *view,
                    GList    *uids,
                    gpointer  user_data)
{
  App *app = user_data;
  print_debug ("%s for calendar", G_STRFUNC);
  invalidate_cache (app);
  app_schedule_changed (app);
}

static void
app_load_events (App *app)
{
  GSList *sources;
  GSList *l;
  GList *ll;
  gchar *since_iso8601;
  gchar *until_iso8601;

  /* out with the old */
  g_hash_table_remove_all (app->appointments);
  /* nuke existing views */
  for (ll = app->live_views; ll != NULL; ll = ll->next)
    {
      ECalView *view = E_CAL_VIEW (ll->data);
      g_signal_handlers_disconnect_by_func (view, on_objects_added, app);
      g_signal_handlers_disconnect_by_func (view, on_objects_modified, app);
      g_signal_handlers_disconnect_by_func (view, on_objects_removed, app);
      e_cal_view_stop (view);
      g_object_unref (view);
    }
  g_list_free (app->live_views);
  app->live_views = NULL;

  /* timezone could have changed */
  app_update_timezone (app);

  since_iso8601 = isodate_from_time_t (app->since);
  until_iso8601 = isodate_from_time_t (app->until);

  print_debug ("Loading events since %s until %s",
               since_iso8601,
               until_iso8601);

  sources = calendar_sources_get_appointment_sources (app->sources);
  for (l = sources; l != NULL; l = l->next)
    {
      ECal *cal = E_CAL (l->data);
      GError *error;
      gchar *query;
      GList *objects;
      GList *j;
      ECalView *view;

      error = NULL;
      if (!e_cal_set_default_timezone (cal, app->zone, &error))
        {
          g_printerr ("Error setting timezone on calendar: %s\n", error->message);
          g_error_free (error);
          continue;
        }

      error = NULL;
      if (!e_cal_open (cal, TRUE, &error))
        {
          g_printerr ("Error opening calendar: %s\n", error->message);
          g_error_free (error);
          continue;
        }

      query = g_strdup_printf ("occur-in-time-range? (make-time \"%s\") "
                               "(make-time \"%s\")",
                               since_iso8601,
                               until_iso8601);
      error = NULL;
      objects = NULL;
      if (!e_cal_get_object_list (cal,
                                  query,
                                  &objects,
                                  &error))
        {
          g_printerr ("Error querying calendar: %s\n", error->message);
          g_error_free (error);
          g_free (query);
          continue;
        }

      for (j = objects; j != NULL; j = j->next)
        {
          icalcomponent *ical = j->data;
          CalendarAppointment *appointment;

          appointment = calendar_appointment_new (ical, cal, app->zone);
          if (appointment == NULL)
            continue;

          calendar_appointment_generate_occurrences (appointment,
                                                     ical,
                                                     cal,
                                                     app->since,
                                                     app->until,
                                                     app->zone);
          g_hash_table_insert (app->appointments, g_strdup (appointment->uid), appointment);
        }

      e_cal_free_object_list (objects);

      error = NULL;
      if (!e_cal_get_query (cal,
                            query,
                            &view,
                            &error))
        {
          g_printerr ("Error setting up live-query on calendar: %s\n", error->message);
          g_error_free (error);
        }
      else
        {
          g_signal_connect (view,
                            "objects-added",
                            G_CALLBACK (on_objects_added),
                            app);
          g_signal_connect (view,
                            "objects-modified",
                            G_CALLBACK (on_objects_modified),
                            app);
          g_signal_connect (view,
                            "objects-removed",
                            G_CALLBACK (on_objects_removed),
                            app);
          e_cal_view_start (view);
          app->live_views = g_list_prepend (app->live_views, view);
        }

      g_free (query);
    }
  g_free (since_iso8601);
  g_free (until_iso8601);
  app->cache_invalid = FALSE;
}

static void
on_appointment_sources_changed (CalendarSources *sources,
                                gpointer         user_data)
{
  App *app = user_data;

  print_debug ("Sources changed\n");
  app_load_events (app);
}

static App *
app_new (GDBusConnection *connection)
{
  App *app;

  app = g_new0 (App, 1);
  app->connection = g_object_ref (connection);
  app->sources = calendar_sources_get ();
  app->sources_signal_id = g_signal_connect (app->sources,
                                             "appointment-sources-changed",
                                             G_CALLBACK (on_appointment_sources_changed),
                                             app);

  app->appointments = g_hash_table_new_full (g_str_hash,
                                             g_str_equal,
                                             g_free,
                                             (GDestroyNotify) calendar_appointment_free);

  app_update_timezone (app);

  return app;
}

static void
app_free (App *app)
{
  GList *ll;
  for (ll = app->live_views; ll != NULL; ll = ll->next)
    {
      ECalView *view = E_CAL_VIEW (ll->data);
      g_signal_handlers_disconnect_by_func (view, on_objects_added, app);
      g_signal_handlers_disconnect_by_func (view, on_objects_modified, app);
      g_signal_handlers_disconnect_by_func (view, on_objects_removed, app);
      e_cal_view_stop (view);
      g_object_unref (view);
    }
  g_list_free (app->live_views);

  g_free (app->timezone_location);

  g_hash_table_unref (app->appointments);

  g_object_unref (app->connection);
  g_signal_handler_disconnect (app->sources,
                               app->sources_signal_id);
  g_object_unref (app->sources);

  if (app->changed_timeout_id != 0)
    g_source_remove (app->changed_timeout_id);

  g_free (app);
}

/* ---------------------------------------------------------------------------------------------------- */

static void
handle_method_call (GDBusConnection       *connection,
                    const gchar           *sender,
                    const gchar           *object_path,
                    const gchar           *interface_name,
                    const gchar           *method_name,
                    GVariant              *parameters,
                    GDBusMethodInvocation *invocation,
                    gpointer               user_data)
{
  App *app = user_data;

  if (g_strcmp0 (method_name, "GetEvents") == 0)
    {
      GVariantBuilder builder;
      GHashTableIter hash_iter;
      CalendarAppointment *a;
      gint64 since;
      gint64 until;
      gboolean force_reload;
      gboolean window_changed;

      g_variant_get (parameters,
                     "(xxb)",
                     &since,
                     &until,
                     &force_reload);

      if (until < since)
        {
          g_dbus_method_invocation_return_dbus_error (invocation,
                                                      "org.gnome.Shell.CalendarServer.Error.Failed",
                                                      "until cannot be before since");
          goto out;
        }

      print_debug ("Handling GetEvents (since=%" G_GINT64_FORMAT ", until=%" G_GINT64_FORMAT ", force_reload=%s)",
                   since,
                   until,
                   force_reload ? "true" : "false");

      window_changed = FALSE;
      if (!(app->until == until && app->since == since))
        {
          GVariantBuilder *builder;
          GVariantBuilder *invalidated_builder;

          app->until = until;
          app->since = since;
          window_changed = TRUE;

          builder = g_variant_builder_new (G_VARIANT_TYPE ("a{sv}"));
          invalidated_builder = g_variant_builder_new (G_VARIANT_TYPE ("as"));
          g_variant_builder_add (builder, "{sv}",
                                 "Until", g_variant_new_int64 (app->until));
          g_variant_builder_add (builder, "{sv}",
                                 "Since", g_variant_new_int64 (app->since));
          g_dbus_connection_emit_signal (app->connection,
                                         NULL, /* destination_bus_name */
                                         "/org/gnome/Shell/CalendarServer",
                                         "org.freedesktop.DBus.Properties",
                                         "PropertiesChanged",
                                         g_variant_new ("(sa{sv}as)",
                                                        "org.gnome.Shell.CalendarServer",
                                                        builder,
                                                        invalidated_builder),
                                         NULL); /* GError** */
        }

      /* reload events if necessary */
      if (window_changed || force_reload || app->cache_invalid)
        {
          app_load_events (app);
        }

      /* The a{sv} is used as an escape hatch in case we want to provide more
       * information in the future without breaking ABI
       */
      g_variant_builder_init (&builder, G_VARIANT_TYPE ("a(sssbxxa{sv})"));
      g_hash_table_iter_init (&hash_iter, app->appointments);
      while (g_hash_table_iter_next (&hash_iter, NULL, (gpointer) &a))
        {
          GVariantBuilder extras_builder;
          GSList *l;

          for (l = a->occurrences; l; l = l->next)
            {
              CalendarOccurrence *o = l->data;
              time_t start_time = o->start_time;
              time_t end_time   = o->end_time;

              if ((start_time >= app->since &&
                   start_time < app->until) ||
                  (start_time <= app->since &&
                  (end_time - 1) > app->since))
                {
                  g_variant_builder_init (&extras_builder, G_VARIANT_TYPE ("a{sv}"));
                  g_variant_builder_add (&builder,
                                         "(sssbxxa{sv})",
                                         a->uid,
                                         a->summary != NULL ? a->summary : "",
                                         a->description != NULL ? a->description : "",
                                         (gboolean) a->is_all_day,
                                         (gint64) start_time,
                                         (gint64) end_time,
                                         extras_builder);
                }
            }
        }
      g_dbus_method_invocation_return_value (invocation,
                                             g_variant_new ("(a(sssbxxa{sv}))", &builder));
    }
  else
    {
      g_assert_not_reached ();
    }

 out:
  ;
}

static GVariant *
handle_get_property (GDBusConnection *connection,
                     const gchar     *sender,
                     const gchar     *object_path,
                     const gchar     *interface_name,
                     const gchar     *property_name,
                     GError         **error,
                     gpointer         user_data)
{
  App *app = user_data;
  GVariant *ret;

  ret = NULL;
  if (g_strcmp0 (property_name, "Since") == 0)
    {
      ret = g_variant_new_int64 (app->since);
    }
  else if (g_strcmp0 (property_name, "Until") == 0)
    {
      ret = g_variant_new_int64 (app->until);
    }
  else
    {
      g_assert_not_reached ();
    }
  return ret;
}

static const GDBusInterfaceVTable interface_vtable =
{
  handle_method_call,
  handle_get_property,
  NULL  /* handle_set_property */
};

static void
on_bus_acquired (GDBusConnection *connection,
                 const gchar     *name,
                 gpointer         user_data)
{
  GError *error;
  guint registration_id;

  _global_app = app_new (connection);

  error = NULL;
  registration_id = g_dbus_connection_register_object (connection,
                                                       "/org/gnome/Shell/CalendarServer",
                                                       introspection_data->interfaces[0],
                                                       &interface_vtable,
                                                       _global_app,
                                                       NULL,  /* user_data_free_func */
                                                       &error);
  if (registration_id == 0)
    {
      g_printerr ("Error exporting object: %s (%s %d)",
                  error->message,
                  g_quark_to_string (error->domain),
                  error->code);
      g_error_free (error);
      _exit (1);
    }

  print_debug ("Connected to the session bus");

}

static void
on_name_lost (GDBusConnection *connection,
              const gchar     *name,
              gpointer         user_data)
{
  g_print ("gnome-shell-calendar-server[%d]: Lost (or failed to acquire) the name " BUS_NAME " - exiting\n",
           (gint) getpid ());
  g_main_loop_quit (loop);
}

static void
on_name_acquired (GDBusConnection *connection,
                  const gchar     *name,
                  gpointer         user_data)
{
  print_debug ("Acquired the name " BUS_NAME);
}

static gboolean
stdin_channel_io_func (GIOChannel *source,
                       GIOCondition condition,
                       gpointer data)
{
  if (condition & G_IO_HUP)
    {
      g_print ("gnome-shell-calendar-server[%d]: Got HUP on stdin - exiting\n",
               (gint) getpid ());
      g_main_loop_quit (loop);
    }
  else
    {
      g_warning ("Unhandled condition %d on GIOChannel for stdin", condition);
    }
  return FALSE; /* remove source */
}

int
main (int    argc,
      char **argv)
{
  GError *error;
  GOptionContext *opt_context;
  gint ret;
  guint name_owner_id;
  GIOChannel *stdin_channel;

  ret = 1;
  loop = NULL;
  opt_context = NULL;
  name_owner_id = 0;
  stdin_channel = NULL;

  g_type_init ();

  introspection_data = g_dbus_node_info_new_for_xml (introspection_xml, NULL);
  g_assert (introspection_data != NULL);

  opt_context = g_option_context_new ("gnome-shell calendar server");
  g_option_context_add_main_entries (opt_context, opt_entries, NULL);
  error = NULL;
  if (!g_option_context_parse (opt_context, &argc, &argv, &error))
    {
      g_printerr ("Error parsing options: %s", error->message);
      g_error_free (error);
      goto out;
    }

  stdin_channel = g_io_channel_unix_new (STDIN_FILENO);
  g_io_add_watch (stdin_channel,
                  G_IO_HUP,
                  stdin_channel_io_func,
                  NULL);

  loop = g_main_loop_new (NULL, FALSE);

  name_owner_id = g_bus_own_name (G_BUS_TYPE_SESSION,
                                  BUS_NAME,
                                  G_BUS_NAME_OWNER_FLAGS_ALLOW_REPLACEMENT |
                                   (opt_replace ? G_BUS_NAME_OWNER_FLAGS_REPLACE : 0),
                                  on_bus_acquired,
                                  on_name_acquired,
                                  on_name_lost,
                                  NULL,
                                  NULL);

  g_main_loop_run (loop);

  ret = 0;

 out:
  if (stdin_channel != NULL)
    g_io_channel_unref (stdin_channel);
  if (_global_app != NULL)
    app_free (_global_app);
  if (name_owner_id != 0)
    g_bus_unown_name (name_owner_id);
  if (loop != NULL)
    g_main_loop_unref (loop);
  if (opt_context != NULL)
    g_option_context_free (opt_context);
  return ret;
}

/* ---------------------------------------------------------------------------------------------------- */

static void
print_debug (const gchar *format, ...)
{
  gchar *s;
  va_list ap;
  gchar timebuf[64];
  GTimeVal now;
  time_t now_t;
  struct tm broken_down;
  static volatile gsize once_init_value = 0;
  static gboolean show_debug = FALSE;
  static guint pid = 0;

  if (g_once_init_enter (&once_init_value))
    {
      show_debug = (g_getenv ("CALENDAR_SERVER_DEBUG") != NULL);
      pid = getpid ();
      g_once_init_leave (&once_init_value, 1);
    }

  if (!show_debug)
    goto out;

  g_get_current_time (&now);
  now_t = now.tv_sec;
  localtime_r (&now_t, &broken_down);
  strftime (timebuf, sizeof timebuf, "%H:%M:%S", &broken_down);

  va_start (ap, format);
  s = g_strdup_vprintf (format, ap);
  va_end (ap);

  g_print ("gnome-shell-calendar-server[%d]: %s.%03d: %s\n", pid, timebuf, (gint) (now.tv_usec / 1000), s);
  g_free (s);
 out:
  ;
}
