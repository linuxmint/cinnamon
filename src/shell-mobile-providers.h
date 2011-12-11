/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA 02110-1301 USA.
 *
 * Copyright (C) 2009 Novell, Inc.
 * Author: Tambet Ingo (tambet@gmail.com).
 *
 * Copyright (C) 2009 - 2010 Red Hat, Inc.
 *
 * Ported to GNOME Shell by Giovanni Campagna <scampa.giovanni@gmail.com>
 * Porting consisted only in replacing nmn with shell, to be compatible with
 * GObject Introspection namespacing
 */

#ifndef SHELL_MOBILE_PROVIDERS_H
#define SHELL_MOBILE_PROVIDERS_H

#include <glib.h>
#include <glib-object.h>

#define SHELL_TYPE_MOBILE_PROVIDER (shell_mobile_provider_get_type ())
#define SHELL_TYPE_MOBILE_ACCESS_METHOD (shell_mobile_access_method_get_type ())

typedef enum {
    SHELL_MOBILE_ACCESS_METHOD_TYPE_UNKNOWN = 0,
    SHELL_MOBILE_ACCESS_METHOD_TYPE_GSM,
    SHELL_MOBILE_ACCESS_METHOD_TYPE_CDMA
} ShellMobileAccessMethodType;

typedef struct {
    char *mcc;
    char *mnc;
} ShellGsmMccMnc;

typedef struct {
    char *name;
    /* maps lang (char *) -> name (char *) */
    GHashTable *lcl_names;

    char *username;
    char *password;
    char *gateway;
    GSList *dns; /* GSList of 'char *' */

    /* Only used with SHELL_PROVIDER_TYPE_GSM */
    char *gsm_apn;

    ShellMobileAccessMethodType type;

    gint refs;
} ShellMobileAccessMethod;

typedef struct {
    char *name;
    /* maps lang (char *) -> name (char *) */
    GHashTable *lcl_names;

    GSList *methods; /* GSList of ShellMobileAccessMethod */

    GSList *gsm_mcc_mnc; /* GSList of ShellGsmMccMnc */
    GSList *cdma_sid; /* GSList of guint32 */

    gint refs;
} ShellMobileProvider;


GType shell_gsm_mcc_mnc_get_type (void); /* added in porting */
GType shell_mobile_provider_get_type (void);
GType shell_mobile_access_method_get_type (void);

ShellMobileProvider *shell_mobile_provider_ref   (ShellMobileProvider *provider);
void                 shell_mobile_provider_unref (ShellMobileProvider *provider);
GSList *             shell_mobile_provider_get_gsm_mcc_mnc (ShellMobileProvider *provider);
GSList *             shell_mobile_provider_get_cdma_sid (ShellMobileProvider *provider);

ShellMobileAccessMethod *shell_mobile_access_method_ref   (ShellMobileAccessMethod *method);
void                     shell_mobile_access_method_unref (ShellMobileAccessMethod *method);

GHashTable *shell_mobile_providers_parse (GHashTable **out_ccs);

void shell_mobile_providers_dump (GHashTable *providers);

#endif /* SHELL_MOBILE_PROVIDERS_H */
