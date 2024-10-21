/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Copyright 2011 Red Hat, Inc.
 *           2011 Giovanni Campagna <scampa.giovanni@gmail.com>
 *           2017 Lubomir Rintel <lkundrak@v3.sk>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 */

#include "config.h"
#include <string.h>

#include <libsecret/secret.h>

#include "cinnamon-network-agent.h"

enum {
  SIGNAL_NEW_REQUEST,
  SIGNAL_CANCEL_REQUEST,
  SIGNAL_LAST
};

static gint signals[SIGNAL_LAST];

typedef struct {
  GCancellable *                    cancellable;
  CinnamonNetworkAgent             *self;

  gchar                            *request_id;
  NMConnection                     *connection;
  gchar                            *setting_name;
  gchar                           **hints;
  NMSecretAgentGetSecretsFlags      flags;
  NMSecretAgentOldGetSecretsFunc    callback;
  gpointer                          callback_data;

  GVariantDict                     *entries;
  GVariantBuilder                   builder_vpn;
} CinnamonAgentRequest;

struct _CinnamonNetworkAgentPrivate {
  /* <gchar *request_id, CinnamonAgentRequest *request> */
  GHashTable *requests;
};

G_DEFINE_TYPE_WITH_PRIVATE (CinnamonNetworkAgent, cinnamon_network_agent, NM_TYPE_SECRET_AGENT_OLD)

static const SecretSchema network_agent_schema = {
    "org.freedesktop.NetworkManager.Connection",
    SECRET_SCHEMA_DONT_MATCH_NAME,
    {
        { CINNAMON_KEYRING_UUID_TAG, SECRET_SCHEMA_ATTRIBUTE_STRING },
        { CINNAMON_KEYRING_SN_TAG, SECRET_SCHEMA_ATTRIBUTE_STRING },
        { CINNAMON_KEYRING_SK_TAG, SECRET_SCHEMA_ATTRIBUTE_STRING },
        { NULL, 0 },
    }
};

static void
cinnamon_agent_request_free (gpointer data)
{
  CinnamonAgentRequest *request = data;

  g_cancellable_cancel (request->cancellable);
  g_object_unref (request->cancellable);
  g_object_unref (request->self);
  g_object_unref (request->connection);
  g_free (request->setting_name);
  g_strfreev (request->hints);
  g_clear_pointer (&request->entries, g_variant_dict_unref);
  g_variant_builder_clear (&request->builder_vpn);

  g_free (request);
}

static void
cinnamon_agent_request_cancel (CinnamonAgentRequest *request)
{
  GError *error;
  CinnamonNetworkAgent *self;

  self = request->self;

  error = g_error_new (NM_SECRET_AGENT_ERROR,
                       NM_SECRET_AGENT_ERROR_AGENT_CANCELED,
                       "Canceled by NetworkManager");
  request->callback (NM_SECRET_AGENT_OLD (self), request->connection,
                     NULL, error, request->callback_data);

  g_signal_emit (self, signals[SIGNAL_CANCEL_REQUEST], 0, request->request_id);

  g_hash_table_remove (self->priv->requests, request->request_id);
  g_error_free (error);
}

static void
cinnamon_network_agent_init (CinnamonNetworkAgent *agent)
{
  CinnamonNetworkAgentPrivate *priv;

  priv = agent->priv = cinnamon_network_agent_get_instance_private (agent);
  priv->requests = g_hash_table_new_full (g_str_hash, g_str_equal,
                      g_free, cinnamon_agent_request_free);
}

static void
cinnamon_network_agent_finalize (GObject *object)
{
  CinnamonNetworkAgentPrivate *priv = CINNAMON_NETWORK_AGENT (object)->priv;
  GError *error;
  GHashTableIter iter;
  gpointer key;
  gpointer value;

  error = g_error_new (NM_SECRET_AGENT_ERROR,
                       NM_SECRET_AGENT_ERROR_AGENT_CANCELED,
                       "The secret agent is going away");

  g_hash_table_iter_init (&iter, priv->requests);
  while (g_hash_table_iter_next (&iter, &key, &value))
    {
      CinnamonAgentRequest *request = value;

      request->callback (NM_SECRET_AGENT_OLD (object),
                         request->connection,
                         NULL, error,
                         request->callback_data);
    }

  g_hash_table_destroy (priv->requests);
  g_error_free (error);

  G_OBJECT_CLASS (cinnamon_network_agent_parent_class)->finalize (object);
}

