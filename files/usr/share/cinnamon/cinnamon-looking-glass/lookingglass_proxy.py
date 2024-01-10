#!/usr/bin/python3

from gi.repository import Gio, GObject

LG_DBUS_NAME = "org.Cinnamon.LookingGlass"
LG_DBUS_PATH = "/org/Cinnamon/LookingGlass"

class LookingGlassProxy(GObject.Object):
    __gsignals__ = {
        'status-changed': (GObject.SignalFlags.RUN_LAST, None, (bool, )),
        "signal": (GObject.SignalFlags.RUN_LAST | GObject.SignalFlags.DETAILED, None, ())
    }

    def __init__(self):
        GObject.Object.__init__(self)
        self._proxy = None
        self.state = False
        Gio.bus_watch_name(Gio.BusType.SESSION,
                           LG_DBUS_NAME,
                           Gio.BusNameWatcherFlags.NONE,
                           self.on_bus_connect,
                           self.on_bus_disconnect)

    def refresh_status(self):
        self.set_status(self.get_is_ready())

    def get_is_ready(self):
        return self._proxy is not None and self._proxy.get_name_owner() is not None

    def prepare_signal_name(self, signal):
        out = signal[0].lower()

        for letter in signal[1:]:
            out += ("-" if letter.isupper() else "") + letter.lower()

        return "signal::" + out

    def on_signal(self, proxy, sender_name, signal_name, params):
        detailed_name = self.prepare_signal_name(signal_name)
        self.emit(detailed_name)

    def set_status(self, state):
        if state != self.state:
            self.state = state
            self.emit("status-changed", state)

    def on_bus_connect(self, connection, name, owner):
        if self._proxy:
            return
        self.init_proxy()

    def on_bus_disconnect(self, connection, name):
        self._proxy = None
        self.refresh_status()

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
            print("Could not establish proxy with Cinnamon looking-glass interface: %s" % e.message)
            self._proxy = None

    def on_proxy_ready(self, obj, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self._proxy.connect("g-signal", self.on_signal)
        self.refresh_status()

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

    def GetErrorStack(self, result_cb):
        if self._proxy:
            try:
                self._proxy.GetErrorStack('()', result_handler=result_cb, error_handler=self._get_error_stack_error_cb)
            except Exception:
                pass

    def _get_error_stack_error_cb(self, proxy, error):
        print("Couldn't fetch the error stack: %s" % error.message)

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

    def Inspect(self, code, result_cb, user_data=None):
        if self._proxy:
            try:
                self._proxy.Inspect('(s)', code, result_handler=result_cb, error_handler=self._inspect_error_cb, user_data=user_data)
            except Exception as e:
                print(e)

    def _inspect_error_cb(self, proxy, error):
        print("Couldn't inspect element: %s" % error.message)

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
