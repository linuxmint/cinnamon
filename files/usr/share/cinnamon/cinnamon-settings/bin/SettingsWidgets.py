#!/usr/bin/env python2

from gi.repository import Gio, Gtk, GObject, Gdk, GLib, GdkPixbuf, CDesktopEnums, CinnamonDesktop
import math
import os
import subprocess
import traceback
import dbus

settings_objects = {}

# Monkey patch Gio.Settings object
def __setitem__(self, key, value):
    # set_value() aborts the program on an unknown key
    if key not in self:
        raise KeyError('unknown key: %r' % (key,))

    # determine type string of this key
    range = self.get_range(key)
    type_ = range.get_child_value(0).get_string()
    v = range.get_child_value(1)
    if type_ == 'type':
        # v is boxed empty array, type of its elements is the allowed value type
        assert v.get_child_value(0).get_type_string().startswith('a')
        type_str = v.get_child_value(0).get_type_string()[1:]
    elif type_ == 'enum':
        # v is an array with the allowed values
        assert v.get_child_value(0).get_type_string().startswith('a')
        type_str = v.get_child_value(0).get_child_value(0).get_type_string()
    elif type_ == 'flags':
        # v is an array with the allowed values
        assert v.get_child_value(0).get_type_string().startswith('a')
        type_str = v.get_child_value(0).get_type_string()
    elif type_ == 'range':
        # type_str is a tuple giving the range
        assert v.get_child_value(0).get_type_string().startswith('(')
        type_str = v.get_child_value(0).get_type_string()[1]

    if not self.set_value(key, GLib.Variant(type_str, value)):
        raise ValueError("value '%s' for key '%s' is outside of valid range" % (value, key))

def bind_with_mapping(self, key, widget, prop, flags, key_to_prop, prop_to_key):
    self._ignore_key_changed = False

    def key_changed(settings, key):
        if self._ignore_key_changed:
            return
        self._ignore_prop_changed = True
        widget.set_property(prop, key_to_prop(self[key]))
        self._ignore_prop_changed = False

    def prop_changed(widget, param):
        if self._ignore_prop_changed:
            return
        self._ignore_key_changed = True
        self[key] = prop_to_key(widget.get_property(prop))
        self._ignore_key_changed = False

    if not (flags & (Gio.SettingsBindFlags.SET | Gio.SettingsBindFlags.GET)): # ie Gio.SettingsBindFlags.DEFAULT
       flags |= Gio.SettingsBindFlags.SET | Gio.SettingsBindFlags.GET
    if flags & Gio.SettingsBindFlags.GET:
        key_changed(self, key)
        if not (flags & Gio.SettingsBindFlags.GET_NO_CHANGES):
            self.connect('changed::' + key, key_changed)
    if flags & Gio.SettingsBindFlags.SET:
        widget.connect('notify::' + prop, prop_changed)
    if not (flags & Gio.SettingsBindFlags.NO_SENSITIVITY):
        self.bind_writable(key, widget, "sensitive", False)

Gio.Settings.bind_with_mapping = bind_with_mapping
Gio.Settings.__setitem__ = __setitem__

