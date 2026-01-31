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
import re

can_backend = px_can_backend + c_can_backend
can_backend.append('List')

JSON_SETTINGS_PROPERTIES_MAP = {
    "description"      : "label",
    "min"              : "mini",
    "max"              : "maxi",
    "step"             : "step",
    "units"            : "units",
    "digits"           : "digits",
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
    "show-buttons"     : "show_buttons",
    "hidden-buttons"   : "hidden_buttons"
}

OPERATIONS = ['<=', '>=', '<', '>', '!=', '=']

OPERATIONS_MAP = {'<': operator.lt, '<=': operator.le, '>': operator.gt, '>=': operator.ge, '!=': operator.ne, '=': operator.eq}

class JSONSettingsHandler(object):
    def __init__(self, filepath, uuid = None, instance_id = None, notify_callback=None):
        super(JSONSettingsHandler, self).__init__()

        self.notify_callback = notify_callback

        self.filepath = filepath
        self.file_obj = Gio.File.new_for_path(self.filepath)
        self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, None)

        self.bindings = {}
        self.listeners = {}
        self.deps = {}
        self.uuid = uuid
        self.instance_id = instance_id

        self.timeout_id = 0
        self.file_monitor_id = 0
        self.settings = self.get_settings()
        self.resume_monitor()

    def pause_monitor(self):
        if self.timeout_id > 0:
            GLib.source_remove(self.timeout_id)
            self.timeout_id = 0
        if self.file_monitor_id > 0:
            self.file_monitor.disconnect(self.file_monitor_id)
            self.file_monitor_id = 0

    def resume_monitor(self):
        self.file_monitor_id = self.file_monitor.connect("changed", self.on_file_changed)

    def on_file_changed(self, *args):
        if self.timeout_id > 0:
            GLib.source_remove(self.timeout_id)
        self.timeout_id = GLib.timeout_add(2000, self.check_settings)

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
                if "map_set" in info and info["map_set"] is not None:
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
            if "map_get" in info and info["map_get"] is not None:
                value = info["map_get"](value)
            if value != info["obj"].get_property(info["prop"]) and value is not None:
                info["obj"].set_property(info["prop"], value)

    def check_settings(self, *args):
        self.timeout_id = 0
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
        return GLib.SOURCE_REMOVE

    def get_settings(self):
        file = open(self.filepath)
        raw_data = file.read()
        file.close()
        try:
            settings = json.loads(raw_data, object_pairs_hook=collections.OrderedDict)
        except:
            raise Exception(f"Failed to parse settings JSON data for file {self.filepath}")
        return settings

    def save_settings(self):
        self.pause_monitor()
        if os.path.exists(self.filepath):
            os.remove(self.filepath)
        raw_data = json.dumps(self.settings, indent=4, ensure_ascii=False)
        with open(self.filepath, 'w+') as new_file:
            new_file.write(raw_data)
            new_file.flush()
        self.resume_monitor()

    def reset_to_defaults(self):
        for key in self.settings:
            if "value" in self.settings[key]:
                self.settings[key]["value"] = self.settings[key]["default"]
                self.do_key_update(key)

        self.save_settings()
        if self.notify_callback:
            self.notify_callback(self, "", "")

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
            settings = json.loads(raw_data, object_pairs_hook=collections.OrderedDict)
        except:
            raise Exception(f"Failed to parse settings JSON data for file {self.filepath}")

        for key in self.settings:
            if "value" not in self.settings[key]:
                continue
            if key in settings and "value" in self.settings[key]:
                self.settings[key]["value"] = settings[key]["value"]
                self.do_key_update(key)
            else:
                print(f"Skipping key {key}: the key does not exist in {filepath} or has no value")
        self.save_settings()
        if self.notify_callback:
            self.notify_callback(self, "", "")

    def save_to_file(self, filepath):
        if os.path.exists(filepath):
            os.remove(filepath)
        raw_data = json.dumps(self.settings, indent=4)
        new_file = open(filepath, 'w+')
        new_file.write(raw_data)
        new_file.close()

def get_constant(settings, string):
    try:
        value = float(string)  # Try converting to a float
    except ValueError:
        if string.lower() == 'true':
            value = True
        elif string.lower() == "false":
            value = False
        else:
            value = string
    return value

