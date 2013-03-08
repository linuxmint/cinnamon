#!/usr/bin/env python

import sys

try:
    import os
    import glob
    import gettext
    import json
    import collections
    import XletSettingsWidgets
    import dbus
    from gi.repository import Gio, Gtk, GObject, GdkPixbuf
except Exception, detail:
    print detail
    sys.exit(1)

home = os.path.expanduser("~")

class XletSetting:

    def __init__(self, uuid, parent, _type):
        self.session_bus = dbus.SessionBus()
        self.parent = parent
        self.type = _type
        self.current_id = None
        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/bin/xlet-settings.ui")
        self.content = self.builder.get_object("content")
        self.back_to_list_button = self.builder.get_object("back_to_list")
        self.highlight_button = self.builder.get_object("highlight_button")
        self.more_button = self.builder.get_object("more_button")
        self.remove_button = self.builder.get_object("remove_xlet")
        self.uuid = uuid
        self.content.connect("hide", self.on_hide)

        self.applet_meta = {}
        self.applet_settings = collections.OrderedDict()
        self.setting_factories = collections.OrderedDict()
        self.load_applet_data (self.uuid)
        if "icon" in self.applet_meta:
            image = Gtk.Image().new_from_icon_name(self.applet_meta["icon"], Gtk.IconSize.BUTTON)
            self.back_to_list_button.set_image(image)
            self.back_to_list_button.get_property('image').set_padding(5, 0)
        self.back_to_list_button.set_label(self.applet_meta["name"])
        self.back_to_list_button.set_tooltip_text(_("Back to list"))
        self.more_button.set_tooltip_text(_("More actions..."))
        self.remove_button.set_tooltip_text(_("Remove the current instance of this %s") % self.type)
        self.highlight_button.set_tooltip_text(_("Momentarily highlight the %s on your desktop") % self.type)
        if len(self.applet_settings.keys()) > 1:
            self.build_notebook()
        else:
            self.build_single()
        self.back_to_list_button.connect("clicked", self.on_back_to_list_button_clicked)
        if self.type != "extension":
            self.highlight_button.connect("clicked", self.on_highlight_button_clicked)
            self.highlight_button.show()
        else:
            self.highlight_button.hide()
        self.more_button.connect("clicked", self.on_more_button_clicked)
        self.remove_button.connect("clicked", self.on_remove_button_clicked)

    def show (self):
        self.content.show_all()
        try:
            self.back_to_list_button.get_property('image').show()
        except:
            pass

    def on_hide (self, widget):
        self.content.hide()
        self.content.destroy()
        self.applet_meta = None
        self.applet_settings = None
        for _id in self.setting_factories.keys():
            self.setting_factories[_id].pause_monitor()
        self.setting_factories = None

    def load_applet_data (self, uuid):
        found = self.get_meta_data_for_applet("/usr/share/cinnamon/%ss/%s" % (self.type, uuid))
        if not found:
            found = self.get_meta_data_for_applet("%s/.local/share/cinnamon/%ss/%s" % (home, self.type, uuid))
        if not found:
            print(_("Could not find %s metadata - are you sure it's installed correctly?") % self.type)
            return
        found = self.get_settings_for_applet("%s/.cinnamon/configs/%s" % (home, uuid))
        if not found:
            print(_("Could not find any instance settings data for this %s - are you sure it is loaded, and supports settings?") % self.type)

    def get_meta_data_for_applet(self, path):
        if os.path.exists(path) and os.path.isdir(path):
            if os.path.exists("%s/metadata.json" % path):
                raw_data = open("%s/metadata.json" % path).read()
                self.applet_meta = json.loads(raw_data)
                return True
        return False

    def get_settings_for_applet(self, path):
        if "max-instances" in self.applet_meta:
            self.multi_instance = int(self.applet_meta["max-instances"]) > 1
        else:
            self.multi_instance = False
        if os.path.exists(path) and os.path.isdir(path):
            instances = os.listdir(path)
            if len(instances) != 0:
                for instance in instances:
                    raw_data = open("%s/%s" % (path, instance)).read()
                    try:
                        js = json.loads(raw_data, object_pairs_hook=collections.OrderedDict)
                    except:
                        raise Exception(_("Failed to parse settings JSON data for %s %s") % (self.type, self.uuid))
                    instance_id = instance.split(".json")[0]
                    self.applet_settings[instance_id] = js
                    self.setting_factories[instance_id] = XletSettingsWidgets.Factory("%s/%s" % (path, instance), instance_id, self.multi_instance)
                return True
            else:
                raise Exception(_("Could not find any active setting files for %s %s") % (self.type, self.uuid))
        return False

    def build_single(self):
        self.nb = None
        self.view = Gtk.ScrolledWindow()
        self.view.set_shadow_type(Gtk.ShadowType.IN)
        self.content_box = Gtk.VBox()
        self.view.add_with_viewport(self.content_box)
        self.content_box.set_border_width(5)

        for instance_key in self.applet_settings.keys():
            for setting_key in self.applet_settings[instance_key].keys():
                if setting_key == "__md5__" or self.applet_settings[instance_key][setting_key]["type"] == "generic":
                    continue
                self.setting_factories[instance_key].create(setting_key,
                                                            self.applet_settings[instance_key][setting_key]["type"],
                                                            self.uuid)
            widgets = self.setting_factories[instance_key].widgets
            for widget_key in widgets.keys():
                if widgets[widget_key].get_indented():
                    indent = XletSettingsWidgets.IndentedHBox()
                    indent.add_fill(widgets[widget_key])
                    self.content_box.pack_start(indent, False, False, 2)
                else:
                    self.content_box.pack_start(widgets[widget_key], False, False, 2)
                if len(widgets[widget_key].dependents) > 0:
                    widgets[widget_key].update_dependents()
        self.content.pack_start(self.view, True, True, 2)
        self.current_id = instance_key

    def build_notebook(self):
        self.nb = Gtk.Notebook()
        i = 1
        for instance_key in self.applet_settings.keys():

            view = Gtk.ScrolledWindow()
            content_box = Gtk.VBox()
            view.add_with_viewport(content_box)
            content_box.set_border_width(5)
            for setting_key in self.applet_settings[instance_key].keys():
                if setting_key == "__md5__" or self.applet_settings[instance_key][setting_key]["type"] == "generic":
                    continue
                self.setting_factories[instance_key].create(setting_key,
                                                            self.applet_settings[instance_key][setting_key]["type"],
                                                            self.uuid)
            widgets = self.setting_factories[instance_key].widgets
            for widget_key in widgets.keys():
                if widgets[widget_key].get_indented():
                    indent = XletSettingsWidgets.IndentedHBox()
                    indent.add_fill(widgets[widget_key])
                    content_box.pack_start(indent, False, False, 2)
                else:
                    content_box.pack_start(widgets[widget_key], False, False, 2)
                if len(widgets[widget_key].dependents) > 0:
                    widgets[widget_key].update_dependents()
            self.nb.append_page(view, Gtk.Label(_("Instance %s") % i))
            view.key = instance_key
            i += 1

        self.content.pack_start(self.nb, True, True, 2)
        self.nb.set_scrollable(True)
        self.nb.connect("switch-page", self.on_page_changed)

    def on_page_changed(self, nb, page, num):
        self.current_id = page.key

    def on_highlight_button_clicked(self, widget):
        cinnamon_dbus = self.session_bus.get_object("org.Cinnamon", "/org/Cinnamon")
        highlight_applet = cinnamon_dbus.get_dbus_method('highlightApplet', 'org.Cinnamon')
        highlight_applet(self.current_id, self.multi_instance)

    def on_back_to_list_button_clicked(self, widget):
        self.parent._close_configure(self)

    def on_remove_button_clicked(self, widget):
        settings = Gio.Settings.new("org.cinnamon")
        if self.type == "applet":
            enabled_xlets = settings.get_strv("enabled-applets")
        elif self.type == "desklet":
            enabled_xlets = settings.get_strv("enabled-desklets")
        elif self.type == "extension":
            enabled_xlets = settings.get_strv("enabled-extensions")
        else:
            return
        new_enabled = []
        for xlet in enabled_xlets:
            if self.uuid not in xlet:
                new_enabled.append(xlet)
            elif self.multi_instance and self.current_id not in xlet:
                new_enabled.append(xlet)

        if self.nb is None or (self.nb is not None and self.nb.get_n_pages() == 1):
            self.parent._close_configure(self)
        else:
            current_index = self.nb.get_current_page()
            tab = self.nb.get_nth_page(current_index)
            self.setting_factories[self.current_id].pause_monitor()
            self.nb.remove_page(current_index)
            tab.destroy()
            self.nb.set_current_page(0)

        if self.type == "applet":
            settings.set_strv("enabled-applets", new_enabled)
        elif self.type == "desklet":
            settings.set_strv("enabled-desklets", new_enabled)
        elif self.type == "extension":
            settings.set_strv("enabled-extensions", new_enabled)


    def on_more_button_clicked(self, widget):
        popup = Gtk.Menu()
        popup.attach_to_widget(widget, None)

        reset_option = Gtk.MenuItem(_("Reset to defaults"))
        popup.append(reset_option)
        reset_option.connect("activate", self.on_reset_defaults)
        reset_option.show()

        import_option = Gtk.MenuItem(_("Import from a file"))
        popup.append(import_option)
        import_option.connect("activate", self.on_import)
        import_option.show()

        export_option = Gtk.MenuItem(_("Export to a file"))
        popup.append(export_option)
        export_option.connect("activate", self.on_export)
        export_option.show()

        popup.popup(None, None, None, None, 0, 0)

    def on_reset_defaults(self, popup):
        self.setting_factories[self.current_id].reset_to_defaults()

    def on_import(self, popup):
        dialog = Gtk.FileChooserDialog(_("Select a JSON file to import"),
                                       None,
                                       Gtk.FileChooserAction.OPEN,
                                      (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                       Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
        filter_text = Gtk.FileFilter()
        filter_text.add_pattern("*.json")
        filter_text.set_name(_("JSON files"))
        dialog.add_filter(filter_text)

        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.setting_factories[self.current_id].load_from_file(filename)

        dialog.destroy()

    def on_export(self, popup):
        dialog = Gtk.FileChooserDialog(_("Select or enter file to export to"),
                                       None,
                                       Gtk.FileChooserAction.SAVE,
                                      (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                       Gtk.STOCK_SAVE, Gtk.ResponseType.ACCEPT))
        dialog.set_do_overwrite_confirmation(True)
        filter_text = Gtk.FileFilter()
        filter_text.add_pattern("*.json")
        filter_text.set_name(_("JSON files"))
        dialog.add_filter(filter_text)

        response = dialog.run()

        if response == Gtk.ResponseType.ACCEPT:
            filename = dialog.get_filename()
            if ".json" not in filename:
                filename = filename + ".json"
            self.setting_factories[self.current_id].export_to_file(filename)

        dialog.destroy()