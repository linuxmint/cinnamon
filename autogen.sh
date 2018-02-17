#!/bin/sh
# Run this to generate all the initial makefiles, etc.
test -n "$srcdir" || srcdir=$(dirname "$0")
test -n "$srcdir" || srcdir=.
export srcdir

olddir=$(pwd)
cd "$srcdir"

(test -f configure.ac) || {
    echo "*** ERROR: Directory '$srcdir' does not look like the top-level project directory ***"
    exit 1
}

# shellcheck disable=SC2016
PKG_NAME=$(autoconf --trace 'AC_INIT:$1' configure.ac)
if [ "$#" = 0 -a "x$NOCONFIGURE" = "x" ]; then
    echo "*** WARNING: I am going to run 'configure' with no arguments." >&2
    echo "*** If you wish to pass any to it, please specify them on the" >&2
    echo "*** '$0' command line." >&2
    echo "" >&2
fi

mkdir -p m4
ACLOCAL_DIR="$(aclocal --print-ac-dir)"
set -a 'codeset.m4' 'gettext.m4' 'glibc21.m4' 'iconv.m4' 'lcmessage.m4' 'progtest.m4'
NUM_MACROS="$#"; COUNT=1
for i in "$@"; do
    MACRO_PATH="$ACLOCAL_DIR/$i"
    if [ -f "$MACRO_PATH" ]; then
        (cp --no-preserve=mode,ownership "${MACRO_PATH}" "${srcdir}/m4/")2>/dev/null && (echo Copied $i into ${srcdir}/m4)
    else
        echo "$i could not be found in ${ACLOCAL_DIR}" >&2
    fi

    if [ "$COUNT" -ge "${NUM_MACROS}" ]; then echo "Done copying aclocal *.m4 files."; unset MACRO_PATH; break; fi
    COUNT=$((COUNT + 1))
done

cat > ${srcdir}/m4/isc-posix.m4 << EOL
# isc-posix.m4 serial 2 (gettext-0.11.2)
dnl Copyright (C) 1995-2002 Free Software Foundation, Inc.
dnl This file is free software; the Free Software Foundation
dnl gives unlimited permission to copy and/or distribute it,
dnl with or without modifications, as long as this notice is preserved.

# This file is not needed with autoconf-2.53 and newer.  Remove it in 2005.

# This test replaces the one in autoconf.
# Currently this macro should have the same name as the autoconf macro
# because gettext's gettext.m4 (distributed in the automake package)
# still uses it.  Otherwise, the use in gettext.m4 makes autoheader
# give these diagnostics:
#   configure.in:556: AC_TRY_COMPILE was called before AC_ISC_POSIX
#   configure.in:556: AC_TRY_RUN was called before AC_ISC_POSIX

undefine([AC_ISC_POSIX])

AC_DEFUN([AC_ISC_POSIX],
  [
    dnl This test replaces the obsolescent AC_ISC_POSIX kludge.
    AC_CHECK_LIB(cposix, strerror, [LIBS="$LIBS -lcposix"])
  ]
)
EOL

glib-gettextize --force --copy || exit 1
gtkdocize --copy || exit 1
intltoolize --force --copy --automake || exit 1
autoreconf --verbose --force --install || exit 1

cd "$olddir"
if [ "$NOCONFIGURE" = "" ]; then
    $srcdir/configure "$@" || exit 1
    if [ "$1" = "--help" ]; then exit 0 else
        echo "Now type 'make' to compile $PKG_NAME" || exit 1
    fi
else
    echo "Skipping configure process."
fi