#!/usr/bin/python3

from gi.repository import Gio
from xapp.SettingsWidgets import *
from SettingsWidgets import SoundFileChooser, DateChooser, TimeChooser, Keybinding
from xapp.GSettingsWidgets import CAN_BACKEND as px_can_backend
from SettingsWidgets import CAN_BACKEND as c_can_backend
from TreeListWidgets import List
import os
import collections
import json
import operator

can_backend = px_can_backend + c_can_backend
can_backend.append('List')

JSON_SETTINGS_PROPERTIES_MAP = {
    "description"      : "label",
    "min"              : "mini",
    "max"              : "maxi",
    "step"             : "step",
    "units"            : "units",
    "show-value"       : "show_value",
    "select-dir"       : "dir_select",
    "height"           : "height",
    "tooltip"          : "tooltip",
    "possible"         : "possible",
    "expand-width"     : "expand_width",
    "columns"          : "columns",
    "event-sounds"     : "event_sounds",
    "default_icon"     : "default_icon",
    "icon_categories"  : "icon_categories",
    "default_category" : "default_category",
    "show-seconds"     : "show_seconds",
    "show-buttons"     : "show_buttons"
}

OPERATIONS = ['<=', '>=', '<', '>', '!=', '=']

OPERATIONS_MAP = {'<': operator.lt, '<=': operator.le, '>': operator.gt, '>=': operator.ge, '!=': operator.ne, '=': operator.eq}

class JSONSettingsHandler(object):
    def __init__(self, filepath, notify_callback=None):
        super(JSONSettingsHandler, self).__init__()

        self.resume_timeout = None
        self.notify_callback = notify_callback

        self.filepath = filepath
        self.file_obj = Gio.File.new_for_path(self.filepath)
        self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.SEND_MOVED, None)
        self.file_monitor.connect("changed", self.check_settings)

        self.bindings = {}
        self.listeners = {}
        self.deps = {}

        self.settings = self.get_settings()

    def bind(self, key, obj, prop, direction, map_get=None, map_set=None):
        if direction & (Gio.SettingsBindFlags.SET | Gio.SettingsBindFlags.GET) == 0:
            direction |= Gio.SettingsBindFlags.SET | Gio.SettingsBindFlags.GET

        binding_info = {"obj": obj, "prop": prop, "dir": direction, "map_get": map_get, "map_set": map_set}
        if key not in self.bindings:
            self.bindings[key] = []
        self.bindings[key].append(binding_info)

        if direction & Gio.SettingsBindFlags.GET != 0:
            self.set_object_value(binding_info, self.get_value(key))
        if direction & Gio.SettingsBindFlags.SET != 0:
            binding_info["oid"] = obj.connect("notify::"+prop, self.object_value_changed, key)

    def listen(self, key, callback):
        if key not in self.listeners:
            self.listeners[key] = []
        self.listeners[key].append(callback)

    def get_value(self, key):
        return self.get_property(key, "value")

    def set_value(self, key, value):
        if value != self.settings[key]["value"]:
            self.settings[key]["value"] = value
            self.save_settings()
            if self.notify_callback:
                self.notify_callback(self, key, value)

            if key in self.bindings:
                for info in self.bindings[key]:
                    self.set_object_value(info, value)

            if key in self.listeners:
                for callback in self.listeners[key]:
                    callback(key, value)

    def get_property(self, key, prop):
        props = self.settings[key]
        return props[prop]

    def has_property(self, key, prop):
        return prop in self.settings[key]

    def has_key(self, key):
        return key in self.settings

    def object_value_changed(self, obj, value, key):
        for info in self.bindings[key]:
            if obj == info["obj"]:
                value = info["obj"].get_property(info["prop"])
                if "map_set" in info and info["map_set"] != None:
                    value = info["map_set"](value)

        for info in self.bindings[key]:
            if obj != info["obj"]:
                self.set_object_value(info, value)
        self.set_value(key, value)

        if key in self.listeners:
            for callback in self.listeners[key]:
                callback(key, value)

    def set_object_value(self, info, value):
        if info["dir"] & Gio.SettingsBindFlags.GET == 0:
            return

        with info["obj"].freeze_notify():
            if "map_get" in info and info["map_get"] != None:
                value = info["map_get"](value)
            if value != info["obj"].get_property(info["prop"]) and value is not None:
                info["obj"].set_property(info["prop"], value)

    def check_settings(self, *args):
        old_settings = self.settings
        self.settings = self.get_settings()

        for key in self.bindings:
            new_value = self.settings[key]["value"]
            if new_value != old_settings[key]["value"]:
                for info in self.bindings[key]:
                    self.set_object_value(info, new_value)

        for key, callback_list in self.listeners.items():
            new_value = self.settings[key]["value"]
            if new_value != old_settings[key]["value"]:
                for callback in callback_list:
                    callback(key, new_value)

    def get_settings(self):
        file = open(self.filepath)
        raw_data = file.read()
        file.close()
        try:
            settings = json.loads(raw_data, object_pairs_hook=collections.OrderedDict)
        except:
            raise Exception("Failed to parse settings JSON data for file %s" % (self.filepath))
        return settings

    def save_settings(self):
        self.pause_monitor()
        if os.path.exists(self.filepath):
            os.remove(self.filepath)
        raw_data = json.dumps(self.settings, indent=4)
        new_file = open(self.filepath, 'w+')
        new_file.write(raw_data)
        new_file.close()
        self.resume_monitor()

    def pause_monitor(self):
        self.file_monitor.cancel()
        self.handler = None

    def resume_monitor(self):
        if self.resume_timeout:
            GLib.source_remove(self.resume_timeout)
        self.resume_timeout = GLib.timeout_add(2000, self.do_resume)

    def do_resume(self):
        self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.SEND_MOVED, None)
        self.handler = self.file_monitor.connect("changed", self.check_settings)
        self.resume_timeout = None
        return False

    def reset_to_defaults(self):
        for key in self.settings:
            if "value" in self.settings[key]:
                self.settings[key]["value"] = self.settings[key]["default"]
                self.do_key_update(key)

        self.save_settings()

    def do_key_update(self, key):
        if key in self.bindings:
            for info in self.bindings[key]:
                self.set_object_value(info, self.settings[key]["value"])

        if key in self.listeners:
            for callback in self.listeners[key]:
                callback(key, self.settings[key]["value"])

    def load_from_file(self, filepath):
        file = open(filepath)
        raw_data = file.read()
        file.close()
        try:
            settings = json.loads(raw_data, encoding=None, object_pairs_hook=collections.OrderedDict)
        except:
            raise Exception("Failed to parse settings JSON data for file %s" % (self.filepath))

        for key in self.settings:
            if "value" not in self.settings[key]:
                continue
            if key in settings and "value" in self.settings[key]:
                self.settings[key]["value"] = settings[key]["value"]
                self.do_key_update(key)
            else:
                print("Skipping key %s: the key does not exist in %s or has no value" % (key, filepath))
        self.save_settings()

    def save_to_file(self, filepath):
        if os.path.exists(filepath):
            os.remove(filepath)
        raw_data = json.dumps(self.settings, indent=4)
        new_file = open(filepath, 'w+')
        new_file.write(raw_data)
        new_file.close()

