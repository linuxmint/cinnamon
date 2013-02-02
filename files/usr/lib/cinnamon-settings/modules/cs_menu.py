#!/usr/bin/env python

from SettingsWidgets import *

class DoubleListFrame(Gtk.Frame):
    def __init__(self, label):
        Gtk.Frame.__init__(self)
        
        self.set_label(label)
        
        outerbox = Gtk.HBox(True, 0)
        self.leftBox = Gtk.VBox(True, 0)
        self.rightBox = Gtk.VBox(True, 0)
        outerbox.pack_start(self.leftBox, True, True, 5)
        outerbox.pack_start(self.rightBox, True, True, 5)
        self.add(outerbox)
        
    def add_left(self, widget):
        self.leftBox.add(widget)
    def add_right(self, widget):
        self.rightBox.add(widget)

class Module:
    def __init__(self, content_box):
        keywords = _("menu, start, bookmarks, places, recent")
        advanced = False
        sidePage = SidePage(_("Menu"), "menu.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "menu"
        sidePage.add_widget(GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text", None))
        sidePage.add_widget(GSettingsFileChooser(_("Menu icon"), "org.cinnamon", "menu-icon", None, True))
        sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(GSettingsCheckButton(_("Activate menu on hover"), "org.cinnamon", "activate-menu-applet-on-hover", None))
        
        visibleItemsFrame = DoubleListFrame(_("Visible Items"))
        sidePage.add_widget(visibleItemsFrame)
        
        visibleItemsFrame.add_left(GSettingsCheckButton(_("Bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        visibleItemsFrame.add_left(GSettingsCheckButton(_("Recent files"), "org.cinnamon", "menu-show-recent", None))
        visibleItemsFrame.add_right(GSettingsCheckButton(_("Favorites"), "org.cinnamon", "menu-show-favorites", None))
        visibleItemsFrame.add_right(GSettingsCheckButton(_("System buttons"), "org.cinnamon", "menu-show-system-buttons", None))
        visibleItemsFrame.add_left(GSettingsCheckButton(_("Selected application title"), "org.cinnamon", "menu-show-appinfo-title", None))
        visibleItemsFrame.add_right(GSettingsCheckButton(_("Selected application description"), "org.cinnamon", "menu-show-appinfo-description", None))

