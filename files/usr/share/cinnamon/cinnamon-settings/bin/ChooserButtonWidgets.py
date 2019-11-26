#!/usr/bin/python3

from gi.repository import Gtk, GObject, GLib, Gdk, GdkPixbuf, Gio
import cairo
import tweenEquations
import os
import math
import gettext
import datetime
gettext.install("cinnamon", "/usr/share/locale")

TWEEN_SHAPES = ["Quad", "Cubic", "Quart", "Quint", "Sine", "Expo", "Circ", "Elastic", "Back", "Bounce"]
TWEEN_DIRECTIONS = ["In", "Out", "InOut", "OutIn"]
EFFECT_STYLE_NAMES = {
    "none":         _("None"),
    "scale":        _("Scale"),
    "fade":         _("Fade"),
    "blend":        _("Blend"),
    "move":         _("Move"),
    "flyUp":        _("Fly up"),
    "flyDown":      _("Fly down"),
    "traditional":  _("Traditional")
}

PREVIEW_HEIGHT = 48
PREVIEW_WIDTH = 96
ANIMATION_DURATION = 800
ANIMATION_FRAME_RATE = 20

class BaseChooserButton(Gtk.Button):
    def __init__ (self, has_button_label=False):
        super(BaseChooserButton, self).__init__()
        self.set_valign(Gtk.Align.CENTER)
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
    def __init__ (self, num_cols=4, button_picture_size=24, menu_pictures_size=24, has_button_label=False, keep_square=False):
        super(PictureChooserButton, self).__init__(has_button_label)
        self.num_cols = num_cols
        self.scale = self.get_scale_factor()
        self.button_picture_size = button_picture_size
        self.menu_pictures_size = menu_pictures_size
        self.keep_square = keep_square
        self.row = 0
        self.col = 0
        self.progress = 0.0

        context = self.get_style_context()
        context.add_class("gtkstyle-fallback")

        self.button_image.set_valign(Gtk.Align.CENTER)
        if self.keep_square:
            self.button_image.set_size_request(button_picture_size / self.scale, button_picture_size / self.scale)
        else:
            self.button_image.set_size_request(-1, button_picture_size / self.scale)

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
        pixbuf = None
        message = ""

        if os.path.exists(path):
            try:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
            except GLib.Error as e:
                message = "Could not load pixbuf from '%s': %s" % (path, e.message)
                error = True

            if pixbuf != None:
                h = pixbuf.get_height()
                w = pixbuf.get_width()

                if (self.keep_square and (h > self.button_picture_size or w > self.button_picture_size)):
                    try:
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, self.button_picture_size * self.scale, self.button_picture_size * self.scale)
                    except GLib.Error as e:
                        message = "Could not scale pixbuf from '%s': %s" % (path, e.message)
                        error = True
                elif h > self.button_picture_size:
                    try:
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, -1, self.button_picture_size * self.scale)
                    except GLib.Error as e:
                        message = "Could not scale pixbuf from '%s': %s" % (path, e.message)
                        error = True

        if pixbuf:
            surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, self.scale)
            self.button_image.set_from_surface(surface)
        else:
            print(message)
            self.set_picture_from_file("/usr/share/cinnamon/faces/user-generic.png")

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
        pixbuf = None
        if os.path.exists(path):
            try:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
            except GLib.Error as e:
                message = "Could not load pixbuf from '%s': %s" % (path, e.message)
                error = True

            if pixbuf != None:
                h = pixbuf.get_height()
                w = pixbuf.get_width()

                try:
                    if self.menu_pictures_size is None:
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, w, h)
                    else:
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, -1, self.menu_pictures_size)
                except GLib.Error as e:
                    print('Caught GLib.Error exception: {}\npath: {}'.format(e, str(path)))

                if pixbuf is None:
                    return

                surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, self.scale)
                image = Gtk.Image()
                image.set_size_request(self.menu_pictures_size / self.scale, self.menu_pictures_size / self.scale)
                image.set_from_surface(surface)
                menuitem = Gtk.MenuItem()
                if title is not None:
                    vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
                    vbox.add(image)
                    label = Gtk.Label()
                    label.set_text(title)
                    vbox.add(label)
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

    def __init__(self, follow_current=False, date=None):
        super(DateChooserButton, self).__init__()

        if not follow_current and date is not None:
            self.set_date(date)
        else:
            self.set_date(datetime.date.today())

        if follow_current:
            GLib.timeout_add_seconds(1, self.update_date)

        self.connect("clicked", self.on_button_clicked)

    def on_button_clicked(self, *args):
        self.dialog = Gtk.Dialog(transient_for=self.get_toplevel(),
                                 title=_("Select a date"),
                                 flags=Gtk.DialogFlags.MODAL,
                                 buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                          Gtk.STOCK_OK, Gtk.ResponseType.OK))

        content = self.dialog.get_content_area()
        content.props.margin_start = 20
        content.props.margin_end = 20
        content.props.margin_top = 20
        content.props.margin_bottom = 20
        content.props.spacing = 15

        today = Gtk.Button(label=_("Today"))
        today.props.halign = Gtk.Align.CENTER
        content.pack_start(today, False, False, 0)

        calendar = Gtk.Calendar()
        content.pack_start(calendar, True, True, 0)
        calendar.select_month(self.date.month-1, self.date.year)
        calendar.select_day(self.date.day)

        def select_today(*args):
            date = datetime.date.today()
            calendar.select_month(date.month - 1, date.year)
            calendar.select_day(date.day)
        today.connect("clicked", select_today)

        content.show_all()

        response = self.dialog.run()

        if response == Gtk.ResponseType.OK:
            date = calendar.get_date()
            self.set_date(datetime.date(date[0], date[1]+1, date[2])) # Gtk.Calendar uses 0 based month
            self.emit("date-changed", self.date.year, self.date.month, self.date.day)

        self.dialog.destroy()

    def update_date(self, *args):
        self.set_date(datetime.date.today())
        return True

    def get_date(self):
        return self.date

    def set_date(self, date):
        """Sets the date of the widget.
        Date can be a date or datetime class from the datetime module or a (y,m,d) tuple.
        """
        if isinstance(date, datetime.date):
            self.date = date
        elif isinstance(date, datetime.datetime):
            self.date = date.date()
        elif isinstance(date, tuple):
            self.date = datetime.date(*date)
        else:
            raise ValueError('Invalid date format. Date must be of type datetime.date, datetime.datetime, or a tuple of the form (year, month, day)')

        date_string = self.date.strftime(_("%A %B %-e, %Y"))
        self.set_label(date_string)

