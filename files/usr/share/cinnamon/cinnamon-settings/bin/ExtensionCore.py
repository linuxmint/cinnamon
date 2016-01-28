#!/usr/bin/env python2

from SettingsWidgets import SidePage, SettingsStack
import XletSettings
from Spices import Spice_Harvester
import sys
import thread
import os
import re
import json
from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, Pango, GLib
import dbus
import cgi
import subprocess
import gettext

home = os.path.expanduser("~")

SHOW_ALL = 0
SHOW_ACTIVE = 1
SHOW_INACTIVE = 2

SETTING_TYPE_NONE = 0
SETTING_TYPE_INTERNAL = 1
SETTING_TYPE_EXTERNAL = 2

ROW_SIZE = 32

curr_ver = subprocess.check_output(["cinnamon", "--version"]).splitlines()[0].split(" ")[1]

def find_extension_subdir(directory):
    largest = [0]
    curr_a = curr_ver.split(".")

    for subdir in os.listdir(directory):
        if not os.path.isdir(os.path.join(directory, subdir)):
            continue

        if not re.match(r'^[1-9][0-9]*\.[0-9]+(\.[0-9]+)?$', subdir):
            continue

        subdir_a = subdir.split(".")

        if cmp(subdir_a, curr_a) <= 0 and cmp(largest, subdir_a) <= 0:
            largest = subdir_a

    if len(largest) == 1:
        return directory
    else:
        return os.path.join(directory, ".".join(largest))

class SurfaceWrapper:
    def __init__(self, surface):
        self.surface = surface

