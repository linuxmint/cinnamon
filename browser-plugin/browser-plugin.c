/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Copyright (C) 2011 Red Hat
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
 *      Jasper St. Pierre <jstpierre@mecheye.net>
 *      Giovanni Campagna <scampa.giovanni@gmail.com>
 */

#include <string.h>

#define XP_UNIX 1

#include "npapi/npapi.h"
#include "npapi/npruntime.h"
#include "npapi/npfunctions.h"

#include <glib.h>
#include <gio/gio.h>
#include <json-glib/json-glib.h>

#define ORIGIN "extensions.gnome.org"
#define PLUGIN_NAME "Gnome Shell Integration"
#define PLUGIN_DESCRIPTION "This plugin provides integration with Gnome Shell " \
      "for live extension enabling and disabling. " \
      "It can be used only by extensions.gnome.org"
#define PLUGIN_MIME_STRING "application/x-gnome-shell-integration::Gnome Shell Integration Dummy Content-Type";

#define PLUGIN_API_VERSION 1

typedef struct {
  GDBusProxy *proxy;
} PluginData;

/* =============== public entry points =================== */

static NPNetscapeFuncs funcs;

static inline gchar *
get_string_property (NPP         instance,
                     NPObject   *obj,
                     const char *name)
{
  NPVariant result = { NPVariantType_Void };
  NPString result_str;
  gchar *result_copy;

  result_copy = NULL;

  if (!funcs.getproperty (instance, obj,
                          funcs.getstringidentifier (name),
                          &result))
    goto out;

  if (!NPVARIANT_IS_STRING (result))
    goto out;

  result_str = NPVARIANT_TO_STRING (result);
  if (strlen (result_str.UTF8Characters) != result_str.UTF8Length)
    goto out;

  result_copy = g_strdup (result_str.UTF8Characters);

 out:
  funcs.releasevariantvalue (&result);
  return result_copy;
}

static gboolean
check_origin_and_protocol (NPP instance)
{
  gboolean ret = FALSE;
  NPError error;
  NPObject *window = NULL;
  NPVariant document = { NPVariantType_Void };
  NPVariant location = { NPVariantType_Void };
  gchar *hostname = NULL;
  gchar *protocol = NULL;

  error = funcs.getvalue (instance, NPNVWindowNPObject, &window);
  if (error != NPERR_NO_ERROR)
    goto out;

  if (!funcs.getproperty (instance, window,
                          funcs.getstringidentifier ("document"),
                          &document))
    goto out;

  if (!NPVARIANT_IS_OBJECT (document))
    goto out;

  if (!funcs.getproperty (instance, NPVARIANT_TO_OBJECT (document),
                          funcs.getstringidentifier ("location"),
                          &location))
    goto out;

  if (!NPVARIANT_IS_OBJECT (document))
    goto out;

  hostname = get_string_property (instance,
                                  NPVARIANT_TO_OBJECT (location),
                                  "hostname");

  if (g_strcmp0 (hostname, ORIGIN))
    {
      g_debug ("origin does not match, is %s",
               hostname);

      goto out;
    }

  protocol = get_string_property (instance,
                                  NPVARIANT_TO_OBJECT (location),
                                  "protocol");

  if (g_strcmp0 (protocol, "https:") != 0)
    {
      g_debug ("protocol does not match, is %s",
               protocol);

      goto out;
    }

  ret = TRUE;

 out:
  g_free (protocol);
  g_free (hostname);

  funcs.releasevariantvalue (&location);
  funcs.releasevariantvalue (&document);

  if (window != NULL)
    funcs.releaseobject (window);
  return ret;
}

NPError
NP_Initialize(NPNetscapeFuncs *pfuncs, NPPluginFuncs *plugin)
{
  /* global initialization routine, called once when plugin
     is loaded */

  g_debug ("plugin loaded");

  memcpy (&funcs, pfuncs, sizeof (funcs));

  plugin->size = sizeof(NPPluginFuncs);
  plugin->newp = NPP_New;
  plugin->destroy = NPP_Destroy;
  plugin->getvalue = NPP_GetValue;

  return NPERR_NO_ERROR;
}

NPError
NP_Shutdown(void)
{
  return NPERR_NO_ERROR;
}

