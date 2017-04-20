/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-theme-node.c: style information for one node in a tree of themed objects
 *
 * Copyright 2008-2010 Red Hat, Inc.
 * Copyright 2009 Steve Frécinaux
 * Copyright 2009, 2010 Florian Müllner
 * Copyright 2010 Adel Gadllah
 * Copyright 2010 Giovanni Campagna
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

#include <stdlib.h>
#include <string.h>

#include "st-theme-private.h"
#include "st-theme-context.h"
#include "st-theme-node-private.h"

static void st_theme_node_dispose           (GObject                 *object);
static void st_theme_node_finalize           (GObject                 *object);

static const ClutterColor BLACK_COLOR = { 0, 0, 0, 0xff };
static const ClutterColor TRANSPARENT_COLOR = { 0, 0, 0, 0 };
static const ClutterColor DEFAULT_SUCCESS_COLOR = { 0x4e, 0x9a, 0x06, 0xff };
static const ClutterColor DEFAULT_WARNING_COLOR = { 0xf5, 0x79, 0x3e, 0xff };
static const ClutterColor DEFAULT_ERROR_COLOR = { 0xcc, 0x00, 0x00, 0xff };

extern gfloat st_slow_down_factor;

G_DEFINE_TYPE (StThemeNode, st_theme_node, G_TYPE_OBJECT)

static void
st_theme_node_init (StThemeNode *node)
{
  node->transition_duration = -1;
  _st_theme_node_init_drawing_state (node);
}

static void
st_theme_node_class_init (StThemeNodeClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->dispose = st_theme_node_dispose;
  object_class->finalize = st_theme_node_finalize;
}

static void
maybe_free_properties (StThemeNode *node)
{
  if (node->properties)
    {
      g_free (node->properties);
      node->properties = NULL;
      node->n_properties = 0;
    }

  if (node->inline_properties)
    {
      /* This destroys the list, not just the head of the list */
      cr_declaration_destroy (node->inline_properties);
      node->inline_properties = NULL;
    }
}

static void
on_custom_stylesheets_changed (StTheme *theme,
                               gpointer data)
{
  StThemeNode *node = data;
  maybe_free_properties (node);
  node->properties_computed = FALSE;
}

static void
st_theme_node_dispose (GObject *gobject)
{
  StThemeNode *node = ST_THEME_NODE (gobject);

  if (node->context)
    {
      g_object_unref (node->context);
      node->context = NULL;
    }

  if (node->theme)
    {
      g_signal_handlers_disconnect_by_func (node->theme, on_custom_stylesheets_changed, node);
      g_object_unref (node->theme);
      node->theme = NULL;
    }

  if (node->parent_node)
    {
      g_object_unref (node->parent_node);
      node->parent_node = NULL;
    }

  if (node->border_image)
    {
      g_object_unref (node->border_image);
      node->border_image = NULL;
    } 

  if (node->icon_colors)
    {
      st_icon_colors_unref (node->icon_colors);
      node->icon_colors = NULL;
    }

  G_OBJECT_CLASS (st_theme_node_parent_class)->dispose (gobject);
}

static void
st_theme_node_finalize (GObject *object)
{
  StThemeNode *node = ST_THEME_NODE (object);

  g_free (node->element_id);
  g_strfreev (node->element_classes);
  g_strfreev (node->pseudo_classes);
  g_free (node->inline_style);

  maybe_free_properties (node);

  if (node->font_desc)
    {
      pango_font_description_free (node->font_desc);
      node->font_desc = NULL;
    }

  if (node->box_shadow)
    {
      st_shadow_unref (node->box_shadow);
      node->box_shadow = NULL;
    }

  if (node->background_image_shadow)
    {
      st_shadow_unref (node->background_image_shadow);
      node->background_image_shadow = NULL;
    }

  if (node->text_shadow)
    {
      st_shadow_unref (node->text_shadow);
      node->text_shadow = NULL;
    }

  if (node->background_image)
    g_free (node->background_image);

  _st_theme_node_free_drawing_state (node);

  G_OBJECT_CLASS (st_theme_node_parent_class)->finalize (object);
}

static GStrv
split_on_whitespace (const gchar *s)
{
  gchar *cur;
  gchar *l;
  gchar *temp;
  GPtrArray *arr;

  if (s == NULL)
    return NULL;

  arr = g_ptr_array_new ();
  l = g_strdup (s);

  cur = strtok_r (l, " \t\f\r\n", &temp);

  while (cur != NULL)
    {
      g_ptr_array_add (arr, g_strdup (cur));
      cur = strtok_r (NULL, " \t\f\r\n", &temp);
    }

  g_free (l);
  g_ptr_array_add (arr, NULL);
  return (GStrv) g_ptr_array_free (arr, FALSE);
}

/**
 * st_theme_node_new:
 * @context: the context representing global state for this themed tree
 * @parent_node: (allow-none): the parent node of this node
 * @theme: (allow-none): a theme (stylesheet set) that overrides the
 *   theme inherited from the parent node
 * @element_type: the type of the GObject represented by this node
 *  in the tree (corresponding to an element if we were theming an XML
 *  document. %G_TYPE_NONE means this style was created for the stage
 * actor and matches a selector element name of 'stage'.
 * @element_id: (allow-none): the ID to match CSS rules against
 * @element_class: (allow-none): a whitespace-separated list of classes
 *   to match CSS rules against
 * @pseudo_class: (allow-none): a whitespace-separated list of pseudo-classes
 *   (like 'hover' or 'visited') to match CSS rules against
 *
 * Creates a new #StThemeNode. Once created, a node is immutable. Of any
 * of the attributes of the node (like the @element_class) change the node
 * and its child nodes must be destroyed and recreated.
 *
 * Return value: (transfer full): the theme node
 */
StThemeNode *
st_theme_node_new (StThemeContext    *context,
                   StThemeNode       *parent_node,
                   StTheme           *theme,
                   GType              element_type,
                   const char        *element_id,
                   const char        *element_class,
                   const char        *pseudo_class,
                   const char        *inline_style,
                   gboolean           important)
{
  StThemeNode *node;

  g_return_val_if_fail (ST_IS_THEME_CONTEXT (context), NULL);
  g_return_val_if_fail (parent_node == NULL || ST_IS_THEME_NODE (parent_node), NULL);

  node = g_object_new (ST_TYPE_THEME_NODE, NULL);

  node->context = g_object_ref (context);
  if (parent_node != NULL)
    node->parent_node = g_object_ref (parent_node);
  else
    node->parent_node = NULL;

  if (theme == NULL && parent_node != NULL)
    theme = parent_node->theme;

  if (theme != NULL)
    {
      node->theme = g_object_ref (theme);
      g_signal_connect (node->theme, "custom-stylesheets-changed",
                        G_CALLBACK (on_custom_stylesheets_changed), node);
    }

  node->important = (parent_node ? parent_node->important : FALSE) || important;
  node->element_type = element_type;
  node->element_id = g_strdup (element_id);
  node->element_classes = split_on_whitespace (element_class);
  node->pseudo_classes = split_on_whitespace (pseudo_class);
  node->inline_style = g_strdup (inline_style);

  return node;
}

/**
 * st_theme_node_get_parent:
 * @node: a #StThemeNode
 *
 * Gets the parent themed element node.
 *
 * Return value: (transfer none): the parent #StThemeNode, or %NULL if this
 *  is the root node of the tree of theme elements.
 */
StThemeNode *
st_theme_node_get_parent (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  return node->parent_node;
}

/**
 * st_theme_node_get_theme:
 * @node: a #StThemeNode
 *
 * Gets the theme stylesheet set that styles this node
 *
 * Return value: (transfer none): the theme stylesheet set
 */
StTheme *
st_theme_node_get_theme (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  return node->theme;
}

GType
st_theme_node_get_element_type (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), G_TYPE_NONE);

  return node->element_type;
}

const char *
st_theme_node_get_element_id (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  return node->element_id;
}

/**
 * st_theme_node_get_element_classes:
 *
 * Returns: (transfer none): the element's classes
 */
GStrv
st_theme_node_get_element_classes (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  return node->element_classes;
}

/**
 * st_theme_node_get_pseudo_classes:
 *
 * Returns: (transfer none): the element's pseudo-classes
 */
GStrv
st_theme_node_get_pseudo_classes (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  return node->pseudo_classes;
}

/**
 * st_theme_node_equal:
 * @node_a: first #StThemeNode
 * @node_b: second #StThemeNode
 *
 * Compare two #StThemeNodes. Two nodes which compare equal will match
 * the same CSS rules and have the same style properties. However, two
 * nodes that have ended up with identical style properties do not
 * necessarily compare equal.
 * In detail, @node_a and @node_b are considered equal iff
 * <itemizedlist>
 *   <listitem>
 *     <para>they share the same #StTheme and #StThemeContext</para>
 *   </listitem>
 *   <listitem>
 *     <para>they have the same parent</para>
 *   </listitem>
 *   <listitem>
 *     <para>they have the same element type</para>
 *   </listitem>
 *   <listitem>
 *     <para>their id, class, pseudo-class and inline-style match</para>
 *   </listitem>
 * </itemizedlist>
 *
 * Returns: %TRUE if @node_a equals @node_b
 */
gboolean
st_theme_node_equal (StThemeNode *node_a, StThemeNode *node_b)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node_a), FALSE);

  if (node_a == node_b)
     return TRUE;

  g_return_val_if_fail (ST_IS_THEME_NODE (node_b), FALSE);

  if (node_a->parent_node != node_b->parent_node ||
      node_a->context != node_b->context ||
      node_a->theme != node_b->theme ||
      node_a->element_type != node_b->element_type ||
      node_a->important != node_b->important ||
      g_strcmp0 (node_a->element_id, node_b->element_id) ||
      g_strcmp0 (node_a->inline_style, node_b->inline_style))
    return FALSE;

  if ((node_a->element_classes == NULL) != (node_b->element_classes == NULL))
    return FALSE;

  if ((node_a->pseudo_classes == NULL) != (node_b->pseudo_classes == NULL))
    return FALSE;

  if (node_a->element_classes != NULL)
    {
      int i;

      for (i = 0; ; i++)
        {
          if (g_strcmp0 (node_a->element_classes[i],
                         node_b->element_classes[i]))
            return FALSE;

          if (node_a->element_classes[i] == NULL)
            break;
        }
    }

  if (node_a->pseudo_classes != NULL)
    {
      int i;

      for (i = 0; ; i++)
        {
          if (g_strcmp0 (node_a->pseudo_classes[i],
                         node_b->pseudo_classes[i]))
            return FALSE;

          if (node_a->pseudo_classes[i] == NULL)
            break;
        }
    }

  return TRUE;
}

guint
st_theme_node_hash (StThemeNode *node)
{
  guint hash = GPOINTER_TO_UINT (node->parent_node);

  hash = hash * 33 + GPOINTER_TO_UINT (node->context);
  hash = hash * 33 + GPOINTER_TO_UINT (node->theme);
  hash = hash * 33 + ((guint) node->element_type);

  if (node->element_id != NULL)
    hash = hash * 33 + g_str_hash (node->element_id);

  if (node->inline_style != NULL)
    hash = hash * 33 + g_str_hash (node->inline_style);

  if (node->element_classes != NULL)
    {
      gchar **it;

      for (it = node->element_classes; *it != NULL; it++)
        hash = hash * 33 + g_str_hash (*it) + 1;
    }

  if (node->pseudo_classes != NULL)
    {
      gchar **it;

      for (it = node->pseudo_classes; *it != NULL; it++)
        hash = hash * 33 + g_str_hash (*it) + 1;
    }

  return hash;
}

static void
ensure_properties (StThemeNode *node)
{
  if (!node->properties_computed)
    {
      GPtrArray *properties = NULL;

      node->properties_computed = TRUE;

      if (node->theme)
        {
          properties = _st_theme_get_matched_properties (node->theme, node);
          if ((!properties || properties->len == 0) && node->important)
            properties = _st_theme_get_matched_properties_fallback (node->theme, node);
        }

      if (node->inline_style)
        {
          CRDeclaration *cur_decl;

          if (!properties)
            properties = g_ptr_array_new ();

          node->inline_properties = _st_theme_parse_declaration_list (node->inline_style);
          for (cur_decl = node->inline_properties; cur_decl; cur_decl = cur_decl->next)
            g_ptr_array_add (properties, cur_decl);
        }

      if (properties)
        {
          node->n_properties = properties->len;
          node->properties = (CRDeclaration **)g_ptr_array_free (properties, FALSE);
        }
    }
}

typedef enum {
  VALUE_FOUND,
  VALUE_NOT_FOUND,
  VALUE_INHERIT
} GetFromTermResult;

static gboolean
term_is_inherit (CRTerm *term)
{
  return (term->type == TERM_IDENT &&
          strcmp (term->content.str->stryng->str, "inherit") == 0);
}

static gboolean
term_is_none (CRTerm *term)
{
  return (term->type == TERM_IDENT &&
          strcmp (term->content.str->stryng->str, "none") == 0);
}

static gboolean
term_is_transparent (CRTerm *term)
{
  return (term->type == TERM_IDENT &&
          strcmp (term->content.str->stryng->str, "transparent") == 0);
}

static int
color_component_from_double (double component)
{
  /* We want to spread the range 0-1 equally over 0..255, but
   * 1.0 should map to 255 not 256, so we need to special-case it.
   * See http://people.redhat.com/otaylor/pixel-converting.html
   * for (very) detailed discussion of related issues. */
  if (component >= 1.0)
    return 255;
  else
    return (int)(component * 256);
}

