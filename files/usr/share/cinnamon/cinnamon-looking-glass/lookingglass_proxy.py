#!/usr/bin/python3

from gi.repository import Gio, GLib, GObject

LG_DBUS_NAME = "org.Cinnamon.LookingGlass"
LG_DBUS_PATH = "/org/Cinnamon/LookingGlass"

CINNAMON_DBUS_NAME = "org.Cinnamon"
CINNAMON_DBUS_PATH = "/org/Cinnamon"

class ProxyBase(GObject.Object):
    __gsignals__ = {
        'status-changed': (GObject.SignalFlags.RUN_LAST, None, (bool, ))
    }

    def __init__(self, name, path):
        GObject.Object.__init__(self)
        self._name = name
        self._path = path
        self._proxy = None
        self.state = False
        Gio.bus_watch_name(Gio.BusType.SESSION,
                           name,
                           Gio.BusNameWatcherFlags.NONE,
                           self.on_bus_connect,
                           self.on_bus_disconnect)

    def refresh_status(self):
        self.set_status(self.get_is_ready())

    def get_is_ready(self):
        return self._proxy is not None and self._proxy.get_name_owner() is not None

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
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION,
                                      Gio.DBusProxyFlags.NONE,
                                      None,
                                      self._name,
                                      self._path,
                                      self._name,
                                      None,
                                      self.on_proxy_ready,
                                      None)
        except GLib.Error as e:
            print("Could not establish proxy with %s: %s" % (self._name, e.message))
            self._proxy = None

    def on_proxy_ready(self, obj, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self.on_proxy_created()
        self.refresh_status()

    def on_proxy_created(self):
        pass

class LookingGlassProxy(ProxyBase):
    __gsignals__ = {
        "signal": (GObject.SignalFlags.RUN_LAST | GObject.SignalFlags.DETAILED, None, ())
    }

    def __init__(self):
        ProxyBase.__init__(self, LG_DBUS_NAME, LG_DBUS_PATH)

    def on_proxy_created(self):
        self._proxy.connect("g-signal", self.on_signal)

    def prepare_signal_name(self, signal):
        out = signal[0].lower()

        for letter in signal[1:]:
            out += ("-" if letter.isupper() else "") + letter.lower()

        return "signal::" + out

    def on_signal(self, proxy, sender_name, signal_name, params):
        detailed_name = self.prepare_signal_name(signal_name)
        self.emit(detailed_name)

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

# org.Cinnamon.Eval, unlike the looking glass one, returns its result and
# does not add to the command history or the results page. It's used for
# Setting flags from the muffin debug page.
class CinnamonProxy(ProxyBase):
    def __init__(self):
        ProxyBase.__init__(self, CINNAMON_DBUS_NAME, CINNAMON_DBUS_PATH)

    def Eval(self, code):
        if self._proxy:
            try:
                return self._proxy.Eval('(s)', code)
            except Exception as e:
                print("Could not evaluate '%s': %s" % (code, e))
        return False, ""
