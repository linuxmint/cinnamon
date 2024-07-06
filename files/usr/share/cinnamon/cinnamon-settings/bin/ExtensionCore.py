#!/usr/bin/python3

from functools import lru_cache
import os
import re
import html
import subprocess
import gettext
from html.parser import HTMLParser
from html import entities
import locale

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, Gdk, GdkPixbuf, GLib

from xapp.SettingsWidgets import SettingsPage, SettingsWidget, SettingsLabel
from Spices import ThreadedTaskManager

home = os.path.expanduser('~')

SHOW_ALL = 0
SHOW_ACTIVE = 1
SHOW_INACTIVE = 2

SETTING_TYPE_NONE = 0
SETTING_TYPE_INTERNAL = 1
SETTING_TYPE_EXTERNAL = 2

ROW_SIZE = 32

UNSAFE_ITEMS = ['spawn_sync', 'spawn_command_line_sync', 'GTop', 'get_file_contents_utf8_sync']

LANGUAGE_CODE = LONG_LANGUAGE_CODE = "C"
try:
    LONG_LANGUAGE_CODE = locale.getlocale()[0]
    LANGUAGE_CODE = locale.getlocale()[0].split("_")[0]
except:
    pass


@lru_cache(maxsize=None)  # fetch only once
def get_cinnamon_version():
    version_str = subprocess.check_output(['cinnamon', '--version'], encoding="utf-8").split()[1]
    return [int(part) for part in version_str.split(".")]


def find_extension_subdir(directory):
    largest = [0]
    curr_a = get_cinnamon_version()

    for subdir in os.listdir(directory):
        if not os.path.isdir(os.path.join(directory, subdir)):
            continue

        if not re.match(r'^[1-9][0-9]*\.[0-9]+(\.[0-9]+)?$', subdir):
            continue

        subdir_a = [int(part) for part in subdir.split(".")]

        if largest < subdir_a <= curr_a:
            largest = subdir_a

    if largest == [0]:
        return directory
    return os.path.join(directory, ".".join(map(str, largest)))


translations = {}


def translate(uuid, string):
    # do not translate whitespaces
    if not string.strip():
        return string

    # check for a translation for this xlet
    if uuid not in translations:
        try:
            translations[uuid] = gettext.translation(uuid, home + '/.local/share/locale').gettext
        except IOError:
            try:
                translations[uuid] = gettext.translation(uuid, '/usr/share/locale').gettext
            except IOError:
                translations[uuid] = None

    if translations[uuid]:
        result = translations[uuid](string)
        if result != string:
            return result
    return _(string)


def list_header_func(row, before, user_data):
    if before and not row.get_header():
        row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))


def filter_row(row, entry):
    search_string = entry.get_text().lower()
    for row_part in [row.name, row.description, row.uuid, row.author]:
        if search_string.lower() in row_part.lower():
            return True
    return False


def show_prompt(msg, window=None):
    dialog = Gtk.MessageDialog(transient_for=window,
                               destroy_with_parent=True,
                               message_type=Gtk.MessageType.QUESTION,
                               buttons=Gtk.ButtonsType.YES_NO)
    esc = html.escape(msg)
    dialog.set_markup(esc)
    dialog.show_all()
    response = dialog.run()
    dialog.destroy()
    return response == Gtk.ResponseType.YES


def show_message(msg, window=None):
    dialog = Gtk.MessageDialog(transient_for=window,
                               destroy_with_parent=True,
                               message_type=Gtk.MessageType.ERROR,
                               buttons=Gtk.ButtonsType.OK)
    esc = html.escape(msg)
    dialog.set_markup(esc)
    dialog.show_all()
    dialog.run()
    dialog.destroy()


background_work_queue = ThreadedTaskManager(5)


class MyHTMLParser(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self)
        self.strings = []

    def handle_data(self, data):
        self.strings.append(data)

    def handle_charref(self, number):
        codepoint = int(number[1:], 16) if number[0] in ('x', 'X') else int(number)
        self.strings.append(chr(codepoint))

    def handle_entityref(self, name):
        codepoint = entities.name2codepoint[name]
        self.strings.append(chr(codepoint))

    def get_text(self):
        return ''.join(self.strings)


def sanitize_html(string):
    parser = MyHTMLParser()
    parser.feed(string)
    text = parser.get_text()
    return text.strip('\n ').strip('\n').replace('\n', ' ').replace('  ', ' ').replace('\\', '')


