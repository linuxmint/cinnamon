/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
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
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA
 * 02110-1335, USA.
 *
 * Authors: David Zeuthen <davidz@redhat.com>
 *          Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

#include "cinnamon-mime-sniffer.h"
#include "hotplug-mimetypes.h"

/* Set the environment variable HOTPLUG_SNIFFER_DEBUG to show debug */
static void print_debug (const gchar *str, ...);

#define BUS_NAME "org.Cinnamon.HotplugSniffer"
#define AUTOQUIT_TIMEOUT 5

static const gchar introspection_xml[] =
  "<node>"
  "  <interface name='org.Cinnamon.HotplugSniffer'>"
  "    <method name='SniffURI'>"
  "      <arg type='s' name='uri' direction='in'/>"
  "      <arg type='as' name='content_types' direction='out'/>"
  "    </method>"
  "  </interface>"
  "</node>";

static GDBusNodeInfo *introspection_data = NULL;
static GMainLoop     *loop = NULL;
static guint          autoquit_id = 0;

static gboolean
autoquit_timeout_cb (gpointer _unused)
{
  print_debug ("Timeout reached, quitting...");

  autoquit_id = 0;
  g_main_loop_quit (loop);

  return FALSE;
}

static void
ensure_autoquit_off (void)
{
  if (g_getenv ("HOTPLUG_SNIFFER_PERSIST") != NULL)
    return;

  if (autoquit_id != 0)
    {
      g_source_remove (autoquit_id);
      autoquit_id = 0;
    }
}

static void
ensure_autoquit_on (void)
{
  if (g_getenv ("HOTPLUG_SNIFFER_PERSIST") != NULL)
    return;

  autoquit_id = 
    g_timeout_add_seconds (AUTOQUIT_TIMEOUT,
                           autoquit_timeout_cb, NULL);
}

typedef struct {
  GVariant *parameters;
  GDBusMethodInvocation *invocation;
} InvocationData;

static InvocationData *
invocation_data_new (GVariant *params,
                     GDBusMethodInvocation *invocation)
{
  InvocationData *ret;

  ret = g_slice_new0 (InvocationData);
  ret->parameters = g_variant_ref (params);
  ret->invocation = g_object_ref (invocation);

  return ret;
}

static void
invocation_data_free (InvocationData *data)
{
  g_variant_unref (data->parameters);
  g_clear_object (&data->invocation);

  g_slice_free (InvocationData, data);
}

static void
sniff_async_ready_cb (GObject *source,
                      GAsyncResult *res,
                      gpointer user_data)
{
  InvocationData *data = user_data;
  gchar **types;
  GError *error = NULL;

  types = cinnamon_mime_sniffer_sniff_finish (CINNAMON_MIME_SNIFFER (source),
                                           res, &error);

  if (error != NULL)
    {
      g_dbus_method_invocation_return_gerror (data->invocation, error);
      g_error_free (error);
      goto out;
    }

  g_dbus_method_invocation_return_value (data->invocation,
                                         g_variant_new ("(^as)", types));

 out:
  g_strfreev (types);
  invocation_data_free (data);
  ensure_autoquit_on ();
}

static void
handle_sniff_uri (InvocationData *data)
{
  CinnamonMimeSniffer *sniffer;
  const gchar *uri;
  GFile *file;

  ensure_autoquit_off ();

  g_variant_get (data->parameters, 
                 "(&s)", &uri,
                 NULL);
  file = g_file_new_for_uri (uri);

  print_debug ("Initiating sniff for uri %s", uri);

  sniffer = cinnamon_mime_sniffer_new (file);
  cinnamon_mime_sniffer_sniff_async (sniffer,
                                  sniff_async_ready_cb,
                                  data);

  g_object_unref (sniffer);
  g_object_unref (file);
}

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
  InvocationData *data;

  data = invocation_data_new (parameters, invocation);

  if (g_strcmp0 (method_name, "SniffURI") == 0)
    handle_sniff_uri (data);
  else
    g_assert_not_reached ();
}

static const GDBusInterfaceVTable interface_vtable =
{
  handle_method_call,
  NULL, /* get_property */
  NULL, /* set_property */
};

static void
on_bus_acquired (GDBusConnection *connection,
                 const gchar *name,
                 gpointer user_data)
{
  GError *error = NULL;

  print_debug ("Connected to the session bus: %s", name);

  g_dbus_connection_register_object (connection,
                                     "/org/Cinnamon/HotplugSniffer",
                                     introspection_data->interfaces[0],
                                     &interface_vtable,
                                     NULL,
                                     NULL,
                                     &error);

  if (error != NULL)
    {
      g_printerr ("Error exporting object on the session bus: %s",
                  error->message);
      g_error_free (error);

      _exit(1);
    }

  print_debug ("Object exported on the session bus");
}

static void
on_name_lost (GDBusConnection *connection,
              const gchar *name,
              gpointer user_data)
{
  print_debug ("Lost bus name: %s, exiting", name);

  g_main_loop_quit (loop);
}

static void
on_name_acquired (GDBusConnection *connection,
                  const gchar *name,
                  gpointer user_data)
{
  print_debug ("Acquired bus name: %s", name);
}

int
main (int    argc,
      char **argv)
{
  guint name_owner_id;

  introspection_data = g_dbus_node_info_new_for_xml (introspection_xml, NULL);
  g_assert (introspection_data != NULL);

  ensure_autoquit_on ();
  loop = g_main_loop_new (NULL, FALSE);

  name_owner_id = g_bus_own_name (G_BUS_TYPE_SESSION,
                                  BUS_NAME, 0,
                                  on_bus_acquired,
                                  on_name_acquired,
                                  on_name_lost,
                                  NULL,
                                  NULL);

  g_main_loop_run (loop);

  if (name_owner_id != 0)
    g_bus_unown_name (name_owner_id);

  if (loop != NULL)
    g_main_loop_unref (loop);

  return 0;
}

/* ---------------------------------------------------------------------------------------------------- */

static void
print_debug (const gchar *format, ...)
{
  g_autofree char *s = NULL;
  g_autofree char *timestamp = NULL;
  va_list ap;
  g_autoptr (GDateTime) now = NULL;
  static size_t once_init_value = 0;
  static gboolean show_debug = FALSE;
  static guint pid = 0;

  if (g_once_init_enter (&once_init_value))
    {
      show_debug = (g_getenv ("HOTPLUG_SNIFFER_DEBUG") != NULL);
      pid = getpid ();
      g_once_init_leave (&once_init_value, 1);
    }

  if (!show_debug)
    goto out;

  now = g_date_time_new_now_local ();
  timestamp = g_date_time_format (now, "%H:%M:%S");

  va_start (ap, format);
  s = g_strdup_vprintf (format, ap);
  va_end (ap);

  g_print ("cinnamon-hotplug-sniffer[%d]: %s.%03d: %s\n",
           pid, timestamp, g_date_time_get_microsecond (now), s);
 out:
  ;
}

