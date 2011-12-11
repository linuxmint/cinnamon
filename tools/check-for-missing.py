#!/usr/bin/python
#
# This is a simple script that we use to check for files in git
# and not in the distribution. It was previously written in shell
# and inlined in the Makefile.am, but 'git ls-files --exclude=<pattern>'
# was changed to no longer do anything useful, which made that
# too challenging to be worthwhile.

import fnmatch, os, subprocess, sys

srcdir=sys.argv[1]
distdir=sys.argv[2]
excludes=sys.argv[3:]

os.chdir(srcdir)

status=0
for f in subprocess.Popen(["git", "ls-files"], stdout=subprocess.PIPE).stdout:
    f = f.strip()
    if (not os.path.exists(os.path.join(distdir, f)) and
        not any((fnmatch.fnmatch(f, p) for p in excludes))):
        print "File missing from distribution:", f
        status=1

sys.exit(status)
