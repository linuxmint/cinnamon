# -*- coding: utf-8 -*-
#   Alacarte Menu Editor - Simple fd.o Compliant Menu Editor
#   Copyright (C) 2006  Travis Watkins, Heinrich Wendel
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
from gi.repository import CMenu, GLib
from cme import util

class MenuEditor(object):
    def __init__(self, name='cinnamon-applications.menu'):
        self.name = name
        self.tree = CMenu.Tree.new(name, CMenu.TreeFlags.SHOW_EMPTY|CMenu.TreeFlags.INCLUDE_EXCLUDED|CMenu.TreeFlags.INCLUDE_NODISPLAY|CMenu.TreeFlags.SORT_DISPLAY_NAME)
        self.tree.connect('changed', self._menuChanged)
        self._load()

        self.path = os.path.join(util.getUserMenuPath(), self.tree.props.menu_basename)
        self._loadDOM()

    def _loadDOM(self):
        try:
            self.dom_tree = ET.parse(self.path)
            self.root = self.dom_tree.getroot()
        except Exception:
            # If file doesn't exist or is corrupt, create from string
            xml_string = util.getUserMenuXml(self.tree)
            self.root = ET.fromstring(xml_string)
            self.dom_tree = ET.ElementTree(self.root)

    def _load(self):
        if not self.tree.load_sync():
            raise ValueError("can not load menu tree %r" % (self.name,))

    def _menuChanged(self, *a):
        self._load()

    def _save(self):
        xml_header = b"<?xml version='1.0' encoding='UTF-8'?>\n"
        dtd_header = b"<!DOCTYPE Menu PUBLIC '-//freedesktop//DTD Menu 1.0//EN' 'http://standards.freedesktop.org/menu-spec/menu-1.0.dtd'>\n"
        
        ET.indent(self.dom_tree, space="  ", level=0)
        
        with open(self.path, 'wb') as f:
            f.write(xml_header)
            f.write(dtd_header)
            self.dom_tree.write(f, encoding="utf-8", xml_declaration=False)

    def restoreToSystem(self):
        self._restoreTree(self.tree.get_root_directory())
        self._loadDOM()

    def _restoreTree(self, menu):
        item_iter = menu.iter()
        item_type = item_iter.next()
        while item_type != CMenu.TreeItemType.INVALID:
            if item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
                self._restoreTree(item)
            elif item_type == CMenu.TreeItemType.ENTRY:
                item = item_iter.get_entry()
                self._restoreItem(item)
            item_type = item_iter.next()
        self._restoreMenu(menu)

    def _restoreItem(self, item):
        if self.getIsItemUserOrSystem(item) != "both":
            return
        try:
            Path(item.get_desktop_file_path()).unlink()
        except OSError:
            pass

    def _restoreMenu(self, menu):
        if self.getIsItemUserOrSystem(menu) != "both":
            return
        if not menu.get_desktop_file_path():
            return
        file_id = Path(menu.get_desktop_file_path()).name
        path = Path(util.getUserDirectoryDir()) / file_id
        try:
            path.unlink()
        except OSError:
            pass

    def getMenus(self, parent):
        if parent is None:
            yield self.tree.get_root_directory(), True
            return

        item_iter = parent.iter()
        item_type = item_iter.next()
        items = []
        while item_type != CMenu.TreeItemType.INVALID:
            if item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
                items.append(item)
            item_type = item_iter.next()
        items.sort(key=util.menuSortKey)
        for item in items:
            yield item, self.isVisible(item)

    def getItems(self, menu):
        item_iter = menu.iter()
        item_type = item_iter.next()
        while item_type != CMenu.TreeItemType.INVALID:
            item = None
            if item_type == CMenu.TreeItemType.ENTRY:
                item = item_iter.get_entry()
            elif item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
            elif item_type == CMenu.TreeItemType.HEADER:
                item = item_iter.get_header()
            elif item_type == CMenu.TreeItemType.ALIAS:
                item = item_iter.get_alias()
            yield item, self.isVisible(item)
            item_type = item_iter.next()

    def getIsItemUserOrSystem(self, item):
        if isinstance(item, CMenu.TreeEntry):
            file_id = item.get_desktop_file_id().removesuffix(":flatpak")
            user_path = Path(util.getUserItemDir()) / file_id
            user_exists = user_path.is_file()
            system_exists = util.getSystemItemFilepath(file_id) is not None
        elif isinstance(item, CMenu.TreeDirectory):
            if item.get_desktop_file_path():
                file_id = Path(item.get_desktop_file_path()).name
            else:
                file_id = item.get_menu_id() + '.directory'
            system_exists = util.getSystemDirectoryFilepath(file_id) is not None
            user_path = Path(util.getUserDirectoryDir()) / file_id
            user_exists = Path(user_path).is_file()

        if user_exists and not system_exists:
            return "user only"
        elif not user_exists and system_exists:
            return "system only"
        elif user_exists and system_exists:
            return "both"
        else:
            return "neither"

    def insertExternalMenu(self, file_id):
        menu_id = file_id.rsplit('.', 1)[0]
        self._addXmlDefaultLayout(self.root)
        
        menu_xml = self._getXmlMenu(menu_id, self.root)
        self._addXmlTextElement(menu_xml, 'Directory', file_id)
        self._addXmlCategory(menu_xml, menu_id)
        self._save()

    def removeCustomMenu(self, menu):
        file_path = menu.get_desktop_file_path()
        if file_path and file_path.startswith(util.getUserDirectoryDir()):
            try:
                Path(file_path).unlink()
            except OSError:
                pass

        menu_id = menu.get_menu_id()
        # Find the specific Menu element by its Name child
        for node in self.root.findall('Menu'):
            name_node = node.find('Name')
            if name_node is not None and name_node.text == menu_id:
                self.root.remove(node)
                break
        
        self._save()

    def deleteUserDesktopFile(self, file_id):
        file_id = file_id.removesuffix(":flatpak")
        user_path = Path(util.getUserItemDir()) / file_id
        if user_path.is_file():
            try:
                user_path.unlink()
                return True
            except OSError:
                return False
        return False

    def isVisible(self, item):
        if isinstance(item, CMenu.TreeEntry):
            app_info = item.get_app_info()
            return not (item.get_is_excluded() or app_info.get_nodisplay())
        elif isinstance(item, CMenu.TreeDirectory):
            return not item.get_is_nodisplay()
        return True

    # Logic for finding/creating XML elements
    def _getXmlMenuPart(self, element, name):
        for node in element.findall('Menu'):
            name_node = node.find('Name')
            if name_node is not None and name_node.text == name:
                    return node
        return None

    def _getXmlMenu(self, name, element):
        found = self._getXmlMenuPart(element, name)
        if found is not None:
            element = found
        else:
            element = self._addXmlMenuElement(element, name)
        return element

    def _addXmlMenuElement(self, element, name):
        node = ET.SubElement(element, 'Menu')
        self._addXmlTextElement(node, 'Name', name)
        return node

    def _addXmlTextElement(self, element, name, text):
        # Check if it already exists with this text
        for child in element.findall(name):
            if child.text == text:
                return child
        node = ET.SubElement(element, name)
        node.text = text
        return node

    def _addXmlCategory(self, element, category_id):
        include = ET.SubElement(element, 'Include')
        cat = ET.SubElement(include, 'Category')
        cat.text = category_id
        return include

    def _addXmlDefaultLayout(self, element):
        # remove old default layout
        for node in element.findall('DefaultLayout'):
            element.remove(node)

        # add new layout
        node = ET.SubElement(element, 'DefaultLayout')
        node.set('inline', 'false')
        return node

