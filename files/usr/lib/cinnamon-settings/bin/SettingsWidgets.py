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
    from gi.repository import GConf
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
    import tweenEquations

except Exception, detail:
    print detail
    sys.exit(1)

class EditableEntry (Gtk.Notebook):

    __gsignals__ = {
        'changed': (GObject.SIGNAL_RUN_FIRST, None,
                      (str,))
    }

    PAGE_BUTTON = 0
    PAGE_ENTRY = 1

    def __init__ (self):
        super(EditableEntry, self).__init__()

        self.label = Gtk.Label()
        self.entry = Gtk.Entry()
        self.button = Gtk.Button()

        self.button.set_alignment(0.0, 0.5)
        self.button.set_relief(Gtk.ReliefStyle.NONE)
        self.append_page(self.button, None);
        self.append_page(self.entry, None);  
        self.set_current_page(0)
        self.set_show_tabs(False)
        self.set_show_border(False)
        self.editable = False
        self.show_all()

        self.button.connect("released", self._on_button_clicked)
        self.button.connect("activate", self._on_button_clicked)
        self.entry.connect("activate", self._on_entry_validated)
        self.entry.connect("changed", self._on_entry_changed)

    def set_text(self, text):
        self.button.set_label(text)
        self.entry.set_text(text)

    def _on_button_clicked(self, button):
        self.set_editable(True)

    def _on_entry_validated(self, entry):
        self.set_editable(False)
        self.emit("changed", entry.get_text())

    def _on_entry_changed(self, entry):
        self.button.set_label(entry.get_text())

    def set_editable(self, editable):        
        if (editable):
            self.set_current_page(EditableEntry.PAGE_ENTRY)
        else:
            self.set_current_page(EditableEntry.PAGE_BUTTON)
        self.editable = editable

    def set_tooltip_text(self, tooltip):
        self.button.set_tooltip_text(tooltip)

    def get_editable(self):
        return self.editable

    def get_text(self):
        return self.entry.get_text()

class BaseChooserButton(Gtk.Button):
    def __init__ (self, has_button_label=False):
        super(BaseChooserButton, self).__init__()
        self.menu = Gtk.Menu()
        self.button_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        self.button_image = Gtk.Image()
        self.button_box.add(self.button_image)
        if has_button_label:
            self.button_label = Gtk.Label()
            self.button_box.add(self.button_label)
        self.add(self.button_box)
        self.connect("button-release-event", self._on_button_clicked)

    def popup_menu_below_button (self, menu, widget):
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

    def _on_button_clicked(self, widget, event):
        if event.button == 1:
            self.menu.show_all()
            self.menu.popup(None, None, self.popup_menu_below_button, self, event.button, event.time)

class PictureChooserButton(BaseChooserButton):
    def __init__ (self, num_cols=4, button_picture_size=None, menu_pictures_size=None, has_button_label=False):
        super(PictureChooserButton, self).__init__(has_button_label)
        self.num_cols = num_cols
        self.button_picture_size = button_picture_size
        self.menu_pictures_size = menu_pictures_size
        self.row = 0
        self.col = 0
        self.progress = 0.0

        context = self.get_style_context()
        context.add_class("gtkstyle-fallback")

        self.connect_after("draw", self.on_draw) 

    def on_draw(self, widget, cr, data=None):
        if self.progress == 0:
            return False
        box = widget.get_allocation()

        context = widget.get_style_context()
        c = context.get_background_color(Gtk.StateFlags.SELECTED)

        max_length = box.width * .6
        start = (box.width - max_length) / 2
        y = box.height - 5

        cr.save()

        cr.set_source_rgba(c.red, c.green, c.blue, c.alpha)
        cr.set_line_width(3)
        cr.set_line_cap(1)
        cr.move_to(start, y)
        cr.line_to(start + (self.progress * max_length), y)
        cr.stroke()

        cr.restore()
        return False

    def increment_loading_progress(self, inc):
        progress = self.progress + inc
        self.progress = min(1.0, progress)
        self.queue_draw()

    def reset_loading_progress(self):
        self.progress = 0.0
        self.queue_draw()

    def set_picture_from_file (self, path):
        if os.path.exists(path):
            if self.button_picture_size is None:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
            else:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, -1, self.button_picture_size, True)
            self.button_image.set_from_pixbuf(pixbuf)

    def set_button_label(self, label):
        self.button_label.set_markup(label)

    def _on_picture_selected(self, menuitem, path, callback, id=None):
        if id is not None:
            result = callback(path, id)
        else:
            result = callback(path)
        
        if result:
            self.set_picture_from_file(path)            

    def clear_menu(self):
        menu = self.menu
        self.menu = Gtk.Menu()
        self.row = 0
        self.col = 0
        menu.destroy()

    def add_picture(self, path, callback, title=None, id=None):
        if os.path.exists(path):          
            if self.menu_pictures_size is None:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
            else:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, -1, self.menu_pictures_size, True)
            image = Gtk.Image.new_from_pixbuf (pixbuf)  
            menuitem = Gtk.MenuItem()            
            if title is not None:
                vbox = Gtk.VBox()
                vbox.pack_start(image, False, False, 2)
                label = Gtk.Label()
                label.set_text(title)
                vbox.pack_start(label, False, False, 2)
                menuitem.add(vbox)
            else:
                menuitem.add(image)
            if id is not None:
                menuitem.connect('activate', self._on_picture_selected, path, callback, id)
            else:
                menuitem.connect('activate', self._on_picture_selected, path, callback)
            self.menu.attach(menuitem, self.col, self.col+1, self.row, self.row+1)
            self.col = (self.col+1) % self.num_cols
            if (self.col == 0):
                self.row = self.row + 1

    def add_separator(self):
        self.row = self.row + 1
        self.menu.attach(Gtk.SeparatorMenuItem(), 0, self.num_cols, self.row, self.row+1)

    def add_menuitem(self, menuitem):
        self.row = self.row + 1
        self.menu.attach(menuitem, 0, self.num_cols, self.row, self.row+1)

