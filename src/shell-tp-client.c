/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "shell-tp-client.h"

#include <string.h>

#include <telepathy-glib/telepathy-glib.h>

G_DEFINE_TYPE(ShellTpClient, shell_tp_client, TP_TYPE_BASE_CLIENT)

struct _ShellTpClientPrivate
{
  ShellTpClientObserveChannelsImpl observe_impl;
  gpointer user_data_obs;
  GDestroyNotify destroy_obs;

  ShellTpClientApproveChannelsImpl approve_channels_impl;
  gpointer user_data_approve_channels;
  GDestroyNotify destroy_approve_channels;

  ShellTpClientHandleChannelsImpl handle_channels_impl;
  gpointer user_data_handle_channels;
  GDestroyNotify destroy_handle_channels;

  ShellTpClientContactListChangedImpl contact_list_changed_impl;
  gpointer user_data_contact_list_changed;
  GDestroyNotify destroy_contact_list_changed;
};

/**
 * ShellTpClientObserveChannelsImpl:
 * @client: a #ShellTpClient instance
 * @account: a #TpAccount having %TP_ACCOUNT_FEATURE_CORE prepared if possible
 * @connection: a #TpConnection having %TP_CONNECTION_FEATURE_CORE prepared
 * if possible
 * @channels: (element-type TelepathyGLib.Channel): a #GList of #TpChannel,
 *  all having %TP_CHANNEL_FEATURE_CORE prepared if possible
 * @dispatch_operation: (allow-none): a #TpChannelDispatchOperation or %NULL;
 *  the dispatch_operation is not guaranteed to be prepared
 * @requests: (element-type TelepathyGLib.ChannelRequest): a #GList of
 *  #TpChannelRequest, all having their object-path defined but are not
 *  guaranteed to be prepared.
 * @context: a #TpObserveChannelsContext representing the context of this
 *  D-Bus call
 *
 * Signature of the implementation of the ObserveChannels method.
 */

/**
 * ShellTpClientApproveChannelsImpl:
 * @client: a #ShellTpClient instance
 * @account: a #TpAccount having %TP_ACCOUNT_FEATURE_CORE prepared if possible
 * @connection: a #TpConnection having %TP_CONNECTION_FEATURE_CORE prepared
 * if possible
 * @channels: (element-type TelepathyGLib.Channel): a #GList of #TpChannel,
 *  all having %TP_CHANNEL_FEATURE_CORE prepared if possible
 * @dispatch_operation: (allow-none): a #TpChannelDispatchOperation or %NULL;
 *  the dispatch_operation is not guaranteed to be prepared
 * @context: a #TpAddDispatchOperationContext representing the context of this
 *  D-Bus call
 *
 * Signature of the implementation of the AddDispatchOperation method.
 */

/**
 * ShellTpClientHandleChannelsImpl:
 * @client: a #ShellTpClient instance
 * @account: a #TpAccount having %TP_ACCOUNT_FEATURE_CORE prepared if possible
 * @connection: a #TpConnection having %TP_CONNECTION_FEATURE_CORE prepared
 * if possible
 * @channels: (element-type TelepathyGLib.Channel): a #GList of #TpChannel,
 *  all having %TP_CHANNEL_FEATURE_CORE prepared if possible
 * @requests_satisfied: (element-type TelepathyGLib.ChannelRequest): a #GList of
 * #TpChannelRequest having their object-path defined but are not guaranteed
 * to be prepared.
 * @user_action_time: the time at which user action occurred, or one of the
 *  special values %TP_USER_ACTION_TIME_NOT_USER_ACTION or
 *  %TP_USER_ACTION_TIME_CURRENT_TIME
 *  (see #TpAccountChannelRequest:user-action-time for details)
 * @context: a #TpHandleChannelsContext representing the context of this
 *  D-Bus call
 *
 * Signature of the implementation of the HandleChannels method.
 */

/**
 * ShellTpClientContactListChangedImpl:
 * @connection: a #TpConnection having %TP_CONNECTION_FEATURE_CORE prepared
 * if possible
 * @added: (element-type TelepathyGLib.Contact): a #GPtrArray of added #TpContact
 * @removed: (element-type TelepathyGLib.Contact): a #GPtrArray of removed #TpContact
 *
 * Signature of the implementation of the ContactListChanged method.
 */

