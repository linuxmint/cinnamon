/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Copyright 2011 Red Hat, Inc.
 *           2011 Giovanni Campagna <scampa.giovanni@gmail.com>
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
#include <gnome-keyring.h>

#include "shell-network-agent.h"
#include "shell-marshal.h"

enum {
  SIGNAL_NEW_REQUEST,
  SIGNAL_CANCEL_REQUEST,
  SIGNAL_LAST
};

static gint signals[SIGNAL_LAST];

typedef struct {
  gpointer                       keyring_op;
  ShellNetworkAgent             *self;

  gchar                         *request_id;
  NMConnection                  *connection;
  gchar                         *setting_name;
  gchar                        **hints;
  NMSecretAgentGetSecretsFlags   flags;
  NMSecretAgentGetSecretsFunc    callback;
  gpointer                       callback_data;

  /* <gchar *setting_key, gchar *secret> */
  GHashTable                    *entries;
} ShellAgentRequest;

struct _ShellNetworkAgentPrivate {
  /* <gchar *request_id, ShellAgentRequest *request> */
  GHashTable *requests;
};

G_DEFINE_TYPE (ShellNetworkAgent, shell_network_agent, NM_TYPE_SECRET_AGENT)

static void
shell_agent_request_free (gpointer data)
{
  ShellAgentRequest *request = data;

  if (request->keyring_op)
    gnome_keyring_cancel_request (request->keyring_op);

  g_object_unref (request->self);
  g_object_unref (request->connection);
  g_free (request->setting_name);
  g_strfreev (request->hints);

  g_hash_table_destroy (request->entries);

  g_slice_free (ShellAgentRequest, request);
}

static void
shell_network_agent_init (ShellNetworkAgent *agent)
{
  ShellNetworkAgentPrivate *priv;

  priv = agent->priv = G_TYPE_INSTANCE_GET_PRIVATE (agent, SHELL_TYPE_NETWORK_AGENT, ShellNetworkAgentPrivate);

  priv->requests = g_hash_table_new_full (g_str_hash, g_str_equal,
					  g_free, shell_agent_request_free);
}

static void
shell_network_agent_finalize (GObject *object)
{
  ShellNetworkAgentPrivate *priv = SHELL_NETWORK_AGENT (object)->priv;
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
      ShellAgentRequest *request = value;

      request->callback (NM_SECRET_AGENT (object),
                         request->connection,
                         NULL, error,
                         request->callback_data);
    }

  g_hash_table_destroy (priv->requests);
  g_error_free (error);

  G_OBJECT_CLASS (shell_network_agent_parent_class)->finalize (object);
}

