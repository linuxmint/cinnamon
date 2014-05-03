/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#ifdef HAVE_MALLINFO
#include <malloc.h>
#endif
#include <stdlib.h>
#include <string.h>
#include <X11/Xlib.h>
#include <clutter/clutter.h>
#include <clutter/x11/clutter-x11.h>
#include <dbus/dbus-glib.h>
#include <gdk/gdk.h>
#include <gdk/gdkx.h>
#include <gtk/gtk.h>
#include <glib/gi18n-lib.h>
#include <girepository.h>
#include <meta/main.h>
#include <meta/meta-plugin.h>
#include <meta/prefs.h>

#include "cinnamon-a11y.h"
#include "cinnamon-global.h"
#include "cinnamon-global-private.h"
#include "cinnamon-perf-log.h"
#include "st.h"

extern GType gnome_cinnamon_plugin_get_type (void);

#define CINNAMON_DBUS_SERVICE "org.Cinnamon"
#define MAGNIFIER_DBUS_SERVICE "org.gnome.Magnifier"

static void
cinnamon_dbus_init (gboolean replace)
{
  GError *error = NULL;
  DBusGConnection *session;
  DBusGProxy *bus;
  guint32 request_name_flags;
  guint32 request_name_result;

  /** TODO:
   * In the future we should use GDBus for this.  However, in
   * order to do that, we need to port all of the JavaScript
   * code.  Otherwise, the name will be claimed on the wrong
   * connection.
   */
  session = dbus_g_bus_get (DBUS_BUS_SESSION, NULL);

  bus = dbus_g_proxy_new_for_name (session,
                                   DBUS_SERVICE_DBUS,
                                   DBUS_PATH_DBUS,
                                   DBUS_INTERFACE_DBUS);

  request_name_flags = DBUS_NAME_FLAG_DO_NOT_QUEUE | DBUS_NAME_FLAG_ALLOW_REPLACEMENT;
  if (replace)
    request_name_flags |= DBUS_NAME_FLAG_REPLACE_EXISTING;
  if (!dbus_g_proxy_call (bus, "RequestName", &error,
                          G_TYPE_STRING, CINNAMON_DBUS_SERVICE,
                          G_TYPE_UINT, request_name_flags,
                          G_TYPE_INVALID,
                          G_TYPE_UINT, &request_name_result,
                          G_TYPE_INVALID))
    {
      g_printerr ("failed to acquire org.Cinnamon: %s\n", error->message);
      exit (1);
    }
  if (!(request_name_result == DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER
        || request_name_result == DBUS_REQUEST_NAME_REPLY_ALREADY_OWNER))
    {
      g_printerr ("%s already exists on bus and --replace not specified\n",
                  CINNAMON_DBUS_SERVICE);
      exit (1);
    }

  /* Also grab org.gnome.Panel to replace any existing panel process */
  if (!dbus_g_proxy_call (bus, "RequestName", &error, G_TYPE_STRING,
                          "org.gnome.Panel", G_TYPE_UINT,
                          DBUS_NAME_FLAG_REPLACE_EXISTING | request_name_flags,
                          G_TYPE_INVALID, G_TYPE_UINT,
                          &request_name_result, G_TYPE_INVALID))
    {
      g_print ("failed to acquire org.gnome.Panel: %s\n", error->message);
      exit (1);
    }

  /* ...and the org.gnome.Magnifier service.
   */
  if (!dbus_g_proxy_call (bus, "RequestName", &error,
                          G_TYPE_STRING, MAGNIFIER_DBUS_SERVICE,
                          G_TYPE_UINT, DBUS_NAME_FLAG_REPLACE_EXISTING | request_name_flags,
                          G_TYPE_INVALID,
                          G_TYPE_UINT, &request_name_result,
                          G_TYPE_INVALID))
    {
      g_print ("failed to acquire %s: %s\n", MAGNIFIER_DBUS_SERVICE, error->message);
      /* Failing to acquire the magnifer service is not fatal.  Log the error,
       * but keep going. */
    }

  /* ...and the org.freedesktop.Notifications service; we always
   * specify REPLACE_EXISTING to ensure we kill off
   * notification-daemon if it was running.
   */
  if (!dbus_g_proxy_call (bus, "RequestName", &error,
                          G_TYPE_STRING, "org.freedesktop.Notifications",
                          G_TYPE_UINT, DBUS_NAME_FLAG_REPLACE_EXISTING | request_name_flags,
                          G_TYPE_INVALID,
                          G_TYPE_UINT, &request_name_result,
                          G_TYPE_INVALID))
    {
      g_print ("failed to acquire org.freedesktop.Notifications: %s\n", error->message);
    }

  /* ...and the on-screen keyboard service */
  if (!dbus_g_proxy_call (bus, "RequestName", &error,
                          G_TYPE_STRING, "org.gnome.Caribou.Keyboard",
                          G_TYPE_UINT, DBUS_NAME_FLAG_REPLACE_EXISTING,
                          G_TYPE_INVALID,
                          G_TYPE_UINT, &request_name_result,
                          G_TYPE_INVALID))
    {
      g_print ("failed to acquire org.gnome.Caribou.Keyboard: %s\n", error->message);
    }

  g_object_unref (bus);
}

