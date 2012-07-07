/*
 * Copyright (C) 2004 Free Software Foundation, Inc.
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
 * Authors:
 *     Mark McLoughlin  <mark@skynet.ie>
 *     William Jon McCann  <mccann@jhu.edu>
 *     Martin Grimme  <martin@pycage.de>
 *     Christian Kellner  <gicmo@xatom.net>
 */

#include <config.h>

#include "calendar-sources.h"

#include <libintl.h>
#include <string.h>
#include <gconf/gconf-client.h>
#define HANDLE_LIBICAL_MEMORY
#include <libecal/e-cal.h>
#include <libedataserver/e-source-list.h>
#include <libedataserverui/e-passwords.h>

#undef CALENDAR_ENABLE_DEBUG
#include "calendar-debug.h"

#ifndef _
#define _(x) gettext(x)
#endif

#ifndef N_
#define N_(x) x
#endif

#define CALENDAR_SOURCES_GET_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), CALENDAR_TYPE_SOURCES, CalendarSourcesPrivate))

#define CALENDAR_SOURCES_EVO_DIR                          "/apps/evolution"
#define CALENDAR_SOURCES_APPOINTMENT_SOURCES_KEY          CALENDAR_SOURCES_EVO_DIR "/calendar/sources"
#define CALENDAR_SOURCES_SELECTED_APPOINTMENT_SOURCES_DIR CALENDAR_SOURCES_EVO_DIR "/calendar/display"
#define CALENDAR_SOURCES_SELECTED_APPOINTMENT_SOURCES_KEY CALENDAR_SOURCES_SELECTED_APPOINTMENT_SOURCES_DIR "/selected_calendars"
#define CALENDAR_SOURCES_TASK_SOURCES_KEY                 CALENDAR_SOURCES_EVO_DIR "/tasks/sources"
#define CALENDAR_SOURCES_SELECTED_TASK_SOURCES_DIR        CALENDAR_SOURCES_EVO_DIR "/calendar/tasks"
#define CALENDAR_SOURCES_SELECTED_TASK_SOURCES_KEY        CALENDAR_SOURCES_SELECTED_TASK_SOURCES_DIR "/selected_tasks"

typedef struct _CalendarSourceData CalendarSourceData;

struct _CalendarSourceData
{
  ECalSourceType   source_type;
  CalendarSources *sources;
  guint            changed_signal;

  GSList          *clients;
  GSList          *selected_sources;
  ESourceList     *esource_list;

  guint            selected_sources_listener;
  char            *selected_sources_dir;

  guint            timeout_id;

  guint            loaded : 1;
};

struct _CalendarSourcesPrivate
{
  CalendarSourceData  appointment_sources;
  CalendarSourceData  task_sources;

  GConfClient        *gconf_client;
};

static void calendar_sources_class_init (CalendarSourcesClass *klass);
static void calendar_sources_init       (CalendarSources      *sources);
static void calendar_sources_finalize   (GObject             *object);

static void backend_died_cb (ECal *client, CalendarSourceData *source_data);
static void calendar_sources_esource_list_changed (ESourceList        *source_list,
                                                   CalendarSourceData *source_data);

enum
{
  APPOINTMENT_SOURCES_CHANGED,
  TASK_SOURCES_CHANGED,
  LAST_SIGNAL
};
static guint signals [LAST_SIGNAL] = { 0, };

static GObjectClass    *parent_class = NULL;
static CalendarSources *calendar_sources_singleton = NULL;

GType
calendar_sources_get_type (void)
{
  static GType sources_type = 0;
  
  if (!sources_type)
    {
      static const GTypeInfo sources_info =
      {
	sizeof (CalendarSourcesClass),
	NULL,		/* base_init */
	NULL,		/* base_finalize */
	(GClassInitFunc) calendar_sources_class_init,
	NULL,           /* class_finalize */
	NULL,		/* class_data */
	sizeof (CalendarSources),
	0,		/* n_preallocs */
	(GInstanceInitFunc) calendar_sources_init,
      };
      
      sources_type = g_type_register_static (G_TYPE_OBJECT,
					     "CalendarSources",
					     &sources_info, 0);
    }
  
  return sources_type;
}

