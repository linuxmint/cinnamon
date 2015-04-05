#!/usr/bin/env python2

from SettingsWidgets import *
from gi.repository import Gio

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
        schema = "org.nemo.desktop"
        nemo_desktop_schema = Gio.Settings.new(schema)
        nemo_desktop_keys = nemo_desktop_schema.list_keys()

        page = SettingsPage()
        self.sidePage.add_widget(page)

        show_desktop_icons_key = "show-desktop-icons"
        if show_desktop_icons_key in nemo_desktop_keys:
            switch = GSettingsSwitch("", schema, show_desktop_icons_key)
            switch.fill_row()
            switch.label.set_markup("<b>%s</b>" % _("Show desktop icons"))
            page.add(switch)

            settings = page.add_reveal_section(_("Desktop Icons"), schema, show_desktop_icons_key)

            options = [
                ("computer-icon-visible", _("Computer")),
                ("home-icon-visible", _("Home")),
                ("trash-icon-visible", _("Trash")),
                ("volumes-visible", _("Mounted volumes")),
                ("network-icon-visible", _("Network"))
            ]

            for key, label in options:
                if key in nemo_desktop_keys:
                    settings.add_row(GSettingsSwitch(label, schema, key))
