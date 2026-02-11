/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2006 William Jon McCann <mccann@jhu.edu>
 * Copyright (C) 2006 Ray Strode <rstrode@redhat.com>
 * Copyright (C) 2003 Bill Nottingham <notting@redhat.com>
 * Copyright (c) 1993-2003 Jamie Zawinski <jwz@jwz.org>
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

#include "config.h"

#include <stdlib.h>
#ifdef HAVE_UNISTD_H
# include <unistd.h>
#endif

#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <pwd.h>
#include <grp.h>
#include <security/pam_appl.h>
#include <signal.h>
#include <errno.h>

#include <glib.h>
#include <glib/gstdio.h>
#include <glib/gi18n-lib.h>

#include "cs-auth.h"

#include "subprocs.h"

/* Some time between Red Hat 4.2 and 7.0, the words were transposed
   in the various PAM_x_CRED macro names.  Yay!
*/
#ifndef  PAM_REFRESH_CRED
# define PAM_REFRESH_CRED PAM_CRED_REFRESH
#endif

#ifdef HAVE_PAM_FAIL_DELAY
/* We handle delays ourself.*/
/* Don't set this to 0 (Linux bug workaround.) */
# define PAM_NO_DELAY(pamh) pam_fail_delay ((pamh), 1)
#else  /* !HAVE_PAM_FAIL_DELAY */
# define PAM_NO_DELAY(pamh) /* */
#endif /* !HAVE_PAM_FAIL_DELAY */


/* On SunOS 5.6, and on Linux with PAM 0.64, pam_strerror() takes two args.
   On some other Linux systems with some other version of PAM (e.g.,
   whichever Debian release comes with a 2.2.5 kernel) it takes one arg.
   I can't tell which is more "recent" or "correct" behavior, so configure
   figures out which is in use for us.  Shoot me!
*/
#ifdef PAM_STRERROR_TWO_ARGS
# define PAM_STRERROR(pamh, status) pam_strerror((pamh), (status))
#else  /* !PAM_STRERROR_TWO_ARGS */
# define PAM_STRERROR(pamh, status) pam_strerror((status))
#endif /* !PAM_STRERROR_TWO_ARGS */

static GMainLoop    *auth_loop = NULL;
static gboolean      verbose_enabled = FALSE;
static pam_handle_t *pam_handle = NULL;
static gboolean      did_we_ask_for_password = FALSE;

#define DEBUG(...) if (verbose_enabled) g_printerr (__VA_ARGS__)

struct pam_closure {
        const char       *username;
        CsAuthMessageFunc cb_func;
        gpointer          cb_data;
        int               signal_fd;
        int               result;
};

typedef struct {
        struct pam_closure *closure;
        CsAuthMessageStyle style;
        const char        *msg;
        char             **resp;
        gboolean           should_interrupt_stack;
} GsAuthMessageHandlerData;

static GCond  *message_handled_condition;
static GMutex *message_handler_mutex;

GQuark
cs_auth_error_quark (void)
{
        static GQuark quark = 0;
        if (! quark) {
                quark = g_quark_from_static_string ("cs_auth_error");
        }

        return quark;
}

void
cs_auth_set_verbose (gboolean enabled)
{
        verbose_enabled = enabled;
}

gboolean
cs_auth_get_verbose (void)
{
        return verbose_enabled;
}

static CsAuthMessageStyle
pam_style_to_cs_style (int pam_style)
{
        CsAuthMessageStyle style;

        switch (pam_style) {
        case PAM_PROMPT_ECHO_ON:
                style = CS_AUTH_MESSAGE_PROMPT_ECHO_ON;
                break;
        case PAM_PROMPT_ECHO_OFF:
                style = CS_AUTH_MESSAGE_PROMPT_ECHO_OFF;
                break;
        case PAM_ERROR_MSG:
                style = CS_AUTH_MESSAGE_ERROR_MSG;
                break;
        case PAM_TEXT_INFO:
                style = CS_AUTH_MESSAGE_TEXT_INFO;
                break;
        default:
                g_assert_not_reached ();
                break;
        }

        return style;
}

