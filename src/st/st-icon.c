/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-icon.c: icon widget
 *
 * Copyright 2009, 2010 Intel Corporation.
 * Copyright 2010 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms and conditions of the GNU Lesser General Public License,
 * version 2.1, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * SECTION:st-icon
 * @short_description: a simple styled icon actor
 *
 * #StIcon is a simple styled texture actor that displays an image from
 * a stylesheet.
 */

#include "st-enum-types.h"
#include "st-icon.h"
#include "st-texture-cache.h"
#include "st-theme-context.h"
#include "st-private.h"

enum
{
  PROP_0,

  PROP_GICON,
  PROP_ICON_NAME,
  PROP_ICON_TYPE,
  PROP_ICON_SIZE
};

struct _StIconPrivate
{
  ClutterActor *icon_texture;
  ClutterActor *pending_texture;
  guint         opacity_handler_id;
  guint         texture_file_changed_id;

  GIcon        *gicon;
  gchar        *file_uri;
  gchar        *icon_name;
  StIconType    icon_type;
  gint          prop_icon_size;  /* icon size set as property */
  gint          theme_icon_size; /* icon size from theme node */
  gint          icon_size;       /* icon size we are using */
  gint          icon_scale;

  CoglPipeline  *shadow_pipeline;

  StShadow     *shadow_spec;
  ClutterSize   shadow_size;
};

G_DEFINE_TYPE_WITH_PRIVATE (StIcon, st_icon, ST_TYPE_WIDGET)

static void st_icon_update               (StIcon *icon);
static gboolean st_icon_update_icon_size (StIcon *icon);
static void st_icon_update_shadow_pipeline (StIcon *icon);
static void st_icon_clear_shadow_pipeline (StIcon *icon);

#define DEFAULT_ICON_SIZE 48
#define DEFAULT_ICON_TYPE ST_ICON_SYMBOLIC

