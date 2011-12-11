NULL = 
BUILT_SOURCES =
CLEANFILES =
EXTRA_DIST =
bin_SCRIPTS =
libexec_PROGRAMS =
noinst_LTLIBRARIES =
noinst_PROGRAMS =
service_in_files =

-include $(INTROSPECTION_MAKEFILE)
INTROSPECTION_GIRS =
INTROSPECTION_SCANNER_ARGS = --warn-all --warn-error --add-include-path=$(srcdir)
INTROSPECTION_COMPILER_ARGS = --includedir=$(srcdir) --includedir=$(MUTTER_TYPELIB_DIR)

typelibdir = $(pkglibdir)
typelib_DATA = $(INTROSPECTION_GIRS:.gir=.typelib)

servicedir = $(datadir)/dbus-1/services
service_DATA = $(service_in_files:.service.in=.service)

%.service: %.service.in Makefile
	$(AM_V_GEN)									\
		[ -d $(@D) ] || $(mkdir_p) $(@D) ;					\
		sed -e "s|\@libexecdir\@|$(libexecdir)|" $< > $@.tmp && mv $@.tmp $@
CLEANFILES += $(service_DATA)

CLEANFILES += $(gir_DATA) $(typelib_DATA)

bin_SCRIPTS += gnome-shell-extension-tool
EXTRA_DIST += gnome-shell-extension-tool.in
bin_PROGRAMS = gnome-shell-real

if USE_JHBUILD_WRAPPER_SCRIPT
gnome_shell = gnome-shell-jhbuild
bin_SCRIPTS += gnome-shell-jhbuild
else
gnome_shell = gnome-shell-real
endif
EXTRA_DIST += gnome-shell-jhbuild.in

noinst_DATA = gnome-shell
gnome-shell: $(gnome_shell) Makefile
	$(AM_V_GEN) cp $< $@.tmp && mv $@.tmp $@
install-exec-hook:
	mv $(DESTDIR)$(bindir)/$(gnome_shell) $(DESTDIR)$(bindir)/gnome-shell
uninstall-hook:
	rm -f $(DESTDIR)$(bindir)/gnome-shell

generated_script_substitutions = \
	    -e "s|@bindir[@]|$(bindir)|" \
	    -e "s|@datadir[@]|$(datadir)|" \
	    -e "s|@libexecdir[@]|$(libexecdir)|" \
	    -e "s|@libdir[@]|$(libdir)|" \
	    -e "s|@JHBUILD_TYPELIBDIR[@]|$(JHBUILD_TYPELIBDIR)|" \
	    -e "s|@pkgdatadir[@]|$(pkgdatadir)|" \
	    -e "s|@PYTHON[@]|$(PYTHON)|" \
	    -e "s|@VERSION[@]|$(VERSION)|" \
	    -e "s|@sysconfdir[@]|$(sysconfdir)|"

gnome-shell-jhbuild: gnome-shell-jhbuild.in gnome-shell-real Makefile
	$(AM_V_GEN) sed $(generated_script_substitutions) $< > $@.tmp && mv $@.tmp $@ && chmod a+x $@
	@# Regenerate libtool wrapper so Alt+F2 restart will work
	@$(LIBTOOL) --mode=execute test -f gnome-shell-real

gnome-shell-extension-tool: gnome-shell-extension-tool.in Makefile
	$(AM_V_GEN) sed $(generated_script_substitutions) $< > $@.tmp && mv $@.tmp $@ && chmod a+x $@

CLEANFILES += gnome-shell $(bin_SCRIPTS)

include Makefile-st.am
include Makefile-tray.am
include Makefile-gvc.am
include Makefile-calendar-server.am
include Makefile-hotplug-sniffer.am

gnome_shell_cflags =				\
	$(GNOME_SHELL_CFLAGS)			\
	-I$(srcdir)/tray			\
	-DVERSION=\"$(VERSION)\"		\
	-DLOCALEDIR=\"$(datadir)/locale\" 	\
	-DDATADIR=\"$(datadir)\"		\
	-DGNOME_SHELL_LIBEXECDIR=\"$(libexecdir)\"	\
	-DGNOME_SHELL_DATADIR=\"$(pkgdatadir)\"	\
	-DGNOME_SHELL_PKGLIBDIR=\"$(pkglibdir)\" \
	-DJSDIR=\"$(pkgdatadir)/js\"