static void
calendar_sources_class_init (CalendarSourcesClass *klass)
{
  GObjectClass *gobject_class = (GObjectClass *) klass;

  parent_class = g_type_class_peek_parent (klass);

  gobject_class->finalize = calendar_sources_finalize;

  g_type_class_add_private (klass, sizeof (CalendarSourcesPrivate));

  signals [APPOINTMENT_SOURCES_CHANGED] =
    g_signal_new ("appointment-sources-changed",
		  G_TYPE_FROM_CLASS (gobject_class),
		  G_SIGNAL_RUN_LAST,
		  G_STRUCT_OFFSET (CalendarSourcesClass,
				   appointment_sources_changed),
		  NULL,
		  NULL,
		  g_cclosure_marshal_VOID__VOID,
		  G_TYPE_NONE,
		  0);

  signals [TASK_SOURCES_CHANGED] =
    g_signal_new ("task-sources-changed",
		  G_TYPE_FROM_CLASS (gobject_class),
		  G_SIGNAL_RUN_LAST,
		  G_STRUCT_OFFSET (CalendarSourcesClass,
				   task_sources_changed),
		  NULL,
		  NULL,
		  g_cclosure_marshal_VOID__VOID,
		  G_TYPE_NONE,
		  0);
}

static void
calendar_sources_init (CalendarSources *sources)
{
  sources->priv = CALENDAR_SOURCES_GET_PRIVATE (sources);

  sources->priv->appointment_sources.source_type    = E_CAL_SOURCE_TYPE_EVENT;
  sources->priv->appointment_sources.sources        = sources;
  sources->priv->appointment_sources.changed_signal = signals [APPOINTMENT_SOURCES_CHANGED];
  sources->priv->appointment_sources.timeout_id     = 0;

  sources->priv->task_sources.source_type    = E_CAL_SOURCE_TYPE_TODO;
  sources->priv->task_sources.sources        = sources;
  sources->priv->task_sources.changed_signal = signals [TASK_SOURCES_CHANGED];
  sources->priv->task_sources.timeout_id     = 0;

  sources->priv->gconf_client = gconf_client_get_default ();
}

static void
calendar_sources_finalize_source_data (CalendarSources    *sources,
				       CalendarSourceData *source_data)
{
  if (source_data->loaded)
    {
      GSList *l;

      if (source_data->selected_sources_dir)
	{
	  gconf_client_remove_dir (sources->priv->gconf_client,
				   source_data->selected_sources_dir,
				   NULL);

	  g_free (source_data->selected_sources_dir);
	  source_data->selected_sources_dir = NULL;
	}

      if (source_data->selected_sources_listener)
	{
	  gconf_client_notify_remove (sources->priv->gconf_client,
				      source_data->selected_sources_listener);
	  source_data->selected_sources_listener = 0;
	}

      for (l = source_data->clients; l; l = l->next)
        {
          g_signal_handlers_disconnect_by_func (G_OBJECT (l->data),
                                                G_CALLBACK (backend_died_cb),
                                                source_data);
          g_object_unref (l->data);
        }
      g_slist_free (source_data->clients);
      source_data->clients = NULL;

      if (source_data->esource_list)
        {
          g_signal_handlers_disconnect_by_func (source_data->esource_list,
                                                G_CALLBACK (calendar_sources_esource_list_changed),
                                                source_data);
          g_object_unref (source_data->esource_list);
	}
      source_data->esource_list = NULL;

      for (l = source_data->selected_sources; l; l = l->next)
	g_free (l->data);
      g_slist_free (source_data->selected_sources);
      source_data->selected_sources = NULL;

      if (source_data->timeout_id != 0)
        {
          g_source_remove (source_data->timeout_id);
          source_data->timeout_id = 0;
        }

      source_data->loaded = FALSE;
    }
}

