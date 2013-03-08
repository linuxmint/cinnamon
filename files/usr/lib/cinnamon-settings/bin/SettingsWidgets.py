#!/usr/bin/env python

try:
    import os
    import os.path
    import commands
    import sys
    import string    
    import gettext
    from gi.repository import Gio, Gtk, GObject, Gdk
    from gi.repository import GdkPixbuf 
#    import gconf
    import json
    import dbus
    import time
    from datetime import datetime
    import thread
    import urllib
    import lxml.etree
    import locale    
    import imtools
    from PIL import Image
    import tempfile
    import math
    import subprocess

except Exception, detail:
    print detail
    sys.exit(1)

class SidePage:
    def __init__(self, name, icon, keywords, advanced, content_box, is_c_mod = False, is_standalone = False, exec_name = None):
        self.name = name
        self.icon = icon
        self.content_box = content_box
        self.widgets = []
        self.is_c_mod = is_c_mod
        self.is_standalone = is_standalone
        self.exec_name = exec_name
        self.keywords = keywords
        self.advanced = advanced
        self.topWindow = None
        self.builder = None

    def add_widget(self, widget, advanced = False):
        self.widgets.append(widget)
        widget.advanced = advanced

    def build(self, mode_advanced):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        # Add our own widgets
        # C modules are sort of messy - they check the desktop type
        # (for Unity or GNOME) and show/hide UI items depending on
        # the result - so we can't just show_all on the widget, it will
        # mess up these modifications - so for these, we just show the
        # top-level widget
        if not self.is_standalone:
            for widget in self.widgets:
                if widget.advanced:
                    if not mode_advanced:
                        continue
                self.content_box.pack_start(widget, False, False, 2)
            if self.is_c_mod:
                self.content_box.show()
                children = self.content_box.get_children()
                for child in children:
                    child.show()
                    if child.get_name() == "c_box":
                        c_widgets = child.get_children()
                        if not c_widgets:
                            c_widget = self.content_box.c_manager.get_c_widget(self.exec_name)
                            if c_widget is not None:
                                child.pack_start(c_widget, False, False, 2)
                                c_widget.show()
                        else:
                            for c_widget in c_widgets:
                                c_widget.show()
            else:
                self.content_box.show_all()
        else:
            subprocess.Popen(self.exec_name.split())

class CCModule:
    def __init__(self, label, mod_id, icon, category, advanced, keywords, content_box):
        sidePage = SidePage(label, icon, keywords, advanced, content_box, True, False, mod_id)
        self.sidePage = sidePage
        self.name = mod_id
        self.category = category

    def process (self, c_manager):
        if c_manager.lookup_c_module(self.name):
            c_box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            c_box.set_vexpand(False)
            c_box.set_name("c_box")
            self.sidePage.add_widget(c_box)
            return True
        else:
            return False

class SAModule:
    def __init__(self, label, mod_id, icon, category, advanced, keywords, content_box):
        sidePage = SidePage(label, icon, keywords, advanced, content_box, False, True, mod_id)
        self.sidePage = sidePage
        self.name = mod_id
        self.category = category

    def process (self):
        return fileexists(self.name.split()[0])

def fileexists(program):

    def is_exe(fpath):
        return os.path.isfile(fpath) and os.access(fpath, os.X_OK)

    for path in os.environ["PATH"].split(os.pathsep):
        path = path.strip('"')
        exe_file = os.path.join(path, program)
        if is_exe(exe_file):
            return True
    return False

def walk_directories(dirs, filter_func):
    valid = []
    try:
        for thdir in dirs:
            if os.path.isdir(thdir):
                for t in os.listdir(thdir):
                    if filter_func(os.path.join(thdir, t)):
                         valid.append(t)
    except:
        pass
        #logging.critical("Error parsing directories", exc_info=True)
    return valid

