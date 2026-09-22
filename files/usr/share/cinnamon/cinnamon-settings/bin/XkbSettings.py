#!/usr/bin/python3

from gi.repository import Gio, Gtk, CinnamonDesktop, Pango, GLib

from xapp.SettingsWidgets import SettingsSection

class XkbSettingsEditor(SettingsSection):
    # Groups that are hidden from UI (broken or not supported in Cinnamon)
    FORBIDDEN_GROUPS = ['custom']

    # Allowed options per group. If a group is in this dict, only the listed options are shown.
    # If a group is not in this dict, all options from XkbInfo are shown.
    ALLOWED_OPTIONS = {
        'grp': [
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

    LEFT_PANE_WIDTH = 250
    LEFT_PANE_MIN_WIDTH = 150

    def __init__(self, **kwargs):
        super().__init__()
        self.settings = Gio.Settings(schema_id="org.cinnamon.desktop.input-sources")
        self.xkb_info = CinnamonDesktop.XkbInfo.new_with_extras()

        self._building = False
        self._internal_write = False
        self._current_group = None
        self._rows_by_group_id = {}

        self.groups = self._build_groups()

        self._build_ui()
        self._populate_group_list()

        self.settings.connect("changed::xkb-options", self._on_external_change)

        first = self.groups_listbox.get_row_at_index(0)
        if first is not None:
            self.groups_listbox.select_row(first)

    def _is_group_allowed(self, group_id):
        return group_id not in self.FORBIDDEN_GROUPS

    def _build_groups(self):
        """Build an ordered list of group descriptors:
        { id, description, multi, all_ids, displayed:[(option_id, description)] }
        'id' is the XkbInfo group id and is used for every XkbInfo lookup.
        'all_ids' is the full set of the group's option ids (including ones not
        offered in the UI) and is used to map a stored option back to its group.
        Mapping is by exact option-id membership, not by prefix: a prefix can
        span two groups (e.g. 'keypad:legacy' is in the keypad group while
        'keypad:pointerkeys' is in compat), but the option ids never overlap.
        """
        groups = []
        for group_id in self.xkb_info.get_all_option_groups():
            if not self._is_group_allowed(group_id):
                continue

            description = self.xkb_info.description_for_group(group_id)
            if not description:
                continue

            all_options = self.xkb_info.get_options_for_group(group_id) or []
            if not all_options:
                continue

            # Options actually offered in the UI (curated where a whitelist exists).
            if group_id in self.ALLOWED_OPTIONS:
                allowed = set(self.ALLOWED_OPTIONS[group_id])
                displayed_ids = [o for o in all_options
                                 if ':' in o and o.split(':', 1)[1] in allowed]
            else:
                displayed_ids = list(all_options)

            multi = self.xkb_info.get_option_group_allows_multiple_selection(group_id)
            # Muffin only supports a single layout-switch toggle.
            if group_id == "grp":
                multi = False

            groups.append({
                "id": group_id,
                "description": description,
                "multi": multi,
                "all_ids": set(all_options),
                "displayed": sorted(
                    [(o, self.xkb_info.description_for_option(group_id, o) or o)
                     for o in displayed_ids],
                    key=lambda item: item[1].lower()),
            })

        groups.sort(key=lambda g: g["description"].lower())
        return groups

    def _stored_options(self):
        return self.settings.get_strv("xkb-options")

    def _stored_for_group(self, group):
        return [o for o in self._stored_options() if o in group["all_ids"]]

    def _option_description(self, group, option_id):
        return self.xkb_info.description_for_option(group["id"], option_id) or option_id

    def _sort_group_rows(self, row1, row2):
        # Groups with an active option sort ahead of unset ones, alphabetical by
        # description within each tier.
        active1 = bool(self._stored_for_group(row1.group))
        active2 = bool(self._stored_for_group(row2.group))
        if active1 != active2:
            return -1 if active1 else 1

        d1 = row1.group["description"].lower()
        d2 = row2.group["description"].lower()
        return (d1 > d2) - (d1 < d2)

    def _update_header(self, row, before):
        # A separator marks the boundary between the active groups and the
        # unset ones.
        if before is not None and \
           self._stored_for_group(before.group) and not self._stored_for_group(row.group):
            separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
            separator.set_margin_top(4)
            separator.set_margin_bottom(4)
            row.set_header(separator)
        else:
            row.set_header(None)

    def _resort(self):
        self.groups_listbox.invalidate_sort()
        self.groups_listbox.invalidate_headers()

    # ------------------------------------------------------------------- view

    def _build_ui(self):
        paned = Gtk.Paned(orientation=Gtk.Orientation.HORIZONTAL, wide_handle=True)
        paned.set_position(self.LEFT_PANE_WIDTH)

        self.groups_listbox = Gtk.ListBox()
        self.groups_listbox.set_selection_mode(Gtk.SelectionMode.BROWSE)
        self.groups_listbox.set_sort_func(self._sort_group_rows)
        self.groups_listbox.set_header_func(self._update_header)
        self.groups_listbox.connect("row-selected", self._on_group_selected)

        left_scrolled = Gtk.ScrolledWindow()
        left_scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        left_scrolled.set_shadow_type(Gtk.ShadowType.IN)
        left_scrolled.set_size_request(self.LEFT_PANE_MIN_WIDTH, -1)
        left_scrolled.add(self.groups_listbox)

        self.detail_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        self.detail_box.props.margin = 4

        right_scrolled = Gtk.ScrolledWindow()
        right_scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        right_scrolled.set_shadow_type(Gtk.ShadowType.IN)
        right_scrolled.set_min_content_height(300)
        right_scrolled.set_min_content_width(200)
        right_scrolled.add(self.detail_box)

        paned.pack1(left_scrolled, False, False)
        paned.pack2(right_scrolled, True, True)

        self.pack_start(paned, True, True, 0)

    def _populate_group_list(self):
        bold = Pango.AttrList()
        bold.insert(Pango.attr_weight_new(Pango.Weight.BOLD))

        for group in self.groups:
            title = Gtk.Label(label=group["description"], xalign=0)
            title.set_attributes(bold)
            title.set_ellipsize(Pango.EllipsizeMode.END)

            subtitle = Gtk.Label(xalign=0)
            subtitle.get_style_context().add_class("dim-label")
            subtitle.set_ellipsize(Pango.EllipsizeMode.END)
            subtitle.set_no_show_all(True)

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_left=2)
            vbox.pack_start(title, False, False, 0)
            vbox.pack_start(subtitle, False, False, 0)

            row = Gtk.ListBoxRow()
            row.group = group
            row.subtitle = subtitle
            row.add(vbox)

            self.groups_listbox.add(row)
            self._rows_by_group_id[group["id"]] = row
            self._update_subtitle(group)

        self.groups_listbox.show_all()

    def _build_detail(self, group):
        self._building = True

        for child in self.detail_box.get_children():
            self.detail_box.remove(child)

        active = self._stored_for_group(group)

        if group["multi"]:
            self._build_multi(group, active)
        else:
            self._build_single(group, active)

        self.detail_box.show_all()
        self._building = False

    def _build_multi(self, group, active):
        shown = set()
        for option_id, description in group["displayed"]:
            check = Gtk.CheckButton(label=description)
            check.set_active(option_id in active)
            check.connect("toggled", self._on_check_toggled, group, option_id)
            self.detail_box.pack_start(check, False, False, 0)
            shown.add(option_id)

        # Preserve any active option we don't normally display.
        for option_id in active:
            if option_id in shown:
                continue
            check = Gtk.CheckButton(label=self._option_description(group, option_id))
            check.set_active(True)
            check.connect("toggled", self._on_check_toggled, group, option_id)
            self.detail_box.pack_start(check, False, False, 0)

    def _build_single(self, group, active):
        active_id = active[0] if active else None

        none_radio = Gtk.RadioButton(label=_("None"))
        none_radio.set_active(active_id is None)
        none_radio.connect("toggled", self._on_radio_toggled, group, None)
        self.detail_box.pack_start(none_radio, False, False, 0)

        shown = set()
        for option_id, description in group["displayed"]:
            radio = Gtk.RadioButton.new_with_label_from_widget(none_radio, description)
            radio.set_active(option_id == active_id)
            radio.connect("toggled", self._on_radio_toggled, group, option_id)
            self.detail_box.pack_start(radio, False, False, 0)
            shown.add(option_id)

        # Preserve an active option we don't normally display.
        if active_id is not None and active_id not in shown:
            radio = Gtk.RadioButton.new_with_label_from_widget(
                none_radio, self._option_description(group, active_id))
            radio.set_active(True)
            radio.connect("toggled", self._on_radio_toggled, group, active_id)
            self.detail_box.pack_start(radio, False, False, 0)

    # --------------------------------------------------------------- handlers

    def _on_group_selected(self, listbox, row):
        if row is None:
            return
        self._current_group = row.group
        self._build_detail(row.group)

    def _on_radio_toggled(self, button, group, option_id):
        if self._building or not button.get_active():
            return
        self._write_group(group, [] if option_id is None else [option_id])

    def _on_check_toggled(self, button, group, option_id):
        if self._building:
            return
        active = set(self._stored_for_group(group))
        if button.get_active():
            active.add(option_id)
        else:
            active.discard(option_id)
        self._write_group(group, list(active))

    def _on_external_change(self, settings, key):
        if self._internal_write:
            return
        for group in self.groups:
            self._update_subtitle(group)
        self._resort()
        if self._current_group is not None:
            self._build_detail(self._current_group)

    # ------------------------------------------------------------ write/state

    def _write_group(self, group, new_group_options):
        current = self._stored_options()

        # Keep everything that doesn't belong to this group untouched .
        others = [o for o in current if o not in group["all_ids"]]
        new_list = others + new_group_options

        self._internal_write = True
        self.settings.set_strv("xkb-options", new_list)
        GLib.idle_add(self._clear_internal_write)

        self._update_subtitle(group)
        self._resort()

    def _clear_internal_write(self):
        self._internal_write = False
        return GLib.SOURCE_REMOVE

    def _update_subtitle(self, group):
        row = self._rows_by_group_id.get(group["id"])
        if row is None:
            return

        active = self._stored_for_group(group)
        if active:
            descriptions = [self._option_description(group, o) for o in active]
            # Multi-select groups can have several active options; list each on
            # its own line. Single-choice groups only ever have one.
            separator = "\n" if group["multi"] else ", "
            row.subtitle.set_text(separator.join(descriptions))
            row.subtitle.show()
        else:
            row.subtitle.hide()