static void
calendar_sources_finalize (GObject *object)
{
  CalendarSources *sources = CALENDAR_SOURCES (object);

  calendar_sources_finalize_source_data (sources, &sources->priv->appointment_sources);
  calendar_sources_finalize_source_data (sources, &sources->priv->task_sources);

  if (sources->priv->gconf_client)
    g_object_unref (sources->priv->gconf_client);
  sources->priv->gconf_client = NULL;

  if (G_OBJECT_CLASS (parent_class)->finalize)
    G_OBJECT_CLASS (parent_class)->finalize (object);
}

CalendarSources *
calendar_sources_get (void)
{
  gpointer singleton_location = &calendar_sources_singleton;

  if (calendar_sources_singleton)
    return g_object_ref (calendar_sources_singleton);

  calendar_sources_singleton = g_object_new (CALENDAR_TYPE_SOURCES, NULL);
  g_object_add_weak_pointer (G_OBJECT (calendar_sources_singleton),
			     singleton_location);

  return calendar_sources_singleton;
}

static gboolean
is_source_selected (ESource *esource,
		    GSList  *selected_sources)
{
  const char *uid;
  GSList     *l;

  uid = e_source_peek_uid (esource);

  for (l = selected_sources; l; l = l->next)
    {
      const char *source = l->data;

      if (!strcmp (source, uid))
	return TRUE;
    }

  return FALSE;
}

static char *
auth_func_cb (ECal       *ecal,
	      const char *prompt,
	      const char *key,
	      gpointer    user_data)
{
	ESource *source;
	const gchar *auth_domain;
	const gchar *component_name;

	source = e_cal_get_source (ecal);
	auth_domain = e_source_get_property (source, "auth-domain");
	component_name = auth_domain ? auth_domain : "Calendar";

	return e_passwords_get_password (component_name, key);
}

/* The clients are just created here but not loaded */
static ECal *
get_ecal_from_source (ESource        *esource,
		      ECalSourceType  source_type,
		      GSList         *existing_clients)
{
  ECal *retval;

  if (existing_clients)
    {
      GSList *l;

      for (l = existing_clients; l; l = l->next)
	{
	  ECal *client = E_CAL (l->data);

	  if (e_source_equal (esource, e_cal_get_source (client)))
	    {
	      dprintf ("        load_esource: found existing source ... returning that\n");

	      return g_object_ref (client);
	    }
	}
    }

  retval = e_cal_new (esource, source_type);
  if (!retval)
    {
      g_warning ("Could not load source '%s' from '%s'\n",
		 e_source_peek_name (esource),
		 e_source_peek_relative_uri (esource));
      return NULL;
    }

  e_cal_set_auth_func (retval, auth_func_cb, NULL);

  return retval;
}

/* - Order doesn't matter
 * - Can just compare object pointers since we
 *   re-use client connections
 */
static gboolean
compare_ecal_lists (GSList *a,
		    GSList *b)
{
  GSList *l;

  if (g_slist_length (a) != g_slist_length (b))
    return FALSE;

  for (l = a; l; l = l->next)
    {
      if (!g_slist_find (b, l->data))
	return FALSE;
    }

  return TRUE;
}

static inline void
debug_dump_selected_sources (GSList *selected_sources)
{
#ifdef CALENDAR_ENABLE_DEBUG
  GSList *l;

  dprintf ("Selected sources:\n");
  for (l = selected_sources; l; l = l->next)
    {
      char *source = l->data;

      dprintf ("  %s\n", source);
    }
  dprintf ("\n");
#endif
}

static inline void
debug_dump_ecal_list (GSList *ecal_list)
{
#ifdef CALENDAR_ENABLE_DEBUG
  GSList *l;

  dprintf ("Loaded clients:\n");
  for (l = ecal_list; l; l = l->next)
    {
      ECal    *client = l->data;
      ESource *source = e_cal_get_source (client);

      dprintf ("  %s %s %s\n",
	       e_source_peek_uid (source),
	       e_source_peek_name (source),
	       e_cal_get_uri (client));
    }
#endif
}

