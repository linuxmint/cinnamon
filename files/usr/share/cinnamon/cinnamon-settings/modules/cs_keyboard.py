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

from bin.KeybindingWidgets import ButtonKeybinding, CellRendererKeybinding
from bin.SettingsWidgets import SidePage, Keybinding
from bin import util
from bin import InputSources
from bin import XkbSettings
from bin import KeybindingTable
from xapp.GSettingsWidgets import *

gettext.install("cinnamon", "/usr/share/locale")

MASKS = [Gdk.ModifierType.CONTROL_MASK, Gdk.ModifierType.MOD1_MASK,
         Gdk.ModifierType.SHIFT_MASK, Gdk.ModifierType.SUPER_MASK]

class Module:
    comment = _("Manage keyboard settings and shortcuts")
    name = "keyboard"
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("keyboard, shortcut, hotkey")
        sidePage = SidePage(_("Keyboard"), "cs-keyboard", keywords, content_box, size=550, module=self)
        self.sidePage = sidePage
        self.current_category = None
        self.last_selected_category = None
        self.last_selected_binding = None
        self.loaded = False

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
            self.sidePage.stack.set_homogeneous(False)
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
            self.cat_store.set_sort_column_id(1, Gtk.SortType.ASCENDING)

            self.kb_root_store = Gtk.ListStore(str,     # Keybinding name
                                               object)  # The keybinding object

            self.kb_store = Gtk.TreeModelFilter(child_model=self.kb_root_store)
            self.kb_store.set_visible_func(self.kb_store_visible_func)

            self.entry_store = Gtk.ListStore(str)  # Accel string

            cell = Gtk.CellRendererText()
            cell.set_alignment(0, 0)
            pb_cell = Gtk.CellRendererPixbuf()
            pb_cell.set_property("xpad", 3)
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

            self.kb_table = KeybindingTable.get_default()
            self.kb_table_check_done = False

            cat_iters = {}
            longest_cat_label = " "

            for category in self.kb_table.main_store:
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
            self.kb_table.connect("binding-changed", self.on_kb_changed)
            self.kb_table.connect("spices-changed", lambda table: self.reload_spices())
            self.kb_table.connect("customs-changed", lambda table: self.reload_customs())

            vbox.pack_start(headingbox, True, True, 0)

            page = InputSources.InputSourceSettingsPage()
            self.sidePage.stack.add_titled(page, "layouts", _("Layouts"))

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "xkb-options", _("XKB Options"))

            page.pack_start(XkbSettings.XkbSettingsEditor(), True, True, 0)

            self.kb_search_entry.grab_focus()

    def on_kb_changed(self, kb_table):
        self.onKeyBindingChanged(self.kb_tree)

    def stack_page_changed(self, stack, pspec, data=None):
        if stack.get_visible_child_name() == "shortcuts":
            if not self.kb_table_check_done:
                GLib.idle_add(lambda: self.kb_table.check_for_collisions())
                self.kb_table_check_done = True

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

        if not category or not category.dbus_info.get("highlight", False):
            self.categoryHighlightUnmap()
            return

        # If the category hasn't changed, do nothing
        if self.last_selected_category and self.last_selected_category == category:
            self.categoryHighlightOnMap()
            return

        if hasattr(event, "type") and event.type != Gdk.EventType.FOCUS_CHANGE:
            self.categoryHighlightUnmap()

        self.last_selected_category = category

        # Turn highlighting on (if applicable) if the category switched
        self.categoryHighlightOnMap()

    def onCategoryChanged(self, tree, *args):
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

        for category in self.kb_table.main_store:
            for keybinding in category.keybindings:
                self.kb_root_store.append((keybinding.label, keybinding))

    def reload_customs(self):
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

        for category in self.kb_table.custom_store:
            for keybinding in category.keybindings:
                self.kb_root_store.append((keybinding.label, keybinding))

    def reload_spices(self):
        tree_iter = self.kb_root_store.get_iter_first()

        while tree_iter:
            keybinding = self.kb_root_store.get_value(tree_iter, 1)
            if keybinding.category not in (*self.kb_table.static_categories.keys(), "custom"):
                if not self.kb_root_store.remove(tree_iter):
                    break
                continue

            tree_iter = self.kb_root_store.iter_next(tree_iter)

        for category in self.kb_table.spice_store:
            for keybinding in category.keybindings:
                self.kb_root_store.append((keybinding.label, keybinding))

    def kb_name_cell_data_func(self, column, cell, model, tree_iter, data=None):
        binding = model.get_value(tree_iter, 1)

        if binding and self.kb_search_entry.get_text() or self.kb_search_binding.get_accel_string():
            category = escape(self.kb_table.binding_categories[binding.category])
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
                self.remove_custom_button.set_property('sensitive', isinstance(keybinding, KeybindingTable.CustomKeyBinding))

            if self.search_choice == "bindings" and self.kb_search_binding.accel_string:
                self.last_accel_string = self.kb_search_binding.accel_string

    def onEntryChanged(self, cell, path, accel_string, accel_label, entry_store):
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings.get_value(kb_iter, 1)

        self.kb_table.maybe_update_binding(current_keybinding, accel_string, accel_label, int(path))

        self.entry_tree.get_selection().select_path(path)

    def onEntryCleared(self, cell, path, entry_store):
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings.get_value(kb_iter, 1)
            self.kb_table.clear_binding(current_keybinding, int(path))

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

        self.kb_table.add_custom_keybinding(dialog.name_entry.get_text(),
                                            dialog.command_entry.get_text())

        self.reload_customs()
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
            self.kb_table.remove_custom_keybinding(keybinding)

        self.reload_customs()
        self.kb_store.refilter()

        for index, cat in enumerate(self.cat_store):
            if cat[2].int_name == "custom":
                self.cat_tree.set_cursor(str(index), self.cat_tree.get_column(0), False)

    def onCustomKeyBindingEdited(self, kb_treeview, column, kb_column):
        keybindings, tree_iter = kb_treeview.get_selection().get_selected()
        if tree_iter:
            keybinding = keybindings.get_value(tree_iter, 1)
            if isinstance(keybinding, KeybindingTable.KeyBinding):
                return
            dialog = AddCustomDialog(True)
            dialog.name_entry.set_text(keybinding.label)
            dialog.command_entry.set_text(keybinding.action)
            dialog.show_all()
            response = dialog.run()
            if response != Gtk.ResponseType.OK:
                dialog.destroy()
                return

            self.kb_table.update_custom_keybinding_details(keybinding, dialog.name_entry.get_text(), dialog.command_entry.get_text())

            self.reload_customs()
            self.kb_store.refilter()

            for index, cat in enumerate(self.cat_store):
                if cat[2].int_name == "custom":
                    self.cat_tree.set_cursor(str(index), self.cat_tree.get_column(0), False)
            for index, keybinding in enumerate(self.kb_store):
                if keybinding[0] == dialog.name_entry.get_text():
                    self.kb_tree.set_cursor(str(index), self.kb_tree.get_column(0), False)

            dialog.destroy()

    def onContextMenuPopup(self, tree, event=None):
        for mask in MASKS:
            if hasattr(event, 'state') and event.state & mask == mask:
                return
        model, tree_iter = tree.get_selection().get_selected()
        binding = model.get_value(tree_iter, 1) if tree_iter else None
        if self.last_selected_binding and self.last_selected_binding != binding:
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
                for category in self.kb_table.main_store:
                    if category.int_name == binding.category:
                        cat_iter = self.recurseCatTree(self.cat_store.get_iter_first(), binding.category)
                        _path = self.cat_store.get_path(cat_iter)
                        self.cat_tree.expand_to_path(_path)
                        self.cat_tree.set_cursor(_path)
                        break


        if not self.current_category:
            for cat in self.kb_table.main_store:
                if cat.int_name == binding.category:
                    self.current_category = cat
                    break

        if binding == self.last_selected_binding:
            if event and event.type != Gdk.EventType.BUTTON_RELEASE or event.button != 3:
                return Gdk.EVENT_PROPAGATE

        self.last_selected_binding = binding
        self.bindingHighlightOnMap()

        if tree_iter:
            if search_input_text or self.kb_search_binding.accel_string:
                self.onSearchBindingCleared(None)
                return
            if isinstance(binding, KeybindingTable.CustomKeyBinding):
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
        self.kb_table.reset_bindings(keybinding)

    def categoryHighlightOnMap(self, *args):
        # Turn highlighting on (if applicable)
        try:
            if self.last_selected_category.dbus_info["highlight"]:
                uuid = self.last_selected_category.dbus_info["uuid"]
                _id = self.last_selected_category.dbus_info["instance_id"]
                self.kb_table.highlight_spice(uuid, _id, True)
        except (KeyError, AttributeError):
            pass

    def categoryHighlightUnmap(self, *args):
        # Turn highlighting off (if applicable)
        try:
            if self.last_selected_category.dbus_info["highlight"]:
                uuid = self.last_selected_category.dbus_info["uuid"]
                _id = self.last_selected_category.dbus_info["instance_id"]
                self.kb_table.highlight_spice(uuid, _id, False)
        except (KeyError, AttributeError):
            pass

    def categoryHighlightOff(self, *args):
        # Unset highlighting (if applicable) e.g. when closing the window
        self.categoryHighlightUnmap()

        self.last_selected_category = None

    def bindingHighlightOnMap(self, *args):
        # Turn highlighting on (if applicable)

        try:
            if self.last_selected_binding.dbus_info["highlight"]:
                uuid = self.last_selected_binding.dbus_info["uuid"]
                _id = self.last_selected_binding.dbus_info["instance_id"]
                self.kb_table.highlight_spice(uuid, _id, True)
        except (KeyError, AttributeError):
            pass

    def bindingHighlightOnUnmap(self, *args):
        # Turn highlighting off (if applicable)

        try:
            if self.last_selected_binding.dbus_info["highlight"]:
                uuid = self.last_selected_binding.dbus_info["uuid"]
                _id = self.last_selected_binding.dbus_info["instance_id"]
                self.kb_table.highlight_spice(uuid, _id, False)
        except (KeyError, AttributeError):
            pass

    def bindingHighlightOff(self, *args):
        # Unset highlighting (if applicable) e.g. when closing the window
        self.bindingHighlightOnUnmap()

        self.last_selected_binding = None

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