static void
request_secrets_from_ui (CinnamonAgentRequest *request)
{
  g_signal_emit (request->self, signals[SIGNAL_NEW_REQUEST], 0,
                 request->request_id,
                 request->connection,
                 request->setting_name,
                 request->hints,
                 (int)request->flags);
}

static void
check_always_ask_cb (NMSetting    *setting,
                     const gchar  *key,
                     const GValue *value,
                     GParamFlags   flags,
                     gpointer      user_data)
{
  gboolean *always_ask = user_data;
  NMSettingSecretFlags secret_flags = NM_SETTING_SECRET_FLAG_NONE;

  if (flags & NM_SETTING_PARAM_SECRET)
    {
      if (nm_setting_get_secret_flags (setting, key, &secret_flags, NULL))
        {
          if (secret_flags & NM_SETTING_SECRET_FLAG_NOT_SAVED)
            *always_ask = TRUE;
        }
    }
}

static gboolean
has_always_ask (NMSetting *setting)
{
  gboolean always_ask = FALSE;

  nm_setting_enumerate_values (setting, check_always_ask_cb, &always_ask);
  return always_ask;
}

static gboolean
is_connection_always_ask (NMConnection *connection)
{
  NMSettingConnection *s_con;
  const gchar *ctype;
  NMSetting *setting;

  /* For the given connection type, check if the secrets for that connection
   * are always-ask or not.
   */
  s_con = (NMSettingConnection *) nm_connection_get_setting (connection, NM_TYPE_SETTING_CONNECTION);
  g_assert (s_con);
  ctype = nm_setting_connection_get_connection_type (s_con);

  setting = nm_connection_get_setting_by_name (connection, ctype);
  g_return_val_if_fail (setting != NULL, FALSE);

  if (has_always_ask (setting))
    return TRUE;

  /* Try type-specific settings too; be a bit paranoid and only consider
   * secrets from settings relevant to the connection type.
   */
  if (NM_IS_SETTING_WIRELESS (setting))
    {
      setting = nm_connection_get_setting (connection, NM_TYPE_SETTING_WIRELESS_SECURITY);
      if (setting && has_always_ask (setting))
        return TRUE;
      setting = nm_connection_get_setting (connection, NM_TYPE_SETTING_802_1X);
      if (setting && has_always_ask (setting))
        return TRUE;
    }
  else if (NM_IS_SETTING_WIRED (setting))
    {
      setting = nm_connection_get_setting (connection, NM_TYPE_SETTING_PPPOE);
      if (setting && has_always_ask (setting))
        return TRUE;
      setting = nm_connection_get_setting (connection, NM_TYPE_SETTING_802_1X);
      if (setting && has_always_ask (setting))
        return TRUE;
    }

  return FALSE;
}