privlibdir = $(pkglibdir)
privlib_LTLIBRARIES = libgnome-shell.la

shell_built_sources = \
	shell-marshal.h \
	shell-marshal.c \
	shell-enum-types.h \
	shell-enum-types.c

BUILT_SOURCES += $(shell_built_sources)
EXTRA_DIST += shell-marshal.list

shell_public_headers_h =		\
	shell-app.h			\
	shell-app-system.h		\
	shell-app-usage.h		\
	shell-arrow.h			\
	shell-contact-system.h	\
	shell-doc-system.h		\
	shell-embedded-window.h		\
	shell-generic-container.h	\
	shell-gtk-embed.h		\
	shell-global.h			\
	shell-mobile-providers.h	\
	shell-mount-operation.h		\
	shell-network-agent.h		\
	shell-perf-log.h		\
	shell-slicer.h			\
	shell-stack.h			\
	shell-tp-client.h		\
	shell-tray-icon.h		\
	shell-tray-manager.h		\
	shell-util.h			\
	shell-window-tracker.h		\
	shell-wm.h			\
	shell-xfixes-cursor.h

libgnome_shell_la_SOURCES =		\
	$(shell_built_sources)		\
	$(shell_public_headers_h)	\
	shell-app-private.h		\
	shell-app-system-private.h	\
	shell-embedded-window-private.h	\
	shell-global-private.h		\
	shell-jsapi-compat-private.h	\
	shell-window-tracker-private.h	\
	shell-wm-private.h		\
	gnome-shell-plugin.c		\
	shell-app.c			\
	shell-a11y.h			\
	shell-a11y.c			\
	shell-app-system.c		\
	shell-app-usage.c		\
	shell-arrow.c			\
	shell-contact-system.c	\
	shell-doc-system.c		\
	shell-embedded-window.c		\
	shell-generic-container.c	\
	shell-gtk-embed.c		\
	shell-global.c			\
	shell-mobile-providers.c	\
	shell-mount-operation.c		\
	shell-network-agent.c		\
	shell-perf-log.c		\
	shell-polkit-authentication-agent.h	\
	shell-polkit-authentication-agent.c	\
	shell-slicer.c			\
	shell-stack.c			\
	shell-tp-client.c			\
	shell-tray-icon.c		\
	shell-tray-manager.c		\
	shell-util.c			\
	shell-window-tracker.c		\
	shell-wm.c			\
	shell-xfixes-cursor.c

libgnome_shell_la_gir_sources = \
	$(filter-out %-private.h $(shell_recorder_non_gir_sources), $(shell_public_headers_h) $(libgnome_shell_la_SOURCES))

gnome_shell_real_SOURCES =		\
	main.c
gnome_shell_real_CPPFLAGS = $(gnome_shell_cflags)
gnome_shell_real_LDADD = libgnome-shell.la $(libgnome_shell_la_LIBADD)
gnome_shell_real_DEPENDENCIES = libgnome-shell.la

########################################

shell_recorder_sources =        \
	shell-recorder.c	\
	shell-recorder.h

# Custom element is an internal detail
shell_recorder_non_gir_sources =  \
	shell-recorder-src.c	  \
	shell-recorder-src.h

if BUILD_RECORDER
libgnome_shell_la_SOURCES += $(shell_recorder_sources) $(shell_recorder_non_gir_sources)

noinst_PROGRAMS += test-recorder

test_recorder_CPPFLAGS = $(TEST_SHELL_RECORDER_CFLAGS)
test_recorder_LDADD = $(TEST_SHELL_RECORDER_LIBS)

test_recorder_SOURCES =     \
	$(shell_recorder_sources) $(shell_recorder_non_gir_sources) \
	test-recorder.c
endif BUILD_RECORDER

########################################

libexec_PROGRAMS += gnome-shell-perf-helper

gnome_shell_perf_helper_SOURCES = shell-perf-helper.c
gnome_shell_perf_helper_CPPFLAGS = $(SHELL_PERF_HELPER_CFLAGS)
gnome_shell_perf_helper_LDADD = $(SHELL_PERF_HELPER_LIBS)

########################################

noinst_PROGRAMS += run-js-test

