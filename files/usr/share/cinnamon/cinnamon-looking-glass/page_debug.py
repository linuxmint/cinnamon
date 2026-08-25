#!/usr/bin/python3

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

class ModulePage(Gtk.Box):
    def __init__(self, parent):
        Gtk.Box.__init__(self, orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.parent = parent
        self.topic_checks = []
        self.freeze = False
        self.unredirect_inhibited = False

        self.set_border_width(6)

        scanout_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        scanout_box.pack_start(Gtk.Label(label="Allow unredirect / direct scanout"), False, False, 0)
        self.scanout_switch = Gtk.Switch(active=True, valign=Gtk.Align.CENTER)
        self.scanout_switch.set_tooltip_text("Turn off to keep every window redirected through the compositor")
        self.scanout_switch.connect("notify::active", self.on_scanout_toggled)
        scanout_box.pack_end(self.scanout_switch, False, False, 0)
        self.pack_start(scanout_box, False, False, 0)

        self.pack_start(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), False, False, 0)

        self.verbose_check = Gtk.CheckButton(label="Verbose (all topics)")
        self.verbose_check.connect("toggled", self.on_verbose_toggled)
        self.pack_start(self.verbose_check, False, False, 0)

        self.groups_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.groups_box.set_border_width(6)

        scroller = Gtk.ScrolledWindow()
        scroller.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroller.add(self.groups_box)
        self.pack_start(scroller, True, True, 0)

        self.parent.cinnamon_proxy.connect("status-changed", self.on_status_change)

    def run_js(self, code):
        return self.parent.cinnamon_proxy.Eval(code)

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
        flowbox.set_max_children_per_line(4)
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