static void
request_secrets_from_ui (ShellAgentRequest *request)
{
  g_signal_emit (request->self, signals[SIGNAL_NEW_REQUEST], 0,
                 request->request_id,
                 request->connection,
                 request->setting_name,
                 request->hints);
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
gvalue_destroy_notify (gpointer data)
{
  GValue *value = data;
  g_value_unset (value);
  g_slice_free (GValue, value);
}

static gboolean
strv_has (gchar **haystack,
          gchar  *needle)
{
  gchar *iter;
  for (iter = *haystack; iter; iter++)
    {
      if (g_strcmp0 (iter, needle) == 0)
        return TRUE;
    }

  return FALSE;
}

static void
get_secrets_keyring_cb (GnomeKeyringResult  result,
			GList              *list,
			gpointer            user_data)
{
  ShellAgentRequest *closure = user_data;
  ShellNetworkAgent *self = closure->self;
  ShellNetworkAgentPrivate *priv = self->priv;
  GError *error = NULL;
  gint n_found = 0;
  GList *iter;
  GHashTable *outer;

  closure->keyring_op = NULL;

  if (result == GNOME_KEYRING_RESULT_CANCELLED)
    {
      g_set_error (&error,
		   NM_SECRET_AGENT_ERROR,
		   NM_SECRET_AGENT_ERROR_USER_CANCELED,
		   "The secret request was cancelled by the user");

      closure->callback (NM_SECRET_AGENT (closure->self), closure->connection, NULL, error, closure->callback_data);

      goto out;
    }

  if (result != GNOME_KEYRING_RESULT_OK &&
      result != GNOME_KEYRING_RESULT_NO_MATCH)
    {
      g_set_error (&error,
		   NM_SECRET_AGENT_ERROR,
		   NM_SECRET_AGENT_ERROR_INTERNAL_ERROR,
		   "Internal error while retrieving secrets from the keyring (result %d)", result);

      closure->callback (NM_SECRET_AGENT (closure->self), closure->connection, NULL, error, closure->callback_data);

      goto out;
    }

  for (iter = list; iter; iter = g_list_next (iter))
    {
      GnomeKeyringFound *item = iter->data;
      int i;

      for (i = 0; i < item->attributes->len; i++)
        {
          GnomeKeyringAttribute *attr = &gnome_keyring_attribute_list_index (item->attributes, i);

          if (g_strcmp0 (attr->name, SHELL_KEYRING_SK_TAG) == 0
              && (attr->type == GNOME_KEYRING_ATTRIBUTE_TYPE_STRING))
            {
              gchar *secret_name = g_strdup (attr->value.string);
              GValue *secret_value = g_slice_new0 (GValue);
              g_value_init (secret_value, G_TYPE_STRING);
              g_value_set_string (secret_value, item->secret);

              g_hash_table_insert (closure->entries, secret_name, secret_value);

              if (closure->hints)
                n_found += strv_has (closure->hints, secret_name);
              else
                n_found += 1;

              break;
            }
        }
    }

  if (n_found == 0 &&
      (closure->flags & NM_SECRET_AGENT_GET_SECRETS_FLAG_ALLOW_INTERACTION))
    {
      /* Even if n_found == 0, secrets is not necessarily empty */
      nm_connection_update_secrets (closure->connection, closure->setting_name, closure->entries, NULL);

      request_secrets_from_ui (closure);
      return;
    }

  outer = g_hash_table_new (g_str_hash, g_str_equal);
  g_hash_table_insert (outer, closure->setting_name, closure->entries);

  closure->callback (NM_SECRET_AGENT (closure->self), closure->connection, outer, NULL, closure->callback_data);

  g_hash_table_destroy (outer);

 out:
  g_hash_table_remove (priv->requests, closure->request_id);
  g_clear_error (&error);
}

static void
shell_network_agent_get_secrets (NMSecretAgent                 *agent,
				 NMConnection                  *connection,
				 const gchar                   *connection_path,
				 const gchar                   *setting_name,
				 const gchar                  **hints,
				 NMSecretAgentGetSecretsFlags   flags,
				 NMSecretAgentGetSecretsFunc    callback,
				 gpointer                       callback_data)
{
  ShellNetworkAgent *self = SHELL_NETWORK_AGENT (agent);
  ShellAgentRequest *request;
  NMSettingConnection *setting_connection;
  const char *connection_type;

  /* VPN secrets are currently unimplemented - bail out early */
  setting_connection = nm_connection_get_setting_connection (connection);
  connection_type = nm_setting_connection_get_connection_type (setting_connection);
  if (strcmp (connection_type, "vpn") == 0)
    {
      GError *error = g_error_new (NM_SECRET_AGENT_ERROR,
                                   NM_SECRET_AGENT_ERROR_AGENT_CANCELED,
                                   "VPN secrets are currently unhandled.");
      callback (NM_SECRET_AGENT (self), connection, NULL, error, callback_data);
      return;
    }

  request = g_slice_new (ShellAgentRequest);
  request->self = g_object_ref (self);
  request->connection = g_object_ref (connection);
  request->setting_name = g_strdup (setting_name);
  request->hints = g_strdupv ((gchar **)hints);
  request->flags = flags;
  request->callback = callback;
  request->callback_data = callback_data;
  request->entries = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, gvalue_destroy_notify);

  request->request_id = g_strdup_printf ("%s/%s", connection_path, setting_name);
  g_hash_table_replace (self->priv->requests, request->request_id, request);

  if ((flags & NM_SECRET_AGENT_GET_SECRETS_FLAG_REQUEST_NEW) ||
      (flags && NM_SECRET_AGENT_GET_SECRETS_FLAG_ALLOW_INTERACTION
       && is_connection_always_ask (request->connection)))
    {
      request_secrets_from_ui (request);
      return;
    }

  request->keyring_op = gnome_keyring_find_itemsv (GNOME_KEYRING_ITEM_GENERIC_SECRET,
						   get_secrets_keyring_cb,
						   request,
						   NULL, /* GDestroyNotify */
						   SHELL_KEYRING_UUID_TAG,
						   GNOME_KEYRING_ATTRIBUTE_TYPE_STRING,
						   nm_connection_get_uuid (connection),
						   SHELL_KEYRING_SN_TAG,
						   GNOME_KEYRING_ATTRIBUTE_TYPE_STRING,
						   setting_name,
						   NULL);  
}

void
shell_network_agent_set_password (ShellNetworkAgent *self,
                                  gchar             *request_id,
                                  gchar             *setting_key,
                                  gchar             *setting_value)
{
  ShellNetworkAgentPrivate *priv;
  ShellAgentRequest *request;
  GValue *value;

  g_return_if_fail (SHELL_IS_NETWORK_AGENT (self));

  priv = self->priv;
  request = g_hash_table_lookup (priv->requests, request_id);

  value = g_slice_new0 (GValue);
  g_value_init (value, G_TYPE_STRING);
  g_value_set_string (value, setting_value);

  g_hash_table_replace (request->entries, g_strdup (setting_key), value);
}

