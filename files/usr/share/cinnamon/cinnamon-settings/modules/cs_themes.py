#!/usr/bin/python3

import os
import json
import tinycss2

from gi.repository import Gtk, GdkPixbuf

from xapp.GSettingsWidgets import *
from CinnamonGtkSettings import CssRange, CssOverrideSwitch, GtkSettingsSwitch, PreviewWidget, Gtk2ScrollbarSizeEditor
from SettingsWidgets import LabelRow, SidePage, walk_directories
from ChooserButtonWidgets import PictureChooserButton
from ExtensionCore import DownloadSpicesPage
from Spices import Spice_Harvester

from pathlib import Path

ICON_SIZE = 48

# Gtk and Cinnamon check folders in order of precedence.  These lists match the
# order.  It doesn't really matter here, since we're only looking for names,
# but it's helpful to be aware of it.

ICON_FOLDERS = [
    os.path.join(GLib.get_home_dir(), ".icons"),
    os.path.join(GLib.get_user_data_dir(), "icons")
] + [os.path.join(datadir, "icons") for datadir in GLib.get_system_data_dirs()]

THEME_FOLDERS = [
    os.path.join(GLib.get_home_dir(), ".themes"),
    os.path.join(GLib.get_user_data_dir(), "themes")
] + [os.path.join(datadir, "themes") for datadir in GLib.get_system_data_dirs()]

THEMES_BLACKLIST = [
    "gnome", # not meant to be used as a theme. Provides icons to inheriting themes.
    "hicolor", # same
    "adwaita", "adwaita-dark", # incomplete outside of GNOME, doesn't support Cinnamon.
    "highcontrast", # same. Also, available via a11y as a global setting.
    "epapirus", "epapirus-dark", # specifically designed for Pantheon
    "ubuntu-mono", "ubuntu-mono-dark", "ubuntu-mono-light", "loginicons", # ubuntu-mono icons (non-removable in Ubuntu 24.04)
    "humanity", "humanity-dark"  # same
]

class Style:
    def __init__(self, json_obj):
        self.name = json_obj["name"]
        self.modes = {}
        self.default_mode = None

class Mode:
    def __init__(self, name):
        self.name = name
        self.default_variant = None
        self.variants = []

    def get_variant_by_name(self, name):
        for variant in self.variants:
            if name == variant.name:
                return variant

        return None

class Variant:
    def __init__(self, json_obj):
        self.name = json_obj["name"]
        self.gtk_theme = None
        self.icon_theme = None
        self.cinnamon_theme = None
        self.cursor_theme = None
        self.color = "#000000"
        self.color2 = "#000000"
        if "themes" in json_obj:
            themes = json_obj["themes"]
            self.gtk_theme = themes
            self.icon_theme = themes
            self.cinnamon_theme = themes
            self.cursor_theme = themes
        if "gtk" in json_obj:
            self.gtk_theme = json_obj["gtk"]
        if "icons" in json_obj:
            self.icon_theme = json_obj["icons"]
        if "cinnamon" in json_obj:
            self.cinnamon_theme = json_obj["cinnamon"]
        if "cursor" in json_obj:
            self.cursor_theme = json_obj["cursor"]
        self.color = json_obj["color"]
        self.color2 = self.color
        if "color2" in json_obj:
            self.color2 = json_obj["color2"]