static gboolean
auth_message_handler (CsAuthMessageStyle style,
                      const char        *msg,
                      char             **response,
                      gpointer           data)
{
        gboolean ret;

        ret = TRUE;
        *response = NULL;

        switch (style) {
        case CS_AUTH_MESSAGE_PROMPT_ECHO_ON:
                break;
        case CS_AUTH_MESSAGE_PROMPT_ECHO_OFF:
                if (msg != NULL && g_str_has_prefix (msg, _("Password:"))) {
                        did_we_ask_for_password = TRUE;
                }
                break;
        case CS_AUTH_MESSAGE_ERROR_MSG:
                break;
        case CS_AUTH_MESSAGE_TEXT_INFO:
                break;
        default:
                g_assert_not_reached ();
        }

        return ret;
}

static gboolean
cs_auth_queued_message_handler (GsAuthMessageHandlerData *data)
{
        gboolean res;

        if (cs_auth_get_verbose ()) {
                DEBUG ("Waiting for lock\n");
        }

        g_mutex_lock (message_handler_mutex);

        if (cs_auth_get_verbose ()) {
                DEBUG ("Waiting for response\n");
        }

        res = data->closure->cb_func (data->style,
                                      data->msg,
                                      data->resp,
                                      data->closure->cb_data);
        data->should_interrupt_stack = res == FALSE;

        g_printerr ("should interrupt: %d\n", data->should_interrupt_stack);

        g_cond_signal (message_handled_condition);
        g_mutex_unlock (message_handler_mutex);

        if (cs_auth_get_verbose ()) {
                DEBUG ("Got response\n");
        }

        return FALSE;
}

static gboolean
cs_auth_run_message_handler (struct pam_closure *c,
                             CsAuthMessageStyle  style,
                             const char         *msg,
                             char              **resp)
{
        GsAuthMessageHandlerData data;

        data.closure = c;
        data.style = style;
        data.msg = msg;
        data.resp = resp;
        data.should_interrupt_stack = TRUE;

        g_mutex_lock (message_handler_mutex);

        /* Queue the callback in the gui (the main) thread
         */
        g_idle_add ((GSourceFunc) cs_auth_queued_message_handler, &data);

        if (cs_auth_get_verbose ()) {
                DEBUG ("cs-auth-pam (pid %i): Waiting for response to message style %d: '%s'\n", getpid (), style, msg);
        }

        /* Wait for the response
         */
        g_cond_wait (message_handled_condition,
                     message_handler_mutex);
        g_mutex_unlock (message_handler_mutex);

        if (cs_auth_get_verbose ()) {
                DEBUG ("cs-auth-pam (pid %i): Got response to message style %d: interrupt:%d\n", getpid (), style, data.should_interrupt_stack);
        }

        return data.should_interrupt_stack == FALSE;
}

static int
pam_conversation (int                        nmsgs,
                  const struct pam_message **msg,
                  struct pam_response      **resp,
                  void                      *closure)
{
        int                  replies = 0;
        struct pam_response *reply = NULL;
        struct pam_closure  *c = (struct pam_closure *) closure;
        gboolean             res;
        int                  ret;

        reply = (struct pam_response *) calloc (nmsgs, sizeof (*reply));

        if (reply == NULL) {
                return PAM_CONV_ERR;
        }

        res = TRUE;
        ret = PAM_SUCCESS;

        for (replies = 0; replies < nmsgs && ret == PAM_SUCCESS; replies++) {
                CsAuthMessageStyle style;
                char              *utf8_msg;

                style = pam_style_to_cs_style (msg [replies]->msg_style);

                utf8_msg = g_locale_to_utf8 (msg [replies]->msg,
                                             -1,
                                             NULL,
                                             NULL,
                                             NULL);

                /* if we couldn't convert text from locale then
                 * assume utf-8 and hope for the best */
                if (utf8_msg == NULL) {
                        char *p;
                        char *q;

                        utf8_msg = g_strdup (msg [replies]->msg);

                        p = utf8_msg;
                        while (*p != '\0' && !g_utf8_validate ((const char *)p, -1, (const char **)&q)) {
                                *q = '?';
                                p = q + 1;
                        }
                }

                /* handle message locally first */
                auth_message_handler (style,
                                      utf8_msg,
                                      &reply [replies].resp,
                                      NULL);

                if (c->cb_func != NULL) {
                        if (cs_auth_get_verbose ()) {
                                DEBUG ("Handling message style %d: '%s'\n", style, utf8_msg);
                        }

 			/* blocks until the gui responds
  			 */
  			res = cs_auth_run_message_handler (c,
                                                           style,
  							   utf8_msg,
  							   &reply [replies].resp);

                        if (cs_auth_get_verbose ()) {
                                DEBUG ("Msg handler returned %d\n", res);
                        }

                        /* If the handler returns FALSE - interrupt the PAM stack */
                        if (res) {
                                reply [replies].resp_retcode = PAM_SUCCESS;
                        } else {
                                int i;
                                for (i = 0; i <= replies; i++) {
                                        free (reply [i].resp);
                                }
                                free (reply);
                                reply = NULL;
                                ret = PAM_CONV_ERR;
                        }
                }

                g_free (utf8_msg);
        }

        *resp = reply;

        return ret;
}

