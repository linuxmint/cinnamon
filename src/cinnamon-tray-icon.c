/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include "cinnamon-tray-icon.h"
#include "cinnamon-gtk-embed.h"
#include "tray/na-tray-child.h"
#include <gdk/gdkx.h>
#include <X11/Xatom.h>
#include "st.h"

enum {
   PROP_0,

   PROP_PID,
   PROP_TITLE,
   PROP_WM_CLASS
};

struct _CinnamonTrayIconPrivate
{
  NaTrayChild *socket;

  pid_t pid;
  char *title, *wm_class;
  gboolean entered;
};

G_DEFINE_TYPE (CinnamonTrayIcon, cinnamon_tray_icon, CINNAMON_TYPE_GTK_EMBED);

static void
cinnamon_tray_icon_finalize (GObject *object)
{
  CinnamonTrayIcon *icon = CINNAMON_TRAY_ICON (object);

  g_free (icon->priv->title);
  g_free (icon->priv->wm_class);

  G_OBJECT_CLASS (cinnamon_tray_icon_parent_class)->finalize (object);
}

static void
cinnamon_tray_icon_constructed (GObject *object)
{
  GdkWindow *icon_app_window;
  CinnamonTrayIcon *icon = CINNAMON_TRAY_ICON (object);
  CinnamonEmbeddedWindow *window;
  GdkDisplay *display;
  Window plug_xid;
  Atom _NET_WM_PID, type;
  int result, format;
  gulong nitems, bytes_after, *val = NULL;

  /* We do all this now rather than computing it on the fly later,
   * because Cinnamon may want to see their values from a
   * tray-icon-removed signal handler, at which point the plug has
   * already been removed from the socket.
   */

  g_object_get (object, "window", &window, NULL);
  g_return_if_fail (window != NULL);
  icon->priv->socket = NA_TRAY_CHILD (gtk_bin_get_child (GTK_BIN (window)));
  g_object_unref (window);

  icon->priv->title = na_tray_child_get_title (icon->priv->socket);
  na_tray_child_get_wm_class (icon->priv->socket, NULL, &icon->priv->wm_class);

  icon_app_window = gtk_socket_get_plug_window (GTK_SOCKET (icon->priv->socket));
  if (icon_app_window == NULL)
    {
      g_warning ("cinnamon tray: icon app window is gone");
      return;
    }
  plug_xid = GDK_WINDOW_XID (icon_app_window);

  display = gtk_widget_get_display (GTK_WIDGET (icon->priv->socket));
  gdk_x11_display_error_trap_push (display);
  _NET_WM_PID = gdk_x11_get_xatom_by_name_for_display (display, "_NET_WM_PID");
  result = XGetWindowProperty (GDK_DISPLAY_XDISPLAY (display), plug_xid,
                               _NET_WM_PID, 0, G_MAXLONG, False, XA_CARDINAL,
                               &type, &format, &nitems,
                               &bytes_after, (guchar **)&val);
  if (!gdk_x11_display_error_trap_pop (display) &&
      result == Success &&
      type == XA_CARDINAL &&
      nitems == 1)
    icon->priv->pid = *val;

  if (val)
    XFree (val);
}

