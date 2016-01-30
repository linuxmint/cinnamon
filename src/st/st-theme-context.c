/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-theme-context.c: holds global information about a tree of styled objects
 *
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2009 Florian Müllner
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#include <config.h>

#include "st-texture-cache.h"
#include "st-theme.h"
#include "st-theme-context.h"

struct _StThemeContext {
  GObject parent;

  PangoFontDescription *font;
  StThemeNode *root_node;
  StTheme *theme;

  /* set of StThemeNode */
  GHashTable *nodes;

  gint scale_factor;
};

struct _StThemeContextClass {
  GObjectClass parent_class;
};

#define DEFAULT_FONT "sans-serif 10"

enum
{
  PROP_0,
  PROP_SCALE_FACTOR
};

enum
{
  CHANGED,

  LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0, };

G_DEFINE_TYPE (StThemeContext, st_theme_context, G_TYPE_OBJECT);

static void on_icon_theme_changed (StTextureCache *cache,
                                   StThemeContext *context);

static void st_theme_context_changed (StThemeContext *context);

static void st_theme_context_set_property (GObject      *object,
                                           guint         prop_id,
                                           const GValue *value,
                                           GParamSpec   *pspec);
static void st_theme_context_get_property (GObject      *object,
                                           guint         prop_id,
                                           GValue       *value,
                                           GParamSpec   *pspec);

static void
st_theme_context_finalize (GObject *object)
{
  StThemeContext *context = ST_THEME_CONTEXT (object);

  g_signal_handlers_disconnect_by_func (st_texture_cache_get_default (),
                                       (gpointer) on_icon_theme_changed,
                                       context);

  g_signal_handlers_disconnect_by_func (clutter_get_default_backend (),
                                        (gpointer) st_theme_context_changed,
                                        context);

  if (context->nodes)
    g_hash_table_unref (context->nodes);
  if (context->root_node)
    g_object_unref (context->root_node);
  if (context->theme)
    g_object_unref (context->theme);

  pango_font_description_free (context->font);

  G_OBJECT_CLASS (st_theme_context_parent_class)->finalize (object);
}

static void
st_theme_context_class_init (StThemeContextClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->set_property = st_theme_context_set_property;
  object_class->get_property = st_theme_context_get_property;
  object_class->finalize = st_theme_context_finalize;

/**
   * StThemeContext:scale-factor:
   *
   * The scaling factor used or high dpi scaling.
   */
  g_object_class_install_property (object_class,
                                   PROP_SCALE_FACTOR,
                                   g_param_spec_int ("scale-factor",
                                                     "Scale factor",
                                                     "Integer scale factor used for high dpi scaling",
                                                     0, G_MAXINT, 1,
                                                     G_PARAM_READABLE | G_PARAM_WRITABLE));

  signals[CHANGED] =
    g_signal_new ("changed",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  0, /* no default handler slot */
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 0);
}

static void
st_theme_context_init (StThemeContext *context)
{
  context->font = pango_font_description_from_string (DEFAULT_FONT);

  g_signal_connect (st_texture_cache_get_default (),
                    "icon-theme-changed",
                    G_CALLBACK (on_icon_theme_changed),
                    context);

  g_signal_connect_swapped (clutter_get_default_backend (),
                            "resolution-changed",
                            G_CALLBACK (st_theme_context_changed),
                            context);

  context->nodes = g_hash_table_new_full ((GHashFunc) st_theme_node_hash,
                                          (GEqualFunc) st_theme_node_equal,
                                          g_object_unref, NULL);

  context->scale_factor = 1;
}

