#!/usr/bin/env python2

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk
from KeybindingWidgets import CellRendererKeybinding
import cgi
import gettext

gettext.install("cinnamon", "/usr/share/locale")

# Keybindings page - check if we need to store custom
# keybindings to gsettings key as well as GConf (In Mint 14 this is changed)
CUSTOM_KEYS_PARENT_SCHEMA = "org.cinnamon.desktop.keybindings"
CUSTOM_KEYS_BASENAME = "/org/cinnamon/desktop/keybindings/custom-keybindings"
CUSTOM_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.custom-keybinding"

MUFFIN_KEYBINDINGS_SCHEMA = "org.cinnamon.desktop.keybindings.wm"
MEDIA_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.media-keys"
CINNAMON_SCHEMA = "org.cinnamon.desktop.keybindings"

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
    [_("Workspaces"),       "workspaces",       None,       "display"],
        [_("Direct Navigation"),    "ws-navi",          "workspaces",   None],
    [_("System"),           "system",           None,       "preferences-system"],
        [_("Hardware"),             "sys-hw",           "system",       None],
        [_("Screenshots and Recording"),"sys-screen",   "system",       None],
    [_("Launchers"),        "launchers",        None,       "applications-utilities"],
    [_("Sound and Media"),  "media",            None,       "applications-multimedia"],
        [_("Quiet Keys"),           "media-quiet",      "media",        None],
    [_("Universal Access"), "accessibility",    None,       "access"],
    [_("Custom Shortcuts"), "custom",           None,       "gnome-panel-launcher"]
]

