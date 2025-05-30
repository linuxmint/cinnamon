#!/usr/bin/python3

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('CDesktopEnums', '3.0')
from gi.repository import Gio, Gtk, CDesktopEnums

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *


class Module:
    name = "windows"
    category = "prefs"
    comment = _("Manage window preferences")

    def __init__(self, content_box):
        keywords = _("windows, titlebar, edge, switcher, window list, attention, focus, tile, tiling, snap, snapping")
        sidePage = SidePage(_("Windows"), "cs-windows", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Windows module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Titlebar

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "titlebar", _("Titlebar"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            settings = page.add_section(_("Buttons"))

            button_options = []
            if Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL:
                button_options.append([":minimize,maximize,close", _("Left")])
                button_options.append(["close,maximize,minimize:", _("Right")])
            else:
                button_options.append([":minimize,maximize,close", _("Right")])
                button_options.append(["close,maximize,minimize:", _("Left")])
            button_options.append([":close", _("Gnome")])
            button_options.append(["close:minimize,maximize", _("Classic Mac")])

            widget = CustomButtonLayoutSelector(_("Buttons layout"), "org.cinnamon.desktop.wm.preferences", "button-layout", button_options, size_group=size_group)
            settings.add_row(widget)

            settings = page.add_section(_("Actions"))

            action_options = [["toggle-shade", _("Toggle Shade")], ["toggle-maximize", _("Toggle Maximize")],
                              ["toggle-maximize-horizontally", _("Toggle Maximize Horizontally")], ["toggle-maximize-vertically", _("Toggle Maximize Vertically")],
                              ["toggle-stuck", _("Toggle on all workspaces")], ["toggle-above", _("Toggle always on top")],
                              ["minimize", _("Minimize")], ["menu", _("Menu")], ["lower", _("Lower")], ["none", _("None")]]

            widget = GSettingsComboBox(_("Action on title bar double-click"), "org.cinnamon.desktop.wm.preferences", "action-double-click-titlebar", action_options, size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsComboBox(_("Action on title bar middle-click"), "org.cinnamon.desktop.wm.preferences", "action-middle-click-titlebar", action_options, size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsComboBox(_("Action on title bar right-click"), "org.cinnamon.desktop.wm.preferences", "action-right-click-titlebar", action_options, size_group=size_group)
            settings.add_row(widget)

            scroll_options = [["none", _("Nothing")],["shade", _("Shade and unshade")],["opacity", _("Adjust opacity")]]

            widget = GSettingsComboBox(_("Action on title bar with mouse scroll"), "org.cinnamon.desktop.wm.preferences", "action-scroll-titlebar", scroll_options, size_group=size_group)
            settings.add_row(widget)

            spin = GSettingsSpinButton(_("Minimum opacity"), "org.cinnamon.desktop.wm.preferences", "min-window-opacity", _("%"))
            settings.add_reveal_row(spin)

            spin.revealer.settings = Gio.Settings("org.cinnamon.desktop.wm.preferences")
            spin.revealer.settings.bind_with_mapping("action-scroll-titlebar", spin.revealer, "reveal-child", Gio.SettingsBindFlags.GET, lambda x: x == "opacity", None)

            # Behavior

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "behavior", _("Behavior"))

            settings = page.add_section(_("Window Focus"))

            focus_options = [["click", _("Click")], ["sloppy", _("Sloppy")], ["mouse", _("Mouse")]]
            widget = GSettingsComboBox(_("Window focus mode"), "org.cinnamon.desktop.wm.preferences", "focus-mode", focus_options)
            widget.set_tooltip_text(_("The window focus mode indicates how windows are activated. It has three possible values; \"click\" means windows must be clicked in order to focus them, \"sloppy\" means windows are focused when the mouse enters the window, and \"mouse\" means windows are focused when the mouse enters the window and unfocused when the mouse leaves the window."))
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Automatically raise focused windows"), "org.cinnamon.desktop.wm.preferences", "auto-raise")
            settings.add_reveal_row(widget)

            widget.revealer.settings = Gio.Settings("org.cinnamon.desktop.wm.preferences")
            widget.revealer.settings.bind_with_mapping("focus-mode", widget.revealer, "reveal-child", Gio.SettingsBindFlags.GET, lambda x: x in ("sloppy", "mouse"), None)

            widget = GSettingsSwitch(_("Bring windows which require attention to the current workspace"), "org.cinnamon.muffin", "bring-windows-to-current-workspace")
            settings.add_row(widget)

            # It's weird to show a combo for two items. For now this is simpler to explain as a switch...
            widget = Switch(_("Give focus to new windows launched from a terminal"))
            widget.set_tooltip_text(_("Normally, all windows created by the user are given initial focus. "
                                      "This controls whether or not to include programs launched from a terminal."))
            settings.add_row(widget)

            gsettings = widget.get_settings("org.cinnamon.desktop.wm.preferences")
            real_switch = widget.content_widget
            self.updating = False

            def update_switch(settings, key):
                if self.updating:
                    return
                self.updating = True
                real_switch.set_active(gsettings.get_enum(key) == CDesktopEnums.FocusNewWindows.SMART)
                self.updating = False

            def update_setting(widget, pspec):
                if self.updating:
                    return
                self.updating = True
                gsettings.set_enum("focus-new-windows",
                                   CDesktopEnums.FocusNewWindows.SMART if real_switch.get_active() else CDesktopEnums.FocusNewWindows.STRICT)
                self.updating = False

            real_switch.connect("notify::active", update_setting)
            gsettings.connect("changed::focus-new-windows", update_switch)
            update_switch(gsettings, "focus-new-windows")
            #######

            widget = GSettingsSwitch(_("Attach dialog windows to the parent window"), "org.cinnamon.muffin", "attach-modal-dialogs")
            settings.add_row(widget)

            settings = page.add_section(_("Moving and Resizing Windows"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            placement_options = [["automatic", _("Automatic")], ["pointer", _("Cursor")], ["manual", _("Manual")], ["center", _("Center")]]
            widget = GSettingsComboBox(_("Location of newly opened windows"), "org.cinnamon.muffin", "placement-mode", placement_options, size_group=size_group)
            settings.add_row(widget)

            special_key_options = [["", _("Disabled")], ["<Alt>", "<Alt>"],["<Super>", "<Super>"],["<Control>", "<Control>"]]
            widget = GSettingsComboBox(_("Special key to move and resize windows"), "org.cinnamon.desktop.wm.preferences", "mouse-button-modifier", special_key_options, size_group=size_group)
            widget.set_tooltip_text(_("While the special key is pressed, windows can be dragged with the left mouse button and resized with the right mouse button."))
            settings.add_row(widget)

            widget = GSettingsRange(_("Draggable border width"), "org.cinnamon.muffin", "draggable-border-width", _("Narrower"), _("Wider"),
                                    2, 64, show_value=False)
            widget.content_widget.set_tooltip_text(_("This adjusts the width of that portion of the window border used for resizing."))
            widget.add_mark(10, Gtk.PositionType.TOP, None)
            settings.add_row(widget)

            # Alt Tab

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "alttab", _("Alt-Tab"))

            settings = page.add_section(_("Alt-Tab"))

            alttab_styles = [
                ["icons", _("Icons only")],
                ["thumbnails", _("Thumbnails only")],
                ["icons+thumbnails", _("Icons and thumbnails")],
                ["icons+preview", _("Icons and window preview")],
                ["preview", _("Window preview (no icons)")],
                ["coverflow", _("Coverflow (3D)")],
                ["timeline", _("Timeline (3D)")]
            ]
            widget = GSettingsComboBox(_("Alt-Tab switcher style"), "org.cinnamon", "alttab-switcher-style", alttab_styles)
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Display the alt-tab switcher on the primary monitor instead of the active one"), "org.cinnamon", "alttab-switcher-enforce-primary-monitor")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Move minimized windows to the end of the alt-tab switcher"), "org.cinnamon", "alttab-minimized-aware")
            settings.add_row(widget)

            widget = GSettingsSpinButton(_("Delay before displaying the alt-tab switcher"), "org.cinnamon", "alttab-switcher-delay", units=_("milliseconds"), mini=0, maxi=1000, step=50, page=150)
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Show windows from all workspaces"), "org.cinnamon", "alttab-switcher-show-all-workspaces")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Show windows from current monitor"), "org.cinnamon", "alttab-switcher-show-current-monitor")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Warp mouse pointer to the new focused window"), "org.cinnamon", "alttab-switcher-warp-mouse-pointer")
            settings.add_row(widget)

            # Tiling
            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "tiling", _("Tiling"))

            settings = page.add_section(_("Tiling Preferences"))
            switch = GSettingsSwitch(_("Enable window tiling"), "org.cinnamon.muffin", "edge-tiling")
            settings.add_row(switch)
            switch = GSettingsSwitch(_("Maximize, instead of tile, when dragging a window to the top edge"), "org.cinnamon.muffin", "tile-maximize")
            settings.add_reveal_row(switch, "org.cinnamon.muffin", "edge-tiling")

