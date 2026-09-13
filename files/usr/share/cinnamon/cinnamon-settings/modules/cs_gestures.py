#!/usr/bin/python3

import glob
import os
import subprocess
from functools import cmp_to_key
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GdkPixbuf

from bin import util
from bin.SettingsWidgets import SidePage, SettingsWidget
from xapp.GSettingsWidgets import *

SCHEMA = "org.cinnamon.gestures"
NON_GESTURE_KEYS = [
    "enabled",
    "swipe-percent-threshold",
    "pinch-percent-threshold"
]

ACTIONS = [
    # Action, Label, Allow phase selection, extra widget type (e.g one-to-one)
    # [entry|slider|none], default custom value, can follow the fingers
    ["", _("Disabled"), False, "none", "", False],
    ["WORKSPACE_NEXT", _("Switch to right workspace"), True, "none", "", True],
    ["WORKSPACE_PREVIOUS", _("Switch to left workspace"), True, "none", "", True],
    # ["WORKSPACE_UP", _("Switch to the workspace above"), "none", ""],
    # ["WORKSPACE_DOWN", _("Switch to the workspace below"), "none", ""],
    ["TOGGLE_EXPO", _("(Expo) Show the workspace selector "), True, "none", "", True],
    ["TOGGLE_OVERVIEW", _("(Scale) Show the window selector"), True, "none", "", True],
    ["SWITCH_WINDOWS", _("Switch windows"), True, "none", "", True],
    ["MINIMIZE", _("Minimize window"), True, "none", "", True],
    ["MAXIMIZE", _("Maximize window"), True, "none", "", True],
    ["CLOSE", _("Close window"), True, "none", "", False],
    ["WINDOW_WORKSPACE_NEXT", _("Move window to right workspace"), True, "none", "", False],
    ["WINDOW_WORKSPACE_PREVIOUS", _("Move window to left workspace"), True, "none", "", False],
    ["FULLSCREEN", _("Make window fullscreen"), True, "none", "", False],
    ["UNFULLSCREEN", _("Exit window fullscreen"), True, "none", "", False],
    ["PUSH_TILE_UP", _("Push tile up"), True, "none", "", True],
    ["PUSH_TILE_DOWN", _("Push tile down"), True, "none", "", True],
    ["PUSH_TILE_LEFT", _("Push tile left"), True, "none", "", True],
    ["PUSH_TILE_RIGHT", _("Push tile right"), True, "none", "", True],
    ["TOGGLE_DESKTOP", _("Show desktop"), True, "none", "", False],
    ["VOLUME_UP", _("Volume up"), False, "none", "", False],
    ["VOLUME_DOWN", _("Volume down"), False, "none", "", False],
    ["TOGGLE_MUTE", _("Volume mute"), True, "none", "", False],
    ["MEDIA_PLAY_PAUSE", _("Toggle Play / Pause"), True, "none", "", False],
    ["MEDIA_NEXT", _("Next track"), True, "none", "", False],
    ["MEDIA_PREVIOUS", _("Previous track"), True, "none", "", False],
    ["ZOOM_IN", _("Zoom desktop in"), False, "slider", "50", False],
    ["ZOOM_OUT", _("Zoom desktop out"), False, "slider", "50", False],
    ["EXEC", _("Run a command"), True, "entry", "", False],
]

[ACTION_ID_COL, ACTION_LABEL_COL, ACTION_ALLOW_PHASE_SELECT_COL, ACTION_EXTRA_WIDGET_TYPE_COL,
 ACTION_DEFAULT_CUSTOM_VALUE_COL, ACTION_ALLOW_FOLLOW_COL] = range(0, 6)

PHASES = [
    ["start", _("Trigger at gesture start")],
    ["end", _("Trigger at gesture end")]
]

# Follow or modern guestures are not
# in the list above as they behave differently
# and only some actions can use them for now as we have
# to do more work per action to annimate them nicely
FOLLOW_PHASE = "follow"
DEFAULT_PHASE = "end"

# Shipped with the xapp icons, used as the toggle for modern gestures
FOLLOW_ICON = "xsi-boot-menu-symbolic"

# Pictures of a swipe, one per finger count. Live beside this module,
# not under the icon theme: each is an illustration, not a looked-up icon.
SETTINGS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRAPHICS_DIR = os.path.join(SETTINGS_DIR, "graphics")

# How wide to draw one of those illustrations.
SWIPE_ILLUSTRATION_SIZE = 180


def swipe_illustration_path(fingers):
    return os.path.join(GRAPHICS_DIR, "%d-fingers-touchpad.svg" % fingers)

# How much of the illustration's grey-to-white gradient to pull towards the
# theme's accent color, so Mint-Y/Mint-X/Mint-L (and anything else that
# defines the same named color) give the hands a mild tint of their own.
GRADIENT_TINT_AMOUNT = 0.25


