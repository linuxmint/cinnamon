# -*- coding: utf-8 -*-
#   Alacarte Menu Editor - Simple fd.o Compliant Menu Editor
#   Copyright (C) 2006  Travis Watkins
#
#   This library is free software; you can redistribute it and/or
#   modify it under the terms of the GNU Library General Public
#   License as published by the Free Software Foundation; either
#   version 2 of the License, or (at your option) any later version.
#
#   This library is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
#   Library General Public License for more details.
#
#   You should have received a copy of the GNU Library General Public
#   License along with this library; if not, write to the Free Software
#   Foundation, Inc., 51 Franklin Street, Suite 500, Boston, MA  02110-1335  USA

import os
import xml.dom.minidom
import uuid
import sys
if sys.version_info[:2] >= (3, 8):
    from collections.abc import Sequence
else:
    from collections import Sequence
from gi.repository import Gtk, GdkPixbuf, CMenu, GLib, Gdk

DESKTOP_GROUP = GLib.KEY_FILE_DESKTOP_GROUP
KEY_FILE_FLAGS = GLib.KeyFileFlags.KEEP_COMMENTS | GLib.KeyFileFlags.KEEP_TRANSLATIONS

def fillKeyFile(keyfile, items):
    for key, item in items.items():
        if item is None:
            continue

        if isinstance(item, bool):
            keyfile.set_boolean(DESKTOP_GROUP, key, item)
        elif isinstance(item, str):
            keyfile.set_string(DESKTOP_GROUP, key, item)
        elif isinstance(item, Sequence):
            keyfile.set_string_list(DESKTOP_GROUP, key, item)

def getNameFromKeyFile(keyfile):
    return keyfile.get_string(DESKTOP_GROUP, "Name")

def getUniqueFileId(name, extension):
    while 1:
        filename = name + '-' + str(uuid.uuid1()) + extension
        if extension == '.desktop':
            path = getUserItemPath()
            if not os.path.isfile(os.path.join(path, filename)) and not getItemPath(filename):
                break
        elif extension == '.directory':
            path = getUserDirectoryPath()
            if not os.path.isfile(os.path.join(path, filename)) and not getDirectoryPath(filename):
                break
    return filename

def getUniqueRedoFile(filepath):
    while 1:
        new_filepath = filepath + '.redo-' + str(uuid.uuid1())
        if not os.path.isfile(new_filepath):
            break
    return new_filepath

def getUniqueUndoFile(filepath):
    filename, extension = os.path.split(filepath)[1].rsplit('.', 1)
    while 1:
        if extension == 'desktop':
            path = getUserItemPath()
        elif extension == 'directory':
            path = getUserDirectoryPath()
        elif extension == 'menu':
            path = getUserMenuPath()
        new_filepath = os.path.join(path, filename + '.' + extension + '.undo-' + str(uuid.uuid1()))
        if not os.path.isfile(new_filepath):
            break
    return new_filepath

def getItemPath(file_id):
    for path in GLib.get_system_data_dirs():
        file_path = os.path.join(path, 'applications', file_id)
        if os.path.isfile(file_path):
            return file_path
    return None

def getUserItemPath():
    item_dir = os.path.join(GLib.get_user_data_dir(), 'applications')
    if not os.path.isdir(item_dir):
        os.makedirs(item_dir)
    return item_dir

def getDirectoryPath(file_id):
    for path in GLib.get_system_data_dirs():
        file_path = os.path.join(path, 'desktop-directories', file_id)
        if os.path.isfile(file_path):
            return file_path
    return None

def getUserDirectoryPath():
    menu_dir = os.path.join(GLib.get_user_data_dir(), 'desktop-directories')
    if not os.path.isdir(menu_dir):
        os.makedirs(menu_dir)
    return menu_dir

def getUserMenuPath():
    menu_dir = os.path.join(GLib.get_user_config_dir(), 'menus')
    if not os.path.isdir(menu_dir):
        os.makedirs(menu_dir)
    return menu_dir

def getSystemMenuPath(file_id):
    for path in GLib.get_system_config_dirs():
        file_path = os.path.join(path, 'menus', file_id)
        if os.path.isfile(file_path):
            return file_path
    return None

def getUserMenuXml(tree):
    system_file = getSystemMenuPath(os.path.basename(tree.get_canonical_menu_path()))
    name = tree.get_root_directory().get_menu_id()
    menu_xml = "<!DOCTYPE Menu PUBLIC '-//freedesktop//DTD Menu 1.0//EN' 'http://standards.freedesktop.org/menu-spec/menu-1.0.dtd'>\n"
    menu_xml += "<Menu>\n  <Name>" + name + "</Name>\n  "
    menu_xml += "<MergeFile type=\"parent\">" + system_file +    "</MergeFile>\n</Menu>\n"
    return menu_xml

class SurfaceWrapper:
    def __init__(self, surface):
        self.surface = surface

def getIcon(item, widget):
    wrapper = SurfaceWrapper(None)
    pixbuf = None
    if item is None:
        return wrapper

    if isinstance(item, CMenu.TreeDirectory):
        gicon = item.get_icon()
    elif isinstance(item, CMenu.TreeEntry):
        app_info = item.get_app_info()
        gicon = app_info.get_icon()
    else:
        return wrapper

    if gicon is None:
        return wrapper

    icon_theme = Gtk.IconTheme.get_default()
    size = 24 * widget.get_scale_factor()
    info = icon_theme.lookup_by_gicon(gicon, size, 0)
    if info is None:
        return wrapper
    try:
        pixbuf = info.load_icon()
    except GLib.GError:
        return wrapper
    if pixbuf is None:
        return wrapper
    if pixbuf.get_width() != size or pixbuf.get_height() != size:
        pixbuf = pixbuf.scale_simple(size, size, GdkPixbuf.InterpType.HYPER)

    wrapper.surface = Gdk.cairo_surface_create_from_pixbuf (pixbuf, widget.get_scale_factor(), widget.get_window())
    return wrapper

def removeWhitespaceNodes(node):
    remove_list = []
    for child in node.childNodes:
        if child.nodeType == xml.dom.minidom.Node.TEXT_NODE:
            child.data = child.data.strip()
            if not child.data.strip():
                remove_list.append(child)
        elif child.hasChildNodes():
            removeWhitespaceNodes(child)
    for node in remove_list:
        node.parentNode.removeChild(node)

def menuSortKey(node):
    prefCats = ["administration", "preferences"]
    key = node.get_menu_id().lower()
    name = node.get_name().lower()
    if key in prefCats: name = "zzzz" + name # Hack for prefCats to be sorted at the end
    return name