static GetFromTermResult
get_color_from_rgba_term (CRTerm       *term,
                          ClutterColor *color)
{
  CRTerm *arg = term->ext_content.func_param;
  CRNum *num;
  double r = 0, g = 0, b = 0, a = 0;
  int i;

  for (i = 0; i < 4; i++)
    {
      double value;

      if (arg == NULL)
        return VALUE_NOT_FOUND;

      if ((i == 0 && arg->the_operator != NO_OP) ||
          (i > 0 && arg->the_operator != COMMA))
        return VALUE_NOT_FOUND;

      if (arg->type != TERM_NUMBER)
        return VALUE_NOT_FOUND;

      num = arg->content.num;

      /* For simplicity, we convert a,r,g,b to [0,1.0] floats and then
       * convert them back below. Then when we set them on a cairo content
       * we convert them back to floats, and then cairo converts them
       * back to integers to pass them to X, and so forth...
       */
      if (i < 3)
        {
          if (num->type == NUM_PERCENTAGE)
            value = num->val / 100;
          else if (num->type == NUM_GENERIC)
            value = num->val / 255;
          else
            return VALUE_NOT_FOUND;
        }
      else
        {
          if (num->type != NUM_GENERIC)
            return VALUE_NOT_FOUND;

          value = num->val;
        }

      value = CLAMP (value, 0, 1);

      switch (i)
        {
        case 0:
          r = value;
          break;
        case 1:
          g = value;
          break;
        case 2:
          b = value;
          break;
        case 3:
          a = value;
          break;
        }

      arg = arg->next;
    }

  color->red = color_component_from_double (r);
  color->green = color_component_from_double (g);
  color->blue = color_component_from_double (b);
  color->alpha = color_component_from_double (a);

  return VALUE_FOUND;
}

static GetFromTermResult
get_color_from_term (StThemeNode  *node,
                     CRTerm       *term,
                     ClutterColor *color)
{
  CRRgb rgb;
  enum CRStatus status;

  /* Since libcroco doesn't know about rgba colors, it can't handle
   * the transparent keyword
   */
  if (term_is_transparent (term))
    {
      *color = TRANSPARENT_COLOR;
      return VALUE_FOUND;
    }
  /* rgba () colors - a CSS3 addition, are not supported by libcroco,
   * but they are parsed as a "function", so we can emulate the
   * functionality.
   */
  else if (term->type == TERM_FUNCTION &&
           term->content.str &&
           term->content.str->stryng &&
           term->content.str->stryng->str &&
           strcmp (term->content.str->stryng->str, "rgba") == 0)
    {
      return get_color_from_rgba_term (term, color);
    }

  status = cr_rgb_set_from_term (&rgb, term);
  if (status != CR_OK)
    return VALUE_NOT_FOUND;

  if (rgb.inherit)
    return VALUE_INHERIT;

  if (rgb.is_percentage)
    cr_rgb_compute_from_percentage (&rgb);

  color->red = rgb.red;
  color->green = rgb.green;
  color->blue = rgb.blue;
  color->alpha = 0xff;

  return VALUE_FOUND;
}

/**
 * st_theme_node_lookup_color:
 * @node: a #StThemeNode
 * @property_name: The name of the color property
 * @inherit: if %TRUE, if a value is not found for the property on the
 *   node, then it will be looked up on the parent node, and then on the
 *   parent's parent, and so forth. Note that if the property has a
 *   value of 'inherit' it will be inherited even if %FALSE is passed
 *   in for @inherit; this only affects the default behavior for inheritance.
 * @color: (out caller-allocates): location to store the color that was
 *   determined. If the property is not found, the value in this location
 *   will not be changed.
 *
 * Generically looks up a property containing a single color value. When
 * specific getters (like st_theme_node_get_background_color()) exist, they
 * should be used instead. They are cached, so more efficient, and have
 * handling for shortcut properties and other details of CSS.
 *
 * See also st_theme_node_get_color(), which provides a simpler API.
 *
 * Return value: %TRUE if the property was found in the properties for this
 *  theme node (or in the properties of parent nodes when inheriting.)
 */
gboolean
st_theme_node_lookup_color (StThemeNode  *node,
                            const char   *property_name,
                            gboolean      inherit,
                            ClutterColor *color)
{

  int i;

  ensure_properties (node);

  for (i = node->n_properties - 1; i >= 0; i--)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp (decl->property->stryng->str, property_name) == 0)
        {
          GetFromTermResult result = get_color_from_term (node, decl->value, color);
          if (result == VALUE_FOUND)
            {
              return TRUE;
            }
          else if (result == VALUE_INHERIT)
            {
              if (node->parent_node)
                return st_theme_node_lookup_color (node->parent_node, property_name, inherit, color);
              else
                break;
            }
        }
    }

  if (inherit && node->parent_node)
    return st_theme_node_lookup_color (node->parent_node, property_name, inherit, color);

  return FALSE;
}

/**
 * st_theme_node_get_color:
 * @node: a #StThemeNode
 * @property_name: The name of the color property
 * @color: (out caller-allocates): location to store the color that
 *   was determined.
 *
 * Generically looks up a property containing a single color value. When
 * specific getters (like st_theme_node_get_background_color()) exist, they
 * should be used instead. They are cached, so more efficient, and have
 * handling for shortcut properties and other details of CSS.
 *
 * If @property_name is not found, a warning will be logged and a
 * default color returned.
 *
 * See also st_theme_node_lookup_color(), which provides more options,
 * and lets you handle the case where the theme does not specify the
 * indicated color.
 */
void
st_theme_node_get_color (StThemeNode  *node,
                         const char   *property_name,
                         ClutterColor *color)
{
  if (!st_theme_node_lookup_color (node, property_name, FALSE, color))
    {
      g_warning ("Did not find color property '%s'", property_name);
      memset (color, 0, sizeof (ClutterColor));
    }
}

/**
 * st_theme_node_lookup_double:
 * @node: a #StThemeNode
 * @property_name: The name of the numeric property
 * @inherit: if %TRUE, if a value is not found for the property on the
 *   node, then it will be looked up on the parent node, and then on the
 *   parent's parent, and so forth. Note that if the property has a
 *   value of 'inherit' it will be inherited even if %FALSE is passed
 *   in for @inherit; this only affects the default behavior for inheritance.
 * @value: (out): location to store the value that was determined.
 *   If the property is not found, the value in this location
 *   will not be changed.
 *
 * Generically looks up a property containing a single numeric value
 *  without units.
 *
 * See also st_theme_node_get_double(), which provides a simpler API.
 *
 * Return value: %TRUE if the property was found in the properties for this
 *  theme node (or in the properties of parent nodes when inheriting.)
 */
gboolean
st_theme_node_lookup_double (StThemeNode *node,
                             const char  *property_name,
                             gboolean     inherit,
                             double      *value)
{
  gboolean result = FALSE;
  int i;

  ensure_properties (node);

  for (i = node->n_properties - 1; i >= 0; i--)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp (decl->property->stryng->str, property_name) == 0)
        {
          CRTerm *term = decl->value;

          if (term->type != TERM_NUMBER || term->content.num->type != NUM_GENERIC)
            continue;

          *value = term->content.num->val;
          result = TRUE;
          break;
        }
    }

  if (!result && inherit && node->parent_node)
    result = st_theme_node_lookup_double (node->parent_node, property_name, inherit, value);

  return result;
}

/**
 * st_theme_node_get_double:
 * @node: a #StThemeNode
 * @property_name: The name of the numeric property
 *
 * Generically looks up a property containing a single numeric value
 *  without units.
 *
 * See also st_theme_node_lookup_double(), which provides more options,
 * and lets you handle the case where the theme does not specify the
 * indicated value.
 *
 * Return value: the value found. If @property_name is not
 *  found, a warning will be logged and 0 will be returned.
 */
gdouble
st_theme_node_get_double (StThemeNode *node,
                          const char  *property_name)
{
  gdouble value;

  if (st_theme_node_lookup_double (node, property_name, FALSE, &value))
    return value;
  else
    {
      g_warning ("Did not find double property '%s'", property_name);
      return 0.0;
    }
}

static const PangoFontDescription *
get_parent_font (StThemeNode *node)
{
  if (node->parent_node)
    return st_theme_node_get_font (node->parent_node);
  else
    return st_theme_context_get_font (node->context);
}

static GetFromTermResult
get_length_from_term (StThemeNode *node,
                      CRTerm      *term,
                      gboolean     use_parent_font,
                      gdouble     *length)
{
  CRNum *num;

  enum {
    ABSOLUTE,
    POINTS,
    FONT_RELATIVE,
  } type = ABSOLUTE;

  double multiplier = 1.0;
  int scale_factor;

  g_object_get (node->context, "scale-factor", &scale_factor, NULL);

  if (term->type != TERM_NUMBER)
    {
      g_warning ("Ignoring length property that isn't a number at line %d, col %d",
                 term->location.line, term->location.column);
      return VALUE_NOT_FOUND;
    }

  num = term->content.num;

  switch (num->type)
    {
    case NUM_LENGTH_PX:
      type = ABSOLUTE;
      multiplier = 1 * scale_factor;
      break;
    case NUM_LENGTH_PT:
      type = POINTS;
      multiplier = 1;
      break;
    case NUM_LENGTH_IN:
      type = POINTS;
      multiplier = 72;
      break;
    case NUM_LENGTH_CM:
      type = POINTS;
      multiplier = 72. / 2.54;
      break;
    case NUM_LENGTH_MM:
      type = POINTS;
      multiplier = 72. / 25.4;
      break;
    case NUM_LENGTH_PC:
      type = POINTS;
      multiplier = 12. / 25.4;
      break;
    case NUM_LENGTH_EM:
      {
        type = FONT_RELATIVE;
        multiplier = 1;
        break;
      }
    case NUM_LENGTH_EX:
      {
        /* Doing better would require actually resolving the font description
         * to a specific font, and Pango doesn't have an ex metric anyways,
         * so we'd have to try and synthesize it by complicated means.
         *
         * The 0.5em is the CSS spec suggested thing to use when nothing
         * better is available.
         */
        type = FONT_RELATIVE;
        multiplier = 0.5;
        break;
      }

    case NUM_INHERIT:
      return VALUE_INHERIT;

    case NUM_AUTO:
      g_warning ("'auto' not supported for lengths");
      return VALUE_NOT_FOUND;

    case NUM_GENERIC:
      {
        if (num->val != 0)
          {
            g_warning ("length values must specify a unit");
            return VALUE_NOT_FOUND;
          }
        else
          {
            type = ABSOLUTE;
            multiplier = 0;
          }
        break;
      }

    case NUM_PERCENTAGE:
      g_warning ("percentage lengths not currently supported");
      return VALUE_NOT_FOUND;

    case NUM_ANGLE_DEG:
    case NUM_ANGLE_RAD:
    case NUM_ANGLE_GRAD:
    case NUM_TIME_MS:
    case NUM_TIME_S:
    case NUM_FREQ_HZ:
    case NUM_FREQ_KHZ:
    case NUM_UNKNOWN_TYPE:
    case NB_NUM_TYPE:
      g_warning ("Ignoring invalid type of number of length property");
      return VALUE_NOT_FOUND;
    }

  double resolution;

  switch (type)
    {
    case ABSOLUTE:
      *length = num->val * multiplier;
      break;
    case POINTS:
      resolution = clutter_backend_get_resolution (clutter_get_default_backend ());
      *length = num->val * multiplier * (resolution / 72.);
      break;
    case FONT_RELATIVE:
      {
        const PangoFontDescription *desc;
        double font_size;

        if (use_parent_font)
          desc = get_parent_font (node);
        else
          desc = st_theme_node_get_font (node);

        font_size = (double)pango_font_description_get_size (desc) / PANGO_SCALE;

        if (pango_font_description_get_size_is_absolute (desc))
          {
            *length = num->val * multiplier * font_size;
          }
        else
          {
            resolution = clutter_backend_get_resolution (clutter_get_default_backend ());
            *length = num->val * multiplier * (resolution / 72.) * font_size;
          }
      }
      break;
    default:
      g_assert_not_reached ();
    }

  return VALUE_FOUND;
}

static GetFromTermResult
get_length_from_term_int (StThemeNode *node,
                          CRTerm      *term,
                          gboolean     use_parent_font,
                          gint        *length)
{
  double value;
  GetFromTermResult result;

  result = get_length_from_term (node, term, use_parent_font, &value);
  if (result == VALUE_FOUND)
    *length = (int) (0.5 + value);
  return result;
}

static GetFromTermResult
get_length_internal (StThemeNode *node,
                     const char  *property_name,
                     const char  *suffixed,
                     gdouble     *length)
{
  int i;

  ensure_properties (node);

  for (i = node->n_properties - 1; i >= 0; i--)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp (decl->property->stryng->str, property_name) == 0 ||
          (suffixed != NULL && strcmp (decl->property->stryng->str, suffixed) == 0))
        {
          GetFromTermResult result = get_length_from_term (node, decl->value, FALSE, length);
          if (result != VALUE_NOT_FOUND)
            return result;
        }
    }

  return VALUE_NOT_FOUND;
}