def _tinted_hex(hex_color, accent, amount):
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    r += (accent.red * 255 - r) * amount
    g += (accent.green * 255 - g) * amount
    b += (accent.blue * 255 - b) * amount
    return "#%02x%02x%02x" % (round(r), round(g), round(b))


def themed_swipe_pixbuf(widget, fingers, size):
    with open(swipe_illustration_path(fingers), encoding="utf-8") as f:
        svg = f.read()

    found, accent = widget.get_style_context().lookup_color("theme_selected_bg_color")
    if found:
        for stop in ("8d8d8d", "ffffff"):
            svg = svg.replace("stop-color:#%s" % stop,
                               "stop-color:" + _tinted_hex(stop, accent, GRADIENT_TINT_AMOUNT))

    loader = GdkPixbuf.PixbufLoader()
    loader.set_size(size, size)
    loader.write(svg.encode("utf-8"))
    loader.close()
    return loader.get_pixbuf()

# The column is there for every row, so that the rows line up.
FOLLOW_COLUMN_WIDTH = 42

# One-click bundles of gesture bindings: (name, {key: "ACTION::phase"}).
# Add an entry to add a button; the layout wraps on its own.
GESTURE_TEMPLATES = [
    (_("Easy Workspace Gestures"), {
        "swipe-up-3": "TOGGLE_OVERVIEW::follow",
        "swipe-left-3": "WORKSPACE_NEXT::follow",
        "swipe-right-3": "WORKSPACE_PREVIOUS::follow",
        "swipe-down-3": "",
        "swipe-up-4": "TOGGLE_EXPO::follow",
        "swipe-down-4": "",
    }),
    (_("Easy Window Management Gestures"), {
        "swipe-up-3": "PUSH_TILE_UP::follow",
        "swipe-left-3": "PUSH_TILE_LEFT::follow",
        "swipe-right-3": "PUSH_TILE_RIGHT::follow",
        "swipe-down-3": "PUSH_TILE_DOWN::follow",
        "swipe-up-4": "MAXIMIZE::follow",
        "swipe-down-4": "MINIMIZE::follow",
    }),
]

GESTURE_TEMPLATE_MAX_COLUMNS = 4

TEMPLATE_DIRECTIONS = {"up": _("up"), "down": _("down"), "left": _("left"),
                      "right": _("right"), "in": _("in"), "out": _("out")}


def _action_label(action_id):
    return next((row[ACTION_LABEL_COL] for row in ACTIONS if row[ACTION_ID_COL] == action_id), action_id)


def template_tooltip(bindings):
    lines = []
    for key in sorted(bindings, key=lambda k: (int(k.split("-")[2]), k.split("-")[1])):
        _kind, direction, fingers = key.split("-")
        action_id = bindings[key].split("::")[0]
        lines.append(_("%s-finger swipe %s: %s") %
                     (fingers, TEMPLATE_DIRECTIONS.get(direction, direction), _action_label(action_id)))
    return "\n".join(lines)

# Finger counts a touchpad does not report. Two fingers on one is
# scrolling, and no touchpad has five to spare.
TOUCH_ONLY_FINGERS = {2, 5}

[PHASE_ID_COL, PHASE_LABEL_COL] = range(0, 2)

# The kernel reports how many fingers are down with these key codes.
FINGER_TOOL_CODES = {3: 0x14e, 4: 0x14f, 5: 0x148}
BTN_TOOL_FINGER = 0x145

# A device with these but not the button above is a touchscreen: it
# reports where it is touched, not how many fingers are down.
BTN_TOUCH = 0x14a
ABS_MT_POSITION_X = 0x35


def _capability_bits(path):
    # The kernel writes this as space-separated hex chunks, highest first.
    try:
        with open(path) as f:
            value = f.read().strip()
    except OSError:
        return set()

    number = 0
    for index, chunk in enumerate(reversed(value.split())):
        try:
            number |= int(chunk, 16) << (64 * index)
        except ValueError:
            return set()

    # Bit N set means N is in the returned set.
    return {bit for bit in range(1024) if number >> bit & 1}


def supported_finger_counts():
    # Falls back to offering everything if nothing can be read.
    counts = set()
    found_touchpad = False

    for device in glob.glob("/sys/class/input/event*/device"):
        keys = _capability_bits(os.path.join(device, "capabilities/key"))

        if BTN_TOOL_FINGER not in keys:
            continue

        found_touchpad = True
        counts.update(count for count, code in FINGER_TOOL_CODES.items() if code in keys)

    if not found_touchpad:
        return set(FINGER_TOOL_CODES)

    return counts


