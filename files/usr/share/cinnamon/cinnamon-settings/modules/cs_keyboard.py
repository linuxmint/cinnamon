#!/usr/bin/python3

import gettext
import json
import os
import subprocess

from pathlib import Path
from html import escape

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gdk, Gio, Gtk

from KeybindingWidgets import ButtonKeybinding, CellRendererKeybinding
from SettingsWidgets import SidePage
from bin import util
from xapp.GSettingsWidgets import *

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

MASKS = [Gdk.ModifierType.CONTROL_MASK, Gdk.ModifierType.MOD1_MASK,
         Gdk.ModifierType.SHIFT_MASK, Gdk.ModifierType.SUPER_MASK]

CATEGORIES = [
    #   Label                   id                  parent
    #(child)Label                       id                  parent

    [_("General"),          "general",          None,       "preferences-desktop-keyboard-shortcuts"],
    [_("Troubleshooting"),      "trouble",          "general",      None],
    [_("Windows"),          "windows",          None,       "preferences-system-windows"],
    [_("Positioning"),          "win-position",     "windows",      None],
    [_("Tiling and Snapping"),  "win-tiling",       "windows",      None],
    [_("Inter-workspace"),      "win-workspaces",   "windows",      None],
    [_("Inter-monitor"),        "win-monitors",     "windows",      None],
    [_("Workspaces"),       "workspaces",       None,       "video-display"],
    [_("Direct Navigation"),    "ws-navi",          "workspaces",   None],
    [_("System"),           "system",           None,       "preferences-system"],
    [_("Hardware"),             "sys-hw",           "system",       None],
    [_("Screenshots and Recording"),"sys-screen",   "system",       None],
    [_("Launchers"),        "launchers",        None,       "applications-utilities"],
    [_("Sound and Media"),  "media",            None,       "applications-multimedia"],
    [_("Quiet Keys"),           "media-quiet",      "media",        None],
    [_("Universal Access"), "accessibility",    None,       "preferences-desktop-accessibility"],
    [_("Custom Shortcuts"), "custom",           None,       "cinnamon-panel-launcher"],
    [_("Pointer"),          "pointer",          "general",  None],
    [_("Spices"),          "spices",          None,  "cinnamon"]
]