/**
 * st_theme_node_lookup_length:
 * @node: a #StThemeNode
 * @property_name: The name of the length property
 * @inherit: if %TRUE, if a value is not found for the property on the
 *   node, then it will be looked up on the parent node, and then on the
 *   parent's parent, and so forth. Note that if the property has a
 *   value of 'inherit' it will be inherited even if %FALSE is passed
 *   in for @inherit; this only affects the default behavior for inheritance.
 * @length: (out): location to store the length that was determined.
 *   If the property is not found, the value in this location
 *   will not be changed. The returned length is resolved
 *   to pixels.
 *
 * Generically looks up a property containing a single length value. When
 * specific getters (like st_theme_node_get_border_width()) exist, they
 * should be used instead. They are cached, so more efficient, and have
 * handling for shortcut properties and other details of CSS.
 *
 * See also st_theme_node_get_length(), which provides a simpler API.
 *
 * Return value: %TRUE if the property was found in the properties for this
 *  theme node (or in the properties of parent nodes when inheriting.)
 */
gboolean
st_theme_node_lookup_length (StThemeNode *node,
                             const char  *property_name,
                             gboolean     inherit,
                             gdouble     *length)
{
  GetFromTermResult result = get_length_internal (node, property_name, NULL, length);
  if (result == VALUE_FOUND)
    return TRUE;
  else if (result == VALUE_INHERIT)
    inherit = TRUE;

  if (inherit && node->parent_node &&
      st_theme_node_lookup_length (node->parent_node, property_name, inherit, length))
    return TRUE;
  else
    return FALSE;
}

/**
 * st_theme_node_get_length:
 * @node: a #StThemeNode
 * @property_name: The name of the length property
 *
 * Generically looks up a property containing a single length value. When
 * specific getters (like st_theme_node_get_border_width()) exist, they
 * should be used instead. They are cached, so more efficient, and have
 * handling for shortcut properties and other details of CSS.
 *
 * Unlike st_theme_node_get_color() and st_theme_node_get_double(),
 * this does not print a warning if the property is not found; it just
 * returns 0.
 *
 * See also st_theme_node_lookup_length(), which provides more options.
 *
 * Return value: the length, in pixels, or 0 if the property was not found.
 */
gdouble
st_theme_node_get_length (StThemeNode *node,
                          const char  *property_name)
{
  gdouble length;

  if (st_theme_node_lookup_length (node, property_name, FALSE, &length))
    return length;
  else
    return 0.0;
}

static void
do_border_radius_term (StThemeNode *node,
                       CRTerm      *term,
                       gboolean     topleft,
                       gboolean     topright,
                       gboolean     bottomright,
                       gboolean     bottomleft)
{
  int value;

  if (get_length_from_term_int (node, term, FALSE, &value) != VALUE_FOUND)
    return;

  if (topleft)
    node->border_radius[ST_CORNER_TOPLEFT] = value;
  if (topright)
    node->border_radius[ST_CORNER_TOPRIGHT] = value;
  if (bottomright)
    node->border_radius[ST_CORNER_BOTTOMRIGHT] = value;
  if (bottomleft)
    node->border_radius[ST_CORNER_BOTTOMLEFT] = value;
}

static void
do_border_radius (StThemeNode   *node,
                  CRDeclaration *decl)
{
  const char *property_name = decl->property->stryng->str + 13; /* Skip 'border-radius' */

  if (strcmp (property_name, "") == 0)
    {
      /* Slight deviation ... if we don't understand some of the terms and understand others,
       * then we set the ones we understand and ignore the others instead of ignoring the
       * whole thing
       */
      if (decl->value == NULL) /* 0 values */
        return;
      else if (decl->value->next == NULL) /* 1 value */
        {
          do_border_radius_term (node, decl->value,       TRUE, TRUE, TRUE, TRUE); /* all corners */
          return;
        }
      else if (decl->value->next->next == NULL) /* 2 values */
        {
          do_border_radius_term (node, decl->value,       TRUE,  FALSE,  TRUE,  FALSE);  /* topleft/bottomright */
          do_border_radius_term (node, decl->value->next, FALSE,  TRUE,   FALSE, TRUE);  /* topright/bottomleft */
        }
      else if (decl->value->next->next->next == NULL) /* 3 values */
        {
          do_border_radius_term (node, decl->value,             TRUE,  FALSE, FALSE, FALSE); /* topleft */
          do_border_radius_term (node, decl->value->next,       FALSE, TRUE,  FALSE, TRUE);  /* topright/bottomleft */
          do_border_radius_term (node, decl->value->next->next, FALSE, FALSE, TRUE,  FALSE);  /* bottomright */
        }
      else if (decl->value->next->next->next->next == NULL) /* 4 values */
        {
          do_border_radius_term (node, decl->value,                   TRUE,  FALSE, FALSE, FALSE); /* topleft */
          do_border_radius_term (node, decl->value->next,             FALSE, TRUE,  FALSE, FALSE); /* topright */
          do_border_radius_term (node, decl->value->next->next,       FALSE, FALSE, TRUE,  FALSE); /* bottomright */
          do_border_radius_term (node, decl->value->next->next->next, FALSE, FALSE, FALSE, TRUE);  /* bottomleft */
        }
      else
        {
          g_warning ("Too many values for border-radius property");
          return;
        }
    }
  else
    {
      if (decl->value == NULL || decl->value->next != NULL)
        return;

      if (strcmp (property_name, "-topleft") == 0)
        do_border_radius_term (node, decl->value, TRUE,  FALSE, FALSE, FALSE);
      else if (strcmp (property_name, "-topright") == 0)
        do_border_radius_term (node, decl->value, FALSE, TRUE,  FALSE, FALSE);
      else if (strcmp (property_name, "-bottomright") == 0)
        do_border_radius_term (node, decl->value, FALSE, FALSE, TRUE,  FALSE);
      else if (strcmp (property_name, "-bottomleft") == 0)
        do_border_radius_term (node, decl->value, FALSE, FALSE, FALSE, TRUE);
    }
}

static void
do_border_property (StThemeNode   *node,
                    CRDeclaration *decl)
{
  const char *property_name = decl->property->stryng->str + 6; /* Skip 'border' */
  StSide side = (StSide)-1;
  ClutterColor color;
  gboolean color_set = FALSE;
  int width = 0; /* suppress warning */
  gboolean width_set = FALSE;
  int j;

  if (g_str_has_prefix (property_name, "-radius"))
    {
      do_border_radius (node, decl);
      return;
    }

  if (g_str_has_prefix (property_name, "-left"))
    {
      side = ST_SIDE_LEFT;
      property_name += 5;
    }
  else if (g_str_has_prefix (property_name, "-right"))
    {
      side = ST_SIDE_RIGHT;
      property_name += 6;
    }
  else if (g_str_has_prefix (property_name, "-top"))
    {
      side = ST_SIDE_TOP;
      property_name += 4;
    }
  else if (g_str_has_prefix (property_name, "-bottom"))
    {
      side = ST_SIDE_BOTTOM;
      property_name += 7;
    }

  if (strcmp (property_name, "") == 0)
    {
      /* Set value for width/color/style in any order */
      CRTerm *term;

      for (term = decl->value; term; term = term->next)
        {
          GetFromTermResult result;

          if (term->type == TERM_IDENT)
            {
              const char *ident = term->content.str->stryng->str;
              if (strcmp (ident, "none") == 0 || strcmp (ident, "hidden") == 0)
                {
                  width = 0;
                  width_set = TRUE;
                  continue;
                }
              else if (strcmp (ident, "solid") == 0)
                {
                  /* The only thing we support */
                  continue;
                }
              else if (strcmp (ident, "dotted") == 0 ||
                       strcmp (ident, "dashed") == 0 ||
                       strcmp (ident, "double") == 0 ||
                       strcmp (ident, "groove") == 0 ||
                       strcmp (ident, "ridge") == 0 ||
                       strcmp (ident, "inset") == 0 ||
                       strcmp (ident, "outset") == 0)
                {
                  /* Treat the same as solid */
                  continue;
                }

              /* Presumably a color, fall through */
            }

          if (term->type == TERM_NUMBER)
            {
              result = get_length_from_term_int (node, term, FALSE, &width);
              if (result != VALUE_NOT_FOUND)
                {
                  width_set = result == VALUE_FOUND;
                  continue;
                }
            }

          result = get_color_from_term (node, term, &color);
          if (result != VALUE_NOT_FOUND)
            {
              color_set = result == VALUE_FOUND;
              continue;
            }
        }

    }
  else if (strcmp (property_name, "-color") == 0)
    {
      if (decl->value == NULL || decl->value->next != NULL)
        return;

      if (get_color_from_term (node, decl->value, &color) == VALUE_FOUND)
        /* Ignore inherit */
        color_set = TRUE;
    }
  else if (strcmp (property_name, "-width") == 0)
    {
      if (decl->value == NULL || decl->value->next != NULL)
        return;

      if (get_length_from_term_int (node, decl->value, FALSE, &width) == VALUE_FOUND)
        /* Ignore inherit */
        width_set = TRUE;
    }

  if (side == (StSide)-1)
    {
      for (j = 0; j < 4; j++)
        {
          if (color_set)
            node->border_color[j] = color;
          if (width_set)
            node->border_width[j] = width;
        }
    }
  else
    {
      if (color_set)
        node->border_color[side] = color;
      if (width_set)
        node->border_width[side] = width;
    }
}

static void
do_outline_property (StThemeNode   *node,
                     CRDeclaration *decl)
{
  const char *property_name = decl->property->stryng->str + 7; /* Skip 'outline' */
  ClutterColor color;
  gboolean color_set = FALSE;
  int width = 0; /* suppress warning */
  gboolean width_set = FALSE;

  if (strcmp (property_name, "") == 0)
    {
      /* Set value for width/color/style in any order */
      CRTerm *term;

      for (term = decl->value; term; term = term->next)
        {
          GetFromTermResult result;

          if (term->type == TERM_IDENT)
            {
              const char *ident = term->content.str->stryng->str;
              if (strcmp (ident, "none") == 0 || strcmp (ident, "hidden") == 0)
                {
                  width = 0;
                  width_set = TRUE;
                  continue;
                }
              else if (strcmp (ident, "solid") == 0)
                {
                  /* The only thing we support */
                  continue;
                }
              else if (strcmp (ident, "dotted") == 0 ||
                       strcmp (ident, "dashed") == 0 ||
                       strcmp (ident, "double") == 0 ||
                       strcmp (ident, "groove") == 0 ||
                       strcmp (ident, "ridge") == 0 ||
                       strcmp (ident, "inset") == 0 ||
                       strcmp (ident, "outset") == 0)
                {
                  /* Treat the same as solid */
                  continue;
                }

              /* Presumably a color, fall through */
            }

          if (term->type == TERM_NUMBER)
            {
              result = get_length_from_term_int (node, term, FALSE, &width);
              if (result != VALUE_NOT_FOUND)
                {
                  width_set = result == VALUE_FOUND;
                  continue;
                }
            }

          result = get_color_from_term (node, term, &color);
          if (result != VALUE_NOT_FOUND)
            {
              color_set = result == VALUE_FOUND;
              continue;
            }
        }

    }
  else if (strcmp (property_name, "-color") == 0)
    {
      if (decl->value == NULL || decl->value->next != NULL)
        return;

      if (get_color_from_term (node, decl->value, &color) == VALUE_FOUND)
        /* Ignore inherit */
        color_set = TRUE;
    }
  else if (strcmp (property_name, "-width") == 0)
    {
      if (decl->value == NULL || decl->value->next != NULL)
        return;

      if (get_length_from_term_int (node, decl->value, FALSE, &width) == VALUE_FOUND)
        /* Ignore inherit */
        width_set = TRUE;
    }

  if (color_set)
    node->outline_color = color;
  if (width_set)
    node->outline_width = width;
}

static void
do_padding_property_term (StThemeNode *node,
                          CRTerm      *term,
                          gboolean     left,
                          gboolean     right,
                          gboolean     top,
                          gboolean     bottom)
{
  int value;

  if (get_length_from_term_int (node, term, FALSE, &value) != VALUE_FOUND)
    return;

  if (left)
    node->padding[ST_SIDE_LEFT] = value;
  if (right)
    node->padding[ST_SIDE_RIGHT] = value;
  if (top)
    node->padding[ST_SIDE_TOP] = value;
  if (bottom)
    node->padding[ST_SIDE_BOTTOM] = value;
}

static void
do_padding_property (StThemeNode   *node,
                     CRDeclaration *decl)
{
  const char *property_name = decl->property->stryng->str + 7; /* Skip 'padding' */

  if (strcmp (property_name, "") == 0)
    {
      /* Slight deviation ... if we don't understand some of the terms and understand others,
       * then we set the ones we understand and ignore the others instead of ignoring the
       * whole thing
       */
      if (decl->value == NULL) /* 0 values */
        return;
      else if (decl->value->next == NULL) /* 1 value */
        {
          do_padding_property_term (node, decl->value, TRUE, TRUE, TRUE, TRUE); /* left/right/top/bottom */
          return;
        }
      else if (decl->value->next->next == NULL) /* 2 values */
        {
          do_padding_property_term (node, decl->value,       FALSE, FALSE, TRUE,  TRUE);  /* top/bottom */
          do_padding_property_term (node, decl->value->next, TRUE, TRUE,   FALSE, FALSE); /* left/right */
        }
      else if (decl->value->next->next->next == NULL) /* 3 values */
        {
          do_padding_property_term (node, decl->value,             FALSE, FALSE, TRUE,  FALSE); /* top */
          do_padding_property_term (node, decl->value->next,       TRUE,  TRUE,  FALSE, FALSE); /* left/right */
          do_padding_property_term (node, decl->value->next->next, FALSE, FALSE, FALSE, TRUE);  /* bottom */
        }
      else if (decl->value->next->next->next->next == NULL) /* 4 values */
        {
          do_padding_property_term (node, decl->value,                   FALSE, FALSE, TRUE,  FALSE); /* top */
          do_padding_property_term (node, decl->value->next,             FALSE, TRUE,  FALSE, FALSE); /* right */
          do_padding_property_term (node, decl->value->next->next,       FALSE, FALSE, FALSE, TRUE);  /* bottom */
          do_padding_property_term (node, decl->value->next->next->next, TRUE,  FALSE, FALSE, FALSE); /* left */
        }
      else
        {
          g_warning ("Too many values for padding property");
          return;
        }
    }
  else
    {
      if (decl->value == NULL || decl->value->next != NULL)
        return;

      if (strcmp (property_name, "-left") == 0)
        do_padding_property_term (node, decl->value, TRUE,  FALSE, FALSE, FALSE);
      else if (strcmp (property_name, "-right") == 0)
        do_padding_property_term (node, decl->value, FALSE, TRUE,  FALSE, FALSE);
      else if (strcmp (property_name, "-top") == 0)
        do_padding_property_term (node, decl->value, FALSE, FALSE, TRUE,  FALSE);
      else if (strcmp (property_name, "-bottom") == 0)
        do_padding_property_term (node, decl->value, FALSE, FALSE, FALSE, TRUE);
    }
}

