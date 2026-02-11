#!/usr/bin/python3

from gi.repository import GLib, Gio
import sys
import signal
import argparse
import gettext
from enum import IntEnum

signal.signal(signal.SIGINT, signal.SIG_DFL)
gettext.install("cinnamon", "/usr/share/locale")

# DBus interface constants
SS_SERVICE = "org.cinnamon.ScreenSaver"
SS_PATH = "/org/cinnamon/ScreenSaver"
SS_INTERFACE = "org.cinnamon.ScreenSaver"

class Action(IntEnum):
    QUERY = 1
    LOCK = 2
    ACTIVATE = 3
    DEACTIVATE = 4
    VERSION = 5

class ScreensaverCommand:
    """
    Standalone executable for controlling the screensaver via DBus.
    Supports both internal (Main.screenShield) and external (cinnamon-screensaver) modes.
    """
    def __init__(self, mainloop):
        self.mainloop = mainloop
        self.proxy = None

        parser = argparse.ArgumentParser(description='Cinnamon Screensaver Command')
        parser.add_argument('--query', '-q', dest="action_id", action='store_const', const=Action.QUERY,
                            help=_('Query the state of the screensaver'))
        parser.add_argument('--lock', '-l', dest="action_id", action='store_const', const=Action.LOCK,
                            help=_('Lock the screen immediately'))
        parser.add_argument('--activate', '-a', dest="action_id", action='store_const', const=Action.ACTIVATE,
                            help=_('Turn the screensaver on (blank the screen)'))
        parser.add_argument('--deactivate', '-d', dest="action_id", action='store_const', const=Action.DEACTIVATE,
                            help=_('Deactivate the screensaver (un-blank the screen)'))
        parser.add_argument('--version', '-V', dest="action_id", action='store_const', const=Action.VERSION,
                            help=_('Version of this application'))
        parser.add_argument('--away-message', '-m', dest="message", action='store', default="",
                            help=_('Message to display in lock screen'))
        args = parser.parse_args()

        if not args.action_id:
            parser.print_help()
            quit()

        if args.action_id == Action.VERSION:
            # Get version from cinnamon
            try:
                version_proxy = Gio.DBusProxy.new_for_bus_sync(
                    Gio.BusType.SESSION,
                    Gio.DBusProxyFlags.NONE,
                    None,
                    'org.Cinnamon',
                    '/org/Cinnamon',
                    'org.Cinnamon',
                    None
                )
                version = version_proxy.get_cached_property('CinnamonVersion')
                if version:
                    print("cinnamon-screensaver-command (Cinnamon %s)" % version.unpack())
                else:
                    print("cinnamon-screensaver-command (Cinnamon version unknown)")
            except:
                print("cinnamon-screensaver-command")
            quit()

        self.action_id = args.action_id
        self.message = args.message

        # Create DBus proxy
        Gio.DBusProxy.new_for_bus(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.NONE,
            None,
            SS_SERVICE,
            SS_PATH,
            SS_INTERFACE,
            None,
            self._on_proxy_ready
        )

    def _on_proxy_ready(self, source, result):
        try:
            self.proxy = Gio.DBusProxy.new_for_bus_finish(result)
            self.perform_action()
        except GLib.Error as e:
            print("Can't connect to screensaver: %s" % e.message)
            self.mainloop.quit()

    def perform_action(self):
        try:
            if self.action_id == Action.QUERY:
                result = self.proxy.call_sync(
                    'GetActive',
                    None,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )
                if result:
                    is_active = result.unpack()[0]
                    if is_active:
                        print(_("The screensaver is active\n"))
                    else:
                        print(_("The screensaver is inactive\n"))

            elif self.action_id == Action.LOCK:
                self.proxy.call_sync(
                    'Lock',
                    GLib.Variant('(s)', (self.message,)),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )

            elif self.action_id == Action.ACTIVATE:
                self.proxy.call_sync(
                    'SetActive',
                    GLib.Variant('(b)', (True,)),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )

            elif self.action_id == Action.DEACTIVATE:
                self.proxy.call_sync(
                    'SetActive',
                    GLib.Variant('(b)', (False,)),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )

        except GLib.Error as e:
            print("Error executing command: %s" % e.message)

        self.mainloop.quit()

if __name__ == "__main__":
    ml = GLib.MainLoop.new(None, True)
    main = ScreensaverCommand(ml)
    ml.run()