const char*
NP_GetMIMEDescription(void)
{
  return PLUGIN_MIME_STRING;
}

NPError
NP_GetValue(void         *instance,
            NPPVariable   variable,
            void         *value)
{
  switch (variable) {
  case NPPVpluginNameString:
    *(char**)value = PLUGIN_NAME;
    break;
  case NPPVpluginDescriptionString:
    *(char**)value = PLUGIN_DESCRIPTION;
    break;
  default:
    ;
  }

  return NPERR_NO_ERROR;
}

NPError
NPP_New(NPMIMEType    mimetype,
        NPP           instance,
        uint16_t      mode,
        int16_t       argc,
        char        **argn,
        char        **argv,
        NPSavedData  *saved)
{
  /* instance initialization function */
  PluginData *data;
  GError *error = NULL;

  g_debug ("plugin created");

  if (!check_origin_and_protocol (instance))
    return NPERR_GENERIC_ERROR;

  data = g_slice_new (PluginData);
  instance->pdata = data;

  data->proxy = g_dbus_proxy_new_for_bus_sync (G_BUS_TYPE_SESSION,
                                               G_DBUS_PROXY_FLAGS_NONE,
                                               NULL, /* interface info */
                                               "org.gnome.Shell",
                                               "/org/gnome/Shell",
                                               "org.gnome.Shell",
                                               NULL, /* GCancellable */
                                               &error);
  if (!data->proxy)
    {
      /* ignore error if the shell is not running, otherwise warn */
      if (error->domain != G_DBUS_ERROR ||
          error->code != G_DBUS_ERROR_NAME_HAS_NO_OWNER)
        {
          g_warning ("Failed to set up Shell proxy: %s", error->message);
        }
      g_clear_error (&error);
      return NPERR_GENERIC_ERROR;
    }

  g_debug ("plugin created successfully");

  return NPERR_NO_ERROR;
}

NPError
NPP_Destroy(NPP           instance,
	    NPSavedData **saved)
{
  /* instance finalization function */

  PluginData *data = instance->pdata;

  g_debug ("plugin destroyed");

  g_object_unref (data->proxy);

  g_slice_free (PluginData, data);

  return NPERR_NO_ERROR;
}

/* =================== scripting interface =================== */

typedef struct {
	NPObject     parent;
	NPP          instance;
	GDBusProxy  *proxy;
	NPObject    *listener;
	gint         signal_id;
} PluginObject;

static void
on_shell_signal (GDBusProxy *proxy,
                 gchar      *sender_name,
                 gchar      *signal_name,
                 GVariant   *parameters,
                 gpointer    user_data)
{
  PluginObject *obj = user_data;

  if (strcmp (signal_name, "ExtensionStatusChanged") == 0)
    {
      gchar *uuid;
      gint32 status;
      gchar *error;
      NPVariant args[3];
      NPVariant result;

      g_variant_get (parameters, "(sis)", &uuid, &status, &error);
      STRINGZ_TO_NPVARIANT (uuid, args[0]);
      INT32_TO_NPVARIANT (status, args[1]);
      STRINGZ_TO_NPVARIANT (error, args[2]);

      funcs.invokeDefault (obj->instance, obj->listener,
			   args, 3, &result);

      funcs.releasevariantvalue (&result);
      g_free (uuid);
      g_free (error);
    }
}

static NPObject *
plugin_object_allocate (NPP      instance,
                        NPClass *klass)
{
  PluginData *data = instance->pdata;
  PluginObject *obj = g_slice_new0 (PluginObject);

  obj->instance = instance;
  obj->proxy = g_object_ref (data->proxy);
  obj->signal_id = g_signal_connect (obj->proxy, "g-signal",
                                     G_CALLBACK (on_shell_signal), obj);

  g_debug ("plugin object created");

  return (NPObject*)obj;
}

static void
plugin_object_deallocate (NPObject *npobj)
{
  PluginObject *obj = (PluginObject*)npobj;

  g_signal_handler_disconnect (obj->proxy, obj->signal_id);
  g_object_unref (obj->proxy);

  if (obj->listener)
    funcs.releaseobject (obj->listener);

  g_debug ("plugin object destroyed");

  g_slice_free (PluginObject, obj);
}