static void
malloc_statistics_callback (CinnamonPerfLog *perf_log,
                            gpointer      data)
{
#ifdef HAVE_MALLINFO
  struct mallinfo info = mallinfo ();

  cinnamon_perf_log_update_statistic_i (perf_log,
                                     "malloc.arenaSize",
                                     info.arena);
  cinnamon_perf_log_update_statistic_i (perf_log,
                                     "malloc.mmapSize",
                                     info.hblkhd);
  cinnamon_perf_log_update_statistic_i (perf_log,
                                     "malloc.usedSize",
                                     info.uordblks);
#endif
}

static void
cinnamon_perf_log_init (void)
{
  CinnamonPerfLog *perf_log = cinnamon_perf_log_get_default ();

  /* For probably historical reasons, mallinfo() defines the returned values,
   * even those in bytes as int, not size_t. We're determined not to use
   * more than 2G of malloc'ed memory, so are OK with that.
   */
  cinnamon_perf_log_define_statistic (perf_log,
                                   "malloc.arenaSize",
                                   "Amount of memory allocated by malloc() with brk(), in bytes",
                                   "i");
  cinnamon_perf_log_define_statistic (perf_log,
                                   "malloc.mmapSize",
                                   "Amount of memory allocated by malloc() with mmap(), in bytes",
                                   "i");
  cinnamon_perf_log_define_statistic (perf_log,
                                   "malloc.usedSize",
                                   "Amount of malloc'ed memory currently in use",
                                   "i");

  cinnamon_perf_log_add_statistics_callback (perf_log,
                                          malloc_statistics_callback,
                                          NULL, NULL);
}

static void
muted_log_handler (const char     *log_domain,
                   GLogLevelFlags  log_level,
                   const char     *message,
                   gpointer        data)
{
  /* Intentionally empty to discard message */
}

static gboolean
print_version (const gchar    *option_name,
               const gchar    *value,
               gpointer        data,
               GError        **error)
{
  g_print ("Cinnamon %s\n", VERSION);
  exit (0);
}

GOptionEntry gnome_cinnamon_options[] = {
  {
    "version", 0, G_OPTION_FLAG_NO_ARG, G_OPTION_ARG_CALLBACK,
    print_version,
    N_("Print version"),
    NULL
  },
  { NULL }
};

static void
center_pointer_on_screen ()
{
  Display *dpy;
  Window root_window;
  Screen *screen;
  
  dpy = XOpenDisplay(0);
  root_window = XRootWindow(dpy, 0);
  XSelectInput(dpy, root_window, KeyReleaseMask);
  screen = DefaultScreenOfDisplay(dpy);
  XWarpPointer(dpy, None, root_window, 0, 0, 0, 0, WidthOfScreen(screen)/2, HeightOfScreen(screen)/2);
  XFlush(dpy);
}

int
main (int argc, char **argv)
{
  GOptionContext *ctx;
  GError *error = NULL;
  int ecode;
  g_setenv ("CLUTTER_DISABLE_XINPUT", "1", TRUE);
  g_type_init ();

  bindtextdomain (GETTEXT_PACKAGE, LOCALEDIR);
  bind_textdomain_codeset (GETTEXT_PACKAGE, "UTF-8");
  textdomain (GETTEXT_PACKAGE);

  g_setenv ("GDK_SCALE", "1", TRUE);

  ctx = meta_get_option_context ();
  g_option_context_add_main_entries (ctx, gnome_cinnamon_options, GETTEXT_PACKAGE);
  if (!g_option_context_parse (ctx, &argc, &argv, &error))
    {
      g_printerr ("%s: %s\n", argv[0], error->message);
      exit (1);
    }

  g_option_context_free (ctx);

  meta_plugin_type_register (gnome_cinnamon_plugin_get_type ());

  /* Prevent meta_init() from causing gtk to load gail and at-bridge */
  g_setenv ("NO_GAIL", "1", TRUE);
  g_setenv ("NO_AT_BRIDGE", "1", TRUE);
  meta_init ();
  g_unsetenv ("NO_GAIL");
  g_unsetenv ("NO_AT_BRIDGE");
  g_unsetenv ("CLUTTER_DISABLE_XINPUT");

  /* FIXME: Add gjs API to set this stuff and don't depend on the
   * environment.  These propagate to child processes.
   */
  g_setenv ("GJS_DEBUG_OUTPUT", "stderr", TRUE);
  g_setenv ("GJS_DEBUG_TOPICS", "JS ERROR;JS LOG", TRUE);

  g_setenv ("CINNAMON_VERSION", VERSION, TRUE);


  center_pointer_on_screen();

  cinnamon_dbus_init (meta_get_replace_current_wm ());
  cinnamon_a11y_init ();
  cinnamon_perf_log_init ();

  g_irepository_prepend_search_path (CINNAMON_PKGLIBDIR);
#if HAVE_BLUETOOTH
  g_irepository_prepend_search_path (BLUETOOTH_DIR);
#endif

  /* Disable debug spew from various libraries */
  g_log_set_handler ("Gvc", G_LOG_LEVEL_DEBUG,
                     muted_log_handler, NULL);
  g_log_set_handler ("AccountsService", G_LOG_LEVEL_DEBUG,
                     muted_log_handler, NULL);
  g_log_set_handler ("Bluetooth", G_LOG_LEVEL_DEBUG | G_LOG_LEVEL_MESSAGE,
                     muted_log_handler, NULL);

  /* Initialize the global object */
  _cinnamon_global_init (NULL);

  g_unsetenv ("GDK_SCALE");

  ecode = meta_run ();

  if (g_getenv ("CINNAMON_ENABLE_CLEANUP"))
    {
      g_printerr ("Doing final cleanup...\n");
      g_object_unref (cinnamon_global_get ());
    }

  return ecode;
}