static void
get_secrets_keyring_cb (GObject            *source,
                        GAsyncResult       *result,
                        gpointer            user_data)
{
  CinnamonAgentRequest *closure;
  CinnamonNetworkAgent *self;
  CinnamonNetworkAgentPrivate *priv;
  GError *secret_error = NULL;
  GError *error = NULL;
  GList *items;
  GList *l;
  gboolean secrets_found = FALSE;
  GVariantBuilder builder_setting, builder_connection;
  g_autoptr (GVariant) setting = NULL;

  items = secret_service_search_finish (NULL, result, &secret_error);

  if (g_error_matches (secret_error, G_IO_ERROR, G_IO_ERROR_CANCELLED))
    {
      g_error_free (secret_error);
      return;
    }

  closure = user_data;
  self = closure->self;
  priv  = self->priv;

  if (secret_error != NULL)
    {
      g_set_error (&error,
                   NM_SECRET_AGENT_ERROR,
                   NM_SECRET_AGENT_ERROR_FAILED,
                   "Internal error while retrieving secrets from the keyring (%s)", secret_error->message);
      g_error_free (secret_error);
      closure->callback (NM_SECRET_AGENT_OLD (closure->self), closure->connection, NULL, error, closure->callback_data);

      goto out;
    }

  g_variant_builder_init (&builder_setting, NM_VARIANT_TYPE_SETTING);

  for (l = items; l; l = g_list_next (l))
    {
      SecretItem *item = l->data;
      GHashTable *attributes;
      GHashTableIter iter;
      const gchar *name, *attribute;
      SecretValue *secret = secret_item_get_secret (item);

      /* This can happen if the user denied a request to unlock */
      if (secret == NULL)
        continue;

      attributes = secret_item_get_attributes (item);
      g_hash_table_iter_init (&iter, attributes);
      while (g_hash_table_iter_next (&iter, (gpointer *)&name, (gpointer *)&attribute))
        {
          if (g_strcmp0 (name, CINNAMON_KEYRING_SK_TAG) == 0)
            {
              g_variant_builder_add (&builder_setting, "{sv}", attribute,
                                     g_variant_new_string (secret_value_get (secret, NULL)));

              secrets_found = TRUE;

              break;
            }
        }

      g_hash_table_unref (attributes);
      secret_value_unref (secret);
    }

  g_list_free_full (items, g_object_unref);
  setting = g_variant_ref_sink (g_variant_builder_end (&builder_setting));

  /* All VPN requests get sent to the VPN's auth dialog, since it knows better
   * than the agent about what secrets are required.  Otherwise, if no secrets
   * were found and interaction is allowed the ask for some secrets, because
   * NetworkManager will fail the connection if not secrets are returned
   * instead of asking again with REQUEST_NEW.
   */
  if (strcmp(closure->setting_name, NM_SETTING_VPN_SETTING_NAME) == 0 ||
      (!secrets_found && (closure->flags & NM_SECRET_AGENT_GET_SECRETS_FLAG_ALLOW_INTERACTION)))
    {
      nm_connection_update_secrets (closure->connection, closure->setting_name,
                                    setting, NULL);

      closure->entries = g_variant_dict_new (setting);
      request_secrets_from_ui (closure);
      return;
    }

  g_variant_builder_init (&builder_connection, NM_VARIANT_TYPE_CONNECTION);
  g_variant_builder_add (&builder_connection, "{s@a{sv}}",
                         closure->setting_name, setting);

  closure->callback (NM_SECRET_AGENT_OLD (closure->self), closure->connection,
                     g_variant_builder_end (&builder_connection), NULL,
                     closure->callback_data);

 out:
  g_hash_table_remove (priv->requests, closure->request_id);
  g_clear_error (&error);
}

static void
cinnamon_network_agent_get_secrets (NMSecretAgentOld                 *agent,
                                    NMConnection                     *connection,
                                    const gchar                      *connection_path,
                                    const gchar                      *setting_name,
                                    const gchar                     **hints,
                                    NMSecretAgentGetSecretsFlags      flags,
                                    NMSecretAgentOldGetSecretsFunc    callback,
                                    gpointer                          callback_data)
{
  CinnamonNetworkAgent *self = CINNAMON_NETWORK_AGENT (agent);
  CinnamonAgentRequest *request;
  GHashTable *attributes;
  char *request_id;

  request_id = g_strdup_printf ("%s/%s", connection_path, setting_name);
  if ((request = g_hash_table_lookup (self->priv->requests, request_id)) != NULL)
    {
      /* We already have a request pending for this (connection, setting)
       * Cancel it before starting the new one.
       * This will also free the request structure and associated resources.
       */
      cinnamon_agent_request_cancel (request);
    }

  request = g_new0 (CinnamonAgentRequest, 1);
  request->self = g_object_ref (self);
  request->cancellable = g_cancellable_new ();
  request->connection = g_object_ref (connection);
  request->setting_name = g_strdup (setting_name);
  request->hints = g_strdupv ((gchar **)hints);
  request->flags = flags;
  request->callback = callback;
  request->callback_data = callback_data;

  request->request_id = request_id;
  g_hash_table_replace (self->priv->requests, request->request_id, request);

  g_variant_builder_init (&request->builder_vpn, G_VARIANT_TYPE ("a{ss}"));

  if ((flags & NM_SECRET_AGENT_GET_SECRETS_FLAG_REQUEST_NEW) ||
      ((flags & NM_SECRET_AGENT_GET_SECRETS_FLAG_ALLOW_INTERACTION)
       && is_connection_always_ask (request->connection)))
    {
      request->entries = g_variant_dict_new (NULL);
      request_secrets_from_ui (request);
      return;
    }

  attributes = secret_attributes_build (&network_agent_schema,
                                        CINNAMON_KEYRING_UUID_TAG, nm_connection_get_uuid (connection),
                                        CINNAMON_KEYRING_SN_TAG, setting_name,
                                        NULL);

  secret_service_search (NULL, &network_agent_schema, attributes,
                         SECRET_SEARCH_ALL | SECRET_SEARCH_UNLOCK | SECRET_SEARCH_LOAD_SECRETS,
                         request->cancellable, get_secrets_keyring_cb, request);

  g_hash_table_unref (attributes);
}

