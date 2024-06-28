#!/usr/bin/python3

from gi.repository import Gtk, GObject, GLib, Gdk, GdkPixbuf, Gio
import os
import gettext
import datetime
gettext.install("cinnamon", "/usr/share/locale")

class BaseChooserButton(Gtk.Button):
    def __init__ (self, has_button_label=False, frame=False):
        super(BaseChooserButton, self).__init__()
        self.has_button_label = has_button_label
        self.frame = frame
        self.set_valign(Gtk.Align.CENTER)
        self.menu = Gtk.Menu()
        self.button_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        self.button_image = Gtk.Image()

        if self.frame:
            f = Gtk.Frame(valign=Gtk.Align.END, halign=Gtk.Align.CENTER)
            f.add(self.button_image)
            self.button_box.add(f)
        else:
            self.button_box.add(self.button_image)

        if self.has_button_label:
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
        return x, y, push_in

    def _on_button_clicked(self, widget, event):
        if event.button == 1:
            self.menu.show_all()
            self.menu.popup(None, None, self.popup_menu_below_button, self, event.button, event.time)

class PictureChooserButton(BaseChooserButton):
    def __init__ (self, num_cols=4, button_picture_width=24, menu_picture_width=24, has_button_label=False, keep_square=False, frame=False):
        super(PictureChooserButton, self).__init__(has_button_label, frame)
        self.num_cols = num_cols
        self.scale = self.get_scale_factor()
        self.button_picture_width = button_picture_width
        self.menu_picture_width = menu_picture_width
        self.keep_square = keep_square
        self.row = 0
        self.col = 0
        self.progress = 0.0

        context = self.get_style_context()
        context.add_class("gtkstyle-fallback")

        self.button_image.set_valign(Gtk.Align.CENTER)
        if self.keep_square:
            self.button_image.set_size_request(button_picture_width / self.scale, button_picture_width / self.scale)
        else:
            self.button_image.set_size_request(button_picture_width / self.scale, -1)

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

    def create_scaled_surface(self, path):
        w = self.button_picture_width * self.scale
        h = -1 if not self.keep_square else self.button_picture_width * self.scale

        try:
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, w, h)
            if pixbuf:
                return Gdk.cairo_surface_create_from_pixbuf(pixbuf, self.scale)
        except GLib.Error as e:
            print("Could not load thumbnail file '%s': %s" % (path, e.message))
        return None

    def set_picture_from_file (self, path):
        surface = self.create_scaled_surface(path)
        if surface:
            self.button_image.set_from_surface(surface)
        else:
            self.button_image.set_from_icon_name("user-generic", Gtk.IconSize.BUTTON)

    def set_button_label(self, label):
        if self.has_button_label:
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
        image = Gtk.Image()
        image.set_size_request(self.menu_picture_width / self.scale, -1)

        surface = self.create_scaled_surface(path)

        if surface:
            image.set_from_surface(surface)
        else:
            image.set_from_icon_name("user-generic", Gtk.IconSize.BUTTON)

        if self.frame:
            frame = Gtk.Frame(halign=Gtk.Align.CENTER, valign=Gtk.Align.CENTER)
            frame.add(image)
            menu_image = frame
        else:
            menu_image = image

        menuitem = Gtk.MenuItem()
        if title is not None:
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, valign=Gtk.Align.END)
            vbox.add(menu_image)
            label = Gtk.Label()
            label.set_text(title)
            vbox.add(label)
            menuitem.add(vbox)
        else:
            menuitem.add(menu_image)
        if id is not None:
            menuitem.connect('activate', self._on_picture_selected, path, callback, id)
        else:
            menuitem.connect('activate', self._on_picture_selected, path, callback)
        self.menu.attach(menuitem, self.col, self.col+1, self.row, self.row+1)
        self.col = (self.col+1) % self.num_cols
        if self.col == 0:
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

        # Translators: This is the date which appears in the calendar
        # applet, as a tooltip and as a title header inside the applet.
        # The format uses the strftime syntax.
        # %A, %B %-e, %Y is the American Date format (Saturday, January 4, 2020):
        # %A is the name of the day, %B is the name of the month
        # %-e is the non-padded day number, %Y is the year.
        # for info on the strftime format visit: http://man7.org/linux/man-pages/man3/strftime.3.html
        # for info on international date formats visit: http://www.localeplanet.com/compare/date-pattern.html?pat=FULL
        date_string = self.date.strftime(_("%A, %B %-e, %Y"))
        self.set_label(date_string)

class TimeChooserButton(Gtk.Button):
    __gsignals__ = {
        'time-changed': (GObject.SignalFlags.RUN_FIRST, None, (int,int,int))
    }

    def __init__(self, follow_current=False, time=None, show_seconds='default'):
        super(TimeChooserButton, self).__init__()

        if show_seconds == 'default':
            self.show_seconds_override_default = False
        else:
            self.show_seconds_override_default = True
            if show_seconds == 'true':
                self.show_seconds = True
            elif show_seconds == 'false':
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

            up_button = Gtk.Button.new_from_icon_name('pan-up-symbolic', Gtk.IconSize.DIALOG)
            down_button = Gtk.Button.new_from_icon_name('pan-down-symbolic', Gtk.IconSize.DIALOG)
            up_button.set_relief(Gtk.ReliefStyle.NONE)
            down_button.set_relief(Gtk.ReliefStyle.NONE)
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
