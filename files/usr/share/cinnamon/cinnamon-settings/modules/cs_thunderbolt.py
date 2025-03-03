#!/usr/bin/python3

import os

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gtk, Gio, GLib

from SettingsWidgets import SidePage
from xapp.SettingsWidgets import SettingsStack, SettingsPage, SettingsSection, SettingsWidget, SettingsLabel


BOLT_BUS_NAME = "org.freedesktop.bolt"
BOLT_OBJECT_PATH = "/org/freedesktop/bolt"


def build_detail_row(key, value):
    row = SettingsWidget()
    labelKey = Gtk.Label(label=key)
    labelKey.get_style_context().add_class("dim-label")
    row.pack_start(labelKey, False, False, 0)
    if isinstance(value, Gtk.Label):
        labelValue = value
    else:
        labelValue = Gtk.Label(label=str(value))
    labelValue.set_selectable(True)
    labelValue.set_line_wrap(True)        
    row.pack_end(labelValue, False, False, 0)
    return row

def format_generation(gen):
    if gen in (1,2,3):
        return f'Thunderbolt {gen}'
    elif gen == 4:
        return 'USB4'
    raise ValueError("undefined thunderbolt generation")


class DBusProps:
    pass


class DBusProxy:
    def __init__(self, name, object_path, interface_name):
        # Save the dbus info
        self.name = name
        self.object_path = object_path
        self.interface_name = interface_name

        # Callback for when properties are changed
        self.on_property_changed = None
        self.on_property_invalidated = None

        # Get the initial properties for this DBus Proxy
        var = Gio.DBusConnection.call_sync(
            Gio.bus_get_sync(Gio.BusType.SYSTEM),
            name,
            object_path,
            "org.freedesktop.DBus.Properties",
            "GetAll",
            GLib.Variant("(s)", (interface_name,)),
            None,
            0,
            -1,
            None)

        self.props = DBusProps()
        (props,) = var.unpack()
        for key, value in props.items():
            setattr(self.props, key, value)

        # Main proxy for DBus Object
        self._proxy = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            None,
            name,
            object_path,
            interface_name,
            None)

        # Register for future changes to properties
        self._proxy.connect("g-properties-changed", self._on_g_properties_changed)

    def _on_g_properties_changed(self, proxy, changed, invalidated):
        for key, value in changed.unpack().items():
            setattr(self.props, key, value)
            if self.on_property_changed:
                self.on_property_changed(key, value)
        for key in invalidated:
            delattr(self.props, key)
            if self.on_property_invalidated:
                self.on_property_invalidated(key)


class BoltManagerProxy(DBusProxy):
    def __init__(self):
        # Perform parent initialization
        super().__init__(
            BOLT_BUS_NAME,
            BOLT_OBJECT_PATH,
            "org.freedesktop.bolt1.Manager"
            )

        # Callbacks
        self.on_device_added = None
        self.on_device_removed = None
        
        # Connect to g-signal for event handling
        self._proxy.connect('g-signal', self._on_g_signal)

    def _on_g_signal(self, proxy, sender, signal, parameters):
        if signal == "DeviceAdded" and self.on_device_added:
            (obj_path,) = parameters.unpack()
            self.on_device_added(obj_path)
        elif signal == "DeviceRemoved" and self.on_device_removed:
            (obj_path,) = parameters.unpack()
            self.on_device_removed(obj_path)

    def list_devices(self):
        return self._proxy.ListDevices()

    def enroll_device(self, uid):
        self._proxy.EnrollDevice('(sss)', uid, 'auto', '')

    def forget_device(self, uid):
        self._proxy.ForgetDevice('(s)', uid)


class BoltDeviceProxy(DBusProxy):
    def __init__(self, obj_path):
        super().__init__(
            BOLT_BUS_NAME,
            obj_path,
            "org.freedesktop.bolt1.Device"
            )

    def authorize(self):
        self._proxy.Authorize('(s)', 'auto')


