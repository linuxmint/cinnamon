/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include "cinnamon-embedded-window-private.h"

#include <gdk/gdkx.h>

enum {
   PROP_0,

   PROP_WINDOW
};

struct _CinnamonGtkEmbedPrivate
{
  CinnamonEmbeddedWindow *window;
};

G_DEFINE_TYPE (CinnamonGtkEmbed, cinnamon_gtk_embed, CLUTTER_X11_TYPE_TEXTURE_PIXMAP);

static void cinnamon_gtk_embed_set_window (CinnamonGtkEmbed       *embed,
                                        CinnamonEmbeddedWindow *window);

static void
cinnamon_gtk_embed_on_window_destroy (GtkWidget     *object,
                                   CinnamonGtkEmbed *embed)
{
  cinnamon_gtk_embed_set_window (embed, NULL);
}

static void
cinnamon_gtk_embed_on_window_realize (GtkWidget     *widget,
                                   CinnamonGtkEmbed *embed)
{
  /* Here automatic=FALSE means to use CompositeRedirectManual.
   * That is, the X server shouldn't draw the window onto the
   * screen.
   */
  clutter_x11_texture_pixmap_set_window (CLUTTER_X11_TEXTURE_PIXMAP (embed),
                                         gdk_x11_window_get_xid (gtk_widget_get_window (widget)),
                                         FALSE);
}

static void
cinnamon_gtk_embed_set_window (CinnamonGtkEmbed       *embed,
                            CinnamonEmbeddedWindow *window)
{

  if (embed->priv->window)
    {
      _cinnamon_embedded_window_set_actor (embed->priv->window, NULL);

      g_object_unref (embed->priv->window);

      clutter_x11_texture_pixmap_set_window (CLUTTER_X11_TEXTURE_PIXMAP (embed),
                                             None,
                                             FALSE);

      g_signal_handlers_disconnect_by_func (embed->priv->window,
                                            (gpointer)cinnamon_gtk_embed_on_window_destroy,
                                            embed);
      g_signal_handlers_disconnect_by_func (embed->priv->window,
                                            (gpointer)cinnamon_gtk_embed_on_window_realize,
                                            embed);
    }

  embed->priv->window = window;

  if (embed->priv->window)
    {
      g_object_ref (embed->priv->window);

      _cinnamon_embedded_window_set_actor (embed->priv->window, embed);

      g_signal_connect (embed->priv->window, "destroy",
                        G_CALLBACK (cinnamon_gtk_embed_on_window_destroy), embed);
      g_signal_connect (embed->priv->window, "realize",
                        G_CALLBACK (cinnamon_gtk_embed_on_window_realize), embed);

      if (gtk_widget_get_realized (GTK_WIDGET (window)))
        cinnamon_gtk_embed_on_window_realize (GTK_WIDGET (embed->priv->window), embed);
    }

  clutter_actor_queue_relayout (CLUTTER_ACTOR (embed));
}

