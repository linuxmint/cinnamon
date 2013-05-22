#!/usr/bin/env python

try:
    from SettingsWidgets import SidePage
    import XletSettings
    from Spices import Spice_Harvester
    #from Spices import *
    import gettext
    import locale
    import os.path
    import sys
    import time
    import urllib2
    import os
    import os.path
    import json
    from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, Pango, GLib
    import dbus
    import cgi
    import subprocess
except Exception, detail:
    print detail
    sys.exit(1)

home = os.path.expanduser("~")

SHOW_ALL = 0
SHOW_ACTIVE = 1
SHOW_INACTIVE = 2

SETTING_TYPE_NONE = 0
SETTING_TYPE_INTERNAL = 1
SETTING_TYPE_EXTERNAL = 2

ROW_SIZE = 32

class ExtensionSidePage (SidePage):
    SORT_NAME = 0
    SORT_RATING = 1
    SORT_DATE_EDITED = 2
    SORT_ENABLED = 3
    SORT_REMOVABLE = 4  

    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box, -1)
        self.collection_type = collection_type
        self.target = target
        self.noun = noun
        self.pl_noun = pl_noun
        self.themes = collection_type == "theme"
        self.icons = []

    def build(self, advanced):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        scrolledWindow = Gtk.ScrolledWindow()   
        scrolledWindow.set_shadow_type(Gtk.ShadowType.ETCHED_IN)   
        scrolledWindow.set_border_width(6) 
        self.notebook = Gtk.Notebook()
        extensions_vbox = Gtk.VBox()
        
        self.search_entry = Gtk.Entry()
        self.search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find')
        self.search_entry.set_placeholder_text(_("Search %s") % (self.pl_noun))
        self.search_entry.connect('changed', self.on_entry_refilter)

        self.notebook.append_page(extensions_vbox, Gtk.Label(_("Installed")))
        
        self.content_box.add(self.notebook)
        self.treeview = Gtk.TreeView()
        self.treeview.set_rules_hint(True)
        self.treeview.set_has_tooltip(True)
        if self.themes:
            self.treeview.connect("row-activated", self.on_row_activated)


        column2 = Gtk.TreeViewColumn("Icon", Gtk.CellRendererPixbuf(), pixbuf=4)        
        column2.set_min_width(50)

        cr = Gtk.CellRendererText()
        column3 = Gtk.TreeViewColumn("Description", cr, markup=1)
        column3.set_expand(True)
        if self.themes:
            column3.set_max_width(300)
            cr.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR)
            cr.set_property('wrap-width', 200)

        actionColumn = Gtk.TreeViewColumn("Read only", Gtk.CellRendererPixbuf(), pixbuf=10)
        actionColumn.set_expand(True)

        cr = Gtk.CellRendererPixbuf()
        isActiveColumn = Gtk.TreeViewColumn("Active", cr, pixbuf=11)
        isActiveColumn.set_expand(True)
        isActiveColumn.set_cell_data_func(cr, self._is_active_data_func)
        
        self.treeview.append_column(column2)
        self.treeview.append_column(column3)
        self.treeview.append_column(actionColumn)
        self.treeview.append_column(isActiveColumn)
        self.treeview.set_headers_visible(False)
        
        self.model = Gtk.TreeStore(str, str, int, int, GdkPixbuf.Pixbuf, str, int, bool, str, long, GdkPixbuf.Pixbuf, GdkPixbuf.Pixbuf, str, int)
        #                          uuid, desc, enabled, max-instances, icon, name, read-only, hide-config-button, ext-setting-app, edit-date, read-only icon, active icon, schema file name (for uninstall), settings type

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
        if not self.themes:
            self.instanceButton = Gtk.Button(_("Add to %s") % (self.target))
        else:
            self.instanceButton = Gtk.Button(_("Apply theme"))
        self.instanceButton.connect("clicked", lambda x: self._add_another_instance())
        if self.collection_type in ("desklet", "applet"):
            self.instanceButton.set_tooltip_text(_("Some %s can be added multiple times.\n Use this to add another instance. Use panel edit mode to remove a single instance.") % (self.pl_noun))
        elif self.collection_type == "extension":
            self.instanceButton.set_tooltip_text(_("Click to enable this %s") % (self.noun))
        else:
            self.instanceButton.set_tooltip_text(_("Click to apply this %s") % (self.noun))
        self.instanceButton.set_sensitive(False);

        self.configureButton = Gtk.Button(_("Configure"))
        self.configureButton.connect("clicked", self._configure_extension)
        self.configureButton.set_tooltip_text(_("Configure this %s") % (self.noun))

        self.extConfigureButton = Gtk.Button(_("Configure"))
        self.extConfigureButton.connect("clicked", self._external_configure_launch)
        self.extConfigureButton.set_tooltip_text(_("Configure this %s") % (self.noun))

        if not self.themes:
            restoreButton = Gtk.Button(_("Restore to default"))
        else:
            restoreButton = Gtk.Button(_("Restore default theme"))
        restoreButton.connect("clicked", lambda x: self._restore_default_extensions())
        
        hbox = Gtk.HBox()
        self.comboshow = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.comboshow.pack_start(renderer_text, True)
        showTypes=Gtk.ListStore(int, str)
        showTypes.append([SHOW_ALL, _("All %s") % (self.pl_noun)])
        showTypes.append([SHOW_ACTIVE, _("Active %s") % (self.pl_noun)])
        showTypes.append([SHOW_INACTIVE, _("Inactive %s") % (self.pl_noun)])
        self.comboshow.set_model(showTypes)
        self.comboshow.set_entry_text_column(1)
        self.comboshow.set_active(0) #All
        self.comboshow.connect('changed', self.comboshow_changed)
        self.comboshow.add_attribute(renderer_text, "text", 1)
        self.comboshow.show()
        
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

        getmore_label = Gtk.Label(_("Get more online"))
        self.notebook.append_page(getmore_vbox, getmore_label)
        self.notebook.connect("switch-page", self.on_page_changed)

        self.gm_combosort = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.gm_combosort.pack_start(renderer_text, True)
        sortTypes=Gtk.ListStore(int, str)
        sortTypes.append([self.SORT_NAME, _("Name")])
        sortTypes.append([self.SORT_RATING, _("Most popular")])
        sortTypes.append([self.SORT_DATE_EDITED, _("Latest")])
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
        self.gm_search_entry.set_placeholder_text(_("Search %s") % (self.pl_noun))
        hbox.pack_end(self.gm_search_entry, False, False, 4)
        self.search_entry.show()
        
        getmore_vbox.pack_start(hbox, False, False, 4)

        # MODEL
        self.gm_model = Gtk.TreeStore(str, str,      int, GdkPixbuf.Pixbuf, int,    str,     int)
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

        gm_column2 = Gtk.TreeViewColumn("Icon", Gtk.CellRendererPixbuf(), pixbuf=3)

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
        self.install_button = Gtk.Button(_("  Install or update selected"))
        self.select_updated = Gtk.Button("  Select updated")

        b, w, h = Gtk.icon_size_lookup(Gtk.IconSize.BUTTON)
        pb = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/update.svg", w, h)
        img = Gtk.Image.new_from_pixbuf(pb)
        self.select_updated.set_image(img)
        reload_button = Gtk.Button(_("Refresh list"))
        buttonbox.pack_start(self.install_button, False, False, 2)
        buttonbox.pack_start(self.select_updated, False, False, 2)
        buttonbox.pack_end(reload_button, False, False, 2)
        hbox.pack_start(buttonbox, True, True, 5)
        getmore_vbox.pack_end(hbox, False, True, 5)

        reload_button.connect("clicked", lambda x: self.load_spices(True))
        self.install_button.connect("clicked", lambda x: self.install_extensions())
        self.select_updated.connect("clicked", lambda x: self.select_updated_extensions())
        self.select_updated.hide()
        self.treeview.get_selection().connect("changed", lambda x: self._selection_changed());
        self.install_list = []
        self.update_list = {}

        self.spices = Spice_Harvester(self.collection_type, self.window, self.builder, self.noun, self.pl_noun)
        # if not self.spices.get_webkit_enabled():
        #     getmore_label.set_sensitive(False)
        #     reload_button.set_sensitive(False)

        extra_page = self.getAdditionalPage()
        if extra_page:
            self.notebook.append_page(extra_page, extra_page.label)

        self.content_box.show_all()

        if not self.themes:
            self.spices.scrubConfigDirs(self.enabled_extensions)

        self.search_entry.grab_focus()

        if len(sys.argv) > 2:
            for row in self.model:
                uuid = self.model.get_value(row.iter, 0)
                if uuid == sys.argv[2]:
                    path = self.model.get_path(row.iter)
                    filtered = self.treeview.get_model().convert_child_path_to_path(path)
                    if filtered is not None:
                        self.treeview.get_selection().select_path(filtered)
                        self.treeview.scroll_to_cell(filtered, None, False, 0, 0)
                        if self.configureButton.get_visible() and self.configureButton.get_sensitive():
                            self.configureButton.clicked()
                        elif self.extConfigureButton.get_visible() and self.extConfigureButton.get_sensitive():
                            self.extConfigureButton.clicked()

    def getAdditionalPage(self):
        return None

    def on_treeview_query_tooltip(self, treeview, x, y, keyboard_mode, tooltip):
        data = treeview.get_path_at_pos(x, y)
        if data:
            path, column, x, y=data
            iter = self.modelfilter.get_iter(path)
            if column.get_property('title')=="Read only" and iter != None:
                if not self.modelfilter.get_value(iter, 6):
                    tooltip.set_text(_("This %s is read-only, and cannot be uninstalled") % self.noun)
                    return True
                else:
                    return False
            elif column.get_property('title') == "Active" and iter != None:
                count = self.modelfilter.get_value(iter, 2)
                markup = ""
                if count > 0:
                    markup += _("This %s is currently active.") % self.noun
                    if count > 1:
                        markup += _("\n\nInstance count: %d") % count
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
                        tooltip.set_text(_("An update is available for this %s") % (self.noun))
                    else:
                        tooltip.set_text(_("This %s is installed and up-to-date") % (self.noun))
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

                    if self.should_show_config_button(self.modelfilter, iter):
                        item = Gtk.MenuItem(_("Configure"))
                        item.connect('activate', lambda x: self._configure_extension())
                        item.set_sensitive(self.modelfilter.get_value(iter, 2) > 0)
                        popup.add(item)
                        popup.add(Gtk.SeparatorMenuItem())

                    if self.should_show_ext_config_button(self.modelfilter, iter):
                        item = Gtk.MenuItem(_("Configure"))
                        item.connect('activate', lambda x: self._external_configure_launch())
                        item.set_sensitive(self.modelfilter.get_value(iter, 2) > 0)
                        popup.add(item)
                        popup.add(Gtk.SeparatorMenuItem())

                    if self.modelfilter.get_value(iter, 2) > 0 and not self.themes:
                        checked = self.modelfilter.get_value(iter, 2)
                        item = Gtk.MenuItem(_("Remove from %s") % (self.target))
                        item.connect('activate', lambda x: self.disable_extension(uuid, name, checked))
                        popup.add(item)

                        max_instances = self.modelfilter.get_value(iter, 3);
                        can_instance = max_instances == -1 or ((max_instances > 0) and (max_instances > checked))
                        if can_instance:
                            item = Gtk.MenuItem(_("Add to %s") % (self.target))
                            item.connect('activate', lambda x: self.instance_extension(uuid))
                            popup.add(item)
                    else:
                        if not self.themes:
                            item = Gtk.MenuItem(_("Add to %s") % (self.target))
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

                    #popup.add(item)
                    popup.show_all()
                    popup.popup(None, None, None, None, event.button, event.time)

                # Only allow context menu for currently selected item
                if indices[0] not in sel:
                    return False

            return True
   
    def _is_active_data_func(self, column, cell, model, iter, data=None):
        enabled = model.get_value(iter, 2) > 0
        if (enabled):
            if not self.themes:
                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/running.svg", ROW_SIZE, ROW_SIZE)
            else:
                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/installed.svg", ROW_SIZE, ROW_SIZE)
        else:
            img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/inactive.png", ROW_SIZE, ROW_SIZE)
        cell.set_property('pixbuf', img)

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
                    newExtensions += [(i_uuid, is_update)]
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

            if column.get_property('title')==_("Action") and iter != None:
                self.gm_treeview.get_window().set_cursor(Gdk.Cursor.new(Gdk.CursorType.HAND2))
                return
        self.gm_treeview.get_window().set_cursor(Gdk.Cursor.new(Gdk.CursorType.ARROW))

    def gm_on_button_press_event(self, widget, event):
        if event.button == 1:
            data=widget.get_path_at_pos(int(event.x),int(event.y))
            if data:
                path, column, x, y = data
                if column.get_property('title')==_("Action"):
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
        cell.set_property('markup',"<span color='#0000FF'>More info</span>")

    def _gm_status_data_func(self, column, cell, model, iter, data=None):
        uuid = model.get_value(iter, 0)
        date = model.get_value(iter, 6)

        installed, can_update, is_active = self.version_compare(uuid, date)

        if installed:
            if can_update:
                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/update.svg", ROW_SIZE, ROW_SIZE)
                self.update_list[uuid] = True
            else:
                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/installed.svg", ROW_SIZE, ROW_SIZE)
                if uuid in self.update_list.keys():
                    del self.update_list[uuid]
        else:
            img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/inactive.png", ROW_SIZE, ROW_SIZE)
            if uuid in self.update_list.keys():
                del self.update_list[uuid]

        cell.set_property("pixbuf", img)
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
        query = self.search_entry.get_buffer().get_text()
        extensionName = model.get_value(iterr, 5)
        
        enabled = model.get_value(iterr, 2)

        if extensionName == None:
            return False

        if self.showFilter == SHOW_ALL:
            return enabled >= 0 and (query == "" or query in extensionName.lower())
        elif self.showFilter == SHOW_ACTIVE:
            return enabled > 0 and (query == "" or query in extensionName.lower())
        elif self.showFilter == SHOW_INACTIVE:
            return enabled == 0 and (query == "" or query in extensionName.lower())
        else:
            return False

    def match_func(self, model, iterr, data=None):
        query = self.search_entry.get_buffer().get_text()
        value = model.get_value(iterr, 5)
        
        if query == "":
            return True
        elif query in value.lower():
            return True
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
        self.spices.load(self.on_spice_load, force)

    def install_extensions(self):
        if len(self.install_list) > 0:
            self.spices.install_all(self.install_list, self.install_finished)
    
    def install_finished(self, need_restart):
        for row in self.gm_model:
            self.gm_model.set_value(row.iter, 2, 0)
        self.install_button.set_sensitive(False)
        self.install_list = []
        self.load_extensions()
        if need_restart:
            self.show_info(_("One or more active %s may have been updated.  You probably need to restart Cinnamon for the changes to take effect") % (self.pl_noun))

    def on_spice_load(self, spicesData):
        #print "total spices loaded: %d" % len(spicesData)
        self.gm_model.clear()
        self.install_button.set_sensitive(False)
        for uuid in spicesData:
            extensionData = spicesData[uuid]
            extensionName = extensionData['name'].replace('&', '&amp;')
            iter = self.gm_model.insert_before(None, None)
            self.gm_model.set_value(iter, 0, uuid)
            if not self.themes:
                self.gm_model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="x-small">%s</span></b>' % (extensionName, uuid))
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
            if not os.path.exists(os.path.join(self.spices.get_cache_folder(), icon_filename)):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( ("/usr/lib/cinnamon-settings/data/icons/%ss.svg") % (self.collection_type), w, h)
            else:
                try:
                    img = GdkPixbuf.Pixbuf.new_from_file_at_size(os.path.join(self.spices.get_cache_folder(), icon_filename), w, h)
                except:
                    img = GdkPixbuf.Pixbuf.new_from_file_at_size( ("/usr/lib/cinnamon-settings/data/icons/%ss.svg") % (self.collection_type), w, h)
            self.gm_model.set_value(iter, 3, img)
            self.gm_model.set_value(iter, 4, int(extensionData['score']))
            self.gm_model.set_value(iter, 5, extensionData['name'])
            self.gm_model.set_value(iter, 6, int(extensionData['last_edited']))

    def enable_extension(self, uuid, name):
        if not self.themes:
            if self.collection_type in ("applet", "desklet"):
                extension_id = self.settings.get_int(("next-%s-id") % (self.collection_type));
                self.settings.set_int(("next-%s-id") % (self.collection_type), (extension_id+1));
            else:
                extension_id = 0
            self.enabled_extensions.append(self.toSettingString(uuid, extension_id))
            self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)
        else:
            if uuid == "STOCK":
                self.settings.set_string("name", "")
            else:
                self.settings.set_string("name", name)

    def disable_extension(self, uuid, name, checked):

        if (checked > 1):
            msg = _("There are multiple instances of this %s, do you want to remove them all?\n\n") % (self.noun)
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
        self.spices.uninstall(uuid, name, schema_filename, self.on_uninstall_finished)
    
    def on_uninstall_finished(self, uuid):
        self.load_extensions()

    def instance_extension(self, uuid):
        if self.collection_type in ("applet", "desklet"):
            extension_id = self.settings.get_int(("next-%s-id") % (self.collection_type));
            self.settings.set_int(("next-%s-id") % (self.collection_type), (extension_id+1));
        else:
            extension_id = 0
        self.enabled_extensions.append(self.toSettingString(uuid, extension_id))
        self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)

    def on_page_changed(self, notebook, page, page_num):
        if page_num == 1 and len(self.gm_model) == 0:
            self.load_spices()
        GLib.timeout_add(1, self.focus, page_num)

    def focus(self, page_num):
        if page_num == 0:
            self.search_entry.grab_focus()
        else:
            self.gm_search_entry.grab_focus()
        return False

    def _enabled_extensions_changed(self):
        last_selection = ''
        model, treeiter = self.treeview.get_selection().get_selected()

        if self.themes:
            self.enabled_extensions = [self.settings.get_string("name")]
        else:
            self.enabled_extensions = self.settings.get_strv(("enabled-%ss") % (self.collection_type))
        
        uuidCount = {}
        for enabled_extension in self.enabled_extensions:
            try:
                uuid = self.fromSettingString(enabled_extension)
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
            if(uuid in uuidCount):
                self.model.set_value(row.iter, 2, uuidCount[uuid])
            else:
                self.model.set_value(row.iter, 2, 0)
        self._selection_changed()

    def _add_another_instance(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            self._add_another_instance_iter(treeiter)

    def select_updated_extensions(self):
        if len(self.update_list) > 1:
            noun = self.pl_noun
        else:
            noun = self.noun
        if not self.show_prompt(_("This operation will update %d installed %s.\n\nDo you want to continue?") % (len(self.update_list), noun)):
            return
        for row in self.gm_model:
            uuid = self.gm_model.get_value(row.iter, 0)
            if uuid in self.update_list.keys():
                self.gm_mark(uuid, True)
        self.install_extensions()

    def refresh_update_button(self):
        num = len(self.update_list)
        if num > 0:
            if num > 1:
                self.select_updated.set_label(_("%d updates available!") % (len(self.update_list)))
            else:
                self.select_updated.set_label(_("%d update available!") % (len(self.update_list)))
            self.select_updated.show()
            self.select_updated.get_property('image').show()
        else:
            self.select_updated.hide()

    def _add_another_instance_iter(self, treeiter):
        uuid = self.modelfilter.get_value(treeiter, 0);
        name = self.modelfilter.get_value(treeiter, 5)
        if not self.themes:
            self.instance_extension(uuid)
        else:
            self.enable_extension(uuid, name)
        
    def _selection_changed(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        enabled = False;
        if self.collection_type in ("applet", "desklet"):
            tip = _("Some %s can be added multiple times.\nUse this to add another instance. Use panel edit mode to remove a single instance.") % (self.pl_noun)
        elif self.collection_type == "extension":
            tip = _("Click to enable this %s") % (self.noun)
        else:
            tip = _("Click to apply this %s") % (self.noun)
        if treeiter:
            checked = model.get_value(treeiter, 2);
            max_instances = model.get_value(treeiter, 3);
            enabled = max_instances > checked
            if self.collection_type in ("applet", "desklet"):
                if max_instances == 1:
                    tip += _("\nThis %s does not support multiple instances.") % (self.noun)
                else:
                    tip += _("\nThis %s supports max %d instances.") % (self.noun, max_instances)
        self.instanceButton.set_sensitive(enabled);
        self.instanceButton.set_tooltip_text(tip)

        if treeiter:
            self.configureButton.set_visible(self.should_show_config_button(model, treeiter))
            self.configureButton.set_sensitive(checked)
            self.extConfigureButton.set_visible(self.should_show_ext_config_button(model, treeiter))
            self.extConfigureButton.set_sensitive(checked)

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
            self.notebook.hide()
            settingContainer.show()

    def _external_configure_launch(self, widget = None):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            app = model.get_value(treeiter, 8)
            if app is not None:
                subprocess.Popen([app])

    def _close_configure(self, settingContainer):
        settingContainer.content.hide()
        self.notebook.show_all()

    def _restore_default_extensions(self):
        if not self.themes:
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
            if os.path.exists(directory) and os.path.isdir(directory):
                extensions = os.listdir(directory)
                extensions.sort()
                for extension in extensions:
                    if self.uuid_already_in_list(extension):
                        continue
                    try:
                        if os.path.exists("%s/%s/metadata.json" % (directory, extension)):
                            json_data=open("%s/%s/metadata.json" % (directory, extension)).read()
                            setting_type = 0
                            data = json.loads(json_data)  
                            extension_uuid = data["uuid"]
                            extension_name = data["name"]                                        
                            extension_description = data["description"]                          
                            try: extension_max_instances = int(data["max-instances"])
                            except KeyError: extension_max_instances = 1
                            except ValueError: extension_max_instances = 1

                            try: extension_role = data["role"]
                            except KeyError: extension_role = None
                            except ValueError: extension_role = None

                            try: hide_config_button = data["hide-configuration"]
                            except KeyError: hide_config_button = False
                            except ValueError: hide_config_button = False

                            try:
                                ext_config_app = os.path.join(directory, extension, data["external-configuration-app"])
                                setting_type = SETTING_TYPE_EXTERNAL
                            except KeyError: ext_config_app = ""
                            except ValueError: ext_config_app = ""

                            if os.path.exists("%s/%s/settings-schema.json" % (directory, extension)):
                                setting_type = SETTING_TYPE_INTERNAL

                            try: last_edited = data["last-edited"]
                            except KeyError: last_edited = -1
                            except ValueError: last_edited = -1

                            try: schema_filename = data["schema-file"]
                            except KeyError: schema_filename = ""
                            except ValueError: schema_filename = ""

                            if ext_config_app != "" and not os.path.exists(ext_config_app):
                                ext_config_app = ""

                            if extension_max_instances < -1:
                                extension_max_instances = 1
                                
                            if self.search_entry.get_text().upper() in (extension_name + extension_description).upper():
                                iter = self.model.insert_before(None, None)
                                found = 0
                                for enabled_extension in self.enabled_extensions:
                                    if extension_uuid in enabled_extension:
                                        found += 1

                                self.model.set_value(iter, 0, extension_uuid)                
                                self.model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (extension_name, extension_uuid, extension_description))                                  
                                self.model.set_value(iter, 2, found)
                                self.model.set_value(iter, 3, extension_max_instances)
                                img = None                            
                                if "icon" in data:
                                    extension_icon = data["icon"]
                                    theme = Gtk.IconTheme.get_default()                                                    
                                    if theme.has_icon(extension_icon):
                                        img = theme.load_icon(extension_icon, ROW_SIZE, 0)
                                elif os.path.exists("%s/%s/icon.png" % (directory, extension)):
                                    img = GdkPixbuf.Pixbuf.new_from_file_at_size("%s/%s/icon.png" % (directory, extension), ROW_SIZE, ROW_SIZE)                            
                                
                                if img is None:                                                
                                    img = GdkPixbuf.Pixbuf.new_from_file_at_size( ("/usr/lib/cinnamon-settings/data/icons/%ss.svg") % (self.collection_type), ROW_SIZE, ROW_SIZE)
                                                            
                                self.model.set_value(iter, 4, img)
                                self.model.set_value(iter, 5, extension_name)
                                self.model.set_value(iter, 6, os.access(directory, os.W_OK))
                                self.model.set_value(iter, 7, hide_config_button)
                                self.model.set_value(iter, 8, ext_config_app)
                                self.model.set_value(iter, 9, long(last_edited))

                                if (os.access(directory, os.W_OK)):
                                    img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/user.png", ROW_SIZE, ROW_SIZE)
                                else:
                                    img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/system.svg", ROW_SIZE, ROW_SIZE)

                                self.model.set_value(iter, 10, img)

                                if (found):
                                    img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/running.svg", ROW_SIZE, ROW_SIZE)
                                else:
                                    img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/inactive.png", ROW_SIZE, ROW_SIZE)

                                self.model.set_value(iter, 11, img)
                                self.model.set_value(iter, 12, schema_filename)
                                self.model.set_value(iter, 13, setting_type)

                    except Exception, detail:
                        print "Failed to load extension %s: %s" % (extension, detail)
        else: # Theme handling
            if os.path.exists(directory) and os.path.isdir(directory):
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
                        if os.path.exists(path) and os.path.isdir(path):
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
                                icon_path = "/usr/lib/cinnamon-settings/data/icons/themes.svg"
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size(icon_path, -1, 60)

                            self.model.set_value(iter, 0, theme_uuid)
                            self.model.set_value(iter, 1, '<b>%s</b>' % (theme_name))
                            self.model.set_value(iter, 2, found)
                            self.model.set_value(iter, 3, 1)
                            self.model.set_value(iter, 4, img)
                            self.model.set_value(iter, 5, theme_name)
                            self.model.set_value(iter, 6, os.access(directory, os.W_OK))
                            self.model.set_value(iter, 7, True)
                            self.model.set_value(iter, 8, "")
                            self.model.set_value(iter, 9, long(theme_last_edited))

                            if (os.access(directory, os.W_OK)):
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/user.png", ROW_SIZE, ROW_SIZE)
                            else:
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/system.svg", ROW_SIZE, ROW_SIZE)

                            self.model.set_value(iter, 10, img)
                            if (found):
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/installed.svg", ROW_SIZE, ROW_SIZE)
                            else:
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/lib/cinnamon-settings/data/inactive.png", ROW_SIZE, ROW_SIZE)
                            self.model.set_value(iter, 11, img)
                            self.model.set_value(iter, 13, SETTING_TYPE_NONE)
                    except Exception, detail:
                        print "Failed to load extension %s: %s" % (theme, detail)

    def show_prompt(self, msg):
        dialog = Gtk.MessageDialog(None,
                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                    Gtk.MessageType.QUESTION,
                    Gtk.ButtonsType.YES_NO,
                    None)
        dialog.set_default_size(400, 200)
        esc = cgi.escape(msg)
        dialog.set_markup(esc)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
        return response == Gtk.ResponseType.YES

    def show_info(self, msg):
        dialog = Gtk.MessageDialog(None, Gtk.DialogFlags.MODAL, Gtk.MessageType.INFO, Gtk.ButtonsType.OK, None)
        esc = cgi.escape(msg)
        dialog.set_markup(esc)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
