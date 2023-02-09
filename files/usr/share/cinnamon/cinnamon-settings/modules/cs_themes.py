#!/usr/bin/python3

import os

from gi.repository import Gtk

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
    os.path.join(GLib.get_user_data_dir(), "icons"),
    os.path.join(GLib.get_home_dir(), ".icons")
] + [os.path.join(datadir, "icons") for datadir in GLib.get_system_data_dirs()]

THEME_FOLDERS = [
    os.path.join(GLib.get_user_data_dir(), "themes"),
    os.path.join(GLib.get_home_dir(), ".themes")
] + [os.path.join(datadir, "themes") for datadir in GLib.get_system_data_dirs()]

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

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Themes module")

            self.spices = Spice_Harvester('theme', self.window)

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            self.settings = Gio.Settings.new("org.cinnamon.desktop.interface")
            self.cinnamon_settings = Gio.Settings.new("org.cinnamon.theme")

            self.scale = self.window.get_scale_factor()

            self.icon_chooser = self.create_button_chooser(self.settings, 'icon-theme', 'icons', 'icons', button_picture_size=ICON_SIZE, menu_pictures_size=ICON_SIZE, num_cols=4)
            self.cursor_chooser = self.create_button_chooser(self.settings, 'cursor-theme', 'icons', 'cursors', button_picture_size=32, menu_pictures_size=32, num_cols=4)
            self.theme_chooser = self.create_button_chooser(self.settings, 'gtk-theme', 'themes', 'gtk-3.0', button_picture_size=35, menu_pictures_size=35, num_cols=4)
            self.cinnamon_chooser = self.create_button_chooser(self.cinnamon_settings, 'name', 'themes', 'cinnamon', button_picture_size=60, menu_pictures_size=60*self.scale, num_cols=4)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "themes", _("Themes"))

            settings = page.add_section(_("Themes"))

            widget = self.make_group(_("Mouse Pointer"), self.cursor_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Applications"), self.theme_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Icons"), self.icon_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Desktop"), self.cinnamon_chooser)
            settings.add_row(widget)

            page = DownloadSpicesPage(self, 'theme', self.spices, self.window)
            self.sidePage.stack.add_titled(page, 'download', _("Add/Remove"))

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "options", _("Settings"))

            settings = page.add_section(_("Miscellaneous options"))

            widget = GSettingsSwitch(_("Show icons in menus"), "org.cinnamon.settings-daemon.plugins.xsettings", "menus-have-icons")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Show icons on buttons"), "org.cinnamon.settings-daemon.plugins.xsettings", "buttons-have-icons")
            settings.add_row(widget)

            try:
                import tinycss2
            except:
                self.refresh()
                return

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
"""Changes will take effect the next time you log in and may not affect all applications."""))
            settings.add_row(label_widget)

            self.builder = self.sidePage.builder

            for path in [THEME_FOLDERS[0], ICON_FOLDERS[0]]:
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

            self.refresh()

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
        GLib.timeout_add_seconds(5, self.refresh)

    def refresh(self):
        choosers = [(self.cursor_chooser, "cursors", self._load_cursor_themes(), self._on_cursor_theme_selected),
                    (self.theme_chooser, "gtk-3.0", self._load_gtk_themes(), self._on_gtk_theme_selected),
                    (self.cinnamon_chooser, "cinnamon", self._load_cinnamon_themes(), self._on_cinnamon_theme_selected),
                    (self.icon_chooser, "icons", self._load_icon_themes(), self._on_icon_theme_selected)]
        for chooser in choosers:
            chooser[0].clear_menu()
            chooser[0].set_sensitive(False)
            chooser[0].progress = 0.0

            chooser_obj = chooser[0]
            path_suffix = chooser[1]
            themes = chooser[2]
            callback = chooser[3]
            payload = (chooser_obj, path_suffix, themes, callback)
            self.refresh_chooser(payload)
        self.refreshing = False

    def refresh_chooser(self, payload):
        (chooser, path_suffix, themes, callback) = payload

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

    def create_button_chooser(self, settings, key, path_prefix, path_suffix, button_picture_size, menu_pictures_size, num_cols):
        chooser = PictureChooserButton(num_cols=num_cols, button_picture_size=button_picture_size, menu_pictures_size=menu_pictures_size, has_button_label=True)
        theme = settings.get_string(key)
        chooser.set_button_label(theme)
        chooser.set_tooltip_text(theme)
        if path_suffix == "cinnamon" and theme == "cinnamon":
            chooser.set_picture_from_file("/usr/share/cinnamon/theme/thumbnail.png")
        elif path_suffix == "icons":
            current_theme = Gtk.IconTheme.get_default()
            folder = current_theme.lookup_icon_for_scale("folder", button_picture_size, self.window.get_scale_factor(), 0)
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
        return chooser

    def _on_icon_theme_selected(self, path, theme):
        try:
            self.settings.set_string("icon-theme", theme)
            self.icon_chooser.set_button_label(theme)
            self.icon_chooser.set_tooltip_text(theme)
        except Exception as detail:
            print(detail)
        return True

    def _on_gtk_theme_selected(self, path, theme):
        try:
            self.settings.set_string("gtk-theme", theme)
            self.theme_chooser.set_button_label(theme)
            self.theme_chooser.set_tooltip_text(theme)
        except Exception as detail:
            print(detail)
        return True

    def _on_cursor_theme_selected(self, path, theme):
        try:
            self.settings.set_string("cursor-theme", theme)
            self.cursor_chooser.set_button_label(theme)
            self.cursor_chooser.set_tooltip_text(theme)
        except Exception as detail:
            print(detail)

        self.update_cursor_theme_link(path, theme)
        return True

    def _on_cinnamon_theme_selected(self, path, theme):
        try:
            self.cinnamon_settings.set_string("name", theme)
            self.cinnamon_chooser.set_button_label(theme)
            self.cinnamon_chooser.set_tooltip_text(theme)
        except Exception as detail:
            print(detail)
        return True

    def get_theme_sort_key(self, name):
        name = name.lower()
        legacy = 0
        darker = 0
        dark = 0
        if "legacy" in name:
            legacy = 1
        if "darker" in name:
            darker = 1
        if "dark" in name and "darker" not in name:
            dark = 1
        name = name.replace("darker", "").replace("dark", "").replace("legacy", "")
        name = f"{legacy}{dark}{darker}{name}"
        return name

    def _load_gtk_themes(self):
        """ Only shows themes that have variations for gtk+-3 and gtk+-2 """
        dirs = THEME_FOLDERS
        valid = walk_directories(dirs, self.filter_func_gtk_dir, return_directories=True)
        valid.sort(key=lambda a: self.get_theme_sort_key(a[0]))
        res = []
        for i in valid:
            for j in res:
                if i[0] == j[0]:
                    if i[1] == dirs[0]:
                        continue
                    else:
                        res.remove(j)
            res.append((i[0], i[1]))
        return res

    def filter_func_gtk_dir(self, directory):
        theme_dir = Path(directory)

        for gtk3_dir in theme_dir.glob("gtk-3.*"):
            # Skip gtk key themes
            if os.path.exists(os.path.join(gtk3_dir, "gtk.css")):
                return True
        return False

    def _load_icon_themes(self):
        dirs = ICON_FOLDERS
        walked = walk_directories(dirs, lambda d: os.path.isdir(d), return_directories=True)
        valid = []
        for directory in walked:
            if directory[0] in ("gnome", "hicolor"):
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

        valid.sort(key=lambda a: self.get_theme_sort_key(a[0]))
        res = []
        for i in valid:
            for j in res:
                if i[0] == j:
                    if i[1] == dirs[0]:
                        continue
                    else:
                        res.remove(j)
            res.append(i[0])
        return res

    def _load_cursor_themes(self):
        dirs = ICON_FOLDERS
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and os.path.exists(os.path.join(d, "cursors")), return_directories=True)
        valid.sort(key=lambda a: a[0].lower())
        res = []
        for i in valid:
            for j in res:
                if i[0] == j[0]:
                    if i[1] == dirs[0]:
                        continue
                    else:
                        res.remove(j)
            res.append((i[0], i[1]))
        return res

    def _load_cinnamon_themes(self):
        dirs = THEME_FOLDERS
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "cinnamon")), return_directories=True)
        valid.sort(key=lambda a: self.get_theme_sort_key(a[0]))
        res = []
        for i in valid:
            for j in res:
                if i[0] == j[0]:
                    if i[1] == dirs[0]:
                        continue
                    else:
                        res.remove(j)
            res.append((i[0], i[1]))
        return res

    def update_cursor_theme_link(self, path, name):
        default_dir = os.path.join(ICON_FOLDERS[0], "default")
        index_path = os.path.join(default_dir, "index.theme")

        try:
            os.makedirs(default_dir)
        except os.error as e:
            pass

        if os.path.exists(index_path):
            os.unlink(index_path)

        contents = "[icon theme]\nInherits=%s\n" % name

        with open(index_path, "w") as f:
            f.write(contents)