class JSONSettingsRevealer(Gtk.Revealer):
    def __init__(self, settings, key):
        super(JSONSettingsRevealer, self).__init__()
        self.settings = settings

        # Split the dependencies into a list of keys, operations and constants
        expression = re.split(r'(!=|<=|>=|[<>=&| ])', key)
        # Remove any blank entries and any whitespace within entries
        self.expression = [item.strip() for item in expression if item.strip()]

        # Listen to any keys found in the expression,
        # expand all compares, decode constants,
        # decode compare operators and check for errors
        key = None
        idx = 0
        count = len(self.expression)
        listening = []
        #print( f"Preparing dependency: {self.expression}" )
        while idx < count:
            element = self.expression[idx]
            if element == '&' or element == '|':
                pass
            elif element in OPERATIONS:  # ... key op constant ...
                self.expression[idx] = OPERATIONS_MAP[element]
                key = self.expression[idx-1]
                if idx+1 < count and self.expression[idx+1] != '&' and self.expression[idx+1] != '|':
                    self.expression[idx+1] = get_constant(self.settings, self.expression[idx+1])
                else:  # No constant provided, so we assume a zero length string
                    self.expression.insert(idx+1, "")
                    count += 1
                idx += 1
            elif element[0] == '!':      # ... !key ...
                key = element[1:]
                self.expression[idx] = key
                self.expression.insert(idx+1, False)
                self.expression.insert(idx+1, operator.eq)
                idx += 2
                count += 2
            elif idx == count-1 or self.expression[idx+1] == '&' or self.expression[idx+1] == '|':   # standalone key
                key = element
                self.expression.insert(idx+1, True)
                self.expression.insert(idx+1, operator.eq)
                idx += 2
                count += 2
            if key:
                if self.settings.has_key(key):
                    if key not in listening:
                        self.settings.listen(key, self.key_changed)
                        listening.append(key)
                else:
                    print( f"Error in json dependency: \"{key}\" is not a valid key" )
                if idx+1 < count and self.expression[idx+1] != '&' and self.expression[idx+1] != '|':
                    print( f"Error in json dependency: Unexpected expression \"{self.expression[idx+1]}\"" )
                    self.expression = self.expression[:idx+1]  # remove the remaining elements since something is wrong with the syntax
                    break
                key = None
            idx += 1

        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        Gtk.Revealer.add(self, self.box)

        self.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.set_transition_duration(150)

       #  Set reveal state
        self.key_changed(None, None)

    def add(self, widget):
        self.box.pack_start(widget, False, True, 0)

    def key_changed(self, key, value):
        evaluate = []
        count = len(self.expression)
        #print( f"Evaluating expression: {self.expression}" )

        # Go through the expression to evaluate all the compares
        # The init ensures that the list has this format: key op const [ <&/|> key op const ]...
        idx = 0
        while idx < count:
            lhs = self.settings.get_value(self.expression[idx])
            op  = self.expression[idx+1]
            rhs = self.expression[idx+2]
            evaluate.append( op(lhs, rhs) )
            idx += 3
            if idx < count:
                evaluate.append( self.expression[idx] )
                idx += 1
        #print( f"Post compare evaluation: {evaluate}" )

        # Handle all the "and" operations first in accordance with the logical order of operations
        while "&" in evaluate:
            idx = evaluate.index("&")
            result = (evaluate[idx-1] and evaluate[idx+1])
            evaluate[idx-1:idx+2] = [] ## remove 3 elements: idx-1 through idx+1
            evaluate.insert(idx-1, result);
        #print( f"After evaluating the ands: {evaluate}" )

        # Handle all the "or" operations (there should be nothing but "or" operations at this point)
        while "|" in evaluate:
            idx = evaluate.index("|")
            result = (evaluate[idx-1] or evaluate[idx+1])
            evaluate[idx-1:idx+2] = [] ## remove 3 elements: idx-1 through idx+1
            evaluate.insert(idx-1, result);
        #print( f"After evaluating ors: {evaluate}" )

        # At this point we should only have one entry in the list, the final result
        self.set_reveal_child(evaluate[0])

class JSONSettingsBackend(object):
    def attach(self):
        self._saving = False

        if hasattr(self, "set_rounding") and self.settings.has_property(self.key, "round"):
            self.set_rounding(self.settings.get_property(self.key, "round"))
        if hasattr(self, "bind_object"):
            bind_object = self.bind_object
        else:
            bind_object = self.content_widget
        if self.bind_dir is not None:
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
        if self.bind_dir is None:
            raise NotImplementedError("SettingsWidget classes with no .bind_dir must implement connect_widget_handlers().")

def json_settings_factory(subclass):
    class NewClass(globals()[subclass], JSONSettingsBackend):
        def __init__(self, key, settings, properties):
            self.backend = "json"
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
