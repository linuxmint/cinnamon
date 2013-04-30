#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk
import cgi
import gettext

gettext.install("cinnamon", "/usr/share/cinnamon/locale")

# Keybindings page - check if we need to store custom
# keybindings to gsettings key as well as GConf (In Mint 14 this is changed)
CUSTOM_KEYS_BASENAME = "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"
CUSTOM_KEYS_SCHEMA = "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding"
CUSTOM_KEYBINDINGS_GSETTINGS = False
HAS_DEDICATED_TERMINAL_SHORTCUT = False

schema = Gio.Settings("org.gnome.settings-daemon.plugins.media-keys")
key_list = schema.list_keys()
for key in key_list:
    if key == "custom-keybindings":
        CUSTOM_KEYBINDINGS_GSETTINGS = True
    if key == "terminal":
        HAS_DEDICATED_TERMINAL_SHORTCUT = True

FORBIDDEN_KEYVALS = [
    Gdk.KEY_Home,
    Gdk.KEY_Left,
    Gdk.KEY_Up,
    Gdk.KEY_Right,
    Gdk.KEY_Down,
    Gdk.KEY_Page_Up,
    Gdk.KEY_Page_Down,
    Gdk.KEY_End,
    Gdk.KEY_Tab,
    Gdk.KEY_KP_Enter,
    Gdk.KEY_Return,
    Gdk.KEY_space,
    Gdk.KEY_Mode_switch
]

