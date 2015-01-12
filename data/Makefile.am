desktopdir=$(datadir)/applications
desktop_DATA = cinnamon.desktop

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
dist_theme_DATA = \
    theme/add-workspace-hover.svg  \
    theme/add-workspace.svg        \
    theme/calendar-arrow-left.svg  \
    theme/calendar-arrow-left-hover.svg  \
    theme/calendar-arrow-right.svg \
    theme/calendar-arrow-right-hover.svg \
    theme/checkbox-off.svg         \
    theme/checkbox.svg             \
    theme/cinnamon.css             \
    theme/close.svg                \
    theme/close-window.svg         \
    theme/corner-ripple.png        \
    theme/menu.svg                 \
    theme/overview-hover.png       \
    theme/overview.png             \
    theme/player-paused.svg        \
    theme/player-playing.svg       \
    theme/player-stopped.svg       \
    theme/process-working.svg      \
    theme/radiobutton-off.svg      \
    theme/radiobutton.svg          \
    theme/thumbnail-generic.png    \
    theme/thumbnail.png            \
    theme/switch-off.svg           \
    theme/switch-on.svg            \
    theme/trash-icon.png           \
    theme/workspace-shadow.png

gsettings_SCHEMAS = org.cinnamon.gschema.xml

@INTLTOOL_XML_NOMERGE_RULE@
@GSETTINGS_RULES@

# We need to compile schemas at make time
# to run from source tree
gschemas.compiled: $(gsettings_SCHEMAS:.xml=.valid)
	$(AM_V_GEN) $(GLIB_COMPILE_SCHEMAS) --targetdir=. .

all-local: gschemas.compiled

EXTRA_DIST =						\
	cinnamon.desktop.in.in			\
	$(menu_DATA)					\
	org.cinnamon.gschema.xml.in

CLEANFILES =						\
	cinnamon.desktop.in				\
	$(desktop_DATA)					\
	$(gsettings_SCHEMAS)				\
	gschemas.compiled

SUBDIRS = \
	icons    \
	$(NULL)

