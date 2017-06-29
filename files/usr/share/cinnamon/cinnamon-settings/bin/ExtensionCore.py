#!/usr/bin/python2

import sys
import os
import re
import json
import cgi
import subprocess
import gettext
from HTMLParser import HTMLParser
import htmlentitydefs

import dbus
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, Pango, GLib

from SettingsWidgets import SidePage, SettingsStack, SettingsPage, SettingsWidget, SettingsLabel
from Spices import Spice_Harvester, ThreadedTaskManager

home = os.path.expanduser('~')

SHOW_ALL = 0
SHOW_ACTIVE = 1
SHOW_INACTIVE = 2

SETTING_TYPE_NONE = 0
SETTING_TYPE_INTERNAL = 1
SETTING_TYPE_EXTERNAL = 2

ROW_SIZE = 32

UNSAFE_ITEMS = ['spawn_sync', 'spawn_command_line_sync', 'GTop', 'get_file_contents_utf8_sync']

curr_ver = subprocess.check_output(['cinnamon', '--version']).splitlines()[0].split(' ')[1]

def find_extension_subdir(directory):
    largest = [0]
    curr_a = curr_ver.split('.')

    for subdir in os.listdir(directory):
        if not os.path.isdir(os.path.join(directory, subdir)):
            continue

        if not re.match(r'^[1-9][0-9]*\.[0-9]+(\.[0-9]+)?$', subdir):
            continue

        subdir_a = subdir.split(".")

        if cmp(subdir_a, curr_a) <= 0 and cmp(largest, subdir_a) <= 0:
            largest = subdir_a

    if len(largest) == 1:
        return directory
    else:
        return os.path.join(directory, ".".join(largest))

translations = {}

def translate(uuid, string):
    #check for a translation for this xlet
    if uuid not in translations:
        try:
            translations[uuid] = gettext.translation(uuid, home + '/.local/share/locale').ugettext
        except IOError:
            try:
                translations[uuid] = gettext.translation(uuid, '/usr/share/locale').ugettext
            except IOError:
                translations[uuid] = None

    #do not translate whitespaces
    if not string.strip():
        return string

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
    if search_string in row.name.lower() or search_string in row.description.lower() or search_string.lower() in row.uuid.lower():
        return True
    else:
        return False

def show_prompt(msg, window=None):
    dialog = Gtk.MessageDialog(transient_for = window,
                               destroy_with_parent = True,
                               message_type = Gtk.MessageType.QUESTION,
                               buttons = Gtk.ButtonsType.YES_NO)
    dialog.set_default_size(400, 200)
    esc = cgi.escape(msg)
    dialog.set_markup(esc)
    dialog.show_all()
    response = dialog.run()
    dialog.destroy()
    return response == Gtk.ResponseType.YES

background_work_queue = ThreadedTaskManager(5)


class MyHTMLParser(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self)
        self.strings = []

    def handle_data(self, data):
        self.strings.append(data)

    def handle_charref(self, number):
        codepoint = int(number[1:], 16) if number[0] in (u'x', u'X') else int(number)
        self.strings.append(unichr(codepoint))

    def handle_entityref(self, name):
        codepoint = htmlentitydefs.name2codepoint[name]
        self.strings.append(unichr(codepoint))

    def get_text(self):
        return u''.join(self.strings)

def sanitize_html(string):
    parser = MyHTMLParser()
    parser.feed(string)
    text = parser.get_text()
    return text.strip('\\n ').strip('\\n').replace('\\n', ' ').replace('  ', ' ').replace('\\', '')


