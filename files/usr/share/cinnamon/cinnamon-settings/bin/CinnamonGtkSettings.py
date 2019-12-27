#!/usr/bin/python3

import os.path
import signal

import tinycss
from tinycss import tokenizer

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk, Gio, GObject

from xapp.SettingsWidgets import SettingsWidget, Range, Switch

SETTINGS_GROUP_NAME = "Settings"

ini_instance = None

def get_ini_editor():
    global ini_instance

    if ini_instance is None:
        ini_instance = GtkSettingsEditor()

    return ini_instance

class GtkSettingsEditor:
    def __init__(self):
        self._path = os.path.join(GLib.get_user_config_dir(),
                                  "gtk-3.0",
                                  "settings.ini")

        self.default_settings = Gtk.Settings.get_default()
    def _get_keyfile(self):
        keyfile = None
        try:
            keyfile = GLib.KeyFile()
            keyfile.load_from_file(self._path, 0)
        except:
            pass
        finally:
            return keyfile

    def get_boolean(self, key):
        keyfile = self._get_keyfile()
        try:
            result = keyfile.get_boolean(SETTINGS_GROUP_NAME, key)
        except:
            result = self.default_settings.get_property(key)

        return result

    def set_boolean(self, key, value):
        keyfile = self._get_keyfile()
        keyfile.set_boolean(SETTINGS_GROUP_NAME, key, value)

        try:
            data = keyfile.to_data()
            GLib.file_set_contents(self._path, bytes(data[0], encoding="utf8"))
        except:
            raise

class GtkSettingsSwitch(Switch):
    def __init__(self, markup, setting_name=None):
        self.setting_name = setting_name
        super(GtkSettingsSwitch, self).__init__(markup)

        self.settings = get_ini_editor()
        self.content_widget.set_active(self.settings.get_boolean(self.setting_name))
        self.content_widget.connect("notify::active", self.on_switch_active_changed)

    def on_switch_active_changed(self, switch, pspec, data=None):
        self.settings.set_boolean(self.setting_name, self.content_widget.get_active())

css_instance = None

def get_css_editor(selector=None):
    global css_instance

    if css_instance is None:
        css_instance = GtkCssEditor(selector)

    return css_instance

class CSSSettingsException(Exception):
    pass

class GtkCssEditor:
    def __init__(self, selector):
        self._path = os.path.join(GLib.get_user_config_dir(),
                                  "gtk-3.0",
                                  "gtk.css")

        self.parser = tinycss.make_parser()
        self.selector = selector

        self.rule_separator = "/***** %s - cinnamon-settings-generated - do not edit *****/" % self.selector
        self.my_ruleset = None

        file = Gio.File.new_for_path(self._path)

        try:
            success, content_bytes, tag = file.load_contents(None)

            self._contents = content_bytes.decode()
            self.stylesheet = self.parser.parse_stylesheet(self._contents)
        except GLib.Error as e:
            if e.code == Gio.IOErrorEnum.NOT_FOUND:
                self._contents = ""
                self.stylesheet = tinycss.css21.Stylesheet(rules=[], errors=[], encoding="utf-8")
            else:
                raise PermissionError("Could not load ~/.config/gtk-3.0/gtk.css file, check permissions")

    def sanitize_contents(self):
        in_lines = self._contents.split("\n")
        out_lines = []
        sof = True

        selector_found = False
        for line in in_lines:
            if self.rule_separator in line:
                break

            if line == "" and sof:
                continue

            if line.strip().startswith(self.selector):
                selector_found = True
                continue

            if not selector_found:
                out_lines.append(line)
                sof = False
                continue

            if "}" in line:
                selector_found = False
                continue

        if line == "" and len(out_lines) > 0:
            out_lines.pop()

        self._contents = "\n".join(out_lines)

    def get_ruleset(self, selector_css):
        """
        Gets the current ruleset for selector_css,
        If it isn't currently defined, returns an empty
        one.
        """
        for rs in self.stylesheet.rules:
            try:
                if rs.selector.as_css() == selector_css:
                    return rs
            except AttributeError:
                continue

        new_ruleset = tinycss.css21.RuleSet(tokenizer.tokenize_flat(selector_css), [], None, None)
        self.stylesheet.rules.append(new_ruleset)

        return new_ruleset

    def get_declaration(self, selector, decl_name):
        rs = self.get_ruleset(selector)

        for declaration in rs.declarations:
            if decl_name == declaration.name:
                return declaration.value[0].value

        return None

    def set_declaration(self, selector, decl_name, value_as_str):
        # Remove an existing declaration.. for some reason if they
        # get modified, they become invalid (or I'm doing something wrong)
        self.remove_declaration(selector, decl_name)

        rs = self.get_ruleset(selector)

        value_token = tokenizer.tokenize_flat(value_as_str)

        # Make a new declaration, add it to the ruleset
        new_decl = tinycss.css21.Declaration(decl_name, value_token, None, None, None)

        rs.declarations.append(new_decl)

        self.my_ruleset = rs

    def remove_declaration(self, selector, decl_name):
        rs = self.get_ruleset(selector)

        if not rs:
            return

        self.my_ruleset = None

        for declaration in rs.declarations:
            if decl_name == declaration.name:
                rs.declarations.remove(declaration)

                if len(rs.declarations) == 0:
                    self.stylesheet.rules.remove(rs)

                break

    def save_stylesheet(self):
        self.sanitize_contents()
        out = ""

        lines = self._contents.split("\n")
        for line in lines:
            if self.rule_separator in line:
                break

            out += line + "\n"

        if self.my_ruleset:
            if line != "":
                out += "\n"

            out += self.rule_separator + "\n"

            out += self.my_ruleset.selector.as_css() + " {\n"

            for decl in self.my_ruleset.declarations:
                out += "    " + decl.name + ": " + decl.value.as_css() + ";\n"

            out += "}\n"

        self._contents = out

        try:
            with open(self._path, "w+") as f:
                f.write(out)
        except PermissionError as e:
            print(e)