def has_touchscreen():
    for device in glob.glob("/sys/class/input/event*/device"):
        keys = _capability_bits(os.path.join(device, "capabilities/key"))

        if BTN_TOUCH not in keys or BTN_TOOL_FINGER in keys:
            continue

        if ABS_MT_POSITION_X in _capability_bits(os.path.join(device, "capabilities/abs")):
            return True

    return False


def offered_swipe_finger_counts():
    if has_touchscreen():
        return {2, 3, 4, 5}

    return supported_finger_counts()


def can_follow(action):
    # Whether @action can follow the fingers. Must agree with can_follow()
    # in js/ui/gestures/actions.js.
    for option in ACTIONS:
        if option[ACTION_ID_COL] == action:
            return option[ACTION_ALLOW_FOLLOW_COL]

    return False


def parse_setting(string):
    pieces = string.split("::")

    if len(pieces) == 2:
        return (pieces[0], "", pieces[1])
    elif len(pieces) == 3:
        return pieces
    else:
        return ["", "", ""]

def setting_to_string(action="", command=None, phase=DEFAULT_PHASE):
    if action == "":
        return ""

    # Nothing matches an empty phase, so an action with one never runs.
    if not phase:
        phase = DEFAULT_PHASE

    if command is not None:
        return f"{action}::{command}::{phase}"
    else:
        return f"{action}::{phase}"

