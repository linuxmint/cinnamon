#!/usr/bin/python3

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk, GObject
from PIL import Image

class EyeDropper(Gtk.HBox):
    __gsignals__ = {
        'color-picked': (GObject.SignalFlags.RUN_LAST, None, (GObject.TYPE_STRING,))
    }

    def __init__(self):
        Gtk.HBox.__init__ (self)

        self.button = Gtk.Button("")
        self.button.set_tooltip_text(_("Click the eyedropper, then click a color anywhere on your screen to select that color"))
        self.button.set_image(Gtk.Image().new_from_stock(Gtk.STOCK_COLOR_PICKER, Gtk.IconSize.BUTTON))
        self.button.get_property('image').show()
        self.button.set_events(Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.POINTER_MOTION_HINT_MASK)

        self.pack_start(self.button, False, False, 2)

        self.bp_handler = None
        self.br_handler = None
        self.kp_handler = None

        self.button.connect("clicked", self.on_button_clicked)

    def on_button_clicked(self, widget):
        screen = widget.get_screen()
        self.time = Gtk.get_current_event_time()
        self.device = Gtk.get_current_event_device()

        self.grab_widget = Gtk.Window(Gtk.WindowType.POPUP)
        self.grab_widget.set_screen(screen)
        self.grab_widget.resize(1, 1)
        self.grab_widget.move(-100, -100)
        self.grab_widget.show()

        self.grab_widget.add_events(Gdk.EventMask.BUTTON_RELEASE_MASK | Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.POINTER_MOTION_MASK)
        toplevel = widget.get_toplevel()

        if isinstance(toplevel, Gtk.Window):
            if toplevel.has_group():
                toplevel.add_window(grab_widget)

        window = self.grab_widget.get_window()

        picker_cursor = Gdk.Cursor(screen.get_display(), Gdk.CursorType.CROSSHAIR)

        grab_status = self.device.grab(window, Gdk.GrabOwnership.APPLICATION, False,
                                       Gdk.EventMask.BUTTON_RELEASE_MASK | Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.POINTER_MOTION_MASK,
                                       picker_cursor, self.time)

        if grab_status != Gdk.GrabStatus.SUCCESS:
            return

        Gtk.device_grab_add(self.grab_widget, self.device, True)

        self.bp_handler = self.grab_widget.connect("button-press-event", self.mouse_press)
        self.kp_handler = self.grab_widget.connect("key-press-event", self.key_press)

    def mouse_press(self, widget, event):
        if event.type == Gdk.EventType.BUTTON_PRESS and event.button == 1:
            self.br_handler = widget.connect("button-release-event", self.mouse_release)
            return True
        return False

    def key_press(self, widget, event):
        screen, x_root, y_root = self.device.get_position()
        if event.keyval == Gdk.KEY_Escape:
            self.ungrab(self.device)
            return True
        elif event.keyval in (Gdk.KEY_space, Gdk.KEY_Return, Gdk.KEY_ISO_Enter, Gdk.KEY_KP_Enter, Gdk.KEY_KP_Space):
            self.grab_color_at_pointer(event, screen, x_root, y_root)
            return True
        return False

    def mouse_release(self, widget, event):
        screen, x, y = self.device.get_position()
        if event.button != 1:
            return False
        self.grab_color_at_pointer(event, screen, event.x_root, event.y_root)
        return True

    def grab_color_at_pointer(self, event, screen, x_root, y_root):
        device = self.device
        window = screen.get_root_window()
        pixbuf = Gdk.pixbuf_get_from_window(window, x_root, y_root, 1, 1)
        image = pixbuf2Image(pixbuf)

        r, g, b = image.getpixel((0, 0))

        color = Gdk.RGBA()
        color.red = r / 255.0
        color.green = g / 255.0
        color.blue = b / 255.0
        self.emit('color-picked', color.to_string())
        self.ungrab(device)

    def ungrab(self, device):
        device.ungrab(self.time)
        Gtk.device_grab_remove(self.grab_widget, device)
        self.grab_widget.handler_disconnect(self.bp_handler)
        self.grab_widget.handler_disconnect(self.br_handler)
        self.grab_widget.handler_disconnect(self.kp_handler)

def pixbuf2Image(pb):
    width,height = pb.get_width(),pb.get_height()
    return Image.fromstring("RGB",(width,height),pb.get_pixels() )
