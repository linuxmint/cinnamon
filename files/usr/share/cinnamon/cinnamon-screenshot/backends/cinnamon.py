import os
import sys

import gi
gi.require_version('XApp', '1.0')
from gi.repository import GdkPixbuf, Gio, GLib, GObject, XApp

from backends.base import Backend


BUS_NAME = 'org.cinnamon.Screenshot'
OBJECT_PATH = '/org/cinnamon/Screenshot'
INTERFACE = 'org.cinnamon.Screenshot'


class CinnamonBackend(Backend, GObject.Object):
    __gsignals__ = {
        'online-changed': (GObject.SignalFlags.RUN_LAST, None, (bool,)),
    }

    def __init__(self):
        GObject.Object.__init__(self)
        self._proxy = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES,
            None,
            BUS_NAME, OBJECT_PATH, INTERFACE,
            None,
        )
        self._proxy.connect('notify::g-name-owner', self._on_name_owner_changed)

    def _on_name_owner_changed(self, *_args):
        self.emit('online-changed', self.is_available())

    def is_available(self):
        return self._proxy.get_name_owner() is not None

    def _tempfile(self):
        return os.path.join(XApp.get_tmp_dir(), f'cinnamon-screenshot-{os.getpid()}.png')

    def _call(self, method, params, on_result):
        """Invoke a DBus method asynchronously; deliver the unpacked
        result tuple (or None on failure) to on_result."""
        def cb(proxy, res):
            try:
                result = proxy.call_finish(res).unpack()
            except GLib.Error as exc:
                print(f'cinnamon-screenshot: DBus {method} failed: {exc.message}', file=sys.stderr)
                result = None
            on_result(result)
        self._proxy.call(method, params, Gio.DBusCallFlags.NONE, -1, None, cb)

    def _load_and_unlink(self, path):
        try:
            pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
        except GLib.Error:
            pixbuf = None
        try:
            os.unlink(path)
        except OSError:
            pass
        return pixbuf

    def _deliver_image(self, path, result, on_done):
        if not result or not result[0]:
            on_done(None)
            return
        on_done(self._load_and_unlink(result[1] or path))

    def screenshot(self, include_pointer, on_done, copy_to_clipboard=False):
        path = self._tempfile()
        self._call('Screenshot',
                   GLib.Variant('(bsb)', (include_pointer, path, copy_to_clipboard)),
                   lambda result: self._deliver_image(path, result, on_done))

    def screenshot_window(self, include_pointer, include_shadow, on_done, copy_to_clipboard=False):
        path = self._tempfile()
        self._call('ScreenshotWindow',
                   GLib.Variant('(bbsb)', (include_shadow, include_pointer, path, copy_to_clipboard)),
                   lambda result: self._deliver_image(path, result, on_done))

    def screenshot_window_by_id(self, window_id, include_pointer, include_shadow, on_done, copy_to_clipboard=False):
        path = self._tempfile()
        self._call('ScreenshotWindowById',
                   GLib.Variant('(tbbsb)', (window_id, include_shadow, include_pointer, path, copy_to_clipboard)),
                   lambda result: self._deliver_image(path, result, on_done))

    def screenshot_area(self, x, y, w, h, include_pointer, on_done, copy_to_clipboard=False):
        path = self._tempfile()
        self._call('ScreenshotArea',
                   GLib.Variant('(iiiibsb)', (x, y, w, h, include_pointer, path, copy_to_clipboard)),
                   lambda result: self._deliver_image(path, result, on_done))

    def select_area(self, on_done):
        self._call('SelectArea', None,
                   lambda result: on_done(tuple(result) if result else None))

    def select_window(self, on_done):
        self._call('SelectWindow', None,
                   lambda result: on_done(result[0] if result else None))
