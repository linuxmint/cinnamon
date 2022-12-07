#!/usr/bin/python3

import sys
import os
import gettext
import glob
from optparse import OptionParser
import shutil
import subprocess
from setproctitle import setproctitle

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("CMenu", "3.0")
from gi.repository import GLib, Gtk, Gio, CMenu

sys.path.insert(0, '/usr/share/cinnamon/cinnamon-menu-editor')
from cme import util

sys.path.insert(0, '/usr/share/cinnamon/cinnamon-settings/bin')
import JsonSettingsWidgets

# i18n
gettext.install("cinnamon", "/usr/share/locale")
# i18n for menu item

#_ = gettext.gettext # bug !!! _ is already defined by gettext.install!
home = os.path.expanduser("~")
PANEL_LAUNCHER_PATH = os.path.join(GLib.get_user_data_dir(), "cinnamon", "panel-launchers")
OLD_PANEL_LAUNCHER_PATH = os.path.join(home, ".cinnamon", "panel-launchers")

EXTENSIONS = (".png", ".xpm", ".svg")

DEFAULT_ICON_NAME = "cinnamon-panel-launcher"

def escape_space(string):
    return string.replace(" ", "\ ")


def ask(msg):
    dialog = Gtk.MessageDialog(None,
                               Gtk.DialogFlags.DESTROY_WITH_PARENT | Gtk.DialogFlags.MODAL,
                               Gtk.MessageType.QUESTION,
                               Gtk.ButtonsType.YES_NO,
                               None)
    dialog.set_markup(msg)
    dialog.show_all()
    response = dialog.run()
    dialog.destroy()
    return response == Gtk.ResponseType.YES


DESKTOP_GROUP = GLib.KEY_FILE_DESKTOP_GROUP


class ItemEditor(object):
    ui_file = None

    def __init__(self, item_path=None, callback=None, destdir=None):
        self.builder = Gtk.Builder()
        self.builder.set_translation_domain('cinnamon') # let it translate!
        self.builder.add_from_file(self.ui_file)
        self.callback = callback
        self.destdir = destdir
        self.dialog = self.builder.get_object('editor')

        self.dialog.connect('response', self.on_response)

        self.icon_chooser = self.builder.get_object('icon-chooser')
        self.icon_chooser.get_dialog().set_property("allow-paths", True)

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
            self.builder.get_object('name-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-ok')
            self.builder.get_object('name-entry').set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY,
                                                                        _("Valid name"))
        else:
            self.builder.get_object('name-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'process-stop')
            self.builder.get_object('name-entry').set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY,
                                                                        _("The name cannot be empty."))

        if exec_valid:
            self.builder.get_object('exec-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-ok')
            self.builder.get_object('exec-entry').set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY,
                                                                        _("Valid executable"))
        else:
            self.builder.get_object('exec-entry').set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'process-stop')
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

    def set_icon(self, name):
        try:
            val = self.keyfile.get_string(DESKTOP_GROUP, name)
        except GLib.GError:
            pass
        else:
            print(val)
            self.icon_chooser.set_icon(val)
            print('icon:', self.icon_chooser.get_icon())

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

            subprocess.Popen(['update-desktop-database', util.getUserItemPath()], env=os.environ)
        except IOError as e:
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
        self.builder.get_object('exec-browse').connect('clicked', self.pick_exec)

        self.builder.get_object('name-entry').connect('changed', self.resync_validity)
        self.builder.get_object('exec-entry').connect('changed', self.resync_validity)

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        exec_text = self.builder.get_object('exec-entry').get_text().strip()
        name_valid = name_text != ""
        exec_valid = self.validate_exec_line(exec_text)
        self.sync_widgets(name_valid, exec_valid)

    def load(self):
        super(LauncherEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('exec-entry', "Exec")
        self.set_text('comment-entry', "Comment")
        self.set_check('terminal-check', "Terminal")
        self.set_icon("Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Exec=self.builder.get_object('exec-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Terminal=self.builder.get_object('terminal-check').get_active(),
                    Icon=self.icon_chooser.get_icon(),
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
        if self.item_path:
            self.item_path = os.path.join(util.getUserItemPath(), os.path.split(self.item_path)[1])

class DirectoryEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/directory-editor.ui'

    def build_ui(self):
        self.builder.get_object('name-entry').connect('changed', self.resync_validity)

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        valid = (name_text != "")
        self.builder.get_object('ok').set_sensitive(valid)

    def load(self):
        super(DirectoryEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('comment-entry', "Comment")
        self.set_icon("Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Icon=self.icon_chooser.get_icon(),
                    Type="Directory")

    def check_custom_path(self):
        self.item_path = os.path.join(util.getUserDirectoryPath(), os.path.split(self.item_path)[1])

class CinnamonLauncherEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/launcher-editor.ui'

    def build_ui(self):
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
                old_name = os.path.join(OLD_PANEL_LAUNCHER_PATH, 'cinnamon-custom-launcher-' + str(i) + '.desktop')
                file = Gio.file_parse_name(name)
                old_file = Gio.file_parse_name(old_name)
                if not file.query_exists(None) and not old_file.query_exists(None):
                    break
                i += 1
            self.item_path = name

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        exec_text = self.builder.get_object('exec-entry').get_text().strip()
        name_valid = name_text != ""
        exec_valid = self.validate_exec_line(exec_text)
        self.sync_widgets(name_valid, exec_valid)

    def load(self):
        super(CinnamonLauncherEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('exec-entry', "Exec")
        self.set_text('comment-entry', "Comment")
        self.set_check('terminal-check', "Terminal")
        self.set_icon("Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Exec=self.builder.get_object('exec-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Terminal=self.builder.get_object('terminal-check').get_active(),
                    Icon=self.icon_chooser.get_icon(),
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
        if options.mode == "cinnamon-launcher" and len(args) < 1:
            parser.error("cinnamon-launcher mode must have the following syntax:\n"
                         "cinnamon-desktop-editor -mcinnamon-launcher [-ffoo.desktop] <json-path>")

        self.tree = CMenu.Tree.new("cinnamon-applications.menu", CMenu.TreeFlags.INCLUDE_NODISPLAY)
        if not self.tree.load_sync():
            raise ValueError("can not load menu tree")

        self.mode = options.mode
        self.orig_file = options.original_desktop_file
        self.desktop_file = options.desktop_file
        self.dest_dir = options.destination_directory

        if options.mode == "cinnamon-launcher":
            self.json_path = args[0]

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
            print("Invalid args")

    def directory_cb(self, success, dest_path):
        self.end()

    def launcher_cb(self, success, dest_path):
        self.end()

    def panel_launcher_cb(self, success, dest_path):
        if success:
            settings = JsonSettingsWidgets.JSONSettingsHandler(self.json_path)
            launchers = settings.get_value("launcherList")
            if self.desktop_file is None:
                launchers.append(os.path.split(dest_path)[1])
            else:
                i = launchers.index(self.desktop_file)
                if i >= 0:
                    del launchers[i]
                    launchers.insert(i, os.path.split(dest_path)[1])
            settings.save_settings()
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
            old_panel_launchers = glob.glob(os.path.join(OLD_PANEL_LAUNCHER_PATH, "*.desktop"))
            for launcher in (panel_launchers + old_panel_launchers):
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
    setproctitle("cinnamon-desktop-editor")
    Gtk.Window.set_default_icon_name(DEFAULT_ICON_NAME)
    Main()
    Gtk.main()
