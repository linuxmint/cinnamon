#!/usr/bin/env python


import settings
from settings import *

class Module:
    def __init__(self, content_box):
        sidePage = SidePage(_("Hot corner"), "overview.svg", content_box)
        self.sidePage = sidePage
        sidePage.add_widget(GSettingsCheckButton(_("Hot corner icon visible"), "org.cinnamon", "overview-corner-visible", None))
        sidePage.add_widget(GSettingsCheckButton(_("Hot corner enabled"), "org.cinnamon", "overview-corner-hover", None))
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Hot corner position:"))
        box.add(label)
        positions = [["topLeft", _("Top left")], ["topRight", _("Top right")], ["bottomLeft", _("Bottom left")], ["bottomRight", _("Bottom right")]]
        box.add(GSettingsComboBox("", "org.cinnamon", "overview-corner-position", "org.cinnamon/overview-corner-hover", positions))
        sidePage.add_widget(box)

        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Hot corner function:"))
        box.add(label)
        cornerfunctions = [["expo", _("Workspace selection (ala Compiz Expo)")], ["scale", _("Window selection (ala Compiz Scale)")]]
        box.add(GSettingsComboBox("", "org.cinnamon", "overview-corner-functionality", "org.cinnamon/overview-corner-hover", cornerfunctions))
        sidePage.add_widget(box)

        sidePage.add_widget(GSettingsCheckButton(_("Expo applet: activate on hover"), "org.cinnamon", "expo-applet-hover", None))
        sidePage.add_widget(GSettingsCheckButton(_("Scale applet: activate on hover"), "org.cinnamon", "scale-applet-hover", None))