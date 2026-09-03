#!/usr/bin/python3

# Write-only debug controls for the header bar. Cinnamon resets all of these
# when it restarts, so they only ever get pushed out, never read back.

import json
from gi.repository import Gtk

TOPIC_QUERY = "Object.entries(imports.gi.Meta.DebugTopic).filter(e => typeof e[1] === 'number')"

LABEL_OVERRIDES = {
    "DBUS": "DBus",
    "PREFS": "Preferences",
    "SM": "Session Management",
    "WINDOW_OPS": "Window Operations",
    "WORKAREA": "Work Area"
}

GROUPS = [
    ("Wayland", {"INPUT", "LAYER_SHELL", "SCANOUT"}),
    ("X11", {"GROUPS", "SHAPES", "SM", "SYNC"}),
    ("General", None)
]

# Still in MetaDebugTopic, but nothing passes them to meta_topic() any more.
UNUSED_TOPICS = {"COMPOSITOR", "ERRORS", "EVENTS", "THEMES"}

def make_label(name):
    return LABEL_OVERRIDES.get(name, name.replace("_", " ").title())

def add_control_row(box, label, control):
    row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
    row.pack_start(Gtk.Label(label=label), False, False, 0)
    row.pack_end(control, False, False, 0)
    box.pack_start(row, False, False, 0)

class SlowDownSpinButton(Gtk.SpinButton):
    def __init__(self, proxy):
        Gtk.SpinButton.__init__(self,
                                adjustment=Gtk.Adjustment(value=1,
                                                          lower=1,
                                                          upper=20,
                                                          step_increment=1,
                                                          page_increment=1),
                                numeric=True,
                                width_chars=2,
                                max_width_chars=2,
                                valign=Gtk.Align.CENTER)
        self.proxy = proxy

        self.set_tooltip_text("Effects slow-down factor")
        self.connect("value-changed", self.on_value_changed)

        self.proxy.connect("status-changed", self.on_status_change)

    def on_status_change(self, proxy, online):
        if online:
            self.set_value(1)

    def on_value_changed(self, spin):
        self.proxy.Eval("imports.gi.St.Settings.get().slow_down_factor = %d" % self.get_value_as_int())

class DebugButton(Gtk.MenuButton):
    def __init__(self, proxy):
        Gtk.MenuButton.__init__(self, image=Gtk.Image(icon_name="xsi-cog-symbolic"))
        self.proxy = proxy
        self.topic_checks = []
        self.freeze = False
        self.unredirect_inhibited = False

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        content.set_border_width(6)

        self.scanout_switch = Gtk.Switch(active=True, valign=Gtk.Align.CENTER)
        self.scanout_switch.set_tooltip_text("Turn off to keep every window redirected through the compositor")
        self.scanout_switch.connect("notify::active", self.on_scanout_toggled)
        add_control_row(content, "Allow unredirect / direct scanout", self.scanout_switch)

        add_control_row(content, "Effects slow-down factor", SlowDownSpinButton(proxy))

        content.pack_start(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), False, False, 0)

        self.verbose_check = Gtk.CheckButton(label="Verbose logging (enable all topics)")
        self.verbose_check.connect("toggled", self.on_verbose_toggled)
        content.pack_start(self.verbose_check, False, False, 0)

        self.groups_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.groups_box.set_border_width(6)

        scroller = Gtk.ScrolledWindow()
        scroller.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroller.set_propagate_natural_height(True)
        scroller.set_propagate_natural_width(True)
        scroller.set_max_content_height(500)
        scroller.add(self.groups_box)
        content.pack_start(scroller, True, True, 0)

        popover = Gtk.Popover()
        popover.add(content)
        content.show_all()
        self.set_popover(popover)

        self.proxy.connect("status-changed", self.on_status_change)

    def run_js(self, code):
        return self.proxy.Eval(code)

    def on_status_change(self, proxy, online):
        if not online:
            return

        if not self.topic_checks:
            self.build_topics()

        self.unredirect_inhibited = False
        self.freeze = True
        self.scanout_switch.set_active(True)
        self.verbose_check.set_active(False)
        for check in self.topic_checks:
            check.set_active(False)
        self.freeze = False

    def build_topics(self):
        success, data = self.run_js(TOPIC_QUERY)
        if not success:
            return

        try:
            topics = json.loads(data)
        except ValueError as e:
            print("Could not read the muffin debug topic list: %s" % e)
            return

        # VERBOSE is the master toggle above, not one of the individual topics.
        topics = [(name, value) for name, value in topics
                  if name != "VERBOSE" and name not in UNUSED_TOPICS]

        grouped = set()
        for title, names in GROUPS:
            if names is None:
                members = [t for t in topics if t[0] not in grouped]
            else:
                members = [t for t in topics if t[0] in names]
                grouped.update(name for name, value in members)

            if members:
                self.add_group(title, members)

        self.groups_box.show_all()

    def add_group(self, title, members):
        label = Gtk.Label(halign=Gtk.Align.START)
        label.set_markup("<b>%s</b>" % title)
        self.groups_box.pack_start(label, False, False, 0)

        flowbox = Gtk.FlowBox()
        flowbox.set_selection_mode(Gtk.SelectionMode.NONE)
        flowbox.set_min_children_per_line(2)
        flowbox.set_max_children_per_line(2)
        flowbox.set_homogeneous(True)
        self.groups_box.pack_start(flowbox, False, False, 0)

        for label_text, value in sorted((make_label(name), value) for name, value in members):
            check = Gtk.CheckButton(label=label_text)
            check.topic = value
            check.connect("toggled", self.on_topic_toggled)
            flowbox.add(check)
            self.topic_checks.append(check)

    def on_topic_toggled(self, check):
        if self.freeze:
            return

        active = check.get_active()
        method = "add_verbose_topic" if active else "remove_verbose_topic"
        self.run_js("imports.gi.Meta.%s(%d)" % (method, check.topic))

        # Removing a topic while everything was on leaves all the others on, so
        # only the master toggle needs correcting.
        if not active and self.verbose_check.get_active():
            self.freeze = True
            self.verbose_check.set_active(False)
            self.freeze = False

    def on_verbose_toggled(self, check):
        if self.freeze:
            return

        active = check.get_active()
        self.run_js("imports.gi.Meta.set_verbose(%s)" % ("true" if active else "false"))

        self.freeze = True
        for topic_check in self.topic_checks:
            topic_check.set_active(active)
        self.freeze = False

    def on_scanout_toggled(self, switch, pspec):
        if self.freeze:
            return

        self.set_unredirect_inhibited(not switch.get_active())

    def set_unredirect_inhibited(self, inhibited):
        if inhibited == self.unredirect_inhibited:
            return

        method = "disable" if inhibited else "enable"
        self.run_js("imports.gi.Meta.%s_unredirect_for_display(global.display)" % method)
        self.unredirect_inhibited = inhibited

    def release(self):
        self.set_unredirect_inhibited(False)