static void
cinnamon_gtk_embed_set_property (GObject         *object,
                              guint            prop_id,
                              const GValue    *value,
                              GParamSpec      *pspec)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (object);

  switch (prop_id)
    {
    case PROP_WINDOW:
      cinnamon_gtk_embed_set_window (embed, (CinnamonEmbeddedWindow *)g_value_get_object (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_gtk_embed_get_property (GObject         *object,
                              guint            prop_id,
                              GValue          *value,
                              GParamSpec      *pspec)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (object);

  switch (prop_id)
    {
    case PROP_WINDOW:
      g_value_set_object (value, embed->priv->window);
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_gtk_embed_get_preferred_width (ClutterActor *actor,
                                     float         for_height,
                                     float        *min_width_p,
                                     float        *natural_width_p)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (actor);

  if (embed->priv->window
      && gtk_widget_get_visible (GTK_WIDGET (embed->priv->window)))
    {
      GtkRequisition min_req, natural_req;
      gtk_widget_get_preferred_size (GTK_WIDGET (embed->priv->window), &min_req, &natural_req);

      *min_width_p = min_req.width;
      *natural_width_p = natural_req.width;
    }
  else
    *min_width_p = *natural_width_p = 0;
}

static void
cinnamon_gtk_embed_get_preferred_height (ClutterActor *actor,
                                      float         for_width,
                                      float        *min_height_p,
                                      float        *natural_height_p)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (actor);

  if (embed->priv->window
      && gtk_widget_get_visible (GTK_WIDGET (embed->priv->window)))
    {
      GtkRequisition min_req, natural_req;
      gtk_widget_get_preferred_size (GTK_WIDGET (embed->priv->window), &min_req, &natural_req);

      *min_height_p = min_req.height;
      *natural_height_p = natural_req.height;
    }
  else
    *min_height_p = *natural_height_p = 0;
}

static void
cinnamon_gtk_embed_allocate (ClutterActor          *actor,
                          const ClutterActorBox *box,
                          ClutterAllocationFlags flags)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (actor);
  float wx = 0.0, wy = 0.0, x, y, ax, ay;

  CLUTTER_ACTOR_CLASS (cinnamon_gtk_embed_parent_class)->
    allocate (actor, box, flags);

  /* Find the actor's new coordinates in terms of the stage (which is
   * priv->window's parent window.
   */
  while (actor)
    {
      clutter_actor_get_position (actor, &x, &y);
      clutter_actor_get_anchor_point (actor, &ax, &ay);

      wx += x - ax;
      wy += y - ay;

      actor = clutter_actor_get_parent (actor);
    }

  _cinnamon_embedded_window_allocate (embed->priv->window,
                                   (int)(0.5 + wx), (int)(0.5 + wy),
                                   box->x2 - box->x1,
                                   box->y2 - box->y1);
}

static void
cinnamon_gtk_embed_realize (ClutterActor *actor)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (actor);

  _cinnamon_embedded_window_realize (embed->priv->window);

  CLUTTER_ACTOR_CLASS (cinnamon_gtk_embed_parent_class)->realize (actor);
}

static void
cinnamon_gtk_embed_unrealize (ClutterActor *actor)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (actor);
  
  if (embed->priv->window)
    _cinnamon_embedded_window_unrealize (embed->priv->window);

  CLUTTER_ACTOR_CLASS (cinnamon_gtk_embed_parent_class)->unrealize (actor);
}

static void
cinnamon_gtk_embed_dispose (GObject *object)
{
  CinnamonGtkEmbed *embed = CINNAMON_GTK_EMBED (object);

  cinnamon_gtk_embed_set_window (embed, NULL);

  G_OBJECT_CLASS (cinnamon_gtk_embed_parent_class)->dispose (object);
}

static void
cinnamon_gtk_embed_class_init (CinnamonGtkEmbedClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);

  g_type_class_add_private (klass, sizeof (CinnamonGtkEmbedPrivate));

  object_class->get_property = cinnamon_gtk_embed_get_property;
  object_class->set_property = cinnamon_gtk_embed_set_property;
  object_class->dispose      = cinnamon_gtk_embed_dispose;

  actor_class->get_preferred_width = cinnamon_gtk_embed_get_preferred_width;
  actor_class->get_preferred_height = cinnamon_gtk_embed_get_preferred_height;
  actor_class->allocate = cinnamon_gtk_embed_allocate;
  actor_class->realize = cinnamon_gtk_embed_realize;
  actor_class->unrealize = cinnamon_gtk_embed_unrealize;

  g_object_class_install_property (object_class,
                                   PROP_WINDOW,
                                   g_param_spec_object ("window",
                                                        "Window",
                                                        "CinnamonEmbeddedWindow to embed",
                                                        CINNAMON_TYPE_EMBEDDED_WINDOW,
                                                        G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY));
}

static void
cinnamon_gtk_embed_init (CinnamonGtkEmbed *embed)
{
  embed->priv = G_TYPE_INSTANCE_GET_PRIVATE (embed, CINNAMON_TYPE_GTK_EMBED,
                                             CinnamonGtkEmbedPrivate);

  /* automatic here means whether ClutterX11TexturePixmap should
   * process damage update and refresh the pixmap itself.
   */
  clutter_x11_texture_pixmap_set_automatic (CLUTTER_X11_TEXTURE_PIXMAP (embed), TRUE);
}

/*
 * Public API
 */
ClutterActor *
cinnamon_gtk_embed_new (CinnamonEmbeddedWindow *window)
{
  g_return_val_if_fail (CINNAMON_IS_EMBEDDED_WINDOW (window), NULL);

  return g_object_new (CINNAMON_TYPE_GTK_EMBED,
                       "window", window,
                       NULL);
}
