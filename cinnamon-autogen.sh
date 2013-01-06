#!/bin/sh
# Run this to generate all the initial makefiles, etc.

#name of package
test "$PKG_NAME" || PKG_NAME=Package
test "$srcdir" || srcdir=.

# default version requirements ...
test "$REQUIRED_AUTOCONF_VERSION" || REQUIRED_AUTOCONF_VERSION=2.53
test "$REQUIRED_AUTOMAKE_VERSION" || REQUIRED_AUTOMAKE_VERSION=1.9
test "$REQUIRED_LIBTOOL_VERSION" || REQUIRED_LIBTOOL_VERSION=1.4.3
test "$REQUIRED_GETTEXT_VERSION" || REQUIRED_GETTEXT_VERSION=0.10.40
test "$REQUIRED_GLIB_GETTEXT_VERSION" || REQUIRED_GLIB_GETTEXT_VERSION=2.2.0
test "$REQUIRED_INTLTOOL_VERSION" || REQUIRED_INTLTOOL_VERSION=0.25
test "$REQUIRED_PKG_CONFIG_VERSION" || REQUIRED_PKG_CONFIG_VERSION=0.14.0
test "$REQUIRED_GTK_DOC_VERSION" || REQUIRED_GTK_DOC_VERSION=1.0
test "$REQUIRED_DOC_COMMON_VERSION" || REQUIRED_DOC_COMMON_VERSION=2.3.0
test "$REQUIRED_GNOME_DOC_UTILS_VERSION" || REQUIRED_GNOME_DOC_UTILS_VERSION=0.4.2

# a list of required m4 macros.  Package can set an initial value
test "$REQUIRED_M4MACROS" || REQUIRED_M4MACROS=
test "$FORBIDDEN_M4MACROS" || FORBIDDEN_M4MACROS=

# Not all echo versions allow -n, so we check what is possible. This test is
# based on the one in autoconf.
ECHO_C=
ECHO_N=
case `echo -n x` in
-n*)
  case `echo 'x\c'` in
  *c*) ;;
  *)   ECHO_C='\c';;
  esac;;
*)
  ECHO_N='-n';;
esac

# some terminal codes ...
if tty < /dev/null 1>/dev/null 2>&1; then
    boldface="`tput bold 2>/dev/null`"
    normal="`tput sgr0 2>/dev/null`"
else
    boldface=
    normal=
fi
printbold() {
    echo $ECHO_N "$boldface" $ECHO_C
    echo "$@"
    echo $ECHO_N "$normal" $ECHO_C
}    
printerr() {
    echo "$@" >&2
}

# Usage:
#     compare_versions MIN_VERSION ACTUAL_VERSION
# returns true if ACTUAL_VERSION >= MIN_VERSION
compare_versions() {
    ch_min_version=$1
    ch_actual_version=$2
    ch_status=0
    IFS="${IFS=         }"; ch_save_IFS="$IFS"; IFS="."
    set $ch_actual_version
    for ch_min in $ch_min_version; do
        ch_cur=`echo $1 | sed 's/[^0-9].*$//'`; shift # remove letter suffixes
        if [ -z "$ch_min" ]; then break; fi
        if [ -z "$ch_cur" ]; then ch_status=1; break; fi
        if [ $ch_cur -gt $ch_min ]; then break; fi
        if [ $ch_cur -lt $ch_min ]; then ch_status=1; break; fi
    done
    IFS="$ch_save_IFS"
    return $ch_status
}

# Usage:
#     version_check PACKAGE VARIABLE CHECKPROGS MIN_VERSION SOURCE
# checks to see if the package is available
version_check() {
    vc_package=$1
    vc_variable=$2
    vc_checkprogs=$3
    vc_min_version=$4
    vc_source=$5
    vc_status=1

    vc_checkprog=`eval echo "\\$$vc_variable"`
    if [ -n "$vc_checkprog" ]; then
	printbold "using $vc_checkprog for $vc_package"
	return 0
    fi

    if test "x$vc_package" = "xautomake" -a "x$vc_min_version" = "x1.4"; then
	vc_comparator="="
    else
	vc_comparator=">="
    fi
    printbold "checking for $vc_package $vc_comparator $vc_min_version..."
    for vc_checkprog in $vc_checkprogs; do
	echo $ECHO_N "  testing $vc_checkprog... " $ECHO_C
	if $vc_checkprog --version < /dev/null > /dev/null 2>&1; then
	    vc_actual_version=`$vc_checkprog --version | head -n 1 | \
                               sed 's/^.*[ 	]\([0-9.]*[a-z]*\).*$/\1/'`
	    if compare_versions $vc_min_version $vc_actual_version; then
		echo "found $vc_actual_version"
		# set variables
		eval "$vc_variable=$vc_checkprog; \
			${vc_variable}_VERSION=$vc_actual_version"
		vc_status=0
		break
	    else
		echo "too old (found version $vc_actual_version)"
	    fi
	else
	    echo "not found."
	fi
    done
    if [ "$vc_status" != 0 ]; then
	printerr "***Error***: You must have $vc_package $vc_comparator $vc_min_version installed"
	printerr "  to build $PKG_NAME.  Download the appropriate package for"
	printerr "  from your distribution or get the source tarball at"
        printerr "    $vc_source"
	printerr
	exit $vc_status
    fi
    return $vc_status
}