class ManageSpicesRow(Gtk.ListBoxRow):
    def __init__(self, extension_type, metadata, size_group):
        super(ManageSpicesRow, self).__init__()
        self.extension_type = extension_type
        self.metadata = metadata

        self.status_ids = {}

        self.writable = metadata['writable']

        self.uuid = self.metadata['uuid']
        self.name = translate(self.metadata['uuid'], self.metadata['name'])
        self.description = translate(self.metadata['uuid'], self.metadata['description'])

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

        try:
            last_edited = self.metadata['last-edited']
        except (KeyError, ValueError):
            last_edited = -1

        if 'multiversion' in self.metadata and self.metadata['multiversion']:
            self.metadata['path'] = find_extension_subdir(self.metadata['path'])

        # "hide-configuration": true in metadata trumps all
        # otherwise we check for "external-configuration-app" in metadata and settings-schema.json in settings
        self.has_config = False
        self.ext_config_app = None
        if not 'hide-configuration' in self.metadata or self.metadata['hide-configuration'] != True:
            if 'external-configuration-app' in self.metadata:
                self.ext_config_app = os.path.join(self.metadata['path'], self.metadata['external-configuration-app'])

            if self.ext_config_app is not None:
                if os.path.exists(self.ext_config_app):
                    self.has_config = True
                else:
                    self.ext_config_app = None

            if self.ext_config_app is None and os.path.exists('%s/settings-schema.json' % self.metadata['path']):
                self.has_config = True

        widget = SettingsWidget()
        self.add(widget)

        grid = Gtk.Grid()
        grid.set_column_spacing(15)
        widget.pack_start(grid, True, True, 0)

        icon = None
        if 'icon' in self.metadata:
            icon_name = self.metadata['icon']
            if Gtk.IconTheme.get_default().has_icon(icon_name):
                icon = Gtk.Image.new_from_icon_name(icon_name, 3)

        if icon is None and os.path.exists('%s/icon.png' % self.metadata['path']):
            try:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale('%s/icon.png' % self.metadata['path'], 24, 24, True)
                icon = Gtk.Image.new_from_pixbuf(pixbuf)
            except:
                icon = None

        if icon is None:
            icon = Gtk.Image.new_from_icon_name('cs-%ss' % (extension_type), 3)

        grid.attach(icon, 0, 0, 1, 1)

        desc_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        desc_box.props.hexpand = True
        desc_box.props.halign = Gtk.Align.START
        name_label = Gtk.Label()
        name_markup = GLib.markup_escape_text(self.name)
        name_label.set_markup('<b>{}</b>'.format(name_markup))
        name_label.props.xalign = 0.0
        desc_box.add(name_label)

        description_label = SettingsLabel()
        description_markup = GLib.markup_escape_text(sanitize_html(self.description))
        description_label.set_markup('<small>{}</small>'.format(description_markup))
        desc_box.add(description_label)

        grid.attach_next_to(desc_box, icon, Gtk.PositionType.RIGHT, 1, 1)

        self.status_box = Gtk.Box()
        self.status_box.set_spacing(4)
        grid.attach_next_to(self.status_box, desc_box, Gtk.PositionType.RIGHT, 1, 1)

        self.button_box = Gtk.Box()
        self.button_box.set_valign(Gtk.Align.CENTER)
        grid.attach_next_to(self.button_box, self.status_box, Gtk.PositionType.RIGHT, 1, 1)
        size_group.add_widget(self.button_box)

        if self.has_config:
            config_icon = Gtk.Image.new_from_icon_name('system-run-symbolic', 2)
            self.config_button = Gtk.Button(image=config_icon)
            self.config_button.set_tooltip_text(_('Configure'))
            self.button_box.pack_start(self.config_button, False, False, 0)
            self.config_button.connect('clicked', self.configure)
            self.set_can_config()

        if not self.writable:
            self.add_status('locked', 'changes-prevent-symbolic', _("This is a system %s and cannot be removed") % (self.extension_type))

        try:
            schema_filename = self.metadata['schema-file']
        except (KeyError, ValueError):
            schema_filename = ''

        if self.writable:
            self.scan_extension_for_danger(self.metadata['path'])

        self.version_supported = False
        try:
            self.version_supported = curr_ver in self.metadata['cinnamon-version'] or curr_ver.rsplit('.', 1)[0] in self.metadata['cinnamon-version']
        except (KeyError, ValueError):
            self.version_supported = True # Don't check version if not specified.

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
            self.add_status('enabled', 'object-select-symbolic', _("This %s is currently enabled") % (self.extension_type))
        else:
            self.remove_status('enabled')
        if self.has_config:
            self.config_button.set_sensitive(enabled)

    def scan_extension_for_danger(self, directory):
        background_work_queue.push(self.scan_extension_thread, self.on_scan_complete, (directory,))

    def scan_extension_thread(self, directory):
        dangerous = False

        def scan_item(item):
            if item.endswith('.js'):
                f = open(item)
                contents = f.read()
                for unsafe_item in UNSAFE_ITEMS:
                    if unsafe_item in contents:
                        raise Exception('unsafe')
                f.close()

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
            self.add_status('dangerous', 'dialog-warning-symbolic', _("This %s contains function calls that could potentially cause Cinnamon to crash or freeze. If you are experiencing crashes or freezing, please try removing this %s.") % (self.extension_type, self.extension_type))


