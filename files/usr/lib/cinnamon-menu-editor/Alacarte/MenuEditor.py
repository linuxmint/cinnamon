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
#   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

import os, re, xml.dom.minidom, locale
import gmenu
from Alacarte import util

class Menu:
	tree = None
	visible_tree = None
	path = None
	dom = None

class MenuEditor:
	#lists for undo/redo functionality
	__undo = []
	__redo = []

	def __init__(self):
		self.locale = locale.getdefaultlocale()[0]
		self.__loadMenus()

	def __loadMenus(self):
		self.applications = Menu()
		self.applications.tree = gmenu.lookup_tree('cinnamon-applications.menu', gmenu.FLAGS_SHOW_EMPTY|gmenu.FLAGS_INCLUDE_EXCLUDED|gmenu.FLAGS_INCLUDE_NODISPLAY|gmenu.FLAGS_SHOW_ALL_SEPARATORS)
		self.applications.visible_tree = gmenu.lookup_tree('cinnamon-applications.menu')
		self.applications.tree.sort_key = gmenu.SORT_DISPLAY_NAME
		self.applications.visible_tree.sort_key = gmenu.SORT_DISPLAY_NAME
		self.applications.path = os.path.join(util.getUserMenuPath(), self.applications.tree.get_menu_file())
		if not os.path.isfile(self.applications.path):
			self.applications.dom = xml.dom.minidom.parseString(util.getUserMenuXml(self.applications.tree))
		else:
			self.applications.dom = xml.dom.minidom.parse(self.applications.path)
		self.__remove_whilespace_nodes(self.applications.dom)

		self.save(True)

	def save(self, from_loading=False):
		for menu in ('applications',):
			fd = open(getattr(self, menu).path, 'w')
			fd.write(re.sub("\n[\s]*([^\n<]*)\n[\s]*</", "\\1</", getattr(self, menu).dom.toprettyxml().replace('<?xml version="1.0" ?>\n', '')))
			fd.close()
		if not from_loading:
			self.__loadMenus()

	def quit(self):
		for file_name in os.listdir(util.getUserItemPath()):
			if file_name[-6:-2] in ('redo', 'undo'):
				file_path = os.path.join(util.getUserItemPath(), file_name)
				os.unlink(file_path)
		for file_name in os.listdir(util.getUserDirectoryPath()):
			if file_name[-6:-2] in ('redo', 'undo'):
				file_path = os.path.join(util.getUserDirectoryPath(), file_name)
				os.unlink(file_path)
		for file_name in os.listdir(util.getUserMenuPath()):
			if file_name[-6:-2] in ('redo', 'undo'):
				file_path = os.path.join(util.getUserMenuPath(), file_name)
				os.unlink(file_path)

	def revert(self):
		for name in ('applications',):
			menu = getattr(self, name)
			self.revertTree(menu.tree.root)
			path = os.path.join(util.getUserMenuPath(), menu.tree.get_menu_file())
			try:
				os.unlink(path)
			except OSError:
				pass
			#reload DOM for each menu
			if not os.path.isfile(menu.path):
				menu.dom = xml.dom.minidom.parseString(util.getUserMenuXml(menu.tree))
			else:
				menu.dom = xml.dom.minidom.parse(menu.path)
			self.__remove_whilespace_nodes(menu.dom)
		#reset undo/redo, no way to recover from this
		self.__undo, self.__redo = [], []
		self.save()

	def revertTree(self, menu):
		for child in menu.get_contents():
			if child.get_type() == gmenu.TYPE_DIRECTORY:
				self.revertTree(child)
			elif child.get_type() == gmenu.TYPE_ENTRY:
				self.revertItem(child)
		self.revertMenu(menu)

	def undo(self):
		if len(self.__undo) == 0:
			return
		files = self.__undo.pop()
		redo = []
		for file_path in files:
			new_path = file_path.rsplit('.', 1)[0]
			redo_path = util.getUniqueRedoFile(new_path)
			data = open(new_path).read()
			open(redo_path, 'w').write(data)
			data = open(file_path).read()
			open(new_path, 'w').write(data)
			os.unlink(file_path)
			redo.append(redo_path)
		#reload DOM to make changes stick
		for name in ('applications',):
			menu = getattr(self, name)
			if not os.path.isfile(menu.path):
				menu.dom = xml.dom.minidom.parseString(util.getUserMenuXml(menu.tree))
			else:
				menu.dom = xml.dom.minidom.parse(menu.path)
			self.__remove_whilespace_nodes(menu.dom)
		self.__redo.append(redo)

	def redo(self):
		if len(self.__redo) == 0:
			return
		files = self.__redo.pop()
		undo = []
		for file_path in files:
			new_path = file_path.rsplit('.', 1)[0]
			undo_path = util.getUniqueUndoFile(new_path)
			data = open(new_path).read()
			open(undo_path, 'w').write(data)
			data = open(file_path).read()
			open(new_path, 'w').write(data)
			os.unlink(file_path)
			undo.append(undo_path)
		#reload DOM to make changes stick
		for name in ('applications',):
			menu = getattr(self, name)
			if not os.path.isfile(menu.path):
				menu.dom = xml.dom.minidom.parseString(util.getUserMenuXml(menu.tree))
			else:
				menu.dom = xml.dom.minidom.parse(menu.path)
			self.__remove_whilespace_nodes(menu.dom)
		self.__undo.append(undo)

	def getMenus(self, parent=None):
		if parent == None:
			yield self.applications.tree.root
		else:
			for menu in parent.get_contents():
				if menu.get_type() == gmenu.TYPE_DIRECTORY:
					yield (menu, self.__isVisible(menu))

	def getItems(self, menu):
		for item in menu.get_contents():
			if item.get_type() == gmenu.TYPE_SEPARATOR:
				yield (item, True)
			else:
				if item.get_type() == gmenu.TYPE_ENTRY and item.get_desktop_file_id()[-19:] == '-usercustom.desktop':
					continue
				yield (item, self.__isVisible(item))

	def canRevert(self, item):
		if item.get_type() == gmenu.TYPE_ENTRY:
			if util.getItemPath(item.get_desktop_file_id()):
				path = util.getUserItemPath()
				if os.path.isfile(os.path.join(path, item.get_desktop_file_id())):
					return True
		elif item.get_type() == gmenu.TYPE_DIRECTORY:
			if item.get_desktop_file_path():
				file_id = os.path.split(item.get_desktop_file_path())[1]
			else:
				file_id = item.get_menu_id() + '.directory'
			if util.getDirectoryPath(file_id):
				path = util.getUserDirectoryPath()
				if os.path.isfile(os.path.join(path, file_id)):
					return True
		return False

	def setVisible(self, item, visible):
		dom = self.__getMenu(item).dom
		if item.get_type() == gmenu.TYPE_ENTRY:
			self.__addUndo([self.__getMenu(item), item])
			menu_xml = self.__getXmlMenu(self.__getPath(item.get_parent()), dom, dom)
			if visible:
				self.__addXmlFilename(menu_xml, dom, item.get_desktop_file_id(), 'Include')
				self.__writeItem(item, no_display=False)
			else:
				self.__addXmlFilename(menu_xml, dom, item.get_desktop_file_id(), 'Exclude')
			self.__addXmlTextElement(menu_xml, 'AppDir', util.getUserItemPath(), dom)
		elif item.get_type() == gmenu.TYPE_DIRECTORY:
			self.__addUndo([self.__getMenu(item), item])
			#don't mess with it if it's empty
			if len(item.get_contents()) == 0:
				return
			menu_xml = self.__getXmlMenu(self.__getPath(item), dom, dom)
			for node in self.__getXmlNodesByName(['Deleted', 'NotDeleted'], menu_xml):
				node.parentNode.removeChild(node)
			if visible:
				self.__writeMenu(item, no_display=False)
			else:
				self.__writeMenu(item, no_display=True)
			self.__addXmlTextElement(menu_xml, 'DirectoryDir', util.getUserDirectoryPath(), dom)
		self.save()

	def createItem(self, parent, icon, name, comment, command, use_term, before=None, after=None):
		file_id = self.__writeItem(None, icon, name, comment, command, use_term)
		self.insertExternalItem(file_id, parent, before, after)

	def insertExternalItem(self, file_id, parent, before=None, after=None):
		dom = self.__getMenu(parent).dom
		self.__addItem(parent, file_id, dom)
		self.__positionItem(parent, ('Item', file_id), before, after)
		self.__addUndo([self.__getMenu(parent), ('Item', file_id)])
		self.save()

	def createMenu(self, parent, icon, name, comment, before=None, after=None):
		file_id = self.__writeMenu(None, icon, name, comment)
		self.insertExternalMenu(file_id, parent.menu_id, before, after)

	def insertExternalMenu(self, file_id, parent_id, before=None, after=None):
		menu_id = file_id.rsplit('.', 1)[0]
		parent = self.__findMenu(parent_id)
		dom = self.__getMenu(parent).dom
		self.__addXmlDefaultLayout(self.__getXmlMenu(self.__getPath(parent), dom, dom) , dom)
		menu_xml = self.__getXmlMenu(self.__getPath(parent) + '/' + menu_id, dom, dom)
		self.__addXmlTextElement(menu_xml, 'Directory', file_id, dom)
		self.__positionItem(parent, ('Menu', menu_id), before, after)
		self.__addUndo([self.__getMenu(parent), ('Menu', file_id)])
		self.save()

	def createSeparator(self, parent, before=None, after=None):
		self.__positionItem(parent, ('Separator',), before, after)
		self.__addUndo([self.__getMenu(parent), ('Separator',)])
		self.save()

	def editItem(self, item, icon, name, comment, command, use_term, parent=None, final=True):
		#if nothing changed don't make a user copy
		if icon == item.get_icon() and name == item.get_display_name() and comment == item.get_comment() and command == item.get_exec() and use_term == item.get_launch_in_terminal():
			return
		#hack, item.get_parent() seems to fail a lot
		if not parent:
			parent = item.get_parent()
		if final:
			self.__addUndo([self.__getMenu(parent), item])
		self.__writeItem(item, icon, name, comment, command, use_term)
		if final:
			dom = self.__getMenu(parent).dom
			menu_xml = self.__getXmlMenu(self.__getPath(parent), dom, dom)
			self.__addXmlTextElement(menu_xml, 'AppDir', util.getUserItemPath(), dom)
		self.save()

	def editMenu(self, menu, icon, name, comment, final=True):
		#if nothing changed don't make a user copy
		if icon == menu.get_icon() and name == menu.get_name() and comment == menu.get_comment():
			return
		#we don't use this, we just need to make sure the <Menu> exists
		#otherwise changes won't show up
		dom = self.__getMenu(menu).dom
		menu_xml = self.__getXmlMenu(self.__getPath(menu), dom, dom)
		file_id = self.__writeMenu(menu, icon, name, comment)
		if final:
			self.__addXmlTextElement(menu_xml, 'DirectoryDir', util.getUserDirectoryPath(), dom)
			self.__addUndo([self.__getMenu(menu), menu])
		self.save()

	def copyItem(self, item, new_parent, before=None, after=None):
		dom = self.__getMenu(new_parent).dom
		file_path = item.get_desktop_file_path()
		keyfile = util.DesktopParser(file_path)
		#erase Categories in new file
		keyfile.set('Categories', ('',))
		keyfile.set('Hidden', False)
		file_id = util.getUniqueFileId(item.get_name(), '.desktop')
		out_path = os.path.join(util.getUserItemPath(), file_id)
		keyfile.write(open(out_path, 'w'))
		self.__addItem(new_parent, file_id, dom)
		self.__positionItem(new_parent, ('Item', file_id), before, after)
		self.__addUndo([self.__getMenu(new_parent), ('Item', file_id)])
		self.save()
		return file_id

	def moveItem(self, item, new_parent, before=None, after=None):
		undo = []
		if item.get_parent() != new_parent:
			#hide old item
			self.deleteItem(item)
			undo.append(item)
			file_id = self.copyItem(item, new_parent)
			item = ('Item', file_id)
			undo.append(item)
		self.__positionItem(new_parent, item, before, after)
		undo.append(self.__getMenu(new_parent))
		self.__addUndo(undo)
		self.save()

	def moveMenu(self, menu, new_parent, before=None, after=None):
		parent = new_parent
		#don't move a menu into it's child
		while parent.get_parent():
			parent = parent.get_parent()
			if parent == menu:
				return False

		#don't move a menu into itself
		if new_parent == menu:
			return False

		#can't move between top-level menus
		if self.__getMenu(menu) != self.__getMenu(new_parent):
			return False
		if menu.get_parent() != new_parent:
			dom = self.__getMenu(menu).dom
			root_path = self.__getPath(menu).split('/', 1)[0]
			xml_root = self.__getXmlMenu(root_path, dom, dom)
			old_path = self.__getPath(menu).split('/', 1)[1]
			#root menu's path has no /
			if '/' in self.__getPath(new_parent):
				new_path = self.__getPath(new_parent).split('/', 1)[1] + '/' + menu.get_menu_id()
			else:
				new_path = menu.get_menu_id()
			self.__addXmlMove(xml_root, old_path, new_path, dom)
		self.__positionItem(new_parent, menu, before, after)
		self.__addUndo([self.__getMenu(new_parent),])
		self.save()

	def moveSeparator(self, separator, new_parent, before=None, after=None):
		self.__positionItem(new_parent, separator, before, after)
		self.__addUndo([self.__getMenu(new_parent),])
		self.save()

	def deleteItem(self, item):
		self.__addUndo([item,])
		self.__writeItem(item, hidden=True)
		self.save()

	def deleteMenu(self, menu):
		dom = self.__getMenu(menu).dom
		menu_xml = self.__getXmlMenu(self.__getPath(menu), dom, dom)
		self.__addDeleted(menu_xml, dom)
		self.__addUndo([self.__getMenu(menu),])
		self.save()

	def deleteSeparator(self, item):
		parent = item.get_parent()
		contents = parent.get_contents()
		contents.remove(item)
		layout = self.__createLayout(contents)
		dom = self.__getMenu(parent).dom
		menu_xml = self.__getXmlMenu(self.__getPath(parent), dom, dom)
		self.__addXmlLayout(menu_xml, layout, dom)
		self.__addUndo([self.__getMenu(item.get_parent()),])
		self.save()

	def revertItem(self, item):
		if not self.canRevert(item):
			return
		self.__addUndo([item,])
		try:
			os.remove(item.get_desktop_file_path())
		except OSError:
			pass
		self.save()

	def revertMenu(self, menu):
		if not self.canRevert(menu):
			return
		#wtf happened here? oh well, just bail
		if not menu.get_desktop_file_path():
			return
		self.__addUndo([menu,])
		file_id = os.path.split(menu.get_desktop_file_path())[1]
		path = os.path.join(util.getUserDirectoryPath(), file_id)
		try:
			os.remove(path)
		except OSError:
			pass
		self.save()

	#private stuff
	def __addUndo(self, items):
		self.__undo.append([])
		for item in items:
			if isinstance(item, Menu):
				file_path = item.path
			elif isinstance(item, tuple):
				if item[0] == 'Item':
					file_path = os.path.join(util.getUserItemPath(), item[1])
					if not os.path.isfile(file_path):
						file_path = util.getItemPath(item[1])
				elif item[0] == 'Menu':
					file_path = os.path.join(util.getUserDirectoryPath(), item[1])
					if not os.path.isfile(file_path):
						file_path = util.getDirectoryPath(item[1])
				else:
					continue
			elif item.get_type() == gmenu.TYPE_DIRECTORY:
				if item.get_desktop_file_path() == None:
					continue
				file_path = os.path.join(util.getUserDirectoryPath(), os.path.split(item.get_desktop_file_path())[1])
				if not os.path.isfile(file_path):
					file_path = item.get_desktop_file_path()
			elif item.get_type() == gmenu.TYPE_ENTRY:
				file_path = os.path.join(util.getUserItemPath(), item.get_desktop_file_id())
				if not os.path.isfile(file_path):
					file_path = item.get_desktop_file_path()
			else:
				continue
			data = open(file_path).read()
			undo_path = util.getUniqueUndoFile(file_path)
			open(undo_path, 'w').write(data)
			self.__undo[-1].append(undo_path)

	def __getMenu(self, item):
		return self.applications

	def __findMenu(self, menu_id, parent=None):
		if parent == None:
			return self.__findMenu(menu_id, self.applications.tree.root)
		if menu_id == self.applications.tree.root.menu_id:
			return self.applications.tree.root
		for item in parent.get_contents():
			if item.get_type() == gmenu.TYPE_DIRECTORY:
				if item.menu_id == menu_id:
					return item
				menu = self.__findMenu(menu_id, item)
				if menu != None:
					return menu

	def __isVisible(self, item):
		if item.get_type() == gmenu.TYPE_ENTRY:
			return not (item.get_is_excluded() or item.get_is_nodisplay())
		menu = self.__getMenu(item)
		if menu == self.applications:
			root = self.applications.visible_tree.root
		if item.get_type() == gmenu.TYPE_DIRECTORY:
			if self.__findMenu(item.menu_id, root) == None:
				return False
		return True

	def __getPath(self, menu, path=None):
		if not path:
                        path = menu.tree.root.get_menu_id()
		if menu.get_parent():
			path = self.__getPath(menu.get_parent(), path)
			path += '/'
			path += menu.menu_id
		return path

	def __getXmlMenu(self, path, element, dom):
		if '/' in path:
			(name, path) = path.split('/', 1)
		else:
			name = path
			path = ''

		found = None
		for node in self.__getXmlNodesByName('Menu', element):
			for child in self.__getXmlNodesByName('Name', node):
				if child.childNodes[0].nodeValue == name:
					if path:
						found = self.__getXmlMenu(path, node, dom)
					else:
						found = node
					break
			if found:
				break
		if not found:
			node = self.__addXmlMenuElement(element, name, dom)
			if path:
				found = self.__getXmlMenu(path, node, dom)
			else:
				found = node

		return found

	def __addXmlMenuElement(self, element, name, dom):
		node = dom.createElement('Menu')
		self.__addXmlTextElement(node, 'Name', name, dom)
		return element.appendChild(node)

	def __addXmlTextElement(self, element, name, text, dom):
		for temp in element.childNodes:
			if temp.nodeName == name:
				if temp.childNodes[0].nodeValue == text:
					return
		node = dom.createElement(name)
		text = dom.createTextNode(text)
		node.appendChild(text)
		return element.appendChild(node)

	def __addXmlFilename(self, element, dom, filename, type = 'Include'):
		# remove old filenames
		for node in self.__getXmlNodesByName(['Include', 'Exclude'], element):
			if node.childNodes[0].nodeName == 'Filename' and node.childNodes[0].childNodes[0].nodeValue == filename:
				element.removeChild(node)

		# add new filename
		node = dom.createElement(type)
		node.appendChild(self.__addXmlTextElement(node, 'Filename', filename, dom))
		return element.appendChild(node)

	def __addDeleted(self, element, dom):
		node = dom.createElement('Deleted')
		return element.appendChild(node)

	def __writeItem(self, item=None, icon=None, name=None, comment=None, command=None, use_term=None, no_display=None, startup_notify=None, hidden=None):
		if item:
			file_path = item.get_desktop_file_path()
			file_id = item.get_desktop_file_id()
			keyfile = util.DesktopParser(file_path)
		elif item == None and name == None:
			raise Exception('New menu items need a name')
		else:
			file_id = util.getUniqueFileId(name, '.desktop')
			keyfile = util.DesktopParser()
		if icon:
			keyfile.set('Icon', icon)
			keyfile.set('Icon', icon, self.locale)
		if name:
			keyfile.set('Name', name)
			keyfile.set('Name', name, self.locale)
		if comment:
			keyfile.set('Comment', comment)
			keyfile.set('Comment', comment, self.locale)
		if command:
			keyfile.set('Exec', command)
		if use_term != None:
			keyfile.set('Terminal', use_term)
		if no_display != None:
			keyfile.set('NoDisplay', no_display)
		if startup_notify != None:
			keyfile.set('StartupNotify', startup_notify)
		if hidden != None:
			keyfile.set('Hidden', hidden)
		out_path = os.path.join(util.getUserItemPath(), file_id)
		keyfile.write(open(out_path, 'w'))
		return file_id

	def __writeMenu(self, menu=None, icon=None, name=None, comment=None, no_display=None):
		if menu:
			file_id = os.path.split(menu.get_desktop_file_path())[1]
			file_path = menu.get_desktop_file_path()
			keyfile = util.DesktopParser(file_path)
		elif menu == None and name == None:
			raise Exception('New menus need a name')
		else:
			file_id = util.getUniqueFileId(name, '.directory')
			keyfile = util.DesktopParser(file_type='Directory')
		if icon:
			keyfile.set('Icon', icon)
		if name:
			keyfile.set('Name', name)
			keyfile.set('Name', name, self.locale)
		if comment:
			keyfile.set('Comment', comment)
			keyfile.set('Comment', comment, self.locale)
		if no_display != None:
			keyfile.set('NoDisplay', no_display)
		out_path = os.path.join(util.getUserDirectoryPath(), file_id)
		keyfile.write(open(out_path, 'w'))
		return file_id

	def __getXmlNodesByName(self, name, element):
		for	child in element.childNodes:
			if child.nodeType == xml.dom.Node.ELEMENT_NODE:
				if isinstance(name, str) and child.nodeName == name:
					yield child
				elif isinstance(name, list) or isinstance(name, tuple):
					if child.nodeName in name:
						yield child

	def __remove_whilespace_nodes(self, node):
		remove_list = []
		for child in node.childNodes:
			if child.nodeType == xml.dom.minidom.Node.TEXT_NODE:
				child.data = child.data.strip()
				if not child.data.strip():
					remove_list.append(child)
			elif child.hasChildNodes():
				self.__remove_whilespace_nodes(child)
		for node in remove_list:
			node.parentNode.removeChild(node)

	def __addXmlMove(self, element, old, new, dom):
		if not self.__undoMoves(element, old, new, dom):
			node = dom.createElement('Move')
			node.appendChild(self.__addXmlTextElement(node, 'Old', old, dom))
			node.appendChild(self.__addXmlTextElement(node, 'New', new, dom))
			#are parsed in reverse order, need to put at the beginning
			return element.insertBefore(node, element.firstChild)

	def __addXmlLayout(self, element, layout, dom):
		# remove old layout
		for node in self.__getXmlNodesByName('Layout', element):
			element.removeChild(node)

		# add new layout
		node = dom.createElement('Layout')
		for order in layout.order:
			if order[0] == 'Separator':
				child = dom.createElement('Separator')
				node.appendChild(child)
			elif order[0] == 'Filename':
				child = self.__addXmlTextElement(node, 'Filename', order[1], dom)
			elif order[0] == 'Menuname':
				child = self.__addXmlTextElement(node, 'Menuname', order[1], dom)
			elif order[0] == 'Merge':
				child = dom.createElement('Merge')
				child.setAttribute('type', order[1])
				node.appendChild(child)
		return element.appendChild(node)

	def __addXmlDefaultLayout(self, element, dom):
		# remove old default layout
		for node in self.__getXmlNodesByName('DefaultLayout', element):
			element.removeChild(node)

		# add new layout
		node = dom.createElement('DefaultLayout')
		node.setAttribute('inline', 'false')
		return element.appendChild(node)

	def __createLayout(self, items):
		layout = Layout()
		layout.order = []

		layout.order.append(['Merge', 'menus'])
		for item in items:
			if isinstance(item, tuple):
				if item[0] == 'Separator':
					layout.parseSeparator()
				elif item[0] == 'Menu':
					layout.parseMenuname(item[1])
				elif item[0] == 'Item':
					layout.parseFilename(item[1])
			elif item.get_type() == gmenu.TYPE_DIRECTORY:
				layout.parseMenuname(item.get_menu_id())
			elif item.get_type() == gmenu.TYPE_ENTRY:
				layout.parseFilename(item.get_desktop_file_id())
			elif item.get_type() == gmenu.TYPE_SEPARATOR:
				layout.parseSeparator()
		layout.order.append(['Merge', 'files'])
		return layout

	def __addItem(self, parent, file_id, dom):
		xml_parent = self.__getXmlMenu(self.__getPath(parent), dom, dom)
		self.__addXmlFilename(xml_parent, dom, file_id, 'Include')

	def __deleteItem(self, parent, file_id, dom, before=None, after=None):
		xml_parent = self.__getXmlMenu(self.__getPath(parent), dom, dom)
		self.__addXmlFilename(xml_parent, dom, file_id, 'Exclude')

	def __positionItem(self, parent, item, before=None, after=None):
		if not before and not after:
			return
		current = parent.contents.index(item)
		if after:
			index = parent.contents.index(after)
			if current > index:
				index += 1
		elif before:
			index = parent.contents.index(before)
			if current < index:
				index -= 1
		contents = parent.contents
		#if this is a move to a new parent you can't remove the item
		try:
			contents.remove(item)
		except:
			pass
		contents.insert(index, item)
		layout = self.__createLayout(contents)
		dom = self.__getMenu(parent).dom
		menu_xml = self.__getXmlMenu(self.__getPath(parent), dom, dom)
		self.__addXmlLayout(menu_xml, layout, dom)

	def __undoMoves(self, element, old, new, dom):
		nodes = []
		matches = []
		original_old = old
		final_old = old
		#get all <Move> elements
		for node in self.__getXmlNodesByName(['Move'], element):
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
							xml_menu = self.__getXmlMenu(root_path + '/' + new, dom, dom)
							for app_dir in node.getElementsByTagName('AppDir'):
								xml_menu.appendChild(app_dir)
							for dir_dir in node.getElementsByTagName('DirectoryDir'):
								xml_menu.appendChild(dir_dir)
							parent = node.parentNode
							parent.removeChild(node)
					node = dom.createElement('Move')
					node.appendChild(self.__addXmlTextElement(node, 'Old', xml_old.childNodes[0].nodeValue, dom))
					node.appendChild(self.__addXmlTextElement(node, 'New', os.path.join(new, path[1]), dom))
					element.appendChild(node)
			if final_old == new:
				return True
			node = dom.createElement('Move')
			node.appendChild(self.__addXmlTextElement(node, 'Old', final_old, dom))
			node.appendChild(self.__addXmlTextElement(node, 'New', new, dom))
			return element.appendChild(node)

class Layout:
	def __init__(self, node=None):
		self.order = []

	def parseMenuname(self, value):
		self.order.append(['Menuname', value])

	def parseSeparator(self):
		self.order.append(['Separator'])

	def parseFilename(self, value):
		self.order.append(['Filename', value])

	def parseMerge(self, merge_type='all'):
		self.order.append(['Merge', merge_type])