class Module:
    name = "gestures"
    category = "prefs"
    comment = _("Manage touch gestures")

    def __init__(self, content_box):
        keywords = _("gesture, swipe, pinch, touch")
        sidePage = SidePage(_("Gestures"), "cs-gestures", keywords, content_box, 560, module=self)
        self.sidePage = sidePage

        self.gesture_settings = None
        self.disabled_box = None

    def on_module_selected(self):
        self.is_wayland = util.get_session_type() == "wayland"

        # On X11, check for touchegg; on Wayland, native gestures are used
        if self.is_wayland:
            installed = True
            alive = True
        else:
            installed = GLib.find_program_in_path("touchegg")
            alive = self.test_daemon_alive()

        if self.gesture_settings is None:
            self.gesture_settings = Gio.Settings(schema_id=SCHEMA)
            self.migrate_settings()
            self.gesture_settings.connect("changed::enabled", self.on_enabled_changed)

        enabled = self.gesture_settings.get_boolean("enabled")

        if not self.loaded:
            print("Loading Gestures module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            page = SettingsPage()
            self.sidePage.stack.add_named(page, "disabled")

            page.set_spacing(10)

            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, valign=Gtk.Align.START, margin_top=150)
            page.pack_start(box, True, True, 0)
            image = Gtk.Image(icon_name="xsi-touch-disabled-symbolic", icon_size=Gtk.IconSize.DIALOG)
            box.pack_start(image, False, False, 0)

            self.disabled_label = Gtk.Label(expand=True)
            box.pack_start(self.disabled_label, False, False, 0)

            self.disabled_page_switch = Gtk.Switch(active=self.gesture_settings.get_boolean("enabled"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_page_switch.connect("notify::active", self.enabled_switch_changed)
            box.pack_start(self.disabled_page_switch, False, False, 0)

            self.disabled_retry_button = Gtk.Button(label=_("Check again"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_retry_button.connect("clicked", lambda w: self.on_module_selected())
            box.pack_start(self.disabled_retry_button, False, False, 0)

            self.disabled_page_disable_button = Gtk.Button(label=_("Disable"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_page_disable_button.connect("clicked", lambda w: self.gesture_settings.set_boolean("enabled", False))
            box.pack_start(self.disabled_page_disable_button, False, False, 0)

            ssource = Gio.SettingsSchemaSource.get_default()
            schema = ssource.lookup(SCHEMA, True)
            all_keys = schema.list_keys()

            order = ["up", "down", "left", "right", "in", "out"]

            def sort_by_direction(key1, key2):
                v1 = 0
                v2 = 0
                for i, k in enumerate(order):
                    if k in key1:
                        v1 = i
                    if k in key2:
                        v2 = i

                if v1 < v2:
                    return -1
                if v1 > v2:
                    return 1
                return 0

            keys = sorted([key for key in all_keys if key not in NON_GESTURE_KEYS], key=cmp_to_key(sort_by_direction))

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "tweaks", _("Settings"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            section = page.add_section(_("General"))
            widget = GSettingsSwitch(_("Enable gestures"), "org.cinnamon.gestures", "enabled")
            section.add_row(widget)

            reset_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
            reset_button = Gtk.Button(label=_("Reset gestures to defaults"), halign=Gtk.Align.CENTER)
            reset_button.connect("clicked", self.on_reset_clicked)
            reset_box.pack_start(reset_button, True, False, 0)
            section.add_row(reset_box)

            section = page.add_section(_("Activation thresholds"),
                                       _("In percentage of the touch surface"))

            widget = GSettingsRange(_("Swipe"), "org.cinnamon.gestures", "swipe-percent-threshold", 
                _("20%"), _("80%"), 20, 80, step=5, show_value=True)
            widget.add_mark(60, Gtk.PositionType.TOP, None)
            section.add_row(widget)
            widget = GSettingsRange(_("Pinch"), "org.cinnamon.gestures", "pinch-percent-threshold", 
                _("20%"), _("80%"), 20, 80, step=5, show_value=True)
            widget.add_mark(40, Gtk.PositionType.TOP, None)
            section.add_row(widget)

            settings = page.add_section(_("Looking for something else?"))

            box = SettingsWidget()
            button = Gtk.Button(label=_("Mouse and Touchpad Settings"), halign=Gtk.Align.CENTER)
            button.connect("clicked", self.on_mouse_settings_button_clicked)
            box.pack_start(button, True, False, 0)
            settings.add_row(box)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "swipe", _("Swipe"))
            page.set_margin_top(5)
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
            label_size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
            section = page.add_section(_("Swipe"))

            # Tighter than the page's usual section spacing.
            top = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
            page.pack_start(top, False, False, 0)

            # Templates for easy combos button flexbox
            top.pack_start(self.build_gesture_templates(), False, False, 0)

            box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            box.pack_start(Gtk.Image.new_from_icon_name(FOLLOW_ICON, Gtk.IconSize.BUTTON),
                          False, False, 0)
            label = Gtk.Label(
                label=_("Gestures marked with this icon can follow your fingers as they move"),
                wrap=True, xalign=0.0)
            box.pack_start(label, True, True, 0)
            top.pack_start(box, False, False, 0)

            swipe_fingers = sorted(offered_swipe_finger_counts())
            lowest_swipe_fingers = swipe_fingers[0] if swipe_fingers else None

            for fingers in swipe_fingers:
                # One picture per count, not one shared by all of them.
                picture = Gtk.Image.new_from_pixbuf(
                    themed_swipe_pixbuf(page, fingers, SWIPE_ILLUSTRATION_SIZE))

                subtitle = _("Touchscreen only") if fingers in TOUCH_ONLY_FINGERS else None
                section, expander = self.add_finger_section(
                    page, _("Swipe with %d fingers") % fingers,
                    subtitle, fingers != lowest_swipe_fingers, picture=picture)

                for key in keys:
                    label = self.get_key_label(key, "swipe", fingers)
                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key,
                                             size_group=size_group,
                                             label_size_group=label_size_group)
                    section.add_row(widget)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "pinch", _("Pinch"))
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
            label_size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            for fingers in range(2, 5):
                section, _expander = self.add_finger_section(page, _("Pinch with %d fingers") % fingers,
                                                          None, fingers != 2)
                for key in keys:
                    label = self.get_key_label(key, "pinch", fingers)

                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key,
                                             size_group=size_group, label_size_group=label_size_group)
                    section.add_row(widget)

            section, _expander = self.add_finger_section(page, _("Pinch with 5 fingers"), _("Touchscreen only"), True)

            for key in keys:
                label = self.get_key_label(key, "pinch", 5)

                if not label:
                    continue

                widget = GestureComboBox(label, self.gesture_settings, key,
                                         size_group=size_group, label_size_group=label_size_group)
                section.add_row(widget)

            # Every tap gesture needs a touchscreen, so the page does too.
            if has_touchscreen():
                page = SettingsPage()
                self.sidePage.stack.add_titled(page, "tap", _("Tap"))
                size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
                label_size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

                section = page.add_section(_("Tap"))
                section.set_halign(Gtk.Align.START)

                for fingers in range(2, 6):
                    for key in keys:
                        label = self.get_key_label(key, "tap", fingers)

                        if not label:
                            continue

                        widget = GestureComboBox(label, self.gesture_settings, key,
                                                 size_group=size_group, label_size_group=label_size_group)
                        section.add_row(widget)

        self.disabled_page_switch.set_visible(False)
        self.disabled_retry_button.set_visible(False)
        self.disabled_page_disable_button.set_visible(False)

        text = ""
        if not self.gesture_settings.get_boolean("enabled"):
            self.disabled_page_switch.set_visible(True)
            text = _("Gestures are disabled")
        elif not self.is_wayland:
            # X11-specific: check for touchegg
            if not installed:
                text = _("The touchegg package must be installed for gesture support.")
                self.disabled_retry_button.show()
            elif not alive:
                text = _("The Touchegg service is not running")
                if self.gesture_settings.get_boolean("enabled"):
                    self.disabled_page_disable_button.set_visible(True)
                self.disabled_retry_button.show()

        self.sidePage.stack.set_transition_type(Gtk.StackTransitionType.NONE)

        if not enabled or (not self.is_wayland and (not alive or not installed)):
            self.disabled_label.set_markup(f"<big><b>{text}</b></big>")
            page = "disabled"
        else:
            page = "swipe"

        GLib.idle_add(self.set_initial_page, page)

    def on_mouse_settings_button_clicked(self, button):
        subprocess.Popen(["cinnamon-settings", "mouse"])

    def build_gesture_templates(self):
        """A row of buttons, one per GESTURE_TEMPLATES entry, each setting a
        whole bundle of gestures at once. A Gtk.FlowBox wraps on its own
        once there are more than GESTURE_TEMPLATE_MAX_COLUMNS of them.

        Every button stays clickable. Whichever template's bindings are
        all currently in effect gets highlighted; editing any one of its
        gestures, by another template or by hand, drops that highlight.
        """
        flow = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE,
                           homogeneous=True,
                           row_spacing=10, column_spacing=10,
                           min_children_per_line=1,
                           max_children_per_line=GESTURE_TEMPLATE_MAX_COLUMNS)

        self.template_buttons = []
        for name, bindings in GESTURE_TEMPLATES:
            button = Gtk.Button(label=name, tooltip_text=template_tooltip(bindings))
            button.connect("clicked", self.on_template_clicked, bindings)
            flow.add(button)
            self.template_buttons.append((button, bindings))

        self.gesture_settings.connect("changed", self.refresh_template_buttons)
        self.refresh_template_buttons()

        return flow

    def template_matches(self, bindings):
        return all(self.gesture_settings.get_string(key) == value
                  for key, value in bindings.items())

    def refresh_template_buttons(self, *args):
        for button, bindings in self.template_buttons:
            if self.template_matches(bindings):
                button.get_style_context().add_class("suggested-action")
            else:
                button.get_style_context().remove_class("suggested-action")

    def on_template_clicked(self, button, bindings):
        for key, value in bindings.items():
            self.gesture_settings.set_string(key, value)

    def add_finger_section(self, page, title, subtitle, collapsible, picture=None):
        """Add a section for one finger count. Collapsed by default when
        @collapsible, so only the lowest supported count is shown open.
        @page only needs to be a vertical Gtk.Box.

        @picture, if given, sits beside the rows, below a header that
        spans the full width and does not move when the section opens.

        Returns: (section, expander); @expander is None when not collapsible.
        """
        # halign=START, or a vertical box gives this its full width
        # regardless of pack flags, stretching the frame with it.
        content = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=20,
                          halign=Gtk.Align.START)
        if picture is not None:
            picture.set_valign(Gtk.Align.START)
            content.pack_start(picture, False, False, 0)

        section = SettingsSection()
        content.pack_start(section, False, False, 0)

        if not collapsible:
            header = Gtk.Label(use_markup=True, xalign=0.0)
            header.set_markup("<b>%s</b>" % GLib.markup_escape_text(title))
            page.pack_start(header, False, False, 0)

            if subtitle:
                sub = Gtk.Label(label=subtitle, xalign=0.0)
                sub.get_style_context().add_class("dim-label")
                page.pack_start(sub, False, False, 0)

            page.pack_start(content, False, False, 0)
            return section, None

        markup = "<b>%s</b>" % GLib.markup_escape_text(title)
        if subtitle:
            markup += "  <small>%s</small>" % GLib.markup_escape_text(subtitle)

        expander = Gtk.Expander(use_markup=True, label=markup, expanded=False)
        expander.add(content)
        page.pack_start(expander, False, False, 0)

        return section, expander

    def on_reset_clicked(self, button):
        dialog = Gtk.MessageDialog(transient_for=button.get_toplevel(),
                                   modal=True,
                                   message_type=Gtk.MessageType.QUESTION,
                                   buttons=Gtk.ButtonsType.YES_NO,
                                   text=_("Reset all gestures to their defaults?"))
        response = dialog.run()
        dialog.destroy()

        if response != Gtk.ResponseType.YES:
            return

        # Not NON_GESTURE_KEYS: "enabled" defaults to off, and a reset
        # here shouldn't turn gestures off or touch the thresholds.
        ssource = Gio.SettingsSchemaSource.get_default()
        schema = ssource.lookup(SCHEMA, True)
        for key in schema.list_keys():
            if key not in NON_GESTURE_KEYS:
                self.gesture_settings.reset(key)

    def set_initial_page(self, page):
        if page == "disabled":
            Gio.Application.get_default().stack_switcher.set_opacity(0)
        else:
            Gio.Application.get_default().stack_switcher.set_opacity(1.0)

        self.sidePage.stack.set_visible_child_full(page, Gtk.StackTransitionType.CROSSFADE)
        self.sidePage.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)

    def enabled_switch_changed(self, widget, pspec):
        self.gesture_settings.set_boolean("enabled", widget.get_active())

    def on_enabled_changed(self, settings, key):
        try:
            self.disabled_page_switch.disconnect_by_func(self.enabled_switch_changed)
        except TypeError:
            pass

        enabled = settings.get_boolean("enabled")
        self.disabled_page_switch.set_active(enabled)

        self.on_module_selected()

        self.disabled_page_switch.connect("notify::active", self.enabled_switch_changed)

    def get_key_label(self, key, gtype, fingers):
        parts = key.split("-")
        if gtype != parts[0]:
            return None

        gesture_directions = {"left": _("Left"), "right": _("Right"),
                              "up": _("Up"), "down": _("Down"),
                              "in": _("In"), "out": _("Out")}
        if gtype in ("swipe", "pinch"):
            if int(parts[2]) != fingers:
                return None
            direction = parts[1]
            return gesture_directions.get(direction, None)
        if gtype == "tap":
            if int(parts[1]) != fingers:
                return None
            return _("Tap with %d fingers") % fingers

        return None

    def test_daemon_alive(self):
        try:
            conn = Gio.DBusConnection.new_for_address_sync("unix:abstract=touchegg",
                                                           Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT,
                                                           None, None)
            conn.close_sync(None)
            return True
        except GLib.Error:
            pass

        return False

    def migrate_settings(self):
        source = Gio.SettingsSchemaSource.get_default()
        if source:
            schema = source.lookup(SCHEMA, True)
            if schema:
                all_keys = schema.list_keys()
                for key in all_keys:
                    if key not in NON_GESTURE_KEYS:
                        val = self.gesture_settings.get_string(key)
                        if val == "" or "::" in val:
                            continue

                        action_string = custom_string = ""
                        if val.startswith("EXEC:"):
                            action_string, custom_string = val.split(":")
                            if custom_string == "":
                                # A RUN with no command is invalid; reset it.
                                self.gesture_settings.set_string(key, "")
                                continue
                        else:
                            action_string = val

                        if custom_string == "":
                            self.gesture_settings.set_string(key, f"{action_string}::end")
                        else:
                            self.gesture_settings.set_string(key, f"{action_string}::{custom_string}::end")

