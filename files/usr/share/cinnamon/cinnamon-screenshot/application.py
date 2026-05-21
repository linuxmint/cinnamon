import argparse
import gettext
import sys

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, GLib, Gtk

import screenshot_backend
import prefs
import util

gettext.install('cinnamon', '/usr/share/locale')


class ScreenshotApplication(Gtk.Application):
    def __init__(self, args):
        super().__init__(
            application_id='org.cinnamon.Screenshot',
            flags=Gio.ApplicationFlags.NON_UNIQUE,
        )
        self.args = args
        self.backend = screenshot_backend.Backend()
        self._exit_code = 0

    def do_activate(self):
        args = self.args
        if args.clipboard:
            self._run_clipboard()
        elif args.file and not args.interactive:
            self._run_save_to_file(args.file)
        else:
            self._run_window()

    def _resolve_mode(self):
        if self.args.window:
            return 'window'
        if self.args.area:
            return 'area'
        if self.args.monitor is not None:
            return 'monitor'
        return 'screen'

    def capture(self, mode, include_pointer, include_shadow, delay, on_done, area_rect=None):
        # Monitor mode and area mode both end up calling screenshot_area,
        # which both grabs and flashes the captured rect on the server side.
        # Area mode without a rect runs the selector first to get one.
        def do_capture():
            if area_rect is not None:
                x, y, w, h = area_rect
                self.backend.screenshot_area(x, y, w, h, include_pointer, on_done)
            elif mode == 'window':
                self.backend.screenshot_window(include_pointer, include_shadow, on_done)
            else:
                self.backend.screenshot(include_pointer, on_done)
            return GLib.SOURCE_REMOVE

        def schedule(fn):
            if delay > 0:
                GLib.timeout_add_seconds(delay, fn)
            else:
                GLib.idle_add(fn)

        if mode == 'area' and area_rect is None:
            def after_select(rect):
                nonlocal area_rect
                if rect is None:
                    on_done(None)
                    return
                area_rect = rect
                schedule(do_capture)
            self.backend.select_area(after_select)
        else:
            schedule(do_capture)

    def _run_window(self):
        from main_window import MainWindow
        win = MainWindow(self)
        win.run()

    def _run_clipboard(self):
        self.hold()
        mode = self._resolve_mode()
        area_rect = None
        if mode == 'monitor':
            area_rect = util.monitor_rect(self.args.monitor)
            if area_rect is None:
                mode = 'screen'
        include_pointer = self.args.include_pointer or prefs.get_include_pointer()
        include_shadow = self.args.include_shadow or prefs.get_include_shadow()
        delay = self.args.delay if self.args.delay is not None else 0

        def done(pixbuf):
            if pixbuf is not None:
                util.copy_pixbuf_to_clipboard(pixbuf)
                GLib.idle_add(self._finish_clipboard)
            else:
                self._exit_code = 1
                self.release()
                self.quit()

        self.capture(mode, include_pointer, include_shadow, delay, done, area_rect=area_rect)

    def _finish_clipboard(self):
        self.release()
        self.quit()
        return GLib.SOURCE_REMOVE

    def _run_save_to_file(self, path):
        self.hold()
        mode = self._resolve_mode()
        area_rect = None
        if mode == 'monitor':
            area_rect = util.monitor_rect(self.args.monitor)
            if area_rect is None:
                mode = 'screen'
        include_pointer = self.args.include_pointer or prefs.get_include_pointer()
        include_shadow = self.args.include_shadow or prefs.get_include_shadow()
        delay = self.args.delay if self.args.delay is not None else 0

        def done(pixbuf):
            if pixbuf is not None:
                try:
                    util.save_pixbuf(pixbuf, path)
                except Exception as exc:
                    print(f'cinnamon-screenshot: save failed: {exc}', file=sys.stderr)
                    self._exit_code = 1
            else:
                self._exit_code = 1
            self.release()
            self.quit()

        self.capture(mode, include_pointer, include_shadow, delay, done, area_rect=area_rect)

    @property
    def exit_code(self):
        return self._exit_code


def _build_arg_parser():
    parser = argparse.ArgumentParser(
        prog='cinnamon-screenshot',
        description='Take screenshots of your screen, windows, or selected areas',
        add_help=True,
    )
    parser.add_argument('-c', '--clipboard', action='store_true',
                        help='Send the grab directly to the clipboard')
    parser.add_argument('-w', '--window', action='store_true',
                        help='Grab the active window instead of the entire screen')
    parser.add_argument('-a', '--area', action='store_true',
                        help='Grab a selected area of the screen')
    parser.add_argument('-m', '--monitor', type=int, default=None, metavar='INDEX',
                        help='Grab a specific monitor by 0-based index')
    parser.add_argument('-p', '--include-pointer', action='store_true',
                        help='Include the pointer in the screenshot')
    parser.add_argument('-s', '--include-shadow', action='store_true',
                        help='Include the window shadow when grabbing a window')
    parser.add_argument('-d', '--delay', type=int, default=None, metavar='SECONDS',
                        help='Take the screenshot after a delay')
    parser.add_argument('-i', '--interactive', action='store_true',
                        help='Interactively set options before taking the screenshot')
    parser.add_argument('-f', '--file', metavar='PATH',
                        help='Save the screenshot directly to PATH')
    return parser

def main():
    parser = _build_arg_parser()
    args = parser.parse_args()

    if args.window and args.area:
        parser.error('cannot combine --window and --area')
    if args.monitor is not None and (args.window or args.area):
        parser.error('--monitor cannot be combined with --window or --area')
    if args.include_shadow and not args.window:
        parser.error('--include-shadow requires --window')
    if args.interactive and (args.delay is not None or args.include_pointer or args.include_shadow):
        parser.error('--interactive cannot be combined with --delay, --include-pointer, or --include-shadow')

    app = ScreenshotApplication(args)
    app.run([])
    return app.exit_code
