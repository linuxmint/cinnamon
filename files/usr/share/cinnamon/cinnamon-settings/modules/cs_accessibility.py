#!/usr/bin/python2

import gi
gi.require_version("Gtk", "3.0")
gi.require_version('CDesktopEnums', '3.0')

from gi.repository import Gtk, CDesktopEnums
from GSettingsWidgets import *

DPI_FACTOR_LARGE         = 1.25
DPI_FACTOR_NORMAL        = 1.0

HIGH_CONTRAST_THEME      = "HighContrast"
KEY_TEXT_SCALING_FACTOR  = "text-scaling-factor"
KEY_GTK_THEME            = "gtk-theme"
KEY_GTK_THEME_BACKUP     = "gtk-theme-backup"
KEY_ICON_THEME           = "icon-theme"
KEY_ICON_THEME_BACKUP    = "icon-theme-backup"
KEY_WM_THEME             = "theme"
KEY_WM_THEME_BACKUP      = "theme-backup"


class Module:
    name = "universal-access"
    comment = _("Configure accessibility features")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("magnifier, talk, access, zoom, keys, contrast");
        sidePage = SidePage(_("Accessibility"), "cs-universal-access", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Accessibility module"

            self.iface_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
            self.wm_settings = Gio.Settings(schema_id="org.cinnamon.desktop.wm.preferences");
            self.mag_settings = Gio.Settings(schema_id="org.cinnamon.desktop.a11y.magnifier");

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

####    Visual

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "visual", _("Visual"))

# Visual Aids

            settings = page.add_section(_("Visual Aids"))

            switch = Switch(_("High contrast"))
            self.iface_settings.bind_with_mapping(KEY_GTK_THEME,
                                                  switch.content_widget, "active",
                                                  Gio.SettingsBindFlags.DEFAULT,
                                                  self.hi_con_get_mapping,
                                                  self.hi_con_set_mapping)
            settings.add_row(switch)

            switch = Switch(_("Large text"))
            self.iface_settings.bind_with_mapping(KEY_TEXT_SCALING_FACTOR,
                                                  switch.content_widget, "active",
                                                  Gio.SettingsBindFlags.DEFAULT,
                                                  self.lg_text_get_mapping,
                                                  self.lg_text_set_mapping)
            settings.add_row(switch)

            switch = GSettingsDependencySwitch(_("Screen reader"),
                                               "org.cinnamon.desktop.a11y.applications",
                                               "screen-reader-enabled",
                                               None,
                                               ["orca"],
                                               ["gnome-orca"])
            settings.add_row(switch)

# Desktop Zoom

            settings = page.add_section(_("Desktop Zoom"))

            switch = GSettingsSwitch(_("Enable zoom"), "org.cinnamon.desktop.a11y.applications", "screen-magnifier-enabled")
            settings.add_row(switch)

            spin = GSettingsSpinButton(_("Magnification"), "org.cinnamon.desktop.a11y.magnifier", "mag-factor", None, 1.0, 15.0, step=0.5)
            settings.add_reveal_row(spin, "org.cinnamon.desktop.a11y.applications", "screen-magnifier-enabled")

            zoom_key_options = [["", _("Disabled")], ["<Alt>", "<Alt>"],["<Super>", "<Super>"],["<Control>", "<Control>"]]
            widget = GSettingsComboBox(_("Mouse wheel modifier"), "org.cinnamon.desktop.wm.preferences", "mouse-button-zoom-modifier", zoom_key_options)
            widget.set_tooltip_text(_("While this modifier is pressed, mouse scrolling will increase or decrease zoom."))
            settings.add_reveal_row(widget, "org.cinnamon.desktop.a11y.applications", "screen-magnifier-enabled")

            switch = GSettingsSwitch(_("Scroll at screen edges"), "org.cinnamon.desktop.a11y.magnifier", "scroll-at-edges")
            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.applications", "screen-magnifier-enabled")

            mouse_track_options = [["centered",     _("Keep cursor centered")],
                                   ["proportional", _("Cursor moves with contents")],
                                   ["push",         _("Cursor pushes contents around")]]

            widget = GSettingsComboBox(_("Mouse tracking mode"), "org.cinnamon.desktop.a11y.magnifier", "mouse-tracking", mouse_track_options)
            settings.add_reveal_row(widget, "org.cinnamon.desktop.a11y.applications", "screen-magnifier-enabled")

            switch = GSettingsSwitch(_("Lens mode"), "org.cinnamon.desktop.a11y.magnifier", "lens-mode")
            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.applications", "screen-magnifier-enabled")

            self.zoom_stack = SettingsStack()
            self.zoom_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)

            lens_shape_options = [["square",          _("Square")],
                                  ["horizontal",      _("Horizontal strip")],
                                  ["vertical",        _("Vertical strip")]]

            widget = GSettingsComboBox(_("Lens shape"), "org.cinnamon.desktop.a11y.magnifier", "lens-shape", lens_shape_options)
            self.zoom_stack.add_named(widget, "shape")

            screen_pos_options = [["full-screen",     _("Full screen")],
                                  ["top-half",        _("Top half")],
                                  ["bottom-half",     _("Bottom half")],
                                  ["left-half",       _("Left half")],
                                  ["right-half",      _("Right half")]]

            widget = GSettingsComboBox(_("Screen position"), "org.cinnamon.desktop.a11y.magnifier", "screen-position", screen_pos_options)
            self.zoom_stack.add_named(widget, "screen")

            settings.add_reveal_row(self.zoom_stack, "org.cinnamon.desktop.a11y.applications", "screen-magnifier-enabled")

            self.mag_settings.bind_with_mapping("lens-mode",
                                                self.zoom_stack, "visible-child-name",
                                                Gio.SettingsBindFlags.GET,
                                                self.zoom_stack_get,
                                                None)

            if (self.mag_settings.get_boolean("lens-mode")):
                self.zoom_stack.set_visible_child_name("shape")
            else:
                self.zoom_stack.set_visible_child_name("screen")

