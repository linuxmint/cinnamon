#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage
from gi.repository import Gtk
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("desklet, desktop, slideshow")
        advanced = False
        self.name = "desklets"
        # for i18n replacement in ExtensionCore.py
        noun = _("desklet")
        pl_noun = _("desklets")
        target = _("desktop")
        sidePage = DeskletsViewSidePage(_("Desklets"), "desklets.svg", keywords, advanced, content_box, "desklet", noun, pl_noun, target)
        self.sidePage = sidePage

        self.category = "prefs"

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class DeskletsViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target):
        self.RemoveString = _("You can remove specific instances from the desktop via that desklet's context menu")
        ExtensionSidePage.__init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target)

    def toSettingString(self, uuid, instanceId):
        return ("%s:%d:0:100") % (uuid, instanceId)

    def fromSettingString(self, string):
        uuid, instanceId, x, y = string.split(":")
        return uuid

    def getAdditionalPage(self):
        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.label = Gtk.Label(_("General Desklets Settings"))
        config_vbox = Gtk.VBox()
        scrolled_window.add_with_viewport(config_vbox)
        config_vbox.set_border_width(5)

        dec = [[0, _("No decoration")], [1, _("Border only")], [2, _("Border and header")]]
        dec_combo = GSettingsIntComboBox(_("Decoration of desklets"), "org.cinnamon", "desklet-decorations", dec)

        label = Gtk.Label()
        label.set_markup("<i><small>%s\n%s</small></i>" % (_("Note: Some desklets require the border/header to be always present"), _("Such requirements override the settings selected here")))

        desklet_snap = GSettingsCheckButton(_("Snap desklets to grid"), "org.cinnamon", "desklet-snap", None)
        desklet_snap_interval = GSettingsSpinButton(_("Width of desklet snap grid"), "org.cinnamon", "desklet-snap-interval", "org.cinnamon/desklet-snap", 0, 100, 1, 5, "")

        config_vbox.pack_start(dec_combo, False, False, 2)
        config_vbox.pack_start(label, False, False, 2)
        config_vbox.pack_start(desklet_snap, False, False, 2)
        config_vbox.pack_start(desklet_snap_interval, False, False, 2)

        return scrolled_window