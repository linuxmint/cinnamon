#!/usr/bin/python3

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *


class Module:
    name = "windows"
    category = "prefs"
    comment = _("Manage window preferences")

    def __init__(self, content_box):
        keywords = _("windows, titlebar, edge, switcher, window list, attention, focus")
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

            widget = GSettingsComboBox(_("Buttons layout"), "org.cinnamon.desktop.wm.preferences", "button-layout", button_options, size_group=size_group)
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

            widget = GSettingsSwitch(_("Bring windows which require attention to the current workspace"), "org.cinnamon", "bring-windows-to-current-workspace")
            settings.add_row(widget)

            stealing_options = [["smart", _("Smart")], ["strict", _("Strict")]]
            widget = GSettingsComboBox(_("Focus mode for new windows"), "org.cinnamon.desktop.wm.preferences", "focus-new-windows", stealing_options)
            widget.set_tooltip_text(_("This option provides additional control over how newly created windows get focus. It has two possible values; 'smart' applies the user's normal focus mode, and 'strict' results in windows started from a terminal not being given focus."))
            settings.add_row(widget)

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

            widget = GSettingsSpinButton(_("Window drag/resize threshold"), "org.cinnamon.muffin", "resize-threshold", _("Pixels"), 1, 100, size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Edge resistance with other windows and monitor boundaries"), "org.cinnamon.muffin", "edge-resistance-window")
            widget.set_tooltip_text(_("Make window borders stick when moved or resized near other windows or monitor edges."))
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
