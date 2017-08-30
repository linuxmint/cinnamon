#!/usr/bin/python2
import cairo
import math

from gi.repository import Gio, GLib

from GSettingsWidgets import *

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
            print "Loading HotCorner module"

            self.corners = []
            for i in range(4):
                self.corners.append(HotCornerConfiguration(i, self.onConfigChanged))

            self.settings = Gio.Settings.new('org.cinnamon')
            self.settings.connect('changed::hotcorner-layout', self.on_settings_changed)
            oc_list = self.settings.get_strv("hotcorner-layout")
            self.properties = []
            for item in oc_list:
                props = item.split(":")
                self.properties.append(props)

            table = Gtk.Table.new(2, 3, False)
            table.set_row_spacings(5)
            table.set_col_spacings(10)
            table.set_margin_top(2)
            table.set_margin_bottom(2)
            table.set_border_width(8)

            self.cornerDisplay = HotCornerDisplay()
            table.attach(self.cornerDisplay, 1, 2, 0, 2)
            table.attach(self.corners[0].build(), 0, 1, 0, 1, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            table.attach(self.corners[1].build(), 2, 3, 0, 1, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            table.attach(self.corners[2].build(), 0, 1, 1, 2, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            table.attach(self.corners[3].build(), 2, 3, 1, 2, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)

            self.cornerDisplay.set_size_request(200, 250)

            self.sidePage.add_widget(table)

            self.on_settings_changed(self.settings, "hotcorner-layout")

    def on_settings_changed(self, settings, key):
        oc_list = self.settings.get_strv("hotcorner-layout")
        del self.properties[:]
        for item in oc_list:
            props = item.split(":")
            self.properties.append(props)
        self.update()

    def update(self):
        for corner in self.corners:
            function = ""
            prop = self.properties[corner.index]
            function = prop[0]
            enabled = prop[1] == "true"
            isEnabled = False

            if prop[1] == "true":
                isEnabled = True
            else:
                isEnabled = False

            try:
                delay = prop[2]
            except:
                delay = "0"

            corner.setValues(function, enabled, delay)
            self.cornerDisplay.setCornerEnabled(corner.index, isEnabled)
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


class HotCornerDisplay(Gtk.Label):
    def __init__(self):
        Gtk.Label.__init__(self, label = "")
        self.connect('draw', self.expose)

        self.cornerEnabled = []
        self.cornerEnabled.append(True)
        self.cornerEnabled.append(True)
        self.cornerEnabled.append(True)
        self.cornerEnabled.append(True)

    def setCornerEnabled(self, index, value):
        self.cornerEnabled[index] = value

    def _setCornerColor(self, cr, index):
        if self.cornerEnabled[index]:
            cr.set_source_rgba(self.activeColor.red, self.activeColor.green, self.activeColor.blue, self.activeColor.alpha)
        else:
            cr.set_source_rgba(self.inactiveColor.red, self.inactiveColor.green, self.inactiveColor.blue, self.inactiveColor.alpha)

    def _getColor(self, context, default, alternative):
        (succ, color) = context.lookup_color(default)
        if not succ:
            (succ, color) = context.lookup_color(alternative)
        return color

    #Renders button with corner visuals
    def expose(self, widget, cr):
        context = self.get_style_context()
        context.save()
        context.add_class(Gtk.STYLE_CLASS_BUTTON)

        self.activeColor = self._getColor(context, "success_color", "question_bg_color")
        self.inactiveColor = self._getColor(context, "error_color", "error_bg_color")
        self.inactiveColor.alpha *= 0.35
        self.activeColor.alpha *= 0.9

        allocation = self.get_allocation()

        self.allocWidth = allocation.width
        self.allocHeight = allocation.height

        cr.save()
        cr.set_antialias(cairo.ANTIALIAS_SUBPIXEL)

        cr.rectangle(0, 0, self.allocWidth, self.allocHeight)
        cr.clip()
        Gtk.render_background(context, cr, -10, -10, self.allocWidth+20, self.allocHeight+20)

        cr.rectangle(0, 0, self.allocWidth, self.allocHeight)
        cr.clip()

        cr.set_line_width(1)

        self._setCornerColor(cr, 0)
        cr.move_to(1,51)
        cr.line_to(1,1)
        cr.arc(1, 1, 51, _0_DEG, _90_DEG)
        cr.fill()

        self._setCornerColor(cr, 1)
        cr.move_to(self.allocWidth-1,1)
        cr.line_to(self.allocWidth-1,51)
        cr.arc(self.allocWidth-1, 1, 51, _90_DEG, _180_DEG)
        cr.fill()

        self._setCornerColor(cr, 2)
        cr.move_to(1,self.allocHeight-1)
        cr.line_to(1,self.allocHeight-51)
        cr.arc(1, self.allocHeight, 51, _270_DEG, _90_DEG)
        cr.fill()

        self._setCornerColor(cr, 3)
        cr.move_to(self.allocWidth,self.allocHeight-50)
        cr.line_to(self.allocWidth,self.allocHeight)
        cr.arc(self.allocWidth, self.allocHeight, 50, _180_DEG, _270_DEG)
        cr.fill()

        cr.set_source_rgba(0, 0, 0, 1)
        cr.rectangle(0, 0, self.allocWidth, self.allocHeight)
        cr.stroke()

        context.restore()


        cr.stroke_preserve()

        cr.restore()

        return True

class HotCornerConfiguration():
    def __init__(self, index, updateCallback):
        self.updateCallback = updateCallback
        self.index = index
        self.timer = None
        self.functionStore = Gtk.ListStore(str, str)
        self.functionStore.append(['expo', _("Show all workspaces")]) #Expo
        self.functionStore.append(['scale', _("Show all windows")]) #Scale
        self.functionStore.append(['desktop', _("Show the desktop")])
        self.functionStore.append(['custom', _("Run a command")])

    def build(self):
        self.box = Gtk.VBox.new(3, False)

        self.functionCombo = Gtk.ComboBox.new_with_model(self.functionStore)
        self.functionCombo.set_entry_text_column(1)
        rendererText = Gtk.CellRendererText()
        self.functionCombo.pack_start(rendererText, True)
        self.functionCombo.add_attribute(rendererText, "text", 1)

        self.customEntry = Gtk.Entry()
        self.customEntry.set_no_show_all(True)
        self.hoverCheckbox = Gtk.CheckButton()
        self.hoverCheckbox.set_label(_("Hover enabled"))
        self.hoverDelayBox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self.hoverDelayLabel = Gtk.Label.new(_("Hover delay"))
        self.hoverDelaySpinner = Gtk.SpinButton.new_with_range(0, 1000, 50)
        self.hoverDelayUnitsLabel = Gtk.Label.new(_("ms"))

        self.box.pack_start(self.functionCombo, True, True, 0)
        self.box.pack_start(self.customEntry, True, True, 0)
        self.box.pack_start(self.hoverCheckbox, True, True, 0)
        self.hoverDelayBox.pack_start(self.hoverDelayLabel, False, False, 5)
        self.hoverDelayBox.pack_end(self.hoverDelayUnitsLabel, False, False, 5)
        self.hoverDelayBox.pack_end(self.hoverDelaySpinner, False, False, 5)
        self.box.pack_start(self.hoverDelayBox, True, True, 0)

        self.functionCombo.connect('changed', self.on_widget_changed)
        self.customEntry.connect('changed', self.on_widget_changed)
        self.hoverCheckbox.connect('toggled', self.on_widget_changed)
        self.hoverDelaySpinner.connect('value-changed', self.on_widget_changed)

        self.functionCombo.show()
        self.hoverCheckbox.show()
        self.customEntry.show()
        self.hoverDelayLabel.show()
        self.hoverDelaySpinner.show()
        self.hoverDelayUnitsLabel.show()
        self.hoverDelayBox.show()
        self.box.show()

        alignment = Gtk.Alignment()
        if self.index < 2:
            alignment.set(0, 0, 1, 0)
        else:
            alignment.set(0, 1, 1, 0)
        alignment.add(self.box)
        alignment.set_size_request(180, 50)

        return alignment

    def setValues(self, function, enabled, delay):
        hideCustomEntry = True

        if function == "expo":
            self.functionCombo.set_active(0)
        elif function == "scale":
            self.functionCombo.set_active(1)
        elif function == "desktop":
            self.functionCombo.set_active(2)
        else:
            hideCustomEntry = False
            self.functionCombo.set_active(3)
            if self.customEntry.get_text() != function:
                self.customEntry.set_text(function)

        if hideCustomEntry:
            self.customEntry.hide()
        else:
            self.customEntry.show()

        if self.hoverCheckbox.get_active() != enabled:
            self.hoverCheckbox.set_active(enabled)

        self.hoverDelayBox.set_sensitive(enabled)
        self.hoverDelaySpinner.set_value(int(delay))

    def on_widget_changed(self, widget):
        def apply(self):
            iter = self.functionCombo.get_active_iter()
            if iter != None:
                function = self.functionStore.get_value(iter, 0)
                enabled = self.hoverCheckbox.get_active()
                delay = str(int(self.hoverDelaySpinner.get_value()))

                if function != 'custom':
                    self.customEntry.hide()
                else:
                    self.customEntry.show()
                    function = self.customEntry.get_text()

                self.updateCallback(self.index, function, enabled, delay)

            self.timer = None

        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(250, apply, self)
