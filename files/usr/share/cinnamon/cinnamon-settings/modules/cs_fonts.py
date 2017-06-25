#!/usr/bin/python2

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk

from GSettingsWidgets import *


class Module:
    name = "fonts"
    category = "appear"
    comment = _("Configure system fonts")

    def __init__(self, content_box):
        keywords = _("font, size, small, large")
        sidePage = SidePage(_("Fonts"), "cs-fonts", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Fonts module"

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("Font Selection"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            widget = GSettingsFontButton(_("Default font"), "org.cinnamon.desktop.interface", "font-name", size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsFontButton(_("Desktop font"), "org.nemo.desktop", "font", size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsFontButton(_("Document font"), "org.gnome.desktop.interface", "document-font-name", size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsFontButton(_("Monospace font"), "org.gnome.desktop.interface", "monospace-font-name", size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsFontButton(_("Window title font"), "org.cinnamon.desktop.wm.preferences", "titlebar-font", size_group=size_group)
            settings.add_row(widget)

            settings = page.add_section(_("Font Settings"))

            aa_options = [["none", _("None")], ["grayscale", _("Grayscale")], ["rgba", _("Rgba")]]
            hinting_options = [["none", _("None")], ["slight", _("Slight")], ["medium", _("Medium")], ["full", _("Full")]]
            rgba_options = [["rgba", _("Rgba")], ["rgb", _("Rgb")], ["bgr", _("Bgr")], ["vrgb", _("Vrgb")], ["vbgr", _("Vbgr")]]

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
            widget = GSettingsSpinButton(_("Text scaling factor"), "org.cinnamon.desktop.interface", "text-scaling-factor", step=0.1, size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsComboBox(_("Antialiasing"), "org.cinnamon.settings-daemon.plugins.xsettings", "antialiasing", aa_options, size_group=size_group)
            widget.set_tooltip_text(_("Antialiasing makes on screen text smoother and easier to read"))
            settings.add_row(widget)

            widget = GSettingsComboBox(_("Hinting"), "org.cinnamon.settings-daemon.plugins.xsettings", "hinting", hinting_options, size_group=size_group)
            widget.set_tooltip_text(_("Hinting allows for producing clear, legible text on screen."))
            settings.add_row(widget)

            widget = GSettingsComboBox(_("RGBA order"), "org.cinnamon.settings-daemon.plugins.xsettings", "rgba-order", rgba_options, size_group=size_group)
            widget.set_tooltip_text(_("The order of subpixel elements on an LCD screen, only used when antialiasing is set to 'rgba'"))
            settings.add_row(widget)
