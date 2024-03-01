#!/usr/bin/python3

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
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
rename_theme_on_update = False

class OptionsWindow(Gtk.Window):
    def __init__(self, theme_path, desktop_environment, rename_theme_on_update):
        super().__init__(title="")

        self.desktop_environment = desktop_environment
        self.rename_theme_on_update = rename_theme_on_update

        self.current_theme_dir = theme_path
        self.current_theme_name = os.path.basename(self.current_theme_dir)
        
        self.set_default_size(500, 100)
        
        box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 5)
        box.set_margin_top(15)
        box.set_margin_bottom(15)
        box.set_margin_start(25)
        box.set_margin_end(25)
        self.add(box)
        
        self.load_config_file()
        self.set_title(self.options["theme_name"] + " theme options")
        self.set_icon_name("applications-graphics")

        self.widgets = {}
        
        for option in self.options["options"]:
            if option["desktop"] == "all" or option["desktop"] == self.desktop_environment:
                if option["type"] == "combo":
                    combobox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 10)
                    combobox_label = Gtk.Label.new(option["label"])
                    combobox_label.set_halign(Gtk.Align.START)
                    combobox.pack_start(combobox_label, True, True, 0)
                    combo_widget = Gtk.ComboBoxText()
                    for label in option["labels"]:
                        combo_widget.append_text(label)
                    combo_widget.set_active(option["value"])
                    combo_widget.set_halign(Gtk.Align.END)
                    combo_widget.connect("changed", self.on_combo_changed)
                    combobox.pack_start(combo_widget, True, True, 0)
                    box.pack_start(combobox, False, True, 0)
                    self.widgets[option["name"]] = combo_widget
                elif option["type"] == "switch":
                    switchbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 10)
                    switchbox_label = Gtk.Label.new(option["label"])
                    switchbox_label.set_halign(Gtk.Align.START)
                    switchbox.pack_start(switchbox_label, True, True, 0)
                    switch_widget = Gtk.Switch()
                    switch_widget.set_active(option["value"])
                    switch_widget.set_halign(Gtk.Align.END)
                    switch_widget.set_valign(Gtk.Align.CENTER)
                    switch_widget.connect("state-set", self.on_switch_changed)
                    switchbox.pack_start(switch_widget, True, True, 0)
                    box.pack_start(switchbox, False, True, 0)
                    self.widgets[option["name"]] = switch_widget
        #---------------------------
        if gsettings_get("org.cinnamon.desktop.interface",
                                "gtk-theme") == self.current_theme_name:
            restart_label = Gtk.Label.new(_("Restart Cinnamon for titlebar changes to take effect. " \
            "(Right click on panel>Troubleshoot>Restart Cinnamon.). Some apps may need to be restarted."))
            restart_label.set_line_wrap(True)
            box.pack_start(restart_label, False, True, 0)
        #---------------------------
        self.applybutton = Gtk.Button.new_with_label("Apply")
        self.applybutton.set_halign(Gtk.Align.CENTER)
        self.applybutton.set_valign(Gtk.Align.END)
        self.applybutton.set_sensitive(False)
        self.applybutton.connect("clicked", self.on_apply_button_clicked)
        box.pack_start(self.applybutton, False, True, 0)
        #---------------------------
        separator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
        separator.set_valign(Gtk.Align.END)
        box.pack_start(separator, False, True, 0)
        #---------------------------
        if self.options["adwaita_link_to_gtk4"]:
            adwaitabox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 10)
            self.adwaitabox_label = Gtk.Label.new("")
            self.adwaitabox_label.set_halign(Gtk.Align.START)
            self.adwaitabox_label.set_line_wrap(True)
            adwaitabox.pack_start(self.adwaitabox_label, True, True, 0)
            self.adwaitabox_button = Gtk.Button.new()
            self.adwaitabox_button.set_halign(Gtk.Align.END)
            self.adwaitabox_button.set_valign(Gtk.Align.CENTER)
            self.adwaitabox_button.connect("clicked", self.on_adwaitabox_button_clicked)
            adwaitabox.pack_start(self.adwaitabox_button, True, True, 0)
            box.pack_start(adwaitabox, False, True, 0)
            self.update_adwaitabox()
        

    def update_adwaitabox(self):
        if is_libadwaita_linked(self.current_theme_dir):
            self.adwaitabox_label.set_text(_("This theme is your current libadwaita theme"))
            self.adwaitabox_button.set_label(_("Remove"))
        else:
            self.adwaitabox_label.set_text(_("Set this theme as your current libadwaita theme"))
            self.adwaitabox_button.set_label(_("Install"))

    def on_adwaitabox_button_clicked(self, button):
        if is_libadwaita_linked(self.current_theme_dir): # "Remove" clicked
            unlink_libadwaita()
        else: # "Install" clicked
            unlink_libadwaita()
            link_libadwaita(self.current_theme_dir)

        self.update_adwaitabox()
    
    def on_combo_changed(self, combo):
        self.applybutton.set_sensitive(True)

    def on_switch_changed(self, switch, state):
        self.applybutton.set_sensitive(True)

    def load_config_file(self):
        file_name = os.path.join(self.current_theme_dir, "config", "options_config.json")
        with open(file_name, "r") as file:
            self.options = json.load(file)

    def save_config_file(self, new_theme_dir):
        file_name = os.path.join(new_theme_dir, "config", "options_config.json")
        with open(file_name, "w") as file:
            json.dump(self.options, file, indent=4)

    def get_new_theme_names(self):
        if self.rename_theme_on_update:
            random_chars = "".join(random.choices(string.digits, k=3))
            new_theme_name = self.options["theme_name"] + random_chars
            new_theme_dir = os.path.join(os.path.dirname(self.current_theme_dir), new_theme_name)
        else: #keep same name
            new_theme_dir = self.current_theme_dir
            new_theme_name = self.current_theme_name
        return (new_theme_dir, new_theme_name)

    def on_apply_button_clicked(self, button):        
        new_theme_dir, new_theme_name = self.get_new_theme_names()
        #Rename theme directory if neccessary
        if new_theme_dir != self.current_theme_dir:
            os.rename(self.current_theme_dir, new_theme_dir)

        #prepare install command and store settings
        command = [os.path.join(new_theme_dir, 'config', self.options["script_name"])]
        command.append("--name")
        command.append(new_theme_name)
        command.append("--dest")
        command.append(os.path.dirname(new_theme_dir))
        
        for option in self.options["options"]:
            if option["desktop"] == "all" or option["desktop"] == self.desktop_environment:
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
        
        #Install theme
        try:
            print ("Running..." + " ".join(command))
            subprocess.run(command, check=True)
            print("Install finished OK")
        except subprocess.CalledProcessError as e:
            print(f"Install script error. Return code: {e.returncode}")
            print(f"Output:\n{e.output.decode('utf-8')}")
        
        #save settings
        self.save_config_file(new_theme_dir)

        #apply desktop theme
        set_theme(self.current_theme_name, new_theme_name)
        self.applybutton.set_sensitive(False)

        #Relink libadwaita if neccessary
        if new_theme_name != self.current_theme_name and is_libadwaita_linked(self.current_theme_dir):
            unlink_libadwaita()
            link_libadwaita(new_theme_dir)

        #update theme name
        self.current_theme_dir = new_theme_dir
        self.current_theme_name = new_theme_name