class ManageSpicesPage(SettingsPage):
    def __init__(self, parent, collection_type, spices, window):
        super(ManageSpicesPage, self).__init__()
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

        toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(toolbar), 'cs-header')
        label = Gtk.Label()
        markup = GLib.markup_escape_text(_("Installed %ss") % self.collection_type)
        label.set_markup('<b>{}</b>'.format(markup))
        title_holder = Gtk.ToolItem()
        title_holder.add(label)
        toolbar.add(title_holder)
        main_box.add(toolbar)

        toolbar_separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        main_box.add(toolbar_separator)
        separator_context = toolbar_separator.get_style_context()
        frame_color = frame_style.get_border_color(Gtk.StateFlags.NORMAL).to_string()
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data('.separator { -GtkWidget-wide-separators: 0; \
                                                   color: %s;                    \
                                                }' % frame_color)
        separator_context.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

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
                elif name2 < name1:
                    return 1
                else:
                    return 0
            elif row1.writable:
                return -1
            else:
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
        button_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        box.set_halign(Gtk.Align.CENTER)
        button_holder.add(box)

        # buttons
        self.instance_button = Gtk.Button(label=self.instance_button_text)
        self.instance_button.connect('clicked', self.add_instance)
        button_group.add_widget(self.instance_button)
        box.add(self.instance_button)
        self.instance_button.set_sensitive(False)

        self.remove_button = Gtk.Button(label=self.remove_button_text)
        self.remove_button.connect('clicked', self.remove_all_instances)
        button_group.add_widget(self.remove_button)
        box.add(self.remove_button)
        self.remove_button.set_sensitive(False)

        self.uninstall_button = Gtk.Button(label=self.uninstall_button_text)
        self.uninstall_button.connect('clicked', self.uninstall_extension)
        button_group.add_widget(self.uninstall_button)
        box.add(self.uninstall_button)
        self.uninstall_button.set_sensitive(False)

        self.restore_button = Gtk.Button(label=self.restore_button_text)
        self.restore_button.connect('clicked', self.restore_to_default)
        button_group.add_widget(self.restore_button)
        box.add(self.restore_button)

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
        else:
            self.instance_button.set_sensitive(row.enabled == 0 or row.max_instances != 1)
            self.remove_button.set_sensitive(row.enabled)
            self.uninstall_button.set_sensitive(row.writable)

    def add_instance(self, *args):
        extension_row = self.list_box.get_selected_row()
        self.enable_extension(extension_row.uuid, extension_row.name, extension_row.version_supported)

    def enable_extension(self, uuid, name, version_check = True):
        if not version_check:
            if not show_prompt(_("Extension %s is not compatible with current version of cinnamon. Using it may break your system. Load anyway?") % uuid, self.window):
                return
            else:
                uuid = '!' + uuid

        self.enable(uuid)

    def enable(self, uuid):
        self.spices.enable_extension(uuid)

    def remove_all_instances(self, *args):
        extension_row = self.list_box.get_selected_row()

        if (extension_row.enabled > 1):
            msg = _("There are %d instances enabled, are you sure you want to remove all of them?\n\n%s" % (extension_row.enabled, self.RemoveString))
            if not show_prompt(msg, self.window):
                return

        self.spices.disable_extension(extension_row.uuid)

    def uninstall_extension(self, *args):
        extension_row = self.list_box.get_selected_row()
        if not show_prompt(_("Are you sure you want to completely remove %s?") % (extension_row.uuid), self.window):
            return
        self.spices.disable_extension(extension_row.uuid)

        self.spices.uninstall(extension_row.uuid)

    def on_uninstall_finished(self, uuid):
        self.load_extensions()

    def restore_to_default(self, *args):
        if self.collection_type == 'applet':
            msg = _("This will restore the default set of enabled applets. Are you sure you want to do this?")
        elif self.collection_type == 'desklet':
            msg = _("This will restore the default set of enabled desklets. Are you sure you want to do this?")
        elif self.collection_type == 'extension':
            msg = _("This will disable all active extensions. Are you sure you want to do this?")
        if show_prompt(msg, self.window):
            if self.collection_type != 'extension':
                os.system(('gsettings reset org.cinnamon next-%s-id') % (self.collection_type))
            os.system(('gsettings reset org.cinnamon enabled-%ss') % (self.collection_type))

    def load_extensions(self, *args):
        for row in self.extension_rows:
            row.destroy()

        self.extension_rows = []

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        for uuid, metadata in self.spices.get_installed().items():
            try:
                extension_row = ManageSpicesRow(self.collection_type, metadata, size_group)
                self.list_box.add(extension_row)
                self.extension_rows.append(extension_row)
                extension_row.set_enabled(self.spices.get_enabled(uuid))
            except Exception, msg:
                print "Failed to load extension %s: %s" % (uuid, msg)

        self.list_box.show_all()

    def update_status(self, *args):
        for row in self.extension_rows:
            enabled = self.spices.get_enabled(row.uuid)
            row.set_enabled(enabled)
            if enabled and not self.spices.get_is_running(row.uuid):
                row.add_status('error', 'dialog-error-symbolic', _("Something went wrong while loading the %s %s. Please make sure you are using the latest version, and then report the issue to the developer.") % (self.collection_type, row.uuid))
            else:
                row.remove_status('error')

        self.update_button_states()

    def on_page_map(self, *args):
        self.search_entry.grab_focus()