class TimeChooserButton(Gtk.Button):
    __gsignals__ = {
        'time-changed': (GObject.SignalFlags.RUN_FIRST, None, (int,int,int))
    }

    def __init__(self, follow_current=False, time=None, show_seconds='default'):
        super(TimeChooserButton, self).__init__()

        if show_seconds is 'default':
            self.show_seconds_override_default = False
        else:
            self.show_seconds_override_default = True
            if show_seconds is 'true':
                self.show_seconds = True
            elif show_seconds is 'false':
                self.show_seconds = False
            else:
                raise ValueError('Invalid argument: show_seconds must be default, true, or false')

        self.settings = Gio.Settings.new('org.cinnamon.desktop.interface')

        if not follow_current and time is not None:
            self.set_time(time)
        else:
            self.set_time(datetime.datetime.now().time())

        if follow_current:
            GLib.timeout_add_seconds(1, self.update_time)

        self.connect('clicked', self.on_button_clicked)

    def get_uses_seconds(self):
        if self.show_seconds_override_default:
            return self.show_seconds
        else:
            return self.settings.get_boolean('clock-show-seconds')

    def on_button_clicked(self, *args):
        dialog = TimeChooserDialog(self.time, self.get_toplevel(), self.get_uses_seconds(), self.settings.get_boolean('clock-use-24h'))

        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            self.set_time(dialog.get_time())
            self.emit("time-changed", self.time.hour, self.time.minute, self.time.second)

        dialog.destroy()

    def update_time(self, *args):
        self.set_time(datetime.datetime.now().time())
        return True

    def get_time(self):
        return self.time

    def set_time(self, time):
        """Sets the time of the widget.
        Time can be a time or datetime class from the datetime module or a (h,m) or (h,m,s) tuple.
        """
        if isinstance(time, datetime.time):
            self.time = time
        elif isinstance(time, datetime.datetime):
            self.time = time.time()
        elif isinstance(time, tuple):
            self.time = datetime.time(*time)
        else:
            raise ValueError('Invalid time format. Must be of type datetime.time, datetime.datetime, or a tuple of the form (hour, minute[, second])')

        self.update_label()

    def update_label(self):
        if self.settings.get_boolean('clock-use-24h'):
            if self.get_uses_seconds():
                format_code = gettext.dgettext('cinnamon-desktop', '%R:%S')
            else:
                format_code = gettext.dgettext('cinnamon-desktop', '%R')
        else:
            if self.get_uses_seconds():
                format_code = gettext.dgettext('cinnamon-desktop', '%l:%M:%S %p')
            else:
                format_code = gettext.dgettext('cinnamon-desktop', '%l:%M %p')
        time_string = self.time.strftime(format_code)
        self.set_label(time_string)

