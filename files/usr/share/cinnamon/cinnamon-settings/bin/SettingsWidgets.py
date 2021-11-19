#!/usr/bin/python3

import os
import subprocess

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GObject, GLib

from xapp.SettingsWidgets import SettingsWidget, SettingsLabel
from xapp.GSettingsWidgets import PXGSettingsBackend
from ChooserButtonWidgets import DateChooserButton, TimeChooserButton
from KeybindingWidgets import ButtonKeybinding

settings_objects = {}

CAN_BACKEND = ["SoundFileChooser", "DateChooser", "TimeChooser", "Keybinding"]

class BinFileMonitor(GObject.GObject):
    __gsignals__ = {
        'changed': (GObject.SignalFlags.RUN_LAST, None, ()),
    }
    def __init__(self):
        super(BinFileMonitor, self).__init__()

        self.changed_id = 0

        env = GLib.getenv("PATH")

        if env == None:
            env = "/bin:/usr/bin:."

        self.paths = env.split(":")

        self.monitors = []

        for path in self.paths:
            file = Gio.File.new_for_path(path)
            mon = file.monitor_directory(Gio.FileMonitorFlags.SEND_MOVED, None)
            mon.connect("changed", self.queue_emit_changed)
            self.monitors.append(mon)

    def _emit_changed(self):
        self.emit("changed")
        self.changed_id = 0
        return False

    def queue_emit_changed(self, file, other, event_type, data=None):
        if self.changed_id > 0:
            GLib.source_remove(self.changed_id)
            self.changed_id = 0

        self.changed_id = GLib.idle_add(self._emit_changed)

file_monitor = None

def get_file_monitor():
    global file_monitor

    if file_monitor == None:
        file_monitor = BinFileMonitor()

    return file_monitor

class DependencyCheckInstallButton(Gtk.Box):
    def __init__(self, checking_text, install_button_text, binfiles, final_widget=None, satisfied_cb=None):
        super(DependencyCheckInstallButton, self).__init__(orientation=Gtk.Orientation.HORIZONTAL)

        self.binfiles = binfiles
        self.satisfied_cb = satisfied_cb

        self.checking_text = checking_text
        self.install_button_text = install_button_text

        self.stack = Gtk.Stack()
        self.pack_start(self.stack, False, False, 0)

        self.progress_bar = Gtk.ProgressBar()
        self.stack.add_named(self.progress_bar, "progress")

        self.progress_bar.set_show_text(True)
        self.progress_bar.set_text(self.checking_text)

        self.install_warning = Gtk.Label(label=install_button_text, margin=5)
        frame = Gtk.Frame()
        frame.add(self.install_warning)
        frame.set_shadow_type(Gtk.ShadowType.OUT)
        frame.show_all()
        self.stack.add_named(frame, "install")

        if final_widget:
            self.stack.add_named(final_widget, "final")
        else:
            self.stack.add_named(Gtk.Alignment(), "final")

        self.stack.set_visible_child_name("progress")
        self.progress_source_id = 0

        self.file_listener = get_file_monitor()
        self.file_listener_id = self.file_listener.connect("changed", self.on_file_listener_ping)

        self.connect("destroy", self.on_destroy)

        GLib.idle_add(self.check)

    def check(self):
        self.start_pulse()

        success = True

        for program in self.binfiles:
            if not GLib.find_program_in_path(program):
                success = False
                break

        GLib.idle_add(self.on_check_complete, success)

        return False

    def pulse_progress(self):
        self.progress_bar.pulse()
        return True

    def start_pulse(self):
        self.cancel_pulse()
        self.progress_source_id = GLib.timeout_add(200, self.pulse_progress)

    def cancel_pulse(self):
        if (self.progress_source_id > 0):
            GLib.source_remove(self.progress_source_id)
            self.progress_source_id = 0

    def on_check_complete(self, result, data=None):
        self.cancel_pulse()
        if result:
            self.stack.set_visible_child_name("final")
            if self.satisfied_cb:
                self.satisfied_cb()
        else:
            self.stack.set_visible_child_name("install")

    def on_file_listener_ping(self, monitor, data=None):
        self.stack.set_visible_child_name("progress")
        self.progress_bar.set_text(self.checking_text)
        self.check()

    def on_destroy(self, widget):
        self.file_listener.disconnect(self.file_listener_id)
        self.file_listener_id = 0

