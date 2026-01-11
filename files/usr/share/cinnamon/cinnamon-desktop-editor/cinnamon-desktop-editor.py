#!/usr/bin/python3

import sys
import os
import gettext
import glob
from optparse import OptionParser
import shutil
import subprocess
from setproctitle import setproctitle
from pathlib import Path
import xml.etree.ElementTree as ET

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("CMenu", "3.0")
from gi.repository import GLib, Gtk, Gio, CMenu

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
    return string.replace(" ", r"\ ")

def ask(msg):
    dialog = Gtk.MessageDialog(
        transient_for=None,
        modal=True,
        destroy_with_parent=True,
        message_type=Gtk.MessageType.QUESTION,
        buttons=Gtk.ButtonsType.YES_NO,
    )
    dialog.set_markup(msg)

    response = dialog.run()
    dialog.destroy()
    return response == Gtk.ResponseType.YES


DESKTOP_GROUP = GLib.KEY_FILE_DESKTOP_GROUP
KEY_FILE_FLAGS = GLib.KeyFileFlags.KEEP_COMMENTS | GLib.KeyFileFlags.KEEP_TRANSLATIONS


def getUserItemPath():
    item_dir = os.path.join(GLib.get_user_data_dir(), 'applications')
    if not os.path.isdir(item_dir):
        os.makedirs(item_dir)
    return item_dir

def getUserDirectoryPath():
    menu_dir = os.path.join(GLib.get_user_data_dir(), 'desktop-directories')
    if not os.path.isdir(menu_dir):
        os.makedirs(menu_dir)
    return menu_dir

def is_system_launcher(filename):
    for path in GLib.get_system_data_dirs():
        if os.path.exists(os.path.join(path, "applications", filename)):
            return True
    return False

def is_system_directory(filename):
    for path in GLib.get_system_data_dirs():
        if os.path.exists(os.path.join(path, "desktop-directories", filename)):
            return True
    return False

# from cs_startup.py
def get_locale():
    current_locale = None
    locales = GLib.get_language_names()
    for locale in locales:
        if locale.find(".") == -1:
            current_locale = locale
            break
    return current_locale

def fillKeyFile(keyfile, items):
    LOCALIZABLE_KEYS = ("Name", "GenericName", "Comment", "Keywords")
    locale = get_locale()

    for key, item in items.items():
        if item is None:
            continue

        if isinstance(item, bool):
            keyfile.set_boolean(DESKTOP_GROUP, key, item)
        elif isinstance(item, str):
            keyfile.set_string(DESKTOP_GROUP, key, item)
            if key in LOCALIZABLE_KEYS and locale:
                keyfile.set_locale_string(DESKTOP_GROUP, key, locale, item)
        elif isinstance(item, list):
            keyfile.set_string_list(DESKTOP_GROUP, key, item)
            if key in LOCALIZABLE_KEYS and locale:
                keyfile.set_locale_string_list(DESKTOP_GROUP, key, locale, item)