class SidePage:
    def __init__(self, name, icon, keywords, content_box = None, size = None, is_c_mod = False, is_standalone = False, exec_name = None, module=None):
        self.name = name
        self.icon = icon
        self.content_box = content_box
        self.widgets = []
        self.is_c_mod = is_c_mod
        self.is_standalone = is_standalone
        self.exec_name = exec_name
        self.module = module # Optionally set by the module so we can call on_module_selected() on it when we show it.
        self.keywords = keywords
        self.size = size
        self.topWindow = None
        self.builder = None
        self.stack_switcher = None
        if self.module != None:
            self.module.loaded = False

    def add_widget(self, widget):
        self.widgets.append(widget)        

    def build(self, switch_container):        
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        if (self.module is not None):
            self.module.on_module_selected(switch_container)
            self.module.loaded = True

        # Add our own widgets
        # C modules are sort of messy - they check the desktop type
        # (for Unity or GNOME) and show/hide UI items depending on
        # the result - so we cannot just show_all on the widget, it will
        # mess up these modifications - so for these, we just show the
        # top-level widget
        if not self.is_standalone:
            for widget in self.widgets:
                if hasattr(widget, 'expand'):
                    self.content_box.pack_start(widget, True, True, 2)
                else:
                    self.content_box.pack_start(widget, False, False, 2)
            if self.is_c_mod:
                self.content_box.show()
                children = self.content_box.get_children()
                for child in children:
                    child.show()
                    if child.get_name() != "c_box":
                        pass

                    c_widgets = child.get_children()
                    if not c_widgets:
                        c_widget = self.content_box.c_manager.get_c_widget(self.exec_name)
                        if c_widget is not None:
                            child.pack_start(c_widget, False, False, 2)
                            c_widget.show()
                    else:
                        for c_widget in c_widgets:
                            c_widget.show()

                    # child.get_children()[0] is the CC Panel object (child is
                    # a box, but will only contain one subwidget). This is
                    # usually a bin, but profound hackery might turn it into a
                    # VBox. So we call get_children()[0] again to obtain the 
                    # primary widget of the panel. We look # in here to see if
                    # there is a stack switcher. If found, we move it to the
                    # switch container
                    for i in child.get_children()[0].get_children()[0]:
                        if isinstance(i, Gtk.StackSwitcher):
                            self.stack_switcher = i
                            break

                    if self.stack_switcher:
                        self.stack_switcher.show()
                        self.stack_switcher.get_parent().remove(self.stack_switcher)
                        switch_container.pack_start(self.stack_switcher, True, True, 0)
            else:
                self.content_box.show_all()
                try:
                    self.check_third_arg()
                except:
                    pass
        else:
            subprocess.Popen(self.exec_name.split())

