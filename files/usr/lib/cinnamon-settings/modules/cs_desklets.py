#!/usr/bin/env python

from SettingsWidgets import *
import os
import os.path
from gi.repository import Gio, Gtk, GObject, Gdk

home = os.path.expanduser("~")

CINNAMON_SPICES_WEBSITE_LINK = "http://cinnamon-spices.linuxmint.com/"

class Module:
    def __init__(self, content_box):
        keywords = _("desklets, desktop, applet, slideshow, background")
        advanced = False
        sidePage = DeskletsViewSidePage(_("Desklets"), "desklets.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "desklets"
        self.category = "prefs"

class DeskletsViewSidePage (SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box)
        self.active_desklet_path = None

        self.settings = Gio.Settings.new("org.cinnamon")
        self.settings.connect('changed::enabled-desklets', self.on_settings_changed)

    def build(self, advanced):
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        # Update enabled desklets list
        self.enabled_desklets = self.settings.get_strv("enabled-desklets")

        # Add our own widgets
        notebook = Gtk.Notebook()
        desklets_vbox = Gtk.VBox()

        scrolled_window = Gtk.ScrolledWindow()
        config_vbox = Gtk.VBox()
        scrolled_window.add_with_viewport(config_vbox)
        config_vbox.set_border_width(5)

        notebook.append_page(desklets_vbox, Gtk.Label(_("Select Desklets")))
        notebook.append_page(scrolled_window, Gtk.Label(_("Desklets Settings")))

        # Construct "Select Desklets"
        self.search_entry = Gtk.Entry()
        self.search_entry.connect('changed', lambda y: self.model.clear()
                                  or self.load_desklets_in('/usr/share/cinnamon/desklets')
                                  or self.load_desklets_in('%s/.local/share/cinnamon/desklets' % home) )

        scrolled_window = Gtk.ScrolledWindow()

        # Define buttons box
        actions_hbox = Gtk.HBox()
        actions_hbox.set_homogeneous(True)
        actions_hbox.set_spacing(5)

        self.uninstall_button = Gtk.Button(_("Uninstall this desklet"))
        self.uninstall_button.set_sensitive(False)
        self.uninstall_button.connect('released', self.query_uninstall)

        self.change_state_button = Gtk.Button(_("Add this desklet"))
        self.change_state_button.set_sensitive(False)
        self.change_state_button.connect('released', self.change_desklet_state)

        actions_hbox.pack_start(self.uninstall_button, True, True, 0)
        actions_hbox.pack_start(self.change_state_button, True, True, 0)

        link = Gtk.LinkButton(CINNAMON_SPICES_WEBSITE_LINK + "desklets")

        desklets_vbox.pack_start(self.search_entry, False, False, 2)
        desklets_vbox.pack_start(scrolled_window, True, True, 2)
        desklets_vbox.pack_start(actions_hbox, False, False, 2)
        desklets_vbox.pack_start(link, False, False, 2)

        self.iconView = Gtk.IconView()
        self.iconView.set_columns(3)
        self.iconView.set_item_padding(2)
        self.iconView.set_row_spacing(2)
        self.model = Gtk.ListStore(str, str, GdkPixbuf.Pixbuf, str, str)
        #                         uuid description thumbnail name directory

        self.load_desklets_in('/usr/share/cinnamon/desklets')
        self.load_desklets_in('%s/.local/share/cinnamon/desklets' % home)

        self.iconView.set_markup_column(1)
        self.iconView.set_pixbuf_column(2)
        self.iconView.set_model(self.model)

        if (self.active_desklet_path is not None):
            self.iconView.select_path(self.active_desklet_path)
            self.update_button(self.iconView)

        self.iconView.connect("selection_changed", self.update_button)
        scrolled_window.add(self.iconView)
        scrolled_window.set_shadow_type(Gtk.ShadowType.IN)

        link.set_label(_("Get new desklets"))

        # Construct "Desklets Settings"
        
        dec = [[0, _("No decoration")], [1, _("Border only")], [2, _("Border and header")]]
        dec_combo = GSettingsIntComboBox(_("Decoration of desklets"), "org.cinnamon", "desklet-decorations", dec)

        label = Gtk.Label()
        label.set_markup("<i><small>%s\n%s</small></i>" % (_("Note: Some desklets require the border/header to be always preset"), _("Such requirements override the settings selected here")))
        config_vbox.pack_start(dec_combo, False, False, 2)
        config_vbox.pack_start(label, False, False, 2)

        # Show widgets
        self.content_box.add(notebook)
        self.content_box.show_all()

    def load_desklets_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            desklets = os.listdir(directory)
            desklets.sort()
            for desklet in desklets:
                try:
                    if os.path.exists("%s/%s/metadata.json" % (directory, desklet)):
                        json_data=open("%s/%s/metadata.json" % (directory, desklet)).read()
                        data = json.loads(json_data)
                        desklet_uuid = data["uuid"]
                        desklet_name = data["name"]
                        desklet_description = data["description"]

                        if self.search_entry.get_text().upper() in (desklet_name + desklet_description).upper():
                            titer = self.model.insert_before(None, None)

                            self.model.set_value(titer, 0, desklet_uuid)
                            self.model.set_value(titer, 1, '%s\n<i><span foreground="#333333" size="xx-small">%s</span></i>' % (desklet_name, desklet_uuid))

                            thumbnail = None
                            if os.path.exists("%s/%s/thumbnail.png" % (directory, desklet)):
                                thumbnail = GdkPixbuf.Pixbuf.new_from_file_at_size("%s/%s/thumbnail.png" % (directory, desklet), 85, 85)
                            if thumbnail is None:
                                thumbnail = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/lib/cinnamon-settings/data/icons/desklets.svg", 85, 85)

                            self.model.set_value(titer, 2, thumbnail)

                            self.model.set_value(titer, 3, desklet_name)
                            self.model.set_value(titer, 4, directory)

                except Exception, detail:
                    print "Failed to load desklet %s: %s" % (desklet, detail)

    def update_button(self, iconView):
        selected_items = iconView.get_selected_items()
        if len(selected_items)>0:
            path = selected_items[0]
            iterator = self.model.get_iter(path)
            self.change_state_button.set_sensitive(True)
            self.uninstall_button.set_sensitive(True)
        else:
            self.change_state_button.set_sensitive(False)
            self.uninstall_button.set_sensitive(False)

    def change_desklet_state(self, button):
        selected_items = self.iconView.get_selected_items()
        path = selected_items[0]
        iterator = self.model.get_iter(path)
        self.active_desklet_path = path
        uuid = self.model.get_value(iterator, 0)

        # Find the smallest possible id
        i = self.settings.get_int("next-desklet-id")
        self.settings.set_int("next-desklet-id", i+1);

        # Write settings
        self.enabled_desklets.append("%s:%s:0:0" % (uuid, i))
        self.settings.set_strv('enabled-desklets', self.enabled_desklets)

    def query_uninstall(self, button):
        selected_items = self.iconView.get_selected_items()
        path = selected_items[0]
        iterator = self.model.get_iter(path)
        self.active_desklet_path = None
        uuid = self.model.get_value(iterator, 0)
        name = self.model.get_value(iterator, 3)
        directory = self.model.get_value(iterator, 4)

        dialog = Gtk.Dialog(_("Uninstall " + name),
                            self.content_box.get_window(),
                            Gtk.DialogFlags.MODAL | Gtk.DialogFlags.DESTROY_WITH_PARENT)
        dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
        dialog.add_button(Gtk.STOCK_OK, Gtk.ResponseType.YES)

        content_area = dialog.get_content_area()
        label = Gtk.Label(_("Are you sure you want to uninstall") + name + _("?"))
        content_area.add(label)
        dialog.show_all()
        response = dialog.run()
        if response == Gtk.ResponseType.YES:
            try:
                shutil.rmtree(directory + "/" + uuid)
                self.remove_desklet(uuid)
            except Exception, details:
                print "Failed to uninstall desklet %s: %s" % (uuid, details)

        dialog.destroy()

    def remove_desklet(self, uuid):
        for enabled_desklet in self.enabled_desklets:
            if uuid in enabled_desklet:
                self.enabled_desklets.remove(enabled_desklet)
        self.settings.set_strv('enabled-desklets', self.enabled_desklets)

    def on_settings_changed(self, settings, key):
        self.build()