void
shell_network_agent_respond (ShellNetworkAgent *self,
                             gchar             *request_id,
                             gboolean           canceled)
{
  ShellNetworkAgentPrivate *priv;
  ShellAgentRequest *request;
  NMConnection *dup;
  GHashTable *outer;

  g_return_if_fail (SHELL_IS_NETWORK_AGENT (self));

  priv = self->priv;
  request = g_hash_table_lookup (priv->requests, request_id);

  if (canceled)
    {
      GError *error = g_error_new (NM_SECRET_AGENT_ERROR,
                                   NM_SECRET_AGENT_ERROR_USER_CANCELED,
                                   "Network dialog was canceled by the user");

      request->callback (NM_SECRET_AGENT (self), request->connection, NULL, error, request->callback_data);
      g_error_free (error);
      g_hash_table_remove (priv->requests, request_id);
      return;
    }

  /* Save updated secrets */
  dup = nm_connection_duplicate (request->connection);
  nm_connection_update_secrets (dup, request->setting_name, request->entries, NULL);

  nm_secret_agent_save_secrets (NM_SECRET_AGENT (self), dup, NULL, NULL);

  outer = g_hash_table_new (g_str_hash, g_str_equal);
  g_hash_table_insert (outer, request->setting_name, request->entries);

  request->callback (NM_SECRET_AGENT (self), request->connection, outer, NULL, request->callback_data);

  g_hash_table_destroy (outer);
  g_object_unref (dup);
  g_hash_table_remove (priv->requests, request_id);
}

static void
shell_network_agent_cancel_get_secrets (NMSecretAgent *agent,
                                        const gchar   *connection_path,
                                        const gchar   *setting_name)
{
  ShellNetworkAgent *self = SHELL_NETWORK_AGENT (agent);
  ShellNetworkAgentPrivate *priv = self->priv;

  gchar *request_id = g_strdup_printf ("%s/%s", connection_path, setting_name);
  ShellAgentRequest *request = g_hash_table_lookup (priv->requests, request_id);

  GError *error = g_error_new (NM_SECRET_AGENT_ERROR,
                               NM_SECRET_AGENT_ERROR_AGENT_CANCELED,
                               "Canceled by NetworkManager");
  request->callback (agent, request->connection, NULL, error, request->callback_data);

  g_signal_emit (self, signals[SIGNAL_CANCEL_REQUEST], 0, request_id);

  g_hash_table_remove (priv->requests, request_id);
  g_free (request_id);
  g_error_free (error);
}

/************************* saving of secrets ****************************************/

static GnomeKeyringAttributeList *
create_keyring_add_attr_list (NMConnection *connection,
                              const gchar  *connection_uuid,
                              const gchar  *connection_id,
                              const gchar  *setting_name,
                              const gchar  *setting_key,
                              gchar       **out_display_name)
{
  GnomeKeyringAttributeList *attrs = NULL;
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

  attrs = gnome_keyring_attribute_list_new ();
  gnome_keyring_attribute_list_append_string (attrs,
                                              SHELL_KEYRING_UUID_TAG,
                                              connection_uuid);
  gnome_keyring_attribute_list_append_string (attrs,
                                              SHELL_KEYRING_SN_TAG,
                                              setting_name);
  gnome_keyring_attribute_list_append_string (attrs,
                                              SHELL_KEYRING_SK_TAG,
                                              setting_key);
  return attrs;
}

typedef struct
{
  /* Sort of ref count, indicates the number of secrets we still need to save */
  gint           n_secrets;

  NMSecretAgent *self;
  NMConnection  *connection;
  gpointer       callback;
  gpointer       callback_data;
} KeyringRequest;

static void
keyring_request_free (KeyringRequest *r)
{
  g_object_unref (r->self);
  g_object_unref (r->connection);

  g_slice_free (KeyringRequest, r);
}

static void
save_secret_cb (GnomeKeyringResult result,
                guint              val,
                gpointer           user_data)
{
  KeyringRequest *call = user_data;
  NMSecretAgentSaveSecretsFunc callback = call->callback;

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
  GnomeKeyringAttributeList *attrs;
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
  gnome_keyring_item_create (NULL,
                             GNOME_KEYRING_ITEM_GENERIC_SECRET,
                             display_name ? display_name : alt_display_name,
                             attrs,
                             secret,
                             TRUE,
                             save_secret_cb,
                             r,
                             NULL);

  gnome_keyring_attribute_list_free (attrs);
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
      secret = g_value_get_string (value);
      if (secret && strlen (secret))
        save_one_secret (r, setting, key, secret, NULL);
  }
}

static void
save_delete_cb (NMSecretAgent *agent,
                NMConnection  *connection,
                GError        *error,
                gpointer       user_data)
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
        ((NMSecretAgentSaveSecretsFunc)r->callback) (agent, connection, NULL, r->callback_data);
      keyring_request_free (r);
    }
}

