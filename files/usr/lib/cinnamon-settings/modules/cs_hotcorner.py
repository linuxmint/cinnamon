#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio

class Module:
    def __init__(self, content_box):
        keywords = _("hotcorner, overview, scale, expo")
        advanced = True
        sidePage = HotCornerViewSidePage(_("Hot corner"), "overview.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "hotcorner"
        self.category = "prefs"

class HotCornerViewSidePage(SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box)

        self.hc_list = Gtk.ListStore(int, str)

        self.hc_list.append([0, _("Top Left")])
        self.hc_list.append([1, _("Top Right")])
        self.hc_list.append([2, _("Bottom Left")])
        self.hc_list.append([3, _("Bottom Right")])

        self.function_list = Gtk.ListStore(str, str)
        self.function_list.append(['expo', "Expo"])
        self.function_list.append(['scale', "Scale"])
        self.function_list.append(['custom', _("Custom")])

        self.hc_selected = 0

        self.custom_command = ""
        
        self.settings = Gio.Settings.new('org.cinnamon')
        self.settings.connect('changed::overview-corner', self.on_settings_changed)
        oc_list = self.settings.get_strv("overview-corner")
        self.properties = []
        for item in oc_list:
            props = item.split(":")
            self.properties.append(props)

        self.enabled_check_button = None
        self.visible_check_button = None

    def on_settings_changed(self, settings, key):
        oc_list = self.settings.get_strv("overview-corner")
        del self.properties[:]
        for item in oc_list:
            props = item.split(":")
            self.properties.append(props)
        self.update()

    def update(self):
        if self.enabled_check_button != None:
            self.enabled_check_button.set_active(self.properties[self.hc_selected][1] == "true")
            self.visible_check_button.set_active(self.properties[self.hc_selected][2] == "true")
            action_no = 2
            action = self.properties[self.hc_selected][0]
            if action == "expo":
                action_no = 0
            elif action == "scale":
                action_no = 1
            self.func_combo.set_active(action_no)

    def build(self, advanced):
        # Clear all existing widgets
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        # Hot corner position
        pos_box = Gtk.Box(Gtk.Orientation.HORIZONTAL)
        self.content_box.pack_start(pos_box, False, False, 0)

        pos_label = Gtk.Label(_("Hot corner position:"))
        pos_box.pack_start(pos_label, False, False, 0)

        pos_combo = Gtk.ComboBox.new_with_model(self.hc_list)
        renderer_text= Gtk.CellRendererText()
        pos_combo.pack_start(renderer_text, True)
        pos_combo.add_attribute(renderer_text, "text", 1)
        pos_combo.set_active(0)
        pos_combo.connect('changed', self.on_pos_changed)
        pos_box.pack_start(pos_combo, True, True, 0)

        label = Gtk.Label()
        label.set_markup("<i><small>Select the hot corner you wish to configure</small></i>")
        self.content_box.pack_start(label, False, False, 0)

        # Hot corner enabled
        box = IndentedHBox()
        self.enabled_check_button = Gtk.CheckButton(_("Hot corner enabled"))
        box.add(self.enabled_check_button)
        self.content_box.pack_start(box, False, False, 0)

        # Hot corner icon visible
        box = IndentedHBox()
        self.visible_check_button = Gtk.CheckButton(_("Hot corner icon visible"))
        box.add(self.visible_check_button)
        self.content_box.pack_start(box, False, False, 0)

        # Hot corner function
        box = IndentedHBox()
        box.add(Gtk.Label(_("Hot corner function:")))
        self.func_combo = Gtk.ComboBox.new_with_model(self.function_list)
        renderer_text = Gtk.CellRendererText()
        self.func_combo.pack_start(renderer_text, True)
        self.func_combo.add_attribute(renderer_text, "text", 1)
        box.add(self.func_combo)
        self.content_box.pack_start(box, False, False, 0)

        # Hot corner custom function
        box = IndentedHBox()
        box2 = IndentedHBox() # Indent by two levels
        box2.add(box)
        self.content_box.pack_start(box2, False, False, 0)

        box2.add(Gtk.Label(_("Enter custom command: ")))
        self.custom_command_entry = Gtk.Entry()
        box2.add(self.custom_command_entry)

        # Signals
        self.enabled_check_button.connect('toggled', self.on_enabled_changed)
        self.visible_check_button.connect('toggled', self.on_visible_changed)
        self.func_combo.connect('changed', self.on_func_combo_changed)
        self.custom_command_entry.connect('changed', self.on_search_entry_changed)
        self.on_settings_changed(self.settings, "overview-corner")
        self.content_box.show_all()

    def on_pos_changed(self, widget):
        titer = widget.get_active_iter()
        if titer != None:
            self.hc_selected = self.hc_list[titer][0]
            self.update()

    def on_enabled_changed(self, widget):
        value = "false"
        if widget.get_active():
            value = "true"
        self.properties[self.hc_selected][1] = value
        self.write_settings()

    def on_visible_changed(self, widget):
        value = "false"
        if widget.get_active():
            value = "true"
        self.properties[self.hc_selected][2] = value
        self.write_settings()

    def on_func_combo_changed(self, widget):
        value = widget.get_active()
        if value == 2:
            self.custom_command_entry.set_sensitive(True)
            value = self.properties[self.hc_selected][0]
            if value == "expo" or value == "scale":
                value = ""
            self.custom_command_entry.set_text(value)
        else:
            self.custom_command_entry.set_sensitive(False)
            self.custom_command_entry.set_text("")
            titer = widget.get_active_iter()
            self.properties[self.hc_selected][0] = self.function_list[titer][0]
            self.write_settings()

    def on_search_entry_changed(self, widget):
        if self.func_combo.get_active() == 2:
            self.properties[self.hc_selected][0] = widget.get_text()
            self.write_settings()

    def write_settings(self):
        oc_list = []
        for prop in self.properties:
            oc_list.append(":".join(prop))
        self.settings.set_strv("overview-corner", oc_list)