class EditableEntry (Gtk.Stack):

    __gsignals__ = {
        'changed': (GObject.SignalFlags.RUN_FIRST, None,
                      (str,))
    }

    def __init__ (self):
        super(EditableEntry, self).__init__()

        self.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.set_transition_duration(150)

        self.label = Gtk.Label()
        self.entry = Gtk.Entry()
        self.button = Gtk.Button()

        self.button.set_alignment(1.0, 0.5)
        self.button.set_relief(Gtk.ReliefStyle.NONE)
        self.add_named(self.button, "button");
        self.add_named(self.entry, "entry");
        self.set_visible_child_name("button")
        self.editable = False
        self.current_text = None
        self.show_all()

        self.button.connect("released", self._on_button_clicked)
        self.button.connect("activate", self._on_button_clicked)
        self.entry.connect("activate", self._on_entry_validated)
        self.entry.connect("changed", self._on_entry_changed)
        self.entry.connect("focus-out-event", self._on_focus_lost)

    def set_text(self, text):
        self.button.set_label(text)
        self.entry.set_text(text)
        self.current_text = text

    def _on_focus_lost(self, widget, event):
        self.button.set_label(self.current_text)
        self.entry.set_text(self.current_text)

        self.set_editable(False)

    def _on_button_clicked(self, button):
        self.set_editable(True)
        self.entry.grab_focus()

    def _on_entry_validated(self, entry):
        self.set_editable(False)
        self.emit("changed", entry.get_text())
        self.current_text = entry.get_text()

    def _on_entry_changed(self, entry):
        self.button.set_label(entry.get_text())

    def set_editable(self, editable):
        if (editable):
            self.set_visible_child_name("entry")
        else:
            self.set_visible_child_name("button")
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
        self.stack = None
        if self.module != None:
            self.module.loaded = False

    def add_widget(self, widget):
        self.widgets.append(widget)

    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        if (self.module is not None):
            self.module.on_module_selected()
            self.module.loaded = True

        if self.is_standalone:
            subprocess.Popen(self.exec_name.split())
            return

        # Add our own widgets
        for widget in self.widgets:
            if hasattr(widget, 'expand'):
                self.content_box.pack_start(widget, True, True, 2)
            else:
                self.content_box.pack_start(widget, False, False, 2)

        # C modules are sort of messy - they check the desktop type
        # (for Unity or GNOME) and show/hide UI items depending on
        # the result - so we cannot just show_all on the widget, it will
        # mess up these modifications - so for these, we just show the
        # top-level widget
        if not self.is_c_mod:
            self.content_box.show_all()
            try:
                self.check_third_arg()
            except:
                pass
            return

        self.content_box.show()
        for child in self.content_box:
            child.show()

            # C modules can have non-C parts. C parts are all named c_box
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

            def recursively_iterate(parent):
                if self.stack:
                    return
                for child in parent:
                    if isinstance(child, Gtk.Stack):
                        self.stack = child
                        break
                    elif isinstance(child, Gtk.Container):
                        recursively_iterate(child)

            # Look for a stack recursively
            recursively_iterate(child)

class CCModule:
    def __init__(self, label, mod_id, icon, category, keywords, content_box):
        sidePage = SidePage(label, icon, keywords, content_box, size=-1, is_c_mod=True, is_standalone=False, exec_name=mod_id, module=None)
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
        name = name.split()[0]

        for path in os.environ["PATH"].split(os.pathsep):
            path = path.strip('"')
            exe_file = os.path.join(path, name)
            if os.path.isfile(exe_file) and os.access(exe_file, os.X_OK):
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

class SettingsRevealer(Gtk.Revealer):
    def __init__(self, schema=None, key=None, values=None):
        Gtk.Revealer.__init__(self)

        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        Gtk.Revealer.add(self, self.box)

        self.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.set_transition_duration(150)

        if schema:
            self.settings = Gio.Settings.new(schema)
            #the value of this key is the information whether to show or to hide the revealer
            if values is None:
                self.settings.bind(key, self, "reveal-child", Gio.SettingsBindFlags.GET)
            #only at some values of this key the reveaer must be shown
            else:
                self.values = values
                self.settings.connect("changed::" + key, self.on_settings_changed)
                self.on_settings_changed(self.settings, key)

    def add(self, widget):
        self.box.pack_start(widget, False, True, 0)

    #only used when checking values
    def on_settings_changed(self, settings, key):
        self.set_reveal_child(settings.get_value(key).unpack() in self.values)

class SettingsPage(Gtk.Box):
    def __init__(self):
        Gtk.Box.__init__(self)
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(15)
        self.set_margin_left(80)
        self.set_margin_right(80)
        self.set_margin_top(15)
        self.set_margin_bottom(15)

    def add_section(self, title):
        section = SettingsBox(title)
        self.pack_start(section, False, False, 0)

        return section

    def add_reveal_section(self, title, schema=None, key=None, values=None):
        section = SettingsBox(title)
        revealer = SettingsRevealer(schema, key, values)
        revealer.add(section)
        section._revealer = revealer
        self.pack_start(revealer, False, False, 0)

        return section