run_js_test_CPPFLAGS = $(gnome_shell_cflags)
run_js_test_LDADD = libgnome-shell.la $(libgnome_shell_la_LIBADD)
run_js_test_LDFLAGS = -export-dynamic

run_js_test_SOURCES =			\
	run-js-test.c

########################################

shell-marshal.h: stamp-shell-marshal.h
	@true
stamp-shell-marshal.h: Makefile shell-marshal.list
	$(AM_V_GEN) $(GLIB_GENMARSHAL) \
		--prefix=_shell_marshal \
		--header \
	$(srcdir)/shell-marshal.list > xgen-smh && \
	(cmp -s xgen-smh shell-marshal.h || cp -f xgen-smh shell-marshal.h) && \
	rm -f xgen-smh && \
	echo timestamp > $(@F)
CLEANFILES += stamp-shell-marshal.h

shell-marshal.c: Makefile shell-marshal.list
	$(AM_V_GEN) (echo "#include \"shell-marshal.h\"" ; \
	 $(GLIB_GENMARSHAL) \
		--prefix=_shell_marshal \
		--body \
	 $(srcdir)/shell-marshal.list ) > xgen-smc && \
	cp -f xgen-smc shell-marshal.c && \
	rm -f xgen-smc


shell-enum-types.h: stamp-shell-enum-types.h Makefile
	@true
stamp-shell-enum-types.h: $(srcdir)/shell-enum-types.h.in $(shell_public_headers_h)
	$(AM_V_GEN) ( \
	  $(GLIB_MKENUMS) \
	    --template $< \
	  $(addprefix $(srcdir)/,$(shell_public_headers_h)) ) > $(@F).tmp && \
	(cmp -s $(@F).tmp shell-enum-types.h || mv $(@F).tmp shell-enum-types.h) && \
	rm -f $(@F).tmp && \
	echo timestamp > $(@F)
EXTRA_DIST += shell-enum-types.h.in
CLEANFILES += stamp-shell-enum-types.h

shell-enum-types.c: $(srcdir)/shell-enum-types.c.in stamp-shell-enum-types.h
	$(AM_V_GEN) ( \
	  $(GLIB_MKENUMS) \
	    --template $< \
	  $(addprefix $(srcdir)/,$(shell_public_headers_h)) ) > $(@F).tmp && \
	mv $(@F).tmp $(@F) && \
	rm -f $(@F).tmp
EXTRA_DIST += shell-enum-types.c.in

libgnome_shell_la_LDFLAGS = -avoid-version
libgnome_shell_la_LIBADD =		\
	-lm			\
	$(GNOME_SHELL_LIBS)	\
	$(BLUETOOTH_LIBS)	\
	libst-1.0.la       	\
	libtray.la		\
	libgvc.la		\
	$(NULL)

libgnome_shell_la_CPPFLAGS = $(gnome_shell_cflags)

Shell-0.1.gir: libgnome-shell.la St-1.0.gir
Shell_0_1_gir_INCLUDES = Clutter-1.0 ClutterX11-1.0 Meta-3.0 TelepathyGLib-0.12 TelepathyLogger-0.2 Soup-2.4 GMenu-3.0 NetworkManager-1.0 NMClient-1.0 Folks-0.6
Shell_0_1_gir_CFLAGS = $(libgnome_shell_la_CPPFLAGS) -I $(srcdir)
Shell_0_1_gir_LIBS = libgnome-shell.la
Shell_0_1_gir_FILES = $(libgnome_shell_la_gir_sources)
Shell_0_1_gir_SCANNERFLAGS = --include-uninstalled=$(builddir)/St-1.0.gir \
	--add-include-path=$(MUTTER_GIR_DIR)
INTROSPECTION_GIRS += Shell-0.1.gir
CLEANFILES += Shell-0.1.gir

St-1.0.gir: libst-1.0.la
St_1_0_gir_INCLUDES = Clutter-1.0 Gtk-3.0
St_1_0_gir_CFLAGS = $(st_cflags) -DST_COMPILATION
St_1_0_gir_LIBS = libst-1.0.la
St_1_0_gir_FILES = $(filter-out %-private.h $(st_non_gir_sources), $(addprefix $(srcdir)/,$(st_source_h))) \
	$(addprefix $(srcdir)/,$(st_source_c))
INTROSPECTION_GIRS += St-1.0.gir
CLEANFILES += St-1.0.gir
