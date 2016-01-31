NULL = 
BUILT_SOURCES =
CLEANFILES =
EXTRA_DIST =
bin_SCRIPTS =
pkglibexec_PROGRAMS =
noinst_LTLIBRARIES =
noinst_PROGRAMS =
service_in_files =

-include $(INTROSPECTION_MAKEFILE)
INTROSPECTION_GIRS =
INTROSPECTION_SCANNER_ARGS = --warn-all --add-include-path=$(srcdir)
INTROSPECTION_COMPILER_ARGS = --includedir=$(srcdir) --includedir=$(MUFFIN_TYPELIB_DIR)

typelibdir = $(pkglibdir)
typelib_DATA = $(INTROSPECTION_GIRS:.gir=.typelib)

servicedir = $(datadir)/dbus-1/services
service_DATA = $(service_in_files:.service.in=.service)

%.service: %.service.in Makefile
	$(AM_V_GEN)									\
		[ -d $(@D) ] || $(MKDIR_P) $(@D) ;					\
		sed -e "s|\@libexecdir\@|$(libexecdir)|" \
		    -e "s|\@pkglibexecdir\@|$(pkglibexecdir)|" $< > $@.tmp && mv $@.tmp $@

CLEANFILES += $(service_DATA)

CLEANFILES += $(gir_DATA) $(typelib_DATA)

bin_SCRIPTS += cinnamon-extension-tool
EXTRA_DIST += cinnamon-extension-tool.in
bin_PROGRAMS = cinnamon-real

if USE_JHBUILD_WRAPPER_SCRIPT
cinnamon = cinnamon-jhbuild
bin_SCRIPTS += cinnamon-jhbuild
else
cinnamon = cinnamon-real
endif
EXTRA_DIST += cinnamon-jhbuild.in

noinst_DATA = cinnamon
cinnamon: $(cinnamon) Makefile
	$(AM_V_GEN) cp $< $@.tmp && mv $@.tmp $@
install-exec-hook:
	mv $(DESTDIR)$(bindir)/$(cinnamon) $(DESTDIR)$(bindir)/cinnamon
uninstall-hook:
	rm -f $(DESTDIR)$(bindir)/cinnamon

generated_script_substitutions = \
	    -e "s|@bindir[@]|$(bindir)|" \
	    -e "s|@datadir[@]|$(datadir)|" \
	    -e "s|@libexecdir[@]|$(libexecdir)|" \
	    -e "s|@libdir[@]|$(libdir)|" \
	    -e "s|@JHBUILD_TYPELIBDIR[@]|$(JHBUILD_TYPELIBDIR)|" \
	    -e "s|@pkgdatadir[@]|$(pkgdatadir)|" \
	    -e "s|@pkglibexecdir[@]|$(pkglibexecdir)|" \
	    -e "s|@PYTHON[@]|$(PYTHON)|" \
	    -e "s|@VERSION[@]|$(VERSION)|" \
	    -e "s|@sysconfdir[@]|$(sysconfdir)|" \
        -e "s|@GJS_CONSOLE[@]|$(GJS_CONSOLE)|"

cinnamon-jhbuild: cinnamon-jhbuild.in cinnamon-real Makefile
	$(AM_V_GEN) sed $(generated_script_substitutions) $< > $@.tmp && mv $@.tmp $@ && chmod a+x $@
	@# Regenerate libtool wrapper so Alt+F2 restart will work
	@$(LIBTOOL) --mode=execute test -f cinnamon-real

cinnamon-extension-tool: cinnamon-extension-tool.in Makefile
	$(AM_V_GEN) sed $(generated_script_substitutions) $< > $@.tmp && mv $@.tmp $@ && chmod a+x $@

CLEANFILES += cinnamon $(bin_SCRIPTS)

include Makefile-st.am
include Makefile-tray.am
include Makefile-hotplug-sniffer.am

cinnamon_cflags =				\
	$(CINNAMON_CFLAGS)			\
	-I$(srcdir)/tray			\
    -DCLUTTER_ENABLE_EXPERIMENTAL_API   \
    -DCOGL_ENABLE_EXPERIMENTAL_API  \
	-DVERSION=\"$(VERSION)\"		\
	-DLOCALEDIR=\"$(datadir)/locale\" 	\
	-DDATADIR=\"$(datadir)\"		\
	-DCINNAMON_LIBEXECDIR=\"$(libexecdir)\"	\
	-DCINNAMON_DATADIR=\"$(pkgdatadir)\"	\
	-DCINNAMON_PKGLIBDIR=\"$(pkglibdir)\" \
	-DCINNAMON_PKGLIBEXECDIR=\"$(pkglibexecdir)\"	\
	-DJSDIR=\"$(pkgdatadir)/js\"

privlibdir = $(pkglibdir)
privlib_LTLIBRARIES = libcinnamon.la libcinnamon-js.la

