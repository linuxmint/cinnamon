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
 */

#include "config.h"

#include <string.h>
#include <errno.h>
#include <stdlib.h>

#include <glib/gi18n.h>

#include "shell-mobile-providers.h"

#ifndef MOBILE_BROADBAND_PROVIDER_INFO
#define MOBILE_BROADBAND_PROVIDER_INFO DATADIR "/mobile-broadband-provider-info/serviceproviders.xml"
#endif

#define ISO_3166_COUNTRY_CODES DATADIR "/zoneinfo/iso3166.tab"



static GHashTable *
read_country_codes (void)
{
    GHashTable *table;
    GIOChannel *channel;
    GString *buffer;
    GError *error = NULL;
    GIOStatus status;

    channel = g_io_channel_new_file (ISO_3166_COUNTRY_CODES, "r", &error);
    if (!channel) {
        if (error) {
            g_warning ("Could not read " ISO_3166_COUNTRY_CODES ": %s", error->message);
            g_error_free (error);
        } else
            g_warning ("Could not read " ISO_3166_COUNTRY_CODES ": Unknown error");

        return NULL;
    }

    table = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_free);
    buffer = g_string_sized_new (32);

    status = G_IO_STATUS_NORMAL;
    while (status == G_IO_STATUS_NORMAL) {
        status = g_io_channel_read_line_string (channel, buffer, NULL, &error);

        switch (status) {
        case G_IO_STATUS_NORMAL:
            if (buffer->str[0] != '#') {
                char **pieces;

                pieces = g_strsplit (buffer->str, "\t", 2);

                /* Hack for rh#556292; iso3166.tab is just wrong */
                pieces[1] = pieces[1] ? g_strchomp (pieces[1]) : NULL;
                if (pieces[1] && !strcmp (pieces[1], "Britain (UK)")) {
                    g_free (pieces[1]);
                    pieces[1] = g_strdup (_("United Kingdom"));
                }

                g_hash_table_insert (table, pieces[0], pieces[1]);
                g_free (pieces);
            }

            g_string_truncate (buffer, 0);
            break;
        case G_IO_STATUS_EOF:
            break;
        case G_IO_STATUS_ERROR:
            g_warning ("Error while reading: %s", error->message);
            g_error_free (error);
            break;
        case G_IO_STATUS_AGAIN:
            /* FIXME: Try again a few times, but really, it never happes, right? */
            break;
        }
    }

    g_string_free (buffer, TRUE);
    g_io_channel_unref (channel);

    return table;
}

/* XML Parser */

typedef enum {
    PARSER_TOPLEVEL = 0,
    PARSER_COUNTRY,
    PARSER_PROVIDER,
    PARSER_METHOD_GSM,
    PARSER_METHOD_GSM_APN,
    PARSER_METHOD_CDMA,
    PARSER_ERROR
} MobileContextState;

typedef struct {
    GHashTable *country_codes;
    GHashTable *table;

    char *current_country;
    GSList *current_providers;
    ShellMobileProvider *current_provider;
    ShellMobileAccessMethod *current_method;

    char *text_buffer;
    MobileContextState state;
} MobileParser;

static ShellGsmMccMnc *
mcc_mnc_new (const char *mcc, const char *mnc)
{
    ShellGsmMccMnc *m;

    m = g_slice_new (ShellGsmMccMnc);
    m->mcc = g_strstrip (g_strdup (mcc));
    m->mnc = g_strstrip (g_strdup (mnc));
    return m;
}

/* added in porting */
static ShellGsmMccMnc *
mcc_mnc_copy (const ShellGsmMccMnc *other) {
    ShellGsmMccMnc *ret;

    ret = g_slice_new (ShellGsmMccMnc);
    ret->mcc = g_strdup (other->mcc);
    ret->mnc = g_strdup (other->mnc);
    return ret;
}

static void
mcc_mnc_free (ShellGsmMccMnc *m)
{
    g_return_if_fail (m != NULL);
    g_free (m->mcc);
    g_free (m->mnc);
    g_slice_free (ShellGsmMccMnc, m);
}