class ManageSpicesRow(Gtk.ListBoxRow):
    def __init__(self, extension_type, metadata, size_groups):
        super().__init__()
        self.extension_type = extension_type
        self.metadata = metadata

        self.status_ids = {}

        self.writable = bool(metadata.get('writable'))

        self.uuid = self.metadata['uuid']

        self.name = translate(self.metadata['uuid'], self.metadata['name'])
        self.description = translate(self.metadata['uuid'], self.metadata['description'])
        icon_path = os.path.join(self.metadata['path'], 'icon.png')

        self.author = ""
        if 'author' in metadata:
            if metadata['author'].lower() != "none" and metadata['author'].lower() != "unknown":
                self.author = metadata['author']

        try:
            self.max_instances = int(self.metadata['max-instances'])
            if self.max_instances < -1:
                self.max_instances = 1
        except (KeyError, ValueError):
            self.max_instances = 1

        try:
            self.role = self.metadata['role']
        except (KeyError, ValueError):
            self.role = None

        self.disabled_about = metadata.get('disable_about', False)

        # Check for the right version subdir (if the spice is multi-versioned,
        # it won't necessarily be in its root directory)
        self.metadata['path'] = find_extension_subdir(self.metadata['path'])

        # "hide-configuration": true in metadata trumps all
        # otherwise we check for "external-configuration-app" in metadata
        # and settings-schema.json in settings
        self.has_config = False
        self.ext_config_app = None
        if not self.metadata.get('hide-configuration'):
            if 'external-configuration-app' in self.metadata:
                self.ext_config_app = os.path.join(self.metadata['path'], self.metadata['external-configuration-app'])

            if self.ext_config_app is not None:
                if os.path.exists(self.ext_config_app):
                    self.has_config = True
                else:
                    self.ext_config_app = None

            if self.ext_config_app is None and os.path.exists(f"{self.metadata['path']}/settings-schema.json"):
                self.has_config = True

        widget = SettingsWidget()
        self.add(widget)

        grid = Gtk.Grid()
        grid.set_column_spacing(15)
        widget.pack_start(grid, True, True, 0)

        enabled_box = Gtk.Box()
        enabled_box.set_spacing(4)
        size_groups[0].add_widget(enabled_box)
        self.enabled_image = Gtk.Image.new_from_icon_name('object-select-symbolic', 2)
        if self.extension_type == "applet":
            self.enabled_image.set_tooltip_text(_("This applet is currently enabled"))
        elif self.extension_type == "desklet":
            self.enabled_image.set_tooltip_text(_("This desklet is currently enabled"))
        elif self.extension_type == "extension":
            self.enabled_image.set_tooltip_text(_("This extension is currently enabled"))
        self.enabled_image.set_no_show_all(True)
        enabled_box.pack_end(self.enabled_image, False, False, 0)
        enabled_box.show()
        grid.attach(enabled_box, 0, 0, 1, 1)

        icon = None
        if 'icon' in self.metadata:
            icon_name = self.metadata['icon']
            if Gtk.IconTheme.get_default().has_icon(icon_name):
                icon = Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.LARGE_TOOLBAR)

        if os.path.exists(icon_path):
            try:
                e, width, height = Gtk.IconSize.lookup(Gtk.IconSize.LARGE_TOOLBAR)
                scale = self.get_scale_factor()

                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(icon_path, width * scale, width * scale, True)
                surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, scale, None)
                icon = Gtk.Image.new_from_surface(surface)
            except Exception as e:
                print(e)
                icon = None

        if icon is None:
            icon = Gtk.Image.new_from_icon_name(f'cs-{extension_type}s', Gtk.IconSize.LARGE_TOOLBAR)

        grid.attach_next_to(icon, enabled_box, Gtk.PositionType.RIGHT, 1, 1)

        desc_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        desc_box.props.hexpand = True
        desc_box.props.halign = Gtk.Align.START
        desc_box.set_spacing(1)

        name_label = Gtk.Label()
        name_markup = GLib.markup_escape_text(self.name)
        if not self.author:
            name_label.set_markup(f'<b>{name_markup}</b>')
        else:
            by_author = _("by %s") % self.author
            name_label.set_markup(f'<b>{name_markup}</b><small> {by_author}</small>')
        name_label.props.xalign = 0.0
        desc_box.add(name_label)

        uuid_label = Gtk.Label()
        uuid_markup = GLib.markup_escape_text(self.uuid)
        uuid_label.set_markup(f'<small><i>{uuid_markup}</i></small>')
        uuid_label.props.xalign = 0.0
        desc_box.add(uuid_label)

        description_label = SettingsLabel()
        description_markup = GLib.markup_escape_text(sanitize_html(self.description))
        description_label.set_markup(f'<small>{description_markup}</small>')
        description_label.set_margin_top(2)
        desc_box.add(description_label)

        grid.attach_next_to(desc_box, icon, Gtk.PositionType.RIGHT, 1, 1)

        self.status_box = Gtk.Box()
        self.status_box.set_spacing(4)
        grid.attach_next_to(self.status_box, desc_box, Gtk.PositionType.RIGHT, 1, 1)
        size_groups[1].add_widget(self.status_box)

        self.button_box = Gtk.Box()
        self.button_box.set_valign(Gtk.Align.CENTER)
        grid.attach_next_to(self.button_box, self.status_box, Gtk.PositionType.RIGHT, 1, 1)
        size_groups[2].add_widget(self.button_box)

        if self.has_config:
            config_icon = Gtk.Image.new_from_icon_name('system-run-symbolic', 2)
            self.config_button = Gtk.Button(image=config_icon)
            self.config_button.set_tooltip_text(_('Configure'))
            self.button_box.pack_start(self.config_button, False, False, 0)
            self.config_button.connect('clicked', self.configure)
            self.set_can_config()

        if not self.writable:
            if self.extension_type == "applet":
                self.add_status('locked', 'changes-prevent-symbolic', _("This is a system applet. It cannot be removed."))
            elif self.extension_type == "desklet":
                self.add_status('locked', 'changes-prevent-symbolic', _("This is a system desklet. It cannot be removed."))
            elif self.extension_type == "extension":
                self.add_status('locked', 'changes-prevent-symbolic', _("This is a system extension. It cannot be removed."))
            elif self.extension_type == "action":
                self.add_status('locked', 'changes-prevent-symbolic', '')

        if self.writable and self.extension_type != 'action':
            self.scan_extension_for_danger(self.metadata['path'])

        self.version_supported = self.is_compatible_with_cinnamon_version()

    def is_compatible_with_cinnamon_version(self):
        try:
            # Treat "cinnamon-version" as a list of minimum required versions
            # if any version in there is lower than our Cinnamon version,
            # then the spice is compatible.
            curr_ver = get_cinnamon_version()

            for version in self.metadata['cinnamon-version']:
                spice_ver = [int(part) for part in version.split(".")]
                if spice_ver[:2] <= curr_ver:
                    # The version is OK, check that we can find the right .js file in the appropriate subdir
                    path = os.path.join(self.metadata['path'], self.extension_type + ".js")
                    if os.path.exists(path):
                        return True
                    print(f"The {self.uuid} {self.extension_type} is not properly structured. Path not found: '{path}'")
                    return False
            print(f"The {self.uuid} {self.extension_type} is not compatible with this version of Cinnamon.")
            return False
        except:
            # If cinnamon-version is not specified or if the version check goes wrong, assume compatibility
            return True

    def set_can_config(self, *args):
        if not self.has_config:
            return

    def configure(self, *args):
        if not self.has_config:
            return

        if self.ext_config_app:
            subprocess.Popen([self.ext_config_app])
        else:
            subprocess.Popen(['xlet-settings', self.extension_type, self.uuid])

    def add_status(self, status_id, icon_name, tooltip_text=''):
        if status_id in self.status_ids:
            return

        icon = Gtk.Image.new_from_icon_name(icon_name, 2)
        self.status_box.pack_end(icon, False, False, 0)
        self.status_ids[status_id] = icon
        icon.set_tooltip_text(tooltip_text)
        icon.show()

    def remove_status(self, status_id):
        if status_id not in self.status_ids:
            return

        self.status_ids[status_id].destroy()
        del self.status_ids[status_id]

    def set_enabled(self, enabled):
        self.enabled = enabled

        if self.enabled:
            self.enabled_image.show()
        else:
            self.enabled_image.hide()
        if self.has_config:
            self.config_button.set_sensitive(enabled)

    def scan_extension_for_danger(self, directory):
        background_work_queue.push(self.scan_extension_thread, self.on_scan_complete, (directory,))

    def scan_extension_thread(self, directory):
        dangerous = False

        def scan_item(item):
            if item.endswith('.js'):
                with open(item, encoding="utf-8") as scan_file:
                    contents = scan_file.read()
                    for unsafe_item in UNSAFE_ITEMS:
                        if unsafe_item in contents:
                            raise Exception('unsafe')

        def scan_dir(subdir):
            for item in os.listdir(subdir):
                item_path = os.path.join(subdir, item)
                if os.path.isdir(item_path):
                    scan_dir(item_path)
                else:
                    scan_item(item_path)

        try:
            scan_dir(directory)
        except:
            dangerous = True

        return dangerous

    def on_scan_complete(self, is_dangerous):
        if is_dangerous:
            if self.extension_type == "applet":
                self.add_status('dangerous', 'dialog-warning-symbolic', _("This applet contains function calls that could potentially cause Cinnamon to crash or freeze. If you are experiencing crashes or freezing, please try removing it."))
            elif self.extension_type == "desklet":
                self.add_status('dangerous', 'dialog-warning-symbolic', _("This desklet contains function calls that could potentially cause Cinnamon to crash or freeze. If you are experiencing crashes or freezing, please try removing it."))
            elif self.extension_type == "extension":
                self.add_status('dangerous', 'dialog-warning-symbolic', _("This extension contains function calls that could potentially cause Cinnamon to crash or freeze. If you are experiencing crashes or freezing, please try removing it."))


