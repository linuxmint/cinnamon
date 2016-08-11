#!/usr/bin/env python2

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk

from ExtensionCore import ExtensionSidePage
from GSettingsWidgets import *

class Module:
    comment = _("Manage your Cinnamon desklets")
    name = "desklets"
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("desklet, desktop, slideshow")
        self.sidePage = DeskletsViewSidePage(_("Desklets"), "cs-desklets", keywords, content_box, "desklet", self)

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Desklets module"
            self.sidePage.load()

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
        page = SettingsPage()
        page.label = _("General Settings")

        settings = page.add_section(_("General Desklets Settings"))

        dec = [[0, _("No decoration")], [1, _("Border only")], [2, _("Border and header")]]
        widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        combo_box = GSettingsComboBox(_("Decoration of desklets"), "org.cinnamon", "desklet-decorations", dec, valtype="int")
        widget.pack_start(combo_box, False, False, 0)
        line1 = Gtk.Label()
        line1.set_markup("<i><small>%s</small></i>" % _("Note: Some desklets require the border/header to be always present"))
        line1.get_style_context().add_class("dim-label")
        widget.pack_start(line1, True, True, 0)
        line2 = Gtk.Label()
        line2.set_markup("<i><small>%s</small></i>" % _("Such requirements override the settings selected here"))
        line2.get_style_context().add_class("dim-label")
        widget.pack_start(line2, True, True, 0)
        settings.add_row(widget)

        settings.add_row(GSettingsSwitch(_("Snap desklets to grid"), "org.cinnamon", "desklet-snap"))
        settings.add_reveal_row(GSettingsSpinButton(_("Width of desklet snap grid"), "org.cinnamon", "desklet-snap-interval", "", 0, 100, 1, 5), "org.cinnamon", "desklet-snap")

        return page