static void
do_margin_property_term (StThemeNode *node,
                         CRTerm      *term,
                         gboolean     left,
                         gboolean     right,
                         gboolean     top,
                         gboolean     bottom)
{
  int value;

  if (get_length_from_term_int (node, term, FALSE, &value) != VALUE_FOUND)
    return;

  if (left)
    node->margin[ST_SIDE_LEFT] = value;
  if (right)
    node->margin[ST_SIDE_RIGHT] = value;
  if (top)
    node->margin[ST_SIDE_TOP] = value;
  if (bottom)
    node->margin[ST_SIDE_BOTTOM] = value;
}

static void
do_margin_property (StThemeNode   *node,
                    CRDeclaration *decl)
{
  const char *property_name = decl->property->stryng->str + 6; /* Skip 'margin' */

  if (strcmp (property_name, "") == 0)
    {
      /* Slight deviation ... if we don't understand some of the terms and understand others,
       * then we set the ones we understand and ignore the others instead of ignoring the
       * whole thing
       */
      if (decl->value == NULL) /* 0 values */
        return;
      else if (decl->value->next == NULL) /* 1 value */
        {
          do_margin_property_term (node, decl->value, TRUE, TRUE, TRUE, TRUE); /* left/right/top/bottom */
          return;
        }
      else if (decl->value->next->next == NULL) /* 2 values */
        {
          do_margin_property_term (node, decl->value,       FALSE, FALSE, TRUE,  TRUE);  /* top/bottom */
          do_margin_property_term (node, decl->value->next, TRUE, TRUE,   FALSE, FALSE); /* left/right */
        }
      else if (decl->value->next->next->next == NULL) /* 3 values */
        {
          do_margin_property_term (node, decl->value,             FALSE, FALSE, TRUE,  FALSE); /* top */
          do_margin_property_term (node, decl->value->next,       TRUE,  TRUE,  FALSE, FALSE); /* left/right */
          do_margin_property_term (node, decl->value->next->next, FALSE, FALSE, FALSE, TRUE);  /* bottom */
        }
      else if (decl->value->next->next->next->next == NULL) /* 4 values */
        {
          do_margin_property_term (node, decl->value,                   FALSE, FALSE, TRUE,  FALSE); /* top */
          do_margin_property_term (node, decl->value->next,             FALSE, TRUE,  FALSE, FALSE); /* right */
          do_margin_property_term (node, decl->value->next->next,       FALSE, FALSE, FALSE, TRUE);  /* bottom */
          do_margin_property_term (node, decl->value->next->next->next, TRUE,  FALSE, FALSE, FALSE); /* left */
        }
      else
        {
          g_warning ("Too many values for margin property");
          return;
        }
    }
  else
    {
      if (decl->value == NULL || decl->value->next != NULL)
        return;

      if (strcmp (property_name, "-left") == 0)
        do_margin_property_term (node, decl->value, TRUE,  FALSE, FALSE, FALSE);
      else if (strcmp (property_name, "-right") == 0)
        do_margin_property_term (node, decl->value, FALSE, TRUE,  FALSE, FALSE);
      else if (strcmp (property_name, "-top") == 0)
        do_margin_property_term (node, decl->value, FALSE, FALSE, TRUE,  FALSE);
      else if (strcmp (property_name, "-bottom") == 0)
        do_margin_property_term (node, decl->value, FALSE, FALSE, FALSE, TRUE);
    }
}

static void
do_size_property (StThemeNode   *node,
                  CRDeclaration *decl,
                  int           *node_value)
{
  get_length_from_term_int (node, decl->value, FALSE, node_value);
}

void
_st_theme_node_ensure_geometry (StThemeNode *node)
{
  int i, j;

  if (node->geometry_computed)
    return;

  node->geometry_computed = TRUE;

  ensure_properties (node);

  for (j = 0; j < 4; j++)
    {
      node->border_width[j] = 0;
      node->border_color[j] = TRANSPARENT_COLOR;
    }

  node->outline_width = 0;
  node->outline_color = TRANSPARENT_COLOR;

  node->width = -1;
  node->height = -1;
  node->min_width = -1;
  node->min_height = -1;
  node->max_width = -1;
  node->max_height = -1;

  for (i = 0; i < node->n_properties; i++)
    {
      CRDeclaration *decl = node->properties[i];
      const char *property_name = decl->property->stryng->str;

      if (g_str_has_prefix (property_name, "border"))
        do_border_property (node, decl);
      else if (g_str_has_prefix (property_name, "outline"))
        do_outline_property (node, decl);
      else if (g_str_has_prefix (property_name, "padding"))
        do_padding_property (node, decl);
      else if (g_str_has_prefix (property_name, "margin"))
        do_margin_property (node, decl);
      else if (strcmp (property_name, "width") == 0)
        do_size_property (node, decl, &node->width);
      else if (strcmp (property_name, "height") == 0)
        do_size_property (node, decl, &node->height);
      else if (strcmp (property_name, "min-width") == 0)
        do_size_property (node, decl, &node->min_width);
      else if (strcmp (property_name, "min-height") == 0)
        do_size_property (node, decl, &node->min_height);
      else if (strcmp (property_name, "max-width") == 0)
        do_size_property (node, decl, &node->max_width);
      else if (strcmp (property_name, "max-height") == 0)
        do_size_property (node, decl, &node->max_height);
    }

  if (node->width != -1)
    {
      if (node->min_width == -1)
        node->min_width = node->width;
      else if (node->width < node->min_width)
        node->width = node->min_width;
      if (node->max_width == -1)
        node->max_width = node->width;
      else if (node->width > node->max_width)
        node->width = node->max_width;
    }

  if (node->height != -1)
    {
      if (node->min_height == -1)
        node->min_height = node->height;
      else if (node->height < node->min_height)
        node->height = node->min_height;
      if (node->max_height == -1)
        node->max_height = node->height;
      else if (node->height > node->max_height)
        node->height = node->max_height;
    }
}

int
st_theme_node_get_border_width (StThemeNode *node,
                                StSide       side)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), 0.);
  g_return_val_if_fail (side >= ST_SIDE_TOP && side <= ST_SIDE_LEFT, 0.);

  _st_theme_node_ensure_geometry (node);

  return node->border_width[side];
}

int
st_theme_node_get_border_radius (StThemeNode *node,
                                 StCorner     corner)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), 0.);
  g_return_val_if_fail (corner >= ST_CORNER_TOPLEFT && corner <= ST_CORNER_BOTTOMLEFT, 0.);

  _st_theme_node_ensure_geometry (node);

  return node->border_radius[corner];
}

int
st_theme_node_get_outline_width (StThemeNode  *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), 0);

  _st_theme_node_ensure_geometry (node);

  return node->outline_width;
}

/**
 * st_theme_node_get_outline_color:
 * @node: a #StThemeNode
 * @color: (out caller-allocates): location to store the color
 *
 * Returns the color of @node's outline.
 */
void
st_theme_node_get_outline_color (StThemeNode  *node,
                                 ClutterColor *color)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));

  _st_theme_node_ensure_geometry (node);

  *color = node->outline_color;
}

int
st_theme_node_get_width (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), -1);

  _st_theme_node_ensure_geometry (node);
  return node->width;
}

int
st_theme_node_get_height (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), -1);

  _st_theme_node_ensure_geometry (node);
  return node->height;
}

int
st_theme_node_get_min_width (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), -1);

  _st_theme_node_ensure_geometry (node);
  return node->min_width;
}

int
st_theme_node_get_min_height (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), -1);

  _st_theme_node_ensure_geometry (node);
  return node->min_height;
}

int
st_theme_node_get_max_width (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), -1);

  _st_theme_node_ensure_geometry (node);
  return node->max_width;
}

int
st_theme_node_get_max_height (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), -1);

  _st_theme_node_ensure_geometry (node);
  return node->max_height;
}

static GetFromTermResult
get_background_color_from_term (StThemeNode  *node,
                                CRTerm       *term,
                                ClutterColor *color)
{
  GetFromTermResult result = get_color_from_term (node, term, color);
  if (result == VALUE_NOT_FOUND)
    {
      if (term_is_transparent (term))
        {
          *color = TRANSPARENT_COLOR;
          return VALUE_FOUND;
        }
    }

  return result;
}

