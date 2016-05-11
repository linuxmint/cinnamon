#!/usr/bin/env python2

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, GLib, Pango
import os
import glob
import shutil

try:
    ENVIRON = os.environ['XDG_CURRENT_DESKTOP']
except:
    ENVIRON = ""
D_GROUP = "Desktop Entry"
DEFAULT_ICON = "system-run"
AUTOSTART_APPS = []

def list_header_func(row, before, user_data):
    if before and not row.get_header():
        row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

class Module:
    name = "startup"
    comment = _("Manage your startup applications")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("startup, programs, boot, init, session")
        sidePage = SidePage(_("Startup Applications"), "cs-startup-programs", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Startup Applications module"

            page = SettingsPage()
            page.expand = True
            self.sidePage.add_widget(page)

            self.ensure_user_autostart_dir()

            settings = AutostartBox(_("Startup Applications"))
            page.pack_start(settings, True, True, 0)

            self.gather_apps()

            for app in AUTOSTART_APPS:
                if app.key_file_loaded and app.shown and not app.no_display and not app.hidden:
                    row = AutostartRow(app)
                    settings.add_row(row)

    def ensure_user_autostart_dir(self):
        user_autostart_dir = os.path.join(GLib.get_user_config_dir(), "autostart")
        if not os.path.isdir(user_autostart_dir):
            try:
                os.makedirs(user_autostart_dir)
            except:
                print "Could not create autostart dir: %s" % user_autostart_dir

    def gather_apps(self):
        system_files = []

        user_files = glob.glob(os.path.join(GLib.get_user_config_dir(), "autostart", "*.desktop"))
        for app in user_files:
            AUTOSTART_APPS.append(AutostartApp(app, user_position=os.path.dirname(app)))
        
        for d in GLib.get_system_config_dirs():
            system_files.extend(glob.glob(os.path.join(d, "autostart", "*.desktop")))

        for sys_app in system_files:
            found = False
            for app in AUTOSTART_APPS:
                if os.path.basename(sys_app) == os.path.basename(app.app):
                    app.system_position = os.path.dirname(sys_app)
                    found = True
                    break

            if not found:
                AUTOSTART_APPS.append(AutostartApp(sys_app, system_position=os.path.dirname(sys_app)))

class AutostartApp():
    def __init__(self, app, user_position=None, system_position=None):
        self.app = app
        self.user_position = user_position
        self.system_position = system_position
        self.save_timeout = 0
        self.save_mask = SaveMask()
        self.key_file = GLib.KeyFile.new()
        self.path = app
        self.key_file_loaded = False
        self.basename = None

        self.load()

    def load(self):
        try:
            self.key_file.load_from_file(self.app, GLib.KeyFileFlags.KEEP_COMMENTS and GLib.KeyFileFlags.KEEP_TRANSLATIONS)
        except GLib.GError:
            print "Failed to load %s" % self.app
            return

        self.key_file_loaded = True

        self.basename = os.path.basename(self.app)
        self.dir = os.path.dirname(self.app)

        self.hidden = self.get_boolean(self.key_file, GLib.KEY_FILE_DESKTOP_KEY_HIDDEN, False)
        self.no_display = self.get_boolean(self.key_file, GLib.KEY_FILE_DESKTOP_KEY_NO_DISPLAY, False)
        self.shown = self.get_shown(self.key_file)
        self.name = self.get_locale_string(self.key_file, GLib.KEY_FILE_DESKTOP_KEY_NAME, _("Unavailable"))
        self.comment = self.get_locale_string(self.key_file, GLib.KEY_FILE_DESKTOP_KEY_COMMENT, _("No description"))
        self.delay = self.get_string(self.key_file, "X-GNOME-Autostart-Delay", "0")
        self.enabled = self.get_boolean(self.key_file, "X-GNOME-Autostart-enabled", True)
        self.command = self.get_string(self.key_file, GLib.KEY_FILE_DESKTOP_KEY_EXEC, "")
        self.icon = self.get_locale_string(self.key_file, GLib.KEY_FILE_DESKTOP_KEY_ICON, DEFAULT_ICON)

    def get_string(self, key_file, key, default_value=None):
        try:
            retval = key_file.get_string(D_GROUP, key)
        except:
            retval = default_value

        return retval

    def get_locale_string(self, key_file, key, default_value=None):
        try:
            retval = key_file.get_locale_string(D_GROUP, key, None)
        except:
            retval = default_value

        return retval

    def get_boolean(self, key_file, key, default_value):
        try:
            retval = key_file.get_boolean(D_GROUP, key)
        except:
            retval = default_value

        return retval

    def get_shown(self, key_file):
        try:
            only_show_in = key_file.get_string_list(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_ONLY_SHOW_IN)
        except:
            only_show_in = False

        if only_show_in:
            found = False
            for i in only_show_in:
                if i == ENVIRON:
                    found = True
                    break
            if not found:
                return False

        try:
            not_show_in = key_file.get_string_list(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_NOT_SHOW_IN)
        except:
            not_show_in = False

        if not_show_in:
            found = False
            for i in not_show_in:
                if i == ENVIRON:
                    found = True
                    break
            if found:
                return False

        return True

    def save_done_success(self):
        self.save_mask.clear_items()

    def save(self):
        if self.user_equals_system():
            old_app = self.app
            self.app = os.path.join(self.system_position, self.basename)
            os.remove(old_app)
            self.key_file = GLib.KeyFile.new()
            if self.key_file.load_from_file(self.app, GLib.KeyFileFlags.KEEP_COMMENTS and GLib.KeyFileFlags.KEEP_TRANSLATIONS):
                self.load()
            self.save_done_success()
            return False

        if self.system_position:
            use_path = os.path.join(self.system_position, self.basename)
        else:
            use_path = self.path

        key_file = GLib.KeyFile.new()

        try:
            key_file.load_from_file(use_path, GLib.KeyFileFlags.KEEP_COMMENTS and GLib.KeyFileFlags.KEEP_TRANSLATIONS)
        except:
            key_file.set_string(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_TYPE, "Application")
            key_file.set_string(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_EXEC, "/bin/false")

        if "enabled" in self.save_mask.contents:
            key_file.set_boolean(D_GROUP, "X-GNOME-Autostart-enabled", self.enabled)

        if "no-display" in self.save_mask.contents:
            key_file.set_boolean(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_NO_DISPLAY, self.no_display)

        if "hidden" in self.save_mask.contents:
            key_file.set_boolean(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_HIDDEN, self.hidden)

        if "name" in self.save_mask.contents:
            locale = self.get_locale()
            if locale:
                key_file.set_locale_string(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_NAME, locale, self.name)
            else:
                key_file.set_string(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_NAME, self.name)

        if "comment" in self.save_mask.contents:
            locale = self.get_locale()
            if locale:
                key_file.set_locale_string(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_COMMENT, locale, self.comment)
            else:
                key_file.set_string(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_COMMENT, self.comment)

        if "command" in self.save_mask.contents:
            key_file.set_string(D_GROUP, GLib.KEY_FILE_DESKTOP_KEY_EXEC, self.command)

        if "delay" in self.save_mask.contents:
            key_file.set_string(D_GROUP, "X-GNOME-Autostart-Delay", self.delay)

        key_file.save_to_file(self.path)
        self.app = self.path
        self.key_file = key_file
        self.save_done_success()

        return False

    def queue_save(self):
        if self.user_position == None:
            self.user_position = os.path.join(GLib.get_user_config_dir(), "autostart")
            self.path = os.path.join(self.user_position, self.basename)

        self.save()

    def update(self, info):
        changed = False
        if info["name"] != self.name:
            self.name = info["name"]
            self.save_mask.add_item("name")
            changed = True

        if info["comment"] != self.comment:
            self.comment = info["comment"]
            self.save_mask.add_item("comment")
            changed = True

        if changed:
            self.update_description()

        if info["command"] != self.command:
            self.command = info["command"]
            self.save_mask.add_item("command")
            changed = True

        if info["delay"] != self.delay:
            self.delay = info["delay"]
            self.save_mask.add_item("delay")
            changed = True

        if changed:
            self.queue_save()

    def set_enabled(self, enabled):
        self.enabled = enabled
        self.save_mask.add_item("enabled")
        self.queue_save()

    def remove(self):
        if not self.system_position and self.user_position:
            os.remove(self.app)
        else:
            self.hidden = True
            self.save_mask.add_item("hidden")
            self.enabled = False
            self.save_mask.add_item("enabled")
            self.queue_save()
        
    def update_description(self):
        if self.name == "":
            self.name = _("No name")
        if self.comment == "":
            self.comment == _("No description")

    def user_equals_system(self):
        if not self.system_position:
            return False

        path = os.path.join(self.system_position, self.basename)
        key_file = GLib.KeyFile.new()
        if not key_file.load_from_file(path, GLib.KeyFileFlags.NONE):
            return False

        if (self.get_boolean(key_file, GLib.KEY_FILE_DESKTOP_KEY_HIDDEN, False) != self.hidden or
            self.get_boolean(key_file, "X-GNOME-Autostart-enabled", True) != self.enabled or
            self.get_shown(key_file) != self.shown):
            return False
        
        if self.get_boolean(key_file, GLib.KEY_FILE_DESKTOP_KEY_NO_DISPLAY, False) != self.no_display:
            return False

        if self.get_locale_string(key_file, GLib.KEY_FILE_DESKTOP_KEY_NAME) != self.name:
            return False

        if self.get_locale_string(key_file, GLib.KEY_FILE_DESKTOP_KEY_COMMENT) != self.comment:
            return False

        if self.get_string(key_file, GLib.KEY_FILE_DESKTOP_KEY_EXEC) != self.command:
            return False

        if self.get_string(key_file, "X-GNOME-Autostart-Delay", "0") != self.delay:
            return False

        if self.get_locale_string(key_file, GLib.KEY_FILE_DESKTOP_KEY_ICON, DEFAULT_ICON) != self.icon:
            return False

        return True

    def get_locale(self):
        current_locale = None
        locales = GLib.get_language_names()
        for locale in locales:
            if locale.find(".") == -1:
                current_locale = locale
                break

        return current_locale

class SaveMask():
    def __init__(self):
        self.contents = []
        self.all = ["enabled", "no-display", "hidden", "name", "comment", "command", "delay"]

    def add_item(self, item):
        if item == "all":
            self.contents = self.all
        else:
            self.contents.append(item)

    def clear_items(self):
        for item in self.contents:
            self.contents.remove(item)

class AutostartBox(Gtk.Box):
    def __init__(self, title):
        Gtk.Box.__init__(self)
        self.set_orientation(Gtk.Orientation.VERTICAL)
        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class("view")
        self.pack_start(frame, True, True, 0)

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(main_box)

        toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(toolbar), "cs-header")
        label = Gtk.Label()
        markup = GLib.markup_escape_text(title)
        label.set_markup("<b>{}</b>".format(markup))
        title_holder = Gtk.ToolItem()
        title_holder.add(label)
        toolbar.add(title_holder)
        main_box.add(toolbar)

        toolbar_separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        main_box.add(toolbar_separator)
        separator_context = toolbar_separator.get_style_context()
        frame_color = frame_style.get_border_color(Gtk.StateFlags.NORMAL).to_string()
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data(".separator { -GtkWidget-wide-separators: 0; \
                                                   color: %s;                    \
                                                }" % frame_color)
        separator_context.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        scw = Gtk.ScrolledWindow()
        scw.expand = True
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scw.set_shadow_type(Gtk.ShadowType.NONE)
        main_box.pack_start(scw, True, True, 0)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        scw.add(self.box)

        self.list_box = Gtk.ListBox()
        self.list_box.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.list_box.set_activate_on_single_click(False)
        self.list_box.set_sort_func(self.sort_apps, None)
        self.list_box.set_header_func(list_header_func, None)
        self.list_box.connect("row-selected", self.on_row_selected)
        self.list_box.connect("row-activated", self.on_row_activated)
        self.box.add(self.list_box)

        button_toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(button_toolbar), "inline-toolbar")
        self.add(button_toolbar)

        button_holder = Gtk.ToolItem()
        button_holder.set_expand(True)
        button_toolbar.add(button_holder)
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        button_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        box.set_halign(Gtk.Align.CENTER)
        button_holder.add(box)

        self.add_button = Gtk.Button.new_with_label(_("Add"))
        self.add_button.connect("clicked", self.on_add_button_clicked)
        button_group.add_widget(self.add_button)
        box.add(self.add_button)

        self.edit_button = Gtk.Button.new_with_label(_("Edit"))
        self.edit_button.connect("clicked", self.on_edit_button_clicked)
        button_group.add_widget(self.edit_button)
        self.edit_button.set_sensitive(False)
        box.add(self.edit_button)

        self.remove_button = Gtk.Button.new_with_label(_("Remove"))
        self.remove_button.connect("clicked", self.on_remove_button_clicked)
        button_group.add_widget(self.remove_button)
        self.remove_button.set_sensitive(False)
        box.add(self.remove_button)

    def add_row(self, row):
        self.list_box.add(row)

    def sort_apps(self, a, b, user_data):
        aname = a.app.name.lower()
        bname = b.app.name.lower()

        if aname < bname:
            return -1
        elif aname > bname:
            return 1
        else:
            return 0

    def on_row_selected(self, list_box, row):
        self.edit_button.set_sensitive(True)
        self.remove_button.set_sensitive(True)

    def on_row_activated(self, list_box, row):
        self.on_edit_button_clicked(list_box)

    def on_remove_button_clicked(self, button):
        row = self.list_box.get_selected_row()
        app = row.app
        app.remove()
        self.list_box.remove(row)
        self.edit_button.set_sensitive(False)
        self.remove_button.set_sensitive(False)

    def on_add_button_clicked(self, button):
        popup = Gtk.Menu()
        popup.attach_to_widget(button, None)

        custom_option = Gtk.MenuItem(_("Custom command"))
        popup.append(custom_option)
        custom_option.connect("activate", self.on_add_custom)
        custom_option.show()

        app_chooser_option = Gtk.MenuItem(_("Choose application"))
        popup.append(app_chooser_option)
        app_chooser_option.connect("activate", self.on_add_app)
        app_chooser_option.show()

        popup.popup(None, None, self.popup_menu_below_button, button, 0, 0)

    def on_edit_button_clicked(self, button):
        row = self.list_box.get_selected_row()
        app = row.app

        edit_dialog = AppDialog(app)
        edit_dialog.set_transient_for(button.get_toplevel())
        edit_dialog.show_all()
        info = edit_dialog.run_dialog()
        if info["done"]:
            app.update(info)
            row.update()

    def on_add_custom(self, popup):
        new_dialog = AppDialog()
        new_dialog.set_transient_for(self.list_box.get_toplevel())
        new_dialog.show_all()
        info = new_dialog.run_dialog()
        if info["done"]:
            filename = self.find_free_basename(info["name"])
            if filename is None:
                return

            app = AutostartApp(filename, user_position=os.path.dirname(filename))
            
            app.basename = os.path.basename(app.app)
            app.dir = os.path.basename(app.app)
            app.hidden = False
            app.no_display = False
            app.enabled = True
            app.shown = True

            app.name = info["name"]
            app.command = info["command"]
            app.delay = info["delay"]
            app.comment = info["comment"]
            app.icon = None

            app.update_description()

            app.save_mask.add_item("all")

            app.queue_save()

            row = AutostartRow(app)
            self.add_row(row)
            row.show_all()

    def on_add_app(self, popup):
        app_dialog = AppChooserDialog()
        app_dialog.set_transient_for(self.list_box.get_toplevel())
        app_dialog.show_all()

        response = app_dialog.run()
        if response == Gtk.ResponseType.OK:
            selected_app = app_dialog.get_selected_app()
            desktop_file_dir = selected_app.get_filename()
            desktop_file_name = self.find_free_basename(os.path.basename(desktop_file_dir))
            if desktop_file_name is None:
                return
            user_autostart_dir = os.path.join(GLib.get_user_config_dir(), "autostart")
            user_desktop_file = os.path.join(user_autostart_dir, desktop_file_name)
            try:
                shutil.copyfile(desktop_file_dir, user_desktop_file)
            except IOError:
                print "Failed to copy desktop file %s" % desktop_file_name

            app = AutostartApp(user_desktop_file, user_position=os.path.dirname(user_desktop_file))

            app.enabled = True

            app.save_mask.add_item("all")

            app.queue_save()

            row = AutostartRow(app)
            self.add_row(row)
            row.show_all()

        app_dialog.destroy()

    def find_free_basename(self, suggested_name):
        if suggested_name.endswith(".desktop"):
            basename_no_ext = suggested_name[:len(suggested_name) - len(".desktop")]
            base_path = os.path.join(GLib.get_user_config_dir(), "autostart", basename_no_ext)
        else:
            base_path = os.path.join(GLib.get_user_config_dir(), "autostart", suggested_name)

        filename = "%s.desktop" % base_path
        basename = os.path.basename(filename)

        i = 1
        max_tries = 100
        while (self.find_app_with_basename(basename) is not None and
               i < max_tries):
            filename = "%s-%d.desktop" % (base_path, i)
            basename = os.path.basename(filename)
            i += 1

        if i == max_tries:
            return None

        return filename

    def find_app_with_basename(self, basename):
        for app in AUTOSTART_APPS:
            if basename == app.basename:
                return app

        return None

    def popup_menu_below_button (self, *args):
        # the introspection for GtkMenuPositionFunc seems to change with each Gtk version,
        # this is a workaround to make sure we get the menu and the widget
        menu = args[0]
        widget = args[-1]
        window = widget.get_window()

        unused_var, window_x, window_y = window.get_origin()
        wrect = widget.get_allocation()
        mrect = menu.get_allocation()

        x = (window_x + wrect.x + (wrect.width / 2)) - (mrect.width / 2)
        y = window_y + wrect.y + wrect.height

        push_in = True
        return (x, y, push_in)