class SettingsBox(Gtk.Frame):
    def __init__(self, title):
        Gtk.Frame.__init__(self)
        self.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = self.get_style_context()
        frame_style.add_class("view")
        self.size_group = Gtk.SizeGroup()
        self.size_group.set_mode(Gtk.SizeGroupMode.VERTICAL)

        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.add(self.box)

        toolbar = Gtk.Toolbar.new()
        toolbar_context = toolbar.get_style_context()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(toolbar), "cs-header")

        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % title)
        title_holder = Gtk.ToolItem()
        title_holder.add(label)
        toolbar.add(title_holder)
        self.box.add(toolbar)

        toolbar_separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        self.box.add(toolbar_separator)
        separator_context = toolbar_separator.get_style_context()
        frame_color = frame_style.get_border_color(Gtk.StateFlags.NORMAL).to_string()
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data(".separator { -GtkWidget-wide-separators: 0; \
                                                   color: %s;                    \
                                                }" % frame_color)
        separator_context.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        self.need_separator = False

    def add_row(self, widget):
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        if self.need_separator:
            vbox.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))
        list_box = Gtk.ListBox()
        list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        row = Gtk.ListBoxRow()
        row.add(widget)
        if isinstance(widget, GSettingsSwitch):
            list_box.connect("row-activated", widget.clicked)
        list_box.add(row)
        vbox.add(list_box)
        self.box.add(vbox)

        self.need_separator = True

    def add_reveal_row(self, widget, schema=None, key=None, values=None):
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        if self.need_separator:
            vbox.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))
        list_box = Gtk.ListBox()
        list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        row = Gtk.ListBoxRow()
        row.add(widget)
        if isinstance(widget, GSettingsSwitch):
            list_box.connect("row-activated", widget.clicked)
        list_box.add(row)
        vbox.add(list_box)
        revealer = SettingsRevealer(schema, key, values)
        widget.revealer = revealer
        revealer.add(vbox)
        self.box.add(revealer)

        self.need_separator = True

        return revealer

class SettingsWidget(Gtk.Box):
    def __init__(self, dep_key=None):
        Gtk.Box.__init__(self)
        self.set_orientation(Gtk.Orientation.HORIZONTAL)
        self.set_spacing(20)
        self.set_border_width(5)
        self.set_margin_left(20)
        self.set_margin_right(20)

        if dep_key:
            flag = Gio.SettingsBindFlags.GET
            if dep_key[0] == "!":
                dep_key = dep_key[1:]
                flag |= Gio.Settings.BindFlags.INVERT_BOOLEAN

            split = dep_key.split("/")
            dep_settings = Gio.Settings.new(split[0])
            dep_settings.bind(split[1], self, "sensitive", flag)

    def add_to_size_group(self, group):
        group.add_widget(self.content_widget)

    def fill_row(self):
        self.set_border_width(0)
        self.set_margin_left(0)
        self.set_margin_right(0)

    def get_settings(self, schema):
        global settings_objects
        try:
            return settings_objects[schema]
        except:
            settings_objects[schema] = Gio.Settings.new(schema)
            return settings_objects[schema]

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

class GSettingsSwitch(SettingsWidget):
    def __init__(self, label, schema=None, key=None, dep_key=None):
        self.key = key
        super(GSettingsSwitch, self).__init__(dep_key=dep_key)

        self.content_widget = Gtk.Switch()
        self.label = Gtk.Label(label)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        if schema:
            self.settings = self.get_settings(schema)
            self.settings.bind(key, self.content_widget, "active", Gio.SettingsBindFlags.DEFAULT)

    def clicked(self, listbox, row, data=None):
        self.content_widget.set_active(not self.content_widget.get_active())

class GSettingsSpinButton(SettingsWidget):
    def __init__(self, label, schema, key, units="", mini=None, maxi=None, step=1, page=None, dep_key=None, size_group=None):
        super(GSettingsSpinButton, self).__init__(dep_key=dep_key)
        self.key = key
        self.timer = None

        if units:
            label += " (%s)" % units
        self.label = Gtk.Label.new(label)
        self.content_widget = Gtk.SpinButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.settings = self.get_settings(schema)

        range = self.settings.get_range(self.key)
        if mini == None or maxi == None:
            mini = range[1][0]
            maxi = range[1][1]
        elif range[0] == "range":
            mini = max(mini, range[1][0])
            maxi = min(maxi, range[1][1])

        if not page:
            page = step

        self.content_widget.set_range(mini, maxi)
        self.content_widget.set_increments(step, page)

        digits = 0
        if (step and '.' in str(step)):
            digits = len(str(step).split('.')[1])
        self.content_widget.set_digits(digits)

        self.settings.bind(key, self.content_widget.get_adjustment(), "value", Gio.SettingsBindFlags.GET)
        self.content_widget.connect("value-changed", self.apply_later)

        if size_group:
            self.add_to_size_group(size_group)

    def apply_later(self, *args):
        def apply(self):
            self.settings[self.key] = self.content_widget.get_value()
            self.timer = None

        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(300, apply, self)