class DownloadSpicesRow(Gtk.ListBoxRow):
    def __init__(self, uuid, data, spices, size_groups):
        super(DownloadSpicesRow, self).__init__()

        self.uuid = uuid
        self.data = data
        self.spices = spices
        self.name = data['name']
        self.description = data['description']
        self.score = data['score']
        self.timestamp = data['last_edited']

        self.status_ids = {}

        self.installed = self.spices.get_is_installed(uuid)

        widget = SettingsWidget()
        widget.set_spacing(15)
        self.add(widget)

        icon = spices.get_icon(uuid)
        widget.pack_start(icon, False, False, 0)

        desc_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        desc_box.set_hexpand(True)
        desc_box.set_halign(Gtk.Align.FILL)
        name_label = Gtk.Label()
        name_markup = GLib.markup_escape_text(self.name)
        name_label.set_markup('<b>{}</b>'.format(name_markup))
        name_label.set_hexpand(True)
        name_label.set_halign(Gtk.Align.START)
        desc_box.pack_start(name_label, False, False, 0)

        description_label = SettingsLabel()
        description_markup = GLib.markup_escape_text(sanitize_html(self.description))
        description_label.set_markup('<small>{}</small>'.format(description_markup))
        desc_box.pack_start(description_label, False, False, 0)

        widget.pack_start(desc_box, True, True, 0)

        score_box = Gtk.Box()
        score_image = Gtk.Image.new_from_icon_name('starred-symbolic', 2)
        score_box.pack_start(score_image, False, False, 0)
        score_label = Gtk.Label(self.score)
        score_box.pack_start(score_label, False, False, 5)
        widget.pack_start(score_box, False, False, 0)
        size_groups[0].add_widget(score_box)

        self.status_box = Gtk.Box()
        self.status_box.set_spacing(4)
        widget.pack_start(self.status_box, False, False, 0)
        size_groups[1].add_widget(self.status_box)

        self.button_box = Gtk.Box()
        self.button_box.set_valign(Gtk.Align.CENTER)
        self.button_box.set_baseline_position(Gtk.BaselinePosition.CENTER)
        widget.pack_start(self.button_box, False, False, 0)
        size_groups[2].add_widget(self.button_box)

        if not self.installed:
            download_button = Gtk.Button.new_from_icon_name('go-down-symbolic', 2)
            self.button_box.pack_start(download_button, False, False, 0)
            download_button.connect('clicked', self.download)
            download_button.set_tooltip_text(_("Install"))
        elif self.spices.get_has_update(uuid):
            download_button = Gtk.Button.new_from_icon_name('view-refresh-symbolic', 2)
            self.button_box.pack_start(download_button, False, False, 0)
            download_button.connect('clicked', self.download)
            download_button.set_tooltip_text(_("Update"))

        if self.installed:
            self.add_status('installed', 'object-select-symbolic', _("Installed"))

        self.show_all()

    def download(self, *args):
        self.spices.install(self.uuid)

    def add_status(self, status_id, icon_name, tooltip_text=""):
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


