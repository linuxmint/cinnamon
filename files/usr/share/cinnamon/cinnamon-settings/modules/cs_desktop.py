#!/usr/bin/env python2

from gi.repository import Gio

from SettingsWidgets import *

DESKTOP_SCHEMA = "org.nemo.desktop"
LAYOUT_KEY = "desktop-layout"
ORPHANS_KEY = "show-orphaned-desktop-icons"

DESKTOPS_ON_PRIMARY = "true::false"
DESKTOPS_ON_ALL = "true::true"
DESKTOPS_ON_NON_PRIMARY = "false::true"
DESKTOPS_ON_NONE = "false::false"


class Module:
    name = "desktop"
    category = "prefs"
    comment = _("Manage your desktop icons")

    def __init__(self, content_box):
        keywords = _("desktop, home, button, trash")
        sidePage = SidePage(_("Desktop"), "cs-desktop", keywords, content_box,
                            module=self)
        self.sidePage = sidePage

    def _loadCheck(self):
        if "org.nemo" in Gio.Settings.list_schemas():
            return True
        return False

    def on_module_selected(self):
        if self.loaded:
            return

        print "Loading Desktop module"

        page = SettingsPage()
        self.sidePage.add_widget(page)

        desktop_layout_options = [[DESKTOPS_ON_NONE,         _("No desktop icons")],
                                  [DESKTOPS_ON_PRIMARY,      _("Show desktop icons on primary monitor only")],
                                  [DESKTOPS_ON_NON_PRIMARY,  _("Show desktop icons on non-primary monitor(s) only")],
                                  [DESKTOPS_ON_ALL,          _("Show desktop icons on all monitors")]]

        widget = GSettingsComboBox("", DESKTOP_SCHEMA, LAYOUT_KEY, desktop_layout_options)

        widget.fill_row()
        widget.label.set_markup("<b>%s</b>" % _("Desktop layout"))
        page.add(widget)

        settings = page.add_reveal_section(_("Desktop Icons"),
                                           DESKTOP_SCHEMA,
                                           LAYOUT_KEY,
                                           [DESKTOPS_ON_PRIMARY, DESKTOPS_ON_NON_PRIMARY, DESKTOPS_ON_ALL])

        options = [
            ("computer-icon-visible", _("Computer")),
            ("home-icon-visible", _("Home")),
            ("trash-icon-visible", _("Trash")),
            ("volumes-visible", _("Mounted volumes")),
            ("network-icon-visible", _("Network"))
        ]

        for key, label in options:
            settings.add_row(GSettingsSwitch(label, DESKTOP_SCHEMA, key))

        settings = page.add_reveal_section(_("Options"),
                                           DESKTOP_SCHEMA,
                                           LAYOUT_KEY,
                                           [DESKTOPS_ON_PRIMARY, DESKTOPS_ON_NON_PRIMARY, DESKTOPS_ON_ALL])

        switch = GSettingsSwitch(_("Allow icons from missing monitors to be displayed on the existing ones"),
                                 DESKTOP_SCHEMA,
                                 ORPHANS_KEY)

        settings.add_row(switch)