class ItemEditor(object):
    ui_file = None

    def __init__(self, item_path=None, callback=None, destdir=None, icon_size=24):
        self.builder = Gtk.Builder()
        self.builder.set_translation_domain('cinnamon') # let it translate!
        self.builder.add_from_file(self.ui_file)
        self.callback = callback
        self.destdir = destdir
        self.dialog = self.builder.get_object('editor')

        self.dialog.connect('response', self.on_response)

        self.starting_icon = None
        self.icon_chooser = self.builder.get_object('icon-chooser')
        self.icon_chooser.get_dialog().set_property("allow-paths", True)

        self.icon_size = icon_size
        self.icon_chooser.set_icon_size(self.get_gtk_size_for_pixels(icon_size))

        self.build_ui()

        self.item_path = item_path
        self.load()
        self.check_custom_path()
        self.resync_validity()

    def get_gtk_size_for_pixels(self, icon_size):
        i = 0
        while True:
            try:
                valid, width, height = Gtk.IconSize.lookup(Gtk.IconSize(i))
                if height > icon_size:
                    return Gtk.IconSize(i)
            except ValueError:
                return Gtk.IconSize.DIALOG

            i += 1

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

    def pick_exec(self, button):
        chooser = Gtk.FileChooserDialog(
            title=_("Choose a command"),
            parent=self.dialog,
            action=Gtk.FileChooserAction.OPEN
        )
        chooser.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.REJECT,
            Gtk.STOCK_OK, Gtk.ResponseType.ACCEPT
        )
        response = chooser.run()

        if response == Gtk.ResponseType.ACCEPT:
            self.builder.get_object('exec-entry').set_text(escape_space(chooser.get_filename()))
        chooser.destroy()

    def set_text(self, ctl, name):
        try:
            val = self.keyfile.get_locale_string(DESKTOP_GROUP, name, None)
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
            self.icon_chooser.set_icon(val)
            self.starting_icon = val

    def load(self):
        self.keyfile = GLib.KeyFile()
        path = self.item_path or ""
        try:
            self.keyfile.load_from_file(path, KEY_FILE_FLAGS)
        except GLib.GError:
            pass

    def save(self):
        fillKeyFile(self.keyfile, self.get_keyfile_edits())
        contents, length = self.keyfile.to_data()
        
        try:
            with open(self.item_path, 'w') as f:
                f.write(contents)
            
        except IOError as e:
            print("Error writing file:", e)

    def run(self):
        self.dialog.present()

    def on_response(self, dialog, response):
        if response == Gtk.ResponseType.OK:
            self.save()
            self.callback(True, self.item_path)
        else:
            self.callback(False, self.item_path)

class NemoLauncherEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/launcher-editor.ui'

    def build_ui(self):
        self.builder.get_object('exec-browse').connect('clicked', self.pick_exec)
        self.builder.get_object('name-entry').connect('changed', self.resync_validity)
        self.builder.get_object('exec-entry').connect('changed', self.resync_validity)

        # Hide LauncherEditor widgets not relevant to NemoLauncherEditor
        self.builder.get_object('nodisplay-check').set_visible(False)
        self.builder.get_object('nodisplay-check').set_no_show_all(True)
        self.builder.get_object('category-section').set_visible(False)
        self.builder.get_object('category-section').set_no_show_all(True)

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        exec_text = self.builder.get_object('exec-entry').get_text().strip()
        name_valid = name_text != ""
        exec_valid = self.validate_exec_line(exec_text)
        self.sync_widgets(name_valid, exec_valid)


    def load(self):
        super(NemoLauncherEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('exec-entry', "Exec")
        self.set_text('comment-entry', "Comment")
        self.set_check('terminal-check', "Terminal")
        self.set_check('offload-gpu-check', "PrefersNonDefaultGPU")
        self.set_icon("Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Exec=self.builder.get_object('exec-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Terminal=self.builder.get_object('terminal-check').get_active(),
                    PrefersNonDefaultGPU=self.builder.get_object("offload-gpu-check").get_active(),
                    Icon=self.icon_chooser.get_icon(),
                    Type="Application")

    def check_custom_path(self):
        if self.item_path:
            self.item_path = os.path.join(getUserItemPath(), os.path.split(self.item_path)[1])

    def save(self):
        fillKeyFile(self.keyfile, self.get_keyfile_edits())
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

            subprocess.Popen(['update-desktop-database', getUserItemPath()], env=os.environ)
        except IOError as e:
            if ask(_("Cannot create the launcher at this location.  Add to the desktop instead?")):
                self.destdir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)
                self.save()

class LauncherEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/launcher-editor.ui'

    def __init__(self, item_path=None, callback=None, destdir=None, icon_size=24, show_categories=False):
        self.show_categories = show_categories
        super(LauncherEditor, self).__init__(item_path, callback, destdir, icon_size)

    def build_ui(self):
        self.builder.get_object('exec-browse').connect('clicked', self.pick_exec)
        self.builder.get_object('name-entry').connect('changed', self.resync_validity)
        self.builder.get_object('exec-entry').connect('changed', self.resync_validity)

        if self.show_categories:
            self.category_widgets = {} # Map ID -> CheckButton
            self._setup_categories_list()
            self.fdo_categories = []
        else:
            cat_section = self.builder.get_object('category-section')
            cat_section.set_visible(False)
            cat_section.set_no_show_all(True)

    def resync_validity(self, *args):
        name_text = self.builder.get_object('name-entry').get_text().strip()
        exec_text = self.builder.get_object('exec-entry').get_text().strip()
        name_valid = name_text != ""
        exec_valid = self.validate_exec_line(exec_text)
        self.sync_widgets(name_valid, exec_valid)

    def _setup_categories_list(self):
        flowbox = self.builder.get_object('category-flowbox')
        DONT_SHOWS = ["Other"]

        tree = CMenu.Tree.new("cinnamon-applications.menu", CMenu.TreeFlags.INCLUDE_NODISPLAY | CMenu.TreeFlags.SHOW_EMPTY)
        if tree.load_sync():
            root = tree.get_root_directory()
            it = root.iter()
            while True:
                item_type = it.next()
                if item_type == CMenu.TreeItemType.INVALID:
                    break
                if item_type == CMenu.TreeItemType.DIRECTORY:
                    dir_item = it.get_directory()
                    name = dir_item.get_name()
                    cat_id = dir_item.get_menu_id()
                    if cat_id and cat_id not in DONT_SHOWS:
                        cb = Gtk.CheckButton(label=name)
                        cb.set_visible(True)
                        flowbox.add(cb)
                        self.category_widgets[cat_id] = cb

    def load(self):
        super(LauncherEditor, self).load()
        self.set_text('name-entry', "Name")
        self.set_text('exec-entry', "Exec")
        self.set_text('comment-entry', "Comment")
        self.set_check('terminal-check', "Terminal")
        self.set_check('offload-gpu-check', "PrefersNonDefaultGPU")
        self.set_check('nodisplay-check', "NoDisplay")
        self.set_icon("Icon")

        if self.show_categories:
            # Preselect existing categories
            try:
                flowbox = self.builder.get_object('category-flowbox')
                self.fdo_categories = self.keyfile.get_string_list(DESKTOP_GROUP, "Categories")
                cinnamon_categories = self._fdo_to_cinnamon(self.fdo_categories)
                for cat_id in cinnamon_categories:
                    if cat_id in self.category_widgets:
                        self.category_widgets[cat_id].set_active(True)
            except GLib.GError:
                pass
        else:
            try:
                self.old_categories = self.keyfile.get_locale_string(DESKTOP_GROUP, "Categories", None)
            except GLib.GError:
                self.old_categories = ""

    def get_keyfile_edits(self):
        if self.show_categories:
            self.fdo_categories = self._cinnamon_to_fdo(self.fdo_categories)
            categories_val = ";".join(self.fdo_categories)
            if categories_val:
                categories_val += ";"
        else:
            categories_val = self.old_categories

        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Exec=self.builder.get_object('exec-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Terminal=self.builder.get_object('terminal-check').get_active(),
                    PrefersNonDefaultGPU=self.builder.get_object("offload-gpu-check").get_active(),
                    NoDisplay=self.builder.get_object("nodisplay-check").get_active(),
                    Categories=categories_val,
                    Icon=self.icon_chooser.get_icon(),
                    Type="Application")

    def check_custom_path(self):
        # If item_path is a system file, we create an override in user item path, otherwise
        # we edit it directly (including items in subdirectories of user path e.g. wine apps)
        file_name = os.path.basename(self.item_path)
        if is_system_launcher(file_name):
            self.item_path = os.path.join(getUserItemPath(), file_name)
        else:
            # If launcher appears to be from a user installed app (e.g. steam, wine) rather
            # than a user created custom launcher, we show a warning that 'restore' is not available.
            if not file_name.startswith("alacarte-"):
                self.builder.get_object('restore-info-bar').show()

    def _fdo_to_cinnamon(self, fdo_cats):
        # These conversions are based on /etc/xdg/menus/cinnamon-applications.menu
        cats = list(fdo_cats)

        mappings = {
            "Game": "Games",
            "Network": "Internet",
            "AudioVideo": "Multimedia",
            "Wine": "wine-wine"
        }
        for fdo, cinn in mappings.items():
            if fdo in cats:
                cats.append(cinn)

        if "Utility" in cats and "Accessibility" not in cats and "System" not in cats:
            cats.append("Accessories")
            
        if "Accessibility" in cats and "Settings" not in cats:
            cats.append("Universal Access")
            
        if "Settings" in cats and "System" not in cats:
            cats.append("Preferences")

        if "System" in cats:
            cats.append("Administration")

        return cats

    def _cinnamon_to_fdo(self, fdo_cats):
        # These conversions are based on /etc/xdg/menus/cinnamon-applications.menu
        mappings = {
            "Accessories": "Utility",
            "Games": "Game",
            "Internet": "Network",
            "Multimedia": "AudioVideo",
            "Universal Access": "Accessibility",
            "wine-wine": "Wine",
            "Preferences": "Settings",
            "Administration": "System"
        }

        for cinn_cat, button in self.category_widgets.items():
            fdo_cat = mappings.get(cinn_cat, cinn_cat)
            if button.get_active():
                if fdo_cat not in fdo_cats:
                    fdo_cats.append(fdo_cat)
            else:
                if fdo_cat in fdo_cats:
                    fdo_cats.remove(fdo_cat)

        if self.category_widgets["Accessories"].get_active():
            if "System" in fdo_cats:
                fdo_cats.remove("System")
            if "Accessibility" in fdo_cats:
                fdo_cats.remove("Accessibility")

        if self.category_widgets["Education"].get_active() and "Science" in fdo_cats:
            fdo_cats.remove("Science")

        if self.category_widgets["Preferences"].get_active(): 
            if "System" in fdo_cats:
                fdo_cats.remove("System")

        return fdo_cats

    def _clear_menu_overrides(self):
        """Removes <Include> and <Exclude> rules for this item from the menu XML."""
        if not self.item_path:
            return

        desktop_id = os.path.basename(self.item_path)
        menu_path = os.path.join(GLib.get_user_config_dir(), "menus", "cinnamon-applications.menu")
        
        if not os.path.exists(menu_path):
            return

        try:
            tree = ET.parse(menu_path)
            root = tree.getroot()
            modified = False

            for parent in root.iter():
                for node in list(parent):
                    if node.tag in ('Include', 'Exclude'):
                        for filename_node in list(node.findall('Filename')):
                            if filename_node.text == desktop_id:
                                node.remove(filename_node)
                                modified = True
                        
                        if len(node) == 0:
                            parent.remove(node)
                            modified = True
            
            if modified:
                tree.write(menu_path, encoding='utf-8', xml_declaration=True)

        except Exception as e:
            print(f"Could not clean menu overrides: {e}")

    def save(self):
        super(LauncherEditor, self).save()
        subprocess.Popen(['update-desktop-database', getUserItemPath()], env=os.environ)
        self._clear_menu_overrides()

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
        self.set_check('nodisplay-check', "NoDisplay")
        self.set_icon("Icon")

    def get_keyfile_edits(self):
        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    NoDisplay=self.builder.get_object('nodisplay-check').get_active(),
                    Icon=self.icon_chooser.get_icon(),
                    Type="Directory")

    def check_custom_path(self):
        # If item_path is a system file, we create an override in user's
        # desktop-directories path, otherwise we edit it directly.
        file_name = os.path.basename(self.item_path)
        if is_system_directory(file_name):
            self.item_path = os.path.join(getUserDirectoryPath(), file_name)
        else:
            # If directory appears to be from a user installed app (e.g. wine) rather
            # than a user created custom launcher, we show a warning that 'restore' is not available.
            if not file_name.startswith("alacarte-"):
                self.builder.get_object('restore-info-bar').show()

