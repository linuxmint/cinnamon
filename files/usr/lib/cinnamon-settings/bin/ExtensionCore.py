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
    from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf, Pango
    import dbus
    import subprocess
except Exception, detail:
    print detail
    sys.exit(1)

home = os.path.expanduser("~")

ACTIVE = 1 << 0
INACTIVE = 1 << 1

class ExtensionSidePage (SidePage):
    SORT_NAME = 0
    SORT_RATING = 1
    SORT_DATE_EDITED = 2
    SORT_ENABLED = 3
    SORT_REMOVABLE = 4

    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, target):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box, True)
        self.collection_type = collection_type
        self.target = target
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
        self.search_entry.set_placeholder_text(_("Search %ss") % (self.collection_type))
        self.search_entry.connect('changed', self.on_entry_refilter)

        self.notebook.append_page(extensions_vbox, Gtk.Label(_("Installed")))
        
        self.content_box.add(self.notebook)
        self.treeview = Gtk.TreeView()
        
        cr = Gtk.CellRendererToggle()
        cr.connect("toggled", self.toggled, self.treeview)
        column1 = Gtk.TreeViewColumn(_("Enable"), cr)
        column1.set_cell_data_func(cr, self.celldatafunction_checkbox)        
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("Icon"), Gtk.CellRendererPixbuf(), pixbuf=4)        
        column2.set_resizable(True)
        column2.set_min_width(50)

        column3 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)        
        column3.set_resizable(True)      
        column3.set_min_width(500)
        column3.set_max_width(501)

        cr = Gtk.CellRendererText()
        actionColumn = Gtk.TreeViewColumn(_("Action"), cr)
        actionColumn.set_min_width(100)
        actionColumn.set_cell_data_func(cr, self._action_data_func)

        cr = Gtk.CellRendererText()
        isActiveColumn = Gtk.TreeViewColumn(_("Active"), cr)
        isActiveColumn.set_min_width(100)
        isActiveColumn.set_cell_data_func(cr, self._is_active_data_func)
        
        self.treeview.append_column(column2)
        self.treeview.append_column(column3)
        self.treeview.append_column(actionColumn)
        self.treeview.append_column(isActiveColumn)
        self.treeview.set_headers_visible(False)
        
        self.model = Gtk.TreeStore(str, str, int, int, GdkPixbuf.Pixbuf, str, int, bool, str)
        #                          uuid, desc, enabled, max-instances, icon, name, read-only, hide-config-button, ext-setting-app

        self.modelfilter = self.model.filter_new()
        self.onlyActive = ACTIVE
        self.modelfilter.set_visible_func(self.only_active)
        
        self.treeview.set_model(self.modelfilter)
        self.treeview.set_search_column(5)
        self.treeview.set_search_entry(self.search_entry)
        # Find the enabled extensions
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_extensions = self.settings.get_strv("enabled-%ss" % (self.collection_type))
                         
        self.load_extensions()

        self.model.set_sort_column_id(5, Gtk.SortType.ASCENDING) # Sort by name 
        
        self.settings.connect(("changed::enabled-%ss") % (self.collection_type), lambda x,y: self._enabled_extensions_changed())
        
        scrolledWindow.add(self.treeview)
        self.treeview.connect('button_press_event', self.on_button_press_event)

        self.instanceButton = Gtk.Button(_("Add to %s") % (self.target))
        self.instanceButton.connect("clicked", lambda x: self._add_another_instance())
        if self.collection_type in ("desklet", "applet"):
            self.instanceButton.set_tooltip_text(_("Some %ss can be added multiple times.\nUse this to add another instance. Use panel edit mode to remove a single instance.") % (self.collection_type))
        else:
            self.instanceButton.set_tooltip_text(_("Click to enable this %s") % (self.collection_type))
        self.instanceButton.set_sensitive(False);

        self.configureButton = Gtk.Button(_("Configure"))
        self.configureButton.connect("clicked", self._configure_extension)
        self.configureButton.set_tooltip_text(_("Configure this %s") % (self.collection_type))

        self.extConfigureButton = Gtk.Button(_("Configure"))
        self.extConfigureButton.connect("clicked", self._external_configure_launch)
        self.extConfigureButton.set_tooltip_text(_("Configure this %s") % (self.collection_type))


        restoreButton = Gtk.Button(_("Restore to default"))
        restoreButton.connect("clicked", lambda x: self._restore_default_extensions())
        # Installed 
        hbox = Gtk.HBox()
        self.activeButton = Gtk.ToggleButton(_("Active"))
        self.inactiveButton = Gtk.ToggleButton(_("Inactive"))
        self.activeButton.set_active(True)
        self.inactiveButton.set_active(False)
        self.activeHandler = self.activeButton.connect("toggled", self._filter_toggle_active)
        self.inactiveHandler = self.inactiveButton.connect("toggled", self._filter_toggle_inactive)

        buttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL)
        buttonbox.set_spacing(6)
        buttonbox.pack_start(self.activeButton, False, False, 0)
        buttonbox.pack_start(self.inactiveButton, False, False, 0)
        hbox.pack_start(buttonbox, False, False, 4)

        hbox.pack_end(self.search_entry, False, False, 4)
        extensions_vbox.pack_start(hbox, False, False, 4)
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
        #hbox.set_margin_bottom(2)
        sortLabel = Gtk.Label()
        sortLabel.set_text("Sort by")
        sortLabel.show()
        hbox.pack_start(sortLabel, False, False, 4)
        hbox.pack_start(self.gm_combosort, False, False, 2)
        hbox.show()

        self.gm_search_entry = Gtk.Entry()
        self.gm_search_entry.connect('changed', self.gm_on_entry_refilter)
        self.gm_search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find')
        self.gm_search_entry.set_placeholder_text(_("Search %ss") % (self.collection_type))
        hbox.pack_end(self.gm_search_entry, False, False, 4)
        self.search_entry.show()
        
        getmore_vbox.pack_start(hbox, False, False, 4)

        # MODEL
        self.gm_model = Gtk.TreeStore(str, str, int, GdkPixbuf.Pixbuf, int, str, int)
        #                            uuid, name, install, icon, score
        self.gm_model.set_sort_column_id(4, Gtk.SortType.DESCENDING)

        # TREE
        self.gm_modelfilter = self.gm_model.filter_new()
        self.gm_modelfilter.set_visible_func(self.gm_match_func)
        self.gm_treeview = Gtk.TreeView()
        
        gm_cr = Gtk.CellRendererToggle()
        gm_cr.connect("toggled", self.gm_toggled, self.gm_treeview)
        gm_column1 = Gtk.TreeViewColumn(_("Install"), gm_cr)
        gm_column1.set_cell_data_func(gm_cr, self.gm_celldatafunction_checkbox)
        gm_column1.set_resizable(True)

        gm_column2 = Gtk.TreeViewColumn(_("Icon"), Gtk.CellRendererPixbuf(), pixbuf=3)
        gm_column2.set_resizable(True)

        gm_column3 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)
        gm_column3.set_resizable(True)
        gm_column3.set_max_width(400)
        
        cr = Gtk.CellRendererText()
        actionColumn = Gtk.TreeViewColumn(_("Action"), cr)
        actionColumn.set_cell_data_func(cr, self._gm_action_data_func)
        actionColumn.set_max_width(70)

        right = Gtk.CellRendererText()
        right.set_property('xalign', 1.0)
        gm_column4 = Gtk.TreeViewColumn(_("Score"), right, markup=4)
        gm_column4.set_resizable(True)
        gm_column4.set_alignment(1.0)

        self.gm_treeview.append_column(gm_column1)
        self.gm_treeview.append_column(gm_column2)
        self.gm_treeview.append_column(gm_column3)
        self.gm_treeview.append_column(actionColumn)
        self.gm_treeview.append_column(gm_column4)
        self.gm_treeview.set_headers_visible(False)

        self.gm_treeview.set_model(self.gm_modelfilter)
        self.gm_treeview.set_search_column(5)
        self.gm_treeview.set_search_entry(self.gm_search_entry)

        gm_scrolled_window.add(self.gm_treeview)
        self.gm_treeview.connect('motion_notify_event', self.gm_on_motion_notify_event)
        self.gm_treeview.connect('button_press_event', self.gm_on_button_press_event)

        getmore_vbox.add(gm_scrolled_window)

        hbox = Gtk.HBox()
        buttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL)
        buttonbox.set_spacing(6)
        self.install_button = Gtk.Button(_("Install selected"))
        reload_button = Gtk.Button(_("Refresh list"))
        buttonbox.pack_start(self.install_button, False, False, 2)
        buttonbox.pack_end(reload_button, False, False, 2)
        hbox.pack_start(buttonbox, True, True, 5)
        getmore_vbox.pack_end(hbox, False, True, 5)

        reload_button.connect("clicked", lambda x: self.load_spices(True))
        self.install_button.connect("clicked", lambda x: self.install_extensions())
        self.content_box.show_all()   
        self.treeview.get_selection().connect("changed", lambda x: self._selection_changed());
        self.install_list = []
        
        self.spices = Spice_Harvester(self.collection_type, self.window, self.builder, self.on_enable_new_extension)
        # if not self.spices.get_webkit_enabled():
        #     getmore_label.set_sensitive(False)
        #     reload_button.set_sensitive(False)

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

    def _filter_toggle_active(self, widget):
        if widget.get_active():
            self.onlyActive |= ACTIVE
        else:
            self.onlyActive &= ~ACTIVE
        self.modelfilter.refilter()
        return False

    def _filter_toggle_inactive(self, widget):
        if widget.get_active():
            self.onlyActive |= INACTIVE
        else:
            self.onlyActive &= ~INACTIVE
        self.modelfilter.refilter()
        return False

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

                    if self.modelfilter.get_value(iter, 2) > 0:
                        checked = self.modelfilter.get_value(iter, 2)
                        item = Gtk.MenuItem(_("Remove from %s") % (self.target))
                        item.connect('activate', lambda x: self.disable_extension(uuid, checked))
                        popup.add(item)

                        max_instances = self.modelfilter.get_value(iter, 3);
                        can_instance = max_instances == -1 or ((max_instances > 0) and (max_instances > checked))
                        if can_instance:
                            item = Gtk.MenuItem(_("Add to %s") % (self.target))
                            item.connect('activate', lambda x: self.instance_extension(uuid))
                            popup.add(item)
                    else:
                        item = Gtk.MenuItem(_("Add to %s") % (self.target))
                        item.connect('activate', lambda x: self.enable_extension(uuid))
                        popup.add(item)
                        
                    
                    item = Gtk.MenuItem(_("Uninstall"))
                    if self.modelfilter.get_value(iter, 6):
                        item.connect('activate', lambda x: self.uninstall_extension(uuid, name))
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

    def _action_data_func(self, column, cell, model, iter, data=None):
        readonly = model.get_value(iter, 6)
        label = '(System)' if not readonly else ''
        cell.set_property('markup',"<span color='#999999'>%s</span>" % label)

    def _is_active_data_func(self, column, cell, model, iter, data=None):
        enabled = model.get_value(iter, 2) > 0
        if enabled:
            label = _("Active")
        else:
            label = ""
        cell.set_property('markup',"<span color='black' weight='bold' size='large'>%s</span>" % label)

    def gm_view_details(self, uuid):
        self.spices.show_detail(uuid, lambda x: self.gm_mark(uuid, True))

    def gm_mark(self, uuid, shouldMark=True):
        for row in self.gm_model:
            if uuid == self.gm_model.get_value(row.iter, 0):
                self.gm_model.set_value(row.iter, 2, 1 if shouldMark else 0)

        if not shouldMark:
            newExtensions = []
            for i_uuid in self.install_list:
                if uuid != i_uuid:
                    newExtensions += [i_uuid]
            self.install_list = newExtensions
        else:
            if uuid not in self.install_list:
                self.install_list += [uuid]

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
                    marked = self.gm_modelfilter.get_value(iter, 2)

                    if (marked):
                        item = Gtk.MenuItem(_("Unmark"))
                        popup.add(item)
                        item.connect('activate', lambda x: self.gm_mark(uuid, False))
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

    def _gm_action_data_func(self, column,cell, model, iter, data=None):
        cell.set_property('markup',"<span color='#0000FF'>More info</span>")


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
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)

        if (checked > 0):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)

    def only_active(self, model, iterr, data=None):
        query = self.search_entry.get_buffer().get_text()
        extensionName = model.get_value(iterr, 5)
        
        enabled = model.get_value(iterr, 2)

        if extensionName == None:
            return False

        if self.onlyActive == ACTIVE | INACTIVE:
            return enabled >= 0 and (query == "" or query in extensionName.lower())
        elif self.onlyActive == ACTIVE:
            return enabled > 0 and (query == "" or query in extensionName.lower())
        elif self.onlyActive == INACTIVE:
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

    def on_enable_new_extension(self, uuid):
        self.enable_extension(uuid)

    def load_spices(self, force=False):
        # if self.spices.get_webkit_enabled():
        self.spices.load(self.on_spice_load, force)

    def install_extensions(self):
        if len(self.install_list) > 0:
            self.spices.install_all(self.install_list, self.install_finished)
    
    def install_finished(self):
        for row in self.gm_model:
            uuid = self.gm_model.get_value(row.iter, 0)
            if uuid in self.install_list:
                self.gm_model.set_value(row.iter, 2, 0)

        self.install_list = []
        self.load_extensions()

    def on_spice_load(self, spicesData):
        #print "total spices loaded: %d" % len(spicesData)
        self.gm_model.clear()
        self.install_button.set_sensitive(False)
        for uuid in spicesData:
            extensionData = spicesData[uuid]
            extensionName = extensionData['name'].replace('&', '&amp;')
            iter = self.gm_model.insert_before(None, None)
            self.gm_model.set_value(iter, 0, uuid)
            self.gm_model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (extensionName, uuid, "Description not implemented"))
            self.gm_model.set_value(iter, 2, 0)
            
            icon_filename = os.path.basename(extensionData['icon'])
            
            if not os.path.exists(os.path.join(self.spices.get_cache_folder(), icon_filename)):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( ("/usr/lib/cinnamon-settings/data/icons/%ss.svg") % (self.collection_type), 32, 32)
            else:
                img = GdkPixbuf.Pixbuf.new_from_file_at_size(os.path.join(self.spices.get_cache_folder(), icon_filename), 32, 32)
            self.gm_model.set_value(iter, 3, img)
            self.gm_model.set_value(iter, 4, int(extensionData['score']))
            self.gm_model.set_value(iter, 5, extensionData['name'])
            self.gm_model.set_value(iter, 6, int(extensionData['last_edited']))

    def enable_extension(self, uuid):
        extension_id = self.settings.get_int(("next-%s-id") % (self.collection_type));
        self.settings.set_int(("next-%s-id") % (self.collection_type), (extension_id+1));
        self.enabled_extensions.append(self.toSettingString(uuid, extension_id))
        self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)

    def disable_extension(self, uuid, checked):

        if (checked > 1):
            msg = _("There are multiple instances of this %s, do you want to remove them all?\n\n") % (self.collection_type)
            msg += self.RemoveString

            if self.show_prompt(msg) == False:
                return

        newExtensions = []
        for enabled_extension in self.enabled_extensions:
            if uuid not in enabled_extension:
                newExtensions.append(enabled_extension)
        self.enabled_extensions = newExtensions
        self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)

    def uninstall_extension(self, uuid, name):
        self.disable_extension(uuid)
        self.spices.uninstall(uuid, name, self.on_uninstall_finished)
    
    def on_uninstall_finished(self, uuid):
        self.load_extensions()

    def instance_extension(self, uuid):
        extension_id = self.settings.get_int(("next-%s-id") % (self.collection_type));
        self.settings.set_int(("next-%s-id") % (self.collection_type), (extension_id+1));
        self.enabled_extensions.append(self.toSettingString(uuid, extension_id))
        self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)

    def on_page_changed(self, notebook, page, page_num):
        if page_num == 1 and len(self.gm_model) == 0:
            self.load_spices()

        return True

    def _enabled_extensions_changed(self):
        last_selection = ''
        model, treeiter = self.treeview.get_selection().get_selected()

        self.enabled_extensions = self.settings.get_strv(("enabled-%ss") % (self.collection_type))
        
        uuidCount = {}
        for enabled_extension in self.enabled_extensions:
            try:
                uuid = self.fromSettingString(enabled_extension)
                if uuid in uuidCount:
                    uuidCount[uuid] += 1
                else:
                    uuidCount[uuid] = 1
            except:
                pass

        for row in self.model:
            uuid = self.model.get_value(row.iter, 0)
            if(uuid in uuidCount):
                self.model.set_value(row.iter, 2, uuidCount[uuid])
            else:
                self.model.set_value(row.iter, 2, 0)
        
    def _add_another_instance(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            self._add_another_instance_iter(treeiter)
        
    def _add_another_instance_iter(self, treeiter):
        uuid = self.modelfilter.get_value(treeiter, 0);
        self.instance_extension(uuid)
        
    def _selection_changed(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        enabled = False;
        if self.collection_type in ("applet", "desklet"):
            tip = _("Some %ss can be added multiple times.\nUse this to add another instance. Use panel edit mode to remove a single instance.") % (self.collection_type)
        else:
            tip = _("Click to enable this %s") % (self.collection_type)
        if treeiter:
            checked = model.get_value(treeiter, 2);
            max_instances = model.get_value(treeiter, 3);
            enabled = max_instances > checked
            if self.collection_type in ("applet", "desklet"):
                if max_instances == 1:
                    tip += _("\nThis %s does not support multiple instances.") % (self.collection_type)
                else:
                    tip += _("\nThis %s supports max %d instances.") % (self.collection_type, max_instances)
        self.instanceButton.set_sensitive(enabled);
        self.instanceButton.set_tooltip_text(tip)
        if treeiter:
            hide_override = model.get_value(treeiter, 7)
            ext_override = model.get_value(treeiter, 8)
            if hide_override:
                self.configureButton.hide()
                self.extConfigureButton.hide()
                return
            if ext_override != "":
                self.configureButton.hide()
                self.extConfigureButton.show()
                if checked:
                    self.extConfigureButton.set_sensitive(True)
                else:
                    self.extConfigureButton.set_sensitive(False)
                return
        if treeiter and self._has_settings(model.get_value(treeiter, 0)):
            self.extConfigureButton.hide()
            self.configureButton.show()
            if checked:
                self.configureButton.set_sensitive(True)
            else:
                self.configureButton.set_sensitive(False)
        else:
            self.configureButton.hide()
            self.extConfigureButton.hide()

    def _has_settings(self, uuid):
        if os.path.exists("%s/.cinnamon/configs/%s" % (home, uuid)):
            if len(os.listdir("%s/.cinnamon/configs/%s" % (home, uuid))) > 0:
                return True
        return False

    def _configure_extension(self, widget):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            uuid = model.get_value(treeiter, 0)
            settingContainer = XletSettings.XletSetting(uuid, self, self.collection_type)
            self.content_box.pack_start(settingContainer.content, True, True, 2)
            self.notebook.hide()
            settingContainer.show()

    def _external_configure_launch(self, widget):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            app = model.get_value(treeiter, 8)
            if app is not None:
                subprocess.Popen([app])

    def _close_configure(self, settingContainer):
        settingContainer.content.hide()
        self.notebook.show_all()

    def _restore_default_extensions(self):
        os.system(('gsettings reset org.cinnamon next-%s-id') % (self.collection_type))
        os.system(('gsettings reset org.cinnamon enabled-%ss') % (self.collection_type))
    
    def load_extensions(self):
        self.model.clear()
        self.load_extensions_in(('/usr/share/cinnamon/%ss') % (self.collection_type))
        self.load_extensions_in(('%s/.local/share/cinnamon/%ss') % (home, self.collection_type))

    def load_extensions_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            extensions = os.listdir(directory)
            extensions.sort()
            for extension in extensions:
                try:           
                    if os.path.exists("%s/%s/metadata.json" % (directory, extension)):
                        json_data=open("%s/%s/metadata.json" % (directory, extension)).read()
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

                        try: ext_config_app = os.path.join(directory, extension, data["external-configuration-app"])
                        except KeyError: ext_config_app = ""
                        except ValueError: ext_config_app = ""

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
                                    img = theme.load_icon(extension_icon, 32, 0)
                            elif os.path.exists("%s/%s/icon.png" % (directory, extension)):
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("%s/%s/icon.png" % (directory, extension), 32, 32)                            
                            
                            if img is None:                                                
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size( ("/usr/lib/cinnamon-settings/data/icons/%ss.svg") % (self.collection_type), 32, 32)
                                
                            self.model.set_value(iter, 4, img)
                            self.model.set_value(iter, 5, extension_name)
                            self.model.set_value(iter, 6, os.access(directory, os.W_OK))
                            self.model.set_value(iter, 7, hide_config_button)
                            self.model.set_value(iter, 8, ext_config_app)

                except Exception, detail:
                    print "Failed to load extension %s: %s" % (extension, detail)

    def show_prompt(self, msg):
        dialog = Gtk.MessageDialog(None,
                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                    Gtk.MessageType.QUESTION,
                    Gtk.ButtonsType.YES_NO,
                    None)
        dialog.set_default_size(400, 200)
        dialog.set_markup(msg)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
        return response == Gtk.ResponseType.YES
                            
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if checked == 0:
                self._add_another_instance_iter(iter)
                return
            
            if (checked > 1):
                msg = _("There are multiple instances of this %s, do you want to remove them all?\n\n") % (self.collection_type)
                msg += self.RemoveString

                if self.show_prompt(msg) == False:
                    return
            self.model.set_value(iter, 2, 0)
            newExtensions = []
            for enabled_extension in self.enabled_extensions:
                if uuid not in enabled_extension:
                    newExtensions.append(enabled_extension)
            self.enabled_extensions = newExtensions
            self.settings.set_strv(("enabled-%ss") % (self.collection_type), self.enabled_extensions)
    
    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)
        if (checked > 0):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)