void
_st_theme_node_ensure_background (StThemeNode *node)
{
  int i;

  if (node->background_computed)
    return;

  node->background_repeat = FALSE;
  node->background_computed = TRUE;
  node->background_color = TRANSPARENT_COLOR;
  node->background_gradient_type = ST_GRADIENT_NONE;
  node->background_position_set = FALSE;
  node->background_size = ST_BACKGROUND_SIZE_AUTO;

  ensure_properties (node);

  for (i = 0; i < node->n_properties; i++)
    {
      CRDeclaration *decl = node->properties[i];
      const char *property_name = decl->property->stryng->str;

      if (g_str_has_prefix (property_name, "background"))
        property_name += 10;
      else
        continue;

      if (strcmp (property_name, "") == 0)
        {
          /* We're very liberal here ... if we recognize any term in the expression we take it, and
           * we ignore the rest. The actual specification is:
           *
           * background: [<'background-color'> || <'background-image'> || <'background-repeat'> || <'background-attachment'> || <'background-position'>] | inherit
           */

          CRTerm *term;
          /* background: property sets all terms to specified or default values */
          node->background_color = TRANSPARENT_COLOR;
          g_free (node->background_image);
          node->background_image = NULL;
          node->background_position_set = FALSE;
          node->background_size = ST_BACKGROUND_SIZE_AUTO;

          for (term = decl->value; term; term = term->next)
            {
              GetFromTermResult result = get_background_color_from_term (node, term, &node->background_color);
              if (result == VALUE_FOUND)
                {
                  /* color stored in node->background_color */
                }
              else if (result == VALUE_INHERIT)
                {
                  if (node->parent_node)
                    {
                      st_theme_node_get_background_color (node->parent_node, &node->background_color);
                      node->background_image = g_strdup (st_theme_node_get_background_image (node->parent_node));
                      node->background_bumpmap = g_strdup (st_theme_node_get_background_bumpmap (node->parent_node));
                    }
                }
              else if (term_is_none (term))
                {
                  /* leave node->background_color as transparent */
                }
              else if (term->type == TERM_URI)
                {
                  CRStyleSheet *base_stylesheet;

                  if (decl->parent_statement != NULL)
                    base_stylesheet = decl->parent_statement->parent_sheet;
                  else
                    base_stylesheet = NULL;

                  node->background_image = _st_theme_resolve_url (node->theme,
                                                                  base_stylesheet,
                                                                  term->content.str->stryng->str);
                }
            }
        }
      else if (strcmp (property_name, "-position") == 0)
        {
          GetFromTermResult result = get_length_from_term_int (node, decl->value, FALSE, &node->background_position_x);
          if (result == VALUE_NOT_FOUND)
            {
              node->background_position_set = FALSE;
              continue;
            }
          else
            node->background_position_set = TRUE;

          result = get_length_from_term_int (node, decl->value->next, FALSE, &node->background_position_y);

          if (result == VALUE_NOT_FOUND)
            {
              node->background_position_set = FALSE;
              continue;
            }
          else
            node->background_position_set = TRUE;
        }
      else if (strcmp (property_name, "-repeat") == 0)
        {
          if (decl->value->type == TERM_IDENT)
            {
              if (strcmp (decl->value->content.str->stryng->str, "repeat") == 0)
                node->background_repeat = TRUE;
            }
        }
      else if (strcmp (property_name, "-size") == 0)
        {
          if (decl->value->type == TERM_IDENT)
            {
              if (strcmp (decl->value->content.str->stryng->str, "contain") == 0)
                node->background_size = ST_BACKGROUND_SIZE_CONTAIN;
              else if (strcmp (decl->value->content.str->stryng->str, "cover") == 0)
                node->background_size = ST_BACKGROUND_SIZE_COVER;
              else if ((strcmp (decl->value->content.str->stryng->str, "auto") == 0) && (decl->value->next) && (decl->value->next->type == TERM_NUMBER))
                {
                  GetFromTermResult result = get_length_from_term_int (node, decl->value->next, FALSE, &node->background_size_h);

                  node->background_size_w = -1;
                  node->background_size = (result == VALUE_FOUND) ? ST_BACKGROUND_SIZE_FIXED : ST_BACKGROUND_SIZE_AUTO;
                }
              else
                node->background_size = ST_BACKGROUND_SIZE_AUTO;
            }
          else if (decl->value->type == TERM_NUMBER)
            {
              GetFromTermResult result = get_length_from_term_int (node, decl->value, FALSE, &node->background_size_w);
              if (result == VALUE_NOT_FOUND)
                continue;

              node->background_size = ST_BACKGROUND_SIZE_FIXED;

              if ((decl->value->next) && (decl->value->next->type == TERM_NUMBER))
                {
                  result = get_length_from_term_int (node, decl->value->next, FALSE, &node->background_size_h);

                  if (result == VALUE_FOUND)
                    continue;
                }
              node->background_size_h = -1;
            }
          else
            node->background_size = ST_BACKGROUND_SIZE_AUTO;
        }
      else if (strcmp (property_name, "-color") == 0)
        {
          GetFromTermResult result;

          if (decl->value == NULL || decl->value->next != NULL)
            continue;

          result = get_background_color_from_term (node, decl->value, &node->background_color);
          if (result == VALUE_FOUND)
            {
              /* color stored in node->background_color */
            }
          else if (result == VALUE_INHERIT)
            {
              if (node->parent_node)
                st_theme_node_get_background_color (node->parent_node, &node->background_color);
            }
        }
      else if (strcmp (property_name, "-image") == 0)
        {
          if (decl->value == NULL || decl->value->next != NULL)
            continue;

          if (decl->value->type == TERM_URI)
            {
              CRStyleSheet *base_stylesheet;

              if (decl->parent_statement != NULL)
                base_stylesheet = decl->parent_statement->parent_sheet;
              else
                base_stylesheet = NULL;

              g_free (node->background_image);
              node->background_image = _st_theme_resolve_url (node->theme,
                                                              base_stylesheet,
                                                              decl->value->content.str->stryng->str);
            }
          else if (term_is_inherit (decl->value))
            {
              g_free (node->background_image);
              node->background_image = g_strdup (st_theme_node_get_background_image (node->parent_node));
            }
          else if (term_is_none (decl->value))
            {
              g_free (node->background_image);
              node->background_image = NULL;
            }
        }
      else if (strcmp (property_name, "-bumpmap") == 0)
        {
          if (decl->value == NULL || decl->value->next != NULL)
            continue;

          if (decl->value->type == TERM_URI)
            {
              CRStyleSheet *base_stylesheet;

              if (decl->parent_statement != NULL)
                base_stylesheet = decl->parent_statement->parent_sheet;
              else
                base_stylesheet = NULL;

              g_free (node->background_bumpmap);
              node->background_bumpmap = _st_theme_resolve_url (node->theme,
                                                                base_stylesheet,
                                                                decl->value->content.str->stryng->str);
              
            }
          else if (term_is_inherit (decl->value))
            {
              g_free (node->background_bumpmap);
              node->background_bumpmap = g_strdup (st_theme_node_get_background_bumpmap (node->parent_node));
            }
          else if (term_is_none(decl->value))
            {
              g_free (node->background_bumpmap);
            }
        }
      else if (strcmp (property_name, "-gradient-direction") == 0)
        {
          CRTerm *term = decl->value;
          if (strcmp (term->content.str->stryng->str, "vertical") == 0)
            {
              node->background_gradient_type = ST_GRADIENT_VERTICAL;
            }
          else if (strcmp (term->content.str->stryng->str, "horizontal") == 0)
            {
              node->background_gradient_type = ST_GRADIENT_HORIZONTAL;
            }
          else if (strcmp (term->content.str->stryng->str, "radial") == 0)
            {
              node->background_gradient_type = ST_GRADIENT_RADIAL;
            }
          else if (strcmp (term->content.str->stryng->str, "none") == 0)
            {
              node->background_gradient_type = ST_GRADIENT_NONE;
            }
          else
            {
              g_warning ("Unrecognized background-gradient-direction \"%s\"",
                         term->content.str->stryng->str);
            }
        }
      else if (strcmp (property_name, "-gradient-start") == 0)
        {
          get_color_from_term (node, decl->value, &node->background_color);
        }
      else if (strcmp (property_name, "-gradient-end") == 0)
        {
          get_color_from_term (node, decl->value, &node->background_gradient_end);
        }
    }
}

/**
 * st_theme_node_get_background_color:
 * @node: a #StThemeNode
 * @color: (out caller-allocates): location to store the color
 *
 * Returns @node's background color.
 */
void
st_theme_node_get_background_color (StThemeNode  *node,
                                    ClutterColor *color)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));

  _st_theme_node_ensure_background (node);

  *color = node->background_color;
}

/**
 * st_theme_node_get_background_image:
 * @node: a #StThemeNode
 *
 * Returns @node's background image.
 */
const char *
st_theme_node_get_background_image (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  _st_theme_node_ensure_background (node);

  return node->background_image;
}

/**
 * st_theme_node_get_background_bumpmap:
 * @node: a #StThemeNode
 *
 * Returns @node's background bumpmap.
 */
const char *
st_theme_node_get_background_bumpmap (StThemeNode *node)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  _st_theme_node_ensure_background (node);

  return node->background_bumpmap;
}

/**
 * st_theme_node_get_foreground_color:
 * @node: a #StThemeNode
 * @color: (out caller-allocates): location to store the color
 *
 * Returns @node's foreground color.
 */
void
st_theme_node_get_foreground_color (StThemeNode  *node,
                                    ClutterColor *color)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));

  if (!node->foreground_computed)
    {
      int i;

      node->foreground_computed = TRUE;

      ensure_properties (node);

      for (i = node->n_properties - 1; i >= 0; i--)
        {
          CRDeclaration *decl = node->properties[i];

          if (strcmp (decl->property->stryng->str, "color") == 0)
            {
              GetFromTermResult result = get_color_from_term (node, decl->value, &node->foreground_color);
              if (result == VALUE_FOUND)
                goto out;
              else if (result == VALUE_INHERIT)
                break;
            }
        }

      if (node->parent_node)
        st_theme_node_get_foreground_color (node->parent_node, &node->foreground_color);
      else
        node->foreground_color = BLACK_COLOR; /* default to black */
    }

 out:
  *color = node->foreground_color;
}


/**
 * st_theme_node_get_background_gradient:
 * @node: A #StThemeNode
 * @type: (out): Type of gradient
 * @start: (out caller-allocates): Color at start of gradient
 * @end: (out caller-allocates): Color at end of gradient
 *
 * The @start and @end arguments will only be set if @type is not #ST_GRADIENT_NONE.
 */
void
st_theme_node_get_background_gradient (StThemeNode    *node,
                                       StGradientType *type,
                                       ClutterColor   *start,
                                       ClutterColor   *end)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));

  _st_theme_node_ensure_background (node);

  *type = node->background_gradient_type;
  if (*type != ST_GRADIENT_NONE)
    {
      *start = node->background_color;
      *end = node->background_gradient_end;
    }
}

/**
 * st_theme_node_get_border_color:
 * @node: a #StThemeNode
 * @side: a #StSide
 * @color: (out caller-allocates): location to store the color
 *
 * Returns the color of @node's border on @side
 */
void
st_theme_node_get_border_color (StThemeNode  *node,
                                StSide        side,
                                ClutterColor *color)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));
  g_return_if_fail (side >= ST_SIDE_TOP && side <= ST_SIDE_LEFT);

  _st_theme_node_ensure_geometry (node);

  *color = node->border_color[side];
}

double
st_theme_node_get_padding (StThemeNode *node,
                           StSide       side)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), 0.);
  g_return_val_if_fail (side >= ST_SIDE_TOP && side <= ST_SIDE_LEFT, 0.);

  _st_theme_node_ensure_geometry (node);

  return node->padding[side];
}

double
st_theme_node_get_margin (StThemeNode *node,
                          StSide side)
{
  g_return_val_if_fail (ST_IS_THEME_NODE (node), 0.);
  g_return_val_if_fail (side >= ST_SIDE_TOP && side <= ST_SIDE_LEFT, 0.);

  _st_theme_node_ensure_geometry (node);

  return node->margin[side];
}

/**
 * st_theme_node_get_transition_duration:
 * @node: an #StThemeNode
 *
 * Get the value of the transition-duration property, which
 * specifies the transition time between the previous #StThemeNode
 * and @node.
 *
 * Returns: the node's transition duration in milliseconds
 */
int
st_theme_node_get_transition_duration (StThemeNode *node)
{
  gdouble value = 0.0;

  g_return_val_if_fail (ST_IS_THEME_NODE (node), 0);

  if (node->transition_duration > -1)
    return st_slow_down_factor * node->transition_duration;

  st_theme_node_lookup_double (node, "transition-duration", FALSE, &value);

  node->transition_duration = (int)value;

  return st_slow_down_factor * node->transition_duration;
}

StTextDecoration
st_theme_node_get_text_decoration (StThemeNode *node)
{
  int i;

  ensure_properties (node);

  for (i = node->n_properties - 1; i >= 0; i--)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp (decl->property->stryng->str, "text-decoration") == 0)
        {
          CRTerm *term = decl->value;
          StTextDecoration decoration = 0;

          /* Specification is none | [ underline || overline || line-through || blink ] | inherit
           *
           * We're a bit more liberal, and for example treat 'underline none' as the same as
           * none.
           */
          for (; term; term = term->next)
            {
              if (term->type != TERM_IDENT)
                goto next_decl;

              if (strcmp (term->content.str->stryng->str, "none") == 0)
                {
                  return 0;
                }
              else if (strcmp (term->content.str->stryng->str, "inherit") == 0)
                {
                  if (node->parent_node)
                    return st_theme_node_get_text_decoration (node->parent_node);
                }
              else if (strcmp (term->content.str->stryng->str, "underline") == 0)
                {
                  decoration |= ST_TEXT_DECORATION_UNDERLINE;
                }
              else if (strcmp (term->content.str->stryng->str, "overline") == 0)
                {
                  decoration |= ST_TEXT_DECORATION_OVERLINE;
                }
              else if (strcmp (term->content.str->stryng->str, "line-through") == 0)
                {
                  decoration |= ST_TEXT_DECORATION_LINE_THROUGH;
                }
              else if (strcmp (term->content.str->stryng->str, "blink") == 0)
                {
                  decoration |= ST_TEXT_DECORATION_BLINK;
                }
              else
                {
                  goto next_decl;
                }
            }

          return decoration;
        }

    next_decl:
      ;
    }

  return 0;
}

StTextAlign
st_theme_node_get_text_align(StThemeNode *node)
{
  int i;

  ensure_properties(node);

  for (i = node->n_properties - 1; i >= 0; i--)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp(decl->property->stryng->str, "text-align") == 0)
        {
          CRTerm *term = decl->value;

          if (term->type != TERM_IDENT || term->next)
            continue;

          if (strcmp(term->content.str->stryng->str, "inherit") == 0)
            {
              if (node->parent_node)
                return st_theme_node_get_text_align(node->parent_node);
              return ST_TEXT_ALIGN_LEFT;
            }
          else if (strcmp(term->content.str->stryng->str, "left") == 0)
            {
              return ST_TEXT_ALIGN_LEFT;
            }
          else if (strcmp(term->content.str->stryng->str, "right") == 0)
            {
              return ST_TEXT_ALIGN_RIGHT;
            }
          else if (strcmp(term->content.str->stryng->str, "center") == 0)
            {
              return ST_TEXT_ALIGN_CENTER;
            }
          else if (strcmp(term->content.str->stryng->str, "justify") == 0)
            {
              return ST_TEXT_ALIGN_JUSTIFY;
            }
        }
    }
  if(node->parent_node)
    return st_theme_node_get_text_align(node->parent_node);
  return ST_TEXT_ALIGN_LEFT;
}

static gboolean
font_family_from_terms (CRTerm *term,
                        char  **family)
{
  GString *family_string;
  gboolean result = FALSE;
  gboolean last_was_quoted = FALSE;

  if (!term)
    return FALSE;

  family_string = g_string_new (NULL);

  while (term)
    {
      if (term->type != TERM_STRING && term->type != TERM_IDENT)
        {
          goto out;
        }

      if (family_string->len > 0)
        {
          if (term->the_operator != COMMA && term->the_operator != NO_OP)
            goto out;
          /* Can concatenate two bare words, but not two quoted strings */
          if ((term->the_operator == NO_OP && last_was_quoted) || term->type == TERM_STRING)
            goto out;

          if (term->the_operator == NO_OP)
            g_string_append (family_string, " ");
          else
            g_string_append (family_string, ", ");
        }
      else
        {
          if (term->the_operator != NO_OP)
            goto out;
        }

      g_string_append (family_string, term->content.str->stryng->str);

      term = term->next;
    }

  result = TRUE;

 out:
  if (result)
    {
      *family = g_string_free (family_string, FALSE);
      return TRUE;
    }
  else
    {
      *family = g_string_free (family_string, TRUE);
      return FALSE;
    }
}

/* In points */
static int font_sizes[] = {
  6 * 1024,   /* xx-small */
  8 * 1024,   /* x-small */
  10 * 1024,  /* small */
  12 * 1024,  /* medium */
  16 * 1024,  /* large */
  20 * 1024,  /* x-large */
  24 * 1024,  /* xx-large */
};