class CinnamonLauncherEditor(ItemEditor):
    ui_file = '/usr/share/cinnamon/cinnamon-desktop-editor/launcher-editor.ui'

    def build_ui(self):
        self.builder.get_object('exec-browse').connect('clicked', self.pick_exec)

        self.builder.get_object('name-entry').connect('changed', self.resync_validity)
        self.builder.get_object('exec-entry').connect('changed', self.resync_validity)

        self.builder.get_object('nodisplay-check').set_visible(False)
        self.builder.get_object('nodisplay-check').set_no_show_all(True)
        self.builder.get_object('category-section').set_visible(False)
        self.builder.get_object('category-section').set_no_show_all(True)

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
        self.set_check('offload-gpu-check', "PrefersNonDefaultGPU")
        self.set_icon("Icon")

    def get_keyfile_edits(self):
        icon_theme = Gtk.IconTheme.get_default()
        icon = self.icon_chooser.get_icon()

        if icon != self.starting_icon:
            info = icon_theme.lookup_icon(icon, self.icon_size, 0)
            if info:
                filename = info.get_filename()
                if not self.in_hicolor(filename):
                    icon = filename

        return dict(Name=self.builder.get_object('name-entry').get_text(),
                    Exec=self.builder.get_object('exec-entry').get_text(),
                    Comment=self.builder.get_object('comment-entry').get_text(),
                    Terminal=self.builder.get_object('terminal-check').get_active(),
                    PrefersNonDefaultGPU=self.builder.get_object("offload-gpu-check").get_active(),
                    Icon=icon,
                    Type="Application")

    def in_hicolor(self, path):
        datadirs = GLib.get_system_data_dirs()

        for datadir in datadirs:
            hicolor_folder = Path(os.path.join(datadir, "icons", "hicolor"))
            icon_path = Path(path)
            try:
                if icon_path.relative_to(hicolor_folder) is not None:
                    return True
            except ValueError:
                pass

        return False

