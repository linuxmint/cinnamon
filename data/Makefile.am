desktopdir=$(datadir)/applications
desktop_DATA = gnome-shell.desktop

# We substitute in bindir so it works as an autostart
# file when built in a non-system prefix
%.desktop.in:%.desktop.in.in
	$(AM_V_GEN) sed -e "s|@bindir[@]|$(bindir)|" \
	    -e "s|@VERSION[@]|$(VERSION)|" \
	    $< > $@ || rm $@

# Placeholder until we add intltool
%.desktop:%.desktop.in
	$(AM_V_GEN) sed s/^_// < $< > $@ || rm $@

searchprovidersdir = $(pkgdatadir)/search_providers
dist_searchproviders_DATA =				\
	search_providers/google.xml				\
	search_providers/wikipedia.xml

themedir = $(pkgdatadir)/theme
dist_theme_DATA =				\
	theme/calendar-arrow-left.svg		\
	theme/calendar-arrow-right.svg		\
	theme/calendar-today.svg		\
	theme/close-window.svg			\
	theme/close.svg				\
	theme/corner-ripple-ltr.png		\
	theme/corner-ripple-rtl.png		\
	theme/dash-placeholder.svg		\
	theme/filter-selected-ltr.svg		\
	theme/filter-selected-rtl.svg		\
	theme/gdm.css				\
	theme/gnome-shell.css			\
	theme/panel-border.svg			\
	theme/panel-button-border.svg		\
	theme/panel-button-highlight-narrow.svg	\
	theme/panel-button-highlight-wide.svg	\
	theme/process-working.svg		\
	theme/running-indicator.svg		\
	theme/scroll-hhandle.svg		\
	theme/scroll-vhandle.svg		\
	theme/source-button-border.svg		\
	theme/toggle-off-us.svg			\
	theme/toggle-off-intl.svg		\
	theme/toggle-on-us.svg			\
	theme/toggle-on-intl.svg		\
	theme/ws-switch-arrow-up.svg		\
	theme/ws-switch-arrow-down.svg

gsettings_SCHEMAS = org.gnome.shell.gschema.xml

@INTLTOOL_XML_NOMERGE_RULE@
@GSETTINGS_RULES@

# We need to compile schemas at make time
# to run from source tree
gschemas.compiled: $(gsettings_SCHEMAS:.xml=.valid)
	$(AM_V_GEN) $(GLIB_COMPILE_SCHEMAS) --targetdir=. .

all-local: gschemas.compiled


# GConf schemas: provide defaults for keys from Metacity we are overriding
gconfschemadir  = @GCONF_SCHEMA_FILE_DIR@
gconfschema_DATA = gnome-shell.schemas

shadersdir = $(pkgdatadir)/shaders
shaders_DATA = \
	shaders/dim-window.glsl

install-data-local:
	GCONF_CONFIG_SOURCE=$(GCONF_SCHEMA_CONFIG_SOURCE) $(GCONFTOOL) --makefile-install-rule $(srcdir)/$(gconfschema_DATA)



EXTRA_DIST =						\
	gnome-shell.desktop.in.in			\
	$(menu_DATA)					\
	$(gconfschema_DATA)				\
	$(shaders_DATA)					\
	org.gnome.shell.gschema.xml.in

CLEANFILES =						\
	gnome-shell.desktop.in				\
	$(desktop_DATA)					\
	$(gsettings_SCHEMAS)				\
	gschemas.compiled