class ManageSpicesPage(SettingsPage):
    def __init__(self, parent, collection_type, spices, window):
        super().__init__()
        self.expand = True
        self.set_spacing(0)
        self.set_margin_top(5)

        self.parent = parent
        self.collection_type = collection_type
        self.spices = spices
        self.has_filter = False
        self.window = window
        self.extension_rows = []

        self.top_box = Gtk.Box()
        self.pack_start(self.top_box, False, False, 10)

        self.search_entry = Gtk.Entry()
        self.search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find-symbolic')
        self.search_entry.set_placeholder_text(_("Search"))
        self.search_entry.connect('changed', self.on_entry_refilter)

        self.top_box.pack_end(self.search_entry, False, False, 4)

        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class('view')
        self.pack_start(frame, True, True, 0)

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(main_box)

        scw = Gtk.ScrolledWindow()
        scw.expand = True
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scw.set_shadow_type(Gtk.ShadowType.NONE)
        main_box.pack_start(scw, True, True, 0)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        scw.add(self.box)

        self.infobar_holder = Gtk.Frame(shadow_type=Gtk.ShadowType.NONE)
        self.box.add(self.infobar_holder)

        def sort_rows(row1, row2):
            if row1.writable == row2.writable:
                name1 = row1.name.lower()
                name2 = row2.name.lower()
                if name1 < name2:
                    return -1
                if name2 < name1:
                    return 1
                return 0
            if row1.writable:
                return -1
            return 1

        self.list_box = Gtk.ListBox()
        self.list_box.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.list_box.set_sort_func(sort_rows)
        self.list_box.set_header_func(list_header_func, None)
        self.list_box.connect('row-selected', self.update_button_states)
        self.box.add(self.list_box)

        button_toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(button_toolbar), 'inline-toolbar')
        self.add(button_toolbar)

        button_holder = Gtk.ToolItem()
        button_holder.set_expand(True)
        button_toolbar.add(button_holder)
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        box.set_halign(Gtk.Align.CENTER)
        button_holder.add(box)

        # buttons
        self.instance_button = Gtk.Button.new_from_icon_name("list-add-symbolic", Gtk.IconSize.MENU)
        self.instance_button.set_size_request(50, -1)
        self.instance_button.set_tooltip_text(self.instance_button_text)
        self.instance_button.connect('clicked', self.add_instance)
        box.add(self.instance_button)
        self.instance_button.set_sensitive(False)

        self.remove_button = Gtk.Button.new_from_icon_name("list-remove-symbolic", Gtk.IconSize.MENU)
        self.remove_button.set_size_request(50, -1)
        self.remove_button.set_tooltip_text(self.remove_button_text)
        self.remove_button.connect('clicked', self.remove_all_instances)
        box.add(self.remove_button)
        self.remove_button.set_sensitive(False)

        self.uninstall_button = Gtk.Button.new_from_icon_name("edit-delete-symbolic", Gtk.IconSize.MENU)
        self.uninstall_button.set_size_request(50, -1)
        self.uninstall_button.set_tooltip_text(self.uninstall_button_text)
        self.uninstall_button.connect('clicked', self.uninstall_extension)
        box.add(self.uninstall_button)
        self.uninstall_button.set_sensitive(False)

        self.restore_button = Gtk.Button.new_from_icon_name("edit-undo-symbolic", Gtk.IconSize.MENU)
        self.restore_button.set_size_request(50, -1)
        self.restore_button.set_tooltip_text(self.restore_button_text)
        self.restore_button.connect('clicked', self.restore_to_default)
        box.add(self.restore_button)

        self.about_button = Gtk.Button.new_from_icon_name("help-about-symbolic", Gtk.IconSize.MENU)
        self.about_button.set_size_request(50, -1)
        self.about_button.set_tooltip_text(_("About"))
        self.about_button.connect('clicked', self.about)
        box.add(self.about_button)
        self.about_button.set_sensitive(False)

        # progress bar
        self.progress_bar = self.spices.get_progressbar()
        pb_container = Gtk.Box()
        pb_container.set_margin_top(20)
        pb_container.pack_start(self.progress_bar, True, True, 0)
        self.pack_end(pb_container, False, False, 0)

        self.load_extensions()

        self.connect('map', self.on_page_map)

        self.spices.connect('installed-changed', self.load_extensions)
        self.spices.connect('status-changed', self.update_status)

    def on_entry_refilter(self, widget, data=None):
        if self.search_entry.get_text() == '':
            self.list_box.set_filter_func(None)
            self.has_filter = False
            return

        if self.has_filter:
            self.list_box.invalidate_filter()
        else:
            self.list_box.set_filter_func(filter_row, self.search_entry)
            self.has_filter = True

    def enabled_changed(self, *args):
        for row in self.extension_rows:
            row.set_enabled(self.spices.get_enabled(row.uuid))

        self.update_button_states()

    def update_button_states(self, *args):
        row = self.list_box.get_selected_row()
        if row is None:
            self.instance_button.set_sensitive(False)
            self.remove_button.set_sensitive(False)
            self.uninstall_button.set_sensitive(False)
            self.about_button.set_sensitive(False)
        else:
            self.instance_button.set_sensitive(row.enabled == 0 or row.max_instances != 1)
            self.remove_button.set_sensitive(row.enabled)
            self.uninstall_button.set_sensitive(row.writable)
            self.about_button.set_sensitive(True)

        if self.collection_type == 'action' and hasattr(row, 'disabled_about'):
            self.about_button.set_sensitive(not row.disabled_about)

    def add_instance(self, *args):
        extension_row = self.list_box.get_selected_row()
        self.enable_extension(extension_row.uuid, extension_row.name, extension_row.version_supported)

    def enable_extension(self, uuid, name, version_check=True):
        if not version_check:
            show_message(_("Extension %s is not compatible with your version of Cinnamon.") % uuid, self.window)
            return

        self.enable(uuid)

    def enable(self, uuid):
        self.spices.enable_extension(uuid)

    def remove_all_instances(self, *args):
        extension_row = self.list_box.get_selected_row()

        if extension_row.enabled > 1:
            msg = _("There are multiple instances enabled. Are you sure you want to remove all of them?")
            if not show_prompt(msg, self.window):
                return

        self.spices.disable_extension(extension_row.uuid)

    def uninstall_extension(self, *args):
        extension_row = self.list_box.get_selected_row()
        if not show_prompt(_("Are you sure you want to completely remove %s?") % extension_row.uuid, self.window):
            return

        self.spices.disable_extension(extension_row.uuid)
        self.spices.uninstall(extension_row.uuid)

    def restore_to_default(self, *args):
        collection_msgs = {'applet': _("This will restore the default set of enabled applets. Are you sure you want to do this?"),
          'desklet': _("This will restore the default set of enabled desklets. Are you sure you want to do this?"),
          'extension': _("This will disable all active extensions. Are you sure you want to do this?"),
          'action': _("This will remove all actions. Are you sure you want to do this?")}
        msg = collection_msgs.get(self.collection_type)

        if show_prompt(msg, self.window):
            gio_sett = 'org.nemo.plugins' if self.collection_type == 'action' else 'org.cinnamon'
            sett = Gio.Settings.new(gio_sett)
            if self.collection_type == 'action':
                for uuid in self.spices.get_installed():
                    disableds = sett.get_strv('disabled-actions')
                    uuid_name = f'{uuid}.nemo_action'
                    if uuid_name in disableds:
                        disableds.remove(uuid_name)
                        sett.set_strv('disabled-actions', disableds)
                    self.spices.uninstall(uuid)
                return
            if self.collection_type != 'extension':
                sett.reset(f'next-{self.collection_type}-id')
            sett.reset(f'enabled-{self.collection_type}s')

    def about(self, *args):
        row = self.list_box.get_selected_row()
        subprocess.Popen(['xlet-about-dialog', self.collection_type + 's', row.uuid])

    def load_extensions(self, *args):
        for row in self.extension_rows:
            row.destroy()

        self.extension_rows = []

        size_groups = [Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL) for i in range(3)]

        for uuid, metadata in self.spices.get_installed().items():
            try:
                extension_row = ManageSpicesRow(self.collection_type, metadata, size_groups)
                self.list_box.add(extension_row)
                self.extension_rows.append(extension_row)
                extension_row.set_enabled(self.spices.get_enabled(uuid))
            except Exception as msg:
                print(f"Failed to load extension {uuid}: {msg}")

        self.list_box.show_all()

    def update_status(self, *args):
        for row in self.extension_rows:
            enabled = self.spices.get_enabled(row.uuid)
            row.set_enabled(enabled)
            if enabled and not self.spices.get_is_running(row.uuid) and self.collection_type != 'action':
                row.add_status('error', 'dialog-error-symbolic', _("Something went wrong while loading %s. Please make sure you are using the latest version, and then report the issue to its developer.") % row.uuid)
            else:
                row.remove_status('error')

        self.update_button_states()

    def on_page_map(self, *args):
        self.search_entry.grab_focus()