static gboolean
font_size_from_term (StThemeNode *node,
                     CRTerm      *term,
                     double      *size)
{
  if (term->type == TERM_IDENT)
    {
      double resolution = clutter_backend_get_resolution (clutter_get_default_backend ());
      /* We work in integers to avoid double comparisons when converting back
       * from a size in pixels to a logical size.
       */
      int size_points = (int)(0.5 + *size * (72. / resolution));

      if (strcmp (term->content.str->stryng->str, "xx-small") == 0)
        size_points = font_sizes[0];
      else if (strcmp (term->content.str->stryng->str, "x-small") == 0)
        size_points = font_sizes[1];
      else if (strcmp (term->content.str->stryng->str, "small") == 0)
        size_points = font_sizes[2];
      else if (strcmp (term->content.str->stryng->str, "medium") == 0)
        size_points = font_sizes[3];
      else if (strcmp (term->content.str->stryng->str, "large") == 0)
        size_points = font_sizes[4];
      else if (strcmp (term->content.str->stryng->str, "x-large") == 0)
        size_points = font_sizes[5];
      else if (strcmp (term->content.str->stryng->str, "xx-large") == 0)
        size_points = font_sizes[6];
      else if (strcmp (term->content.str->stryng->str, "smaller") == 0)
        {
          /* Find the standard size equal to or smaller than the current size */
          int i = 0;

          while (i <= 6 && font_sizes[i] < size_points)
            i++;

          if (i > 6)
            {
              /* original size greater than any standard size */
              size_points = (int)(0.5 + size_points / 1.2);
            }
          else
            {
              /* Go one smaller than that, if possible */
              if (i > 0)
                i--;

              size_points = font_sizes[i];
            }
        }
      else if (strcmp (term->content.str->stryng->str, "larger") == 0)
        {
          /* Find the standard size equal to or larger than the current size */
          int i = 6;

          while (i >= 0 && font_sizes[i] > size_points)
            i--;

          if (i < 0) /* original size smaller than any standard size */
            i = 0;

          /* Go one larger than that, if possible */
          if (i < 6)
            i++;

          size_points = font_sizes[i];
        }
      else
        {
          return FALSE;
        }

      *size = size_points * (resolution / 72.);
      return TRUE;

    }
  else if (term->type == TERM_NUMBER && term->content.num->type == NUM_PERCENTAGE)
    {
      *size *= term->content.num->val / 100.;
      return TRUE;
    }
  else if (get_length_from_term (node, term, TRUE, size) == VALUE_FOUND)
    {
      /* Convert from pixels to Pango units */
      *size *= 1024;
      return TRUE;
    }

  return FALSE;
}

static gboolean
font_weight_from_term (CRTerm      *term,
                       PangoWeight *weight,
                       gboolean    *weight_absolute)
{
  if (term->type == TERM_NUMBER)
    {
      int weight_int;

      /* The spec only allows numeric weights from 100-900, though Pango
       * will handle any number. We just let anything through.
       */
      if (term->content.num->type != NUM_GENERIC)
        return FALSE;

      weight_int = (int)(0.5 + term->content.num->val);

      *weight = weight_int;
      *weight_absolute = TRUE;

    }
  else if (term->type == TERM_IDENT)
    {
      /* FIXME: handle INHERIT */

      if (strcmp (term->content.str->stryng->str, "bold") == 0)
        {
          *weight = PANGO_WEIGHT_BOLD;
          *weight_absolute = TRUE;
        }
      else if (strcmp (term->content.str->stryng->str, "normal") == 0)
        {
          *weight = PANGO_WEIGHT_NORMAL;
          *weight_absolute = TRUE;
        }
      else if (strcmp (term->content.str->stryng->str, "bolder") == 0)
        {
          *weight = PANGO_WEIGHT_BOLD;
          *weight_absolute = FALSE;
        }
      else if (strcmp (term->content.str->stryng->str, "lighter") == 0)
        {
          *weight = PANGO_WEIGHT_LIGHT;
          *weight_absolute = FALSE;
        }
      else
        {
          return FALSE;
        }

    }
  else
    {
      return FALSE;
    }

  return TRUE;
}

static gboolean
font_style_from_term (CRTerm     *term,
                      PangoStyle *style)
{
  if (term->type != TERM_IDENT)
    return FALSE;

  /* FIXME: handle INHERIT */

  if (strcmp (term->content.str->stryng->str, "normal") == 0)
    *style = PANGO_STYLE_NORMAL;
  else if (strcmp (term->content.str->stryng->str, "oblique") == 0)
    *style = PANGO_STYLE_OBLIQUE;
  else if (strcmp (term->content.str->stryng->str, "italic") == 0)
    *style = PANGO_STYLE_ITALIC;
  else
    return FALSE;

  return TRUE;
}

static gboolean
font_variant_from_term (CRTerm       *term,
                        PangoVariant *variant)
{
  if (term->type != TERM_IDENT)
    return FALSE;

  /* FIXME: handle INHERIT */

  if (strcmp (term->content.str->stryng->str, "normal") == 0)
    *variant = PANGO_VARIANT_NORMAL;
  else if (strcmp (term->content.str->stryng->str, "small-caps") == 0)
    *variant = PANGO_VARIANT_SMALL_CAPS;
  else
    return FALSE;

  return TRUE;
}

const PangoFontDescription *
st_theme_node_get_font (StThemeNode *node)
{
  /* Initialized despite _set flags to suppress compiler warnings */
  PangoStyle font_style = PANGO_STYLE_NORMAL;
  gboolean font_style_set = FALSE;
  PangoVariant variant = PANGO_VARIANT_NORMAL;
  gboolean variant_set = FALSE;
  PangoWeight weight = PANGO_WEIGHT_NORMAL;
  gboolean weight_absolute = TRUE;
  gboolean weight_set = FALSE;
  double size = 0.;
  gboolean size_set = FALSE;

  char *family = NULL;
  double parent_size;
  int i;

  if (node->font_desc)
    return node->font_desc;

  node->font_desc = pango_font_description_copy (get_parent_font (node));
  parent_size = pango_font_description_get_size (node->font_desc);
  if (!pango_font_description_get_size_is_absolute (node->font_desc))
    {
      double resolution = clutter_backend_get_resolution (clutter_get_default_backend ());
      parent_size *= (resolution / 72.);
    }

  ensure_properties (node);

  for (i = 0; i < node->n_properties; i++)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp (decl->property->stryng->str, "font") == 0)
        {
          PangoStyle tmp_style = PANGO_STYLE_NORMAL;
          PangoVariant tmp_variant = PANGO_VARIANT_NORMAL;
          PangoWeight tmp_weight = PANGO_WEIGHT_NORMAL;
          gboolean tmp_weight_absolute = TRUE;
          double tmp_size;
          CRTerm *term = decl->value;

          /* A font specification starts with node/variant/weight
           * in any order. Each is allowed to be specified only once,
           * but we don't enforce that.
           */
          for (; term; term = term->next)
            {
              if (font_style_from_term (term, &tmp_style))
                continue;
              if (font_variant_from_term (term, &tmp_variant))
                continue;
              if (font_weight_from_term (term, &tmp_weight, &tmp_weight_absolute))
                continue;

              break;
            }

          /* The size is mandatory */

          if (term == NULL || term->type != TERM_NUMBER)
            {
              g_warning ("Size missing from font property");
              continue;
            }

          tmp_size = parent_size;
          if (!font_size_from_term (node, term, &tmp_size))
            {
              g_warning ("Couldn't parse size in font property");
              continue;
            }

          term = term->next;

          if (term != NULL && term->type && TERM_NUMBER && term->the_operator == DIVIDE)
            {
              /* Ignore line-height specification */
              term = term->next;
            }

          /* the font family is mandatory - it is a comma-separated list of
           * names.
           */
          if (!font_family_from_terms (term, &family))
            {
              g_warning ("Couldn't parse family in font property");
              continue;
            }

          font_style = tmp_style;
          font_style_set = TRUE;
          weight = tmp_weight;
          weight_absolute = tmp_weight_absolute;
          weight_set = TRUE;
          variant = tmp_variant;
          variant_set = TRUE;

          size = tmp_size;
          size_set = TRUE;

        }
      else if (strcmp (decl->property->stryng->str, "font-family") == 0)
        {
          if (!font_family_from_terms (decl->value, &family))
            {
              g_warning ("Couldn't parse family in font property");
              continue;
            }
        }
      else if (strcmp (decl->property->stryng->str, "font-weight") == 0)
        {
          if (decl->value == NULL || decl->value->next != NULL)
            continue;

          if (font_weight_from_term (decl->value, &weight, &weight_absolute))
            weight_set = TRUE;
        }
      else if (strcmp (decl->property->stryng->str, "font-style") == 0)
        {
          if (decl->value == NULL || decl->value->next != NULL)
            continue;

          if (font_style_from_term (decl->value, &font_style))
            font_style_set = TRUE;
        }
      else if (strcmp (decl->property->stryng->str, "font-variant") == 0)
        {
          if (decl->value == NULL || decl->value->next != NULL)
            continue;

          if (font_variant_from_term (decl->value, &variant))
            variant_set = TRUE;
        }
      else if (strcmp (decl->property->stryng->str, "font-size") == 0)
        {
          gdouble tmp_size;
          if (decl->value == NULL || decl->value->next != NULL)
            continue;

          tmp_size = parent_size;
          if (font_size_from_term (node, decl->value, &tmp_size))
            {
              size = tmp_size;
              size_set = TRUE;
            }
        }
    }

  if (family)
    {
      pango_font_description_set_family (node->font_desc, family);
      g_free (family);
    }

  if (size_set)
    pango_font_description_set_absolute_size (node->font_desc, size);

  if (weight_set)
    {
      if (!weight_absolute)
        {
          /* bolder/lighter are supposed to switch between available styles, but with
           * font substitution, that gets to be a pretty fuzzy concept. So we use
           * a fixed step of 200. (The spec says 100, but that might not take us from
           * normal to bold.
           */

          PangoWeight old_weight = pango_font_description_get_weight (node->font_desc);
          if (weight == PANGO_WEIGHT_BOLD)
            weight = old_weight + 200;
          else
            weight = old_weight - 200;

          if (weight < 100)
            weight = 100;
          if (weight > 900)
            weight = 900;
        }

      pango_font_description_set_weight (node->font_desc, weight);
    }

  if (font_style_set)
    pango_font_description_set_style (node->font_desc, font_style);
  if (variant_set)
    pango_font_description_set_variant (node->font_desc, variant);

  return node->font_desc;
}

/**
 * st_theme_node_get_border_image:
 * @node: a #StThemeNode
 *
 * Gets the value for the border-image style property
 *
 * Return value: (transfer none): the border image, or %NULL
 *   if there is no border image.
 */
StBorderImage *
st_theme_node_get_border_image (StThemeNode *node)
{
  int i, scale_factor;

  if (node->border_image_computed)
    return node->border_image;

  scale_factor = 1;

  g_object_get (node->context, "scale-factor", &scale_factor, NULL);

  node->border_image = NULL;
  node->border_image_computed = TRUE;

  ensure_properties (node);

  for (i = node->n_properties - 1; i >= 0; i--)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp (decl->property->stryng->str, "border-image") == 0)
        {
          CRTerm *term = decl->value;
          CRStyleSheet *base_stylesheet;
          int borders[4];
          int n_borders = 0;
          int j;

          const char *url;
          int border_top;
          int border_right;
          int border_bottom;
          int border_left;

          char *filename;

          /* Support border-image: none; to suppress a previously specified border image */
          if (term_is_none (term))
            {
              if (term->next == NULL)
                return NULL;
              else
                goto next_property;
            }

          /* First term must be the URL to the image */
          if (term->type != TERM_URI)
            goto next_property;

          url = term->content.str->stryng->str;

          term = term->next;

          /* Followed by 0 to 4 numbers or percentages. *Not lengths*. The interpretation
           * of a number is supposed to be pixels if the image is pixel based, otherwise CSS pixels.
           */
          for (j = 0; j < 4; j++)
            {
              if (term == NULL)
                break;

              if (term->type != TERM_NUMBER)
                goto next_property;

              if (term->content.num->type == NUM_GENERIC)
                {

                  borders[n_borders] = (int)(0.5 + term->content.num->val) * scale_factor;
                  n_borders++;
                }
              else if (term->content.num->type == NUM_PERCENTAGE)
                {
                  /* This would be easiest to support if we moved image handling into StBorderImage */
                  g_warning ("Percentages not supported for border-image");
                  goto next_property;
                }
              else
                goto next_property;

              term = term->next;
            }

          switch (n_borders)
            {
            case 0:
              border_top = border_right = border_bottom = border_left = 0;
              break;
            case 1:
              border_top = border_right = border_bottom = border_left = borders[0];
              break;
            case 2:
              border_top = border_bottom = borders[0];
              border_left = border_right = borders[1];
              break;
            case 3:
              border_top = borders[0];
              border_left = border_right = borders[1];
              border_bottom = borders[2];
              break;
            case 4:
            default:
              border_top = borders[0];
              border_right = borders[1];
              border_bottom = borders[2];
              border_left = borders[3];
              break;
            }

          if (decl->parent_statement != NULL)
            base_stylesheet = decl->parent_statement->parent_sheet;
          else
            base_stylesheet = NULL;

          filename = _st_theme_resolve_url (node->theme, base_stylesheet, url);
          if (filename == NULL)
            goto next_property;

          node->border_image = st_border_image_new (filename,
                                                    border_top, border_right, border_bottom, border_left);

          g_free (filename);

          return node->border_image;
        }

    next_property:
      ;
    }

  return NULL;
}

/**
 * st_theme_node_get_horizontal_padding:
 * @node: a #StThemeNode
 *
 * Gets the total horizonal padding (left + right padding)
 *
 * Return value: the total horizonal padding
 *   in pixels
 */