#### Keyboard

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "keyboard", _("Keyboard"))

# Virtual keyboard

            settings = page.add_section(_("Virtual keyboard"))

            switch = GSettingsSwitch(_("Enable the on-screen keyboard"),
                                     "org.cinnamon.desktop.a11y.applications",
                                     "screen-keyboard-enabled",
                                     None)

            settings.add_row(switch)

            keyboard_type_options = [["tablet",     _("Tablet")],
                                     ["touch",     _("Touch")],
                                     ["fullscale", _("Full scale")],
                                     ["scan",      _("Scanning")]]

            widget = GSettingsComboBox(_("Keyboard layout"), "org.cinnamon.keyboard", "keyboard-type", keyboard_type_options)
            settings.add_reveal_row(widget, "org.cinnamon.desktop.a11y.applications", "screen-keyboard-enabled")

            keyboard_position_options = [["bottom",     _("At the bottom of the screen")],
                                         ["top",     _("At the top of the screen")]]
            widget = GSettingsComboBox(_("Keyboard position"), "org.cinnamon.keyboard", "keyboard-position", keyboard_position_options)
            settings.add_reveal_row(widget, "org.cinnamon.desktop.a11y.applications", "screen-keyboard-enabled")

            keyboard_size_options = [[4,     _("A quarter of the screen")],
                                     [3,     _("A third of the screen")],
                                     [2, _("Half of the screen")]]

            widget = GSettingsComboBox(_("Keyboard size"), "org.cinnamon.keyboard", "keyboard-size", keyboard_size_options)
            settings.add_reveal_row(widget, "org.cinnamon.desktop.a11y.applications", "screen-keyboard-enabled")

            activation_mode_options = [["accessible", _("Show the keyboard any time something expects input")],
                                       ["on-demand",  _("Show keyboard only when the user activates it")]];

            widget = GSettingsComboBox(_("Activation mode"), "org.cinnamon.keyboard", "activation-mode", activation_mode_options)
            settings.add_reveal_row(widget, "org.cinnamon.desktop.a11y.applications", "screen-keyboard-enabled")