class AutostartRow(Gtk.ListBoxRow):
    def __init__(self, app):
        Gtk.ListBoxRow.__init__(self)
        self.app = app

        widget = SettingsWidget()
        grid = Gtk.Grid()
        grid.set_column_spacing(15)
        widget.pack_start(grid, True, True, 0)

        screen = Gdk.Screen.get_default()
        icon_theme = Gtk.IconTheme.get_for_screen(screen)

        if self.app.icon:
            try:
                if GLib.path_is_absolute(self.app.icon):
                    shown_icon = GdkPixbuf.Pixbuf.new_from_file_at_scale(self.app.icon, 24, 24, True)
                    img = Gtk.Image.new_from_pixbuf(shown_icon)
                else:
                    pixbuf = icon_theme.load_icon(self.app.icon, 24, Gtk.IconLookupFlags.FORCE_SIZE)
                    img = Gtk.Image.new_from_pixbuf(pixbuf)
            except:
                img = Gtk.Image.new_from_gicon(Gio.ThemedIcon.new(DEFAULT_ICON), Gtk.IconSize.LARGE_TOOLBAR) 
        else:
            img = Gtk.Image.new_from_gicon(Gio.ThemedIcon.new(DEFAULT_ICON), Gtk.IconSize.LARGE_TOOLBAR)
        grid.attach(img, 0, 0, 1, 1)    

        self.desc_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.desc_box.props.hexpand = True
        self.desc_box.props.halign = Gtk.Align.START
        self.name_label = Gtk.Label()
        name_markup = GLib.markup_escape_text(self.app.name)
        self.name_label.set_markup("<b>{}</b>".format(name_markup))
        self.name_label.props.xalign = 0.0
        self.desc_box.add(self.name_label)
        self.comment_label = Gtk.Label()
        comment_markup = GLib.markup_escape_text(self.app.comment)
        self.comment_label.set_markup("<small>{}</small>".format(comment_markup))
        self.comment_label.props.xalign = 0.0
        self.comment_label.set_ellipsize(Pango.EllipsizeMode.END)
        self.comment_label.set_max_width_chars(40)
        self.desc_box.add(self.comment_label)
        grid.attach_next_to(self.desc_box, img, Gtk.PositionType.RIGHT, 1, 1)
        self.desc_box.set_sensitive(app.enabled)

        self.delay_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.delay_box.props.hexpand = False
        self.delay_box.set_margin_right(15)
        label = Gtk.Label(_("Delay"))
        self.delay_box.pack_start(label, False, False, 0)
        self.delay_time_label = Gtk.Label()
        delay_time_markup = GLib.markup_escape_text(self.app.delay)
        self.delay_time_label.set_markup(delay_time_markup)
        self.delay_time_label.get_style_context().add_class("dim-label")
        self.delay_box.pack_start(self.delay_time_label, False, False, 0)
        grid.attach_next_to(self.delay_box, self.desc_box, Gtk.PositionType.RIGHT, 1, 1)
        self.delay_box.set_sensitive(app.enabled)

        switch_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        switch_box.set_margin_top(5)
        switch_box.set_margin_bottom(5)
        switch = Gtk.Switch()
        switch.set_active(self.app.enabled)
        switch.connect("notify::active", self.on_switch_activated)
        switch_box.add(switch)
        grid.attach_next_to(switch_box, self.delay_box, Gtk.PositionType.RIGHT, 1, 1)

        self.add(widget)

    def update(self):
        name_markup = GLib.markup_escape_text(self.app.name)
        comment_markup = GLib.markup_escape_text(self.app.comment)
        delay_time_markup = GLib.markup_escape_text(self.app.delay)

        self.name_label.set_markup("<b>{}</b>".format(name_markup))
        self.comment_label.set_markup("<small>{}</small>".format(comment_markup))
        self.delay_time_label.set_markup(delay_time_markup)

    def on_switch_activated(self, switch, gparam):
        active = switch.get_active()
        if active == self.app.enabled:
            return

        if active:
            self.app.set_enabled(True)
            self.desc_box.set_sensitive(True)
            self.delay_box.set_sensitive(True)
        else:
            self.app.set_enabled(False)
            self.desc_box.set_sensitive(False)
            self.delay_box.set_sensitive(False)