static gboolean
close_pam_handle (int status)
{

        if (pam_handle != NULL) {
                int status2;

                status2 = pam_end (pam_handle, status);
                pam_handle = NULL;

                if (cs_auth_get_verbose ()) {
                        DEBUG (" pam_end (...) ==> %d (%s)\n",
                                   status2,
                                   (status2 == PAM_SUCCESS ? "Success" : "Failure"));
                }
        }

        if (message_handled_condition != NULL) {
                g_cond_free (message_handled_condition);
                message_handled_condition = NULL;
        }

        if (message_handler_mutex != NULL) {
                g_mutex_free (message_handler_mutex);
                message_handler_mutex = NULL;
        }

        return TRUE;
}

static gboolean
create_pam_handle (const char      *username,
                   const char      *display,
                   struct pam_conv *conv,
                   int             *status_code)
{
        int         status;
        const char *service = PAM_SERVICE_NAME;
        char       *disp;
        gboolean    ret;

	if (pam_handle != NULL) {
		g_warning ("create_pam_handle: Stale pam handle around, cleaning up\n");
                close_pam_handle (PAM_SUCCESS);
	}

	/* init things */
	pam_handle = NULL;
        status = -1;
        disp = NULL;
        ret = TRUE;

	/* Initialize a PAM session for the user */
	if ((status = pam_start (service, username, conv, &pam_handle)) != PAM_SUCCESS) {
		pam_handle = NULL;
                g_warning (_("Unable to establish service %s: %s\n"),
                           service,
                           PAM_STRERROR (NULL, status));

                if (status_code != NULL) {
                        *status_code = status;
                }

                ret = FALSE;
                goto out;
	}

        if (cs_auth_get_verbose ()) {
                DEBUG ("cs-auth-pam (pid %i): pam_start (\"%s\", \"%s\", ...) ==> %d (%s)\n",
                           getpid (),
                           service,
                           username,
                           status,
                           PAM_STRERROR (pam_handle, status));
        }

        disp = g_strdup (display);
        if (disp == NULL) {
                disp = g_strdup (":0.0");
        }

	if ((status = pam_set_item (pam_handle, PAM_TTY, disp)) != PAM_SUCCESS) {
                g_warning (_("Can't set PAM_TTY=%s"), display);

                if (status_code != NULL) {
                        *status_code = status;
                }

                ret = FALSE;
                goto out;
	}

        ret = TRUE;
	message_handled_condition = g_cond_new ();
	message_handler_mutex = g_mutex_new ();

 out:
        if (status_code != NULL) {
                *status_code = status;
        }

        g_free (disp);

        return ret;
}

static void
set_pam_error (GError **error,
               int      status)
{
        if (status == PAM_AUTH_ERR || status == PAM_USER_UNKNOWN) {
                char *msg;

                if (did_we_ask_for_password) {
                        msg = g_strdup (_("Incorrect password."));
                } else {
                        msg = g_strdup (_("Authentication failed."));
                }

                g_set_error (error,
                             CS_AUTH_ERROR,
                             CS_AUTH_ERROR_AUTH_ERROR,
                             "%s",
                             msg);
                g_free (msg);
        } else if (status == PAM_PERM_DENIED) {
                g_set_error (error,
                             CS_AUTH_ERROR,
                             CS_AUTH_ERROR_AUTH_DENIED,
                             "%s",
                             _("Not permitted to gain access at this time."));
        } else if (status == PAM_ACCT_EXPIRED) {
                g_set_error (error,
                             CS_AUTH_ERROR,
                             CS_AUTH_ERROR_AUTH_DENIED,
                             "%s",
                             _("No longer permitted to access the system."));
        }

}