class TimeChooserDialog(Gtk.Dialog):
    def __init__(self, time, window, use_seconds, use24hour):
        super(TimeChooserDialog, self).__init__(title = _("Select a time"),
                                                transient_for = window,
                                                flags = Gtk.DialogFlags.MODAL,
                                                buttons = (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                                         Gtk.STOCK_OK, Gtk.ResponseType.OK))

        self.time = {'hour': time.hour, 'minute': time.minute, 'second': time.second}
        self.use_seconds = use_seconds
        self.use24hour = use24hour
        self.markup = lambda text: '<span weight="bold" size="xx-large">%s</span>' % text

        content = self.get_content_area()

        grid = Gtk.Grid(halign=Gtk.Align.CENTER)
        content.pack_start(grid, False, False, 0)

        grid.attach(Gtk.Label(self.markup(_("Hour")), use_markup=True), 0, 0, 1, 1)
        grid.attach(Gtk.Label(self.markup(':'), use_markup=True), 1, 2, 1, 1)
        grid.attach(Gtk.Label(self.markup(_("Minute")), use_markup=True), 2, 0, 1, 1)

        unit_defs = [('hour', 0), ('minute', 2)]

        if self.use_seconds:
            grid.attach(Gtk.Label(self.markup(':'), use_markup=True), 3, 2, 1, 1)
            grid.attach(Gtk.Label(self.markup(_("Second")), use_markup=True), 4, 0, 1, 1)
            unit_defs.append(('second', 4))

        self.labels = {}
        for ttype, column in unit_defs:
            self.labels[ttype] = Gtk.Label(self.markup(self.time[ttype]), use_markup=True)
            grid.attach(self.labels[ttype], column, 2, 1, 1)

            up_button = Gtk.Button.new_from_icon_name('pan-up-symbolic', 6)
            down_button = Gtk.Button.new_from_icon_name('pan-down-symbolic', 6)
            up_button.set_relief(2)
            down_button.set_relief(2)
            grid.attach(up_button, column, 1, 1, 1)
            grid.attach(down_button, column, 3, 1, 1)
            up_button.connect('clicked', self.shift_time, ttype, 1)
            down_button.connect('clicked', self.shift_time, ttype, -1)

        content.show_all()

    def shift_time(self, button, ttype, offset):
        self.time[ttype] += offset
        self.time['hour'] = self.time['hour'] % 24
        self.time['minute'] = self.time['minute'] % 60
        self.time['second'] = self.time['second'] % 60
        self.labels[ttype].set_label(self.markup(self.time[ttype]))

    def get_time(self):
        return datetime.time(self.time['hour'], self.time['minute'], self.time['second'])

