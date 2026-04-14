#!/usr/bin/python3

from gi.repository import Gio, Gtk, CinnamonDesktop, Pango, GLib

from xapp.SettingsWidgets import SettingsSection
from bin import util
import subprocess

class XkbSettingsEditor(SettingsSection):
    # Groups that are hidden from UI (broken or not supported in Cinnamon)
    FORBIDDEN_GROUPS = ['custom']

    # Allowed options per group. If a group is in this dict, only the listed options are shown.
    # If a group is not in this dict, all options from XkbInfo are shown.
    ALLOWED_OPTIONS = {
        'grp': {
            'wayland_allowed': False,
            'options':
                [
                    "toggle",
                    "lalt_toggle",
                    "lwin_toggle",
                    "rwin_toggle",
                    "lshift_toggle",
                    "rshift_toggle",
                    "lctrl_toggle",
                    "rctrl_toggle",
                    "sclk_toggle",
                    "menu_toggle",
                    "caps_toggle",
                    "shift_caps_toggle",
                    "shifts_toggle",
                    "alt_caps_toggle",
                    "alt_space_toggle",
                    "win_space_toggle",
                    "ctrl_space_toggle",
                    "ctrl_shift_toggle",
                    "lctrl_lshift_toggle",
                    "rctrl_rshift_toggle",
                    "ctrl_alt_toggle",
                    "alt_shift_toggle",
                    "lalt_lshift_toggle",
                ]
        }
    }

    def __init__(self, **kwargs):
        super().__init__()
        self.input_source_settings = Gio.Settings(schema_id="org.cinnamon.desktop.input-sources")

        self.option_groups = {}
        self.selected_group_id = None
        self.is_wayland = util.get_session_type() == "wayland"

        self.load_options_for_validation()

        self.main_stack = Gtk.Stack()
        self.main_stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)
        self.main_stack.set_transition_duration(200)

        self._create_view_mode()
        self._create_add_mode()

        self.main_stack.add_named(self.view_box, "view")
        self.main_stack.add_named(self.add_box, "add")
        self.main_stack.set_visible_child_name("view")
        self.pack_start(self.main_stack, True, True, 0)

        self.reload()

    def _is_group_allowed(self, group_id):
        if group_id in self.FORBIDDEN_GROUPS:
            return False

        # Check if group is allowed in current session type
        if group_id in self.ALLOWED_OPTIONS:
            group_config = self.ALLOWED_OPTIONS[group_id]
            wayland_allowed = group_config.get('wayland_allowed', True)
            if self.is_wayland and not wayland_allowed:
                return False

        return True

    def _get_canonical_group_name(self, group_id):
        """Convert option prefix to canonical group name for xkbinfo queries.
        E.g., 'compose' -> 'Compose key'
        """
        return self.prefix_to_group.get(group_id, group_id)

    def _sort_groups_func(self, row1, row2):
        """Sort groups by description."""
        desc1 = row1.group_description
        desc2 = row2.group_description
        if desc1 < desc2:
            return -1
        elif desc1 > desc2:
            return 1
        return 0

    def _sort_options_func(self, row1, row2):
        """Sort options by description."""
        desc1 = row1.option_description
        desc2 = row2.option_description
        if desc1 < desc2:
            return -1
        elif desc1 > desc2:
            return 1
        return 0

    def load_options_for_validation(self):
        self.xkb_info = CinnamonDesktop.XkbInfo.new_with_extras()
        groups = self.xkb_info.get_all_option_groups()

        # Build mapping from option prefix to canonical group name
        self.prefix_to_group = {}

        for group in groups:
            self.option_groups[group] = []
            for opt in self.xkb_info.get_options_for_group(group):
                self.option_groups[group].append(opt)
                # Extract prefix from option (e.g., "compose:ralt" -> "compose")
                if ':' in opt:
                    prefix = opt.split(':')[0]
                    self.prefix_to_group[prefix] = group

        # alias for backward compatibility
        self.option_groups["compose"] = self.option_groups["Compose key"]

    def _create_view_mode(self):
        self.view_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)

        # TreeStore: [group_id, option_id, display_text]
        self.tree_store = Gtk.TreeStore(str, str, str)

        # Wrap with sorted model
        self.sorted_model = Gtk.TreeModelSort(model=self.tree_store)
        self.sorted_model.set_sort_column_id(2, Gtk.SortType.ASCENDING)

        self.tree_view = Gtk.TreeView(model=self.sorted_model)
        self.tree_view.set_headers_visible(False)

        text_renderer = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("Option", text_renderer, text=2)
        self.tree_view.append_column(column)

        self.selection = self.tree_view.get_selection()
        self.selection.connect("changed", self._on_selection_changed)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_shadow_type(Gtk.ShadowType.IN)
        scrolled.add(self.tree_view)

        self._create_view_toolbar()

        # Build view mode layout
        list_container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        list_container.get_style_context().add_class("linked")
        list_container.pack_start(scrolled, True, True, 0)
        list_container.pack_start(self.view_toolbar, False, False, 0)

        self.view_box.pack_start(list_container, True, True, 0)

    def _create_view_toolbar(self):
        self.view_toolbar = Gtk.Toolbar()
        self.view_toolbar.get_style_context().add_class("inline-toolbar")

        tool_item = Gtk.ToolItem()
        tool_item.set_expand(True)

        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        button_box.get_style_context().add_class("linked")

        self.btn_add = Gtk.Button()
        self.btn_add.set_image(Gtk.Image.new_from_icon_name("xsi-list-add-symbolic", Gtk.IconSize.BUTTON))
        self.btn_add.set_tooltip_text(_("Add"))
        self.btn_add.connect("clicked", self._on_add_clicked)

        self.btn_remove = Gtk.Button()
        self.btn_remove.set_image(Gtk.Image.new_from_icon_name("xsi-list-remove-symbolic", Gtk.IconSize.BUTTON))
        self.btn_remove.set_tooltip_text(_("Remove"))
        self.btn_remove.set_sensitive(False)
        self.btn_remove.connect("clicked", self._on_remove_clicked)

        button_box.pack_start(self.btn_add, False, False, 0)
        button_box.pack_start(self.btn_remove, False, False, 0)

        tool_item.add(button_box)
        self.view_toolbar.insert(tool_item, -1)

    def _create_add_mode(self):
        self.add_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)

        self.group_desc_label = Gtk.Label()
        self.group_desc_label.set_text(_("Select an option"))
        self.group_desc_label.set_halign(Gtk.Align.START)

        attr_list = Pango.AttrList()
        attr_list.insert(Pango.attr_weight_new(Pango.Weight.BOLD))
        self.group_desc_label.set_attributes(attr_list)
        self.add_box.pack_start(self.group_desc_label, False, False, 0)

        self.add_stack = Gtk.Stack()
        self.add_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.add_stack.set_transition_duration(200)

        self._create_groups_page()
        self._create_options_page()

        self.add_stack.add_named(self.groups_scrolled, "groups")
        self.add_stack.add_named(self.options_box, "options")
        self.add_stack.set_visible_child_name("groups")

        self.add_box.pack_start(self.add_stack, True, True, 0)

        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        button_box.set_halign(Gtk.Align.FILL)
        self.btn_back = Gtk.Button(label=_("Back"))
        self.btn_back.connect("clicked", self._on_back_clicked)
        self.btn_back.set_no_show_all(True)
        button_box.pack_start(self.btn_back, False, False, 0)

        btn_cancel = Gtk.Button(label=_("Cancel"))
        btn_cancel.connect("clicked", self._on_cancel_clicked)
        button_box.pack_end(btn_cancel, False, False, 0)

        self.add_box.pack_start(button_box, False, False, 0)

    def _create_groups_page(self):
        self.groups_scrolled = Gtk.ScrolledWindow()
        self.groups_scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.groups_scrolled.set_shadow_type(Gtk.ShadowType.IN)

        self.groups_listbox = Gtk.ListBox()
        self.groups_listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        self.groups_listbox.set_sort_func(self._sort_groups_func)
        self.groups_listbox.connect("row-activated", self._on_group_activated)
        self.groups_scrolled.add(self.groups_listbox)

        groups = self.xkb_info.get_all_option_groups()
        for group_id in groups:
            if not self._is_group_allowed(group_id):
                continue

            description = self.xkb_info.description_for_group(group_id)
            if not description:
                continue

            label = Gtk.Label(label=description, xalign=0)
            label.set_margin_start(2)

            row = Gtk.ListBoxRow()
            row.group_id = group_id
            row.group_description = description
            row.add(label)
            self.groups_listbox.add(row)

        self.groups_listbox.show_all()

    def _create_options_page(self):
        self.options_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)

        self.options_scrolled = Gtk.ScrolledWindow()
        self.options_scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.options_scrolled.set_shadow_type(Gtk.ShadowType.IN)

        self.options_listbox = Gtk.ListBox()
        self.options_listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        self.options_listbox.set_sort_func(self._sort_options_func)
        self.options_listbox.connect("row-activated", self._on_option_activated)
        self.options_scrolled.add(self.options_listbox)

        self.options_box.pack_start(self.options_scrolled, True, True, 0)

    def reload(self):
        self.tree_store.clear()

        options = self.input_source_settings.get_strv("xkb-options")

        grouped_options = {}
        for option in options:
            if ':' not in option:
                continue

            group_id = option.split(':')[0]
            if not self._is_group_allowed(group_id):
                continue

            if group_id not in grouped_options:
                grouped_options[group_id] = []
            grouped_options[group_id].append(option)

        # Populate tree (sorting handled by TreeModelSort)
        for group_id in grouped_options.keys():
            canonical_group = self._get_canonical_group_name(group_id)
            group_desc = self.xkb_info.description_for_group(canonical_group)
            if not group_desc:
                group_desc = group_id

            group_iter = self.tree_store.append(None, [group_id, None, group_desc])

            for option in grouped_options[group_id]:
                option_desc = self.xkb_info.description_for_option(canonical_group, option)
                if not option_desc:
                    option_desc = option
                self.tree_store.append(group_iter, [group_id, option, option_desc])

        self.tree_view.expand_all()

    def _sync_to_gsettings(self):
        current_options = self.input_source_settings.get_strv("xkb-options")
        current_grp_options = [opt for opt in current_options if opt.startswith('grp:')]

        visible_options = []
        iter = self.tree_store.get_iter_first()
        while iter:
            # Check if this is a group node (option_id is None)
            option_id = self.tree_store.get_value(iter, 1)
            if option_id is None:
                # It's a group node, get children
                child_iter = self.tree_store.iter_children(iter)
                while child_iter:
                    child_option = self.tree_store.get_value(child_iter, 1)
                    if child_option:
                        visible_options.append(child_option)
                    child_iter = self.tree_store.iter_next(child_iter)
            iter = self.tree_store.iter_next(iter)

        # Check if grp options changed
        new_grp_options = [opt for opt in visible_options if opt.startswith('grp:')]
        grp_changed = set(current_grp_options) != set(new_grp_options)

        self.input_source_settings.set_strv("xkb-options", visible_options)

        # Restart Cinnamon if grp options changed (required at the moment for muffin
        # to properly register it).
        if grp_changed and not self.is_wayland:
            GLib.timeout_add(400, self._restart_cinnamon)

    def _restart_cinnamon(self):
        try:
            subprocess.Popen(['cinnamon-dbus-command', 'RestartCinnamon', '1'],
                             stdout=subprocess.DEVNULL)
        except Exception as e:
            print(f"Failed to restart Cinnamon: {e}")
        return GLib.SOURCE_REMOVE

    def _on_selection_changed(self, selection):
        model, iter = selection.get_selected()
        self.btn_remove.set_sensitive(iter is not None)

    def _update_groups_sensitivity(self):
        # Build a set of groups that already have options
        groups_with_options = set()
        iter = self.tree_store.get_iter_first()
        while iter:
            group_id = self.tree_store.get_value(iter, 0)
            if group_id:
                groups_with_options.add(group_id)
            iter = self.tree_store.iter_next(iter)

        for row in self.groups_listbox.get_children():
            group_id = row.group_id
            if group_id in groups_with_options:
                # Group has options, check if it allows multiple
                allows_multiple = self.xkb_info.get_option_group_allows_multiple_selection(group_id)
                # Muffin doesn't support multiple grp options at the moment.
                if group_id == "grp":
                    allows_multiple = False
                row.set_sensitive(allows_multiple)
            else:
                row.set_sensitive(True)

    def _on_add_clicked(self, button):
        self._update_groups_sensitivity()

        self.add_stack.set_visible_child_name("groups")
        self.btn_back.hide()
        self.group_desc_label.set_text(_("Select an option"))
        self.main_stack.set_visible_child_name("add")

    def _on_remove_clicked(self, button):
        model, iter = self.selection.get_selected()
        if not iter:
            return

        option_id = model.get_value(iter, 1)

        # Convert sorted model iter to tree store iter
        store_iter = self.sorted_model.convert_iter_to_child_iter(iter)

        if option_id is None:
            # It's a group node - remove it and all children
            self.tree_store.remove(store_iter)
        else:
            # It's an option node - remove it and check if parent should be removed
            parent_iter = model.iter_parent(iter)

            if parent_iter:
                store_parent_iter = self.sorted_model.convert_iter_to_child_iter(parent_iter)
            else:
                store_parent_iter = None

            self.tree_store.remove(store_iter)

            if store_parent_iter and not self.tree_store.iter_has_child(store_parent_iter):
                self.tree_store.remove(store_parent_iter)

        self._sync_to_gsettings()

    def _on_cancel_clicked(self, button):
        self.main_stack.set_visible_child_name("view")

    def _on_group_activated(self, listbox, row):
        self.selected_group_id = row.group_id

        canonical_group = self._get_canonical_group_name(self.selected_group_id)
        group_desc = self.xkb_info.description_for_group(canonical_group)
        if group_desc:
            self.group_desc_label.set_text(group_desc)
        else:
            self.group_desc_label.set_text(self.selected_group_id)

        for child in self.options_listbox.get_children():
            self.options_listbox.remove(child)

        options = self.xkb_info.get_options_for_group(canonical_group)

        if self.selected_group_id in self.ALLOWED_OPTIONS:
            group_config = self.ALLOWED_OPTIONS[self.selected_group_id]
            allowed_list = group_config['options']
            # Build full option IDs with group prefix for comparison
            allowed_full = [f"{self.selected_group_id}:{opt}" for opt in allowed_list]
            options = [opt for opt in options if opt in allowed_full]

        # Build set of already-used options
        current_options = self.input_source_settings.get_strv("xkb-options")
        used_options = set(current_options)

        for option_id in options:
            option_desc = self.xkb_info.description_for_option(canonical_group, option_id)
            if not option_desc:
                option_desc = option_id

            label = Gtk.Label(label=option_desc, xalign=0)
            label.set_margin_start(2)

            row = Gtk.ListBoxRow()
            row.option_id = option_id
            row.option_description = option_desc
            row.add(label)

            # Make row insensitive if option is already used
            if option_id in used_options:
                row.set_sensitive(False)

            self.options_listbox.add(row)

        self.options_listbox.show_all()

        self.btn_back.show()
        self.add_stack.set_visible_child_name("options")

    def _on_back_clicked(self, button):
        self._update_groups_sensitivity()
        self.btn_back.hide()
        self.group_desc_label.set_text(_("Select an option"))
        self.add_stack.set_visible_child_name("groups")

    def _on_option_activated(self, listbox, row):
        option_id = row.option_id
        group_id = self.selected_group_id

        canonical_group = self._get_canonical_group_name(group_id)

        option_desc = self.xkb_info.description_for_option(canonical_group, option_id)
        if not option_desc:
            option_desc = option_id

        # Check if group already exists
        group_iter = None
        iter = self.tree_store.get_iter_first()
        while iter:
            if self.tree_store.get_value(iter, 0) == group_id:
                group_iter = iter
                break
            iter = self.tree_store.iter_next(iter)

        if group_iter:
            self.tree_store.append(group_iter, [group_id, option_id, option_desc])
            store_path = self.tree_store.get_path(group_iter)
        else:
            group_desc = self.xkb_info.description_for_group(canonical_group)
            if not group_desc:
                group_desc = group_id
            group_iter = self.tree_store.append(None, [group_id, None, group_desc])
            self.tree_store.append(group_iter, [group_id, option_id, option_desc])
            store_path = self.tree_store.get_path(group_iter)

        sorted_path = self.sorted_model.convert_child_path_to_path(store_path)
        if sorted_path:
            self.tree_view.expand_row(sorted_path, False)

        self._sync_to_gsettings()
        self.main_stack.set_visible_child_name("view")