cinnamon_built_sources = \
	cinnamon-marshal.h \
	cinnamon-marshal.c \
	cinnamon-enum-types.h \
	cinnamon-enum-types.c

BUILT_SOURCES += $(cinnamon_built_sources)
EXTRA_DIST += cinnamon-marshal.list

cinnamon_public_headers_h =		\
	cinnamon-app.h			\
	cinnamon-app-system.h		\
	cinnamon-doc-system.h		\
	cinnamon-embedded-window.h		\
	cinnamon-generic-container.h	\
	cinnamon-gtk-embed.h		\
	cinnamon-global.h			\
	cinnamon-mount-operation.h		\
	cinnamon-perf-log.h		\
	cinnamon-screenshot.h	\
	cinnamon-screen-grabber.h	\
	cinnamon-slicer.h			\
	cinnamon-stack.h			\
	cinnamon-tray-icon.h		\
	cinnamon-tray-manager.h		\
	cinnamon-util.h			\
	cinnamon-window-tracker.h		\
	cinnamon-wm.h			\
	cinnamon-xfixes-cursor.h \
    cinnamon-js.h

libcinnamon_la_SOURCES =		\
	$(cinnamon_built_sources)		\
	$(cinnamon_public_headers_h)	\
	cinnamon-app-private.h		\
	cinnamon-app-system-private.h	\
	cinnamon-embedded-window-private.h	\
	cinnamon-global-private.h		\
	cinnamon-window-tracker-private.h	\
	cinnamon-wm-private.h		\
	cinnamon-plugin.c		\
	cinnamon-app.c			\
	cinnamon-app-system.c		\
	cinnamon-doc-system.c		\
	cinnamon-embedded-window.c		\
	cinnamon-generic-container.c	\
	cinnamon-gtk-embed.c		\
	cinnamon-global.c			\
	cinnamon-mount-operation.c		\
	cinnamon-perf-log.c		\
	cinnamon-screenshot.c		\
	cinnamon-screen-grabber.c	\
	cinnamon-slicer.c			\
	cinnamon-stack.c			\
	cinnamon-tray-icon.c		\
	cinnamon-tray-manager.c		\
	cinnamon-util.c			\
	cinnamon-window-tracker.c		\
	cinnamon-wm.c			\
	cinnamon-xfixes-cursor.c \
    cinnamon-js.cpp

libcinnamon_la_gir_sources = \
	$(filter-out %-private.h $(cinnamon_recorder_non_gir_sources), $(cinnamon_public_headers_h) $(libcinnamon_la_SOURCES))

cinnamon_real_SOURCES =		\
	main.c
cinnamon_real_CPPFLAGS = $(cinnamon_cflags)
cinnamon_real_LDADD = libcinnamon.la libcinnamon-js.la $(libcinnamon_la_LIBADD)
cinnamon_real_DEPENDENCIES = libcinnamon.la

########################################

libcinnamon_js_la_SOURCES =      \
    cinnamon-js.h          \
    cinnamon-js.cpp            \
    $(NULL)

libcinnamon_js_la_LIBADD =       \
    $(CINNAMON_JS_LIBS)      \
    $(NULL)

libcinnamon_js_la_LDFLAGS =      \
    -avoid-version

libcinnamon_js_la_CPPFLAGS =     \
    $(CINNAMON_JS_CFLAGS)

########################################

cinnamon_recorder_sources =        \
	cinnamon-recorder.c	\
	cinnamon-recorder.h

# Custom element is an internal detail
cinnamon_recorder_non_gir_sources =  \
	cinnamon-recorder-src.c	  \
	cinnamon-recorder-src.h


if BUILD_RECORDER
libcinnamon_la_SOURCES += $(cinnamon_recorder_sources) $(cinnamon_recorder_non_gir_sources)

noinst_PROGRAMS += test-recorder

test_recorder_CPPFLAGS = $(TEST_CINNAMON_RECORDER_CFLAGS) \
                       $(ST_CFLAGS)
test_recorder_LDADD = $(TEST_CINNAMON_RECORDER_LIBS) \
                       libst-1.0.la


test_recorder_SOURCES =     \
	$(cinnamon_recorder_sources) $(cinnamon_recorder_non_gir_sources) \
	test-recorder.c
endif BUILD_RECORDER

########################################

pkglibexec_PROGRAMS += cinnamon-perf-helper

cinnamon_perf_helper_SOURCES = cinnamon-perf-helper.c
cinnamon_perf_helper_CPPFLAGS = $(CINNAMON_PERF_HELPER_CFLAGS)
cinnamon_perf_helper_LDADD = $(CINNAMON_PERF_HELPER_LIBS)

########################################

noinst_PROGRAMS += run-js-test

run_js_test_CPPFLAGS = $(cinnamon_cflags)
run_js_test_LDADD = libcinnamon.la $(CINNAMON_JS_LIBS) $(libcinnamon_la_LIBADD)
run_js_test_LDFLAGS = -export-dynamic

