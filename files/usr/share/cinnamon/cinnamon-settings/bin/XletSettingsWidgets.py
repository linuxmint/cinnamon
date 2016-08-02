#!/usr/bin/env python2

try:
    import os
    import os.path
    import sys
    import string
    import gettext
    import collections
    import json
    import dbus
    import eyedropper
    import XletSettings
    import tweenEquations
    import math
    import gi
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gio, Gtk, GObject, Gdk, GdkPixbuf
    from KeybindingWidgets import ButtonKeybinding
except Exception, detail:
    print detail
    sys.exit(1)

home = os.path.expanduser("~")

setting_dict = {
    "header"          :   "Header", # Not a setting, just a boldface header text
    "separator"       :   "Separator", # not a setting, a horizontal separator
    "label"           :   "Label", # Not a setting, just a text label
    "entry"           :   "Entry",
    "textview"        :   "TextView",
    "checkbox"        :   "CheckButton",
    "spinbutton"      :   "SpinButton",
    "filechooser"     :   "FileChooser",
    "scale"           :   "Scale",
    "combobox"        :   "ComboBox",
    "colorchooser"    :   "ColorChooser",
    "radiogroup"      :   "RadioGroup",
    "iconfilechooser" :   "IconFileChooser",
    "tween"           :   "Tween",
    "keybinding"      :   "Keybinding",
    "button"          :   "Button" # Not a setting, provides a button which triggers a callback in the applet/desklet
}

class Factory():
    def __init__(self, file_name, instance_id, multi_instance, uuid):
        self.file = file_name
        self.settings = Settings(file_name, self, instance_id, multi_instance, uuid)
        self.widgets = collections.OrderedDict()
        self.file_obj = Gio.File.new_for_path(self.file)
        self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.SEND_MOVED, None)
        self.handler = self.file_monitor.connect("changed", self.on_file_changed)
        self.file_changed_timeout = None
        self.resume_timeout = None

    def create(self, key, setting_type, uuid):
        try:
            self.widgets[key] = eval(setting_dict[setting_type])(key, self.settings, uuid)
        except Exception, detail:
            print ("Invalid setting type '%s' supplied - please check your json file for %s" % (setting_type, uuid))
            print detail

    def on_file_changed(self, file, other, event, data):
        if self.file_changed_timeout:
            GObject.source_remove(self.file_changed_timeout)
        self.file_changed_timeout = GObject.timeout_add(300, self.do_reload)

    def do_reload(self):
        self.settings.reload()
        for key in self.widgets.keys():
            self.widgets[key].on_settings_file_changed()
        self.file_changed_timeout = None
        return False

    def pause_monitor(self):
        self.file_monitor.cancel()
        self.handler = None

    def resume_monitor(self):
        if self.resume_timeout:
            GObject.source_remove(self.resume_timeout)
        self.resume_timeout = GObject.timeout_add(2000, self.do_resume)

    def do_resume(self):
        self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.SEND_MOVED, None)
        self.handler = self.file_monitor.connect("changed", self.on_file_changed)
        self.resume_timeout = None
        return False

    def reset_to_defaults(self):
        self.settings.reset_to_defaults()
        self.on_file_changed(None, None, None, None)

    def export_to_file(self, filename):
        try:
            self.settings.save(filename)
        except Exception, detail:
            warning = Gtk.MessageDialog(None, 0, Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.OK,
                                        _("Error saving file"))
            warning.format_secondary_text(_("There was a problem exporting the file to the selected location."))
            warning.run()
            warning.destroy()
            print detail

    def load_from_file(self, filename):
        try:
            self.settings.load_from_file(filename)
            self.on_file_changed(None, None, None, None)
        except Exception, detail:
            warning = Gtk.MessageDialog(None, 0, Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.OK,
                                        _("Error importing file"))
            warning.format_secondary_text(_("There was a problem importing the configuration file.\nPlease check that it is a valid JSON file, and is appropriate for this applet/desklet/extension.\nThe original configuration file is unchanged."))
            warning.run()
            warning.destroy()
            print detail