void
cinnamon_network_agent_add_vpn_secret (CinnamonNetworkAgent *self,
                                       gchar                *request_id,
                                       gchar                *setting_key,
                                       gchar                *setting_value)
{
  CinnamonNetworkAgentPrivate *priv;
  CinnamonAgentRequest *request;

  g_return_if_fail (CINNAMON_IS_NETWORK_AGENT (self));

  priv = self->priv;
  request = g_hash_table_lookup (priv->requests, request_id);
  g_return_if_fail (request != NULL);

  g_variant_builder_add (&request->builder_vpn, "{ss}", setting_key, setting_value);
}

void
cinnamon_network_agent_set_password (CinnamonNetworkAgent *self,
                                     gchar                *request_id,
                                     gchar                *setting_key,
                                     gchar                *setting_value)
{
  CinnamonNetworkAgentPrivate *priv;
  CinnamonAgentRequest *request;

  g_return_if_fail (CINNAMON_IS_NETWORK_AGENT (self));

  priv = self->priv;
  request = g_hash_table_lookup (priv->requests, request_id);
  g_return_if_fail (request != NULL);

  g_variant_dict_insert (request->entries, setting_key, "s", setting_value);
}

void
cinnamon_network_agent_respond (CinnamonNetworkAgent         *self,
                                gchar                        *request_id,
                                CinnamonNetworkAgentResponse  response)
{
  CinnamonNetworkAgentPrivate *priv;
  CinnamonAgentRequest *request;
  GVariantBuilder builder_connection;
  GVariant *vpn_secrets, *setting;

  g_return_if_fail (CINNAMON_IS_NETWORK_AGENT (self));

  priv = self->priv;
  request = g_hash_table_lookup (priv->requests, request_id);
  g_return_if_fail (request != NULL);

  if (response == CINNAMON_NETWORK_AGENT_USER_CANCELED)
    {
      GError *error = g_error_new (NM_SECRET_AGENT_ERROR,
                                   NM_SECRET_AGENT_ERROR_USER_CANCELED,
                                   "Network dialog was canceled by the user");

      request->callback (NM_SECRET_AGENT_OLD (self), request->connection, NULL, error, request->callback_data);
      g_error_free (error);
      g_hash_table_remove (priv->requests, request_id);
      return;
    }

  if (response == CINNAMON_NETWORK_AGENT_INTERNAL_ERROR)
    {
      GError *error = g_error_new (NM_SECRET_AGENT_ERROR,
                                   NM_SECRET_AGENT_ERROR_FAILED,
                                   "An internal error occurred while processing the request.");

      request->callback (NM_SECRET_AGENT_OLD (self), request->connection, NULL, error, request->callback_data);
      g_error_free (error);
      g_hash_table_remove (priv->requests, request_id);
      return;
    }

  /* response == CINNAMON_NETWORK_AGENT_CONFIRMED */

  /* VPN secrets are stored as a hash of secrets in a single setting */
  vpn_secrets = g_variant_builder_end (&request->builder_vpn);
  if (g_variant_n_children (vpn_secrets))
    g_variant_dict_insert_value (request->entries, NM_SETTING_VPN_SECRETS, vpn_secrets);
  else
    g_variant_unref (vpn_secrets);

  setting = g_variant_dict_end (request->entries);

  /* Save any updated secrets */
  if ((request->flags & NM_SECRET_AGENT_GET_SECRETS_FLAG_ALLOW_INTERACTION) ||
      (request->flags & NM_SECRET_AGENT_GET_SECRETS_FLAG_REQUEST_NEW))
    {
      NMConnection *dup = nm_simple_connection_new_clone (request->connection);

      nm_connection_update_secrets (dup, request->setting_name, setting, NULL);
      nm_secret_agent_old_save_secrets (NM_SECRET_AGENT_OLD (self), dup, NULL, NULL);
      g_object_unref (dup);
    }

  g_variant_builder_init (&builder_connection, NM_VARIANT_TYPE_CONNECTION);
  g_variant_builder_add (&builder_connection, "{s@a{sv}}",
                         request->setting_name, setting);

  request->callback (NM_SECRET_AGENT_OLD (self), request->connection,
                     g_variant_builder_end (&builder_connection), NULL,
                     request->callback_data);

  g_hash_table_remove (priv->requests, request_id);
}

