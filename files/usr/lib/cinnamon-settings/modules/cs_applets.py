#!/usr/bin/env python

import settings
import os
from settings import *
from gi.repository import Gio, Gtk, GObject, Gdk
import dbus

class Module:
    def __init__(self, content_box):
        sidePage = AppletViewSidePage(_("Applets"), "applets.svg", content_box)
        self.sidePage = sidePage

class AppletViewSidePage (SidePage):
    def __init__(self, name, icon, content_box):
        SidePage.__init__(self, name, icon, content_box)
        self.icons = []

        self.search_entry = Gtk.Entry()
        self.search_entry.connect('changed', lambda y: self.model.clear()
                                  or self.load_applets_in('/usr/share/cinnamon/applets')
                                  or self.load_applets_in('%s/.local/share/cinnamon/applets' % home) )

    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        scrolledWindow = Gtk.ScrolledWindow()
        treeview = Gtk.TreeView()

        cr = Gtk.CellRendererToggle()
        cr.connect("toggled", self.toggled, treeview)
        column1 = Gtk.TreeViewColumn(_("Enable"), cr)
        column1.set_cell_data_func(cr, self.celldatafunction_checkbox)
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("Icon"), Gtk.CellRendererPixbuf(), pixbuf=3)
        column2.set_resizable(True)

        column3 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)
        column3.set_resizable(True)

        treeview.append_column(column1)
        treeview.append_column(column2)
        treeview.append_column(column3)
        treeview.set_headers_visible(False)

        self.model = Gtk.TreeStore(str, str, bool, GdkPixbuf.Pixbuf)
        #                          uuid, name, enabled, icon
        self.model.set_sort_column_id(1, Gtk.SortType.ASCENDING)
        treeview.set_model(self.model)

        # Find the enabled applets
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_applets = self.settings.get_strv("enabled-applets")

        self.load_applets_in('/usr/share/cinnamon/applets')
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)

        scrolledWindow.add(treeview)
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)

        button = Gtk.Button(_("Restore to default"))
        button.connect("clicked", lambda x: self._restore_default_applets())

        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/applets")
        link.set_label(_("Get new applets"))

        self.content_box.pack_start(self.search_entry, False, False, 2)
        self.content_box.add(scrolledWindow)
        self.content_box.pack_start(button, False, False, 2)
        self.content_box.pack_start(link, False, False, 2)

        self.content_box.show_all()

    def _restore_default_applets(self):
        os.system('gsettings reset org.cinnamon enabled-applets')
        self.enabled_applets = self.settings.get_strv("enabled-applets")

        self.model.clear()

        self.load_applets_in('/usr/share/cinnamon/applets')
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)

    def load_applets_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            applets = os.listdir(directory)
            applets.sort()
            for applet in applets:
                try:
                    if os.path.exists("%s/%s/metadata.json" % (directory, applet)):
                        json_data=open("%s/%s/metadata.json" % (directory, applet)).read()
                        data = json.loads(json_data)
                        applet_uuid = data["uuid"]
                        applet_name = data["name"]
                        applet_description = data["description"]

                        if self.search_entry.get_text().upper() in (applet_name + applet_description).upper():
                            iter = self.model.insert_before(None, None)
                            found = False
                            for enabled_applet in self.enabled_applets:
                                if applet_uuid in enabled_applet:
                                    found = True
                                    break

                            self.model.set_value(iter, 0, applet_uuid)
                            self.model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (applet_name, applet_uuid, applet_description))
                            self.model.set_value(iter, 2, found)
                            img = None
                            if "icon" in data:
                                applet_icon = data["icon"]
                                theme = Gtk.IconTheme.get_default()
                                if theme.has_icon(applet_icon):
                                    img = theme.load_icon(applet_icon, 32, 0)
                            elif os.path.exists("%s/%s/icon.png" % (directory, applet)):
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("%s/%s/icon.png" % (directory, applet), 32, 32)

                            if img is None:
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/lib/cinnamon-settings/data/icons/applets.svg", 32, 32)

                            self.model.set_value(iter, 3, img)
                except Exception, detail:
                    print "Failed to load applet %s: %s" % (applet, detail)

    def toggled(self, renderer, path, treeview):
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if (checked):
                self.model.set_value(iter, 2, False)
                for enabled_applet in self.enabled_applets:
                    if uuid in enabled_applet:
                        self.enabled_applets.remove(enabled_applet)
            else:
                self.model.set_value(iter, 2, True)
                self.enabled_applets.append("panel1:right:0:%s" % uuid)

            self.settings.set_strv("enabled-applets", self.enabled_applets)

    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)
        if (checked):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)