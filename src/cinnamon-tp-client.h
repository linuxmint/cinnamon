/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#ifndef __CINNAMON_TP_CLIENT_H__
#define __CINNAMON_TP_CLIENT_H__

#include <dbus/dbus-glib.h>
#include <glib-object.h>

#include <telepathy-glib/telepathy-glib.h>
#include <telepathy-logger/telepathy-logger.h>

G_BEGIN_DECLS

typedef struct _CinnamonTpClient CinnamonTpClient;
typedef struct _CinnamonTpClientClass CinnamonTpClientClass;
typedef struct _CinnamonTpClientPrivate CinnamonTpClientPrivate;

struct _CinnamonTpClientClass {
    /*<private>*/
    TpBaseClientClass parent_class;
};

struct _CinnamonTpClient {
    /*<private>*/
    TpBaseClient parent;
    CinnamonTpClientPrivate *priv;
};

GType cinnamon_tp_client_get_type (void);

#define CINNAMON_TYPE_TP_CLIENT \
  (cinnamon_tp_client_get_type ())
#define CINNAMON_TP_CLIENT(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_TP_CLIENT, \
                               CinnamonTpClient))
#define CINNAMON_TP_CLIENT_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_TP_CLIENT, \
                            CinnamonTpClientClass))
#define CINNAMON_IS_TP_CLIENT(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_TP_CLIENT))
#define CINNAMON_IS_TP_CLIENT_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_TP_CLIENT))
#define CINNAMON_TP_CLIENT_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_TP_CLIENT, \
                              CinnamonTpClientClass))

typedef void (*CinnamonTpClientObserveChannelsImpl) (CinnamonTpClient *client,
                                                  TpAccount *account,
                                                  TpConnection *connection,
                                                  GList *channels,
                                                  TpChannelDispatchOperation *dispatch_operation,
                                                  GList *requests,
                                                  TpObserveChannelsContext *context,
                                                  gpointer user_data);

void cinnamon_tp_client_set_observe_channels_func (CinnamonTpClient *self,
                                                CinnamonTpClientObserveChannelsImpl observe_impl,
                                                gpointer user_data,
                                                GDestroyNotify destroy);

typedef void (*CinnamonTpClientApproveChannelsImpl) (
    CinnamonTpClient *client,
    TpAccount *account,
    TpConnection *connection,
    GList *channels,
    TpChannelDispatchOperation *dispatch_operation,
    TpAddDispatchOperationContext *context,
    gpointer user_data);

void cinnamon_tp_client_set_approve_channels_func (CinnamonTpClient *self,
    CinnamonTpClientApproveChannelsImpl approve_impl,
    gpointer user_data,
    GDestroyNotify destroy);

typedef void (*CinnamonTpClientHandleChannelsImpl) (
    CinnamonTpClient *client,
    TpAccount *account,
    TpConnection *connection,
    GList *channels,
    GList *requests_satisfied,
    gint64 user_action_time,
    TpHandleChannelsContext *context,
    gpointer user_data);

void cinnamon_tp_client_set_handle_channels_func (CinnamonTpClient *self,
    CinnamonTpClientHandleChannelsImpl handle_channels_impl,
    gpointer user_data,
    GDestroyNotify destroy);

typedef void (*CinnamonTpClientContactListChangedImpl) (
    TpConnection *connection,
    GPtrArray *added,
    GPtrArray *removed,
    gpointer user_data);

void cinnamon_tp_client_set_contact_list_changed_func (CinnamonTpClient *self,
    CinnamonTpClientContactListChangedImpl contact_list_changed_impl,
    gpointer user_data,
    GDestroyNotify destroy);

void cinnamon_tp_client_grab_contact_list_changed (CinnamonTpClient *self,
    TpConnection *conn);

/* Telepathy utility functions */
typedef void (*CinnamonGetTpContactCb) (TpConnection *connection,
                                     GList *contacts,
                                     TpHandle *failed);

void cinnamon_get_tp_contacts (TpConnection *self,
                            guint n_handles,
                            const TpHandle *handles,
                            guint n_features,
                            const TpContactFeature *features,
                            CinnamonGetTpContactCb callback);

typedef void (*CinnamonGetSelfContactFeaturesCb) (TpConnection *connection,
                                               TpContact *contact);

void cinnamon_get_self_contact_features (TpConnection *self,
                                      guint n_features,
                                      const TpContactFeature *features,
                                      CinnamonGetSelfContactFeaturesCb callback);

void cinnamon_get_contact_events (TplLogManager *log_manager,
                               TpAccount *account,
                               TplEntity *entity,
                               guint num_events,
                               GAsyncReadyCallback callback);

void cinnamon_decline_dispatch_op (TpAddDispatchOperationContext *context,
                                const gchar *message);

G_END_DECLS
#endif /* __CINNAMON_TP_CLIENT_H__ */
