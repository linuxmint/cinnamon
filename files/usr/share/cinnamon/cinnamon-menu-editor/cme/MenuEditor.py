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
import xml.dom.minidom
import xml.parsers.expat
from gi.repository import CMenu, GLib
from cme import util

class MenuEditor(object):
    def __init__(self, name='cinnamon-applications.menu'):
        self.name = name

        self.tree = CMenu.Tree.new(name, CMenu.TreeFlags.SHOW_EMPTY|CMenu.TreeFlags.INCLUDE_EXCLUDED|CMenu.TreeFlags.INCLUDE_NODISPLAY|CMenu.TreeFlags.SHOW_ALL_SEPARATORS|CMenu.TreeFlags.SORT_DISPLAY_NAME)
        self.tree.connect('changed', self.menuChanged)
        self.load()

        self.path = os.path.join(util.getUserMenuPath(), self.tree.props.menu_basename)
        self.loadDOM()

    def loadDOM(self):
        try:
            self.dom = xml.dom.minidom.parse(self.path)
        except (IOError, xml.parsers.expat.ExpatError), e:
            self.dom = xml.dom.minidom.parseString(util.getUserMenuXml(self.tree))
        util.removeWhitespaceNodes(self.dom)

    def load(self):
        if not self.tree.load_sync():
            raise ValueError("can not load menu tree %r" % (self.name,))

    def menuChanged(self, *a):
        self.load()

    def save(self):
        fd = open(self.path, 'w')
        fd.write(self.dom.toprettyxml())
        fd.close()

    def restoreToSystem(self):
        self.restoreTree(self.tree.get_root_directory())
        path = os.path.join(util.getUserMenuPath(), os.path.basename(self.tree.get_canonical_menu_path()))
        try:
            os.unlink(path)
        except OSError:
            pass

        self.loadDOM()

    def restoreTree(self, menu):
        item_iter = menu.iter()
        item_type = item_iter.next()
        while item_type != CMenu.TreeItemType.INVALID:
            if item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
                self.restoreTree(item)
            elif item_type == CMenu.TreeItemType.ENTRY:
                item = item_iter.get_entry()
                self.restoreItem(item)
            item_type = item_iter.next()
        self.restoreMenu(menu)

    def restoreItem(self, item):
        if not self.canRevert(item):
            return
        try:
            os.remove(item.get_desktop_file_path())
        except OSError:
            pass
        self.save()

    def restoreMenu(self, menu):
        if not self.canRevert(menu):
            return
        #wtf happened here? oh well, just bail
        if not menu.get_desktop_file_path():
            return
        file_id = os.path.split(menu.get_desktop_file_path())[1]
        path = os.path.join(util.getUserDirectoryPath(), file_id)
        try:
            os.remove(path)
        except OSError:
            pass
        self.save()

    def getMenus(self, parent):
        if parent is None:
            yield (self.tree.get_root_directory(), True)
            return

        item_iter = parent.iter()
        item_type = item_iter.next()
        items = [];
        while item_type != CMenu.TreeItemType.INVALID:
            if item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
                items.append(item)
            item_type = item_iter.next()
        items.sort(key=util.menuSortKey)
        for item in items:
            yield (item, self.isVisible(item))

    def getContents(self, item):
        contents = []
        item_iter = item.iter()
        item_type = item_iter.next()

        while item_type != CMenu.TreeItemType.INVALID:
            item = None
            if item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
            elif item_type == CMenu.TreeItemType.ENTRY:
                item = item_iter.get_entry()
            elif item_type == CMenu.TreeItemType.HEADER:
                item = item_iter.get_header()
            elif item_type == CMenu.TreeItemType.ALIAS:
                item = item_iter.get_alias()
            elif item_type == CMenu.TreeItemType.SEPARATOR:
                item = item_iter.get_separator()
            if item:
                contents.append(item)
            item_type = item_iter.next()
        return contents

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
            elif item_type == CMenu.TreeItemType.SEPARATOR:
                item = item_iter.get_separator()
            yield (item, self.isVisible(item))
            item_type = item_iter.next()

    def canRevert(self, item):
        if isinstance(item, CMenu.TreeEntry):
            if util.getItemPath(item.get_desktop_file_id()) is not None:
                path = util.getUserItemPath()
                if os.path.isfile(os.path.join(path, item.get_desktop_file_id())):
                    return True
        elif isinstance(item, CMenu.TreeDirectory):
            if item.get_desktop_file_path():
                file_id = os.path.split(item.get_desktop_file_path())[1]
            else:
                file_id = item.get_menu_id() + '.directory'
            if util.getDirectoryPath(file_id) is not None:
                path = util.getUserDirectoryPath()
                if os.path.isfile(os.path.join(path, file_id)):
                    return True
        return False

    def setVisible(self, item, visible):
        dom = self.dom
        if isinstance(item, CMenu.TreeEntry):
            menu_xml = self.getXmlMenu(self.getPath(item.get_parent()), dom.documentElement, dom)
            if visible:
                self.addXmlFilename(menu_xml, dom, item.get_desktop_file_id(), 'Include')
                self.writeItem(item, NoDisplay=False)
            else:
                self.addXmlFilename(menu_xml, dom, item.get_desktop_file_id(), 'Exclude')
            self.addXmlTextElement(menu_xml, 'AppDir', util.getUserItemPath(), dom)
        elif isinstance(item, CMenu.TreeDirectory):
            item_iter = item.iter()
            first_child_type = item_iter.next()
            #don't mess with it if it's empty
            if first_child_type == CMenu.TreeItemType.INVALID:
                return
            menu_xml = self.getXmlMenu(self.getPath(item), dom.documentElement, dom)
            for node in self.getXmlNodesByName(['Deleted', 'NotDeleted'], menu_xml):
                node.parentNode.removeChild(node)
            self.writeMenu(item, NoDisplay=not visible)
            self.addXmlTextElement(menu_xml, 'DirectoryDir', util.getUserDirectoryPath(), dom)
        self.save()

    def createItem(self, parent, before, after, **kwargs):
        file_id = self.writeItem(None, **kwargs)
        self.insertExternalItem(file_id, parent.get_menu_id(), before, after)

    def insertExternalItem(self, file_id, parent_id, before=None, after=None):
        parent = self.findMenu(parent_id)
        dom = self.dom
        self.addItem(parent, file_id, dom)
        self.positionItem(parent, ('Item', file_id), before, after)
        self.save()

    def insertExternalMenu(self, file_id, parent_id, before=None, after=None):
        menu_id = file_id.rsplit('.', 1)[0]
        parent = self.findMenu(parent_id)
        dom = self.dom
        self.addXmlDefaultLayout(self.getXmlMenu(self.getPath(parent), dom.documentElement, dom) , dom)
        menu_xml = self.getXmlMenu(self.getPath(parent) + [menu_id], dom.documentElement, dom)
        self.addXmlTextElement(menu_xml, 'Directory', file_id, dom)
        self.positionItem(parent, ('Menu', menu_id), before, after)
        self.save()

    def editItem(self, item, icon, name, comment, command, use_term, parent=None, final=True):
        #if nothing changed don't make a user copy
        app_info = item.get_app_info()
        if icon == app_info.get_icon() and name == app_info.get_display_name() and comment == item.get_comment() and command == item.get_exec() and use_term == item.get_launch_in_terminal():
            return
        #hack, item.get_parent() seems to fail a lot
        if not parent:
            parent = item.get_parent()
        self.writeItem(item, Icon=icon, Name=name, Comment=comment, Exec=command, Terminal=use_term)
        if final:
            dom = self.dom
            menu_xml = self.getXmlMenu(self.getPath(parent), dom.documentElement, dom)
            self.addXmlTextElement(menu_xml, 'AppDir', util.getUserItemPath(), dom)
        self.save()

    def editMenu(self, menu, icon, name, comment, final=True):
        #if nothing changed don't make a user copy
        if icon == menu.get_icon() and name == menu.get_name() and comment == menu.get_comment():
            return
        #we don't use this, we just need to make sure the <Menu> exists
        #otherwise changes won't show up
        dom = self.dom
        menu_xml = self.getXmlMenu(self.getPath(menu), dom.documentElement, dom)
        self.writeMenu(menu, Icon=icon, Name=name, Comment=comment)
        if final:
            self.addXmlTextElement(menu_xml, 'DirectoryDir', util.getUserDirectoryPath(), dom)
        self.save()

    def copyItem(self, item):
        dom = self.dom
        file_path = item.get_desktop_file_path()
        copy_buffer = GLib.KeyFile()
        copy_buffer.load_from_file(file_path, util.KEY_FILE_FLAGS)
        return (copy_buffer, None)

    def cutItem(self, item):
        copy_buffer, file_id = self.copyItem(item)
        file_id = self.deleteItem(item)
        return (copy_buffer, file_id)

    def pasteItem(self, cut_copy_buffer, menu, file_id = None):
        try:
            path = self.getPath(menu)
            util.fillKeyFile(cut_copy_buffer, dict(Hidden=False, NoDisplay=False))
            name = util.getNameFromKeyFile(cut_copy_buffer)
            if file_id is None:
                file_id = util.getUniqueFileId(name.replace(os.sep, '-'), '.desktop')
            out_path = os.path.join(util.getUserItemPath(), file_id)
            contents, length = cut_copy_buffer.to_data()
            f = open(out_path, 'w')
            f.write(contents)
            f.close()
            menu_xml = self.getXmlMenu(path, self.dom.documentElement, self.dom)
            self.addXmlFilename(menu_xml, self.dom, file_id, 'Include')
            self.addXmlTextElement(menu_xml, 'AppDir', util.getUserItemPath(), self.dom)
            self.save()
            return True
        except:
            return False

    def deleteItem(self, item):
        file_id = self.writeItem(item, Hidden=True)
        item_xml = self.getXmlMenu(self.getPath(item.get_parent()), self.dom.documentElement, self.dom)

        self.removeXmlFilename(item_xml, self.dom, file_id)

        self.save()
        return file_id

    def deleteMenu(self, menu):
        dom = self.dom
        menu_xml = self.getXmlMenu(self.getPath(menu), dom.documentElement, dom)
        self.addDeleted(menu_xml, dom)
        self.save()

    def deleteSeparator(self, item):
        parent = item.get_parent()
        contents = self.getContents(parent)
        contents.remove(item)
        layout = self.createLayout(contents)
        dom = self.dom
        menu_xml = self.getXmlMenu(self.getPath(parent), dom.documentElement, dom)
        self.addXmlLayout(menu_xml, layout, dom)
        self.save()

    def findMenu(self, menu_id, parent=None):
        if parent is None:
            parent = self.tree.get_root_directory()

        if menu_id == parent.get_menu_id():
            return parent

        item_iter = parent.iter()
        item_type = item_iter.next()
        while item_type != CMenu.TreeItemType.INVALID:
            if item_type == CMenu.TreeItemType.DIRECTORY:
                item = item_iter.get_directory()
                if item.get_menu_id() == menu_id:
                    return item
                menu = self.findMenu(menu_id, item)
                if menu is not None:
                    return menu
            item_type = item_iter.next()

    def isVisible(self, item):
        if isinstance(item, CMenu.TreeEntry):
            app_info = item.get_app_info()
            return not (item.get_is_excluded() or app_info.get_nodisplay())
        elif isinstance(item, CMenu.TreeDirectory):
            return not item.get_is_nodisplay()
        return True

    def getPath(self, menu):
        names = []
        current = menu
        while current is not None:
            try:
                names.append(current.get_menu_id())
            except:
                names.append(current.get_desktop_file_id())
            current = current.get_parent()

        # XXX - don't append root menu name, alacarte doesn't
        # expect it. look into this more.
        names.pop(-1)
        return names[::-1]

    def getXmlMenuPart(self, element, name):
        for node in self.getXmlNodesByName('Menu', element):
            for child in self.getXmlNodesByName('Name', node):
                if child.childNodes[0].nodeValue == name:
                    return node
        return None

    def getXmlMenu(self, path, element, dom):
        for name in path:
            found = self.getXmlMenuPart(element, name)
            if found is not None:
                element = found
            else:
                element = self.addXmlMenuElement(element, name, dom)
        return element

    def addXmlMenuElement(self, element, name, dom):
        node = dom.createElement('Menu')
        self.addXmlTextElement(node, 'Name', name, dom)
        return element.appendChild(node)

    def addXmlTextElement(self, element, name, text, dom):
        for temp in element.childNodes:
            if temp.nodeName == name:
                if temp.childNodes[0].nodeValue == text:
                    return
        node = dom.createElement(name)
        text = dom.createTextNode(text)
        node.appendChild(text)
        return element.appendChild(node)

    def addXmlFilename(self, element, dom, filename, type = 'Include'):
        # remove old filenames
        for node in self.getXmlNodesByName(['Include', 'Exclude'], element):
            if node.childNodes[0].nodeName == 'Filename' and node.childNodes[0].childNodes[0].nodeValue == filename:
                element.removeChild(node)

        # add new filename
        node = dom.createElement(type)
        node.appendChild(self.addXmlTextElement(node, 'Filename', filename, dom))
        return element.appendChild(node)

    def removeXmlFilename(self, element, dom, filename):
        for node in self.getXmlNodesByName(['Include'], element):
            if node.childNodes[0].nodeName == 'Filename' and node.childNodes[0].childNodes[0].nodeValue == filename:
                element.removeChild(node)

    def addDeleted(self, element, dom):
        node = dom.createElement('Deleted')
        return element.appendChild(node)

    def makeKeyFile(self, file_path, kwargs):
        if 'KeyFile' in kwargs:
            return kwargs['KeyFile']

        keyfile = GLib.KeyFile()

        if file_path is not None:
            keyfile.load_from_file(file_path, util.KEY_FILE_FLAGS)

        util.fillKeyFile(keyfile, kwargs)
        return keyfile

    def writeItem(self, item, **kwargs):
        if item is not None:
            file_path = item.get_desktop_file_path()
        else:
            file_path = None

        keyfile = self.makeKeyFile(file_path, kwargs)

        if item is not None:
            file_id = item.get_desktop_file_id()
        else:
            file_id = util.getUniqueFileId(keyfile.get_string(GLib.KEY_FILE_DESKTOP_GROUP, 'Name'), '.desktop')

        contents, length = keyfile.to_data()

        f = open(os.path.join(util.getUserItemPath(), file_id), 'w')
        f.write(contents)
        f.close()
        return file_id

    def writeMenu(self, menu, **kwargs):
        if menu is not None:
            file_id = os.path.split(menu.get_desktop_file_path())[1]
            file_path = menu.get_desktop_file_path()
            keyfile = GLib.KeyFile()
            keyfile.load_from_file(file_path, util.KEY_FILE_FLAGS)
        elif menu is None and 'Name' not in kwargs:
            raise Exception('New menus need a name')
        else:
            file_id = util.getUniqueFileId(kwargs['Name'], '.directory')
            keyfile = GLib.KeyFile()

        util.fillKeyFile(keyfile, kwargs)

        contents, length = keyfile.to_data()

        f = open(os.path.join(util.getUserDirectoryPath(), file_id), 'w')
        f.write(contents)
        f.close()
        return file_id

    def getXmlNodesByName(self, name, element):
        for child in element.childNodes:
            if child.nodeType == xml.dom.Node.ELEMENT_NODE:
                if isinstance(name, str) and child.nodeName == name:
                    yield child
                elif isinstance(name, list) or isinstance(name, tuple):
                    if child.nodeName in name:
                        yield child

    def addXmlMove(self, element, old, new, dom):
        if not self.undoMoves(element, old, new, dom):
            node = dom.createElement('Move')
            node.appendChild(self.addXmlTextElement(node, 'Old', old, dom))
            node.appendChild(self.addXmlTextElement(node, 'New', new, dom))
            #are parsed in reverse order, need to put at the beginning
            return element.insertBefore(node, element.firstChild)

    def addXmlLayout(self, element, layout, dom):
        # remove old layout
        for node in self.getXmlNodesByName('Layout', element):
            element.removeChild(node)

        # add new layout
        node = dom.createElement('Layout')
        for order in layout:
            if order[0] == 'Separator':
                child = dom.createElement('Separator')
                node.appendChild(child)
            elif order[0] == 'Filename':
                child = self.addXmlTextElement(node, 'Filename', order[1], dom)
            elif order[0] == 'Menuname':
                child = self.addXmlTextElement(node, 'Menuname', order[1], dom)
            elif order[0] == 'Merge':
                child = dom.createElement('Merge')
                child.setAttribute('type', order[1])
                node.appendChild(child)
        return element.appendChild(node)

    def addXmlDefaultLayout(self, element, dom):
        # remove old default layout
        for node in self.getXmlNodesByName('DefaultLayout', element):
            element.removeChild(node)

        # add new layout
        node = dom.createElement('DefaultLayout')
        node.setAttribute('inline', 'false')
        return element.appendChild(node)

    def createLayout(self, items):
        layout = []
        layout.append(('Merge', 'menus'))
        for item in items:
            if isinstance(item, CMenu.TreeDirectory):
                layout.append(('Menuname', item.get_menu_id()))
            elif isinstance(item, CMenu.TreeEntry):
                layout.append(('Filename', item.get_desktop_file_id()))
            elif isinstance(item, CMenu.TreeSeparator):
                layout.append(('Separator',))
            else:
                layout.append(item)
        layout.append(('Merge', 'files'))
        return layout

    def addItem(self, parent, file_id, dom):
        xml_parent = self.getXmlMenu(self.getPath(parent), dom.documentElement, dom)
        self.addXmlFilename(xml_parent, dom, file_id, 'Include')

    def moveItem(self, parent, item, before=None, after=None):
        self.positionItem(parent, item, before=before, after=after)
        self.save()

    def getIndex(self, item, contents):
        index = -1
        if isinstance(item, CMenu.TreeDirectory):
            for i in range(len(contents)):
                if type(item) is not type(contents[i]):
                    continue
                if item.get_menu_id() == contents[i].get_menu_id():
                    index = i
                    return index
        elif isinstance(item, CMenu.TreeEntry):
            for i in range(len(contents)):
                if type(item) is not type(contents[i]):
                    continue
                if item.get_desktop_file_id() == contents[i].get_desktop_file_id():
                    index = i
                    return index
        return index

    def positionItem(self, parent, item, before=None, after=None):
        contents = self.getContents(parent)
        index = -1
        if after:
            index = self.getIndex(after, contents) + 1
            #  index = contents.index(after) + 1
        elif before:
            index = self.getIndex(before, contents)
            #  index = contents.index(before)
        else:
            # append the item to the list
            index = len(contents)
        #if this is a move to a new parent you can't remove the item
        item_index = self.getIndex(item, contents)
        if item_index > -1:
            # decrease the destination index, if we shorten the list
            if (before and (item_index < index)) \
                    or (after and (item_index < index - 1)):
                index -= 1
            contents.remove(contents[item_index])
        contents.insert(index, item)
        layout = self.createLayout(contents)
        dom = self.dom
        menu_xml = self.getXmlMenu(self.getPath(parent), dom.documentElement, dom)
        self.addXmlLayout(menu_xml, layout, dom)

    def undoMoves(self, element, old, new, dom):
        nodes = []
        matches = []
        original_old = old
        final_old = old
        #get all <Move> elements
        for node in self.getXmlNodesByName(['Move'], element):
            nodes.insert(0, node)
        #if the <New> matches our old parent we've found a stage to undo
        for node in nodes:
            xml_old = node.getElementsByTagName('Old')[0]
            xml_new = node.getElementsByTagName('New')[0]
            if xml_new.childNodes[0].nodeValue == old:
                matches.append(node)
                #we should end up with this path when completed
                final_old = xml_old.childNodes[0].nodeValue
        #undoing <Move>s
        for node in matches:
            element.removeChild(node)
        if len(matches) > 0:
            for node in nodes:
                xml_old = node.getElementsByTagName('Old')[0]
                xml_new = node.getElementsByTagName('New')[0]
                path = os.path.split(xml_new.childNodes[0].nodeValue)
                if path[0] == original_old:
                    element.removeChild(node)
                    for node in dom.getElementsByTagName('Menu'):
                        name_node = node.getElementsByTagName('Name')[0]
                        name = name_node.childNodes[0].nodeValue
                        if name == os.path.split(new)[1]:
                            #copy app and dir directory info from old <Menu>
                            root_path = dom.getElementsByTagName('Menu')[0].getElementsByTagName('Name')[0].childNodes[0].nodeValue
                            xml_menu = self.getXmlMenu(root_path + '/' + new, dom.documentElement, dom)
                            for app_dir in node.getElementsByTagName('AppDir'):
                                xml_menu.appendChild(app_dir)
                            for dir_dir in node.getElementsByTagName('DirectoryDir'):
                                xml_menu.appendChild(dir_dir)
                            parent = node.parentNode
                            parent.removeChild(node)
                    node = dom.createElement('Move')
                    node.appendChild(self.addXmlTextElement(node, 'Old', xml_old.childNodes[0].nodeValue, dom))
                    node.appendChild(self.addXmlTextElement(node, 'New', os.path.join(new, path[1]), dom))
                    element.appendChild(node)
            if final_old == new:
                return True
            node = dom.createElement('Move')
            node.appendChild(self.addXmlTextElement(node, 'Old', final_old, dom))
            node.appendChild(self.addXmlTextElement(node, 'New', new, dom))
            return element.appendChild(node)
