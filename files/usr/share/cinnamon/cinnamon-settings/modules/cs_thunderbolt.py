#!/usr/bin/python3

import os

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gtk, Gio, GLib

from bin.SettingsWidgets import SidePage
from xapp.SettingsWidgets import SettingsStack, SettingsPage, SettingsSection, SettingsWidget, SettingsLabel


BOLT_BUS_NAME = "org.freedesktop.bolt"
BOLT_OBJECT_PATH = "/org/freedesktop/bolt"
BOLT_MANAGER_IFACE = "org.freedesktop.bolt1.Manager"
BOLT_DEVICE_IFACE = "org.freedesktop.bolt1.Device"


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


class DBusProperty:
    """A read-only property for use with the DBusObject class."""
    def __init__(self, dbus_name):
        self.dbus_name = dbus_name

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        variant = instance._proxy.get_cached_property(self.dbus_name)
        return variant.unpack() if variant else None


class DBusObject:
    """A wrapper class around a DBusProxy instance."""
    def __init__(self, bus_name, object_path, interface_name):
        # Save the dbus info
        self.bus_name = bus_name
        self.object_path = object_path
        self.interface_name = interface_name
        # Main proxy for DBus Object
        self._proxy = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            None,
            bus_name,
            object_path,
            interface_name,
            None)
        # List of signals that self._proxy is connected to
        self._sig_handles = []
        # Callback for when properties are changed
        self.on_property_changed = None
        # Register for future changes to properties
        self.signal_connect("g-properties-changed", self._on_g_properties_changed)

    def signal_connect(self, name, callback):
        self._sig_handles.append(self._proxy.connect(name, callback))

    def dispose(self):
        for handle in self._sig_handles:
            self._proxy.disconnect(handle)
        self._sig_handles.clear()
        self._proxy = None

    def _on_g_properties_changed(self, proxy, changed, invalidated):
        if self.on_property_changed:
            self.on_property_changed()


class BoltManager(DBusObject):
    """A DBusObject class for interacting with bolt's Manager interface."""
    def __init__(self):
        # Perform parent initialization
        super().__init__(BOLT_BUS_NAME, BOLT_OBJECT_PATH, BOLT_MANAGER_IFACE)
        # Callbacks
        self.on_device_added = None
        self.on_device_removed = None
        # Connect to g-signal for event handling
        self.signal_connect('g-signal', self._on_g_signal)

    def _on_g_signal(self, proxy, sender, signal, parameters):
        if signal == "DeviceAdded" and self.on_device_added:
            (obj_path,) = parameters.unpack()
            self.on_device_added(obj_path)
        elif signal == "DeviceRemoved" and self.on_device_removed:
            (obj_path,) = parameters.unpack()
            self.on_device_removed(obj_path)

    def ListDomains(self):
        return self._proxy.ListDomains()

    def ListDevices(self):
        return self._proxy.ListDevices()

    def EnrollDevice(self, uid):
        self._proxy.EnrollDevice('(sss)', uid, 'auto', '')

    def ForgetDevice(self, uid):
        self._proxy.ForgetDevice('(s)', uid)


class BoltDevice(DBusObject):
    """A DBusObject class for interacting with bolt's Device interface."""

    Vendor = DBusProperty("Vendor")
    Name = DBusProperty("Name")
    Generation = DBusProperty("Generation")
    Type = DBusProperty("Type")
    Uid = DBusProperty("Uid")
    Status = DBusProperty("Status")
    Stored = DBusProperty("Stored")
    LinkSpeed = DBusProperty("LinkSpeed")

    def __init__(self, obj_path):
        super().__init__(BOLT_BUS_NAME, obj_path, BOLT_DEVICE_IFACE)

    def Authorize(self):
        self._proxy.Authorize('(s)', 'auto')