class BoltSection(SettingsSection):

    def __init__(self, bolt_manager, bolt_device):
        self.bolt_manager = bolt_manager
        self.bolt_device = bolt_device
        self.bolt_device.on_property_changed = lambda k, v: self.refresh()
        super().__init__("{0} {1}".format(bolt_device.props.Vendor, bolt_device.props.Name))
        
        widget = SettingsWidget()
        self.status_label = SettingsLabel()
        widget.pack_start(self.status_label, False, False, 0)
        self.details_btn = Gtk.ToggleButton(label=_("Details"))
        self.details_btn.connect("toggled", lambda w: self.details_revealer.set_reveal_child(w.get_active()))
        self.auth_btn = Gtk.Button(label=_("Authorize"))
        self.auth_btn.connect("clicked", lambda w: self.bolt_device.authorize())
        self.trust_btn = Gtk.Button(label=_("Trust"))
        self.trust_btn.connect("clicked", self.on_trust_btn_clicked)
        button_box = Gtk.ButtonBox(orientation=Gtk.Orientation.HORIZONTAL)
        button_box.pack_start(self.details_btn, True, True, 0)
        button_box.pack_start(self.auth_btn, True, True, 0)
        button_box.pack_start(self.trust_btn, True, True, 0)
        button_box.set_layout(Gtk.ButtonBoxStyle.EXPAND)
        widget.pack_end(button_box, False, False, 0)
        self.add_row(widget)
        
        list_box = Gtk.ListBox()
        list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        list_box.set_header_func(self.update_header)
        generation = self.bolt_device.props.Generation
        list_box.add(build_detail_row(_("Generation"), format_generation(generation)))
        self.details_bandwidth_label = Gtk.Label(label="-")
        list_box.add(build_detail_row(_("Bandwidth"), self.details_bandwidth_label))
        dev_type = self.bolt_device.props.Type
        list_box.add(build_detail_row(_("Type"), dev_type))
        uid = self.bolt_device.props.Uid
        list_box.add(build_detail_row("Uid", uid))
        self.details_revealer = self.add_reveal_row(list_box)

        self.refresh()

    def on_trust_btn_clicked(self, widget):
        uid = self.bolt_device.props.Uid
        stored = self.bolt_device.props.Stored
        if stored:
            self.bolt_manager.forget_device(uid)
        else:
            self.bolt_manager.enroll_device(uid)

    def update_header(self, row, before):
        if before:
            row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

    def refresh(self):
        status = self.bolt_device.props.Status
        stored = self.bolt_device.props.Stored
        link_speed = None
        if hasattr(self.bolt_device.props, "LinkSpeed"):
            link_speed = self.bolt_device.props.LinkSpeed

        # Update the status label
        text = _("Disconnected")
        if status in ("connected", "authorizing", "authorized"):
            text = _("Connected")
        if status == "authorized":
            text = text + " & " + _("Authorized")
        if stored:
            text = text + ", " + _("Trusted")
        self.status_label.set_label_text(text)

        # Update which buttons are active
        if status == "connected":
            self.auth_btn.set_sensitive(True)
            self.trust_btn.set_sensitive(False)
        else:
            self.auth_btn.set_sensitive(False)
            self.trust_btn.set_sensitive(True)

        # Update trust button label
        if stored:
            self.trust_btn.set_label(_("Forget"))
        else:
            self.trust_btn.set_label(_("Trust"))

        # Update bandwidth label
        if status == "disconnected":
            self.details_bandwidth_label.set_label("-")
        else:
            if link_speed:
                speed = link_speed['tx.speed']
                lanes = link_speed['tx.lanes']
                bandwidth = "{0} Gb/s ({1} {2} @ {3} Gb/s)".format(lanes * speed, lanes, _("lanes"), speed)
                self.details_bandwidth_label.set_label(bandwidth)
            else:
                self.details_bandwidth_label.set_label("-")


