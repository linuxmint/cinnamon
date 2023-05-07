#!/usr/bin/python3

import os

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *
from gi.repository import *

SCREENSHOT_HANDLING_SCHEMA = "org.gnome.gnome-screenshot"

class MnemonicLabel(Gtk.Label):
    def __init__(self, text, widget):
        super(MnemonicLabel, self).__init__(label = "")
        self.set_text_with_mnemonic(text)
        self.set_mnemonic_widget(widget)
        self.set_alignment(0.0, 0.5)
        self.set_valign(Gtk.Align.START)
        self.set_line_wrap(True)

class Module:
    name="screenshots"
    category = "prefs"
    comment = _("Screenshots")

    def __init__(self, content_box):
        keywords = _("screenshots, default, directory")
        sidePage = SidePage(_("Screenshots"), "gnome-screenshot", keywords, content_box, 560, module=self)
        self.sidePage = sidePage

    def _on_auto_save_directory_changed(self, settings, key):
        self.screenshots_settings.set_value("auto-save-directory", GLib.Variant.new_string(self.button.get_filename()))

    def _on_button_changed(self, widget):
        self.screenshots_settings.set_value("auto-save-directory", GLib.Variant.new_string(self.button.get_filename()))

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Screenshots module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "autosavedir", _("Screenshots"))

            self.screenshots_settings = Gio.Settings.new(SCREENSHOT_HANDLING_SCHEMA)
            self.screenshots_settings.connect(
                "changed::auto-save-directory",
                self._on_auto_save_directory_changed
            )

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            widget = SettingsWidget()
            self.button = Gtk.FileChooserButton(title=_("Select a folder"), action=Gtk.FileChooserAction.SELECT_FOLDER)
            _path = self.screenshots_settings.get_string("auto-save-directory")
            self.button.set_filename(_path)
            self.button.connect("file-set", self._on_button_changed)
            label = MnemonicLabel("Default directory to save your screenshots", self.button)
            size_group.add_widget(self.button)
            widget.pack_start(label, False, False, 0)
            widget.pack_end(self.button, False, False, 0)

            settings = page.add_section(_("Auto Save Directory"))
            settings.add_row(widget)

    def _setParentRef(self, window):
        self.sidePage.window = window




