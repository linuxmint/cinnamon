#!/usr/bin/python3

from gi.repository import GLib, Gio
import sys
import signal
import shlex
import argparse
import gettext
from subprocess import Popen, DEVNULL
from enum import IntEnum

signal.signal(signal.SIGINT, signal.SIG_DFL)
gettext.install("cinnamon", "/usr/share/locale")

# DBus interface constants
SS_SERVICE = "org.cinnamon.ScreenSaver"
SS_PATH = "/org/cinnamon/ScreenSaver"
SS_INTERFACE = "org.cinnamon.ScreenSaver"

class Action(IntEnum):
    EXIT = 1
    QUERY = 2
    TIME = 3
    LOCK = 4
    ACTIVATE = 5
    DEACTIVATE = 6
    VERSION = 7

class ScreensaverCommand:
    """
    Standalone executable for controlling the screensaver via DBus.
    Supports both internal (Main.screenShield) and external (cinnamon-screensaver) modes.
    """
    def __init__(self, mainloop):
        self.mainloop = mainloop
        self.proxy = None

        parser = argparse.ArgumentParser(description='Cinnamon Screensaver Command')
        parser.add_argument('--exit', '-e', dest="action_id", action='store_const', const=Action.EXIT,
                            help=_('Causes the screensaver to exit gracefully'))
        parser.add_argument('--query', '-q', dest="action_id", action='store_const', const=Action.QUERY,
                            help=_('Query the state of the screensaver'))
        parser.add_argument('--time', '-t', dest="action_id", action='store_const', const=Action.TIME,
                            help=_('Query the length of time the screensaver has been active'))
        parser.add_argument('--lock', '-l', dest="action_id", action='store_const', const=Action.LOCK,
                            help=_('Tells the running screensaver process to lock the screen immediately'))
        parser.add_argument('--activate', '-a', dest="action_id", action='store_const', const=Action.ACTIVATE,
                            help=_('Turn the screensaver on (blank the screen)'))
        parser.add_argument('--deactivate', '-d', dest="action_id", action='store_const', const=Action.DEACTIVATE,
                            help=_('If the screensaver is active then deactivate it (un-blank the screen)'))
        parser.add_argument('--version', '-V', dest="action_id", action='store_const', const=Action.VERSION,
                            help=_('Version of this application'))
        parser.add_argument('--away-message', '-m', dest="message", action='store', default="",
                            help=_('Message to be displayed in lock screen'))
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

        ss_settings = Gio.Settings.new("org.cinnamon.desktop.screensaver")
        custom_saver = ss_settings.get_string("custom-screensaver-command").strip()
        if custom_saver:
            self._handle_custom_saver(custom_saver)
            quit()

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

    def _handle_custom_saver(self, custom_saver):
        if self.action_id in (Action.LOCK, Action.ACTIVATE):
            try:
                Popen(shlex.split(custom_saver), stdin=DEVNULL)
            except OSError as e:
                print("Error %d running %s: %s" % (e.errno, custom_saver, e.strerror))
        else:
            print("Action not supported with custom screensaver.")

    def _on_proxy_ready(self, source, result):
        try:
            self.proxy = Gio.DBusProxy.new_for_bus_finish(result)
            self.perform_action()
        except GLib.Error as e:
            print("Can't connect to screensaver: %s" % e.message)
            self.mainloop.quit()

    def perform_action(self):
        try:
            if self.action_id == Action.EXIT:
                self.proxy.call_sync(
                    'Quit',
                    None,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )

            elif self.action_id == Action.QUERY:
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

            elif self.action_id == Action.TIME:
                result = self.proxy.call_sync(
                    'GetActiveTime',
                    None,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )
                if result:
                    time = result.unpack()[0]
                    if time == 0:
                        print(_("The screensaver is not currently active.\n"))
                    else:
                        print(gettext.ngettext(
                            "The screensaver has been active for %d second.\n",
                            "The screensaver has been active for %d seconds.\n",
                            time
                        ) % time)

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
