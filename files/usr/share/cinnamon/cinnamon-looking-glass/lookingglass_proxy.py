import dbus
from gi.repository import Gio

LG_DBUS_NAME = "org.Cinnamon.LookingGlass"
LG_DBUS_PATH = "/org/Cinnamon/LookingGlass"


class LookingGlassProxy:

    def __init__(self):
        self._signals = []
        self._statusChangeCallbacks = []
        self._proxy = None
        Gio.bus_watch_name(Gio.BusType.SESSION, LG_DBUS_NAME, Gio.BusNameWatcherFlags.NONE, self._onConnect, self._onDisconnect)

    def addStatusChangeCallback(self, callback):
        self._statusChangeCallbacks.append(callback)

    def refreshStatus(self):
        if self._proxy != None:
            self._setStatus(True)
        else:
            self._setStatus(False)

    def getIsReady(self):
        return self._proxy != None

    def connect(self, name, callback):
        self._signals.append((name, callback))

    def _onSignal(self, proxy, sender_name, signal_name, params):
        for name, callback in self._signals:
            if signal_name == name:
                callback(*params)

    def _setStatus(self, state):
        for callback in self._statusChangeCallbacks:
            callback(state)

    def _onConnect(self, connection, name, owner):
        if self._proxy:
            return
        self._initProxy()

    def _onDisconnect(self, connection, name):
        self._proxy = None
        self._setStatus(False)

    def _initProxy(self):
        try:
            self._proxy = Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                              LG_DBUS_NAME, LG_DBUS_PATH, LG_DBUS_NAME, None, self._onProxyReady, None)
        except dbus.exceptions.DBusException as e:
            print(e)
            self._proxy = None

    def _onProxyReady(self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self._proxy.connect("g-signal", self._onSignal)
        self._setStatus(True)

# Proxy Methods:
    def Eval(self, code):
        if self._proxy:
            try:
                self._proxy.Eval('(s)', code)
            except:
                pass

    def GetResults(self):
        if self._proxy:
            try:
                return self._proxy.GetResults('()')
            except:
                pass
        return (False, "")

    def AddResult(self, code):
        if self._proxy:
            try:
                self._proxy.AddResult('(s)', code)
            except:
                pass

    def GetErrorStack(self):
        if self._proxy:
            try:
                return self._proxy.GetErrorStack('()')
            except:
                pass
        return (False, "")

    def GetMemoryInfo(self):
        if self._proxy:
            try:
                return self._proxy.GetMemoryInfo('()')
            except:
                pass
        return (False, 0, {})

    def FullGc(self):
        if self._proxy:
            try:
                self._proxy.FullGc('()')
            except:
                pass

    def Inspect(self, code):
        if self._proxy:
            try:
                return self._proxy.Inspect('(s)', code)
            except:
                pass
        return (False, "")

    def GetLatestWindowList(self):
        if self._proxy:
            try:
                return self._proxy.GetLatestWindowList('()')
            except:
                pass
        return (False, "")

    def StartInspector(self):
        if self._proxy:
            try:
                self._proxy.StartInspector('()')
            except:
                pass

    def GetExtensionList(self):
        if self._proxy:
            try:
                return self._proxy.GetExtensionList('()')
            except:
                pass
        return (False, "")

    def ReloadExtension(self, uuid, xletType):
        if self._proxy:
            try:
                return self._proxy.ReloadExtension('(ss)', uuid, xletType)
            except:
                pass
        return (False, "")
