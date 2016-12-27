/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

/*
 * Copyright (C) 20011 Red Hat, Inc.
 *
 * Author: David Zeuthen <davidz@redhat.com>
 */

#include "config.h"

#include <pwd.h>

#include "cinnamon-marshal.h"

#define POLKIT_AGENT_I_KNOW_API_IS_SUBJECT_TO_CHANGE
#include <polkitagent/polkitagent.h>
#include "cinnamon-polkit-authentication-agent.h"

#include <glib/gi18n.h>

/* uncomment for useful debug output */
/* #define SHOW_DEBUG */

#ifdef SHOW_DEBUG
static void
print_debug (const gchar *format, ...)
{
  gchar *s;
  va_list ap;
  gchar timebuf[64];
  GTimeVal now;
  time_t now_t;
  struct tm broken_down;

  g_get_current_time (&now);
  now_t = now.tv_sec;
  localtime_r (&now_t, &broken_down);
  strftime (timebuf, sizeof timebuf, "%H:%M:%S", &broken_down);

  va_start (ap, format);
  s = g_strdup_vprintf (format, ap);
  va_end (ap);

  g_print ("CinnamonPolkitAuthenticationAgent: %s.%03d: %s\n", timebuf, (gint) (now.tv_usec / 1000), s);
  g_free (s);
}
#else
static void
print_debug (const gchar *str, ...)
{
}
#endif


struct _CinnamonPolkitAuthenticationAgentClass
{
  PolkitAgentListenerClass parent_class;
};

struct _AuthRequest;
typedef struct _AuthRequest AuthRequest;

struct _CinnamonPolkitAuthenticationAgent {
  PolkitAgentListener parent_instance;

  GList *scheduled_requests;

  AuthRequest *current_request;
};

/* Signals */
enum
{
  INITIATE_SIGNAL,
  CANCEL_SIGNAL,
  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0 };

G_DEFINE_TYPE (CinnamonPolkitAuthenticationAgent, cinnamon_polkit_authentication_agent, POLKIT_AGENT_TYPE_LISTENER);

static void initiate_authentication (PolkitAgentListener  *listener,
                                     const gchar          *action_id,
                                     const gchar          *message,
                                     const gchar          *icon_name,
                                     PolkitDetails        *details,
                                     const gchar          *cookie,
                                     GList                *identities,
                                     GCancellable         *cancellable,
                                     GAsyncReadyCallback   callback,
                                     gpointer              user_data);

static gboolean initiate_authentication_finish (PolkitAgentListener  *listener,
                                                GAsyncResult         *res,
                                                GError              **error);

static void
cinnamon_polkit_authentication_agent_init (CinnamonPolkitAuthenticationAgent *agent)
{
  gpointer handle;
  PolkitSubject *subject;
  GError *error;

  subject = NULL;

  error = NULL;
  subject = polkit_unix_session_new_for_process_sync (getpid (),
                                                      NULL, /* GCancellable* */
                                                      &error);
  if (subject == NULL)
    {
      g_warning ("Error getting session for the process we are in: %s (%s %d)",
                 error->message,
                 g_quark_to_string (error->domain),
                 error->code);
      g_error_free (error);
      goto out;
    }

  handle = polkit_agent_listener_register (POLKIT_AGENT_LISTENER (agent),
                                           POLKIT_AGENT_REGISTER_FLAGS_NONE,
                                           subject,
                                           NULL, /* use default object path */
                                           NULL, /* GCancellable */
                                           &error);
  if (handle == NULL)
    {
      g_warning ("Error registering polkit authentication agent: %s (%s %d)",
                 error->message,
                 g_quark_to_string (error->domain),
                 error->code);
      g_error_free (error);
      goto out;
    }

  /* We don't need to register so skip saving handle */

 out:
  if (subject != NULL)
    g_object_unref (subject);
}

static void
cinnamon_polkit_authentication_agent_finalize (GObject *object)
{
  /* CinnamonPolkitAuthenticationAgent *agent = CINNAMON_POLKIT_AUTHENTICATION_AGENT (object); */

  /* Specifically left empty since the object stays alive forever - if code
   *  is reused it would need to free outstanding requests etc.
   */

  G_OBJECT_CLASS (cinnamon_polkit_authentication_agent_parent_class)->finalize (object);
}