KEYBINDINGS = [
    #   KB Label                        Schema                  Key name               Array?  Category
    # General
    [_("Show the window selection screen"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-down", "general"],
    [_("Show the workspace selection screen"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-up", "general"],
    [_("Show desktop"), MUFFIN_KEYBINDINGS_SCHEMA, "show-desktop", "general"],
    [_("Show Desklets"), CINNAMON_SCHEMA, "show-desklets", "general"],
    [_("Cycle through open windows"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-windows", "general"],
    [_("Cycle backwards through open windows"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-windows-backward", "general"],
    [_("Cycle through windows from all workspaces"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-panels", "general"],
    [_("Cycle backwards through windows from all workspaces"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-panels-backward", "general"],
    [_("Cycle through open windows of the same application"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-group", "general"],
    [_("Cycle backwards through open windows of the same application"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-group-backward", "general"],
    [_("Run dialog"), MUFFIN_KEYBINDINGS_SCHEMA, "panel-run-dialog", "general"],
    # General - Troubleshooting
    [_("Toggle Looking Glass"), CINNAMON_SCHEMA, "looking-glass-keybinding", "trouble"],
    # General - Pointer
    [_("Move pointer to the next monitor"), CINNAMON_SCHEMA, "pointer-next-monitor", "pointer"],
    [_("Move pointer to the previous monitor"), CINNAMON_SCHEMA, "pointer-previous-monitor", "pointer"],
    # Windows
    [_("Maximize window"), MUFFIN_KEYBINDINGS_SCHEMA, "maximize", "windows"],
    [_("Unmaximize window"), MUFFIN_KEYBINDINGS_SCHEMA, "unmaximize", "windows"],
    [_("Minimize window"), MUFFIN_KEYBINDINGS_SCHEMA, "minimize", "windows"],
    [_("Close window"), MUFFIN_KEYBINDINGS_SCHEMA, "close", "windows"],
    [_("Activate window menu"), MUFFIN_KEYBINDINGS_SCHEMA, "activate-window-menu", "windows"],
    [_("Raise window"), MUFFIN_KEYBINDINGS_SCHEMA, "raise", "windows"],
    [_("Lower window"), MUFFIN_KEYBINDINGS_SCHEMA, "lower", "windows"],
    [_("Toggle maximization state"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-maximized", "windows"],
    [_("Toggle fullscreen state"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-fullscreen", "windows"],
    [_("Toggle shaded state"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-shaded", "windows"],
    [_("Toggle always on top"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-above", "windows"],
    [_("Toggle showing window on all workspaces"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-on-all-workspaces", "windows"],
    [_("Increase opacity"), MUFFIN_KEYBINDINGS_SCHEMA, "increase-opacity", "windows"],
    [_("Decrease opacity"), MUFFIN_KEYBINDINGS_SCHEMA, "decrease-opacity", "windows"],
    [_("Toggle vertical maximization"), MUFFIN_KEYBINDINGS_SCHEMA, "maximize-vertically", "windows"],
    [_("Toggle horizontal maximization"), MUFFIN_KEYBINDINGS_SCHEMA, "maximize-horizontally", "windows"],
    # Windows - Positioning
    [_("Resize window"), MUFFIN_KEYBINDINGS_SCHEMA, "begin-resize", "win-position"],
    [_("Move window"), MUFFIN_KEYBINDINGS_SCHEMA, "begin-move", "win-position"],
    [_("Center window in screen"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-center", "win-position"],
    [_("Move window to upper-right"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-ne", "win-position"],
    [_("Move window to upper-left"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-nw", "win-position"],
    [_("Move window to lower-right"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-se", "win-position"],
    [_("Move window to lower-left"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-corner-sw", "win-position"],
    [_("Move window to right edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-e", "win-position"],
    [_("Move window to top edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-n", "win-position"],
    [_("Move window to bottom edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-s", "win-position"],
    [_("Move window to left edge"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-side-w", "win-position"],
    # Windows - Tiling and Snapping
    [_("Push tile left"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-left", "win-tiling"],
    [_("Push tile right"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-right", "win-tiling"],
    [_("Push tile up"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-up", "win-tiling"],
    [_("Push tile down"), MUFFIN_KEYBINDINGS_SCHEMA, "push-tile-down", "win-tiling"],
    # Windows - Workspace-related
    [_("Move window to new workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-new", "win-workspaces"],
    [_("Move window to left workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-left", "win-workspaces"],
    [_("Move window to right workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-right", "win-workspaces"],
    [_("Move window to workspace above"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-up", "win-workspaces"],
    [_("Move window to workspace below"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-down", "win-workspaces"],
    [_("Move window to workspace 1"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-1", "win-workspaces"],
    [_("Move window to workspace 2"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-2", "win-workspaces"],
    [_("Move window to workspace 3"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-3", "win-workspaces"],
    [_("Move window to workspace 4"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-4", "win-workspaces"],
    [_("Move window to workspace 5"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-5", "win-workspaces"],
    [_("Move window to workspace 6"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-6", "win-workspaces"],
    [_("Move window to workspace 7"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-7", "win-workspaces"],
    [_("Move window to workspace 8"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-8", "win-workspaces"],
    [_("Move window to workspace 9"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-9", "win-workspaces"],
    [_("Move window to workspace 10"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-10", "win-workspaces"],
    [_("Move window to workspace 11"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-11", "win-workspaces"],
    [_("Move window to workspace 12"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-12", "win-workspaces"],
    # Windows - Monitor-related
    [_("Move window to left monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-left", "win-monitors"],
    [_("Move window to right monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-right", "win-monitors"],
    [_("Move window to monitor above"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-up", "win-monitors"],
    [_("Move window to monitor below"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-down", "win-monitors"],
    # Workspaces
    [_("Switch to left workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-left", "workspaces"],
    [_("Switch to right workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-right", "workspaces"],
    # Workspaces - Direct Nav
    [_("Switch to workspace 1"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-1", "ws-navi"],
    [_("Switch to workspace 2"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-2", "ws-navi"],
    [_("Switch to workspace 3"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-3", "ws-navi"],
    [_("Switch to workspace 4"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-4", "ws-navi"],
    [_("Switch to workspace 5"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-5", "ws-navi"],
    [_("Switch to workspace 6"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-6", "ws-navi"],
    [_("Switch to workspace 7"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-7", "ws-navi"],
    [_("Switch to workspace 8"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-8", "ws-navi"],
    [_("Switch to workspace 9"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-9", "ws-navi"],
    [_("Switch to workspace 10"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-10", "ws-navi"],
    [_("Switch to workspace 11"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-11", "ws-navi"],
    [_("Switch to workspace 12"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-12", "ws-navi"],
    # System
    [_("Log out"), MEDIA_KEYS_SCHEMA, "logout", "system"],
    [_("Shut down"), MEDIA_KEYS_SCHEMA, "shutdown", "system"],
    [_("Lock screen"), MEDIA_KEYS_SCHEMA, "screensaver", "system"],
    [_("Suspend"), MEDIA_KEYS_SCHEMA, "suspend", "system"],
    [_("Hibernate"), MEDIA_KEYS_SCHEMA, "hibernate", "system"],
    [_("Restart Cinnamon"), MEDIA_KEYS_SCHEMA, "restart-cinnamon", "system"],
    # System - Screenshots
    [_("Take a screenshot of an area"), MEDIA_KEYS_SCHEMA, "area-screenshot", "sys-screen"],
    [_("Copy a screenshot of an area to clipboard"), MEDIA_KEYS_SCHEMA, "area-screenshot-clip", "sys-screen"],
    [_("Take a screenshot"), MEDIA_KEYS_SCHEMA, "screenshot", "sys-screen"],
    [_("Copy a screenshot to clipboard"), MEDIA_KEYS_SCHEMA, "screenshot-clip", "sys-screen"],
    [_("Take a screenshot of a window"), MEDIA_KEYS_SCHEMA, "window-screenshot", "sys-screen"],
    [_("Copy a screenshot of a window to clipboard"), MEDIA_KEYS_SCHEMA, "window-screenshot-clip", "sys-screen"],
    [_("Toggle recording desktop (must restart Cinnamon)"), MUFFIN_KEYBINDINGS_SCHEMA, "toggle-recording", "sys-screen"],
    # System - Hardware
    [_("Switch monitor configurations"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-monitor", "sys-hw"],
    [_("Rotate display"), MUFFIN_KEYBINDINGS_SCHEMA, "rotate-monitor", "sys-hw"],
    [_("Orientation Lock"), MEDIA_KEYS_SCHEMA, "video-rotation-lock", "sys-hw"],
    [_("Increase screen brightness"), MEDIA_KEYS_SCHEMA, "screen-brightness-up", "sys-hw"],
    [_("Decrease screen brightness"), MEDIA_KEYS_SCHEMA, "screen-brightness-down", "sys-hw"],
    [_("Toggle keyboard backlight"), MEDIA_KEYS_SCHEMA, "kbd-brightness-toggle", "sys-hw"],
    [_("Increase keyboard backlight level"), MEDIA_KEYS_SCHEMA, "kbd-brightness-up", "sys-hw"],
    [_("Decrease keyboard backlight level"), MEDIA_KEYS_SCHEMA, "kbd-brightness-down", "sys-hw"],
    [_("Toggle touchpad state"), MEDIA_KEYS_SCHEMA, "touchpad-toggle", "sys-hw"],
    [_("Turn touchpad on"), MEDIA_KEYS_SCHEMA, "touchpad-on", "sys-hw"],
    [_("Turn touchpad off"), MEDIA_KEYS_SCHEMA, "touchpad-off", "sys-hw"],
    [_("Show power statistics"), MEDIA_KEYS_SCHEMA, "battery", "sys-hw"],
    # Launchers
    [_("Launch terminal"), MEDIA_KEYS_SCHEMA, "terminal", "launchers"],
    [_("Launch help browser"), MEDIA_KEYS_SCHEMA, "help", "launchers"],
    [_("Launch calculator"), MEDIA_KEYS_SCHEMA, "calculator", "launchers"],
    [_("Launch email client"), MEDIA_KEYS_SCHEMA, "email", "launchers"],
    [_("Launch web browser"), MEDIA_KEYS_SCHEMA, "www", "launchers"],
    [_("Home folder"), MEDIA_KEYS_SCHEMA, "home", "launchers"],
    [_("Search"), MEDIA_KEYS_SCHEMA, "search", "launchers"],
    # Sound and Media
    [_("Volume mute"), MEDIA_KEYS_SCHEMA, "volume-mute", "media"],
    [_("Volume down"), MEDIA_KEYS_SCHEMA, "volume-down", "media"],
    [_("Volume up"), MEDIA_KEYS_SCHEMA, "volume-up", "media"],
    [_("Mic mute"), MEDIA_KEYS_SCHEMA, "mic-mute", "media"],
    [_("Launch media player"), MEDIA_KEYS_SCHEMA, "media", "media"],
    [_("Play"), MEDIA_KEYS_SCHEMA, "play", "media"],
    [_("Pause playback"), MEDIA_KEYS_SCHEMA, "pause", "media"],
    [_("Stop playback"), MEDIA_KEYS_SCHEMA, "stop", "media"],
    [_("Previous track"), MEDIA_KEYS_SCHEMA, "previous", "media"],
    [_("Next track"), MEDIA_KEYS_SCHEMA, "next", "media"],
    [_("Eject"), MEDIA_KEYS_SCHEMA, "eject", "media"],
    [_("Rewind"), MEDIA_KEYS_SCHEMA, "audio-rewind", "media"],
    [_("Fast-forward"), MEDIA_KEYS_SCHEMA, "audio-forward", "media"],
    [_("Repeat"), MEDIA_KEYS_SCHEMA, "audio-repeat", "media"],
    [_("Shuffle"), MEDIA_KEYS_SCHEMA, "audio-random", "media"],
    # Sound and Media Quiet
    [_("Volume mute (Quiet)"), MEDIA_KEYS_SCHEMA, "mute-quiet", "media-quiet"],    # Not sure this is even necessary
    [_("Volume down (Quiet)"), MEDIA_KEYS_SCHEMA, "volume-down-quiet", "media-quiet"],
    [_("Volume up (Quiet)"), MEDIA_KEYS_SCHEMA, "volume-up-quiet", "media-quiet"],
    # Universal Access
    [_("Zoom in"), CINNAMON_SCHEMA, "magnifier-zoom-in", "accessibility"],
    [_("Zoom out"), CINNAMON_SCHEMA, "magnifier-zoom-out", "accessibility"],
    [_("Turn screen reader on or off"), MEDIA_KEYS_SCHEMA, "screenreader", "accessibility"],
    [_("Turn on-screen keyboard on or off"), MEDIA_KEYS_SCHEMA, "on-screen-keyboard", "accessibility"],
    [_("Increase text size"), MEDIA_KEYS_SCHEMA, "increase-text-size", "accessibility"],
    [_("Decrease text size"), MEDIA_KEYS_SCHEMA, "decrease-text-size", "accessibility"],
    [_("High contrast on or off"), MEDIA_KEYS_SCHEMA, "toggle-contrast", "accessibility"]
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

class Module:
    comment = _("Manage keyboard settings and shortcuts")
    name = "keyboard"
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("keyboard, shortcut, hotkey")
        sidePage = SidePage(_("Keyboard"), "cs-keyboard", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.current_category = None
        self.last_selected_category = None
        self.last_selected_binding = None
        self.loaded = False
        self.binding_categories = {}
        self.main_store = []
        self.cat_store = None
        self.kb_root_store = None
        self.kb_store = None
        self.entry_store = None
        self.cat_tree = None
        self.kb_tree = None
        self.entry_tree = None
        self.color_found = None
        self.placeholder_rgba = None
        self.kb_search_entry = None
        self.kb_search_handler_id = None
        self.add_custom_button = None
        self.remove_custom_button = None
        self.search_choice = "shortcuts"
        self.last_accel_string = ""

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Keyboard module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Typing

            page = SettingsPage()

            settings = page.add_section(_("Key repeat"))

            self.sidePage.stack.add_titled(page, "typing", _("Typing"))

            switch = GSettingsSwitch(_("Enable key repeat"), "org.cinnamon.desktop.peripherals.keyboard", "repeat")
            settings.add_row(switch)

            slider = GSettingsRange(_("Repeat delay:"), "org.cinnamon.desktop.peripherals.keyboard", "delay", _("Short"), _("Long"), 100, 2000, show_value=False)
            settings.add_reveal_row(slider, "org.cinnamon.desktop.peripherals.keyboard", "repeat")

            slider = GSettingsRange(_("Repeat speed:"), "org.cinnamon.desktop.peripherals.keyboard", "repeat-interval", _("Slow"), _("Fast"), 20, 2000, log=True, show_value=False, flipped=True)
            settings.add_reveal_row(slider, "org.cinnamon.desktop.peripherals.keyboard", "repeat")

            settings = page.add_section(_("Text cursor"))

            switch = GSettingsSwitch(_("Text cursor blinks"), "org.cinnamon.desktop.interface", "cursor-blink")
            settings.add_row(switch)

            slider = GSettingsRange(_("Blink speed:"), "org.cinnamon.desktop.interface", "cursor-blink-time", _("Slow"), _("Fast"), 100, 2500, show_value=False, flipped=True)
            settings.add_reveal_row(slider, "org.cinnamon.desktop.interface", "cursor-blink")

            # vbox.add(Gtk.Label.new(_("Test Box")))
            # vbox.add(Gtk.Entry())

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            vbox.set_border_width(6)
            vbox.set_spacing(6)
            self.sidePage.stack.add_titled(vbox, "shortcuts", _("Shortcuts"))
            self.sidePage.stack.connect("notify::visible-child-name", self.stack_page_changed)

            headingbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            mainbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
            headingbox.pack_start(mainbox, True, True, 2)
            headingbox.pack_end(Gtk.Label.new(_("To edit a keyboard binding, click it and press the new keys, or press backspace to clear it.")), False, False, 1)

            paned = Gtk.Paned(orientation = Gtk.Orientation.HORIZONTAL)
            paned.set_wide_handle(True)

            left_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            right_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            self.search_vbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)

            paned.add1(left_vbox)

            right_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            paned.add2(right_box)

            # Text entry search field
            self.kb_search_entry = Gtk.Entry(placeholder_text=_("Type to search shortcuts"))
            self.kb_search_handler_id = self.kb_search_entry.connect("changed", self.on_kb_search_changed)

            # Binding entry search field
            self.kb_search_frame = Gtk.Frame()
            self.kb_search_frame.set_shadow_type(Gtk.ShadowType.IN)
            frame_style = self.kb_search_frame.get_style_context()
            frame_style.add_class("view")
            self.color_found, self.placeholder_rgba = frame_style.lookup_color("placeholder_text_color")
            self.kb_search_frame.set_no_show_all(True)
            self.kb_search_binding = ButtonKeybinding()
            self.kb_search_binding.set_valign(Gtk.Align.CENTER)
            self.kb_search_binding.keybinding_cell.default_value = False
            tooltip_text = _("Press Escape to cancel the search.")
            self.kb_search_binding.set_tooltip_text(tooltip_text)
            text_string = _("Click to search by accelerator")
            self.kb_search_binding.keybinding_cell.text_string = text_string
            if self.color_found:
                self.kb_search_binding.keybinding_cell.set_property("foreground-rgba", self.placeholder_rgba)
            self.kb_search_binding.connect('accel-edited', self.onSearchBindingChanged)
            self.kb_search_binding.connect('accel-cleared', self.onSearchBindingCleared)
            self.kb_search_frame.add(self.kb_search_binding)

            # Search option dropdown
            self.kb_search_type = Gtk.ComboBox()
            options = [(_("Shortcuts"), "shortcuts"),
                       (_("Bindings"), "bindings")]
            model = Gtk.ListStore(str, str)
            for option in options:
                model.append(option)
            self.kb_search_type.set_model(model)
            cell = Gtk.CellRendererText()
            self.kb_search_type.pack_start(cell, False)
            self.kb_search_type.add_attribute(cell, "text", 0)
            self.kb_search_type.set_active(0)
            self.kb_search_type.connect("changed", self.on_kb_search_type_changed)

            # Search menu
            self.search_vbox.pack_start(self.kb_search_entry, True, True, 2)
            self.search_vbox.pack_start(self.kb_search_frame, True, True, 2)
            self.search_vbox.pack_end(self.kb_search_type, False, False, 2)
            right_box.pack_start(self.search_vbox, False, False, 2)

            right_scroller = Gtk.ScrolledWindow.new(None, None)
            right_scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.NEVER)
            right_scroller.add(right_vbox)
            right_box.pack_start(right_scroller, True, True, 2)

            category_scroller = Gtk.ScrolledWindow.new(None, None)
            category_scroller.set_shadow_type(Gtk.ShadowType.IN)

            kb_name_scroller = Gtk.ScrolledWindow.new(None, None)
            kb_name_scroller.set_shadow_type(Gtk.ShadowType.IN)

            entry_scroller = Gtk.ScrolledWindow.new(None, None)
            entry_scroller.set_shadow_type(Gtk.ShadowType.IN)

            right_vbox.pack_start(kb_name_scroller, True, True, 2)
            right_vbox.pack_start(entry_scroller, True, True, 2)
            kb_name_scroller.set_property('min-content-height', 150)
            self.cat_tree = Gtk.TreeView(enable_search=False, search_column=-1)
            self.kb_tree = Gtk.TreeView(enable_search=False, search_column=-1)
            self.entry_tree = Gtk.TreeView(enable_search=False, search_column=-1)

            self.kb_tree.connect('row-activated', self.onCustomKeyBindingEdited)
            self.kb_tree.connect('button-release-event', self.onContextMenuPopup)
            self.kb_tree.connect('key-release-event', self.onContextMenuPopup)
            self.kb_tree.connect('map', self.bindingHighlightOnMap)
            self.kb_tree.connect('focus-in-event', self.bindingHighlightOnMap)
            self.kb_tree.connect('unmap', self.bindingHighlightOnUnmap)
            self.kb_tree.connect('focus-out-event', self.bindingHighlightOnUnmap)
            self.kb_tree.connect('destroy', self.bindingHighlightOff)

            self.entry_tree.connect('focus-in-event', self.bindingHighlightOnMap)
            self.entry_tree.connect('focus-out-event', self.bindingHighlightOnUnmap)

            left_vbox.pack_start(category_scroller, True, True, 2)

            category_scroller.add(self.cat_tree)
            category_scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
            kb_name_scroller.add(self.kb_tree)
            kb_name_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
            entry_scroller.add(self.entry_tree)
            entry_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

            buttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL)
            self.add_custom_button = Gtk.Button.new_with_label(_("Add custom shortcut"))
            self.add_custom_button.connect('clicked', self.onAddCustomButtonClicked)
            self.remove_custom_button = Gtk.Button.new_with_label(_("Remove custom shortcut"))
            self.remove_custom_button.connect('clicked', self.onRemoveCustomButtonClicked)
            self.remove_custom_button.set_property('sensitive', False)
            buttonbox.pack_start(self.add_custom_button, False, False, 2)
            buttonbox.pack_start(self.remove_custom_button, False, False, 2)

            right_vbox.pack_end(buttonbox, False, False, 2)

            mainbox.pack_start(paned, True, True, 2)

            self.cat_store = Gtk.TreeStore(str,     # Icon name or None
                                           str,     # The category name
                                           object)  # The category object

            self.kb_root_store = Gtk.ListStore(str,     # Keybinding name
                                               object)  # The keybinding object

            self.kb_store = Gtk.TreeModelFilter(child_model=self.kb_root_store)
            self.kb_store.set_visible_func(self.kb_store_visible_func)

            self.entry_store = Gtk.ListStore(str)  # Accel string

            cell = Gtk.CellRendererText()
            cell.set_alignment(0, 0)
            pb_cell = Gtk.CellRendererPixbuf()
            cat_column = Gtk.TreeViewColumn(_("Categories"))
            cat_column.pack_start(pb_cell, False)
            cat_column.pack_start(cell, True)
            cat_column.add_attribute(pb_cell, "icon-name", 0)
            cat_column.add_attribute(cell, "text", 1)

            cat_column.set_alignment(0)
            cat_column.set_property('min-width', 200)

            self.cat_tree.append_column(cat_column)
            self.cat_tree.connect("cursor-changed", self.onCategoryChanged)
            self.cat_tree.connect("button-release-event", self.onCategorySelected)
            self.cat_tree.connect("key-release-event", self.onCategorySelected)
            self.cat_tree.connect("row-activated", self.onCategoryChanged)
            self.cat_tree.connect("map", self.categoryHighlightOnMap)
            self.cat_tree.connect("focus-in-event", self.categoryHighlightOnMap)
            self.cat_tree.connect("unmap", self.categoryHighlightUnmap)
            self.cat_tree.connect("destroy", self.categoryHighlightOff)

            kb_name_cell = Gtk.CellRendererText()
            kb_name_cell.set_alignment(.5, .5)
            kb_column = Gtk.TreeViewColumn(_("Keyboard shortcuts"), kb_name_cell, text=0)
            kb_column.set_cell_data_func(kb_name_cell, self.kb_name_cell_data_func)
            kb_column.set_alignment(.5)
            self.kb_tree.append_column(kb_column)
            self.kb_tree.connect("cursor-changed", self.onKeyBindingChanged)

            entry_cell = CellRendererKeybinding(self.entry_tree)
            entry_cell.set_alignment(.5, .5)
            entry_cell.connect('accel-edited', self.onEntryChanged, self.entry_store)
            entry_cell.connect('accel-cleared', self.onEntryCleared, self.entry_store)
            entry_cell.set_property('editable', True)

            entry_column = Gtk.TreeViewColumn(_("Keyboard bindings"), entry_cell, accel_string=0)
            entry_column.connect("clicked", self.bindingHighlightOnMap)
            entry_column.set_alignment(.5)
            self.entry_tree.append_column(entry_column)

            self.entry_tree.set_tooltip_text(CellRendererKeybinding.TOOLTIP_TEXT)
            self.current_category = None
            self.main_store = []

            settings = Gio.Settings.new(ENABLED_SCHEMA)
            enabled_extensions = set()
            enabled_spices = set()

            for applets in settings.get_strv("enabled-applets"):
                applet = applets.split(":")[3]
                enabled_spices.add((applet, 'applets'))

            for desklets in settings.get_strv("enabled-desklets"):
                desklet = desklets.split(":")[0]
                enabled_spices.add((desklet, 'desklets'))

            for extension in settings.get_strv("enabled-extensions"):
                enabled_extensions.add(extension)
                enabled_spices.add((extension, 'extensions'))

            keyboard_spices = sorted(enabled_spices)
            spice_keybinds = {}
            spice_properties = {}

            for spice, _type in keyboard_spices:
                for settings_dir in (OLD_SETTINGS_DIR, SETTINGS_DIR):
                    config_path = Path.joinpath(settings_dir, spice)
                    if Path.exists(config_path):
                        configs = [x for x in os.listdir(config_path) if x.endswith(".json")]
                        if not all(x.split(".json")[0].isdigit() for x in configs) and any(x.split(".json")[0].isdigit() for x in configs):
                            for index, value in enumerate(configs):
                                if not value.split(".json")[0].isdigit():
                                    configs.pop(index)
                        for config in configs:
                            config_json = Path.joinpath(config_path, config)
                            _id = config.split(".json")[0]
                            key_name = f"{spice} {_id}" if _id.isdigit() else spice
                            with open(config_json, encoding="utf-8") as config_file:
                                _config = json.load(config_file)

                                for key, val in _config.items():
                                    if isinstance(val, dict) and val.get("type") == "keybinding":
                                        spice_properties.setdefault(key_name, {})
                                        spice_properties[key_name]["highlight"] = spice not in enabled_extensions
                                        spice_properties[key_name]["path"] = str(config_json)
                                        spice_properties[key_name]["type"] = _type
                                        spice_keybinds.setdefault(key_name, {})
                                        spice_keybinds[key_name].setdefault(key, {})
                                        spice_keybinds[key_name][key] = {val.get("description"): val.get("value").split("::")}

            for spice, bindings in spice_keybinds.items():
                name, *_id = spice.split()

                properties = {spice: spice_properties[spice]}
                _type = spice_properties[spice]["type"]
                if "@cinnamon.org" in name:
                    with open(f"/usr/share/cinnamon/{_type}/{name}/metadata.json", encoding="utf-8") as metadata:
                        json_data = json.load(metadata)
                        category_label = _(json_data["name"])
                else:
                    home = os.path.expanduser("~")
                    gettext.bindtextdomain(name, f"{home}/.local/share/locale")
                    gettext.textdomain(name)
                    try:
                        with open(f"{home}/.local/share/cinnamon/{_type}/{name}/metadata.json", encoding="utf-8") as metadata:
                            json_data = json.load(metadata)
                            category_label = gettext.gettext(_(json_data["name"]))
                    except FileNotFoundError:
                        continue
                if not _id:
                    cat_label = category_label if category_label else name
                    CATEGORIES.append([cat_label, name, "spices", None, properties])
                    instance_num = 1
                elif name != CATEGORIES[-1][2]:
                    cat_label = category_label if category_label else name
                    CATEGORIES.append([cat_label, name, "spices", None, None])
                    instance_num = 1
                    label = _("Instance") + f" {instance_num}"
                    CATEGORIES.append([label, f"{name}_{instance_num}", name, None, properties])
                    instance_num = 2
                elif name == CATEGORIES[-1][2]:
                    label = _("Instance") + f" {instance_num}"
                    CATEGORIES.append([label, f"{name}_{instance_num}", name, None, properties])
                    instance_num += 1

                properties = spice if spice_properties[spice]["highlight"] is True else None
                for binding_key, binding_values in bindings.items():
                    if "@cinnamon.org" in name:
                        binding_label = _(list(binding_values.keys())[0])
                    else:
                        home = os.path.expanduser("~")
                        gettext.bindtextdomain(name, f"{home}/.local/share/locale")
                        gettext.textdomain(name)
                        binding_label = gettext.gettext(list(binding_values.keys())[0])
                    binding_schema = spice_properties[spice]["path"]
                    binding_category = f"{name}_{instance_num - 1}" if _id else name
                    KEYBINDINGS.append([binding_label, binding_schema, binding_key, binding_category, properties])
                    self.binding_categories[binding_category] = category_label

            cat_lookup = {}

            for cat in CATEGORIES:
                cat_lookup[cat[1]] = cat[0]
                elem = None
                if len(cat) > 4:
                    elem = cat[4]
                self.main_store.append(KeyBindingCategory(cat[0], cat[1], cat[2], cat[3], elem))

            for binding in KEYBINDINGS:
                self.binding_categories.setdefault(binding[3], cat_lookup[binding[3]])
                for category in self.main_store:
                    if category.int_name == binding[3]:
                        elem = None
                        if len(binding) > 4:
                            elem = binding[4]
                        category.add(KeyBinding(binding[0], binding[1], binding[2], binding[3], elem))

            cat_iters = {}
            longest_cat_label = " "

            for category in self.main_store:
                if not category.parent:
                    cat_iters[category.int_name] = self.cat_store.append(None)
                else:
                    cat_iters[category.int_name] = self.cat_store.append(cat_iters[category.parent])
                if category.icon:
                    self.cat_store.set_value(cat_iters[category.int_name], 0, category.icon)
                self.cat_store.set_value(cat_iters[category.int_name], 1, category.label)
                self.cat_store.set_value(cat_iters[category.int_name], 2, category)
                if len(category.label) > len(longest_cat_label):
                    longest_cat_label = category.label

            layout = self.cat_tree.create_pango_layout(longest_cat_label)
            w, *__ = layout.get_pixel_size()

            paned.set_position(max(w, 200))

            self.cat_tree.set_model(self.cat_store)
            self.kb_tree.set_model(self.kb_store)
            self.entry_tree.set_model(self.entry_store)

            self.populate_kb_tree()

            vbox.pack_start(headingbox, True, True, 0)

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            vbox.set_border_width(6)
            vbox.set_spacing(6)

            if util.get_session_type() != "wayland":
                self.sidePage.stack.add_titled(vbox, "layouts", _("Layouts"))
                try:
                    widget = self.sidePage.content_box.c_manager.get_c_widget("region")
                except:
                    widget = None

                if widget:
                    cheat_box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
                    cheat_box.pack_start(widget, True, True, 2)
                    cheat_box.set_vexpand(False)
                    widget.show()
                    vbox.pack_start(cheat_box, True, True, 0)

            self.kb_search_entry.grab_focus()

    def stack_page_changed(self, stack, pspec, data=None):
        if stack.get_visible_child_name() == "shortcuts":
            # we grab_focus() twice to work-around a potential search exception
            self.cat_tree.grab_focus()
            self.kb_search_entry.grab_focus()

    def onCategorySelected(self, tree, event=None):
        for mask in MASKS:
            if hasattr(event, "state") and event.state & mask == mask:
                return

        # Remove the highlight due to a binding if it exists
        if self.last_selected_binding:
            self.bindingHighlightOnUnmap()

        model, tree_iter = tree.get_selection().get_selected()
        category = model.get_value(tree_iter, 2) if tree_iter else None
        if category and self.search_choice == "bindings":
            self.onSearchBindingCleared(None)
            self.categoryHighlightOnMap()

        if not category or not category.properties:
            self.categoryHighlightUnmap()
            return

        # If the category hasn't changed, do nothing
        if self.last_selected_category and next(iter(category.properties)) == next(iter(self.last_selected_category)):
            self.categoryHighlightOnMap()
            return

        if hasattr(event, "type") and event.type != Gdk.EventType.FOCUS_CHANGE:
            self.categoryHighlightUnmap()

        self.last_selected_category = category.properties

        # Turn highlighting on (if applicable) if the category switched
        self.categoryHighlightOnMap()

    def onCategoryChanged(self, tree):
        self.kb_search_entry.handler_block(self.kb_search_handler_id)
        self.kb_search_entry.set_text("")
        self.kb_search_entry.handler_unblock(self.kb_search_handler_id)

        if tree.get_selection():
            categories, tree_iter = tree.get_selection().get_selected()
            if tree_iter:
                category = categories.get_value(tree_iter, 2)
                self.current_category = category
                self.kb_store.refilter()

                self.remove_custom_button.set_property("sensitive", category.int_name == "custom")

    def on_kb_search_changed(self, entry, data=None):
        self.cat_tree.get_selection().unselect_all()
        self.bindingHighlightOnUnmap()
        self.current_category = None
        self.last_selected_category = None
        self.last_selected_binding = None
        self.kb_store.refilter()

    def on_kb_search_type_changed(self, entry):
        model = self.kb_search_type.get_model()
        option = self.kb_search_type.get_active()
        self.search_choice = model[option][1]

        if self.search_choice == "shortcuts":
            self.onSearchBindingCleared(None)
            self.kb_search_frame.hide()
            self.kb_search_binding.hide()
            self.kb_search_entry.show()
        else:
            self.kb_search_entry.handler_block(self.kb_search_handler_id)
            self.kb_search_entry.set_text("")
            self.kb_search_entry.handler_unblock(self.kb_search_handler_id)
            self.kb_store.refilter()
            self.kb_search_entry.hide()
            self.kb_search_binding.show()
            self.kb_search_frame.show()

        self.bindingHighlightOnUnmap()
        self.categoryHighlightUnmap()

    def populate_kb_tree(self):
        self.kb_root_store.clear()
        self.current_category = None
        self.kb_search_entry.handler_block(self.kb_search_handler_id)
        self.kb_search_entry.set_text("")
        self.kb_search_entry.handler_unblock(self.kb_search_handler_id)

        for category in self.main_store:
            for keybinding in category.keybindings:
                self.kb_root_store.append((keybinding.label, keybinding))
        self.loadCustoms()

    def kb_name_cell_data_func(self, column, cell, model, tree_iter, data=None):
        binding = model.get_value(tree_iter, 1)

        if binding and self.kb_search_entry.get_text() or self.kb_search_binding.get_accel_string():
            category = escape(self.binding_categories[binding.category])
            __, *num = binding.category.split("_")
            _id = f" {num[0]}" if num else ""
            label = escape(binding.label)
            markup = f"<span font_weight='ultra-light'>({category}{_id})</span> {label}"
            cell.set_property("markup", markup)
        else:
            cell.set_property("text", binding.label)

    def kb_store_visible_func(self, model, tree_iter, data=None):
        if self.search_choice == "shortcuts":
            if not self.current_category and not self.kb_search_entry.get_text():
                return False

            keybinding = self.kb_root_store.get_value(tree_iter, 1)

            search = self.kb_search_entry.get_text().lower().strip()
            if search:
                return search in keybinding.label.lower().strip()

            if self.current_category and hasattr(self.current_category, 'int_name'):
                return keybinding.category == self.current_category.int_name
        else:
            if not self.current_category and not self.kb_search_binding.get_accel_string():
                return False

            keybinding = self.kb_root_store.get_value(tree_iter, 1)

            search = self.kb_search_binding.get_accel_string()
            if search:
                entries = [Gtk.accelerator_parse_with_keycode(entry) for entry in keybinding.entries]
                return Gtk.accelerator_parse_with_keycode(search) in entries

            if self.current_category and hasattr(self.current_category, 'int_name'):
                return keybinding.category == self.current_category.int_name

    def loadCustoms(self):
        tree_iter = self.kb_root_store.get_iter_first()

        while tree_iter:
            # Removing a row moves the iter to the next row, which may also be
            # custom, so we don't want to call iter_next() until we hit a row
            # that isn't, otherwise we may skip one.
            keybinding = self.kb_root_store.get_value(tree_iter, 1)
            if keybinding.category == "custom":
                if not self.kb_root_store.remove(tree_iter):
                    break
                continue

            tree_iter = self.kb_root_store.iter_next(tree_iter)

        parent = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA)
        custom_list = parent.get_strv("custom-list")

        for entry in custom_list:
            if entry == DUMMY_CUSTOM_ENTRY:
                continue

            custom_path = CUSTOM_KEYS_BASENAME+"/"+entry+"/"
            schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)
            custom_kb = CustomKeyBinding(entry,
                                         schema.get_string("name"),
                                         schema.get_string("command"),
                                         schema.get_strv("binding"))
            self.kb_root_store.append((custom_kb.label, custom_kb))
            self.binding_categories.setdefault("custom", _("Custom Shortcuts"))

    def onKeyBindingChanged(self, tree):
        self.entry_store.clear()

        if tree.get_selection():
            keybindings, tree_iter = tree.get_selection().get_selected()
            if tree_iter and self.search_choice == "bindings" and self.kb_search_binding.accel_string:
                pass
            elif tree_iter and self.search_choice == "bindings" and self.last_accel_string and self.kb_search_binding.accel_string:
                if self.last_accel_string != self.kb_search_binding.accel_string:
                    if self.color_found:
                        self.kb_search_binding.keybinding_cell.set_property("foreground-rgba", self.placeholder_rgba)
                    self.last_accel_string = self.kb_search_binding.accel_string
                    self.kb_search_binding.keybinding_cell.set_value(None)
                    self.kb_search_binding.accel_string = ""
                    self.kb_search_binding.load_model()

            if tree_iter:
                keybinding = keybindings.get_value(tree_iter, 1)
                for entry in keybinding.entries:
                    if entry != "_invalid_":
                        self.entry_store.append((entry,))
                self.remove_custom_button.set_property('sensitive', isinstance(keybinding, CustomKeyBinding))

            if self.search_choice == "bindings" and self.kb_search_binding.accel_string:
                self.last_accel_string = self.kb_search_binding.accel_string

    def onEntryChanged(self, cell, path, accel_string, accel_label, entry_store):
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings.get_value(kb_iter, 1)

        # Check for duplicates
        for category in self.main_store:
            for keybinding in category.keybindings:
                for entry in keybinding.entries:
                    found = False
                    if Gtk.accelerator_parse_with_keycode(accel_string) == Gtk.accelerator_parse_with_keycode(entry):
                        found = True

                    if found and keybinding.label != current_keybinding.label:
                        dialog = Gtk.MessageDialog(None,
                                                   Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                                   Gtk.MessageType.QUESTION,
                                                   Gtk.ButtonsType.YES_NO,
                                                   None)
                        dialog.set_default_size(400, 200)
                        msg = _("This key combination, <b>%(combination)s</b> is currently in use by <b>%(old)s</b>.  ")
                        msg += _("If you continue, the combination will be reassigned to <b>%(new)s</b>.\n\n")
                        msg += _("Do you want to continue with this operation?")
                        dialog.set_markup(msg % {'combination': escape(accel_label), 'old': escape(keybinding.label), 'new': escape(current_keybinding.label)})
                        dialog.show_all()
                        response = dialog.run()
                        dialog.destroy()
                        if response == Gtk.ResponseType.YES:
                            keybinding.setBinding(keybinding.entries.index(entry), None)
                        else:
                            return
        current_keybinding.setBinding(int(path), accel_string)
        self.onKeyBindingChanged(self.kb_tree)
        self.entry_tree.get_selection().select_path(path)

    def onEntryCleared(self, cell, path, entry_store):
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings.get_value(kb_iter, 1)
        current_keybinding.setBinding(int(path), None)
        self.onKeyBindingChanged(self.kb_tree)
        self.entry_tree.get_selection().select_path(path)

    def onSearchBindingChanged(self, cell, path, accel_string):
        if self.color_found:
            self.kb_search_binding.keybinding_cell.set_property("foreground-rgba", None)
        self.kb_store.refilter()
        self.current_category = None
        self.cat_tree.get_selection().unselect_all()
        self.bindingHighlightOff()

    def onSearchBindingCleared(self, cell):
        if self.color_found:
            self.kb_search_binding.keybinding_cell.set_property("foreground-rgba", self.placeholder_rgba)
        self.kb_search_binding.keybinding_cell.set_value(None)
        self.kb_search_binding.accel_string = ""
        self.kb_search_binding.load_model()
        self.kb_store.refilter()

    def onAddCustomButtonClicked(self, button):
        dialog = AddCustomDialog(False)

        dialog.show_all()
        response = dialog.run()
        if response in (Gtk.ResponseType.CANCEL, Gtk.ResponseType.DELETE_EVENT):
            dialog.destroy()
            return

        parent = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA)
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
        new_schema.set_string("name", dialog.name_entry.get_text())
        new_schema.set_string("command", dialog.command_entry.get_text())
        new_schema.set_strv("binding", ())

        self.loadCustoms()
        self.kb_store.refilter()

        for index, cat in enumerate(self.cat_store):
            if cat[2].int_name == "custom":
                self.cat_tree.set_cursor(str(index), self.cat_tree.get_column(0), False)

        for index, keybinding in enumerate(self.kb_store):
            if keybinding[0] == dialog.name_entry.get_text():
                self.kb_tree.set_cursor(str(index), self.kb_tree.get_column(0), False)

        dialog.destroy()

    def onRemoveCustomButtonClicked(self, button):
        keybindings, tree_iter = self.kb_tree.get_selection().get_selected()
        if tree_iter:
            keybinding = keybindings.get_value(tree_iter, 1)

            custom_path = CUSTOM_KEYS_BASENAME + "/" + keybinding.path + "/"
            custom_schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)
            custom_schema.delay()
            custom_schema.reset("name")
            custom_schema.reset("command")
            custom_schema.reset("binding")
            custom_schema.apply()
            Gio.Settings.sync()

            parent_settings = Gio.Settings(CUSTOM_KEYS_PARENT_SCHEMA)
            array = parent_settings.get_strv("custom-list")

            existing = False
            for entry in array:
                if keybinding.path == entry:
                    existing = True
                    break
            if existing:
                array.remove(keybinding.path)
                ensureCustomListChanges(array)
                parent_settings.set_strv("custom-list", array)

        self.loadCustoms()
        self.kb_store.refilter()

    def onCustomKeyBindingEdited(self, kb_treeview, column, kb_column):
        keybindings, tree_iter = kb_treeview.get_selection().get_selected()
        if tree_iter:
            keybinding = keybindings.get_value(tree_iter, 1)
            if isinstance(keybinding, KeyBinding):
                return
            dialog = AddCustomDialog(True)
            dialog.name_entry.set_text(keybinding.label)
            dialog.command_entry.set_text(keybinding.action)
            dialog.show_all()
            response = dialog.run()
            if response != Gtk.ResponseType.OK:
                dialog.destroy()
                return

            keybinding.label = dialog.name_entry.get_text()
            keybinding.action = dialog.command_entry.get_text()
            keybinding.writeSettings()

            for index, keybinding in enumerate(self.kb_store):
                if keybinding[0] == dialog.name_entry.get_text():
                    self.kb_tree.set_cursor(str(index), self.kb_tree.get_column(0), False)

            dialog.destroy()

            self.loadCustoms()
            self.kb_store.refilter()

    def onContextMenuPopup(self, tree, event=None):
        for mask in MASKS:
            if hasattr(event, 'state') and event.state & mask == mask:
                return
        model, tree_iter = tree.get_selection().get_selected()
        binding = model.get_value(tree_iter, 1) if tree_iter else None

        if self.last_selected_binding and binding and hasattr(binding, "properties") and self.last_selected_binding != binding.properties:
            self.bindingHighlightOnUnmap()

        search_input_text = False
        if self.kb_search_entry.get_text():
            search_input_text = True

        if binding and hasattr(binding, "category"):
            for index, category in enumerate(self.cat_store):
                if category[2].int_name == binding.category:
                    if not category[2].parent:
                        self.cat_tree.set_cursor(Gtk.TreePath(str(index)), None, False)
                        break
            else:
                for category in self.main_store:
                    if category.int_name == binding.category:
                        cat_iter = self.recurseCatTree(self.cat_store.get_iter_first(), binding.category)
                        _path = self.cat_store.get_path(cat_iter)
                        self.cat_tree.expand_to_path(_path)
                        self.cat_tree.set_cursor(_path)
                        break

        if binding and hasattr(binding, "properties") and binding.properties:
            if not self.current_category:
                self.current_category = binding.properties
            if self.last_selected_binding and self.last_selected_binding == binding.properties:
                if event and event.type != Gdk.EventType.BUTTON_RELEASE or event.button != 3:
                    return

            self.last_selected_binding = binding.properties
            self.bindingHighlightOnMap()

        if tree_iter:
            if search_input_text or self.kb_search_binding.accel_string:
                self.onSearchBindingCleared(None)
                return
            if isinstance(binding, CustomKeyBinding):
                return
            if event:
                if event.type != Gdk.EventType.BUTTON_RELEASE or event.button != 3:
                    return
                button = event.button
                event_time = event.time
                info = tree.get_path_at_pos(int(event.x), int(event.y))
                if info:
                    path, col, *__ = info
                    tree.grab_focus()
                    tree.set_cursor(path, col, 0)
            else:
                path = model.get_path(tree_iter)
                button = 0
                event_time = 0
                tree.grab_focus()

            popup = Gtk.Menu()
            popup.attach_to_widget(tree, None)
            popup_reset_item = Gtk.MenuItem(_("Reset to default"))
            popup_reset_item.show()
            popup.append(popup_reset_item)
            popup_reset_item.connect('activate', self.onResetToDefault, binding)
            popup.popup(None, None, None, None, button, event_time)

            return True

    def recurseCatTree(self, tree_iter, binding_category):
        result = None
        model = self.cat_tree.get_model()
        while not result and tree_iter:
            category_name = model.get_value(tree_iter, 2).int_name
            if category_name == binding_category:
                result = tree_iter
                break
            if self.cat_store.iter_has_child(tree_iter):
                child_iter = self.cat_store.iter_children(tree_iter)
                result = self.recurseCatTree(child_iter, binding_category)
            tree_iter = self.cat_store.iter_next(tree_iter)
        return result

    def onResetToDefault(self, popup, keybinding):
        keybinding.resetDefaults()
        self.onKeyBindingChanged(self.kb_tree)

    def categoryHighlightOnMap(self, *args):
        # Turn highlighting on (if applicable)
        if not self.last_selected_category:
            return

        if self.last_selected_category and next(iter(self.last_selected_category.values())).get("highlight", False):
            highlight_on = next(iter(self.last_selected_category))
            _uuid, *_id = highlight_on.split()
            _id = f"'{_id[0]}'" if _id else _uuid
            subprocess.run(["/usr/bin/cinnamon-dbus-command", "highlightXlet",
                            _uuid, _id, "True"],
                           stdout=subprocess.DEVNULL, check=False)

    def categoryHighlightUnmap(self, *args):
        # Turn highlighting off (if applicable)
        if self.last_selected_category and next(iter(self.last_selected_category.values())).get("highlight", False):
            highlight_off = next(iter(self.last_selected_category))
            _uuid, *_id = highlight_off.split()
            _id = f"'{_id[0]}'" if _id else _uuid
            subprocess.run(["/usr/bin/cinnamon-dbus-command", "highlightXlet",
                            _uuid, _id, "False"],
                           stdout=subprocess.DEVNULL, check=False)

    def categoryHighlightOff(self, *args):
        # Unset highlighting (if applicable) e.g. when closing the window
        self.categoryHighlightUnmap()

        self.last_selected_category = None

    def bindingHighlightOnMap(self, *args):
        # Turn highlighting on (if applicable)
        if self.last_selected_binding:
            _uuid, *_id = self.last_selected_binding.split()
            _id = f"'{_id[0]}'" if _id else _uuid
            subprocess.run(["/usr/bin/cinnamon-dbus-command", "highlightXlet",
                            _uuid, _id, "True"],
                           stdout=subprocess.DEVNULL, check=False)

    def bindingHighlightOnUnmap(self, *args):
        # Turn highlighting off (if applicable)
        if self.last_selected_binding:
            _uuid, *_id = self.last_selected_binding.split()
            _id = f"'{_id[0]}'" if _id else _uuid
            subprocess.run(["/usr/bin/cinnamon-dbus-command", "highlightXlet",
                            _uuid, _id, "False"],
                           stdout=subprocess.DEVNULL, check=False)

    def bindingHighlightOff(self, *args):
        # Unset highlighting (if applicable) e.g. when closing the window
        self.bindingHighlightOnUnmap()

        self.last_selected_binding = None


class KeyBindingCategory:
    def __init__(self, label, int_name, parent, icon, properties=None):
        self.label = label
        self.parent = parent
        self.icon = icon
        self.int_name = int_name
        self.properties = properties
        self.keybindings = []

    def add(self, keybinding):
        self.keybindings.append(keybinding)

    def clear(self):
        del self.keybindings[:]


class KeyBinding:
    def __init__(self, label, schema, key, category, properties=None):
        self.key = key
        self.category = category
        self.label = label
        self.schema = schema
        self.entries = []
        self.settings = Gio.Settings.new(schema) if "/" not in schema else schema
        self.properties = properties
        self.loadSettings()

    def loadSettings(self):
        del self.entries[:]
        self.entries = self.get_array(self.settings.get_strv(self.key)) if "/" not in self.settings else self.getConfigSettings()

    def getConfigSettings(self):
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
            with open(self.schema, encoding="utf-8") as config_file:
                config = json.load(config_file)

            config[self.key]["value"] = "::".join(array) if array else "::"

            with open(self.schema, "w", encoding="utf-8") as config_file:
                config_file.write(json.dumps(config, indent=4))

    def resetDefaults(self):
        if "/" not in self.schema:
            self.settings.reset(self.key)
        else:
            with open(self.schema, encoding="utf-8") as config_file:
                config = json.load(config_file)

            config[self.key]["value"] = config[self.key]["default"]

            with open(self.schema, "w", encoding="utf-8") as config_file:
                config_file.write(json.dumps(config, indent=4))

        self.loadSettings()


class CustomKeyBinding:
    def __init__(self, path, label, action, binding):
        self.category = "custom"
        self.path = path
        self.label = label
        self.action = action
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
        self.writeSettings()

    def writeSettings(self):
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


class AddCustomDialog(Gtk.Dialog):
    def __init__(self, edit_mode):
        if edit_mode:
            ok_button_label = _("Update")
        else:
            ok_button_label = _("Add")
        super(AddCustomDialog, self).__init__(_("Add custom shortcut"),
                                              None,
                                              0,
                                              (ok_button_label, Gtk.ResponseType.OK,
                                               _("Cancel"), Gtk.ResponseType.CANCEL))
        self.set_default_size(350, 100)
        name_box = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
        command_box = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
        name_box.pack_start(Gtk.Label.new(_("Name:")), False, False, 2)
        command_box.pack_start(Gtk.Label.new(_("Command:")), False, False, 2)
        self.name_entry = Gtk.Entry()
        self.name_entry.connect('changed', self.onEntriesChanged)
        self.command_entry = Gtk.Entry()
        self.command_entry.connect('changed', self.onEntriesChanged)
        name_box.pack_start(self.name_entry, True, True, 2)
        command_box.pack_start(self.command_entry, True, True, 2)

        self.file_picker = Gtk.FileChooserButton(_("Select a file"), Gtk.FileChooserAction.OPEN)
        self.file_picker.connect('file-set', self.onFilePicked)
        command_box.pack_start(self.file_picker, False, False, 2)

        self.vbox.pack_start(name_box, True, True, 2)
        self.vbox.pack_start(command_box, True, True, 2)

        self.onEntriesChanged(self)

    def onFilePicked(self, widget):
        file = self.file_picker.get_file()
        self.command_entry.set_text(file.get_path().replace(" ", r"\ "))

    def onEntriesChanged(self, widget):
        ok_enabled = self.name_entry.get_text().strip() and self.command_entry.get_text().strip()
        self.set_response_sensitive(Gtk.ResponseType.OK, ok_enabled)
