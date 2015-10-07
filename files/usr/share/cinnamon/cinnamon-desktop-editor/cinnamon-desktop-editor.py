#!/usr/bin/env python2

import sys
import os
import gettext
import glob
from gi.repository import GLib, Gtk, Gio, CMenu, GdkPixbuf
from optparse import OptionParser
import shutil

sys.path.insert(0,'/usr/share/cinnamon/cinnamon-menu-editor')
from cme import util

sys.path.insert(0,'/usr/share/cinnamon/cinnamon-settings')
from bin import XletSettingsWidgets

# i18n
gettext.install("cinnamon", "/usr/share/locale")
# i18n for menu item

_ = gettext.gettext
home = os.path.expanduser("~")
PANEL_LAUNCHER_PATH = os.path.join(home, ".cinnamon", "panel-launchers")

EXTENSIONS = (".png", ".xpm", ".svg")

def escape_space(string):
    return string.replace(" ", "\ ")

def try_icon_name(filename):
    # Detect if the user picked an icon, and make
    # it into an icon name.
    if not filename.endswith(EXTENSIONS):
        return filename

    noext_filename = filename[:-4]

    theme = Gtk.IconTheme.get_default()
    resolved_path = None
    for path in theme.get_search_path():
        if noext_filename.startswith(path):
            resolved_path = noext_filename[len(path):].lstrip(os.sep)
            break

    if resolved_path is None:
        return filename

    parts = resolved_path.split(os.sep)
    # icon-theme/size/category/icon
    if len(parts) != 4:
        return filename

    return parts[3]

def get_icon_string(image):
    filename = image._file
    if filename is not None:
        return try_icon_name(filename)

    return image._icon_name

def strip_extensions(icon):
    if icon.endswith(EXTENSIONS):
        return icon[:-4]
    else:
        return icon

def set_icon_string(image, icon):
    if GLib.path_is_absolute(icon):
        image._file = icon
        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(icon, 64, 64)
        if pixbuf is not None:
            image.set_from_pixbuf(pixbuf)
    else:
        image._icon_name = strip_extensions(icon)
        image.set_from_icon_name (strip_extensions (icon), Gtk.IconSize.BUTTON)

def ask(msg):
    dialog = Gtk.MessageDialog(None,
                               Gtk.DialogFlags.DESTROY_WITH_PARENT,
                               Gtk.MessageType.QUESTION,
                               Gtk.ButtonsType.YES_NO,
                               None)
    dialog.set_default_size(400, 200)
    dialog.set_markup(msg)
    dialog.show_all()
    response = dialog.run()
    dialog.destroy()
    return response == Gtk.ResponseType.YES


DESKTOP_GROUP = GLib.KEY_FILE_DESKTOP_GROUP

class IconPicker(object):
    def __init__(self, dialog, button, image):
        self.dialog = dialog
        self.button = button
        self.button.connect('clicked', self.pick_icon)
        self.image = image

    def pick_icon(self, button):
        chooser = Gtk.FileChooserDialog(title=_("Choose an icon"),
                                        parent=self.dialog,
                                        buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.REJECT,
                                        Gtk.STOCK_OK, Gtk.ResponseType.ACCEPT))
        chooser.add_shortcut_folder("/usr/share/pixmaps")
        chooser.add_shortcut_folder("/usr/share/icons")
        fn = get_icon_string(self.image)
        if fn:
            if GLib.path_is_absolute(fn):
                chooser.set_filename(fn)
            else:
                theme = Gtk.IconTheme.get_default()
                icon_info = theme.lookup_icon(fn, 64, 0)
                icon_info_fn = icon_info.get_filename() if icon_info != None else None
                if icon_info_fn:
                    chooser.set_filename(icon_info_fn)
        filter = Gtk.FileFilter();
        filter.add_pixbuf_formats ();
        chooser.set_filter(filter);

        preview = Gtk.Image()
        chooser.set_preview_widget(preview)
        chooser.connect("update-preview", self.update_icon_preview_cb, preview)

        response = chooser.run()
        if response == Gtk.ResponseType.ACCEPT:
            set_icon_string (self.image, chooser.get_filename())
        chooser.destroy()

    def update_icon_preview_cb(self, chooser, preview):
        filename = chooser.get_preview_filename()
        if filename is None:
            return
        chooser.set_preview_widget_active(False)
        if os.path.isfile(filename):
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, 128, 128)
            if pixbuf is not None:
                preview.set_from_pixbuf(pixbuf)
                chooser.set_preview_widget_active(True)

