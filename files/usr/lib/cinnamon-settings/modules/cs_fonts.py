#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository.Gtk import SizeGroup, SizeGroupMode


class Module:
    def __init__(self, content_box):
        keywords = _("font, size, small, large")
        advanced = False
        sidePage = SidePage(_("Fonts"), "fonts.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "fonts"
        self.category = "appear"
        self.comment = _("Configure system fonts")
        
        #Main Header Text
        title = Gtk.Label()
        title.set_markup("<span font_desc='10.5'><b>%s</b></span>" %(self.comment))
        sidePage.add_widget(title)
        
        #Some info about the settings
        info = Gtk.Label(_("These settings can make reading text easier, help save screen space, or simply personalize your desktop."))
        sidePage.add_widget(info)
        
        sidePage.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        
        #Label
        hbox = Gtk.HBox()
        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % _("Basic font configuration"))
        label.set_alignment(0, 0.5)
        hbox.pack_start(label, False, False, 0)
        self.sidePage.add_widget(hbox, False)
        
        sidePage.add_widget(self.make_combo_group(GSettingsFontButton, _("Default font"), "org.cinnamon.desktop.interface", "font-name", None))
        sidePage.add_widget(self.make_combo_group(GSettingsFontButton, _("Document font"), "org.gnome.desktop.interface", "document-font-name", None))
        sidePage.add_widget(self.make_combo_group(GSettingsFontButton, _("Monospace font"), "org.gnome.desktop.interface", "monospace-font-name", None))
        sidePage.add_widget(self.make_combo_group(GSettingsFontButton, _("Window title font"), "org.cinnamon.desktop.wm.preferences", "titlebar-font", None))
        
        #Label
        hbox = Gtk.HBox()
        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % _("Advanced font configuration"))
        label.set_alignment(0, 0.5)
        hbox.pack_start(label, False, False, 0)
        self.sidePage.add_widget(hbox, True)
        
        sidePage.add_widget(self.make_combo_group(GSettingsRangeSpin, _("Text scaling factor"), "org.cinnamon.desktop.interface", "text-scaling-factor", None), True)
        sidePage.add_widget(self.make_combo_group(GSettingsComboBox, _("Antialiasing"), "org.cinnamon.settings-daemon.plugins.xsettings", "antialiasing", None), True)
        sidePage.add_widget(self.make_combo_group(GSettingsComboBox, _("Hinting"), "org.cinnamon.settings-daemon.plugins.xsettings", "hinting", None), True)

    def make_combo_group(self, widget, group_label, root, key, ex1):
        self.size_groups = getattr(self, "size_groups", [SizeGroup(SizeGroupMode.HORIZONTAL) for x in range(2)])
        
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.pack_start(label, False, False, 0)

        if (key == "text-scaling-factor"):
            w = widget("", root, key, None, adjustment_step = 0.1)
        elif (key == "antialiasing"):
            w = widget("", root, key, None, [(i, i.title()) for i in ("none", "grayscale", "rgba")])
            w.set_tooltip_text(_("Antialiasing makes on screen text smoother and easier to read"))
        elif (key == "hinting"):
            w = widget("", root, key, None, [(i, i.title()) for i in ("none", "slight", "medium", "full")])
            w.set_tooltip_text(_("Hinting allows for producing clear, legible text on screen."))
        else:
            w = widget("", root, key, None)

        self.size_groups[1].add_widget(w)
        box.pack_start(w, False, False, 15)
        
        return box
