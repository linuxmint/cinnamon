/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <fcntl.h>

#include "cinnamon-global-private.h"
#include "cinnamon-screen.h"
#include <meta/meta-x11-display.h>
#include <meta/compositor-mutter.h>
#include <meta/meta-cursor-tracker.h>
#include <meta/meta-background-actor.h>
#include <meta/meta-settings.h>
#include <meta/meta-backend.h>
#include <meta/util.h>
#include <meta/main.h>
#include <cogl-pango/cogl-pango.h>

#define GNOME_DESKTOP_USE_UNSTABLE_API
#include <libcinnamon-desktop/gnome-systemd.h>

static CinnamonGlobal *the_object = NULL;

enum {
  PROP_0,

  PROP_OVERLAY_GROUP,
  PROP_SCREEN,
  PROP_DISPLAY,
  PROP_SCREEN_WIDTH,
  PROP_SCREEN_HEIGHT,
  PROP_STAGE,
  PROP_STAGE_INPUT_MODE,
  PROP_BOTTOM_WINDOW_GROUP,
  PROP_WINDOW_GROUP,
  PROP_TOP_WINDOW_GROUP,
  PROP_BACKGROUND_ACTOR,
  PROP_DESKLET_CONTAINER,
  PROP_WINDOW_MANAGER,
  PROP_SETTINGS,
  PROP_DATADIR,
  PROP_IMAGEDIR,
  PROP_USERDATADIR,
  PROP_FOCUS_MANAGER,
  PROP_UI_SCALE,
  PROP_SESSION_RUNNING,
  PROP_WORKSPACE_MANAGER
};

/* Signals */
enum
{
 NOTIFY_ERROR,
 SCALE_CHANGED,
 SHUTDOWN,
 LAST_SIGNAL
};

G_DEFINE_TYPE(CinnamonGlobal, cinnamon_global, G_TYPE_OBJECT);

static guint cinnamon_global_signals [LAST_SIGNAL] = { 0 };

