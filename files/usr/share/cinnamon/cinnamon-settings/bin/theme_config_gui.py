#!/usr/bin/python3

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
gi.require_version('Gdk', '3.0')
from gi.repository import Gdk
from gi.repository import Gio, GLib
import gettext
import json
import sys
import os
import subprocess
import shutil
import string
import random
import time

gettext.install("cinnamon", "/usr/share/locale")

desktop_environment = "Cinnamon"

class OptionsWindow(Gtk.Window):
    def __init__(self, theme_path, desktop_environment):
        super().__init__(title="")

        self.desktop_environment = desktop_environment

        self.current_theme_dir = theme_path
        self.current_theme_name = os.path.basename(self.current_theme_dir)
        
        self.set_default_size(500, 100)
        
        box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 15)
        box.set_margin_top(20)
        box.set_margin_bottom(20)
        box.set_margin_start(35)
        box.set_margin_end(35)
        self.add(box)
        self.set_icon_name("applications-graphics")
        
        self.load_config_file()
        theme_name = self.options.get("theme_name", "")
        self.set_title(_("%s theme options") % theme_name)

        self.widgets = {}
        
        for option in self.options["options"]:
            desktops = option["desktop"]
            if isinstance(desktops, str):
                desktops = [desktops]
            if not ("all" in desktops or self.desktop_environment in desktops):
                continue

            if option["type"] == "combo":
                combobox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 10)
                combobox_label = Gtk.Label.new(option["label"])
                combobox_label.set_halign(Gtk.Align.START)
                combobox.pack_start(combobox_label, True, True, 0)
                combo_widget = Gtk.ComboBoxText.new()
                for label in option["labels"]:
                    combo_widget.append_text(label)
                combo_widget.set_active(option["value"])
                combo_widget.set_halign(Gtk.Align.END)
                combo_widget.connect("changed", self.on_setting_changed)
                combobox.pack_start(combo_widget, True, True, 0)
                box.pack_start(combobox, False, True, 0)
                self.widgets[option["name"]] = combo_widget
            elif option["type"] == "switch":
                switchbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 10)
                switchbox_label = Gtk.Label.new(option["label"])
                switchbox_label.set_halign(Gtk.Align.START)
                switchbox.pack_start(switchbox_label, True, True, 0)
                switch = Gtk.Switch.new()
                switch.set_active(option["value"])
                switch.set_halign(Gtk.Align.END)
                switch.set_valign(Gtk.Align.CENTER)
                switch.connect("state-set", self.on_setting_changed)
                switchbox.pack_start(switch, True, True, 0)
                box.pack_start(switchbox, False, True, 0)
                self.widgets[option["name"]] = switch
            elif option["type"] == "color-chooser":
                colorbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 10)
                colorbox_label = Gtk.Label.new(option["label"])
                colorbox_label.set_halign(Gtk.Align.START)
                colorbox.pack_start(colorbox_label, True, True, 0)
                colorButton = Gtk.ColorButton.new()
                color = Gdk.RGBA()
                color.parse(option["value"])
                colorButton.set_rgba(color)
                colorButton.set_halign(Gtk.Align.END)
                colorButton.set_valign(Gtk.Align.CENTER)
                colorButton.connect("color-set", self.on_setting_changed)
                colorbox.pack_start(colorButton, True, True, 0)
                box.pack_start(colorbox, False, True, 0)
                self.widgets[option["name"]] = colorButton
            elif option["type"] == "spinbutton":
                spinbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 10)
                spinbox_label = Gtk.Label.new(option["label"])
                spinbox_label.set_halign(Gtk.Align.START)
                spinbox.pack_start(spinbox_label, True, True, 0)
                spinbutton = Gtk.SpinButton.new_with_range(option["min"],option["max"],option["step"])
                spinbutton.set_value(option["value"])
                spinbutton.set_snap_to_ticks(True)
                spinbutton.set_halign(Gtk.Align.END)
                spinbutton.set_valign(Gtk.Align.CENTER)
                spinbutton.connect("changed", self.on_setting_changed)
                spinbox.pack_start(spinbutton, True, True, 0)
                box.pack_start(spinbox, False, True, 0)
                self.widgets[option["name"]] = spinbutton
        
        #---------------------------
        if len(self.widgets) > 0:
            if (gsettings_get("org.cinnamon.desktop.interface", "gtk-theme") == self.current_theme_name
                                                        and os.environ["XDG_SESSION_TYPE"] == "x11"):
                restart_label = Gtk.Label.new(_("Restart Cinnamon for titlebar changes to take effect. " \
                "(Right click on panel>Troubleshoot>Restart Cinnamon.). Some apps may need to be restarted."))
                restart_label.set_line_wrap(True)
                restart_label.set_size_request(450, -1)
                box.pack_start(restart_label, False, True, 0)
            #---------------------------
            separator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
            separator.set_valign(Gtk.Align.END)
            box.pack_start(separator, False, True, 0)
            #---------------------------
            self.applybutton = Gtk.Button.new_with_label("Apply")
            self.applybutton.set_halign(Gtk.Align.CENTER)
            self.applybutton.set_valign(Gtk.Align.END)
            self.applybutton.set_sensitive(False)
            self.applybutton.connect("clicked", self.on_apply_button_clicked)
            box.pack_start(self.applybutton, True, True, 0)
        else:
            no_option_label = Gtk.Label.new(_("No configurable options for Cinnamon desktop."))
            no_option_label.set_line_wrap(True)
            box.pack_start(no_option_label, False, True, 0)
    
    def on_setting_changed(self, *args):
        self.applybutton.set_sensitive(True)

    def load_config_file(self):
        file_name = os.path.join(self.current_theme_dir, "config", "options_config.json")
        with open(file_name, "r") as file:
            self.options = json.load(file)

    def save_config_file(self):
        file_name = os.path.join(self.current_theme_dir, "config", "options_config.json")
        with open(file_name, "w") as file:
            json.dump(self.options, file, indent=4)

    def on_apply_button_clicked(self, button):
        #prepare install command and store settings
        command = [os.path.join(self.current_theme_dir, 'config', self.options["script_name"])]
        
        for option in self.options["options"]:
            desktops = option["desktop"]
            if isinstance(desktops, str):
                desktops = [desktops]
            if "all" in desktops or self.desktop_environment in desktops:
                if option["type"] == "combo":
                    command.append("--" + option["name"])
                    value = self.widgets[option["name"]].get_active()
                    option["value"] = value
                    value_id = option["ids"][value]
                    command.append(value_id)
                elif option["type"] == "switch":
                    value = self.widgets[option["name"]].get_active()
                    option["value"] = value
                    if value:
                        command.append("--" + option["name"])
                elif option["type"] == "color-chooser":
                    command.append("--" + option["name"])
                    rgba = self.widgets[option["name"]].get_rgba()
                    red = int(round(rgba.red * 255))
                    green = int(round(rgba.green * 255))
                    blue = int(round(rgba.blue * 255))
                    value = f"#{red:02x}{green:02x}{blue:02x}"
                    option["value"] = value
                    command.append(value)
                elif option["type"] == "spinbutton":
                    command.append("--" + option["name"])
                    value = self.widgets[option["name"]].get_value()
                    if value == int(value):
                        value = int(value)
                    option["value"] = value
                    command.append(str(value))
        
        #Install theme
        print ("Running..." + " ".join(command))
        subprocess.run(command, check=True)
        print("Install finished OK")
        
        #save settings
        self.save_config_file()

        #apply desktop theme
        set_theme(self.current_theme_name)

        self.applybutton.set_sensitive(False)

