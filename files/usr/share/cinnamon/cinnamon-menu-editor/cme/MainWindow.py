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
from gi.repository import GLib, Gtk, Gdk, CMenu
import html
import os
from pathlib import Path
import gettext
import subprocess

from cme import config
gettext.bindtextdomain(config.GETTEXT_PACKAGE, config.LOCALEDIR)
gettext.textdomain(config.GETTEXT_PACKAGE)

_ = gettext.gettext
from cme.MenuEditor import MenuEditor
from cme import util

class MainWindow(object):
    def __init__(self):
        self.editor = MenuEditor()
        self.editor.tree.connect("changed", self._menuChanged)
        Gtk.Window.set_default_icon_name('menu-editor')
        self.tree = Gtk.Builder()
        self.tree.set_translation_domain(config.GETTEXT_PACKAGE)
        ui_path = os.path.join(config.PKGDATADIR, 'cinnamon-menu-editor.ui')
        self.tree.add_from_file(ui_path)
        self.tree.connect_signals(self)
        self._setupMenuTree()
        self._setupItemTree()

        self.popup_menu = Gtk.Menu()

        self.delete_menu_item = self._create_popup_menu_item(_("Delete"), "edit-delete")
        self.delete_menu_item.connect("activate", self._on_edit_delete_restore_activate)
        self.popup_menu.append(self.delete_menu_item)
        self.restore_menu_item = self._create_popup_menu_item(_("Restore"), "edit-undo")
        self.restore_menu_item.connect("activate", self._on_edit_delete_restore_activate)
        self.popup_menu.append(self.restore_menu_item)
        self.properties_menu_item = self._create_popup_menu_item(_("Properties"), "document-properties")
        self.properties_menu_item.connect("activate", self._on_edit_properties_activate)
        self.popup_menu.append(self.properties_menu_item)

        self.popup_menu.show_all()

        self.file_id = None
        self.last_tree = None
        self.main_window = self.tree.get_object('mainwindow')

        self.paned = self.tree.get_object('main_paned')
        self.main_window.connect("map", self._on_window_mapped)

    def _create_popup_menu_item(self, label, icon_name):
        item = Gtk.ImageMenuItem(label=label)
        image = Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.MENU)
        item.set_image(image)
        return item

    def run(self):
        self._loadMenus()
        self.main_window.show_all()
        Gtk.main()

    def _on_window_mapped(self, widget):
        allocation = self.paned.get_allocation()
        self.paned.set_position(allocation.width // 2)

    def _show_message(self, title, message, buttons=Gtk.ButtonsType.OK, msg_type=Gtk.MessageType.INFO):
        dialog = Gtk.MessageDialog(
            transient_for=self.main_window,
            flags=0,
            message_type=msg_type,
            buttons=buttons,
            text=message
        )
        dialog.set_title(title)
        response = dialog.run()
        dialog.destroy()
        return response

    def _menuChanged(self, *a):
        self._loadUpdates()

    def _loadUpdates(self):
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
                item_id = Path(items[iter][3].get_desktop_file_path()).name
                update_type = CMenu.TreeItemType.DIRECTORY

        menus, iter = menu_tree.get_selection().get_selected()
        update_menus = False
        menu_id = None
        if iter:
            if menus[iter][3].get_desktop_file_path():
                menu_id = Path(menus[iter][3].get_desktop_file_path()).name
            else:
                menu_id = menus[iter][3].get_menu_id()
            update_menus = True
        self._loadMenus()
        #find current menu in new tree
        if update_menus:
            menu_tree.get_model().foreach(self._findMenu, menu_id)
            menus, iter = menu_tree.get_selection().get_selected()
            if iter:
                self.on_menu_tree_cursor_changed(menu_tree)
        #find current item in new list
        if update_items:
            i = 0
            for item in item_tree.get_model():
                found = False
                if isinstance (item[3], CMenu.TreeEntry) and item[3].get_desktop_file_id() == item_id:
                    found = True
                if isinstance (item[3], CMenu.TreeDirectory) and item[3].get_desktop_file_path() and update_type == CMenu.TreeItemType.DIRECTORY:
                    if Path(item[3].get_desktop_file_path()).name == item_id:
                        found = True
                if found:
                    item_tree.get_selection().select_path((i,))
                    self.on_item_tree_cursor_changed(item_tree)
                    break
                i += 1
        return False

    def _findMenu(self, menus, path, iter, menu_id):
        if not menus[path][3].get_desktop_file_path():
            if menu_id == menus[path][3].get_menu_id():
                menu_tree = self.tree.get_object('menu_tree')
                menu_tree.expand_to_path(path)
                menu_tree.get_selection().select_path(path)
                return True
            return False
        if Path(menus[path][3].get_desktop_file_path()).name == menu_id:
            menu_tree = self.tree.get_object('menu_tree')
            menu_tree.expand_to_path(path)
            menu_tree.get_selection().select_path(path)
            return True

    def _setupMenuTree(self):
        self.menu_store = Gtk.TreeStore(object, str, bool, object) # bool is unused, just a placeholder
        menus = self.tree.get_object('menu_tree')                            # so object is the same index for
        column = Gtk.TreeViewColumn(_("Name"))                               # the menu tree and item tree
        column.set_spacing(4)
        cell = Gtk.CellRendererPixbuf()
        column.pack_start(cell, False)
        column.set_cell_data_func(cell, self._icon_data_func, 0)
        cell = Gtk.CellRendererText()
        column.pack_start(cell, True)
        column.add_attribute(cell, 'markup', 1)
        menus.append_column(column)
        menus.get_selection().set_mode(Gtk.SelectionMode.BROWSE)

    def _setupItemTree(self):
        items = self.tree.get_object('item_tree')
        column = Gtk.TreeViewColumn(_("Item"))
        column.set_expand(True)
        column.set_spacing(4)
        cell = Gtk.CellRendererPixbuf()
        column.pack_start(cell, False)
        column.set_cell_data_func(cell, self._icon_data_func, 1)
        cell = Gtk.CellRendererText()
        column.pack_start(cell, True)
        column.add_attribute(cell, 'markup', 2)
        items.append_column(column)
        self.item_store = Gtk.ListStore(bool, object, str, object)
        items.set_model(self.item_store)

    def _icon_data_func(self, column, cell, model, iter, data=None):
        wrapper = model.get_value(iter, data)
        if wrapper:
            cell.set_property("surface", wrapper.surface)

    def _loadMenus(self):
        self.menu_store.clear()
        root_menu = self.editor.tree.get_root_directory()
        self._loadMenu({root_menu: None}, root_menu)
        

        menu_tree = self.tree.get_object('menu_tree')
        menu_tree.set_model(self.menu_store)
        for menu in self.menu_store:
            menu_tree.expand_to_path(menu.path)
        menu_tree.get_selection().select_path((0,))
        self.on_menu_tree_cursor_changed(menu_tree)

    def _loadMenu(self, iters, parent=None):
        for menu, show in self.editor.getMenus(parent):
            name = html.escape(menu.get_name())
            if not show:
                name = "<span alpha='32768'><i>%s</i></span>" % (name,)

            icon = util.getIcon(menu, self.main_window)
            iters[menu] = self.menu_store.append(iters[parent], (icon, name, False, menu))
            self._loadMenu(iters, menu)

    def _loadItems(self, menu):
        self.item_store.clear()
        for item, show in self.editor.getItems(menu):
            icon = util.getIcon(item, self.main_window)
            if isinstance(item, CMenu.TreeDirectory):
                name = item.get_name()
            elif isinstance(item, CMenu.TreeEntry):
                name = item.get_app_info().get_display_name()
            else:
                assert False, 'should not be reached'

            name = html.escape(name)
            if not show:
                name = "<span alpha='32768'><i>%s</i></span>" % (name,)

            self.item_store.append((show, icon, name, item))

    def _on_new_menu_editor_exited(self, pid, status, file_path):        
        GLib.spawn_close_pid(pid)
        if Path(file_path).is_file():
            self.editor.insertExternalMenu(Path(file_path).name)
    
    def _on_launcher_editor_exited(self, pid, status):
        GLib.spawn_close_pid(pid)

    def on_new_menu_button_clicked(self, button):
        file_path = Path(util.getUserDirectoryDir()) / util.getUniqueFileId('custom', '.directory')
        process = subprocess.Popen(['cinnamon-desktop-editor', '-mdirectory', '-o' + str(file_path)], env=os.environ)
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, process.pid, self._on_new_menu_editor_exited, file_path)

    def on_new_launcher_button_clicked(self, button):
        file_path = Path(util.getUserItemDir()) / util.getUniqueFileId('custom', '.desktop')
        process = subprocess.Popen(['cinnamon-desktop-editor', '-mlauncher', '-o' + str(file_path)], env=os.environ)
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, process.pid, self._on_launcher_editor_exited)

    def _on_edit_delete_restore_activate(self, menu):
        item_tree = self.tree.get_object('item_tree')
        items, iter = item_tree.get_selection().get_selected()

        if not iter:
            menu_tree = self.tree.get_object('menu_tree')
            items, iter = menu_tree.get_selection().get_selected()

        if not iter:
            return
        item = items[iter][3]

        if isinstance(item, CMenu.TreeEntry):
            file_id = item.get_desktop_file_id()
            match self.editor.getIsItemUserOrSystem(item):
                case "user only":
                    res = self._show_message(
                        _("Delete Menu Entry"),
                        _("This will delete '%s' launcher from all menu categories and delete it's associated .desktop file. Are you sure?") % item.get_app_info().get_name(),
                        Gtk.ButtonsType.YES_NO,
                        Gtk.MessageType.WARNING
                    )
                    if res == Gtk.ResponseType.YES:
                        self.editor.deleteUserDesktopFile(file_id)
                case "both":
                    res = self._show_message(
                        _("Restore Entry"),
                        _("Restore entry to system default?"),
                        Gtk.ButtonsType.OK_CANCEL,
                        Gtk.MessageType.QUESTION
                    )
                    if res == Gtk.ResponseType.OK:
                        self.editor.deleteUserDesktopFile(file_id)
                case "system only":
                    self._show_message(
                        _("Cannot Delete"),
                        _("This is a system entry and cannot be deleted."),
                        Gtk.ButtonsType.OK,
                        Gtk.MessageType.ERROR
                    )

        elif isinstance(item, CMenu.TreeDirectory):
            match self.editor.getIsItemUserOrSystem(item):
                case "user only":
                    res = self._show_message(
                        _("Delete Menu Category?"),
                        _("Delete the menu '%s' and it's associated .directory file? Items inside the menu will not be deleted.") % item.get_name(),
                        Gtk.ButtonsType.YES_NO,
                        Gtk.MessageType.WARNING
                    )
                    if res == Gtk.ResponseType.YES:
                        self.editor.removeCustomMenu(item)
                case "both":
                    res = self._show_message(
                        _("Reset Menu Category"),
                        _("Reset menu '%s' to system default?") % item.get_name(),
                        Gtk.ButtonsType.OK_CANCEL,
                        Gtk.MessageType.QUESTION
                    )
                    if res == Gtk.ResponseType.OK:
                        self.editor.removeCustomMenu(item)
                case "system only":
                    self._show_message(
                        _("Cannot Delete"),
                        _("This is a system menu and cannot be deleted."),
                        Gtk.ButtonsType.OK,
                        Gtk.MessageType.ERROR
                    )
            
    def _on_edit_properties_activate(self, menu):
        item_tree = self.tree.get_object(self.last_tree)
        items, iter = item_tree.get_selection().get_selected()
        if not iter: return
        
        item = items[iter][3]
        if not isinstance(item, (CMenu.TreeEntry, CMenu.TreeDirectory)): return

        file_type = 'launcher' if isinstance(item, CMenu.TreeEntry) else 'directory'
        file_path = item.get_desktop_file_path()

        process = subprocess.Popen(['cinnamon-desktop-editor', '-m' + file_type, '-o' + file_path], env=os.environ)
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, process.pid, self._on_launcher_editor_exited)

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
        self._loadItems(self.menu_store[menu_path][3])

        item_status = self.editor.getIsItemUserOrSystem(menu)
        self._set_delete_sensitive(item_status == "user only")
        self._set_restore_sensitive(item_status == "both")
        self._set_properties_sensitive(True)

        self.last_tree = "menu_tree"

    def on_item_tree_cursor_changed(self, treeview):
        selection = treeview.get_selection()
        if selection is None:
            return
        items, iter = selection.get_selected()
        if iter is None:
            return

        item = items[iter][3]
        item_status = self.editor.getIsItemUserOrSystem(item)
        self._set_delete_sensitive(item_status == "user only")
        self._set_restore_sensitive(item_status == "both")
        self._set_properties_sensitive(True)
        self.last_tree = "item_tree"

    def on_item_tree_row_activated(self, treeview, path, column):
        self._on_edit_properties_activate(None)

    def _set_delete_sensitive(self, sensitive):
        self.tree.get_object("delete_button").set_sensitive(sensitive)
        self.delete_menu_item.set_sensitive(sensitive)

    def _set_restore_sensitive(self, sensitive):
        self.tree.get_object("restore_item_button").set_sensitive(sensitive)
        self.restore_menu_item.set_sensitive(sensitive)

    def _set_properties_sensitive(self, sensitive):
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
        self.popup_menu.popup(None, None, None, None, button, event_time)
        #without this shift-f10 won't work
        return True

    def on_item_tree_key_press_event(self, item_tree, event):
        if event.keyval == Gdk.KEY_Delete:
            self._on_edit_delete_restore_activate(None)

    def on_delete_button_clicked(self, button):
        self._on_edit_delete_restore_activate(None)

    def on_restore_item_button_clicked(self, button):
        self._on_edit_delete_restore_activate(None)

    def on_properties_button_clicked(self, button):
        self._on_edit_properties_activate(None)

    def on_open_desktop_file_button_clicked(self, button):
        item_tree = self.tree.get_object(self.last_tree)
        items, iter = item_tree.get_selection().get_selected()
        if not iter:
            return
        item = items[iter][3]
        if not isinstance(item, CMenu.TreeEntry) and not isinstance(item, CMenu.TreeDirectory):
            return

        file_path = item.get_desktop_file_path()
        subprocess.run(["xdg-open", file_path])

    def on_restore_all_button_clicked(self, button):
        res = self._show_message(
            _("Restore System Configuration"),
            _("Restore all modified menus and launchers to system defaults? User created menus and launchers will not be deleted."),
            Gtk.ButtonsType.OK_CANCEL,
            Gtk.MessageType.QUESTION
        )
        if res == Gtk.ResponseType.OK:
            self.editor.restoreToSystem()

    def on_close_button_clicked(self, button):
        self.quit()

    def quit(self):
        Gtk.main_quit()
