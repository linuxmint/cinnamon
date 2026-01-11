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
from pathlib import Path
import xml.etree.ElementTree as ET
import uuid
from typing import Optional
from gi.repository import Gtk, GdkPixbuf, CMenu, GLib, Gdk

def getUniqueFileId(name, extension):
    return f"{name}-{uuid.uuid4().hex[:8]}{extension}"

def getSystemItemFilepath(file_id) -> Optional[str]:
    for path in GLib.get_system_data_dirs():
        file_path = Path(path) / 'applications' / file_id
        if file_path.is_file():
            return str(file_path)
    return None

def getUserItemDir() -> str:
    item_dir = Path(GLib.get_user_data_dir()) / 'applications'
    if not item_dir.is_dir():
        Path(item_dir).mkdir(parents=True, exist_ok=True)
    return str(item_dir)

def getSystemDirectoryFilepath(file_id) -> Optional[str]:
    for path in GLib.get_system_data_dirs():
        file_path = Path(path) / 'desktop-directories' / file_id
        if file_path.is_file():
            return str(file_path)
    return None

def getUserDirectoryDir() -> str:
    path = Path(GLib.get_user_data_dir()) / 'desktop-directories'
    path.mkdir(parents=True, exist_ok=True)
    return str(path)

def getUserMenuPath() -> str:
    path = Path(GLib.get_user_config_dir()) / 'menus'
    path.mkdir(parents=True, exist_ok=True)
    return str(path)

def _getSystemMenuPath(file_id) -> Optional[str]:
    for path in GLib.get_system_config_dirs():
        file_path = Path(path) / 'menus' / file_id
        if file_path.is_file():
            return str(file_path)
    return None

def getUserMenuXml(tree) -> str:
    system_file = _getSystemMenuPath(os.path.basename(tree.get_canonical_menu_path()))
    name = tree.get_root_directory().get_menu_id()
    
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE Menu PUBLIC "-//freedesktop//DTD Menu 1.0//EN" '
        '"http://standards.freedesktop.org/menu-spec/menu-1.0.dtd">\n'
        f'<Menu>\n'
        f'  <Name>{name}</Name>\n'
        f'  <MergeFile type="parent">{system_file}</MergeFile>\n'
        '</Menu>'
    )

class SurfaceWrapper:
    def __init__(self, surface):
        self.surface = surface

def getIcon(item, widget) -> SurfaceWrapper:
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

def menuSortKey(node):
    prefCats = ["administration", "preferences"]
    key = node.get_menu_id().lower()
    name = node.get_name().lower()
    if key in prefCats: name = "zzzz" + name # Hack for prefCats to be sorted at the end
    return name
