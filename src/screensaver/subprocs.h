/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * subprocs.c --- choosing, spawning, and killing screenhacks.
 *
 * xscreensaver, Copyright (c) 1991-2003 Jamie Zawinski <jwz@jwz.org>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or 
 * implied warranty.
 */

#ifndef __GS_SUBPROCS_H
#define __GS_SUBPROCS_H

#include <signal.h>

G_BEGIN_DECLS

void unblock_sigchld (void);

#ifdef HAVE_SIGACTION
sigset_t
#else  /* !HAVE_SIGACTION */
int
#endif /* !HAVE_SIGACTION */
block_sigchld (void);

int  signal_pid           (int    pid,
                           int    signal);
void await_dying_children (int      pid,
                           gboolean debug);

G_END_DECLS

#endif /* __GS_SUBPROCS_H */