static void
search_vpn_plugin (GTask        *task,
                   gpointer      object,
                   gpointer      task_data,
                   GCancellable *cancellable)
{
  NMVpnPluginInfo *info = NULL;
  char *service = task_data;

  info = nm_vpn_plugin_info_new_search_file (NULL, service);

  if (info)
    {
      g_task_return_pointer (task, info, g_object_unref);
    }
  else
    {
      g_task_return_new_error (task,
                               G_IO_ERROR, G_IO_ERROR_NOT_FOUND,
                               "No plugin for %s", service);
    }
}

void
cinnamon_network_agent_search_vpn_plugin (CinnamonNetworkAgent   *self,
                                          const char          *service,
                                          GAsyncReadyCallback  callback,
                                          gpointer             user_data)
{
  g_autoptr(GTask) task = NULL;

  g_return_if_fail (CINNAMON_IS_NETWORK_AGENT (self));
  g_return_if_fail (service != NULL);

  task = g_task_new (self, NULL, callback, user_data);
  g_task_set_source_tag (task, cinnamon_network_agent_search_vpn_plugin);
  g_task_set_task_data (task, g_strdup (service), g_free);

  g_task_run_in_thread (task, search_vpn_plugin);
}

/**
 * cinnamon_network_agent_search_vpn_plugin_finish:
 *
 * Returns: (nullable) (transfer full): The found plugin or %NULL
 */