static void
shell_tp_client_init (ShellTpClient *self)
{
  GHashTable *filter;

  self->priv = G_TYPE_INSTANCE_GET_PRIVATE (self, SHELL_TYPE_TP_CLIENT,
      ShellTpClientPrivate);

  /* We only care about single-user text-based chats */
  filter = tp_asv_new (
      TP_PROP_CHANNEL_CHANNEL_TYPE, G_TYPE_STRING,
        TP_IFACE_CHANNEL_TYPE_TEXT,
      TP_PROP_CHANNEL_TARGET_HANDLE_TYPE, G_TYPE_UINT,
        TP_HANDLE_TYPE_CONTACT,
      NULL);

  /* Observer */
  tp_base_client_set_observer_recover (TP_BASE_CLIENT (self), TRUE);

  tp_base_client_add_observer_filter (TP_BASE_CLIENT (self), filter);

  /* Approver */
  tp_base_client_add_approver_filter (TP_BASE_CLIENT (self), filter);

  /* Approve room invitations. We don't handle or observe room channels so
   * just register this filter for the approver. */
  tp_base_client_take_approver_filter (TP_BASE_CLIENT (self), tp_asv_new (
      TP_PROP_CHANNEL_CHANNEL_TYPE, G_TYPE_STRING,
        TP_IFACE_CHANNEL_TYPE_TEXT,
      TP_PROP_CHANNEL_TARGET_HANDLE_TYPE, G_TYPE_UINT,
        TP_HANDLE_TYPE_ROOM,
      NULL));

  /* Approve calls (StreameMedia and Call.DRAFT). We let Empathy handle the
   * call itself. */
  tp_base_client_take_approver_filter (TP_BASE_CLIENT (self),
      tp_asv_new (
        TP_PROP_CHANNEL_CHANNEL_TYPE, G_TYPE_STRING,
          TP_IFACE_CHANNEL_TYPE_STREAMED_MEDIA,
        TP_PROP_CHANNEL_TARGET_HANDLE_TYPE, G_TYPE_UINT, TP_HANDLE_TYPE_CONTACT,
        NULL));

  /* FIXME: use TP_IFACE_CHANNEL_TYPE_CALL once API is undrafted (fdo #24936) */
  tp_base_client_take_approver_filter (TP_BASE_CLIENT (self),
      tp_asv_new (
        TP_PROP_CHANNEL_CHANNEL_TYPE, G_TYPE_STRING,
          "org.freedesktop.Telepathy.Channel.Type.Call.DRAFT",
        TP_PROP_CHANNEL_TARGET_HANDLE_TYPE, G_TYPE_UINT, TP_HANDLE_TYPE_CONTACT,
        NULL));

  /* Approve file transfers. We let Empathy handle the transfer itself. */
  tp_base_client_take_approver_filter (TP_BASE_CLIENT (self),
      tp_asv_new (
        TP_PROP_CHANNEL_CHANNEL_TYPE, G_TYPE_STRING,
          TP_IFACE_CHANNEL_TYPE_FILE_TRANSFER,
        TP_PROP_CHANNEL_TARGET_HANDLE_TYPE, G_TYPE_UINT, TP_HANDLE_TYPE_CONTACT,
        NULL));

  /* Handler */
  tp_base_client_add_handler_filter (TP_BASE_CLIENT (self), filter);

  g_hash_table_unref (filter);
}

static void
observe_channels (TpBaseClient *client,
                  TpAccount *account,
                  TpConnection *connection,
                  GList *channels,
                  TpChannelDispatchOperation *dispatch_operation,
                  GList *requests,
                  TpObserveChannelsContext *context)
{
  ShellTpClient *self = (ShellTpClient *) client;

  g_assert (self->priv->observe_impl != NULL);

  self->priv->observe_impl (self, account, connection, channels,
      dispatch_operation, requests, context, self->priv->user_data_obs);
}

static void
add_dispatch_operation (TpBaseClient *client,
    TpAccount *account,
    TpConnection *connection,
    GList *channels,
    TpChannelDispatchOperation *dispatch_operation,
    TpAddDispatchOperationContext *context)
{
  ShellTpClient *self = (ShellTpClient *) client;

  g_assert (self->priv->approve_channels_impl != NULL);

  self->priv->approve_channels_impl (self, account, connection, channels,
      dispatch_operation, context, self->priv->user_data_approve_channels);
}

static void
handle_channels (TpBaseClient *client,
    TpAccount *account,
    TpConnection *connection,
    GList *channels,
    GList *requests_satisfied,
    gint64 user_action_time,
    TpHandleChannelsContext *context)
{
  ShellTpClient *self = (ShellTpClient *) client;

  g_assert (self->priv->handle_channels_impl != NULL);

  self->priv->handle_channels_impl (self, account, connection, channels,
      requests_satisfied, user_action_time, context,
      self->priv->user_data_handle_channels);
}