def rec_mkdir(path):
    if os.path.exists(path):
        return
    
    rec_mkdir(os.path.split(path)[0])

    if os.path.exists(path):
        return
    os.mkdir(path)

class IndentedHBox(Gtk.HBox):
    def __init__(self):
        super(IndentedHBox, self).__init__()
        indent = Gtk.Label('\t')
        self.pack_start(indent, False, False, 0)

    def add(self, item):
        self.pack_start(item, False, False, 0)

class GSettingsCheckButton(Gtk.CheckButton):    
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsCheckButton, self).__init__(label)
        self.settings = Gio.Settings.new(schema)        
        self.set_active(self.settings.get_boolean(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.connectorId = self.connect('toggled', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.disconnect(self.connectorId)                     #  panel-edit-mode can trigger changed:: twice in certain instances,
        self.set_active(self.settings.get_boolean(self.key))  #  so disconnect temporarily when we are simply updating the widget state
        self.connectorId = self.connect('toggled', self.on_my_value_changed)

    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.get_active())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsSpinButton(Gtk.HBox):    
    def __init__(self, label, schema, key, dep_key, min, max, step, page, units):
        self.key = key
        self.min = min
        self.max = max
        self.dep_key = dep_key
        super(GSettingsSpinButton, self).__init__()        
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.SpinButton()
        self.units = Gtk.Label(units)        
        if (label != ""):       
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)
        if (units != ""):
            self.pack_start(self.units, False, False, 2)
        
        #self.content_widget.set_editable(False)
        self.settings = Gio.Settings.new(schema)
        range = self.settings.get_range(self.key)
        if range[0] == "range":
            rangeDefault = (1 << 32) - 1
            rangeMin = rangeDefault
            rangeMax = rangeDefault
            range = range[1]
            rangeMin = range[0] if range[0] < rangeDefault else rangeDefault
            rangeMax = range[1] if range[1] < rangeDefault else rangeDefault
            self.min = min if min > rangeMin else rangeMin
            self.max = max if max < rangeMax else rangeMax
        self.content_widget.set_range(self.min, self.max)
        self.content_widget.set_increments(step, page)
        self.content_widget.set_value(self.settings.get_int(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)
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

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsEntry(Gtk.HBox):    
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsEntry, self).__init__()
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.Entry()
        self.pack_start(self.label, False, False, 5)        
        self.add(self.content_widget)     
        self.settings = Gio.Settings.new(schema)        
        self.content_widget.set_text(self.settings.get_string(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('focus-out-event', self.on_my_value_changed)     
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_text(self.settings.get_string(self.key))

    def on_my_value_changed(self, event, widget):        
        self.settings.set_string(self.key, self.content_widget.get_text())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))


class GSettingsFileChooser(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, show_none_cb = False):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsFileChooser, self).__init__()
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.FileChooserButton()
        self.pack_start(self.label, False, False, 2)
        self.add(self.content_widget)
        self.settings = Gio.Settings.new(schema)
        value = self.settings.get_string(self.key)     
        if show_none_cb:
            self.show_none_cb = Gtk.CheckButton(_("None"))
            self.show_none_cb.set_active(value=="")
            self.pack_start(self.show_none_cb, False, False, 5)
        else:
            self.show_none_cb = None
        if value=="":
            self.content_widget.set_sensitive(False)
        else:
            self.content_widget.set_filename(value)
        self.content_widget.connect('file-set', self.on_my_value_changed)
        self.show_none_cb.connect('toggled', self.on_my_value_changed)
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_value_changed(self, widget):
        if self.show_none_cb.get_active():
            value = ""
            self.content_widget.set_sensitive(False)
        else:
            value = self.content_widget.get_filename()
            if value==None:
                value = ""
            self.content_widget.set_sensitive(True)
        self.settings.set_string(self.key, value)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsFontButton(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsFontButton, self).__init__()
        self.settings = Gio.Settings.new(schema)
        self.value = self.settings.get_string(key)
        
        self.label = Gtk.Label(label)

        self.content_widget = Gtk.FontButton()
        self.content_widget.set_font_name(self.value)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)
        self.content_widget.connect('font-set', self.on_my_value_changed)
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_value_changed(self, widget):
        self.settings.set_string(self.key, widget.get_font_name())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