class NonScrollingComboBox(Gtk.ComboBox):
    def __init__(self, *args, **kwargs):
        Gtk.ComboBox.__init__(self, *args, **kwargs)

    def do_scroll_event(self, event, data=None):
        # Skip Gtk.ComboBox's default handler.
        #
        # Connecting to a Gtk.ComboBox and stopping a scroll-event
        # prevents unintentional combobox changes, but also breaks
        # any scrollable parents when passing over the combobox.
        Gtk.Widget.do_scroll_event(self, event)

class GestureComboBox(SettingsWidget):
    def __init__(self, label, settings=None, key=None, size_group=None, label_size_group=None):
        super(GestureComboBox, self).__init__()
        self.props.margin = 0
        self.action_map = {}
        self.phase_map = {}

        self.action_value = None
        self.custom_value = None
        self.phase_value = None
        self.follow_value = False

        self.updating_from_setting = False
        self.updating_settings = False

        self.settings = settings
        self.key = key

        # halign=START keeps the row's own hover highlight full width
        # while its content hugs the left, instead of spreading apart.
        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10,
                       halign=Gtk.Align.START)
        self.pack_start(hbox, True, True, 0)
        self.label = SettingsLabel(label)
        self.label.props.xalign = 0.0
        self.label.props.yalign = 0.0

        # Holds every label in the group to the widest one's width, so a
        # short label ("In") does not leave its controls out of line.
        label_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        label_vbox.pack_start(self.label, False, False, 0)
        hbox.pack_start(label_vbox, False, False, 6)

        if label_size_group:
            label_size_group.add_widget(label_vbox)

        controls_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        hbox.pack_start(controls_vbox, False, False, 0)

        self.follow_button = Gtk.ToggleButton(
            image=Gtk.Image.new_from_icon_name(FOLLOW_ICON, Gtk.IconSize.BUTTON),
            tooltip_text=_("Toggle modern gesture that smoothly follow your fingers"),
            no_show_all=True)

        follow_column = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL,
                                halign=Gtk.Align.CENTER,
                                valign=Gtk.Align.START,
                                width_request=FOLLOW_COLUMN_WIDTH)
        follow_column.pack_start(self.follow_button, False, False, 0)
        hbox.pack_start(follow_column, False, False, 0)

        # always visible
        self.action_combo = NonScrollingComboBox(visible=True)
        renderer_text = Gtk.CellRendererText()
        self.action_combo.pack_start(renderer_text, True)
        self.action_combo.add_attribute(renderer_text, "text", ACTION_LABEL_COL)

        controls_vbox.pack_start(self.action_combo, False, False, 0)

        self.custom_entry = Gtk.Entry(placeholder_text=_("Enter a command"), visible=True)
        self.custom_revealer = Gtk.Revealer(child=self.custom_entry,
                                            transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN,
                                            transition_duration=150,
                                            no_show_all=True)

        controls_vbox.pack_start(self.custom_revealer, False, False, 0)

        self.phase_combo = NonScrollingComboBox(visible=True)
        renderer_text = Gtk.CellRendererText()
        self.phase_combo.pack_start(renderer_text, True)
        self.phase_combo.add_attribute(renderer_text, "text", PHASE_LABEL_COL)

        self.phase_revealer = Gtk.Revealer(child=self.phase_combo,
                                           transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN,
                                           transition_duration=150,
                                           no_show_all=True)

        controls_vbox.pack_start(self.phase_revealer, False, False, 0)

        self.adjust_range = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, -50, 50, 2)
        self.adjust_range.add_mark(0, Gtk.PositionType.TOP, None)
        self.adjust_range.set_properties(visible=True,
                                         inverted=True,
                                         digits=0,
                                         has_origin=False,
                                         draw_value=False,
                                         value_pos=Gtk.PositionType.BOTTOM)

        range_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        range_label = Gtk.Label(label=_("Sensitivity"))
        range_box.pack_start(range_label, False, False, 0)

        range_hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        less_label = Gtk.Label(label=_("Less"))
        less_label.get_style_context().add_class("dim-label")
        more_label = Gtk.Label(label=_("More"))
        more_label.get_style_context().add_class("dim-label")
        range_hbox.pack_start(less_label, False, False, 0)
        range_hbox.pack_start(self.adjust_range, True, True, 0)
        range_hbox.pack_start(more_label, False, False, 0)
        range_box.pack_start(range_hbox, False, False, 0)
        range_box.show_all()

        self.range_revealer = Gtk.Revealer(child=range_box,
                                           transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN,
                                           transition_duration=150,
                                           no_show_all=True)

        controls_vbox.pack_start(self.range_revealer, False, False, 0)

        self.set_options()

        self.settings.connect("changed::" + key, self.on_setting_changed)
        self.on_setting_changed(settings, key)
        self.action_combo.connect("changed", self.on_my_value_changed)

        self.phase_combo.connect("changed", self.on_my_value_changed)
        self.follow_button.connect("toggled", self.on_follow_toggled)
        self.custom_entry.connect("changed", self.on_custom_entry_changed)
        self.adjust_range.connect("value-changed", self.on_range_value_changed)

        if size_group:
            size_group.add_widget(self.action_combo)
            size_group.add_widget(self.phase_combo)

    def on_my_value_changed(self, widget):
        if self.updating_from_setting:
            return

        tree_iter = widget.get_active_iter()
        if tree_iter is not None:
            if widget == self.action_combo:
                self.action_value = self.action_model[tree_iter][ACTION_ID_COL]
                custom_type = self.action_model[self.action_combo.get_active_iter()][ACTION_EXTRA_WIDGET_TYPE_COL]
                default_val = self.action_model[self.action_combo.get_active_iter()][ACTION_DEFAULT_CUSTOM_VALUE_COL]
                if custom_type == "slider":
                    self.adjust_range.set_value(int(default_val))
                elif custom_type == "entry":
                    self.custom_entry.set_text("")

            elif widget == self.phase_combo:
                self.phase_value = self.phase_model[tree_iter][PHASE_ID_COL]

            self.update_control_visibilities()
            self.store_action_settings()

    def render_follow_mark(self, layout, cell, model, tree_iter, data=None):
        # Marked on every followable row or volume related, except the one already chosen:
        # the button in the last column communicates that instead.
        row = model[tree_iter]
        mark = row[ACTION_ALLOW_FOLLOW_COL] and row[ACTION_ID_COL] != self.action_value or "VOLUME" in row[ACTION_ID_COL]
        cell.set_property("icon-name", FOLLOW_ICON if mark else None)

    def on_follow_toggled(self, button):
        self.sync_follow_appearance()

        if self.updating_from_setting:
            return

        self.follow_value = button.get_active()

        self.update_control_visibilities()
        self.store_action_settings()

    def sync_follow_appearance(self):

        context = self.follow_button.get_style_context()

        if self.follow_button.get_active():
            context.add_class("suggested-action")
        else:
            context.remove_class("suggested-action")

    def update_control_visibilities(self):
        if self.action_value == "":
            self.follow_button.hide()
            self.phase_revealer.set_reveal_child(False)
            self.phase_revealer.hide()
            self.custom_revealer.set_reveal_child(False)
            self.custom_revealer.hide()
            self.range_revealer.set_reveal_child(False)
            self.range_revealer.hide()
            return

        follow_visible = self.action_model[self.action_combo.get_active_iter()][ACTION_ALLOW_FOLLOW_COL]
        self.follow_button.set_visible(follow_visible)

        # A gesture that acts the whole way through has no single phase.
        following = follow_visible and self.follow_value
        phase_combo_visible = self.action_model[self.action_combo.get_active_iter()][ACTION_ALLOW_PHASE_SELECT_COL] \
            and not following
        self.phase_revealer.set_visible(phase_combo_visible)
        self.phase_revealer.set_reveal_child(phase_combo_visible)

        custom_entry_visible = self.action_value == "EXEC"
        self.custom_revealer.set_visible(custom_entry_visible)
        self.custom_revealer.set_reveal_child(custom_entry_visible)

        range_visible = self.action_model[self.action_combo.get_active_iter()][ACTION_EXTRA_WIDGET_TYPE_COL] == "slider"
        self.range_revealer.set_visible(range_visible)
        self.range_revealer.set_reveal_child(range_visible)

    def on_custom_entry_changed(self, entry):
        if self.updating_from_setting:
            return

        self.custom_value = entry.get_text()

        self.store_action_settings()

    def on_range_value_changed(self, range):
        if self.updating_from_setting:
            return

        self.custom_value = int(self.adjust_range.get_value())

        self.store_action_settings()

    def store_action_settings(self):
        self.updating_settings = True

        if self.action_value == "EXEC" and self.custom_value == "":
            return

        follows = self.follow_value and can_follow(self.action_value)
        val = setting_to_string(self.action_value, self.custom_value,
                                FOLLOW_PHASE if follows else self.phase_value)

        self.settings.set_string(self.key, val)

        self.updating_settings = False

    def on_setting_changed(self, settings, key):
        if self.updating_settings:
            return

        self.updating_from_setting = True

        self.action_value, self.custom_value, self.phase_value = parse_setting(settings.get_string(key))

        # Following is stored in place of a phase, so the phase control
        # returns to its default and the button carries the meaning.
        self.follow_value = self.phase_value == FOLLOW_PHASE
        if self.follow_value:
            self.phase_value = DEFAULT_PHASE

        self.follow_button.set_active(self.follow_value)
        self.sync_follow_appearance()

        if self.action_value == "EXEC":
            if self.custom_value != "":
                self.action_combo.set_active_iter(self.action_map["EXEC"])
            else:
                self.action_value = ""
                self.action_combo.set_active_iter(self.action_map[""])
        else:
            try:
                self.action_combo.set_active_iter(self.action_map[self.action_value])
            except KeyError:
                self.action_combo.set_active_iter(self.action_map[""])

        try:
            self.phase_combo.set_active_iter(self.phase_map[self.phase_value])
        except:
            # Also covers an unset key, whose phase reads back empty; the
            # control's own handler does not run while we set it here.
            self.phase_value = DEFAULT_PHASE
            self.phase_combo.set_active_iter(self.phase_map[DEFAULT_PHASE])

        custom_type = self.action_model[self.action_combo.get_active_iter()][ACTION_EXTRA_WIDGET_TYPE_COL]

        if custom_type == "entry":
            self.custom_entry.set_text(self.custom_value)
        elif custom_type == "slider":
            if self.custom_value == "":
                default_value = self.action_model[self.action_combo.get_active_iter()][ACTION_DEFAULT_CUSTOM_VALUE_COL]
                val = int(default_value)
            else:
                val = int(self.custom_value)

            self.adjust_range.set_value(val)

        self.update_control_visibilities()
        self.updating_from_setting = False

    def set_options(self):
        self.action_model = Gtk.ListStore(str, str, bool, str, str, bool)

        for option in ACTIONS:
            self.action_map[option[0]] = self.action_model.append(option)

        self.action_combo.set_model(self.action_model)
        self.action_combo.set_id_column(0)

        # Without this, GTK lines the active row up under the click and
        # leaves blank space above a list this long doing the sums.
        self.action_combo.set_wrap_width(1)

        # Marks followable actions in the list, not the chosen one: the
        # button next to the row already says that.
        self.follow_mark = Gtk.CellRendererPixbuf(xalign=1.0)
        self.action_combo.pack_end(self.follow_mark, False)
        self.action_combo.set_cell_data_func(self.follow_mark, self.render_follow_mark)

        self.phase_model = Gtk.ListStore(str, str)

        for phase in PHASES:
            self.phase_map[phase[0]] = self.phase_model.append([phase[0], phase[1]])

        self.phase_combo.set_model(self.phase_model)
        self.phase_combo.set_id_column(0)
