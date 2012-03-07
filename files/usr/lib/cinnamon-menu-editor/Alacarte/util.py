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
#   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

import os
import gtk, gmenu
from ConfigParser import ConfigParser

class DesktopParser(ConfigParser):
	def __init__(self, filename=None, file_type='Application'):
		ConfigParser.__init__(self)
		self.filename = filename
		self.file_type = file_type
		if filename:
			if len(self.read(filename)) == 0:
				#file doesn't exist
				self.add_section('Desktop Entry')
		else:
			self.add_section('Desktop Entry')
		self._list_separator = ';'

	def optionxform(self, option):
		#makes keys not be lowercase
		return option

	def get(self, option, locale=None):
		locale_option = option + '[%s]' % locale
		try:
			value = ConfigParser.get(self, 'Desktop Entry', locale_option)
		except:
			try:
				value = ConfigParser.get(self, 'Desktop Entry', option)
			except:
				return None
		if self._list_separator in value:
			value = value.split(self._list_separator)
		if value == 'true':
			value = True
		if value == 'false':
			value = False
		return value

	def set(self, option, value, locale=None):
		if locale:
			option = option + '[%s]' % locale
		if value == True:
			value = 'true'
		if value == False:
			value = 'false'
		if isinstance(value, tuple) or isinstance(value, list):
			value = self._list_separator.join(value) + ';'
		ConfigParser.set(self, 'Desktop Entry', option, value)

	def write(self, file_object):
		file_object.write('[Desktop Entry]\n')
		items = []
		if not self.filename:
			file_object.write('Encoding=UTF-8\n')
			file_object.write('Type=' + str(self.file_type) + '\n')
		for item in self.items('Desktop Entry'):
			items.append(item)
		items.sort()
		for item in items:
			file_object.write(item[0] + '=' + item[1] + '\n')

def getUniqueFileId(name, extension):
	append = 0
	while 1:
		if append == 0:
			filename = name + extension
		else:
			filename = name + '-' + str(append) + extension
		if extension == '.desktop':
			path = getUserItemPath()
			if not os.path.isfile(os.path.join(path, filename)) and not getItemPath(filename):
				break
		elif extension == '.directory':
			path = getUserDirectoryPath()
			if not os.path.isfile(os.path.join(path, filename)) and not getDirectoryPath(filename):
				break
		append += 1
	return filename

def getUniqueRedoFile(filepath):
	append = 0
	while 1:
		new_filepath = filepath + '.redo-' + str(append)
		if not os.path.isfile(new_filepath):
			break
		else:
			append += 1
	return new_filepath

def getUniqueUndoFile(filepath):
	filename, extension = os.path.split(filepath)[1].rsplit('.', 1)
	append = 0
	while 1:
		if extension == 'desktop':
			path = getUserItemPath()
		elif extension == 'directory':
			path = getUserDirectoryPath()
		elif extension == 'menu':
			path = getUserMenuPath()
		new_filepath = os.path.join(path, filename + '.' + extension + '.undo-' + str(append))
		if not os.path.isfile(new_filepath):
			break
		else:
			append += 1
	return new_filepath

def getUserMenuPath():
	menu_dir = None
	if os.environ.has_key('XDG_CONFIG_HOME'):
		menu_dir = os.path.join(os.environ['XDG_CONFIG_HOME'], 'menus')
	else:
		menu_dir = os.path.join(os.environ['HOME'], '.config', 'menus')
	#move .config out of the way if it's not a dir, it shouldn't be there
	if os.path.isfile(os.path.split(menu_dir)[0]):
		os.rename(os.path.split(menu_dir)[0], os.path.split(menu_dir)[0] + '.old')
	if not os.path.isdir(menu_dir):
		os.makedirs(menu_dir)
	return menu_dir

def getItemPath(file_id):
	if os.environ.has_key('XDG_DATA_DIRS'):
		for system_path in os.environ['XDG_DATA_DIRS'].split(':'):
			file_path = os.path.join(system_path, 'applications', file_id)
			if os.path.isfile(file_path):
				return file_path
	file_path = os.path.join('/', 'usr', 'share', 'applications', file_id)
	if os.path.isfile(file_path):
		return file_path
	return False

