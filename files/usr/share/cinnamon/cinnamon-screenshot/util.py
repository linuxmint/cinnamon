import os
import sys

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gdk, Gio, GLib, Gtk


_FILE_MANAGER1_BUS = 'org.freedesktop.FileManager1'
_FILE_MANAGER1_PATH = '/org/freedesktop/FileManager1'

_PIXBUF_FORMAT_FOR_EXT = {
    '.png':  ('png',  []),
    '.jpg':  ('jpeg', [('quality', '95')]),
    '.jpeg': ('jpeg', [('quality', '95')]),
    '.bmp':  ('bmp',  []),
    '.tif':  ('tiff', []),
    '.tiff': ('tiff', []),
}

def format_for_path(path):
    ext = os.path.splitext(path)[1].lower()
    return _PIXBUF_FORMAT_FOR_EXT.get(ext, _PIXBUF_FORMAT_FOR_EXT['.png'])

def save_pixbuf(pixbuf, path):
    fmt, options = format_for_path(path)
    keys = [k for k, _ in options]
    values = [v for _, v in options]
    pixbuf.savev(path, fmt, keys, values)

def copy_pixbuf_to_clipboard(pixbuf):
    clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
    clipboard.set_image(pixbuf)
    clipboard.store()

def monitor_rect(idx):
    """Return (x, y, w, h) of the monitor at the given index, or None if
    the index is out of range or there's only one monitor (caller should
    treat that as 'use the whole screen')."""
    if idx is None:
        return None
    display = Gdk.Display.get_default()
    if display is None:
        return None
    n = display.get_n_monitors()
    if n <= 1 or idx < 0 or idx >= n:
        return None
    geom = display.get_monitor(idx).get_geometry()
    return (geom.x, geom.y, geom.width, geom.height)

def monitor_rect_for_window(gdk_window):
    """Return (x, y, w, h) of the monitor the given GdkWindow is on,
    or None if it can't be determined."""
    if gdk_window is None:
        return None
    display = Gdk.Display.get_default()
    if display is None:
        return None
    monitor = display.get_monitor_at_window(gdk_window)
    if monitor is None:
        return None
    geom = monitor.get_geometry()
    return (geom.x, geom.y, geom.width, geom.height)

def build_filename(directory, file_type='png'):
    """Build a 'Screenshot <iso-timestamp>.<ext>' path inside directory.
    Caller is responsible for passing an existing directory."""
    timestamp = GLib.DateTime.new_now_local().format('%Y-%m-%d %H-%M-%S.%f')[:-3]
    return os.path.join(directory, f'{_("Screenshot")} {timestamp}.{file_type}')

def show_in_file_manager(uri):
    f = Gio.File.new_for_uri(uri)
    is_dir = False
    try:
        info = f.query_info(Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
                            Gio.FileQueryInfoFlags.NONE, None)
        is_dir = info.get_file_type() == Gio.FileType.DIRECTORY
    except GLib.Error:
        pass

    if not is_dir:
        try:
            bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
            bus.call_sync(
                _FILE_MANAGER1_BUS, _FILE_MANAGER1_PATH, _FILE_MANAGER1_BUS,
                'ShowItems',
                GLib.Variant('(ass)', ([uri], '')),
                None, Gio.DBusCallFlags.NONE, -1, None,
            )
            return
        except GLib.Error:
            pass

    target = uri if is_dir else (f.get_parent() or f).get_uri()
    try:
        Gio.AppInfo.launch_default_for_uri(target, None)
    except GLib.Error as exc:
        print(f'cinnamon-screenshot: failed to open file manager: {exc.message}',
              file=sys.stderr)
