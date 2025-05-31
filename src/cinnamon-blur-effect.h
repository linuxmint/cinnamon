/* cinnamon-blur-effect.h
 *
 * Copyright 2019 Georges Basile Stavracas Neto <georges.stavracas@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#pragma once

#include <clutter/clutter.h>

G_BEGIN_DECLS

/**
 * CinnamonBlurMode:
 * @CINNAMON_BLUR_MODE_ACTOR: blur the actor contents, and its children
 * @CINNAMON_BLUR_MODE_BACKGROUND: blur what's beneath the actor
 *
 * The mode of blurring of the effect.
 */
typedef enum
{
  CINNAMON_BLUR_MODE_ACTOR,
  CINNAMON_BLUR_MODE_BACKGROUND,
} CinnamonBlurMode;

#define CINNAMON_TYPE_BLUR_EFFECT (cinnamon_blur_effect_get_type())
G_DECLARE_FINAL_TYPE (CinnamonBlurEffect, cinnamon_blur_effect, CINNAMON, BLUR_EFFECT, ClutterEffect)

CinnamonBlurEffect *cinnamon_blur_effect_new (void);

int cinnamon_blur_effect_get_sigma (CinnamonBlurEffect *self);
void cinnamon_blur_effect_set_sigma (CinnamonBlurEffect *self,
                                  int              sigma);

float cinnamon_blur_effect_get_brightness (CinnamonBlurEffect *self);
void cinnamon_blur_effect_set_brightness (CinnamonBlurEffect *self,
                                       float            brightness);

CinnamonBlurMode cinnamon_blur_effect_get_mode (CinnamonBlurEffect *self);
void cinnamon_blur_effect_set_mode (CinnamonBlurEffect *self,
                                 CinnamonBlurMode    mode);

void cinnamon_blur_effect_new_for_actor (ClutterActor     *actor,
                                         CinnamonBlurMode  mode,
                                         const gchar      *name,
                                         float             brightness,
                                         int               sigma);

G_END_DECLS