def is_link_to(link, target):
    return os.path.islink(link) and os.readlink(link) == target

def is_libadwaita_linked(theme_dir):
    config_dir = os.path.expanduser('~/.config/gtk-4.0/')
    return (is_link_to(os.path.join(config_dir, 'assets'), os.path.join(theme_dir, 'gtk-4.0', 'assets')) and
        is_link_to(os.path.join(config_dir, 'gtk.css'), os.path.join(theme_dir, 'gtk-4.0', 'gtk.css')) and
        is_link_to(os.path.join(config_dir, 'gtk-dark.css'), os.path.join(theme_dir, 'gtk-4.0', 'gtk-dark.css')))

def link_libadwaita(theme_dir):
    config_dir = os.path.expanduser('~/.config/gtk-4.0/')
    os.makedirs(config_dir, exist_ok=True)
    os.symlink(os.path.join(theme_dir, 'gtk-4.0', 'assets'), os.path.join(config_dir, 'assets'), target_is_directory = True)
    os.symlink(os.path.join(theme_dir, 'gtk-4.0', 'gtk.css'), os.path.join(config_dir, 'gtk.css'))
    os.symlink(os.path.join(theme_dir, 'gtk-4.0', 'gtk-dark.css'), os.path.join(config_dir, 'gtk-dark.css'))
               
def unlink_libadwaita():
    config_dir = os.path.expanduser('~/.config/gtk-4.0/')
    subprocess.run(["rm", "-rf", config_dir + "assets"])
    subprocess.run(["rm", "-rf", config_dir + "gtk.css"])
    subprocess.run(["rm", "-rf", config_dir + "gtk-dark.css"])

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

def set_theme(current_theme_name, new_theme_name):    
    # CINNAMON_PATH   = '/org/Cinnamon'
    # CINNAMON_IFACE  = 'org.Cinnamon'
    # bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    # proxy  = Gio.DBusProxy.new_sync( bus, Gio.DBusProxyFlags.NONE, None,
    #                     CINNAMON_IFACE, CINNAMON_PATH, CINNAMON_IFACE, None)
    
    if gsettings_get("org.cinnamon.desktop.interface",
                                "gtk-theme") == current_theme_name:
        gsettings_set("org.cinnamon.desktop.interface", "gtk-theme", "")
        gsettings_set("org.cinnamon.desktop.interface", "gtk-theme", current_theme_name)
        #proxy.RestartCinnamon('(b)', False)

        if gsettings_get("org.cinnamon.theme", "name") == current_theme_name:
            GLib.timeout_add_seconds(1, reset_cinnamon_theme, (current_theme_name))
            #proxy.ReloadTheme
    elif gsettings_get("org.cinnamon.theme", "name") == current_theme_name:
        reset_cinnamon_theme(current_theme_name)

def reset_cinnamon_theme(current_theme_name):
    gsettings_set("org.cinnamon.theme", "name", "")
    gsettings_set("org.cinnamon.theme", "name", current_theme_name)
    return False

if __name__ == "__main__":
    Gtk.init()
    theme_path = sys.argv[1]
    win = OptionsWindow(theme_path, desktop_environment, rename_theme_on_update)
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()  