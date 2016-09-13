#!/usr/bin/env python2

import math
import os
import subprocess
import traceback

import dbus
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('CDesktopEnums', '3.0')
gi.require_version('CinnamonDesktop', '3.0')
from gi.repository import Gio, Gtk, GObject, Gdk, GLib, GdkPixbuf, CDesktopEnums, CinnamonDesktop

import EffectsWidgets
from KeybindingWidgets import ButtonKeybinding

settings_objects = {}

CAN_BACKEND = ["Switch", "SpinButton", "Entry", "TextView", "FontButton", "Range", "ComboBox",
               "ColorChooser", "FileChooser", "SoundFileChooser", "IconChooser", "TweenChooser",
               "EffectChooser", "DateChooser", "Keybinding"]

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

class DateChooserButton(Gtk.Button):
    __gsignals__ = {
        'date-changed': (GObject.SignalFlags.RUN_FIRST, None, (int,int,int))
    }

    def __init__(self):
        super(DateChooserButton, self).__init__()

        self.year, self.month, self.day = GLib.DateTime.new_now_local().get_ymd()

        self.connect("clicked", self.on_button_clicked)

    def on_button_clicked(self, *args):
        self.dialog = Gtk.Dialog(transient_for=self.get_toplevel(),
                                 title=_("Select a date"),
                                 flags=Gtk.DialogFlags.MODAL,
                                 buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                          Gtk.STOCK_OK, Gtk.ResponseType.OK))

        content = self.dialog.get_content_area()

        calendar = Gtk.Calendar()
        content.pack_start(calendar, True, True, 0)
        calendar.select_month(self.month-1, self.year)
        calendar.select_day(self.day)

        def select_today(*args):
            date = GLib.DateTime.new_now_local().get_ymd()
            calendar.select_month(date[1]-1, date[0])
            calendar.select_day(date[2])

        today = Gtk.Button(label=_("Today"))
        today.connect("clicked", select_today)
        content.pack_start(today, False, False, 0)

        content.show_all()

        response = self.dialog.run()

        if response == Gtk.ResponseType.OK:
            date = calendar.get_date()
            self.set_date(date[0], date[1]+1, date[2]) #calendar uses 0 based month
            self.emit("date-changed", self.year, self.month, self.day)

        self.dialog.destroy()

    def get_date(self):
        return self.year, self.month, self.day

    def set_date(self, year, month, day):
        self.year = year
        self.month = month
        self.day = day

        date = GLib.DateTime.new_local(year, month, day, 1, 1, 1)
        date_string = date.format(_("%B %e, %Y"))
        self.set_label(date_string)

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
        css_data = ".separator { -GtkWidget-wide-separators: 0; \
                                   color: %s;                    \
                               }" % frame_color
        try:
            css_provider.load_from_data(css_data)
        except:
            # we must be using python 3
            css_provider.load_from_data(str.encode(css_data))
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
        if isinstance(widget, Switch):
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
        if isinstance(widget, Switch):
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
            self.set_dep_key(dep_key)

    def set_dep_key(self, dep_key):
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

class Switch(SettingsWidget):
    bind_prop = "active"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, dep_key=None, tooltip=""):
        super(Switch, self).__init__(dep_key=dep_key)

        self.content_widget = Gtk.Switch()
        self.label = Gtk.Label(label)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

    def clicked(self, *args):
        self.content_widget.set_active(not self.content_widget.get_active())

class SpinButton(SettingsWidget):
    bind_prop = "value"
    bind_dir = Gio.SettingsBindFlags.GET

    def __init__(self, label, units="", mini=None, maxi=None, step=1, page=None, size_group=None, dep_key=None, tooltip=""):
        super(SpinButton, self).__init__(dep_key=dep_key)

        self.timer = None

        if units:
            label += " (%s)" % units
        self.label = Gtk.Label.new(label)
        self.content_widget = Gtk.SpinButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        range = self.get_range()
        if mini == None or maxi == None:
            mini = range[0]
            maxi = range[1]
        elif range is not None:
            mini = max(mini, range[0])
            maxi = min(maxi, range[1])

        if not page:
            page = step

        self.content_widget.set_range(mini, maxi)
        self.content_widget.set_increments(step, page)

        digits = 0
        if (step and '.' in str(step)):
            digits = len(str(step).split('.')[1])
        self.content_widget.set_digits(digits)

        self.content_widget.connect("value-changed", self.apply_later)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def apply_later(self, *args):
        def apply(self):
            self.set_value(self.content_widget.get_value())
            self.timer = None

        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(300, apply, self)