static void
calendar_sources_load_esource_list (CalendarSourceData *source_data);

static gboolean
backend_restart (gpointer data)
{
  CalendarSourceData *source_data = data;

  calendar_sources_load_esource_list (source_data);

  source_data->timeout_id = 0;
    
  return FALSE;
}

static void
backend_died_cb (ECal *client, CalendarSourceData *source_data)
{
  const char *uristr;

  source_data->clients = g_slist_remove (source_data->clients, client);
  if (g_slist_length (source_data->clients) < 1) 
    {
      g_slist_free (source_data->clients);
      source_data->clients = NULL;
    }
  uristr = e_cal_get_uri (client);
  g_warning ("The calendar backend for %s has crashed.", uristr);

  if (source_data->timeout_id != 0)
    {
      g_source_remove (source_data->timeout_id);
      source_data->timeout_id = 0;
    }

  source_data->timeout_id = g_timeout_add_seconds (2, backend_restart,
		  				   source_data);
}

static void
calendar_sources_load_esource_list (CalendarSourceData *source_data)
{
  GSList  *clients = NULL;
  GSList  *groups, *l;
  gboolean emit_signal = FALSE;

  g_return_if_fail (source_data->esource_list != NULL);

  debug_dump_selected_sources (source_data->selected_sources);

  dprintf ("Source groups:\n");
  groups = e_source_list_peek_groups (source_data->esource_list);
  for (l = groups; l; l = l->next)
    {
      GSList *esources, *s;

      dprintf ("  %s\n", e_source_group_peek_uid (l->data));
      dprintf ("    sources:\n");

      esources = e_source_group_peek_sources (l->data);
      for (s = esources; s; s = s->next)
	{
	  ESource *esource = E_SOURCE (s->data);
	  ECal    *client;

	  dprintf ("      type = '%s' uid = '%s', name = '%s', relative uri = '%s': \n",
                   source_data->source_type == E_CAL_SOURCE_TYPE_EVENT ? "appointment" : "task",
		   e_source_peek_uid (esource),
		   e_source_peek_name (esource),
		   e_source_peek_relative_uri (esource));

	  if (is_source_selected (esource, source_data->selected_sources) &&
	      (client = get_ecal_from_source (esource, source_data->source_type, source_data->clients)))
	    {
	      clients = g_slist_prepend (clients, client);
	    }
	}
    }
  dprintf ("\n");

  if (source_data->loaded && 
      !compare_ecal_lists (source_data->clients, clients))
    emit_signal = TRUE;

  for (l = source_data->clients; l; l = l->next)
    {
      g_signal_handlers_disconnect_by_func (G_OBJECT (l->data),
                                            G_CALLBACK (backend_died_cb),
                                            source_data);

      g_object_unref (l->data);
    }
  g_slist_free (source_data->clients);
  source_data->clients = g_slist_reverse (clients);

  /* connect to backend_died after we disconnected the previous signal
   * handlers. If we do it before, we'll lose some handlers (for clients that
   * were already there before) */
  for (l = source_data->clients; l; l = l->next)
    {
      g_signal_connect (G_OBJECT (l->data), "backend_died",
                        G_CALLBACK (backend_died_cb), source_data);
    }

  if (emit_signal) 
    {
      dprintf ("Emitting %s-sources-changed signal\n",
	       source_data->source_type == E_CAL_SOURCE_TYPE_EVENT ? "appointment" : "task");
      g_signal_emit (source_data->sources, source_data->changed_signal, 0);
    }

  debug_dump_ecal_list (source_data->clients);
}

static void
calendar_sources_esource_list_changed (ESourceList        *source_list,
				       CalendarSourceData *source_data)
				       
{
  dprintf ("ESourceList changed, reloading\n");

  calendar_sources_load_esource_list (source_data);
}