static void
cinnamon_global_set_property(GObject         *object,
                          guint            prop_id,
                          const GValue    *value,
                          GParamSpec      *pspec)
{
  CinnamonGlobal *global = CINNAMON_GLOBAL (object);

  switch (prop_id)
    {
    case PROP_STAGE_INPUT_MODE:
      cinnamon_global_set_stage_input_mode (global, g_value_get_enum (value));
      break;
    case PROP_SESSION_RUNNING:
      global->session_running = g_value_get_boolean (value);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_global_get_property(GObject         *object,
                          guint            prop_id,
                          GValue          *value,
                          GParamSpec      *pspec)
{
  CinnamonGlobal *global = CINNAMON_GLOBAL (object);

  switch (prop_id)
    {
    case PROP_OVERLAY_GROUP:
      g_value_set_object (value, meta_get_feedback_group_for_display (global->meta_display));
      break;
    case PROP_SCREEN:
      g_value_set_object (value, global->cinnamon_screen);
      break;
    case PROP_DISPLAY:
      g_value_set_object (value, global->meta_display);
      break;
    case PROP_SCREEN_WIDTH:
      {
        int width, height;

        meta_display_get_size (global->meta_display, &width, &height);
        g_value_set_int (value, width);
      }
      break;
    case PROP_SCREEN_HEIGHT:
      {
        int width, height;

        meta_display_get_size (global->meta_display, &width, &height);
        g_value_set_int (value, height);
      }
      break;
    case PROP_STAGE:
      g_value_set_object (value, global->stage);
      break;
    case PROP_STAGE_INPUT_MODE:
      g_value_set_enum (value, global->input_mode);
      break;
    case PROP_BOTTOM_WINDOW_GROUP:
      g_value_set_object (value, meta_get_bottom_window_group_for_display (global->meta_display));
      break;
    case PROP_WINDOW_GROUP:
      g_value_set_object (value, meta_get_window_group_for_display (global->meta_display));
      break;
    case PROP_TOP_WINDOW_GROUP:
      g_value_set_object (value, meta_get_top_window_group_for_display (global->meta_display));
      break;
    case PROP_BACKGROUND_ACTOR:
      g_value_set_object (value, meta_get_x11_background_actor_for_display (global->meta_display));
      break;
    case PROP_DESKLET_CONTAINER:
      g_value_set_object (value, meta_get_desklet_container_for_display (global->meta_display));
      break;
    case PROP_WINDOW_MANAGER:
      g_value_set_object (value, global->wm);
      break;
    case PROP_SETTINGS:
      g_value_set_object (value, global->settings);
      break;
    case PROP_DATADIR:
      g_value_set_string (value, global->datadir);
      break;
    case PROP_IMAGEDIR:
      g_value_set_string (value, global->imagedir);
      break;
    case PROP_USERDATADIR:
      g_value_set_string (value, global->userdatadir);
      break;
    case PROP_FOCUS_MANAGER:
      g_value_set_object (value, global->focus_manager);
      break;
    case PROP_UI_SCALE:
      g_value_set_uint (value, global->ui_scale);
      break;
    case PROP_SESSION_RUNNING:
      g_value_set_boolean (value, global->session_running);
      break;
    case PROP_WORKSPACE_MANAGER:
      g_value_set_object (value, global->workspace_manager);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
failed_to_own_notifications (GDBusConnection *connection,
                             const gchar     *name,
                             gpointer         user_data)
{
    g_message ("Tried to become the session notification handler but failed. "
               "Maybe some other process is handling it.");
}

static void
setup_notifications_service (CinnamonGlobal *global)
{
  gboolean disabled;

  /* notify-osd allows itself to be replaced as the notification handler. dunst does not,
     nor does cinnamon. If we attempt to own and fail, cinnamon is still 'on deck' to take
     over if the existing handler disappears - our owner_id is still valid. */

  disabled = g_settings_get_boolean (global->settings, "allow-other-notification-handlers");

  if (disabled)
  {
    return;
  }

  global->notif_service_id = g_bus_own_name (G_BUS_TYPE_SESSION,
                                              "org.freedesktop.Notifications",
                                              G_BUS_NAME_OWNER_FLAGS_REPLACE,
                                              NULL, NULL,
                                              (GBusNameLostCallback) failed_to_own_notifications,
                                              global, NULL);
}

static void
cinnamon_global_init (CinnamonGlobal *global)
{
  const char *datadir = g_getenv ("CINNAMON_DATADIR");
  const char *cinnamon_js = g_getenv("CINNAMON_JS");
  char *imagedir, **search_path;

  if (!datadir)
    datadir = CINNAMON_DATADIR;
  global->datadir = datadir;

  /* We make sure imagedir ends with a '/', since the JS won't have
   * access to g_build_filename() and so will end up just
   * concatenating global.imagedir to a filename.
   */
  imagedir = g_build_filename (datadir, "images/", NULL);
  if (g_file_test (imagedir, G_FILE_TEST_IS_DIR))
    global->imagedir = imagedir;
  else
    {
      g_free (imagedir);
      global->imagedir = g_strdup_printf ("%s/", datadir);
    }

  /* Ensure config dir exists for later use */
  global->userdatadir = g_build_filename (g_get_user_data_dir (), "cinnamon", NULL);
  g_mkdir_with_parents (global->userdatadir, 0700);

  global->settings = g_settings_new ("org.cinnamon");

  setup_notifications_service (global);

  global->ui_scale = 1;

  global->input_mode = CINNAMON_STAGE_INPUT_MODE_NORMAL;

  if (!cinnamon_js)
    cinnamon_js = JSDIR;
  search_path = g_strsplit (cinnamon_js, ":", -1);
  global->js_context = g_object_new (GJS_TYPE_CONTEXT,
                                     "profiler-sigusr2", true,
                                     "search-path", search_path,
                                     NULL);

  g_strfreev (search_path);
}

static void
cinnamon_global_finalize (GObject *object)
{
  CinnamonGlobal *global = CINNAMON_GLOBAL (object);
  g_object_unref (global->js_context);

  g_object_unref (global->settings);
  g_clear_handle_id (&global->notif_service_id, g_bus_unown_name);

  the_object = NULL;

  G_OBJECT_CLASS(cinnamon_global_parent_class)->finalize (object);
}

static void
cinnamon_global_class_init (CinnamonGlobalClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->get_property = cinnamon_global_get_property;
  gobject_class->set_property = cinnamon_global_set_property;
  gobject_class->finalize = cinnamon_global_finalize;

  cinnamon_global_signals[NOTIFY_ERROR] =
      g_signal_new ("notify-error",
                    G_TYPE_FROM_CLASS (klass),
                    G_SIGNAL_RUN_LAST,
                    0,
                    NULL, NULL, NULL,
                    G_TYPE_NONE, 2,
                    G_TYPE_STRING,
                    G_TYPE_STRING);

  cinnamon_global_signals[SCALE_CHANGED] =
      g_signal_new ("scale-changed",
                    G_TYPE_FROM_CLASS (klass),
                    G_SIGNAL_RUN_LAST,
                    0,
                    NULL, NULL, NULL,
                    G_TYPE_NONE, 0);

  cinnamon_global_signals[SHUTDOWN] =
      g_signal_new ("shutdown",
                    G_TYPE_FROM_CLASS (klass),
                    G_SIGNAL_RUN_LAST,
                    0,
                    NULL, NULL, NULL,
                    G_TYPE_NONE, 0);

  g_object_class_install_property (gobject_class,
                                   PROP_OVERLAY_GROUP,
                                   g_param_spec_object ("overlay-group",
                                                        "Overlay Group",
                                                        "Actor holding objects that appear above the desktop contents",
                                                        CLUTTER_TYPE_ACTOR,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_SCREEN,
                                   g_param_spec_object ("screen",
                                                        "Screen",
                                                        "Cinnamon screen object",
                                                        CINNAMON_TYPE_SCREEN,
                                                        G_PARAM_READABLE));

  g_object_class_install_property (gobject_class,
                                   PROP_SCREEN_WIDTH,
                                   g_param_spec_int ("screen-width",
                                                     "Screen Width",
                                                     "Screen width, in pixels",
                                                     0, G_MAXINT, 1,
                                                     G_PARAM_READABLE));

  g_object_class_install_property (gobject_class,
                                   PROP_SCREEN_HEIGHT,
                                   g_param_spec_int ("screen-height",
                                                     "Screen Height",
                                                     "Screen height, in pixels",
                                                     0, G_MAXINT, 1,
                                                     G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_DISPLAY,
                                   g_param_spec_object ("display",
                                                        "Display",
                                                        "Metacity display object for Cinnamon",
                                                        META_TYPE_DISPLAY,
                                                        G_PARAM_READABLE));

  g_object_class_install_property (gobject_class,
                                   PROP_STAGE,
                                   g_param_spec_object ("stage",
                                                        "Stage",
                                                        "Stage holding the desktop scene graph",
                                                        CLUTTER_TYPE_ACTOR,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_STAGE_INPUT_MODE,
                                   g_param_spec_enum ("stage-input-mode",
                                                      "Stage input mode",
                                                      "The stage input mode",
                                                      CINNAMON_TYPE_STAGE_INPUT_MODE,
                                                      CINNAMON_STAGE_INPUT_MODE_NORMAL,
                                                      G_PARAM_READWRITE));
  g_object_class_install_property (gobject_class,
                                   PROP_BOTTOM_WINDOW_GROUP,
                                   g_param_spec_object ("bottom-window-group",
                                                        "Bottom Window Group",
                                                        "Actor holding window actors that must appear below desklets",
                                                        CLUTTER_TYPE_ACTOR,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_WINDOW_GROUP,
                                   g_param_spec_object ("window-group",
                                                        "Window Group",
                                                        "Actor holding window actors",
                                                        CLUTTER_TYPE_ACTOR,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_TOP_WINDOW_GROUP,
                                   g_param_spec_object ("top-window-group",
                                                        "Top Window Group",
                                                        "Actor holding popup menus and other actors which must appear on top of the panels",
                                                        CLUTTER_TYPE_ACTOR,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_BACKGROUND_ACTOR,
                                   g_param_spec_object ("background-actor",
                                                        "Background Actor",
                                                        "Actor drawing root window background",
                                                        CLUTTER_TYPE_ACTOR,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_DESKLET_CONTAINER,
                                   g_param_spec_object ("desklet-container",
                                                        "Desklet Container",
                                                        "Actor that will hold desklets",
                                                        CLUTTER_TYPE_ACTOR,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_WINDOW_MANAGER,
                                   g_param_spec_object ("window-manager",
                                                        "Window Manager",
                                                        "Window management interface",
                                                        CINNAMON_TYPE_WM,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_SETTINGS,
                                   g_param_spec_object ("settings",
                                                        "Settings",
                                                        "GSettings instance for Cinnamon configuration",
                                                        G_TYPE_SETTINGS,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_DATADIR,
                                   g_param_spec_string ("datadir",
                                                        "Data directory",
                                                        "Directory containing Cinnamon data files",
                                                        NULL,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_IMAGEDIR,
                                   g_param_spec_string ("imagedir",
                                                        "Image directory",
                                                        "Directory containing Cinnamon image files",
                                                        NULL,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_USERDATADIR,
                                   g_param_spec_string ("userdatadir",
                                                        "User data directory",
                                                        "Directory containing Cinnamon user data",
                                                        NULL,
                                                        G_PARAM_READABLE));
  g_object_class_install_property (gobject_class,
                                   PROP_FOCUS_MANAGER,
                                   g_param_spec_object ("focus-manager",
                                                        "Focus manager",
                                                        "Cinnamon's StFocusManager",
                                                        ST_TYPE_FOCUS_MANAGER,
                                                        G_PARAM_READABLE));

  g_object_class_install_property (gobject_class,
                                   PROP_UI_SCALE,
                                   g_param_spec_uint ("ui-scale",
                                                      "Current UI Scale",
                                                      "Current UI Scale",
                                                      0, G_MAXUINT, 1,
                                                      G_PARAM_READABLE));

  g_object_class_install_property (gobject_class,
                                   PROP_SESSION_RUNNING,
                                   g_param_spec_boolean ("session-running",
                                                         "Session state",
                                                         "If the session startup has already finished",
                                                         FALSE,
                                                         G_PARAM_CONSTRUCT_ONLY | G_PARAM_READWRITE));

  g_object_class_install_property (gobject_class,
                                   PROP_WORKSPACE_MANAGER,
                                   g_param_spec_object ("workspace-manager",
                                                        "Workspace manager",
                                                        "Workspace manager",
                                                        META_TYPE_WORKSPACE_MANAGER,
                                                        G_PARAM_READABLE | G_PARAM_STATIC_STRINGS));
}

/**
 * _cinnamon_global_init: (skip)
 * @first_property_name: the name of the first property
 * @...: the value of the first property, followed optionally by more
 *  name/value pairs, followed by %NULL
 *
 * Initializes Cinnamon global singleton with the construction-time
 * properties.
 *
 * There are currently no such properties, so @first_property_name should
 * always be %NULL.
 *
 * This call must be called before cinnamon_global_get() and shouldn't be called
 * more than once.
 */
void
_cinnamon_global_init (const char *first_property_name,
                    ...)
{
  va_list argument_list;

  g_return_if_fail (the_object == NULL);

  va_start (argument_list, first_property_name);
  the_object = CINNAMON_GLOBAL (g_object_new_valist (CINNAMON_TYPE_GLOBAL,
                                                  first_property_name,
                                                  argument_list));
  va_end (argument_list);

}

/**
 * cinnamon_global_get:
 *
 * Gets the singleton global object that represents the desktop.
 *
 * Return value: (transfer none): the singleton global object
 */
CinnamonGlobal *
cinnamon_global_get (void)
{
  return the_object;
}

static void
focus_window_changed (MetaDisplay *display,
                      GParamSpec  *param,
                      gpointer     user_data)
{
  CinnamonGlobal *global = user_data;

  if (global->input_mode == CINNAMON_STAGE_INPUT_MODE_FOCUSED &&
      meta_display_get_focus_window (display) != NULL)
    cinnamon_global_set_stage_input_mode (global, CINNAMON_STAGE_INPUT_MODE_NORMAL);
}

static void
cinnamon_global_focus_stage (CinnamonGlobal *global)
{
  meta_focus_stage_window (global->meta_display, cinnamon_global_get_current_time (global));
}

/**
 * cinnamon_global_set_stage_input_mode:
 * @global: the #CinnamonGlobal
 * @mode: the stage input mode
 *
 * Sets the input mode of the stage; when @mode is
 * %CINNAMON_STAGE_INPUT_MODE_NONREACTIVE, then the stage does not absorb
 * any clicks, but just passes them through to underlying windows.
 * When it is %CINNAMON_STAGE_INPUT_MODE_NORMAL, then the stage accepts
 * clicks in the region defined by
 * cinnamon_global_set_stage_input_region() but passes through clicks
 * outside that region. When it is %CINNAMON_STAGE_INPUT_MODE_FULLSCREEN,
 * the stage absorbs all input.
 *
 * When the input mode is %CINNAMON_STAGE_INPUT_MODE_FOCUSED, the pointer
 * is handled as with %CINNAMON_STAGE_INPUT_MODE_NORMAL, but additionally
 * the stage window has the keyboard focus. If the stage loses the
 * focus (eg, because the user clicked into a window) the input mode
 * will revert to %CINNAMON_STAGE_INPUT_MODE_NORMAL.
 *
 * Note that whenever a muffin-internal Gtk widget has a pointer grab,
 * Cinnamon behaves as though it was in
 * %CINNAMON_STAGE_INPUT_MODE_NONREACTIVE, to ensure that the widget gets
 * any clicks it is expecting.
 */
void
cinnamon_global_set_stage_input_mode (CinnamonGlobal         *global,
                                      CinnamonStageInputMode  mode)
{
  g_return_if_fail (CINNAMON_IS_GLOBAL (global));

  if (meta_is_wayland_compositor ())
    return;

  MetaX11Display *x11_display;
  x11_display = meta_display_get_x11_display (global->meta_display);

  if (mode == CINNAMON_STAGE_INPUT_MODE_NONREACTIVE)
    meta_x11_display_clear_stage_input_region (x11_display);
  else if (mode == CINNAMON_STAGE_INPUT_MODE_FULLSCREEN || !global->input_region)
    meta_x11_display_set_stage_input_region (x11_display, None);
  else
    meta_x11_display_set_stage_input_region (x11_display, global->input_region);

  if (mode == CINNAMON_STAGE_INPUT_MODE_FOCUSED)
    cinnamon_global_focus_stage (global);

  if (mode != global->input_mode)
    {
      global->input_mode = mode;
      g_object_notify (G_OBJECT (global), "stage-input-mode");
    }
}

/**
 * cinnamon_global_set_cursor:
 * @global: A #CinnamonGlobal
 * @type: the type of the cursor
 *
 * Set the cursor on the stage window.
 */
void
cinnamon_global_set_cursor (CinnamonGlobal *global,
                            CinnamonCursor type)
{
  MetaCursor ret_curs;

  switch (type)
    {
    case CINNAMON_CURSOR_DND_IN_DRAG:
      ret_curs = META_CURSOR_DND_IN_DRAG;
      break;
    case CINNAMON_CURSOR_DND_MOVE:
      ret_curs = META_CURSOR_DND_MOVE;
      break;
    case CINNAMON_CURSOR_DND_COPY:
      ret_curs = META_CURSOR_DND_COPY;
      break;
    case CINNAMON_CURSOR_DND_UNSUPPORTED_TARGET:
      ret_curs = META_CURSOR_DND_UNSUPPORTED_TARGET;
      break;
    case CINNAMON_CURSOR_POINTING_HAND:
      ret_curs = META_CURSOR_POINTING_HAND;
      break;
    case CINNAMON_CURSOR_RESIZE_BOTTOM:
      ret_curs = META_CURSOR_SOUTH_RESIZE;
      break;
    case CINNAMON_CURSOR_RESIZE_TOP:
      ret_curs = META_CURSOR_NORTH_RESIZE;
      break;
    case CINNAMON_CURSOR_RESIZE_LEFT:
      ret_curs = META_CURSOR_WEST_RESIZE;
      break;
    case CINNAMON_CURSOR_RESIZE_RIGHT:
      ret_curs = META_CURSOR_EAST_RESIZE;
      break;
    case CINNAMON_CURSOR_RESIZE_BOTTOM_RIGHT:
      ret_curs = META_CURSOR_SE_RESIZE;
      break;
    case CINNAMON_CURSOR_RESIZE_BOTTOM_LEFT:
      ret_curs = META_CURSOR_SW_RESIZE;
      break;
    case CINNAMON_CURSOR_RESIZE_TOP_RIGHT:
      ret_curs = META_CURSOR_NE_RESIZE;
      break;
    case CINNAMON_CURSOR_RESIZE_TOP_LEFT:
      ret_curs = META_CURSOR_NW_RESIZE;
      break;
    case CINNAMON_CURSOR_CROSSHAIR:
      ret_curs = META_CURSOR_CROSSHAIR;
      break;
    case CINNAMON_CURSOR_TEXT:
      ret_curs = META_CURSOR_IBEAM;
      break;
    default:
      g_return_if_reached ();
    }

    meta_display_set_cursor (global->meta_display, ret_curs);
}

/**
 * cinnamon_global_unset_cursor:
 * @global: A #CinnamonGlobal
 *
 * Unset the cursor on the stage window.
 */
void
cinnamon_global_unset_cursor (CinnamonGlobal  *global)
{
  meta_display_set_cursor (global->meta_display, META_CURSOR_DEFAULT);
}

/**
 * cinnamon_global_set_stage_input_region:
 * @global: the #CinnamonGlobal
 * @rectangles: (element-type Meta.Rectangle): a list of #MetaRectangle
 * describing the input region.
 *
 * Sets the area of the stage that is responsive to mouse clicks when
 * the stage mode is %CINNAMON_STAGE_INPUT_MODE_NORMAL (but does not change the
 * current stage mode).
 */
void
cinnamon_global_set_stage_input_region (CinnamonGlobal *global,
                                     GSList      *rectangles)
{
  MetaRectangle *rect;
  XRectangle *rects;
  int nrects, i;
  GSList *r;

  g_return_if_fail (CINNAMON_IS_GLOBAL (global));

  if (meta_is_wayland_compositor ())
    return;

  nrects = g_slist_length (rectangles);
  rects = g_new (XRectangle, nrects);
  for (r = rectangles, i = 0; r; r = r->next, i++)
    {
      rect = (MetaRectangle *)r->data;
      rects[i].x = rect->x;
      rects[i].y = rect->y;
      rects[i].width = rect->width;
      rects[i].height = rect->height;
    }

  if (global->input_region)
    XFixesDestroyRegion (global->xdisplay, global->input_region);

  global->input_region = XFixesCreateRegion (global->xdisplay, rects, nrects);
  g_free (rects);

  /* set_stage_input_mode() will figure out whether or not we
   * should actually change the input region right now.
   */
  cinnamon_global_set_stage_input_mode (global, global->input_mode);
}

/**
 * cinnamon_global_get_stage:
 *
 * Return value: (transfer none): The default #ClutterStage
 */
ClutterStage *
cinnamon_global_get_stage (CinnamonGlobal  *global)
{
  return global->stage;
}

/**
 * cinnamon_global_get_screen:
 *
 * Return value: (transfer none): The (Meta) CinnamonScreen
 */
CinnamonScreen *
cinnamon_global_get_screen (CinnamonGlobal  *global)
{
  return global->cinnamon_screen;
}

/**
 * cinnamon_global_get_display:
 *
 * Return value: (transfer none): The default #MetaDisplay
 */
MetaDisplay *
cinnamon_global_get_display (CinnamonGlobal  *global)
{
  return global->meta_display;
}

/**
 * cinnamon_global_get_window_actors:
 *
 * Gets the list of #MetaWindowActor for the plugin's screen
 *
 * Return value: (element-type Meta.WindowActor) (transfer none): the list of windows
 */
GList *
cinnamon_global_get_window_actors (CinnamonGlobal *global)
{
  g_return_val_if_fail (CINNAMON_IS_GLOBAL (global), NULL);

  return meta_get_window_actors (global->meta_display);
}

static void
global_stage_notify_width (GObject    *gobject,
                           GParamSpec *pspec,
                           gpointer    data)
{
  CinnamonGlobal *global = CINNAMON_GLOBAL (data);

  g_object_notify (G_OBJECT (global), "screen-width");
}

static void
global_stage_notify_height (GObject    *gobject,
                            GParamSpec *pspec,
                            gpointer    data)
{
  CinnamonGlobal *global = CINNAMON_GLOBAL (data);

  g_object_notify (G_OBJECT (global), "screen-height");
}

static gboolean
global_stage_before_paint (gpointer data)
{
  cinnamon_perf_log_event (cinnamon_perf_log_get_default (),
                        "clutter.stagePaintStart");

  return TRUE;
}

static gboolean
global_stage_after_paint (gpointer data)
{
  cinnamon_perf_log_event (cinnamon_perf_log_get_default (),
                        "clutter.stagePaintDone");

  return TRUE;
}

static void
cinnamon_fonts_init (ClutterStage *stage)
{
  PangoFontMap *fontmap;

  /* Disable text mipmapping; it causes problems on pre-GEM Intel
   * drivers and we should just be rendering text at the right
   * size rather than scaling it. If we do effects where we dynamically
   * zoom labels, then we might want to reconsider.
   */

  fontmap = clutter_get_font_map ();
  cogl_pango_font_map_set_use_mipmapping (COGL_PANGO_FONT_MAP (fontmap), FALSE);
}

static void
update_scaling_factor (CinnamonGlobal  *global,
                       MetaSettings *settings)
{
  ClutterStage *stage = CLUTTER_STAGE (global->stage);
  StThemeContext *context = st_theme_context_get_for_stage (stage);
  int scaling_factor;

  scaling_factor = meta_settings_get_ui_scaling_factor (settings);
  g_object_set (context, "scale-factor", scaling_factor, NULL);

  if (scaling_factor != global->ui_scale) {
      global->ui_scale = scaling_factor;
      g_object_notify (G_OBJECT (global), "ui-scale");
      g_signal_emit_by_name (global, "scale-changed");
  }
}

static void
ui_scaling_factor_changed (MetaSettings *settings,
                           CinnamonGlobal  *global)
{
  update_scaling_factor (global, settings);
}


void
_cinnamon_global_set_plugin (CinnamonGlobal *global,
                          MetaPlugin  *plugin)
{
  g_return_if_fail (CINNAMON_IS_GLOBAL (global));
  g_return_if_fail (global->plugin == NULL);

  MetaX11Display *x11_display;

  global->plugin = plugin;
  global->wm = cinnamon_wm_new (plugin);

  global->meta_display = meta_plugin_get_display (plugin);
  global->workspace_manager = meta_display_get_workspace_manager (global->meta_display);
  global->cinnamon_screen = cinnamon_screen_new (global->meta_display);

  if (!meta_is_wayland_compositor ())
  {
     x11_display = meta_display_get_x11_display (global->meta_display);
     global->xdisplay = meta_x11_display_get_xdisplay (x11_display);
  }

  global->stage = CLUTTER_STAGE (meta_get_stage_for_display (global->meta_display));
  st_clipboard_set_selection (meta_display_get_selection (global->meta_display));

  g_signal_connect (global->stage, "notify::width",
                    G_CALLBACK (global_stage_notify_width), global);
  g_signal_connect (global->stage, "notify::height",
                    G_CALLBACK (global_stage_notify_height), global);

  if (g_getenv ("CINNAMON_PERF_OUTPUT") != NULL)
    {
      clutter_threads_add_repaint_func_full (CLUTTER_REPAINT_FLAGS_PRE_PAINT,
                                             (GSourceFunc) global_stage_before_paint,
                                             NULL, NULL);
      clutter_threads_add_repaint_func_full (CLUTTER_REPAINT_FLAGS_POST_PAINT,
                                             (GSourceFunc) global_stage_after_paint,
                                             NULL, NULL);
      cinnamon_perf_log_define_event (cinnamon_perf_log_get_default(),
                                      "clutter.stagePaintStart",
                                      "Start of stage page repaint",
                                      "");
      cinnamon_perf_log_define_event (cinnamon_perf_log_get_default(),
                                      "clutter.stagePaintDone",
                                      "End of stage page repaint",
                                      "");
    }

  g_signal_connect (global->meta_display, "notify::focus-window",
                    G_CALLBACK (focus_window_changed), global);

  cinnamon_fonts_init (global->stage);

  MetaBackend *backend = meta_get_backend ();
  MetaSettings *settings = meta_backend_get_settings (backend);
  g_signal_connect (settings, "ui-scaling-factor-changed",
                    G_CALLBACK (ui_scaling_factor_changed), global);

  // gdk_event_handler_set (gnome_cinnamon_gdk_event_handler, global->stage, NULL);

  global->focus_manager = st_focus_manager_get_for_stage (global->stage);

  update_scaling_factor (global, settings);
}

/**
 * cinnamon_global_dump_gjs_stack:
 * @global: A #CinnamonGlobal
 *
 * Prints out the gjs stack
 */
void
cinnamon_global_dump_gjs_stack (CinnamonGlobal *global)
{
  gjs_dumpstack ();
}

GjsContext *
_cinnamon_global_get_gjs_context (CinnamonGlobal *global)
{
  return global->js_context;
}

static guint32
get_current_time_maybe_roundtrip (CinnamonGlobal *global)
{
  guint32 time;

  time = cinnamon_global_get_current_time (global);
  if (time != CurrentTime)
    return time;

  return meta_display_get_current_time_roundtrip (global->meta_display);
}

static ClutterActor *
get_key_focused_actor (CinnamonGlobal *global)
{
  ClutterActor *actor;

  actor = clutter_stage_get_key_focus (global->stage);

  /* If there's no explicit key focus, clutter_stage_get_key_focus()
   * returns the stage. This is a terrible API. */
  if (actor == CLUTTER_ACTOR (global->stage))
    actor = NULL;

  return actor;
}

static void
sync_input_region (CinnamonGlobal *global)
{
  MetaDisplay *display = global->meta_display;
  MetaX11Display *x11_display = meta_display_get_x11_display (display);

  if (global->has_modal)
    meta_x11_display_set_stage_input_region (x11_display, None);
  else
    meta_x11_display_set_stage_input_region (x11_display, global->input_region);
}

/**
 * cinnamon_global_begin_modal:
 * @global: a #CinnamonGlobal
 *
 * Grabs the keyboard and mouse to the stage window. The stage will
 * receive all keyboard and mouse events until cinnamon_global_end_modal()
 * is called. This is used to implement "modes" for the shell, such as the
 * overview mode or the "looking glass" debug overlay, that block
 * application and normal key shortcuts.
 *
 * Returns: %TRUE if we successfully entered the mode. %FALSE if we couldn't
 *  enter the mode. Failure may occur because an application has the pointer
 *  or keyboard grabbed, because Mutter is in a mode itself like moving a
 *  window or alt-Tab window selection, or because cinnamon_global_begin_modal()
 *  was previously called.
 */
gboolean
cinnamon_global_begin_modal (CinnamonGlobal       *global,
                          guint32           timestamp,
                          MetaModalOptions  options)
{
  if (!meta_display_get_compositor (global->meta_display))
    return FALSE;

  /* Make it an error to call begin_modal while we already
   * have a modal active. */
  if (global->has_modal)
    return FALSE;

  global->has_modal = meta_plugin_begin_modal (global->plugin, options, timestamp);
  if (!meta_is_wayland_compositor ())
    sync_input_region (global);
  return global->has_modal;
}

/**
 * cinnamon_global_end_modal:
 * @global: a #CinnamonGlobal
 *
 * Undoes the effect of cinnamon_global_begin_modal().
 */
void
cinnamon_global_end_modal (CinnamonGlobal *global,
                        guint32      timestamp)
{
  if (!meta_display_get_compositor (global->meta_display))
    return;

  if (!global->has_modal)
    return;

  meta_plugin_end_modal (global->plugin, timestamp);
  global->has_modal = FALSE;

  /* If the stage window is unfocused, ensure that there's no
   * actor focused on Clutter's side. */
  if (!meta_stage_is_focused (global->meta_display))
    clutter_stage_set_key_focus (global->stage, NULL);

  /* An actor dropped key focus. Focus the default window. */
  else if (get_key_focused_actor (global) && meta_stage_is_focused (global->meta_display))
    meta_display_focus_default_window (global->meta_display,
                                       get_current_time_maybe_roundtrip (global));

  if (!meta_is_wayland_compositor ())
    sync_input_region (global);
}

static int
set_cloexec (void *data, gint fd)
{
  if (fd >= GPOINTER_TO_INT (data))
    fcntl (fd, F_SETFD, FD_CLOEXEC);

  return 0;
}

#ifndef HAVE_FDWALK
static int
fdwalk (int (*cb)(void *data, int fd), void *data)
{
  gint open_max;
  gint fd;
  gint res = 0;

#ifdef HAVE_SYS_RESOURCE_H
  struct rlimit rl;
#endif

#ifdef __linux__
  DIR *d;

  if ((d = opendir("/proc/self/fd"))) {
      struct dirent *de;

      while ((de = readdir(d))) {
          glong l;
          gchar *e = NULL;

          if (de->d_name[0] == '.')
              continue;

          errno = 0;
          l = strtol(de->d_name, &e, 10);
          if (errno != 0 || !e || *e)
              continue;

          fd = (gint) l;

          if ((glong) fd != l)
              continue;

          if (fd == dirfd(d))
              continue;

          if ((res = cb (data, fd)) != 0)
              break;
        }

      closedir(d);
      return res;
  }

  /* If /proc is not mounted or not accessible we fall back to the old
   * rlimit trick */

#endif

#ifdef HAVE_SYS_RESOURCE_H
  if (getrlimit(RLIMIT_NOFILE, &rl) == 0 && rl.rlim_max != RLIM_INFINITY)
      open_max = rl.rlim_max;
  else
#endif
      open_max = sysconf (_SC_OPEN_MAX);

  for (fd = 0; fd < open_max; fd++)
      if ((res = cb (data, fd)) != 0)
          break;

  return res;
}
#endif

static void
pre_exec_close_fds(void)
{
  fdwalk (set_cloexec, GINT_TO_POINTER(3));
}

/**
 * cinnamon_global_reexec_self:
 * @global: A #CinnamonGlobal
 *
 * Initiates the shutdown sequence.
 */
void
cinnamon_global_reexec_self (CinnamonGlobal *global)
{
  meta_restart ("Restarting Cinnamon...");
}

/**
 * cinnamon_global_real_restart:
 * @global: A #CinnamonGlobal
 *
 * Restart the current process.
 */
void 
cinnamon_global_real_restart (CinnamonGlobal *global)
{
  GPtrArray *arr;
  gsize len;

#if defined __linux__ || defined __sun
  char *buf;
  char *buf_p;
  char *buf_end;
  GError *error = NULL;

  if (!g_file_get_contents ("/proc/self/cmdline", &buf, &len, &error))
    {
      g_warning ("failed to get /proc/self/cmdline: %s", error->message);
      return;
    }

  buf_end = buf+len;
  arr = g_ptr_array_new ();
  /* The cmdline file is NUL-separated */
  for (buf_p = buf; buf_p < buf_end; buf_p = buf_p + strlen (buf_p) + 1)
    g_ptr_array_add (arr, buf_p);

  g_ptr_array_add (arr, NULL);
#elif defined __OpenBSD__
  gchar **args, **args_p;
  gint mib[] = { CTL_KERN, KERN_PROC_ARGS, getpid(), KERN_PROC_ARGV };

  if (sysctl (mib, G_N_ELEMENTS (mib), NULL, &len, NULL, 0) == -1)
    return;

  args = g_malloc0 (len);

  if (sysctl (mib, G_N_ELEMENTS (mib), args, &len, NULL, 0) == -1) {
    g_warning ("failed to get command line args: %d", errno);
    g_free (args);
    return;
  }

  arr = g_ptr_array_new ();
  for (args_p = args; *args_p != NULL; args_p++) {
    g_ptr_array_add (arr, *args_p);
  }

  g_ptr_array_add (arr, NULL);
#elif defined __FreeBSD__
  char *buf;
  char *buf_p;
  char *buf_end;
  gint mib[] = { CTL_KERN, KERN_PROC, KERN_PROC_ARGS, getpid() };

  if (sysctl (mib, G_N_ELEMENTS (mib), NULL, &len, NULL, 0) == -1)
    return;

  buf = g_malloc0 (len);

  if (sysctl (mib, G_N_ELEMENTS (mib), buf, &len, NULL, 0) == -1) {
    g_warning ("failed to get command line args: %d", errno);
    g_free (buf);
    return;
  }

  buf_end = buf+len;
  arr = g_ptr_array_new ();
  /* The value returned by sysctl is NUL-separated */
  for (buf_p = buf; buf_p < buf_end; buf_p = buf_p + strlen (buf_p) + 1)
    g_ptr_array_add (arr, buf_p);

  g_ptr_array_add (arr, NULL);
#else
  return;
#endif

  /* Close all file descriptors other than stdin/stdout/stderr, otherwise
   * they will leak and stay open after the exec. In particular, this is
   * important for file descriptors that represent mapped graphics buffer
   * objects.
   */
  pre_exec_close_fds ();

  meta_display_close (global->meta_display,
                      cinnamon_global_get_current_time (global));

  execvp (arr->pdata[0], (char**)arr->pdata);
  g_warning ("failed to reexec: %s", g_strerror (errno));
  g_ptr_array_free (arr, TRUE);
#if defined __linux__ || defined __FreeBSD__
  g_free (buf);
#elif defined __OpenBSD__
  g_free (args);
#endif
}

/**
 * cinnamon_global_notify_error:
 * @global: a #CinnamonGlobal
 * @msg: Error message
 * @details: Error details
 *
 * Show a system error notification.  Use this function
 * when a user-initiated action results in a non-fatal problem
 * from causes that may not be under system control.  For
 * example, an application crash.
 */
void
cinnamon_global_notify_error (CinnamonGlobal  *global,
                           const char   *msg,
                           const char   *details)
{
  g_signal_emit_by_name (global, "notify-error", msg, details);
}

/**
 * cinnamon_global_get_pointer:
 * @global: the #CinnamonGlobal
 * @x: (out): the X coordinate of the pointer, in global coordinates
 * @y: (out): the Y coordinate of the pointer, in global coordinates
 * @mods: (out): the current set of modifier keys that are pressed down
 *
 * Gets the pointer coordinates and current modifier key state.
 * This is a wrapper around gdk_display_get_pointer() that strips
 * out any un-declared modifier flags, to make gjs happy; see
 * https://bugzilla.gnome.org/show_bug.cgi?id=597292.
 */
void
cinnamon_global_get_pointer (CinnamonGlobal         *global,
                          int                 *x,
                          int                 *y,
                          ClutterModifierType *mods)
{
  ClutterModifierType raw_mods;
  MetaCursorTracker *tracker;

  tracker = meta_cursor_tracker_get_for_display (global->meta_display);
  meta_cursor_tracker_get_pointer (tracker, x, y, &raw_mods);

  *mods = raw_mods & CLUTTER_MODIFIER_MASK;
}

/**
 * cinnamon_global_set_pointer:
 * @global: the #CinnamonGlobal
 * @x: (in): the X coordinate of the pointer, in global coordinates
 * @y: (in): the Y coordinate of the pointer, in global coordinates
 *
 * Sets the pointer coordinates.
 */
void
cinnamon_global_set_pointer (CinnamonGlobal         *global,
                          int                 x,
                          int                 y)
{
  ClutterSeat *seat;

  seat = clutter_backend_get_default_seat (clutter_get_default_backend ());

  if (seat != NULL)
    {
      clutter_seat_warp_pointer (seat, x, y);
    }
  else
    {
      g_warning ("warp_pointer failed, could not get ClutterSeat for operation");
    }
}

/**
 * cinnamon_global_sync_pointer:
 * @global: the #CinnamonGlobal
 *
 * Ensures that clutter is aware of the current pointer position,
 * causing enter and leave events to be emitted if the pointer moved
 * behind our back (ie, during a pointer grab).
 */
void
cinnamon_global_sync_pointer (CinnamonGlobal *global)
{
  int x, y;
  ClutterModifierType mods;
  ClutterEvent *event;
  ClutterSeat *seat;

  cinnamon_global_get_pointer (global, &x, &y, &mods);

  seat = clutter_backend_get_default_seat (clutter_get_default_backend ());
  event = clutter_event_new (CLUTTER_MOTION);

  event->motion.time = cinnamon_global_get_current_time (global);
  event->motion.flags = CLUTTER_EVENT_FLAG_SYNTHETIC;
  event->motion.stage = global->stage;
  event->motion.x = x;
  event->motion.y = y;
  event->motion.modifier_state = mods;
  event->motion.axes = NULL;
  clutter_event_set_device (event, clutter_seat_get_pointer (seat));

  /* Leaving event.source NULL will force clutter to look it up, which
   * will generate enter/leave events as a side effect, if they are
   * needed. We need a better way to do this though... see
   * http://bugzilla.clutter-project.org/show_bug.cgi?id=2615.
   */
  clutter_event_set_source_device (event, NULL);

  clutter_event_put (event);
  clutter_event_free (event);
}

/**
 * cinnamon_global_get_settings:
 * @global: A #CinnamonGlobal
 *
 * Get the global GSettings instance.
 *
 * Return value: (transfer none): The GSettings object
 */
GSettings *
cinnamon_global_get_settings (CinnamonGlobal *global)
{
  return global->settings;
}

/**
 * cinnamon_global_get_current_time:
 * @global: A #CinnamonGlobal
 *
 * Returns: the current X server time from the current Clutter, Gdk, or X
 * event. If called from outside an event handler, this may return
 * %Clutter.CURRENT_TIME (aka 0), or it may return a slightly
 * out-of-date timestamp.
 */
guint32
cinnamon_global_get_current_time (CinnamonGlobal *global)
{
  guint32 time;

  /* meta_display_get_current_time() will return the correct time
     when handling an X or Gdk event, but will return CurrentTime
     from some Clutter event callbacks.

     clutter_get_current_event_time() will return the correct time
     from a Clutter event callback, but may return CLUTTER_CURRENT_TIME
     timestamp if called at other times.

     So we try meta_display_get_current_time() first, since we
     can recognize a "wrong" answer from that, and then fall back
     to clutter_get_current_event_time().
   */

  time = meta_display_get_current_time (global->meta_display);
  if (time != CLUTTER_CURRENT_TIME)
    return time;

  return clutter_get_current_event_time ();
}

/**
 * cinnamon_global_get_pid:
 *
 * Return value: the pid of the cinnamon process.
 */
pid_t
cinnamon_global_get_pid (CinnamonGlobal *global)
{
  return getpid();
}

/**
 * cinnamon_global_get_md5_for_string:
 * @string: input string
 *
 * Return value: (transfer full): the MD5 sum for the given string
 */
gchar *
cinnamon_global_get_md5_for_string (CinnamonGlobal *global, const gchar *string)
{
    return g_compute_checksum_for_string (G_CHECKSUM_MD5, string, -1);
}

static void
cinnamon_global_app_launched_cb (GAppLaunchContext *context,
                                 GAppInfo          *info,
                                 GVariant          *platform_data,
                                 gpointer           user_data)
{
  gint32 pid;
  const gchar *app_name;

  if (!g_variant_lookup (platform_data, "pid", "i", &pid))
    return;

  app_name = g_app_info_get_id (info);
  if (app_name == NULL)
    app_name = g_app_info_get_executable (info);

  /* Start async request; we don't care about the result */
  gnome_start_systemd_scope (app_name,
                             pid,
                             NULL,
                             NULL,
                             NULL, NULL, NULL);
}

/**
 * cinnamon_global_create_app_launch_context:
 * @global: A #CinnaamonGlobal
 *
 * Create a #GAppLaunchContext set up with the correct timestamp, and
 * targeted to activate on the current workspace.
 *
 * Return value: (transfer full): A new #GAppLaunchContext
 */
GAppLaunchContext *
cinnamon_global_create_app_launch_context (CinnamonGlobal *global)
{
  MetaWorkspaceManager *workspace_manager = global->workspace_manager;
  MetaStartupNotification *sn;
  MetaLaunchContext *context;
  MetaWorkspace *ws = NULL;

  sn = meta_display_get_startup_notification (global->meta_display);
  context = meta_startup_notification_create_launcher (sn);

  meta_launch_context_set_timestamp (context, cinnamon_global_get_current_time (global));

  ws = meta_workspace_manager_get_active_workspace (workspace_manager);
  meta_launch_context_set_workspace (context, ws);

  g_signal_connect (context,
                    "launched",
                    G_CALLBACK (cinnamon_global_app_launched_cb),
                    NULL);

  return (GAppLaunchContext *) context;
}

typedef struct
{
  CinnamonLeisureFunction func;
  gpointer user_data;
  GDestroyNotify notify;
} LeisureClosure;

static gboolean
run_leisure_functions (gpointer data)
{
  CinnamonGlobal *global = data;
  GSList *closures;
  GSList *iter;

  global->leisure_function_id = 0;

  /* We started more work since we scheduled the idle */
  if (global->work_count > 0)
    return FALSE;

  /* No leisure closures, so we are done */
  if (global->leisure_closures == NULL)
    return FALSE;

  closures = global->leisure_closures;
  global->leisure_closures = NULL;

  for (iter = closures; iter; iter = iter->next)
    {
      LeisureClosure *closure = closures->data;
      closure->func (closure->user_data);

      if (closure->notify)
        closure->notify (closure->user_data);

      g_slice_free (LeisureClosure, closure);
    }

  g_slist_free (closures);

  return FALSE;
}

static void
schedule_leisure_functions (CinnamonGlobal *global)
{
  /* This is called when we think we are ready to run leisure functions
   * by our own accounting. We try to handle other types of business
   * (like ClutterAnimation) by adding a low priority idle function.
   *
   * This won't work properly if the mainloop goes idle waiting for
   * the vertical blanking interval or waiting for work being done
   * in another thread.
   */
  if (!global->leisure_function_id)
    global->leisure_function_id = g_idle_add_full (G_PRIORITY_LOW,
                                                   run_leisure_functions,
                                                   global, NULL);
}

/**
 * cinnamon_global_begin_work:
 * @global: the #CinnamonGlobal
 *
 * Marks that we are currently doing work. This is used to to track
 * whether we are busy for the purposes of cinnamon_global_run_at_leisure().
 * A count is kept and cinnamon_global_end_work() must be called exactly
 * as many times as cinnamon_global_begin_work().
 */
void
cinnamon_global_begin_work (CinnamonGlobal *global)
{
  global->work_count++;
}

/**
 * cinnamon_global_end_work:
 * @global: the #CinnamonGlobal
 *
 * Marks the end of work that we started with cinnamon_global_begin_work().
 * If no other work is ongoing and functions have been added with
 * cinnamon_global_run_at_leisure(), they will be run at the next
 * opportunity.
 */
void
cinnamon_global_end_work (CinnamonGlobal *global)
{
  g_return_if_fail (global->work_count > 0);

  global->work_count--;
  if (global->work_count == 0)
    schedule_leisure_functions (global);

}

/**
 * cinnamon_global_run_at_leisure:
 * @global: the #CinnamonGlobal
 * @func: function to call at leisure
 * @user_data: data to pass to @func
 * @notify: function to call to free @user_data
 *
 * Schedules a function to be called the next time Cinnamon is idle.
 * Idle means here no animations, no redrawing, and no ongoing background
 * work. Since there is currently no way to hook into the Clutter master
 * clock and know when is running, the implementation here is somewhat
 * approximation. Animations done through Cinnamon's Tweener module will
 * be handled properly, but other animations may be detected as terminating
 * early if they can be drawn fast enough so that the event loop goes idle
 * between frames.
 *
 * The intent of this function is for performance measurement runs
 * where a number of actions should be run serially and each action is
 * timed individually. Using this function for other purposes will
 * interfere with the ability to use it for performance measurement so
 * should be avoided.
 */
void
cinnamon_global_run_at_leisure (CinnamonGlobal         *global,
                             CinnamonLeisureFunction func,
                             gpointer             user_data,
                             GDestroyNotify       notify)
{
  LeisureClosure *closure = g_slice_new (LeisureClosure);
  closure->func = func;
  closure->user_data = user_data;
  closure->notify = notify;

  global->leisure_closures = g_slist_append (global->leisure_closures,
                                             closure);

  if (global->work_count == 0)
    schedule_leisure_functions (global);
}

/**
 * cinnamon_global_segfault:
 * @global: the #CinnamonGlobal
 *
 * Crashes Cinnamon by causing a segfault
 */
void
cinnamon_global_segfault (CinnamonGlobal *global)
{
  int *ptr = NULL;
  g_strdup_printf ("%d", *ptr);
}

/**
 * cinnamon_global_alloc_leak:
 * @global: the #CinnamonGlobal
 * @mb: How many mb to leak
 *
 * Request mb megabytes allocated. This is just for debugging.
 */
void
cinnamon_global_alloc_leak (CinnamonGlobal *global, gint mb)
{
    gint i;

    for (i = 0; i < mb * 1024; i++)
    {
        gchar *ptr = g_strdup_printf ("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                      "xxxxxxxxxxxxxxxxxxxxxxxx"
        );
    }
}