class JSONSettingsRevealer(Gtk.Revealer):
    def __init__(self, settings, key):
        super(JSONSettingsRevealer, self).__init__()
        self.settings = settings

        self.key = None
        self.op = None
        self.value = None
        for op in OPERATIONS:
            if op in key:
                self.op = op
                self.key, self.value = key.split(op)
                break

        if self.key is None:
            if key[:1] == '!':
                self.invert = True
                self.key = key[1:]
            else:
                self.invert = False
                self.key = key

        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        Gtk.Revealer.add(self, self.box)

        self.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.set_transition_duration(150)

        self.settings.listen(self.key, self.key_changed)
        self.key_changed(self.key, self.settings.get_value(self.key))

    def add(self, widget):
        self.box.pack_start(widget, False, True, 0)

    def key_changed(self, key, value):
        if self.op is not None:
            val_type = type(value)
            self.set_reveal_child(OPERATIONS_MAP[self.op](value, val_type(self.value)))
        elif value != self.invert:
            self.set_reveal_child(True)
        else:
            self.set_reveal_child(False)

class JSONSettingsBackend(object):
    def attach(self):
        self._saving = False

        if hasattr(self, "set_rounding") and self.settings.has_property(self.key, "round"):
            self.set_rounding(self.settings.get_property(self.key, "round"))
        if hasattr(self, "bind_object"):
            bind_object = self.bind_object
        else:
            bind_object = self.content_widget
        if self.bind_dir != None:
            self.settings.bind(self.key, bind_object, self.bind_prop, self.bind_dir,
                               self.map_get if hasattr(self, "map_get") else None,
                               self.map_set if hasattr(self, "map_set") else None)
        else:
            self.settings.listen(self.key, self._settings_changed_callback)
            self.on_setting_changed()
            self.connect_widget_handlers()

    def set_value(self, value):
        self._saving = True
        self.settings.set_value(self.key, value)
        self._saving = False

    def get_value(self):
        return self.settings.get_value(self.key)

    def get_range(self):
        min = self.settings.get_property(self.key, "min")
        max = self.settings.get_property(self.key, "max")
        return [min, max]

    def _settings_changed_callback(self, *args):
        if not self._saving:
            self.on_setting_changed(*args)

    def on_setting_changed(self, *args):
        raise NotImplementedError("SettingsWidget class must implement on_setting_changed().")

    def connect_widget_handlers(self, *args):
        if self.bind_dir == None:
            raise NotImplementedError("SettingsWidget classes with no .bind_dir must implement connect_widget_handlers().")

def json_settings_factory(subclass):
    class NewClass(globals()[subclass], JSONSettingsBackend):
        def __init__(self, key, settings, properties):
            self.key = key
            self.settings = settings

            kwargs = {}
            for prop in properties:
                if prop in JSON_SETTINGS_PROPERTIES_MAP:
                    kwargs[JSON_SETTINGS_PROPERTIES_MAP[prop]] = properties[prop]
                elif prop == "options":
                    kwargs["options"] = []
                    for value, label in properties[prop].items():
                        kwargs["options"].append((label, value))
            super(NewClass, self).__init__(**kwargs)
            self.attach()

    return NewClass

for widget in can_backend:
    globals()["JSONSettings"+widget] = json_settings_factory(widget)
