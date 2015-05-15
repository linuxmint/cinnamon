#!/usr/bin/env python2

from SettingsWidgets import *
from gi.repository import Gtk, Gdk, GLib
import os, json, subprocess, re

LOCK_DELAY_OPTIONS = [
    (0, _("Immediately")),
    (15, _("After 15 seconds")),
    (30, _("After 30 seconds")),
    (60, _("After 1 minute")),
    (120, _("After 2 minutes")),
    (180, _("After 3 minutes")),
    (300, _("After 5 minutes")),
    (600, _("After 10 minutes")),
    (1800, _("After 30 minutes")),
    (3600, _("After 1 hour"))
]

LOCK_INACTIVE_OPTIONS = [
    (0,    _("Never")),
    (60,   _("After 1 minute")),
    (300,  _("After 5 minutes")),
    (600,  _("After 10 minutes")),
    (900,  _("After 15 minutes")),
    (1800, _("After 30 minutes")),
    (2700, _("After 45 minutes")),
    (3600, _("After 1 hour"))
]

class Module:
    name = "screensaver"
    category = "prefs"
    comment = _("Manage screen lock settings")

    def __init__(self, content_box):
        keywords = _("screensaver, lock, password, away, message")
        sidePage = SidePage(_("Screen Locker"), "cs-screensaver", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if self.loaded:
            return

        print "Loading Screensaver module"

        self.proc = None

        schema = "org.cinnamon.desktop.screensaver"
        self.settings = Gio.Settings.new(schema)

        self.sidePage.stack = SettingsStack()
        self.sidePage.add_widget(self.sidePage.stack)

        # Screensaver
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "screensaver", _("Screensaver"))
        settings = page.add_section(_("Select screensaver"))

        self.scrollWindow = Gtk.ScrolledWindow()
        self.tree_view = Gtk.TreeView()
        #                          uuid, name, description, path, type
        self.model = Gtk.ListStore(str,  str,  str,         str,  str)
        self.tree_view.set_model(self.model)
        self.tree_view.set_tooltip_column(2)
        self.scrollWindow.set_min_content_height(140)

        renderer = Gtk.CellRendererText.new()
        renderer.set_property("xpad", 30)

        name_column = Gtk.TreeViewColumn("Name", renderer, text=1)
        name_column.set_expand(True)
        name_column.set_property("sizing", Gtk.TreeViewColumnSizing.FIXED)
        self.tree_view.append_column(name_column)

        self.tree_view.set_headers_visible(False)
        self.tree_view.connect("row-activated", self.on_row_activated)
        self.tree_view.set_activate_on_single_click(True)
        self.scrollWindow.add(self.tree_view)
        settings.box.add(self.scrollWindow)

        self.socket_box = Gtk.Box()
        self.socket_box.override_background_color(Gtk.StateFlags.NORMAL, Gdk.RGBA(0, 0, 0, 1))
        page.pack_start(self.socket_box, True, True, 0)

        self.current_name = self.settings.get_string("screensaver-name")
        if self.current_name == "webkit@cinnamon.org":
            self.current_name = self.settings.get_string("screensaver-webkit-theme")

        iter = self.model.append(["", _("Blank screen"), _("Blank screen"), "", "default"])
        if self.current_name == "":
            self.tree_view.get_selection().select_iter(iter)
            self.on_row_activated(self.tree_view, self.model.get_path(iter), None)

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

        if self.xscreensaver_executable is not None:
            for theme in sorted(os.listdir("/usr/lib/xscreensaver")):
                iter = self.model.append([theme, "Xscreensaver: %s" % theme.capitalize(), theme, theme, "xscreensaver"])

            self.parse_dir(path, path, "standalone")

        self.socket_box.connect("map", lambda x: self.on_row_activated(None, None, None))

        # Settings
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "settings", _("Settings"))

        settings = page.add_section(_("Lock settings"))

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

        widget = GSettingsSwitch(_("Lock the computer when put to sleep"), "org.cinnamon.settings-daemon.plugins.power", "lock-on-suspend")
        widget.set_tooltip_text(_("Enable this option to require a password when the computer wakes up from suspend"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Lock the computer when the screen turns off"), schema, "lock-enabled")
        widget.set_tooltip_text(_("Enable this option to require a password when the screen turns itself off, or when the screensaver activates after a period of inactivity"))
        settings.add_row(widget)

        widget = GSettingsComboBox(_("Delay before locking the screen"), schema, "lock-delay", LOCK_DELAY_OPTIONS, valtype="uint", size_group=size_group)
        widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, after showing the screensaver or after turning off the screen"))
        settings.add_reveal_row(widget, schema, "lock-enabled")

        widget = GSettingsComboBox(_("Lock the computer when inactive"), "org.cinnamon.desktop.session", "idle-delay", LOCK_INACTIVE_OPTIONS, valtype="uint", size_group=size_group)
        widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, when the computer is not being used"))
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

        # Date
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "date", _("Date"))

        settings = page.add_section(_("Date and Time"))

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

        widget = GSettingsSwitch(_("Use a custom date and time format"), schema, "use-custom-format")
        settings.add_row(widget)

        widget = GSettingsEntry(_("Time Format"), schema, "time-format", size_group=size_group)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = GSettingsEntry(_("Date Format: "), schema, "date-format", size_group=size_group)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = GSettingsFontButton(_("Time Font"), "org.cinnamon.desktop.screensaver", "font-time", size_group=size_group)
        settings.add_row(widget)

        widget = GSettingsFontButton(_("Date Font"), "org.cinnamon.desktop.screensaver", "font-date", size_group=size_group)
        settings.add_row(widget)

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

            iter = self.model.append([uuid, name, description, directory, ss_type])
            if self.current_name == uuid:
                self.tree_view.get_selection().select_iter(iter)
        except:
            print "Unable to parse screensaver information at %s" % path

    def on_row_activated(self, widget, path, column):
        iter = self.tree_view.get_selection().get_selected()[1]
        if not iter or not self.model[iter]:
            return
        uuid = self.model[iter][0]
        print uuid
        path = self.model[iter][3]
        ss_type = self.model[iter][4]
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
            self.socket_box.forall(lambda x: x.destroy())

        if ss_type == 'webkit':
            command = [self.webkit_executable, "--plugin", uuid]
        elif ss_type == 'xscreensaver':
            command = [self.xscreensaver_executable, "--hack", uuid]
        else:
            command = os.path.join(path, "main")

        try:
            self.proc = subprocess.Popen(command, stdout=subprocess.PIPE)
        except:
            return

        line = self.proc.stdout.readline()

        while line:
            match = re.match('^\s*WINDOW ID=(\d+)\s*$', line.decode())
            if match:
                self.socket_box.forall(lambda x: x.destroy())
                socket = Gtk.Socket()
                socket.show()
                self.socket_box.pack_start(socket, True, True, 0)
                socket.add_id(int(match.group(1)))
                break
            line = self.proc.stdout.readline()
