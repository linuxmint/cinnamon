# Copyright (C) 2007-2010 www.stani.be
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see http://www.gnu.org/licenses/

from gi.repository import Gio, GObject
import platform
import os

def get_multiarch_root():
    plat = platform.machine()

    try_path = "/usr/lib/%s/cinnamon-control-center-1/panels" % plat
    if os.path.exists(try_path):
        return try_path

    try_path = "/usr/lib/%s-linux-gnu/cinnamon-control-center-1/panels" % plat
    if os.path.exists(try_path):
        return try_path

    raise Exception("Could not find cinnamon-control-center module location")

class CManager():
    def __init__(self):
        self.extension_point = Gio.io_extension_point_register ("cinnamon-control-center-1")
        self.modules = []

        try:
            multiarch_folder = get_multiarch_root()
            self.modules = self.modules + Gio.io_modules_load_all_in_directory(multiarch_folder)
        except Exception, e:
            print "capi failed to load multiarch modules:", e
            pass

        try:
            self.modules = self.modules + Gio.io_modules_load_all_in_directory("/usr/lib/cinnamon-control-center-1/panels")
        except Exception, e:
            print "capi failed to load non-multiarch modules:", e
            pass

    def get_c_widget(self, mod_id):
        extension = self.extension_point.get_extension_by_name(mod_id)
        if extension is None:
            print("Could not load %s module; is the cinnamon-control-center package installed?" % mod_id)
            return None
        panel_type = extension.get_type()
        return GObject.new(panel_type)

    def lookup_c_module(self, mod_id):
        extension = self.extension_point.get_extension_by_name(mod_id)
        if extension is None:
            print("Could not find %s module; is the cinnamon-control-center package installed?" % mod_id)
            return False
        else:
            return True