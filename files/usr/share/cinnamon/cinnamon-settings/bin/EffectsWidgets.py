from __future__ import division
from gi.repository import Gtk, GObject
import cairo
import tweenEquations
import math
import gettext
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
class TweenChooserButton(Gtk.Button):
    __gproperties__ = {
        "tween": (str,
                  "tween value",
                  "Value of the selected tween",
                  None,
                  GObject.PARAM_READWRITE)
    }

    def __init__(self):
        super(TweenChooserButton, self).__init__()

        self.tween = ""

        self.menu = Gtk.Menu()
        self.connect("button-release-event", self.on_button_clicked)

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

        self.timer = GObject.timeout_add(ANIMATION_FRAME_RATE, self.advance_animation)

    def stop_animation(self, *args):
        self.animating = False
        if self.timer:
            GObject.source_remove(self.timer)
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
class EffectChooserButton(Gtk.Button):
    __gproperties__ = {
        "effect": (str,
                  "effect value",
                  "Value of the selected effect",
                  None,
                  GObject.PARAM_READWRITE)
    }

    def __init__(self, effect_styles=None):
        super(EffectChooserButton, self).__init__()

        self.effect = ""
        self.effect_styles = ["none", "scale"] if effect_styles == None else effect_styles

        self.menu = Gtk.Menu()
        self.connect("button-release-event", self.on_button_clicked)

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

        self.timer = GObject.timeout_add(ANIMATION_FRAME_RATE, self.advance_animation)

    def stop_animation(self, *args):
        self.animating = False
        if self.timer:
            GObject.source_remove(self.timer)
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