class CCModule:
    def __init__(self, label, mod_id, icon, category, keywords, content_box):
        sidePage = SidePage(label, icon, keywords, content_box, False, True, False, mod_id)
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
    def __init__(self, label, mod_id, icon, category, keywords, content_box):
        sidePage = SidePage(label, icon, keywords, content_box, False, False, True, mod_id)
        self.sidePage = sidePage
        self.name = mod_id
        self.category = category

    def process (self):
        name = self.name.replace("gksudo ", "")
        name = name.replace("gksu ", "")
        return fileexists(name.split()[0])

def fileexists(program):

    def is_exe(fpath):
        return os.path.isfile(fpath) and os.access(fpath, os.X_OK)

    for path in os.environ["PATH"].split(os.pathsep):
        path = path.strip('"')
        exe_file = os.path.join(path, program)
        if is_exe(exe_file):
            return True
    return False

def walk_directories(dirs, filter_func, return_directories=False):
    # If return_directories is False: returns a list of valid subdir names
    # Else: returns a list of valid tuples (subdir-names, parent-directory)
    valid = []
    try:
        for thdir in dirs:
            if os.path.isdir(thdir):
                for t in os.listdir(thdir):
                    if filter_func(os.path.join(thdir, t)):
                        if return_directories:
                            valid.append([t, thdir])
                        else:
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

class Section(Gtk.Box):
    def __init__(self, name):
        self.name = name
        super(Section, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_border_width(6)
        self.set_spacing(6)
        self.label = Gtk.Label()
        self.label.set_markup("<b>%s</b>" % self.name)
        hbox = Gtk.Box()
        hbox.set_orientation(Gtk.Orientation.HORIZONTAL)
        hbox.pack_start(self.label, False, False, 0)
        self.pack_start(hbox, False, True, 0)

    def add(self, widget):
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        box.set_margin_left(40)
        box.set_margin_right(40)
        box.pack_start(widget, False, True, 0)
        self.pack_start(box, False, False, 0)

    def add_expand(self, widget):
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        box.set_margin_left(40)
        box.set_margin_right(40)
        box.pack_start(widget, True, True, 0)
        self.pack_start(box, False, False, 0)

    def add_indented(self, widget):
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        box.set_margin_left(80)
        box.set_margin_right(10)
        box.pack_start(widget, False, True, 0)
        self.pack_start(box, False, False, 0)

    def add_indented_expand(self, widget):
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        box.set_margin_left(80)
        box.set_margin_right(10)
        box.pack_start(widget, True, True, 0)
        self.pack_start(box, False, False, 0)

class SectionBg(Gtk.Viewport):
    def __init__(self):
        Gtk.Viewport.__init__(self)
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        style = self.get_style_context()
        style.add_class("section-bg")
        self.expand = True # Tells CS to give expand us to the whole window

class SettingsStack(Gtk.Stack):
    def __init__(self):
        Gtk.Stack.__init__(self)
        self.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)
        self.set_transition_duration(150)
        self.expand = True

class IndentedHBox(Gtk.HBox):
    def __init__(self):
        super(IndentedHBox, self).__init__()
        indent = Gtk.Label.new('\t')
        self.pack_start(indent, False, False, 0)

    def add(self, item):
        self.pack_start(item, False, True, 0)

    def add_expand(self, item):
        self.pack_start(item, True, True, 0)

