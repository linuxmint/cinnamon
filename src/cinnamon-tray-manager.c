/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <clutter/clutter.h>
#include <clutter/x11/clutter-x11.h>
#include <girepository.h>
#include <gtk/gtk.h>
#include <meta/display.h>

#include "cinnamon-tray-manager.h"
#include "na-tray-manager.h"

#include "cinnamon-tray-icon.h"
#include "cinnamon-embedded-window.h"
#include "cinnamon-global.h"

struct _CinnamonTrayManagerPrivate {
  NaTrayManager *na_manager;
  ClutterStage *stage;
  ClutterColor bg_color;

  GHashTable *icons;
};

typedef struct {
  CinnamonTrayManager *manager;
  GtkWidget *socket;
  GtkWidget *window;
  ClutterActor *actor;
} CinnamonTrayManagerChild;

enum {
  PROP_0,

  PROP_BG_COLOR
};

/* Signals */
enum
{
  TRAY_ICON_ADDED,
  TRAY_ICON_REMOVED,
  LAST_SIGNAL
};

G_DEFINE_TYPE (CinnamonTrayManager, cinnamon_tray_manager, G_TYPE_OBJECT);

static guint cinnamon_tray_manager_signals [LAST_SIGNAL] = { 0 };

static const ClutterColor default_color = { 0x00, 0x00, 0x00, 0xff };

static void na_tray_icon_added (NaTrayManager *na_manager, GtkWidget *child, gpointer manager);
static void na_tray_icon_removed (NaTrayManager *na_manager, GtkWidget *child, gpointer manager);

static void
free_tray_icon (gpointer data)
{
  CinnamonTrayManagerChild *child = data;

  gtk_widget_destroy (child->window);
  if (child->actor)
    {
      g_signal_handlers_disconnect_matched (child->actor, G_SIGNAL_MATCH_DATA,
                                            0, 0, NULL, NULL, child);
      g_object_unref (child->actor);
    }
  g_slice_free (CinnamonTrayManagerChild, child);
}