run_js_test_SOURCES =			\
	run-js-test.c

########################################

cinnamon-marshal.h: stamp-cinnamon-marshal.h
	@true
stamp-cinnamon-marshal.h: Makefile cinnamon-marshal.list
	$(AM_V_GEN) $(GLIB_GENMARSHAL) \
		--prefix=_cinnamon_marshal \
		--header \
	$(srcdir)/cinnamon-marshal.list > xgen-smh && \
	(cmp -s xgen-smh cinnamon-marshal.h || cp -f xgen-smh cinnamon-marshal.h) && \
	rm -f xgen-smh && \
	echo timestamp > $(@F)
CLEANFILES += stamp-cinnamon-marshal.h

cinnamon-marshal.c: Makefile cinnamon-marshal.list
	$(AM_V_GEN) (echo "#include \"cinnamon-marshal.h\"" ; \
	 $(GLIB_GENMARSHAL) \
		--prefix=_cinnamon_marshal \
		--body \
	 $(srcdir)/cinnamon-marshal.list ) > xgen-smc && \
	cp -f xgen-smc cinnamon-marshal.c && \
	rm -f xgen-smc


cinnamon-enum-types.h: stamp-cinnamon-enum-types.h Makefile
	@true
stamp-cinnamon-enum-types.h: $(srcdir)/cinnamon-enum-types.h.in $(cinnamon_public_headers_h)
	$(AM_V_GEN) ( \
	  $(GLIB_MKENUMS) \
	    --template $< \
	  $(addprefix $(srcdir)/,$(cinnamon_public_headers_h)) ) > $(@F).tmp && \
	(cmp -s $(@F).tmp cinnamon-enum-types.h || mv $(@F).tmp cinnamon-enum-types.h) && \
	rm -f $(@F).tmp && \
	echo timestamp > $(@F)
EXTRA_DIST += cinnamon-enum-types.h.in
CLEANFILES += stamp-cinnamon-enum-types.h

cinnamon-enum-types.c: $(srcdir)/cinnamon-enum-types.c.in stamp-cinnamon-enum-types.h
	$(AM_V_GEN) ( \
	  $(GLIB_MKENUMS) \
	    --template $< \
	  $(addprefix $(srcdir)/,$(cinnamon_public_headers_h)) ) > $(@F).tmp && \
	mv $(@F).tmp $(@F) && \
	rm -f $(@F).tmp
EXTRA_DIST += cinnamon-enum-types.c.in

libcinnamon_la_LDFLAGS = -avoid-version
libcinnamon_la_LIBADD =		\
	-lm			\
	$(CINNAMON_LIBS)	\
	$(BLUETOOTH_LIBS)	\
	libst-1.0.la       	\
	libtray.la		\
	$(NULL)

libcinnamon_la_CPPFLAGS = $(cinnamon_cflags)

Cinnamon-0.1.gir: libcinnamon.la St-1.0.gir
Cinnamon_0_1_gir_INCLUDES = Clutter-1.0 ClutterX11-1.0 Meta-Muffin.0 Soup-2.4 CMenu-3.0 NetworkManager-1.0 NMClient-1.0
Cinnamon_0_1_gir_CFLAGS = $(libcinnamon_la_CPPFLAGS) -I $(srcdir)
Cinnamon_0_1_gir_LIBS = libcinnamon.la
Cinnamon_0_1_gir_FILES = $(libcinnamon_la_gir_sources)
Cinnamon_0_1_gir_SCANNERFLAGS = --include-uninstalled=$(builddir)/St-1.0.gir \
	--add-include-path=$(MUFFIN_GIR_DIR) $(if $(BLUETOOTH_DIR),-L $(BLUETOOTH_DIR),)
INTROSPECTION_GIRS += Cinnamon-0.1.gir
CLEANFILES += Cinnamon-0.1.gir

CinnamonJS-0.1.gir: libcinnamon-js.la
CinnamonJS_0_1_gir_CFLAGS = $(libcinnamon_la_CPPFLAGS) -I $(srcdir)
CinnamonJS_0_1_gir_LIBS = libcinnamon-js.la
CinnamonJS_0_1_gir_FILES = $(libcinnamon_js_la_SOURCES)
INTROSPECTION_GIRS += CinnamonJS-0.1.gir
CLEANFILES += CinnamonJS-0.1.gir

St-1.0.gir: libst-1.0.la
St_1_0_gir_INCLUDES = Clutter-1.0 Gtk-3.0
St_1_0_gir_CFLAGS = $(st_cflags) -DST_COMPILATION
St_1_0_gir_LIBS = libst-1.0.la
St_1_0_gir_FILES = $(filter-out %-private.h $(st_non_gir_sources), $(addprefix $(srcdir)/,$(st_source_h))) \
	$(addprefix $(srcdir)/,$(st_source_c))
INTROSPECTION_GIRS += St-1.0.gir
CLEANFILES += St-1.0.gir