# Usage:
#     require_m4macro filename.m4
# adds filename.m4 to the list of required macros
require_m4macro() {
    case "$REQUIRED_M4MACROS" in
	$1\ * | *\ $1\ * | *\ $1) ;;
	*) REQUIRED_M4MACROS="$REQUIRED_M4MACROS $1" ;;
    esac
}

forbid_m4macro() {
    case "$FORBIDDEN_M4MACROS" in
	$1\ * | *\ $1\ * | *\ $1) ;;
	*) FORBIDDEN_M4MACROS="$FORBIDDEN_M4MACROS $1" ;;
    esac
}

# Usage:
#     add_to_cm_macrodirs dirname
# Adds the dir to $cm_macrodirs, if it's not there yet.
add_to_cm_macrodirs() {
    case $cm_macrodirs in
    "$1 "* | *" $1 "* | *" $1") ;;
    *) cm_macrodirs="$cm_macrodirs $1";;
    esac
}

# Usage:
#     print_m4macros_error
# Prints an error message saying that autoconf macros were misused
print_m4macros_error() {
    printerr "***Error***: some autoconf macros required to build $PKG_NAME"
    printerr "  were not found in your aclocal path, or some forbidden"
    printerr "  macros were found.  Perhaps you need to adjust your"
    printerr "  ACLOCAL_FLAGS?"
    printerr
}

