#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio

class Module:
    def __init__(self, content_box):
        keywords = _("desktop, home, button, trash")
        sidePage = SidePage(_("Desktop"), "cs-desktop", keywords, content_box,
                            module=self)
        self.sidePage = sidePage
        self.name = "desktop"
        self.category = "prefs"
        self.comment = _("Manage your desktop icons")

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

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.sidePage.add_widget(vbox)

        show_desktop_icons_key = "show-desktop-icons"        
        if show_desktop_icons_key in nemo_desktop_keys:            
            section = Section(_("Desktop Icons"))
            label = Gtk.Label()
            label.set_markup("<i><small>%s</small></i>" % _("Select the items you want to see on the desktop:"))
            label.get_style_context().add_class("dim-label")
            section.add(label)

            section.add(GSettingsCheckButton(_("Show desktop icons"), schema, show_desktop_icons_key, None))   
        
            options = [
                ("computer-icon-visible", _("Computer")),
                ("home-icon-visible", _("Home")),
                ("trash-icon-visible", _("Trash")),
                ("volumes-visible", _("Mounted volumes")),
                ("network-icon-visible", _("Network"))
            ]
                   
            for key, label in options:
                if key in nemo_desktop_keys:
                    section.add_indented(GSettingsCheckButton(label, schema, key, "%s/%s" % (schema, show_desktop_icons_key)))
           
            vbox.add(section)