static NPIdentifier api_version_id;
static NPIdentifier shell_version_id;
static NPIdentifier get_info_id;
static NPIdentifier list_extensions_id;
static NPIdentifier enable_extension_id;
static NPIdentifier install_extension_id;
static NPIdentifier uninstall_extension_id;
static NPIdentifier onextension_changed_id;
static NPIdentifier get_errors_id;

static bool
plugin_object_has_method (NPObject     *npobj,
                          NPIdentifier  name)
{
  return (name == get_info_id ||
          name == list_extensions_id ||
          name == enable_extension_id ||
          name == install_extension_id ||
          name == uninstall_extension_id ||
          name == get_errors_id);
}

static inline gboolean
uuid_is_valid (const gchar *uuid)
{
  gsize i;

  for (i = 0; uuid[i]; i ++)
    {
      gchar c = uuid[i];
      if (c < 32 || c >= 127)
        return FALSE;

      switch (c)
        {
        case '&':
        case '<':
        case '>':
        case '/':
        case '\\':
          return FALSE;
        default:
          break;
        }
    }
  return TRUE;
}

static gboolean
jsonify_variant (GVariant  *variant,
                 NPVariant *result)
{
  gboolean ret;
  GVariant *real_value;
  JsonNode *root;
  JsonGenerator *generator;
  gsize json_length;
  gchar *json;
  gchar *buffer;

  ret = TRUE;

  /* DBus methods can return multiple values,
   * but we're only interested in the first. */
  g_variant_get (variant, "(@*)", &real_value);

  root = json_gvariant_serialize (real_value);

  generator = json_generator_new ();
  json_generator_set_root (generator, root);
  json = json_generator_to_data (generator, &json_length);

  buffer = funcs.memalloc (json_length + 1);
  if (!buffer)
    {
      ret = FALSE;
      goto out;
    }

  strcpy (buffer, json);

  STRINGN_TO_NPVARIANT (buffer, json_length, *result);

 out:
  g_variant_unref (variant);
  g_variant_unref (real_value);
  json_node_free (root);
  g_free (json);

  return ret;
}

static gboolean
plugin_list_extensions (PluginObject  *obj,
                        NPVariant     *result)
{
  GError *error = NULL;
  GVariant *res;

  res = g_dbus_proxy_call_sync (obj->proxy,
                                "ListExtensions",
                                NULL, /* parameters */
                                G_DBUS_CALL_FLAGS_NONE,
                                -1, /* timeout */
                                NULL, /* cancellable */
                                &error);

  if (!res)
    {
      g_warning ("Failed to retrieve extension list: %s", error->message);
      g_error_free (error);
      return FALSE;
    }

  return jsonify_variant (res, result);
}

static gboolean
plugin_enable_extension (PluginObject *obj,
                         NPString      uuid,
                         gboolean      enabled)
{
  const gchar *uuid_str = uuid.UTF8Characters;
  if (!uuid_is_valid (uuid_str))
    return FALSE;

  g_dbus_proxy_call (obj->proxy,
                     (enabled ? "EnableExtension" : "DisableExtension"),
                     g_variant_new ("(s)", uuid_str),
                     G_DBUS_CALL_FLAGS_NONE,
                     -1, /* timeout */
                     NULL, /* cancellable */
                     NULL, /* callback */
                     NULL /* user_data */);

  return TRUE;
}

static gboolean
plugin_install_extension (PluginObject *obj,
                          NPString      uuid,
                          NPString      version_tag)
{
  const gchar *uuid_str = uuid.UTF8Characters;
  if (!uuid_is_valid (uuid_str))
    return FALSE;

  g_dbus_proxy_call (obj->proxy,
                     "InstallRemoteExtension",
                     g_variant_new ("(ss)",
                                    uuid_str,
                                    version_tag.UTF8Characters),
                     G_DBUS_CALL_FLAGS_NONE,
                     -1, /* timeout */
                     NULL, /* cancellable */
                     NULL, /* callback */
                     NULL /* user_data */);

  return TRUE;
}

