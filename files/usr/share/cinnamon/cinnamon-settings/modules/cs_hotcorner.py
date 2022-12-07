#!/usr/bin/python3

import cairo
import math

from gi.repository import Gio, GLib

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

_270_DEG = 270.0 * (math.pi/180.0)
_180_DEG = 180.0 * (math.pi/180.0)
_90_DEG = 90.0 * (math.pi/180.0)
_0_DEG = 0.0 * (math.pi/180.0)


class Module:
    comment = _("Manage hotcorner settings")
    name = "hotcorner"
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("hotcorner, overview, scale, expo")
        sidePage = SidePage(_("Hot Corners"), "cs-overview", keywords, content_box, -1, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading HotCorner module")

            self.settings = Gio.Settings.new('org.cinnamon')
            self.settings.connect('changed::hotcorner-layout', self.on_settings_changed)
            oc_list = self.settings.get_strv("hotcorner-layout")
            self.properties = []
            for item in oc_list:
                props = item.rsplit(":", 2) # Don't split the command (1st el.)
                self.properties.append(props)

            self.corners = []
            for i in range(4):
                self.corners.append(HotCornerConfiguration(i, self.onConfigChanged))

            self.cornerDisplay = HotCornerDisplay(halign=Gtk.Align.FILL, hexpand=True)
            self.cornerDisplay.set_size_request(200, 200)

            grid = Gtk.Grid(row_spacing=32, column_spacing=16, halign=Gtk.Align.FILL)
            grid.set_border_width(16)

            grid.attach(self.cornerDisplay, 1, 0, 1, 2)
            grid.attach(self.corners[0], 0, 0, 1, 1)
            grid.attach(self.corners[1], 2, 0, 1, 1)
            grid.attach(self.corners[2], 0, 1, 1, 1)
            grid.attach(self.corners[3], 2, 1, 1, 1)

            self.sidePage.add_widget(grid)

            self.on_settings_changed(self.settings, "hotcorner-layout")

    def on_settings_changed(self, settings, key):
        oc_list = self.settings.get_strv("hotcorner-layout")
        del self.properties[:]
        for item in oc_list:
            props = item.rsplit(":", 2) # Don't split the command (1st el.)
            self.properties.append(props)
        self.update()

    def update(self):
        for corner in self.corners:
            function = ""
            prop = self.properties[corner.index]
            function = prop[0]
            enabled = prop[1] == "true"

            try:
                delay = prop[2]
            except:
                delay = "0"

            corner.setValues(function, enabled, delay)
            self.cornerDisplay.setCornerEnabled(corner.index, enabled)
        self.cornerDisplay.queue_draw()

    def onConfigChanged(self, index, function, enabled, delay):
        self.cornerDisplay.queue_draw()

        props = self.properties[index]

        props[0] = function

        if enabled:
            props[1] = 'true'
        else:
            props[1] = 'false'

        try:
            props[2] = str(delay)
        except:
            props.append("0")

        self.write_settings()

    def write_settings(self):
        oc_list = []
        for prop in self.properties:
            oc_list.append(":".join(prop))
        self.settings.set_strv("hotcorner-layout", oc_list)


class HotCornerDisplay(Gtk.DrawingArea):
    def __init__(self, **kwargs):
        Gtk.DrawingArea.__init__(self, **kwargs)
        self.connect('draw', self.expose)

        self.cornerEnabled = [True, True, True, True]

    def setCornerEnabled(self, index, value):
        self.cornerEnabled[index] = value

    def _setCornerColor(self, cr, index):
        if self.cornerEnabled[index]:
            cr.set_source_rgba(self.activeColor.red, self.activeColor.green, self.activeColor.blue, self.activeColor.alpha)
        else:
            cr.set_source_rgba(1, 1, 1, .25)

    def _getColor(self, context, default, alternative):
        (succ, color) = context.lookup_color(default)
        if not succ:
            (succ, color) = context.lookup_color(alternative)
        return color

    # Render display with corner visuals
    def expose(self, widget, cr):
        context = self.get_style_context()

        self.activeColor = self._getColor(context, "success_color", "question_bg_color")
        self.activeColor.alpha *= 0.9

        allocation = self.get_allocation()

        cr.set_antialias(cairo.ANTIALIAS_SUBPIXEL)

        middleX = allocation.width // 2
        middleY = allocation.height // 2
        pat = cairo.RadialGradient(middleX, middleY, 0, middleX, middleY, middleX)
        pat.add_color_stop_rgb(.2, .25, .25, .25)
        pat.add_color_stop_rgb(1, .15, .15, .15)
        cr.set_source(pat)
        cr.rectangle(0, 0, allocation.width, allocation.height)
        cr.fill()

        cr.set_line_width(1)

        cornerSize = 50

        self._setCornerColor(cr, 0)
        cr.move_to(0,0)
        cr.line_to(cornerSize,0)
        cr.arc(0, 0, cornerSize, _0_DEG, _90_DEG)
        cr.fill()

        self._setCornerColor(cr, 1)
        cr.move_to(allocation.width, 0)
        cr.line_to(allocation.width, cornerSize)
        cr.arc(allocation.width, 0, cornerSize, _90_DEG, _180_DEG)
        cr.fill()

        self._setCornerColor(cr, 2)
        cr.move_to(0, allocation.height)
        cr.line_to(0, allocation.height-cornerSize)
        cr.arc(0, allocation.height, cornerSize, _270_DEG, _0_DEG)
        cr.fill()

        self._setCornerColor(cr, 3)
        cr.move_to(allocation.width, allocation.height)
        cr.line_to(allocation.width-cornerSize, allocation.height)
        cr.arc(allocation.width, allocation.height, cornerSize, _180_DEG, _270_DEG)
        cr.fill()

        cr.set_source_rgba(0, 0, 0, 1)
        cr.rectangle(0, 0, allocation.width, allocation.height)
        cr.stroke()

        return True

class HotCornerConfiguration(Gtk.Box):
    def __init__(self, index, updateCallback):
        Gtk.Box.__init__(self, orientation=Gtk.Orientation.VERTICAL)
        self.updateCallback = updateCallback
        self.index = index
        self.timer = None
        self.functionStore = Gtk.ListStore(str, str)
        self.functionStore.append(['expo', _("Show all workspaces")]) #Expo
        self.functionStore.append(['scale', _("Show all windows")]) #Scale
        self.functionStore.append(['desktop', _("Show the desktop")])
        self.functionStore.append(['custom', _("Run a command")])

        enableBox = Gtk.Box(spacing=8)
        enableLabel = Gtk.Label(_("Enable this corner"))
        self.enableSwitch = Gtk.Switch()
        enableBox.pack_start(enableLabel, False, True, 0)
        enableBox.pack_end(self.enableSwitch, False, False, 0)

        self.functionCombo = Gtk.ComboBox.new_with_model(self.functionStore)
        rendererText = Gtk.CellRendererText()
        self.functionCombo.pack_start(rendererText, True)
        self.functionCombo.add_attribute(rendererText, "text", 1)

        self.commandRevealer = Gtk.Revealer()
        self.commandEntry = Gtk.Entry(placeholder_text=_("Type a command..."), margin_bottom=8)
        self.commandRevealer.add(self.commandEntry)
        self.commandRevealer.set_reveal_child(False)

        self.hoverDelayBox = Gtk.Box(spacing=8)
        hoverDelayLabel = Gtk.Label(_("Activation delay (ms)"))
        self.hoverDelaySpinner = Gtk.SpinButton.new_with_range(0, 1000, 50)
        self.hoverDelayBox.pack_start(hoverDelayLabel, False, True, 0)
        self.hoverDelayBox.pack_end(self.hoverDelaySpinner, False, False, 0)

        self.pack_start(enableBox, False, False, 0)
        self.pack_start(self.functionCombo, False, False, 8)
        self.pack_start(self.commandRevealer, False, False, 0)
        self.pack_start(self.hoverDelayBox, False, False, 0)

        self.functionCombo.connect('changed', self.on_widget_changed)
        self.commandEntry.connect('changed', self.on_widget_changed)
        self.enableSwitch.connect('notify::active', self.on_widget_changed)
        self.hoverDelaySpinner.connect('value-changed', self.on_widget_changed)

        if self.index > 1: # Bottom left/right corners
            self.set_valign(Gtk.Align.END)

    def setValues(self, function, enabled, delay):
        showCommandEntry = False

        if function == "expo":
            self.functionCombo.set_active(0)
        elif function == "scale":
            self.functionCombo.set_active(1)
        elif function == "desktop":
            self.functionCombo.set_active(2)
        else:
            showCommandEntry = True
            self.functionCombo.set_active(3)
            if self.commandEntry.get_text() != function:
                self.commandEntry.set_text(function)

        self.commandRevealer.set_reveal_child(showCommandEntry)

        if self.enableSwitch.get_active() != enabled:
            self.enableSwitch.set_active(enabled)

        self.functionCombo.set_sensitive(enabled)
        self.commandEntry.set_sensitive(enabled)
        self.hoverDelayBox.set_sensitive(enabled)
        self.hoverDelaySpinner.set_value(int(delay))

    def on_widget_changed(self, *args):
        def apply(self):
            iter = self.functionCombo.get_active_iter()
            if iter is not None:
                function = self.functionStore.get_value(iter, 0)
                enabled = self.enableSwitch.get_active()
                delay = str(int(self.hoverDelaySpinner.get_value()))

                if function == 'custom':
                    function = self.commandEntry.get_text()

                self.updateCallback(self.index, function, enabled, delay)

            self.timer = None

        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(250, apply, self)
