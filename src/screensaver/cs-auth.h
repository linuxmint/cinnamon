/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2006 William Jon McCann <mccann@jhu.edu>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA
 * 02110-1335, USA.
 *
 */

#ifndef __CS_AUTH_H
#define __CS_AUTH_H

#include <glib.h>

G_BEGIN_DECLS

typedef enum {
    CS_AUTH_MESSAGE_PROMPT_ECHO_ON,
    CS_AUTH_MESSAGE_PROMPT_ECHO_OFF,
    CS_AUTH_MESSAGE_ERROR_MSG,
    CS_AUTH_MESSAGE_TEXT_INFO
} CsAuthMessageStyle;

typedef enum {
    CS_AUTH_ERROR_GENERAL,
    CS_AUTH_ERROR_AUTH_ERROR,
    CS_AUTH_ERROR_USER_UNKNOWN,
    CS_AUTH_ERROR_AUTH_DENIED
} CsAuthError;

#define PAM_SERVICE_NAME "cinnamon"

typedef gboolean  (* CsAuthMessageFunc) (CsAuthMessageStyle style,
                                         const char        *msg,
                                         char             **response,
                                         gpointer           data);

#define CS_AUTH_ERROR cs_auth_error_quark ()

GQuark   cs_auth_error_quark (void);

void     cs_auth_set_verbose (gboolean verbose);
gboolean cs_auth_get_verbose (void);

gboolean cs_auth_priv_init   (void);
gboolean cs_auth_init        (void);
gboolean cs_auth_verify_user (const char       *username,
                              const char       *display,
                              CsAuthMessageFunc func,
                              gpointer          data,
                              GError          **error);

G_END_DECLS

#endif /* __CS_AUTH_H */