static gpointer
cs_auth_thread_func (gpointer auth_operation_fd_ptr)
{
        static const int flags = 0;
        int              status;
        int              status2;
        struct timespec  timeout;
        sigset_t         set;
        const void      *p;
        int              auth_operation_fd = GPOINTER_TO_INT(auth_operation_fd_ptr);

        timeout.tv_sec = 0;
        timeout.tv_nsec = 1;

        set = block_sigchld ();

        status = pam_authenticate (pam_handle, flags);

        sigtimedwait (&set, NULL, &timeout);
        unblock_sigchld ();

        if (cs_auth_get_verbose ()) {
                DEBUG ("   pam_authenticate (...) ==> %d (%s)\n",
                           status,
                           PAM_STRERROR (pam_handle, status));
        }

        if (status != PAM_SUCCESS) {
                goto done;
        }

        if ((status = pam_get_item (pam_handle, PAM_USER, &p)) != PAM_SUCCESS) {
                /* is not really an auth problem, but it will
                   pretty much look as such, it shouldn't really
                   happen */
                goto done;
        }

        /* We don't actually care if the account modules fail or succeed,
         * but we need to run them anyway because certain pam modules
         * depend on side effects of the account modules getting run.
         */
        status2 = pam_acct_mgmt (pam_handle, 0);

        if (cs_auth_get_verbose ()) {
                DEBUG ("pam_acct_mgmt (...) ==> %d (%s)\n",
                           status2,
                           PAM_STRERROR (pam_handle, status2));
        }

        /* FIXME: should we handle these? */
        switch (status2) {
        case PAM_SUCCESS:
                break;
        case PAM_NEW_AUTHTOK_REQD:
                break;
        case PAM_AUTHINFO_UNAVAIL:
                break;
        case PAM_ACCT_EXPIRED:
                break;
        case PAM_PERM_DENIED:
                break;
        default :
                break;
        }

        /* Each time we successfully authenticate, refresh credentials,
           for Kerberos/AFS/DCE/etc.  If this fails, just ignore that
           failure and blunder along; it shouldn't matter.

           Note: this used to be PAM_REFRESH_CRED instead of
           PAM_REINITIALIZE_CRED, but Jason Heiss <jheiss@ee.washington.edu>
           says that the Linux PAM library ignores that one, and only refreshes
           credentials when using PAM_REINITIALIZE_CRED.
        */
        status2 = pam_setcred (pam_handle, PAM_REINITIALIZE_CRED);
        if (cs_auth_get_verbose ()) {
                DEBUG ("   pam_setcred (...) ==> %d (%s)\n",
                           status2,
                           PAM_STRERROR (pam_handle, status2));
        }

 done:
        /* we're done, close the fd and wake up the main
         * loop
         */
        close (auth_operation_fd);

        return GINT_TO_POINTER(status);
}

static gboolean
cs_auth_loop_quit (GIOChannel  *source,
		   GIOCondition condition,
		   gboolean    *thread_done)
{
        *thread_done = TRUE;
        g_main_loop_quit (auth_loop);
        return FALSE;
}

static gboolean
cs_auth_pam_verify_user (pam_handle_t *handle,
                         int          *status)
{
        GThread    *auth_thread;
        GIOChannel *channel;
        guint       watch_id;
        int         auth_operation_fds[2];
        int         auth_status;
        gboolean    thread_done;

        channel = NULL;
        watch_id = 0;
        auth_status = PAM_AUTH_ERR;

        /* This pipe gives us a set of fds we can hook into
         * the event loop to be notified when our helper thread 
         * is ready to be reaped.
         */
        if (pipe (auth_operation_fds) < 0) {
                goto out;
        }

        if (fcntl (auth_operation_fds[0], F_SETFD, FD_CLOEXEC) < 0) {
                close (auth_operation_fds[0]);
                close (auth_operation_fds[1]);
                goto out;
        }

        if (fcntl (auth_operation_fds[1], F_SETFD, FD_CLOEXEC) < 0) {
                close (auth_operation_fds[0]);
                close (auth_operation_fds[1]);
                goto out;
        }

        channel = g_io_channel_unix_new (auth_operation_fds[0]);

        /* we use a recursive main loop to process ui events
         * while we wait on a thread to handle the blocking parts
         * of pam authentication.
         */
        thread_done = FALSE;
        watch_id = g_io_add_watch (channel, G_IO_ERR | G_IO_HUP,
                                   (GIOFunc) cs_auth_loop_quit, &thread_done);

        auth_thread = g_thread_new ("cs-auth-verify-user",
                                    (GThreadFunc) cs_auth_thread_func,
                                    GINT_TO_POINTER (auth_operation_fds[1]));

        if (auth_thread == NULL) {
                goto out;
        }

        auth_loop = g_main_loop_new (NULL, FALSE);
        g_main_loop_run (auth_loop);
        /* if the event loop was quit before the thread is done then we can't
         * reap the thread without blocking on it finishing.  The
         * thread may not ever finish though if the pam module is blocking.
         *
         * The only time the event loop is going to stop when the thread isn't
         * done, however, is if the dialog quits early (from, e.g., "cancel"),
         * so we can just exit.  An alternative option would be to switch to
         * using pthreads directly and calling pthread_cancel.
         */
        if (!thread_done) {
                raise (SIGTERM);
        }

        auth_status = GPOINTER_TO_INT (g_thread_join (auth_thread));

 out:
        if (watch_id != 0 && !thread_done) {
                g_source_remove (watch_id);
                watch_id = 0;
        }

        if (channel != NULL) {
                g_io_channel_unref (channel);
        }

        if (status) {
                *status = auth_status;
        }

        return auth_status == PAM_SUCCESS;
}