class Module:
    name = "thunderbolt"
    category = "hardware"
    comment = _("Manage Thunderbolt and USB4 devices")

    def __init__(self, content_box):
        keywords = _("thunderbolt, usb, docking, station, hub, dock")
        sidePage = SidePage("Thunderbolt", "cs-thunderbolt", keywords, content_box,
                            module=self)
        self.sidePage = sidePage
        self.bolt_manager = None
        self.bolt_devices = dict()

    def on_module_selected(self, check_again=False):
        # Check if thunderbolt is present
        thunderbolt_present = os.path.isdir("/sys/bus/thunderbolt")
        # Check if bolt is installed by finding 'boltctl'
        bolt_installed = GLib.find_program_in_path("boltctl")
        # Check if bolt is available on DBus
        boltd_alive = self.test_daemon_alive()

        # Check if we've already been loaded
        if not self.loaded:

            print("Loading Thunderbolt module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
            self.sidePage.add_widget(self.sidePage.stack)

            # Init the start page
            # Intentionally blank and only used during loading
            page = SettingsPage()
            self.sidePage.stack.add_named(page, "start")

            # Init the disabled page
            page = SettingsPage()
            self.sidePage.stack.add_named(page, "disabled")
            page.set_spacing(10)
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, valign=Gtk.Align.START, margin_top=150)
            page.pack_start(box, True, True, 0)
            image = Gtk.Image(icon_name="dialog-warning-symbolic", icon_size=Gtk.IconSize.DIALOG)
            box.pack_start(image, False, False, 0)
            self.disabled_label = Gtk.Label(expand=True)
            box.pack_start(self.disabled_label, False, False, 0)
            self.disabled_retry_button = Gtk.Button(label=_("Check again"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_retry_button.connect("clicked", self.disable_retry_on_clicked)
            box.pack_start(self.disabled_retry_button, False, False, 0)

            # Init the no devices page
            page = SettingsPage()
            self.sidePage.stack.add_named(page, "empty")
            page.set_spacing(10)
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, valign=Gtk.Align.START, margin_top=150)
            page.pack_start(box, True, True, 0)
            label = Gtk.Label(label=_("No Thunderbolt or USB4 devices found."))
            box.pack_start(label, False, False, 0)

            # Init the settings page
            page = SettingsPage()
            self.sidePage.stack.add_named(page, "settings")
            page.set_spacing(10)

        show_disabled = False
        if not thunderbolt_present:
            text = _("Thunderbolt or USB4 is not detected on your system.")
            self.disabled_retry_button.set_visible(False)
            show_disabled = True
        elif not bolt_installed:
            text = _("The 'bolt' package must be installed to manage Thunderbolt and USB4 devices.")
            self.disabled_retry_button.set_visible(True)
            self.disabled_retry_button.set_sensitive(True)
            show_disabled = True
        elif not boltd_alive:
            text = _("The boltd service is not running.")
            self.disabled_retry_button.set_visible(True)
            self.disabled_retry_button.set_sensitive(True)
            show_disabled = True

        if show_disabled:
            self.reset()
            page = "disabled"
            self.disabled_label.set_markup(f"<big><b>{text}</b></big>")
        else:
            self.setup()
            page = self.page_name()

        GLib.idle_add(self.set_initial_page, page)

    def disable_retry_on_clicked(self, widget):
        self.disabled_retry_button.set_sensitive(False)
        self.on_module_selected()

    def set_initial_page(self, page):
        self.sidePage.stack.set_visible_child_name(page)

    def reset(self):
        self.bolt_manager = None
        for obj_path in list(self.bolt_devices.keys()):
            self.bolt_device_removed(obj_path, False)

    def setup(self):
        if not self.bolt_manager:
            self.bolt_manager = BoltManagerProxy()
            self.bolt_manager.on_device_added = self.bolt_device_added
            self.bolt_manager.on_device_removed = self.bolt_device_removed
        for obj_path in self.bolt_manager.list_devices():
            device = BoltDeviceProxy(obj_path)                
            # Skip the host device
            if device.props.Type == "host":
                continue
            # Add the device
            self.bolt_device_added(obj_path, False)

    def bolt_device_added(self, obj_path, change_page=True):
        if obj_path not in self.bolt_devices:
            # Build the section
            device = BoltDeviceProxy(obj_path)
            section = BoltSection(self.bolt_manager, device)
            section.show_all()
            # Add to the page
            self.bolt_devices[obj_path] = section
            page = self.sidePage.stack.get_child_by_name("settings")
            page.pack_start(section, False, False, 0)
        if change_page:
            self.sidePage.stack.set_visible_child_name(self.page_name())

    def bolt_device_removed(self, obj_path, change_page=True):
        if obj_path in self.bolt_devices:
            section = self.bolt_devices[obj_path]
            section.destroy()
            del self.bolt_devices[obj_path]
        if change_page:
            self.sidePage.stack.set_visible_child_name(self.page_name())

    def page_name(self):
        return "settings" if len(self.bolt_devices) > 0 else "empty"

    def test_daemon_alive(self):
        try:
            # Ping bolt to see if its available and running
            Gio.DBusConnection.call_sync(
                Gio.bus_get_sync(Gio.BusType.SYSTEM),
                BOLT_BUS_NAME,
                BOLT_OBJECT_PATH,
                "org.freedesktop.DBus.Peer",
                "Ping",
                None,
                None,
                0,
                -1,
                None)
            return True
        except GLib.Error as e:
            # Bolt isn't installed or service is disabled
            pass
        return False