/* added in porting */
G_DEFINE_BOXED_TYPE (ShellGsmMccMnc, shell_gsm_mcc_mnc, mcc_mnc_copy, mcc_mnc_free)

static ShellMobileAccessMethod *
access_method_new (void)
{
    ShellMobileAccessMethod *method;

    method = g_slice_new0 (ShellMobileAccessMethod);
    method->refs = 1;
    method->lcl_names = g_hash_table_new_full (g_str_hash, g_str_equal,
                                               (GDestroyNotify) g_free,
                                               (GDestroyNotify) g_free);

    return method;
}

ShellMobileAccessMethod *
shell_mobile_access_method_ref (ShellMobileAccessMethod *method)
{
    g_return_val_if_fail (method != NULL, NULL);
    g_return_val_if_fail (method->refs > 0, NULL);

    method->refs++;

    return method;
}

void
shell_mobile_access_method_unref (ShellMobileAccessMethod *method)
{
    g_return_if_fail (method != NULL);
    g_return_if_fail (method->refs > 0);

    if (--method->refs == 0) {
        g_free (method->name);
        g_hash_table_destroy (method->lcl_names);
        g_free (method->username);
        g_free (method->password);
        g_free (method->gateway);
        g_free (method->gsm_apn);
        g_slist_foreach (method->dns, (GFunc) g_free, NULL);
        g_slist_free (method->dns);

        g_slice_free (ShellMobileAccessMethod, method);
    }
}

GType
shell_mobile_access_method_get_type (void)
{
    static GType type = 0;

    if (G_UNLIKELY (type == 0)) {
        type = g_boxed_type_register_static ("ShellMobileAccessMethod",
                                             (GBoxedCopyFunc) shell_mobile_access_method_ref,
                                             (GBoxedFreeFunc) shell_mobile_access_method_unref);
    }
    return type;
}


static ShellMobileProvider *
provider_new (void)
{
    ShellMobileProvider *provider;

    provider = g_slice_new0 (ShellMobileProvider);
    provider->refs = 1;
    provider->lcl_names = g_hash_table_new_full (g_str_hash, g_str_equal,
                                                 (GDestroyNotify) g_free,
                                                 (GDestroyNotify) g_free);

    return provider;
}

ShellMobileProvider *
shell_mobile_provider_ref (ShellMobileProvider *provider)
{
    provider->refs++;

    return provider;
}

void
shell_mobile_provider_unref (ShellMobileProvider *provider)
{
    if (--provider->refs == 0) {
        g_free (provider->name);
        g_hash_table_destroy (provider->lcl_names);

        g_slist_foreach (provider->methods, (GFunc) shell_mobile_access_method_unref, NULL);
        g_slist_free (provider->methods);

        g_slist_foreach (provider->gsm_mcc_mnc, (GFunc) mcc_mnc_free, NULL);
        g_slist_free (provider->gsm_mcc_mnc);

        g_slist_free (provider->cdma_sid);

        g_slice_free (ShellMobileProvider, provider);
    }
}

GType
shell_mobile_provider_get_type (void)
{
    static GType type = 0;

    if (G_UNLIKELY (type == 0)) {
        type = g_boxed_type_register_static ("ShellMobileProvider",
                                             (GBoxedCopyFunc) shell_mobile_provider_ref,
                                             (GBoxedFreeFunc) shell_mobile_provider_unref);
    }
    return type;
}

static void
provider_list_free (gpointer data)
{
    GSList *list = (GSList *) data;

    while (list) {
        shell_mobile_provider_unref ((ShellMobileProvider *) list->data);
        list = g_slist_delete_link (list, list);
    }
}