/**
 * cs_auth_verify_user:
 * @username: user name
 * @display: display string
 * @func: (scope async): the auth function callback
 * @data: (closure func): data for func
 * @error: Return location for error or %NULL.
 *
 * Starts a PAM thread for user authentication. 
 *
 * Returns: Whether or not the user was authenticated successfully
 */

gboolean
cs_auth_verify_user (const char       *username,
                     const char       *display,
                     CsAuthMessageFunc func,
                     gpointer          data,
                     GError          **error)
{
        int                status = -1;
        struct pam_conv    conv;
        struct pam_closure c;
        struct passwd     *pwent;

        pwent = getpwnam (username);
        if (pwent == NULL) {
                return FALSE;
        }

        c.username = username;
        c.cb_func = func;
        c.cb_data = data;

        conv.conv = &pam_conversation;
        conv.appdata_ptr = (void *) &c;

        /* Initialize PAM. */
        create_pam_handle (username, display, &conv, &status);
        if (status != PAM_SUCCESS) {
                goto done;
        }

        pam_set_item (pam_handle, PAM_USER_PROMPT, _("Username:"));

        did_we_ask_for_password = FALSE;
        if (! cs_auth_pam_verify_user (pam_handle, &status)) {
                goto done;
        }

 done:
        if (status != PAM_SUCCESS) {
                set_pam_error (error, status);
        }

        close_pam_handle (status);

        return (status == PAM_SUCCESS ? TRUE : FALSE);
}

gboolean
cs_auth_init (void)
{
        return TRUE;
}

gboolean
cs_auth_priv_init (void)
{
        /* We have nothing to do at init-time.
           However, we might as well do some error checking.
           If "/etc/pam.d" exists and is a directory, but "/etc/pam.d/xlock"
           does not exist, warn that PAM probably isn't going to work.

           This is a priv-init instead of a non-priv init in case the directory
           is unreadable or something (don't know if that actually happens.)
        */
        const char   dir [] = "/etc/pam.d";
        const char  file [] = "/etc/pam.d/" PAM_SERVICE_NAME;
        const char file2 [] = "/etc/pam.conf";
        struct stat st;

        if (g_stat (dir, &st) == 0 && st.st_mode & S_IFDIR) {
                if (g_stat (file, &st) != 0) {
                        g_warning ("%s does not exist.\n"
                                   "Authentication via PAM is unlikely to work.",
                                   file);
                }
        } else if (g_stat (file2, &st) == 0) {
                FILE *f = g_fopen (file2, "r");
                if (f) {
                        gboolean ok = FALSE;
                        char buf[255];
                        while (fgets (buf, sizeof(buf), f)) {
                                if (strstr (buf, PAM_SERVICE_NAME)) {
                                        ok = TRUE;
                                        break;
                                }
                        }

                        fclose (f);
                        if (!ok) {
                                g_warning ("%s does not list the `%s' service.\n"
                                           "Authentication via PAM is unlikely to work.",
                                           file2, PAM_SERVICE_NAME);
                        }
                }
                /* else warn about file2 existing but being unreadable? */
        } else {
                g_warning ("Neither %s nor %s exist.\n"
                           "Authentication via PAM is unlikely to work.",
                           file2, file);
        }

        /* Return true anyway, just in case. */
        return TRUE;
}
