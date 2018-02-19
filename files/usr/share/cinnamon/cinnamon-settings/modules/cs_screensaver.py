#!/usr/bin/python3

import os, json, subprocess, re
from xml.etree import ElementTree
import gettext
import signal

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib, Pango

from GSettingsWidgets import *

LOCK_DELAY_OPTIONS = [
    (0, _("Lock immediately")),
    (15, _("15 seconds")),
    (30, _("30 seconds")),
    (60, _("1 minute")),
    (120, _("2 minutes")),
    (180, _("3 minutes")),
    (300, _("5 minutes")),
    (600, _("10 minutes")),
    (1800, _("30 minutes")),
    (3600, _("1 hour"))
]

LOCK_INACTIVE_OPTIONS = [
    (0,    _("Never")),
    (60,   _("1 minute")),
    (300,  _("5 minutes")),
    (600,  _("10 minutes")),
    (900,  _("15 minutes")),
    (1800, _("30 minutes")),
    (2700, _("45 minutes")),
    (3600, _("1 hour"))
]

XSCREENSAVER_PATH = "/usr/share/xscreensaver/config/"


def list_header_func(row, before, user_data):
    if before and not row.get_header():
        row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

class Module:
    name = "screensaver"
    category = "prefs"
    comment = _("Manage screen lock settings")

    def __init__(self, content_box):
        keywords = _("screensaver, lock, password, away, message")
        sidePage = SidePage(_("Screensaver"), "cs-screensaver", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_show_custom_format_info_button_clicked(self, button):
        subprocess.Popen(['xdg-open', 'http://www.foragoodstrftime.com/'])

    def on_module_selected(self):
        if self.loaded:
            return

        print("Loading Screensaver module")

        schema = "org.cinnamon.desktop.screensaver"
        self.settings = Gio.Settings.new(schema)

        self.sidePage.stack = SettingsStack()
        self.sidePage.add_widget(self.sidePage.stack)

        # Screensaver
        page = SettingsPage()
        page.expand = True
        self.sidePage.stack.add_titled(page, "screensaver", _("Screensaver"))
        settings = ScreensaverBox(_("Select screensaver"))
        page.pack_start(settings, True, True, 0)

        # Settings
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "settings", _("Settings"))

        settings = page.add_section(_("Screensaver settings"))

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

        widget = GSettingsComboBox(_("Delay before starting the screensaver"), "org.cinnamon.desktop.session", "idle-delay", LOCK_INACTIVE_OPTIONS, valtype=int, size_group=size_group)
        widget.set_tooltip_text(_("This option defines the amount of time to wait before starting the screensaver, when the computer is not being used"))
        settings.add_row(widget)

        settings = page.add_section(_("Lock settings"))

        widget = GSettingsSwitch(_("Lock the computer when put to sleep"), "org.cinnamon.settings-daemon.plugins.power", "lock-on-suspend")
        widget.set_tooltip_text(_("Enable this option to require a password when the computer wakes up from suspend"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Lock the computer after the screensaver starts"), schema, "lock-enabled")
        widget.set_tooltip_text(_("Enable this option to require a password when the screen turns itself off, or when the screensaver activates after a period of inactivity"))
        settings.add_row(widget)

        widget = GSettingsComboBox(_("Delay before locking"), schema, "lock-delay", LOCK_DELAY_OPTIONS, valtype=int, size_group=size_group)
        widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, after showing the screensaver or after turning off the screen"))
        settings.add_reveal_row(widget, schema, "lock-enabled")

        # Customize
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "customize", _("Customize"))

        settings = page.add_section(_("Date and Time"))

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

        widget = GSettingsSwitch(_("Always show the clock"), schema, "show-clock")
        widget.set_tooltip_text(_("Show the clock on the wallpaper instead of just on the unlock screen"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Use a custom date and time format"), schema, "use-custom-format")
        settings.add_row(widget)

        widget = GSettingsEntry(_("Time Format"), schema, "time-format", size_group=size_group)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = GSettingsEntry(_("Date Format: "), schema, "date-format", size_group=size_group)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = SettingsWidget()
        button = Gtk.Button(_("Show information on date format syntax"))
        button.connect("clicked", self.on_show_custom_format_info_button_clicked)
        widget.pack_start(button, True, True, 0)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = GSettingsFontButton(_("Time Font"), "org.cinnamon.desktop.screensaver", "font-time", size_group=size_group)
        settings.add_row(widget)

        widget = GSettingsFontButton(_("Date Font"), "org.cinnamon.desktop.screensaver", "font-date", size_group=size_group)
        settings.add_row(widget)

        settings = page.add_section(_("Away message"))

        widget = GSettingsEntry(_("Show this message when the screen is locked"), schema, "default-message")
        widget.set_child_packing(widget.content_widget, True, True, 0, Gtk.PackType.START)
        widget.set_tooltip_text(_("This is the default message displayed on your lock screen"))
        settings.add_row(widget)

        settings.add_row(GSettingsFontButton(_("Font"), "org.cinnamon.desktop.screensaver", "font-message"))

        widget = GSettingsSwitch(_("Ask for a custom message when locking the screen from the menu"), schema, "ask-for-away-message")
        widget.set_tooltip_text(_("This option allows you to type a message each time you lock the screen from the menu"))
        settings.add_row(widget)

        settings = page.add_section(_("General"))

        widget = GSettingsSwitch(_("Allow keyboard shortcuts"), schema, "allow-keyboard-shortcuts")
        widget.set_tooltip_text(_("Allow shortcuts like volume-control and media keys to be used on the lock screen"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Show media player controls"), schema, "allow-media-control")
        widget.set_tooltip_text(_("For compatible players, show playback controls while media is playing"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Show album art"), schema, "show-album-art")
        widget.set_tooltip_text(_("If available, show album art while media is playing"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Show info panel"), schema, "show-info-panel")
        widget.set_tooltip_text(_("Show the number of missed notifications and the battery status"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Allow floating clock and album art widgets"), schema, "floating-widgets")
        widget.set_tooltip_text(_("When the default screensaver is active, allow the clock and album art widgets to float around randomly"))
        settings.add_row(widget)

class ScreensaverBox(Gtk.Box):
    def __init__(self, title):
        Gtk.Box.__init__(self)
        self.set_orientation(Gtk.Orientation.VERTICAL)
        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class("view")
        self.pack_start(frame, True, True, 0)

        schema = "org.cinnamon.desktop.screensaver"
        self.settings = Gio.Settings.new(schema)

        self.webkit_executable = None
        self.xscreensaver_executable = None
        self.proc = None

        self.current_name = self.settings.get_string("screensaver-name")
        if self.current_name == "webkit@cinnamon.org":
            self.current_name = self.settings.get_string("screensaver-webkit-theme")
        elif self.current_name == "xscreensaver@cinnamon.org":
            self.current_name = "xscreensaver-" + self.settings.get_string("xscreensaver-hack")

        self.main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(self.main_box)

        toolbar = Gtk.Toolbar.new()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(toolbar), "cs-header")
        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % title)
        title_holder = Gtk.ToolItem()
        title_holder.add(label)
        toolbar.add(title_holder)
        self.main_box.add(toolbar)

        self.preview_stack = Gtk.Stack()
        self.preview_stack.set_border_width(30)
        self.preview_stack.set_size_request(-1, 300)
        self.preview_stack.override_background_color(Gtk.StateFlags.NORMAL, Gdk.RGBA(0, 0, 0, 1))
        self.main_box.pack_start(self.preview_stack, False, False, 0)

        self.main_box.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

        scw = Gtk.ScrolledWindow()
        scw.expand = True
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scw.set_shadow_type(Gtk.ShadowType.NONE)
        self.main_box.pack_start(scw, True, True, 0)

        self.list_box = Gtk.ListBox()
        self.list_box.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.list_box.set_header_func(list_header_func, None)
        self.list_box.connect("row-activated", self.on_row_activated)
        scw.add(self.list_box)

        self.socket = Gtk.Socket()
        # Prevent the socket from self-destructing when its plug dies
        self.socket.connect("plug-removed", lambda socket: True)
        self.socket.show()
        self.preview_stack.add_named(self.socket, "socket")

        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/share/cinnamon/thumbnails/wallclock.png", -1, 240)
        image = Gtk.Image.new_from_pixbuf(pixbuf)
        image.show()
        self.preview_stack.add_named(image, "default")

        self.gather_screensavers()

        self.socket_map_id = self.preview_stack.connect("map", self.on_stack_mapped)
        self.socket_unmap_id = self.preview_stack.connect("unmap", self.on_stack_unmapped)

    def gather_screensavers(self):
        row = ScreensaverRow("", _("Screen Locker"), _("The standard cinnamon lock screen"), "", "default")
        self.add_row(row)
        if self.current_name == "":
            self.list_box.select_row(row)

        dirs = [os.path.expanduser("~/.local/share/cinnamon-screensaver/screensavers")] + \
               [os.path.join(x, "cinnamon-screensaver/screensavers/") for x in GLib.get_system_data_dirs()]

        things = []
        for directory in dirs:
            if not os.path.isdir(directory):
                continue

            things += [os.path.join(directory, x) for x in os.listdir(directory)]

        for path in things:
            if not os.path.isdir(path):
                continue

            # Recurse inside if it is webkit
            if os.path.basename(path.rstrip('/')) == "webkit@cinnamon.org":
                webkits = [os.path.join(path, x) for x in os.listdir(path)]

                for theme in webkits:
                    if os.path.basename(theme) == 'main':
                        self.webkit_executable = theme
                        continue

                    if not os.path.isdir(theme):
                        continue

                    self.parse_dir(theme, path, "webkit")
                continue

            if os.path.basename(path.rstrip('/')) == "xscreensaver@cinnamon.org":
                if os.path.exists(os.path.join(path, 'main')):
                    self.xscreensaver_executable = os.path.join(path, 'main')

                continue

            self.parse_dir(path, path, "standalone")

        if self.xscreensaver_executable is not None and os.path.exists(XSCREENSAVER_PATH):
            xscreensavers = []
            try:
                gettext.install("xscreensaver", "/usr/share/locale")

                for item in sorted(os.listdir(XSCREENSAVER_PATH)):
                    if not item.endswith(".xml"):
                        continue

                    path = os.path.join(XSCREENSAVER_PATH, item)
                    try:
                        tree = ElementTree.parse(path);
                        root = tree.getroot()

                        name = root.attrib["name"]
                        label = root.attrib["_label"]
                        description = root.find("_description").text.strip()
                        label = _(label)
                        description = _(description)
                        row = ScreensaverRow(name, label, description, XSCREENSAVER_PATH, "xscreensaver")
                        xscreensavers.append(row)
                    except Exception as detail:
                        print("Unable to parse xscreensaver information at %s: %s" % (path, detail))

                xscreensavers = sorted(xscreensavers, key=lambda x: x.name)
                for xscreensaver in xscreensavers:
                    self.add_row(xscreensaver)
                    if self.current_name == "xscreensaver-" + xscreensaver.uuid:
                        self.list_box.select_row(xscreensaver)
                gettext.install("cinnamon", "/usr/share/locale")
            except Exception as detail:
                print("Unable to parse xscreensaver hacks: %s" % detail)

    def parse_dir(self, path, directory, ss_type):
        try:
            metadata = open(os.path.join(path, "metadata.json"), 'r').read()
            data = json.loads(metadata)

            name = data["name"]
            uuid = data["uuid"]

            assert uuid == os.path.basename(path.rstrip('/'))

            try:
                description = data["description"]
            except KeyError:
                description = None
            except ValueError:
                description = None

            row = ScreensaverRow(uuid, name, description, directory, ss_type)
            self.add_row(row)

            if self.current_name == uuid:
                self.list_box.select_row(row)
        except:
            print("Unable to parse screensaver information at %s" % path)

    def kill_plug(self):
        if not self.proc:
            return

        for child in self.socket.get_children():
            self.socket.remove(child)

        self.proc.send_signal(signal.SIGTERM)
        self.proc = None

    def on_row_activated(self, list_box, row):
        row = self.list_box.get_selected_row()
        if not row:
            return

        self.kill_plug()

        uuid = row.uuid
        path = row.path
        ss_type = row.ss_type

        if uuid == '':
            self.settings.set_string('screensaver-name', '')
        elif ss_type == 'webkit':
            self.settings.set_string('screensaver-name', 'webkit@cinnamon.org')
            self.settings.set_string('screensaver-webkit-theme', uuid)
        elif ss_type == 'xscreensaver':
            self.settings.set_string('screensaver-name', 'xscreensaver@cinnamon.org')
            self.settings.set_string('xscreensaver-hack', uuid)
        else:
            self.settings.set_string('screensaver-name', uuid)

        if ss_type == 'default':
            self.preview_stack.set_visible_child_name("default")
            return

        self.preview_stack.set_visible_child_name("socket")

        if ss_type == 'webkit':
            command = [self.webkit_executable, "--plugin", uuid]
        elif ss_type == 'xscreensaver':
            command = [self.xscreensaver_executable, "--hack", uuid]
        else:
            command = [os.path.join(path, "main")]

        GLib.idle_add(self.idle_spawn_plug, command)

    def idle_spawn_plug(self, command):
        try:
            self.proc = Gio.Subprocess.new(command, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE)
        except GLib.Error as e:
            print(e.message)

        pipe = self.proc.get_stdout_pipe()
        bytes_read = pipe.read_bytes(1024, None)
        pipe.close(None)

        output = bytes_read.get_data().decode()

        if output:
            match = re.match('^\s*WINDOW ID=(\d+)\s*$', output)
            if match:
                self.socket.add_id(int(match.group(1)))

    def on_stack_mapped(self, widget, data=None):
        self.kill_plug()
        self.on_row_activated(None, None)
        GLib.idle_add(self.idle_scroll_to_selection)

    def on_stack_unmapped(self, widget, data=None):
        self.kill_plug()

    def idle_scroll_to_selection(self):
        row = self.list_box.get_selected_row()
        alloc = row.get_allocation()

        adjustment = self.list_box.get_adjustment()
        adjustment.set_value(alloc.y)

    def add_row(self, row):
        self.list_box.add(row)

class ScreensaverRow(Gtk.ListBoxRow):
    def __init__(self, uuid, name, description, path, ss_type):
        Gtk.ListBoxRow.__init__(self)
        self.uuid = uuid
        self.name = name

        # Add ... to the description if it is cut in the middle of a line. If
        # the next line is empty, we interpret this as a paragraph break and
        # don't insert ...
        desc = description.split('\n')
        if len(desc) <= 1 or len(desc[1].strip()) == 0:
            self.short_description = desc[0]
        else:
            self.short_description = desc[0] + "..."

        self.description = description
        self.path = path
        self.ss_type = ss_type

        self.set_tooltip_text(self.description)

        widget = SettingsWidget()
        grid = Gtk.Grid()
        grid.set_column_spacing(15)
        widget.pack_start(grid, True, True, 0)

        self.desc_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.desc_box.props.hexpand = True
        self.desc_box.props.halign = Gtk.Align.START
        self.name_label = Gtk.Label()
        self.name_label.set_markup("<b>%s</b>" % self.name)
        self.name_label.props.xalign = 0.0
        self.desc_box.add(self.name_label)
        self.comment_label = Gtk.Label()
        self.comment_label.set_markup("<small>%s</small>" % self.short_description)
        self.comment_label.props.xalign = 0.0
        self.comment_label.set_ellipsize(Pango.EllipsizeMode.END)
        self.comment_label.set_max_width_chars(80)
        self.desc_box.add(self.comment_label)

        grid.attach(self.desc_box, 0, 0, 1, 1)

        type_box = Gtk.Box()
        type_label = Gtk.Label()
        type_label.set_markup("<small><i>%s</i></small>" % self.ss_type)
        type_box.pack_start(type_label, True, True, 0)
        grid.attach_next_to(type_box, self.desc_box, Gtk.PositionType.RIGHT, 1, 1)

        self.add(widget)
