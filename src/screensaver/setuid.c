/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * setuid.c --- management of runtime privileges.
 *
 * xscreensaver, Copyright (c) 1993-1998 Jamie Zawinski <jwz@jwz.org>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

#include "config.h"

#ifdef USE_SETRES
#define _GNU_SOURCE
#endif /* USE_SETRES */

#include <errno.h>

#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <unistd.h>
#include <pwd.h>		/* for getpwnam() and struct passwd */
#include <grp.h>		/* for getgrgid() and struct group */

#include "setuid.h"

static char *
uid_gid_string (uid_t uid,
                gid_t gid)
{
        static char   *buf;
        struct passwd *p = NULL;
        struct group  *g = NULL;

        p = getpwuid (uid);
        g = getgrgid (gid);

        buf = g_strdup_printf ("%s/%s (%ld/%ld)",
                               (p && p->pw_name ? p->pw_name : "???"),
                               (g && g->gr_name ? g->gr_name : "???"),
                               (long) uid, (long) gid);

        return buf;
}

static gboolean
set_ids_by_number (uid_t  uid,
                   gid_t  gid,
                   char **message_ret)
{
        int uid_errno = 0;
        int gid_errno = 0;
        int sgs_errno = 0;
        struct passwd *p = getpwuid (uid);
        struct group  *g = getgrgid (gid);

        if (message_ret)
                *message_ret = NULL;

        /* Rumor has it that some implementations of of setuid() do nothing
           when called with -1; therefore, if the "nobody" user has a uid of
           -1, then that would be Really Bad.  Rumor further has it that such
           systems really ought to be using -2 for "nobody", since that works.
           So, if we get a uid (or gid, for good measure) of -1, switch to -2
           instead.  Note that this must be done after we've looked up the
           user/group names with getpwuid(-1) and/or getgrgid(-1).
        */
        if (gid == (gid_t) -1) gid = (gid_t) -2;
        if (uid == (uid_t) -1) uid = (uid_t) -2;

#ifndef USE_SETRES
         errno = 0;
         if (setgroups (1, &gid) < 0)
                 sgs_errno = errno ? errno : -1;

        errno = 0;
        if (setgid (gid) != 0)
                gid_errno = errno ? errno : -1;

        errno = 0;
        if (setuid (uid) != 0)
                uid_errno = errno ? errno : -1;
#else /* !USE_SETRES */
        errno = 0;
        if (setresgid (gid, gid, gid) != 0)
                gid_errno = errno ? errno : -1;

        errno = 0;
        if (setresuid (uid, uid, uid) != 0)
                uid_errno = errno ? errno : -1;
#endif /* USE_SETRES */

        if (uid_errno == 0 && gid_errno == 0 && sgs_errno == 0) {
                static char *reason;
                reason = g_strdup_printf ("changed uid/gid to %s/%s (%ld/%ld).",
                                          (p && p->pw_name ? p->pw_name : "???"),
                                          (g && g->gr_name ? g->gr_name : "???"),
                                          (long) uid, (long) gid);
                if (message_ret)
                        *message_ret = g_strdup (reason);

                g_free (reason);

                return TRUE;
        } else {
                char *reason = NULL;

                if (sgs_errno) {
                        reason = g_strdup_printf ("couldn't setgroups to %s (%ld)",
                                                  (g && g->gr_name ? g->gr_name : "???"),
                                                  (long) gid);
                        if (sgs_errno == -1)
                                fprintf (stderr, "%s: unknown error\n", reason);
                        else {
                                errno = sgs_errno;
                                perror (reason);
                        }
                        g_free (reason);
                        reason = NULL;
                }

                if (gid_errno) {
                        reason = g_strdup_printf ("couldn't set gid to %s (%ld)",
                                                  (g && g->gr_name ? g->gr_name : "???"),
                                                  (long) gid);
                        if (gid_errno == -1)
                                fprintf (stderr, "%s: unknown error\n", reason);
                        else {
                                errno = gid_errno;
                                perror (reason);
                        }
                        g_free (reason);
                        reason = NULL;
                }

                if (uid_errno) {
                        reason = g_strdup_printf ("couldn't set uid to %s (%ld)",
                                                  (p && p->pw_name ? p->pw_name : "???"),
                                                  (long) uid);
                        if (uid_errno == -1)
                                fprintf (stderr, "%s: unknown error\n", reason);
                        else {
                                errno = uid_errno;
                                perror (reason);
                        }
                        g_free (reason);
                        reason = NULL;
                }
                return FALSE;
        }
        return FALSE;
}


/* If we've been run as setuid or setgid to someone else (most likely root)
   turn off the extra permissions so that random user-specified programs
   don't get special privileges.  (On some systems it is necessary to install
   this program as setuid root in order to read the passwd file to implement
   lock-mode.)

   *** WARNING: DO NOT DISABLE ANY OF THE FOLLOWING CODE!
   If you do so, you will open a security hole.  See the sections
   of the xscreensaver manual titled "LOCKING AND ROOT LOGINS",
   and "USING XDM".
*/

/* Returns TRUE if OK to lock, FALSE otherwise */
gboolean
hack_uid (char **nolock_reason,
          char **orig_uid,
          char **uid_message)
{
        char    *reason;
        gboolean ret;

        ret = TRUE;
        reason = NULL;

        if (nolock_reason != NULL) {
                *nolock_reason = NULL;
        }
        if (orig_uid != NULL) {
                *orig_uid = NULL;
        }
        if (uid_message != NULL) {
                *uid_message = NULL;
        }

        /* Discard privileges, and set the effective user/group ids to the
           real user/group ids.  That is, give up our "chmod +s" rights.
        */
        {
                uid_t euid = geteuid ();
                gid_t egid = getegid ();
                uid_t uid  = getuid ();
                gid_t gid  = getgid ();

                if (orig_uid != NULL) {
                        *orig_uid = uid_gid_string (euid, egid);
                }

                if (uid != euid || gid != egid) {
#ifndef USE_SETRES
                        if (! set_ids_by_number (uid, gid, uid_message)) {
#else /* !USE_SETRES */
                        if (! set_ids_by_number (euid == 0 ? uid : euid, egid == 0 ? gid : egid, uid_message)) {
#endif /* USE_SETRES */
                                reason = g_strdup ("unable to discard privileges.");

                                ret = FALSE;
                                goto out;
                        }
                }
        }


        /* Locking can't work when running as root, because we have no way of
           knowing what the user id of the logged in user is (so we don't know
           whose password to prompt for.)

           *** WARNING: DO NOT DISABLE THIS CODE!
           If you do so, you will open a security hole.  See the sections
           of the xscreensaver manual titled "LOCKING AND ROOT LOGINS",
           and "USING XDM".
        */
        if (getuid () == (uid_t) 0) {
                reason = g_strdup ("running as root");
                ret = FALSE;
                goto out;
        }

 out:
        if (nolock_reason != NULL) {
                *nolock_reason = g_strdup (reason);
        }
        g_free (reason);

        return ret;
}