double
st_theme_node_get_horizontal_padding (StThemeNode *node)
{
  double padding = 0.0;
  padding += st_theme_node_get_padding (node, ST_SIDE_LEFT);
  padding += st_theme_node_get_padding (node, ST_SIDE_RIGHT);

  return padding;
}

/**
 * st_theme_node_get_vertical_padding:
 * @node: a #StThemeNode
 *
 * Gets the total vertical padding (top + bottom padding)
 *
 * Return value: the total vertical padding
 *   in pixels
 */
double
st_theme_node_get_vertical_padding (StThemeNode *node)
{
  double padding = 0.0;
  padding += st_theme_node_get_padding (node, ST_SIDE_TOP);
  padding += st_theme_node_get_padding (node, ST_SIDE_BOTTOM);

  return padding;
}

void
_st_theme_node_apply_margins (StThemeNode *node,
                              ClutterActor *actor)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));

  _st_theme_node_ensure_geometry (node);

  clutter_actor_set_margin_left (actor, st_theme_node_get_margin(node, ST_SIDE_LEFT));
  clutter_actor_set_margin_right (actor, st_theme_node_get_margin(node, ST_SIDE_RIGHT));
  clutter_actor_set_margin_top (actor, st_theme_node_get_margin(node, ST_SIDE_TOP));
  clutter_actor_set_margin_bottom (actor, st_theme_node_get_margin(node, ST_SIDE_BOTTOM));
}


static GetFromTermResult
parse_shadow_property (StThemeNode       *node,
                       CRDeclaration     *decl,
                       ClutterColor      *color,
                       gdouble           *xoffset,
                       gdouble           *yoffset,
                       gdouble           *blur,
                       gdouble           *spread,
                       gboolean          *inset)
{
  GetFromTermResult result;
  CRTerm *term;
  int n_offsets = 0;

  /* default values */
  color->red = 0x0; color->green = 0x0; color->blue = 0x0; color->alpha = 0xff;
  *xoffset = 0.;
  *yoffset = 0.;
  *blur = 0.;
  *spread = 0.;
  *inset = FALSE;

  /* The CSS3 draft of the box-shadow property[0] is a lot stricter
   * regarding the order of terms:
   * If the 'inset' keyword is specified, it has to be first or last,
   * and the color may not be mixed with the lengths; while we parse
   * length values in the correct order, we allow for arbitrary
   * placement of the color and 'inset' keyword.
   *
   * [0] http://www.w3.org/TR/css3-background/#box-shadow
   */
  for (term = decl->value; term; term = term->next)
    {
      if (term->type == TERM_NUMBER)
        {
          gdouble value;
          gdouble multiplier;

          multiplier = (term->unary_op == MINUS_UOP) ? -1. : 1.;
          result = get_length_from_term (node, term, FALSE, &value);

          if (result == VALUE_INHERIT)
            {
              /* we only allow inherit on the line by itself */
              if (n_offsets > 0)
                return VALUE_NOT_FOUND;
              else
                return VALUE_INHERIT;
            }
          else if (result == VALUE_FOUND)
            {
              switch (n_offsets++)
                {
                case 0:
                  *xoffset = multiplier * value;
                  break;
                case 1:
                  *yoffset = multiplier * value;
                  break;
                case 2:
                  if (multiplier < 0)
                      g_warning ("Negative blur values are "
                                 "not allowed");
                  *blur = value;
                  break;
                case 3:
                  if (multiplier < 0)
                      g_warning ("Negative spread values are "
                                 "not allowed");
                  *spread = value;
                  break;
                }
              continue;
            }
        }
      else if (term->type == TERM_IDENT &&
               strcmp (term->content.str->stryng->str, "inset") == 0)
        {
          *inset = TRUE;
          continue;
        }

      result = get_color_from_term (node, term, color);

      if (result == VALUE_INHERIT)
        {
          if (n_offsets > 0)
            return VALUE_NOT_FOUND;
          else
            return VALUE_INHERIT;
        }
      else if (result == VALUE_FOUND)
        {
          continue;
        }
    }

  /* The only required terms are the x and y offsets
   */
  if (n_offsets >= 2)
    return VALUE_FOUND;
  else
    return VALUE_NOT_FOUND;
}

/**
 * st_theme_node_lookup_shadow:
 * @node: a #StThemeNode
 * @property_name: The name of the shadow property
 * @inherit: if %TRUE, if a value is not found for the property on the
 *   node, then it will be looked up on the parent node, and then on the
 *   parent's parent, and so forth. Note that if the property has a
 *   value of 'inherit' it will be inherited even if %FALSE is passed
 *   in for @inherit; this only affects the default behavior for inheritance.
 * @shadow: (out): location to store the shadow
 *
 * If the property is not found, the value in the shadow variable will not
 * be changed.
 *
 * Generically looks up a property containing a set of shadow values. When
 * specific getters (like st_theme_node_get_box_shadow ()) exist, they
 * should be used instead. They are cached, so more efficient, and have
 * handling for shortcut properties and other details of CSS.
 *
 * See also st_theme_node_get_shadow(), which provides a simpler API.
 *
 * Return value: %TRUE if the property was found in the properties for this
 *  theme node (or in the properties of parent nodes when inheriting.)
 */
gboolean
st_theme_node_lookup_shadow (StThemeNode  *node,
                             const char   *property_name,
                             gboolean      inherit,
                             StShadow    **shadow)
{
  ClutterColor color = { 0., };
  gdouble xoffset = 0.;
  gdouble yoffset = 0.;
  gdouble blur = 0.;
  gdouble spread = 0.;
  gboolean inset = FALSE;

  int i;

  ensure_properties (node);

  for (i = node->n_properties - 1; i >= 0; i--)
    {
      CRDeclaration *decl = node->properties[i];

      if (strcmp (decl->property->stryng->str, property_name) == 0)
        {
          GetFromTermResult result = parse_shadow_property (node,
                                                            decl,
                                                            &color,
                                                            &xoffset,
                                                            &yoffset,
                                                            &blur,
                                                            &spread,
                                                            &inset);
          if (result == VALUE_FOUND)
            {
              *shadow = st_shadow_new (&color,
                                       xoffset, yoffset,
                                       blur, spread,
                                       inset);
              return TRUE;
            }
          else if (result == VALUE_INHERIT)
            {
              if (node->parent_node)
                return st_theme_node_lookup_shadow (node->parent_node,
                                                    property_name,
                                                    inherit,
                                                    shadow);
              else
                break;
            }
        }
    }

    if (inherit && node->parent_node)
      return st_theme_node_lookup_shadow (node->parent_node,
                                          property_name,
                                          inherit,
                                          shadow);

  return FALSE;
}

/**
 * st_theme_node_get_shadow:
 * @node: a #StThemeNode
 * @property_name: The name of the shadow property
 *
 * Generically looks up a property containing a set of shadow values. When
 * specific getters (like st_theme_node_get_box_shadow()) exist, they
 * should be used instead. They are cached, so more efficient, and have
 * handling for shortcut properties and other details of CSS.
 *
 * Like st_theme_get_length(), this does not print a warning if the property is
 * not found; it just returns %NULL
 *
 * See also st_theme_node_lookup_shadow (), which provides more options.
 *
 * Return value: (transfer full): the shadow, or %NULL if the property was not found.
 */
StShadow *
st_theme_node_get_shadow (StThemeNode  *node,
                          const char   *property_name)
{
  StShadow *shadow;

  if (st_theme_node_lookup_shadow (node, property_name, FALSE, &shadow))
    return shadow;
  else
    return NULL;
}

/**
 * st_theme_node_get_box_shadow:
 * @node: a #StThemeNode
 *
 * Gets the value for the box-shadow style property
 *
 * Return value: (transfer none): the node's shadow, or %NULL
 *   if node has no shadow
 */
StShadow *
st_theme_node_get_box_shadow (StThemeNode *node)
{
  StShadow *shadow;

  if (node->box_shadow_computed)
    return node->box_shadow;

  node->box_shadow = NULL;
  node->box_shadow_computed = TRUE;

  if (st_theme_node_lookup_shadow (node,
                                   "box-shadow",
                                   FALSE,
                                   &shadow))
    {
      node->box_shadow = shadow;

      return node->box_shadow;
    }

  return NULL;
}

/**
 * st_theme_node_get_background_image_shadow:
 * @node: a #StThemeNode
 *
 * Gets the value for the -st-background-image-shadow style property
 *
 * Return value: (transfer none): the node's background image shadow, or %NULL
 *   if node has no such shadow
 */
StShadow *
st_theme_node_get_background_image_shadow (StThemeNode *node)
{
  StShadow *shadow;

  if (node->background_image_shadow_computed)
    return node->background_image_shadow;

  node->background_image_shadow = NULL;
  node->background_image_shadow_computed = TRUE;

  if (st_theme_node_lookup_shadow (node,
                                   "-st-background-image-shadow",
                                   FALSE,
                                   &shadow))
    {
      if (shadow->inset)
        {
          g_warning ("The -st-background-image-shadow property does not "
                     "support inset shadows");
          st_shadow_unref (shadow);
          shadow = NULL;
        }

      node->background_image_shadow = shadow;

      return node->background_image_shadow;
    }

  return NULL;
}

/**
 * st_theme_node_get_text_shadow:
 * @node: a #StThemeNode
 *
 * Gets the value for the text-shadow style property
 *
 * Return value: (transfer none): the node's text-shadow, or %NULL
 *   if node has no text-shadow
 */
StShadow *
st_theme_node_get_text_shadow (StThemeNode *node)
{
  StShadow *result = NULL;

  if (node->text_shadow_computed)
    return node->text_shadow;

  ensure_properties (node);

  if (!st_theme_node_lookup_shadow (node,
                                    "text-shadow",
                                    FALSE,
                                    &result))
    {
      if (node->parent_node)
        {
          result = st_theme_node_get_text_shadow (node->parent_node);
          if (result)
            st_shadow_ref (result);
        }
    }

  if (result && result->inset)
    {
      g_warning ("The text-shadow property does not support inset shadows");
      st_shadow_unref (result);
      result = NULL;
    }

  node->text_shadow = result;
  node->text_shadow_computed = TRUE;

  return result;
}

/**
 * st_theme_node_get_icon_colors:
 * @node: a #StThemeNode
 *
 * Gets the colors that should be used for colorizing symbolic icons according
 * the style of this node.
 *
 * Return value: (transfer none): the icon colors to use for this theme node
 */
StIconColors *
st_theme_node_get_icon_colors (StThemeNode *node)
{
  /* Foreground here will always be the same as st_theme_node_get_foreground_color(),
   * but there's a loss of symmetry and little efficiency win if we try to exploit
   * that. */

  enum {
    FOREGROUND = 1 << 0,
    WARNING = 1 << 1,
    ERROR = 1 << 2,
    SUCCESS = 1 << 3
  };

  gboolean shared_with_parent;
  int i;
  ClutterColor color = { 0, };

  guint still_need = FOREGROUND | WARNING | ERROR | SUCCESS;

  g_return_val_if_fail (ST_IS_THEME_NODE (node), NULL);

  if (node->icon_colors)
    return node->icon_colors;

  if (node->parent_node)
    {
      node->icon_colors = st_theme_node_get_icon_colors (node->parent_node);
      shared_with_parent = TRUE;
    }
  else
    {
      node->icon_colors = st_icon_colors_new ();
      node->icon_colors->foreground = BLACK_COLOR;
      node->icon_colors->warning = DEFAULT_WARNING_COLOR;
      node->icon_colors->error = DEFAULT_ERROR_COLOR;
      node->icon_colors->success = DEFAULT_SUCCESS_COLOR;
      shared_with_parent = FALSE;
    }

  ensure_properties (node);

  for (i = node->n_properties - 1; i >= 0 && still_need != 0; i--)
    {
      CRDeclaration *decl = node->properties[i];
      GetFromTermResult result = VALUE_NOT_FOUND;
      guint found = 0;

      if ((still_need & FOREGROUND) != 0 &&
          strcmp (decl->property->stryng->str, "color") == 0)
        {
          found = FOREGROUND;
          result = get_color_from_term (node, decl->value, &color);
        }
      else if ((still_need & WARNING) != 0 &&
               strcmp (decl->property->stryng->str, "warning-color") == 0)
        {
          found = WARNING;
          result = get_color_from_term (node, decl->value, &color);
        }
      else if ((still_need & ERROR) != 0 &&
               strcmp (decl->property->stryng->str, "error-color") == 0)
        {
          found = ERROR;
          result = get_color_from_term (node, decl->value, &color);
        }
      else if ((still_need & SUCCESS) != 0 &&
               strcmp (decl->property->stryng->str, "success-color") == 0)
        {
          found = SUCCESS;
          result = get_color_from_term (node, decl->value, &color);
        }

      if (result == VALUE_INHERIT)
        {
          still_need &= ~found;
        }
      else if (result == VALUE_FOUND)
        {
          still_need &= ~found;
          if (shared_with_parent)
            {
              node->icon_colors = st_icon_colors_copy (node->icon_colors);
              shared_with_parent = FALSE;
            }

          switch (found)
            {
            case FOREGROUND:
              node->icon_colors->foreground = color;
              break;
            case WARNING:
              node->icon_colors->warning = color;
              break;
            case ERROR:
              node->icon_colors->error = color;
              break;
            case SUCCESS:
              node->icon_colors->success = color;
              break;
            }
        }
    }

  if (shared_with_parent)
    st_icon_colors_ref (node->icon_colors);

  return node->icon_colors;
}

