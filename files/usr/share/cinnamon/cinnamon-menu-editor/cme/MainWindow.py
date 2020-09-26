# -*- coding: utf-8 -*-
# vim: set noexpandtab:
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

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('CMenu', '3.0')
from gi.repository import Gtk, GObject, Gdk, CMenu
import html
import os
import gettext
import subprocess

from cme import config
gettext.bindtextdomain(config.GETTEXT_PACKAGE, config.localedir)
gettext.textdomain(config.GETTEXT_PACKAGE)

_ = gettext.gettext
from cme.MenuEditor import MenuEditor
from cme import util

class MainWindow(object):
    timer = None
    #hack to make editing menu properties work
    edit_pool = []

    def __init__(self, datadir, version):
        self.file_path = datadir
        self.version = version
        self.editor = MenuEditor()
        self.editor.tree.connect("changed", self.menuChanged)
        Gtk.Window.set_default_icon_name('alacarte')
        self.tree = Gtk.Builder()
        self.tree.set_translation_domain(config.GETTEXT_PACKAGE)
        self.tree.add_from_file('/usr/share/cinnamon/cinnamon-menu-editor/cinnamon-menu-editor.ui')
        self.tree.connect_signals(self)
        self.setupMenuTree()
        self.setupItemTree()

        self.popup_menu = Gtk.Menu()

        self.cut_menu_item = Gtk.ImageMenuItem.new_from_stock("gtk-cut")
        self.cut_menu_item.connect("activate", self.on_edit_cut_activate)
        self.popup_menu.append(self.cut_menu_item)

        self.copy_menu_item = Gtk.ImageMenuItem.new_from_stock("gtk-copy")
        self.copy_menu_item.connect("activate", self.on_edit_copy_activate)
        self.popup_menu.append(self.copy_menu_item)

        self.paste_menu_item = Gtk.ImageMenuItem.new_from_stock("gtk-paste")
        self.paste_menu_item.connect("activate", self.on_edit_paste_activate)
        self.popup_menu.append(self.paste_menu_item)

        self.delete_menu_item = Gtk.ImageMenuItem.new_from_stock("gtk-delete")
        self.delete_menu_item.connect("activate", self.on_edit_delete_activate)
        self.popup_menu.append(self.delete_menu_item)

        self.properties_menu_item = Gtk.ImageMenuItem.new_from_stock("gtk-properties")
        self.properties_menu_item.connect("activate", self.on_edit_properties_activate)
        self.popup_menu.append(self.properties_menu_item)

        self.popup_menu.show_all()

        self.cut_copy_buffer = None
        self.file_id = None
        self.last_tree = None
        self.main_window = self.tree.get_object('mainwindow')

        self.tree.get_object("action_box").set_layout(Gtk.ButtonBoxStyle.EDGE)

    def run(self):
        self.loadMenus()
        self.main_window.show_all()
        Gtk.main()

    def menuChanged(self, *a):
        self.loadUpdates()

    def loadUpdates(self):
        menu_tree = self.tree.get_object('menu_tree')
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        update_items = False
        update_type = None
        item_id = None
        if iter:
            update_items = True
            if isinstance(items[iter][3], CMenu.TreeEntry):
                item_id = items[iter][3].get_desktop_file_id()
                update_type = CMenu.TreeItemType.ENTRY
            elif isinstance(items[iter][3], CMenu.TreeDirectory):
                item_id = os.path.split(items[iter][3].get_desktop_file_path())[1]
                update_type = CMenu.TreeItemType.DIRECTORY
            elif isinstance(items[iter][3], CMenu.TreeSeparator):
                item_id = items.get_path(iter)
                update_type = CMenu.TreeItemType.SEPARATOR
        menus, iter = menu_tree.get_selection().get_selected()
        update_menus = False
        menu_id = None
        if iter:
            if menus[iter][3].get_desktop_file_path():
                menu_id = os.path.split(menus[iter][3].get_desktop_file_path())[1]
            else:
                menu_id = menus[iter][3].get_menu_id()
            update_menus = True
        self.loadMenus()
        #find current menu in new tree
        if update_menus:
            menu_tree.get_model().foreach(self.findMenu, menu_id)
            menus, iter = menu_tree.get_selection().get_selected()
            if iter:
                self.on_menu_tree_cursor_changed(menu_tree)
        #find current item in new list
        if update_items:
            i = 0
            for item in item_tree.get_model():
                found = False
                if update_type != CMenu.TreeItemType.SEPARATOR:
                    if isinstance (item[3], CMenu.TreeEntry) and item[3].get_desktop_file_id() == item_id:
                        found = True
                    if isinstance (item[3], CMenu.TreeDirectory) and item[3].get_desktop_file_path() and update_type == CMenu.TreeItemType.DIRECTORY:
                        if os.path.split(item[3].get_desktop_file_path())[1] == item_id:
                            found = True
                if isinstance(item[3], CMenu.TreeSeparator):
                    if not isinstance(item_id, tuple):
                        #we may not skip the increment via "continue"
                        i += 1
                        continue
                    #separators have no id, have to find them manually
                    #probably won't work with two separators together
                    if (item_id[0] - 1,) == (i,):
                        found = True
                    elif (item_id[0] + 1,) == (i,):
                        found = True
                    elif (item_id[0],) == (i,):
                        found = True
                if found:
                    item_tree.get_selection().select_path((i,))
                    self.on_item_tree_cursor_changed(item_tree)
                    break
                i += 1
        return False

    def findMenu(self, menus, path, iter, menu_id):
        if not menus[path][3].get_desktop_file_path():
            if menu_id == menus[path][3].get_menu_id():
                menu_tree = self.tree.get_object('menu_tree')
                menu_tree.expand_to_path(path)
                menu_tree.get_selection().select_path(path)
                return True
            return False
        if os.path.split(menus[path][3].get_desktop_file_path())[1] == menu_id:
            menu_tree = self.tree.get_object('menu_tree')
            menu_tree.expand_to_path(path)
            menu_tree.get_selection().select_path(path)
            return True

    def setupMenuTree(self):
        self.menu_store = Gtk.TreeStore(object, str, bool, object) # bool is unused, just a placeholder
        menus = self.tree.get_object('menu_tree')                            # so object is the same index for
        column = Gtk.TreeViewColumn(_("Name"))                               # the menu tree and item tree
        column.set_spacing(4)
        cell = Gtk.CellRendererPixbuf()
        column.pack_start(cell, False)
        column.set_cell_data_func(cell, self.icon_data_func, 0)
        cell = Gtk.CellRendererText()
        column.pack_start(cell, True)
        column.add_attribute(cell, 'markup', 1)
        menus.append_column(column)
        menus.get_selection().set_mode(Gtk.SelectionMode.BROWSE)

    def setupItemTree(self):
        items = self.tree.get_object('item_tree')
        column = Gtk.TreeViewColumn(_("Show"))
        cell = Gtk.CellRendererToggle()
        cell.connect('toggled', self.on_item_tree_show_toggled)
        column.pack_start(cell, True)
        column.add_attribute(cell, 'active', 0)
        #hide toggle for separators
        column.set_cell_data_func(cell, self._cell_data_toggle_func)
        items.append_column(column)
        column = Gtk.TreeViewColumn(_("Item"))
        column.set_spacing(4)
        cell = Gtk.CellRendererPixbuf()
        column.pack_start(cell, False)
        column.set_cell_data_func(cell, self.icon_data_func, 1)
        cell = Gtk.CellRendererText()
        column.pack_start(cell, True)
        column.add_attribute(cell, 'markup', 2)
        items.append_column(column)
        self.item_store = Gtk.ListStore(bool, object, str, object)
        items.set_model(self.item_store)

    def icon_data_func(self, column, cell, model, iter, data=None):
        wrapper = model.get_value(iter, data)
        if wrapper:
            cell.set_property("surface", wrapper.surface)

    def _cell_data_toggle_func(self, tree_column, renderer, model, treeiter, data=None):
        if isinstance(model[treeiter][3], CMenu.TreeSeparator):
            renderer.set_property('visible', False)
        else:
            renderer.set_property('visible', True)

    def loadMenus(self):
        self.menu_store.clear()
        self.loadMenu({ None: None })

        menu_tree = self.tree.get_object('menu_tree')
        menu_tree.set_model(self.menu_store)
        for menu in self.menu_store:
            menu_tree.expand_to_path(menu.path)
        menu_tree.get_selection().select_path((0,))
        self.on_menu_tree_cursor_changed(menu_tree)

    def loadMenu(self, iters, parent=None):
        for menu, show in self.editor.getMenus(parent):
            name = html.escape(menu.get_name())
            if not show:
                name = "<small><i>%s</i></small>" % (name,)

            icon = util.getIcon(menu, self.main_window)
            iters[menu] = self.menu_store.append(iters[parent], (icon, name, False, menu))
            self.loadMenu(iters, menu)

    def loadItems(self, menu):
        self.item_store.clear()
        for item, show in self.editor.getItems(menu):
            icon = util.getIcon(item, self.main_window)
            if isinstance(item, CMenu.TreeDirectory):
                name = item.get_name()
            elif isinstance(item, CMenu.TreeEntry):
                name = item.get_app_info().get_display_name()
            elif isinstance(item, CMenu.TreeSeparator):
                name = '---'
            else:
                assert False, 'should not be reached'

            name = html.escape(name)
            if not show:
                name = "<small><i>%s</i></small>" % (name,)

            self.item_store.append((show, icon, name, item))

    #this is a little timeout callback to insert new items after
    #gnome-desktop-item-edit has finished running
    def waitForNewItemProcess(self, process, parent_id, file_path):
        if process.poll() is not None:
            if os.path.isfile(file_path):
                self.editor.insertExternalItem(os.path.split(file_path)[1], parent_id)
            return False
        return True

    def waitForNewMenuProcess(self, process, parent_id, file_path):
        if process.poll() is not None:
            if os.path.isfile(file_path):
                self.editor.insertExternalMenu(os.path.split(file_path)[1], parent_id)
            return False
        return True

    #this callback keeps you from editing the same item twice
    def waitForEditProcess(self, process, file_path):
        if process.poll() is not None:
            self.edit_pool.remove(file_path)
            return False
        return True

    def on_new_menu_button_clicked(self, button):
        menu_tree = self.tree.get_object('menu_tree')
        menus, iter = menu_tree.get_selection().get_selected()
        if not iter:
            parent = menus[(0,)][3]
            menu_tree.expand_to_path((0,))
            menu_tree.get_selection().select_path((0,))
        else:
            parent = menus[iter][3]
        file_path = os.path.join(util.getUserDirectoryPath(), util.getUniqueFileId('alacarte-made', '.directory'))
        process = subprocess.Popen(['cinnamon-desktop-editor', '-mdirectory', '-o' + file_path], env=os.environ)
        GObject.timeout_add(100, self.waitForNewMenuProcess, process, parent.get_menu_id(), file_path)

    def on_new_item_button_clicked(self, button):
        menu_tree = self.tree.get_object('menu_tree')
        menus, iter = menu_tree.get_selection().get_selected()
        if not iter:
            parent = menus[(0,)][3]
            menu_tree.expand_to_path((0,))
            menu_tree.get_selection().select_path((0,))
        else:
            parent = menus[iter][3]
        file_path = os.path.join(util.getUserItemPath(), util.getUniqueFileId('alacarte-made', '.desktop'))
        process = subprocess.Popen(['cinnamon-desktop-editor', '-mlauncher', '-o' + file_path], env=os.environ)
        GObject.timeout_add(100, self.waitForNewItemProcess, process, parent.get_menu_id(), file_path)

    def on_edit_delete_activate(self, menu):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        item = items[iter][3]
        if isinstance(item, CMenu.TreeEntry):
            self.editor.deleteItem(item)
        elif isinstance(item, CMenu.TreeDirectory):
            self.editor.deleteMenu(item)
        elif isinstance(item, CMenu.TreeSeparator):
            self.editor.deleteSeparator(item)

    def on_edit_properties_activate(self, menu):
        item_tree = self.tree.get_object(self.last_tree)
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        item = items[iter][3]
        if not isinstance(item, CMenu.TreeEntry) and not isinstance(item, CMenu.TreeDirectory):
            return

        if isinstance(item, CMenu.TreeEntry):
            file_type = 'launcher'
        elif isinstance(item, CMenu.TreeDirectory):
            file_type = 'directory'

        file_path = item.get_desktop_file_path()

        if file_path not in self.edit_pool:
            self.edit_pool.append(file_path)
            process = subprocess.Popen(['cinnamon-desktop-editor', '-m' + file_type, '-o' + file_path], env=os.environ)
            GObject.timeout_add(100, self.waitForEditProcess, process, file_path)

    def on_edit_cut_activate(self, menu):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        item = items[iter][3]
        if not iter:
            return
        if not isinstance(item, CMenu.TreeEntry):
            return
        (self.cut_copy_buffer, self.file_id) = self.editor.cutItem(item)

    def on_edit_copy_activate(self, menu):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        item = items[iter][3]
        if not iter:
            return
        if not isinstance(item, CMenu.TreeEntry):
            return
        (self.cut_copy_buffer, self.file_id) = self.editor.copyItem(item)

    def on_edit_paste_activate(self, menu):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            menu_tree = self.tree.get_object('menu_tree')
            items, iter = menu_tree.get_selection().get_selected()
            if not iter:
                return
        item = items[iter][3]
        if not isinstance(item, CMenu.TreeDirectory):
            return
        if self.cut_copy_buffer is not None:
            success = self.editor.pasteItem(self.cut_copy_buffer, item, self.file_id)
            if success:
                self.cut_copy_buffer = None
                self.file_id = None

    def on_menu_tree_cursor_changed(self, treeview):
        selection = treeview.get_selection()
        if selection is None:
            return
        menus, iter = selection.get_selected()
        if iter is None:
            return
        menu = menus[iter][3]

        menu_path = menus.get_path(iter)

        item_tree = self.tree.get_object('item_tree')
        item_tree.get_selection().unselect_all()
        self.loadItems(self.menu_store[menu_path][3])
        self.set_cut_sensitive(False)
        self.set_copy_sensitive(False)
        self.set_delete_sensitive(False)
        self.set_properties_sensitive(True)

        can_paste = isinstance(menu, CMenu.TreeDirectory) and self.cut_copy_buffer is not None
        self.set_paste_sensitive(can_paste)

        index = menus.get_path(iter).get_indices()[menus.get_path(iter).get_depth() - 1]
        parent_iter = menus.iter_parent(iter)
        count =  menus.iter_n_children(parent_iter)
        can_go_up = index > 0 and isinstance(menu, CMenu.TreeDirectory)
        can_go_down = index < count - 1 and isinstance(menu, CMenu.TreeDirectory)
        self.last_tree = "menu_tree"

    def on_item_tree_show_toggled(self, cell, path):
        item = self.item_store[path][3]
        if isinstance(item, CMenu.TreeSeparator):
            return
        if self.item_store[path][0]:
            self.editor.setVisible(item, False)
        else:
            self.editor.setVisible(item, True)
        self.item_store[path][0] = not self.item_store[path][0]

    def on_item_tree_cursor_changed(self, treeview):
        selection = treeview.get_selection()
        if selection is None:
            return
        items, iter = selection.get_selected()
        if iter is None:
            return

        item = items[iter][3]
        self.set_delete_sensitive(True)

        can_edit = not isinstance(item, CMenu.TreeSeparator)
        self.set_properties_sensitive(can_edit)

        can_cut_copy = not isinstance(item, CMenu.TreeDirectory)
        self.set_cut_sensitive(can_cut_copy)
        self.set_copy_sensitive(can_cut_copy)

        can_paste = isinstance(item, CMenu.TreeDirectory) and self.cut_copy_buffer is not None
        self.set_paste_sensitive(can_paste)

        index = items.get_path(iter).get_indices()[0]
        can_go_up = index > 0 and isinstance(item, CMenu.TreeDirectory)
        can_go_down = index < len(items) - 1 and isinstance(item, CMenu.TreeDirectory)
        self.last_tree = "item_tree"

    def on_item_tree_row_activated(self, treeview, path, column):
        self.on_edit_properties_activate(None)

    def set_cut_sensitive(self, sensitive):
        self.tree.get_object("cut_button").set_sensitive(sensitive)
        self.cut_menu_item.set_sensitive(sensitive)

    def set_copy_sensitive(self, sensitive):
        self.tree.get_object("copy_button").set_sensitive(sensitive)
        self.copy_menu_item.set_sensitive(sensitive)

    def set_paste_sensitive(self, sensitive):
        self.tree.get_object("paste_button").set_sensitive(sensitive)
        self.paste_menu_item.set_sensitive(sensitive)

    def set_delete_sensitive(self, sensitive):
        self.tree.get_object("delete_button").set_sensitive(sensitive)
        self.delete_menu_item.set_sensitive(sensitive)

    def set_properties_sensitive(self, sensitive):
        self.tree.get_object("properties_button").set_sensitive(sensitive)
        self.properties_menu_item.set_sensitive(sensitive)

    def on_item_tree_popup_menu(self, item_tree, event=None):
        model, iter = item_tree.get_selection().get_selected()
        if event:
            #don't show if it's not the right mouse button
            if event.button != 3:
                return
            button = event.button
            event_time = event.time
            info = item_tree.get_path_at_pos(int(event.x), int(event.y))
            if info is not None:
                path, col, cellx, celly = info
                item_tree.grab_focus()
                item_tree.set_cursor(path, col, 0)
        else:
            path = model.get_path(iter)
            button = 0
            event_time = 0
            item_tree.grab_focus()
            item_tree.set_cursor(path, item_tree.get_columns()[0], 0)
        self.popup_menu.popup(None, None, None, None, button, event_time)
        #without this shift-f10 won't work
        return True

    def on_menu_tree_popup_menu(self, menu_tree, event=None):
        model, iter = menu_tree.get_selection().get_selected()
        if event:
            #don't show if it's not the right mouse button
            if event.button != 3:
                return
            button = event.button
            event_time = event.time
            info = menu_tree.get_path_at_pos(int(event.x), int(event.y))
            if info is not None:
                path, col, cellx, celly = info
                menu_tree.grab_focus()
                menu_tree.set_cursor(path, col, 0)
        else:
            path = model.get_path(iter)
            button = 0
            event_time = 0
            menu_tree.grab_focus()
            menu_tree.set_cursor(path, menu_tree.get_columns()[0], 0)
        popup = self.tree.get_object('edit_menu')
        popup.popup(None, None, None, None, button, event_time)
        #without this shift-f10 won't work
        return True

    def on_item_tree_key_press_event(self, item_tree, event):
        if event.keyval == Gdk.KEY_Delete:
            self.on_edit_delete_activate(item_tree)

    def on_restore_button_clicked(self, button):
        self.editor.restoreToSystem()

    def on_close_button_clicked(self, button):
        self.quit()

    def on_properties_button_clicked(self, button):
        self.on_edit_properties_activate(None)

    def on_delete_button_clicked(self, button):
        self.on_edit_delete_activate(None)

    def on_cut_button_clicked(self, button):
        self.on_edit_cut_activate(None)

    def on_copy_button_clicked(self, button):
        self.on_edit_copy_activate(None)

    def on_paste_button_clicked(self, button):
        self.on_edit_paste_activate(None)

    def on_open_desktop_file_button_clicked(self, button):
        item_tree = self.tree.get_object(self.last_tree)
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        item = items[iter][3]
        if not isinstance(item, CMenu.TreeEntry) and not isinstance(item, CMenu.TreeDirectory):
            return

        if isinstance(item, CMenu.TreeEntry):
            file_type = 'launcher'
        elif isinstance(item, CMenu.TreeDirectory):
            file_type = 'directory'

        file_path = item.get_desktop_file_path()

        subprocess.run(["xdg-open", file_path])

    def quit(self):
        Gtk.main_quit()
