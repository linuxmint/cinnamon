from gi.repository import GObject

from backends.cinnamon import CinnamonBackend
from backends.x11 import X11Backend


class Backend(GObject.Object):
    """Routes screenshot calls to the cinnamon DBus backend when it is
    available, falling back to the X11 backend for full-screen captures
    otherwise. Emits 'online-changed' whenever the cinnamon service appears
    or disappears so the UI can adjust which modes are offered."""

    __gsignals__ = {
        'online-changed': (GObject.SignalFlags.RUN_LAST, None, (bool,)),
    }

    def __init__(self):
        super().__init__()
        self._cinnamon = CinnamonBackend()
        self._x11 = X11Backend()
        self._cinnamon.connect('online-changed', self._on_cinnamon_online_changed)

    def _on_cinnamon_online_changed(self, _backend, online):
        self.emit('online-changed', online)

    def is_available(self):
        return self._cinnamon.is_available()

    def _active(self):
        return self._cinnamon if self._cinnamon.is_available() else self._x11

    def screenshot(self, include_pointer, on_done):
        self._active().screenshot(include_pointer, on_done)

    def screenshot_window(self, include_pointer, include_shadow, on_done):
        self._active().screenshot_window(include_pointer, include_shadow, on_done)

    def screenshot_window_by_id(self, window_id, include_pointer, include_shadow, on_done):
        self._active().screenshot_window_by_id(window_id, include_pointer, include_shadow, on_done)

    def screenshot_area(self, x, y, w, h, include_pointer, on_done):
        self._active().screenshot_area(x, y, w, h, include_pointer, on_done)

    def flash_area(self, x, y, w, h):
        self._active().flash_area(x, y, w, h)

    def select_area(self, on_done):
        self._active().select_area(on_done)

    def select_window(self, on_done):
        self._active().select_window(on_done)