class Settings():
    def __init__(self, file_name, factory, instance_id, multi_instance, uuid):
        self.file_name = file_name
        self.factory = factory
        self.instance_id = instance_id
        self.multi_instance = multi_instance
        self.uuid = uuid
        self.reload()

    def reload (self):
        _file = open(self.file_name)
        raw_data = _file.read()
        self.data = {}
        self.data = json.loads(raw_data.decode('utf-8'), object_pairs_hook=collections.OrderedDict)
        _file.close()

    def save (self, name = None):
        if name is None:
            name = self.file_name
        self.factory.pause_monitor()
        if os.path.exists(name):
            os.remove(name)
        raw_data = json.dumps(self.data, indent=4)
        new_file = open(name, 'w+')
        new_file.write(raw_data)
        self.factory.resume_monitor()

    def get_data(self, key):
        return self.data[key]

    def get_key_exists(self, key):
        return key in self.data.keys()

    def real_update_dbus(self, key):
        self.factory.pause_monitor()
        session_bus = dbus.SessionBus()
        cinnamon_dbus = session_bus.get_object("org.Cinnamon", "/org/Cinnamon")
        setter = cinnamon_dbus.get_dbus_method('updateSetting', 'org.Cinnamon')
        payload = json.dumps(self.data[key])
        setter(self.uuid, self.instance_id, key, payload)
        self.factory.resume_monitor()

    def try_update_dbus(self, key):
        try:
            self.real_update_dbus(key)
        except Exception, e:
            print "Cinnamon not running, falling back to python settings engine: ", e
            self.save()

    def try_update_dbus_foreach(self):
        failed = False
        for key in self.data.keys():
            if "value" in self.data[key] and "default" in self.data[key]:
                try:
                    self.real_update_dbus(key)
                except Exception, e:
                    failed = True;
                    print "Cinnamon not running, falling back to python settings engine: ", e
        if failed:
            self.save()

    def set_value(self, key, val):
        self.data[key]["value"] = val
        self.try_update_dbus(key)

    def get_value(self, key):
        return self.data[key]["value"]

    def set_custom_value(self, key, val):
        self.data[key]["last-custom-value"] = val
        self.try_update_dbus(key)

    def reset_to_defaults(self):
        for key in self.data.keys():
            if "value" in self.data[key] and "default" in self.data[key]:
                self.data[key]["value"] = self.data[key]["default"]
        self.try_update_dbus_foreach()

    def load_from_file(self, filename):
        new_file = open(filename)
        new_raw = new_file.read()
        new_json = json.loads(new_raw.decode('utf-8'), object_pairs_hook=collections.OrderedDict)
        new_file.close()
        copy = self.data
        if copy["__md5__"] != new_json["__md5__"]:
            dialog = Gtk.Dialog(_("Possible incompatible versions"),
                                   None, 0,
                                  (Gtk.STOCK_NO, Gtk.ResponseType.NO,
                                   Gtk.STOCK_YES, Gtk.ResponseType.YES))
            text = Gtk.Label.new(_("The MD5 tags for the file you are trying to import and the existing file do not match.\n"
                             "This means the two files were generated by different versions of this applet, desklet or extension,\n"
                             "or possibly from a different one entirely.  Continuing with this procedure could yield unpredictable results.\n\n"
                             "Are you sure you want to proceed?"))
            box = dialog.get_content_area()
            box.add(text)
            box.show_all()
            response = dialog.run()

            if response == Gtk.ResponseType.NO:
                dialog.destroy()
                return
            dialog.destroy()
        self.data = new_json
        self.save()


