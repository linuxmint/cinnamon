import cairo
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, GObject


class Previews(object):
    def scale(self, ctx, window, x, y, c):
        steps = 3
        for i in range(steps):
            window(ctx, x, y, (steps - i) * 1. / steps, (i + 1.) / steps)

    def fade(self, ctx, window, x, y, c):
        window(ctx, x, y, .5)

    def blend(self, ctx, window, x, y, c):
        steps = 3
        for i in range(steps):
            window(ctx, x, y, (steps - i) * 1. / steps, 1 + i / (steps - 1.) / 2)

    def traditional(self, ctx, window, x, y, c):
        gradient = cairo.LinearGradient(x, y * 2, x, y)
        gradient.add_color_stop_rgba(0, c.red, c.green, c.blue, 0)
        gradient.add_color_stop_rgb(1, c.red, c.green, c.blue)
        ctx.set_source(gradient)
        ctx.move_to(x, y * 2)
        ctx.line_to(x * 1.5, y * 1.5)
        ctx.line_to(x * 1.5, y * .5)
        ctx.line_to(x * .5, y * .5)
        ctx.line_to(x * .5, y * 1.5)
        ctx.fill()

    def move(self, ctx, window, x, y, c):
        gradient = cairo.LinearGradient(0, 0, x, y)
        gradient.add_color_stop_rgba(0, c.red, c.green, c.blue, 0)
        gradient.add_color_stop_rgb(1, c.red, c.green, c.blue)
        ctx.set_source(gradient)
        ctx.move_to(x / 5, y / 5)
        ctx.line_to(x * 1.5, y * .5)
        ctx.line_to(x * 1.5, y * 1.5)
        ctx.line_to(x * .5, y * 1.5)
        ctx.fill()

    def flyUp(self, ctx, window, x, y, c):
        gradient = cairo.LinearGradient(0, y * 2, 0, y * 1.5)
        gradient.add_color_stop_rgba(0, c.red, c.green, c.blue, 0)
        gradient.add_color_stop_rgb(1, c.red, c.green, c.blue)
        ctx.set_source(gradient)
        ctx.rectangle(x / 2, y / 2, x, y * 1.5)
        ctx.fill()

    def flyDown(self, ctx, window, x, y, c):
        gradient = cairo.LinearGradient(0, 0, 0, y / 2)
        gradient.add_color_stop_rgba(0, c.red, c.green, c.blue, 0)
        gradient.add_color_stop_rgb(1, c.red, c.green, c.blue)
        ctx.set_source(gradient)
        ctx.rectangle(x / 2, 0, x, y * 1.5)
        ctx.fill()

class Map(object):
    def scale(self, ctx, window, x, y, value):
        window(ctx, x, y, scale=value)

    def fade(self, ctx, window, x, y, value):
        window(ctx, x, y, value)

    def blend(self, ctx, window, x, y, value):
        scale = 1.5 - value / 2
        window(ctx, x, y, value, scale)

    def move(self, ctx, window, x, y, value):
        window(ctx, x * value, y * value, scale=value)

    def flyUp(self, ctx, window, x, y, value):
        y *= 2.5 - value * 1.5
        window(ctx, x, y)

    def flyDown(self, ctx, window, x, y, value):
        y *= -.5 + value * 1.5
        window(ctx, x, y)

    def traditional(self, ctx, window, x, y, value):
        window(ctx, x, y, value, value)

class Close(object):
    def scale(self, ctx, window, x, y, value):
        scale = 1 - value
        window(ctx, x, y, scale=scale)

    def fade(self, ctx, window, x, y, value):
        window(ctx, x, y, 1 - value)

    def blend(self, ctx, window, x, y, value):
        scale = 1 + value / 2
        window(ctx, x, y, 1 - value, scale)

    def move(self, ctx, window, x, y, value):
        value = 1 - value
        window(ctx, x * value, y * value, scale=value)

    def flyUp(self, ctx, window, x, y, value):
        y *= 1 - value * 1.5
        window(ctx, x, y)

    def flyDown(self, ctx, window, x, y, value):
        y *= 1 + value * 1.5
        window(ctx, x, y)

    def traditional(self, ctx, window, x, y, value):
        scale = 1 - value / 5
        window(ctx, x, y, 1 - value, scale)

class Minimize(Close):
    def traditional(self, ctx, window, x, y, value):
        y *= 1 + value
        scale = 1 - value
        window(ctx, x, y, scale=scale)

class Maximize(object):
    def scale(self, ctx, window, x, y, value):
        scale = 1 + value
        window(ctx, x, y, scale=scale)

class Unmaximize(object):
    def scale(self, ctx, window, x, y, value):
        scale = 2 - value
        window(ctx, x, y, scale=scale)

ANIMATIONS = {
    "map": Map(),
    "close": Close(),
    "minimize": Minimize(),
    "maximize": Maximize(),
    "unmaximize": Unmaximize(),
    "tile": Maximize()
}

PREVIEWS = Previews()


class Effect(Gtk.DrawingArea):
    width = 96
    height = 48

    state = -2
    duration = 50

    timer = None

    animation = None
    transition = None

    def __init__(self, effect, name):
        super(Effect, self).__init__()

        self.set_size_request(self.width, self.height)
        self.style = self.get_style_context()

        self.connect("draw", self.draw)

        if name in dir(PREVIEWS):
            self.preview = getattr(PREVIEWS, name)

        if name in dir(ANIMATIONS[effect]):
            self.animation = getattr(ANIMATIONS[effect], name)

    def start(self, a, b):
        if self.state == -2:
            self.state = -1.
            self.queue_draw()
            self.timer = GObject.timeout_add(400, self.frame)

    def stop(self, a, b):
        if self.timer:
            GObject.source_remove(self.timer)
            self.timer = None
        self.state = -2
        self.queue_draw()

    def frame(self):
        self.timer = None
        self.state += 1

        if self.state >= self.duration or (not self.animation and self.state >= 0):
            return

        self.queue_draw()

        self.timer = GObject.timeout_add(10, self.frame)

    def draw(self, widget, ctx):
        x = self.width / 2.
        y = self.height / 2.

        if self.state < 0:
            self.preview(ctx, self.window, x, y, self.get_color())
        else:
            value = self.transition(self.state % self.duration, 0, 1, self.duration - 1)
            self.animation(ctx, self.window, x, y, value)

    def get_color(self):
        if self.state == -2:
            return self.style.get_background_color(Gtk.StateFlags.SELECTED)
        return self.style.get_color(Gtk.StateFlags.NORMAL)

    def window(self, ctx, x, y, alpha = 1, scale = 1):
        if scale <= 0:
            return
        alpha = min(max(alpha, 0), 1)

        c = self.get_color()
        ctx.set_source_rgba(c.red, c.green, c.blue, alpha)
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(scale, scale)

        ctx.rectangle(-self.width / 4., -self.height / 4., self.width / 2., self.height / 2.)
        ctx.fill()
        ctx.restore()

    def preview(self, ctx, window, x, y, c):
        window(ctx, x, y)