static void
parser_toplevel_start (MobileParser *parser,
                       const char *name,
                       const char **attribute_names,
                       const char **attribute_values)
{
    int i;

    if (!strcmp (name, "serviceproviders")) {
        for (i = 0; attribute_names && attribute_names[i]; i++) {
            if (!strcmp (attribute_names[i], "format")) {
                if (strcmp (attribute_values[i], "2.0")) {
                    g_warning ("%s: mobile broadband provider database format '%s'"
                               " not supported.", __func__, attribute_values[i]);
                    parser->state = PARSER_ERROR;
                    break;
                }
            }
        }
    } else if (!strcmp (name, "country")) {
        for (i = 0; attribute_names && attribute_names[i]; i++) {
            if (!strcmp (attribute_names[i], "code")) {
                char *country_code;
                char *country;

                country_code = g_ascii_strup (attribute_values[i], -1);
                country = g_hash_table_lookup (parser->country_codes, country_code);
                if (country) {
                    parser->current_country = g_strdup (country);
                    g_free (country_code);
                } else
                    parser->current_country = country_code;

                parser->state = PARSER_COUNTRY;
                break;
            }
        }
    }
}

static void
parser_country_start (MobileParser *parser,
                      const char *name,
                      const char **attribute_names,
                      const char **attribute_values)
{
    if (!strcmp (name, "provider")) {
        parser->state = PARSER_PROVIDER;
        parser->current_provider = provider_new ();
    }
}

static void
parser_provider_start (MobileParser *parser,
                       const char *name,
                       const char **attribute_names,
                       const char **attribute_values)
{
    if (!strcmp (name, "gsm"))
        parser->state = PARSER_METHOD_GSM;
    else if (!strcmp (name, "cdma")) {
        parser->state = PARSER_METHOD_CDMA;
        parser->current_method = access_method_new ();
    }
}

static void
parser_gsm_start (MobileParser *parser,
                  const char *name,
                  const char **attribute_names,
                  const char **attribute_values)
{
    if (!strcmp (name, "network-id")) {
        const char *mcc = NULL, *mnc = NULL;
        int i;

        for (i = 0; attribute_names && attribute_names[i]; i++) {
            if (!strcmp (attribute_names[i], "mcc"))
                mcc = attribute_values[i];
            else if (!strcmp (attribute_names[i], "mnc"))
                mnc = attribute_values[i];

            if (mcc && strlen (mcc) && mnc && strlen (mnc)) {
                parser->current_provider->gsm_mcc_mnc = g_slist_prepend (parser->current_provider->gsm_mcc_mnc,
                                                                         mcc_mnc_new (mcc, mnc));
                break;
            }
        }
    } else if (!strcmp (name, "apn")) {
        int i;

        for (i = 0; attribute_names && attribute_names[i]; i++) {
            if (!strcmp (attribute_names[i], "value")) {

                parser->state = PARSER_METHOD_GSM_APN;
                parser->current_method = access_method_new ();
                parser->current_method->gsm_apn = g_strstrip (g_strdup (attribute_values[i]));
                break;
            }
        }
    }
}

static void
parser_cdma_start (MobileParser *parser,
                   const char *name,
                   const char **attribute_names,
                   const char **attribute_values)
{
    if (!strcmp (name, "sid")) {
        int i;

        for (i = 0; attribute_names && attribute_names[i]; i++) {
            if (!strcmp (attribute_names[i], "value")) {
                unsigned long tmp;

                errno = 0;
                tmp = strtoul (attribute_values[i], NULL, 10);
                if (errno == 0 && tmp > 0)
                    parser->current_provider->cdma_sid = g_slist_prepend (parser->current_provider->cdma_sid,
                                                                          GUINT_TO_POINTER ((guint32) tmp));
                break;
            }
        }
    }
}