class GSettingsEntry(SettingsWidget):
    def __init__(self, label, schema, key, dep_key=None, size_group=None):
        super(GSettingsEntry, self).__init__(dep_key=dep_key)
        self.key = key
        self.label = Gtk.Label.new(label)
        self.content_widget = Gtk.Entry()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.settings = self.get_settings(schema)

        self.settings.bind(key, self.content_widget, "text", Gio.SettingsBindFlags.DEFAULT)

        if size_group:
            self.add_to_size_group(size_group)

class GSettingsFontButton(SettingsWidget):
    def __init__(self, label, schema, key, dep_key=None, size_group=None):
        super(GSettingsFontButton, self).__init__(dep_key=dep_key)
        self.key = key

        self.settings = self.get_settings(schema)
        self.label = Gtk.Label.new(label)

        self.content_widget = Gtk.FontButton()

        if (label != ""):
            self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.settings.bind(key, self.content_widget, "font-name", Gio.SettingsBindFlags.DEFAULT)

        if size_group:
            self.add_to_size_group(size_group)

class GSettingsRange(SettingsWidget):
    def __init__(self, label, schema, key, min_label, max_label, mini=None, maxi=None, step=None, invert=False, log=False, dep_key=None):
        super(GSettingsRange, self).__init__(dep_key=dep_key)
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)

        self.key = key
        self.settings = self.get_settings(schema)
        self.log = log
        self.invert = invert
        self.timer = None

        hbox = Gtk.Box()

        self.label = Gtk.Label.new(label)
        self.label.set_halign(Gtk.Align.CENTER)

        self.min_label= Gtk.Label()
        self.max_label = Gtk.Label()
        self.min_label.set_alignment(1.0, 0.75)
        self.max_label.set_alignment(1.0, 0.75)
        self.min_label.set_margin_right(6)
        self.max_label.set_margin_left(6)
        self.min_label.set_markup("<i><small>%s</small></i>" % min_label)
        self.max_label.set_markup("<i><small>%s</small></i>" % max_label)

        range = self.settings.get_range(self.key)
        if mini == None or maxi == None:
            mini = range[1][0]
            maxi = range[1][1]
        elif range[0] == "range":
            mini = max(mini, range[1][0])
            maxi = min(maxi, range[1][1])

        if log:
            mini = math.log(mini)
            maxi = math.log(maxi)

        if step is None:
            self.step = (maxi - mini) * 0.02
        else:
            self.step = math.log(step) if log else step

        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, mini, maxi, self.step)
        self.content_widget.set_inverted(invert)
        self.content_widget.set_draw_value(False)

        val = self.settings.get_value(self.key)
        if val.get_type_string() == "i":
            self.content_widget.set_round_digits(0)

        if invert:
            self.step *= -1 # Gtk.Scale.new_with_range want a positive value, but our custom scroll handler wants a negative value

        hbox.pack_start(self.min_label, False, False, 0)
        hbox.pack_start(self.content_widget, True, True, 0)
        hbox.pack_start(self.max_label, False, False, 0)

        self.pack_start(self.label, False, False, 0)
        self.pack_start(hbox, True, True, 6)

        self.content_widget.connect("scroll-event", self.on_scroll_event)

        if log:
            self.settings.bind_with_mapping(
                    key,
                    self.content_widget.get_adjustment(),
                    "value",
                    Gio.SettingsBindFlags.GET | Gio.SettingsBindFlags.NO_SENSITIVITY,
                    lambda x: math.log(x),
                    None)
        else:
            self.settings.bind(key, self.content_widget.get_adjustment(), "value", Gio.SettingsBindFlags.GET | Gio.SettingsBindFlags.NO_SENSITIVITY)

        self.content_widget.connect("value-changed", self.apply_later)

    def apply_later(self, *args):
        def apply(self):
            if self.log:
                self.settings[self.key] = math.exp(self.content_widget.get_value())
            else:
                self.settings[self.key] = self.content_widget.get_value()
            self.timer = None

        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(300, apply, self)

    def on_scroll_event(self, widget, event):
        found, delta_x, delta_y = event.get_scroll_deltas()

        # If you scroll up, delta_y < 0. This is a weird world
        widget.set_value(widget.get_value() - delta_y * self.step)

        return True

    def add_mark(self, value, position, markup):
        if self.log:
            self.content_widget.add_mark(math.log(value), position, markup)
        else:
            self.content_widget.add_mark(value, position, markup)

