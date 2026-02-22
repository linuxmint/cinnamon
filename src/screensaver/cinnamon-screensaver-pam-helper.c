/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2004-2006 William Jon McCann <mccann@jhu.edu>
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
 * Authors: William Jon McCann <mccann@jhu.edu>
 *
 */

#include "config.h"

#include <string.h>
#include <stdio.h>
#include <unistd.h>
#include <signal.h>

#include <glib-unix.h>
#include <glib/gi18n.h>
#include <glib/gi18n.h>
#include <glib/gprintf.h>
#include <gio/gunixinputstream.h>

#include "setuid.h"
#include "cs-auth.h"

#define MAX_FAILURES 5

#define DEBUG(...) if (debug_mode) g_printerr (__VA_ARGS__)

static GMainLoop *ml = NULL;

static gboolean debug_mode = FALSE;

static guint shutdown_id = 0;
static gchar *password_ptr = NULL;
static GMutex password_mutex;
static GCancellable *stdin_cancellable = NULL;

#define CS_PAM_AUTH_FAILURE "CS_PAM_AUTH_FAILURE\n"
#define CS_PAM_AUTH_SUCCESS "CS_PAM_AUTH_SUCCESS\n"
#define CS_PAM_AUTH_CANCELLED "CS_PAM_AUTH_CANCELLED\n"
#define CS_PAM_AUTH_BUSY_TRUE "CS_PAM_AUTH_BUSY_TRUE\n"
#define CS_PAM_AUTH_BUSY_FALSE "CS_PAM_AUTH_BUSY_FALSE\n"

#define CS_PAM_AUTH_SET_PROMPT_ "CS_PAM_AUTH_SET_PROMPT_"
#define CS_PAM_AUTH_SET_INFO_ "CS_PAM_AUTH_SET_INFO_"
#define CS_PAM_AUTH_SET_ERROR_ "CS_PAM_AUTH_SET_ERROR_"

#define CS_PAM_AUTH_REQUEST_SUBPROCESS_EXIT "CS_PAM_AUTH_REQUEST_SUBPROCESS_EXIT"

static void send_cancelled (void);

static gboolean
shutdown (void)
{
    DEBUG ("cinnamon-screensaver-pam-helper (pid %i): shutting down.\n", getpid ());

    g_clear_handle_id (&shutdown_id, g_source_remove);
    g_clear_object (&stdin_cancellable);
    g_clear_pointer (&password_ptr, g_free);

    g_main_loop_quit (ml);
    return G_SOURCE_REMOVE;
}

static void
send_failure (void)
{
    if (g_cancellable_is_cancelled (stdin_cancellable))
    {
        return;
    }

    g_printf (CS_PAM_AUTH_FAILURE);
    fflush (stdout);
}

static void
send_success (void)
{
    if (g_cancellable_is_cancelled (stdin_cancellable))
    {
        return;
    }

    g_printf (CS_PAM_AUTH_SUCCESS);
    fflush (stdout);
}

static void
send_cancelled (void)
{
    if (g_cancellable_is_cancelled (stdin_cancellable))
    {
        return;
    }

    g_printf (CS_PAM_AUTH_CANCELLED);
    fflush (stdout);
}

static void
send_busy (gboolean busy)
{
    if (g_cancellable_is_cancelled (stdin_cancellable))
    {
        return;
    }

    if (busy)
    {
        g_printf (CS_PAM_AUTH_BUSY_TRUE);
    }
    else
    {
        g_printf (CS_PAM_AUTH_BUSY_FALSE);
    }

    fflush (stdout);
}

static void
send_prompt (const gchar *msg)
{
    if (g_cancellable_is_cancelled (stdin_cancellable))
    {
        return;
    }

    g_printf (CS_PAM_AUTH_SET_PROMPT_ "%s_\n", msg);
    fflush (stdout);
}

static void
send_info (const gchar *msg)
{
    if (g_cancellable_is_cancelled (stdin_cancellable))
    {
        return;
    }

    g_printf (CS_PAM_AUTH_SET_INFO_ "%s_\n", msg);
    fflush (stdout);
}

static void
send_error (const gchar *msg)
{
    if (g_cancellable_is_cancelled (stdin_cancellable))
    {
        return;
    }

    g_printf (CS_PAM_AUTH_SET_ERROR_ "%s_\n", msg);
    fflush (stdout);
}

