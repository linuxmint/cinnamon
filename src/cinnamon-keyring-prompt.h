/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/* cinnamon-keyring-prompt.c - prompt handler for gnome-keyring-daemon

   Copyright (C) 2011 Stefan Walter

   This program is free software; you can redistribute it and/or
   modify it under the terms of the GNU General Public License as
   published by the Free Software Foundation; either version 2 of the
   License, or (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
   General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.

   Author: Stef Walter <stef@thewalter.net>
*/

#ifndef __CINNAMON_KEYRING_PROMPT_H__
#define __CINNAMON_KEYRING_PROMPT_H__

#include <glib-object.h>
#include <glib.h>

#include <clutter/clutter.h>

G_BEGIN_DECLS

typedef struct _CinnamonKeyringPrompt CinnamonKeyringPrompt;

#define CINNAMON_TYPE_KEYRING_PROMPT (cinnamon_keyring_prompt_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonKeyringPrompt, cinnamon_keyring_prompt,
                      CINNAMON, KEYRING_PROMPT, GObject)

CinnamonKeyringPrompt * cinnamon_keyring_prompt_new                  (void);

ClutterText *           cinnamon_keyring_prompt_get_password_actor   (CinnamonKeyringPrompt *self);

void                    cinnamon_keyring_prompt_set_password_actor   (CinnamonKeyringPrompt *self,
                                                                      ClutterText           *password_actor);

ClutterText *           cinnamon_keyring_prompt_get_confirm_actor    (CinnamonKeyringPrompt *self);

void                    cinnamon_keyring_prompt_set_confirm_actor    (CinnamonKeyringPrompt *self,
                                                                      ClutterText           *confirm_actor);

gboolean                cinnamon_keyring_prompt_complete             (CinnamonKeyringPrompt *self);

void                    cinnamon_keyring_prompt_cancel               (CinnamonKeyringPrompt *self);

G_END_DECLS

#endif /* __CINNAMON_KEYRING_PROMPT_H__ */