NMVpnPluginInfo *
cinnamon_network_agent_search_vpn_plugin_finish (CinnamonNetworkAgent  *self,
                                                 GAsyncResult       *result,
                                                 GError            **error)
{
  g_return_val_if_fail (CINNAMON_IS_NETWORK_AGENT (self), NULL);
  g_return_val_if_fail (G_IS_TASK (result), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}

static void
cinnamon_network_agent_cancel_get_secrets (NMSecretAgentOld *agent,
                                           const gchar      *connection_path,
                                           const gchar      *setting_name)
{
  CinnamonNetworkAgent *self = CINNAMON_NETWORK_AGENT (agent);
  CinnamonNetworkAgentPrivate *priv = self->priv;
  gchar *request_id;
  CinnamonAgentRequest *request;

  request_id = g_strdup_printf ("%s/%s", connection_path, setting_name);
  request = g_hash_table_lookup (priv->requests, request_id);
  g_free (request_id);

  if (!request)
    {
      /* We've already sent the result, but the caller cancelled the
       * operation before receiving that result.
       */
      return;
    }

  cinnamon_agent_request_cancel (request);
}

/************************* saving of secrets ****************************************/

static GHashTable *
create_keyring_add_attr_list (NMConnection *connection,
                              const gchar  *connection_uuid,
                              const gchar  *connection_id,
                              const gchar  *setting_name,
                              const gchar  *setting_key,
                              gchar       **out_display_name)
{
  NMSettingConnection *s_con;

  if (connection)
    {
      s_con = (NMSettingConnection *) nm_connection_get_setting (connection, NM_TYPE_SETTING_CONNECTION);
      g_return_val_if_fail (s_con != NULL, NULL);
      connection_uuid = nm_setting_connection_get_uuid (s_con);
      connection_id = nm_setting_connection_get_id (s_con);
    }

  g_return_val_if_fail (connection_uuid != NULL, NULL);
  g_return_val_if_fail (connection_id != NULL, NULL);
  g_return_val_if_fail (setting_name != NULL, NULL);
  g_return_val_if_fail (setting_key != NULL, NULL);

  if (out_display_name)
    {
      *out_display_name = g_strdup_printf ("Network secret for %s/%s/%s",
                                           connection_id,
                                           setting_name,
                                           setting_key);
    }

  return secret_attributes_build (&network_agent_schema,
                                  CINNAMON_KEYRING_UUID_TAG, connection_uuid,
                                  CINNAMON_KEYRING_SN_TAG, setting_name,
                                  CINNAMON_KEYRING_SK_TAG, setting_key,
                                  NULL);
}

typedef struct
{
  /* Sort of ref count, indicates the number of secrets we still need to save */
  gint              n_secrets;

  NMSecretAgentOld *self;
  NMConnection     *connection;
  gpointer          callback;
  gpointer          callback_data;
} KeyringRequest;

static void
keyring_request_free (KeyringRequest *r)
{
  g_object_unref (r->self);
  g_object_unref (r->connection);

  g_free (r);
}

static void
save_secret_cb (GObject      *source,
                GAsyncResult *result,
                gpointer      user_data)
{
  KeyringRequest *call = user_data;
  NMSecretAgentOldSaveSecretsFunc callback = call->callback;

  call->n_secrets--;

  if (call->n_secrets == 0)
    {
      if (callback)
        callback (call->self, call->connection, NULL, call->callback_data);
      keyring_request_free (call);
    }
}

static void
save_one_secret (KeyringRequest *r,
                 NMSetting      *setting,
                 const gchar    *key,
                 const gchar    *secret,
                 const gchar    *display_name)
{
  GHashTable *attrs;
  gchar *alt_display_name = NULL;
  const gchar *setting_name;
  NMSettingSecretFlags secret_flags = NM_SETTING_SECRET_FLAG_NONE;

  /* Only save agent-owned secrets (not system-owned or always-ask) */
  nm_setting_get_secret_flags (setting, key, &secret_flags, NULL);
  if (secret_flags != NM_SETTING_SECRET_FLAG_AGENT_OWNED)
    return;

  setting_name = nm_setting_get_name (setting);
  g_assert (setting_name);

  attrs = create_keyring_add_attr_list (r->connection, NULL, NULL,
                                        setting_name,
                                        key,
                                        display_name ? NULL : &alt_display_name);
  g_assert (attrs);
  r->n_secrets++;
  secret_password_storev (&network_agent_schema, attrs, SECRET_COLLECTION_DEFAULT,
                          display_name ? display_name : alt_display_name,
                          secret, NULL, save_secret_cb, r);

  g_hash_table_unref (attrs);
  g_free (alt_display_name);
}

static void
vpn_secret_iter_cb (const gchar *key,
                    const gchar *secret,
                    gpointer     user_data)
{
  KeyringRequest *r = user_data;
  NMSetting *setting;
  const gchar *service_name, *id;
  gchar *display_name;

  if (secret && strlen (secret))
    {
      setting = nm_connection_get_setting (r->connection, NM_TYPE_SETTING_VPN);
      g_assert (setting);
      service_name = nm_setting_vpn_get_service_type (NM_SETTING_VPN (setting));
      g_assert (service_name);
      id = nm_connection_get_id (r->connection);
      g_assert (id);

      display_name = g_strdup_printf ("VPN %s secret for %s/%s/" NM_SETTING_VPN_SETTING_NAME,
                                      key,
                                      id,
                                      service_name);
      save_one_secret (r, setting, key, secret, display_name);
      g_free (display_name);
    }
}

static void
write_one_secret_to_keyring (NMSetting    *setting,
                             const gchar  *key,
                             const GValue *value,
                             GParamFlags   flags,
                             gpointer      user_data)
{
  KeyringRequest *r = user_data;
  const gchar *secret;

  /* Non-secrets obviously don't get saved in the keyring */
  if (!(flags & NM_SETTING_PARAM_SECRET))
    return;

  if (NM_IS_SETTING_VPN (setting) && (g_strcmp0 (key, NM_SETTING_VPN_SECRETS) == 0))
    {
      /* Process VPN secrets specially since it's a hash of secrets, not just one */
      nm_setting_vpn_foreach_secret (NM_SETTING_VPN (setting),
                                     vpn_secret_iter_cb,
                                     r);
    }
  else
    {
      if (!G_VALUE_HOLDS_STRING (value))
        return;

      secret = g_value_get_string (value);
      if (secret && strlen (secret))
        save_one_secret (r, setting, key, secret, NULL);
  }
}

static void
save_delete_cb (NMSecretAgentOld *agent,
                NMConnection     *connection,
                GError           *error,
                gpointer          user_data)
{
  KeyringRequest *r = user_data;

  /* Ignore errors; now save all new secrets */
  nm_connection_for_each_setting_value (connection, write_one_secret_to_keyring, r);

  /* If no secrets actually got saved there may be nothing to do so
   * try to complete the request here. If there were secrets to save the
   * request will get completed when those keyring calls return (at the next
   * mainloop iteration).
   */
  if (r->n_secrets == 0)
    {
      if (r->callback)
        ((NMSecretAgentOldSaveSecretsFunc)r->callback) (agent, connection, NULL, r->callback_data);
      keyring_request_free (r);
    }
}

static void
cinnamon_network_agent_save_secrets (NMSecretAgentOld                *agent,
                                     NMConnection                    *connection,
                                     const gchar                     *connection_path,
                                     NMSecretAgentOldSaveSecretsFunc  callback,
                                     gpointer                         callback_data)
{
  KeyringRequest *r;

  r = g_new (KeyringRequest, 1);
  r->n_secrets = 0;
  r->self = g_object_ref (agent);
  r->connection = g_object_ref (connection);
  r->callback = callback;
  r->callback_data = callback_data;

  /* First delete any existing items in the keyring */
  nm_secret_agent_old_delete_secrets (agent, connection, save_delete_cb, r);
}

static void
delete_items_cb (GObject *source,
                 GAsyncResult *result,
                 gpointer user_data)
{
  KeyringRequest *r = user_data;
  GError *secret_error = NULL;
  GError *error = NULL;
  NMSecretAgentOldDeleteSecretsFunc callback = r->callback;

  secret_password_clear_finish (result, &secret_error);
  if (secret_error != NULL)
    {
      error = g_error_new (NM_SECRET_AGENT_ERROR,
                           NM_SECRET_AGENT_ERROR_FAILED,
                           "The request could not be completed.  Keyring result: %s",
                           secret_error->message);
      g_error_free (secret_error);
    }

  callback (r->self, r->connection, error, r->callback_data);
  g_clear_error (&error);
  keyring_request_free (r);
}

static void
cinnamon_network_agent_delete_secrets (NMSecretAgentOld                  *agent,
                                       NMConnection                      *connection,
                                       const gchar                       *connection_path,
                                       NMSecretAgentOldDeleteSecretsFunc  callback,
                                       gpointer                           callback_data)
{
  KeyringRequest *r;
  NMSettingConnection *s_con;
  const gchar *uuid;

  r = g_new (KeyringRequest, 1);
  r->n_secrets = 0; /* ignored by delete secrets calls */
  r->self = g_object_ref (agent);
  r->connection = g_object_ref (connection);
  r->callback = callback;
  r->callback_data = callback_data;

  s_con = (NMSettingConnection *) nm_connection_get_setting (connection, NM_TYPE_SETTING_CONNECTION);
  g_assert (s_con);
  uuid = nm_setting_connection_get_uuid (s_con);
  g_assert (uuid);

  secret_password_clear (&network_agent_schema, NULL, delete_items_cb, r,
                         CINNAMON_KEYRING_UUID_TAG, uuid,
                         NULL);
}

void
cinnamon_network_agent_class_init (CinnamonNetworkAgentClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  NMSecretAgentOldClass *agent_class = NM_SECRET_AGENT_OLD_CLASS (klass);

  gobject_class->finalize = cinnamon_network_agent_finalize;

  agent_class->get_secrets = cinnamon_network_agent_get_secrets;
  agent_class->cancel_get_secrets = cinnamon_network_agent_cancel_get_secrets;
  agent_class->save_secrets = cinnamon_network_agent_save_secrets;
  agent_class->delete_secrets = cinnamon_network_agent_delete_secrets;

  signals[SIGNAL_NEW_REQUEST] = g_signal_new ("new-request",
                          G_TYPE_FROM_CLASS (klass),
                          0, /* flags */
                          0, /* class offset */
                          NULL, /* accumulator */
                          NULL, /* accu_data */
                                              NULL, /* marshaller */
                          G_TYPE_NONE, /* return */
                          5, /* n_params */
                          G_TYPE_STRING,
                          NM_TYPE_CONNECTION,
                          G_TYPE_STRING,
                                              G_TYPE_STRV,
                                              G_TYPE_INT);

  signals[SIGNAL_CANCEL_REQUEST] = g_signal_new ("cancel-request",
                                                 G_TYPE_FROM_CLASS (klass),
                                                 0, /* flags */
                                                 0, /* class offset */
                                                 NULL, /* accumulator */
                                                 NULL, /* accu_data */
                                                 NULL, /* marshaller */
                                                 G_TYPE_NONE,
                                                 1, /* n_params */
                                                 G_TYPE_STRING);
}