# Keyboard indicators

            settings = page.add_section(_("Keyboard indicators"))

            switch = GSettingsSwitch(_("Use visual indicator on Caps and Num Lock"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "togglekeys-enable-osd")

            settings.add_row(switch)

            switch = GSettingsSwitch(_("Use audio indicator on Caps and Num Lock"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "togglekeys-enable-beep")

            settings.add_row(switch)

            sound_picker = GSettingsSoundFileChooser(_("Sound to use Caps or Num Lock on"),
                                                     "org.cinnamon.desktop.a11y.keyboard",
                                                     "togglekeys-sound-on")
            settings.add_reveal_row(sound_picker, "org.cinnamon.desktop.a11y.keyboard", "togglekeys-enable-beep")

            sound_picker = GSettingsSoundFileChooser(_("Sound to use Caps or Num Lock off"),
                                                     "org.cinnamon.desktop.a11y.keyboard",
                                                     "togglekeys-sound-off")
            settings.add_reveal_row(sound_picker, "org.cinnamon.desktop.a11y.keyboard", "togglekeys-enable-beep")

            settings = page.add_section(_("Event feedback (required for typing assistance alerts)"))

            switch = GSettingsSwitch(_("Enable visual alerts"),
                                     "org.cinnamon.desktop.wm.preferences",
                                     "visual-bell")
            settings.add_row(switch)

            visual_bell_options = [["fullscreen-flash",     _("Flash the entire monitor")],
                                   ["frame-flash", _("Flash the active window")]]

            widget = GSettingsComboBox(_("Visual style"), "org.cinnamon.desktop.wm.preferences", "visual-bell-type", visual_bell_options)
            settings.add_reveal_row(widget, "org.cinnamon.desktop.wm.preferences", "visual-bell")

            switch = GSettingsSwitch(_("Enable audio alerts"),
                                     "org.cinnamon.desktop.wm.preferences",
                                     "audible-bell")
            settings.add_row(switch)

            sound_picker = GSettingsSoundFileChooser(_("Sound to use for window alerts"),
                                                     "org.cinnamon.desktop.wm.preferences",
                                                     "bell-sound")
            settings.add_reveal_row(sound_picker, "org.cinnamon.desktop.wm.preferences", "audible-bell")

####    Typing Assistance

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "typing", _("Typing assistance"))

# Stickykeys

            settings = page.add_section(_("Sticky keys"))

            switch = GSettingsSwitch(_("Treat a sequence of modifier keys as a combination"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "stickykeys-enable",
                                     None)

            settings.add_row(switch)

            switch = GSettingsSwitch(_("Disable if two modifiers are pressed together"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "stickykeys-two-key-off",
                                     None)

            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.keyboard", "stickykeys-enable")

            switch = GSettingsSwitch(_("Alert when a modifier key is pressed"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "stickykeys-modifier-beep",
                                     "org.cinnamon.desktop.sound/event-sounds")

            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.keyboard", "stickykeys-enable")

# Slowkeys

            settings = page.add_section(_("Slow keys"))

            switch = GSettingsSwitch(_("Put a delay between when a key is pressed and when it is accepted"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "slowkeys-enable",
                                     None)

            settings.add_row(switch)

            switch = GSettingsSwitch(_("Alert when a key is pressed"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "slowkeys-beep-press",
                                     "org.cinnamon.desktop.sound/event-sounds")

            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.keyboard", "slowkeys-enable")

            switch = GSettingsSwitch(_("Alert when a key is accepted"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "slowkeys-beep-accept",
                                     "org.cinnamon.desktop.sound/event-sounds")

            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.keyboard", "slowkeys-enable")

            switch = GSettingsSwitch(_("Alert when a key is rejected"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "slowkeys-beep-reject",
                                     "org.cinnamon.desktop.sound/event-sounds")

            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.keyboard", "slowkeys-enable")

            slider = GSettingsRange(_("Acceptance delay"),
                                    "org.cinnamon.desktop.a11y.keyboard",
                                    "slowkeys-delay",
                                    _("Short"), _("Long"),
                                    0, 500, 10, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.keyboard", "slowkeys-enable")

# Bouncekeys

            settings = page.add_section(_("Bounce keys"))

            switch = GSettingsSwitch(_("Ignore fast duplicate keypresses"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "bouncekeys-enable",
                                     None)

            settings.add_row(switch)

            switch = GSettingsSwitch(_("Alert when a key is rejected"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "bouncekeys-beep-reject",
                                     "org.cinnamon.desktop.sound/event-sounds")

            settings.add_reveal_row(switch, "org.cinnamon.desktop.a11y.keyboard", "bouncekeys-enable")

            slider = GSettingsRange(_("Acceptance delay"),
                                    "org.cinnamon.desktop.a11y.keyboard",
                                    "bouncekeys-delay",
                                    _("Short"), _("Long"),
                                    0, 900, 10, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.keyboard", "bouncekeys-enable")

####    Pointing and Clicking

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "mouse", _("Mouse"))

# Mousekeys

            settings = page.add_section(_("Mouse keys"))

            switch = GSettingsSwitch(_("Control the pointer using the keypad"),
                                     "org.cinnamon.desktop.a11y.keyboard",
                                     "mousekeys-enable",
                                     None)

            settings.add_row(switch)

            slider = GSettingsRange(_("Initial delay"),
                                    "org.cinnamon.desktop.a11y.keyboard",
                                    "mousekeys-init-delay",
                                    _("Shorter"), _("Longer"),
                                    10, 2000, 10, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.keyboard", "mousekeys-enable")

            slider = GSettingsRange(_("Acceleration time"),
                                    "org.cinnamon.desktop.a11y.keyboard",
                                    "mousekeys-accel-time",
                                    _("Shorter"), _("Longer"),
                                    10, 2000, 10, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.keyboard", "mousekeys-enable")

            slider = GSettingsRange(_("Maximum speed"),
                                    "org.cinnamon.desktop.a11y.keyboard",
                                    "mousekeys-max-speed",
                                    _("Slower"), _("Faster"),
                                    1, 500, 1, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.keyboard", "mousekeys-enable")

# Dependency Checker

            settings = page.add_reveal_section(_("Simulated secondary click and hover click"))
            self.dc_section = settings

            install_widget = SettingsWidget()

            self.dep_button = DependencyCheckInstallButton(_("Checking dependencies"),
                                                           _("Please install: %s") % ("mousetweaks"),
                                                           ["mousetweaks"],
                                                           Gtk.Alignment(),
                                                           self.on_dep_satisfied)

            install_widget.pack_start(self.dep_button, True, False, 0)

            settings.add_row(install_widget)

            self.dc_section._revealer.set_reveal_child(True)

# Secondary click

            settings = page.add_reveal_section(_("Simulated secondary click"))
            self.ssc_section = settings

            switch = GSettingsSwitch(_("Trigger a secondary click by holding down the primary button"),
                                     "org.cinnamon.desktop.a11y.mouse",
                                     "secondary-click-enabled",
                                     None)

            settings.add_row(switch)

            slider = GSettingsRange(_("Acceptance delay"),
                                    "org.cinnamon.desktop.a11y.mouse",
                                    "secondary-click-time",
                                    _("Shorter"), _("Longer"),
                                    0.5, 3.0, 0.1, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.mouse", "secondary-click-enabled")

# Hover Click

            settings = page.add_reveal_section(_("Hover click"))
            self.hc_section = settings

            switch = GSettingsSwitch(_("Trigger a click when the pointer hovers"),
                                     "org.cinnamon.desktop.a11y.mouse",
                                     "dwell-click-enabled",
                                     None)

            settings.add_row(switch)

            slider = GSettingsRange(_("Delay"),
                                    "org.cinnamon.desktop.a11y.mouse",
                                    "dwell-time",
                                    _("Short"), _("Long"),
                                    0.2, 3.0, 0.1, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.mouse", "dwell-click-enabled")

            slider = GSettingsRange(_("Motion threshold"),
                                    "org.cinnamon.desktop.a11y.mouse",
                                    "dwell-threshold",
                                    _("Small"), _("Large"),
                                    1, 30, 1, show_value=False)

            settings.add_reveal_row(slider, "org.cinnamon.desktop.a11y.mouse", "dwell-click-enabled")

    def on_dep_satisfied(self):
        self.ssc_section._revealer.set_reveal_child(True)
        self.hc_section._revealer.set_reveal_child(True)
        self.dc_section._revealer.destroy()

    def zoom_stack_get(self, lens_mode):
        ret = "screen"

        if lens_mode:
            ret = "shape"
        else:
            ret = "screen"

        return ret

    def hi_con_get_mapping(self, string):
        return string == HIGH_CONTRAST_THEME

    def hi_con_set_mapping(self, active):
        ret = None

        if active:
            ret = HIGH_CONTRAST_THEME

            theme = self.iface_settings.get_string(KEY_GTK_THEME)
            self.iface_settings.set_string(KEY_GTK_THEME_BACKUP, theme)

            theme = self.iface_settings.get_string(KEY_ICON_THEME)
            self.iface_settings.set_string(KEY_ICON_THEME_BACKUP, theme)
            self.iface_settings.set_string(KEY_ICON_THEME, HIGH_CONTRAST_THEME)

            theme = self.wm_settings.get_string(KEY_WM_THEME)
            self.wm_settings.set_string(KEY_WM_THEME_BACKUP, theme)
            self.wm_settings.set_string(KEY_WM_THEME, HIGH_CONTRAST_THEME)
        else:
            ret = self.iface_settings.get_string(KEY_GTK_THEME_BACKUP)

            theme = self.iface_settings.get_string(KEY_ICON_THEME_BACKUP)
            self.iface_settings.set_string(KEY_ICON_THEME, theme)

            theme = self.wm_settings.get_string(KEY_WM_THEME_BACKUP)
            self.wm_settings.set_string(KEY_WM_THEME, theme)

        return ret

    def lg_text_get_mapping(self, factor):
        return factor > DPI_FACTOR_NORMAL

    def lg_text_set_mapping(self, active):
        ret = None

        if active:
            ret = DPI_FACTOR_LARGE
        else:
            ret = self.iface_settings.get_default_value(KEY_TEXT_SCALING_FACTOR).get_double()

        return ret
