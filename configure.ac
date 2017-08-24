AC_PREREQ(2.63)
AC_INIT([cinnamon],[3.4.4],[https://github.com/linuxmint/Cinnamon/issues],[cinnamon])

AC_CONFIG_HEADERS([config.h])
AC_CONFIG_SRCDIR([src/cinnamon-global.c])
AC_CONFIG_MACRO_DIR([m4])
AC_CONFIG_AUX_DIR([config])

m4_ifdef([AX_IS_RELEASE], [AX_IS_RELEASE([always])])

AC_SUBST([PACKAGE_NAME], ["$PACKAGE_NAME"])
AC_SUBST([PACKAGE_VERSION], ["$PACKAGE_VERSION"])

AM_INIT_AUTOMAKE([1.11 no-dist-gzip dist-xz tar-ustar foreign subdir-objects])
AM_MAINTAINER_MODE([enable])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

# Checks for programs.
AC_PROG_CC
AC_PROG_CXX
# Needed for per-target cflags, like in cinnamon-taskpanel
AM_PROG_CC_C_O

# Initialize libtool
LT_PREREQ([2.2.6])
LT_INIT([disable-static])

# i18n
IT_PROG_INTLTOOL([0.40])

GETTEXT_PACKAGE=cinnamon
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE, "$GETTEXT_PACKAGE",
                   [The prefix for our gettext translation domains.])

PKG_PROG_PKG_CONFIG([0.22])

GLIB_GSETTINGS

# Get a value to substitute into cinnamon.in
AM_PATH_PYTHON([2.5])
AC_SUBST(PYTHON)

# We need at least this, since gst_plugin_register_static() was added
# in 0.10.16, but nothing older than 0.10.21 has been tested.
GSTREAMER_MIN_VERSION=0.11.92

recorder_modules=
build_recorder=false
AC_MSG_CHECKING([for GStreamer (needed for recording functionality)])
if $PKG_CONFIG --exists gstreamer-1.0 '>=' $GSTREAMER_MIN_VERSION ; then
   AC_MSG_RESULT(yes)
   build_recorder=true
   recorder_modules="gstreamer-1.0 gstreamer-base-1.0 x11"
   PKG_CHECK_MODULES(TEST_CINNAMON_RECORDER, $recorder_modules clutter-1.0 xfixes)
else
   AC_MSG_RESULT(no)
fi

AM_CONDITIONAL(BUILD_RECORDER, $build_recorder)

CLUTTER_MIN_VERSION=1.10.0
GOBJECT_INTROSPECTION_MIN_VERSION=0.9.2
GJS_MIN_VERSION=3.2.0
MUFFIN_MIN_VERSION=3.0.0
GTK_MIN_VERSION=3.12.0
GIO_MIN_VERSION=2.35.0
POLKIT_MIN_VERSION=0.100
STARTUP_NOTIFICATION_MIN_VERSION=0.11

# Collect more than 20 libraries for a prize!
PKG_CHECK_MODULES(CINNAMON, gio-2.0 >= $GIO_MIN_VERSION
                               gio-unix-2.0 dbus-glib-1 libxml-2.0
                               gtk+-3.0 >= $GTK_MIN_VERSION
                               libmuffin >= $MUFFIN_MIN_VERSION
                               cjs-1.0 >= $GJS_MIN_VERSION
			       libcinnamon-menu-3.0 $recorder_modules
                               gdk-x11-3.0 libsoup-2.4 gl
			       clutter-x11-1.0 >= $CLUTTER_MIN_VERSION
                               libstartup-notification-1.0 >= $STARTUP_NOTIFICATION_MIN_VERSION
                               gobject-introspection-1.0 >= $GOBJECT_INTROSPECTION_MIN_VERSION
                               polkit-agent-1 >= $POLKIT_MIN_VERSION xfixes
                               libnm >= 1.2 libnma >= 1.2 gnome-keyring-1 atk-bridge-2.0)

PKG_CHECK_MODULES(CINNAMON_PERF_HELPER, gtk+-3.0 gio-2.0)

PKG_CHECK_MODULES(CINNAMON_HOTPLUG_SNIFFER, gio-2.0 gdk-pixbuf-2.0)

GJS_VERSION=`$PKG_CONFIG --modversion cjs-1.0`
AC_DEFINE_UNQUOTED([GJS_VERSION], ["$GJS_VERSION"], [The version of GJS we're linking to])
dnl '
AC_SUBST([GJS_VERSION], ["$GJS_VERSION"])

GOBJECT_INTROSPECTION_CHECK([$GOBJECT_INTROSPECTION_MIN_VERSION])
JHBUILD_TYPELIBDIR="$INTROSPECTION_TYPELIBDIR"
AC_SUBST(JHBUILD_TYPELIBDIR)

saved_CFLAGS=$CFLAGS
saved_LIBS=$LIBS
CFLAGS=$CINNAMON_CFLAGS
LIBS=$CINNAMON_LIBS
AC_CHECK_FUNCS(XFixesCreatePointerBarrier)
CFLAGS=$saved_CFLAGS
LIBS=$saved_LIBS

PKG_CHECK_MODULES(ST, clutter-1.0 gtk+-3.0 libcroco-0.6 >= 0.6.2 cinnamon-desktop >= 2.4.0 x11)
PKG_CHECK_MODULES(GDMUSER, dbus-glib-1 gtk+-3.0)
PKG_CHECK_MODULES(TRAY, gtk+-3.0)
PKG_CHECK_MODULES(DESKTOP_SCHEMAS, cinnamon-desktop >= 2.4.0)

AC_MSG_CHECKING([for bluetooth support])
PKG_CHECK_EXISTS([gnome-bluetooth-1.0 >= 3.1.0],
        [BLUETOOTH_DIR=`$PKG_CONFIG --variable=applet_libdir gnome-bluetooth-1.0`
	 BLUETOOTH_LIBS=`$PKG_CONFIG --variable=applet_libs gnome-bluetooth-1.0`
	 AC_SUBST([BLUETOOTH_LIBS],["$BLUETOOTH_LIBS"])
	 AC_SUBST([BLUETOOTH_DIR],["$BLUETOOTH_DIR"])
	 AC_DEFINE_UNQUOTED([BLUETOOTH_DIR],["$BLUETOOTH_DIR"],[Path to installed GnomeBluetooth typelib and library])
	 AC_DEFINE([HAVE_BLUETOOTH],[1],[Define if you have libgnome-bluetooth-applet])
	 AC_SUBST([HAVE_BLUETOOTH],[1])
	 AC_MSG_RESULT([yes])],
	[AC_DEFINE([HAVE_BLUETOOTH],[0])
	 AC_SUBST([HAVE_BLUETOOTH],[0])
	 AC_MSG_RESULT([no])])

MUFFIN_GIR_DIR=`$PKG_CONFIG --variable=girdir libmuffin`
MUFFIN_TYPELIB_DIR=`$PKG_CONFIG --variable=typelibdir libmuffin`
AC_SUBST(MUFFIN_GIR_DIR)
AC_SUBST(MUFFIN_TYPELIB_DIR)

GJS_CONSOLE=`$PKG_CONFIG --variable=cjs_console cjs-1.0`
AC_SUBST(GJS_CONSOLE)

AC_CHECK_FUNCS(fdwalk)
AC_CHECK_FUNCS(mallinfo)
AC_CHECK_HEADERS([sys/resource.h])

# _NL_TIME_FIRST_WEEKDAY is an enum and not a define
AC_MSG_CHECKING([for _NL_TIME_FIRST_WEEKDAY])
AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[#include <langinfo.h>]],
                                   [[nl_langinfo(_NL_TIME_FIRST_WEEKDAY);]])],
               [langinfo_ok=yes], [langinfo_ok=no])
AC_MSG_RESULT($langinfo_ok)
if test "$langinfo_ok" = "yes"; then
  AC_DEFINE([HAVE__NL_TIME_FIRST_WEEKDAY], [1],
            [Define if _NL_TIME_FIRST_WEEKDAY is available])
fi

# Sets GLIB_GENMARSHAL and GLIB_MKENUMS
AM_PATH_GLIB_2_0()
G_IR_SCANNER=`$PKG_CONFIG --variable=g_ir_scanner gobject-introspection-1.0`
AC_SUBST(G_IR_SCANNER)
G_IR_COMPILER=`$PKG_CONFIG --variable=g_ir_compiler gobject-introspection-1.0`
AC_SUBST(G_IR_COMPILER)
G_IR_GENERATE=`$PKG_CONFIG --variable=g_ir_generate gobject-introspection-1.0`
AC_SUBST(G_IR_GENERATE)
GIRDIR=`$PKG_CONFIG --variable=girdir gobject-introspection-1.0`
AC_SUBST(GIRDIR)
TYPELIBDIR="$($PKG_CONFIG --variable=typelibdir gobject-introspection-1.0)"
AC_SUBST(TYPELIBDIR)

m4_ifdef([AX_COMPILER_FLAGS],
         [AX_COMPILER_FLAGS([WARN_CFLAGS],[WARN_LDFLAGS])])

AC_ARG_ENABLE(jhbuild-wrapper-script,
  AS_HELP_STRING([--jhbuild-wrapper-script=yes],[Make "cinnamon" script work for jhbuild]),,enable_jhbuild_wrapper_script=no)
AM_CONDITIONAL(USE_JHBUILD_WRAPPER_SCRIPT, test "x$enable_jhbuild_wrapper_script" = xyes)

AC_ARG_ENABLE([gtk-doc],
  AC_HELP_STRING([--enable-gtk-doc],
                 [use gtk-doc to build documentation [[default=yes]]]),,
  enable_gtk_doc=yes)


AC_MSG_CHECKING([location of system Certificate Authority list])
AC_ARG_WITH(ca-certificates,
            [AC_HELP_STRING([--with-ca-certificates=@<:@path@:>@],
                            [path to system Certificate Authority list])])

if test "$with_ca_certificates" = "no"; then
    AC_MSG_RESULT([disabled])
else
    if test -z "$with_ca_certificates"; then
        for f in /etc/pki/tls/certs/ca-bundle.crt \
                 /etc/ssl/certs/ca-certificates.crt; do
             if test -f "$f"; then
                with_ca_certificates="$f"
             fi
        done
        if test -z "$with_ca_certificates"; then
            AC_MSG_ERROR([could not find. Use --with-ca-certificates=path to set, or --without-ca-certificates to disable])
        fi
   fi

   AC_MSG_RESULT($with_ca_certificates)
   AC_DEFINE_UNQUOTED(CINNAMON_SYSTEM_CA_FILE, ["$with_ca_certificates"], [The system TLS CA list])
fi
AC_SUBST(CINNAMON_SYSTEM_CA_FILE,["$with_ca_certificates"])

GTK_DOC_CHECK([1.15], [--flavour no-tmpl])
AC_CONFIG_FILES([
  Makefile
  data/Makefile
  data/icons/Makefile
  docs/Makefile
  docs/reference/Makefile
  docs/reference/cinnamon/Makefile
  docs/reference/cinnamon/cinnamon-docs.sgml
  docs/reference/cinnamon-js/Makefile
  docs/reference/cinnamon-tutorials/Makefile
  docs/reference/cinnamon-tutorials/cinnamon-tutorials-docs.sgml
  docs/reference/st/Makefile
  docs/reference/st/cinnamon-st-docs.sgml
  js/Makefile
  js/misc/config.js
  src/Makefile
  tests/Makefile
  po/Makefile.in
  man/Makefile
  files/Makefile
])
AC_OUTPUT
