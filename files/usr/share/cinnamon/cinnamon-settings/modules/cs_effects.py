#!/usr/bin/python2

from GSettingsWidgets import *
from ChooserButtonWidgets import TweenChooserButton, EffectChooserButton

EFFECT_SETS = {
    "cinnamon": ("traditional", "traditional", "traditional", "none",  "none",  "none"),
    "scale":    ("scale",       "scale",       "scale",       "scale", "scale", "scale"),
    "fade":     ("fade",        "fade",        "fade",        "scale", "scale", "scale"),
    "blend":    ("blend",       "blend",       "blend",       "scale", "scale", "scale"),
    "move":     ("move",        "move",        "move",        "scale", "scale", "scale"),
    "flyUp":    ("flyUp",       "flyDown",     "flyDown",     "scale", "scale", "scale"),
    "flyDown":  ("flyDown",     "flyUp",       "flyUp",       "scale", "scale", "scale"),
    "default":  ("scale",       "scale",       "none",        "none",  "none",  "none")
}

TRANSITIONS_SETS = {
    "cinnamon": ("easeOutQuad",    "easeOutQuad",   "easeInQuad",  "easeInExpo", "easeNone",       "easeInQuad"),
    "normal":   ("easeOutSine",    "easeInBack",    "easeInSine",  "easeInBack", "easeOutBounce",  "easeInBack"),
    "extra":    ("easeOutElastic", "easeOutBounce", "easeOutExpo", "easeInExpo", "easeOutElastic", "easeInExpo"),
    "fade":     ("easeOutQuart",   "easeInQuart",   "easeInQuart", "easeInBack", "easeOutBounce",  "easeInBack")
}