#class GSettingsRange(Gtk.HBox):
#    def __init__(self, label, schema, key, dep_key, **options):
#        self.key = key
#        self.dep_key = dep_key
#        super(GSettingsRange, self).__init__()
#        self.settings = Gio.Settings.new(schema)
#        self.value = self.settings.get_double(self.key)
#        
#        self.label = Gtk.Label(label)
#
#        #returned variant is range:(min, max)
#        _min, _max = self.settings.get_range(self.key)[1]
#
#        self.content_widget = Gtk.HScale.new_with_range(_min, _max, options.get('adjustment_step', 1))
#        self.content_widget.set_value(self.value)
#        if (label != ""):
#            self.pack_start(self.label, False, False, 2)
#        self.pack_start(self.content_widget, True, True, 2)
#        self.content_widget.connect('value-changed', self.on_my_value_changed)
#        self.content_widget.show_all()
#        self.dependency_invert = False
#        if self.dep_key is not None:
#            if self.dep_key[0] == '!':
#                self.dependency_invert = True
#                self.dep_key = self.dep_key[1:]
#            split = self.dep_key.split('/')
#            self.dep_settings = Gio.Settings.new(split[0])
#            self.dep_key = split[1]
#            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
#            self.on_dependency_setting_changed(self, None)
#
#    def on_my_value_changed(self, widget):
#        self.settings.set_double(self.key, widget.get_value())
#
#    def on_dependency_setting_changed(self, settings, dep_key):
#        if not self.dependency_invert:
#            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
#        else:
#            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsRange(Gtk.HBox):
    def __init__(self, label, low_label, hi_label, low_limit, hi_limit, inverted, valtype, exponential, schema, key, dep_key, **options):
        super(GSettingsRange, self).__init__()
        self.key = key
        self.dep_key = dep_key
        self.settings = Gio.Settings.new(schema)
        self.valtype = valtype
        if self.valtype == "int":
            self.value = self.settings.get_int(self.key) * 1.0
        elif self.valtype == "uint":
            self.value = self.settings.get_uint(self.key) * 1.0
        elif self.valtype == "double":
            self.value = self.settings.get_double(self.key) * 1.0
        self.label = Gtk.Label(label)
        self.low_label = Gtk.Label()
        self.hi_label = Gtk.Label()
        self.low_label.set_markup("<i><small>%s</small></i>" % low_label)
        self.hi_label.set_markup("<i><small>%s</small></i>" % hi_label)
        self.inverted = inverted
        self.exponential = exponential
        self._range = (hi_limit - low_limit) * 1.0
        self._step = options.get('adjustment_step', 1)
        self._min = low_limit * 1.0
        self._max = hi_limit * 1.0
        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0, 1, (self._step / self._range))
        self.content_widget.set_value(self.to_corrected(self.value))
        self.content_widget.set_draw_value(False);
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        if (low_label != ""):
            self.pack_start(self.low_label, False, False, 2)
        self.pack_start(self.content_widget, True, True, 2)
        if (hi_label != ""):
            self.pack_start(self.hi_label, False, False, 2)
        self._dragging = False
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.content_widget.connect('button-press-event', self.on_mouse_down)
        self.content_widget.connect('button-release-event', self.on_mouse_up)
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

