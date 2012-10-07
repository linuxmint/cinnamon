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

from gi.repository import Gtk, GObject, Gio, GdkPixbuf, Gdk, GMenu, GLib
import cgi
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
        self.tree.add_from_file('/usr/lib/cinnamon-menu-editor/cinnamon-menu-editor.ui')
        self.tree.connect_signals(self)
        self.setupMenuTree()
        self.setupItemTree()
        self.tree.get_object('edit_delete').set_sensitive(False)
        self.tree.get_object('edit_properties').set_sensitive(False)
        self.tree.get_object('move_up_button').set_sensitive(False)
        self.tree.get_object('move_down_button').set_sensitive(False)

    def run(self):
        self.loadMenus()
        self.tree.get_object('mainwindow').show_all()
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
            if isinstance(items[iter][3], GMenu.TreeEntry):
                item_id = items[iter][3].get_desktop_file_id()
                update_type = GMenu.TreeItemType.ENTRY
            elif isinstance(items[iter][3], GMenu.TreeDirectory):
                item_id = os.path.split(items[iter][3].get_desktop_file_path())[1]
                update_type = GMenu.TreeItemType.DIRECTORY
            elif isinstance(items[iter][3], GMenu.TreeSeparator):
                item_id = items.get_path(iter)
                update_type = GMenu.TreeItemType.SEPARATOR
        menus, iter = menu_tree.get_selection().get_selected()
        update_menus = False
        menu_id = None
        if iter:
            if menus[iter][2].get_desktop_file_path():
                menu_id = os.path.split(menus[iter][2].get_desktop_file_path())[1]
            else:
                menu_id = menus[iter][2].get_menu_id()
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
                if update_type != GMenu.TreeItemType.SEPARATOR:
                    if isinstance (item[3], GMenu.TreeEntry) and item[3].get_desktop_file_id() == item_id:
                        found = True
                    if isinstance (item[3], GMenu.TreeDirectory) and item[3].get_desktop_file_path() and update_type == GMenu.TreeItemType.DIRECTORY:
                        if os.path.split(item[3].get_desktop_file_path())[1] == item_id:
                            found = True
                if isinstance(item[3], GMenu.TreeSeparator):
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
        if not menus[path][2].get_desktop_file_path():
            if menu_id == menus[path][2].get_menu_id():
                menu_tree = self.tree.get_object('menu_tree')
                menu_tree.expand_to_path(path)
                menu_tree.get_selection().select_path(path)
                return True
            return False
        if os.path.split(menus[path][2].get_desktop_file_path())[1] == menu_id:
            menu_tree = self.tree.get_object('menu_tree')
            menu_tree.expand_to_path(path)
            menu_tree.get_selection().select_path(path)
            return True

    def setupMenuTree(self):
        self.menu_store = Gtk.TreeStore(GdkPixbuf.Pixbuf, str, object)
        menus = self.tree.get_object('menu_tree')
        column = Gtk.TreeViewColumn(_('Name'))
        column.set_spacing(4)
        cell = Gtk.CellRendererPixbuf()
        column.pack_start(cell, False)
        column.add_attribute(cell, 'pixbuf', 0)
        cell = Gtk.CellRendererText()
        column.pack_start(cell, True)
        column.add_attribute(cell, 'markup', 1)
        menus.append_column(column)
        menus.get_selection().set_mode(Gtk.SelectionMode.BROWSE)

    def setupItemTree(self):
        items = self.tree.get_object('item_tree')
        column = Gtk.TreeViewColumn(_('Show'))
        cell = Gtk.CellRendererToggle()
        cell.connect('toggled', self.on_item_tree_show_toggled)
        column.pack_start(cell, True)
        column.add_attribute(cell, 'active', 0)
        #hide toggle for separators
        column.set_cell_data_func(cell, self._cell_data_toggle_func)
        items.append_column(column)
        column = Gtk.TreeViewColumn(_('Item'))
        column.set_spacing(4)
        cell = Gtk.CellRendererPixbuf()
        column.pack_start(cell, False)
        column.add_attribute(cell, 'pixbuf', 1)
        cell = Gtk.CellRendererText()
        column.pack_start(cell, True)
        column.add_attribute(cell, 'markup', 2)
        items.append_column(column)
        self.item_store = Gtk.ListStore(bool, GdkPixbuf.Pixbuf, str, object)
        items.set_model(self.item_store)

    def _cell_data_toggle_func(self, tree_column, renderer, model, treeiter, data=None):
        if isinstance(model[treeiter][3], GMenu.TreeSeparator):
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
            name = cgi.escape(menu.get_name())
            if not show:
                name = "<small><i>%s</i></small>" % (name,)

            icon = util.getIcon(menu)
            iters[menu] = self.menu_store.append(iters[parent], (icon, name, menu))
            self.loadMenu(iters, menu)

    def loadItems(self, menu):
        self.item_store.clear()
        for item, show in self.editor.getItems(menu):
            icon = util.getIcon(item)
            if isinstance(item, GMenu.TreeDirectory):
                name = item.get_name()
            elif isinstance(item, GMenu.TreeEntry):
                name = item.get_app_info().get_display_name()
            elif isinstance(item, GMenu.TreeSeparator):
                name = '---'
            else:
                assert False, 'should not be reached'

            name = cgi.escape(name)
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
            parent = menus[(0,)][2]
            menu_tree.expand_to_path((0,))
            menu_tree.get_selection().select_path((0,))
        else:
            parent = menus[iter][2]
        file_path = os.path.join(util.getUserDirectoryPath(), util.getUniqueFileId('alacarte-made', '.directory'))
        process = subprocess.Popen(['gnome-desktop-item-edit', file_path], env=os.environ)
        GObject.timeout_add(100, self.waitForNewMenuProcess, process, parent.get_menu_id(), file_path)

    def on_new_item_button_clicked(self, button):
        menu_tree = self.tree.get_object('menu_tree')
        menus, iter = menu_tree.get_selection().get_selected()
        if not iter:
            parent = menus[(0,)][2]
            menu_tree.expand_to_path((0,))
            menu_tree.get_selection().select_path((0,))
        else:
            parent = menus[iter][2]
        file_path = os.path.join(util.getUserItemPath(), util.getUniqueFileId('alacarte-made', '.desktop'))
        process = subprocess.Popen(['gnome-desktop-item-edit', file_path], env=os.environ)
        GObject.timeout_add(100, self.waitForNewItemProcess, process, parent.get_menu_id(), file_path)

    def on_edit_delete_activate(self, menu):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        item = items[iter][3]
        if isinstance(item, GMenu.TreeEntry):
            self.editor.deleteItem(item)
        elif isinstance(item, GMenu.TreeDirectory):
            self.editor.deleteMenu(item)
        elif isinstance(item, GMenu.TreeSeparator):
            self.editor.deleteSeparator(item)

    def on_edit_properties_activate(self, menu):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        item = items[iter][3]
        if not isinstance(item, GMenu.TreeEntry) and not isinstance(item, GMenu.TreeDirectory):
            return

        if isinstance(item, GMenu.TreeEntry):
            file_path = os.path.join(util.getUserItemPath(), item.get_desktop_file_id())
            file_type = 'Item'
        elif isinstance(item, GMenu.TreeDirectory):
            file_path = os.path.join(util.getUserDirectoryPath(), os.path.split(item.get_desktop_file_path())[1])
            file_type = 'Menu'

        if not os.path.isfile(file_path):
            data = open(item.get_desktop_file_path()).read()
            open(file_path, 'w').write(data)

        if file_path not in self.edit_pool:
            self.edit_pool.append(file_path)
            process = subprocess.Popen(['gnome-desktop-item-edit', file_path], env=os.environ)
            GObject.timeout_add(100, self.waitForEditProcess, process, file_path)

    def on_menu_tree_cursor_changed(self, treeview):
        selection = treeview.get_selection()
        if selection is None:
            return
        menus, iter = selection.get_selected()
        if iter is None:
            return
        menu_path = menus.get_path(iter)
        item_tree = self.tree.get_object('item_tree')
        item_tree.get_selection().unselect_all()
        self.loadItems(self.menu_store[menu_path][2])
        self.tree.get_object('edit_delete').set_sensitive(False)
        self.tree.get_object('edit_properties').set_sensitive(False)
        self.tree.get_object('move_up_button').set_sensitive(False)
        self.tree.get_object('move_down_button').set_sensitive(False)
        self.tree.get_object('properties_button').set_sensitive(False)
        self.tree.get_object('delete_button').set_sensitive(False)

    def on_item_tree_show_toggled(self, cell, path):
        item = self.item_store[path][3]
        if isinstance(item, GMenu.TreeSeparator):
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
        self.tree.get_object('edit_delete').set_sensitive(True)
        self.tree.get_object('delete_button').set_sensitive(True)

        can_edit = not isinstance(item, GMenu.TreeSeparator)
        self.tree.get_object('edit_properties').set_sensitive(can_edit)
        self.tree.get_object('properties_button').set_sensitive(can_edit)

        index = items.get_path(iter).get_indices()[0]
        can_go_up = index > 0 and isinstance(item, GMenu.TreeDirectory)
        can_go_down = index < len(items) - 1 and isinstance(item, GMenu.TreeDirectory)
        self.tree.get_object('move_up_button').set_sensitive(can_go_up)
        self.tree.get_object('move_down_button').set_sensitive(can_go_down)

    def on_item_tree_row_activated(self, treeview, path, column):
        self.on_edit_properties_activate(None)

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
        popup = self.tree.get_object('edit_menu')
        popup.popup(None, None, None, None, button, event_time)
        #without this shift-f10 won't work
        return True

    def on_item_tree_key_press_event(self, item_tree, event):
        if event.keyval == Gdk.KEY_Delete:
            self.on_edit_delete_activate(item_tree)

    def on_move_up_button_clicked(self, button):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        path = items.get_path(iter)
        #at top, can't move up
        if path.get_indices()[0] == 0:
            return
        item = items[path][3]
        before = items[(path.get_indices()[0] - 1,)][3]
        self.editor.moveItem(item.get_parent(), item, before=before)    

    def on_move_down_button_clicked(self, button):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        path = items.get_path(iter)
        #at bottom, can't move down
        if path.get_indices()[0] == (len(items) - 1):
            return
        item = items[path][3]
        after = items[path][3]
        self.editor.moveItem(item.get_parent(), item, after=after)

    def on_restore_button_clicked(self, button):
        self.editor.restoreToSystem()

    def on_close_button_clicked(self, button):
        self.quit()

    def on_properties_button_clicked(self, button):
        self.on_edit_properties_activate(None)
    def on_delete_button_clicked(self, button):
        self.on_edit_delete_activate(None)

    def quit(self):
        Gtk.main_quit()