class CssOverrideSwitch(Switch):
    def __init__(self, markup, setting_name=None):
        self.setting_name = setting_name
        super(CssOverrideSwitch, self).__init__(markup)

        self.content_widget.set_active(False)

class CssRange(Range):
    def __init__(self, markup, selector, decl_names, mini, maxi, units="", tooltip="", switch_widget=None):
        # we override get_range() on the SettingsWidget, these properties need to exist before super()
        self.mini = mini
        self.maxi = maxi

        super(CssRange, self).__init__(markup, units=units, mini=mini, maxi=maxi, step=1, tooltip=tooltip)

        self.units = units

        self.timer = 0

        self.switch_widget = switch_widget.content_widget
        self.selector = selector
        self.decl_names = decl_names

    def sync_initial_switch_state(self):
        editor = get_css_editor(self.selector)

        all_existing = True

        for decl_name in self.decl_names:
            if editor.get_declaration(self.selector, decl_name):
                continue

            all_existing = False
            break

        starting_value = 10

        if all_existing:
            starting_value = editor.get_declaration(self.selector, self.decl_names[0])

            self.content_widget.set_value(starting_value)

        self.switch_widget.set_active(all_existing)
        self.switch_widget.connect("notify::active", self.on_switch_active_changed)

        self.revealer.set_reveal_child(all_existing)

    def on_switch_active_changed(self, switch, pspec, data=None):
        active = switch.get_active()

        if active:
            # I'm not sure how we could get the current theme's scrollbar min-width, without
            # parsing it with tinycss also - a bit overkill?  10 is pretty common...
            self.revealer.set_reveal_child(True)
            self.content_widget.set_value(10)

            # set_value doesn't work if the switch was off at startup, the value won't be changing,
            # so apply_later won't be called from SettingsWidgets.Range
            self.apply_later()
        else:
            for name in self.decl_names:
                get_css_editor().remove_declaration(self.selector, name)

            self.revealer.set_reveal_child(False)

        get_css_editor().save_stylesheet()

    def apply_later(self, *args):
        def apply(self):
            editor = get_css_editor()
            for name in self.decl_names:
                value_as_str = "%d%s" % (int(self.content_widget.get_value()), self.units)
                editor.set_declaration(self.selector, name, value_as_str)

            editor.save_stylesheet()
            self.timer = 0
        if self.timer > 0:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(300, apply, self)

    def get_range(self):
        return [self.mini, self.maxi]

class PreviewWidget(SettingsWidget):
    def __init__(self):
        super(PreviewWidget, self).__init__()

        self.content_widget = Gtk.Socket()
        self.content_widget.set_valign(Gtk.Align.CENTER)

        # This matches the plug toplevel container, it keeps the PreviewWidget from
        # resizing briefly when reloading the plug.
        self.content_widget.set_size_request(-1, 100)
        self.content_widget.connect("hierarchy-changed", self.on_widget_hierarchy_changed)
        self.content_widget.connect("plug-removed", self.on_plug_removed)

        self.file_monitor_delay = 0

        self.interface_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
        self.update_overlay_state()

        self.pack_start(self.content_widget, True, True, 0)

        self.proc = None

    def update_overlay_state(self):
        if self.interface_settings.get_boolean("gtk-overlay-scrollbars"):
            GLib.setenv("GTK_OVERLAY_SCROLLING", "1", True)
        else:
            GLib.setenv("GTK_OVERLAY_SCROLLING", "0", True)

    def socket_is_anchored(self, socket):
        toplevel = socket.get_toplevel()

        is_toplevel = isinstance(toplevel, Gtk.Window)

        return is_toplevel

    def on_widget_hierarchy_changed(self, widget, previous_toplevel, data=None):
        if not self.socket_is_anchored(self.content_widget):
            self.kill_plug()
            return

        self.interface_settings.connect("changed::gtk-overlay-scrollbars", self.on_overlay_scrollbars_changed)
        self.interface_settings.get_boolean("gtk-overlay-scrollbars")

        path = os.path.join(GLib.get_user_config_dir(), "gtk-3.0")
        file = Gio.File.new_for_path(path)

        try:
            self.config_monitor = file.monitor_directory(Gio.FileMonitorFlags.NONE, None)
            self.config_monitor.connect("changed", self.on_config_dir_changed)
        except GLib.Error as e:
            print(e.message)

        self.reload()

    def on_plug_removed(self, socket, data=None):
        return True

    def on_overlay_scrollbars_changed(self, settings, key, data=None):
        self.update_overlay_state()

        self.reload()

    def on_config_dir_changed(self, monitor, file, other, event_type, data=None):
        if event_type != Gio.FileMonitorEvent.CHANGES_DONE_HINT:
            return

        if self.file_monitor_delay > 0:
            GObject.source_remove(self.file_monitor_delay)

        self.file_monitor_delay = GObject.timeout_add(100, self.on_file_monitor_delay_finished)

    def on_file_monitor_delay_finished(self, data=None):
        self.file_monitor_delay = 0
        self.reload()

        return False

    def kill_plug(self):
        if self.proc:
            self.proc.send_signal(signal.SIGTERM)
            self.proc = None

    def reload(self):
        self.kill_plug()

        self.proc = Gio.Subprocess.new(['python3', '/usr/share/cinnamon/cinnamon-settings/bin/scrollbar-test-widget.py', str(self.content_widget.get_id())],
                                       Gio.SubprocessFlags.NONE)