static void
cinnamon_polkit_authentication_agent_class_init (CinnamonPolkitAuthenticationAgentClass *klass)
{
  GObjectClass *gobject_class;
  PolkitAgentListenerClass *listener_class;

  gobject_class = G_OBJECT_CLASS (klass);
  gobject_class->finalize = cinnamon_polkit_authentication_agent_finalize;

  listener_class = POLKIT_AGENT_LISTENER_CLASS (klass);
  listener_class->initiate_authentication = initiate_authentication;
  listener_class->initiate_authentication_finish = initiate_authentication_finish;

  signals[INITIATE_SIGNAL] =
    g_signal_new ("initiate",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,    /* class_offset */
                  NULL, /* accumulator */
                  NULL, /* accumulator data */
                  _cinnamon_marshal_VOID__STRING_STRING_STRING_STRING_BOXED,
                  G_TYPE_NONE,
                  5,
                  G_TYPE_STRING,
                  G_TYPE_STRING,
                  G_TYPE_STRING,
                  G_TYPE_STRING,
                  G_TYPE_STRV);

  signals[CANCEL_SIGNAL] =
    g_signal_new ("cancel",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0,    /* class_offset */
                  NULL, /* accumulator */
                  NULL, /* accumulator data */
                  g_cclosure_marshal_VOID__VOID,
                  G_TYPE_NONE,
                  0);
}

CinnamonPolkitAuthenticationAgent *
cinnamon_polkit_authentication_agent_new (void)
{
  return CINNAMON_POLKIT_AUTHENTICATION_AGENT (g_object_new (CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT, NULL));
}

struct _AuthRequest {
  /* not holding ref */
  CinnamonPolkitAuthenticationAgent *agent;
  GCancellable *cancellable;
  gulong handler_id;

  /* copies */
  gchar          *action_id;
  gchar          *message;
  gchar          *icon_name;
  PolkitDetails  *details;
  gchar          *cookie;
  GList          *identities;

  GSimpleAsyncResult *simple;
};

static void
auth_request_free (AuthRequest *request)
{
  g_cancellable_disconnect (request->cancellable, request->handler_id);
  g_free (request->action_id);
  g_free (request->message);
  g_free (request->icon_name);
  g_object_unref (request->details);
  g_list_foreach (request->identities, (GFunc) g_object_unref, NULL);
  g_list_free (request->identities);
  g_object_unref (request->simple);
  g_free (request);
}

static void
auth_request_initiate (AuthRequest *request)
{
  gchar **user_names;
  GPtrArray *p;
  GList *l;

  p = g_ptr_array_new ();
  for (l = request->identities; l != NULL; l = l->next)
    {
      if (POLKIT_IS_UNIX_USER (l->data))
        {
          PolkitUnixUser *user = POLKIT_UNIX_USER (l->data);
          gint uid;
          gchar buf[4096];
          struct passwd pwd;
          struct passwd *ppwd;

          uid = polkit_unix_user_get_uid (user);
          if (getpwuid_r (uid, &pwd, buf, sizeof (buf), &ppwd) == 0)
            {
              if (!g_utf8_validate (pwd.pw_name, -1, NULL))
                {
                  g_warning ("Invalid UTF-8 in username for uid %d. Skipping", uid);
                }
              else
                {
                  g_ptr_array_add (p, g_strdup (pwd.pw_name));
                }
            }
          else
            {
              g_warning ("Error looking up user name for uid %d", uid);
            }
        }
      else
        {
          g_warning ("Unsupporting identity of GType %s", g_type_name (G_TYPE_FROM_INSTANCE (l->data)));
        }
    }
  g_ptr_array_add (p, NULL);
  user_names = (gchar **) g_ptr_array_free (p, FALSE);
  g_signal_emit (request->agent,
                 signals[INITIATE_SIGNAL],
                 0, /* detail */
                 request->action_id,
                 request->message,
                 request->icon_name,
                 request->cookie,
                 user_names);
  g_strfreev (user_names);
}

static void auth_request_complete (AuthRequest *request,
                                   gboolean     dismissed);

static gboolean
handle_cancelled_in_idle (gpointer user_data)
{
  AuthRequest *request = user_data;

  print_debug ("CANCELLED %s cookie %s", request->action_id, request->cookie);
  if (request == request->agent->current_request)
    {
      g_signal_emit (request->agent,
                     signals[CANCEL_SIGNAL],
                     0); /* detail */
    }
  else
    {
      auth_request_complete (request, FALSE);
    }

  return FALSE;
}

