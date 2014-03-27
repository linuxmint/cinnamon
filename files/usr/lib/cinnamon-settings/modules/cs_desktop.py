#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio

class Module:
    def __init__(self, content_box):
        keywords = _("desktop, home, button, trash")
        sidePage = SidePage(_("Desktop"), "cs-desktop", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "desktop"
        self.category = "prefs"
        self.comment = _("Manage your desktop icons")

    def _loadCheck(self):
        if 'org.nemo' in Gio.Settings.list_schemas():            
            return True
        else:
            return False

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Desktop module"
            nemo_desktop_schema = Gio.Settings.new("org.nemo.desktop")
            nemo_desktop_keys = nemo_desktop_schema.list_keys()

            bg = SectionBg()        
            self.sidePage.add_widget(bg)
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            bg.add(vbox)

            section = Section(_("Desktop Icons"))            
            label = Gtk.Label()
            label.set_markup("<i><small>%s</small></i>" % _("Select the items you want to see on the desktop:"))
            label.get_style_context().add_class("dim-label")
            section.add(label)
            if "computer-icon-visible" in nemo_desktop_keys:
                section.add(GSettingsCheckButton(_("Computer"), "org.nemo.desktop", "computer-icon-visible", None))
            if "home-icon-visible" in nemo_desktop_keys:
                section.add(GSettingsCheckButton(_("Home"), "org.nemo.desktop", "home-icon-visible", None))
            if "trash-icon-visible" in nemo_desktop_keys:
                section.add(GSettingsCheckButton(_("Trash"), "org.nemo.desktop", "trash-icon-visible", None))
            if "volumes-visible" in nemo_desktop_keys:
                section.add(GSettingsCheckButton(_("Mounted volumes"), "org.nemo.desktop", "volumes-visible", None))
            if "network-icon-visible" in nemo_desktop_keys:
                section.add(GSettingsCheckButton(_("Network"), "org.nemo.desktop", "network-icon-visible", None))
            vbox.add(section)