def draw_window(context, x, y, color, alpha = 1, scale = 1):
    if scale <= 0:
        return
    alpha = min(max(alpha, 0), 1)

    context.set_source_rgba(color.red, color.green, color.blue, alpha)
    context.save()
    context.translate(x, y)
    context.scale(scale, scale)

    context.rectangle(-PREVIEW_WIDTH / 4., -PREVIEW_HEIGHT / 4., PREVIEW_WIDTH / 2., PREVIEW_HEIGHT / 2.)
    context.fill()
    context.restore()

# The following classes contain the functions to draw effect previews. To add a new effect,
# you will only need to include the draw_preview function. To provide an animation preview,
# you will also need to include the animate fuction. You will also need to add your new effect
# to EFFECT_STYLES_NAME above
class none(object):
    def draw_preview(self, context, x, y, color):
        draw_window(context, x, y, color, 1.)

class scale(object):
    def draw_preview(self, context, x, y, color):
        steps = 3
        for i in range(steps):
            draw_window(context, x, y, color, (steps - i) * 1. / steps, (i + 1.) / steps)

    def animate(self, context, x, y, percent_complete, color):
        scale = 1 - percent_complete
        draw_window(context, x, y, color, scale=scale)

class fade(object):
    def draw_preview(self, context, x, y, color):
        draw_window(context, x, y, color, .5)

    def animate(self, context, x, y, percent_complete, color):
        alpha = 1 - percent_complete
        draw_window(context, x, y, color, alpha=alpha)

class blend(object):
    def draw_preview(self, context, x, y, color):
        steps = 3
        for i in range(steps):
            draw_window(context, x, y, color, (steps - i) * 1. / steps, 1 + i / (steps - 1.) / 2)

    def animate(self, context, x, y, percent_complete, color):
        scale = 1 + percent_complete / 2
        alpha = 1 - percent_complete
        draw_window(context, x, y, color, alpha=alpha, scale=scale)

class traditional(object):
    def draw_preview(self, context, x, y, color):
        gradient = cairo.LinearGradient(x, y * 2, x, y)
        gradient.add_color_stop_rgba(0, color.red, color.green, color.blue, 0)
        gradient.add_color_stop_rgb(1, color.red, color.green, color.blue)
        context.set_source(gradient)
        context.move_to(x, y * 2)
        context.line_to(x * 1.5, y * 1.5)
        context.line_to(x * 1.5, y * .5)
        context.line_to(x * .5, y * .5)
        context.line_to(x * .5, y * 1.5)
        context.fill()

    def animate(self, context, x, y, percent_complete, color):
        y *= 1 + percent_complete
        scale = 1 - percent_complete
        alpha = 1 - percent_complete
        draw_window(context, x, y, color, alpha=alpha, scale=scale)

class move(object):
    def draw_preview(self, context, x, y, color):
        gradient = cairo.LinearGradient(0, 0, x, y)
        gradient.add_color_stop_rgba(0, color.red, color.green, color.blue, 0)
        gradient.add_color_stop_rgb(1, color.red, color.green, color.blue)
        context.set_source(gradient)
        context.move_to(x / 5, y / 5)
        context.line_to(x * 1.5, y * .5)
        context.line_to(x * 1.5, y * 1.5)
        context.line_to(x * .5, y * 1.5)
        context.fill()

    def animate(self, context, x, y, percent_complete, color):
        remain = 1 - percent_complete
        draw_window(context, x*remain, y*remain, color, scale=remain)

class flyUp(object):
    def draw_preview(self, context, x, y, color):
        gradient = cairo.LinearGradient(0, y * 2, 0, y * 1.5)
        gradient.add_color_stop_rgba(0, color.red, color.green, color.blue, 0)
        gradient.add_color_stop_rgb(1, color.red, color.green, color.blue)
        context.set_source(gradient)
        context.rectangle(x / 2, y / 2, x, y * 1.5)
        context.fill()

    def animate(self, context, x, y, percent_complete, color):
        y *= 1 - percent_complete * 1.5
        draw_window(context, x, y, color)

