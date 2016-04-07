#!/usr/bin/env python2

from ExtensionCore import ExtensionSidePage
from gi.repository.Gtk import SizeGroup, SizeGroupMode
from SettingsWidgets import *

ICON_SIZE = 48

class Module:
    comment = _("Manage themes to change how your desktop looks")
    name = "themes"
    category = "appear"

    def __init__(self, content_box):
        self.keywords = _("themes, style")
        self.icon = "cs-themes"
        sidePage = SidePage(_("Themes"), self.icon, self.keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Themes module"
            self.settings = Gio.Settings.new("org.cinnamon.desktop.interface")
            self.wm_settings = Gio.Settings.new("org.cinnamon.desktop.wm.preferences")
            self.cinnamon_settings = Gio.Settings.new("org.cinnamon.theme")

            self.icon_chooser = self.create_button_chooser(self.settings, 'icon-theme', 'icons', 'icons', button_picture_size=ICON_SIZE, menu_pictures_size=ICON_SIZE, num_cols=4)
            self.cursor_chooser = self.create_button_chooser(self.settings, 'cursor-theme', 'icons', 'cursors', button_picture_size=32, menu_pictures_size=32, num_cols=4)
            self.theme_chooser = self.create_button_chooser(self.settings, 'gtk-theme', 'themes', 'gtk-3.0', button_picture_size=35, menu_pictures_size=35, num_cols=4)
            self.metacity_chooser = self.create_button_chooser(self.wm_settings, 'theme', 'themes', 'metacity-1', button_picture_size=32, menu_pictures_size=32, num_cols=4)
            self.cinnamon_chooser = self.create_button_chooser(self.cinnamon_settings, 'name', 'themes', 'cinnamon', button_picture_size=60, menu_pictures_size=60, num_cols=4)

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("Themes"))

            widget = self.make_group(_("Window borders"), self.metacity_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Icons"), self.icon_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Controls"), self.theme_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Mouse Pointer"), self.cursor_chooser)
            settings.add_row(widget)

            widget = self.make_group(_("Desktop"), self.cinnamon_chooser)
            center_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            button = Gtk.LinkButton()
            button.set_label(_("Add/remove desktop themes..."))
            button.connect("activate-link", self.add_remove_cinnamon_themes)
            center_box.pack_end(button, False, False, 0)
            widget.pack_start(center_box, False, False, 0)
            settings.add_row(widget)

            settings = page.add_section(_("Options"))

            widget = GSettingsSwitch(_("Show icons in menus"), "org.cinnamon.settings-daemon.plugins.xsettings", "menus-have-icons")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Show icons on buttons"), "org.cinnamon.settings-daemon.plugins.xsettings", "buttons-have-icons")
            settings.add_row(widget)

            self.builder = self.sidePage.builder

            for path in [os.path.expanduser("~/.themes"), os.path.expanduser("~/.icons")]:
                try:
                    os.makedirs(path)
                except OSError:
                    pass

            self.monitors = []
            for path in [os.path.expanduser("~/.themes"), "/usr/share/themes", os.path.expanduser("~/.icons"), "/usr/share/icons"]:
                if os.path.exists(path):
                    file_obj = Gio.File.new_for_path(path)
                    file_monitor = file_obj.monitor_directory(Gio.FileMonitorFlags.SEND_MOVED, None)
                    file_monitor.connect("changed", self.on_file_changed)
                    self.monitors.append(file_monitor)

            self.refresh()

    def on_file_changed(self, file, other, event, data):
        self.refresh()

    def refresh(self):
        choosers = []
        choosers.append((self.cursor_chooser, "cursors", self._load_cursor_themes(), self._on_cursor_theme_selected))
        choosers.append((self.theme_chooser, "gtk-3.0", self._load_gtk_themes(), self._on_gtk_theme_selected))
        choosers.append((self.metacity_chooser, "metacity-1", self._load_metacity_themes(), self._on_metacity_theme_selected))
        choosers.append((self.cinnamon_chooser, "cinnamon", self._load_cinnamon_themes(), self._on_cinnamon_theme_selected))
        choosers.append((self.icon_chooser, "icons", self._load_icon_themes(), self._on_icon_theme_selected))
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
            # thread.start_new_thread(self.refresh_chooser, (payload,))

    def refresh_chooser(self, payload):
        (chooser, path_suffix, themes, callback) = payload

        inc = 1.0
        if len(themes) > 0:
            inc = 1.0 / len(themes)

        if path_suffix == "icons":
            for theme in themes:
                icon_theme = Gtk.IconTheme()
                icon_theme.set_custom_theme(theme)
                folder = icon_theme.lookup_icon("folder", ICON_SIZE, Gtk.IconLookupFlags.FORCE_SVG)
                if folder:
                    path = folder.get_filename()
                    chooser.add_picture(path, callback, title=theme, id=theme)
                GLib.timeout_add(5, self.increment_progress, (chooser,inc))
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
        # thread.exit()

    def increment_progress(self, payload):
        (chooser, inc) = payload
        chooser.increment_loading_progress(inc)

    def hide_progress(self, chooser):
        chooser.set_sensitive(True)
        chooser.reset_loading_progress()

    def _setParentRef(self, window):
        pass

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
            folder = current_theme.lookup_icon("folder", button_picture_size, 0)
            if folder is not None:
                path = folder.get_filename()
                chooser.set_picture_from_file(path)
        else:
            try:
                for path in ["/usr/share/%s/%s/%s/thumbnail.png" % (path_prefix, theme, path_suffix),
                             os.path.expanduser("~/.%s/%s/%s/thumbnail.png" % (path_prefix, theme, path_suffix)),
                             "/usr/share/cinnamon/thumbnails/%s/%s.png" % (path_suffix, theme),
                             "/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix]:
                    if os.path.exists(path):
                        chooser.set_picture_from_file(path)
                        break
            except:
                chooser.set_picture_from_file("/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix)
        return chooser

    def add_remove_cinnamon_themes(self, widget):
        window = Gtk.Window()
        box = Gtk.VBox()
        window.add(box)
        window.set_title(_("Desktop themes"))
        window.set_default_size(640, 480)
        window.set_border_width(6)
        window.set_position(Gtk.WindowPosition.CENTER)
        page = ExtensionSidePage(self.name, self.icon, self.keywords, box, "theme", None)
        page.load(window=window)
        box.pack_start(page.vbox, True, True, 6)
        window.show_all()
        return True

    def _on_icon_theme_selected(self, path, theme):
        try:
            self.settings.set_string("icon-theme", theme)
            self.icon_chooser.set_button_label(theme)
            self.icon_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail
        return True

    def _on_metacity_theme_selected(self, path, theme):
        try:
            self.wm_settings.set_string("theme", theme)
            self.metacity_chooser.set_button_label(theme)
            self.metacity_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail
        return True

    def _on_gtk_theme_selected(self, path, theme):
        try:
            self.settings.set_string("gtk-theme", theme)
            self.theme_chooser.set_button_label(theme)
            self.theme_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail
        return True

    def _on_cursor_theme_selected(self, path, theme):
        try:
            self.settings.set_string("cursor-theme", theme)
            self.cursor_chooser.set_button_label(theme)
            self.cursor_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail
        return True

    def _on_cinnamon_theme_selected(self, path, theme):
        try:
            self.cinnamon_settings.set_string("name", theme)
            self.cinnamon_chooser.set_button_label(theme)
            self.cinnamon_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail
        return True

    def _load_gtk_themes(self):
        """ Only shows themes that have variations for gtk+-3 and gtk+-2 """
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "gtk-2.0")) and os.path.exists(os.path.join(d, "gtk-3.0")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []
        for i in valid:
            res.append((i[0], i[1]))
        return res

    def _load_icon_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and os.path.exists(os.path.join(d, "index.theme")) and \
                                 next((True for l in list(open(os.path.join(d, "index.theme"))) if l.startswith("Directories=")), False))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append(i)
        return res

    def _load_cursor_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and os.path.exists(os.path.join(d, "cursors")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []
        for i in valid:
            res.append((i[0], i[1]))
        return res

    def _load_metacity_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "metacity-1")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []
        for i in valid:
            res.append((i[0], i[1]))
        return res

    def _load_cinnamon_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "cinnamon")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []
        for i in valid:
            res.append((i[0], i[1]))
        return res