static void
mobile_parser_start_element (GMarkupParseContext *context,
                             const gchar *element_name,
                             const gchar **attribute_names,
                             const gchar **attribute_values,
                             gpointer data,
                             GError **error)
{
    MobileParser *parser = (MobileParser *) data;

    if (parser->text_buffer) {
        g_free (parser->text_buffer);
        parser->text_buffer = NULL;
    }

    switch (parser->state) {
    case PARSER_TOPLEVEL:
        parser_toplevel_start (parser, element_name, attribute_names, attribute_values);
        break;
    case PARSER_COUNTRY:
        parser_country_start (parser, element_name, attribute_names, attribute_values);
        break;
    case PARSER_PROVIDER:
        parser_provider_start (parser, element_name, attribute_names, attribute_values);
        break;
    case PARSER_METHOD_GSM:
        parser_gsm_start (parser, element_name, attribute_names, attribute_values);
        break;
    case PARSER_METHOD_CDMA:
        parser_cdma_start (parser, element_name, attribute_names, attribute_values);
        break;
    default:
        break;
    }
}

static void
parser_country_end (MobileParser *parser,
                    const char *name)
{
    if (!strcmp (name, "country")) {
        g_hash_table_insert (parser->table, parser->current_country, parser->current_providers);
        parser->current_country = NULL;
        parser->current_providers = NULL;
        parser->text_buffer = NULL;
        parser->state = PARSER_TOPLEVEL;
    }
}

static void
parser_provider_end (MobileParser *parser,
                     const char *name)
{
    if (!strcmp (name, "name")) {
        if (!parser->current_provider->name) {
            /* Use the first one. */
            parser->current_provider->name = parser->text_buffer;
            parser->text_buffer = NULL;
        }
    } else if (!strcmp (name, "provider")) {
        parser->current_provider->methods = g_slist_reverse (parser->current_provider->methods);

        parser->current_provider->gsm_mcc_mnc = g_slist_reverse (parser->current_provider->gsm_mcc_mnc);
        parser->current_provider->cdma_sid = g_slist_reverse (parser->current_provider->cdma_sid);

        parser->current_providers = g_slist_prepend (parser->current_providers, parser->current_provider);
        parser->current_provider = NULL;
        parser->text_buffer = NULL;
        parser->state = PARSER_COUNTRY;
    }
}

static void
parser_gsm_end (MobileParser *parser,
                 const char *name)
{
    if (!strcmp (name, "gsm")) {
        parser->text_buffer = NULL;
        parser->state = PARSER_PROVIDER;
    }
}

static void
parser_gsm_apn_end (MobileParser *parser,
                    const char *name)
{
    if (!strcmp (name, "name")) {
        if (!parser->current_method->name) {
            /* Use the first one. */
            parser->current_method->name = parser->text_buffer;
            parser->text_buffer = NULL;
        }
    } else if (!strcmp (name, "username")) {
        parser->current_method->username = parser->text_buffer;
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "password")) {
        parser->current_method->password = parser->text_buffer;
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "dns")) {
        parser->current_method->dns = g_slist_prepend (parser->current_method->dns, parser->text_buffer);
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "gateway")) {
        parser->current_method->gateway = parser->text_buffer;
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "apn")) {
        parser->current_method->type = SHELL_MOBILE_ACCESS_METHOD_TYPE_GSM;
        parser->current_method->dns = g_slist_reverse (parser->current_method->dns);

        if (!parser->current_method->name)
            parser->current_method->name = g_strdup (_("Default"));

        parser->current_provider->methods = g_slist_prepend (parser->current_provider->methods,
                                                             parser->current_method);
        parser->current_method = NULL;
        parser->text_buffer = NULL;
        parser->state = PARSER_METHOD_GSM;
    }
}

static void
parser_cdma_end (MobileParser *parser,
                 const char *name)
{
    if (!strcmp (name, "username")) {
        parser->current_method->username = parser->text_buffer;
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "password")) {
        parser->current_method->password = parser->text_buffer;
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "dns")) {
        parser->current_method->dns = g_slist_prepend (parser->current_method->dns, parser->text_buffer);
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "gateway")) {
        parser->current_method->gateway = parser->text_buffer;
        parser->text_buffer = NULL;
    } else if (!strcmp (name, "cdma")) {
        parser->current_method->type = SHELL_MOBILE_ACCESS_METHOD_TYPE_CDMA;
        parser->current_method->dns = g_slist_reverse (parser->current_method->dns);

        if (!parser->current_method->name)
            parser->current_method->name = g_strdup (parser->current_provider->name);

        parser->current_provider->methods = g_slist_prepend (parser->current_provider->methods,
                                                             parser->current_method);
        parser->current_method = NULL;
        parser->text_buffer = NULL;
        parser->state = PARSER_PROVIDER;
    }
}