static void
calendar_sources_selected_sources_notify (GConfClient        *client,
					  guint               cnx_id,
					  GConfEntry         *entry,
					  CalendarSourceData *source_data)
{
  GSList *l;

  if (!entry->value ||
      entry->value->type != GCONF_VALUE_LIST ||
      gconf_value_get_list_type (entry->value) != GCONF_VALUE_STRING)
    return;

  dprintf ("Selected sources key (%s) changed, reloading\n", entry->key);

  for (l = source_data->selected_sources; l; l = l->next)
    g_free (l->data);
  source_data->selected_sources = NULL;

  for (l = gconf_value_get_list (entry->value); l; l = l->next)
    {
      const char *source = gconf_value_get_string (l->data);

      source_data->selected_sources = 
	g_slist_prepend (source_data->selected_sources,
			 g_strdup (source));
    }
  source_data->selected_sources =
    g_slist_reverse (source_data->selected_sources);

  calendar_sources_load_esource_list (source_data);
}

static void
calendar_sources_load_sources (CalendarSources    *sources,
			       CalendarSourceData *source_data,
			       const char         *sources_key,
			       const char         *selected_sources_key,
			       const char         *selected_sources_dir)
{
  GConfClient *gconf_client;
  GError      *error;

  dprintf ("---------------------------\n");
  dprintf ("Loading sources:\n");
  dprintf ("  sources_key: %s\n", sources_key);
  dprintf ("  selected_sources_key: %s\n", selected_sources_key);
  dprintf ("  selected_sources_dir: %s\n", selected_sources_dir);

  gconf_client = sources->priv->gconf_client;

  error = NULL;
  source_data->selected_sources = gconf_client_get_list (gconf_client,
							 selected_sources_key,
							 GCONF_VALUE_STRING,
							 &error);
  if (error)
    {
      g_warning ("Failed to get selected sources from '%s': %s\n",
		 selected_sources_key,
		 error->message);
      g_error_free (error);
      return;
    }

  gconf_client_add_dir (gconf_client,
			selected_sources_dir,
			GCONF_CLIENT_PRELOAD_NONE,
			NULL);
  source_data->selected_sources_dir = g_strdup (selected_sources_dir);

  source_data->selected_sources_listener =
    gconf_client_notify_add (gconf_client,
			     selected_sources_dir,
			     (GConfClientNotifyFunc) calendar_sources_selected_sources_notify,
			     source_data, NULL, NULL);

  source_data->esource_list = e_source_list_new_for_gconf (gconf_client, sources_key);
  g_signal_connect (source_data->esource_list, "changed",
		    G_CALLBACK (calendar_sources_esource_list_changed),
		    source_data);

  calendar_sources_load_esource_list (source_data);

  source_data->loaded = TRUE;

  dprintf ("---------------------------\n");
}

GSList *
calendar_sources_get_appointment_sources (CalendarSources *sources)
{
  g_return_val_if_fail (CALENDAR_IS_SOURCES (sources), NULL);

  if (!sources->priv->appointment_sources.loaded)
    {
      calendar_sources_load_sources (sources,
				     &sources->priv->appointment_sources,
				     CALENDAR_SOURCES_APPOINTMENT_SOURCES_KEY,
				     CALENDAR_SOURCES_SELECTED_APPOINTMENT_SOURCES_KEY,
				     CALENDAR_SOURCES_SELECTED_APPOINTMENT_SOURCES_DIR);
    }
  
  return sources->priv->appointment_sources.clients;
}

GSList *
calendar_sources_get_task_sources (CalendarSources *sources)
{
  g_return_val_if_fail (CALENDAR_IS_SOURCES (sources), NULL);

  if (!sources->priv->task_sources.loaded)
    {
      calendar_sources_load_sources (sources,
				     &sources->priv->task_sources,
				     CALENDAR_SOURCES_TASK_SOURCES_KEY,
				     CALENDAR_SOURCES_SELECTED_TASK_SOURCES_KEY,
				     CALENDAR_SOURCES_SELECTED_TASK_SOURCES_DIR);
    }

  return sources->priv->task_sources.clients;
}
