#!/usr/bin/python3

import os.path
import signal

try:
    import tinycss2
except:
    pass

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

        self.selector = selector

        self.rule_separator = "/***** %s - cinnamon-settings-generated - do not edit *****/" % self.selector
        rules = []

        file = Gio.File.new_for_path(self._path)

        try:
            success, content_bytes, tag = file.load_contents(None)

            self._contents = content_bytes.decode()
            stylesheet = tinycss2.parse_stylesheet(self._contents)
            for rs in stylesheet:
                if isinstance(rs, tinycss2.ast.ParseError):
                    continue
                rules.append(rs)
            self.stylesheet = rules
        except GLib.Error as e:
            if e.code == Gio.IOErrorEnum.NOT_FOUND:
                self._contents = ""
                self.stylesheet = rules
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

    def _serialize_selector(self, rule):
        at_css = ""
        if isinstance(rule, tinycss2.ast.AtRule):
            at_css += "@" + rule.at_keyword
        at_css += self._serialize_prelude(rule.prelude)
        return at_css

    def _serialize_prelude(self, prelude):
        at_css = ""
        for cv in prelude:
            if isinstance(cv, tinycss2.ast.WhitespaceToken):
                at_css += " "
            elif isinstance(cv, tinycss2.ast.HashToken):
                at_css += "#" + cv.value
            elif isinstance(cv, tinycss2.ast.FunctionBlock):
                next
            else:
                at_css += cv.value
        return at_css.strip()

    def get_ruleset(self, selector_css):
        """
        Gets the current ruleset for selector_css,
        If it isn't currently defined, returns an empty
        one.
        """
        idx = 0
        for rs in self.stylesheet:
            if isinstance(rs, (tinycss2.ast.AtRule, tinycss2.ast.QualifiedRule)):
                if self._serialize_selector(rs) == selector_css:
                    return rs, idx
            idx += 1

        new_ruleset = tinycss2.parse_one_rule(selector_css + " {}", False)
        self.stylesheet.append(new_ruleset)

        return new_ruleset, len(self.stylesheet) - 1

    def get_declaration(self, selector, decl_name):
        rs, _ = self.get_ruleset(selector)

        declarations = tinycss2.parse_declaration_list(rs.content, True, True)

        for declaration in declarations:
            if decl_name == declaration.name:
                decl_value = None
                for component_value in declaration.value:
                    if isinstance(component_value, tinycss2.ast.DimensionToken):
                        decl_value = component_value.value
                return decl_value

        return None

    def set_declaration(self, selector, decl_name, value_as_str):
        # Remove an existing declaration.. for some reason if they
        # get modified, they become invalid (or I'm doing something wrong)
        self.remove_declaration(selector, decl_name)

        rs, idx = self.get_ruleset(selector)
        # rs.content[0].value: the value of the WhitespaceToken is the actual indent
        prefix = "\n\t"
        if rs.content:
            prefix = rs.content[0].value

        component_values = tinycss2.parse_component_value_list(prefix + decl_name +
                                                               ": " + value_as_str + ";")
        for component_value in component_values:
            self.stylesheet[idx].content.append(component_value)

    @staticmethod
    def _remove_declaration_from_content(declaration, content):
        idx = 0
        ident_idx = 0
        found_ident = False
        done = False
        new_content = []
        for component_value in content:
            idx += 1
            if len(content) != idx and isinstance(content[idx], tinycss2.ast.IdentToken) and \
               content[idx].value == declaration.name and \
               isinstance(component_value, tinycss2.ast.WhitespaceToken):
                continue
            if isinstance(component_value, tinycss2.ast.IdentToken) and \
               component_value.value == declaration.name:
                found_ident = True
                continue
            if found_ident:
                if isinstance(component_value, tinycss2.ast.LiteralToken):
                    if ident_idx == 0 or done:
                        done = False
                        continue
                if len(declaration.value) - 1 == ident_idx and \
                   component_value == declaration.value[ident_idx]:
                    done = True
                    continue
                if component_value == declaration.value[ident_idx] and \
                   content[idx] == declaration.value[ident_idx + 1]:
                    ident_idx += 1
                    continue
            new_content.append(component_value)

        return new_content

    def remove_declaration(self, selector, decl_name):
        rs, idx = self.get_ruleset(selector)

        if not rs:
            return

        declarations = tinycss2.parse_declaration_list(rs.content, True, True)

        for declaration in declarations:
            if decl_name == declaration.name:
                new_content = self._remove_declaration_from_content(declaration, rs.content)

                if not new_content:
                    self.stylesheet.remove(rs)
                    break

                self.stylesheet[idx].content = new_content
                break

    def save_stylesheet(self):
        self.sanitize_contents()
        out = ""

        lines = self._contents.split("\n")
        for line in lines:
            if self.rule_separator in line:
                break

            out += line + "\n"

        if self.stylesheet:
            if line != "":
                out += "\n"

            out += self.rule_separator + "\n"
            for rs in self.stylesheet:
                out += rs.serialize()

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

        self.builder = Gtk.Builder()
        self.builder.set_translation_domain('cinnamon')
        self.builder.add_from_file("/usr/share/cinnamon/cinnamon-settings/bin/scrollbar-test-widget.glade")

        self.content_widget = self.builder.get_object("content_box")
        self.content_widget.set_valign(Gtk.Align.CENTER)
        self.scrolled_window = self.builder.get_object("scrolled_window")
        self.pack_start(self.content_widget, True, True, 0)

        self.interface_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
        self.interface_settings.connect("changed::gtk-overlay-scrollbars", self.on_overlay_scrollbars_changed)
        self.update_overlay_state()

    def update_overlay_state(self):
        if self.interface_settings.get_boolean("gtk-overlay-scrollbars"):
            self.scrolled_window.set_overlay_scrolling(True)
        else:
            self.scrolled_window.set_overlay_scrolling(False)

    def on_overlay_scrollbars_changed(self, settings, key, data=None):
        self.update_overlay_state()

class Gtk2ScrollbarSizeEditor:
    def __init__(self, ui_scale):
        rcpath = GLib.getenv("GTK2_RC_FILES")
        if rcpath:
            self._path = rcpath.split(":")[0]
        else:
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
                print("Could not load .gtkrc-2.0 file: %s" % e.message)

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
            # If a path is specified through GTK2_RC_FILES, ensure it exists
            if not self._file.get_parent().query_exists():
                self._file.get_parent().make_directory_with_parents()
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
