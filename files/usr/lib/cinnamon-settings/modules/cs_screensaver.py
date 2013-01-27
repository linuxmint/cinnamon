#!/usr/bin/env python

import os
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        sidePage = SidePage(_("Screensaver & Brightness"), "screensaver.svg", content_box)
        self.sidePage = sidePage
        self.name = "screensaver"
        self.category = "prefs"
        if os.path.exists("/usr/bin/cinnamon-screensaver-command"):
            sidePage.add_widget(GSettingsCheckButton(_("Ask for an away message when locking the screen from the menu"), "org.cinnamon.screensaver", "ask-for-away-message", None))
            sidePage.add_widget(GSettingsEntry(_("Default message"), "org.cinnamon.screensaver", "default-message", None))

        extension = gio.g_io_extension_point_get_extension_by_name (ext_point, "cinnamon-screen")
        if extension == 0:
            print "Problem occurred loading cinnamon-control-center module: cinnamon-screen"
            return
        self.sidePage.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        gio.g_io_extension_get_type.restype = c_int
        panel_type = gio.g_io_extension_get_type (extension)
        libgobject.g_object_new.restype = ctypes.POINTER(ctypes.py_object)
        ptr = libgobject.g_object_new(panel_type, None)
        widget = c_api.pygobject_new(ptr)
        self.sidePage.add_widget(widget)

