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

class CManager():
    def __init__(self):
        self.extension_point = Gio.io_extension_point_register ("cinnamon-control-center-1")
        self.modules = []

        architecture = platform.machine()
        paths = ["/usr/lib"]

        # On x86 archs, iterate through multiple paths
        # For instance, on a Mint i686 box, the path is actually /usr/lib/i386-linux-gnu
        x86archs = ["i386", "i486", "i586", "i686"]
        if architecture in x86archs:
            for arch in x86archs:
                paths += ["/usr/lib/%s" % arch, "/usr/lib/%s-linux-gnu" % arch]
        elif architecture == "x86_64":
            paths += ["/usr/lib/x86_64", "/usr/lib/x86_64-linux-gnu", "/usr/lib64"]
        else:
            paths += ["/usr/lib/%s" % architecture, "/usr/lib/%s-linux-gnu" % architecture]

        for path in paths:
            path = os.path.join(path, "cinnamon-control-center-1/panels")
            if os.path.exists(path):
                try:
                    self.modules = self.modules + Gio.io_modules_load_all_in_directory(path)
                except Exception, e:
                    print "capi failed to load multiarch modules from %s: " % path, e

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