class DownloadSpicesPage(SettingsPage):
    def __init__(self, parent, collection_type, spices, window):
        super(DownloadSpicesPage, self).__init__()
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

        self.top_box = Gtk.Box()
        self.pack_start(self.top_box, False, False, 10)

        sort_label = Gtk.Label()
        sort_label.set_text(_("Sort by"))
        self.top_box.pack_start(sort_label, False, False, 4)

        self.sort_combo = Gtk.ComboBox()
        sort_types=Gtk.ListStore(str, str)
        self.sort_combo.set_model(sort_types)
        renderer_text = Gtk.CellRendererText()
        self.sort_combo.pack_start(renderer_text, True)
        self.sort_combo.add_attribute(renderer_text, "text", 1)
        self.sort_combo.set_id_column(0)
        sort_types.append(['name', _("Name")])
        sort_types.append(['score', _("Popularity")])
        sort_types.append(['date', _("Date")])
        sort_types.append(['installed', _("Installed")])
        self.sort_combo.set_active(1) #Rating
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

        toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(toolbar), 'cs-header')
        label = Gtk.Label()
        markup = GLib.markup_escape_text(_("Download %ss") % self.collection_type)
        label.set_markup('<b>{}</b>'.format(markup))
        title_holder = Gtk.ToolItem()
        title_holder.add(label)
        toolbar.add(title_holder)
        main_box.add(toolbar)

        toolbar_separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        main_box.add(toolbar_separator)
        separator_context = toolbar_separator.get_style_context()
        frame_color = frame_style.get_border_color(Gtk.StateFlags.NORMAL).to_string()
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data('.separator { -GtkWidget-wide-separators: 0; \
                                                   color: %s;                    \
                                                }' % frame_color)
        separator_context.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        scw = Gtk.ScrolledWindow()
        scw.expand = True
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scw.set_shadow_type(Gtk.ShadowType.NONE)
        main_box.pack_start(scw, True, True, 0)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        scw.add(self.box)

        self.infobar_holder = Gtk.Frame(shadow_type=Gtk.ShadowType.NONE)
        self.box.add(self.infobar_holder)

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
        button_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        box.set_halign(Gtk.Align.CENTER)
        button_holder.add(box)

        # buttons
        self.more_info_button = Gtk.Button(label=_("More info"))
        self.more_info_button.connect('clicked', self.get_more_info)
        button_group.add_widget(self.more_info_button)
        box.add(self.more_info_button)
        self.more_info_button.set_sensitive(False)

        self.uninstall_button = Gtk.Button(label=_("Uninstall"))
        self.uninstall_button.connect('clicked', self.uninstall)
        button_group.add_widget(self.uninstall_button)
        box.add(self.uninstall_button)
        self.uninstall_button.set_sensitive(False)

        self.update_all_button = Gtk.Button(label=_("Update all"))
        self.update_all_button.connect('clicked', self.update_all)
        button_group.add_widget(self.update_all_button)
        box.add(self.update_all_button)
        self.update_all_button.set_sensitive(False)

        self.refresh_button = Gtk.Button(label=_("Refresh"))
        self.refresh_button.connect('clicked', self.refresh)
        button_group.add_widget(self.refresh_button)
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
        self.build_list()

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
            elif row2.name.lower() < row1.name.lower():
                return 1
            else:
                return -1

        def sort_score(row1, row2):
            return row2.score - row1.score

        def sort_date(row1, row2):
            return row2.timestamp - row1.timestamp

        def sort_installed(row1, row2):
            if row1.installed == row2.installed:
                return 0
            elif row1.installed:
                return -1
            else:
                return 1

        sort_type = self.sort_combo.get_active_id()
        if sort_type == 'name':
            self.list_box.set_sort_func(sort_name)
        elif sort_type == 'score':
            self.list_box.set_sort_func(sort_score)
        elif sort_type == 'date':
            self.list_box.set_sort_func(sort_date)
        else:
            self.list_box.set_sort_func(sort_installed)

    def on_row_selected(self, list_box, row):
        if row is None:
            self.more_info_button.set_sensitive(False)
            self.uninstall_button.set_sensitive(False)
        else:
            self.more_info_button.set_sensitive(True)
            self.uninstall_button.set_sensitive(row.installed)

    def uninstall(self, *args):
        extension_row = self.list_box.get_selected_row()
        if not show_prompt(_("Are you sure you want to completely remove %s?") % (extension_row.uuid), self.window):
            return

        self.spices.disable_extension(extension_row.uuid)
        self.spices.uninstall(extension_row.uuid)

    def refresh(self, *args):
        self.refresh_button.set_sensitive(False)
        self.spices.refresh_cache()

    def build_list(self, *args):
        spices_data = self.spices.get_cache()
        if spices_data == None:
            return

        if len(self.extension_rows) > 0:
            for row in self.extension_rows:
                row.destroy()
            self.extension_rows = []

        size_groups = [Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL) for i in range(3)]

        for uuid, data in spices_data.items():
            row = DownloadSpicesRow(uuid, data, self.spices, size_groups)
            self.extension_rows.append(row)
            self.list_box.add(row)

        self.update_all_button.set_sensitive(self.spices.are_updates_available())
        self.refresh_button.set_sensitive(True)

    def get_more_info(self, *args):
        extension_row = self.list_box.get_selected_row()
        self.spices.open_spice_page(extension_row.uuid)

    def update_all(self, *args):
        self.spices.update_all()

    def on_page_map(self, *args):
        if not self.spices.processing_jobs:
            if not self.spices.has_cache:
                if show_prompt(_("In order to view the list of available %ss you will need to download it. Would you like to do so now? (This may take a minute or more depending on your Internet connection)") % self.collection_type, self.window):
                    self.spices.refresh_cache()
            elif self.spices.get_cache_age() > 7:
                if show_prompt(_("The list of available %ss may be out of date. Would you like to update now? (This may take a minute or more depending on your Internet connection)") % self.collection_type, self.window):
                    self.spices.refresh_cache()

        self.search_entry.grab_focus()
