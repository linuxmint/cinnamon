/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <gdk/gdkx.h>
#include <clutter/x11/clutter-x11.h>

#include "cinnamon-embedded-window-private.h"

/* This type is a subclass of GtkWindow that ties the window to a
 * CinnamonGtkEmbed; the resizing logic is bound to the clutter logic.
 *
 * The typical usage we might expect is
 *
 *  - CinnamonEmbeddedWindow is created and filled with content
 *  - CinnamonEmbeddedWindow is shown with gtk_widget_show_all()
 *  - CinnamonGtkEmbed is created for the CinnamonEmbeddedWindow
 *  - actor is added to a stage
 *
 * The way it works is that the GtkWindow is mapped if and only if both:
 *
 * - gtk_widget_visible (window) [widget has been shown]
 * - Actor is mapped [actor and all parents visible, actor in stage]
 */

enum {
   PROP_0
};

typedef struct _CinnamonEmbeddedWindowPrivate CinnamonEmbeddedWindowPrivate;

struct _CinnamonEmbeddedWindowPrivate {
  CinnamonGtkEmbed *actor;

  GdkRectangle position;
};

G_DEFINE_TYPE_WITH_PRIVATE (CinnamonEmbeddedWindow,
                            cinnamon_embedded_window,
                            GTK_TYPE_WINDOW);

/*
 * The normal gtk_window_show() starts all of the complicated asynchronous
 * window resizing code running; we don't want or need any of that.
 * Bypassing the normal code does mean that the extra geometry management
 * available on GtkWindow: gridding, maximum sizes, etc, is ignored; we
 * don't really want that anyways - we just want a way of embedding a
 * GtkWidget into a Clutter stage.
 */
static void
cinnamon_embedded_window_show (GtkWidget *widget)
{
  CinnamonEmbeddedWindow *window = CINNAMON_EMBEDDED_WINDOW (widget);
  CinnamonEmbeddedWindowPrivate *priv;
  GtkWidgetClass *widget_class;

  priv = cinnamon_embedded_window_get_instance_private (window);

  /* Skip GtkWindow, but run the default GtkWidget handling which
   * marks the widget visible */
  widget_class = g_type_class_peek (GTK_TYPE_WIDGET);
  widget_class->show (widget);

  if (priv->actor)
    {
      /* Size is 0x0 if the GtkWindow is not shown */
      clutter_actor_queue_relayout (CLUTTER_ACTOR (priv->actor));

      if (clutter_actor_is_realized (CLUTTER_ACTOR (priv->actor)))
        gtk_widget_map (widget);
    }
}

static void
cinnamon_embedded_window_hide (GtkWidget *widget)
{
  CinnamonEmbeddedWindow *window = CINNAMON_EMBEDDED_WINDOW (widget);
  CinnamonEmbeddedWindowPrivate *priv;

  priv = cinnamon_embedded_window_get_instance_private (window);

  if (priv->actor)
    clutter_actor_queue_relayout (CLUTTER_ACTOR (priv->actor));

  GTK_WIDGET_CLASS (cinnamon_embedded_window_parent_class)->hide (widget);
}

static gboolean
cinnamon_embedded_window_configure_event (GtkWidget         *widget,
                                       GdkEventConfigure *event)
{
  /* Normally a configure event coming back from X triggers the
   * resizing logic inside GtkWindow; we just ignore them
   * since we are handling the resizing logic separately.
   */
  return FALSE;
}

static void
cinnamon_embedded_window_check_resize (GtkContainer *container)
{
  CinnamonEmbeddedWindow *window = CINNAMON_EMBEDDED_WINDOW (container);
  CinnamonEmbeddedWindowPrivate *priv;

  priv = cinnamon_embedded_window_get_instance_private (window);

  /* Check resize is called when a resize is queued on something
   * inside the GtkWindow; we need to make sure that in response
   * to this gtk_widget_size_request() and then
   * gtk_widget_size_allocate() are called; we defer to the Clutter
   * logic and assume it will do the right thing.
   */
  if (priv->actor)
    clutter_actor_queue_relayout (CLUTTER_ACTOR (priv->actor));
}

