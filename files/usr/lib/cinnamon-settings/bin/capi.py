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
import gi
import ctypes
from ctypes import *

gio = CDLL("libgio-2.0.so.0")
libgobject = CDLL('libgobject-2.0.so.0')
ext_point = gio.g_io_extension_point_register ("cinnamon-control-center-1")
modules = gio.g_io_modules_load_all_in_directory ("/usr/lib/cinnamon-control-center-1/panels")

class _PyGObject_Functions(ctypes.Structure):
   _fields_ = [
       ('register_class',
        ctypes.PYFUNCTYPE(ctypes.c_void_p, ctypes.c_char_p,
                          ctypes.c_int, ctypes.py_object,
                          ctypes.py_object)),
       ('register_wrapper',
        ctypes.PYFUNCTYPE(ctypes.c_void_p, ctypes.py_object)),
       ('lookup_class',
        ctypes.PYFUNCTYPE(ctypes.py_object, ctypes.c_int)),
       ('newgobj',
        ctypes.PYFUNCTYPE(ctypes.py_object, ctypes.c_void_p)),
       ]

class PyGObjectCPAI(object):
    def __init__(self):
        PyCObject_AsVoidPtr = ctypes.pythonapi.PyCObject_AsVoidPtr
        PyCObject_AsVoidPtr.restype = ctypes.c_void_p
        PyCObject_AsVoidPtr.argtypes = [ctypes.py_object]
        addr = PyCObject_AsVoidPtr(ctypes.py_object(
           gi._gobject._PyGObject_API))
        self._api = _PyGObject_Functions.from_address(addr)

    def pygobject_new(self, addr):
        return self._api.newgobj(addr)

def get_c_widget(mod_id):
    extension = gio.g_io_extension_point_get_extension_by_name (ext_point, mod_id)
    if extension == 0:
        print "Problem occurred loading cinnamon-control-center module: " + mod_id
        return None
    gio.g_io_extension_get_type.restype = c_int
    panel_type = gio.g_io_extension_get_type (extension)
    libgobject.g_object_new.restype = ctypes.POINTER(ctypes.py_object)
    ptr = libgobject.g_object_new(panel_type, None)
    return PyGObjectCPAI().pygobject_new(ptr)