class CustomButtonLayoutSelector(Gtk.Box):
    def __init__(self, description, schema_name, key_name, predefined_options, size_group=None):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6)

        self.description = description 
        self.settings = Gio.Settings(schema_name)
        self.key_name = key_name
        self.predefined_options = predefined_options 
        self.custom_sentinel_value = "___CUSTOM_LAYOUT_SENTINEL___" 

        self.updating_ui_from_gsettings = False

        self.combo = Gtk.ComboBoxText()
        if size_group:
            size_group.add_widget(self.combo)

        for value, text in self.predefined_options:
            self.combo.append(value, text)
        self.combo.append(self.custom_sentinel_value, _("Custom"))

        self.pack_start(self.combo, True, True, 0)

        self.entry_revealer = Gtk.Revealer()
        self.entry_revealer.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.entry_revealer.set_transition_duration(200)

        self.custom_entry = Gtk.Entry()
        self.custom_entry.set_placeholder_text(_("e.g., menu:minimize,maximize,close"))
        self.custom_entry.set_tooltip_text(_("Define custom button layout. \n"
                                             "Format: left_side: 'buttons:', right_side: ':buttons'. \n"
                                             "Available buttons: close, minimize, maximize, menu. \n"
                                             "Examples: menu,maximize:close or :close,minimize \n"
                                             "Leave one side empty for buttons only on one side, e.g., :close or close: \n"
                                             "Press 'Enter' key to validate button layout." ))
        self.entry_revealer.add(self.custom_entry)
        self.pack_start(self.entry_revealer, True, True, 0)

        # Add a label for error messages
        self.error_label = Gtk.Label()
        self.error_label.set_no_show_all(True)
        self.error_label.get_style_context().add_class('error-label')
        self.pack_start(self.error_label, True, True, 0)

        self.combo.connect("changed", self._on_combo_changed)
        self.custom_entry.connect("activate", self._on_entry_submit)
        self.custom_entry.connect("focus-out-event", self._on_entry_submit_on_focus_out)
        self.custom_entry.connect("changed", self._on_entry_changed)

        self.settings_handler_id = self.settings.connect(f"changed::{self.key_name}", self._on_settings_changed)

        self._load_initial_state()

    def _load_initial_state(self):
        # Temporarily block to avoid issues during init.
        # Signal might be emitted if value is coerced by GSettings during get_string if not already cached.
        # if self.settings_handler_id is not None: # Check if handler ID exists
        #     self.settings.block_signal_handler(self.settings_handler_id)
        
        self._update_ui_from_settings_value(self.settings.get_string(self.key_name))
        
        # if self.settings_handler_id is not None: # Check if handler ID exists
        #     self.settings.unblock_signal_handler(self.settings_handler_id)

    def _update_ui_from_settings_value(self, current_value):
        self.updating_ui_from_gsettings = True

        found_predefined = False
        for val, _text in self.predefined_options:
            if val == current_value:
                self.combo.set_active_id(val)
                self.entry_revealer.set_reveal_child(False)
                found_predefined = True
                break
        
        if not found_predefined:
            self.combo.set_active_id(self.custom_sentinel_value)
            self.custom_entry.set_text(current_value if current_value is not None else "")
            self.entry_revealer.set_reveal_child(True)
            
        self.updating_ui_from_gsettings = False

    def _on_settings_changed(self, settings_obj, key):
        if self.updating_ui_from_gsettings:
            return 
        
        current_value = settings_obj.get_string(key)
        self._update_ui_from_settings_value(current_value)

    def _on_combo_changed(self, combo):
        if self.updating_ui_from_gsettings:
            return

        active_id = combo.get_active_id()
        if active_id is None:
            return

        if active_id == self.custom_sentinel_value:
            self.entry_revealer.set_reveal_child(True)
        else:
            self.entry_revealer.set_reveal_child(False)
            # if self.settings_handler_id is not None:
            #     self.settings.block_signal_handler(self.settings_handler_id)
            self.settings.set_string(self.key_name, active_id)
            # if self.settings_handler_id is not None:
            #     self.settings.unblock_signal_handler(self.settings_handler_id)

    def _validate_layout(self, layout_string):
        valid_buttons = ['close', 'minimize', 'maximize', 'menu']
        parts = layout_string.split(':')
        if len(parts) != 2:
            return False, _("Invalid format. Must contain exactly one ':'")
        
        for part in parts:
            if part:
                buttons = part.split(',')
                invalid_buttons = [btn for btn in buttons if btn not in valid_buttons]
                if invalid_buttons:
                    return False, _("Invalid buttons: ") + ", ".join(invalid_buttons)
        return True, ""

    def _show_error(self, error_message):
        self.custom_entry.get_style_context().add_class('error')
        self.error_label.set_text(error_message)
        self.error_label.show()

    def _clear_error(self):
        self.custom_entry.get_style_context().remove_class('error')
        self.error_label.set_text("")
        self.error_label.hide()

    def _on_entry_changed(self, entry):
        self._clear_error()

    def _submit_custom_entry_value(self):
        if self.updating_ui_from_gsettings:
            return False

        if self.combo.get_active_id() == self.custom_sentinel_value:
            new_layout_string = self.custom_entry.get_text()
            is_valid, error_message = self._validate_layout(new_layout_string)
            
            if not is_valid:
                self._show_error(error_message)
                return False
            
            self._clear_error()
            self.settings.set_string(self.key_name, new_layout_string)
        return False

    def _on_entry_submit(self, entry):
        self._submit_custom_entry_value()

    def _on_entry_submit_on_focus_out(self, entry, event):
        self._submit_custom_entry_value()
        return False

    def do_destroy(self):
        if hasattr(self, 'settings_handler_id') and self.settings_handler_id is not None:
            self.settings.disconnect(self.settings_handler_id)
        # Gtk.Box.do_destroy(self) # Call chain automatically for GObject subclasses
        super().do_destroy()