class AppDialog(Gtk.Dialog):
    def __init__(self, app=None):
        super(AppDialog, self).__init__()
        self.app = app
        self.set_modal(True)

        self.add_button(_("Cancel"), Gtk.ResponseType.CANCEL)

        if not app:
            self.set_title(_("Add Startup Program"))
            self.add_button(_("Add"), Gtk.ResponseType.OK)
        else:
            self.set_title(_("Edit Startup Program"))
            self.add_button(_("Save"), Gtk.ResponseType.OK)

        self.set_default_response(Gtk.ResponseType.OK)

        content_area = self.get_content_area()
        content_area.set_border_width(6)

        grid = Gtk.Grid()
        grid.set_column_spacing(12)
        grid.set_row_spacing(6)
        grid.set_border_width(6)

        content_area.add(grid)

        label = Gtk.Label(_("Name"))
        label.props.xalign = 0.0
        grid.attach(label, 0, 0, 1, 1)
        self.name_entry = Gtk.Entry()
        self.name_entry.props.hexpand = True
        if self.app:
            self.name_entry.set_text(self.app.name)
        self.name_entry.connect("activate", self.on_entry_activated)
        grid.attach(self.name_entry, 1, 0, 2, 1)

        label = Gtk.Label(_("Command"))
        label.props.xalign = 0.0
        grid.attach(label, 0, 1, 1, 1)
        box = Gtk.Box(Gtk.Orientation.HORIZONTAL)
        grid.attach(box, 1, 1, 2, 1)
        self.command_entry = Gtk.Entry()
        self.command_entry.props.hexpand = True
        self.command_entry.set_margin_right(12)
        if self.app:
            self.command_entry.set_text(self.app.command)
        self.command_entry.connect("activate", self.on_entry_activated)
        box.pack_start(self.command_entry, True, True, 0)

        browse_button = Gtk.Button.new_with_label(_("Browse..."))
        browse_button.props.hexpand = False
        browse_button.connect("clicked", self.on_browse_button_clicked)
        box.pack_end(browse_button, False, False, 0)

        label = Gtk.Label(_("Comment"))
        label.props.xalign = 0.0
        grid.attach(label, 0, 2, 1, 1)
        self.comment_entry = Gtk.Entry()
        self.comment_entry.props.hexpand = True
        if self.app:
            self.comment_entry.set_text(self.app.comment)
        self.comment_entry.connect("activate", self.on_entry_activated)
        grid.attach(self.comment_entry, 1, 2, 2, 1)

        label = Gtk.Label(_("Startup delay"))
        label.props.xalign = 0.0
        grid.attach(label, 0, 3, 1, 1)
        box = Gtk.Box(Gtk.Orientation.HORIZONTAL)
        grid.attach(box, 1, 3, 1, 1)
        self.spin = Gtk.SpinButton.new_with_range(0, 100, 1)
        if self.app:
            self.spin.set_value(int(self.app.delay))
        self.spin.connect("activate", self.on_entry_activated)
        box.pack_start(self.spin, False, False, 0)

    def run_dialog(self):
        retval = {"done": False}
        error_msg = None

        while self.run() == Gtk.ResponseType.OK:
            name = self.name_entry.get_text()
            command = self.command_entry.get_text()
            comment = self.comment_entry.get_text()
            delay = str(int(self.spin.get_value()))
            error_msg = None

            if command == "" or command.isspace():
                error_msg = _("The startup command cannot be empty")
            else:
                try:
                    success, argv = GLib.shell_parse_argv(command)
                except GLib.GError as e:
                    if e:
                        error_msg = e.message
                    else:
                        error_msg = _("The startup command is not valid")

            if error_msg is not None:
                msg_box = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                                            Gtk.ButtonsType.CANCEL,
                                            "%s" % error_msg)
                error_msg = None
                msg_box.run()
                msg_box.destroy()
                continue

            if name == "" or name.isspace():
                retval["name"] = argv[0]
            else:
                retval["name"] = name

            retval["command"] = command
            retval["comment"] = comment
            retval["delay"] = delay
            retval["done"] = True

            break

        self.destroy()

        return retval

    def on_entry_activated(self, widget):
        self.response(Gtk.ResponseType.OK)

    def on_browse_button_clicked(self, button):
        chooser = Gtk.FileChooserDialog(_("Select Command"),
                                        self,
                                        Gtk.FileChooserAction.OPEN,
                                        (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                         Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT))

        response = chooser.run()

        if response == Gtk.ResponseType.ACCEPT:
            name = chooser.get_filename()
            self.command_entry.set_text(name)

        chooser.destroy()