TIME_SETS = {
    "cinnamon": (175, 175, 200, 100, 100, 100),
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
TYPES = ("map", "close", "minimize", "maximize", "unmaximize", "tile")
SCHEMA = "org.cinnamon"
DEP_PATH = "org.cinnamon/desktop-effects"
KEY_TEMPLATE = "desktop-effects-%s-%s"

class GSettingsTweenChooserButton(TweenChooserButton, CSGSettingsBackend):
    def __init__(self, schema, key, dep_key):
        self.key = key
        self.bind_prop = "tween"
        self.bind_dir = Gio.SettingsBindFlags.DEFAULT
        self.bind_object = self

        if schema not in settings_objects.keys():
            settings_objects[schema] = Gio.Settings.new(schema)
        self.settings = settings_objects[schema]

        super(GSettingsTweenChooserButton, self).__init__()
        self.bind_settings()

class GSettingsEffectChooserButton(EffectChooserButton, CSGSettingsBackend):
    def __init__(self, schema, key, dep_key, options):
        self.key = key
        self.bind_prop = "effect"
        self.bind_dir = Gio.SettingsBindFlags.DEFAULT
        self.bind_object = self

        if schema not in settings_objects.keys():
            settings_objects[schema] = Gio.Settings.new(schema)
        self.settings = settings_objects[schema]

        super(GSettingsEffectChooserButton, self).__init__(options)
        self.bind_settings()

class Module:
    name = "effects"
    category = "appear"
    comment = _("Control Cinnamon visual effects.")

    def __init__(self, content_box):
        keywords = _("effects, fancy, window")
        sidePage = SidePage(_("Effects"), "cs-desktop-effects", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Effects module"

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            self.schema = Gio.Settings(SCHEMA)
            self.effect_sets = {}
            for name, sets in COMBINATIONS.items():
                self.effect_sets[name] = (EFFECT_SETS[sets[0]], TRANSITIONS_SETS[sets[1]], TIME_SETS[sets[2]])

            # Enable effects

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "effects", _("Enable effects"))

            settings = page.add_section(_("Enable Effects"))

            widget = GSettingsSwitch(_("Window effects"), "org.cinnamon", "desktop-effects")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            widget = GSettingsSwitch(_("Effects on menus"), "org.cinnamon", "desktop-effects-on-menus")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            self.chooser = GSettingsComboBox(_("Effects style"), "org.cinnamon", "desktop-effects-style", OPTIONS)
            self.chooser.content_widget.connect("changed", self.on_value_changed)
            settings.add_reveal_row(self.chooser, "org.cinnamon", "desktop-effects")

            widget = GSettingsSwitch(_("Fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Session startup animation"), "org.cinnamon", "startup-animation")
            settings.add_row(widget)

            if Gtk.get_major_version() == 3 and Gtk.get_minor_version() >= 16:
                widget = GSettingsSwitch(_("Overlay scroll bars (logout required)"), "org.cinnamon.desktop.interface", "gtk-overlay-scrollbars")
                settings.add_row(widget)

            self.schema.connect("changed::desktop-effects", self.on_desktop_effects_enabled_changed)

            # Customize

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "customize", _("Customize"))

            box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
            label = Gtk.Label()
            label.set_markup("<b>%s</b>" % _("Customize settings"))
            box.pack_start(label, False, False, 0)
            self.custom_switch = Gtk.Switch(active = self.is_custom())
            box.pack_end(self.custom_switch, False, False, 0)
            self.custom_switch.connect("notify::active", self.update_effects)
            page.add(box)

            self.revealer = Gtk.Revealer()
            self.revealer.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
            self.revealer.set_transition_duration(150)
            page.add(self.revealer)
            settings = SettingsBox(_("Effect"))
            self.revealer.add(settings)

            self.size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            effects = ["none", "scale", "fade", "blend", "move", "flyUp", "flyDown", "traditional"]

            # MAPPING WINDOWS
            widget = self.make_effect_group(_("Mapping windows"), "map", effects)
            settings.add_row(widget)

            # CLOSING WINDOWS
            widget = self.make_effect_group(_("Closing windows"), "close", effects)
            settings.add_row(widget)

            # MINIMIZING WINDOWS
            widget = self.make_effect_group(_("Minimizing windows"), "minimize", effects)
            settings.add_row(widget)

            # MAXIMIZING WINDOWS
            # effects = ["none", _("None")], ["scale", _("Scale")]]
            widget = self.make_effect_group(_("Maximizing windows"), "maximize")
            settings.add_row(widget)

            # UNMAXIMIZING WINDOWS
            widget = self.make_effect_group(_("Unmaximizing windows"), "unmaximize")
            settings.add_row(widget)

            # TILING WINDOWS
            widget = self.make_effect_group(_("Tiling and snapping windows"), "tile")
            settings.add_row(widget)

            self.update_effects(self.custom_switch, None)

    def make_effect_group(self, group_label, key, effects=None):
        tmin, tmax, tstep, tdefault = (0, 2000, 50, 200)

        row = SettingsWidget()
        row.set_spacing(5)

        label = SettingsLabel()
        label.set_margin_right(5)
        label.set_markup(group_label)
        label.props.xalign = 0.0
        row.pack_start(label, False, False, 0)

        label = Gtk.Label(_("ms"))
        row.pack_end(label, False, False, 0)

        effect = GSettingsEffectChooserButton(SCHEMA, KEY_TEMPLATE % (key, "effect"), DEP_PATH, effects)
        self.size_group.add_widget(effect)
        tween = GSettingsTweenChooserButton(SCHEMA, KEY_TEMPLATE % (key, "transition"), DEP_PATH)
        self.size_group.add_widget(tween)
        time = GSettingsSpinButton("", SCHEMA, KEY_TEMPLATE % (key, "time"), dep_key=DEP_PATH, mini=tmin, maxi=tmax, step=tstep, page=tdefault)
        time.set_border_width(0)
        time.set_margin_right(0)
        time.set_margin_left(0)
        time.set_spacing(0)
        row.pack_end(time, False, False, 0)
        row.pack_end(tween, False, False, 0)
        row.pack_end(effect, False, False, 0)

        return row

    def is_custom(self):
        effects = []
        transitions = []
        times = []

        for i in TYPES:
            effects.append(self.schema.get_string(KEY_TEMPLATE % (i, "effect")))
            transitions.append(self.schema.get_string(KEY_TEMPLATE % (i, "transition")))
            times.append(self.schema.get_int(KEY_TEMPLATE % (i, "time")))

        value = (tuple(effects), tuple(transitions), tuple(times))
        return value != self.effect_sets[self.chooser.value]

    def on_value_changed(self, widget):
        value = self.effect_sets[self.schema.get_string("desktop-effects-style")]
        j = 0
        for i in TYPES:
            self.schema.set_string(KEY_TEMPLATE % (i, "effect"), value[0][j])
            self.schema.set_string(KEY_TEMPLATE % (i, "transition"), value[1][j])
            self.schema.set_int(KEY_TEMPLATE % (i, "time"), value[2][j])
            j += 1

    def update_effects(self, switch, gparam):
        active = switch.get_active()

        self.revealer.set_reveal_child(active)
        #when unchecking the checkbutton, reset the values
        if not active:
            self.on_value_changed(self.chooser)

    def on_desktop_effects_enabled_changed(self, schema, key):
        active = schema.get_boolean(key)

        if not active and schema.get_boolean("desktop-effects-on-dialogs"):
            schema.set_boolean("desktop-effects-on-dialogs", False)

        if not active and schema.get_boolean("desktop-effects-on-menus"):
            schema.set_boolean("desktop-effects-on-menus", False)

        self.update_effects(self.custom_switch, None)