static void
st_icon_set_property (GObject      *gobject,
                      guint         prop_id,
                      const GValue *value,
                      GParamSpec   *pspec)
{
  StIcon *icon = ST_ICON (gobject);

  switch (prop_id)
    {
    case PROP_GICON:
      st_icon_set_gicon (icon, g_value_get_object (value));
      break;

    case PROP_ICON_NAME:
      st_icon_set_icon_name (icon, g_value_get_string (value));
      break;

    case PROP_ICON_TYPE:
      st_icon_set_icon_type (icon, g_value_get_enum (value));
      break;

    case PROP_ICON_SIZE:
      st_icon_set_icon_size (icon, g_value_get_int (value));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_icon_get_property (GObject    *gobject,
                      guint       prop_id,
                      GValue     *value,
                      GParamSpec *pspec)
{
  StIcon *icon = ST_ICON (gobject);

  switch (prop_id)
    {
    case PROP_GICON:
      g_value_set_object (value, icon->priv->gicon);
      break;

    case PROP_ICON_NAME:
      g_value_set_string (value, st_icon_get_icon_name (icon));
      break;

    case PROP_ICON_TYPE:
      g_value_set_enum (value, st_icon_get_icon_type (icon));
      break;

    case PROP_ICON_SIZE:
      g_value_set_int (value, st_icon_get_icon_size (icon));
      break;

    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_icon_dispose (GObject *gobject)
{
  StIconPrivate *priv = ST_ICON (gobject)->priv;

  if (priv->texture_file_changed_id > 0)
    {
      g_signal_handler_disconnect(st_texture_cache_get_default(), priv->texture_file_changed_id);
      priv->texture_file_changed_id = 0;
    }

  if (priv->icon_texture)
    {
      clutter_actor_destroy (priv->icon_texture);
      priv->icon_texture = NULL;
    }

  if (priv->pending_texture)
    {
      clutter_actor_destroy (priv->pending_texture);
      g_object_unref (priv->pending_texture);
      priv->pending_texture = NULL;
    }

  g_free (priv->file_uri);
  priv->file_uri = NULL;

  g_clear_object (&priv->gicon);

  g_clear_pointer (&priv->shadow_pipeline, cogl_object_unref);

  g_clear_pointer (&priv->shadow_spec, st_shadow_unref);

  G_OBJECT_CLASS (st_icon_parent_class)->dispose (gobject);
}

static void
st_icon_finalize (GObject *gobject)
{
  StIconPrivate *priv = ST_ICON (gobject)->priv;

  if (priv->icon_name)
    {
      g_free (priv->icon_name);
      priv->icon_name = NULL;
    }

  G_OBJECT_CLASS (st_icon_parent_class)->finalize (gobject);
}

static void
st_icon_paint (ClutterActor *actor)
{
  StIcon *icon = ST_ICON (actor);
  StIconPrivate *priv = icon->priv;

  st_widget_paint_background (ST_WIDGET (actor));

  if (priv->icon_texture)
    {
      st_icon_update_shadow_pipeline (icon);
      if (priv->shadow_pipeline)
        {
          ClutterActorBox allocation;
          CoglFramebuffer *fb = cogl_get_draw_framebuffer();

          clutter_actor_get_allocation_box (priv->icon_texture, &allocation);

          _st_paint_shadow_with_opacity (priv->shadow_spec,
                                         priv->shadow_pipeline,
                                         fb,
                                         &allocation,
                                         clutter_actor_get_paint_opacity (priv->icon_texture));
        }

      clutter_actor_paint (priv->icon_texture);
    }
}

static void
st_icon_style_changed (StWidget *widget)
{
  StIcon *self = ST_ICON (widget);
  StThemeNode *theme_node = st_widget_get_theme_node (widget);
  StIconPrivate *priv = self->priv;

  st_icon_clear_shadow_pipeline (self);
  g_clear_pointer (&priv->shadow_spec, st_shadow_unref);

  priv->shadow_spec = st_theme_node_get_shadow (theme_node, "icon-shadow");

  if (priv->shadow_spec && priv->shadow_spec->inset)
    {
      g_warning ("The icon-shadow property does not support inset shadows");
      st_shadow_unref (priv->shadow_spec);
      priv->shadow_spec = NULL;
    }

  priv->theme_icon_size = (int)(0.5 + st_theme_node_get_length (theme_node, "icon-size"));
  st_icon_update_icon_size (self);
  st_icon_update (self);
}

static void
st_icon_class_init (StIconClass *klass)
{
  GParamSpec *pspec;

  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);

  object_class->get_property = st_icon_get_property;
  object_class->set_property = st_icon_set_property;
  object_class->dispose = st_icon_dispose;
  object_class->finalize = st_icon_finalize;

  actor_class->paint = st_icon_paint;

  widget_class->style_changed = st_icon_style_changed;

  pspec = g_param_spec_object ("gicon",
                               "GIcon",
                               "A GIcon to override :icon-name",
                               G_TYPE_ICON,
                               ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_GICON, pspec);

  pspec = g_param_spec_string ("icon-name",
                               "Icon name",
                               "An icon name",
                               NULL, ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_ICON_NAME, pspec);

  pspec = g_param_spec_enum ("icon-type",
                             "Icon type",
                             "The type of icon that should be used",
                             ST_TYPE_ICON_TYPE,
                             DEFAULT_ICON_TYPE,
                             ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_ICON_TYPE, pspec);

  pspec = g_param_spec_int ("icon-size",
                            "Icon size",
                            "The size if the icon, if positive. Otherwise the size will be derived from the current style",
                            -1, G_MAXINT, -1,
                            ST_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_ICON_SIZE, pspec);
}

static void
st_icon_init (StIcon *self)
{
  ClutterLayoutManager *layout_manager;

  self->priv = st_icon_get_instance_private (self);

  layout_manager = clutter_bin_layout_new (CLUTTER_BIN_ALIGNMENT_FILL,
                                           CLUTTER_BIN_ALIGNMENT_FILL);

  clutter_actor_set_layout_manager (CLUTTER_ACTOR (self), layout_manager);
  self->priv->icon_size = DEFAULT_ICON_SIZE;
  self->priv->prop_icon_size = -1;
  self->priv->icon_type = DEFAULT_ICON_TYPE;

  self->priv->shadow_pipeline = NULL;

  self->priv->icon_scale = 1;

  self->priv->file_uri = NULL;
}

static void
st_icon_clear_shadow_pipeline (StIcon *icon)
{
  StIconPrivate *priv = icon->priv;

  g_clear_pointer (&priv->shadow_pipeline, cogl_object_unref);
  clutter_size_init (&priv->shadow_size, 0, 0);
}

static void
st_icon_update_shadow_pipeline (StIcon *icon)
{
  StIconPrivate *priv = icon->priv;

  if (priv->icon_texture && priv->shadow_spec)
    {
      ClutterActorBox box;
      float width, height;

      clutter_actor_get_allocation_box (CLUTTER_ACTOR (icon), &box);
      clutter_actor_box_get_size (&box, &width, &height);

      if (priv->shadow_pipeline == NULL ||
          priv->shadow_size.width != width ||
          priv->shadow_size.height != height)
        {
          st_icon_clear_shadow_pipeline (icon);

          priv->shadow_pipeline =
            _st_create_shadow_pipeline_from_actor (priv->shadow_spec,
                                                   priv->icon_texture);

          if (priv->shadow_pipeline)
            clutter_size_init (&priv->shadow_size, width, height);
        }
    }
}

static void
on_pixbuf_changed (ClutterTexture *texture,
                   StIcon         *icon)
{
  st_icon_clear_shadow_pipeline (icon);
  clutter_actor_queue_redraw (CLUTTER_ACTOR (icon));
}

static void
on_texture_file_cb (StTextureCache *cache,
                         char *uri,
                         StIcon *icon)
{
  if (g_strcmp0 (uri, icon->priv->file_uri) == 0)
    st_icon_update (icon);
}

static void
st_icon_finish_update (StIcon *icon)
{
  StIconPrivate *priv = icon->priv;

  if (priv->icon_texture)
    {
      clutter_actor_destroy (priv->icon_texture);
      priv->icon_texture = NULL;
    }

  if (priv->pending_texture)
    {
      priv->icon_texture = priv->pending_texture;
      priv->pending_texture = NULL;
      clutter_actor_set_x_align (priv->icon_texture, CLUTTER_ACTOR_ALIGN_CENTER);
      clutter_actor_set_y_align (priv->icon_texture, CLUTTER_ACTOR_ALIGN_CENTER);
      clutter_actor_add_child (CLUTTER_ACTOR (icon), priv->icon_texture);

      /* Remove the temporary ref we added */
      g_object_unref (priv->icon_texture);

      st_icon_clear_shadow_pipeline (icon);

      /* "pixbuf-change" is actually a misnomer for "texture-changed" */
      g_signal_connect (priv->icon_texture, "pixbuf-change",
                        G_CALLBACK (on_pixbuf_changed), icon);
    }
}

static void
opacity_changed_cb (GObject *object,
                    GParamSpec *pspec,
                    gpointer user_data)
{
  StIcon *icon = user_data;
  StIconPrivate *priv = icon->priv;

  g_signal_handler_disconnect (priv->pending_texture, priv->opacity_handler_id);
  priv->opacity_handler_id = 0;

  st_icon_finish_update (icon);
}

static void
st_icon_update (StIcon *icon)
{
  StIconPrivate *priv = icon->priv;
  StThemeNode *theme_node;
  StTextureCache *cache;
  gint scale;
  ClutterActor *stage;
  StThemeContext *context;

  if (priv->pending_texture)
    {
      clutter_actor_destroy (priv->pending_texture);
      g_object_unref (priv->pending_texture);
      priv->pending_texture = NULL;
      priv->opacity_handler_id = 0;
    }

  theme_node = st_widget_peek_theme_node (ST_WIDGET (icon));
  if (theme_node == NULL)
    return;

  stage = clutter_actor_get_stage (CLUTTER_ACTOR (icon));
  context = st_theme_context_get_for_stage (CLUTTER_STAGE (stage));
  g_object_get (context, "scale-factor", &scale, NULL);

  priv->icon_scale = scale;

  cache = st_texture_cache_get_default ();
  if (priv->gicon)
    {
      priv->pending_texture = st_texture_cache_load_gicon (cache,
                                                           (priv->icon_type != ST_ICON_APPLICATION &&
                                                            priv->icon_type != ST_ICON_DOCUMENT) ?
                                                           theme_node : NULL,
                                                           priv->gicon,
                                                           priv->icon_size);
    }
 else if (priv->icon_name)
    {
      priv->pending_texture = st_texture_cache_load_icon_name (cache,
                                                               theme_node,
                                                               priv->icon_name,
                                                               priv->icon_type,
                                                               priv->icon_size);
    }

  if (priv->pending_texture)
    {
      g_object_ref_sink (priv->pending_texture);

      if (clutter_actor_get_opacity (priv->pending_texture) != 0 || priv->icon_texture == NULL)
        {
          /* This icon is ready for showing, or nothing else is already showing */
          st_icon_finish_update (icon);
        }
      else
        {
          /* Will be shown when fully loaded */
          priv->opacity_handler_id = g_signal_connect (priv->pending_texture, "notify::opacity", G_CALLBACK (opacity_changed_cb), icon);
        }
    }
  else if (priv->icon_texture)
    {
      clutter_actor_destroy (priv->icon_texture);
      priv->icon_texture = NULL;
    }
}

static gboolean
st_icon_update_icon_size (StIcon *icon)
{
  StIconPrivate *priv = icon->priv;
  int new_size;

  if (priv->prop_icon_size > 0)
    new_size = priv->prop_icon_size;
  else if (priv->theme_icon_size > 0)
    {
      gint scale;
      ClutterActor *stage;
      StThemeContext *context;

      /* The theme will give us an already-scaled size, so we
       * undo it here, as priv->icon_size is in unscaled pixels.
       */
      stage = clutter_actor_get_stage (CLUTTER_ACTOR (icon));
      context = st_theme_context_get_for_stage (CLUTTER_STAGE (stage));
      g_object_get (context, "scale-factor", &scale, NULL);
      new_size = (gint) (priv->theme_icon_size / scale);
    }
  else
    new_size = DEFAULT_ICON_SIZE;

  if (new_size != priv->icon_size)
    {
      clutter_actor_queue_relayout (CLUTTER_ACTOR (icon));
      priv->icon_size = new_size;
      return TRUE;
    }
  else
    return FALSE;
}

/**
 * st_icon_new:
 *
 * Create a newly allocated #StIcon
 *
 * Returns: A newly allocated #StIcon
 */
ClutterActor *
st_icon_new (void)
{
  return g_object_new (ST_TYPE_ICON, NULL);
}

const gchar *
st_icon_get_icon_name (StIcon *icon)
{
  g_return_val_if_fail (ST_IS_ICON (icon), NULL);

  return icon->priv->icon_name;
}

void
st_icon_set_icon_name (StIcon      *icon,
                       const gchar *icon_name)
{
  StIconPrivate *priv;

  g_return_if_fail (ST_IS_ICON (icon));

  priv = icon->priv;

  /* Check if there's no change */
  if (g_strcmp0 (priv->icon_name, icon_name) == 0)
    return;

  g_free (priv->icon_name);
  priv->icon_name = g_strdup (icon_name);

  if (priv->gicon)
    {
      if (icon->priv->texture_file_changed_id > 0)
      {
        g_signal_handler_disconnect(st_texture_cache_get_default(), icon->priv->texture_file_changed_id);
        icon->priv->texture_file_changed_id = 0;
      }
      g_object_unref (priv->gicon);
      g_free (icon->priv->file_uri);
      icon->priv->file_uri = NULL;
      priv->gicon = NULL;
      g_object_notify (G_OBJECT (icon), "gicon");
    }

  g_object_notify (G_OBJECT (icon), "icon-name");

  st_icon_update (icon);
}

/**
 * st_icon_get_icon_type:
 * @icon: a #StIcon
 *
 * Gets the type of icon we'll look up to display in the actor.
 * See st_icon_set_icon_type().
 *
 * Return value: the icon type.
 */
StIconType
st_icon_get_icon_type (StIcon *icon)
{
  g_return_val_if_fail (ST_IS_ICON (icon), DEFAULT_ICON_TYPE);

  return icon->priv->icon_type;
}

/**
 * st_icon_set_icon_type:
 * @icon: a #StIcon
 * @icon_type: the type of icon to use
 *
 * Sets the type of icon we'll look up to display in the actor.
 * The icon type determines whether we use a symbolic icon or
 * a full color icon and also is used for specific handling for
 * application and document icons.
 */
void
st_icon_set_icon_type (StIcon     *icon,
                       StIconType  icon_type)
{
  StIconPrivate *priv;

  g_return_if_fail (ST_IS_ICON (icon));

  priv = icon->priv;

  if (icon_type == priv->icon_type)
    return;

  priv->icon_type = icon_type;
  st_icon_update (icon);

  g_object_notify (G_OBJECT (icon), "icon-type");
}

/**
 * st_icon_get_gicon:
 * @icon: an icon
 *
 * Return value: (transfer none): the override GIcon, if set, or NULL
 */
GIcon *
st_icon_get_gicon (StIcon *icon)
{
  g_return_val_if_fail (ST_IS_ICON (icon), NULL);

  return icon->priv->gicon;
}

/**
 * st_icon_set_gicon:
 * @icon: an icon
 * @gicon: (allow-none): a #GIcon to override :icon-name
 */
void
st_icon_set_gicon (StIcon *icon, GIcon *gicon)
{
  StTextureCache *cache = st_texture_cache_get_default();
  g_return_if_fail (ST_IS_ICON (icon));
  g_return_if_fail (G_IS_ICON (gicon));

  if (icon->priv->gicon == gicon) /* do nothing */
    return;

  if (icon->priv->texture_file_changed_id > 0)
  {
    g_signal_handler_disconnect(cache, icon->priv->texture_file_changed_id);
    icon->priv->texture_file_changed_id = 0;
  }

  if (icon->priv->gicon)
    {
      g_object_unref (icon->priv->gicon);
      icon->priv->gicon = NULL;
      g_free (icon->priv->file_uri);
      icon->priv->file_uri = NULL;
    }

  if (gicon) {
    icon->priv->gicon = g_object_ref (gicon);
    if (G_IS_FILE_ICON (gicon))
    {
      GFile *file = g_file_icon_get_file (G_FILE_ICON(gicon));
      icon->priv->file_uri = g_file_get_uri (file);
    }
    icon->priv->texture_file_changed_id = g_signal_connect (cache, "texture-file-changed", G_CALLBACK (on_texture_file_cb), icon);
  }

  if (icon->priv->icon_name)
    {
      g_free (icon->priv->icon_name);
      icon->priv->icon_name = NULL;
      g_object_notify (G_OBJECT (icon), "icon-name");
    }

  g_object_notify (G_OBJECT (icon), "gicon");

  st_icon_update (icon);
}

/**
 * st_icon_get_icon_size:
 * @icon: an icon
 *
 * Gets the size explicit size on the icon. This is not necesariily
 *  the size that the icon will actually be displayed at.
 *
 * Return value: the size explicitly set, or -1 if no size has been set
 */
gint
st_icon_get_icon_size (StIcon *icon)
{
  g_return_val_if_fail (ST_IS_ICON (icon), -1);

  return icon->priv->prop_icon_size;
}

/**
 * st_icon_set_icon_size:
 * @icon: an icon
 * @size: if positive, the new size, otherwise the size will be
 *   derived from the current style
 *
 * Sets an explicit size for the icon.
 */
void
st_icon_set_icon_size (StIcon *icon,
                       gint    size)
{
  StIconPrivate *priv;

  g_return_if_fail (ST_IS_ICON (icon));

  priv = icon->priv;
  if (priv->prop_icon_size != size)
    {
      priv->prop_icon_size = size;
      if (st_icon_update_icon_size (icon))
        st_icon_update (icon);
      g_object_notify (G_OBJECT (icon), "icon-size");
    }
}
