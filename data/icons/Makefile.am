NULL =

public_icons_themes = \
	hicolor	\
	$(NULL)

public_icons = \
	hicolor_actions_scalable_pan-down-symbolic.svg \
	hicolor_actions_scalable_pan-end-symbolic.svg \
	hicolor_actions_scalable_pan-end-symbolic-rtl.svg \
	hicolor_actions_scalable_pan-start-symbolic.svg \
	hicolor_actions_scalable_pan-start-symbolic-rtl.svg \
	hicolor_actions_scalable_pan-up-symbolic.svg \
    hicolor_actions_scalable_caps-lock-symbolic.svg \
    hicolor_actions_scalable_caps-lock-off-symbolic.svg \
    hicolor_actions_scalable_num-lock-symbolic.svg \
    hicolor_actions_scalable_num-lock-off-symbolic.svg \
	hicolor_categories_16x16_cs-desklets.svg \
	hicolor_categories_16x16_cs-backgrounds.svg \
	hicolor_categories_scalable_cs-applets.svg \
	hicolor_categories_scalable_cs-backgrounds.svg \
	hicolor_categories_scalable_cs-bluetooth.svg \
	hicolor_categories_scalable_cs-cat-admin.svg \
	hicolor_categories_scalable_cs-cat-appearance.svg \
	hicolor_categories_scalable_cs-cat-hardware.svg \
	hicolor_categories_scalable_cs-cat-prefs.svg \
	hicolor_categories_scalable_cs-color.svg \
	hicolor_categories_scalable_cs-date-time.svg \
	hicolor_categories_scalable_cs-default-applications.svg \
	hicolor_categories_scalable_cs-desklets.svg \
	hicolor_categories_scalable_cs-desktop-effects.svg \
	hicolor_categories_scalable_cs-desktop.svg \
	hicolor_categories_scalable_cs-details.svg \
	hicolor_categories_scalable_cs-display.svg \
	hicolor_categories_scalable_cs-drivers.svg \
	hicolor_categories_scalable_cs-extensions.svg \
	hicolor_categories_scalable_cs-firewall.svg \
	hicolor_categories_scalable_cs-fonts.svg \
	hicolor_categories_scalable_cs-general.svg \
	hicolor_categories_scalable_cs-input-method.svg \
	hicolor_categories_scalable_cs-keyboard.svg \
	hicolor_categories_scalable_cs-language.svg \
	hicolor_categories_scalable_cs-linuxmint.svg \
	hicolor_categories_scalable_cs-login.svg \
	hicolor_categories_scalable_cs-mouse.svg \
	hicolor_categories_scalable_cs-network.svg \
	hicolor_categories_scalable_cs-notifications.svg \
	hicolor_categories_scalable_cs-overview.svg \
	hicolor_categories_scalable_cs-panel.svg \
	hicolor_categories_scalable_cs-power.svg \
	hicolor_categories_scalable_cs-printer.svg \
	hicolor_categories_scalable_cs-privacy.svg \
	hicolor_categories_scalable_cs-region.svg \
	hicolor_categories_scalable_cs-retro.svg \
	hicolor_categories_scalable_cs-screensaver.svg \
	hicolor_categories_scalable_cs-screen.svg \
	hicolor_categories_scalable_cs-sound.svg \
	hicolor_categories_scalable_cs-sources.svg \
	hicolor_categories_scalable_cs-startup-programs.svg \
	hicolor_categories_scalable_cs-tablet.svg \
	hicolor_categories_scalable_cs-themes.svg \
	hicolor_categories_scalable_cs-tiling.svg \
	hicolor_categories_scalable_cs-universal-access.svg \
	hicolor_categories_scalable_cs-user-accounts.svg \
	hicolor_categories_scalable_cs-user.svg \
	hicolor_categories_scalable_cs-windows.svg \
	hicolor_categories_scalable_cs-workspaces.svg \
	hicolor_emblems_scalable_cs-xlet-error.svg \
	hicolor_emblems_scalable_cs-xlet-installed.svg \
	hicolor_emblems_scalable_cs-xlet-running.svg \
	hicolor_emblems_scalable_cs-xlet-system.svg \
	hicolor_emblems_scalable_cs-xlet-update.svg \
	hicolor_devices_scalable_audio-speaker-left.svg \
	hicolor_devices_scalable_audio-speaker-center.svg \
	hicolor_devices_scalable_audio-speaker-right.svg \
	hicolor_devices_scalable_audio-speaker-left-back.svg \
	hicolor_devices_scalable_audio-speaker-center-back.svg \
	hicolor_devices_scalable_audio-speaker-right-back.svg \
	hicolor_devices_scalable_audio-speaker-left-side.svg \
	hicolor_devices_scalable_audio-speaker-right-side.svg \
	hicolor_devices_scalable_audio-subwoofer.svg \
	$(NULL)

EXTRA_DIST = \
	$(public_icons)		\
	$(NULL)


###############################################################################

gtk_update_icon_cache = gtk-update-icon-cache -f -t

update-icon-cache:
	@-if test -z "$(DESTDIR)"; then \
		echo "Updating Gtk icon cache."; \
		for theme in $(public_icons_themes); do \
			$(gtk_update_icon_cache) $(datadir)/icons/$$theme; \
		done; \
	else \
		echo "*** Icon cache not updated.  After (un)install, run this:"; \
		for theme in $(public_icons_themes); do \
			echo "***   $(gtk_update_icon_cache) $(datadir)/icons/$$theme"; \
		done; \
	fi

install-icons:
	for icon in $(public_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		mkdir -p $(DESTDIR)$(datadir)/icons/$$THEME/$$SIZE/$$CONTEXT; \
		$(INSTALL_DATA) $(srcdir)/$$icon $(DESTDIR)$(datadir)/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done; \
	for icon in $(private_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		mkdir -p $(DESTDIR)$(pkgdatadir)/icons/$$THEME/$$SIZE/$$CONTEXT; \
		$(INSTALL_DATA) $(srcdir)/$$icon $(DESTDIR)$(pkgdatadir)/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done

uninstall-icons:
	-for icon in $(public_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		rm -f $(DESTDIR)$(datadir)/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done; \
	for icon in $(private_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		rm -f $(DESTDIR)$(pkgdatadir)/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done

install-data-local: install-icons update-icon-cache

uninstall-local: uninstall-icons update-icon-cache
