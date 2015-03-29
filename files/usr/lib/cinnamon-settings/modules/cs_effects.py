#!/usr/bin/env python

from SettingsWidgets import *
import windowEffects

EFFECT_SETS = {
    "cinnamon": ("traditional", "traditional", "traditional", "scale", "none",  "scale"),
    "scale":    ("scale",       "scale",       "scale",       "scale", "scale", "scale"),
    "fade":     ("fade",        "fade",        "fade",        "scale", "scale", "scale"),
    "blend":    ("blend",       "blend",       "blend",       "scale", "scale", "scale"),
    "move":     ("move",        "move",        "move",        "scale", "scale", "scale"),
    "flyUp":    ("flyUp",       "flyDown",     "flyDown",     "scale", "scale", "scale"),
    "flyDown":  ("flyDown",     "flyUp",       "flyUp",       "scale", "scale", "scale"),
    "default":  ("scale",       "scale",       "none",        "none",  "none",  "none")
}

TRANSITIONS_SETS = {
    "cinnamon": ("easeOutQuad",    "easeInExpo",    "easeOutExpo", "easeInExpo", "easeNone",       "easeInQuad"),
    "normal":   ("easeOutSine",    "easeInBack",    "easeInSine",  "easeInBack", "easeOutBounce",  "easeInBack"),
    "extra":    ("easeOutElastic", "easeOutBounce", "easeOutExpo", "easeInExpo", "easeOutElastic", "easeInExpo"),
    "fade":     ("easeOutQuart",   "easeInQuart",   "easeInQuart", "easeInBack", "easeOutBounce",  "easeInBack")
}

TIME_SETS = {
    "cinnamon": (150, 150, 200, 100, 100, 100),
    "slow":     (400, 400, 400, 100, 100, 100),
    "normal":   (250, 250, 250, 100, 100, 100),
    "fast":     (100, 100, 100, 100, 100, 100),
    "default":  (250, 250, 150, 400, 400, 400)
}

COMBINATIONS = {
   #  name           effect    transition    time
    "cinnamon":   ("cinnamon", "cinnamon", "cinnamon"),
    "scale":      ("scale",    "normal",   "normal"),
    "fancyScale": ("scale",    "extra",    "slow"),
    "fade":       ("fade",     "fade",     "normal"),
    "blend":      ("blend",    "fade",     "normal"),
    "move":       ("move",     "normal",   "fast"),
    "flyUp":      ("flyUp",    "normal",   "fast"),
    "flyDown":    ("flyDown",  "normal",   "fast"),
   #for previous versions
    "default":    ("default",  "normal",   "default")
}

OPTIONS = (
    ("cinnamon",   _("Cinnamon")),
    ("scale",      _("Scale")),
    ("fancyScale", _("Fancy Scale")),
    ("fade",       _("Fade")),
    ("blend",      _("Blend")),
    ("move",       _("Move")),
    ("flyUp",      _("Fly up, down")),
    ("flyDown",    _("Fly down, up")),
   #for previous versions
    ("default",    _("Default"))
)