static void
st_theme_context_set_property (GObject      *object,
                               guint         prop_id,
                               const GValue *value,
                               GParamSpec   *pspec)
{
  StThemeContext *context = ST_THEME_CONTEXT (object);

  switch (prop_id)
    {
    case PROP_SCALE_FACTOR:
      {
        int scale_factor = g_value_get_int (value);
        if (scale_factor != context->scale_factor)
          {
            context->scale_factor = scale_factor;
            st_theme_context_changed (context);
          }

        break;
      }
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
st_theme_context_get_property (GObject    *object,
                               guint       prop_id,
                               GValue     *value,
                               GParamSpec *pspec)
{
  StThemeContext *context = ST_THEME_CONTEXT (object);

  switch (prop_id)
    {
    case PROP_SCALE_FACTOR:
      g_value_set_int (value, context->scale_factor);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

/**
 * st_theme_context_new:
 *
 * Create a new theme context not associated with any #ClutterStage.
 * This can be useful in testing scenarios, or if using StThemeContext
 * with something other than #ClutterActor objects, but you generally
 * should use st_theme_context_get_for_stage() instead.
 */
StThemeContext *
st_theme_context_new (void)
{
  StThemeContext *context;

  context = g_object_new (ST_TYPE_THEME_CONTEXT, NULL);

  return context;
}

static void
on_stage_destroy (ClutterStage *stage)
{
  StThemeContext *context = st_theme_context_get_for_stage (stage);

  g_object_set_data (G_OBJECT (stage), "st-theme-context", NULL);
  g_object_unref (context);
}

static void
st_theme_context_changed (StThemeContext *context)
{
  StThemeNode *old_root = context->root_node;
  context->root_node = NULL;
  g_hash_table_remove_all (context->nodes);

  g_signal_emit (context, signals[CHANGED], 0);

  if (old_root)
    g_object_unref (old_root);
}

static gboolean
changed_idle (gpointer userdata)
{
  st_theme_context_changed (userdata);
  return FALSE;
}

static void
on_icon_theme_changed (StTextureCache *cache,
                       StThemeContext *context)
{
  /* Note that an icon theme change isn't really a change of the StThemeContext;
   * the style information has changed. But since the style factors into the
   * icon_name => icon lookup, faking a theme context change is a good way
   * to force users such as StIcon to look up icons again. Don't bother recreating
   * the root node, though. */
  g_idle_add ((GSourceFunc) changed_idle, context);
}

/**
 * st_theme_context_get_for_stage:
 * @stage: a #ClutterStage
 *
 * Gets a singleton theme context associated with the stage.
 *
 * Return value: (transfer none): the singleton theme context for the stage
 */
StThemeContext *
st_theme_context_get_for_stage (ClutterStage *stage)
{
  StThemeContext *context;

  g_return_val_if_fail (CLUTTER_IS_STAGE (stage), NULL);

  context = g_object_get_data (G_OBJECT (stage), "st-theme-context");
  if (context)
    return context;

  context = st_theme_context_new ();
  g_object_set_data (G_OBJECT (stage), "st-theme-context", context);
  g_signal_connect (stage, "destroy",
                    G_CALLBACK (on_stage_destroy), NULL);

  return context;
}

/**
 * st_theme_context_set_theme:
 * @context: a #StThemeContext
 *
 * Sets the default set of theme stylesheets for the context. This theme will
 * be used for the root node and for nodes descending from it, unless some other
 * style is explicitely specified.
 */
void
st_theme_context_set_theme (StThemeContext          *context,
                            StTheme                 *theme)
{
  g_return_if_fail (ST_IS_THEME_CONTEXT (context));
  g_return_if_fail (theme == NULL || ST_IS_THEME (theme));

  if (context->theme != theme)
    {
      if (context->theme)
        g_object_unref (context->theme);

      context->theme = theme;

      if (context->theme)
        g_object_ref (context->theme);

      st_theme_context_changed (context);
    }
}

/**
 * st_theme_context_get_theme:
 * @context: a #StThemeContext
 *
 * Gets the default theme for the context. See st_theme_context_set_theme()
 *
 * Return value: (transfer none): the default theme for the context
 */
StTheme *
st_theme_context_get_theme (StThemeContext *context)
{
  g_return_val_if_fail (ST_IS_THEME_CONTEXT (context), NULL);

  return context->theme;
}

/**
 * st_theme_context_set_font:
 * @context: a #StThemeContext
 * @font: the default font for theme context
 *
 * Sets the default font for the theme context. This is the font that
 * is inherited by the root node of the tree of theme nodes. If the
 * font is not overriden, then this font will be used. If the font is
 * partially modified (for example, with 'font-size: 110%', then that
 * modification is based on this font.
 */
void
st_theme_context_set_font (StThemeContext             *context,
                           const PangoFontDescription *font)
{
  g_return_if_fail (ST_IS_THEME_CONTEXT (context));
  g_return_if_fail (font != NULL);

  if (context->font == font ||
      pango_font_description_equal (context->font, font))
    return;

  pango_font_description_free (context->font);
  context->font = pango_font_description_copy (font);
  st_theme_context_changed (context);
}

/**
 * st_theme_context_get_font:
 * @context: a #StThemeContext
 *
 * Gets the default font for the theme context. See st_theme_context_set_font().
 *
 * Return value: the default font for the theme context.
 */
const PangoFontDescription *
st_theme_context_get_font (StThemeContext *context)
{
  g_return_val_if_fail (ST_IS_THEME_CONTEXT (context), NULL);

  return context->font;
}

/**
 * st_theme_context_get_root_node:
 * @context: a #StThemeContext
 *
 * Gets the root node of the tree of theme style nodes that associated with this
 * context. For the node tree associated with a stage, this node represents
 * styles applied to the stage itself.
 *
 * Return value: (transfer none): the root node of the context's style tree
 */
StThemeNode *
st_theme_context_get_root_node (StThemeContext *context)
{
  if (context->root_node == NULL)
    context->root_node = st_theme_node_new (context, NULL, context->theme,
                                            G_TYPE_NONE, NULL, NULL, NULL, NULL, FALSE);

  return context->root_node;
}

/**
 * st_theme_context_intern_node:
 * @context: a #StThemeContext
 * @node: a #StThemeNode
 *
 * Return an existing node matching @node, or if that isn't possible,
 * @node itself.
 *
 * Return value: (transfer none): a node with the same properties as @node
 */
StThemeNode *
st_theme_context_intern_node (StThemeContext *context,
                              StThemeNode    *node)
{
  StThemeNode *mine = g_hash_table_lookup (context->nodes, node);

  /* this might be node or not - it doesn't actually matter */
  if (mine != NULL)
    return mine;

  g_hash_table_add (context->nodes, g_object_ref (node));
  return node;
}