class GSettingsComboBox(SettingsWidget):
    def __init__(self, label, schema, key, options, valtype="string", dep_key=None, size_group=None):
        super(GSettingsComboBox, self).__init__(dep_key=dep_key)

        self.settings = self.get_settings(schema)
        self.key = key
        self.valtype = valtype
        self.option_map = {}

        self.label = Gtk.Label.new(label)
        if valtype == "string":
            self.model = Gtk.ListStore(str, str)
        else:
            self.model = Gtk.ListStore(int, str)

        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])
            self.model.set_value(iter, 1, option[1])
            self.option_map[option[0]] = iter

        self.content_widget = Gtk.ComboBox.new_with_model(self.model)
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.content_widget.show_all()

        self.on_my_setting_changed()

        self.content_widget.connect('changed', self.on_my_value_changed)
        self.settings.connect("changed::" + self.key, self.on_my_setting_changed)

        if size_group:
            self.add_to_size_group(size_group)

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.value = self.model[tree_iter][0]
            self.settings[self.key] = self.value

    def on_my_setting_changed(self, *args):
        self.value = self.settings[self.key]
        try:
            self.content_widget.set_active_iter(self.option_map[self.value])
        except:
            self.content_widget.set_active_iter(None)


class GSettingsColorChooser(SettingsWidget):
    def __init__(self, label, schema, key, dep_key=None, size_group=None):
        super(GSettingsColorChooser, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label(label)
        self.content_widget = Gtk.ColorButton()
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.settings = self.get_settings(schema)
        self.settings.bind_with_mapping(
                key,
                self.content_widget,
                "color",
                Gio.SettingsBindFlags.DEFAULT,
                Gdk.color_parse,
                Gdk.Color.to_string)

        if size_group:
            self.add_to_size_group(size_group)

class GSettingsSoundFileChooser(SettingsWidget):
    def __init__(self, label, schema, key, dep_key=None, size_group=None):
        super(GSettingsSoundFileChooser, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label(label)

        self.content_widget = Gtk.ButtonBox(Gtk.Orientation.HORIZONTAL)

        c = self.content_widget.get_style_context()
        c.add_class(Gtk.STYLE_CLASS_LINKED)

        self.key = key
        self.settings = self.get_settings(schema)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.file_picker = Gtk.Button()
        self.file_picker.connect("clicked", self.on_picker_clicked)
        self.update_button_label(self.settings.get_string(self.key))

        self.content_widget.add(self.file_picker)

        self.play_button = Gtk.Button()
        self.play_button.set_image(Gtk.Image.new_from_stock("gtk-media-play", Gtk.IconSize.BUTTON))
        self.play_button.connect("clicked", self.on_play_clicked)
        self.content_widget.add(self.play_button)

        self._proxy = None

        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      'org.cinnamon.SettingsDaemon',
                                      '/org/cinnamon/SettingsDaemon/Sound',
                                      'org.cinnamon.SettingsDaemon.Sound',
                                      None, self._on_proxy_ready, None)
        except dbus.exceptions.DBusException as e:
            print(e)
            self._proxy = None
            self.play_button.set_sensitive(False)

        if size_group:
            self.add_to_size_group(size_group)

    def _on_proxy_ready (self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)

    def on_play_clicked(self, widget):
        self._proxy.PlaySoundFile("(us)", 0, self.settings.get_string(self.key))

    def on_picker_clicked(self, widget):
        dialog = Gtk.FileChooserDialog(title=self.label.get_text(),
                                       action=Gtk.FileChooserAction.OPEN,
                                       buttons=(_("_Cancel"), Gtk.ResponseType.CANCEL,
                                                _("_Open"), Gtk.ResponseType.ACCEPT))

        dialog.set_filename(self.settings.get_string(self.key))

        sound_filter = Gtk.FileFilter()
        sound_filter.add_mime_type("audio")
        dialog.add_filter(sound_filter)

        if (dialog.run() == Gtk.ResponseType.ACCEPT):
            name = dialog.get_filename()
            self.settings.set_string(self.key, name)
            self.update_button_label(name)

        dialog.destroy()

    def update_button_label(self, absolute_path):
        f = Gio.File.new_for_path(absolute_path)

        self.file_picker.set_label(f.get_basename())


class DependencyCheckInstallButton(Gtk.Box):
    def __init__(self, checking_text, install_button_text, packages, final_widget=None, satisfied_cb=None):
        super(DependencyCheckInstallButton, self).__init__(orientation=Gtk.Orientation.HORIZONTAL)

        self.packages = packages
        self.satisfied_cb = satisfied_cb

        self.checking_text = checking_text
        self.install_button_text = install_button_text

        self.stack = Gtk.Stack()
        self.pack_start(self.stack, False, False, 0)

        self.progress_bar = Gtk.ProgressBar()
        self.stack.add_named(self.progress_bar, "progress")

        self.progress_bar.set_show_text(True)
        self.progress_bar.set_text(self.checking_text)

        self.install_button = Gtk.Button(install_button_text)
        self.install_button.connect("clicked", self.on_install_clicked)
        self.stack.add_named(self.install_button, "install")

        if final_widget:
            self.stack.add_named(final_widget, "final")
        else:
            self.stack.add_named(Gtk.Alignment(), "final")

        self.stack.set_visible_child_name("progress")

        self.progress_source_id = 0

        GObject.idle_add(self.check)

    def check(self):
        self.start_pulse()
        CinnamonDesktop.installer_check_for_packages(self.packages, self.on_check_complete)
        return False

    def on_install_clicked(self, widget):
        self.progress_bar.set_text(_("Installing"))
        self.stack.set_visible_child_name("progress")
        self.start_pulse()
        CinnamonDesktop.installer_install_packages(self.packages, self.on_install_complete)

    def pulse_progress(self):
        self.progress_bar.pulse()
        return True

    def start_pulse(self):
        self.cancel_pulse()
        self.progress_source_id = GObject.timeout_add(200, self.pulse_progress)

    def cancel_pulse(self):
        if (self.progress_source_id > 0):
            GObject.source_remove(self.progress_source_id)
            self.progress_source_id = 0

    def on_check_complete(self, result, data=None):
        self.cancel_pulse()
        if result:
            self.stack.set_visible_child_name("final")
            if self.satisfied_cb:
                self.satisfied_cb()
        else:
            self.stack.set_visible_child_name("install")

    def on_install_complete(self, result, data=None):
        self.progress_bar.set_text(self.checking_text)
        CinnamonDesktop.installer_check_for_packages(self.packages, self.on_check_complete)

class GSettingsDependencySwitch(SettingsWidget):
    def __init__(self, label, schema=None, key=None, dep_key=None, packages=None):
        super(GSettingsDependencySwitch, self).__init__(dep_key=dep_key)

        self.packages = packages

        self.content_widget = Gtk.Alignment()
        self.label = Gtk.Label(label)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.switch = Gtk.Switch()
        self.switch.set_halign(Gtk.Align.END)
        self.switch.set_valign(Gtk.Align.CENTER)

        pkg_string = ""
        for pkg in packages:
            if pkg_string != "":
                pkg_string += ", "
            pkg_string += pkg

        self.dep_button = DependencyCheckInstallButton(_("Checking dependencies"),
                                                       _("Install: %s") % (pkg_string),
                                                       packages,
                                                       self.switch)
        self.content_widget.add(self.dep_button)

        if schema:
            self.settings = self.get_settings(schema)
            self.settings.bind(key, self.switch, "active", Gio.SettingsBindFlags.DEFAULT)