static gboolean
plugin_uninstall_extension (PluginObject *obj,
                            NPString      uuid,
                            NPVariant    *result)
{
  GError *error = NULL;
  GVariant *res;
  const gchar *uuid_str;

  uuid_str = uuid.UTF8Characters;
  if (!uuid_is_valid (uuid_str))
    return FALSE;

  res = g_dbus_proxy_call_sync (obj->proxy,
                                "UninstallExtension",
                                g_variant_new ("(s)",
                                               uuid_str),
                                G_DBUS_CALL_FLAGS_NONE,
                                -1, /* timeout */
                                NULL, /* cancellable */
                                &error);

  if (!res)
    {
      g_warning ("Failed to uninstall extension: %s", error->message);
      g_error_free (error);
      return FALSE;
    }

  return jsonify_variant (res, result);
}

static gboolean
plugin_get_info (PluginObject *obj,
                 NPString      uuid,
                 NPVariant    *result)
{
  GError *error = NULL;
  GVariant *res;
  const gchar *uuid_str;

  uuid_str = uuid.UTF8Characters;
  if (!uuid_is_valid (uuid_str))
    return FALSE;

  res = g_dbus_proxy_call_sync (obj->proxy,
                                "GetExtensionInfo",
                                g_variant_new ("(s)", uuid_str),
                                G_DBUS_CALL_FLAGS_NONE,
                                -1, /* timeout */
                                NULL, /* cancellable */
                                &error);

  if (!res)
    {
      g_warning ("Failed to retrieve extension metadata: %s", error->message);
      g_error_free (error);
      return FALSE;
    }

  return jsonify_variant (res, result);
}

static gboolean
plugin_get_errors (PluginObject *obj,
                   NPString      uuid,
                   NPVariant    *result)
{
  GError *error = NULL;
  GVariant *res;
  const gchar *uuid_str;

  uuid_str = uuid.UTF8Characters;
  if (!uuid_is_valid (uuid_str))
    return FALSE;

  res = g_dbus_proxy_call_sync (obj->proxy,
                                "GetExtensionErrors",
                                g_variant_new ("(s)", uuid_str),
                                G_DBUS_CALL_FLAGS_NONE,
                                -1, /* timeout */
                                NULL, /* cancellable */
                                &error);

  if (!res)
    {
      g_warning ("Failed to retrieve errors: %s", error->message);
      g_error_free (error);
      return FALSE;
    }

  return jsonify_variant (res, result);
}

static int
plugin_get_api_version (PluginObject  *obj,
                        NPVariant     *result)
{
  INT32_TO_NPVARIANT (PLUGIN_API_VERSION, *result);
  return TRUE;
}

static gboolean
plugin_get_shell_version (PluginObject  *obj,
                          NPVariant     *result)
{
  GVariant *res;
  const gchar *version;
  gsize length;
  gchar *buffer;
  gboolean ret;

  ret = TRUE;

  res = g_dbus_proxy_get_cached_property (obj->proxy,
                                          "ShellVersion");

  if (res == NULL)
    {
      g_warning ("Failed to grab shell version.");
      version = "-1";
    }
  else
    {
      g_variant_get (res, "&s", &version);
    }

  length = strlen (version);
  buffer = funcs.memalloc (length + 1);
  if (!buffer)
    {
      ret = FALSE;
      goto out;
    }
  strcpy (buffer, version);

  STRINGN_TO_NPVARIANT (buffer, length, *result);

 out:
  g_variant_unref (res);
  return ret;
}

static bool
plugin_object_invoke (NPObject        *npobj,
                      NPIdentifier     name,
                      const NPVariant *args,
                      uint32_t         argc,
                      NPVariant       *result)
{
  PluginObject *obj;

  g_debug ("invoking plugin object method");

  obj = (PluginObject*) npobj;

  VOID_TO_NPVARIANT (*result);

  if (!plugin_object_has_method (npobj, name))
    return FALSE;

  if (name == list_extensions_id)
    return plugin_list_extensions (obj, result);
  else if (name == get_info_id)
    {
      if (!NPVARIANT_IS_STRING(args[0])) return FALSE;

      return plugin_get_info (obj, NPVARIANT_TO_STRING(args[0]), result);
    }
  else if (name == enable_extension_id)
    {
      if (!NPVARIANT_IS_STRING(args[0])) return FALSE;
      if (!NPVARIANT_IS_BOOLEAN(args[1])) return FALSE;

      return plugin_enable_extension (obj,
                                      NPVARIANT_TO_STRING(args[0]),
                                      NPVARIANT_TO_BOOLEAN(args[1]));
    }
  else if (name == install_extension_id)
    {
      if (!NPVARIANT_IS_STRING(args[0])) return FALSE;
      if (!NPVARIANT_IS_STRING(args[1])) return FALSE;

      return plugin_install_extension (obj,
                                       NPVARIANT_TO_STRING(args[0]),
                                       NPVARIANT_TO_STRING(args[1]));
    }
  else if (name == uninstall_extension_id)
    {
      if (!NPVARIANT_IS_STRING(args[0])) return FALSE;

      return plugin_uninstall_extension (obj,
                                         NPVARIANT_TO_STRING(args[0]),
                                         result);
    }
  else if (name == get_errors_id)
    {
      if (!NPVARIANT_IS_STRING(args[0])) return FALSE;

      return plugin_get_errors (obj,
                                NPVARIANT_TO_STRING(args[0]),
                                result);
    }

  return TRUE;
}

