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
        sidePage = SidePage(_("Menu"), "menu.svg", content_box)
        self.sidePage = sidePage
        self.name = "menu"
        sidePage.add_widget(GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text", None))
        sidePage.add_widget(GSettingsFileChooser(_("Menu icon"), "org.cinnamon", "menu-icon", None, True))
        sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(GSettingsCheckButton(_("Activate menu on hover"), "org.cinnamon", "activate-menu-applet-on-hover", None))
        
        visibleItemsFrame = DoubleListFrame(_("Visible Items"))
        sidePage.add_widget(visibleItemsFrame)
        
        visibleItemsFrame.add_left(GSettingsCheckButton(_("Show bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        visibleItemsFrame.add_left(GSettingsCheckButton(_("Show recent files"), "org.cinnamon", "menu-show-recent", None))
        visibleItemsFrame.add_right(GSettingsCheckButton(_("Show favorites"), "org.cinnamon", "menu-show-favorites", None))
        visibleItemsFrame.add_right(GSettingsCheckButton(_("Show system buttons"), "org.cinnamon", "menu-show-system-buttons", None))
        
        appInfoFrame = DoubleListFrame(_("Selected Application Information"))
        sidePage.add_widget(appInfoFrame)
        
        appInfoFrame.add_left(GSettingsCheckButton(_("Show title"), "org.cinnamon", "menu-show-appinfo-title", None))
        appInfoFrame.add_left(GSettingsCheckButton(_("Show description"), "org.cinnamon", "menu-show-appinfo-description", None))
        appInfoFrame.add_right(GSettingsCheckButton(_("Align title and description right"), "org.cinnamon", "menu-align-appinfo-right", None))
        appInfoFrame.add_right(GSettingsCheckButton(_("Use multiple lines for description"), "org.cinnamon", "menu-use-multiline-appinfo", None))

        sidePage.add_widget(GSettingsCheckButton(_("Flip searchbox and selected application information"), "org.cinnamon", "menu-flip-search-appinfo", None))
