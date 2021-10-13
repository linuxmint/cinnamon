#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *
from ChooserButtonWidgets import TweenChooserButton, EffectChooserButton

SCHEMA = "org.cinnamon"
DEP_PATH = "org.cinnamon/desktop-effects"
KEY_TEMPLATE = "desktop-effects-%s-%s"

class GSettingsTweenChooserButton(TweenChooserButton, PXGSettingsBackend):
    def __init__(self, schema, key, dep_key):
        self.key = key
        self.bind_prop = "tween"
        self.bind_dir = Gio.SettingsBindFlags.DEFAULT
        self.bind_object = self

        if schema not in settings_objects:
            settings_objects[schema] = Gio.Settings.new(schema)
        self.settings = settings_objects[schema]

        super(GSettingsTweenChooserButton, self).__init__()
        self.bind_settings()

class GSettingsEffectChooserButton(EffectChooserButton, PXGSettingsBackend):
    def __init__(self, schema, key, dep_key, options):
        self.key = key
        self.bind_prop = "effect"
        self.bind_dir = Gio.SettingsBindFlags.DEFAULT
        self.bind_object = self

        if schema not in settings_objects:
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
            print("Loading Effects module")

            self.schema = Gio.Settings(SCHEMA)

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("Enable Effects"))

            widget = GSettingsSwitch(_("Window effects"), "org.cinnamon.muffin", "desktop-effects")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            widget = GSettingsSwitch(_("Effects on menus"), "org.cinnamon", "desktop-effects-on-menus")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            widget = GSettingsSwitch(_("Fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Session startup animation"), "org.cinnamon", "startup-animation")
            settings.add_row(widget)

            self.schema.connect("changed::desktop-effects", self.on_desktop_effects_enabled_changed)


            self.size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            effects = ["none", "scale", "fade", "blend", "move", "flyUp", "flyDown", "traditional"]

            # MAPPING WINDOWS
            widget = self.make_effect_group(_("Mapping windows"), "map", effects)
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # CLOSING WINDOWS
            widget = self.make_effect_group(_("Closing windows"), "close", effects)
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # MINIMIZING WINDOWS
            widget = self.make_effect_group(_("Minimizing windows"), "minimize", effects)
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # MAXIMIZING WINDOWS
            # effects = ["none", _("None")], ["scale", _("Scale")]]
            widget = self.make_effect_group(_("Maximizing windows"), "maximize")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # UNMAXIMIZING WINDOWS
            widget = self.make_effect_group(_("Unmaximizing windows"), "unmaximize")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # TILING WINDOWS
            widget = self.make_effect_group(_("Tiling and snapping windows"), "tile")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

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

    def on_desktop_effects_enabled_changed(self, schema, key):
        active = schema.get_boolean(key)

        if not active and schema.get_boolean("desktop-effects-on-dialogs"):
            schema.set_boolean("desktop-effects-on-dialogs", False)

        if not active and schema.get_boolean("desktop-effects-on-menus"):
            schema.set_boolean("desktop-effects-on-menus", False)
