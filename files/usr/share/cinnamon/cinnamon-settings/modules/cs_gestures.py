#!/usr/bin/python3

import glob
import os
from functools import cmp_to_key
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk

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
    # Columns: action id, label, phase selection allowed, extra widget type(entry|slider|none), default custom value, can follow the fingers
    ["", _("Disabled"), False, "none", "", False],
    ["WORKSPACE_NEXT", _("Switch to right workspace"), True, "none", "", True],
    ["WORKSPACE_PREVIOUS", _("Switch to left workspace"), True, "none", "", True],
    # ["WORKSPACE_UP", _("Switch to the workspace above"), "none", ""],
    # ["WORKSPACE_DOWN", _("Switch to the workspace below"), "none", ""],
    ["TOGGLE_EXPO", _("(Expo) Show the workspace selector"), True, "none", "", True],
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

# A phase meaning the action follows the fingers instead of firing once.
# Not listed in PHASES: only some actions can use it for now.
FOLLOW_PHASE = "follow"
DEFAULT_PHASE = "end"

# Icon (from the xapp theme) marking actions that follow the fingers
FOLLOW_ICON = "xsi-boot-menu-symbolic"

# Actions that can only follow the fingers, whatever phase is stored.
ALWAYS_FOLLOW_ACTIONS = ("VOLUME_UP", "VOLUME_DOWN", "ZOOM_IN", "ZOOM_OUT")

# Symbolic gesture illustrations, one for each finger count.
GRAPHICS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "graphics")

# Size the illustrations are drawn at.
ILLUSTRATION_SIZE = 48


def gesture_illustration(gesture, fingers):
    path = os.path.join(GRAPHICS_DIR, "%s-%d-fingers-symbolic.svg" % (gesture, fingers))
    return Gtk.Image(gicon=Gio.FileIcon.new(Gio.File.new_for_path(path)), pixel_size=ILLUSTRATION_SIZE)


# Reserved in every row so the rows line up.
FOLLOW_COLUMN_WIDTH = 42

FOLLOW_MARK_WIDTH = 16

# One-click binding bundles: (name, {key: "ACTION::phase"}). The FlowBox
# wraps the buttons onto extra lines on its own.
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


# Finger counts each kind of device can report. libinput delivers no
# touchpad gesture above four fingers, and two-finger swipes scroll.
# Keep in sync with js/ui/gestures/nativeGestureSource.js.
TOUCHPAD_FINGERS = {"swipe": (3, 4), "pinch": (2, 3, 4)}
TOUCHSCREEN_FINGERS = (2, 3, 4, 5)

[PHASE_ID_COL, PHASE_LABEL_COL] = range(0, 2)

# A touchpad reports how many fingers are down, starting with this key
# code. A device reporting position but no finger counts is a touchscreen.
BTN_TOOL_FINGER = 0x145
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


def has_touchscreen():
    for device in glob.glob("/sys/class/input/event*/device"):
        keys = _capability_bits(os.path.join(device, "capabilities/key"))

        if BTN_TOUCH not in keys or BTN_TOOL_FINGER in keys:
            continue

        if ABS_MT_POSITION_X in _capability_bits(os.path.join(device, "capabilities/abs")):
            return True

    return False