static void
shell_tp_client_dispose (GObject *object)
{
  ShellTpClient *self = SHELL_TP_CLIENT (object);
  void (*dispose) (GObject *) =
    G_OBJECT_CLASS (shell_tp_client_parent_class)->dispose;

  if (self->priv->destroy_obs != NULL)
    {
      self->priv->destroy_obs (self->priv->user_data_obs);
      self->priv->destroy_obs = NULL;
      self->priv->user_data_obs = NULL;
    }

  if (self->priv->destroy_approve_channels != NULL)
    {
      self->priv->destroy_approve_channels (self->priv->user_data_approve_channels);
      self->priv->destroy_approve_channels = NULL;
      self->priv->user_data_approve_channels = NULL;
    }

  if (self->priv->destroy_handle_channels != NULL)
    {
      self->priv->destroy_handle_channels (self->priv->user_data_handle_channels);
      self->priv->destroy_handle_channels = NULL;
      self->priv->user_data_handle_channels = NULL;
    }

  if (self->priv->destroy_contact_list_changed != NULL)
    {
      self->priv->destroy_contact_list_changed (self->priv->user_data_contact_list_changed);
      self->priv->destroy_contact_list_changed = NULL;
      self->priv->user_data_contact_list_changed = NULL;
    }

  if (dispose != NULL)
    dispose (object);
}

static void
shell_tp_client_class_init (ShellTpClientClass *cls)
{
  GObjectClass *object_class = G_OBJECT_CLASS (cls);
  TpBaseClientClass *base_clt_cls = TP_BASE_CLIENT_CLASS (cls);

  g_type_class_add_private (cls, sizeof (ShellTpClientPrivate));

  object_class->dispose = shell_tp_client_dispose;

  base_clt_cls->observe_channels = observe_channels;
  base_clt_cls->add_dispatch_operation = add_dispatch_operation;
  base_clt_cls->handle_channels = handle_channels;
}

void
shell_tp_client_set_observe_channels_func (ShellTpClient *self,
                                           ShellTpClientObserveChannelsImpl observe_impl,
                                           gpointer user_data,
                                           GDestroyNotify destroy)
{
  g_assert (self->priv->observe_impl == NULL);

  self->priv->observe_impl = observe_impl;
  self->priv->user_data_obs = user_data;
  self->priv->destroy_obs = destroy;
}

void
shell_tp_client_set_approve_channels_func (ShellTpClient *self,
    ShellTpClientApproveChannelsImpl approve_channels_impl,
    gpointer user_data,
    GDestroyNotify destroy)
{
  g_assert (self->priv->approve_channels_impl == NULL);

  self->priv->approve_channels_impl = approve_channels_impl;
  self->priv->user_data_approve_channels = user_data;
  self->priv->destroy_approve_channels = destroy;
}

void
shell_tp_client_set_handle_channels_func (ShellTpClient *self,
    ShellTpClientHandleChannelsImpl handle_channels_impl,
    gpointer user_data,
    GDestroyNotify destroy)
{
  g_assert (self->priv->handle_channels_impl == NULL);

  self->priv->handle_channels_impl = handle_channels_impl;
  self->priv->user_data_handle_channels = user_data;
  self->priv->destroy_handle_channels = destroy;
}

void
shell_tp_client_set_contact_list_changed_func (ShellTpClient *self,
    ShellTpClientContactListChangedImpl contact_list_changed_impl,
    gpointer user_data,
    GDestroyNotify destroy)
{
  g_assert (self->priv->contact_list_changed_impl == NULL);

  self->priv->contact_list_changed_impl = contact_list_changed_impl;
  self->priv->user_data_handle_channels = user_data;
  self->priv->destroy_handle_channels = destroy;
}

static void
on_contact_list_changed (TpConnection *conn,
                         GPtrArray *added,
                         GPtrArray *removed,
                         gpointer user_data)
{
  ShellTpClient *self = (ShellTpClient *) user_data;

  g_assert (self->priv->contact_list_changed_impl != NULL);

  self->priv->contact_list_changed_impl (conn,
      added, removed,
      self->priv->user_data_contact_list_changed);
}

void
shell_tp_client_grab_contact_list_changed (ShellTpClient *self,
                                           TpConnection *conn)
{
  g_signal_connect (conn, "contact-list-changed",
                    G_CALLBACK (on_contact_list_changed),
                    self);
}