static gboolean
auth_message_handler (CsAuthMessageStyle style,
                      const char        *msg,
                      char             **response,
                      gpointer           data)
{
    gboolean    ret;

    DEBUG ("cinnamon-screensaver-pam-helper: Got message style %d: '%s'\n", style, msg);
    ret = TRUE;
    *response = NULL;

    switch (style)
    {
        case CS_AUTH_MESSAGE_PROMPT_ECHO_ON:
            DEBUG ("cinnamon-screensaver-pam-helper: CS_AUTH_MESSAGE_PROMPT_ECHO_ON\n");
            break;
        case CS_AUTH_MESSAGE_PROMPT_ECHO_OFF:
            if (msg != NULL)
            {
                send_prompt (msg);
                send_busy (FALSE);

                while (password_ptr == NULL && !g_cancellable_is_cancelled (stdin_cancellable))
                {
                    g_main_context_iteration (g_main_context_default (), FALSE);
                    usleep (100 * 1000);
                }

                g_mutex_lock (&password_mutex);

                DEBUG ("cinnamon-screensaver-pam-helper: auth_message_handler processing response string\n");

                if (password_ptr != NULL)
                {
                    *response = g_strdup (password_ptr);
                    memset (password_ptr, '\b', strlen (password_ptr));
                    g_clear_pointer (&password_ptr, g_free);
                }

                g_mutex_unlock (&password_mutex);
            }
            break;
        case CS_AUTH_MESSAGE_ERROR_MSG:
            DEBUG ("CS_AUTH_MESSAGE_ERROR_MSG\n");

            if (msg != NULL)
            {
              send_error (msg);
            }
            break;
        case CS_AUTH_MESSAGE_TEXT_INFO:
            DEBUG ("CS_AUTH_MESSAGE_TEXT_INFO\n");

            if (msg != NULL)
            {
              send_info (msg);
            }
            break;
        default:
            g_assert_not_reached ();
    }

    if (style == CS_AUTH_MESSAGE_PROMPT_ECHO_OFF)
    {
        if (*response == NULL) {
            DEBUG ("cinnamon-screensaver-pam-helper: Got no response to prompt\n");
            ret = FALSE;
        } else {
            send_busy (TRUE);
        }
    }

    /* we may have pending events that should be processed before continuing back into PAM */
    while (g_main_context_pending (g_main_context_default ()))
    {
        g_main_context_iteration(g_main_context_default (), TRUE);
    }

    return ret;
}

static gboolean
do_auth_check (void)
{
    GError *error;
    gboolean res;

    error = NULL;

    res = cs_auth_verify_user (g_get_user_name (),
                               g_getenv ("DISPLAY"),
                               auth_message_handler,
                               NULL,
                               &error);

    DEBUG ("cinnamon-screensaver-pam-helper: Verify user returned: %s\n", res ? "TRUE" : "FALSE");

    if (!res)
    {
        if (error != NULL && !g_cancellable_is_cancelled (stdin_cancellable))
        {
            DEBUG ("cinnamon-screensaver-pam-helper: Verify user returned error: %s\n", error->message);
            send_error (error->message);
            g_error_free (error);
        }
    }

    return res;
}

static gboolean
auth_check_idle (gpointer user_data)
{
    gboolean     res;
    gboolean     again;
    static guint loop_counter = 0;

    again = TRUE;
    res = do_auth_check ();

    if (res)
    {
        again = FALSE;
        send_success ();
    }
    else
    {
        loop_counter++;

        if (loop_counter < MAX_FAILURES)
        {
            send_failure ();
            DEBUG ("cinnamon-screensaver-pam-helper: Authentication failed, retrying (%u)\n", loop_counter);
        }
        else
        {
            DEBUG ("cinnamon-screensaver-pam-helper: Authentication failed, quitting (max failures)\n");
            again = FALSE;
            /* Don't quit immediately, but rather request that cinnamon-screensaver
             * terminates us after it has finished the dialog shake. Time out
             * after 5 seconds and quit anyway if this doesn't happen though */
            send_cancelled ();
        }
    }

    if (again)
    {
        return G_SOURCE_CONTINUE;
    }

    g_cancellable_cancel (stdin_cancellable);

    return G_SOURCE_REMOVE;
}

static void
stdin_monitor_task_thread (GTask        *task,
                           gpointer      source_object,
                           gpointer      task_data,
                           GCancellable *cancellable)
{

    GInputStream *stream = G_INPUT_STREAM (g_unix_input_stream_new (STDIN_FILENO, FALSE));
    gssize size;
    GError *error =NULL;

    while (!g_cancellable_is_cancelled (cancellable))
    {
        guint8 input[255];
        // Blocks
        size = g_input_stream_read (stream, input, 255, cancellable, &error);

        if (error)
        {
            g_cancellable_cancel (cancellable);
            break;
        }

        g_mutex_lock (&password_mutex);

        if (size > 0)
        {
            if (input [size - 1] == '\n')
            {
                input [size - 1] = 0;
            }

            password_ptr = g_strdup ((gchar *) &input);
            memset (input, '\b', 255);
        }

        g_mutex_unlock (&password_mutex);

        g_usleep (1000);
    }

    g_object_unref (stream);

    if (error != NULL)
    {
        g_task_return_error (task, error);
    }
}

static void
stdin_monitor_task_finished (GObject      *source,
                           GAsyncResult *result,
                           gpointer      user_data)
{
    GError *error = NULL;
    g_task_propagate_boolean (G_TASK (result), &error);

    if (error != NULL)
    {
        if (error->code != G_IO_ERROR_CANCELLED)
        {
            g_critical ("cinnamon-screensaver-pam-helper: stdin monitor: Could not read input from cinnamon-screensaver: %s", error->message);
        }
        g_error_free (error);
    }

    DEBUG ("cinnamon-screensaver-pam-helper: stdin_monitor_task_finished (Cancelled: %d)\n",
           g_cancellable_is_cancelled (stdin_cancellable));

    shutdown ();
}