# halt writing gsettings during dragging
# it can take a long time to process all
# those updates, and the system can crash

    def on_mouse_down(self, widget, event):
        self._dragging = True

    def on_mouse_up(self, widget, event):
        self._dragging = False
        self.on_my_value_changed(widget)

    def on_my_value_changed(self, widget):
        if self._dragging:
            return
        corrected = self.from_corrected(widget.get_value())
        if self.valtype == "int":
            self.settings.set_int(self.key, corrected)
        elif self.valtype == "uint":
            self.settings.set_uint(self.key, corrected)
        elif self.valtype == "double":
            self.settings.set_double(self.key, corrected)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

    def to_corrected(self, value):
        result = 0.0
        if self.exponential:
            k = (math.log(self._max) - math.log(self._min)) / (self._range / self._step)
            a = self._max / math.exp(k * self._range)
            cur_val_step = (1 / (k / math.log(value / a))) / self._range
            if self.inverted:
                result = 1 - cur_val_step
            else:
                result = cur_val_step
        else:
            if self.inverted:
                result = 1 - ((value - self._min) / self._range)
            else:
                result = (value - self._min) / self._range
        return result

    def from_corrected(self, value):
        result = 0.0
        if self.exponential:
            k = (math.log(self._max)-math.log(self._min))/(self._range / self._step)
            a = self._max / math.exp(k * self._range)
            if self.inverted:
                cur_val_step = (1 - value) * self._range
                result = a * math.exp(k * cur_val_step)
            else:
                cur_val_step = value * self._range
                result =  a * math.exp(k * cur_val_step)
        else:
            if self.inverted:
                result = ((1 - value) * self._range) + self._min
            else:
                result =  (value * self._range) + self._min
        return round(result)

class GSettingsRangeSpin(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, **options):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsRangeSpin, self).__init__()
        self.label = Gtk.Label(label)
        self.content_widget = Gtk.SpinButton()

        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)

        self.settings = Gio.Settings.new(schema)

        _min, _max = self.settings.get_range(self.key)[1]
        _increment = options.get('adjustment_step', 1)

        self.content_widget.set_range(_min, _max)
        self.content_widget.set_increments(_increment, _increment)
        #self.content_widget.set_editable(False)
        self.content_widget.set_digits(1)
        self.content_widget.set_value(self.settings.get_double(self.key))

        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.settings.get_double(self.key))

    def on_my_value_changed(self, widget):
        self.settings.set_double(self.key, self.content_widget.get_value())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsComboBox(Gtk.HBox):    
    def __init__(self, label, schema, key, dep_key, options):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsComboBox, self).__init__()
        self.settings = Gio.Settings.new(schema)        
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
        self.pack_start(self.content_widget, False, False, 2)                     
        self.content_widget.connect('changed', self.on_my_value_changed)
        self.content_widget.show_all()
        self.dependency_invert = False
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            value = self.model[tree_iter][0]            
            self.settings.set_string(self.key, value)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsIntComboBox(Gtk.HBox):
    def __init__(self, label, schema, key, options):
        self.key = key
        super(GSettingsIntComboBox, self).__init__()
        self.settings = Gio.Settings.new(schema)
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
        self.pack_start(self.content_widget, False, False, 2)
        self.content_widget.connect('changed', self.on_my_value_changed)
        self.content_widget.show_all()

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            value = self.model[tree_iter][0]
            self.settings.set_int(self.key, value)