def offered_finger_counts(gesture, touchscreen):
    return TOUCHSCREEN_FINGERS if touchscreen else TOUCHPAD_FINGERS[gesture]


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

    # An empty phase would never match, so use the default.
    if not phase:
        phase = DEFAULT_PHASE

    if command is not None and command != "":
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
        self.finger_sections = []

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

            page = self.add_scrolled_page("tweaks", _("Settings"))

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

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
            label_size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            page = self.add_scrolled_page("swipe", _("Swipe"), header=self.build_follow_infobar())

            section = page.add_section()
            section.add_row(self.build_gesture_templates())

            touchscreen = has_touchscreen()

            for fingers in offered_finger_counts("swipe", touchscreen):
                self.add_finger_section(
                    page, "swipe", fingers,
                    ngettext("Swipe with %d finger", "Swipe with %d fingers", fingers) % fingers,
                    keys, size_group, label_size_group)

            page = self.add_scrolled_page("pinch", _("Pinch"), header=self.build_follow_infobar())
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
            label_size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            for fingers in offered_finger_counts("pinch", touchscreen):
                self.add_finger_section(
                    page, "pinch", fingers,
                    ngettext("Pinch with %d finger", "Pinch with %d fingers", fingers) % fingers,
                    keys, size_group, label_size_group)

            # Taps only work on a touchscreen.
            if touchscreen:
                page = self.add_scrolled_page("tap", _("Tap"))
                size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
                label_size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

                section = page.add_section(_("Tap"))

                for fingers in TOUCHSCREEN_FINGERS:
                    key = "tap-%d" % fingers
                    widget = GestureComboBox(self.get_key_label(key, "tap", fingers),
                                             self.gesture_settings, key,
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

    def build_follow_infobar(self):
        infobar = Gtk.InfoBar(message_type=Gtk.MessageType.INFO)
        content = infobar.get_content_area()
        content.set_spacing(10)
        content.add(Gtk.Image.new_from_icon_name(FOLLOW_ICON, Gtk.IconSize.BUTTON))
        content.add(Gtk.Label(
            label=_("Gestures marked with this icon can follow your fingers as they move"),
            wrap=True, xalign=0.0))

        return infobar

    def add_scrolled_page(self, name, title, header=None):
        """Adds a stack page that scrolls on its own, so @header stays put
        above it instead of scrolling away with the window's content.

        Every page needs this: the stack asks for the height of its
        tallest child, and one unscrolled page would make the window
        scroll all of them.
        """
        page = SettingsPage()

        scroller = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER)
        scroller.add(page)
        scroller.get_child().set_shadow_type(Gtk.ShadowType.NONE)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        if header is not None:
            box.pack_start(header, False, False, 0)
        box.pack_start(scroller, True, True, 0)

        self.sidePage.stack.add_titled(box, name, title)

        return page

    def build_gesture_templates(self):
        """A row of buttons, one per GESTURE_TEMPLATES entry, each applying
        a whole bundle of bindings at once.
        """
        flow = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE,
                           homogeneous=True,
                           row_spacing=10, column_spacing=10,
                           min_children_per_line=1,
                           max_children_per_line=GESTURE_TEMPLATE_MAX_COLUMNS,
                           margin=6)

        for name, bindings in GESTURE_TEMPLATES:
            button = Gtk.Button(label=name)
            button.connect("clicked", self.on_template_clicked, bindings)
            flow.add(button)

        return flow

    def on_template_clicked(self, button, bindings):
        for key, value in bindings.items():
            self.gesture_settings.set_string(key, value)

    def add_finger_section(self, page, gesture, fingers, title, keys,
                           size_group, label_size_group):
        """Adds the section for one finger count of @gesture to a vertical
        box. Its first row holds a switch and is always shown.

        The switch belongs to no setting. It shows the other rows, and
        starts on if any of them has an action; switching it off also
        disables every action in the section.
        """
        section_keys = [key for key in keys if self.get_key_label(key, gesture, fingers)]
        in_use = any(self.gesture_settings.get_string(key) for key in section_keys)

        markup = "<b>%s</b>" % GLib.markup_escape_text(title)
        if fingers not in TOUCHPAD_FINGERS[gesture]:
            markup += "  <small>%s</small>" % GLib.markup_escape_text(_("Touchscreen only"))

        switch = Gtk.Switch(active=in_use, valign=Gtk.Align.CENTER)

        # Tighter than a SettingsWidget's defaults, with the picture in
        # line with the row labels below it.
        header = SettingsWidget()
        header.set_spacing(10)
        header.set_margin_start(6)
        header.pack_start(gesture_illustration(gesture, fingers), False, False, 0)
        header.pack_start(switch, False, False, 0)
        header.pack_start(Gtk.Label(use_markup=True, label=markup, xalign=0.0), False, False, 0)

        section = SettingsSection()
        section.add_row(header)
        page.pack_start(section, False, False, 0)

        # A click anywhere on the row works the switch, as on other pages.
        list_box = header.get_parent().get_parent()
        list_box.connect("row-activated", lambda *args: switch.set_active(not switch.get_active()))

        revealers = []
        for key in section_keys:
            widget = GestureComboBox(self.get_key_label(key, gesture, fingers),
                                     self.gesture_settings, key,
                                     size_group=size_group,
                                     label_size_group=label_size_group)
            revealer = section.add_reveal_row(widget, revealer=SettingsRevealer())
            revealer.set_reveal_child(in_use)
            revealers.append(revealer)

        self.finger_sections.append((switch, section_keys))
        switch.connect("notify::active", self.on_finger_switch_toggled, revealers, section_keys)
        self.gesture_settings.connect("changed", self.on_finger_section_changed, switch, section_keys)

    def on_finger_switch_toggled(self, switch, pspec, revealers, section_keys):
        for revealer in revealers:
            revealer.set_reveal_child(switch.get_active())

        if not switch.get_active():
            for key in section_keys:
                self.gesture_settings.set_string(key, "")

    def on_finger_section_changed(self, settings, key, switch, section_keys):
        # An action set from elsewhere, such as a preset, opens its section.
        if key in section_keys and settings.get_string(key):
            switch.set_active(True)

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

        # NON_GESTURE_KEYS are left alone: a reset should not turn
        # gestures off or touch the thresholds.
        ssource = Gio.SettingsSchemaSource.get_default()
        schema = ssource.lookup(SCHEMA, True)
        for key in schema.list_keys():
            if key not in NON_GESTURE_KEYS:
                self.gesture_settings.reset(key)

        for switch, section_keys in self.finger_sections:
            switch.set_active(any(self.gesture_settings.get_string(key) for key in section_keys))

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
            return ngettext("Tap with %d finger", "Tap with %d fingers", fingers) % fingers

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
                                # An EXEC with no command is invalid; clear it.
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
        # Scroll the parent instead of changing the selection, so the
        # combobox does not eat scrolling meant for a scrollable page.
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

        # A tap is over at once: it has no phases, and nothing to follow.
        self.is_tap = key.startswith("tap-")

        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        self.pack_start(hbox, True, True, 0)
        self.label = SettingsLabel(label)
        self.label.props.xalign = 0.0
        self.label.props.yalign = 0.0

        # Size group: equal label widths keep the controls aligned.
        label_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        label_vbox.pack_start(self.label, False, False, 0)
        hbox.pack_start(label_vbox, True, True, 6)

        if label_size_group:
            label_size_group.add_widget(label_vbox)

        controls_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        hbox.pack_start(controls_vbox, False, False, 0)

        self.follow_button = Gtk.ToggleButton(
            image=Gtk.Image.new_from_icon_name(FOLLOW_ICON, Gtk.IconSize.BUTTON),
            tooltip_text=_("Toggle modern gestures that smoothly follow your fingers"),
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

        # Themes can make a button taller than a combo.
        height_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.VERTICAL)
        height_group.add_widget(self.action_combo)
        height_group.add_widget(self.follow_button)

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

        # Milliseconds added to the time between zoom steps. Centred on
        # the value zoom actions are stored with by default.
        self.adjust_range = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, -50, 150, 2)
        self.adjust_range.add_mark(50, Gtk.PositionType.TOP, None)
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

        self.follow_toggled_id = self.follow_button.connect("toggled", self.on_follow_toggled)

        self.settings.connect("changed::" + key, self.on_setting_changed)
        self.on_setting_changed(settings, key)
        self.action_combo.connect("changed", self.on_my_value_changed)

        self.phase_combo.connect("changed", self.on_my_value_changed)
        self.custom_entry.connect("changed", self.on_custom_entry_changed)
        self.adjust_range.connect("value-changed", self.on_range_value_changed)

        if size_group:
            size_group.add_widget(self.action_combo)
            size_group.add_widget(self.phase_combo)

    def active_action(self):
        return self.action_model[self.action_combo.get_active_iter()]

    def on_my_value_changed(self, widget):
        if self.updating_from_setting:
            return

        tree_iter = widget.get_active_iter()
        if tree_iter is not None:
            if widget == self.action_combo:
                action = self.action_model[tree_iter]
                self.action_value = action[ACTION_ID_COL]
                custom_type = action[ACTION_EXTRA_WIDGET_TYPE_COL]
                if custom_type == "slider":
                    self.adjust_range.set_value(int(action[ACTION_DEFAULT_CUSTOM_VALUE_COL]))
                elif custom_type == "entry":
                    self.custom_entry.set_text("")

            elif widget == self.phase_combo:
                self.phase_value = self.phase_model[tree_iter][PHASE_ID_COL]

            self.update_control_visibilities()
            self.store_action_settings()

    def render_follow_mark(self, layout, cell, model, tree_iter, data=None):
        # Only in the open list: the closed combo shares this renderer.
        row = model[tree_iter]
        mark = self.action_combo.props.popup_shown and not self.is_tap and \
            (row[ACTION_ALLOW_FOLLOW_COL] or row[ACTION_ID_COL] in ALWAYS_FOLLOW_ACTIONS)
        cell.set_property("icon-name", FOLLOW_ICON if mark else None)

    def on_follow_toggled(self, button):
        self.follow_value = button.get_active()

        self.update_control_visibilities()
        self.store_action_settings()

    def update_control_visibilities(self):
        action = self.active_action()

        follow_visible = not self.is_tap and action[ACTION_ALLOW_FOLLOW_COL]
        always_follows = not self.is_tap and self.action_value in ALWAYS_FOLLOW_ACTIONS
        self.follow_button.set_visible(follow_visible or always_follows)
        self.follow_button.set_sensitive(not always_follows)

        # Shown on for an action that always follows, without touching
        # the user's own choice, which a followable action gets back.
        self.follow_button.handler_block(self.follow_toggled_id)
        self.follow_button.set_active(always_follows or self.follow_value)
        self.follow_button.handler_unblock(self.follow_toggled_id)

        # A gesture that acts the whole way through has no single phase.
        following = follow_visible and self.follow_value
        extra_widget = action[ACTION_EXTRA_WIDGET_TYPE_COL]

        for revealer, shown in (
                (self.phase_revealer, action[ACTION_ALLOW_PHASE_SELECT_COL] and not following and not self.is_tap),
                (self.custom_revealer, extra_widget == "entry"),
                (self.range_revealer, extra_widget == "slider")):
            revealer.set_visible(shown)
            revealer.set_reveal_child(shown)

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
        if self.action_value == "EXEC" and self.custom_value == "":
            return

        follows = self.follow_value and not self.is_tap and self.active_action()[ACTION_ALLOW_FOLLOW_COL]
        val = setting_to_string(self.action_value, self.custom_value,
                                FOLLOW_PHASE if follows else self.phase_value)

        self.updating_settings = True
        self.settings.set_string(self.key, val)
        self.updating_settings = False

    def on_setting_changed(self, settings, key):
        if self.updating_settings:
            return

        self.updating_from_setting = True

        self.action_value, self.custom_value, self.phase_value = parse_setting(settings.get_string(key))

        # "follow" is stored in place of a phase; the toggle shows it,
        # so the phase combo falls back to its default.
        self.follow_value = self.phase_value == FOLLOW_PHASE
        if self.follow_value:
            self.phase_value = DEFAULT_PHASE

        unknown_action = False

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
                unknown_action = True
                self.action_value = ""
                self.action_combo.set_active_iter(self.action_map[""])

        try:
            self.phase_combo.set_active_iter(self.phase_map[self.phase_value])
        except:
            # An unset key reads back an empty phase. The combo's handler
            # is off while we update from the setting.
            self.phase_value = DEFAULT_PHASE
            self.phase_combo.set_active_iter(self.phase_map[DEFAULT_PHASE])

        action = self.active_action()
        custom_type = action[ACTION_EXTRA_WIDGET_TYPE_COL]

        if custom_type == "entry":
            self.custom_entry.set_text(self.custom_value)
        elif custom_type == "slider":
            self.adjust_range.set_value(int(self.custom_value or action[ACTION_DEFAULT_CUSTOM_VALUE_COL]))

        self.update_control_visibilities()
        self.updating_from_setting = False

        # The row shows such an action as disabled, so make that true.
        if unknown_action:
            self.settings.set_string(self.key, "")

    def set_options(self):
        self.action_model = Gtk.ListStore(str, str, bool, str, str, bool)

        for option in ACTIONS:
            # These act on how far the fingers have moved, and a tap
            # reports the whole way at once.
            if self.is_tap and option[ACTION_ID_COL] in ALWAYS_FOLLOW_ACTIONS:
                continue

            self.action_map[option[0]] = self.action_model.append(option)

        self.action_combo.set_model(self.action_model)
        self.action_combo.set_id_column(0)

        # Without this, GTK scrolls a long list so the active row lands
        # under the pointer, leaving blank space above it.
        self.action_combo.set_wrap_width(1)

        # Fixed width so the list reserves room for the mark even though
        # it is measured while the mark is still hidden.
        self.follow_mark = Gtk.CellRendererPixbuf(xalign=1.0)
        self.follow_mark.set_fixed_size(FOLLOW_MARK_WIDTH, -1)
        self.action_combo.pack_end(self.follow_mark, False)
        self.action_combo.set_cell_data_func(self.follow_mark, self.render_follow_mark)
        self.action_combo.connect("notify::popup-shown", lambda combo, pspec: combo.queue_draw())

        self.phase_model = Gtk.ListStore(str, str)

        for phase in PHASES:
            self.phase_map[phase[0]] = self.phase_model.append([phase[0], phase[1]])

        self.phase_combo.set_model(self.phase_model)
        self.phase_combo.set_id_column(0)