class GSettingsDependencySwitch(SettingsWidget):
    def __init__(self, label, schema=None, key=None, dep_key=None, binfiles=None, packages=None):
        super(GSettingsDependencySwitch, self).__init__(dep_key=dep_key)

        self.binfiles = binfiles
        self.packages = packages

        self.content_widget = Gtk.Alignment()
        self.label = Gtk.Label(label)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.switch = Gtk.Switch()
        self.switch.set_halign(Gtk.Align.END)
        self.switch.set_valign(Gtk.Align.CENTER)

        pkg_string = ""
        for pkg in packages:
            if pkg_string != "":
                pkg_string += ", "
            pkg_string += pkg

        self.dep_button = DependencyCheckInstallButton(_("Checking dependencies"),
                                                       _("Please install: %s") % (pkg_string),
                                                       binfiles,
                                                       self.switch)
        self.content_widget.add(self.dep_button)

        if schema:
            self.settings = self.get_settings(schema)
            self.settings.bind(key, self.switch, "active", Gio.SettingsBindFlags.DEFAULT)

class SidePage(object):
    def __init__(self, name, icon, keywords, content_box = None, size = None, is_c_mod = False, is_standalone = False, exec_name = None, module=None):
        self.name = name
        self.icon = icon
        self.content_box = content_box
        self.widgets = []
        self.is_c_mod = is_c_mod
        self.is_standalone = is_standalone
        self.exec_name = exec_name
        self.module = module # Optionally set by the module so we can call on_module_selected() on it when we show it.
        self.keywords = keywords
        self.size = size
        self.topWindow = None
        self.builder = None
        self.stack = None
        if self.module != None:
            self.module.loaded = False

    def add_widget(self, widget):
        self.widgets.append(widget)

    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        if (self.module is not None):
            self.module.on_module_selected()
            self.module.loaded = True

        if self.is_standalone:
            subprocess.Popen(self.exec_name.split())
            return

        # Add our own widgets
        for widget in self.widgets:
            if hasattr(widget, 'expand'):
                self.content_box.pack_start(widget, True, True, 2)
            else:
                self.content_box.pack_start(widget, False, False, 2)

        # C modules are sort of messy - they check the desktop type
        # (for Unity or GNOME) and show/hide UI items depending on
        # the result - so we cannot just show_all on the widget, it will
        # mess up these modifications - so for these, we just show the
        # top-level widget
        if not self.is_c_mod:
            self.content_box.show_all()
            try:
                self.check_third_arg()
            except:
                pass
            return

        self.content_box.show()
        for child in self.content_box:
            child.show()

            # C modules can have non-C parts. C parts are all named c_box
            if child.get_name() != "c_box":
                pass

            c_widgets = child.get_children()
            if not c_widgets:
                c_widget = self.content_box.c_manager.get_c_widget(self.exec_name)
                if c_widget is not None:
                    child.pack_start(c_widget, False, False, 2)
                    c_widget.show()
            else:
                for c_widget in c_widgets:
                    c_widget.show()

            def recursively_iterate(parent):
                if self.stack:
                    return
                for child in parent:
                    if isinstance(child, Gtk.Stack):
                        self.stack = child
                        break
                    elif isinstance(child, Gtk.Container):
                        recursively_iterate(child)

            # Look for a stack recursively
            recursively_iterate(child)

class CCModule:
    def __init__(self, label, mod_id, icon, category, keywords, content_box):
        sidePage = SidePage(label, icon, keywords, content_box, size=-1, is_c_mod=True, is_standalone=False, exec_name=mod_id, module=None)
        self.sidePage = sidePage
        self.name = mod_id
        self.category = category

    def process (self, c_manager):
        if c_manager.lookup_c_module(self.name):
            c_box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            c_box.set_vexpand(False)
            c_box.set_name("c_box")
            self.sidePage.add_widget(c_box)
            return True
        else:
            return False