class ItemEditor(object):
    ui_file = None

    def __init__(self, item_path = None, callback = None, destdir = None):
        self.builder = Gtk.Builder()
        self.builder.add_from_file(self.ui_file)
        self.callback = callback
        self.destdir = destdir
        self.dialog = self.builder.get_object('editor')

        self.dialog.connect('response', self.on_response)

        icon = self.builder.get_object('icon-image')
        icon._file = None
        icon._icon_name = None

        self.build_ui()

        self.item_path = item_path
        self.load()
        self.check_custom_path()
        self.resync_validity()

    def build_ui(self):
        raise NotImplementedError()

    def check_custom_path(self):
        raise NotImplementedError()

    def sync_widgets(self, name_valid, exec_valid):
        if name_valid:
            self.builder.get_object('name-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'ok')
            self.builder.get_object('name-entry').set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY,
                                                                        _("Valid name"))
        else:
            self.builder.get_object('name-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'stop')
            self.builder.get_object('name-entry').set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY,
                                                                        _("The name cannot be empty."))

        if exec_valid:
            self.builder.get_object('exec-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'ok')
            self.builder.get_object('exec-entry').set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY,
                                                                        _("Valid executable"))
        else:
            self.builder.get_object('exec-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'stop')
            self.builder.get_object('exec-entry').set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY,
                                                                        _("The executable is not valid. It cannot be empty and spaces in the path must be escaped with backslash (\\)."))

        self.builder.get_object('ok').set_sensitive(name_valid and exec_valid)

    def validate_exec_line(self, string):
        try:
            success, parsed = GLib.shell_parse_argv(string)
            if GLib.find_program_in_path(parsed[0]) or ((not os.path.isdir(parsed[0])) and os.access(parsed[0], os.X_OK)):
                return True
        except:
            pass
        return False

    def get_keyfile_edits(self):
        raise NotImplementedError()

    def set_text(self, ctl, name):
        try:
            val = self.keyfile.get_string(DESKTOP_GROUP, name)
        except GLib.GError:
            pass
        else:
            self.builder.get_object(ctl).set_text(val)

    def set_check(self, ctl, name):
        try:
            val = self.keyfile.get_boolean(DESKTOP_GROUP, name)
        except GLib.GError:
            pass
        else:
            self.builder.get_object(ctl).set_active(val)

    def set_icon(self, ctl, name):
        try:
            val = self.keyfile.get_string(DESKTOP_GROUP, name)
        except GLib.GError:
            pass
        else:
            set_icon_string(self.builder.get_object(ctl), val)

    def load(self):
        self.keyfile = GLib.KeyFile()
        path = self.item_path or ""
        try:
            self.keyfile.load_from_file(path, util.KEY_FILE_FLAGS)
        except GLib.GError:
            pass

    def save(self):
        util.fillKeyFile(self.keyfile, self.get_keyfile_edits())
        contents, length = self.keyfile.to_data()
        need_exec = False
        if self.destdir is not None:
            self.item_path = os.path.join(self.destdir, self.builder.get_object('name-entry').get_text() + ".desktop")
            need_exec = True

        try:
            with open(self.item_path, 'w') as f:
                f.write(contents)
            if need_exec:
                os.chmod(self.item_path, 0o755)
        except IOError:
            if ask(_("Cannot create the launcher at this location.  Add to the desktop instead?")):
                self.destdir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)
                self.save()

    def run(self):
        self.dialog.present()

    def on_response(self, dialog, response):
        if response == Gtk.ResponseType.OK:
            self.save()
            self.callback(True, self.item_path)
        else:
            self.callback(False, self.item_path)
        self.dialog.destroy()

class LauncherEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/launcher-editor.ui'

    def build_ui(self):
        self.icon_picker = IconPicker(self.dialog,
                                      self.builder.get_object('icon-button'),
                                      self.builder.get_object('icon-image'))

        self.builder.get_object('exec-browse').connect('clicked', self.pick_exec)

        self.builder.get_object('name-entry').connect('changed', self.resync_validity)
        self.builder.get_object('exec-entry').connect('changed', self.resync_validity)

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        exec_text = self.builder.get_object('exec-entry').get_text().strip()
        name_valid = name_text is not ""
        exec_valid = self.validate_exec_line(exec_text)
        self.sync_widgets(name_valid, exec_valid)

    def load(self):
        super(LauncherEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('exec-entry', "Exec")
        self.set_text('comment-entry', "Comment")
        self.set_check('terminal-check', "Terminal")
        self.set_icon('icon-image', "Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Exec=self.builder.get_object('exec-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Terminal=self.builder.get_object('terminal-check').get_active(),
                    Icon=get_icon_string(self.builder.get_object('icon-image')),
                    Type="Application")

    def pick_exec(self, button):
        chooser = Gtk.FileChooserDialog(title=_("Choose a command"),
                                        parent=self.dialog,
                                        buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.REJECT,
                                        Gtk.STOCK_OK, Gtk.ResponseType.ACCEPT))
        response = chooser.run()
        if response == Gtk.ResponseType.ACCEPT:
            self.builder.get_object('exec-entry').set_text(escape_space(chooser.get_filename()))
        chooser.destroy()

    def check_custom_path(self):
        pass


class DirectoryEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/directory-editor.ui'

    def build_ui(self):
        self.icon_picker = IconPicker(self.dialog,
                                      self.builder.get_object('icon-button'),
                                      self.builder.get_object('icon-image'))

        self.builder.get_object('name-entry').connect('changed', self.resync_validity)

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        valid = (name_text is not "")
        self.builder.get_object('ok').set_sensitive(valid)

    def load(self):
        super(DirectoryEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('comment-entry', "Comment")
        self.set_icon('icon-image', "Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Icon=get_icon_string(self.builder.get_object('icon-image')),
                    Type="Directory")

    def check_custom_path(self):
        pass


class CinnamonLauncherEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/launcher-editor.ui'

    def build_ui(self):
        self.icon_picker = IconPicker(self.dialog,
                                      self.builder.get_object('icon-button'),
                                      self.builder.get_object('icon-image'))

        self.builder.get_object('exec-browse').connect('clicked', self.pick_exec)

        self.builder.get_object('name-entry').connect('changed', self.resync_validity)
        self.builder.get_object('exec-entry').connect('changed', self.resync_validity)

    def check_custom_path(self):
        dir = Gio.file_new_for_path(PANEL_LAUNCHER_PATH)
        if not dir.query_exists(None):
            dir.make_directory_with_parents(None)

        if self.item_path is None or "cinnamon-custom-launcher" not in self.item_path:
            i = 1
            while True:
                name = os.path.join(PANEL_LAUNCHER_PATH, 'cinnamon-custom-launcher-' + str(i) + '.desktop')
                file = Gio.file_parse_name(name)
                if not file.query_exists(None):
                    break
                i += 1
            self.item_path = name

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        exec_text = self.builder.get_object('exec-entry').get_text().strip()
        name_valid = name_text is not ""
        exec_valid = self.validate_exec_line(exec_text)
        self.sync_widgets(name_valid, exec_valid)

    def load(self):
        super(CinnamonLauncherEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('exec-entry', "Exec")
        self.set_text('comment-entry', "Comment")
        self.set_check('terminal-check', "Terminal")
        self.set_icon('icon-image', "Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Exec=self.builder.get_object('exec-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Terminal=self.builder.get_object('terminal-check').get_active(),
                    Icon=get_icon_string(self.builder.get_object('icon-image')),
                    Type="Application")

    def pick_exec(self, button):
        chooser = Gtk.FileChooserDialog(title=_("Choose a command"),
                                        parent=self.dialog,
                                        buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.REJECT,
                                        Gtk.STOCK_OK, Gtk.ResponseType.ACCEPT))
        response = chooser.run()
        if response == Gtk.ResponseType.ACCEPT:
            self.builder.get_object('exec-entry').set_text(escape_space(chooser.get_filename()))
        chooser.destroy()

class Main:
    def __init__(self):
        parser = OptionParser()
        parser.add_option("-o", "--original", dest="original_desktop_file", help="Path of original .desktop file", metavar="ORIG_FILE")
        parser.add_option("-d", "--directory", dest="destination_directory", help="Destination directory of the new launcher", metavar="DEST_DIR")
        parser.add_option("-f", "--file", dest="desktop_file", help="Name of desktop file (i.e. gnome-terminal.desktop)", metavar="DESKTOP_NAME")
        parser.add_option("-m", "--mode", dest="mode", default=None, help="Mode to run in: launcher, directory, panel-launcher or nemo-launcher")
        (options, args) = parser.parse_args()

        if not options.mode:
            parser.error("You must select a mode to run in")
        if options.mode in ("directory", "launcher") and not options.original_desktop_file:
            parser.error("directory and launcher modes must be accompanied by the -o argument")
        if options.mode == "nemo-launcher" and not options.destination_directory:
            parser.error("nemo-launcher mode must be accompanied by the -d argument")
        if options.mode == "cinnamon-launcher" and len(args) < 3:
            parser.error("cinnamon-launcher mode must have the following syntax:\n\
                         cinnamon-desktop-editor -mcinnamon-launcher [-ffoo.desktop] <uuid> <instance-id> <json-path>")

        self.tree = CMenu.Tree.new("cinnamon-applications.menu", CMenu.TreeFlags.INCLUDE_NODISPLAY)
        if not self.tree.load_sync():
            raise ValueError("can not load menu tree")

        self.mode = options.mode
        self.orig_file = options.original_desktop_file
        self.desktop_file = options.desktop_file
        self.dest_dir = options.destination_directory

        if options.mode == "cinnamon-launcher":
            self.uuid = args[0]
            self.iid = args[1]
            self.json_path = args[2]

        if self.desktop_file is not None:
            self.get_desktop_path()

        if self.mode == "directory":
            editor = DirectoryEditor(self.orig_file, self.directory_cb)
            editor.dialog.show_all()
        elif self.mode == "launcher":
            editor = LauncherEditor(self.orig_file, self.launcher_cb)
            editor.dialog.show_all()
        elif self.mode == "cinnamon-launcher":
            editor = CinnamonLauncherEditor(self.orig_file, self.panel_launcher_cb)
            editor.dialog.show_all()
        elif self.mode == "nemo-launcher":
            editor = LauncherEditor(self.orig_file, self.nemo_launcher_cb, self.dest_dir)
            editor.dialog.show_all()
        else:
            print "Invalid args"

    def directory_cb(self, success, dest_path):
        self.end()

    def launcher_cb(self, success, dest_path):
        self.end()

    def panel_launcher_cb(self, success, dest_path):
        if success:
            factory = XletSettingsWidgets.Factory(self.json_path, self.iid, False, self.uuid)

            launchers = factory.settings.get_value("launcherList")
            if self.desktop_file is None:
                launchers.append(os.path.split(dest_path)[1])
            else:
                i = launchers.index(self.desktop_file)
                if i >= 0:
                    del launchers[i]
                    launchers.insert(i, os.path.split(dest_path)[1])
            factory.settings.set_value("launcherList", launchers)
            if self.desktop_file is None:
                self.ask_menu_launcher(dest_path)
        self.end()

    def nemo_launcher_cb(self, success, dest_path):
        if success:
            self.ask_menu_launcher(dest_path)
        self.end()

    def ask_menu_launcher(self, dest_path):
        if ask(_("Would you like to add this launcher to the menu also?  It will be placed in the Other category initially.")):
            new_file_path = os.path.join(util.getUserItemPath(), os.path.split(dest_path)[1])
            shutil.copy(dest_path, new_file_path)

    def get_desktop_path(self):
        self.search_menu_sys()
        if self.orig_file is None:
            panel_launchers = glob.glob(os.path.join(PANEL_LAUNCHER_PATH, "*.desktop"))
            for launcher in panel_launchers:
                if os.path.split(launcher)[1] == self.desktop_file:
                    self.orig_file = launcher

    def search_menu_sys(self, parent=None):
        if parent is None:
            parent = self.tree.get_root_directory()

        item_iter = parent.iter()
        item_type = item_iter.next()
        while item_type != CMenu.TreeItemType.INVALID:
            if item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
                self.search_menu_sys(item)
            elif item_type == CMenu.TreeItemType.ENTRY:
                item = item_iter.get_entry()
                if item.get_desktop_file_id() == self.desktop_file:
                    self.orig_file = item.get_desktop_file_path()
            item_type = item_iter.next()

    def end(self):
        Gtk.main_quit()

if __name__ == "__main__":
    Gtk.Window.set_default_icon_name('gnome-panel-launcher')
    Main()
    Gtk.main()