class ExtensionSidePage (SidePage):
    SORT_NAME = 0
    SORT_RATING = 1
    SORT_DATE_EDITED = 2
    SORT_ENABLED = 3
    SORT_REMOVABLE = 4

    def __init__(self, name, icon, keywords, content_box, collection_type, module=None):
        SidePage.__init__(self, name, icon, keywords, content_box, module=module)
        self.collection_type = collection_type
        self.themes = collection_type == "theme"
        self.icons = []
        self.run_once = False

    def load(self, window=None):

        if window is not None:
            self.window = window

        self.running_uuids = None
        self._proxy = None
        self._signals = []

        scrolledWindow = Gtk.ScrolledWindow()
        scrolledWindow.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        scrolledWindow.set_border_width(6)

        self.stack = SettingsStack()
        if window is not None:
            self.stack_switcher = Gtk.StackSwitcher()
            self.stack_switcher.set_halign(Gtk.Align.CENTER)
            self.stack_switcher.set_stack(self.stack)
            self.stack_switcher.set_homogeneous(True)

            self.vbox = Gtk.VBox()
            self.vbox.pack_start(self.stack_switcher, False, True, 2)
            self.vbox.pack_start(self.stack, True, True, 2)

        self.add_widget(self.stack)

        extensions_vbox = Gtk.VBox()

        self.search_entry = Gtk.Entry()
        self.search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find-symbolic')
        self.search_entry.set_placeholder_text(_("Search"))
        self.search_entry.connect('changed', self.on_entry_refilter)

        if self.collection_type == "applet":
            self.stack.add_titled(extensions_vbox, "installed", _("Installed applets"))
        elif self.collection_type == "desklet":
            self.stack.add_titled(extensions_vbox, "installed", _("Installed desklets"))
        elif self.collection_type == "extension":
            self.stack.add_titled(extensions_vbox, "installed", _("Installed extensions"))
        elif self.collection_type == "theme":
            self.stack.add_titled(extensions_vbox, "installed", _("Installed themes"))

        self.stack.expand = True

        self.treeview = Gtk.TreeView()
        self.treeview.set_rules_hint(True)
        self.treeview.set_has_tooltip(True)
        if self.themes:
            self.treeview.connect("row-activated", self.on_row_activated)

        cr = Gtk.CellRendererPixbuf()
        column2 = Gtk.TreeViewColumn("Icon", cr)
        column2.set_min_width(50)
        column2.set_cell_data_func(cr, self.icon_cell_data_func, 4)

        cr = Gtk.CellRendererText()
        column3 = Gtk.TreeViewColumn("Description", cr, markup=1)
        column3.set_expand(True)
        if self.themes:
            column3.set_max_width(300)
            cr.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR)
            cr.set_property('wrap-width', 200)

        cr = Gtk.CellRendererPixbuf()
        cr.set_property("stock-size", Gtk.IconSize.DND)
        actionColumn = Gtk.TreeViewColumn("Read only", cr, icon_name=10)
        actionColumn.set_expand(True)

        cr = Gtk.CellRendererPixbuf()
        cr.set_property("stock-size", Gtk.IconSize.DND)
        isActiveColumn = Gtk.TreeViewColumn("Active", cr, icon_name=11)
        isActiveColumn.set_expand(True)
        isActiveColumn.set_cell_data_func(cr, self._is_active_data_func)

        self.treeview.append_column(column2)
        self.treeview.append_column(column3)
        self.treeview.append_column(actionColumn)
        self.treeview.append_column(isActiveColumn)
        self.treeview.set_headers_visible(False)

        self.model = Gtk.TreeStore(str, str, int, int, object, str, int, bool, str, long, str, str, str, int, bool)
        #                          uuid, desc, enabled, max-instances, icon, name, read-only, hide-config-button, ext-setting-app, edit-date, read-only icon, active icon, schema file name (for uninstall), settings type, version_supported

        self.modelfilter = self.model.filter_new()
        self.showFilter = SHOW_ALL
        self.modelfilter.set_visible_func(self.only_active)

        self.treeview.set_model(self.modelfilter)
        self.treeview.connect("query-tooltip", self.on_treeview_query_tooltip)
        self.treeview.set_search_column(5)
        x =  Gtk.Tooltip()
        x.set_text("test")
        self.treeview.set_tooltip_cell(x, None, actionColumn, None)
        self.treeview.set_search_entry(self.search_entry)
        # Find the enabled extensions
        if not self.themes:
            self.settings = Gio.Settings.new("org.cinnamon")
            self.enabled_extensions = self.settings.get_strv("enabled-%ss" % (self.collection_type))
        else:
            self.settings = Gio.Settings.new("org.cinnamon.theme")
            self.enabled_extensions = [self.settings.get_string("name")]

        self.load_extensions()

        self.model.set_default_sort_func(self.model_sort_func)
        self.model.set_sort_column_id(-1, Gtk.SortType.ASCENDING)

        if not self.themes:
            self.settings.connect(("changed::enabled-%ss") % (self.collection_type), lambda x,y: self._enabled_extensions_changed())
        else:
            self.settings.connect("changed::name", lambda x, y: self._enabled_extensions_changed())

        scrolledWindow.add(self.treeview)
        self.treeview.connect('button_press_event', self.on_button_press_event)

        if self.collection_type == "applet":
            self.instanceButton = Gtk.Button.new_with_label(_("Add to panel"))
        elif self.collection_type == "desklet":
            self.instanceButton = Gtk.Button.new_with_label(_("Add to desktop"))
        elif self.collection_type == "extension":
            self.instanceButton = Gtk.Button.new_with_label(_("Add to Cinnamon"))
        elif self.collection_type == "theme":
            self.instanceButton = Gtk.Button.new_with_label(_("Apply theme"))
        else:
            self.instanceButton = Gtk.Button.new_with_label(_("Add"))

        self.instanceButton.connect("clicked", lambda x: self._add_another_instance())

        self.instanceButton.set_sensitive(False);

        self.configureButton = Gtk.Button.new_with_label(_("Configure"))
        self.configureButton.connect("clicked", self._configure_extension)

        self.extConfigureButton = Gtk.Button.new_with_label(_("Configure"))
        self.extConfigureButton.connect("clicked", self._external_configure_launch)

        if self.collection_type == "theme":
            restoreButton = Gtk.Button.new_with_label(_("Restore default theme"))
        elif self.collection_type == "desklet":
            restoreButton = Gtk.Button.new_with_label(_("Remove all desklets"))
        elif self.collection_type == "extension":
            restoreButton = Gtk.Button.new_with_label(_("Disable all extensions"))
        else:
            restoreButton = Gtk.Button.new_with_label(_("Restore to default"))

        restoreButton.connect("clicked", lambda x: self._restore_default_extensions())

        hbox = Gtk.HBox()
        self.comboshow = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.comboshow.pack_start(renderer_text, True)
        showTypes=Gtk.ListStore(int, str)
        if self.collection_type == "applet":
            showTypes.append([SHOW_ALL, _("All applets")])
            showTypes.append([SHOW_ACTIVE, _("Active applets")])
            showTypes.append([SHOW_INACTIVE, _("Inactive applets")])
        elif self.collection_type == "desklet":
            showTypes.append([SHOW_ALL, _("All desklets")])
            showTypes.append([SHOW_ACTIVE, _("Active desklets")])
            showTypes.append([SHOW_INACTIVE, _("Inactive desklets")])
        elif self.collection_type == "extension":
            showTypes.append([SHOW_ALL, _("All extensions")])
            showTypes.append([SHOW_ACTIVE, _("Active extensions")])
            showTypes.append([SHOW_INACTIVE, _("Inactive extensions")])
        self.comboshow.set_model(showTypes)
        self.comboshow.set_entry_text_column(1)
        self.comboshow.set_active(0) #All
        self.comboshow.connect('changed', self.comboshow_changed)
        self.comboshow.add_attribute(renderer_text, "text", 1)
        self.comboshow.show()

        if not self.themes:
            showLabel = Gtk.Label()
            showLabel.set_text(_("Show"))
            showLabel.show()
            hbox.pack_start(showLabel, False, False, 4)
            hbox.pack_start(self.comboshow, False, False, 2)

        hbox.pack_end(self.search_entry, False, False, 4)
        extensions_vbox.pack_start(hbox, False, False, 4)
        hbox.set_border_width(3);
        hbox.show()
        self.search_entry.show()

        extensions_vbox.pack_start(scrolledWindow, True, True, 0)
        hbox = Gtk.HBox()
        extensions_vbox.pack_start(hbox, False, True, 5)

        buttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL)
        buttonbox.set_layout(Gtk.ButtonBoxStyle.START);
        buttonbox.set_spacing(5)
        hbox.pack_start(buttonbox, True, True, 5)
        hbox.xalign = 1.0

        img = Gtk.Image.new_from_stock("gtk-add", Gtk.IconSize.BUTTON)
        self.instanceButton.set_image(img)
        img = Gtk.Image.new_from_stock("gtk-properties", Gtk.IconSize.BUTTON)
        self.configureButton.set_image(img)
        img = Gtk.Image.new_from_stock("gtk-properties", Gtk.IconSize.BUTTON)
        self.extConfigureButton.set_image(img)

        buttonbox.pack_start(self.instanceButton, False, False, 0)
        buttonbox.pack_start(self.configureButton, False, False, 0)
        buttonbox.pack_start(self.extConfigureButton, False, False, 0)

        rightbuttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL);
        rightbuttonbox.set_layout(Gtk.ButtonBoxStyle.END);
        rightbuttonbox.pack_start(restoreButton, False, False, 0)

        hbox.pack_end(rightbuttonbox, False, False, 5)

        self.configureButton.hide()
        self.configureButton.set_no_show_all(True)
        self.extConfigureButton.hide()
        self.extConfigureButton.set_no_show_all(True)

        # Get More - Variables prefixed with "gm_" where necessary
        gm_scrolled_window = Gtk.ScrolledWindow()
        gm_scrolled_window.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        gm_scrolled_window.set_border_width(6)
        getmore_vbox = Gtk.VBox()
        getmore_vbox.set_border_width(0)

        if self.collection_type == "applet":
            self.stack.add_titled(getmore_vbox, "more", _("Available applets (online)"))
        elif self.collection_type == "desklet":
            self.stack.add_titled(getmore_vbox, "more", _("Available desklets (online)"))
        elif self.collection_type == "extension":
            self.stack.add_titled(getmore_vbox, "more", _("Available extensions (online)"))
        elif self.collection_type == "theme":
            self.stack.add_titled(getmore_vbox, "more", _("Available themes (online)"))

        self.stack.connect("notify::visible-child-name", self.on_page_changed)

        self.gm_combosort = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.gm_combosort.pack_start(renderer_text, True)
        sortTypes=Gtk.ListStore(int, str)
        sortTypes.append([self.SORT_NAME, _("Name")])
        sortTypes.append([self.SORT_RATING, _("Popularity")])
        sortTypes.append([self.SORT_DATE_EDITED, _("Date")])
        self.gm_combosort.set_model(sortTypes)
        self.gm_combosort.set_entry_text_column(1)
        self.gm_combosort.set_active(1) #Rating
        self.gm_combosort.connect('changed', self.gm_changed_sorting)
        self.gm_combosort.add_attribute(renderer_text, "text", 1)
        self.gm_combosort.show()

        hbox = Gtk.HBox()
        hbox.set_border_width(3);
        sortLabel = Gtk.Label()
        sortLabel.set_text(_("Sort by"))
        sortLabel.show()
        hbox.pack_start(sortLabel, False, False, 4)
        hbox.pack_start(self.gm_combosort, False, False, 2)
        hbox.show()

        self.gm_search_entry = Gtk.Entry()
        self.gm_search_entry.connect('changed', self.gm_on_entry_refilter)
        self.gm_search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find')
        self.gm_search_entry.set_placeholder_text(_("Search"))
        hbox.pack_end(self.gm_search_entry, False, False, 4)
        self.search_entry.show()

        getmore_vbox.pack_start(hbox, False, False, 4)

        # MODEL
        self.gm_model = Gtk.TreeStore(str, str,      int, object, int,    str,     int)
        #                            uuid, name, install, icon,            score,   name,    date-edited
        self.gm_model.set_sort_column_id(4, Gtk.SortType.DESCENDING)

        # TREE
        self.gm_modelfilter = self.gm_model.filter_new()
        self.gm_modelfilter.set_visible_func(self.gm_match_func)
        self.gm_treeview = Gtk.TreeView()
        self.gm_treeview.set_rules_hint(True)
        self.gm_treeview.set_has_tooltip(True)

        gm_cr = Gtk.CellRendererToggle()
        gm_cr.connect("toggled", self.gm_toggled, self.gm_treeview)
        gm_column1 = Gtk.TreeViewColumn("Install", gm_cr)
        gm_column1.set_cell_data_func(gm_cr, self.gm_celldatafunction_checkbox)

        gm_cr = Gtk.CellRendererPixbuf()
        gm_column2 = Gtk.TreeViewColumn("Icon", gm_cr)
        gm_column2.set_cell_data_func(gm_cr, self.icon_cell_data_func, 3)

        gm_cr = Gtk.CellRendererText()
        gm_column3 = Gtk.TreeViewColumn("Description", gm_cr, markup=1)
        gm_column3.set_expand(True)
        if self.themes:
            gm_column3.set_max_width(300)
            gm_cr.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR)
            gm_cr.set_property('wrap-width', 200)

        cr = Gtk.CellRendererText()
        actionColumn = Gtk.TreeViewColumn("Action", cr)
        actionColumn.set_cell_data_func(cr, self._gm_action_data_func)
        actionColumn.set_expand(True)

        cr = Gtk.CellRendererPixbuf()
        cr.set_property("stock-size", Gtk.IconSize.DND)
        statusColumn = Gtk.TreeViewColumn("Status", cr)
        statusColumn.set_cell_data_func(cr, self._gm_status_data_func)
        statusColumn.set_expand(True)


        right = Gtk.CellRendererText()
        right.set_property('xalign', 1.0)
        gm_column4 = Gtk.TreeViewColumn("Score", right, markup=4)
        gm_column4.set_alignment(1.0)
        gm_column4.set_expand(True)

        self.gm_treeview.append_column(gm_column1)
        self.gm_treeview.append_column(gm_column2)
        self.gm_treeview.append_column(gm_column3)
        self.gm_treeview.append_column(actionColumn)
        self.gm_treeview.append_column(statusColumn)
        self.gm_treeview.append_column(gm_column4)
        self.gm_treeview.set_headers_visible(False)

        self.gm_treeview.set_model(self.gm_modelfilter)
        self.gm_treeview.set_search_column(5)
        self.gm_treeview.set_search_entry(self.gm_search_entry)

        gm_scrolled_window.add(self.gm_treeview)
        self.gm_treeview.connect('motion_notify_event', self.gm_on_motion_notify_event)
        self.gm_treeview.connect('button_press_event', self.gm_on_button_press_event)
        self.gm_treeview.connect("query-tooltip", self.gm_on_treeview_query_tooltip)

        getmore_vbox.add(gm_scrolled_window)

        hbox = Gtk.HBox()
        buttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL)
        buttonbox.set_spacing(6)
        self.install_button = Gtk.Button.new_with_label(_("Install or update selected items"))
        self.select_updated = Gtk.Button.new_from_icon_name("cs-xlet-update", Gtk.IconSize.BUTTON)
        self.select_updated.set_label(_("Select updated"))

        reload_button = Gtk.Button.new_with_label(_("Refresh list"))
        buttonbox.pack_start(self.install_button, False, False, 2)
        buttonbox.pack_start(self.select_updated, False, False, 2)
        buttonbox.pack_end(reload_button, False, False, 2)

        buttonbox.set_child_non_homogeneous(self.install_button, True)
        buttonbox.set_child_non_homogeneous(self.select_updated, True)
        buttonbox.set_child_non_homogeneous(reload_button, True)

        hbox.pack_start(buttonbox, True, True, 5)
        getmore_vbox.pack_end(hbox, False, True, 5)

        reload_button.connect("clicked", lambda x: self.load_spices(True))
        self.install_button.connect("clicked", lambda x: self.install_extensions())
        self.select_updated.connect("clicked", lambda x: self.select_updated_extensions())
        self.select_updated.hide()
        self.select_updated.set_no_show_all(True)
        self.treeview.get_selection().connect("changed", lambda x: self._selection_changed());
        self.install_list = []
        self.update_list = {}
        self.current_num_updates = 0

        self.spices = Spice_Harvester(self.collection_type, self.window)

        # if not self.spices.get_webkit_enabled():
        #     getmore_label.set_sensitive(False)
        #     reload_button.set_sensitive(False)
        extra_page = self.getAdditionalPage()
        if extra_page:
            self.stack.add_titled(extra_page, "extra", extra_page.label)

        self.content_box.show_all()

        if not self.themes:
            self.spices.scrubConfigDirs(self.enabled_extensions)
            try:
                Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                          "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", None, self._on_proxy_ready, None)
            except dbus.exceptions.DBusException as e:
                print(e)
                self._proxy = None

        self.search_entry.grab_focus()

    def refresh_running_uuids(self):
        try:
            if self._proxy:
                self.running_uuids = self._proxy.GetRunningXletUUIDs('(s)', self.collection_type)
            else:
                self.running_uuids = None
        except:
            self.running_uuids = None

    def _on_proxy_ready (self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self._proxy.connect("g-signal", self._on_signal)
        self._enabled_extensions_changed()

    def _on_signal(self, proxy, sender_name, signal_name, params):
        for name, callback in self._signals:
            if signal_name == name:
                callback(*params)

    def connect_proxy(self, name, callback):
        self._signals.append((name, callback))

    def disconnect_proxy(self, name):
        for signal in self._signals:
            if name in signal:
                self._signals.remove(signal)
                break

    def check_third_arg(self):
        if len(sys.argv) > 2 and not self.run_once:
            for row in self.model:
                uuid = self.model.get_value(row.iter, 0)
                if uuid == sys.argv[2]:
                    path = self.model.get_path(row.iter)
                    filtered = self.treeview.get_model().convert_child_path_to_path(path)
                    if filtered is not None:
                        self.treeview.get_selection().select_path(filtered)
                        self.treeview.scroll_to_cell(filtered, None, False, 0, 0)
                        self.run_once = True
                        if self.configureButton.get_visible() and self.configureButton.get_sensitive():
                            self.configureButton.clicked()
                        elif self.extConfigureButton.get_visible() and self.extConfigureButton.get_sensitive():
                            self.extConfigureButton.clicked()

    def icon_cell_data_func(self, column, cell, model, iter, data=None):
        wrapper = model.get_value(iter, data)
        cell.set_property("surface", wrapper.surface)

    def getAdditionalPage(self):
        return None

    def on_treeview_query_tooltip(self, treeview, x, y, keyboard_mode, tooltip):
        data = treeview.get_path_at_pos(x, y)
        if data:
            path, column, x, y=data
            iter = self.modelfilter.get_iter(path)
            if column.get_property('title')=="Read only" and iter != None:
                if not self.modelfilter.get_value(iter, 6):
                    tooltip.set_text(_("Cannot be uninstalled"))
                    return True
                else:
                    return False
            elif column.get_property('title') == "Active" and iter != None:
                count = self.modelfilter.get_value(iter, 2)
                markup = ""
                if count > 0:
                    markup += _("In use")
                    if count > 1:
                        markup += _("\n\nInstance count: %d") % count
                    tooltip.set_markup(markup)
                    return True
                elif count < 0:
                    markup += _("Problem loading - please check Looking Glass or your system's error log");
                    tooltip.set_markup(markup)
                    return True
        return False

    def gm_on_treeview_query_tooltip(self, treeview, x, y, keyboard_mode, tooltip):
        data = treeview.get_path_at_pos(x, y)
        if data:
            path, column, x, y = data
            iter = self.gm_modelfilter.get_iter(path)
            if column.get_property('title') == "Status":
                uuid = self.gm_modelfilter.get_value(iter, 0)
                date = self.gm_modelfilter.get_value(iter, 6)
                installed, can_update, is_active = self.version_compare(uuid, date)
                if installed:
                    if can_update:
                        tooltip.set_text(_("Update available"))
                    else:
                        tooltip.set_text(_("Installed and up-to-date"))
                    return True
            elif column.get_property('title') == "Score":
                tooltip.set_text(_("Popularity"))
                return True
        return False

    def model_sort_func(self, model, iter1, iter2, data=None):
        s1 = ((not model[iter1][6]), model[iter1][5])
        s2 = ((not model[iter2][6]), model[iter2][5])
        return cmp( s1, s2 )

    def on_row_activated(self, treeview, path, column): # Only used in themes
        iter = self.modelfilter.get_iter(path)
        uuid = self.modelfilter.get_value(iter, 0)
        name = self.modelfilter.get_value(iter, 5)
        self.enable_extension(uuid, name)

    def on_button_press_event(self, widget, event):
        if event.button == 3:
            data = widget.get_path_at_pos(int(event.x),int(event.y))
            res = False
            if data:
                sel=[]
                path, col, cx, cy=data
                indices = path.get_indices()
                iter = self.modelfilter.get_iter(path)

                for i in self.treeview.get_selection().get_selected_rows()[1]:
                    sel.append(i.get_indices()[0])

                if sel:
                    popup = Gtk.Menu()
                    popup.attach_to_widget(self.treeview, None)

                    uuid = self.modelfilter.get_value(iter, 0)
                    name = self.modelfilter.get_value(iter, 5)
                    checked = self.modelfilter.get_value(iter, 2)
                    version_check = self.modelfilter.get_value(iter, 14)

                    if self.should_show_config_button(self.modelfilter, iter):
                        item = Gtk.MenuItem(_("Configure"))
                        item.connect('activate', lambda x: self._configure_extension())
                        item.set_sensitive(checked > 0)
                        popup.add(item)
                        popup.add(Gtk.SeparatorMenuItem())

                    if self.should_show_ext_config_button(self.modelfilter, iter):
                        item = Gtk.MenuItem(_("Configure"))
                        item.connect('activate', lambda x: self._external_configure_launch())
                        item.set_sensitive(checked > 0)
                        popup.add(item)
                        popup.add(Gtk.SeparatorMenuItem())

                    if not self.themes:
                        if checked != 0:
                            if self.collection_type == "applet":
                                item = Gtk.MenuItem(_("Remove from panel"))
                            elif self.collection_type == "desklet":
                                item = Gtk.MenuItem(_("Remove from desktop"))
                            elif self.collection_type == "extension":
                                item = Gtk.MenuItem(_("Remove from Cinnamon"))
                            else:
                                item = Gtk.MenuItem(_("Remove"))
                            item.connect('activate', lambda x: self.disable_extension(uuid, name, checked))
                            popup.add(item)

                        max_instances = self.modelfilter.get_value(iter, 3);
                        can_instance = checked != -1 and (max_instances == -1 or ((max_instances > 0) and (max_instances > checked)))

                        if can_instance:
                            if self.collection_type == "applet":
                                item = Gtk.MenuItem(_("Add to panel"))
                            elif self.collection_type == "desklet":
                                item = Gtk.MenuItem(_("Add to desktop"))
                            elif self.collection_type == "extension":
                                item = Gtk.MenuItem(_("Add to Cinnamon"))
                            else:
                                item = Gtk.MenuItem(_("Add"))
                            item.connect('activate', lambda x: self.enable_extension(uuid, name, version_check))
                            popup.add(item)
                    else:
                        item = Gtk.MenuItem(_("Apply theme"))
                        item.connect('activate', lambda x: self.enable_extension(uuid, name))
                        popup.add(item)

                    item = Gtk.MenuItem(_("Uninstall"))
                    if self.modelfilter.get_value(iter, 6):
                        schema_filename = self.modelfilter.get_value(iter, 12)
                        item.connect('activate', lambda x: self.uninstall_extension(uuid, name, schema_filename))
                        item.set_sensitive(True)
                    else:
                        item.set_sensitive(False)
                    popup.add(item)

                    popup.show_all()
                    popup.popup(None, None, None, None, event.button, event.time)

                # Only allow context menu for currently selected item
                if indices[0] not in sel:
                    return False

            return True

    def _is_active_data_func(self, column, cell, model, iter, data=None):
        enabled = model.get_value(iter, 2) > 0
        error = model.get_value(iter, 2) < 0
        if enabled:
            if not self.themes:
                icon = "cs-xlet-running"
            else:
                icon = "cs-xlet-installed"
        elif error:
            if not self.themes:
                icon = "cs-xlet-error"
        else:
            icon = ""
        cell.set_property('icon-name', icon)

    def comboshow_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            model = widget.get_model()
            value = model[tree_iter][0]
            self.showFilter = value
            self.modelfilter.refilter()

    def version_compare(self, uuid, date):
        installed = False
        can_update = False
        is_active = False

        installed_iter = self.model.get_iter_first()
        while installed_iter != None:
            installed_uuid = self.model.get_value(installed_iter, 0)
            installed_date = self.model.get_value(installed_iter, 9)
            if uuid == installed_uuid:
                installed = True
                can_update = date > installed_date
                is_active = self.model.get_value(installed_iter, 2) > 0
                break
            installed_iter = self.model.iter_next(installed_iter)
        return installed, can_update, is_active

    def gm_view_details(self, uuid):
        self.spices.show_detail(uuid, lambda x: self.gm_mark(uuid, True))

    def gm_mark(self, uuid, shouldMark=True):
        for row in self.gm_model:
            if uuid == self.gm_model.get_value(row.iter, 0):
                self.gm_model.set_value(row.iter, 2, 1 if shouldMark else 0)
                date = self.gm_model.get_value(row.iter, 6)

        if not shouldMark:
            newExtensions = []
            for i_uuid, is_update, is_active in self.install_list:
                if uuid != i_uuid:
                    newExtensions += [(i_uuid, is_update, is_active)]
            self.install_list = newExtensions
        else:
            if uuid not in self.install_list:
                installed, is_update, is_active = self.version_compare(uuid, date)
                self.install_list += [(uuid, is_update, is_active)]

        if len(self.install_list) > 0:
            self.install_button.set_sensitive(True)
        else:
            self.install_button.set_sensitive(False)

    def gm_on_motion_notify_event(self, widget, event):
        data = widget.get_path_at_pos(int(event.x),int(event.y))
        if data:
            path, column, x, y=data
            iter = self.gm_modelfilter.get_iter(path)
            if column.get_property('title')== "Action" and iter != None:
                self.gm_treeview.get_window().set_cursor(Gdk.Cursor.new(Gdk.CursorType.HAND2))
                return
        self.gm_treeview.get_window().set_cursor(Gdk.Cursor.new(Gdk.CursorType.ARROW))

    def gm_on_button_press_event(self, widget, event):
        if event.button == 1:
            data=widget.get_path_at_pos(int(event.x),int(event.y))
            if data:
                path, column, x, y = data
                if column.get_property('title')== "Action":
                    iter = self.gm_modelfilter.get_iter(path)
                    uuid = self.gm_modelfilter.get_value(iter, 0)
                    self.gm_view_details(uuid)
                    return False

        if event.button == 3:
            data = widget.get_path_at_pos(int(event.x),int(event.y))
            res = False
            if data:
                sel=[]
                path, col, cx, cy=data
                indices = path.get_indices()
                iter = self.gm_modelfilter.get_iter(path)

                for i in self.gm_treeview.get_selection().get_selected_rows()[1]:
                    sel.append(i.get_indices()[0])

                if sel:
                    popup = Gtk.Menu()
                    popup.attach_to_widget(self.treeview, None)

                    uuid = self.gm_modelfilter.get_value(iter, 0)
                    name = self.gm_modelfilter.get_value(iter, 5)
                    date = self.gm_modelfilter.get_value(iter, 6)
                    marked = self.gm_modelfilter.get_value(iter, 2)
                    installed, can_update, is_active = self.version_compare(uuid, date)
                    if (marked):
                        item = Gtk.MenuItem(_("Unmark"))
                        popup.add(item)
                        item.connect('activate', lambda x: self.gm_mark(uuid, False))
                    else:
                        if not installed or can_update:
                            if can_update:
                                item = Gtk.MenuItem(_("Mark for upgrade"))
                            else:
                                item = Gtk.MenuItem(_("Mark for installation"))
                            popup.add(item)
                            item.connect('activate', lambda x: self.gm_mark(uuid, True))

                    item = Gtk.MenuItem(_("More info"))
                    item.connect('activate', lambda x: self.gm_view_details(uuid))
                    popup.add(item)

                    #item = Gtk.MenuItem(_("Homepage.."))
                    #item.connect('activate', lambda x: self.gm_launch_homepage(uuid))
                    #popup.add(item)

                    #item = Gtk.MenuItem(_("Review.."))
                    #item.connect('activate', lambda x: self.gm_view_on_spices(uuid))
                    #popup.add(item)

                    popup.show_all()
                    popup.popup(None, None, None, None, event.button, event.time)

                # Only allow context menu for currently selected item
                if indices[0] not in sel:
                    return False

            return True

    def _gm_action_data_func(self, column, cell, model, iter, data=None):
        cell.set_property('markup',"<span color='#0000FF'>%s</span>" % _("More info"))

    def _gm_status_data_func(self, column, cell, model, iter, data=None):
        uuid = model.get_value(iter, 0)
        date = model.get_value(iter, 6)

        installed, can_update, is_active = self.version_compare(uuid, date)

        if installed:
            if can_update:
                name = "cs-xlet-update"
                self.update_list[uuid] = True
            else:
                name = "cs-xlet-installed"
                if uuid in self.update_list.keys():
                    del self.update_list[uuid]
        else:
            name = ""
            if uuid in self.update_list.keys():
                del self.update_list[uuid]

        cell.set_property("icon-name", name)
        self.refresh_update_button()

    def gm_toggled(self, renderer, path, treeview):
        iter = self.gm_modelfilter.get_iter(path)
        if (iter != None):
            uuid = self.gm_modelfilter.get_value(iter, 0)
            checked = self.gm_modelfilter.get_value(iter, 2)

            if checked == True:
                self.gm_mark(uuid, False)
            else:
                self.gm_mark(uuid, True)

    def gm_celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        uuid = model.get_value(iter, 0)
        date = model.get_value(iter, 6)
        installed, can_update, is_active = self.version_compare(uuid, date)
        cell.set_property("activatable", not installed or can_update)
        checked = model.get_value(iter, 2)

        if checked > 0:
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)

    def only_active(self, model, iterr, data=None):
        query = self.search_entry.get_buffer().get_text().lower()
        extensionName = model.get_value(iterr, 5)

        enabled = model.get_value(iterr, 2)

        if extensionName == None:
            return False

        if self.showFilter == SHOW_ALL:
            return (query == "" or query in extensionName.lower())
        elif self.showFilter == SHOW_ACTIVE:
            return enabled > 0 and (query == "" or query in extensionName.lower())
        elif self.showFilter == SHOW_INACTIVE:
            return enabled <= 0 and (query == "" or query in extensionName.lower())
        else:
            return False

    def on_entry_refilter(self, widget, data=None):
        self.modelfilter.refilter()

    def gm_changed_sorting(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            model = widget.get_model()
            value = model[tree_iter][0]

            if value == self.SORT_NAME:
                self.gm_model.set_sort_column_id(5, Gtk.SortType.ASCENDING)
            elif value == self.SORT_RATING:
                self.gm_model.set_sort_column_id(4, Gtk.SortType.DESCENDING)
            elif value == self.SORT_DATE_EDITED:
                self.gm_model.set_sort_column_id(6, Gtk.SortType.DESCENDING)

    def gm_match_func(self, model, iterr, data=None):
        query = self.gm_search_entry.get_buffer().get_text()
        value = model.get_value(iterr, 5)

        if query == "":
            return True
        elif query.lower() in value.lower():
            return True
        return False

    def gm_on_entry_refilter(self, widget, data=None):
        self.gm_modelfilter.refilter()

    def load_spices(self, force=False):
        # if self.spices.get_webkit_enabled():
        self.update_list = {}

        thread.start_new_thread(self.spices.load, (self.on_spice_load, force))

    def install_extensions(self):
        if len(self.install_list) > 0:
            thread.start_new_thread(self.spices.install_all, (self.install_list, self.install_finished))

    def install_finished(self, need_restart):
        for row in self.gm_model:
            self.gm_model.set_value(row.iter, 2, 0)
        self.install_button.set_sensitive(False)
        self.install_list = []
        self.load_extensions()

        for uuid in need_restart:
            self.connect_proxy("XletAddedComplete", self.xlet_added_callback)
            self._proxy.ReloadXlet("(ss)", uuid, self.collection_type.upper())

    def on_spice_load(self, spicesData):
        # print "total spices loaded: %d" % len(spicesData)
        self.gm_model.clear()
        self.install_button.set_sensitive(False)
        for uuid in spicesData:
            extensionData = spicesData[uuid]
            extensionName = extensionData['name'].replace('&', '&amp;')
            iter = self.gm_model.insert_before(None, None)
            self.gm_model.set_value(iter, 0, uuid)
            if not self.themes:
                self.gm_model.set_value(iter, 1, '<b>%s</b>\n<b><span size="x-small">%s</span></b>' % (extensionName, uuid))
            else:
                self.gm_model.set_value(iter, 1, '<b>%s</b>' % (extensionName))
            self.gm_model.set_value(iter, 2, 0)

            if not self.themes:
                icon_filename = os.path.basename(extensionData['icon'])
                w = ROW_SIZE + 5
                h = ROW_SIZE + 5
            else:
                icon_filename = os.path.basename(extensionData['screenshot'])
                w = -1
                h = 60
            if w != -1:
                w = w * self.window.get_scale_factor()
            h = h * self.window.get_scale_factor()

            if not os.path.exists(os.path.join(self.spices.get_cache_folder(), icon_filename)):
                theme = Gtk.IconTheme.get_default()
                if theme.has_icon("cs-%ss" % (self.collection_type)):
                    img = theme.load_icon("cs-%ss" % (self.collection_type), h, 0)
            else:
                try:
                    img = GdkPixbuf.Pixbuf.new_from_file_at_size(os.path.join(self.spices.get_cache_folder(), icon_filename), w, h)
                except:
                    theme = Gtk.IconTheme.get_default()
                    if theme.has_icon("cs-%ss" % (self.collection_type)):
                        img = theme.load_icon("cs-%ss" % (self.collection_type), h, 0)

            surface = Gdk.cairo_surface_create_from_pixbuf (img, self.window.get_scale_factor(), self.window.get_window())
            wrapper = SurfaceWrapper(surface)

            self.gm_model.set_value(iter, 3, wrapper)
            self.gm_model.set_value(iter, 4, int(extensionData['score']))
            self.gm_model.set_value(iter, 5, extensionData['name'])
            self.gm_model.set_value(iter, 6, int(extensionData['last_edited']))

    def enable_extension(self, uuid, name, version_check = True):
        if not version_check:
            if not self.show_prompt(_("Extension %s is not compatible with current version of cinnamon. Using it may break your system. Load anyway?") % uuid):
                return
            else:
                uuid = "!" + uuid

        if not self.themes:
            if self.collection_type in ("applet", "desklet"):
                extension_id = self.settings.get_int(("next-%s-id") % (self.collection_type));
                self.settings.set_int(("next-%s-id") % (self.collection_type), (extension_id+1));
            else:
                extension_id = 0

            self.enabled_extensions.append(self.toSettingString(uuid, extension_id))

            if self._proxy:
                self.connect_proxy("XletAddedComplete", self.xlet_added_callback)

            self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)
        else:
            if uuid == "STOCK":
                self.settings.set_string("name", "")
            else:
                self.settings.set_string("name", name)

    def xlet_added_callback(self, success, uuid):
        if not success:
            self.disable_extension(uuid, "", 0)

            msg = _("""
There was a problem loading the selected item, and it has been disabled.\n\n
Check your system log and the Cinnamon LookingGlass log for any issues.
Please contact the developer.""")

            dialog = Gtk.MessageDialog(transient_for = None,
                                       modal = True,
                                       message_type = Gtk.MessageType.ERROR)
            esc = cgi.escape(msg)
            dialog.set_markup(esc)

            if self.do_logs_exist():
                dialog.add_button(_("View logfile(s)"), 1)

            dialog.add_button(_("Close"), 2)
            dialog.set_default_response(2)

            dialog.connect("response", self.on_xlet_error_dialog_response)

            dialog.show_all()
            response = dialog.run()

        self.disconnect_proxy("XletAddedComplete")

        GObject.timeout_add(100, self._enabled_extensions_changed)

    def on_xlet_error_dialog_response(self, widget, id):
        if id == 1:
            self.show_logs()
        elif id == 2:
            widget.destroy()

    def disable_extension(self, uuid, name, checked=0):
        if (checked > 1):
            msg = _("There are multiple instances, do you want to remove all of them?\n\n")
            msg += self.RemoveString

            if not self.show_prompt(msg):
                return
        if not self.themes:
            newExtensions = []
            for enabled_extension in self.enabled_extensions:
                if uuid not in enabled_extension:
                    newExtensions.append(enabled_extension)
            self.enabled_extensions = newExtensions
            self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)
        else:
            if self.enabled_extensions[0] == name:
                self._restore_default_extensions()

    def uninstall_extension(self, uuid, name, schema_filename):
        if not self.themes:
            obj = uuid
        else:
            obj = name
        if not self.show_prompt(_("Are you sure you want to completely remove %s?") % (obj)):
            return
        self.disable_extension(uuid, name, 0)

        thread.start_new_thread(self.spices.uninstall, (uuid, name, schema_filename, self.on_uninstall_finished))

    def on_uninstall_finished(self, uuid):
        self.load_extensions()

    def on_page_changed(self, *args):
        name = self.stack.get_visible_child_name()
        if name == "more" and len(self.gm_model) == 0:
            self.load_spices()
        self.focus(name)

    def focus(self, name):
        if name == "installed":
            self.search_entry.grab_focus()
        else:
            self.gm_search_entry.grab_focus()
        return False

    def _enabled_extensions_changed(self):
        last_selection = ''
        model, treeiter = self.treeview.get_selection().get_selected()
        self.refresh_running_uuids()

        if self.themes:
            self.enabled_extensions = [self.settings.get_string("name")]
        else:
            self.enabled_extensions = self.settings.get_strv(("enabled-%ss") % (self.collection_type))

        uuidCount = {}
        for enabled_extension in self.enabled_extensions:
            try:
                uuid = self.fromSettingString(enabled_extension).lstrip("!")
                if uuid == "":
                    uuid = "STOCK"
                if uuid in uuidCount:
                    uuidCount[uuid] += 1
                else:
                    uuidCount[uuid] = 1
            except:
                pass
        for row in self.model:
            if not self.themes:
                uuid = self.model.get_value(row.iter, 0)
            else:
                if self.model.get_value(row.iter, 0) == "STOCK":
                    uuid = "STOCK"
                else:
                    uuid = self.model.get_value(row.iter, 5)
            if uuid in uuidCount:
                if self.running_uuids is not None:
                    if uuid in self.running_uuids:
                        self.model.set_value(row.iter, 2, uuidCount[uuid])
                    else:
                        self.model.set_value(row.iter, 2, -1)
                else:
                    self.model.set_value(row.iter, 2, uuidCount[uuid])
            else:
                self.model.set_value(row.iter, 2, 0)
        self._selection_changed()

    def fromSettingString(self, string):
        return string

    def _add_another_instance(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            self._add_another_instance_iter(treeiter)

    def select_updated_extensions(self):
        if len(self.update_list) > 1:
            msg = _("This operation will update the selected items.\n\nDo you want to continue?")
        else:
            msg = _("This operation will update the selected item.\n\nDo you want to continue?")
        if not self.show_prompt(msg):
            return
        for row in self.gm_model:
            uuid = self.gm_model.get_value(row.iter, 0)
            if uuid in self.update_list.keys():
                self.gm_mark(uuid, True)
        self.install_extensions()

    def refresh_update_button(self):
        num = len(self.update_list)
        if num == self.current_num_updates:
            return
        self.current_num_updates = num
        if num > 0:
            if num > 1:
                self.select_updated.set_label(_("%d updates available!") % (len(self.update_list)))
            else:
                self.select_updated.set_label(_("%d update available!") % (len(self.update_list)))
            self.select_updated.show()
        else:
            self.select_updated.hide()

    def _add_another_instance_iter(self, treeiter):
        uuid = self.modelfilter.get_value(treeiter, 0)
        name = self.modelfilter.get_value(treeiter, 5)
        version_check = self.modelfilter.get_value(treeiter, 14)
        self.enable_extension(uuid, name, version_check)

    def _selection_changed(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        enabled = False;

        if treeiter:
            checked = model.get_value(treeiter, 2);
            max_instances = model.get_value(treeiter, 3);
            enabled = checked != -1 and (max_instances == -1 or ((max_instances > 0) and (max_instances > checked)))

            self.instanceButton.set_sensitive(enabled);

            self.configureButton.set_visible(self.should_show_config_button(model, treeiter))
            self.configureButton.set_sensitive(checked > 0)
            self.extConfigureButton.set_visible(self.should_show_ext_config_button(model, treeiter))
            self.extConfigureButton.set_sensitive(checked > 0)

    def should_show_config_button(self, model, iter):
        hide_override = model.get_value(iter, 7)
        setting_type = model.get_value(iter, 13)
        return setting_type == SETTING_TYPE_INTERNAL and not hide_override

    def should_show_ext_config_button(self, model, iter):
        hide_override = model.get_value(iter, 7)
        setting_type = model.get_value(iter, 13)
        return setting_type == SETTING_TYPE_EXTERNAL and not hide_override

    def _configure_extension(self, widget = None):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            uuid = model.get_value(treeiter, 0)
            settingContainer = XletSettings.XletSetting(uuid, self, self.collection_type)
            self.content_box.pack_start(settingContainer.content, True, True, 2)
            self.stack.hide()
            settingContainer.show()
            self._on_signal(None, None, "hide_stack", ())

    def _external_configure_launch(self, widget = None):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            app = model.get_value(treeiter, 8)
            if app is not None:
                subprocess.Popen([app])

    def _close_configure(self, settingContainer):
        settingContainer.content.hide()
        self.stack.show_all()
        self._on_signal(None, None, "show_stack", ())

    def _restore_default_extensions(self):
        if not self.themes:
            if self.collection_type == "applet":
                msg = _("This will restore the default set of enabled applets. Are you sure you want to do this?")
            elif self.collection_type == "desklet":
                msg = _("This will restore the default set of enabled desklets. Are you sure you want to do this?")
            if self.show_prompt(msg):
                os.system(('gsettings reset org.cinnamon next-%s-id') % (self.collection_type))
                os.system(('gsettings reset org.cinnamon enabled-%ss') % (self.collection_type))
        else:
            os.system("gsettings reset org.cinnamon.theme name")

    def uuid_already_in_list(self, uuid):
        installed_iter = self.model.get_iter_first()
        found = False
        if self.themes:
            col = 5
        else:
            col = 0
        while installed_iter != None:
            installed_uuid = self.model.get_value(installed_iter, col)
            if uuid == installed_uuid:
                found = True
                break
            installed_iter = self.model.iter_next(installed_iter)
        return found

    def load_extensions(self):
        self.model.clear()
        if not self.themes:
            self.load_extensions_in(('%s/.local/share/cinnamon/%ss') % (home, self.collection_type))
            self.load_extensions_in(('/usr/share/cinnamon/%ss') % (self.collection_type))
        else:
            self.load_extensions_in(('%s/.themes') % (home))
            self.load_extensions_in('/usr/share', True)
            self.load_extensions_in('/usr/share/themes')

    def load_extensions_in(self, directory, stock_theme = False):
        if not self.themes:  # Applet, Desklet, Extension handling
            if not (os.path.exists(directory) and os.path.isdir(directory)):
                return

            extensions = os.listdir(directory)
            extensions.sort()
            for extension in extensions:
                if self.uuid_already_in_list(extension):
                    continue

                extension_dir = "%s/%s" % (directory, extension)
                try:
                    if not (os.path.exists("%s/metadata.json" % extension_dir)):
                        continue

                    json_data=open("%s/metadata.json" % extension_dir).read()
                    setting_type = 0
                    data = json.loads(json_data)
                    extension_uuid = data["uuid"]
                    extension_name = XletSettings.translate(data["uuid"], data["name"])
                    extension_description = XletSettings.translate(data["uuid"], data["description"])
                    try: extension_max_instances = int(data["max-instances"])
                    except KeyError: extension_max_instances = 1
                    except ValueError:
                        extension_max_instances = 1

                    try: extension_role = data["role"]
                    except KeyError: extension_role = None
                    except ValueError: extension_role = None

                    try: hide_config_button = data["hide-configuration"]
                    except KeyError: hide_config_button = False
                    except ValueError: hide_config_button = False

                    if "multiversion" in data and data["multiversion"]:
                        extension_dir = find_extension_subdir(extension_dir)

                    try:
                        ext_config_app = os.path.join(extension_dir, data["external-configuration-app"])
                        setting_type = SETTING_TYPE_EXTERNAL
                    except KeyError: ext_config_app = ""
                    except ValueError: ext_config_app = ""

                    if os.path.exists("%s/settings-schema.json" % extension_dir):
                        setting_type = SETTING_TYPE_INTERNAL

                    try: last_edited = data["last-edited"]
                    except KeyError: last_edited = -1
                    except ValueError: last_edited = -1

                    try: schema_filename = data["schema-file"]
                    except KeyError: schema_filename = ""
                    except ValueError: schema_filename = ""

                    version_supported = False
                    try:
                        version_supported = curr_ver in data["cinnamon-version"] or curr_ver.rsplit(".", 1)[0] in data["cinnamon-version"]
                    except KeyError: version_supported = True # Don't check version if not specified.
                    except ValueError: version_supported = True


                    if ext_config_app != "" and not os.path.exists(ext_config_app):
                        ext_config_app = ""

                    if extension_max_instances < -1:
                        extension_max_instances = 1

                    if not (self.search_entry.get_text().upper() in (extension_name + extension_description).upper()):
                        continue

                    iter = self.model.insert_before(None, None)
                    found = sum(extension_uuid in x for x in self.enabled_extensions)

                    self.model.set_value(iter, 0, extension_uuid)
                    self.model.set_value(iter, 1, '''\
<b>%s</b>
<b><span size="xx-small">%s</span></b>
<i><span size="x-small">%s</span></i>''' % (extension_name, extension_uuid, extension_description))

                    self.model.set_value(iter, 2, found)
                    self.model.set_value(iter, 3, extension_max_instances)

                    img = None
                    size = ROW_SIZE * self.window.get_scale_factor()
                    if "icon" in data:
                        extension_icon = data["icon"]
                        theme = Gtk.IconTheme.get_default()
                        if theme.has_icon(extension_icon):
                            img = theme.load_icon(extension_icon, size, 0)
                    elif os.path.exists("%s/icon.png" % extension_dir):
                        img = GdkPixbuf.Pixbuf.new_from_file_at_size("%s/icon.png" % extension_dir, size, size)

                    if img is None:
                        theme = Gtk.IconTheme.get_default()
                        if theme.has_icon("cs-%ss" % (self.collection_type)):
                            img = theme.load_icon("cs-%ss" % (self.collection_type), size, 0)

                    surface = Gdk.cairo_surface_create_from_pixbuf (img, self.window.get_scale_factor(), self.window.get_window())
                    wrapper = SurfaceWrapper(surface)

                    self.model.set_value(iter, 4, wrapper)

                    self.model.set_value(iter, 5, extension_name)
                    self.model.set_value(iter, 6, os.access(directory, os.W_OK))
                    self.model.set_value(iter, 7, hide_config_button)
                    self.model.set_value(iter, 8, ext_config_app)
                    self.model.set_value(iter, 9, long(last_edited))

                    if (os.access(directory, os.W_OK)):
                        icon = ""
                    else:
                        icon = "cs-xlet-system"

                    self.model.set_value(iter, 10, icon)

                    if (found):
                        icon = "cs-xlet-running"
                    else:
                        icon = ""

                    self.model.set_value(iter, 11, icon)
                    self.model.set_value(iter, 12, schema_filename)
                    self.model.set_value(iter, 13, setting_type)
                    self.model.set_value(iter, 14, version_supported)

                except Exception, detail:
                    print "Failed to load extension %s: %s" % (extension, detail)

        else: # Theme handling
            if not (os.path.exists(directory) and os.path.isdir(directory)):
                return

            if stock_theme:
                themes = ["cinnamon"]
            else:
                themes = os.listdir(directory)
            themes.sort()
            for theme in themes:
                if self.uuid_already_in_list(theme):
                    continue
                try:
                    if stock_theme:
                        path = os.path.join(directory, theme, "theme")
                    else:
                        path = os.path.join(directory, theme, "cinnamon")
                    if not (os.path.exists(path) and os.path.isdir(path)):
                        continue
                    theme_last_edited = -1
                    theme_uuid = ""
                    metadata = os.path.join(path, "metadata.json")
                    if os.path.exists(metadata):
                        json_data=open(metadata).read()
                        data = json.loads(json_data)
                        try: theme_last_edited = data["last-edited"]
                        except KeyError: theme_last_edited = -1
                        except ValueError: theme_last_edited = -1
                        try: theme_uuid = data["uuid"]
                        except KeyError: theme_uuid = ""
                        except ValueError: theme_uuid = ""
                    if stock_theme:
                        theme_name = "Cinnamon"
                        theme_uuid = "STOCK"
                    else:
                        theme_name = theme
                    theme_description = ""
                    iter = self.model.insert_before(None, None)
                    found = 0
                    for enabled_theme in self.enabled_extensions:
                        if enabled_theme == theme_name:
                            found = 1
                        elif enabled_theme == "" and theme_uuid == "STOCK":
                            found = 1
                    if os.path.exists(os.path.join(path, "thumbnail.png")):
                        icon_path = os.path.join(path, "thumbnail.png")
                    else:
                        icon_path = "/usr/share/cinnamon/theme/thumbnail-generic.png"
                    size = 60 * self.window.get_scale_factor()
                    img = GdkPixbuf.Pixbuf.new_from_file_at_size(icon_path, -1, size)

                    surface = Gdk.cairo_surface_create_from_pixbuf (img, self.window.get_scale_factor(), self.window.get_window())
                    wrapper = SurfaceWrapper(surface)

                    self.model.set_value(iter, 0, theme_uuid)
                    self.model.set_value(iter, 1, '<b>%s</b>' % (theme_name))
                    self.model.set_value(iter, 2, found)
                    self.model.set_value(iter, 3, 1)
                    self.model.set_value(iter, 4, wrapper)
                    self.model.set_value(iter, 5, theme_name)
                    self.model.set_value(iter, 6, os.access(directory, os.W_OK))
                    self.model.set_value(iter, 7, True)
                    self.model.set_value(iter, 8, "")
                    self.model.set_value(iter, 9, long(theme_last_edited))

                    if (os.access(directory, os.W_OK)):
                        icon = ""
                    else:
                        icon = "cs-xlet-system"

                    self.model.set_value(iter, 10, icon)
                    if (found):
                        icon = "cs-xlet-installed"
                    else:
                        icon = ""
                    self.model.set_value(iter, 11, icon)
                    self.model.set_value(iter, 13, SETTING_TYPE_NONE)
                    self.model.set_value(iter, 14, True)
                except Exception, detail:
                    print "Failed to load extension %s: %s" % (theme, detail)

    def show_prompt(self, msg):
        dialog = Gtk.MessageDialog(transient_for = None,
                                   destroy_with_parent = True,
                                   message_type = Gtk.MessageType.QUESTION,
                                   buttons = Gtk.ButtonsType.YES_NO)
        dialog.set_default_size(400, 200)
        esc = cgi.escape(msg)
        dialog.set_markup(esc)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
        return response == Gtk.ResponseType.YES

    def show_info(self, msg):
        dialog = Gtk.MessageDialog(transient_for = None,
                                   modal = True,
                                   message_type = Gtk.MessageType.INFO,
                                   buttons = Gtk.ButtonsType.OK)
        esc = cgi.escape(msg)
        dialog.set_markup(esc)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()

################################## LOG FILE OPENING SPECIFICS

# Other distros can add appropriate instructions to these two methods
# to open the correct locations

    def do_logs_exist(self):
        return os.path.exists("%s/.cinnamon/glass.log" % (home)) or \
               os.path.exists("%s/.xsession-errors" % (home))

    def show_logs(self):
        glass_path = "%s/.cinnamon/glass.log" % (home)
        if os.path.exists(glass_path):
            subprocess.Popen(["xdg-open", glass_path])

        xerror_path = "%s/.xsession-errors" % (home)
        if os.path.exists(xerror_path):
            subprocess.Popen(["xdg-open", xerror_path])
