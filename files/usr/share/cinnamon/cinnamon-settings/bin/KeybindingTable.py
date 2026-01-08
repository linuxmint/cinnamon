#!/usr/bin/python3


from html import escape
import gettext
import json
import os

from pathlib import Path

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk, Gio, GObject, GLib

gettext.install("cinnamon", "/usr/share/locale")

# Keybindings page - check if we need to store custom
# keybindings to gsettings key as well as GConf (In Mint 14 this is changed)
CUSTOM_KEYS_PARENT_SCHEMA = "org.cinnamon.desktop.keybindings"
CUSTOM_KEYS_BASENAME = "/org/cinnamon/desktop/keybindings/custom-keybindings"
CUSTOM_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.custom-keybinding"

MUFFIN_KEYBINDINGS_SCHEMA = "org.cinnamon.desktop.keybindings.wm"
MEDIA_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.media-keys"
CINNAMON_SCHEMA = "org.cinnamon.desktop.keybindings"
ENABLED_SCHEMA = "org.cinnamon"

OLD_SETTINGS_DIR = Path.joinpath(Path.home(), ".cinnamon/configs/")
SETTINGS_DIR = Path.joinpath(Path.home(), ".config/cinnamon/spices/")

"""
  ["Category Label", "category-id", "parent-category-id" | None, "icon-name", [sub-categories...],
    [
      ["Keybinding label", "schema-id", "settings-key"],
      ...
      ...
    ]
  ]
"""
STATIC_KEYBINDINGS = \
[
  [_("General"), "general", None, "preferences-desktop-keyboard-shortcuts",
    [
      [_("Pointer"), "pointer", "general", None, [],
        [
          [_("Move pointer to the next monitor"), CINNAMON_SCHEMA, "pointer-next-monitor"],
          [_("Move pointer to the previous monitor"), CINNAMON_SCHEMA, "pointer-previous-monitor"]
        ]
      ],
      [_("Troubleshooting"), "trouble", "general", None, [],
        [
          [_("Toggle Looking Glass"), CINNAMON_SCHEMA, "looking-glass-keybinding"]
        ]
      ]
    ],
    [
      [_("Show the window selection screen"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-down"],
      [_("Show the workspace selection screen"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-up"],
      [_("Show desktop"), MUFFIN_KEYBINDINGS_SCHEMA, "show-desktop"],
      [_("Show Desklets"), CINNAMON_SCHEMA, "show-desklets"],
      [_("Cycle through open windows"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-windows"],
      [_("Cycle backwards through open windows"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-windows-backward"],
      [_("Cycle through windows from all workspaces"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-panels"],
      [_("Cycle backwards through windows from all workspaces"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-panels-backward"],
      [_("Cycle through open windows of the same application"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-group"],
      [_("Cycle backwards through open windows of the same application"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-group-backward"],
      [_("Run dialog"), MUFFIN_KEYBINDINGS_SCHEMA, "panel-run-dialog"]
    ]
  ],
  [_("Keyboard"), "keyboard", None, "input-keyboard", [],
    [
      [_("Switch to next layout"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-input-source"],
      [_("Switch to previous layout"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-input-source-backward"],
      [_("Switch to first layout"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-input-source-0"],
      [_("Switch to second layout"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-input-source-1"],
      [_("Switch to third layout"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-input-source-2"],
      [_("Switch to fourth layout"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-input-source-3"]
    ]
  ],
  [_("Windows"), "windows", None, "preferences-system-windows",
    [
      [_("Positioning"), "win-position", "windows", None, [],
        [
          [_("Resize window"), MUFFIN_KEYBINDINGS_SCHEMA, "begin-resize"],
          [_("Move window"), MUFFIN_KEYBINDINGS_SCHEMA, "begin-move"],
          [_("Center window in screen"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-center"],
          [_("Move window to upper-right"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-ne"],
          [_("Move window to upper-left"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-nw"],
          [_("Move window to lower-right"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-se"],
          [_("Move window to lower-left"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-sw"],
          [_("Move window to right edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-e"],
          [_("Move window to top edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-n"],
          [_("Move window to bottom edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-s"],
          [_("Move window to left edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-w"]
        ]
      ],
      [_("Tiling and Snapping"), "win-tiling", "windows", None, [],
        [
          [_("Push tile left"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-left"],
          [_("Push tile right"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-right"],
          [_("Push tile up"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-up"],
          [_("Push tile down"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-down"]
        ]
      ],
      [_("Inter-workspace"), "win-workspaces", "windows", None, [],
        [
          [_("Move window to new workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-new"],
          [_("Move window to left workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-left"],
          [_("Move window to right workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-right"],
          [_("Move window to workspace above"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-up"],
          [_("Move window to workspace below"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-down"],
          [_("Move window to workspace 1"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-1"],
          [_("Move window to workspace 2"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-2"],
          [_("Move window to workspace 3"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-3"],
          [_("Move window to workspace 4"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-4"],
          [_("Move window to workspace 5"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-5"],
          [_("Move window to workspace 6"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-6"],
          [_("Move window to workspace 7"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-7"],
          [_("Move window to workspace 8"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-8"],
          [_("Move window to workspace 9"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-9"],
          [_("Move window to workspace 10"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-10"],
          [_("Move window to workspace 11"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-11"],
          [_("Move window to workspace 12"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-12"]
        ]
      ],
      [_("Inter-monitor"), "win-monitors", "windows", None, [],
        [
          [_("Move window to left monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-left"],
          [_("Move window to right monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-right"],
          [_("Move window to monitor above"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-up"],
          [_("Move window to monitor below"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-down"]
        ]
      ]
    ],
    [
      [_("Maximize window"), MUFFIN_KEYBINDINGS_SCHEMA, "maximize"],
      [_("Unmaximize window"), MUFFIN_KEYBINDINGS_SCHEMA, "unmaximize"],
      [_("Minimize window"), MUFFIN_KEYBINDINGS_SCHEMA, "minimize"],
      [_("Close window"), MUFFIN_KEYBINDINGS_SCHEMA, "close"],
      [_("Activate window menu"), MUFFIN_KEYBINDINGS_SCHEMA, "activate-window-menu"],
      [_("Raise window"), MUFFIN_KEYBINDINGS_SCHEMA, "raise"],
      [_("Lower window"), MUFFIN_KEYBINDINGS_SCHEMA, "lower"],
      [_("Toggle maximization state"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-maximized"],
      [_("Toggle fullscreen state"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-fullscreen"],
      [_("Toggle shaded state"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-shaded"],
      [_("Toggle always on top"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-above"],
      [_("Toggle showing window on all workspaces"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-on-all-workspaces"],
      [_("Increase opacity"), MUFFIN_KEYBINDINGS_SCHEMA, "increase-opacity"],
      [_("Decrease opacity"), MUFFIN_KEYBINDINGS_SCHEMA, "decrease-opacity"],
      [_("Toggle vertical maximization"), MUFFIN_KEYBINDINGS_SCHEMA, "maximize-vertically"],
      [_("Toggle horizontal maximization"), MUFFIN_KEYBINDINGS_SCHEMA, "maximize-horizontally"]
    ]
  ],
  [_("Workspaces"), "workspaces", None, "video-display",
    [
      [_("Direct Navigation"), "ws-navi", "workspaces", None, [],
        [
          [_("Switch to workspace 1"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-1"],
          [_("Switch to workspace 2"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-2"],
          [_("Switch to workspace 3"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-3"],
          [_("Switch to workspace 4"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-4"],
          [_("Switch to workspace 5"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-5"],
          [_("Switch to workspace 6"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-6"],
          [_("Switch to workspace 7"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-7"],
          [_("Switch to workspace 8"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-8"],
          [_("Switch to workspace 9"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-9"],
          [_("Switch to workspace 10"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-10"],
          [_("Switch to workspace 11"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-11"],
          [_("Switch to workspace 12"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-12"]
        ]
      ]
    ],
    [
      [_("Switch to left workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-left"],
      [_("Switch to right workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-right"]
    ]
  ],
  [_("System"), "system", None, "preferences-system",
    [
      [_("Hardware"), "sys-hw", "system", None, [],
        [
          [_("Switch monitor configurations"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-monitor"],
          [_("Rotate display"), MUFFIN_KEYBINDINGS_SCHEMA, "rotate-monitor"],
          [_("Orientation Lock"), MEDIA_KEYS_SCHEMA, "video-rotation-lock"],
          [_("Increase screen brightness"), MEDIA_KEYS_SCHEMA, "screen-brightness-up"],
          [_("Decrease screen brightness"), MEDIA_KEYS_SCHEMA, "screen-brightness-down"],
          [_("Toggle keyboard backlight"), MEDIA_KEYS_SCHEMA, "kbd-brightness-toggle"],
          [_("Increase keyboard backlight level"), MEDIA_KEYS_SCHEMA, "kbd-brightness-up"],
          [_("Decrease keyboard backlight level"), MEDIA_KEYS_SCHEMA, "kbd-brightness-down"],
          [_("Toggle touchpad state"), MEDIA_KEYS_SCHEMA, "touchpad-toggle"],
          [_("Turn touchpad on"), MEDIA_KEYS_SCHEMA, "touchpad-on"],
          [_("Turn touchpad off"), MEDIA_KEYS_SCHEMA, "touchpad-off"],
          [_("Show power statistics"), MEDIA_KEYS_SCHEMA, "battery"]
        ]
      ],
      [_("Screenshots and Recording"), "sys-screen", "system", None, [],
        [
          [_("Take a screenshot of an area"), MEDIA_KEYS_SCHEMA, "area-screenshot"],
          [_("Copy a screenshot of an area to clipboard"), MEDIA_KEYS_SCHEMA, "area-screenshot-clip"],
          [_("Take a screenshot"), MEDIA_KEYS_SCHEMA, "screenshot"],
          [_("Copy a screenshot to clipboard"), MEDIA_KEYS_SCHEMA, "screenshot-clip"],
          [_("Take a screenshot of a window"), MEDIA_KEYS_SCHEMA, "window-screenshot"],
          [_("Copy a screenshot of a window to clipboard"), MEDIA_KEYS_SCHEMA, "window-screenshot-clip"],
          [_("Toggle recording desktop (must restart Cinnamon)"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-recording"]
        ]
      ]
    ],
    [
      [_("Log out"), MEDIA_KEYS_SCHEMA, "logout"],
      [_("Shut down"), MEDIA_KEYS_SCHEMA, "shutdown"],
      [_("Lock screen"), MEDIA_KEYS_SCHEMA, "screensaver"],
      [_("Suspend"), MEDIA_KEYS_SCHEMA, "suspend"],
      [_("Hibernate"), MEDIA_KEYS_SCHEMA, "hibernate"],
      [_("Restart Cinnamon"), MEDIA_KEYS_SCHEMA, "restart-cinnamon"]
    ]
  ],
  [_("Launchers"), "launchers", None, "applications-utilities", [],
    [
      [_("Launch terminal"), MEDIA_KEYS_SCHEMA, "terminal"],
      [_("Launch help browser"), MEDIA_KEYS_SCHEMA, "help"],
      [_("Launch calculator"), MEDIA_KEYS_SCHEMA, "calculator"],
      [_("Launch email client"), MEDIA_KEYS_SCHEMA, "email"],
      [_("Launch web browser"), MEDIA_KEYS_SCHEMA, "www"],
      [_("Home folder"), MEDIA_KEYS_SCHEMA, "home"],
      [_("Search"), MEDIA_KEYS_SCHEMA, "search"]
    ]
  ],
  [_("Sound and Media"), "media", None, "applications-multimedia",
    [
      [_("Quiet Keys"), "media-quiet", "media", None, [],
        [
          [_("Volume mute (Quiet)"), MEDIA_KEYS_SCHEMA, "mute-quiet"],
          [_("Volume down (Quiet)"), MEDIA_KEYS_SCHEMA, "volume-down-quiet"],
          [_("Volume up (Quiet)"), MEDIA_KEYS_SCHEMA, "volume-up-quiet"]
        ]
      ]
    ],
    [
      [_("Volume mute"), MEDIA_KEYS_SCHEMA, "volume-mute"],
      [_("Volume down"), MEDIA_KEYS_SCHEMA, "volume-down"],
      [_("Volume up"), MEDIA_KEYS_SCHEMA, "volume-up"],
      [_("Mic mute"), MEDIA_KEYS_SCHEMA, "mic-mute"],
      [_("Launch media player"), MEDIA_KEYS_SCHEMA, "media"],
      [_("Play"), MEDIA_KEYS_SCHEMA, "play"],
      [_("Pause playback"), MEDIA_KEYS_SCHEMA, "pause"],
      [_("Stop playback"), MEDIA_KEYS_SCHEMA, "stop"],
      [_("Previous track"), MEDIA_KEYS_SCHEMA, "previous"],
      [_("Next track"), MEDIA_KEYS_SCHEMA, "next"],
      [_("Eject"), MEDIA_KEYS_SCHEMA, "eject"],
      [_("Rewind"), MEDIA_KEYS_SCHEMA, "audio-rewind"],
      [_("Fast-forward"), MEDIA_KEYS_SCHEMA, "audio-forward"],
      [_("Repeat"), MEDIA_KEYS_SCHEMA, "audio-repeat"],
      [_("Shuffle"), MEDIA_KEYS_SCHEMA, "audio-random"]
    ]
  ],
  [_("Universal Access"), "accessibility", None, "preferences-desktop-accessibility", [],
    [
      [_("Zoom in"), CINNAMON_SCHEMA, "magnifier-zoom-in"],
      [_("Zoom out"), CINNAMON_SCHEMA, "magnifier-zoom-out"],
      [_("Reset zoom"), CINNAMON_SCHEMA, "magnifier-zoom-reset"],
      [_("Turn screen reader on or off"), MEDIA_KEYS_SCHEMA, "screenreader"],
      [_("Turn on-screen keyboard on or off"), MEDIA_KEYS_SCHEMA, "on-screen-keyboard"],
      [_("Increase text size"), MEDIA_KEYS_SCHEMA, "increase-text-size"],
      [_("Decrease text size"), MEDIA_KEYS_SCHEMA, "decrease-text-size"],
      [_("High contrast on or off"), MEDIA_KEYS_SCHEMA, "toggle-contrast"]
    ]
  ],
  [_("Spices"), "spices", None, "cinnamon", [], []]
]

# keybindings.js listens for changes to 'custom-list'. Any time we create a shortcut
# or add/remove individual keybindings, we need to cause this list to change.
#
# Use a dummy entry to trigger this by alternately adding and removing it to the list.
DUMMY_CUSTOM_ENTRY = "__dummy__"

def ensureCustomListChanges(custom_list):
    if DUMMY_CUSTOM_ENTRY in custom_list:
        custom_list.remove(DUMMY_CUSTOM_ENTRY)
    else:
        custom_list.append(DUMMY_CUSTOM_ENTRY)

class KeyBindingCategory:
    def __init__(self, label, int_name, parent, icon, dbus_info={}):
        self.label = label
        self.parent = parent
        self.icon = icon
        self.int_name = int_name
        self.dbus_info = dbus_info
        self.keybindings = []

    def add(self, keybinding):
        self.keybindings.append(keybinding)

    def clear(self):
        del self.keybindings[:]

class KeyBinding(GObject.Object):
    __gsignals__ = {
        'changed': (GObject.SignalFlags.RUN_FIRST, None, ()),
    }
    def __init__(self, label, schema, key, category, settings_dict, dbus_info={}):
        super().__init__()
        self.key = key
        self.category = category
        self.label = label
        self.schema = schema
        self.entries = []
        self.dbus_info = dbus_info
        self.json_timeout_id = 0
        self.json_monitor_id = 0
        self.initial_load = True
        if "/" not in schema:
            try:
                self.settings = settings_dict[schema]
            except KeyError:
                self.settings = Gio.Settings(schema_id=schema)
                settings_dict[schema] = self.settings
            self.load_gsettings()
            self.settings.connect(f"changed::{self.key}", self.load_gsettings)
        else:
            self.settings = schema
            self.load_json_settings()
            self.settings_file = Gio.File.new_for_path(self.settings)
            self.settings_monitor = self.settings_file.monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, None)
            self.resume_json_monitor()

    def emit_changed(self):
        # Skip initial emission, while the UI is loaded
        if self.initial_load:
            self.initial_load = False
            return
        self.emit("changed")

    def pause_json_monitor(self):
        if self.json_timeout_id > 0:
            GLib.source_remove(self.json_timeout_id)
            self.json_timeout_id = 0
        if self.json_monitor_id > 0:
            self.settings_monitor.disconnect(self.json_monitor_id)
            self.json_monitor_id = 0

    def resume_json_monitor(self):
        self.json_monitor_id = self.settings_monitor.connect("changed", self.json_settings_changed)

    def json_settings_changed(self, *args):
        if self.json_timeout_id > 0:
            GLib.source_remove(self.json_timeout_id)
        self.json_timeout_id = GLib.timeout_add(2000, self.load_json_settings)

    def load_gsettings(self, *args):
        del self.entries[:]
        self.entries = self.get_array(self.settings.get_strv(self.key))
        self.emit_changed()

    def load_json_settings(self, *args):
        del self.entries[:]
        settings = self.getConfigSettings()
        if settings is None:
            return
        self.entries = settings
        self.json_timeout_id = 0
        self.emit_changed()

    def getConfigSettings(self):
        if not Path(self.schema).exists():
            self.settings_monitor.cancel()
            return
        with open(self.schema, encoding="utf-8") as config_file:
            config = json.load(config_file)
            keybinds = config[self.key]["value"].split("::")
            if len(keybinds) < 2:
                keybinds.append("")

        return keybinds

    def get_array(self, raw_array):
        result = []

        for entry in raw_array:
            result.append(entry)
        while len(result) < 3:
            result.append("")

        return result

    def setBinding(self, index, val):
        self.entries[index] = val if val else ""
        self.writeSettings()

    def writeSettings(self):
        array = []
        for entry in self.entries:
            if entry:
                array.append(entry)

        if "/" not in self.schema:
            self.settings.set_strv(self.key, array)
        else:
            self.pause_json_monitor()
            with open(self.schema, encoding="utf-8") as config_file:
                config = json.load(config_file)

            config[self.key]["value"] = "::".join(array) if array else "::"

            with open(self.schema, "w", encoding="utf-8") as config_file:
                config_file.write(json.dumps(config, indent=4))
                config_file.flush()
            self.resume_json_monitor()
        self.emit_changed()

    def resetDefaults(self):
        if "/" not in self.schema:
            self.settings.reset(self.key)
            self.load_gsettings()
        else:
            self.pause_json_monitor()
            with open(self.schema, encoding="utf-8") as config_file:
                config = json.load(config_file)

            config[self.key]["value"] = config[self.key]["default"]

            with open(self.schema, "w", encoding="utf-8") as config_file:
                config_file.write(json.dumps(config, indent=4))
                config_file.flush()
            self.resume_json_monitor()
            self.json_settings_changed()
        self.emit_changed()

class CustomKeyBinding(GObject.Object):
    __gsignals__ = {
        'changed': (GObject.SignalFlags.RUN_FIRST, None, ()),
    }
    def __init__(self, path, label, action, binding):
        super().__init__()
        self.category = "custom"
        self.path = path
        self.label = label
        self.action = action
        self.dbus_info = {}
        self.entries = self.get_array(binding)

    def get_array(self, raw_array):
        result = []

        for entry in raw_array:
            result.append(entry)
        while len(result) < 3:
            result.append("")
        return result

    def setBinding(self, index, val):
        self.entries[index] = val if val else ""
        self.writeSettings(True)

    def setDetails(self, name, command):
        self.label = name
        self.action = command
        self.writeSettings(False)

    def writeSettings(self, emit_changed=False):
        custom_path = CUSTOM_KEYS_BASENAME+"/"+self.path+"/"
        settings = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)

        settings.set_string("name", self.label)
        settings.set_string("command", self.action)

        array = []
        for entry in self.entries:
            if entry:
                array.append(entry)
        settings.set_strv("binding", array)

        # Touch the custom-list key, this will trigger a rebuild in cinnamon
        parent = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA)
        custom_list = parent.get_strv("custom-list")
        ensureCustomListChanges(custom_list)
        parent.set_strv("custom-list", custom_list)

        if emit_changed:
            self.emit("changed")

class KeybindingTable(GObject.Object):
    __gsignals__ = {
        'binding-changed': (GObject.SignalFlags.RUN_FIRST, None, ()), # modify any actual keybinding
        'customs-changed': (GObject.SignalFlags.RUN_FIRST, None, ()), # add/remove/edit customs (but *not* their bindings)
        'spices-changed': (GObject.SignalFlags.RUN_FIRST, None, ()) # enabled spices
    }
    def __init__(self):
        super().__init__()
        self.settings_by_schema_id = {}

        self._static_store = []
        self._static_categories = {}

        self._custom_store = []
        self._custom_categories = {}

        self._spice_store = []
        self._spice_categories = {}

        self._collision_check_done = False
        self._collision_table = {}

        self._config_monitors = {
            OLD_SETTINGS_DIR: {},
            SETTINGS_DIR: {}
        }

        self._load_static_store()
        self._load_custom_store()
        self._load_spice_store()
        self._collision_check_done = True

        try:
            Gio.DBusProxy.new_for_bus(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                None,
                "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon",
                None, self._on_proxy_ready, None
            )
        except GLib.Error as e:
            print(e)

    def _on_proxy_ready(self, obj, result, data=None):
        try:
            self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        except GLib.Error as e:
            print(f"KeybindingTable could not establish proxy for org.Cinnamon: {e}")

    def _proxy_send_kb_changed(self, keybinding):
        if keybinding.dbus_info.get("uuid", None) is None:
            return

        if self._proxy.get_name_owner() is None:
            return

        self._proxy.updateSetting(
            '(ssss)',
            keybinding.dbus_info["uuid"],
            keybinding.dbus_info["config_id"],
            keybinding.key,
            json.dumps(keybinding.entries)
        )

    def _add_to_collision_table(self, keybinding):
        if self._collision_check_done:
            return

        for entry in keybinding.entries:
            if entry == '':
                continue
            try:
                existing = self._collision_table[entry]
                existing.append(keybinding)
            except KeyError:
                self._collision_table[entry] = [keybinding]

    @property
    def main_store(self):
        return self._static_store + self._custom_store + self._spice_store

    @property
    def custom_store(self):
        return self._custom_store

    @property
    def spice_store(self):
        return self._spice_store

    @property
    def binding_categories(self):
        return {**self._static_categories, **self._custom_categories, **self._spice_categories}

    @property
    def static_categories(self):
        return self._static_categories

    def _get_settings_for_schema(self, schema_id):
        try:
            settings = self.settings_by_schema_id[schema_id]
        except KeyError:
            settings = Gio.Settings(schema_id=schema_id)
            self.settings_by_schema_id[schema_id] = settings
        return settings

    def _on_kb_changed(self, keybinding, data=None):
        self.emit("binding-changed")

    def _load_static_store(self):
        def _load_category(cat):
            self._static_categories[cat[1]] = cat[0]
            category = KeyBindingCategory(cat[0], cat[1], cat[2], cat[3])
            self._static_store.append(category)

            for subcat in cat[4]:
                _load_category(subcat)

            for binding in cat[5]:
                kb = KeyBinding(binding[0], binding[1], binding[2], cat[1], self.settings_by_schema_id)
                kb.connect("changed", self._on_kb_changed)
                self._add_to_collision_table(kb)
                category.add(kb)

        for category in STATIC_KEYBINDINGS:
            _load_category(category)

    def _on_enabled_spices_changed(self, settings, key, data=None):
        self._load_spice_store()

    def _load_spice_store(self):
        try:
            settings = self.settings_by_schema_id[ENABLED_SCHEMA]
        except KeyError:
            settings = Gio.Settings(schema_id=ENABLED_SCHEMA)
            self.settings_by_schema_id[ENABLED_SCHEMA] = settings

            settings.connect("changed::enabled-applets", self._on_enabled_spices_changed)
            settings.connect("changed::enabled-desklets", self._on_enabled_spices_changed)
            settings.connect("changed::enabled-extensions", self._on_enabled_spices_changed)

        enabled_extensions = set()
        enabled_spices = {
            "applets": {},
            "desklets": {},
            "extensions": {}
        }

        for applets in settings.get_strv("enabled-applets"):
            p, pos, order, applet_uuid, *extra = applets.split(":")
            if len(extra) > 0:
                instance_id = extra[0]
            else:
                instance_id = None
            enabled_spices["applets"].setdefault(applet_uuid, set()).add(instance_id)
        for desklets in settings.get_strv("enabled-desklets"):
            desklet_uuid, instance_id, x, y = desklets.split(":")
            enabled_spices["desklets"].setdefault(desklet_uuid, set()).add(instance_id)

        for extension in settings.get_strv("enabled-extensions"):
            enabled_extensions.add(extension)
            enabled_spices["extensions"].setdefault(extension, set()).add(None)
        spice_keybinds = {}
        spice_properties = {}

        def set_properties(_type, uuid, config_path, configs):
            for config in configs:
                config_json = Path.joinpath(config_path, config)
                _id = config.split(".json")[0]
                key_name = f"{uuid}_{_id}" if _id.isdigit() else uuid
                with open(config_json, encoding="utf-8") as config_file:
                    _config = json.load(config_file)

                    for key, val in _config.items():
                        if isinstance(val, dict) and val.get("type") == "keybinding":
                            spice_properties.setdefault(key_name, {})
                            spice_properties[key_name]["highlight"] = uuid not in enabled_extensions
                            spice_properties[key_name]["path"] = str(config_json)
                            spice_properties[key_name]["type"] = _type
                            spice_properties[key_name]["uuid"] = uuid
                            spice_properties[key_name]["instance_id"] = _id
                            spice_properties[key_name]["config_id"] = _id
                            spice_keybinds.setdefault(key_name, {})
                            spice_keybinds[key_name].setdefault(key, {})
                            spice_keybinds[key_name][key] = {val.get("description"): val.get("value").split("::")}


        def on_dir_changed(monitor, file, other_file, event_type, _type, uuid, config_path, get_configs):
            if event_type != Gio.FileMonitorEvent.CHANGES_DONE_HINT:
                return
            monitor.cancel()
            del self._config_monitors[config_path.parent][uuid]
            set_properties(_type, uuid, config_path, get_configs(config_path))
            resume()


        def has_monitors():
            for value in self._config_monitors.values():
                if len(value):
                    return True
            return False


        def resume():
            if has_monitors():
                return
            finish_load()
            
        
        for _type, value in enabled_spices.items():
            for uuid, instance_ids in value.items():
                for settings_dir in (OLD_SETTINGS_DIR, SETTINGS_DIR):
                    config_path = Path.joinpath(settings_dir, uuid)
                    if not Path.exists(config_path):
                        continue

                    def get_configs(config_path):
                        configs = [x for x in os.listdir(config_path) if x.endswith(".json")]
                        # If we encounted numbered and non-numbered, config files, filter out the uuid-named one 
                        if not all(x.split(".json")[0].isdigit() for x in configs) and any(x.split(".json")[0].isdigit() for x in configs):
                            for index, value in enumerate(configs):
                                if not value.split(".json")[0].isdigit():
                                    configs.pop(index)
                        return configs

                    configs = get_configs(config_path)
                    # Must wait until config file is created/deleted
                    if len(configs) != len(instance_ids):
                        g_config_dir = Gio.File.new_for_path(str(config_path))
                        monitor = g_config_dir.monitor_directory(Gio.FileMonitorFlags.NONE, None)
                        monitor.connect("changed", on_dir_changed, _type, uuid, config_path, get_configs)
                        self._config_monitors[settings_dir][uuid] = monitor
                        continue

                    set_properties(_type, uuid, config_path, configs)
        
        def finish_load():
            self._spice_categories = {}
            self._spice_store = []

            new_categories = []
            new_keybindings = []

            for spice, bindings in spice_keybinds.items():
                uuid, *_id = spice.split("_")

                spice_props = spice_properties[spice]
                _type = spice_props["type"]
                local_metadata_path = Path.home() / '.local/share/cinnamon' / _type / uuid / 'metadata.json'
                if local_metadata_path.exists():
                    gettext.bindtextdomain(uuid, str(Path.home() / '.local/share/locale'))
                    gettext.textdomain(uuid)
                    with open(local_metadata_path, encoding="utf-8") as metadata:
                        json_data = json.load(metadata)
                        category_label = _(json_data["name"])
                else:
                    system_metadata_path = Path("/usr/share/cinnamon") / _type / uuid / "metadata.json"
                    if system_metadata_path.exists():
                        with open(system_metadata_path, encoding="utf-8") as metadata:
                            json_data = json.load(metadata)
                            category_label = _(json_data["name"])
                if not _id:
                    cat_label = category_label if category_label else uuid
                    new_categories.append([cat_label, uuid, "spices", None, spice_props])
                    instance_num = 1
                elif len(new_categories) == 0 or uuid != new_categories[-1][2]:
                    cat_label = category_label if category_label else uuid
                    new_categories.append([cat_label, uuid, "spices", None, {}])
                    instance_num = 1
                    label = _("Instance") + f" {instance_num}"
                    new_categories.append([label, f"{uuid}_{instance_num}", uuid, None, spice_props])
                    instance_num = 2
                elif len(new_categories) > 0 and uuid == new_categories[-1][2]:
                    label = _("Instance") + f" {instance_num}"
                    new_categories.append([label, f"{uuid}_{instance_num}", uuid, None, spice_props])
                    instance_num += 1

                dbus_info = {}
                dbus_info["highlight"] = spice_props["highlight"]
                dbus_info["uuid"] = spice_props["uuid"]
                dbus_info["instance_id"] = spice_props["instance_id"]
                dbus_info["config_id"] = spice_props["config_id"]
                for binding_key, binding_values in bindings.items():
                    if "@cinnamon.org" in uuid:
                        binding_label = _(list(binding_values.keys())[0])
                    else:
                        home = os.path.expanduser("~")
                        gettext.bindtextdomain(uuid, f"{home}/.local/share/locale")
                        gettext.textdomain(uuid)
                        binding_label = gettext.gettext(list(binding_values.keys())[0])
                    binding_schema = spice_properties[spice]["path"]
                    binding_category = f"{uuid}_{instance_num - 1}" if _id else uuid
                    new_keybindings.append([binding_label, binding_schema, binding_key, binding_category, dbus_info])
                    self._spice_categories[binding_category] = category_label

            cat_lookup = {}

            for cat in new_categories:
                cat_lookup[cat[1]] = cat[0]
                self._spice_store.append(KeyBindingCategory(cat[0], cat[1], cat[2], cat[3], cat[4]))

            for binding in new_keybindings:
                self._spice_categories.setdefault(binding[3], cat_lookup[binding[3]])
                for category in self._spice_store:
                    if category.int_name == binding[3]:
                        kb = KeyBinding(binding[0], binding[1], binding[2], binding[3], self.settings_by_schema_id, binding[4])
                        kb.connect("changed", self._on_kb_changed)

                        self._add_to_collision_table(kb)
                        category.add(kb)
            self.emit("spices-changed")

        resume()


    def _load_custom_store(self):
        settings = self._get_settings_for_schema(CUSTOM_KEYS_PARENT_SCHEMA)
        custom_list = settings.get_strv("custom-list")

        self._custom_store = []
        self._custom_categories = {}

        cat = KeyBindingCategory(_("Custom Shortcuts"), "custom", None, "cinnamon-panel-launcher")
        self._custom_store.append(cat)

        for entry in custom_list:
            if entry == DUMMY_CUSTOM_ENTRY:
                continue

            custom_path = CUSTOM_KEYS_BASENAME+"/"+entry+"/"
            schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)
            custom_kb = CustomKeyBinding(entry,
                                         schema.get_string("name"),
                                         schema.get_string("command"),
                                         schema.get_strv("binding"))
            custom_kb.connect("changed", self._on_kb_changed)

            cat = self._custom_store[0]

            self._add_to_collision_table(custom_kb)
            cat.add(custom_kb)
            self._custom_categories.setdefault("custom", _("Custom Shortcuts"))

    def add_custom_keybinding(self, name, command):
        parent = self._get_settings_for_schema(CUSTOM_KEYS_PARENT_SCHEMA)
        array = parent.get_strv("custom-list")

        num_array = []

        for entry in array:
            if entry == DUMMY_CUSTOM_ENTRY:
                continue

            num_array.append(int(entry.replace("custom", "")))
        num_array.sort()

        i = 0
        while True:
            if i in num_array:
                i += 1
            else:
                break

        new_str = "custom" + str(i)
        array.append(new_str)
        ensureCustomListChanges(array)
        parent.set_strv("custom-list", array)

        new_path = CUSTOM_KEYS_BASENAME + "/custom" + str(i) + "/"
        new_schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, new_path)
        new_schema.set_string("name", name)
        new_schema.set_string("command", command)
        new_schema.set_strv("binding", ())

        self._load_custom_store()
        self.emit("customs-changed")

    def remove_custom_keybinding(self, keybinding):
        custom_path = CUSTOM_KEYS_BASENAME + "/" + keybinding.path + "/"
        custom_schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)
        custom_schema.delay()
        custom_schema.reset("name")
        custom_schema.reset("command")
        custom_schema.reset("binding")
        custom_schema.apply()
        Gio.Settings.sync()

        parent = self._get_settings_for_schema(CUSTOM_KEYS_PARENT_SCHEMA)
        array = parent.get_strv("custom-list")

        existing = False
        for entry in array:
            if keybinding.path == entry:
                existing = True
                break
        if existing:
            array.remove(keybinding.path)
            ensureCustomListChanges(array)
            parent.set_strv("custom-list", array)

        self._load_custom_store()
        self.emit("customs-changed")

    def update_custom_keybinding_details(self, keybinding, new_name, new_command):
        keybinding.setDetails(new_name, new_command)
        self.emit("customs-changed")

    def maybe_update_binding(self, current_keybinding, accel_string, accel_label, position):
        new_accel = Gtk.accelerator_parse_with_keycode(accel_string)

        for cat in self.main_store:
            for keybinding in cat.keybindings:
                for entry in keybinding.entries:
                    if new_accel == Gtk.accelerator_parse_with_keycode(entry):
                        if keybinding.label != current_keybinding.label:
                            dialog = Gtk.MessageDialog(None,
                                                       Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                                       Gtk.MessageType.QUESTION,
                                                       Gtk.ButtonsType.YES_NO,
                                                       None)
                            dialog.set_default_size(400, 125)
                            msg = _("This key combination, <b>%(combination)s</b> is currently in use by <b>%(old)s</b>.  ")
                            msg += _("If you continue, the combination will be reassigned to <b>%(new)s</b>.\n\n")
                            msg += _("Do you want to continue with this operation?")
                            dialog.set_markup(msg % {'combination': escape(accel_label), 'old': escape(keybinding.label), 'new': escape(current_keybinding.label)})
                            dialog.show_all()
                            response = dialog.run()
                            dialog.destroy()
                            if response == Gtk.ResponseType.YES:
                                keybinding.setBinding(keybinding.entries.index(entry), None)
                                self._proxy_send_kb_changed(keybinding)
                            else:
                                return False
        current_keybinding.setBinding(int(position), accel_string)
        self._proxy_send_kb_changed(current_keybinding)
        return True

    def _filter_duplicate_applet_keybindings(self, keybindings):
        all_same = False
        by_uuids = {}

        ret = []

        for keybinding in keybindings:
            uuid = keybinding.dbus_info.get("uuid", None)
            if uuid is None:
                ret.append(keybinding)
                continue

            try:
                by_uuids[uuid].append(keybinding)
            except KeyError:
                by_uuids[uuid] = [keybinding]

        for uuid in by_uuids.keys():
            ret.append(by_uuids[uuid][-1])

        return ret

    def check_for_collisions(self):
        dupes = [dupe for dupe in self._collision_table.keys() if len(self._collision_table[dupe]) > 1]

        if len(dupes) == 0:
            return
        for accel_string in dupes:
            bindings = self._filter_duplicate_applet_keybindings(self._collision_table[accel_string])
            if len(bindings) < 2:
                continue

            key, codes, mods = Gtk.accelerator_parse_with_keycode(accel_string)
            if (key == 0 and len(codes) == 0):
                if accel_string == "XF86Keyboard":
                    label = "Keyboard"
                else:
                    label = accel_string
            else:
                label = Gtk.accelerator_get_label_with_keycode(Gdk.Display.get_default(), key, codes[0], mods)

            dialog = Gtk.MessageDialog(None,
                                       Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                       Gtk.MessageType.QUESTION,
                                       0,
                                       None)
            dialog.set_default_size(400, 125)
            msg = _("This key combination, <b>%(combination)s</b> is currently assigned to multiple actions. ")
            msg += _("Choose the assignment you wish to keep. The others will be cleared.")
            dialog.set_markup(msg % {'combination': escape(label)})

            for i in range(len(bindings)):
                keybinding = bindings[i]
                dialog.add_button(keybinding.label, i)

            dialog.show_all()
            response = dialog.run()
            dialog.destroy()

            try:
                keep_keybinding = bindings[response]
                for keybinding in bindings:
                    if keybinding != keep_keybinding:
                        for i in range(len(keybinding.entries)):
                            if keybinding.entries[i] == accel_string:
                                keybinding.setBinding(i, "")
                                self._proxy_send_kb_changed(keybinding)

            except (KeyError, IndexError):
                pass

    def clear_binding(self, keybinding, position):
        keybinding.setBinding(int(position), None)
        self._proxy_send_kb_changed(keybinding)

    def reset_bindings(self, keybinding):
        keybinding.resetDefaults()
        self._proxy_send_kb_changed(keybinding)

    def lookup_gsettings_keybinding(self, schema_id, key):
        for cat in self._static_store + self._custom_store:
            for keybinding in cat.keybindings:
                if keybinding.schema == schema_id and keybinding.key == key:
                    return keybinding
        return None

    def lookup_json_keybinding(self, uuid, instance_id, key):
        for cat in self._spice_store:
            cat_uuid = cat.int_name.split("_")[0]
            if cat_uuid != uuid:
                continue
            for keybinding in cat.keybindings:
                if instance_id == keybinding.dbus_info["config_id"] and keybinding.key == key:
                    return keybinding
        return None

    def highlight_spice(self, uuid, instance_id, highlight):
        if self._proxy.get_name_owner() is None:
            return

        self._proxy.highlightXlet(
            '(ssb)', uuid, str(instance_id), highlight
        )

instance = None

def get_default():
    global instance
    if instance is None:
        instance = KeybindingTable()
    return instance