class Module:
    comment = _("Manage themes to change how your desktop looks")
    name = "themes"
    category = "appear"

    def __init__(self, content_box):
        self.keywords = _("themes, style")
        self.icon = "cs-themes"
        self.window = None
        sidePage = SidePage(_("Themes"), self.icon, self.keywords, content_box, module=self)
        self.sidePage = sidePage
        self.refreshing = False # flag to ensure we only refresh once at any given moment

    def refresh_themes(self):
        # Find all installed themes
        self.gtk_themes = []
        self.gtk_theme_names = set()
        self.icon_theme_names = []
        self.cinnamon_themes = []
        self.cinnamon_theme_names = set()
        self.cursor_themes = []
        self.cursor_theme_names = set()

        # Gtk themes -- Only shows themes that have a gtk-3.* variation
        for (name, path) in walk_directories(THEME_FOLDERS, self.filter_func_gtk_dir, return_directories=True):
            if name.lower() in THEMES_BLACKLIST:
                continue
            for theme in self.gtk_themes:
                if name == theme[0]:
                    if path == THEME_FOLDERS[0]:
                        continue
                    else:
                        self.gtk_themes.remove(theme)
            self.gtk_theme_names.add(name)
            self.gtk_themes.append((name, path))
        self.gtk_themes.sort(key=lambda a: a[0].lower())

        # Cinnamon themes
        for (name, path) in walk_directories(THEME_FOLDERS, lambda d: os.path.exists(os.path.join(d, "cinnamon")), return_directories=True):
            for theme in self.cinnamon_themes:
                if name == theme[0]:
                    if path == THEME_FOLDERS[0]:
                        continue
                    else:
                        self.cinnamon_themes.remove(theme)
            self.cinnamon_theme_names.add(name)
            self.cinnamon_themes.append((name, path))
        self.cinnamon_themes.sort(key=lambda a: a[0].lower())

        # Icon themes
        walked = walk_directories(ICON_FOLDERS, lambda d: os.path.isdir(d), return_directories=True)
        valid = []
        for directory in walked:
            if directory[0].lower() in THEMES_BLACKLIST:
                continue
            path = os.path.join(directory[1], directory[0], "index.theme")
            if os.path.exists(path):
                try:
                    for line in list(open(path)):
                        if line.startswith("Directories="):
                            valid.append(directory)
                            break
                except Exception as e:
                    print (e)
        valid.sort(key=lambda a: a[0].lower())
        for (name, path) in valid:
            if name not in self.icon_theme_names:
                self.icon_theme_names.append(name)

        # Cursor themes
        for (name, path) in walk_directories(ICON_FOLDERS, lambda d: os.path.isdir(d) and os.path.exists(os.path.join(d, "cursors")), return_directories=True):
            if name.lower() in THEMES_BLACKLIST:
                continue
            for theme in self.cursor_themes:
                if name == theme[0]:
                    if path == ICON_FOLDERS[0]:
                        continue
                    else:
                        self.cursor_themes.remove(theme)
            self.cursor_theme_names.add(name)
            self.cursor_themes.append((name, path))
        self.cursor_themes.sort(key=lambda a: a[0].lower())

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Themes module")

            self.refresh_themes()

            self.ui_ready = True

            self.spices = Spice_Harvester('theme', self.window)

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            self.settings = Gio.Settings.new("org.cinnamon.desktop.interface")
            self.cinnamon_settings = Gio.Settings.new("org.cinnamon.theme")
            self.xsettings = Gio.Settings.new("org.x.apps.portal")

            self.scale = self.window.get_scale_factor()

            self.icon_chooser = self.create_button_chooser(self.settings, 'icon-theme', 'icons', 'icons', button_picture_width=ICON_SIZE, menu_picture_width=ICON_SIZE, num_cols=4, frame=False)
            self.cursor_chooser = self.create_button_chooser(self.settings, 'cursor-theme', 'icons', 'cursors', button_picture_width=32, menu_picture_width=32, num_cols=4, frame=False)
            self.theme_chooser = self.create_button_chooser(self.settings, 'gtk-theme', 'themes', 'gtk-3.0', button_picture_width=125, menu_picture_width=125, num_cols=4, frame=True)
            self.cinnamon_chooser = self.create_button_chooser(self.cinnamon_settings, 'name', 'themes', 'cinnamon', button_picture_width=125, menu_picture_width=125*self.scale, num_cols=4, frame=True)

            selected_meta_theme = None

            gladefile = "/usr/share/cinnamon/cinnamon-settings/themes.ui"
            builder = Gtk.Builder()
            builder.set_translation_domain('cinnamon')
            builder.add_from_file(gladefile)
            page = builder.get_object("page_simplified")
            page.show()

            self.style_combo = builder.get_object("style_combo")
            self.mixed_button = builder.get_object("mixed_button")
            self.dark_button = builder.get_object("dark_button")
            self.light_button = builder.get_object("light_button")
            self.color_box = builder.get_object("color_box")
            self.customize_button = builder.get_object("customize_button")
            self.preset_button = builder.get_object("preset_button")
            self.color_label = builder.get_object("color_label")
            self.active_style = None
            self.active_mode_name = None
            self.active_variant = None

            # HiDPI support
            for mode in ["mixed", "dark", "light"]:
                path = f"/usr/share/cinnamon/cinnamon-settings/appearance-{mode}.svg"
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, 112*self.scale, 80*self.scale)
                surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, self.scale)
                builder.get_object(f"image_{mode}").set_from_surface(surface)

            self.color_dot_svg = ""
            with open("/usr/share/cinnamon/cinnamon-settings/color_dot.svg") as f:
                self.color_dot_svg = f.read()

            self.reset_look_ui()

            self.mixed_button.connect("clicked", self.on_mode_button_clicked, "mixed")
            self.dark_button.connect("clicked", self.on_mode_button_clicked, "dark")
            self.light_button.connect("clicked", self.on_mode_button_clicked, "light")
            self.customize_button.connect("clicked", self.on_customize_button_clicked)
            self.style_combo.connect("changed", self.on_style_combo_changed)

            self.sidePage.stack.add_named(page, "simplified")

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "themes", _("Themes"))

            settings = page.add_section()

            widget = self.make_group(_("Mouse Pointer"), self.cursor_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Applications"), self.theme_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Icons"), self.icon_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Desktop"), self.cinnamon_chooser)
            settings.add_row(widget)

            button = Gtk.Button()
            button.set_label(_("Simplified settings..."))
            button.set_halign(Gtk.Align.END)
            button.connect("clicked", self.on_simplified_button_clicked)
            page.add(button)

            page = DownloadSpicesPage(self, 'theme', self.spices, self.window)
            self.sidePage.stack.add_titled(page, 'download', _("Add/Remove"))

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "options", _("Settings"))

            settings = page.add_section(_("Miscellaneous options"))

            options = [("default", _("Let applications decide")),
                       ("prefer-dark", _("Prefer dark mode")),
                       ("prefer-light", _("Prefer light mode"))]
            widget = GSettingsComboBox(_("Dark mode"), "org.x.apps.portal", "color-scheme", options)
            widget.set_tooltip_text(_("This setting only affects applications which support dark mode"))
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Show icons in menus"), "org.cinnamon.settings-daemon.plugins.xsettings", "menus-have-icons")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Show icons on buttons"), "org.cinnamon.settings-daemon.plugins.xsettings", "buttons-have-icons")
            settings.add_row(widget)

            settings = page.add_section(_("Scrollbar behavior"))

            # Translators: The 'trough' is the part of the scrollbar that the 'handle'
            # rides in.  This setting determines whether clicking in that trough somewhere
            # jumps directly to the new position, or if it only scrolls towards it.
            switch = GtkSettingsSwitch(_("Jump to position when clicking in a trough"), "gtk-primary-button-warps-slider")
            settings.add_row(switch)

            widget = GSettingsSwitch(_("Use overlay scroll bars"), "org.cinnamon.desktop.interface", "gtk-overlay-scrollbars")
            settings.add_row(widget)

            self.gtk2_scrollbar_editor = Gtk2ScrollbarSizeEditor(widget.get_scale_factor())

            switch = CssOverrideSwitch(_("Override the current theme's scrollbar width"))
            settings.add_row(switch)
            self.scrollbar_switch = switch.content_widget

            widget = CssRange(_("Scrollbar width"), "scrollbar slider", ["min-width", "min-height"], 2, 40, "px", None, switch)
            settings.add_reveal_row(widget)

            try:
                widget.sync_initial_switch_state()
            except PermissionError as e:
                print(e)
                switch.set_sensitive(False)

            self.scrollbar_css_range = widget.content_widget
            self.scrollbar_css_range.get_adjustment().set_page_increment(2.0)

            switch.content_widget.connect("notify::active", self.on_css_override_active_changed)
            widget.content_widget.connect("value-changed", self.on_range_slider_value_changed)

            self.on_css_override_active_changed(switch)

            widget = PreviewWidget()
            settings.add_row(widget)

            label_widget = LabelRow(_(
"""Changes may not apply to already-running programs, and may not affect all applications."""))
            settings.add_row(label_widget)

            self.builder = self.sidePage.builder

            for path in [THEME_FOLDERS[0], ICON_FOLDERS[0], ICON_FOLDERS[1]]:
                try:
                    os.makedirs(path)
                except OSError:
                    pass

            self.monitors = []
            for path in (THEME_FOLDERS + ICON_FOLDERS):
                if os.path.exists(path):
                    file_obj = Gio.File.new_for_path(path)
                    try:
                        file_monitor = file_obj.monitor_directory(Gio.FileMonitorFlags.SEND_MOVED, None)
                        file_monitor.connect("changed", self.on_file_changed)
                        self.monitors.append(file_monitor)
                    except Exception as e:
                        # File monitors can fail when the OS runs out of file handles
                        print(e)

            self.refresh_choosers()
            GLib.idle_add(self.set_mode, "simplified" if self.active_variant is not None else "themes", True)
            return

        GLib.idle_add(self.set_mode, self.sidePage.stack.get_visible_child_name())

    def is_variant_active(self, variant):
        # returns whether or not the given variant corresponds to the currently selected themes
        if variant.gtk_theme != self.settings.get_string("gtk-theme"):
            return False
        if variant.icon_theme != self.settings.get_string("icon-theme"):
            return False
        if variant.cinnamon_theme != self.cinnamon_settings.get_string("name"):
            return False
        if variant.cursor_theme != self.settings.get_string("cursor-theme"):
            return False
        return True

    def is_variant_valid(self, variant):
        # returns whether or not the given variant is valid (i.e. made of themes which are currently installed)
        if variant.gtk_theme is None:
            print("No Gtk theme defined")
            return False
        if variant.icon_theme is None:
            print("No icon theme defined")
            return False
        if variant.cinnamon_theme is None:
            print("No Cinnamon theme defined")
            return False
        if variant.cursor_theme is None:
            print("No cursor theme defined")
            return False
        if variant.gtk_theme not in self.gtk_theme_names:
            print("Gtk theme not found:", variant.gtk_theme)
            return False
        if variant.icon_theme not in self.icon_theme_names:
            print("icon theme not found:", variant.icon_theme)
            return False
        if variant.cinnamon_theme not in self.cinnamon_theme_names and variant.cinnamon_theme != "cinnamon":
            print("Cinnamon theme not found:", variant.cinnamon_theme)
            return False
        if variant.cursor_theme not in self.cursor_theme_names:
            print("Cursor theme not found:", variant.cursor_theme)
            return False
        return True

    def cleanup_ui(self):
        self.mixed_button.set_state_flags(Gtk.StateFlags.NORMAL, True)
        self.dark_button.set_state_flags(Gtk.StateFlags.NORMAL, True)
        self.light_button.set_state_flags(Gtk.StateFlags.NORMAL, True)
        self.mixed_button.set_sensitive(False)
        self.dark_button.set_sensitive(False)
        self.light_button.set_sensitive(False)
        for child in self.color_box.get_children():
            self.color_box.remove(child)
        self.color_label.hide()
        model = self.style_combo.get_model()
        model.clear()

    def reset_look_ui(self):
        if not self.ui_ready:
            return

        self.ui_ready = False
        self.cleanup_ui()

        # Read the JSON files
        self.styles = {}
        self.style_objects = {}
        self.active_style = None
        self.active_mode_name = None
        self.active_variant = None

        path = "/usr/share/cinnamon/styles.d"
        if os.path.exists(path):
            for filename in sorted(os.listdir(path)):
                if filename.endswith(".styles"):
                    try:
                        with open(os.path.join(path, filename)) as f:
                            json_text = json.loads(f.read())
                            for style_json in json_text["styles"]:
                                style = Style(style_json)
                                for mode_name in ["mixed", "dark", "light"]:
                                    if mode_name in style_json:
                                        mode = Mode(mode_name)
                                        for variant_json in style_json[mode_name]:
                                            variant = Variant(variant_json)
                                            if self.is_variant_valid(variant):
                                                # Add the variant to the mode
                                                mode.variants.append(variant)
                                                if mode.default_variant is None:
                                                    # Assign the first variant as default
                                                    mode.default_variant = variant
                                                if "default" in variant_json and variant_json["default"] == "true":
                                                    # Override default if specified
                                                    mode.default_variant = variant
                                                # Add the mode to the style (if not done already)
                                                if not mode_name in style.modes:
                                                    style.modes[mode_name] = mode
                                                # Set it as the default mode if there's no default mode
                                                if style.default_mode is None:
                                                    style.default_mode = mode
                                                # Set active variant variables if the variant is active
                                                if self.is_variant_active(variant):
                                                    self.active_style= style
                                                    self.active_mode_name = mode_name
                                                    self.active_variant = variant
                                # Override the default mode if specified
                                if "default" in style_json:
                                    default_name = style_json["default"]
                                    if default_name in style.modes:
                                        style.default_mode = style.modes[default_name]

                                if style.default_mode is None:
                                    print ("No valid mode/variants found for style:", style.name)
                                else:
                                    self.styles[style.name] = style
                    except Exception as e:
                        print(f"Failed to parse styles from {filename}.")
                        print(e)

        # Populate the style combo
        for name in sorted(self.styles.keys()):
            self.style_combo.append_text(name)

        if self.active_variant is not None:
            style = self.active_style
            mode = self.active_style.modes[self.active_mode_name]
            variant = self.active_variant
            print("Found active variant:", style.name, mode.name, variant.name)
            # Position the style combo
            model = self.style_combo.get_model()
            iter = model.get_iter_first()
            while (iter != None):
                name = model.get_value(iter, 0)
                if name == style.name:
                    self.style_combo.set_active_iter(iter)
                    break
                iter = model.iter_next(iter)
            # Set the mode buttons
            for mode_name in ["mixed", "dark", "light"]:
                if mode_name == "mixed":
                    button = self.mixed_button
                elif mode_name == "dark":
                    button = self.dark_button
                else:
                    button = self.light_button
                # Set the button state
                if mode_name == mode.name:
                    button.set_state_flags(Gtk.StateFlags.CHECKED, True)
                else:
                    button.set_state_flags(Gtk.StateFlags.NORMAL, True)
                if mode_name in style.modes:
                    button.set_sensitive(True)
                else:
                    button.set_sensitive(False)

            if len(mode.variants) > 1:
                # Generate the color buttons
                self.color_label.show()
                for variant in mode.variants:
                    svg = self.color_dot_svg.replace("#8cffbe", variant.color)
                    svg = svg.replace("#71718e", variant.color2)
                    svg = str.encode(svg)
                    stream = Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(svg))
                    pixbuf = GdkPixbuf.Pixbuf.new_from_stream_at_scale(stream, 22*self.scale, 22*self.scale, True, None)
                    surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, self.scale)
                    image = Gtk.Image.new_from_surface(surface)
                    button = Gtk.ToggleButton()
                    button.add(image)
                    button.show_all()
                    self.color_box.add(button)
                    if variant == self.active_variant:
                        button.set_state_flags(Gtk.StateFlags.CHECKED, True)
                    button.connect("clicked", self.on_color_button_clicked, variant)
        else:
            # Position style combo on "Custom"
            self.style_combo.append_text(_("Custom"))
            self.style_combo.set_active(len(self.styles.keys()))
        self.ui_ready = True

    def on_customize_button_clicked(self, button):
        self.set_button_chooser(self.icon_chooser, self.settings.get_string("icon-theme"), 'icons', 'icons', ICON_SIZE)
        self.set_button_chooser(self.cursor_chooser, self.settings.get_string("cursor-theme"), 'icons', 'cursors', 32)
        self.set_button_chooser(self.theme_chooser, self.settings.get_string("gtk-theme"), 'themes', 'gtk-3.0', 35)
        self.set_button_chooser(self.cinnamon_chooser, self.cinnamon_settings.get_string("name"), 'themes', 'cinnamon', 60)
        self.set_mode("themes")

    def on_simplified_button_clicked(self, button):
        self.reset_look_ui()
        self.set_mode("simplified")

    def set_mode(self, mode, startup=False):
        # When picking a start page at startup, no transition, or else you'll see the tail end of it happening
        # as the page is loading. Otherwise, crossfade when switching between simple/custom. The left/right
        # transition is kept as the default for shifting between the 3 custom pages (themes, downloads, settings).
        if startup:
            transition = Gtk.StackTransitionType.NONE
        else:
            transition = Gtk.StackTransitionType.CROSSFADE

        switcher_widget = Gio.Application.get_default().stack_switcher

        if mode == "simplified":
            switcher_widget.set_opacity(0.0)
            switcher_widget.set_sensitive(False)
        else:
            switcher_widget.set_opacity(1.0)
            switcher_widget.set_sensitive(True)

        self.sidePage.stack.set_visible_child_full(mode, transition)

    def on_navigate_out_of_module(self):
        switcher_widget = Gio.Application.get_default().stack_switcher
        switcher_widget.set_opacity(1.0)
        switcher_widget.set_sensitive(True)

    def on_color_button_clicked(self, button, variant):
        print("Color button clicked")
        self.activate_variant(variant)

    def on_mode_button_clicked(self, button, mode_name):
        print("Mode button clicked")
        if self.active_style is not None:
            mode = self.active_style.modes[mode_name]
            self.activate_mode(self.active_style, mode)

    def on_style_combo_changed(self, combobox):
        if not self.ui_ready:
            return
        selected_name = combobox.get_active_text()
        if selected_name == None or selected_name == _("Custom"):
            return
        print("Activating style:", selected_name)
        for name in self.styles.keys():
            if name == selected_name:
                style = self.styles[name]
                mode = style.default_mode
                self.activate_mode(style, mode)

    def activate_mode(self, style, mode):
        print("Activating mode:", mode.name)

        if mode.name == "mixed":
            self.xsettings.set_enum("color-scheme", 0)
        elif mode.name == "dark":
            self.xsettings.set_enum("color-scheme", 1)
        elif mode.name == "light":
            self.xsettings.set_enum("color-scheme", 2)

        if self.active_variant is not None:
            new_same_variant = mode.get_variant_by_name(self.active_variant.name)
            if new_same_variant is not None:
                self.activate_variant(new_same_variant)
                return

        self.activate_variant(mode.default_variant)

    def activate_variant(self, variant):
        print("Activating variant:", variant.name)
        self.settings.set_string("gtk-theme", variant.gtk_theme)
        self.settings.set_string("icon-theme", variant.icon_theme)
        self.cinnamon_settings.set_string("name", variant.cinnamon_theme)
        self.settings.set_string("cursor-theme", variant.cursor_theme)
        self.reset_look_ui()

    def on_css_override_active_changed(self, switch, pspec=None, data=None):
        if self.scrollbar_switch.get_active():
            self.gtk2_scrollbar_editor.set_size(self.scrollbar_css_range.get_value())
        else:
            self.gtk2_scrollbar_editor.set_size(0)

    def on_range_slider_value_changed(self, widget, data=None):
        if self.scrollbar_switch.get_active():
            self.gtk2_scrollbar_editor.set_size(widget.get_value())

    def on_file_changed(self, file, other, event, data):
        if self.refreshing:
            return
        self.refreshing = True
        GLib.timeout_add_seconds(5, self.refresh_themes)
        GLib.timeout_add_seconds(5, self.refresh_choosers)

    def refresh_choosers(self):
        array = [(self.cursor_chooser, "cursors", self.cursor_themes, self._on_cursor_theme_selected),
                    (self.theme_chooser, "gtk-3.0", self.gtk_themes, self._on_gtk_theme_selected),
                    (self.cinnamon_chooser, "cinnamon", self.cinnamon_themes, self._on_cinnamon_theme_selected),
                    (self.icon_chooser, "icons", self.icon_theme_names, self._on_icon_theme_selected)]
        for element in array:
            chooser, path_suffix, themes, callback = element
            chooser.clear_menu()
            chooser.set_sensitive(False)
            chooser.progress = 0.0
            self.refresh_chooser(chooser, path_suffix, themes, callback)
        self.refreshing = False

    def refresh_chooser(self, chooser, path_suffix, themes, callback):
        inc = 1.0
        if len(themes) > 0:
            inc = 1.0 / len(themes)

        if path_suffix == 'icons':
            cache_folder = GLib.get_user_cache_dir() + '/cs_themes/'
            icon_cache_path = os.path.join(cache_folder, 'icons')

            # Retrieve list of known themes/locations for faster loading (icon theme loading and lookup are very slow)
            if os.path.exists(icon_cache_path):
                read_path = icon_cache_path
            else:
                read_path = '/usr/share/cinnamon/cinnamon-settings/icons'

            icon_paths = {}
            with open(read_path, 'r') as cache_file:
                for line in cache_file:
                    theme_name, icon_path = line.strip().split(':')
                    icon_paths[theme_name] = icon_path

            dump = False
            for theme in themes:
                theme_path = None

                if theme in icon_paths:
                    # loop through all possible locations until we find a match
                    # (user folders should override system ones)
                    for theme_folder in ICON_FOLDERS:
                        possible_path = os.path.join(theme_folder, icon_paths[theme])
                        if os.path.exists(possible_path):
                            theme_path = possible_path
                            break

                if theme_path is None:
                    icon_theme = Gtk.IconTheme()
                    icon_theme.set_custom_theme(theme)
                    folder = icon_theme.lookup_icon('folder', ICON_SIZE, Gtk.IconLookupFlags.FORCE_SVG)
                    if folder:
                        theme_path = folder.get_filename()

                        # we need to get the relative path for storage
                        for theme_folder in ICON_FOLDERS:
                            if os.path.commonpath([theme_folder, theme_path]) == theme_folder:
                                icon_paths[theme] = os.path.relpath(theme_path, start=theme_folder)
                                break

                    dump = True

                if theme_path is None:
                    continue

                if os.path.exists(theme_path):
                    chooser.add_picture(theme_path, callback, title=theme, id=theme)
                GLib.timeout_add(5, self.increment_progress, (chooser, inc))

            if dump:
                if not os.path.exists(cache_folder):
                    os.mkdir(cache_folder)

                with open(icon_cache_path, 'w') as cache_file:
                    for theme_name, icon_path in icon_paths.items():
                        cache_file.write('%s:%s\n' % (theme_name, icon_path))

        else:
            if path_suffix == "cinnamon":
                chooser.add_picture("/usr/share/cinnamon/theme/thumbnail.png", callback, title="cinnamon", id="cinnamon")
            if path_suffix in ["gtk-3.0", "cinnamon"]:
                themes = sorted(themes, key=lambda t: (not t[1].startswith(GLib.get_home_dir())))

            for theme in themes:
                theme_name = theme[0]
                theme_path = theme[1]
                try:
                    for path in ["%s/%s/%s/thumbnail.png" % (theme_path, theme_name, path_suffix),
                                 "/usr/share/cinnamon/thumbnails/%s/%s.png" % (path_suffix, theme_name),
                                 "/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix]:
                        if os.path.exists(path):
                            chooser.add_picture(path, callback, title=theme_name, id=theme_name)
                            break
                except:
                    chooser.add_picture("/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix, callback, title=theme_name, id=theme_name)
                GLib.timeout_add(5, self.increment_progress, (chooser, inc))
        GLib.timeout_add(500, self.hide_progress, chooser)

    def increment_progress(self, payload):
        (chooser, inc) = payload
        chooser.increment_loading_progress(inc)

    def hide_progress(self, chooser):
        chooser.set_sensitive(True)
        chooser.reset_loading_progress()

    def _setParentRef(self, window):
        self.window = window

    def make_group(self, group_label, widget, add_widget_to_size_group=True):
        self.size_groups = getattr(self, "size_groups", [Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL) for x in range(2)])
        box = SettingsWidget()
        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.pack_start(label, False, False, 0)
        if add_widget_to_size_group:
            self.size_groups[1].add_widget(widget)
        box.pack_end(widget, False, False, 0)

        return box

    def create_button_chooser(self, settings, key, path_prefix, path_suffix, button_picture_width, menu_picture_width, num_cols, frame):
        chooser = PictureChooserButton(num_cols=num_cols, button_picture_width=button_picture_width, menu_picture_width=menu_picture_width, has_button_label=True, frame=frame)
        theme = settings.get_string(key)
        self.set_button_chooser(chooser, theme, path_prefix, path_suffix, button_picture_width)
        return chooser

    def set_button_chooser(self, chooser, theme, path_prefix, path_suffix, button_picture_width):
        self.set_button_chooser_text(chooser, theme)
        if path_suffix == "cinnamon" and theme == "cinnamon":
            chooser.set_picture_from_file("/usr/share/cinnamon/theme/thumbnail.png")
        elif path_suffix == "icons":
            current_theme = Gtk.IconTheme.get_default()
            folder = current_theme.lookup_icon_for_scale("folder", button_picture_width, self.window.get_scale_factor(), 0)
            if folder is not None:
                path = folder.get_filename()
                chooser.set_picture_from_file(path)
        else:
            try:
                for path in ([os.path.join(datadir, path_prefix, theme, path_suffix, "thumbnail.png") for datadir in GLib.get_system_data_dirs()]
                             + [os.path.expanduser("~/.%s/%s/%s/thumbnail.png" % (path_prefix, theme, path_suffix)),
                             "/usr/share/cinnamon/thumbnails/%s/%s.png" % (path_suffix, theme),
                             "/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix]):
                    if os.path.exists(path):
                        chooser.set_picture_from_file(path)
                        break
            except:
                chooser.set_picture_from_file("/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix)

    def set_button_chooser_text(self, chooser, theme):
        chooser.set_button_label(theme)
        chooser.set_tooltip_text(theme)

    def _on_icon_theme_selected(self, path, theme):
        try:
            self.settings.set_string("icon-theme", theme)
            self.set_button_chooser_text(self.icon_chooser, theme)
        except Exception as detail:
            print(detail)
        return True

    def _on_gtk_theme_selected(self, path, theme):
        try:
            self.settings.set_string("gtk-theme", theme)
            self.set_button_chooser_text(self.theme_chooser, theme)
        except Exception as detail:
            print(detail)
        return True

    def _on_cursor_theme_selected(self, path, theme):
        try:
            self.settings.set_string("cursor-theme", theme)
            self.set_button_chooser_text(self.cursor_chooser, theme)
        except Exception as detail:
            print(detail)

        self.update_cursor_theme_link(path, theme)
        return True

    def _on_cinnamon_theme_selected(self, path, theme):
        try:
            self.cinnamon_settings.set_string("name", theme)
            self.set_button_chooser_text(self.cinnamon_chooser, theme)
        except Exception as detail:
            print(detail)
        return True

    def filter_func_gtk_dir(self, directory):
        theme_dir = Path(directory)
        for gtk3_dir in theme_dir.glob("gtk-3.*"):
            # Skip gtk key themes
            if os.path.exists(os.path.join(gtk3_dir, "gtk.css")):
                return True
        return False

    def update_cursor_theme_link(self, path, name):
        contents = "[icon theme]\nInherits=%s\n" % name
        self._set_cursor_theme_at(ICON_FOLDERS[0], contents)
        self._set_cursor_theme_at(ICON_FOLDERS[1], contents)

    def _set_cursor_theme_at(self, directory, contents):
        default_dir = os.path.join(directory, "default")
        index_path = os.path.join(default_dir, "index.theme")

        try:
            os.makedirs(default_dir)
        except os.error as e:
            pass

        if os.path.exists(index_path):
            os.unlink(index_path)

        with open(index_path, "w") as f:
            f.write(contents)