class GSettingsColorChooser(Gtk.ColorButton):
    def __init__(self, schema, key, dep_key):
        Gtk.ColorButton.__init__(self)
        self._schema = Gio.Settings.new(schema)
        self._key = key
        self.dep_key = dep_key
        self.set_value(self._schema[self._key])
        self.connect("color-set", self._on_color_set)
        self._schema.connect("changed::"+key, self._on_settings_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def _on_settings_value_changed(self, schema, key):
        self.set_value(schema[key])
    def _on_color_set(self, *args):
        self._schema.set_string(self._key, self.get_value())
    def get_value(self):
        return self.get_color().to_string()
    def set_value(self, value):
        self.set_color(Gdk.color_parse(value))

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

# class GConfFontButton(Gtk.HBox):
#     def __init__(self, label, key):
#         self.key = key
#         super(GConfFontButton, self).__init__()
#         self.settings = gconf.client_get_default()
#         self.value = self.settings.get_string(key)
        
#         self.label = Gtk.Label(label)

#         self.content_widget = Gtk.FontButton()
#         self.content_widget.set_font_name(self.value)
        
#         if (label != ""):
#             self.pack_start(self.label, False, False, 2)
#         self.pack_start(self.content_widget, False, False, 2)
#         self.content_widget.connect('font-set', self.on_my_value_changed)
#         self.content_widget.show_all()
#     def on_my_value_changed(self, widget):
#         self.settings.set_string(self.key, widget.get_font_name())

# class GConfComboBox(Gtk.HBox):    
#     def __init__(self, label, key, options, init_value = ""):  
#         self.key = key
#         super(GConfComboBox, self).__init__()
#         self.settings = gconf.client_get_default()  
#         self.value = self.settings.get_string(self.key)
#         if not self.value:
#             self.value = init_value
                      
#         self.label = Gtk.Label(label)       
#         self.model = Gtk.ListStore(str, str)
#         selected = None
#         for option in options:
#             iter = self.model.insert_before(None, None)
#             self.model.set_value(iter, 0, option[0])                
#             self.model.set_value(iter, 1, option[1])                        
#             if (option[0] == self.value):
#                 selected = iter
                                
#         self.content_widget = Gtk.ComboBox.new_with_model(self.model)   
#         renderer_text = Gtk.CellRendererText()
#         self.content_widget.pack_start(renderer_text, True)
#         self.content_widget.add_attribute(renderer_text, "text", 1)     
        
#         if selected is not None:
#             self.content_widget.set_active_iter(selected)
        
#         if (label != ""):
#             self.pack_start(self.label, False, False, 2)                
#         self.pack_start(self.content_widget, False, False, 2)                     
#         self.content_widget.connect('changed', self.on_my_value_changed)
#         # The on_my_setting_changed callback raises a segmentation fault, need to investigate that
#         #self.settings.add_dir(os.path.split(key)[0], gconf.CLIENT_PRELOAD_NONE)
#         #self.settings.notify_add(self.key, self.on_my_setting_changed)
#         self.content_widget.show_all()
        
#     def on_my_value_changed(self, widget):
#         tree_iter = widget.get_active_iter()
#         if tree_iter != None:            
#             value = self.model[tree_iter][0]            
#             self.settings.set_string(self.key, value)
#     def on_my_setting_changed(self, client, cnxn_id, entry, args):
#         print entry

# class GConfCheckButton(Gtk.CheckButton):    
#     def __init__(self, label, key):        
#         self.key = key
#         super(GConfCheckButton, self).__init__(label)       
#         self.settings = gconf.client_get_default()
#         self.set_active(self.settings.get_bool(self.key))
#         self.settings.notify_add(self.key, self.on_my_setting_changed)
#         self.connect('toggled', self.on_my_value_changed)            
    
#     def on_my_setting_changed(self, client, cnxn_id, entry):
#         value = entry.value.get_bool()
#         self.set_active(value)
        
#     def on_my_value_changed(self, widget):
#         self.settings.set_bool(self.key, self.get_active())

class DBusCheckButton(Gtk.CheckButton):    
    def __init__(self, label, service, path, get_method, set_method):        
        super(DBusCheckButton, self).__init__(label)     
        proxy = dbus.SystemBus().get_object(service, path)
        self.dbus_iface = dbus.Interface(proxy, dbus_interface=service)
        self.dbus_get_method = get_method
        self.dbus_set_method = set_method
        self.set_active(getattr(self.dbus_iface, get_method)()[1])
        self.connect('toggled', self.on_my_value_changed)
        
    def on_my_value_changed(self, widget):
        getattr(self.dbus_iface, self.dbus_set_method)(self.get_active())