KEYBINDINGS = [
    #   KB Label                        Schema                  Key name               Array?  Category
    # Cinnamon stuff
    [_("Toggle Scale"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-down", True, "cinnamon"],
    [_("Toggle Expo"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-up", True, "cinnamon"],
    [_("Cycle through open windows"), "org.gnome.desktop.wm.keybindings", "switch-windows", True, "cinnamon"],
    [_("Cycle backwards though open windows"), "org.gnome.desktop.wm.keybindings", "switch-windows-backward", True, "cinnamon"],
    [_("Run dialog (must restart Cinnamon)"), "org.gnome.desktop.wm.keybindings", "panel-run-dialog", True, "cinnamon"],
    [_("Menu button (must restart Cinnamon)"), "org.cinnamon.muffin", "overlay-key", False, "cinnamon"],

    # Windows - General
    [_("Maximize window"), "org.gnome.desktop.wm.keybindings", "maximize", True, "windows"],
    [_("Unmaximize window"), "org.gnome.desktop.wm.keybindings", "unmaximize", True, "windows"],
    [_("Minimize window"), "org.gnome.desktop.wm.keybindings", "minimize", True, "windows"],
    [_("Toggle tiled left (must restart Cinnamon)"), "org.cinnamon.muffin.keybindings", "toggle-tiled-left", True, "windows"],
    [_("Toggle tiled right (must restart Cinnamon)"), "org.cinnamon.muffin.keybindings", "toggle-tiled-right", True, "windows"],
    [_("Close window"), "org.gnome.desktop.wm.keybindings", "close", True, "windows"],
    [_("Show desktop"), "org.gnome.desktop.wm.keybindings", "show-desktop", True, "windows"],
    [_("Activate window menu"), "org.gnome.desktop.wm.keybindings", "activate-window-menu", True, "windows"],
    [_("Toggle maximization state"), "org.gnome.desktop.wm.keybindings", "toggle-maximized", True, "windows"],
    [_("Toggle fullscreen state"), "org.gnome.desktop.wm.keybindings", "toggle-fullscreen", True, "windows"],
    [_("Toggle shaded state"), "org.gnome.desktop.wm.keybindings", "toggle-shaded", True, "windows"],
    [_("Maximize vertically"), "org.gnome.desktop.wm.keybindings", "maximize-vertically", True, "windows"],
    [_("Maximize horizontally"), "org.gnome.desktop.wm.keybindings", "maximize-horizontally", True, "windows"],
    [_("Resize window"), "org.gnome.desktop.wm.keybindings", "begin-resize", True, "windows"],
    [_("Move window"), "org.gnome.desktop.wm.keybindings", "begin-move", True, "windows"],
    [_("Center window in screen"), "org.gnome.desktop.wm.keybindings", "move-to-center", True, "windows"],
    [_("Move window to upper-right"), "org.gnome.desktop.wm.keybindings", "move-to-corner-ne", True, "windows"],
    [_("Move window to upper-left"), "org.gnome.desktop.wm.keybindings", "move-to-corner-nw", True, "windows"],
    [_("Move window to lower-right"), "org.gnome.desktop.wm.keybindings", "move-to-corner-se", True, "windows"],
    [_("Move window to lower-left"), "org.gnome.desktop.wm.keybindings", "move-to-corner-sw", True, "windows"],
    [_("Move window to right edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-e", True, "windows"],
    [_("Move window to top edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-n", True, "windows"],
    [_("Move window to bottom edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-s", True, "windows"],
    [_("Move window to left edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-w", True, "windows"],

    # Workspace management
    [_("Toggle showing window on all workspaces"), "org.gnome.desktop.wm.keybindings", "toggle-on-all-workspaces", True, "ws-manage"],
    [_("Switch to left workspace"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-left", True, "ws-manage"],
    [_("Switch to right workspace"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-right", True, "ws-manage"],
    [_("Switch to workspace 1"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-1", True, "ws-manage"],
    [_("Switch to workspace 2"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-2", True, "ws-manage"],
    [_("Switch to workspace 3"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-3", True, "ws-manage"],
    [_("Switch to workspace 4"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-4", True, "ws-manage"],
    [_("Switch to workspace 5"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-5", True, "ws-manage"],
    [_("Switch to workspace 6"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-6", True, "ws-manage"],
    [_("Switch to workspace 7"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-7", True, "ws-manage"],
    [_("Switch to workspace 8"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-8", True, "ws-manage"],
    [_("Switch to workspace 9"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-9", True, "ws-manage"],
    [_("Switch to workspace 10"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-10", True, "ws-manage"],
    [_("Switch to workspace 11"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-11", True, "ws-manage"],
    [_("Switch to workspace 12"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-12", True, "ws-manage"],
    [_("Move window to left workspace"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-left", True, "ws-manage"],
    [_("Move window to right workspace"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-right", True, "ws-manage"],
    [_("Move window to workspace 1"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-1", True, "ws-manage"],
    [_("Move window to workspace 2"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-2", True, "ws-manage"],
    [_("Move window to workspace 3"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-3", True, "ws-manage"],
    [_("Move window to workspace 4"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-4", True, "ws-manage"],
    [_("Move window to workspace 5"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-5", True, "ws-manage"],
    [_("Move window to workspace 6"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-6", True, "ws-manage"],
    [_("Move window to workspace 7"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-7", True, "ws-manage"],
    [_("Move window to workspace 8"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-8", True, "ws-manage"],
    [_("Move window to workspace 9"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-9", True, "ws-manage"],
    [_("Move window to workspace 10"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-10", True, "ws-manage"],
    [_("Move window to workspace 11"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-11", True, "ws-manage"],
    [_("Move window to workspace 12"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-12", True, "ws-manage"],

    # System
    [_("Log out"), "org.gnome.settings-daemon.plugins.media-keys", "logout", False, "system"],
    [_("Lock screen"), "org.gnome.settings-daemon.plugins.media-keys", "screensaver", False, "system"],
    [_("Toggle recording desktop (must restart Cinnamon)"), "org.cinnamon.muffin.keybindings", "toggle-recording", True, "system"],

    # Launchers
    [_("Launch help browser"), "org.gnome.settings-daemon.plugins.media-keys", "help", False, "launchers"],
    [_("Launch calculator"), "org.gnome.settings-daemon.plugins.media-keys", "calculator", False, "launchers"],
    [_("Launch email client"), "org.gnome.settings-daemon.plugins.media-keys", "email", False, "launchers"],
    [_("Launch web browser"), "org.gnome.settings-daemon.plugins.media-keys", "www", False, "launchers"],
    [_("Home folder"), "org.gnome.settings-daemon.plugins.media-keys", "home", False, "launchers"],
    [_("Search"), "org.gnome.settings-daemon.plugins.media-keys", "search", False, "launchers"],

    # Sound and Media
    [_("Volume mute"), "org.gnome.settings-daemon.plugins.media-keys", "volume-mute", False, "media"],
    [_("Volume down"), "org.gnome.settings-daemon.plugins.media-keys", "volume-down", False, "media"],
    [_("Volume up"), "org.gnome.settings-daemon.plugins.media-keys", "volume-up", False, "media"],
    [_("Launch media player"), "org.gnome.settings-daemon.plugins.media-keys", "media", False, "media"],
    [_("Play"), "org.gnome.settings-daemon.plugins.media-keys", "play", False, "media"],
    [_("Pause playback"), "org.gnome.settings-daemon.plugins.media-keys", "pause", False, "media"],
    [_("Stop playback"), "org.gnome.settings-daemon.plugins.media-keys", "stop", False, "media"],
    [_("Previous track"), "org.gnome.settings-daemon.plugins.media-keys", "previous", False, "media"],
    [_("Next track"), "org.gnome.settings-daemon.plugins.media-keys", "next", False, "media"],
    [_("Eject"), "org.gnome.settings-daemon.plugins.media-keys", "eject", False, "media"],

    # Universal Access
    [_("Turn zoom on or off"), "org.gnome.settings-daemon.plugins.media-keys", "magnifier", False, "accessibility"],
    [_("Zoom in"), "org.gnome.settings-daemon.plugins.media-keys", "magnifier-zoom-in", False, "accessibility"],
    [_("Zoom out"), "org.gnome.settings-daemon.plugins.media-keys", "magnifier-zoom-out", False, "accessibility"],
    [_("Turn screen reader on or off"), "org.gnome.settings-daemon.plugins.media-keys", "screenreader", False, "accessibility"],
    [_("Turn on-screen keyboard on or off"), "org.gnome.settings-daemon.plugins.media-keys", "on-screen-keyboard", False, "accessibility"],
    [_("Increase text size"), "org.gnome.settings-daemon.plugins.media-keys", "increase-text-size", False, "accessibility"],
    [_("Decrease text size"), "org.gnome.settings-daemon.plugins.media-keys", "decrease-text-size", False, "accessibility"],
    [_("High contrast on or off"), "org.gnome.settings-daemon.plugins.media-keys", "toggle-contrast", False, "accessibility"]
]

if HAS_DEDICATED_TERMINAL_SHORTCUT:
    KEYBINDINGS.append([_("Launch terminal"), "org.gnome.settings-daemon.plugins.media-keys", "terminal", False, "launchers"])

class Module:
    def __init__(self, content_box):
        keywords = _("keyboard, shortcut, hotkey")
        advanced = True
        sidePage = KeyboardSidePage(_("Keyboard"), "keyboard.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "keyboard"
        self.category = "hardware"

        # Let us transition any existing gconf shortcuts over to gsettings
        # Since we are still going to support both, and really only track gconf (for now)
        # We will only do this on the first run of Cinnamon Settings after an upgrade.
        schema = Gio.Settings("org.cinnamon.overrides")
        first_run_completed = schema.get_boolean("custom-keybindings-to-3-6")

        if CUSTOM_KEYBINDINGS_GSETTINGS and not first_run_completed:
            gclient = GConf.Client.get_default()
            path = "/desktop/gnome/keybindings"
            subdirs = gclient.all_dirs(path)
            for subdir in subdirs:
                custom_kb = CustomKeyBinding(subdir,
                                             gclient.get_string(subdir+"/name"),
                                             gclient.get_string(subdir+"/action"),
                                             gclient.get_string(subdir+"/binding"))
                custom_kb.writeSettings()
            schema.set_boolean("custom-keybindings-to-3-6", True)

        ###### Done with upgrade

class KeyBindingCategory():
    def __init__(self, label, int_name):
        self.label = label
        self.int_name = int_name
        self.keybindings = []

    def add(self, keybinding):
        self.keybindings.append(keybinding)

    def clear(self):
        del self.keybindings[:]

class KeyBinding():
    def __init__(self, label, schema, key, is_array, category):
        self.key = key
        self.label = label
        self.is_array = is_array
        self.entries = [ ]
        self.settings = Gio.Settings.new(schema)
        self.loadSettings()

    def loadSettings(self):
        del self.entries[:]
        if self.is_array:
            self.entries = self.get_array(self.settings.get_strv(self.key))
        else:
            self.entries = self.get_array(self.settings.get_string(self.key))

    def get_array(self, raw_array):
        result = []
        if self.is_array:
            for entry in raw_array:
                result.append(entry)
            while (len(result) < 3):
                result.append("")
        else:
            result.append(raw_array)
            while (len(result) < 3):
                result.append("_invalid_")
        return result

    def setBinding(self, index, val):
        if val is not None:
            self.entries[index] = val
        else:
            self.entries[index] = ""
        self.writeSettings()

    def writeSettings(self):
        if self.is_array:
            array = []
            for entry in self.entries:
                if entry is not "":
                    array.append(entry)
            self.settings.set_strv(self.key, array)
        else:
            self.settings.set_string(self.key, self.entries[0])

    def resetDefaults(self):
        self.settings.reset(self.key)
        self.loadSettings()

class CustomKeyBinding():
    def __init__(self, path, label, action, binding):
        self.path = path
        self.label = label
        self.action = action
        self.entries = []
        self.entries.append(binding)

    def setBinding(self, index, val):
        if val is not None:
            self.entries[index] = val
        else:
            self.entries[index] = ""
        self.writeSettings()

    def writeSettings(self):
        gclient = GConf.Client.get_default()
        gclient.set_string(self.path + "/name", self.label)
        gclient.set_string(self.path + "/action", self.action)
        gclient.set_string(self.path + "/binding", self.entries[0])
        if CUSTOM_KEYBINDINGS_GSETTINGS:
            temp = self.path.split("/")
            custom_gconf_id = temp[len(temp)-1] # get the "custom0" or "custom1" id from gconf path
            custom_path = CUSTOM_KEYS_BASENAME+"/"+custom_gconf_id+"/"
            custom_schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)
            custom_schema.set_string("name", self.label)
            custom_schema.set_string("command", self.action)
            custom_schema.set_string("binding", self.entries[0])

            parent_settings = Gio.Settings("org.gnome.settings-daemon.plugins.media-keys")
            array = parent_settings.get_strv("custom-keybindings")

            existing = False
            for entry in array:
                if custom_path == entry:
                    existing = True
                    break
            if not existing:
                array.append(custom_path)
                parent_settings.set_strv("custom-keybindings", array)

# Utility to convert key modifier codes to something more friendly
def clean_kb(keybinding):
    if keybinding is "":
        return cgi.escape(_("unassigned"))
    keybinding = keybinding.replace("<Super>", _("Super-"))
    keybinding = keybinding.replace("<Primary>", _("Ctrl-"))
    keybinding = keybinding.replace("<Shift>", _("Shift-"))
    keybinding = keybinding.replace("<Alt>", _("Alt-"))
    keybinding = keybinding.replace("<Control>", _("Ctrl-"))
    return cgi.escape(keybinding)

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
        name_box.pack_start(Gtk.Label(_("Name:")), False, False, 2)
        command_box.pack_start(Gtk.Label(_("Command:")), False, False, 2)
        self.name_entry = Gtk.Entry()
        self.name_entry.connect('changed', self.onEntriesChanged)
        self.command_entry  = Gtk.Entry()
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
        path = self.file_picker.get_uri()[7:]
        self.command_entry.set_text(path)

    def onEntriesChanged(self, widget):
        ok_enabled = self.name_entry.get_text().strip() is not "" and self.command_entry.get_text().strip() is not ""
        self.set_response_sensitive(Gtk.ResponseType.OK, ok_enabled)

class NotebookPage:
    def __init__(self, name, expanding):
        self.name = name
        self.widgets = []
        self.expanding = expanding
        self.tab = Gtk.ScrolledWindow()
        self.content_box = Gtk.VBox()

    def add_widget(self, widget):
        self.widgets.append(widget)

    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        for widget in self.widgets:
            self.content_box.pack_start(widget, self.expanding, self.expanding, 2)
        self.tab.add_with_viewport(self.content_box)
        self.content_box.set_border_width(5)
        self.tab.set_min_content_height(320)
        self.content_box.show_all()

class KeyboardSidePage (SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box)
        self.tabs = []

    def build(self, advanced):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        self.notebook = Gtk.Notebook()

        tab = NotebookPage(_("Typing"), False)
        tab.add_widget(GSettingsCheckButton(_("Enable key repeat"), "org.gnome.settings-daemon.peripherals.keyboard", "repeat", None))
        box = IndentedHBox()
        slider = GSettingsRange(_("Repeat delay:"), _("Short"), _("Long"), 100, 2000, False, "uint", False, "org.gnome.settings-daemon.peripherals.keyboard", "delay",
                                                                        "org.gnome.settings-daemon.peripherals.keyboard/repeat", adjustment_step = 10)
        box.pack_start(slider, True, True, 0)
        tab.add_widget(box)
        box = IndentedHBox()
        slider = GSettingsRange(_("Repeat speed:"), _("Slow"), _("Fast"), 20, 2000, True, "uint", True, "org.gnome.settings-daemon.peripherals.keyboard", "repeat-interval",
                                                                        "org.gnome.settings-daemon.peripherals.keyboard/repeat", adjustment_step = 1)
        box.pack_start(slider, True, True, 0)
        tab.add_widget(box)
        tab.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        
        tab.add_widget(GSettingsCheckButton(_("Text cursor blinks"), "org.gnome.desktop.interface", "cursor-blink", None))
        box = IndentedHBox()
        slider = GSettingsRange(_("Blink speed:"), _("Slow"), _("Fast"), 100, 2500, True, "int", False, "org.gnome.desktop.interface", "cursor-blink-time",
                                                                        "org.gnome.desktop.interface/cursor-blink", adjustment_step = 10)
        box.pack_start(slider, True, True, 0)
        tab.add_widget(box)
        tab.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        tab.add_widget(Gtk.Label(_("Test Box")))
        tab.add_widget(Gtk.Entry())
        self.addNotebookTab(tab)

        tab = NotebookPage(_("Keyboard shortcuts"), True)

        headingbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        mainbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
        headingbox.pack_start(mainbox, True, True, 2)
        headingbox.pack_end(Gtk.Label(_("To edit a keyboard binding, click it and press the new keys, or press backspace to clear it.")), False, False, 1)

        left_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        right_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        
        category_scroller = Gtk.ScrolledWindow.new(None, None)
        category_scroller.set_shadow_type(Gtk.ShadowType.IN)
        
        kb_name_scroller = Gtk.ScrolledWindow.new(None, None)
        kb_name_scroller.set_shadow_type(Gtk.ShadowType.IN)
        
        entry_scroller = Gtk.ScrolledWindow.new(None, None)
        entry_scroller.set_shadow_type(Gtk.ShadowType.IN)
        
        right_vbox.pack_start(kb_name_scroller, False, False, 2)
        right_vbox.pack_start(entry_scroller, False, False, 2)
        kb_name_scroller.set_property('min-content-height', 150)
        entry_scroller.set_property('min-content-height', 100)
        self.cat_tree = Gtk.TreeView.new()        
        self.kb_tree = Gtk.TreeView.new()
        self.entry_tree = Gtk.TreeView.new()

        self.kb_tree.connect('row-activated', self.onCustomKeyBindingEdited)
        self.kb_tree.connect('button-press-event', self.onContextMenuPopup)
        self.kb_tree.connect('popup-menu', self.onContextMenuPopup)

        left_vbox.pack_start(category_scroller, True, True, 2)
                
        category_scroller.add(self.cat_tree)
        category_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER)
        kb_name_scroller.add(self.kb_tree)
        kb_name_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        entry_scroller.add(self.entry_tree)
        entry_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER)

        buttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL)
        self.add_custom_button = Gtk.Button(_("Add custom shortcut"))
        self.add_custom_button.connect('clicked', self.onAddCustomButtonClicked)
        self.remove_custom_button = Gtk.Button(_("Remove custom shortcut"))
        self.remove_custom_button.connect('clicked', self.onRemoveCustomButtonClicked)
        self.remove_custom_button.set_property('sensitive', False)
        buttonbox.pack_start(self.add_custom_button, False, False, 2)
        buttonbox.pack_start(self.remove_custom_button, False, False, 2)

        right_vbox.pack_end(buttonbox, False, False, 2)

        mainbox.pack_start(left_vbox, False, False, 2)
        mainbox.pack_start(right_vbox, True, True, 2)

        left_vbox.set_border_width(2)
        right_vbox.set_border_width(2)

        self.cat_store = Gtk.ListStore(str,     # The category name
                                       object)  # The category object

        self.kb_store = Gtk.ListStore( str,   # Keybinding name
                                       object)# The keybinding object

        self.entry_store = Gtk.ListStore( str, # Keybinding entry
                                          object) # Keybinding object

        cell = Gtk.CellRendererText()
        cell.set_alignment(.5,0)
        cat_column = Gtk.TreeViewColumn(_("Categories"), cell, text=0)
        cat_column.set_alignment(.5)
        cat_column.set_property('min-width', 200)

        self.cat_tree.append_column(cat_column)
        self.cat_tree.connect("cursor-changed", self.onCategoryChanged)

        kb_name_cell = Gtk.CellRendererText()
        kb_name_cell.set_alignment(.5,.5)
        kb_column = Gtk.TreeViewColumn(_("Keyboard shortcuts"), kb_name_cell, text=0)
        kb_column.set_alignment(.5)
        self.kb_tree.append_column(kb_column)
        self.kb_tree.connect("cursor-changed", self.onKeyBindingChanged)

        entry_cell = Gtk.CellRendererAccel()
        entry_cell.set_alignment(.5,.5)
        entry_cell.connect('accel-edited', self.onEntryChanged, self.entry_store)
        entry_cell.connect('accel-cleared', self.onEntryCleared, self.entry_store)
        entry_cell.set_property('editable', True)

        try:  # Only Ubuntu allows MODIFIER_TAP - using a single modifier as a keybinding
            entry_cell.set_property('accel-mode', Gtk.CellRendererAccelMode.MODIFIER_TAP)
        except Exception:  # Pure GTK does not, so use OTHER
            entry_cell.set_property('accel-mode', Gtk.CellRendererAccelMode.OTHER)

        entry_column = Gtk.TreeViewColumn(_("Keyboard bindings"), entry_cell, text=0)
        entry_column.set_alignment(.5)
        self.entry_tree.append_column(entry_column)

        self.main_store = []

        # categories                                Display name        internal category
        self.main_store.append(KeyBindingCategory("Cinnamon", "cinnamon"))
        self.main_store.append(KeyBindingCategory(_("Windows"), "windows"))
        self.main_store.append(KeyBindingCategory(_("Workspace Management"), "ws-manage"))
        self.main_store.append(KeyBindingCategory(_("System"), "system"))
        self.main_store.append(KeyBindingCategory(_("Launchers"), "launchers"))
        self.main_store.append(KeyBindingCategory(_("Sound and Media"), "media"))
        self.main_store.append(KeyBindingCategory(_("Universal Access"), "accessibility"))
        self.main_store.append(KeyBindingCategory(_("Custom Shortcuts"), "custom"))

        for binding in KEYBINDINGS:
            for category in self.main_store:
                if category.int_name == binding[4]:
                    category.add(KeyBinding(binding[0], binding[1], binding[2], binding[3], binding[4]))
      #              print bindings.index(binding)  # remove, only for catching segfaults when adding bindings

        for category in self.main_store:
            self.cat_store.append((category.label, category))

        self.loadCustoms()
        self.cat_tree.set_model(self.cat_store)
        self.kb_tree.set_model(self.kb_store)
        self.entry_tree.set_model(self.entry_store)

        tab.add_widget(headingbox)
        self.addNotebookTab(tab)

        self.content_box.add(self.notebook)
        for tab in self.tabs:
            tab.build()
        self.content_box.show_all()

    def addNotebookTab(self, tab):
        self.notebook.append_page(tab.tab, Gtk.Label(tab.name))
        self.tabs.append(tab)

    def onCategoryChanged(self, tree):
        self.kb_store.clear()
        if tree.get_selection() is not None:
            categories, iter = tree.get_selection().get_selected()
            if iter:
                category = categories[iter][1]
                if category.int_name is not "custom":
                    for keybinding in category.keybindings:
                        self.kb_store.append((keybinding.label, keybinding))
                else:
                    self.loadCustoms()
            self.remove_custom_button.set_property('sensitive', False)

    def loadCustoms(self):
        for category in self.main_store:
            if category.int_name is "custom":
                category.clear()
        gclient = GConf.Client.get_default()
        path = "/desktop/gnome/keybindings"
        subdirs = gclient.all_dirs(path)
        for subdir in subdirs:
            custom_kb = CustomKeyBinding(subdir,
                                         gclient.get_string(subdir+"/name"),
                                         gclient.get_string(subdir+"/action"),
                                         gclient.get_string(subdir+"/binding"))
            self.kb_store.append((custom_kb.label, custom_kb))
            for category in self.main_store:
                if category.int_name is "custom":
                    category.add(custom_kb)

    def onKeyBindingChanged(self, tree):
        self.entry_store.clear()
        if tree.get_selection() is not None:
            keybindings, iter = tree.get_selection().get_selected()
            if iter:
                keybinding = keybindings[iter][1]
                if isinstance(keybinding, KeyBinding):
                    for entry in keybinding.entries:
                        if entry is not "_invalid_":
                            self.entry_store.append((clean_kb(entry), entry))
                    self.remove_custom_button.set_property('sensitive', False)
                else:
                    self.entry_store.append((clean_kb(keybinding.entries[0]), keybinding))
                    self.remove_custom_button.set_property('sensitive', True)


    def onEntryChanged(self, cell, path, keyval, mask, keycode, entry_store):
        accel_string = Gtk.accelerator_name(keyval, mask)
        accel_string = accel_string.replace("<Mod2>", "")
        iter = entry_store.get_iter(path)
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings[kb_iter][1]
        # Check for bad keys or modifiers
        if (mask == 0 or mask == Gdk.ModifierType.SHIFT_MASK) and keycode != 0:
            if ((keyval >= Gdk.KEY_a and keyval <= Gdk.KEY_z)
            or (keyval >= Gdk.KEY_A and keyval <= Gdk.KEY_Z)
            or (keyval >= Gdk.KEY_0 and keyval <= Gdk.KEY_9)
            or (keyval >= Gdk.KEY_kana_fullstop and keyval <= Gdk.KEY_semivoicedsound)
            or (keyval >= Gdk.KEY_Arabic_comma and keyval <= Gdk.KEY_Arabic_sukun)
            or (keyval >= Gdk.KEY_Serbian_dje and keyval <= Gdk.KEY_Cyrillic_HARDSIGN)
            or (keyval >= Gdk.KEY_Greek_ALPHAaccent and keyval <= Gdk.KEY_Greek_omega)
            or (keyval >= Gdk.KEY_hebrew_doublelowline and keyval <= Gdk.KEY_hebrew_taf)
            or (keyval >= Gdk.KEY_Thai_kokai and keyval <= Gdk.KEY_Thai_lekkao)
            or (keyval >= Gdk.KEY_Hangul and keyval <= Gdk.KEY_Hangul_Special)
            or (keyval >= Gdk.KEY_Hangul_Kiyeog and keyval <= Gdk.KEY_Hangul_J_YeorinHieuh)
            or keyval in FORBIDDEN_KEYVALS):
                dialog = Gtk.MessageDialog(None,
                                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                    Gtk.MessageType.ERROR,
                                    Gtk.ButtonsType.OK,
                                    None)
                dialog.set_default_size(400, 200)
                msg = _("\nThis key combination, \'<b>%s</b>\' cannot be used because it would become impossible to type using this key.\n\n")
                msg += _("Please try again with a modifier key such as Control, Alt or Super (Windows key) at the same time.\n")
                dialog.set_markup(msg % clean_kb(accel_string))
                dialog.show_all()
                response = dialog.run()
                dialog.destroy()
                return

        # Check for duplicates
        for category in self.main_store:
            for keybinding in category.keybindings:
                for entry in keybinding.entries:
                    if accel_string == entry and keybinding.label != current_keybinding.label:
                        dialog = Gtk.MessageDialog(None,
                                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                    Gtk.MessageType.QUESTION,
                                    Gtk.ButtonsType.YES_NO,
                                    None)
                        dialog.set_default_size(400, 200)
                        msg = _("This key combination, \'<b>%s</b>\' is currently in use by \'<b>%s</b>\'.  ")
                        msg += _("If you continue, the combination will be reassigned to \'<b>%s</b>.\'\n\n")
                        msg += _("Do you want to continue with this operation?")
                        dialog.set_markup(msg % (clean_kb(accel_string), cgi.escape(keybinding.label), cgi.escape(current_keybinding.label)))
                        dialog.show_all()
                        response = dialog.run()
                        dialog.destroy()
                        if response == Gtk.ResponseType.YES:
                            keybinding.setBinding(keybinding.entries.index(accel_string), None)
                        elif response == Gtk.ResponseType.NO:
                            return
        current_keybinding.setBinding(int(path), accel_string)
        self.onKeyBindingChanged(self.kb_tree)
        self.entry_tree.get_selection().select_path(path)

    def onEntryCleared(self, cell, path, entry_store):
        iter = entry_store.get_iter(path)
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings[kb_iter][1]
        current_keybinding.setBinding(int(path), None)
        self.onKeyBindingChanged(self.kb_tree)
        self.entry_tree.get_selection().select_path(path)

    def onAddCustomButtonClicked(self, button):
        dialog = AddCustomDialog(False)

        dialog.show_all()
        response = dialog.run()
        if response == Gtk.ResponseType.CANCEL:
            dialog.destroy()
            return

        gclient = GConf.Client.get_default()
        path = "/desktop/gnome/keybindings/custom"
        i = 0
        while gclient.dir_exists(path + str(i)):
            i += 1
        new_path = path + str(i)
        gclient.set_string(new_path + "/name", dialog.name_entry.get_text())
        gclient.set_string(new_path + "/action", dialog.command_entry.get_text())
        gclient.set_string(new_path + "/binding", "")
        i = 0
        for cat in self.cat_store:
            if cat[1].int_name is "custom":
                self.cat_tree.set_cursor(str(i), self.cat_tree.get_column(0), False)
            i += 1
        i = 0
        for keybinding in self.kb_store:
            if keybinding[0] == dialog.name_entry.get_text():
                self.kb_tree.set_cursor(str(i), self.kb_tree.get_column(0), False)
            i += 1
        dialog.destroy()

    def onRemoveCustomButtonClicked(self, button):
        keybindings, iter = self.kb_tree.get_selection().get_selected()
        if iter:
            keybinding = keybindings[iter][1]
            gclient = GConf.Client.get_default()
            if gclient.dir_exists(keybinding.path):
                gclient.unset(keybinding.path + "/name")
                gclient.unset(keybinding.path + "/action")
                gclient.unset(keybinding.path + "/binding")
            if CUSTOM_KEYBINDINGS_GSETTINGS:
                temp = keybinding.path.split("/")
                custom_gconf_id = temp[len(temp)-1] # get the "custom0" or "custom1" id from gconf path
                custom_path = CUSTOM_KEYS_BASENAME+"/"+custom_gconf_id+"/"
                custom_schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)
                custom_schema.delay()
                custom_schema.reset("name")
                custom_schema.reset("command")
                custom_schema.reset("binding")
                custom_schema.apply()
                Gio.Settings.sync()

                parent_settings = Gio.Settings("org.gnome.settings-daemon.plugins.media-keys")
                array = parent_settings.get_strv("custom-keybindings")

                existing = False
                for entry in array:
                    if custom_path == entry:
                        existing = True
                        break
                if existing:
                    array.remove(custom_path)
                    parent_settings.set_strv("custom-keybindings", array)

        i = 0
        for cat in self.cat_store:
            if cat[1].int_name is "custom":
                self.cat_tree.set_cursor(str(i), self.cat_tree.get_column(0), False)
            i += 1

    def onCustomKeyBindingEdited(self, kb_treeview, column, kb_column):
        keybindings, iter = kb_treeview.get_selection().get_selected()
        if iter:
            keybinding = keybindings[iter][1]
            if isinstance(keybinding, KeyBinding):
                return
            else:
                dialog = AddCustomDialog(True)
                dialog.name_entry.set_text(keybinding.label)
                dialog.command_entry.set_text(keybinding.action)
                dialog.show_all()
                response = dialog.run()
                if response == Gtk.ResponseType.CANCEL:
                    dialog.destroy()
                    return

                keybinding.label = dialog.name_entry.get_text()
                keybinding.action = dialog.command_entry.get_text()
                keybinding.writeSettings();

                i = 0
                for cat in self.cat_store:
                    if cat[1].int_name is "custom":
                        self.cat_tree.set_cursor(str(i), self.cat_tree.get_column(0), False)
                    i += 1
                i = 0
                for keybinding in self.kb_store:
                    if keybinding[0] == dialog.name_entry.get_text():
                        self.kb_tree.set_cursor(str(i), self.kb_tree.get_column(0), False)
                    i += 1
                dialog.destroy()

    def onContextMenuPopup(self, tree, event = None):
        model, iter = tree.get_selection().get_selected()
        if iter:
            keybinding = model[iter][1]
            if isinstance(keybinding, CustomKeyBinding):
                return
            if event:
                if event.button != 3:
                    return
                button = event.button
                event_time = event.time
                info = tree.get_path_at_pos(int(event.x), int(event.y))
                if info is not None:
                    path, col, cellx, celly = info
                    tree.grab_focus()
                    tree.set_cursor(path, col, 0)
            else: 
                path = model.get_path(iter)
                button = 0
                event_time = 0
                tree.grab_focus()
            popup = Gtk.Menu()
            popup.attach_to_widget(tree, None)
            popup_reset_item = Gtk.MenuItem(_("Reset to default"))
            popup_reset_item.show()
            popup.append(popup_reset_item)
            popup_reset_item.connect('activate', self.onResetToDefault, keybinding)
            popup.popup(None, None, None, None, button, event_time)
            return True

    def onResetToDefault(self, popup, keybinding):
        keybinding.resetDefaults()
        self.onKeyBindingChanged(self.kb_tree)
