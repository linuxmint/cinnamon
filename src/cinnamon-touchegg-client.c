/* Adapted from ToucheggClient.js in gnome-shell-extension-x11gestures
 * (https://github.com/JoseExposito/gnome-shell-extension-x11gestures) */

#include <config.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <gtk/gtk.h>
#include <glib/gstdio.h>

#include "cinnamon-touchegg-client.h"

#define DBUS_ADDRESS "unix:abstract=touchegg"
#define DBUS_INTERFACE_NAME "io.github.joseexposito.Touchegg"
#define DBUS_OBJECT_PATH "/io/github/joseexposito/Touchegg"

typedef struct
{
    GDBusConnection *connection;
    GCancellable *cancellable;

    gchar *last_signal;
    GVariant *last_params;

    guint  signal_listener_id;
    guint  retry_timer_id;
} CinnamonToucheggClientPrivate;

struct _CinnamonToucheggClient
{
    GObject parent_instance;
};

G_DEFINE_TYPE_WITH_PRIVATE (CinnamonToucheggClient, cinnamon_touchegg_client, G_TYPE_OBJECT)

enum
{
    GESTURE_BEGIN,
    GESTURE_UPDATE,
    GESTURE_END,
    LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = {0, };

static void
emit_our_signal (CinnamonToucheggClient *client,
                 const gchar            *our_signal,
                 GVariant               *params)
{
    guint type, direction, device;
    gint fingers;
    gdouble percentage;
    guint64 elapsed_time;
    g_variant_get (params, "(uudiut)", &type, &direction, &percentage, &fingers, &device, &elapsed_time);

    g_debug ("CinnamonToucheggClient signal: %s: type %u, direction %u, progress %0.1f, fingers %d, device %u, elapsed_time %lu",
             our_signal, type, direction, percentage, fingers, device, elapsed_time);

    g_signal_emit_by_name (client, our_signal, type, direction, percentage, fingers, device, g_get_monotonic_time ());
}

static void
handle_signal (GDBusConnection *connection,
               const gchar     *sender_name,
               const gchar     *object_path,
               const gchar     *interface_name,
               const gchar     *signal_name,
               GVariant        *params,
               gpointer         user_data)
{
    g_return_if_fail (CINNAMON_IS_TOUCHEGG_CLIENT (user_data));
    CinnamonToucheggClient *client = CINNAMON_TOUCHEGG_CLIENT (user_data);
    CinnamonToucheggClientPrivate *priv = cinnamon_touchegg_client_get_instance_private (client);

    const gchar *our_signal = NULL;

    if (g_strcmp0 (signal_name, "OnGestureBegin") == 0)
    {
        our_signal = "gesture-begin";
    }
    else
    if (g_strcmp0 (signal_name, "OnGestureUpdate") == 0)
    {
        our_signal = "gesture-update";
    }
    else
    if (g_strcmp0 (signal_name, "OnGestureEnd") == 0)
    {
        our_signal = "gesture-end";
    }

    if (our_signal == NULL) {
        g_warning ("Unknown signal '%s' received from touchegg daemon", signal_name);
        return;
    }

    priv->last_params = g_variant_ref (params);
    priv->last_signal = g_strdup (our_signal);

    emit_our_signal (client, our_signal, params);
}

static void init_connection (CinnamonToucheggClient *client);

static gboolean
retry_connection (gpointer data)
{
    CinnamonToucheggClient *client = CINNAMON_TOUCHEGG_CLIENT (data);
    CinnamonToucheggClientPrivate *priv = cinnamon_touchegg_client_get_instance_private (client);

    g_debug ("CinnamonToucheggClient: retrying connection");

    priv->retry_timer_id = 0;

    init_connection (client);

    return G_SOURCE_REMOVE;
}

static void
connection_lost (GDBusConnection *connection,
                 gboolean         peer_vanished,
                 GError          *error,
                 gpointer         user_data)
{
    CinnamonToucheggClient *client = CINNAMON_TOUCHEGG_CLIENT (user_data);
    CinnamonToucheggClientPrivate *priv = cinnamon_touchegg_client_get_instance_private (client);

    if (priv->last_signal != NULL && g_strcmp0 (priv->last_signal, "gesture-end") != 0)
    {
        emit_our_signal (client, "gesture-end", priv->last_params);

        g_clear_pointer (&priv->last_signal, g_free);
        g_clear_pointer (&priv->last_params, g_variant_unref);
    }

    priv->signal_listener_id = 0;
    g_clear_object (&priv->connection);

    // shutting down
    if (!peer_vanished && error == NULL)
    {
        return;
    }

    if (error != NULL)
    {
        g_warning ("Connection to Touchegg daemon lost, will try to reconnect: %s", error->message);
    }

    priv->retry_timer_id = g_timeout_add_seconds (5, (GSourceFunc) retry_connection, client);
}

static void
connect_listener (CinnamonToucheggClient *client)
{
    CinnamonToucheggClientPrivate *priv = cinnamon_touchegg_client_get_instance_private (client);
    g_debug ("CinnamonToucheggClient: connect_listener");

    priv->signal_listener_id = g_dbus_connection_signal_subscribe(priv->connection,
                                                                  NULL,
                                                                  DBUS_INTERFACE_NAME,
                                                                  NULL,
                                                                  DBUS_OBJECT_PATH,
                                                                  NULL,
                                                                  G_DBUS_SIGNAL_FLAGS_NONE,
                                                                  (GDBusSignalCallback) handle_signal,
                                                                  client,
                                                                  NULL);
}

static void
got_connection (GObject      *source,
                GAsyncResult *res,
                gpointer      user_data)
{
    g_return_if_fail (CINNAMON_IS_TOUCHEGG_CLIENT (user_data));
    CinnamonToucheggClient *client = CINNAMON_TOUCHEGG_CLIENT (user_data);
    CinnamonToucheggClientPrivate *priv = cinnamon_touchegg_client_get_instance_private (client);

    GError *error = NULL;
    priv->connection = g_dbus_connection_new_for_address_finish (res, &error);

    if (error != NULL)
    {
        g_critical ("Couldn't connect with touchegg daemon: %s", error->message);
        g_error_free (error);
        priv->retry_timer_id = g_timeout_add_seconds (5, (GSourceFunc) retry_connection, client);
        return;
    }

    g_signal_connect_object (priv->connection, "closed", G_CALLBACK (connection_lost), client, 0);

    connect_listener (client);
}


static void
init_connection (CinnamonToucheggClient *client)
{
    CinnamonToucheggClientPrivate *priv = cinnamon_touchegg_client_get_instance_private (client);
    g_debug ("CinnamonToucheggClient: init_client");

    if (priv->cancellable != NULL) {
        g_cancellable_cancel (priv->cancellable);
        g_object_unref (priv->cancellable);
    }

    priv->cancellable = g_cancellable_new ();

    g_dbus_connection_new_for_address (DBUS_ADDRESS,
                                       G_DBUS_CONNECTION_FLAGS_AUTHENTICATION_CLIENT,
                                       NULL,
                                       priv->cancellable,
                                       (GAsyncReadyCallback) got_connection,
                                       client);
}

static void
cinnamon_touchegg_client_init (CinnamonToucheggClient *client)
{
    init_connection (client);
}

static void
cinnamon_touchegg_client_dispose (GObject *object)
{
    CinnamonToucheggClient *client = CINNAMON_TOUCHEGG_CLIENT (object);
    CinnamonToucheggClientPrivate *priv = cinnamon_touchegg_client_get_instance_private (client);
    g_debug ("CinnamonToucheggClient dispose (%p)", object);

    g_clear_handle_id (&priv->retry_timer_id, g_source_remove);

    if (priv->cancellable != NULL) {
        g_cancellable_cancel (priv->cancellable);
        g_object_unref (priv->cancellable);
        priv->cancellable = NULL;
    }

    if (priv->connection != NULL)
    {
        if (priv->signal_listener_id > 0)
        {
            g_dbus_connection_signal_unsubscribe (priv->connection, priv->signal_listener_id);
            priv->signal_listener_id = 0;
        }

        g_dbus_connection_flush_sync (priv->connection, NULL, NULL);
        g_dbus_connection_close_sync (priv->connection, NULL, NULL);

        g_object_unref (priv->connection);
        priv->connection = NULL;
    }

    g_clear_pointer (&priv->last_signal, g_free);
    g_clear_pointer (&priv->last_params, g_variant_unref);

    G_OBJECT_CLASS (cinnamon_touchegg_client_parent_class)->dispose (object);
}

static void
cinnamon_touchegg_client_finalize (GObject *object)
{
    g_debug ("CinnamonToucheggClient finalize (%p)", object);

    G_OBJECT_CLASS (cinnamon_touchegg_client_parent_class)->finalize (object);
}

static void
cinnamon_touchegg_client_class_init (CinnamonToucheggClientClass *klass)
{
    GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

    gobject_class->dispose = cinnamon_touchegg_client_dispose;
    gobject_class->finalize = cinnamon_touchegg_client_finalize;

    signals[GESTURE_BEGIN] =
          g_signal_new ("gesture-begin",
                        CINNAMON_TYPE_TOUCHEGG_CLIENT,
                        G_SIGNAL_RUN_LAST | G_SIGNAL_ACTION,
                        0,
                        NULL, NULL, NULL,
                        G_TYPE_NONE, 6, G_TYPE_UINT, G_TYPE_UINT, G_TYPE_DOUBLE, G_TYPE_INT, G_TYPE_UINT, G_TYPE_INT64);

    signals[GESTURE_UPDATE] =
          g_signal_new ("gesture-update",
                        CINNAMON_TYPE_TOUCHEGG_CLIENT,
                        G_SIGNAL_RUN_LAST | G_SIGNAL_ACTION,
                        0,
                        NULL, NULL, NULL,
                        G_TYPE_NONE, 6, G_TYPE_UINT, G_TYPE_UINT, G_TYPE_DOUBLE, G_TYPE_INT, G_TYPE_UINT, G_TYPE_INT64);

    signals[GESTURE_END] =
          g_signal_new ("gesture-end",
                        CINNAMON_TYPE_TOUCHEGG_CLIENT,
                        G_SIGNAL_RUN_LAST | G_SIGNAL_ACTION,
                        0,
                        NULL, NULL, NULL,
                        G_TYPE_NONE, 6, G_TYPE_UINT, G_TYPE_UINT, G_TYPE_DOUBLE, G_TYPE_INT, G_TYPE_UINT, G_TYPE_INT64);
}

CinnamonToucheggClient *
cinnamon_touchegg_client_new (void)
{
    CinnamonToucheggClient *client = g_object_new (CINNAMON_TYPE_TOUCHEGG_CLIENT, NULL);

    return client;
}