static GObject *
cinnamon_embedded_window_constructor (GType                  gtype,
                                   guint                  n_properties,
                                   GObjectConstructParam *properties)
{
  GObject *object;
  GObjectClass *parent_class;

  parent_class = G_OBJECT_CLASS (cinnamon_embedded_window_parent_class);
  object = parent_class->constructor (gtype, n_properties, properties);

  /* Setting the resize mode to immediate means that calling queue_resize()
   * on a widget within the window will immediately call check_resize()
   * to be called, instead of having it queued to an idle. From our perspective,
   * this is ideal since we just are going to queue a resize to Clutter's
   * idle resize anyways.
   */
  g_object_set (object,
                "app-paintable", TRUE,
                "resize-mode", GTK_RESIZE_IMMEDIATE,
                "type", GTK_WINDOW_POPUP,
                NULL);

  return object;
}

static void
cinnamon_embedded_window_class_init (CinnamonEmbeddedWindowClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS (klass);
  GtkContainerClass *container_class = GTK_CONTAINER_CLASS (klass);

  object_class->constructor     = cinnamon_embedded_window_constructor;

  widget_class->show            = cinnamon_embedded_window_show;
  widget_class->hide            = cinnamon_embedded_window_hide;
  widget_class->configure_event = cinnamon_embedded_window_configure_event;

  container_class->check_resize    = cinnamon_embedded_window_check_resize;
}

static void
cinnamon_embedded_window_init (CinnamonEmbeddedWindow *window)
{
}

/*
 * Private routines called by CinnamonGtkEmbed
 */

void
_cinnamon_embedded_window_set_actor (CinnamonEmbeddedWindow  *window,
                                  CinnamonGtkEmbed        *actor)

{
  CinnamonEmbeddedWindowPrivate *priv;

  g_return_if_fail (CINNAMON_IS_EMBEDDED_WINDOW (window));

  priv = cinnamon_embedded_window_get_instance_private (window);
  priv->actor = actor;

  if (actor &&
      clutter_actor_is_mapped (CLUTTER_ACTOR (actor)) &&
      gtk_widget_get_visible (GTK_WIDGET (window)))
    gtk_widget_map (GTK_WIDGET (window));
}

void
_cinnamon_embedded_window_allocate (CinnamonEmbeddedWindow *window,
                                 int                  x,
                                 int                  y,
                                 int                  width,
                                 int                  height)
{
  CinnamonEmbeddedWindowPrivate *priv;
  GtkAllocation allocation;

  g_return_if_fail (CINNAMON_IS_EMBEDDED_WINDOW (window));

  priv = cinnamon_embedded_window_get_instance_private (window);

  if (priv->position.x == x &&
      priv->position.y == y &&
      priv->position.width == width &&
      priv->position.height == height)
    return;

  priv->position.x = x;
  priv->position.y = y;
  priv->position.width = width;
  priv->position.height = height;

  if (gtk_widget_get_realized (GTK_WIDGET (window)))
    gdk_window_move_resize (gtk_widget_get_window (GTK_WIDGET (window)),
                            x, y, width, height);

  allocation.x = 0;
  allocation.y = 0;
  allocation.width = width;
  allocation.height = height;

  gtk_widget_size_allocate (GTK_WIDGET (window), &allocation);
}

void
_cinnamon_embedded_window_map (CinnamonEmbeddedWindow *window)
{
  g_return_if_fail (CINNAMON_IS_EMBEDDED_WINDOW (window));

  if (gtk_widget_get_visible (GTK_WIDGET (window)))
    gtk_widget_map (GTK_WIDGET (window));
}

void
_cinnamon_embedded_window_unmap (CinnamonEmbeddedWindow *window)
{
  g_return_if_fail (CINNAMON_IS_EMBEDDED_WINDOW (window));

  gtk_widget_unmap (GTK_WIDGET (window));
}

/*
 * Public API
 */
GtkWidget *
cinnamon_embedded_window_new (void)
{
  return g_object_new (CINNAMON_TYPE_EMBEDDED_WINDOW,
                       NULL);
}