class Module:
    types = ("map", "close", "minimize", "maximize", "unmaximize", "tile")
    root = "org.cinnamon"
    path = "org.cinnamon/desktop-effects"
    template = "desktop-effects-%s-%s"

    def __init__(self, content_box):
        keywords = _("effects, fancy, window")
        sidePage = SidePage(_("Effects"), "cs-desktop-effects", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "effects"
        self.category = "appear"
        self.comment = _("Control Cinnamon visual effects.")
    def on_module_selected(self):
        if not self.loaded:
            print "Loading Effects module"
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.sidePage.add_widget(vbox)

            self.schema = Gio.Settings(self.root)
            self.effect_sets = {}
            for name, sets in COMBINATIONS.items():
                self.effect_sets[name] = (EFFECT_SETS[sets[0]], TRANSITIONS_SETS[sets[1]], TIME_SETS[sets[2]])

            section = Section(_("Enable Effects"))
            section.add(GSettingsCheckButton(_("Enable fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade", None))
            section.add(GSettingsCheckButton(_("Enable desktop effects"), "org.cinnamon", "desktop-effects", None))
            section.add_indented(GSettingsCheckButton(_("Enable session startup animation"), "org.cinnamon", "startup-animation", "org.cinnamon/desktop-effects"))
            section.add_indented(GSettingsCheckButton(_("Enable desktop effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs", "org.cinnamon/desktop-effects"))
            vbox.add(section)

            self.schema.connect("changed::desktop-effects", self.on_desktop_effects_enabled_changed)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Style"))

            self.chooser = GSettingsComboBox(_("Effects style"), "org.cinnamon", "desktop-effects-style", "org.cinnamon/desktop-effects", OPTIONS)
            self.chooser.content_widget.connect("changed", self.on_value_changed)
            section.add(self.chooser)

            self.custom_checkbutton = Gtk.CheckButton(active = self.is_custom(), label = _("Customize"), margin_left = 5)
            self.custom_checkbutton.get_children()[0].set_use_markup(True)
            self.custom_checkbutton.connect("toggled", self.update_effects)
            section.add(self.custom_checkbutton)

            self.grid = Gtk.Grid(row_spacing = 5, column_spacing = 5)

            #MAPPING WINDOWS
            effects = [
                ["none",    _("None")],
                ["scale",   _("Scale")],
                ["fade",    _("Fade")],
                ["blend",   _("Blend")],
                ["move",    _("Move")],
                ["flyUp",   _("Fly up")],
                ["flyDown", _("Fly down")],
                ["traditional", _("Traditional")]
            ]
            self.make_effect_group(_("Mapping windows:"), "map", effects, 0)

            #CLOSING WINDOWS
            self.make_effect_group(_("Closing windows:"), "close", effects, 1)

            #MINIMIZING WINDOWS
            self.make_effect_group(_("Minimizing windows:"), "minimize", effects, 2)

            #MAXIMIZING WINDOWS
            effects = [["none", _("None")], ["scale", _("Scale")]]
            self.make_effect_group(_("Maximizing windows:"), "maximize", effects, 3)

            #UNMAXIMIZING WINDOWS
            self.make_effect_group(_("Unmaximizing windows:"), "unmaximize", effects, 4)

            #TILING WINDOWS
            self.make_effect_group(_("Tiling and snapping windows:"), "tile", effects, 5)

            section.add_indented(self.grid)
            vbox.add(section)
            self.update_effects(self.custom_checkbutton)

    def make_effect_group(self, group_label, key, effects, row):
        tmin, tmax, tstep, tdefault = (0, 2000, 50, 200)

        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.grid.attach(label, 0, row, 1, 1)

        effect = GSettingsEffectChooserButton(self.root, self.template % (key, "effect"), self.path, effects, key)
        tween = GSettingsTweenChooserButton(self.root, self.template % (key, "transition"), self.path)
        time = GSettingsSpinButton("", self.root, self.template % (key, "time"), self.path, tmin, tmax, tstep, tdefault, _("milliseconds"))

        self.grid.attach(effect, 1, row, 1, 1)
        self.grid.attach(tween, 2, row, 1, 1)
        self.grid.attach(time, 3, row, 1, 1)

        effect.bind_transition(self.template % (key, "transition"))
        effect.bind_time(self.template % (key, "time"))
        tween.bind_time(self.template % (key, "time"))

    def is_custom(self):
        effects = []
        transitions = []
        times = []

        for i in self.types:
            effects.append(self.schema.get_string(self.template % (i, "effect")))
            transitions.append(self.schema.get_string(self.template % (i, "transition")))
            times.append(self.schema.get_int(self.template % (i, "time")))

        value = (tuple(effects), tuple(transitions), tuple(times))
        return value != self.effect_sets[self.chooser.value]

    def on_value_changed(self, widget):
        value = self.effect_sets[self.schema.get_string("desktop-effects-style")]
        j = 0
        for i in self.types:
            self.schema.set_string(self.template % (i, "effect"), value[0][j])
            self.schema.set_string(self.template % (i, "transition"), value[1][j])
            self.schema.set_int(self.template % (i, "time"), value[2][j])
            j += 1

    def update_effects(self, checkbutton):
        active = checkbutton.get_active()

        self.grid.set_sensitive(active)
        #when unchecking the checkbutton, reset the values
        if not active:
            self.on_value_changed(self.chooser)

    def on_desktop_effects_enabled_changed(self, schema, key):
        active = schema.get_boolean(key)

        if not active and schema.get_boolean("desktop-effects-on-dialogs"):
            schema.set_boolean("desktop-effects-on-dialogs", False)

        self.custom_checkbutton.set_sensitive(active)
        self.update_effects(self.custom_checkbutton)

class GSettingsEffectChooserButton(BaseChooserButton):
    def __init__(self, schema, key, dep_key, options, effect):
        super(GSettingsEffectChooserButton, self).__init__()

        self._schema = Gio.Settings.new(schema)
        self._key = key
        self.options = options
        self.effect = effect
        self.value = self._schema.get_string(key)

        col = 0
        row = 0
        for i in options:
            self.build_menuitem(i, col, row)
            if i[0] == self.value:
                self.set_label(i[1])
            col += 1
            if col >= 4:
                col = 0
                row += 1

        self.set_size_request(72, -1)

        self.dep_key = dep_key
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::" + self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

        self._schema.connect("changed::" + key, self.on_gsettings_value_changed)

    def build_menuitem(self, option, col, row):
        menuitem = EffectMenuItem(option[0], option[1], self.effect)
        menuitem.connect("activate", self.change_value)
        self.menu.attach(menuitem, col, col + 1, row, row + 1)

    def bind_transition(self, transition_key):
        self._schema.connect("changed::" + transition_key, self.update_transition)
        self.update_transition(self._schema, transition_key)

    def update_transition(self, settings, key):
        transition = settings.get_string(key)
        for item in self.menu.get_children():
            item.graph.transition = getattr(tweenEquations, transition, tweenEquations.easeNone)

    def bind_time(self, key):
        self._schema.connect("changed::" + key, self.update_time)
        self.update_time(self._schema, key)

    def update_time(self, settings, key):
        time = settings.get_int(key) / 10
        for item in self.menu.get_children():
            item.graph.duration = time

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

    def change_value(self, widget):
        self.value = widget.value
        self.set_label(widget.name)
        self._schema.set_string(self._key, self.value)

    def on_gsettings_value_changed(self, a, b):
        self.value = self._schema.get_string(self._key)
        for i in self.options:
            if i[0] == self.value:
                self.set_label(i[1])

class EffectMenuItem(Gtk.MenuItem):
    def __init__(self, value, name, effect):
        super(EffectMenuItem, self).__init__()
        self.graph = windowEffects.Effect(effect, value)
        self.value = value
        self.name = name

        self.vbox = Gtk.VBox()
        self.add(self.vbox)

        self.connect("enter-notify-event", self.graph.start)
        self.connect("leave-notify-event", self.graph.stop)
        self.vbox.add(self.graph)

        label = Gtk.Label()
        self.vbox.add(label)
        label.set_text(name)

class GSettingsTweenChooserButton(BaseChooserButton):
    def __init__(self, schema, key, dep_key):
        super(GSettingsTweenChooserButton, self).__init__()

        self._schema = Gio.Settings.new(schema)
        self._key = key
        self.dep_key = dep_key
        self.value = self._schema.get_string(key)
        self.options = []

        self.set_label(self.value)
        self.set_size_request(128, -1)

        self.build_menuitem("None", 0, 0)

        row = 1
        for main in ["Quad", "Cubic", "Quart", "Quint", "Sine", "Expo", "Circ", "Elastic", "Back", "Bounce"]:
            col = 0
            for prefix in ["In", "Out", "InOut", "OutIn"]:
                self.build_menuitem(prefix + main, col, row)
                self.options.append("ease" + prefix + main)
                col += 1
            row += 1

        self._schema.connect("changed::" + key, self.on_gsettings_value_changed)

        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::" + self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

    def build_menuitem(self, name, col, row):
        menuitem = TweenMenuItem("ease" + name)
        menuitem.connect("activate", self.change_value)
        self.menu.attach(menuitem, col, col + 1, row, row + 1)

    def bind_time(self, key):
        self._schema.connect("changed::" + key, self.update_time)
        self.update_time(self._schema, key)

    def update_time(self, settings, key):
        time = settings.get_int(key) / 10
        for item in self.menu.get_children():
            item.duration = time

    def change_value(self, widget):
        self.value = widget.name
        self.set_label(self.value)
        self._schema.set_string(self._key, self.value)

    def on_gsettings_value_changed(self, a, b):
        self.value = self._schema.get_string(self._key)
        for i in self.options:
            if i == self.value:
                self.set_label(i)

class TweenMenuItem(Gtk.MenuItem):
    width = 96
    height = 48

    state = -1
    duration = 50

    timer = None

    def __init__(self, name):
        super(TweenMenuItem, self).__init__()

        self.name = name
        self.function = getattr(tweenEquations, name)

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
        self.timer = GObject.timeout_add(10, self.frame)
