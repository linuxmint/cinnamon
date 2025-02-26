#!/usr/bin/python3

import os

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gtk, Gio, GLib

from SettingsWidgets import SidePage
from xapp.SettingsWidgets import SettingsStack, SettingsPage

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
            setattr(self.props, key, None)
            if self.on_property_invalidated:
                self.on_property_invalidated(key)

class BoltManagerProxy(DBusProxy):
    def __init__(self):
        # Perform parent initialization
        super().__init__(
            "org.freedesktop.bolt",
            "/org/freedesktop/bolt",
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
            "org.freedesktop.bolt",
            obj_path,
            "org.freedesktop.bolt1.Device"
            )

    def authorize(self):
        self._proxy.Authorize('(s)', 'auto')

class Module:
    name = "thunderbolt"
    category = "hardware"
    comment = _("Manage Thunderbolt™ and USB4 devices")

    def __init__(self, content_box):
        keywords = _("thunderbolt")
        sidePage = SidePage("Thunderbolt™", "csd-thunderbolt", keywords, content_box,
                            module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        # Check if thunderbolt is present
        thunderbolt_present =  os.path.isdir("/sys/bus/thunderbolt")
        # check if bolt is installed
        # boltctl is part of the bolt package
        bolt_installed = GLib.find_program_in_path("boltctlx")

        print("thunderbolt_present", thunderbolt_present)
        print("bolt_installed", bolt_installed)

        # Check if we've already been loaded
        if not self.loaded:

            print("Loading Thunderbolt module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

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
            box.pack_start(self.disabled_retry_button, False, False, 0)

        self.disabled_retry_button.set_visible(False)

        # TODO check for whether to display Thuderbolt settings page
        # 1) Is there a thunderbolt bus?        
        # 2) Is bolt service installed?
        show_disabled = False
        if not thunderbolt_present:
            text = _("No Thunderbolt™ or USB4 detected on your system.")
            show_disabled = True
        elif not bolt_installed:
            text = _("The 'bolt' package must be installed to manage Thunderbolt™ and USB4 devices.")
            self.disabled_retry_button.set_visible(True)
            show_disabled = True

        if show_disabled:
            self.disabled_label.set_markup(f"<big><b>{text}</b></big>")
            page = "disabled"
        else:
            page = "disabled" # TODO - show the actual settings page

        self.sidePage.stack.set_transition_type(Gtk.StackTransitionType.NONE)

        GLib.idle_add(self.set_initial_page, page)

    def set_initial_page(self, page):
        self.sidePage.stack.set_visible_child_full(page, Gtk.StackTransitionType.CROSSFADE)
