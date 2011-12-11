/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-shadow.c: Boxed type holding for -st-shadow attributes
 *
 * Copyright 2009, 2010 Florian Müllner
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

#include "config.h"

#include "st-shadow.h"

/**
 * SECTION: st-shadow
 * @short_description: Boxed type for -st-shadow attributes
 *
 * #StShadow is a boxed type for storing attributes of the -st-shadow
 * property, modelled liberally after the CSS3 box-shadow property.
 * See http://www.css3.info/preview/box-shadow/
 *
 */

/**
 * st_shadow_new:
 * @color: shadow's color
 * @xoffset: horizontal offset
 * @yoffset: vertical offset
 * @blur: blur radius
 * @spread: spread radius
 * @inset: whether the shadow should be inset
 *
 * Creates a new #StShadow
 *
 * Returns: the newly allocated shadow. Use st_shadow_free() when done
 */
StShadow *
st_shadow_new (ClutterColor *color,
               gdouble       xoffset,
               gdouble       yoffset,
               gdouble       blur,
               gdouble       spread,
               gboolean      inset)
{
  StShadow *shadow;

  shadow = g_slice_new (StShadow);

  shadow->color     = *color;
  shadow->xoffset   = xoffset;
  shadow->yoffset   = yoffset;
  shadow->blur      = blur;
  shadow->spread    = spread;
  shadow->inset     = inset;
  shadow->ref_count = 1;

  return shadow;
}

/**
 * st_shadow_ref:
 * @shadow: a #StShadow
 *
 * Atomically increments the reference count of @shadow by one.
 *
 * Returns: the passed in #StShadow.
 */
StShadow *
st_shadow_ref (StShadow *shadow)
{
  g_return_val_if_fail (shadow != NULL, NULL);
  g_return_val_if_fail (shadow->ref_count > 0, shadow);

  g_atomic_int_inc (&shadow->ref_count);
  return shadow;
}

/**
 * st_shadow_unref:
 * @shadow: a #StShadow
 *
 * Atomically decrements the reference count of @shadow by one.
 * If the reference count drops to 0, all memory allocated by the
 * #StShadow is released.
 */
void
st_shadow_unref (StShadow *shadow)
{
  g_return_if_fail (shadow != NULL);
  g_return_if_fail (shadow->ref_count > 0);

  if (g_atomic_int_dec_and_test (&shadow->ref_count))
    g_slice_free (StShadow, shadow);
}

/**
 * st_shadow_equal:
 * @shadow: a #StShadow
 * @other: a different #StShadow
 *
 * Check if two shadow objects are identical. Note that two shadows may
 * compare non-identically if they differ only by floating point rounding
 * errors.
 *
 * Return value: %TRUE if the two shadows are identical
 */
gboolean
st_shadow_equal (StShadow *shadow,
                 StShadow *other)
{
  g_return_val_if_fail (shadow != NULL, FALSE);
  g_return_val_if_fail (other != NULL, FALSE);

  /* We use strict equality to compare double quantities; this means
   * that, for example, a shadow offset of 0.25in does not necessarily
   * compare equal to a shadow offset of 18pt in this test. Assume
   * that a few false negatives are mostly harmless.
   */

  return (clutter_color_equal (&shadow->color, &other->color) &&
          shadow->xoffset == other->xoffset &&
          shadow->yoffset == other->yoffset &&
          shadow->blur == other->blur &&
          shadow->spread == other->spread &&
          shadow->inset == other->inset);
}

/**
 * st_shadow_get_box:
 * @shadow: a #StShadow
 * @actor_box: the box allocated to a #ClutterAlctor
 * @shadow_box: computed box occupied by @shadow
 *
 * Gets the box used to paint @shadow, which will be partly
 * outside of @actor_box
 */
void
st_shadow_get_box (StShadow              *shadow,
                   const ClutterActorBox *actor_box,
                   ClutterActorBox       *shadow_box)
{
  g_return_if_fail (shadow != NULL);
  g_return_if_fail (actor_box != NULL);
  g_return_if_fail (shadow_box != NULL);

  /* Inset shadows are drawn below the border, so returning
   * the original box is not actually correct; still, it's
   * good enough for the purpose of determing additional space
   * required outside the actor box.
   */
  if (shadow->inset)
    {
      *shadow_box = *actor_box;
      return;
    }

  shadow_box->x1 = actor_box->x1 + shadow->xoffset
                   - shadow->blur - shadow->spread;
  shadow_box->x2 = actor_box->x2 + shadow->xoffset
                   + shadow->blur + shadow->spread;
  shadow_box->y1 = actor_box->y1 + shadow->yoffset
                   - shadow->blur - shadow->spread;
  shadow_box->y2 = actor_box->y2 + shadow->yoffset
                   + shadow->blur + shadow->spread;
}

GType
st_shadow_get_type (void)
{
  static GType _st_shadow_type = 0;

  if (G_UNLIKELY (_st_shadow_type == 0))
    _st_shadow_type =
        g_boxed_type_register_static ("StShadow",
                                      (GBoxedCopyFunc) st_shadow_ref,
                                      (GBoxedFreeFunc) st_shadow_unref);

  return _st_shadow_type;
}
