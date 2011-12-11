/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#ifndef __SHELL_TP_CLIENT_H__
#define __SHELL_TP_CLIENT_H__

#include <dbus/dbus-glib.h>
#include <glib-object.h>

#include <telepathy-glib/telepathy-glib.h>
#include <telepathy-logger/telepathy-logger.h>

G_BEGIN_DECLS

typedef struct _ShellTpClient ShellTpClient;
typedef struct _ShellTpClientClass ShellTpClientClass;
typedef struct _ShellTpClientPrivate ShellTpClientPrivate;

struct _ShellTpClientClass {
    /*<private>*/
    TpBaseClientClass parent_class;
};

struct _ShellTpClient {
    /*<private>*/
    TpBaseClient parent;
    ShellTpClientPrivate *priv;
};

GType shell_tp_client_get_type (void);

#define SHELL_TYPE_TP_CLIENT \
  (shell_tp_client_get_type ())
#define SHELL_TP_CLIENT(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_TP_CLIENT, \
                               ShellTpClient))
#define SHELL_TP_CLIENT_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_TP_CLIENT, \
                            ShellTpClientClass))
#define SHELL_IS_TP_CLIENT(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_TP_CLIENT))
#define SHELL_IS_TP_CLIENT_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_TP_CLIENT))
#define SHELL_TP_CLIENT_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_TP_CLIENT, \
                              ShellTpClientClass))

typedef void (*ShellTpClientObserveChannelsImpl) (ShellTpClient *client,
                                                  TpAccount *account,
                                                  TpConnection *connection,
                                                  GList *channels,
                                                  TpChannelDispatchOperation *dispatch_operation,
                                                  GList *requests,
                                                  TpObserveChannelsContext *context,
                                                  gpointer user_data);

void shell_tp_client_set_observe_channels_func (ShellTpClient *self,
                                                ShellTpClientObserveChannelsImpl observe_impl,
                                                gpointer user_data,
                                                GDestroyNotify destroy);

typedef void (*ShellTpClientApproveChannelsImpl) (
    ShellTpClient *client,
    TpAccount *account,
    TpConnection *connection,
    GList *channels,
    TpChannelDispatchOperation *dispatch_operation,
    TpAddDispatchOperationContext *context,
    gpointer user_data);

void shell_tp_client_set_approve_channels_func (ShellTpClient *self,
    ShellTpClientApproveChannelsImpl approve_impl,
    gpointer user_data,
    GDestroyNotify destroy);

typedef void (*ShellTpClientHandleChannelsImpl) (
    ShellTpClient *client,
    TpAccount *account,
    TpConnection *connection,
    GList *channels,
    GList *requests_satisfied,
    gint64 user_action_time,
    TpHandleChannelsContext *context,
    gpointer user_data);

void shell_tp_client_set_handle_channels_func (ShellTpClient *self,
    ShellTpClientHandleChannelsImpl handle_channels_impl,
    gpointer user_data,
    GDestroyNotify destroy);

typedef void (*ShellTpClientContactListChangedImpl) (
    TpConnection *connection,
    GPtrArray *added,
    GPtrArray *removed,
    gpointer user_data);

void shell_tp_client_set_contact_list_changed_func (ShellTpClient *self,
    ShellTpClientContactListChangedImpl contact_list_changed_impl,
    gpointer user_data,
    GDestroyNotify destroy);

void shell_tp_client_grab_contact_list_changed (ShellTpClient *self,
    TpConnection *conn);

/* Telepathy utility functions */
typedef void (*ShellGetTpContactCb) (TpConnection *connection,
                                     GList *contacts,
                                     TpHandle *failed);

void shell_get_tp_contacts (TpConnection *self,
                            guint n_handles,
                            const TpHandle *handles,
                            guint n_features,
                            const TpContactFeature *features,
                            ShellGetTpContactCb callback);

typedef void (*ShellGetSelfContactFeaturesCb) (TpConnection *connection,
                                               TpContact *contact);

void shell_get_self_contact_features (TpConnection *self,
                                      guint n_features,
                                      const TpContactFeature *features,
                                      ShellGetSelfContactFeaturesCb callback);

void shell_get_contact_events (TplLogManager *log_manager,
                               TpAccount *account,
                               TplEntity *entity,
                               guint num_events,
                               GAsyncReadyCallback callback);

void shell_decline_dispatch_op (TpAddDispatchOperationContext *context,
                                const gchar *message);

G_END_DECLS
#endif /* __SHELL_TP_CLIENT_H__ */