class Main:
    def __init__(self):
        parser = OptionParser()
        parser.add_option("-o", "--original", dest="original_desktop_file", help="Path of original .desktop file", metavar="ORIG_FILE")
        parser.add_option("-d", "--directory", dest="destination_directory", help="Destination directory of the new launcher", metavar="DEST_DIR")
        parser.add_option("-f", "--file", dest="desktop_file", help="Name of desktop file (i.e. gnome-terminal.desktop)", metavar="DESKTOP_NAME")
        parser.add_option("-m", "--mode", dest="mode", default=None, help="Mode to run in: launcher, directory, panel-launcher or nemo-launcher")
        parser.add_option("-i", "--icon-size", dest="icon_size", type=int, default=24, help="Size to set the icon picker for (panel-launcher only)")
        parser.add_option("--show-categories", action="store_true", dest="show_categories", default=False, help="Show the category selection section (launcher mode only)")
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
        self.show_categories = options.show_categories

        if options.mode == "cinnamon-launcher":
            self.json_path = args[0]
            self.icon_size = options.icon_size

        if self.desktop_file is not None:
            self.get_desktop_path()

        if self.mode == "directory":
            editor = DirectoryEditor(self.orig_file, self.directory_cb)
            editor.dialog.show_all()
        elif self.mode == "launcher":
            editor = LauncherEditor(self.orig_file, self.launcher_cb, show_categories=self.show_categories)
            editor.dialog.show_all()
        elif self.mode == "cinnamon-launcher":
            editor = CinnamonLauncherEditor(self.orig_file, self.panel_launcher_cb, icon_size=self.icon_size)
            editor.dialog.show_all()
        elif self.mode == "nemo-launcher":
            editor = NemoLauncherEditor(self.orig_file, self.nemo_launcher_cb, self.dest_dir)
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
            new_file_path = os.path.join(getUserItemPath(), os.path.split(dest_path)[1])
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