static void
mobile_parser_end_element (GMarkupParseContext *context,
                           const gchar *element_name,
                           gpointer data,
                           GError **error)
{
    MobileParser *parser = (MobileParser *) data;

    switch (parser->state) {
    case PARSER_COUNTRY:
        parser_country_end (parser, element_name);
        break;
    case PARSER_PROVIDER:
        parser_provider_end (parser, element_name);
        break;
    case PARSER_METHOD_GSM:
        parser_gsm_end (parser, element_name);
        break;
    case PARSER_METHOD_GSM_APN:
        parser_gsm_apn_end (parser, element_name);
        break;
    case PARSER_METHOD_CDMA:
        parser_cdma_end (parser, element_name);
        break;
    default:
        break;
    }
}

static void
mobile_parser_characters (GMarkupParseContext *context,
                          const gchar *text,
                          gsize text_len,
                          gpointer data,
                          GError **error)
{
    MobileParser *parser = (MobileParser *) data;

    g_free (parser->text_buffer);
    parser->text_buffer = g_strdup (text);
}

static const GMarkupParser mobile_parser = {
    mobile_parser_start_element,
    mobile_parser_end_element,
    mobile_parser_characters,
    NULL, /* passthrough */
    NULL /* error */
};

/**
 * shell_mobile_providers_parse:
 * @out_ccs: (out) (allow-none): (element-type utf8 utf8): a #GHashTable containing
 *   country codes
 *
 * Returns: (element-type utf8 GList<Shell.MobileProvider>) (transfer container): a
 *   hash table where keys are country names 'char *', values are a 'GSList *'
 *   of 'ShellMobileProvider *'. Everything is destroyed with g_hash_table_destroy ().
*/
GHashTable *
shell_mobile_providers_parse (GHashTable **out_ccs)
{
    GMarkupParseContext *ctx;
    GIOChannel *channel;
    MobileParser parser;
    GError *error = NULL;
    char buffer[4096];
    GIOStatus status;
    gsize len = 0;

    memset (&parser, 0, sizeof (MobileParser));

    parser.country_codes = read_country_codes ();
    if (!parser.country_codes)
        goto out;

    channel = g_io_channel_new_file (MOBILE_BROADBAND_PROVIDER_INFO, "r", &error);
    if (!channel) {
        if (error) {
            g_warning ("Could not read " MOBILE_BROADBAND_PROVIDER_INFO ": %s", error->message);
            g_error_free (error);
        } else
            g_warning ("Could not read " MOBILE_BROADBAND_PROVIDER_INFO ": Unknown error");

        goto out;
    }

    parser.table = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, provider_list_free);
    parser.state = PARSER_TOPLEVEL;

    ctx = g_markup_parse_context_new (&mobile_parser, 0, &parser, NULL);

    status = G_IO_STATUS_NORMAL;
    while (status == G_IO_STATUS_NORMAL) {
        status = g_io_channel_read_chars (channel, buffer, sizeof (buffer), &len, &error);

        switch (status) {
        case G_IO_STATUS_NORMAL:
            if (!g_markup_parse_context_parse (ctx, buffer, len, &error)) {
                status = G_IO_STATUS_ERROR;
                g_warning ("Error while parsing XML: %s", error->message);
                g_error_free (error);;
            }
            break;
        case G_IO_STATUS_EOF:
            break;
        case G_IO_STATUS_ERROR:
            g_warning ("Error while reading: %s", error->message);
            g_error_free (error);
            break;
        case G_IO_STATUS_AGAIN:
            /* FIXME: Try again a few times, but really, it never happes, right? */
            break;
        }
    }

    g_io_channel_unref (channel);
    g_markup_parse_context_free (ctx);

    if (parser.current_provider) {
        g_warning ("pending current provider");
        shell_mobile_provider_unref (parser.current_provider);
    }

    if (parser.current_providers) {
        g_warning ("pending current providers");
        provider_list_free (parser.current_providers);
    }

    g_free (parser.current_country);
    g_free (parser.text_buffer);

 out:
    if (parser.country_codes) {
        if (out_ccs)
            *out_ccs = parser.country_codes;
        else
            g_hash_table_destroy (parser.country_codes);
    }

    return parser.table;
}