static void
on_request_cancelled (GCancellable *cancellable,
                      gpointer      user_data)
{
  AuthRequest *request = user_data;
  /* post-pone to idle to handle GCancellable deadlock in
   *
   *  https://bugzilla.gnome.org/show_bug.cgi?id=642968
   */
  g_idle_add (handle_cancelled_in_idle, request);
}

static void maybe_process_next_request (CinnamonPolkitAuthenticationAgent *agent);

static void
auth_request_complete (AuthRequest *request,
                       gboolean     dismissed)
{
  CinnamonPolkitAuthenticationAgent *agent = request->agent;

  if (dismissed)
    g_simple_async_result_set_error (request->simple,
                                     POLKIT_ERROR,
                                     POLKIT_ERROR_CANCELLED,
                                     _("Authentication dialog was dismissed by the user"));

  if (agent->current_request == request)
    {
      print_debug ("COMPLETING CURRENT %s cookie %s", request->action_id, request->cookie);

      g_simple_async_result_complete_in_idle (request->simple);
      auth_request_free (request);

      agent->current_request = NULL;

      maybe_process_next_request (agent);
    }
  else
    {
      print_debug ("COMPLETING SCHEDULED %s cookie %s", request->action_id, request->cookie);
      agent->scheduled_requests = g_list_remove (agent->scheduled_requests, request);
      g_simple_async_result_complete_in_idle (request->simple);
      auth_request_free (request);
    }
}

static void
maybe_process_next_request (CinnamonPolkitAuthenticationAgent *agent)
{
  print_debug ("MAYBE_PROCESS cur=%p len(scheduled)=%d", agent->current_request, g_list_length (agent->scheduled_requests));

  if (agent->current_request == NULL && agent->scheduled_requests != NULL)
    {
      AuthRequest *request;

      request = agent->scheduled_requests->data;

      agent->current_request = request;
      agent->scheduled_requests = g_list_remove (agent->scheduled_requests, request);

      print_debug ("INITIATING %s cookie %s", request->action_id, request->cookie);
      auth_request_initiate (request);
    }
}

static void
initiate_authentication (PolkitAgentListener  *listener,
                         const gchar          *action_id,
                         const gchar          *message,
                         const gchar          *icon_name,
                         PolkitDetails        *details,
                         const gchar          *cookie,
                         GList                *identities,
                         GCancellable         *cancellable,
                         GAsyncReadyCallback   callback,
                         gpointer              user_data)
{
  CinnamonPolkitAuthenticationAgent *agent = CINNAMON_POLKIT_AUTHENTICATION_AGENT (listener);
  AuthRequest *request;

  request = g_new0 (AuthRequest, 1);
  request->agent = agent;
  request->action_id = g_strdup (action_id);
  request->message = g_strdup (message);
  request->icon_name = g_strdup (icon_name);
  request->details = g_object_ref (details);
  request->cookie = g_strdup (cookie);
  request->identities = g_list_copy (identities);
  g_list_foreach (request->identities, (GFunc) g_object_ref, NULL);
  request->simple = g_simple_async_result_new (G_OBJECT (listener),
                                               callback,
                                               user_data,
                                               initiate_authentication);
  request->cancellable = cancellable;
  request->handler_id = g_cancellable_connect (request->cancellable,
                                               G_CALLBACK (on_request_cancelled),
                                               request,
                                               NULL); /* GDestroyNotify for request */

  print_debug ("SCHEDULING %s cookie %s", request->action_id, request->cookie);
  agent->scheduled_requests = g_list_append (agent->scheduled_requests, request);

  maybe_process_next_request (agent);
}

static gboolean
initiate_authentication_finish (PolkitAgentListener  *listener,
                                GAsyncResult         *res,
                                GError              **error)
{
  GSimpleAsyncResult *simple = G_SIMPLE_ASYNC_RESULT (res);
  if (g_simple_async_result_propagate_error (simple, error))
    return FALSE;
  else
    return TRUE;
}

void
cinnamon_polkit_authentication_agent_complete (CinnamonPolkitAuthenticationAgent *agent,
                                            gboolean                        dismissed)
{
  g_return_if_fail (CINNAMON_IS_POLKIT_AUTHENTICATION_AGENT (agent));
  g_return_if_fail (agent->current_request != NULL);

  auth_request_complete (agent->current_request, dismissed);
}
