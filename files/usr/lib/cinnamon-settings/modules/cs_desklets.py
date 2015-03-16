#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage
from gi.repository import Gtk
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("desklet, desktop, slideshow")
        self.name = "desklets"
        self.comment = _("Manage your Cinnamon desklets")       
        sidePage = DeskletsViewSidePage(_("Desklets"), "cs-desklets", keywords, content_box, "desklet", self)
        self.sidePage = sidePage
        self.category = "prefs"

    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading Desklets module"
            self.sidePage.load(switch_container)
        self.sidePage.stack_switcher.show()

    def _setParentRef(self, window):
        self.sidePage.window = window

class DeskletsViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, content_box, collection_type, module):
        self.RemoveString = _("You can remove specific instances from the desktop via that desklet's context menu")
        ExtensionSidePage.__init__(self, name, icon, keywords, content_box, collection_type, module)

    def toSettingString(self, uuid, instanceId):
        screen = Gdk.Screen.get_default()
        primary = screen.get_primary_monitor()
        primary_rect = screen.get_monitor_geometry(primary)
        return ("%s:%d:%d:%d") % (uuid, instanceId, primary_rect.x + 100, primary_rect.y + 100)

    def fromSettingString(self, string):
        uuid, instanceId, x, y = string.split(":")
        return uuid

    def getAdditionalPage(self):
        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.label = _("General Desklets Settings")
        config_vbox = Gtk.VBox()
        scrolled_window.add_with_viewport(config_vbox)
        config_vbox.set_border_width(5)

        dec = [[0, _("No decoration")], [1, _("Border only")], [2, _("Border and header")]]
        dec_combo = GSettingsIntComboBox(_("Decoration of desklets"), "org.cinnamon", "desklet-decorations", None, dec)

        label = Gtk.Label()
        label.set_markup("<i><small>%s\n%s</small></i>" % (_("Note: Some desklets require the border/header to be always present"), _("Such requirements override the settings selected here")))
        label.set_alignment(0.1,0)
        

        desklet_snap = GSettingsCheckButton(_("Snap desklets to grid"), "org.cinnamon", "desklet-snap", None)
        desklet_snap_interval = GSettingsSpinButton(_("Width of desklet snap grid"), "org.cinnamon", "desklet-snap-interval", "org.cinnamon/desklet-snap", 0, 100, 1, 5, "")

        config_vbox.pack_start(dec_combo, False, False, 2)
        config_vbox.pack_start(label, False, False, 2)
        config_vbox.pack_start(desklet_snap, False, False, 2)
        config_vbox.pack_start(desklet_snap_interval, False, False, 2)

        return scrolled_window
