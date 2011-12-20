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
 * Ported to Cinnamon by Giovanni Campagna <scampa.giovanni@gmail.com>
 * Porting consisted only in replacing nmn with cinnamon, to be compatible with
 * GObject Introspection namespacing
 */

#ifndef CINNAMON_MOBILE_PROVIDERS_H
#define CINNAMON_MOBILE_PROVIDERS_H

#include <glib.h>
#include <glib-object.h>

#define CINNAMON_TYPE_MOBILE_PROVIDER (cinnamon_mobile_provider_get_type ())
#define CINNAMON_TYPE_MOBILE_ACCESS_METHOD (cinnamon_mobile_access_method_get_type ())

typedef enum {
    CINNAMON_MOBILE_ACCESS_METHOD_TYPE_UNKNOWN = 0,
    CINNAMON_MOBILE_ACCESS_METHOD_TYPE_GSM,
    CINNAMON_MOBILE_ACCESS_METHOD_TYPE_CDMA
} CinnamonMobileAccessMethodType;

typedef struct {
    char *mcc;
    char *mnc;
} CinnamonGsmMccMnc;

typedef struct {
    char *name;
    /* maps lang (char *) -> name (char *) */
    GHashTable *lcl_names;

    char *username;
    char *password;
    char *gateway;
    GSList *dns; /* GSList of 'char *' */

    /* Only used with CINNAMON_PROVIDER_TYPE_GSM */
    char *gsm_apn;

    CinnamonMobileAccessMethodType type;

    gint refs;
} CinnamonMobileAccessMethod;

typedef struct {
    char *name;
    /* maps lang (char *) -> name (char *) */
    GHashTable *lcl_names;

    GSList *methods; /* GSList of CinnamonMobileAccessMethod */

    GSList *gsm_mcc_mnc; /* GSList of CinnamonGsmMccMnc */
    GSList *cdma_sid; /* GSList of guint32 */

    gint refs;
} CinnamonMobileProvider;


GType cinnamon_gsm_mcc_mnc_get_type (void); /* added in porting */
GType cinnamon_mobile_provider_get_type (void);
GType cinnamon_mobile_access_method_get_type (void);

CinnamonMobileProvider *cinnamon_mobile_provider_ref   (CinnamonMobileProvider *provider);
void                 cinnamon_mobile_provider_unref (CinnamonMobileProvider *provider);
GSList *             cinnamon_mobile_provider_get_gsm_mcc_mnc (CinnamonMobileProvider *provider);
GSList *             cinnamon_mobile_provider_get_cdma_sid (CinnamonMobileProvider *provider);

CinnamonMobileAccessMethod *cinnamon_mobile_access_method_ref   (CinnamonMobileAccessMethod *method);
void                     cinnamon_mobile_access_method_unref (CinnamonMobileAccessMethod *method);

GHashTable *cinnamon_mobile_providers_parse (GHashTable **out_ccs);

void cinnamon_mobile_providers_dump (GHashTable *providers);

#endif /* CINNAMON_MOBILE_PROVIDERS_H */