def gsettings_get(schema, key):
    if Gio.SettingsSchemaSource.get_default().lookup(schema, True) is not None:
        setting = Gio.Settings.new(schema)
        return setting.get_string(key)
    else:
        return ""

def gsettings_set(schema, key, value):
    if Gio.SettingsSchemaSource.get_default().lookup(schema, True) is not None:
        print ("gsettings setting " + schema + " " + key)
        setting = Gio.Settings.new(schema)
        setting.set_string(key, value)

def set_theme(current_theme_name):    
    if gsettings_get("org.cinnamon.desktop.interface",
                                "gtk-theme") == current_theme_name:
        gsettings_set("org.cinnamon.desktop.interface", "gtk-theme", "")
        gsettings_set("org.cinnamon.desktop.interface", "gtk-theme", current_theme_name)

        if gsettings_get("org.cinnamon.theme", "name") == current_theme_name:
            # wait for 1 second after updating gtk theme before updating cinnamon theme otherwise
            # cinnamon theme doesn't always update.
            GLib.timeout_add_seconds(1, reset_cinnamon_theme, (current_theme_name))
    elif gsettings_get("org.cinnamon.theme", "name") == current_theme_name:
        reset_cinnamon_theme(current_theme_name)

def reset_cinnamon_theme(current_theme_name):
    gsettings_set("org.cinnamon.theme", "name", "")
    gsettings_set("org.cinnamon.theme", "name", current_theme_name)
    return False

if __name__ == "__main__":
    Gtk.init()
    theme_path = sys.argv[1]
    win = OptionsWindow(theme_path, desktop_environment)
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()  