def getUserItemPath():
	item_dir = None
	if os.environ.has_key('XDG_DATA_HOME'):
		item_dir = os.path.join(os.environ['XDG_DATA_HOME'], 'applications')
	else:
		item_dir = os.path.join(os.environ['HOME'], '.local', 'share', 'applications')
	if not os.path.isdir(item_dir):
		os.makedirs(item_dir)
	return item_dir

def getDirectoryPath(file_id):
	home = getUserDirectoryPath()
	file_path = os.path.join(home, file_id)
	if os.path.isfile(file_path):
		return file_path
	if os.environ.has_key('XDG_DATA_DIRS'):
		for system_path in os.environ['XDG_DATA_DIRS'].split(':'):
			file_path = os.path.join(system_path, 'desktop-directories', file_id)
			if os.path.isfile(file_path):
				return file_path
	file_path = os.path.join('/', 'usr', 'share', 'desktop-directories', file_id)
	if os.path.isfile(file_path):
		return file_path
	return False

def getUserDirectoryPath():
	menu_dir = None
	if os.environ.has_key('XDG_DATA_HOME'):
		menu_dir = os.path.join(os.environ['XDG_DATA_HOME'], 'desktop-directories')
	else:
		menu_dir = os.path.join(os.environ['HOME'], '.local', 'share', 'desktop-directories')
	if not os.path.isdir(menu_dir):
		os.makedirs(menu_dir)
	return menu_dir

def getSystemMenuPath(file_name):
	if os.environ.has_key('XDG_CONFIG_DIRS'):
		for system_path in os.environ['XDG_CONFIG_DIRS'].split(':'):
			file_path = os.path.join(system_path, 'menus', file_name)
			if os.path.isfile(file_path):
				return file_path
	file_path = os.path.join('/', 'etc', 'xdg', 'menus', file_name)
	if os.path.isfile(file_path):
		return file_path
	return False

def getUserMenuXml(tree):
	system_file = getSystemMenuPath(tree.get_menu_file())
	name = tree.root.get_menu_id()
	menu_xml = "<!DOCTYPE Menu PUBLIC '-//freedesktop//DTD Menu 1.0//EN' 'http://standards.freedesktop.org/menu-spec/menu-1.0.dtd'>\n"
	menu_xml += "<Menu>\n  <Name>" + name + "</Name>\n  "
	menu_xml += "<MergeFile type=\"parent\">" + system_file +	"</MergeFile>\n</Menu>\n"
	return menu_xml

def getIcon(item, for_properties=False):
	pixbuf, path = None, None
	if item == None:
		if for_properties:
			return None, None
		return None
	if isinstance(item, str):
		iconName = item
	else:
		iconName = item.get_icon()
	if iconName and not '/' in iconName and iconName[-3:] in ('png', 'svg', 'xpm'):
		iconName = iconName[:-4]
	icon_theme = gtk.icon_theme_get_default()
	try:
		pixbuf = icon_theme.load_icon(iconName, 24, 0)
		path = icon_theme.lookup_icon(iconName, 24, 0).get_filename()
	except:
		if iconName and '/' in iconName:
			try:
				pixbuf = gtk.gdk.pixbuf_new_from_file_at_size(iconName, 24, 24)
				path = iconName
			except:
				pass
		if pixbuf == None:
			if for_properties:
				return None, None
			if item.get_type() == gmenu.TYPE_DIRECTORY:
				iconName = 'gnome-fs-directory'
			elif item.get_type() == gmenu.TYPE_ENTRY:
				iconName = 'application-default-icon'
			try:
				pixbuf = icon_theme.load_icon(iconName, 24, 0)
				path = icon_theme.lookup_icon(iconName, 24, 0).get_filename()
			except:
				return None
	if pixbuf == None:
		return None
	if pixbuf.get_width() != 24 or pixbuf.get_height() != 24:
		pixbuf = pixbuf.scale_simple(24, 24, gtk.gdk.INTERP_HYPER)
	if for_properties:
		return pixbuf, path
	return pixbuf