static void
cinnamon_tray_manager_set_property(GObject         *object,
                                guint            prop_id,
                                const GValue    *value,
                                GParamSpec      *pspec)
{
  CinnamonTrayManager *manager = CINNAMON_TRAY_MANAGER (object);

  switch (prop_id)
    {
    case PROP_BG_COLOR:
      {
        ClutterColor *color = g_value_get_boxed (value);
        if (color)
          manager->priv->bg_color = *color;
        else
          manager->priv->bg_color = default_color;
      }
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_tray_manager_get_property(GObject         *object,
                                guint            prop_id,
                                GValue          *value,
                                GParamSpec      *pspec)
{
  CinnamonTrayManager *manager = CINNAMON_TRAY_MANAGER (object);

  switch (prop_id)
    {
    case PROP_BG_COLOR:
      g_value_set_boxed (value, &manager->priv->bg_color);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_tray_manager_init (CinnamonTrayManager *manager)
{
  manager->priv = G_TYPE_INSTANCE_GET_PRIVATE (manager, CINNAMON_TYPE_TRAY_MANAGER,
                                               CinnamonTrayManagerPrivate);
  manager->priv->na_manager = na_tray_manager_new ();

  manager->priv->icons = g_hash_table_new_full (NULL, NULL,
                                                NULL, free_tray_icon);
  manager->priv->bg_color = default_color;

  g_signal_connect (manager->priv->na_manager, "tray-icon-added",
                    G_CALLBACK (na_tray_icon_added), manager);
  g_signal_connect (manager->priv->na_manager, "tray-icon-removed",
                    G_CALLBACK (na_tray_icon_removed), manager);
}

static void
cinnamon_tray_manager_finalize (GObject *object)
{
  CinnamonTrayManager *manager = CINNAMON_TRAY_MANAGER (object);

  g_object_unref (manager->priv->na_manager);
  g_object_unref (manager->priv->stage);
  g_hash_table_destroy (manager->priv->icons);

  G_OBJECT_CLASS (cinnamon_tray_manager_parent_class)->finalize (object);
}

static void
cinnamon_tray_manager_class_init (CinnamonTrayManagerClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  g_type_class_add_private (klass, sizeof (CinnamonTrayManagerPrivate));

  gobject_class->finalize = cinnamon_tray_manager_finalize;
  gobject_class->set_property = cinnamon_tray_manager_set_property;
  gobject_class->get_property = cinnamon_tray_manager_get_property;

  cinnamon_tray_manager_signals[TRAY_ICON_ADDED] =
    g_signal_new ("tray-icon-added",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (CinnamonTrayManagerClass, tray_icon_added),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  CLUTTER_TYPE_ACTOR);
  cinnamon_tray_manager_signals[TRAY_ICON_REMOVED] =
    g_signal_new ("tray-icon-removed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (CinnamonTrayManagerClass, tray_icon_removed),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  CLUTTER_TYPE_ACTOR);

  /* Lifting the CONSTRUCT_ONLY here isn't hard; you just need to
   * iterate through the icons, reset the background pixmap, and
   * call na_tray_child_force_redraw()
   */
  g_object_class_install_property (gobject_class,
                                   PROP_BG_COLOR,
                                   g_param_spec_boxed ("bg-color",
                                                       "BG Color",
                                                       "Background color (only if we don't have transparency)",
                                                       CLUTTER_TYPE_COLOR,
                                                       G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY));
}

CinnamonTrayManager *
cinnamon_tray_manager_new (void)
{
  return g_object_new (CINNAMON_TYPE_TRAY_MANAGER, NULL);
}

static void
cinnamon_tray_manager_style_changed (StWidget *theme_widget,
                                  gpointer  user_data)
{
  CinnamonTrayManager *manager = user_data;
  StThemeNode *theme_node;
  StIconColors *icon_colors;
  GdkColor foreground, warning, error, success;

  theme_node = st_widget_get_theme_node (theme_widget);
  icon_colors = st_theme_node_get_icon_colors (theme_node);

  foreground.red = icon_colors->foreground.red * 0x101;
  foreground.green = icon_colors->foreground.green * 0x101;
  foreground.blue = icon_colors->foreground.blue * 0x101;
  warning.red = icon_colors->warning.red * 0x101;
  warning.green = icon_colors->warning.green * 0x101;
  warning.blue = icon_colors->warning.blue * 0x101;
  error.red = icon_colors->error.red * 0x101;
  error.green = icon_colors->error.green * 0x101;
  error.blue = icon_colors->error.blue * 0x101;
  success.red = icon_colors->success.red * 0x101;
  success.green = icon_colors->success.green * 0x101;
  success.blue = icon_colors->success.blue * 0x101;

  na_tray_manager_set_colors (manager->priv->na_manager,
                              &foreground, &warning,
                              &error, &success);
}

void
cinnamon_tray_manager_manage_stage (CinnamonTrayManager *manager,
                                 ClutterStage     *stage,
                                 StWidget         *theme_widget)
{
  Window stage_xwindow;
  GdkWindow *stage_window;
  GdkDisplay *display;
  GdkScreen *screen;
  gint scale;

  g_return_if_fail (manager->priv->stage == NULL);

  manager->priv->stage = g_object_ref (stage);

  stage_xwindow = clutter_x11_get_stage_window (stage);

  /* This is a pretty ugly way to get the GdkScreen for the stage; it
   *  will normally go through the foreign_new() case with a
   *  round-trip to the X server, it might be nicer to pass the screen
   *  in in some way. (The Clutter/Muffin combo is currently incapable
   *  of multi-screen operation, so alternatively we could just assume
   *  that clutter_x11_get_default_screen() gives us the right
   *  screen.) We assume, in any case, that we are using the default
   *  GDK display.
   */
  display = gdk_display_get_default();
  stage_window = gdk_x11_window_lookup_for_display (display, stage_xwindow);
  if (stage_window)
    g_object_ref (stage_window);
  else
    stage_window = gdk_x11_window_foreign_new_for_display (display, stage_xwindow);

  screen = gdk_window_get_screen (stage_window);

  g_object_unref (stage_window);

  scale = 1;

  g_object_get (cinnamon_global_get (),
                "ui_scale", &scale,
                NULL);

  na_tray_manager_set_scale (manager->priv->na_manager, scale);

  na_tray_manager_manage_screen (manager->priv->na_manager, screen);

  g_signal_connect (theme_widget, "style-changed",
                    G_CALLBACK (cinnamon_tray_manager_style_changed), manager);
  cinnamon_tray_manager_style_changed (theme_widget, manager);
}

static void
cinnamon_tray_manager_child_on_realize (GtkWidget             *widget,
                                     CinnamonTrayManagerChild *child)
{
  /* If the tray child is using an RGBA colormap (and so we have real
   * transparency), we don't need to worry about the background. If
   * not, we obey the bg-color property by creating a cairo pattern of
   * that color and setting it as our background. Then "parent-relative"
   * background on the socket and the plug within that will cause
   * the icons contents to appear on top of our background color.
   */
  if (!na_tray_child_has_alpha (NA_TRAY_CHILD (child->socket)))
    {
      ClutterColor color = child->manager->priv->bg_color;
      cairo_pattern_t *bg_pattern;

      bg_pattern = cairo_pattern_create_rgb (color.red / 255.,
                                             color.green / 255.,
                                             color.blue / 255.);
      gdk_window_set_background_pattern (gtk_widget_get_window (widget),
                                         bg_pattern);

      cairo_pattern_destroy (bg_pattern);
    }
}

static void
on_plug_added (GtkSocket        *socket,
               CinnamonTrayManager *manager)
{
  CinnamonTrayManagerChild *child;

  g_signal_handlers_disconnect_by_func (socket, on_plug_added, manager);

  child = g_hash_table_lookup (manager->priv->icons, socket);

  child->actor = cinnamon_tray_icon_new (CINNAMON_EMBEDDED_WINDOW (child->window));
  g_object_ref_sink (child->actor);

  g_signal_emit (manager, cinnamon_tray_manager_signals[TRAY_ICON_ADDED], 0,
                 child->actor);
}

static void
na_tray_icon_added (NaTrayManager *na_manager, GtkWidget *socket,
                    gpointer user_data)
{
  CinnamonTrayManager *manager = user_data;
  GtkWidget *win;
  CinnamonTrayManagerChild *child;

  /* We don't need the NaTrayIcon to be composited on the window we
   * put it in: the window is the same size as the tray icon
   * and transparent. We can just use the default X handling of
   * subwindows as mode of SOURCE (replace the parent with the
   * child) and then composite the parent onto the stage.
   */
  na_tray_child_set_composited (NA_TRAY_CHILD (socket), FALSE);

  win = cinnamon_embedded_window_new (manager->priv->stage);
  gtk_container_add (GTK_CONTAINER (win), socket);

  /* The visual of the socket matches that of its contents; make
   * the window we put it in match that as well */
  gtk_widget_set_visual (win, gtk_widget_get_visual (socket));

  child = g_slice_new0 (CinnamonTrayManagerChild);
  child->manager = manager;
  child->window = win;
  child->socket = socket;

  g_signal_connect (win, "realize",
                    G_CALLBACK (cinnamon_tray_manager_child_on_realize), child);

  gtk_widget_show_all (win);

  g_hash_table_insert (manager->priv->icons, socket, child);

  g_signal_connect (socket, "plug-added", G_CALLBACK (on_plug_added), manager);
}

static void
cinnamon_tray_manager_child_redisplay (gpointer socket_pointer, gpointer child_pointer, gpointer user_data)
{
  CinnamonTrayManagerChild *child = child_pointer;
  
  g_return_if_fail(child != NULL);
  
  if (child->actor && CLUTTER_IS_ACTOR(child->actor)) {
    clutter_actor_destroy(child->actor);
  }
  
  on_plug_added(socket_pointer, child->manager);
}

void cinnamon_tray_manager_redisplay (CinnamonTrayManager *manager)
{
  g_hash_table_foreach(manager->priv->icons, cinnamon_tray_manager_child_redisplay, manager);
}

static void
na_tray_icon_removed (NaTrayManager *na_manager, GtkWidget *socket,
                      gpointer user_data)
{
  CinnamonTrayManager *manager = user_data;
  CinnamonTrayManagerChild *child;

  child = g_hash_table_lookup (manager->priv->icons, socket);
  g_return_if_fail (child != NULL);

  if (child->actor != NULL)
    {
      /* Only emit signal if a corresponding tray-icon-added signal was emitted,
         that is, if embedding did not fail and we got a plug-added
      */
      g_signal_emit (manager,
                     cinnamon_tray_manager_signals[TRAY_ICON_REMOVED], 0,
                     child->actor);
    }
  g_hash_table_remove (manager->priv->icons, socket);
}
