import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gdk, GLib

from backends.base import Backend


def _grab_root(x=0, y=0, w=None, h=None):
    display = Gdk.Display.get_default()
    if display is None:
        return None
    root = display.get_default_screen().get_root_window()
    if w is None:
        w = root.get_width()
    if h is None:
        h = root.get_height()
    return Gdk.pixbuf_get_from_window(root, x, y, w, h)


def _deliver(on_done, result):
    def cb():
        on_done(result)
        return GLib.SOURCE_REMOVE
    GLib.idle_add(cb)


class X11Backend(Backend):
    """Fallback backend used when the cinnamon screenshot DBus service is
    unowned. Supports full-screen and arbitrary-rect capture (used for
    per-monitor grabs); window capture and the interactive area selector
    require the cinnamon service. include_pointer is ignored — the X11
    grab path does not overlay the cursor. Results are delivered on the
    main loop's next idle iteration so the call shape matches the async
    DBus-backed implementation."""

    def screenshot(self, include_pointer, on_done, copy_to_clipboard=False):
        _deliver(on_done, _grab_root())

    def screenshot_area(self, x, y, w, h, include_pointer, on_done, copy_to_clipboard=False):
        _deliver(on_done, _grab_root(x, y, w, h))