class DownloadSpicesRow(Gtk.ListBoxRow):
    def __init__(self, uuid, data, spices, size_groups):
        super().__init__()

        self.uuid = uuid
        self.data = data
        self.spices = spices
        self.name = data['name']
        self.description = data['description']
        self.score = data['score']
        self.timestamp = data['last_edited']
        self.subject = data['last_commit_subject']

        self.author = ""
        if 'author_user' in data:
            if data['author_user'].lower() != "none" and data['author_user'].lower() != "unknown":
                self.author = data['author_user']

        if 'translations' in data.keys():
            for key in (f'name_{LONG_LANGUAGE_CODE}', f'name_{LANGUAGE_CODE}'):
                if key in data['translations'].keys():
                    self.name = data['translations'][key]
                    break

            for key in (f'description_{LONG_LANGUAGE_CODE}', f'description_{LANGUAGE_CODE}'):
                if key in data['translations'].keys():
                    self.description = data['translations'][key]
                    break

        self.has_update = False

        self.status_ids = {}

        self.installed = self.spices.get_is_installed(uuid)

        widget = SettingsWidget()
        widget.set_spacing(15)
        self.add(widget)

        installed_box = Gtk.Box()
        installed_box.set_spacing(4)
        widget.pack_start(installed_box, False, False, 0)
        size_groups[0].add_widget(installed_box)
        installed_image = Gtk.Image.new_from_icon_name('object-select-symbolic', 2)
        installed_box.pack_end(installed_image, False, False, 0)
        installed_image.set_tooltip_text(_("Installed"))
        installed_image.set_no_show_all(True)
        if self.installed:
            installed_image.show()
        else:
            installed_image.hide()

        icon = spices.get_icon(uuid)
        widget.pack_start(icon, False, False, 0)

        desc_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        desc_box.set_hexpand(True)
        desc_box.set_halign(Gtk.Align.FILL)
        desc_box.set_spacing(1)

        name_label = Gtk.Label()
        name_markup = GLib.markup_escape_text(self.name)
        if self.author == "":
            name_label.set_markup(f'<b>{name_markup}</b>')
        else:
            by_author = _("by %s") % self.author
            name_label.set_markup(f'<b>{name_markup}</b><small> {by_author}</small>')
        name_label.set_hexpand(True)
        name_label.set_halign(Gtk.Align.START)
        desc_box.pack_start(name_label, False, False, 0)

        uuid_label = Gtk.Label()
        uuid_markup = GLib.markup_escape_text(self.uuid)
        uuid_label.set_markup(f'<small><i>{uuid_markup}</i></small>')
        uuid_label.props.xalign = 0.0
        desc_box.add(uuid_label)

        description_label = SettingsLabel()
        description_markup = GLib.markup_escape_text(sanitize_html(self.description))
        if self.spices.get_has_update(uuid):
            subject_markup = GLib.markup_escape_text(sanitize_html(self.subject))
            description_label.set_markup(f'<small>{description_markup}</small>\n<small><i>{subject_markup}</i></small>')
        else:
            description_label.set_markup(f'<small>{description_markup}</small>')
        description_label.set_margin_top(2)
        desc_box.pack_start(description_label, False, False, 0)

        widget.pack_start(desc_box, True, True, 0)

        score_box = Gtk.Box()
        score_image = Gtk.Image.new_from_icon_name('starred-symbolic', 2)
        score_box.pack_start(score_image, False, False, 0)
        score_label = Gtk.Label(self.score)
        score_box.pack_start(score_label, False, False, 5)
        widget.pack_start(score_box, False, False, 0)
        size_groups[1].add_widget(score_box)

        self.status_box = Gtk.Box()
        self.status_box.set_spacing(4)
        widget.pack_start(self.status_box, False, False, 0)
        size_groups[2].add_widget(self.status_box)

        self.button_box = Gtk.Box()
        self.button_box.set_valign(Gtk.Align.CENTER)
        self.button_box.set_baseline_position(Gtk.BaselinePosition.CENTER)
        widget.pack_start(self.button_box, False, False, 0)
        size_groups[3].add_widget(self.button_box)

        if not self.installed:
            download_button = Gtk.Button.new_from_icon_name('folder-download-symbolic', 2)
            self.button_box.pack_start(download_button, False, False, 0)
            download_button.connect('clicked', self.download)
            download_button.set_tooltip_text(_("Install"))
        elif self.spices.get_has_update(uuid):
            self.has_update = True
            download_button = Gtk.Button.new_from_icon_name('view-refresh-symbolic', 2)
            self.button_box.pack_start(download_button, False, False, 0)
            download_button.connect('clicked', self.download)
            download_button.set_tooltip_text(_("Update"))

    def download(self, *args):
        self.spices.install(self.uuid)

    def add_status(self, status_id, icon_name, tooltip_text=""):
        if status_id in self.status_ids:
            return

        icon = Gtk.Image.new_from_icon_name(icon_name, 2)
        self.status_box.pack_end(icon, False, False, 0)
        self.status_ids[status_id] = icon
        icon.set_tooltip_text(tooltip_text)

    def remove_status(self, status_id):
        if status_id not in self.status_ids:
            return

        self.status_ids[status_id].destroy()
        del self.status_ids[status_id]