# Usage:
#     check_m4macros
# Checks that all the requested macro files are in the aclocal macro path
# Uses REQUIRED_M4MACROS and ACLOCAL variables.
check_m4macros() {
    # construct list of macro directories
    cm_macrodirs=`$ACLOCAL --print-ac-dir`
    # aclocal also searches a version specific dir, eg. /usr/share/aclocal-1.9
    # but it contains only Automake's own macros, so we can ignore it.

    # Read the dirlist file, supported by Automake >= 1.7.
    # If AUTOMAKE was defined, no version was detected.
    if [ -z "$AUTOMAKE_VERSION" ] || compare_versions 1.7 $AUTOMAKE_VERSION && [ -s $cm_macrodirs/dirlist ]; then
	cm_dirlist=`sed 's/[ 	]*#.*//;/^$/d' $cm_macrodirs/dirlist`
	if [ -n "$cm_dirlist" ] ; then
	    for cm_dir in $cm_dirlist; do
		if [ -d $cm_dir ]; then
		    add_to_cm_macrodirs $cm_dir
		fi
	    done
	fi
    fi

    # Parse $ACLOCAL_FLAGS
    set - $ACLOCAL_FLAGS
    while [ $# -gt 0 ]; do
	if [ "$1" = "-I" ]; then
	    add_to_cm_macrodirs "$2"
	    shift
	fi
	shift
    done

    cm_status=0
    if [ -n "$REQUIRED_M4MACROS" ]; then
	printbold "Checking for required M4 macros..."
	# check that each macro file is in one of the macro dirs
	for cm_macro in $REQUIRED_M4MACROS; do
	    cm_macrofound=false
	    for cm_dir in $cm_macrodirs; do
		if [ -f "$cm_dir/$cm_macro" ]; then
		    cm_macrofound=true
		    break
		fi
		# The macro dir in Cygwin environments may contain a file
		# called dirlist containing other directories to look in.
		if [ -f "$cm_dir/dirlist" ]; then
		    for cm_otherdir in `cat $cm_dir/dirlist`; do
			if [ -f "$cm_otherdir/$cm_macro" ]; then
			    cm_macrofound=true
		            break
			fi
		    done
		fi
	    done
	    if $cm_macrofound; then
		:
	    else
		printerr "  $cm_macro not found"
		cm_status=1
	    fi
	done
    fi
    if [ "$cm_status" != 0 ]; then
        print_m4macros_error
        exit $cm_status
    fi
    if [ -n "$FORBIDDEN_M4MACROS" ]; then
	printbold "Checking for forbidden M4 macros..."
	# check that each macro file is in one of the macro dirs
	for cm_macro in $FORBIDDEN_M4MACROS; do
	    cm_macrofound=false
	    for cm_dir in $cm_macrodirs; do
		if [ -f "$cm_dir/$cm_macro" ]; then
		    cm_macrofound=true
		    break
		fi
	    done
	    if $cm_macrofound; then
		printerr "  $cm_macro found (should be cleared from macros dir)"
		cm_status=1
	    fi
	done
    fi
    if [ "$cm_status" != 0 ]; then
        print_m4macros_error
	exit $cm_status
    fi
}

# try to catch the case where the macros2/ directory hasn't been cleared out.
forbid_m4macro gnome-cxx-check.m4

want_libtool=false
want_gettext=false
want_glib_gettext=false
want_intltool=false
want_pkg_config=false
want_gtk_doc=false
want_gnome_doc_utils=false
want_maintainer_mode=false

find_configure_files() {
    configure_ac=
    if test -f "$1/configure.ac"; then
	configure_ac="$1/configure.ac"
    elif test -f "$1/configure.in"; then
	configure_ac="$1/configure.in"
    fi
    if test "x$configure_ac" != x; then
	echo "$configure_ac"
	# TODO We have not detected the right autoconf yet!
	autoconf -t 'AC_CONFIG_SUBDIRS:$1' "$configure_ac" | while read dir; do
	    find_configure_files "$1/$dir"
	done
    fi
}

configure_files="`find_configure_files $srcdir`"

for configure_ac in $configure_files; do
    dirname=`dirname $configure_ac`
    if [ -f $dirname/NO-AUTO-GEN ]; then
	echo skipping $dirname -- flagged as no auto-gen
	continue
    fi
    if grep "^A[CM]_PROG_LIBTOOL" $configure_ac >/dev/null ||
       grep "^LT_INIT" $configure_ac >/dev/null; then
	want_libtool=true
    fi
    if grep "^AM_GNU_GETTEXT" $configure_ac >/dev/null; then
	want_gettext=true
    fi
    if grep "^AM_GLIB_GNU_GETTEXT" $configure_ac >/dev/null; then
	want_glib_gettext=true
    fi
    if grep "^AC_PROG_INTLTOOL" $configure_ac >/dev/null ||
       grep "^IT_PROG_INTLTOOL" $configure_ac >/dev/null; then
	want_intltool=true
    fi
    if grep "^PKG_CHECK_MODULES" $configure_ac >/dev/null; then
	want_pkg_config=true
    fi
    if grep "^GTK_DOC_CHECK" $configure_ac >/dev/null; then
	want_gtk_doc=true
    fi
    if grep "^GNOME_DOC_INIT" $configure_ac >/dev/null; then
        want_gnome_doc_utils=true
    fi

    # check that AM_MAINTAINER_MODE is used
    if grep "^AM_MAINTAINER_MODE" $configure_ac >/dev/null; then
	want_maintainer_mode=true
    fi

    if grep "^YELP_HELP_INIT" $configure_ac >/dev/null; then
        require_m4macro yelp.m4
    fi

    # check to make sure gnome-common macros can be found ...
    if grep "^GNOME_COMMON_INIT" $configure_ac >/dev/null ||
       grep "^GNOME_DEBUG_CHECK" $configure_ac >/dev/null ||
       grep "^GNOME_MAINTAINER_MODE_DEFINES" $configure_ac >/dev/null; then
        require_m4macro gnome-common.m4
    fi
    if grep "^GNOME_COMPILE_WARNINGS" $configure_ac >/dev/null ||
       grep "^GNOME_CXX_WARNINGS" $configure_ac >/dev/null; then
        require_m4macro gnome-compiler-flags.m4
    fi
    if grep "^GNOME_CODE_COVERAGE" $configure_ac >/dev/null; then
        require_m4macro gnome-code-coverage.m4
    fi
done

#tell Mandrake autoconf wrapper we want autoconf 2.5x, not 2.13
WANT_AUTOCONF_2_5=1
export WANT_AUTOCONF_2_5
version_check autoconf AUTOCONF 'autoconf2.50 autoconf autoconf-2.53' $REQUIRED_AUTOCONF_VERSION \
    "http://ftp.gnu.org/pub/gnu/autoconf/autoconf-$REQUIRED_AUTOCONF_VERSION.tar.gz"
AUTOHEADER=`echo $AUTOCONF | sed s/autoconf/autoheader/`

version_check automake AUTOMAKE "automake $AUTOMAKE automake-1.13 automake-1.12 automake-1.11 automake-1.10 automake-1.9" $REQUIRED_AUTOMAKE_VERSION \
    "http://ftp.gnu.org/pub/gnu/automake/automake-$REQUIRED_AUTOMAKE_VERSION.tar.gz"
ACLOCAL=`echo $AUTOMAKE | sed s/automake/aclocal/`

if $want_libtool; then
    version_check libtool LIBTOOLIZE "libtoolize glibtoolize" $REQUIRED_LIBTOOL_VERSION \
        "http://ftp.gnu.org/pub/gnu/libtool/libtool-$REQUIRED_LIBTOOL_VERSION.tar.gz"
    require_m4macro libtool.m4
fi

if $want_gettext; then
    version_check gettext GETTEXTIZE gettextize $REQUIRED_GETTEXT_VERSION \
        "http://ftp.gnu.org/pub/gnu/gettext/gettext-$REQUIRED_GETTEXT_VERSION.tar.gz"
    require_m4macro gettext.m4
fi

if $want_glib_gettext; then
    version_check glib-gettext GLIB_GETTEXTIZE glib-gettextize $REQUIRED_GLIB_GETTEXT_VERSION \
        "ftp://ftp.gtk.org/pub/gtk/v2.2/glib-$REQUIRED_GLIB_GETTEXT_VERSION.tar.gz"
    require_m4macro glib-gettext.m4
fi

if $want_intltool; then
    version_check intltool INTLTOOLIZE intltoolize $REQUIRED_INTLTOOL_VERSION \
        "http://ftp.gnome.org/pub/GNOME/sources/intltool/"
    require_m4macro intltool.m4
fi

if $want_pkg_config; then
    version_check pkg-config PKG_CONFIG pkg-config $REQUIRED_PKG_CONFIG_VERSION \
        "'http://www.freedesktop.org/software/pkgconfig/releases/pkgconfig-$REQUIRED_PKG_CONFIG_VERSION.tar.gz"
    require_m4macro pkg.m4
fi

if $want_gtk_doc; then
    version_check gtk-doc GTKDOCIZE gtkdocize $REQUIRED_GTK_DOC_VERSION \
        "http://ftp.gnome.org/pub/GNOME/sources/gtk-doc/"
    require_m4macro gtk-doc.m4
fi

if $want_gnome_doc_utils; then
    version_check gnome-doc-utils GNOME_DOC_PREPARE gnome-doc-prepare $REQUIRED_GNOME_DOC_UTILS_VERSION \
        "http://ftp.gnome.org/pub/GNOME/sources/gnome-doc-utils/"
fi

if [ "x$USE_COMMON_DOC_BUILD" = "xyes" ]; then
    version_check gnome-common DOC_COMMON gnome-doc-common \
        $REQUIRED_DOC_COMMON_VERSION " "
fi

check_m4macros

if [ "$#" = 0 -a "x$NOCONFIGURE" = "x" ]; then
  printerr "**Warning**: I am going to run \`configure' with no arguments."
  printerr "If you wish to pass any to it, please specify them on the"
  printerr \`$0\'" command line."
  printerr
fi

topdir=`pwd`
for configure_ac in $configure_files; do 
    dirname=`dirname $configure_ac`
    basename=`basename $configure_ac`
    if [ -f $dirname/NO-AUTO-GEN ]; then
	echo skipping $dirname -- flagged as no auto-gen
    elif [ ! -w $dirname ]; then
        echo skipping $dirname -- directory is read only
    else
	printbold "Processing $configure_ac"
	cd $dirname

        # Note that the order these tools are called should match what
        # autoconf's "autoupdate" package does.  See bug 138584 for
        # details.

        # programs that might install new macros get run before aclocal
	if grep "^A[CM]_PROG_LIBTOOL" $basename >/dev/null ||
	   grep "^LT_INIT" $basename >/dev/null; then
	    printbold "Running $LIBTOOLIZE..."
	    $LIBTOOLIZE --force --copy || exit 1
	fi

	if grep "^AM_GLIB_GNU_GETTEXT" $basename >/dev/null; then
	    printbold "Running $GLIB_GETTEXTIZE... Ignore non-fatal messages."
	    echo "no" | $GLIB_GETTEXTIZE --force --copy || exit 1
	elif grep "^AM_GNU_GETTEXT" $basename >/dev/null; then
	   if grep "^AM_GNU_GETTEXT_VERSION" $basename > /dev/null; then
	   	printbold "Running autopoint..."
		autopoint --force || exit 1
	   else
	    	printbold "Running $GETTEXTIZE... Ignore non-fatal messages."
	    	echo "no" | $GETTEXTIZE --force --copy || exit 1
	   fi
	fi

	if grep "^AC_PROG_INTLTOOL" $basename >/dev/null ||
           grep "^IT_PROG_INTLTOOL" $basename >/dev/null; then
	    printbold "Running $INTLTOOLIZE..."
	    $INTLTOOLIZE --force --copy --automake || exit 1
	fi
	if grep "^GTK_DOC_CHECK" $basename >/dev/null; then
	    printbold "Running $GTKDOCIZE..."
	    $GTKDOCIZE --copy || exit 1
	fi

	if [ "x$USE_COMMON_DOC_BUILD" = "xyes" ]; then
	    printbold "Running gnome-doc-common..."
	    gnome-doc-common --copy || exit 1
	fi
	if grep "^GNOME_DOC_INIT" $basename >/dev/null; then
	    printbold "Running $GNOME_DOC_PREPARE..."
	    $GNOME_DOC_PREPARE --force --copy || exit 1
	fi

        # Now run aclocal to pull in any additional macros needed

	# if the AC_CONFIG_MACRO_DIR() macro is used, pass that
	# directory to aclocal.
	m4dir=`cat "$basename" | grep '^AC_CONFIG_MACRO_DIR' | sed -n -e 's/AC_CONFIG_MACRO_DIR(\([^()]*\))/\1/p' | sed -e 's/^\[\(.*\)\]$/\1/' | sed -e 1q`
	if [ -n "$m4dir" ]; then
	    m4dir="-I $m4dir"
	fi
	printbold "Running $ACLOCAL..."
	$ACLOCAL $m4dir $ACLOCAL_FLAGS || exit 1

	if grep "GNOME_AUTOGEN_OBSOLETE" aclocal.m4 >/dev/null; then
	    printerr "*** obsolete gnome macros were used in $configure_ac"
	fi

	# Now that all the macros are sorted, run autoconf and autoheader ...
	printbold "Running $AUTOCONF..."
	$AUTOCONF || exit 1
	if grep "^A[CM]_CONFIG_HEADER" $basename >/dev/null; then
	    printbold "Running $AUTOHEADER..."
	    $AUTOHEADER || exit 1
	    # this prevents automake from thinking config.h.in is out of
	    # date, since autoheader doesn't touch the file if it doesn't
	    # change.
	    test -f config.h.in && touch config.h.in
	fi

	# Finally, run automake to create the makefiles ...
	printbold "Running $AUTOMAKE..."
        if [ -f COPYING ]; then
          cp -pf COPYING COPYING.autogen_bak
        fi
        if [ -f INSTALL ]; then
          cp -pf INSTALL INSTALL.autogen_bak
        fi
	if [ $REQUIRED_AUTOMAKE_VERSION != 1.4 ]; then
	    $AUTOMAKE --gnu --add-missing --copy -Wno-portability || exit 1
	else
	    $AUTOMAKE --gnu --add-missing --copy || exit 1
	fi
        if [ -f COPYING.autogen_bak ]; then
          cmp COPYING COPYING.autogen_bak > /dev/null || cp -pf COPYING.autogen_bak COPYING
          rm -f COPYING.autogen_bak
        fi
        if [ -f INSTALL.autogen_bak ]; then
          cmp INSTALL INSTALL.autogen_bak > /dev/null || cp -pf INSTALL.autogen_bak INSTALL
          rm -f INSTALL.autogen_bak
        fi

	cd "$topdir"
    fi
done

conf_flags=""

if $want_maintainer_mode; then
    conf_flags="--enable-maintainer-mode"
fi

if test x$NOCONFIGURE = x; then
    printbold Running $srcdir/configure $conf_flags "$@" ...
    $srcdir/configure $conf_flags "$@" \
	&& echo Now type \`make\' to compile $PKG_NAME || exit 1
else
    echo Skipping configure process.
fi
