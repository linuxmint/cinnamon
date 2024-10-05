
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <float.h>

#include "st-debug.h"
#include "st-widget.h"

static GHashTable *warned_actors = NULL;

static void
remove_finalized_actor_from_warn_list (gpointer  data,
                                       GObject  *old_pointer)
{
  if (!g_hash_table_remove (warned_actors, old_pointer))
    {
      g_critical ("Failed to remove actor %p from warned_actors table", old_pointer);
    }
}

static void
init_coord_rounding (void)
{
  static size_t once_init_value = 0;

  if (g_once_init_enter (&once_init_value))
    {
      warned_actors = g_hash_table_new (g_direct_hash, g_direct_equal);
      g_once_init_leave (&once_init_value, 1);
    }
}

static void
warn_rounding (ClutterActor *actor,
               const gchar *context,
               gfloat       x,
               gfloat       y,
               gfloat       width,
               gfloat       height)
{
  gpointer key = actor != NULL ? (gpointer) actor : (gpointer) context;

  if (!g_hash_table_contains (warned_actors, key))
    {
      g_printerr ("(%s) is using non-integer coordinates: x%0.6f y%0.5f  w%0.5f h%0.5f\n", context, x, y, width, height);
      g_hash_table_add (warned_actors, key);

      if (actor != NULL)
        {
          g_object_weak_ref (G_OBJECT (actor), (GWeakNotify) remove_finalized_actor_from_warn_list, NULL);
        }
    }
}

// FIXME: Still need to learn at what point AA (or whatever) kicks in to achieve fractional positioning.
#define MAX_FLOAT_DIFF .0001

static gboolean
_check_coord_rounding (gfloat       x,
                       gfloat       y,
                       gfloat       width,
                       gfloat       height)
{
  gfloat rx, ry, rw, rh;

  rx = (float) roundf (x);
  ry = (float) roundf (y);
  rw = (float) roundf (width);
  rh = (float) roundf (height);

  if ((fabsf (x - rx)     > MAX_FLOAT_DIFF) || (fabsf (y - ry)      > MAX_FLOAT_DIFF) ||
      (fabsf (width - rw) > MAX_FLOAT_DIFF) || (fabsf (height - rh) > MAX_FLOAT_DIFF))
    {
      return FALSE;
    }

  return TRUE;
}


/**
 * st_debug_check_coord_rounding:
 * @context: a string describing the context of the check
 * @x: An x coordinate
 * @y: A y coordinate
 * @width: A width value
 * @height: A height value
 *
 * Checks the given (float) values and warns if any fall between
 * their closest integer neighbors.
 */
void
st_debug_check_coord_rounding (const gchar *context,
                               gfloat       x,
                               gfloat       y,
                               gfloat       width,
                               gfloat       height)
{
  g_return_if_fail (context != NULL);

  init_coord_rounding ();

  if (!_check_coord_rounding (x, y, width, height))
    {
      warn_rounding (NULL, context, x, y, width, height);
    }
}

/**
 * st_debug_check_actor_coord_rounding:
 * @actor: a #ClutterActor whose position and sizes to check.
 * @context: (nullable): a string describing the context of the check
 *
 * Checks the position and size of the given actor and warns if any
 * fall between their closest integer neighbors.
 *
 * If @context is %NULL, the function will use the style class, style,
 * and pseudo-class of the actor to generate a description.
 */
void
st_debug_check_actor_coord_rounding (ClutterActor *actor,
                                     const gchar  *context)
{
  g_return_if_fail (actor != NULL);

  init_coord_rounding ();

  gfloat fx, fy, fw, fh;
  clutter_actor_get_transformed_position (actor, &fx, &fy);
  clutter_actor_get_transformed_size (actor, &fw, &fh);

  if (!_check_coord_rounding (fx, fy, fw, fh))
    {
      g_autofree gchar *desc = NULL;

      if (context == NULL && ST_IS_WIDGET (actor))
        {
          g_autofree gchar *pseudo_class = NULL;
          g_autofree gchar *inline_style = NULL;
          g_autofree gchar *style_class = NULL;

          g_object_get (actor,
                        "style-class",  &style_class,
                        "style",        &inline_style,
                        "pseudo-class", &pseudo_class,
                        NULL);

          desc = g_strdup_printf ("%p - %s+%s+%s",
                                  actor,
                                  style_class  ? style_class  : "",
                                  inline_style ? inline_style : "",
                                  pseudo_class ? pseudo_class : "");
        }
      else
        {
          desc = g_strdup (context);
        }

      warn_rounding (actor, desc, fx, fy, fw, fh);
    }
}

/**
 * st_debug_clear_coord_rounding_warning:
 * @context: (not nullable): A string originally used in a call to #st_debug_check_coord_rounding
 *
 * Removes the warned state of the given context. If the context was never
 * warned against, this function will do nothing.
 */
void
st_debug_clear_coord_rounding_warning (const gchar *context)
{
  g_hash_table_remove (warned_actors, context);
}
