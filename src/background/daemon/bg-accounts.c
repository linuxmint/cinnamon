#include "config.h"

#include <gio/gio.h>

#include "bg-accounts.h"

#define ACCOUNTS_NAME "org.freedesktop.Accounts"
#define ACCOUNTS_PATH "/org/freedesktop/Accounts"

typedef struct {
    char *path;
    char *object_path;
} SetBackground;

static void
set_background_free (SetBackground *call)
{
    g_free (call->path);
    g_free (call->object_path);
    g_free (call);
}

static void
on_set_background_file_done (GObject      *source,
                             GAsyncResult *result,
                             gpointer      user_data)
{
    SetBackground *call = user_data;
    g_autoptr(GError) err = NULL;
    g_autoptr(GVariant) ret =
        g_dbus_connection_call_finish (G_DBUS_CONNECTION (source), result, &err);

    if (err)
        g_warning ("Could not set the login-screen background for %s: %s",
                   call->object_path, err->message);
    else
        g_debug ("Login-screen background set to %s via " ACCOUNTS_NAME ".User",
                 call->path);

    set_background_free (call);
}

static void
on_display_manager_set_done (GObject      *source,
                             GAsyncResult *result,
                             gpointer      user_data)
{
    SetBackground *call = user_data;
    GDBusConnection *conn = G_DBUS_CONNECTION (source);
    g_autoptr(GError) err = NULL;
    g_autoptr(GVariant) ret = g_dbus_connection_call_finish (conn, result, &err);

    if (!err) {
        g_debug ("Login-screen background set to %s via "
                 "org.freedesktop.DisplayManager.AccountsService", call->path);
        set_background_free (call);
        return;
    }

    g_debug ("org.freedesktop.DisplayManager.AccountsService unavailable (%s), "
             "trying " ACCOUNTS_NAME ".User", err->message);

    g_dbus_connection_call (conn,
                            ACCOUNTS_NAME,
                            call->object_path,
                            ACCOUNTS_NAME ".User",
                            "SetBackgroundFile",
                            g_variant_new ("(s)", call->path),
                            NULL,
                            G_DBUS_CALL_FLAGS_NONE,
                            -1, NULL,
                            on_set_background_file_done,
                            call);
}

static void
on_find_user_done (GObject      *source,
                   GAsyncResult *result,
                   gpointer      user_data)
{
    SetBackground *call = user_data;
    GDBusProxy *proxy = G_DBUS_PROXY (source);
    g_autoptr(GError) err = NULL;
    g_autoptr(GVariant) ret = g_dbus_proxy_call_finish (proxy, result, &err);

    if (err) {
        g_debug ("accountsservice does not know '%s': %s",
                 g_get_user_name (), err->message);
        set_background_free (call);
        return;
    }

    g_variant_get (ret, "(o)", &call->object_path);

    g_dbus_connection_call (g_dbus_proxy_get_connection (proxy),
                            ACCOUNTS_NAME,
                            call->object_path,
                            "org.freedesktop.DBus.Properties",
                            "Set",
                            g_variant_new ("(ssv)",
                                           "org.freedesktop.DisplayManager.AccountsService",
                                           "BackgroundFile",
                                           g_variant_new_string (call->path)),
                            NULL,
                            G_DBUS_CALL_FLAGS_NONE,
                            -1, NULL,
                            on_display_manager_set_done,
                            call);
}

static void
on_accounts_proxy_ready (GObject      *source G_GNUC_UNUSED,
                         GAsyncResult *result,
                         gpointer      user_data)
{
    SetBackground *call = user_data;
    g_autoptr(GError) err = NULL;
    g_autoptr(GDBusProxy) proxy = g_dbus_proxy_new_for_bus_finish (result, &err);

    if (!proxy) {
        g_debug ("Could not contact accountsservice: %s", err->message);
        set_background_free (call);
        return;
    }

    g_dbus_proxy_call (proxy,
                       "FindUserByName",
                       g_variant_new ("(s)", g_get_user_name ()),
                       G_DBUS_CALL_FLAGS_NONE,
                       -1, NULL,
                       on_find_user_done,
                       call);
}

void
bg_accounts_set_background (const char *uri)
{
    static char *published;

    if (!uri || uri[0] == '\0')
        return;

    g_autofree char *path = g_filename_from_uri (uri, NULL, NULL);

    if (!path) {
        g_debug ("Not a local file:// uri, not publishing to accountsservice: %s", uri);
        return;
    }

    if (g_strcmp0 (published, path) == 0)
        return;

    g_free (published);
    published = g_strdup (path);

    SetBackground *call = g_new0 (SetBackground, 1);
    call->path = g_strdup (path);

    g_dbus_proxy_new_for_bus (G_BUS_TYPE_SYSTEM,
                              G_DBUS_PROXY_FLAGS_DO_NOT_LOAD_PROPERTIES |
                              G_DBUS_PROXY_FLAGS_DO_NOT_CONNECT_SIGNALS,
                              NULL,
                              ACCOUNTS_NAME,
                              ACCOUNTS_PATH,
                              ACCOUNTS_NAME,
                              NULL,
                              on_accounts_proxy_ready,
                              call);
}