static float
get_width_inc (StThemeNode *node)
{
  return ((int)(0.5 + node->border_width[ST_SIDE_LEFT]) + node->padding[ST_SIDE_LEFT] +
          (int)(0.5 + node->border_width[ST_SIDE_RIGHT]) + node->padding[ST_SIDE_RIGHT]);
}

static float
get_height_inc (StThemeNode *node)
{
  return ((int)(0.5 + node->border_width[ST_SIDE_TOP]) + node->padding[ST_SIDE_TOP] +
          (int)(0.5 + node->border_width[ST_SIDE_BOTTOM]) + node->padding[ST_SIDE_BOTTOM]);
}

/**
 * st_theme_node_adjust_for_height:
 * @node: a #StThemeNode
 * @for_height: (inout): the "for height" to adjust
 *
 * Adjusts a "for height" passed to clutter_actor_get_preferred_width() to
 * account for borders and padding. This is a convenience function meant
 * to be called from a get_preferred_width() method of a #ClutterActor
 * subclass. The value after adjustment is the height available for the actor's
 * content.
 */
void
st_theme_node_adjust_for_height (StThemeNode  *node,
                                 float        *for_height)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));
  g_return_if_fail (for_height != NULL);

  if (*for_height >= 0)
    {
      float height_inc = get_height_inc (node);
      *for_height = MAX (0, *for_height - height_inc);
    }
}

/**
 * st_theme_node_adjust_preferred_width:
 * @node: a #StThemeNode
 * @min_width_p: (inout) (allow-none): the minimum width to adjust
 * @natural_width_p: (inout): the natural width to adjust
 *
 * Adjusts the minimum and natural width computed for an actor by
 * adding on the necessary space for borders and padding and taking
 * into account any minimum or maximum width. This is a convenience
 * function meant to be called from the get_preferred_width() method
 * of a #ClutterActor subclass
 */
void
st_theme_node_adjust_preferred_width (StThemeNode  *node,
                                      float        *min_width_p,
                                      float        *natural_width_p)
{
  float width_inc;

  g_return_if_fail (ST_IS_THEME_NODE (node));

  _st_theme_node_ensure_geometry (node);

  width_inc = get_width_inc (node);

  if (min_width_p)
    {
      if (node->min_width != -1)
        *min_width_p = node->min_width;
      *min_width_p += width_inc;
    }

  if (natural_width_p)
    {
      if (node->width != -1)
        *natural_width_p = node->width;
      if (node->max_width != -1)
        *natural_width_p = MIN (*natural_width_p, node->max_width);
      *natural_width_p += width_inc;
    }
}

/**
 * st_theme_node_adjust_for_width:
 * @node: a #StThemeNode
 * @for_width: (inout): the "for width" to adjust
 *
 * Adjusts a "for width" passed to clutter_actor_get_preferred_height() to
 * account for borders and padding. This is a convenience function meant
 * to be called from a get_preferred_height() method of a #ClutterActor
 * subclass. The value after adjustment is the width available for the actor's
 * content.
 */
void
st_theme_node_adjust_for_width (StThemeNode  *node,
                                float        *for_width)
{
  g_return_if_fail (ST_IS_THEME_NODE (node));
  g_return_if_fail (for_width != NULL);

  if (*for_width >= 0)
    {
      float width_inc = get_width_inc (node);
      *for_width = MAX (0, *for_width - width_inc);
    }
}

/**
 * st_theme_node_adjust_preferred_height:
 * @node: a #StThemeNode
 * @min_height_p: (inout) (allow-none): the minimum height to adjust
 * @natural_height_p: (inout): the natural height to adjust
 *
 * Adjusts the minimum and natural height computed for an actor by
 * adding on the necessary space for borders and padding and taking
 * into account any minimum or maximum height. This is a convenience
 * function meant to be called from the get_preferred_height() method
 * of a #ClutterActor subclass
 */
void
st_theme_node_adjust_preferred_height (StThemeNode  *node,
                                       float           *min_height_p,
                                       float           *natural_height_p)
{
  float height_inc;

  g_return_if_fail (ST_IS_THEME_NODE (node));

  _st_theme_node_ensure_geometry (node);

  height_inc = get_height_inc (node);

  if (min_height_p)
    {
      if (node->min_height != -1)
        *min_height_p = node->min_height;
      *min_height_p += height_inc;
    }
  if (natural_height_p)
    {
      if (node->height != -1)
        *natural_height_p = node->height;
      if (node->max_height != -1)
        *natural_height_p = MIN (*natural_height_p, node->max_height);
      *natural_height_p += height_inc;
    }
}

/**
 * st_theme_node_get_content_box:
 * @node: a #StThemeNode
 * @allocation: the box allocated to a #ClutterAlctor
 * @content_box: (out caller-allocates): computed box occupied by the actor's content
 *
 * Gets the box within an actor's allocation that contents the content
 * of an actor (excluding borders and padding). This is a convenience function
 * meant to be used from the allocate() or paint() methods of a #ClutterActor
 * subclass.
 */
void
st_theme_node_get_content_box (StThemeNode           *node,
                               const ClutterActorBox *allocation,
                               ClutterActorBox       *content_box)
{
  double noncontent_left, noncontent_top, noncontent_right, noncontent_bottom;
  double avail_width, avail_height, content_width, content_height;

  g_return_if_fail (ST_IS_THEME_NODE (node));

  _st_theme_node_ensure_geometry (node);

  avail_width = allocation->x2 - allocation->x1;
  avail_height = allocation->y2 - allocation->y1;

  noncontent_left = node->border_width[ST_SIDE_LEFT] + node->padding[ST_SIDE_LEFT];
  noncontent_top = node->border_width[ST_SIDE_TOP] + node->padding[ST_SIDE_TOP];
  noncontent_right = node->border_width[ST_SIDE_RIGHT] + node->padding[ST_SIDE_RIGHT];
  noncontent_bottom = node->border_width[ST_SIDE_BOTTOM] + node->padding[ST_SIDE_BOTTOM];

  content_box->x1 = (int)(0.5 + noncontent_left);
  content_box->y1 = (int)(0.5 + noncontent_top);

  content_width = avail_width - noncontent_left - noncontent_right;
  if (content_width < 0)
    content_width = 0;
  content_height = avail_height - noncontent_top - noncontent_bottom;
  if (content_height < 0)
    content_height = 0;

  content_box->x2 = (int)(0.5 + content_box->x1 + content_width);
  content_box->y2 = (int)(0.5 + content_box->y1 + content_height);
}

/**
 * st_theme_node_get_background_paint_box:
 * @node: a #StThemeNode
 * @allocation: the box allocated to a #ClutterActor
 * @paint_box: (out caller-allocates): computed box occupied when painting the actor's background
 *
 * Gets the box used to paint the actor's background, including the area
 * occupied by properties which paint outside the actor's assigned allocation.
 */
void
st_theme_node_get_background_paint_box (StThemeNode           *node,
                                        const ClutterActorBox *actor_box,
                                        ClutterActorBox       *paint_box)
{
  StShadow *background_image_shadow;
  ClutterActorBox shadow_box;

  g_return_if_fail (ST_IS_THEME_NODE (node));
  g_return_if_fail (actor_box != NULL);
  g_return_if_fail (paint_box != NULL);

  background_image_shadow = st_theme_node_get_background_image_shadow (node);

  *paint_box = *actor_box;

  if (!background_image_shadow)
    return;

  st_shadow_get_box (background_image_shadow, actor_box, &shadow_box);

  paint_box->x1 = MIN (paint_box->x1, shadow_box.x1);
  paint_box->x2 = MAX (paint_box->x2, shadow_box.x2);
  paint_box->y1 = MIN (paint_box->y1, shadow_box.y1);
  paint_box->y2 = MAX (paint_box->y2, shadow_box.y2);
}

/**
 * st_theme_node_get_paint_box:
 * @node: a #StThemeNode
 * @allocation: the box allocated to a #ClutterActor
 * @paint_box: (out caller-allocates): computed box occupied when painting the actor
 *
 * Gets the box used to paint the actor, including the area occupied
 * by properties which paint outside the actor's assigned allocation.
 * When painting @node to an offscreen buffer, this function can be
 * used to determine the necessary size of the buffer.
 */
void
st_theme_node_get_paint_box (StThemeNode           *node,
                             const ClutterActorBox *actor_box,
                             ClutterActorBox       *paint_box)
{
  StShadow *box_shadow;
  ClutterActorBox shadow_box;
  int outline_width;

  g_return_if_fail (ST_IS_THEME_NODE (node));
  g_return_if_fail (actor_box != NULL);
  g_return_if_fail (paint_box != NULL);

  box_shadow = st_theme_node_get_box_shadow (node);
  outline_width = st_theme_node_get_outline_width (node);

  st_theme_node_get_background_paint_box (node, actor_box, paint_box);

  if (!box_shadow && !outline_width)
    return;

  paint_box->x1 -= outline_width;
  paint_box->x2 += outline_width;
  paint_box->y1 -= outline_width;
  paint_box->y2 += outline_width;

  if (box_shadow)
    {
      st_shadow_get_box (box_shadow, actor_box, &shadow_box);

      paint_box->x1 = MIN (paint_box->x1, shadow_box.x1);
      paint_box->x2 = MAX (paint_box->x2, shadow_box.x2);
      paint_box->y1 = MIN (paint_box->y1, shadow_box.y1);
      paint_box->y2 = MAX (paint_box->y2, shadow_box.y2);
    }
}

/**
 * st_theme_node_geometry_equal:
 * @node: a #StThemeNode
 * @other: a different #StThemeNode
 *
 * Tests if two theme nodes have the same borders and padding; this can be
 * used to optimize having to relayout when the style applied to a Clutter
 * actor changes colors without changing the geometry.
 */
gboolean
st_theme_node_geometry_equal (StThemeNode *node,
                              StThemeNode *other)
{
  StSide side;

  g_return_val_if_fail (ST_IS_THEME_NODE (node), FALSE);

  if (node == other)
     return TRUE;

  g_return_val_if_fail (ST_IS_THEME_NODE (other), FALSE);

  _st_theme_node_ensure_geometry (node);
  _st_theme_node_ensure_geometry (other);

  for (side = ST_SIDE_TOP; side <= ST_SIDE_LEFT; side++)
    {
      if (node->border_width[side] != other->border_width[side])
        return FALSE;
      if (node->padding[side] != other->padding[side])
        return FALSE;
    }

  if (node->width != other->width || node->height != other->height)
    return FALSE;
  if (node->min_width != other->min_width || node->min_height != other->min_height)
    return FALSE;
  if (node->max_width != other->max_width || node->max_height != other->max_height)
    return FALSE;

  return TRUE;
}

/**
 * st_theme_node_paint_equal:
 * @node: a #StThemeNode
 * @other: a different #StThemeNode
 *
 * Check if st_theme_node_paint() will paint identically for @node as it does
 * for @other. Note that in some cases this function may return %TRUE even
 * if there is no visible difference in the painting.
 *
 * Return value: %TRUE if the two theme nodes paint identically. %FALSE if the
 *   two nodes potentially paint differently.
 */
gboolean
st_theme_node_paint_equal (StThemeNode *node,
                           StThemeNode *other)
{
  StBorderImage *border_image, *other_border_image;
  StShadow *shadow, *other_shadow;
  int i;

  g_return_val_if_fail (ST_IS_THEME_NODE (node), FALSE);

  if (node == other)
     return TRUE;

  g_return_val_if_fail (ST_IS_THEME_NODE (other), FALSE);

  _st_theme_node_ensure_background (node);
  _st_theme_node_ensure_background (other);

  if (!clutter_color_equal (&node->background_color, &other->background_color))
    return FALSE;

  if (node->background_gradient_type != other->background_gradient_type)
    return FALSE;

  if (node->background_gradient_type != ST_GRADIENT_NONE &&
      !clutter_color_equal (&node->background_gradient_end, &other->background_gradient_end))
    return FALSE;

  if (g_strcmp0 (node->background_image, other->background_image) != 0)
    return FALSE;

  _st_theme_node_ensure_geometry (node);
  _st_theme_node_ensure_geometry (other);

  for (i = 0; i < 4; i++)
    {
      if (node->border_width[i] != other->border_width[i])
        return FALSE;

      if (node->border_width[i] > 0 &&
          !clutter_color_equal (&node->border_color[i], &other->border_color[i]))
        return FALSE;

      if (node->border_radius[i] != other->border_radius[i])
        return FALSE;
    }

  if (node->outline_width != other->outline_width)
    return FALSE;

  if (node->outline_width > 0 &&
      !clutter_color_equal (&node->outline_color, &other->outline_color))
    return FALSE;

  border_image = st_theme_node_get_border_image (node);
  other_border_image = st_theme_node_get_border_image (other);

  if ((border_image == NULL) != (other_border_image == NULL))
    return FALSE;

  if (border_image != NULL && !st_border_image_equal (border_image, other_border_image))
    return FALSE;

  shadow = st_theme_node_get_box_shadow (node);
  other_shadow = st_theme_node_get_box_shadow (other);

  if ((shadow == NULL) != (other_shadow == NULL))
    return FALSE;

  if (shadow != NULL && !st_shadow_equal (shadow, other_shadow))
    return FALSE;

  shadow = st_theme_node_get_background_image_shadow (node);
  other_shadow = st_theme_node_get_background_image_shadow (other);

  if ((shadow == NULL) != (other_shadow == NULL))
    return FALSE;

  if (shadow != NULL && !st_shadow_equal (shadow, other_shadow))
    return FALSE;

  return TRUE;
}
