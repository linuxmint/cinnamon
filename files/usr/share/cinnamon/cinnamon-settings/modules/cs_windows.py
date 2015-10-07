#!/usr/bin/env python2

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk


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
            print "Loading Windows module"

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Titlebar

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "titlebar", _("Titlebar"))

            widget = TitleBarButtonsOrderSelector()
            page.add(widget)

            settings = page.add_section(_("Actions"))

            action_options = [["toggle-shade", _("Toggle Shade")], ["toggle-maximize", _("Toggle Maximize")],
                             ["toggle-maximize-horizontally", _("Toggle Maximize Horizontally")], ["toggle-maximize-vertically", _("Toggle Maximize Vertically")],
                             ["toggle-stuck", _("Toggle on all workspaces")], ["toggle-above", _("Toggle always on top")],
                             ["minimize", _("Minimize")], ["menu", _("Menu")], ["lower", _("Lower")], ["none", _("None")]]

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

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
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Automatically raise focused windows"), "org.cinnamon.desktop.wm.preferences", "auto-raise")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Bring windows which require attention to the current workspace"), "org.cinnamon", "bring-windows-to-current-workspace")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Prevent focus stealing"), "org.cinnamon", "prevent-focus-stealing")
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

            widget = GSettingsSpinButton(_("Delay before displaying the alt-tab switcher"), "org.cinnamon", "alttab-switcher-delay", units=_("milliseconds"), mini=0, maxi=1000, step=50, page=150)
            settings.add_row(widget)

class TitleBarButtonsOrderSelector(SettingsBox):
    def __init__(self):
        self.schema = "org.cinnamon.muffin"
        self.key = "button-layout"

        super(TitleBarButtonsOrderSelector, self).__init__(_("Buttons"))

        self.settings = Gio.Settings.new(self.schema)
        self.value = self.settings.get_string(self.key)

        left_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        left_box.set_border_width(5)
        left_box.set_margin_left(20)
        left_box.set_margin_right(20)

        right_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        right_box.set_border_width(5)
        right_box.set_margin_left(20)
        right_box.set_margin_right(20)

        try:
            left_items, right_items = self.value.split(":")
        except:
            left_items = right_items = ""
        if len(left_items) > 0:
            left_items = left_items.split(",")
        else:
            left_items = []
        if len(right_items) > 0:
            right_items = right_items.split(",")
        else:
            right_items = []

        left_label = Gtk.Label.new(_("Left side title bar buttons"))
        left_box.pack_start(left_label, False, False, 0)
        left_grid = Gtk.Grid()
        left_grid.set_column_spacing(4)
        left_box.pack_end(left_grid, False, False, 0)

        right_label = Gtk.Label.new(_("Right side title bar buttons"))
        right_box.pack_start(right_label, False, False, 0)
        right_grid = Gtk.Grid()
        right_grid.set_column_spacing(4)
        right_box.pack_end(right_grid, False, False, 0)

        self.left_side_widgets = []
        self.right_side_widgets = []
        for i in range(4):
            self.left_side_widgets.append(Gtk.ComboBox())
            self.right_side_widgets.append(Gtk.ComboBox())

        buttons = [
            ("", ""),
            ("menu", _("Menu")),
            ("close", _("Close")),
            ("minimize", _("Minimize")),
            ("maximize", _("Maximize")),
            ("stick", _("Sticky")),
            ("shade", _("Shade"))
        ]

        for i in self.left_side_widgets + self.right_side_widgets:
            if i in self.left_side_widgets:
                ref_list = left_items
                index = self.left_side_widgets.index(i)
            else:
                ref_list = right_items
                index = self.right_side_widgets.index(i)
            model = Gtk.ListStore(str, str)
            selected_iter = None
            for button in buttons:
                iter = model.insert_before(None, None)
                model.set_value(iter, 0, button[0])
                model.set_value(iter, 1, button[1])
                if index < len(ref_list) and ref_list[index] == button[0]:
                    selected_iter = iter
            i.set_model(model)
            renderer_text = Gtk.CellRendererText()
            i.pack_start(renderer_text, True)
            i.add_attribute(renderer_text, "text", 1)
            if selected_iter is not None:
                i.set_active_iter(selected_iter)
            i.connect("changed", self.on_my_value_changed)

        for i in self.left_side_widgets:
            index = self.left_side_widgets.index(i)
            left_grid.attach(i, index, 0, 1, 1)
        for i in self.right_side_widgets:
            index = self.right_side_widgets.index(i)
            right_grid.attach(i, index, 0, 1, 1)

        self.add_row(left_box)
        self.add_row(right_box)

    def on_my_value_changed(self, widget):
        active_iter = widget.get_active_iter()
        if active_iter:
            new_value = widget.get_model()[active_iter][0]
        else:
            new_value = None
        left_items = []
        right_items = []
        for i in self.left_side_widgets + self.right_side_widgets:
            active_iter = i.get_active_iter()
            if active_iter:
                value = i.get_model()[i.get_active_iter()][0]
                if i != widget and value == new_value:
                    i.set_active_iter(None)
                elif value != "":
                    if i in self.left_side_widgets:
                        left_items.append(value)
                    else:
                        right_items.append(value)
        self.settings.set_string(self.key, ','.join(str(item) for item in left_items) + ':' + ','.join(str(item) for item in right_items))
