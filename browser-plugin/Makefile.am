
mozillalibdir = $(BROWSER_PLUGIN_DIR)

mozillalib_LTLIBRARIES = libgnome-shell-browser-plugin.la

libgnome_shell_browser_plugin_la_LDFLAGS = -module -avoid-version -no-undefined

libgnome_shell_browser_plugin_la_LIBADD = 	\
	$(BROWSER_PLUGIN_LIBS)

libgnome_shell_browser_plugin_la_SOURCES = 	\
	browser-plugin.c \
	npapi/npapi.h \
	npapi/npfunctions.h \
	npapi/npruntime.h \
	npapi/nptypes.h

libgnome_shell_browser_plugin_la_CFLAGS = 	\
	$(BROWSER_PLUGIN_CFLAGS)		\
	-DG_DISABLE_DEPRECATED			\
	-DG_LOG_DOMAIN=\"GnomeShellBrowserPlugin\"