class flyDown(object):
    def draw_preview(self, context, x, y, color):
        gradient = cairo.LinearGradient(0, 0, 0, y / 2)
        gradient.add_color_stop_rgba(0, color.red, color.green, color.blue, 0)
        gradient.add_color_stop_rgb(1, color.red, color.green, color.blue)
        context.set_source(gradient)
        context.rectangle(x / 2, 0, x, y * 1.5)
        context.fill()

    def animate(self, context, x, y, percent_complete, color):
        y *= 1 + percent_complete * 1.5
        draw_window(context, x, y, color)

# a button to select tweens
class TweenChooserButton(BaseChooserButton):
    __gproperties__ = {
        "tween": (str,
                  "tween value",
                  "Value of the selected tween",
                  None,
                  GObject.ParamFlags.READWRITE)
    }

    def __init__(self):
        super(TweenChooserButton, self).__init__()

        self.tween = ""

        self.set_size_request(128, -1)

        self.build_menuitem("None", 0, 0)

        row = 1
        for suffix in TWEEN_SHAPES:
            col = 0
            for prefix in TWEEN_DIRECTIONS:
                self.build_menuitem(prefix + suffix, col, row)
                col += 1
            row += 1

    def build_menuitem(self, name, col, row):
        menuitem = TweenMenuItem("ease" + name)
        menuitem.connect("activate", self.change_value)
        self.menu.attach(menuitem, col, col + 1, row, row + 1)

    def change_value(self, widget):
        self.props.tween = widget.tween_type

    def do_get_property(self, prop):
        if prop.name == 'tween':
            return self.tween
        else:
            raise AttributeError('unknown property %s' % prop.name)

    def do_set_property(self, prop, value):
        if prop.name == 'tween':
            if value != self.tween:
                self.tween = value
                self.set_label(self.tween)
        else:
            raise AttributeError('unknown property %s' % prop.name)

# menu item for TweenChooserButton
class TweenMenuItem(Gtk.MenuItem):
    def __init__(self, tween_type):
        super(TweenMenuItem, self).__init__()

        self.animating = False
        self.timer = None

        self.tween_type = tween_type
        self.tween_function = getattr(tweenEquations, tween_type)

        self.vbox = Gtk.VBox()
        self.add(self.vbox)

        box = Gtk.Box()
        self.vbox.add(box)

        self.graph = Gtk.DrawingArea()
        box.add(self.graph)
        self.graph.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT)
        self.graph.connect("draw", self.draw_graph)

        self.arrow = Gtk.DrawingArea()
        box.pack_end(self.arrow, False, False, 0)
        self.arrow.set_size_request(5, PREVIEW_HEIGHT)
        self.arrow.connect("draw", self.draw_arrow)

        self.connect("enter-notify-event", self.start_animation)
        self.connect("leave-notify-event", self.stop_animation)

        label = Gtk.Label()
        self.vbox.add(label)
        label.set_text(tween_type)

    def draw_graph(self, widget, context):
        width = PREVIEW_WIDTH - 2.
        height = PREVIEW_HEIGHT / 8.

        style = widget.get_style_context()
        if self.animating:
            color = style.get_background_color(Gtk.StateFlags.SELECTED)
        else:
            color = style.get_color(Gtk.StateFlags.NORMAL)
        context.set_source_rgb(color.red, color.green, color.blue)

        context.move_to(1, height * 6)
        for i in range(int(width)):
            value = self.tween_function(i + 1., height * 6, -height * 4, width)
            context.line_to(i + 2, value)
        context.stroke()

    def draw_arrow(self, widget, context):
        if not self.animating:
            return
        height = PREVIEW_HEIGHT / 8.

        style = widget.get_style_context()
        color = style.get_color(Gtk.StateFlags.NORMAL)
        context.set_source_rgb(color.red, color.green, color.blue)

        value = self.tween_function(self.elapsed/ANIMATION_DURATION, height * 6, -height * 4, 1)
        context.arc(5, value, 5, math.pi / 2, math.pi * 1.5)
        context.fill()

    def start_animation(self, *args):
        self.animating = True
        self.elapsed = 0
        self.arrow.queue_draw()
        self.graph.queue_draw()

        self.timer = GLib.timeout_add(ANIMATION_FRAME_RATE, self.advance_animation)

    def stop_animation(self, *args):
        self.animating = False
        if self.timer:
            GLib.source_remove(self.timer)
            self.timer = None

        self.arrow.queue_draw()
        self.graph.queue_draw()

    def advance_animation(self):
        self.elapsed += ANIMATION_FRAME_RATE
        if self.elapsed >= ANIMATION_DURATION:
            self.timer = None
            return False
            # self.stop_animation()
        self.arrow.queue_draw()

        return True