class Entry(SettingsWidget):
    bind_prop = "text"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(Entry, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label.new(label)
        self.content_widget = Gtk.Entry()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

class TextView(SettingsWidget):
    bind_prop = "text"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, height=200, dep_key=None, tooltip=""):
        super(TextView, self).__init__(dep_key=dep_key)

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(8)

        self.label = Gtk.Label.new(label)
        self.label.set_halign(Gtk.Align.CENTER)

        self.scrolledwindow = Gtk.ScrolledWindow(hadjustment=None, vadjustment=None)
        self.scrolledwindow.set_size_request(width=-1, height=height)
        self.scrolledwindow.set_policy(hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
                                       vscrollbar_policy=Gtk.PolicyType.AUTOMATIC)
        self.scrolledwindow.set_shadow_type(type=Gtk.ShadowType.ETCHED_IN)
        self.content_widget = Gtk.TextView()
        self.content_widget.set_border_width(3)
        self.content_widget.set_wrap_mode(wrap_mode=Gtk.WrapMode.NONE)
        self.bind_object = self.content_widget.get_buffer()

        self.pack_start(self.label, False, False, 0)
        self.add(self.scrolledwindow)
        self.scrolledwindow.add(self.content_widget)
        self._value_changed_timer = None

class FontButton(SettingsWidget):
    bind_prop = "font-name"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(FontButton, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label.new(label)

        self.content_widget = Gtk.FontButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

class Range(SettingsWidget):
    bind_prop = "value"
    bind_dir = Gio.SettingsBindFlags.GET | Gio.SettingsBindFlags.NO_SENSITIVITY

    def __init__(self, label, min_label="", max_label="", mini=None, maxi=None, step=None, invert=False, log=False, dep_key=None, tooltip=""):
        super(Range, self).__init__(dep_key=dep_key)

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)

        self.log = log
        self.invert = invert
        self.timer = None
        self.value = 0

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

        range = self.get_range()
        if mini == None or maxi == None:
            mini = range[0]
            maxi = range[1]
        elif range is not None:
            mini = max(mini, range[0])
            maxi = min(maxi, range[1])

        if log:
            mini = math.log(mini)
            maxi = math.log(maxi)
            self.map_get = lambda x: math.log(x)
            self.map_set = lambda x: math.exp(x)

        if step is None:
            self.step = (maxi - mini) * 0.02
        else:
            self.step = math.log(step) if log else step

        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, mini, maxi, self.step)
        self.content_widget.set_inverted(invert)
        self.content_widget.set_draw_value(False)
        self.bind_object = self.content_widget.get_adjustment()

        if invert:
            self.step *= -1 # Gtk.Scale.new_with_range want a positive value, but our custom scroll handler wants a negative value

        hbox.pack_start(self.min_label, False, False, 0)
        hbox.pack_start(self.content_widget, True, True, 0)
        hbox.pack_start(self.max_label, False, False, 0)

        self.pack_start(self.label, False, False, 0)
        self.pack_start(hbox, True, True, 6)

        self.content_widget.connect("scroll-event", self.on_scroll_event)
        self.content_widget.connect("value-changed", self.apply_later)

        self.set_tooltip_text(tooltip)

    def apply_later(self, *args):
        def apply(self):
            if self.log:
                self.set_value(math.exp(self.content_widget.get_value()))
            else:
                self.set_value(self.content_widget.get_value())
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

    def set_rounding(self, digits):
        if not self.log:
            self.content_widget.set_round_digits(digits)

class ComboBox(SettingsWidget):
    bind_dir = None

    def __init__(self, label, options=[], valtype="string", size_group=None, dep_key=None, tooltip=""):
        super(ComboBox, self).__init__(dep_key=dep_key)

        self.valtype = valtype
        self.option_map = {}

        self.label = Gtk.Label.new(label)

        selected = None

        self.content_widget = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_options(options)
        self.content_widget.connect('changed', self.on_my_value_changed)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.value = self.model[tree_iter][0]
            self.set_value(self.value)

    def on_setting_changed(self, *args):
        self.value = self.get_value()
        try:
            self.content_widget.set_active_iter(self.option_map[self.value])
        except:
            self.content_widget.set_active_iter(None)

    def set_options(self, options):
        # assume all keys are the same type (mixing types is going to cause an error somewhere)
        var_type = type(options[0][0])
        self.model = Gtk.ListStore(var_type, str)

        for option in options:
            self.option_map[option[0]] = self.model.append([option[0], option[1]])

        self.content_widget.set_model(self.model)
        self.content_widget.set_id_column(0)

class ColorChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, legacy_string=False, size_group=None, dep_key=None, tooltip=""):
        super(ColorChooser, self).__init__(dep_key=dep_key)
        # note: Gdk.Color is deprecated in favor of Gdk.RGBA, but as the hex format is still used
        # in some places (most notably the desktop background handling in cinnamon-desktop) we
        # still support it for now by adding the legacy_string argument
        self.legacy_string = legacy_string

        self.label = Gtk.Label(label)
        self.content_widget = Gtk.ColorButton()
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.content_widget.connect('color-set', self.on_my_value_changed)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def on_setting_changed(self, *args):
        color_string = self.get_value()
        rgba = Gdk.RGBA()
        rgba.parse(color_string)
        self.content_widget.set_rgba(rgba)

    def on_my_value_changed(self, widget):
        if self.legacy_string:
            color_string = self.content_widget.get_color().to_string()
        else:
            color_string = self.content_widget.get_rgba().to_string()
        self.set_value(color_string)

class FileChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, dir_select=False, size_group=None, dep_key=None, tooltip=""):
        super(FileChooser, self).__init__(dep_key=dep_key)
        if dir_select:
            action = Gtk.FileChooserAction.SELECT_FOLDER
        else:
            action = Gtk.FileChooserAction.OPEN

        self.label = Gtk.Label(label)
        self.content_widget = Gtk.FileChooserButton(action=action)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.content_widget.connect("file-set", self.on_file_selected)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def on_file_selected(self, *args):
        self.set_value(self.content_widget.get_uri())

    def on_setting_changed(self, *args):
        self.content_widget.set_uri(self.get_value())

class SoundFileChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(SoundFileChooser, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label(label)
        self.content_widget = Gtk.Box()

        c = self.content_widget.get_style_context()
        c.add_class(Gtk.STYLE_CLASS_LINKED)

        self.file_picker_button = Gtk.Button()
        self.file_picker_button.connect("clicked", self.on_picker_clicked)

        button_content = Gtk.Box(spacing=5)
        self.file_picker_button.add(button_content)

        self.button_label = Gtk.Label()
        button_content.pack_start(Gtk.Image(icon_name="sound"), False, False, 0)
        button_content.pack_start(self.button_label, False, False, 0)

        self.content_widget.pack_start(self.file_picker_button, True, True, 0)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.play_button = Gtk.Button()
        self.play_button.set_image(Gtk.Image.new_from_stock("gtk-media-play", Gtk.IconSize.BUTTON))
        self.play_button.connect("clicked", self.on_play_clicked)
        self.content_widget.pack_start(self.play_button, False, False, 0)

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

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def _on_proxy_ready (self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)

    def on_play_clicked(self, widget):
        self._proxy.PlaySoundFile("(us)", 0, self.get_value())

    def on_picker_clicked(self, widget):
        dialog = Gtk.FileChooserDialog(title=self.label.get_text(),
                                       action=Gtk.FileChooserAction.OPEN,
                                       transient_for=self.get_toplevel(),
                                       buttons=(_("_Cancel"), Gtk.ResponseType.CANCEL,
                                                _("_Open"), Gtk.ResponseType.ACCEPT))

        dialog.set_filename(self.get_value())

        sound_filter = Gtk.FileFilter()
        sound_filter.add_mime_type("audio/x-wav")
        sound_filter.add_mime_type("audio/x-vorbis+ogg")
        sound_filter.set_name(_("Sound files"))
        dialog.add_filter(sound_filter)

        if (dialog.run() == Gtk.ResponseType.ACCEPT):
            name = dialog.get_filename()
            self.set_value(name)
            self.update_button_label(name)

        dialog.destroy()

    def update_button_label(self, absolute_path):
        f = Gio.File.new_for_path(absolute_path)

        self.button_label.set_label(f.get_basename())

    def on_setting_changed(self, *args):
        self.update_button_label(self.get_value())

class IconChooser(SettingsWidget):
    bind_prop = "text"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(IconChooser, self).__init__(dep_key=dep_key)

        valid, self.width, self.height = Gtk.icon_size_lookup(Gtk.IconSize.BUTTON)

        self.label = Gtk.Label.new(label)

        self.content_widget = Gtk.Box()
        self.bind_object = Gtk.Entry()
        self.image_button = Gtk.Button()

        self.preview = Gtk.Image.new()
        self.image_button.set_image(self.preview)

        self.content_widget.pack_start(self.bind_object, False, False, 2)
        self.content_widget.pack_start(self.image_button, False, False, 5)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.image_button.connect("clicked", self.on_button_pressed)
        self.handler = self.bind_object.connect("changed", self.set_icon)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def set_icon(self, *args):
        val = self.bind_object.get_text()
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
            self.bind_object.set_text(filename)
            self.set_val(filename)

        dialog.destroy()

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

class TweenChooser(SettingsWidget):
    bind_prop = "tween"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(TweenChooser, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label.new(label)

        self.content_widget = EffectsWidgets.TweenChooserButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

class EffectChooser(SettingsWidget):
    bind_prop = "effect"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, possible=None, size_group=None, dep_key=None, tooltip=""):
        super(EffectChooser, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label.new(label)

        self.content_widget = EffectsWidgets.EffectChooserButton(possible)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

class DateChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, size_group=None, dep_key=None, tooltip=""):
        super(DateChooser, self).__init__(dep_key=dep_key)

        self.label = Gtk.Label.new(label)

        self.content_widget = DateChooserButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.set_tooltip_text(tooltip)

        self.content_widget.connect("date-changed", self.on_date_changed)

        if size_group:
            self.add_to_size_group(size_group)

    def on_date_changed(self, *args):
        date = self.content_widget.get_date()
        self.set_value({"y": date[0], "m": date[1], "d": date[2]})

    def on_setting_changed(self, *args):
        date = self.get_value()
        self.content_widget.set_date(date["y"], date["m"], date["d"])

class Keybinding(SettingsWidget):
    bind_dir = None

    def __init__(self, label, num_bind=2, size_group=None, dep_key=None, tooltip=""):
        super(Keybinding, self).__init__(dep_key=dep_key)

        self.num_bind = num_bind

        self.label = Gtk.Label(label)

        self.buttons = []
        self.teach_button = None

        self.content_widget = Gtk.Frame(shadow_type=Gtk.ShadowType.IN)
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self.content_widget.add(box)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        for x in range(self.num_bind):
            if x != 0:
                box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))
            kb = ButtonKeybinding()
            kb.set_size_request(150, -1)
            kb.connect("accel-edited", self.on_kb_changed)
            kb.connect("accel-cleared", self.on_kb_changed)
            box.pack_start(kb, False, False, 0)
            self.buttons.append(kb)

        self.event_id = None
        self.teaching = False

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

    def on_kb_changed(self, *args):
        bindings = []

        for x in range(self.num_bind):
            string = self.buttons[x].get_accel_string()
            bindings.append(string)

        self.set_value("::".join(bindings))

    def on_setting_changed(self, *args):
        value = self.get_value()
        bindings = value.split("::")

        for x in range(min(len(bindings), self.num_bind)):
            self.buttons[x].set_accel_string(bindings[x])

class Button(SettingsWidget):
    def __init__(self, label, callback=None):
        super(Button, self).__init__()
        self.label = label
        self.callback = callback

        self.content_widget = Gtk.Button(label=label)
        self.pack_start(self.content_widget, True, True, 0)
        self.content_widget.connect("clicked", self._on_button_clicked)

    def _on_button_clicked(self, *args):
        if self.callback is not None:
            self.callback(self)
        elif hasattr(self, "on_activated"):
            self.on_activated()
        else:
            print("warning: button '%s' does nothing" % self.label)

    def set_label(self, label):
        self.label = label
        self.content_widget.set_label(label)

class Text(SettingsWidget):
    def __init__(self, label, align=Gtk.Align.START):
        super(Text, self).__init__()
        self.label = label

        self.content_widget = Gtk.Label(label=label, halign=align)
        self.pack_start(self.content_widget, True, True, 0)