static void
dump_generic (ShellMobileAccessMethod *method)
{
    GSList *iter;
    GString *dns;

    g_print ("        username: %s\n", method->username ? method->username : "");
    g_print ("        password: %s\n", method->password ? method->password : "");

    dns = g_string_new (NULL);
    for (iter = method->dns; iter; iter = g_slist_next (iter))
        g_string_append_printf (dns, "%s%s", dns->len ? ", " : "", (char *) iter->data);
    g_print ("        dns     : %s\n", dns->str);
    g_string_free (dns, TRUE);

    g_print ("        gateway : %s\n", method->gateway ? method->gateway : "");
}

static void
dump_cdma (ShellMobileAccessMethod *method)
{
    g_print ("     CDMA: %s\n", method->name);

    dump_generic (method);
}

static void
dump_gsm (ShellMobileAccessMethod *method)
{
    g_print ("     APN: %s (%s)\n", method->name, method->gsm_apn);

    dump_generic (method);
}

static void
dump_country (gpointer key, gpointer value, gpointer user_data)
{
    GSList *citer, *miter;

    for (citer = value; citer; citer = g_slist_next (citer)) {
        ShellMobileProvider *provider = citer->data;

        g_print ("Provider: %s (%s)\n", provider->name, (const char *) key);
        for (miter = provider->methods; miter; miter = g_slist_next (miter)) {
            ShellMobileAccessMethod *method = miter->data;
            GSList *liter;


            for (liter = provider->gsm_mcc_mnc; liter; liter = g_slist_next (liter)) {
                ShellGsmMccMnc *m = liter->data;
                g_print ("        MCC/MNC: %s-%s\n", m->mcc, m->mnc);
            }

            for (liter = provider->cdma_sid; liter; liter = g_slist_next (liter))
                g_print ("        SID: %d\n", GPOINTER_TO_UINT (liter->data));

            switch (method->type) {
            case SHELL_MOBILE_ACCESS_METHOD_TYPE_CDMA:
                dump_cdma (method);
                break;
            case SHELL_MOBILE_ACCESS_METHOD_TYPE_GSM:
                dump_gsm (method);
                break;
            default:
                break;
            }
            g_print ("\n");
        }
    }
}

void
shell_mobile_providers_dump (GHashTable *providers)
{
    g_return_if_fail (providers != NULL);
    g_hash_table_foreach (providers, dump_country, NULL);
}

/* All the following don't exist in nm-applet, because C doesn't need
   those. They're only needed for the introspection annotations
*/

/**
 * shell_mobile_provider_get_gsm_mcc_mnc:
 * @provider: a #ShellMobileProvider
 *
 * Returns: (element-type Shell.GsmMccMnc) (transfer none): the
 *   list of #ShellGsmMccMnc this provider exposes
 */
GSList *
shell_mobile_provider_get_gsm_mcc_mnc (ShellMobileProvider *provider)
{
    return provider->gsm_mcc_mnc;
}

/**
 * shell_mobile_provider_get_cdma_sid:
 * @provider: a #ShellMobileProvider
 *
 * Returns: (element-type guint32) (transfer none): the
 *   list of CDMA sids this provider exposes
 */
GSList *
shell_mobile_provider_get_cdma_sid (ShellMobileProvider *provider)
{
    return provider->cdma_sid;
}