# a button to select effect types
class EffectChooserButton(BaseChooserButton):
    __gproperties__ = {
        "effect": (str,
                   "effect value",
                   "Value of the selected effect",
                   None,
                   GObject.ParamFlags.READWRITE)
    }

    def __init__(self, effect_styles=None):
        super(EffectChooserButton, self).__init__()

        self.effect = ""
        self.effect_styles = ["none", "scale"] if effect_styles == None else effect_styles

        self.set_size_request(128, -1)

        row = 0
        col = 0
        for option in self.effect_styles:
            self.build_menuitem(option, col, row)
            col += 1
            if col >= 4:
                col = 0
                row += 1

    def build_menuitem(self, effect_type, col, row):
        # apply the specific effect type methods onto the base effect type menu item
        EffectTypeMenuItem = type(effect_type+"MenuItem",
                                  (globals()[effect_type], EffectMenuItem),
                                  {"effect_type": effect_type})
        menuitem = EffectTypeMenuItem()
        menuitem.connect("activate", self.change_value)
        self.menu.attach(menuitem, col, col + 1, row, row + 1)

    def change_value(self, widget):
        self.props.effect = widget.effect_type

    def do_get_property(self, prop):
        if prop.name == 'effect':
            return self.effect
        else:
            raise AttributeError('unknown property %s' % prop.name)

    def do_set_property(self, prop, value):
        if prop.name == 'effect':
            if value != self.effect:
                self.effect = value
                self.set_label(EFFECT_STYLE_NAMES[self.effect])
        else:
            raise AttributeError('unknown property %s' % prop.name)

# menu item for TweenChooserButton
class EffectMenuItem(Gtk.MenuItem):
    def __init__(self):
        super(EffectMenuItem, self).__init__()

        self.animating = False
        self.timer = None

        self.drawing = Gtk.DrawingArea()
        self.drawing.connect("draw", self.draw)
        self.drawing.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT)
        self.style = self.drawing.get_style_context()

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.add(box)

        self.connect("enter-notify-event", self.start_animation)
        self.connect("leave-notify-event", self.stop_animation)
        box.add(self.drawing)

        label = Gtk.Label()
        box.add(label)
        label.set_text(EFFECT_STYLE_NAMES[self.effect_type])

    def start_animation(self, *args):
        if not hasattr(self, "animate"):
            return
        self.animating = True
        self.elapsed = 0
        self.drawing.queue_draw()

        self.timer = GLib.timeout_add(ANIMATION_FRAME_RATE, self.advance_animation)

    def stop_animation(self, *args):
        self.animating = False
        if self.timer:
            GLib.source_remove(self.timer)
            self.timer = None

        self.drawing.queue_draw()

    def advance_animation(self):
        if self.elapsed > ANIMATION_DURATION:
            self.stop_animation()
        self.elapsed += ANIMATION_FRAME_RATE
        self.drawing.queue_draw()

        return True

    def draw(self, widget, context):
        x = PREVIEW_WIDTH / 2.
        y = PREVIEW_HEIGHT / 2.
        color = self.get_color()

        if self.animating:
            percent_complete = self.elapsed / ANIMATION_DURATION
            self.animate(context, x, y, percent_complete, color)
        else:
            self.draw_preview(context, x, y, color)
        #     value = self.transition(self.state % self.duration, 0, 1, self.duration - 1)

    def get_color(self):
        if self.animating:
            return self.style.get_color(Gtk.StateFlags.NORMAL)
        return self.style.get_background_color(Gtk.StateFlags.SELECTED)