static void
shell_network_agent_save_secrets (NMSecretAgent                *agent,
                                  NMConnection                 *connection,
                                  const gchar                  *connection_path,
                                  NMSecretAgentSaveSecretsFunc  callback,
                                  gpointer                      callback_data)
{
  KeyringRequest *r;

  r = g_slice_new (KeyringRequest);
  r->n_secrets = 0;
  r->self = g_object_ref (agent);
  r->connection = g_object_ref (connection);
  r->callback = callback;
  r->callback_data = callback_data;

  /* First delete any existing items in the keyring */
  nm_secret_agent_delete_secrets (agent, connection, save_delete_cb, r);
}

static void
keyring_delete_cb (GnomeKeyringResult result, gpointer user_data)
{
  /* Ignored */
}

static void
delete_find_items_cb (GnomeKeyringResult result, GList *list, gpointer user_data)
{
  KeyringRequest *r = user_data;
  GList *iter;
  GError *error = NULL;
  NMSecretAgentDeleteSecretsFunc callback = r->callback;

  if ((result == GNOME_KEYRING_RESULT_OK) || (result == GNOME_KEYRING_RESULT_NO_MATCH))
    {
      for (iter = list; iter != NULL; iter = g_list_next (iter))
        {
          GnomeKeyringFound *found = (GnomeKeyringFound *) iter->data;

          gnome_keyring_item_delete (found->keyring, found->item_id, keyring_delete_cb, NULL, NULL);
        }
    }
  else
    {
      error = g_error_new (NM_SECRET_AGENT_ERROR,
                           NM_SECRET_AGENT_ERROR_INTERNAL_ERROR,
                           "The request could not be completed.  Keyring result: %d",
                           result);
    }

  callback (r->self, r->connection, error, r->callback_data);
  g_clear_error (&error);
}

static void
shell_network_agent_delete_secrets (NMSecretAgent                  *agent,
                                    NMConnection                   *connection,
                                    const gchar                    *connection_path,
                                    NMSecretAgentDeleteSecretsFunc  callback,
                                    gpointer                        callback_data)
{
  KeyringRequest *r;
  NMSettingConnection *s_con;
  const gchar *uuid;

  r = g_slice_new (KeyringRequest);
  r->n_secrets = 0; /* ignored by delete secrets calls */
  r->self = g_object_ref (agent);
  r->connection = g_object_ref (connection);
  r->callback = callback;
  r->callback_data = callback_data;

  s_con = (NMSettingConnection *) nm_connection_get_setting (connection, NM_TYPE_SETTING_CONNECTION);
  g_assert (s_con);
  uuid = nm_setting_connection_get_uuid (s_con);
  g_assert (uuid);

  gnome_keyring_find_itemsv (GNOME_KEYRING_ITEM_GENERIC_SECRET,
                             delete_find_items_cb,
                             r,
                             (GDestroyNotify)keyring_request_free,
                             SHELL_KEYRING_UUID_TAG,
                             GNOME_KEYRING_ATTRIBUTE_TYPE_STRING,
                             uuid,
                             NULL);
}

void
shell_network_agent_class_init (ShellNetworkAgentClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  NMSecretAgentClass *agent_class = NM_SECRET_AGENT_CLASS (klass);

  gobject_class->finalize = shell_network_agent_finalize;

  agent_class->get_secrets = shell_network_agent_get_secrets;
  agent_class->cancel_get_secrets = shell_network_agent_cancel_get_secrets;
  agent_class->save_secrets = shell_network_agent_save_secrets;
  agent_class->delete_secrets = shell_network_agent_delete_secrets;

  signals[SIGNAL_NEW_REQUEST] = g_signal_new ("new-request",
					      G_TYPE_FROM_CLASS (klass),
					      0, /* flags */
					      0, /* class offset */
					      NULL, /* accumulator */
					      NULL, /* accu_data */
					      _shell_marshal_VOID__STRING_OBJECT_STRING_BOXED,
					      G_TYPE_NONE, /* return */
					      3, /* n_params */
					      G_TYPE_STRING,
					      NM_TYPE_CONNECTION,
					      G_TYPE_STRING,
                                              G_TYPE_STRV);

  signals[SIGNAL_CANCEL_REQUEST] = g_signal_new ("cancel-request",
                                                 G_TYPE_FROM_CLASS (klass),
                                                 0, /* flags */
                                                 0, /* class offset */
                                                 NULL, /* accumulator */
                                                 NULL, /* accu_data */
                                                 g_cclosure_marshal_VOID__STRING,
                                                 G_TYPE_NONE,
                                                 1, /* n_params */
                                                 G_TYPE_STRING);

  g_type_class_add_private (klass, sizeof (ShellNetworkAgentPrivate));
}
