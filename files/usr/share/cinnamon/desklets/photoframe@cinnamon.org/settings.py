#!/usr/bin/python

from gi.repository import Gtk, Gio, GLib, GObject
import sys
import gettext
gettext.install("cinnamon", "/usr/share/cinnamon/locale")

SCHEMA="org.cinnamon.desklets.photoframe"

class DeskletSettings:
    def __init__(self, schema, ID):
        self.schema = schema
        self.ID = ID
        self._settings = Gio.Settings.new(schema)

    def connect(self, signal, callback): # Wrapper function
        self._settings.connect(signal, callback)

    def get_string(self, key):
        variant = self._settings.get_value(key)
        dictionary = variant.lookup_value(self.ID, None)
        if dictionary:
            return dictionary.unpack()
        return ""

    def set_string(self, key, value):
        variant = self._settings.get_value(key)
        array = variant.unpack()

        array[self.ID] = value
        newVariant = GLib.Variant("a{ss}", array)
        self._settings.set_value(key, newVariant)

    def get_boolean(self, key):
        variant = self._settings.get_value(key)
        dictionary = variant.lookup_value(self.ID, None)
        if dictionary:
            return dictionary.unpack()
        return False

    def set_boolean(self, key, value):
        variant = self._settings.get_value(key)
        array = variant.unpack()

        array[self.ID] = value
        newVariant = GLib.Variant("a{sb}", array)
        self._settings.set_value(key, newVariant)

    def get_int(self, key):
        variant = self._settings.get_value(key)
        dictionary = variant.lookup_value(self.ID, None)
        if dictionary:
            return dictionary.unpack()
        return 0

    def set_int(self, key, value):
        variant = self._settings.get_value(key)
        array = variant.unpack()

        array[self.ID] = value
        newVariant = GLib.Variant("a{si}", array)
        self._settings.set_value(key, newVariant)

class GSettingsEntry(Gtk.HBox):    
    def __init__(self, label, schema, key, ID):
        self.key = key
        super(GSettingsEntry, self).__init__()
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.Entry()
        self.pack_start(self.label, False, False, 5)        
        self.add(self.content_widget)     
        self.settings = DeskletSettings(schema, ID)
        self.content_widget.set_text(self.settings.get_string(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('focus-out-event', self.on_my_value_changed)     
        self.content_widget.show_all()

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_text(self.settings.get_string(self.key))

    def on_my_value_changed(self, event, widget):        
        self.settings.set_string(self.key, self.content_widget.get_text())

class GSettingsCheckButton(Gtk.CheckButton):
    def __init__(self, label, schema, key, ID):
        self.key = key
        super(GSettingsCheckButton, self).__init__(label)
        self.settings = DeskletSettings(schema, ID)
        self.set_active(self.settings.get_boolean(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.connectorId = self.connect('toggled', self.on_my_value_changed)

    def on_my_setting_changed(self, settings, key):
        self.set_active(self.settings.get_boolean(self.key))

    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.get_active())

class GSettingsIntComboBox(Gtk.HBox):
    def __init__(self, label, schema, key, options, ID):
        self.key = key
        super(GSettingsIntComboBox, self).__init__()
        self.settings = DeskletSettings(schema, ID)
        self.value = self.settings.get_int(self.key)

        self.label = Gtk.Label(label)
        self.model = Gtk.ListStore(int, str)
        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])
            self.model.set_value(iter, 1, option[1])
            if (option[0] == self.value):
                selected = iter

        self.content_widget = Gtk.ComboBox.new_with_model(self.model)
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)

        if selected is not None:
            self.content_widget.set_active_iter(selected)

        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, True, True, 2)
        self.content_widget.connect('changed', self.on_my_value_changed)
        self.content_widget.show_all()

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            value = self.model[tree_iter][0]
            self.settings.set_int(self.key, value)

class GSettingsComboBox(Gtk.HBox):
    def __init__(self, label, schema, key, options, ID):
        self.key = key
        super(GSettingsComboBox, self).__init__()
        self.settings = DeskletSettings(schema, ID)
        self.value = self.settings.get_string(self.key)

        self.label = Gtk.Label(label)
        self.model = Gtk.ListStore(str, str)
        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])
            self.model.set_value(iter, 1, option[1])
            if (option[0] == self.value):
                selected = iter

        self.content_widget = Gtk.ComboBox.new_with_model(self.model)
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)

        if selected is not None:
            self.content_widget.set_active_iter(selected)

        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, True, True, 2)
        self.content_widget.connect('changed', self.on_my_value_changed)
        self.content_widget.show_all()

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            value = self.model[tree_iter][0]
            self.settings.set_string(self.key, value)

class GSettingsSpinButton(Gtk.HBox):
    def __init__(self, label, schema, key, min, max, step, page, ID):
        self.key = key
        super(GSettingsSpinButton, self).__init__()
        self.label = Gtk.Label(label)
        self.content_widget = Gtk.SpinButton()
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, True, True, 2)

        self.content_widget.set_range(min, max)
        self.content_widget.set_increments(step, page)
        #self.content_widget.set_editable(False)
        self.settings = DeskletSettings(schema, ID)
        self.content_widget.set_value(self.settings.get_int(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self._value_changed_timer = None

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.settings.get_int(self.key))

    def on_my_value_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(300, self.update_settings_value)

    def update_settings_value(self):
        self.settings.set_int(self.key, self.content_widget.get_value())
        self._value_changed_timer = None
        return False

class MainWindow:
    def __init__(self, desklet_id):
        self.window = Gtk.Window()

        self.window.set_title(_("Photo Frame Desklet Settings"))

        self.content_box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        self.window.add(self.content_box)

        effects_combo = [["color", _("Color")], ["sepia", _("Sepia")], ["black-and-white", _("Black and White")]]
        quality_combo = [[0, _("Fast")], [1, _("Regular")], [2, _("Fine")]]

        self.content_box.pack_start(GSettingsSpinButton(_("Height of photo:"), SCHEMA, "height", 0, 5000, 1, 10, desklet_id), True, False, 0)
        self.content_box.pack_start(GSettingsSpinButton(_("Width of photo:"), SCHEMA, "width", 0, 5000, 1, 10, desklet_id), True, False, 0)
        self.content_box.pack_start(GSettingsSpinButton(_("Time each photo is displayed: (s)"), SCHEMA, "delay", 1, 120, 1, 5, desklet_id), True, False, 0)
        self.content_box.pack_start(GSettingsSpinButton(_("Transition time between photos: (ms)"), SCHEMA, "fade-delay", 0, 2000, 50, 200, desklet_id), True, False, 0)
        self.content_box.pack_start(GSettingsComboBox(_("Display effect of the photos:"), SCHEMA, "effect", effects_combo, desklet_id), True, False, 0)
        self.content_box.pack_start(GSettingsIntComboBox(_("Display quality of the photos:"), SCHEMA, "quality", quality_combo, desklet_id), True, False, 0)
        self.content_box.pack_start(GSettingsCheckButton(_("Shuffle photos:"), SCHEMA, "shuffle", desklet_id), True, False, 0)
        self.content_box.pack_start(GSettingsEntry(_("Directory photos are located in:"), SCHEMA, "directory", desklet_id), True, False, 0)

        self.window.show_all()
        self.window.connect("destroy", Gtk.main_quit)
        Gtk.main()

if __name__ == "__main__":
    MainWindow(sys.argv[1])