KEYBINDINGS = [
    #   KB Label                        Schema                  Key name               Array?  Category
    # General
    [_("Toggle Scale"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-down", "general"],
    [_("Toggle Expo"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-to-workspace-up", "general"],
    [_("Cycle through open windows"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-windows", "general"],
    [_("Cycle backwards through open windows"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-windows-backward", "general"],
    [_("Cycle through open windows of the same application"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-group", "general"],
    [_("Cycle backwards through open windows of the same application"), MUFFIN_KEYBINDINGS_SCHEMA, "switch-group-backward", "general"],
    [_("Run dialog"), MUFFIN_KEYBINDINGS_SCHEMA, "panel-run-dialog", "general"],
    # General - Troubleshooting
    [_("Toggle Looking Glass"), CINNAMON_SCHEMA, "looking-glass-keybinding", "trouble"],
    # Windows
    [_("Maximize window"), MUFFIN_KEYBINDINGS_SCHEMA, "maximize", "windows"],
    [_("Unmaximize window"), MUFFIN_KEYBINDINGS_SCHEMA, "unmaximize", "windows"],
    [_("Minimize window"), MUFFIN_KEYBINDINGS_SCHEMA, "minimize", "windows"],
    [_("Close window"), MUFFIN_KEYBINDINGS_SCHEMA, "close", "windows"],
    [_("Show desktop"), MUFFIN_KEYBINDINGS_SCHEMA, "show-desktop", "windows"],
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
    [_("Push snap left"), MUFFIN_KEYBINDINGS_SCHEMA, "push-snap-left", "win-tiling"],
    [_("Push snap right"), MUFFIN_KEYBINDINGS_SCHEMA, "push-snap-right", "win-tiling"],
    [_("Push snap up"), MUFFIN_KEYBINDINGS_SCHEMA, "push-snap-up", "win-tiling"],
    [_("Push snap down"), MUFFIN_KEYBINDINGS_SCHEMA, "push-snap-down", "win-tiling"],
    # Windows - Workspace-related
    [_("Move window to new workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-new", "win-workspaces"],
    [_("Move window to left workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-left", "win-workspaces"],
    [_("Move window to right workspace"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-workspace-right", "win-workspaces"],
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
    #Windows - Monitor-related
    [_("Move window to left monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-left", "win-monitors"],
    [_("Move window to right monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-right", "win-monitors"],
    [_("Move window to up monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-up", "win-monitors"],
    [_("Move window to down monitor"), MUFFIN_KEYBINDINGS_SCHEMA, "move-to-monitor-down", "win-monitors"],
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
    [_("Re-detect display devices"), MEDIA_KEYS_SCHEMA, "video-outputs", "sys-hw"],
    [_("Rotate display"), MEDIA_KEYS_SCHEMA, "video-rotation", "sys-hw"],
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
    [_("Volume down (Quiet)"), MEDIA_KEYS_SCHEMA, "volume-down", "media-quiet"],
    [_("Volume up (Quiet)"), MEDIA_KEYS_SCHEMA, "volume-up", "media-quiet"],
    # Universal Access
    [_("Zoom in"), CINNAMON_SCHEMA, "magnifier-zoom-in", "accessibility"],
    [_("Zoom out"), CINNAMON_SCHEMA, "magnifier-zoom-out", "accessibility"],
    [_("Turn screen reader on or off"), MEDIA_KEYS_SCHEMA, "screenreader", "accessibility"],
    [_("Turn on-screen keyboard on or off"), MEDIA_KEYS_SCHEMA, "on-screen-keyboard", "accessibility"],
    [_("Increase text size"), MEDIA_KEYS_SCHEMA, "increase-text-size", "accessibility"],
    [_("Decrease text size"), MEDIA_KEYS_SCHEMA, "decrease-text-size", "accessibility"],
    [_("High contrast on or off"), MEDIA_KEYS_SCHEMA, "toggle-contrast", "accessibility"]
]

class Module:
    comment = _("Manage keyboard settings and shortcuts")
    name = "keyboard"
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("keyboard, shortcut, hotkey")
        sidePage = SidePage(_("Keyboard"), "cs-keyboard", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Keyboard module"

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Typing

            page = SettingsPage()

            settings = page.add_section(_("Key repeat"))

            self.sidePage.stack.add_titled(page, "typing", _("Typing"))

            switch = GSettingsSwitch(_("Enable key repeat"), "org.cinnamon.settings-daemon.peripherals.keyboard", "repeat")
            settings.add_row(switch)

            slider = GSettingsRange(_("Repeat delay:"), "org.cinnamon.settings-daemon.peripherals.keyboard", "delay", _("Short"), _("Long"), 100, 2000)
            settings.add_reveal_row(slider, "org.cinnamon.settings-daemon.peripherals.keyboard", "repeat")

            slider = GSettingsRange(_("Repeat speed:"), "org.cinnamon.settings-daemon.peripherals.keyboard", "repeat-interval", _("Slow"), _("Fast"), 20, 2000, invert=True, log=True)
            settings.add_reveal_row(slider, "org.cinnamon.settings-daemon.peripherals.keyboard", "repeat")

            settings = page.add_section(_("Text cursor"))

            switch = GSettingsSwitch(_("Text cursor blinks"), "org.cinnamon.desktop.interface", "cursor-blink")
            settings.add_row(switch)

            slider = GSettingsRange(_("Blink speed:"), "org.cinnamon.desktop.interface", "cursor-blink-time", _("Slow"), _("Fast"), 100, 2500, invert=True)
            settings.add_reveal_row(slider, "org.cinnamon.desktop.interface", "cursor-blink")

            # vbox.add(Gtk.Label.new(_("Test Box")))
            # vbox.add(Gtk.Entry())

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            vbox.set_border_width(6)
            vbox.set_spacing(6)
            self.sidePage.stack.add_titled(vbox, "shortcuts", _("Shortcuts"))

            headingbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            mainbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
            headingbox.pack_start(mainbox, True, True, 2)
            headingbox.pack_end(Gtk.Label.new(_("To edit a keyboard binding, click it and press the new keys, or press backspace to clear it.")), False, False, 1)

            paned = Gtk.Paned(orientation = Gtk.Orientation.HORIZONTAL)

            left_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            right_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)

            paned.add1(left_vbox)

            right_scroller = Gtk.ScrolledWindow.new(None, None)
            right_scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.NEVER)
            right_scroller.add(right_vbox)
            paned.add2(right_scroller)

            category_scroller = Gtk.ScrolledWindow.new(None, None)
            category_scroller.set_shadow_type(Gtk.ShadowType.IN)

            kb_name_scroller = Gtk.ScrolledWindow.new(None, None)
            kb_name_scroller.set_shadow_type(Gtk.ShadowType.IN)

            entry_scroller = Gtk.ScrolledWindow.new(None, None)
            entry_scroller.set_shadow_type(Gtk.ShadowType.IN)

            right_vbox.pack_start(kb_name_scroller, True, True, 2)
            right_vbox.pack_start(entry_scroller, True, True, 2)
            kb_name_scroller.set_property('min-content-height', 150)
            self.cat_tree = Gtk.TreeView.new()
            self.kb_tree = Gtk.TreeView.new()
            self.entry_tree = Gtk.TreeView.new()

            self.kb_tree.connect('row-activated', self.onCustomKeyBindingEdited)
            self.kb_tree.connect('button-press-event', self.onContextMenuPopup)
            self.kb_tree.connect('popup-menu', self.onContextMenuPopup)

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

            left_vbox.set_border_width(2)
            right_vbox.set_border_width(2)

            self.cat_store = Gtk.TreeStore(str,     # Icon name or None
                                           str,     # The category name
                                           object)  # The category object

            self.kb_store = Gtk.ListStore( str,   # Keybinding name
                                           object)# The keybinding object

            self.entry_store = Gtk.ListStore(str) # Accel string

            cell = Gtk.CellRendererText()
            cell.set_alignment(0,0)
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

            kb_name_cell = Gtk.CellRendererText()
            kb_name_cell.set_alignment(.5,.5)
            kb_column = Gtk.TreeViewColumn(_("Keyboard shortcuts"), kb_name_cell, text=0)
            kb_column.set_alignment(.5)
            self.kb_tree.append_column(kb_column)
            self.kb_tree.connect("cursor-changed", self.onKeyBindingChanged)

            entry_cell = CellRendererKeybinding(self.entry_tree)
            entry_cell.set_alignment(.5,.5)
            entry_cell.connect('accel-edited', self.onEntryChanged, self.entry_store)
            entry_cell.connect('accel-cleared', self.onEntryCleared, self.entry_store)
            entry_cell.set_property('editable', True)

            entry_column = Gtk.TreeViewColumn(_("Keyboard bindings"), entry_cell, accel_string=0)
            entry_column.set_alignment(.5)
            self.entry_tree.append_column(entry_column)

            self.entry_tree.set_tooltip_text("%s\n%s\n%s" % (_("Click to set a new accelerator key."), _("Press Escape or click again to cancel the operation."), _("Press Backspace to clear the existing keybinding.")))

            self.main_store = []

            for cat in CATEGORIES:
                self.main_store.append(KeyBindingCategory(cat[0], cat[1], cat[2], cat[3]))

            for binding in KEYBINDINGS:
                for category in self.main_store:
                    if category.int_name == binding[3]:
                        category.add(KeyBinding(binding[0], binding[1], binding[2], binding[3]))

            cat_iters = {}
            longest_cat_label = " "

            for category in self.main_store:
                if category.parent == None:
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
            w, h = layout.get_pixel_size()

            paned.set_position(max(w, 200))

            self.loadCustoms()
            self.cat_tree.set_model(self.cat_store)
            self.kb_tree.set_model(self.kb_store)
            self.entry_tree.set_model(self.entry_store)

            vbox.pack_start(headingbox, True, True, 0)

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            vbox.set_border_width(6)
            vbox.set_spacing(6)
            self.sidePage.stack.add_titled(vbox, "layouts", _("Layouts"))
            try:
                widget = self.sidePage.content_box.c_manager.get_c_widget("region")
            except:
                widget = None

            if widget is not None:
                cheat_box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
                cheat_box.pack_start(widget, True, True, 2)
                cheat_box.set_vexpand(False)
                widget.show()
                vbox.pack_start(cheat_box, True, True, 0)

    def addNotebookTab(self, tab):
        self.notebook.append_page(tab.tab, Gtk.Label.new(tab.name))
        self.tabs.append(tab)

    def onCategoryChanged(self, tree):
        self.kb_store.clear()
        if tree.get_selection() is not None:
            categories, iter = tree.get_selection().get_selected()
            if iter:
                category = categories[iter][2]
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

        parent = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA)
        custom_list = parent.get_strv("custom-list")

        for entry in custom_list:
            custom_path = CUSTOM_KEYS_BASENAME+"/"+entry+"/"
            schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)
            custom_kb = CustomKeyBinding(entry,
                                         schema.get_string("name"),
                                         schema.get_string("command"),
                                         schema.get_strv("binding"))
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
                for entry in keybinding.entries:
                    if entry is not "_invalid_":
                        self.entry_store.append((entry,))
                self.remove_custom_button.set_property('sensitive', isinstance(keybinding, CustomKeyBinding))

    def onEntryChanged(self, cell, path, accel_string, accel_label, entry_store):
        iter = entry_store.get_iter(path)
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings[kb_iter][1]

        # Check for duplicates
        for category in self.main_store:
            for keybinding in category.keybindings:
                for entry in keybinding.entries:
                    found = False
                    if accel_string.lower() == entry.lower():
                        found = True
                    elif accel_string.replace("<Primary>", "<Control>").lower() == entry.lower():
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
                        dialog.set_markup(msg % {'combination':accel_label, 'old':cgi.escape(keybinding.label), 'new':cgi.escape(current_keybinding.label)})
                        dialog.show_all()
                        response = dialog.run()
                        dialog.destroy()
                        if response == Gtk.ResponseType.YES:
                            keybinding.setBinding(keybinding.entries.index(entry), None)
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
        if response == Gtk.ResponseType.CANCEL or response == Gtk.ResponseType.DELETE_EVENT:
            dialog.destroy()
            return

        parent = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA)
        array = parent.get_strv("custom-list")
        num_array = []
        for entry in array:
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
        parent.set_strv("custom-list", array)

        new_path = CUSTOM_KEYS_BASENAME + "/custom" + str(i) + "/"
        new_schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, new_path)
        new_schema.set_string("name", dialog.name_entry.get_text())
        new_schema.set_string("command", dialog.command_entry.get_text().replace("%20", "\ "))
        new_schema.set_strv("binding", ())
        i = 0
        for cat in self.cat_store:
            if cat[2].int_name is "custom":
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
                parent_settings.set_strv("custom-list", array)

        i = 0
        for cat in self.cat_store:
            if cat[2].int_name is "custom":
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
                if response == Gtk.ResponseType.CANCEL or response == Gtk.ResponseType.DELETE_EVENT:
                    dialog.destroy()
                    return

                keybinding.label = dialog.name_entry.get_text()
                keybinding.action = dialog.command_entry.get_text().replace("%20", "\ ")
                keybinding.writeSettings();

                i = 0
                for cat in self.cat_store:
                    if cat[2].int_name is "custom":
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


class KeyBindingCategory():
    def __init__(self, label, int_name, parent, icon):
        self.label = label
        self.parent = parent
        self.icon = icon
        self.int_name = int_name
        self.keybindings = []

    def add(self, keybinding):
        self.keybindings.append(keybinding)

    def clear(self):
        del self.keybindings[:]

class KeyBinding():
    def __init__(self, label, schema, key, category):
        self.key = key
        self.label = label
        self.entries = [ ]
        self.settings = Gio.Settings.new(schema)
        self.loadSettings()

    def loadSettings(self):
        del self.entries[:]
        self.entries = self.get_array(self.settings.get_strv(self.key))

    def get_array(self, raw_array):
        result = []

        for entry in raw_array:
            result.append(entry)
        while (len(result) < 3):
            result.append("")

        return result

    def setBinding(self, index, val):
        if val is not None:
            self.entries[index] = val
        else:
            self.entries[index] = ""
        self.writeSettings()

    def writeSettings(self):
        array = []
        for entry in self.entries:
            if entry is not "":
                array.append(entry)
        self.settings.set_strv(self.key, array)

    def resetDefaults(self):
        self.settings.reset(self.key)
        self.loadSettings()

class CustomKeyBinding():
    def __init__(self, path, label, action, binding):
        self.path = path
        self.label = label
        self.action = action
        self.entries = self.get_array(binding)

    def get_array(self, raw_array):
        result = []

        for entry in raw_array:
            result.append(entry)
        while (len(result) < 3):
            result.append("")
        return result

    def setBinding(self, index, val):
        if val is not None:
            self.entries[index] = val
        else:
            self.entries[index] = ""
        self.writeSettings()

    def writeSettings(self):
        custom_path = CUSTOM_KEYS_BASENAME+"/"+self.path+"/"
        settings = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path)

        settings.set_string("name", self.label)
        settings.set_string("command", self.action)

        array = []
        for entry in self.entries:
            if entry is not "":
                array.append(entry)
        settings.set_strv("binding", array)

        # Touch the custom-list key, this will trigger a rebuild in cinnamon
        parent = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA)
        custom_list = parent.get_strv("custom-list")
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