class BaseWidget(object):
    def __init__(self, key, settings_obj, uuid):
        self.settings_obj = settings_obj
        self.key = key
        self.uuid = uuid
        self.handler = None
        self.dependents = []
        dep_key = self.get_dependency()
        if dep_key is not None:
            if dep_key in self.settings_obj.factory.widgets:
                self.settings_obj.factory.widgets[dep_key].add_dependent(self.key)
            else:
                print ("Dependency key does not exist for key " + self.key + ".  The dependency MUST come before the dependent.  The UUID is: " + self.uuid)

    def on_settings_file_changed(self):
        pass

    def add_dependent(self, key):
        print ("Can only bind dependency to a CheckButton widget.  Ignoring dependency key.  The UUID is: " + self.uuid)

    def get_dependency(self):
        try:
            return self.settings_obj.get_data(self.key)["dependency"]
        except:
            return None

    def update_dependents(self):
        pass

    def update_dep_state(self, active):
        pass

    def get_data(self):
        try:
            return self.settings_obj.get_data(self.key)
        except:
            print ("Could not find key '%s' in settings data for xlet '%s'" % (self.key, self.uuid))

    def get_desc(self):
        try:
            desc = self.settings_obj.get_data(self.key)["description"]
            return XletSettings.translate(self.uuid, desc)
        except:
            print ("Could not find description for key '%s' in xlet '%s'" % (self.key, self.uuid))
            return ""

    def get_tooltip(self):
        try:
            tt = self.settings_obj.get_data(self.key)["tooltip"]
            return XletSettings.translate(self.uuid, tt)
        except:
            return ""

    def get_units(self):
        try:
            units = self.settings_obj.get_data(self.key)["units"]
            return XletSettings.translate(self.uuid, units)
        except:
            print ("Could not find units for key '%s' in xlet '%s'" % (self.key, self.uuid))
            return ""

    def get_val(self):
        try:
            return self.settings_obj.get_data(self.key)["value"]
        except:
            print ("Could not find current value for key '%s' in xlet '%s'" % (self.key, self.uuid))
            return ""

    def get_min(self):
        try:
            return self.settings_obj.get_data(self.key)["min"]
        except:
            print ("Could not get minimum value for key '%s' in xlet '%s'" % (self.key, self.uuid))
            return 0

    def get_max(self):
        try:
            return self.settings_obj.get_data(self.key)["max"]
        except:
            print ("Could not get maximum value for key '%s' in xlet '%s'" % (self.key, self.uuid))
            return 1

    def get_step(self):
        try:
            return self.settings_obj.get_data(self.key)["step"]
        except:
            print ("Could not get step amount for key '%s' in xlet '%s'" % (self.key, self.uuid))

    def get_options(self):
        try:
            ret = collections.OrderedDict()
            d = self.settings_obj.get_data(self.key)["options"]
            for key in d:
                ret[XletSettings.translate(self.uuid, key)] = d[key]

            return ret

        except Exception, detail:
            print ("Could not find options for key '%s' in xlet '%s'" % (self.key, self.uuid))
            print detail

    def get_custom_val(self):
        try:
            return self.settings_obj.get_data(self.key)["last-custom-value"]
        except:
            return ""

    def get_select_dir(self):
        try:
            return self.settings_obj.get_data(self.key)["select-dir"]
        except:
            print ("Could not find select-dir field for key '%s' in xlet '%s'" % (self.key, self.uuid))

    def get_callback(self):
        try:
            return self.settings_obj.get_data(self.key)["callback"]
        except:
            print ("Could not find callback field for key '%s' in xlet '%s'" % (self.key, self.uuid))

    def set_val(self, val):
        try:
            self.settings_obj.set_value(self.key, val)
        except Exception, detail:
            print ("Could not set value for key '%s' in xlet '%s'" % (self.key, self.uuid))
            print detail

    def set_custom_val(self, val):
        try:
            self.settings_obj.set_custom_value(self.key, val)
        except:
            print ("Could not set custom value for key '%s' in xlet '%s'" % (self.key, self.uuid))

    def get_instance_id(self):
        return self.settings_obj.instance_id

    def get_multi_instance(self):
        return self.settings_obj.multi_instance

    def get_indented(self):
        try:
            return self.settings_obj.get_data(self.key)["indent"]
        except:
            return False

    def get_height(self):
        try:
            return self.settings_obj.get_data(self.key)["height"]
        except:
            return 200

def set_tt(tt, *widgets):
    for widget in widgets:
        widget.set_tooltip_text(tt)


class IndentedHBox(Gtk.HBox):
    def __init__(self):
        super(IndentedHBox, self).__init__()
        indent = Gtk.Label.new('\t')
        self.pack_start(indent, False, False, 0)

    def add(self, item):
        self.pack_start(item, False, False, 0)

    def add_fill(self, item):
        self.pack_start(item, True, True, 0)

class Header(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Header, self).__init__()
        self.label = Gtk.Label()
        self.label.set_use_markup(True)
        self.label.set_markup("<b>%s</b>" % self.get_desc())
        self.pack_start(self.label, False, False, 2)

class Label(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Label, self).__init__()
        self.label = Gtk.Label()
        self.label.set_use_markup(True)
        self.label.set_markup(self.get_desc())
        self.pack_start(self.label, False, False, 2)

class Separator(Gtk.HSeparator, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Separator, self).__init__()