static bool
plugin_object_has_property (NPObject     *npobj,
                            NPIdentifier  name)
{
  return (name == onextension_changed_id ||
          name == api_version_id ||
          name == shell_version_id);
}

static bool
plugin_object_get_property (NPObject     *npobj,
                            NPIdentifier  name,
                            NPVariant    *result)
{
  PluginObject *obj;

  if (!plugin_object_has_property (npobj, name))
    return FALSE;

  obj = (PluginObject*) npobj;
  if (name == api_version_id)
    return plugin_get_api_version (obj, result);
  else if (name == shell_version_id)
    return plugin_get_shell_version (obj, result);
  else if (name == onextension_changed_id)
    {
      if (obj->listener)
        OBJECT_TO_NPVARIANT (obj->listener, *result);
      else
        NULL_TO_NPVARIANT (*result);
    }

  return TRUE;
}

static bool
plugin_object_set_property (NPObject        *npobj,
                            NPIdentifier     name,
                            const NPVariant *value)
{
  PluginObject *obj;

  if (!plugin_object_has_property (npobj, name))
    return FALSE;

  if (name == onextension_changed_id)
    {
      obj = (PluginObject*) npobj;
      if (obj->listener)
        funcs.releaseobject (obj->listener);

      obj->listener = NULL;
      if (NPVARIANT_IS_OBJECT (*value))
        {
          obj->listener = NPVARIANT_TO_OBJECT (*value);
          funcs.retainobject (obj->listener);
          return TRUE;
        }
      else if (NPVARIANT_IS_NULL (*value))
        return TRUE;
    }

  return FALSE;
}

static NPClass plugin_class = {
  NP_CLASS_STRUCT_VERSION,
  plugin_object_allocate,
  plugin_object_deallocate,
  NULL, /* invalidate */
  plugin_object_has_method,
  plugin_object_invoke,
  NULL, /* invoke default */
  plugin_object_has_property,
  plugin_object_get_property,
  plugin_object_set_property,
  NULL, /* remove property */
  NULL, /* enumerate */
  NULL, /* construct */
};

static void
init_methods_and_properties (void)
{
  /* this is the JS public API; it is manipulated through NPIdentifiers for speed */
  api_version_id = funcs.getstringidentifier ("apiVersion");
  shell_version_id = funcs.getstringidentifier ("shellVersion");

  get_info_id = funcs.getstringidentifier ("getExtensionInfo");
  list_extensions_id = funcs.getstringidentifier ("listExtensions");
  enable_extension_id = funcs.getstringidentifier ("setExtensionEnabled");
  install_extension_id = funcs.getstringidentifier ("installExtension");
  uninstall_extension_id = funcs.getstringidentifier ("uninstallExtension");
  get_errors_id = funcs.getstringidentifier ("getExtensionErrors");

  onextension_changed_id = funcs.getstringidentifier ("onchange");
}

NPError
NPP_GetValue(NPP          instance,
	     NPPVariable  variable,
	     void        *value)
{
  g_debug ("NPP_GetValue called");

  switch (variable) {
  case NPPVpluginScriptableNPObject:
    g_debug ("creating scriptable object");
    init_methods_and_properties ();

    *(NPObject**)value = funcs.createobject (instance, &plugin_class);
    break;
  default:
    ;
  }

  return NPERR_NO_ERROR;
}