class BoltSection(SettingsSection):
    def __init__(self, bolt_manager, bolt_device):
        self.bolt_manager = bolt_manager
        self.bolt_device = bolt_device
        self.bolt_device.on_property_changed = lambda: self.refresh()
        super().__init__("{0} {1}".format(bolt_device.Vendor, bolt_device.Name))

        widget = SettingsWidget()
        self.status_label = SettingsLabel()
        widget.pack_start(self.status_label, False, False, 0)
        self.details_btn = Gtk.ToggleButton(label=_("Details"))
        self.details_btn.connect("toggled", lambda w: self.details_revealer.set_reveal_child(w.get_active()))
        self.auth_btn = Gtk.Button(label=_("Authorize"))
        self.auth_btn.connect("clicked", lambda w: self.bolt_device.Authorize())
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
        generation = self.bolt_device.Generation
        list_box.add(build_detail_row(_("Generation"), format_generation(generation)))
        self.details_bandwidth_label = Gtk.Label(label="-")
        list_box.add(build_detail_row(_("Bandwidth"), self.details_bandwidth_label))
        dev_type = self.bolt_device.Type
        list_box.add(build_detail_row(_("Type"), dev_type))
        uid = self.bolt_device.Uid
        list_box.add(build_detail_row("Uid", uid))
        self.details_revealer = self.add_reveal_row(list_box)

        self.refresh()

    def on_trust_btn_clicked(self, widget):
        uid = self.bolt_device.Uid
        stored = self.bolt_device.Stored
        if stored:
            self.bolt_manager.ForgetDevice(uid)
        else:
            self.bolt_manager.EnrollDevice(uid)

    def update_header(self, row, before):
        if before:
            row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

    def refresh(self):
        status = self.bolt_device.Status
        stored = self.bolt_device.Stored
        link_speed = self.bolt_device.LinkSpeed

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
        sidePage = SidePage("Thunderbolt", "cs-thunderbolt", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.bolt_manager = None
        self.bolt_devices = dict()

    def on_module_selected(self):

        # Check if we've already been loaded
        # This is set by the SidePage class that hosts this module
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
            image = Gtk.Image(icon_name="xsi-dialog-warning-symbolic", icon_size=Gtk.IconSize.DIALOG)
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

        # Check that org.freedesktop.bolt is available on the system
        if not self.is_bolt_available():
            text = _("The %s service is missing or not activatable.") % BOLT_BUS_NAME
            self.disabled_label.set_markup(f"<big><b>{text}</b></big>")
            self.disabled_retry_button.set_visible(True)
            self.disabled_retry_button.set_sensitive(True)
            page = "disabled"
            GLib.idle_add(self.set_page, page)
            return

        # Initialilze the bolt manager
        if not self.bolt_manager:
            self.bolt_manager = BoltManager()
            self.bolt_manager.on_device_added = self.bolt_device_added
            self.bolt_manager.on_device_removed = self.bolt_device_removed

        # Check if there are any domains
        # If thunderbolt or usb4 is available, there will be 1 domain per controller
        # Each domain has a corresponding device with the same uuid
        if not self.bolt_manager.ListDomains():
            text = _("Thunderbolt or USB4 is not detected on your system.")
            self.disabled_label.set_markup(f"<big><b>{text}</b></big>")
            self.disabled_retry_button.set_visible(False)
            page = "disabled"
            GLib.idle_add(self.set_page, page)
            return

        # Setup and display the page
        self.setup()
        GLib.idle_add(self.set_page, self.page_name())

    def disable_retry_on_clicked(self, widget):
        self.disabled_retry_button.set_sensitive(False)
        GLib.idle_add(self.on_module_selected)

    def set_page(self, page):
        self.sidePage.stack.set_visible_child_name(page)

    def setup(self):
        for obj_path in self.bolt_manager.ListDevices():
            params = GLib.Variant("(ss)", (BOLT_DEVICE_IFACE, "Type"))
            var = Gio.DBusConnection.call_sync(
                Gio.bus_get_sync(Gio.BusType.SYSTEM),
                BOLT_BUS_NAME,
                obj_path,
                "org.freedesktop.DBus.Properties",
                "Get",
                params,
                GLib.VariantType("(v)"),
                0,
                -1,
                None)
            (device_type,) = var.unpack()
            if device_type == 'host':
                continue
            self.bolt_device_added(obj_path, False)

    def bolt_device_added(self, obj_path, change_page=True):
        if obj_path not in self.bolt_devices:
            # Build the section
            device = BoltDevice(obj_path)
            section = BoltSection(self.bolt_manager, device)
            section.show_all()
            # Add to the page
            self.bolt_devices[obj_path] = section
            page = self.sidePage.stack.get_child_by_name("settings")
            page.pack_start(section, False, False, 0)
        if change_page:
            GLib.idle_add(self.set_page, self.page_name())

    def bolt_device_removed(self, obj_path, change_page=True):
        if obj_path in self.bolt_devices:
            section = self.bolt_devices[obj_path]
            # Dispose of the bolt device proxy
            section.bolt_device.dispose()
            section.bolt_device = None
            # Destroy the settigs section
            section.destroy()
            # Finally - remove the settings section from the paths dict
            del self.bolt_devices[obj_path]
        if change_page:
            GLib.idle_add(self.set_page, self.page_name())

    def page_name(self):
        return "settings" if len(self.bolt_devices) > 0 else "empty"

    def is_bolt_available(self):
        try:
            var = Gio.DBusConnection.call_sync(
                Gio.bus_get_sync(Gio.BusType.SYSTEM),
                "org.freedesktop.DBus",
                "/org/freedesktop/DBus",
                "org.freedesktop.DBus",
                "ListActivatableNames",
                None,
                GLib.VariantType("(as)"),
                0,
                -1,
                None)
            (bus_names,) = var.unpack()
            return BOLT_BUS_NAME in bus_names
        except Exception as e:
            print(e)
        return False