class CheckButton(Gtk.CheckButton, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(CheckButton, self).__init__(self.get_desc())
        self.set_active(self.get_val())
        self.handler = self.connect('toggled', self.on_my_value_changed)
        set_tt(self.get_tooltip(), self)

    def add_dependent(self, widget):
        self.dependents.append(widget)

    def on_my_value_changed(self, widget):
        self.set_val(self.get_active())
        self.update_dependents()

    def update_dependents(self):
        for dep in self.dependents:
            self.settings_obj.factory.widgets[dep].update_dep_state(self.get_active())

    def on_settings_file_changed(self):
        self.handler_block(self.handler)
        self.set_active(self.get_val())
        self.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.set_sensitive(active)

class SpinButton(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(SpinButton, self).__init__()

        self.label = Gtk.Label.new(self.get_desc())
        self.spinner = Gtk.SpinButton()
        try: # Guess if number is float and set digits to step size decimal places
            self.spinner.set_digits(len(str(self.get_step()).split(".")[1]))
        except:
            pass
        self.units = Gtk.Label.new(self.get_units())

        if self.get_desc() != "":
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.spinner, False, False, 2)
        if self.get_units() != "":
            self.pack_start(self.units, False, False, 2)
        self.spinner.set_range(self.get_min(), self.get_max())
        self.spinner.set_increments(self.get_step(), self.get_step() * 2)
        self.spinner.set_value(self.get_val())
        set_tt(self.get_tooltip(), self.spinner, self.units, self.label)
        self.handler = self.spinner.connect('value-changed', self.on_my_value_changed)
        self._value_changed_timer = None

    def on_my_value_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(100, self.update_settings_value)

    def update_settings_value(self):
        self.set_val(self.spinner.get_value())
        self._value_changed_timer = None
        return False

    def on_settings_file_changed(self):
        self.spinner.handler_block(self.handler)
        self.spinner.set_value(self.get_val())
        self.spinner.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.spinner.set_sensitive(active)

class Entry(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Entry, self).__init__()
        self.label = Gtk.Label.new(self.get_desc())
        self.entry = Gtk.Entry()
        self.pack_start(self.label, False, False, 2)
        self.add(self.entry)
        self.entry.set_text(self.get_val())
        self.handler = self.entry.connect("changed", self.on_my_value_changed)
        set_tt(self.get_tooltip(), self.label, self.entry)
        self._value_changed_timer = None

    def on_my_value_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(100, self.update_settings_value)

    def update_settings_value(self):
        self.set_val(self.entry.get_text())
        self._value_changed_timer = None
        return False

    def on_settings_file_changed(self):
        self.entry.handler_block(self.handler)
        self.entry.set_text(self.get_val())
        self.entry.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.entry.set_sensitive(active)

class TextView(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(TextView, self).__init__()
        self.label = Gtk.Label.new(self.get_desc())
        self.label.set_alignment(xalign=1, yalign=0)
        self.scrolledwindow = Gtk.ScrolledWindow(hadjustment=None, vadjustment=None)
        self.scrolledwindow.set_size_request(width=-1, height=self.get_height())
        self.scrolledwindow.set_policy(hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
                                       vscrollbar_policy=Gtk.PolicyType.AUTOMATIC)
        self.scrolledwindow.set_shadow_type(type=Gtk.ShadowType.ETCHED_IN)
        self.textview = Gtk.TextView()
        self.textview.set_border_width(3)
        self.textview.set_wrap_mode(wrap_mode=Gtk.WrapMode.NONE)
        self.buffer = self.textview.get_buffer()
        self.buffer.set_text(self.get_val())
        self.pack_start(self.label, False, False, 2)
        self.add(self.scrolledwindow)
        self.scrolledwindow.add(self.textview)
        self.handler = self.buffer.connect("changed", self.on_my_value_changed)
        set_tt(self.get_tooltip(), self.label, self.textview)
        self._value_changed_timer = None

    def on_my_value_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(100, self.update_settings_value)

    def update_settings_value(self):
        [start, end] = self.buffer.get_bounds()
        self.set_val(self.buffer.get_text(start, end, False))
        self._value_changed_timer = None
        return False

    def on_settings_file_changed(self):
        self.textview.handler_block(self.handler)
        self.buffer.set_text(self.get_val())
        self.textview.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.textview.set_sensitive(active)

class ColorChooser(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(ColorChooser, self).__init__()
        self.label = Gtk.Label.new(self.get_desc())
        self.chooser = Gtk.ColorButton()
        self.chooser.set_use_alpha(True)
        self.eyedropper = eyedropper.EyeDropper()
        self.pack_start(self.label, False, False, 2)
        self.pack_start(self.chooser, False, False, 2)
        self.pack_start(self.eyedropper, False, False, 2)
        self.eyedropper.connect("color-picked", self.on_eyedropper_picked)
        color = Gdk.RGBA()
        Gdk.RGBA.parse(color, self.get_val())
        self.chooser.set_rgba(color)
        set_tt(self.get_tooltip(), self.label, self.chooser)
        self.handler = self.chooser.connect("color-set", self.on_my_value_changed)

    def on_eyedropper_picked(self, widget, color):
        new = Gdk.RGBA()
        rgba = Gdk.RGBA.parse(new, color)
        self.chooser.set_rgba(new)
        self.set_val(color)

    def on_my_value_changed(self, *args):
        try:
            color = Gdk.RGBA()
            self.chooser.get_rgba(color)
        except TypeError:
            color = self.chooser.get_rgba()
        self.set_val(color.to_string())

    def on_settings_file_changed(self):
        color = Gdk.RGBA()
        Gdk.RGBA.parse(color, self.get_val())
        self.chooser.handler_block(self.handler)
        self.chooser.set_rgba(color)
        self.chooser.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.chooser.set_sensitive(active)

class ComboBox(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(ComboBox, self).__init__()
        self.label = Gtk.Label.new(self.get_desc())
        options = self.get_options()
        for option_name in options.keys():
            if isinstance(options[option_name], basestring):
                self.model = Gtk.ListStore(str, str)
            elif isinstance(options[option_name], int):
                self.model = Gtk.ListStore(str, int)
            elif isinstance(options[option_name], bool):
                self.model = Gtk.ListStore(str, bool)
            else:
                self.model = Gtk.ListStore(str, float)
            break
        selected = None
        for option_name in options.keys():
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option_name)
            self.model.set_value(iter, 1, options[option_name])
            if (options[option_name] == self.get_val()):
                selected = iter
        self.combo = Gtk.ComboBox.new_with_model(self.model)
        self.combo.set_id_column(0)
        renderer_text = Gtk.CellRendererText()
        self.combo.pack_start(renderer_text, True)
        self.combo.add_attribute(renderer_text, "text", 0)
        set_tt(self.get_tooltip(), self.label, self.combo)

        if selected is not None:
            self.combo.set_active_iter(selected)

        if self.get_desc() != "":
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.combo, False, False, 2)
        self.handler = self.combo.connect("changed", self.on_my_value_changed)
        self.combo.show_all()

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.set_val(self.model[tree_iter][1])

    def on_settings_file_changed(self):
        self.combo.handler_block(self.handler)
        options = self.get_options()
        for option_name in options.keys():
            if (options[option_name] == self.get_val()):
                self.combo.set_active_id(option_name)
        self.combo.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.combo.set_sensitive(active)

class RadioGroup(Gtk.VBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(RadioGroup, self).__init__()
        self.label = Gtk.Label.new(self.get_desc())
        self.model = self.get_options()
        self.entry = None
        self.custom_key = None
        self.custom_button = None
        hbox = Gtk.HBox()
        if self.get_desc() != "":
            hbox.pack_start(self.label, False, False, 2)
            self.pack_start(hbox, False, False, 2)
            set_tt(self.get_tooltip(), self.label)
        group = None
        for key in self.model.keys():
            hbox = IndentedHBox()
            if self.model[key] == "custom":
                self.custom_key = key
                if group is None:
                    button = Gtk.RadioButton.new_with_label_from_widget(None, "")
                    group = button
                else:
                    button = Gtk.RadioButton.new_with_label_from_widget(group, "")
                self.custom_button = button
                hbox.add(button)
                self.entry = Gtk.Entry()
                hbox.add(self.entry)
                if self.get_val() == self.get_custom_val():
                    button.set_active(True)
                button.orig_key = key
            else:
                if group is None:
                    button = Gtk.RadioButton.new_with_label_from_widget(None, key)
                    group = button
                else:
                    button = Gtk.RadioButton.new_with_label_from_widget(group, key)
                hbox.add(button)
                if self.get_val() == self.model[key]:
                    button.set_active(True)
                button.orig_key = key

            self.pack_start(hbox, False, False, 2)

        if self.entry is not None:
            self.entry.set_text(self.get_custom_val())
            self.entry.connect("focus-in-event", self.on_custom_focus)
            self.entry.handler = self.entry.connect("changed", self.on_entry_changed)
            set_tt(self.get_tooltip(), self.entry)

        self.group = group.get_group()
        for button in self.group:
            button.handler = button.connect("toggled", self.on_button_activated)
            set_tt(self.get_tooltip(), button)
        self._value_changed_timer = None

    def on_custom_focus(self, event, widget):
        self.custom_button.set_active(True)

    def on_entry_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(300, self.update_custom_settings_value)

    def on_button_activated(self, widget):
        if widget.get_active():
            if widget is self.custom_button:
                self.update_custom_settings_value()
            else:
                self.update_settings_value(widget.orig_key)

    def update_custom_settings_value(self):
        self.set_val(self.entry.get_text())
        self.set_custom_val(self.entry.get_text())
        self._value_changed_timer = None
        return False

    def update_settings_value(self, model_key):
        self.set_val(self.model[model_key])
        if self.entry is not None:
            self.set_custom_val(self.entry.get_text())

    def on_settings_file_changed(self):
        new_val = self.get_val()
        _set = False
        for button in self.group:
            l = button.get_label()
            if l == "":
                l = self.custom_key
            if self.model[l] == new_val:
                button.handler_block(button.handler)
                button.set_active(True)
                button.handler_unblock(button.handler)
                _set = True
        if not _set:
            if self.entry is not None:
                self.custom_button.handler_block(self.custom_button.handler)
                self.entry.handler_block(self.entry.handler)
                self.custom_button.set_active(True)
                self.entry.set_text(new_val)
                self.custom_button.handler_unblock(self.custom_button.handler)
                self.entry.handler_unblock(self.entry.handler)
            else:
                self.custom_button.handler_block(self.custom_button.handler)
                self.custom_button.set_active(True)
                self.custom_button.handler_unblock(self.custom_button.handler)

    def update_dep_state(self, active):
        for button in self.group:
            button.set_sensitive(active)
        if self.entry is not None:
            self.entry.set_sensitive(active)


class FileChooser(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(FileChooser, self).__init__()

        self.label = Gtk.Label.new(self.get_desc())
        self.entry = Gtk.Entry()
        self.button = Gtk.Button("")
        self.button.set_image(Gtk.Image().new_from_stock(Gtk.STOCK_OPEN, Gtk.IconSize.BUTTON))
        self.button.get_property('image').show()
        if self.get_desc() != "":
            self.pack_start(self.label, False, False, 2)

        self.pack_start(self.entry, True, True, 2)
        self.pack_start(self.button, False, False, 5)

        self.entry.set_text(self.get_val())

        self.button.connect("clicked", self.on_button_pressed)
        self.handler = self.entry.connect("changed", self.on_entry_changed)
        self._value_changed_timer = None
        set_tt(self.get_tooltip(), self.label, self.button, self.entry)

    def on_button_pressed(self, widget):
        if self.get_select_dir():
            mode = Gtk.FileChooserAction.SELECT_FOLDER
            string = _("Select a directory to use")
        else:
            mode = Gtk.FileChooserAction.OPEN
            string = _("Select a file")
        dialog = Gtk.FileChooserDialog(string,
                                       None,
                                       mode,
                                       (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                        Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
        if self.get_select_dir():
            filt = Gtk.FileFilter()
            filt.set_name(_("Directories"))
            filt.add_custom(Gtk.FileFilterFlags.FILENAME, self.filter_func, None)
            dialog.add_filter(filt)

        dialog.set_filename(self.get_val())
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.entry.set_text(filename)
            self.set_val(filename)
        dialog.destroy()

    def filter_func(chooser, info, data):
        return os.path.isdir(info.filename)

    def on_entry_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(300, self.update_from_entry)

    def update_from_entry(self):
        self.set_val(self.entry.get_text())
        self._value_changed_timer = None
        return False

    def on_settings_file_changed(self):
        self.entry.handler_block(self.handler)
        self.entry.set_text(self.get_val())
        self.entry.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.entry.set_sensitive(active)
        self.button.set_sensitive(active)


class IconFileChooser(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(IconFileChooser, self).__init__()

        valid, self.width, self.height = Gtk.icon_size_lookup(Gtk.IconSize.BUTTON)

        self.label = Gtk.Label.new(self.get_desc())
        self.entry = Gtk.Entry()
        self.image_button = Gtk.Button()

        if self.get_desc() != "":
            self.pack_start(self.label, False, False, 2)
        self.preview = Gtk.Image.new()

        self.setup_image()

        self.image_button.set_image(self.preview)

        self.pack_start(self.entry, True, True, 2)
        self.pack_start(self.image_button, False, False, 5)
        self.entry.set_text(self.get_val())

        self.image_button.connect("clicked", self.on_button_pressed)
        self.handler = self.entry.connect("changed", self.on_entry_changed)
        self._value_changed_timer = None
        set_tt(self.get_tooltip(), self.label, self.image_button, self.entry)

    def setup_image(self):
        val = self.get_val()
        if os.path.exists(val) and not os.path.isdir(val):
            img = GdkPixbuf.Pixbuf.new_from_file_at_size(val, self.width, self.height)
            self.preview.set_from_pixbuf(img)
        else:
            self.preview.set_from_icon_name(val, Gtk.IconSize.BUTTON)

    def on_button_pressed(self, widget):
        dialog = Gtk.FileChooserDialog(_("Choose an Icon"),
                                           None,
                                           Gtk.FileChooserAction.OPEN,
                                           (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                            Gtk.STOCK_OPEN, Gtk.ResponseType.OK))

        filter_text = Gtk.FileFilter()
        filter_text.set_name(_("Image files"))
        filter_text.add_mime_type("image/*")
        dialog.add_filter(filter_text)

        preview = Gtk.Image()
        dialog.set_preview_widget(preview)
        dialog.connect("update-preview", self.update_icon_preview_cb, preview)

        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.entry.set_text(filename)
            self.set_val(filename)
            self.setup_image()

        dialog.destroy()

    def on_entry_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(100, self.update_from_entry)

    def update_from_entry(self):
        self.set_val(self.entry.get_text())
        self.setup_image()
        self._value_changed_timer = None
        return False

    def on_settings_file_changed(self):
        self.entry.handler_block(self.handler)
        self.entry.set_text(self.get_val())
        self.setup_image()
        self.entry.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.entry.set_sensitive(active)
        self.image_button.set_sensitive(active)

    #Updates the preview widget
    def update_icon_preview_cb(self, dialog, preview):
        filename = dialog.get_preview_filename()
        dialog.set_preview_widget_active(False)
        if os.path.isfile(filename):
            pixbuf = GdkPixbuf.Pixbuf.new_from_file(filename)
            if pixbuf is not None:
                if pixbuf.get_width() > 128:
                    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, 128, -1)
                elif pixbuf.get_height() > 128:
                    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, -1, 128)
                preview.set_from_pixbuf(pixbuf)
                dialog.set_preview_widget_active(True)

class Scale(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Scale, self).__init__()
        self.label = Gtk.Label.new(self.get_desc())
        self.scale = Gtk.HScale.new_with_range(self.get_min(), self.get_max(), self.get_step())
        self.scale.set_value(self.get_val())
        if (self.get_desc() != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.scale, True, True, 2)
        self.handler = self.scale.connect('value-changed', self.on_my_value_changed)
        self.scale.show_all()
        set_tt(self.get_tooltip(), self.label, self.scale)
        self.scale.connect("scroll-event", self.on_mouse_scroll_event)
        self._value_changed_timer = None

# TODO: Should we fix this in GTK? upscrolling should slide the slider to the right..right?
# This is already adjusted in Nemo as well.
    def on_mouse_scroll_event(self, widget, event):
        found, delta_x, delta_y = event.get_scroll_deltas()
        if found:
            add = delta_y < 0
            val = widget.get_value()
            if add:
                val += self.get_step()
            else:
                val -= self.get_step()
            widget.set_value(val)
        return True

    def on_my_value_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(100, self.update_settings_value)

    def update_settings_value(self):
        self.set_val(self.scale.get_value())
        self._value_changed_timer = None
        return False

    def on_settings_file_changed(self):
        self.scale.handler_block(self.handler)
        self.scale.set_value(self.get_val())
        self.scale.handler_unblock(self.handler)

    def update_dep_state(self, active):
        self.scale.set_sensitive(active)

class Tween(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Tween, self).__init__()

        self.label = Gtk.Label.new(self.get_desc())
        if self.get_desc() != "":
            self.pack_start(self.label, False, False, 2)

        self.tween = TweenChooser(self.get_val(), key, settings_obj, uuid)
        set_tt(self.get_tooltip(), self.label, self.tween)
        self.pack_start(self.tween, False, False, 2)

class TweenChooser(Gtk.Button):
    def __init__(self, value, key, settings_obj, uuid):
        super(TweenChooser, self).__init__()

        self.value = value
        self.key = key
        self.settings_obj = settings_obj
        self.uuid = uuid

        self.menu = Gtk.Menu()
        self.connect("button-release-event", self.on_button_clicked)

        self.set_label(self.value)
        self.set_size_request(128, -1)

        self.build_menuitem("None", 0, 0)

        row = 1
        for main in ["Quad", "Cubic", "Quart", "Quint", "Sine", "Expo", "Circ", "Elastic", "Back", "Bounce"]:
            col = 0
            for prefix in ["In", "Out", "InOut", "OutIn"]:
                self.build_menuitem(prefix + main, col, row)
                col += 1
            row += 1

    def build_menuitem(self, name, col, row):
        menuitem = TweenMenuItem("ease" + name)
        menuitem.connect("activate", self.change_value)
        self.menu.attach(menuitem, col, col + 1, row, row + 1)

    def change_value(self, widget):
        self.value = widget.name
        self.set_label(self.value)
        #set value
        try:
            self.settings_obj.set_value(self.key, self.value)
        except Exception, detail:
            print ("Could not set value for key '%s' in xlet '%s'" % (self.key, self.uuid))
            print detail

    #Imports from PictureChooserButton
    def popup_menu_below_button (self, *args):
        # the introspection for GtkMenuPositionFunc seems to change with each Gtk version,
        # this is a workaround to make sure we get the menu and the widget
        menu = args[0]
        widget = args[-1]
        window = widget.get_window()
        screen = window.get_screen()
        monitor = screen.get_monitor_at_window(window)

        warea = screen.get_monitor_workarea(monitor)
        wrect = widget.get_allocation()
        mrect = menu.get_allocation()

        unused_var, window_x, window_y = window.get_origin()

        # Position left edge of the menu with the right edge of the button
        x = window_x + wrect.x + wrect.width
        # Center the menu vertically with respect to the monitor
        y = warea.y + (warea.height / 2) - (mrect.height / 2)

        # Now, check if we're still touching the button - we want the right edge
        # of the button always 100% touching the menu

        if y > (window_y + wrect.y):
            y = y - (y - (window_y + wrect.y))
        elif (y + mrect.height) < (window_y + wrect.y + wrect.height):
            y = y + ((window_y + wrect.y + wrect.height) - (y + mrect.height))

        push_in = True # push_in is True so all menu is always inside screen
        return (x, y, push_in)

    def on_button_clicked(self, widget, event):
        if event.button == 1:
            self.menu.show_all()
            self.menu.popup(None, None, self.popup_menu_below_button, self, event.button, event.time)

class TweenMenuItem(Gtk.MenuItem):
    width = 96
    height = 48

    state = -1
    duration = 50

    timer = None

    def __init__(self, name):
        super(TweenMenuItem, self).__init__()

        self.name = name
        self.function = eval("tweenEquations." + name)

        self.vbox = Gtk.VBox()
        self.add(self.vbox)

        box = Gtk.Box()
        self.vbox.add(box)

        self.graph = Gtk.DrawingArea()
        box.add(self.graph)
        self.graph.set_size_request(self.width, self.height)
        self.graph.connect("draw", self.draw_graph)

        self.arr = Gtk.DrawingArea()
        box.pack_end(self.arr, False, False, 0)
        self.arr.set_size_request(5, self.height)
        self.arr.connect("draw", self.draw_arr)

        self.connect("enter-notify-event", self.start_animation)
        self.connect("leave-notify-event", self.end_animation)

        label = Gtk.Label()
        self.vbox.add(label)
        label.set_text(name)

    def draw_graph(self, widget, ctx):
        width = self.width - 2.
        height = self.height / 8.

        context = widget.get_style_context()
        if self.state == -1:
            c = context.get_background_color(Gtk.StateFlags.SELECTED)
        else:
            c = context.get_color(Gtk.StateFlags.NORMAL)
        ctx.set_source_rgb(c.red, c.green, c.blue)

        ctx.move_to(1, height * 6)
        for i in range(int(width)):
            ctx.line_to(i + 2, self.function(i + 1., height * 6, -height * 4, width))
        ctx.stroke()

    def draw_arr(self, widget, ctx):
        if self.state < 0:
            return
        height = self.height / 8.

        context = widget.get_style_context()
        c = context.get_color(Gtk.StateFlags.NORMAL)
        ctx.set_source_rgb(c.red, c.green, c.blue)

        ctx.arc(5, self.function(self.state, height * 6, -height * 4, self.duration - 1), 5, math.pi / 2, math.pi * 1.5)
        ctx.fill()

    def start_animation(self, a, b):
        self.state = 0.
        self.graph.queue_draw()
        self.arr.queue_draw()

        self.timer = GObject.timeout_add(400, self.frame)

    def end_animation(self, a, b):
        if self.timer:
            GObject.source_remove(self.timer)
            self.timer = None

        self.state = -1
        self.graph.queue_draw()
        self.arr.queue_draw()

    def frame(self):
        self.timer = None
        self.state += 1

        if self.state >= self.duration:
            return

        self.arr.queue_draw()
        self.timer = GObject.timeout_add(15, self.frame)

class Keybinding(Gtk.HBox, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Keybinding, self).__init__()
        self.label = Gtk.Label.new(self.get_desc())
        self.value = self.get_val()
        if self.get_desc() != "":
            self.pack_start(self.label, False, False, 2)
            set_tt(self.get_tooltip(), self.label)

        self.buttons = []
        self.teach_button = None

        self.accel_frame = Gtk.Frame(shadow_type=Gtk.ShadowType.IN)
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self.accel_frame.add(box)

        self.pack_end(self.accel_frame, False, False, 2)

        array = self.string_to_array(self.value)

        x = 0
        for x in range(2):
            kb = ButtonKeybinding(accel_string=array[x])
            kb.set_size_request(200, -1)
            kb.set_hexpand(True)
            kb.connect("accel-edited", self.on_kb_changed)
            kb.connect("accel-cleared", self.on_kb_changed)
            box.pack_start(kb, True, True, 0)
            self.buttons.append(kb)
            if x == 0:
                box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))

        self.show_all()
        self.event_id = None
        self.teaching = False

    def on_kb_changed(self, widget, accel_string=None, accel_label=None):
        new_array = []
        x = 0

        for x in range(2):
            string = self.buttons[x].accel_string
            if string is not None:
                new_array.append(string)

        val_string = self.array_to_string(new_array)

        self.set_val(val_string)

    def array_to_string(self, array):
        string = ""
        done_once = False

        for binding in array:
            if done_once:
                string += "::"
            string += binding
            done_once = True

        return string

    def string_to_array(self, string):
        if not string or string == "":
            return ["",""]

        array = string.split("::", 1)
        while len(array) < 2:
            array.append("")

        return array

    def on_settings_file_changed(self):
        self.value = self.get_val()
        self.set_button_text()

    def update_dep_state(self, active):
        self.button.set_sensitive(active)

class Button(Gtk.Button, BaseWidget):
    def __init__(self, key, settings_obj, uuid):
        BaseWidget.__init__(self, key, settings_obj, uuid)
        super(Button, self).__init__(self.get_desc())
        self.connect('clicked', self.on_clicked)
        set_tt(self.get_tooltip(), self)

    def on_clicked(self, widget):
        session_bus = dbus.SessionBus()
        cinnamon_dbus = session_bus.get_object("org.Cinnamon", "/org/Cinnamon")
        activate_cb = cinnamon_dbus.get_dbus_method('activateCallback', 'org.Cinnamon')
        activate_cb(self.get_callback(), self.uuid, self.get_instance_id())

    def update_dep_state(self, active):
        self.set_sensitive(active)