class AppChooserDialog(Gtk.Dialog):
    def __init__(self):
        Gtk.Dialog.__init__(self, title=_("Applications"))

        self.all = {}

        self.entry = Gtk.SearchEntry()
        self.entry.set_placeholder_text(_("Search Applications..."))
        self.entry.set_width_chars(30)

        self.search_bar = Gtk.SearchBar()
        self.search_bar.add(self.entry)
        self.search_bar.props.hexpand = True

        list_box = Gtk.ListBox()
        list_box.set_sort_func(self.sort_apps, None)
        list_box.set_header_func(list_header_func, None)
        list_box.set_filter_func(self.list_filter_func, None)
        self.entry.connect("search-changed", lambda e: list_box.invalidate_filter())

        apps = Gio.app_info_get_all()
        for a in apps:
            if a.should_show():
                widget = self.build_widget(a)
                if widget:
                    self.all[widget] = a
                    list_box.add(widget)

        frame = Gtk.Frame()
        frame.set_border_width(6)
        frame.set_shadow_type(Gtk.ShadowType.IN)
        sw = Gtk.ScrolledWindow()
        sw.props.hscrollbar_policy = Gtk.PolicyType.NEVER
        sw.get_style_context().add_class("view")
        sw.props.vexpand = True
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(box)
        box.add(self.search_bar)
        box.add(sw)
        sw.add(list_box)

        self.add_button(_("_Close"), Gtk.ResponseType.CLOSE)
        self.add_button(_("Add Application"), Gtk.ResponseType.OK)
        self.set_default_response(Gtk.ResponseType.OK)

        self.get_content_area().set_border_width(6)
        self.get_content_area().pack_start(frame, True, True, 0)
        self.set_modal(True)
        self.set_size_request(400,300)

        self.list_box = list_box

        self.connect("key-press-event", self.on_key_press)

    def sort_apps(self, a, b, user_data):
        aname = self.all.get(a).get_name()
        bname = self.all.get(b).get_name()

        if aname < bname:
            return -1
        elif aname > bname:
            return 1
        else:
            return 0

    def build_widget(self, a):
        row = Gtk.ListBoxRow()
        grid = Gtk.Grid()
        grid.set_column_spacing(10)
        if not a.get_name():
            return None

        screen = Gdk.Screen.get_default()
        icon_theme = Gtk.IconTheme.get_for_screen(screen)

        icon = a.get_icon()
        if icon:
            try:
                if GLib.path_is_absolute(icon.to_string()):
                    iconfile = icon.to_string()
                    shown_icon = GdkPixbuf.Pixbuf.new_from_file_at_scale(iconfile, 24, 24, True)
                    img = Gtk.Image.new_from_pixbuf(shown_icon)
                else:
                    pixbuf = icon_theme.load_icon(icon.to_string(), 24, Gtk.IconLookupFlags.FORCE_SIZE)
                    img = Gtk.Image.new_from_pixbuf(pixbuf)
            except:
                img = Gtk.Image.new_from_gicon(Gio.ThemedIcon.new(DEFAULT_ICON), Gtk.IconSize.LARGE_TOOLBAR)
        else:
            img = Gtk.Image.new_from_gicon(Gio.ThemedIcon.new(DEFAULT_ICON), Gtk.IconSize.LARGE_TOOLBAR)
        grid.attach(img, 0, 0, 1, 1)
        img.props.hexpand = False

        label = Gtk.Label(label=a.get_name(), xalign=0)
        grid.attach_next_to(label, img, Gtk.PositionType.RIGHT, 1, 1)
        label.props.hexpand = True
        label.props.halign = Gtk.Align.START
        label.props.vexpand = False
        label.props.valign = Gtk.Align.CENTER

        row.add(grid)

        return row

    def list_filter_func(self, row, unused):
        text = self.entry.get_text().lower()
        grid = row.get_child()
        for child in grid.get_children():
            if type(child) == Gtk.Label:
                if text in child.get_text().lower():
                    return True
                return False
        return False

    def on_key_press(self, widget, event):
        key_name = Gdk.keyval_name(event.keyval)
        if key_name == "Escape":
            if self.entry.is_focus():
                self.search_bar.set_search_mode(False)
                return True
            elif self.search_bar.get_search_mode():
                self.entry.grab_focus()
                return True
        elif key_name not in ["Escape", "Up", "Down"]:
            if not self.entry.is_focus() and self.search_bar.get_search_mode():
                if self.entry.im_context_filter_keypress(event):
                    self.entry.grab_focus()
                    l = self.entry.get_text_length()
                    self.entry.select_region(l, l)
                    return True
            return self.search_bar.handle_event(event)

        return False

    def get_selected_app(self):
        row = self.list_box.get_selected_row()
        if row:
            return self.all.get(row)
        return None