static void
setup_stdin_monitor (void)
{
    GTask *task;

    stdin_cancellable = g_cancellable_new ();
    task = g_task_new (NULL, stdin_cancellable, stdin_monitor_task_finished, NULL);

    // g_task_set_return_on_cancel (task, TRUE);

    g_task_run_in_thread (task, stdin_monitor_task_thread);
    g_object_unref (task);
}


/*
 * Copyright (c) 1991-2004 Jamie Zawinski <jwz@jwz.org>
 * Copyright (c) 2005 William Jon McCann <mccann@jhu.edu>
 *
 * Initializations that potentially take place as a privileged user:
   If the executable is setuid root, then these initializations
   are run as root, before discarding privileges.
*/
static gboolean
privileged_initialization (int     *argc,
                           char   **argv,
                           gboolean verbose)
{
    gboolean ret;
    char    *nolock_reason;
    char    *orig_uid;
    char    *uid_message;

#ifndef NO_LOCKING
    /* before hack_uid () for proper permissions */
    cs_auth_priv_init ();
#endif /* NO_LOCKING */

    ret = hack_uid (&nolock_reason,
                    &orig_uid,
                    &uid_message);

    if (nolock_reason)
    {
        DEBUG ("cinnamon-screensaver-pam-helper: Locking disabled: %s\n", nolock_reason);
    }

    if (uid_message && verbose)
    {
        g_print ("cinnamon-screensaver-pam-helper: Modified UID: %s", uid_message);
    }

    g_free (nolock_reason);
    g_free (orig_uid);
    g_free (uid_message);

    return ret;
}


/*
 * Copyright (c) 1991-2004 Jamie Zawinski <jwz@jwz.org>
 * Copyright (c) 2005 William Jon McCann <mccann@jhu.edu>
 *
 * Figure out what locking mechanisms are supported.
 */
static gboolean
lock_initialization (int     *argc,
                     char   **argv,
                     char   **nolock_reason,
                     gboolean verbose)
{
    if (nolock_reason != NULL)
    {
        *nolock_reason = NULL;
    }

#ifdef NO_LOCKING
    if (nolock_reason != NULL)
    {
        *nolock_reason = g_strdup ("not compiled with locking support");
    }

    return FALSE;
#else /* !NO_LOCKING */

    /* Finish initializing locking, now that we're out of privileged code. */
    if (!cs_auth_init ())
    {
        if (nolock_reason != NULL)
        {
            *nolock_reason = g_strdup ("error getting password");
        }

        return FALSE;
    }

#endif /* NO_LOCKING */

    return TRUE;
}

static void
response_lock_init_failed (void)
{
    /* if we fail to lock then we should drop the dialog */
    send_success ();
}

static gboolean
handle_sigterm (gpointer data)
{
    DEBUG ("cinnamon-screensaver-pam-helper (pid %i): SIGTERM, shutting down\n", getpid ());

    g_cancellable_cancel (stdin_cancellable);
    return G_SOURCE_REMOVE;
}

int
main (int    argc,
      char **argv)
{
    GOptionContext *context;
    GError *error = NULL;
    char   *nolock_reason = NULL;

    g_unix_signal_add (SIGTERM, (GSourceFunc) handle_sigterm, NULL);

    bindtextdomain (GETTEXT_PACKAGE, "/usr/share/locale");

    if (! privileged_initialization (&argc, argv, debug_mode))
    {
        response_lock_init_failed ();
        exit (1);
    }

    static GOptionEntry entries [] = {
        { "debug", 0, 0, G_OPTION_ARG_NONE, &debug_mode,
          N_("Show debugging output"), NULL },
        { NULL }
    };

    context = g_option_context_new (N_("\n\nPAM interface for cinnamon-screensaver."));
    g_option_context_set_translation_domain (context, GETTEXT_PACKAGE);
    g_option_context_add_main_entries (context, entries, GETTEXT_PACKAGE);

    if (!g_option_context_parse (context, &argc, &argv, &error)) {
        g_critical ("Failed to parse arguments: %s", error->message);
        g_error_free (error);
        g_option_context_free (context);
        exit (1);
    }

    g_option_context_free (context);

    if (! lock_initialization (&argc, argv, &nolock_reason, debug_mode))
    {
        if (nolock_reason != NULL)
        {
            DEBUG ("cinnamon-screensaver-pam-helper: Screen locking disabled: %s\n", nolock_reason);
            g_free (nolock_reason);
        }
        response_lock_init_failed ();

        exit (1);
    }

    cs_auth_set_verbose (debug_mode);
    DEBUG ("cinnamon-screensaver-pam-helper (pid %i): start\n", getpid ());

    setup_stdin_monitor ();
    g_idle_add ((GSourceFunc) auth_check_idle, NULL);

    ml = g_main_loop_new (NULL, FALSE);
    g_main_loop_run (ml);

    DEBUG ("cinnamon-screensaver-pam-helper: exit\n");
    return 0;
}
