#!/usr/bin/python3

import gi
from gi.repository import Gio, Gtk, Gdk, CinnamonDesktop, Pango
from xapp.SettingsWidgets import SettingsSection, ComboBox, SettingsWidget, SettingsLabel
import xapp.widgets

class XkbOptionButton(SettingsWidget):
    def __init__(self, option_group, settings, xkbinfo, size_group):
        super().__init__()
        self.option_group = option_group
        self.settings = settings
        self.xkbinfo = xkbinfo
        self.options_for_group = self.xkbinfo.get_options_for_group(self.option_group)

        self.label = SettingsLabel(self.xkbinfo.description_for_group(self.option_group))
        self.content_widget = Gtk.Button()
        self.button_label = Gtk.Label(width_chars=30, max_width_chars=30, ellipsize=Pango.EllipsizeMode.END, justify=Gtk.Justification.CENTER)
        self.content_widget.set_image(self.button_label)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.content_widget.set_valign(Gtk.Align.CENTER)
        if size_group:
            size_group.add_widget(self.content_widget)

        self.button_label.set_label(self.generate_label_from_options())

        self.dialog = None
        self.radio_buttons = []
        self.updating_states = False

        self.content_widget.connect("clicked", self.on_button_clicked)
        self.settings_handler_id = self.settings.connect("changed::xkb-options", self.on_settings_changed)

    def create_dialog(self):
        if self.dialog is not None:
            return

        self.dialog = Gtk.Dialog()
        self.dialog.set_title(self.xkbinfo.description_for_group(self.option_group))
        self.dialog.set_transient_for(self.get_toplevel())
        self.dialog.set_modal(True)
        self.dialog.set_default_size(400, 500)

        self.dialog.add_button(_("Close"), Gtk.ResponseType.CLOSE)

        content_area = self.dialog.get_content_area()

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_shadow_type(Gtk.ShadowType.IN)
        scrolled.set_margin_start(6)
        scrolled.set_margin_end(6)
        scrolled.set_margin_top(6)
        scrolled.set_margin_bottom(0)

        radio_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        radio_box.set_margin_start(6)
        radio_box.set_margin_end(6)
        radio_box.set_margin_top(6)
        radio_box.set_margin_bottom(6)

        current_options = self.settings.get_strv("xkb-options")

        active_option = None
        for opt in current_options:
            if opt in self.options_for_group:
                active_option = opt
                break

        none_radio = Gtk.RadioButton.new_with_label_from_widget(None, _("None"))
        none_radio.option_id = None
        none_radio.set_active(active_option is None)
        none_radio.connect("toggled", self.on_radio_toggled)
        radio_box.pack_start(none_radio, False, False, 0)
        self.radio_buttons.append(none_radio)

        options_with_desc = []
        for option_id in self.options_for_group:
            opt_desc = self.xkbinfo.description_for_option(self.option_group, option_id)
            options_with_desc.append((option_id, opt_desc))

        options_with_desc.sort(key=lambda x: x[1])

        for option_id, opt_desc in options_with_desc:
            radio = Gtk.RadioButton.new_with_label_from_widget(none_radio, opt_desc)
            radio.option_id = option_id
            radio.set_active(option_id == active_option)
            radio.connect("toggled", self.on_radio_toggled)
            radio_box.pack_start(radio, False, False, 0)
            self.radio_buttons.append(radio)

        scrolled.add(radio_box)
        content_area.pack_start(scrolled, True, True, 0)

        self.dialog.connect("response", self.on_dialog_response)
        self.dialog.show_all()

    def update_radio_states(self):
        if not self.radio_buttons or self.updating_states:
            return

        self.updating_states = True

        current_options = self.settings.get_strv("xkb-options")

        active_option = None
        for opt in current_options:
            if opt in self.options_for_group:
                active_option = opt
                break

        for radio in self.radio_buttons:
            if active_option is None:
                radio.set_active(radio.option_id is None)
            else:
                radio.set_active(radio.option_id == active_option)

        self.updating_states = False

    def on_button_clicked(self, button):
        if self.dialog is None:
            self.create_dialog()
        else:
            self.update_radio_states()
        self.dialog.present()

    def on_dialog_response(self, dialog, response_id):
        self.dialog.hide()

    def on_radio_toggled(self, radio):
        if self.updating_states:
            return
        if not radio.get_active():
            return

        current_options = self.settings.get_strv("xkb-options")
        option_id = radio.option_id

        current_options = [opt for opt in current_options if opt not in self.options_for_group]

        if option_id is not None:
            current_options.append(option_id)

        self.settings.set_strv("xkb-options", current_options)
        self.button_label.set_label(self.generate_label_from_options())

    def on_settings_changed(self, settings, key):
        self.update_radio_states()
        self.button_label.set_label(self.generate_label_from_options())

    def generate_label_from_options(self):
        current_options = self.settings.get_strv("xkb-options")

        for opt in current_options:
            if opt in self.options_for_group:
                return self.xkbinfo.description_for_option(self.option_group, opt)

        return _("None")

class XkbSettingsEditor(SettingsSection):
    def __init__(self, **kwargs):
        super().__init__(title=_("Xkb options"))
        self.input_source_settings = Gio.Settings(schema_id="org.cinnamon.desktop.input-sources")

        self.option_groups = {}

        self.editor = xapp.widgets.ListEditor()

        self.pack_start(self.editor, True, True, 0)

        self.editor.set_allow_duplicates(False)
        self.editor.set_allow_add(True, _("Add a valid Xkb option:"), _("For example, 'caps:none'."))
        self.editor.set_allow_edit(False)
        self.editor.set_allow_remove(True)
        self.editor.set_sort_function(False)
        self.editor.set_validation_function(self.validate_xkb_option)

        self.load_options_for_validation()
        self.reload()
        self.editor.connect("list-changed", self.on_list_changed)

    def _option_is_ui_managed(self, option):
        if option == "terminate:ctrl_alt_bksp":
            return True
        return option.split(":")[0] in ["lv3", "compose"]

    def load_options_for_validation(self):
        self.xkb_info = CinnamonDesktop.XkbInfo.new_with_extras()
        groups = self.xkb_info.get_all_option_groups()
        for group in groups:
            self.option_groups[group] = []
            for opt in self.xkb_info.get_options_for_group(group):
                self.option_groups[group].append(opt)
        # alias...
        self.option_groups["compose"] = self.option_groups["Compose key"]

    def validate_xkb_option(self, text):
        try:
            group = text.split(":")[0]
            if text in self.option_groups[group]:
                if self._option_is_ui_managed(text):
                    return _("Set this option in the shortcuts section.")
                else:
                    return None
            else:
                return _("Invalid option")
        except Exception as e:
            return _("Invalid option")

    def reload(self):
        options = self.input_source_settings.get_strv("xkb-options")
        visible_options = []

        for option in options:
            if self._option_is_ui_managed(option):
                continue
            visible_options.append(option)

        self.editor.set_strings(visible_options)

    def on_list_changed(self, widget, listed_options):
        current_options = self.input_source_settings.get_strv("xkb-options")
        new_options = []

        for option in current_options:
            if self._option_is_ui_managed(option):
                new_options.append(option)

        new_options += listed_options

        self.input_source_settings.set_strv("xkb-options", new_options)