class DownloadSpicesPage(SettingsPage):
    def __init__(self, parent, collection_type, spices, window):
        super().__init__()
        self.expand = True
        self.set_spacing(0)
        self.set_margin_top(5)

        self.parent = parent
        self.collection_type = collection_type
        self.spices = spices
        self.window = window
        self.has_filter = False
        self.extension_rows = []
        self._signals = []

        self.initial_refresh_done = False

        self.top_box = Gtk.Box()
        self.pack_start(self.top_box, False, False, 10)

        sort_label = Gtk.Label()
        sort_label.set_text(_("Sort by"))
        self.top_box.pack_start(sort_label, False, False, 4)

        self.sort_combo = Gtk.ComboBox()
        sort_types = Gtk.ListStore(str, str)
        self.sort_combo.set_model(sort_types)
        renderer_text = Gtk.CellRendererText()
        self.sort_combo.pack_start(renderer_text, True)
        self.sort_combo.add_attribute(renderer_text, "text", 1)
        self.sort_combo.set_id_column(0)
        sort_types.append(['name', _("Name")])
        sort_types.append(['score', _("Popularity")])
        sort_types.append(['date', _("Date")])
        sort_types.append(['installed', _("Installed")])
        sort_types.append(['update', _("Upgradable")])
        self.sort_combo.set_active(1)  # Rating
        self.sort_combo.connect('changed', self.sort_changed)
        self.top_box.pack_start(self.sort_combo, False, False, 4)

        self.search_entry = Gtk.Entry()
        self.search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find-symbolic')
        self.search_entry.set_placeholder_text(_("Search"))
        self.search_entry.connect('changed', self.on_entry_refilter)

        self.top_box.pack_end(self.search_entry, False, False, 4)

        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class('view')
        self.pack_start(frame, True, True, 0)

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(main_box)

        self.infobar_holder = Gtk.Frame(shadow_type=Gtk.ShadowType.NONE)
        main_box.pack_start(self.infobar_holder, False, False, 0)

        scw = Gtk.ScrolledWindow()
        scw.expand = True
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scw.set_shadow_type(Gtk.ShadowType.NONE)
        main_box.pack_start(scw, True, True, 0)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        scw.add(self.box)

        self.list_box = Gtk.ListBox()
        self.list_box.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.list_box.set_header_func(list_header_func, None)
        self.list_box.connect('row-selected', self.on_row_selected)
        self.box.add(self.list_box)

        button_toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(button_toolbar), 'inline-toolbar')
        self.add(button_toolbar)

        button_holder = Gtk.ToolItem()
        button_holder.set_expand(True)
        button_toolbar.add(button_holder)
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        box.set_halign(Gtk.Align.CENTER)
        button_holder.add(box)

        # buttons
        self.more_info_button = Gtk.Button.new_from_icon_name("dialog-information-symbolic", Gtk.IconSize.MENU)
        self.more_info_button.set_size_request(50, -1)
        self.more_info_button.set_tooltip_text(_("More info"))
        self.more_info_button.connect('clicked', self.get_more_info)
        box.add(self.more_info_button)
        self.more_info_button.set_sensitive(False)

        self.uninstall_button = Gtk.Button.new_from_icon_name("edit-delete-symbolic", Gtk.IconSize.MENU)
        self.uninstall_button.set_size_request(50, -1)
        self.uninstall_button.set_tooltip_text(_("Uninstall"))
        self.uninstall_button.connect('clicked', self.uninstall)
        box.add(self.uninstall_button)
        self.uninstall_button.set_sensitive(False)

        self.update_all_button = Gtk.Button.new_from_icon_name("software-update-available-symbolic", Gtk.IconSize.MENU)
        self.update_all_button.set_size_request(50, -1)
        self.update_all_button.connect('clicked', self.update_all)
        box.add(self.update_all_button)
        self.update_all_button.set_sensitive(False)

        self.refresh_button = Gtk.Button.new_from_icon_name("emblem-synchronizing-symbolic", Gtk.IconSize.MENU)
        self.refresh_button.set_size_request(50, -1)
        self.refresh_button.set_tooltip_text(_("Refresh"))
        self.refresh_button.connect('clicked', self.refresh)
        box.add(self.refresh_button)

        # progress bar
        self.progress_bar = self.spices.get_progressbar()
        pb_container = Gtk.Box()
        pb_container.set_margin_top(20)
        pb_container.pack_start(self.progress_bar, True, True, 0)
        self.pack_end(pb_container, False, False, 0)

        self.install_list = []
        self.update_list = {}
        self.current_num_updates = 0

        self.sort_changed()

        self.connect('map', self.on_page_map)

        self.spices.connect('cache-loaded', self.build_list)
        self.spices.connect('installed-changed', self.build_list)

    def on_entry_refilter(self, widget, data=None):
        if self.search_entry.get_text() == '':
            self.list_box.set_filter_func(None)
            self.has_filter = False
            return

        if self.has_filter:
            self.list_box.invalidate_filter()
        else:
            self.list_box.set_filter_func(filter_row, self.search_entry)
            self.has_filter = True

    def sort_changed(self, *args):
        def sort_name(row1, row2):
            if row2.name.lower() == row1.name.lower():
                return 0
            if row2.name.lower() < row1.name.lower():
                return 1
            return -1

        def sort_score(row1, row2):
            return row2.score - row1.score

        def sort_date(row1, row2):
            return row2.timestamp - row1.timestamp

        def sort_installed(row1, row2):
            if row1.installed == row2.installed:
                return 0
            if row1.installed:
                return -1
            return 1

        def sort_update(row1, row2):
            if row1.has_update == row2.has_update:
                if not row1.has_update:
                    return row2.timestamp - row1.timestamp
                return 0
            if row1.has_update:
                return -1
            return 1

        sort_type = self.sort_combo.get_active_id()
        if sort_type == 'name':
            self.list_box.set_sort_func(sort_name)
        elif sort_type == 'score':
            self.list_box.set_sort_func(sort_score)
        elif sort_type == 'date':
            self.list_box.set_sort_func(sort_date)
        elif sort_type == 'installed':
            self.list_box.set_sort_func(sort_installed)
        else:
            self.list_box.set_sort_func(sort_update)

    def on_row_selected(self, list_box, row):
        if row is None:
            self.more_info_button.set_sensitive(False)
            self.uninstall_button.set_sensitive(False)
        else:
            self.more_info_button.set_sensitive(True)
            self.uninstall_button.set_sensitive(row.installed)

    def uninstall(self, *args):
        extension_row = self.list_box.get_selected_row()
        if not show_prompt(_("Are you sure you want to completely remove %s?") % extension_row.uuid, self.window):
            return

        self.spices.disable_extension(extension_row.uuid)
        self.spices.uninstall(extension_row.uuid)

    def refresh(self, *args):
        self.refresh_button.set_sensitive(False)
        self.spices.refresh_cache()

    def build_list(self, *args):
        spices_data = self.spices.get_cache()
        if spices_data is None:
            return

        if len(self.extension_rows) > 0:
            for row in self.extension_rows:
                row.destroy()
            self.extension_rows = []

        size_groups = [Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL) for i in range(4)]

        for uuid, data in spices_data.items():
            row = DownloadSpicesRow(uuid, data, self.spices, size_groups)
            self.extension_rows.append(row)
            self.list_box.add(row)

        updates_available = self.spices.get_n_updates()
        self.update_all_button.set_sensitive(updates_available)
        if updates_available > 0:
            msg_text = _("Update all") + ' (' + ngettext("%d update available", "%d updates available", updates_available) % updates_available  + ')'
        else:
            msg_text = _("No updates available")
        self.update_all_button.set_tooltip_text(msg_text)
        self.refresh_button.set_sensitive(True)
        self.list_box.show_all()

    def get_more_info(self, *args):
        extension_row = self.list_box.get_selected_row()
        self.spices.open_spice_page(extension_row.uuid)

    def update_all(self, *args):
        self.spices.update_all()

    def on_page_map(self, *args):
        GLib.idle_add(self.on_page_shown)

    def on_page_shown(self, *args):
        if not self.extension_rows:
            self.build_list()

        if not self.initial_refresh_done and not self.spices.processing_jobs:
            self.initial_refresh_done = True
            self.spices.refresh_cache()

        self.search_entry.grab_focus()