class GSettingsCheckButton(Gtk.CheckButton):    
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsCheckButton, self).__init__(label = label)
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
        self.label = Gtk.Label.new(label)       
        self.content_widget = Gtk.SpinButton()
        self.units = Gtk.Label.new(units)        
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
        self.label = Gtk.Label.new(label)       
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
        self.show_none_cb = show_none_cb
        super(GSettingsFileChooser, self).__init__()
        self.label = Gtk.Label.new(label)       
        self.content_widget = Gtk.FileChooserButton()
        self.pack_start(self.label, False, False, 2)
        self.add(self.content_widget)
        self.settings = Gio.Settings.new(schema)
        value = self.settings.get_string(self.key)     
        if value != "":
            self.content_widget.set_filename(value)

        if self.show_none_cb:
            self.show_none_cb_widget = Gtk.CheckButton(_("None"))
            self.show_none_cb_widget.set_active(value=="")
            self.pack_start(self.show_none_cb_widget, False, False, 5)        
            if value=="":
                self.content_widget.set_sensitive(False)
        
        self.content_widget.connect('file-set', self.on_my_value_changed)
        if self.show_none_cb:
            self.show_none_cb_widget.connect('toggled', self.on_my_value_changed)
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
        if self.show_none_cb:
            if self.show_none_cb_widget.get_active():
                value = ""
                self.content_widget.set_sensitive(False)
            else:
                value = self.content_widget.get_filename()
                if value==None:
                    value = ""
                self.content_widget.set_sensitive(True)
        else:
            value = self.content_widget.get_filename()
            if value==None:
                value = ""
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
        
        self.label = Gtk.Label.new(label)

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
#        self.label = Gtk.Label.new(label)
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
        self.label = Gtk.Label.new(label)
        self.label.set_alignment(1.0, 0.5)
        self.label.set_size_request(150, -1)
        self.low_label = Gtk.Label()
        self.low_label.set_alignment(0.5, 0.5)
        self.low_label.set_size_request(60, -1)
        self.hi_label = Gtk.Label()
        self.hi_label.set_alignment(0.5, 0.5)
        self.hi_label.set_size_request(60, -1)
        self.low_label.set_markup("<i><small>%s</small></i>" % low_label)
        self.hi_label.set_markup("<i><small>%s</small></i>" % hi_label)
        self.inverted = inverted
        self.exponential = exponential
        self._range = (hi_limit - low_limit) * 1.0
        self._step = options.get('adjustment_step', 1)
        self._min = low_limit * 1.0
        self._max = hi_limit * 1.0
        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0, 1, (self._step / self._range))
        self.content_widget.set_size_request(300, 0)
        self.content_widget.set_value(self.to_corrected(self.value))
        self.content_widget.set_draw_value(False);

        self.grid = Gtk.Grid()
        if (label != ""):
            self.grid.attach(self.label, 0, 0, 1, 1)
        if (low_label != ""):
            self.grid.attach(self.low_label, 1, 0, 1, 1)
        self.grid.attach(self.content_widget, 2, 0, 1, 1)
        if (hi_label != ""):
            self.grid.attach(self.hi_label, 3, 0, 1, 1)
        self.pack_start(self.grid, True, True, 2)
        self._dragging = False
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.content_widget.connect('button-press-event', self.on_mouse_down)
        self.content_widget.connect('button-release-event', self.on_mouse_up)
        self.content_widget.connect("scroll-event", self.on_mouse_scroll_event)
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

    def on_mouse_scroll_event(self, widget, event):
        found, delta_x, delta_y = event.get_scroll_deltas()
        if found:
            add = delta_y < 0
            uncorrected = self.from_corrected(widget.get_value())
            if add:
                corrected = self.to_corrected(uncorrected + self._step)
            else:
                corrected = self.to_corrected(uncorrected - self._step)
            widget.set_value(corrected)
        return True

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

    def add_mark(self, value, position, markup):
        self.content_widget.add_mark((value - self._min) / self._range, position, markup)

class GSettingsRangeSpin(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, **options):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsRangeSpin, self).__init__()
        self.label = Gtk.Label.new(label)
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
        value = self.settings.get_double(self.key)
        if value != self.content_widget.get_value():
            self.content_widget.set_value(value)

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
                      
        self.label = Gtk.Label.new(label)       
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
    def __init__(self, label, schema, key, dep_key, options, use_uint=False):
        self.key = key
        self.dep_key = dep_key
        self.use_uint = use_uint
        super(GSettingsIntComboBox, self).__init__()
        self.settings = Gio.Settings.new(schema)
        if self.use_uint:
            self.value = self.settings.get_uint(self.key)
        else:
            self.value = self.settings.get_int(self.key)

        self.label = Gtk.Label.new(label)
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
        self.pack_start(self.content_widget, False, True, 2)
        self.content_widget.connect('changed', self.on_my_value_changed)
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
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            value = self.model[tree_iter][0]
            if self.use_uint:
                self.settings.set_uint(self.key, value)
            else:
                self.settings.set_int(self.key, value)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsUIntComboBox(Gtk.HBox):
    def __init__(self, label, schema, key, options):
        self.key = key
        super(GSettingsUIntComboBox, self).__init__()
        self.settings = Gio.Settings.new(schema)
        self.value = self.settings.get_uint(self.key)

        self.label = Gtk.Label.new(label)
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
        self.pack_start(self.content_widget, False, True, 2)
        self.content_widget.connect('changed', self.on_my_value_changed)
        self.content_widget.show_all()

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            value = self.model[tree_iter][0]
            self.settings.set_uint(self.key, value)


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
        
#         self.label = Gtk.Label.new(label)

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
                      
#         self.label = Gtk.Label.new(label)       
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