class SAModule:
    def __init__(self, label, mod_id, icon, category, keywords, content_box):
        sidePage = SidePage(label, icon, keywords, content_box, False, False, True, mod_id)
        self.sidePage = sidePage
        self.name = mod_id
        self.category = category

    def process (self):
        name = self.name.replace("pkexec ", "")
        name = name.split()[0]

        return GLib.find_program_in_path(name) is not None

def walk_directories(dirs, filter_func, return_directories=False):
    # If return_directories is False: returns a list of valid subdir names
    # Else: returns a list of valid tuples (subdir-names, parent-directory)
    valid = []
    try:
        for thdir in dirs:
            if os.path.isdir(thdir):
                for t in os.listdir(thdir):
                    if filter_func(os.path.join(thdir, t)):
                        if return_directories:
                            valid.append([t, thdir])
                        else:
                            valid.append(t)
    except:
        pass
        #logging.critical("Error parsing directories", exc_info=True)
    return valid

class LabelRow(SettingsWidget):
    def __init__(self, text=None, tooltip=None):
        super(LabelRow, self).__init__()

        self.label = SettingsLabel()
        self.label.set_hexpand(True)
        self.pack_start(self.label, False, False, 0)
        self.label.set_markup(text)
        self.set_tooltip_text(tooltip)

class SoundFileChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, event_sounds=True, size_group=None, dep_key=None, tooltip=""):
        super(SoundFileChooser, self).__init__(dep_key=dep_key)

        self.event_sounds = event_sounds

        self.label = SettingsLabel(label)
        self.content_widget = Gtk.Box()

        c = self.content_widget.get_style_context()
        c.add_class(Gtk.STYLE_CLASS_LINKED)

        self.file_picker_button = Gtk.Button()
        self.file_picker_button.connect("clicked", self.on_picker_clicked)

        button_content = Gtk.Box(spacing=5)
        self.file_picker_button.add(button_content)

        self.button_label = Gtk.Label()
        button_content.pack_start(Gtk.Image(icon_name="sound"), False, False, 0)
        button_content.pack_start(self.button_label, False, False, 0)

        self.content_widget.pack_start(self.file_picker_button, True, True, 0)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.play_button = Gtk.Button()
        self.play_button.set_image(Gtk.Image.new_from_icon_name("media-playback-start-symbolic", Gtk.IconSize.BUTTON))
        self.play_button.connect("clicked", self.on_play_clicked)
        self.content_widget.pack_start(self.play_button, False, False, 0)

        self._proxy = None

        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      'org.cinnamon.SettingsDaemon.Sound',
                                      '/org/cinnamon/SettingsDaemon/Sound',
                                      'org.cinnamon.SettingsDaemon.Sound',
                                      None, self._on_proxy_ready, None)
        except GLib.Error as e:
            print(e.message)
            self._proxy = None
            self.play_button.set_sensitive(False)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def _on_proxy_ready (self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)

    def on_play_clicked(self, widget):
        self._proxy.PlaySoundFile("(us)", 0, self.get_value())

    def on_picker_clicked(self, widget):
        dialog = Gtk.FileChooserDialog(title=self.label.get_text(),
                                       action=Gtk.FileChooserAction.OPEN,
                                       transient_for=self.get_toplevel(),
                                       buttons=(_("_Cancel"), Gtk.ResponseType.CANCEL,
                                                _("_Open"), Gtk.ResponseType.ACCEPT))

        if os.path.exists(self.get_value()):
            dialog.set_filename(self.get_value())
        else:
            dialog.set_current_folder('/usr/share/sounds')

        sound_filter = Gtk.FileFilter()
        if self.event_sounds:
            sound_filter.add_mime_type("audio/x-wav")
            sound_filter.add_mime_type("audio/x-vorbis+ogg")
        else:
            sound_filter.add_mime_type("audio/*")
        sound_filter.set_name(_("Sound files"))
        dialog.add_filter(sound_filter)

        if (dialog.run() == Gtk.ResponseType.ACCEPT):
            name = dialog.get_filename()
            self.set_value(name)
            self.update_button_label(name)

        dialog.destroy()

    def update_button_label(self, absolute_path):
        if absolute_path != "":
            f = Gio.File.new_for_path(absolute_path)
            self.button_label.set_label(f.get_basename())

    def on_setting_changed(self, *args):
        self.update_button_label(self.get_value())

    def connect_widget_handlers(self, *args):
        pass

class DateChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(DateChooser, self).__init__(dep_key=dep_key)

        self.label = SettingsLabel(label)

        self.content_widget = DateChooserButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def on_date_changed(self, *args):
        date = self.content_widget.get_date()
        self.set_value({"y": date.year, "m": date.month, "d": date.day})

    def on_setting_changed(self, *args):
        date = self.get_value()
        self.content_widget.set_date((date["y"], date["m"], date["d"]))

    def connect_widget_handlers(self, *args):
        self.content_widget.connect("date-changed", self.on_date_changed)

class TimeChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(TimeChooser, self).__init__(dep_key=dep_key)

        self.label = SettingsLabel(label)

        self.content_widget = TimeChooserButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def on_time_changed(self, *args):
        time = self.content_widget.get_time()
        self.set_value({"h": time.hour, "m": time.minute, "s": time.second})

    def on_setting_changed(self, *args):
        time = self.get_value()
        self.content_widget.set_time((time["h"], time["m"], time["s"]))

    def connect_widget_handlers(self, *args):
        self.content_widget.connect("time-changed", self.on_time_changed)

class Keybinding(SettingsWidget):
    bind_dir = None

    def __init__(self, label, num_bind=2, size_group=None, dep_key=None, tooltip=""):
        super(Keybinding, self).__init__(dep_key=dep_key)

        self.num_bind = num_bind

        self.label = SettingsLabel(label)

        self.buttons = []
        self.teach_button = None

        self.content_widget = Gtk.Frame(shadow_type=Gtk.ShadowType.IN)
        self.content_widget.set_valign(Gtk.Align.CENTER)
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self.content_widget.add(box)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        for x in range(self.num_bind):
            if x != 0:
                box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))
            kb = ButtonKeybinding()
            kb.set_size_request(150, -1)
            kb.connect("accel-edited", self.on_kb_changed)
            kb.connect("accel-cleared", self.on_kb_changed)
            box.pack_start(kb, False, False, 0)
            self.buttons.append(kb)

        self.event_id = None
        self.teaching = False

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def on_kb_changed(self, *args):
        bindings = []

        for x in range(self.num_bind):
            string = self.buttons[x].get_accel_string()
            bindings.append(string)

        self.set_value("::".join(bindings))

    def on_setting_changed(self, *args):
        value = self.get_value()
        bindings = value.split("::")

        for x in range(min(len(bindings), self.num_bind)):
            self.buttons[x].set_accel_string(bindings[x])

    def connect_widget_handlers(self, *args):
        pass

def g_settings_factory(subclass):
    class NewClass(globals()[subclass], PXGSettingsBackend):
        def __init__(self, label, schema, key, *args, **kwargs):
            self.key = key
            if schema not in settings_objects:
                settings_objects[schema] = Gio.Settings.new(schema)
            self.settings = settings_objects[schema]

            if "map_get" in kwargs:
                self.map_get = kwargs["map_get"]
                del kwargs["map_get"]
            if "map_set" in kwargs:
                self.map_set = kwargs["map_set"]
                del kwargs["map_set"]

            super(NewClass, self).__init__(label, *args, **kwargs)
            self.bind_settings()
    return NewClass

for widget in CAN_BACKEND:
    globals()["GSettings"+widget] = g_settings_factory(widget)
