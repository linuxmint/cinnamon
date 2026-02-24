/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * subprocs.c --- choosing, spawning, and killing screenhacks.
 *
 * xscreensaver, Copyright (c) 1991-2003 Jamie Zawinski <jwz@jwz.org>
 * Modified:     Copyright (c) 2004 William Jon McCann <mccann@jhu.edu>
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

#include <stdlib.h>
#include <ctype.h>
#include <stdio.h>
#include <string.h>

#ifndef ESRCH
# include <errno.h>
#endif

#include <sys/time.h>		/* sys/resource.h needs this for timeval */
# include <sys/wait.h>		/* for waitpid() and associated macros */

#ifdef VMS
# include <processes.h>
# include <unixio.h>		/* for close */
# include <unixlib.h>		/* for getpid */
# define pid_t int
# define fork  vfork
#endif /* VMS */

#include <signal.h>		/* for the signal names */

#include <glib.h>
#include "subprocs.h"

#if !defined(SIGCHLD) && defined(SIGCLD)
# define SIGCHLD SIGCLD
#endif

/* Semaphore to temporarily turn the SIGCHLD handler into a no-op.
   Don't alter this directly -- use block_sigchld() / unblock_sigchld().
*/
static int block_sigchld_handler = 0;


#ifdef HAVE_SIGACTION
sigset_t
#else  /* !HAVE_SIGACTION */
int
#endif /* !HAVE_SIGACTION */
block_sigchld (void)
{
#ifdef HAVE_SIGACTION
        sigset_t child_set;
        sigemptyset (&child_set);
        sigaddset (&child_set, SIGCHLD);
        sigaddset (&child_set, SIGPIPE);
        sigprocmask (SIG_BLOCK, &child_set, 0);
#endif /* HAVE_SIGACTION */

        block_sigchld_handler++;

#ifdef HAVE_SIGACTION
        return child_set;
#else  /* !HAVE_SIGACTION */
        return 0;
#endif /* !HAVE_SIGACTION */
}

void
unblock_sigchld (void)
{
#ifdef HAVE_SIGACTION
        sigset_t child_set;
        sigemptyset (&child_set);
        sigaddset (&child_set, SIGCHLD);
        sigaddset (&child_set, SIGPIPE);
        sigprocmask (SIG_UNBLOCK, &child_set, 0);
#endif /* HAVE_SIGACTION */

        block_sigchld_handler--;
}

int
signal_pid (int    pid,
            int    signal)
{
        int status = -1;
        gboolean verbose = TRUE;

        if (block_sigchld_handler)
                /* This function should not be called from the signal handler. */
                abort();

        block_sigchld ();                      /* we control the horizontal... */

        status = kill (pid, signal);

        if (verbose && status < 0) {
                if (errno == ESRCH)
                        g_message ("Child process %lu was already dead.",
                                   (unsigned long) pid);
                else {
                        char buf [1024];
                        snprintf (buf, sizeof (buf), "Couldn't kill child process %lu",
                                 (unsigned long) pid);
                        perror (buf);
                }
        }

        unblock_sigchld ();

        if (block_sigchld_handler < 0)
                abort ();

        return status;
}

#ifndef VMS

void
await_dying_children (int      pid,
                      gboolean debug)
{
        while (1) {
                int wait_status = 0;
                pid_t kid;

                errno = 0;
                kid = waitpid (-1, &wait_status, WNOHANG|WUNTRACED);

                if (debug) {
                        if (kid < 0 && errno)
                                g_message ("waitpid(%d) ==> %ld (%d)", pid, (long) kid, errno);
                        else if (kid != 0) 
                                g_message ("waitpid(%d) ==> %ld", pid, (long) kid);
                }

                /* 0 means no more children to reap.
                   -1 means error -- except "interrupted system call" isn't a "real"
                   error, so if we get that, we should just try again. */
                if (kid < 0 && errno != EINTR)
                        break;
        }
}


#else  /* VMS */
static void await_dying_children (saver_info *si) { return; }
#endif /* VMS */