/* Telepathy utility functions */

/**
 * ShellGetTpContactCb:
 * @connection: The connection
 * @contacts: (element-type TelepathyGLib.Contact): List of contacts
 * @failed: Array of failed contacts
 */

static void
shell_global_get_tp_contacts_cb (TpConnection *self,
                                 guint n_contacts,
                                 TpContact * const *contacts,
                                 guint n_failed,
                                 const TpHandle *failed,
                                 const GError *error,
                                 gpointer user_data,
                                 GObject *weak_object)
{
  int i;
  GList *contact_list = NULL;
  for (i = 0; i < n_contacts; i++) {
      contact_list = g_list_append(contact_list, contacts[i]);
  }

  TpHandle *failed_list = g_new0 (TpHandle, n_failed + 1);
  memcpy(failed_list, failed, n_failed);

  ((ShellGetTpContactCb)user_data)(self, contact_list, failed_list);
}

/**
 * shell_get_tp_contacts:
 * @self: A connection, which must be ready
 * @n_handles: Number of handles in handles
 * @handles: (array length=n_handles) (element-type uint): Array of handles
 * @n_features: Number of features in features
 * @features: (array length=n_features) (allow-none) (element-type uint):
 *  Array of features
 * @callback: (scope async): User callback to run when the contacts are ready
 *
 * Wrap tp_connection_get_contacts_by_handle so we can transform the array
 * into a null-terminated one, which gjs can handle.
 * We send the original callback to tp_connection_get_contacts_by_handle as
 * user_data, and we have our own function as callback, which does the
 * transforming.
 */
void
shell_get_tp_contacts (TpConnection *self,
                       guint n_handles,
                       const TpHandle *handles,
                       guint n_features,
                       const TpContactFeature *features,
                       ShellGetTpContactCb callback)
{
  tp_connection_get_contacts_by_handle(self, n_handles, handles,
                                       n_features, features,
                                       shell_global_get_tp_contacts_cb,
                                       callback, NULL, NULL);
}

static void
shell_global_get_self_contact_features_cb (TpConnection *connection,
                                           guint n_contacts,
                                           TpContact * const *contacts,
                                           const GError *error,
                                           gpointer user_data,
                                           GObject *weak_object)
{
  if (error != NULL) {
    g_print ("Failed to upgrade self contact: %s", error->message);
    return;
  }
  ((ShellGetSelfContactFeaturesCb)user_data)(connection, *contacts);
}

/**
 * shell_get_self_contact_features:
 * @self: A connection, which must be ready
 * @n_features: Number of features in features
 * @features: (array length=n_features) (allow-none) (element-type uint):
 *  Array of features
 * @callback: (scope async): User callback to run when the contact is ready
 *
 * Wrap tp_connection_upgrade_contacts due to the lack of support for
 * proper arrays arguments in GJS.
 */
void
shell_get_self_contact_features (TpConnection *self,
                                 guint n_features,
                                 const TpContactFeature *features,
                                 ShellGetSelfContactFeaturesCb callback)
{
  TpContact *self_contact = tp_connection_get_self_contact (self);

  tp_connection_upgrade_contacts (self, 1, &self_contact,
                                  n_features, features,
                                  shell_global_get_self_contact_features_cb,
                                  callback, NULL, NULL);
}

/**
 * shell_get_contact_events:
 * @log_manager: A #TplLogManager
 * @account: A #TpAccount
 * @entity: A #TplEntity
 * @num_events: The number of events to retrieve
 * @callback: (scope async): User callback to run when the contact is ready
 *
 * Wrap tpl_log_manager_get_filtered_events_async because gjs cannot support
 * multiple callbacks in the same function call.
 */
void
shell_get_contact_events (TplLogManager *log_manager,
                          TpAccount *account,
                          TplEntity *entity,
                          guint num_events,
                          GAsyncReadyCallback callback)
{
  tpl_log_manager_get_filtered_events_async (log_manager,
                                             account,
                                             entity,
                                             TPL_EVENT_MASK_TEXT,
                                             num_events,
                                             NULL, NULL,
                                             callback, NULL);
}

/* gjs doesn't allow us to craft a GError so we need a C wrapper */
void
shell_decline_dispatch_op (TpAddDispatchOperationContext *context,
    const gchar *message)
{
  GError *error = g_error_new_literal (TP_ERRORS, TP_ERROR_INVALID_ARGUMENT,
      message);

  tp_add_dispatch_operation_context_fail (context, error);
  g_error_free (error);
}
