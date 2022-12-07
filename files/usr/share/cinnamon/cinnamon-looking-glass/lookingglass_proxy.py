#!/usr/bin/python3

from gi.repository import Gio

LG_DBUS_NAME = "org.Cinnamon.LookingGlass"
LG_DBUS_PATH = "/org/Cinnamon/LookingGlass"


class LookingGlassProxy:
    def __init__(self):
        self._signals = []
        self._status_change_callbacks = []
        self._proxy = None
        Gio.bus_watch_name(Gio.BusType.SESSION,
                           LG_DBUS_NAME,
                           Gio.BusNameWatcherFlags.NONE,
                           self.on_connect,
                           self.on_disconnect)

    def add_status_change_callback(self, callback):
        self._status_change_callbacks.append(callback)

    def refresh_status(self):
        self.set_status(self._proxy is not None)

    def get_is_ready(self):
        return self._proxy is not None

    def connect(self, name, callback):
        self._signals.append((name, callback))

    def on_signal(self, proxy, sender_name, signal_name, params):
        for name, callback in self._signals:
            if signal_name == name:
                callback(*params)

    def set_status(self, state):
        for callback in self._status_change_callbacks:
            callback(state)

    def on_connect(self, connection, name, owner):
        if self._proxy:
            return
        self.init_proxy()

    def on_disconnect(self, connection, name):
        self._proxy = None
        self.set_status(False)

    def init_proxy(self):
        try:
            self._proxy = Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION,
                                                    Gio.DBusProxyFlags.NONE,
                                                    None,
                                                    LG_DBUS_NAME,
                                                    LG_DBUS_PATH,
                                                    LG_DBUS_NAME,
                                                    None,
                                                    self.on_proxy_ready,
                                                    None)
        except GLib.Error as e:
            print(e.message)
            self._proxy = None

    def on_proxy_ready(self, obj, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self._proxy.connect("g-signal", self.on_signal)
        self.set_status(True)

# Proxy Methods:
    def Eval(self, code):
        if self._proxy:
            try:
                self._proxy.Eval('(s)', code)
            except Exception:
                pass

    def GetResults(self):
        if self._proxy:
            try:
                return self._proxy.GetResults('()')
            except Exception:
                pass
        return False, ""

    def AddResult(self, code):
        if self._proxy:
            try:
                self._proxy.AddResult('(s)', code)
            except Exception:
                pass

    def GetErrorStack(self):
        if self._proxy:
            try:
                return self._proxy.GetErrorStack('()')
            except Exception:
                pass
        return False, ""

    def GetMemoryInfo(self):
        if self._proxy:
            try:
                return self._proxy.GetMemoryInfo('()')
            except Exception:
                pass
        return False, 0, {}

    def FullGc(self):
        if self._proxy:
            try:
                self._proxy.FullGc('()')
            except Exception:
                pass

    def Inspect(self, code):
        if self._proxy:
            try:
                return self._proxy.Inspect('(s)', code)
            except Exception:
                pass
        return False, ""

    def GetLatestWindowList(self):
        if self._proxy:
            try:
                return self._proxy.GetLatestWindowList('()')
            except Exception:
                pass
        return False, ""

    def StartInspector(self):
        if self._proxy:
            try:
                self._proxy.StartInspector('()')
            except Exception:
                pass

    def GetExtensionList(self):
        if self._proxy:
            try:
                return self._proxy.GetExtensionList('()')
            except Exception:
                pass
        return False, ""

    def ReloadExtension(self, uuid, xlet_type):
        if self._proxy:
            try:
                return self._proxy.ReloadExtension('(ss)', uuid, xlet_type)
            except Exception:
                pass
        return False, ""