class Gtk2ScrollbarSizeEditor:
    def __init__(self, ui_scale):
        self._path = os.path.join(GLib.get_home_dir(), ".gtkrc-2.0")
        self._file = Gio.File.new_for_path(self._path)
        self._settings = Gio.Settings(schema_id="org.cinnamon.theme")
        self.ui_scale = ui_scale
        self.timeout_id = 0
        self.number_end = 0
        self.style_prop_start = 0
        self._contents = ""

        try:
            success, content_bytes, tag = self._file.load_contents(None)

            self._contents = content_bytes.decode()
        except GLib.Error as e:
            if e.code == Gio.IOErrorEnum.NOT_FOUND:
                pass
            else:
                print("Could not load ~/.gtkrc-2.0 file: %s" % e.message)

        self.parse_contents()

    def set_size(self, size):
        if self.timeout_id > 0:
            GLib.source_remove(self.timeout_id)

        multiplier = self._settings.get_double("gtk-version-scrollbar-multiplier")
        comped_value = int(size * multiplier * self.ui_scale)

        self.timeout_id = GLib.timeout_add(300, self.on_set_size_timeout, comped_value)

    def on_set_size_timeout(self, size):
        c = self._contents

        if size > 0:
            style_prop = "GtkScrollbar::slider-width = %d" % size
            final_contents = c[:self.style_prop_start] + style_prop + c[self.style_prop_start:]
        else:
            final_contents = self._contents

        # print("saving changed: ", final_contents)

        try:
            self._file.replace_contents(final_contents.encode("utf-8"),
                                        None,
                                        False,
                                        0,
                                        None)
        except GLib.Error as e:
            print("Could not save .gtkrc-2.0 file: %s" % e.message)

        self.timeout_id = 0
        return False

    def make_default_contents(self):
        self._contents = """
###############################################
# Created by cinnamon-settings - please do not edit or reformat.
#
style "cs-scrollbar-style" {

}

class "GtkScrollbar" style "cs-scrollbar-style"
###############################################
"""
        self.style_prop_start = 145

    def check_preexisting_cs_modification(self):
        marker = "cs-scrollbar-style"

        c = self._contents

        if marker in c:
            i = c.index(marker) + len(marker)

            while i < len(c):
                if c[i] == "{":
                    i += 1

                    open_bracket = i

                    while i < len(c):
                        if c[i] == "}":
                            close_bracket = i
                            self._contents = c[:open_bracket] + "\n\n" + c[close_bracket:]
                            self.style_prop_start = open_bracket + 1
                            return True
                        i += 1
                i += 1

        return False

    def parse_contents(self):
        if self.check_preexisting_cs_modification():
            return

        style_prop = "GtkScrollbar::slider-width"

        if not self._contents:
            self.make_default_contents()
            return

        c = self._contents

        length = len(c)
        i = 0
        found = False

        while i < length:
            if c[i:].startswith(style_prop):
                self.style_prop_start = i
                found = True
                break
            i += 1

        if not found:
            self.make_default_contents()
            return

        i += len(style_prop)
        found = False

        while i < length:
            if c[i] == "=":
                found = True
                break
            i += 1

        if not found:
            self.make_default_contents()
            return

        i += 1
        found = False

        while i < length:
            if c[i].isalpha():
                break
            if c[i].isspace():
                i += 1
                continue
            if c[i].isdigit():
                found = True
                break

        if not found:
            self.make_default_contents()
            return

        i += 1

        while i < length:
            if c[i].isdigit():
                i += 1
                continue
            else:
                self.number_end = i
                break

        self._contents = c[:self.style_prop_start] + c[self.number_end:]