static void
cinnamon_tray_icon_get_property (GObject         *object,
                              guint            prop_id,
                              GValue          *value,
                              GParamSpec      *pspec)
{
  CinnamonTrayIcon *icon = CINNAMON_TRAY_ICON (object);

  switch (prop_id)
    {
    case PROP_PID:
      g_value_set_uint (value, icon->priv->pid);
      break;

    case PROP_TITLE:
      g_value_set_string (value, icon->priv->title);
      break;

    case PROP_WM_CLASS:
      g_value_set_string (value, icon->priv->wm_class);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_tray_icon_class_init (CinnamonTrayIconClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  g_type_class_add_private (klass, sizeof (CinnamonTrayIconPrivate));

  object_class->get_property = cinnamon_tray_icon_get_property;
  object_class->constructed  = cinnamon_tray_icon_constructed;
  object_class->finalize     = cinnamon_tray_icon_finalize;

  g_object_class_install_property (object_class,
                                   PROP_PID,
                                   g_param_spec_uint ("pid",
                                                      "PID",
                                                      "The PID of the icon's application",
                                                      0, G_MAXUINT, 0,
                                                      G_PARAM_READABLE));
  g_object_class_install_property (object_class,
                                   PROP_TITLE,
                                   g_param_spec_string ("title",
                                                        "Title",
                                                        "The icon's window title",
                                                        NULL,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (object_class,
                                   PROP_WM_CLASS,
                                   g_param_spec_string ("wm-class",
                                                        "WM Class",
                                                        "The icon's window WM_CLASS",
                                                        NULL,
                                                        G_PARAM_READABLE));
}

static void
cinnamon_tray_icon_init (CinnamonTrayIcon *icon)
{
  icon->priv = G_TYPE_INSTANCE_GET_PRIVATE (icon, CINNAMON_TYPE_TRAY_ICON,
                                            CinnamonTrayIconPrivate);
}

/*
 * Public API
 */
ClutterActor *
cinnamon_tray_icon_new (CinnamonEmbeddedWindow *window)
{
  g_return_val_if_fail (CINNAMON_IS_EMBEDDED_WINDOW (window), NULL);

  return g_object_new (CINNAMON_TYPE_TRAY_ICON,
                       "window", window,
                       NULL);
}

#define DEBUG_TRAY_EVENTS 0

static void
send_button_xevent (ClutterEventType  event_type,
                    ClutterEvent     *event,
                    GdkWindow        *remote_window,
                    GdkScreen        *screen,
                    gboolean          clutter_scroll)
{
  Display *xdisplay;
  Window xwindow, xrootwindow;
  guint32 c_event_time;
  int x_root, y_root, target_x, target_y;

  c_event_time = clutter_event_get_time (event);
  xwindow = GDK_WINDOW_XID (remote_window);
  xdisplay = GDK_WINDOW_XDISPLAY (remote_window);
  xrootwindow = GDK_WINDOW_XID (gdk_screen_get_root_window (screen));
  target_x = gdk_window_get_width (remote_window) / 2;
  target_y = gdk_window_get_height (remote_window) / 2;
  gdk_window_get_origin (remote_window, &x_root, &y_root);
  x_root += target_x;
  y_root += target_y;

  XButtonEvent xbevent;

  xbevent.type = event_type;
  xbevent.window = xwindow;
  xbevent.root = xrootwindow;
  xbevent.subwindow = None;
  xbevent.time = c_event_time;
  xbevent.x = target_x;
  xbevent.y = target_y;
  xbevent.x_root = x_root;
  xbevent.y_root = y_root;
  xbevent.state = clutter_event_get_state (event);
  xbevent.same_screen = True;

  if (clutter_scroll)
    {
      uint button;

      button = 4;

      switch (clutter_event_get_scroll_direction (event))
        {
          case CLUTTER_SCROLL_UP:
            button = 4;
            break;
          case CLUTTER_SCROLL_DOWN:
            button = 5;
            break;
          case CLUTTER_SCROLL_LEFT:
            button = 6;
            break;
          case CLUTTER_SCROLL_RIGHT:
            button = 7;
            break;
          default:
            g_warn_if_reached ();
            break;
        }

      xbevent.button = button;
    }
  else
  {
    xbevent.button = clutter_event_get_button (event);
  }

  XSendEvent (xdisplay, xwindow, False, 0, (XEvent *) &xbevent);
}

static void
send_crossing_xevent (ClutterEventType  event_type,
                      ClutterEvent     *event,
                      GdkWindow        *remote_window,
                      GdkScreen        *screen)
{
  Display *xdisplay;
  Window xwindow, xrootwindow;
  guint32 c_event_time;
  int x_root, y_root, target_x, target_y;

  c_event_time = clutter_event_get_time (event);
  xwindow = GDK_WINDOW_XID (remote_window);
  xdisplay = GDK_WINDOW_XDISPLAY (remote_window);
  xrootwindow = GDK_WINDOW_XID (gdk_screen_get_root_window (screen));
  target_x = gdk_window_get_width (remote_window) / 2;
  target_y = gdk_window_get_height (remote_window) / 2;
  gdk_window_get_origin (remote_window, &x_root, &y_root);
  x_root += target_x;
  y_root += target_y;

  XCrossingEvent xcevent;

  xcevent.type = event_type;
  xcevent.window = xwindow;
  xcevent.root = xrootwindow;
  xcevent.subwindow = None;
  xcevent.time = c_event_time;
  xcevent.x = target_x;
  xcevent.y = target_y;
  xcevent.x_root = x_root;
  xcevent.y_root = y_root;
  xcevent.mode = NotifyNormal;
  xcevent.detail = NotifyNonlinear;
  xcevent.same_screen = True;

  XSendEvent (xdisplay, xwindow, False, 0, (XEvent *) &xcevent);
}

/**
 * cinnamon_tray_icon_handle_event:
 * @icon: a #CinnamonTrayIcon
 * @event_type: a #ClutterEventType
 * @event: the #ClutterEvent
 *
 * Converts a ClutterEvent into an XEvent.
 *
 * Returns: Whether to continue the event chain.
 */
gboolean
cinnamon_tray_icon_handle_event (CinnamonTrayIcon *icon,
                                 ClutterEventType  event_type,
                                 ClutterEvent     *event)
{
  GdkScreen *screen;
  GdkWindow *remote_window;
  gboolean cont = CLUTTER_EVENT_PROPAGATE;

  gdk_error_trap_push ();

  remote_window = gtk_socket_get_plug_window (GTK_SOCKET (icon->priv->socket));
  if (remote_window == NULL)
    {
      g_warning ("cinnamon tray: plug window is gone");

      gdk_error_trap_pop_ignored ();
      return CLUTTER_EVENT_STOP;
    }

  screen = gdk_window_get_screen (remote_window);

  switch (event_type) {
    case CLUTTER_BUTTON_PRESS:
    case CLUTTER_BUTTON_RELEASE:
      {
        if (DEBUG_TRAY_EVENTS)
          g_message ("%s", event_type == CLUTTER_BUTTON_PRESS ? "ButtonPress" : "ButtonRelease");

        if (!icon->priv->entered)
          {
            send_crossing_xevent (EnterNotify,
                                  event,
                                  remote_window,
                                  screen);
            icon->priv->entered = TRUE;
          }

        send_button_xevent (event_type == CLUTTER_BUTTON_PRESS ? ButtonPress : ButtonRelease,
                            event,
                            remote_window,
                            screen,
                            FALSE);

        icon->priv->entered = FALSE;

        cont = CLUTTER_EVENT_STOP;
        break;
      }
    case CLUTTER_ENTER:
    case CLUTTER_LEAVE:
      {
        if ((event_type == CLUTTER_ENTER && icon->priv->entered) || (event_type == CLUTTER_LEAVE && !icon->priv->entered))
          {
            if (DEBUG_TRAY_EVENTS)
              g_message ("Bail tray icon on crossing event");

            cont = CLUTTER_EVENT_STOP;
            break;
          }

        if (DEBUG_TRAY_EVENTS)
          g_message ("%s", event_type == CLUTTER_ENTER ? "EnterNotify" : "LeaveNotify");

        send_crossing_xevent (event_type == CLUTTER_ENTER ? EnterNotify : LeaveNotify,
                              event,
                              remote_window,
                              screen);

        icon->priv->entered = event_type == CLUTTER_ENTER;

        cont = CLUTTER_EVENT_PROPAGATE;
        break;
      }
    case CLUTTER_SCROLL:
      {
        if (clutter_event_get_scroll_direction (event) == CLUTTER_SCROLL_SMOOTH)
          {
            cont = CLUTTER_EVENT_STOP;
            break;
          }

        if (DEBUG_TRAY_EVENTS)
          g_message ("Scroll");

        send_crossing_xevent (EnterNotify,
                              event,
                              remote_window,
                              screen);

        send_button_xevent (ButtonPress,
                            event,
                            remote_window,
                            screen,
                            TRUE);

        send_button_xevent (ButtonRelease,
                            event,
                            remote_window,
                            screen,
                            TRUE);

        send_crossing_xevent (LeaveNotify,
                              event,
                              remote_window,
                              screen);

        icon->priv->entered = FALSE;

        cont = CLUTTER_EVENT_STOP;
        break;
      }
    case CLUTTER_MOTION:
      cont = CLUTTER_EVENT_STOP;
    default:
      cont = CLUTTER_EVENT_PROPAGATE;
  }

  gdk_error_trap_pop_ignored ();
  return cont;
}