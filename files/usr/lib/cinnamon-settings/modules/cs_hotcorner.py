#!/usr/bin/env python
import cairo
import math

from SettingsWidgets import *
from gi.repository import Gio

_270_DEG = 270.0 * (math.pi/180.0)
_180_DEG = 180.0 * (math.pi/180.0)
_90_DEG = 90.0 * (math.pi/180.0)
_0_DEG = 0.0 * (math.pi/180.0)

class Module:
    def __init__(self, content_box):
        keywords = _("hotcorner, overview, scale, expo")
        advanced = True
        sidePage = HotCornerViewSidePage(_("Hot Corners"), "overview.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "hotcorner"
        self.category = "prefs"

class HotCornerDisplay(Gtk.Label):
    def __init__(self):
        Gtk.Label.__init__(self, "")
        self.connect('draw', self.expose)
        
        self.corners = []
        self.corners.append(True)
        self.corners.append(True)
        self.corners.append(True)
        self.corners.append(True)
        
    def setCorner(self, index, value):
        self.corners[index] = value
        
    def _setCornerColor(self, cr, index):
        if self.corners[index]:
            cr.set_source_rgba(1, 0, 0, 1)
        else:
            cr.set_source_rgba(0.4, 0.4, 0.4, 1)
        
    def expose(self, widget, cr):
        allocation = self.get_allocation()

        width = allocation.width
        height = allocation.height
        
        cr.save()
        cr.set_antialias(cairo.ANTIALIAS_SUBPIXEL)
        
        cr.set_source_rgba(0.7, 0.7, 0.7, 1)
        cr.rectangle(0, 0, width, height)
        cr.fill()
        
        self._setCornerColor(cr, 0)
        
        cr.move_to(0,50)
        cr.line_to(0,0)
        cr.arc(0, 0, 50, _0_DEG, _90_DEG)
        cr.fill()
        
        self._setCornerColor(cr, 1)
        
        cr.move_to(width,0)
        cr.line_to(width,50)
        cr.arc(width, 0, 50, _90_DEG, _180_DEG)
        cr.fill()
        
        self._setCornerColor(cr, 2)
        
        cr.move_to(0,height)
        cr.line_to(0,height-50)
        cr.arc(0, height, 50, _270_DEG, _90_DEG)
        cr.fill()
        
        self._setCornerColor(cr, 3)
        
        cr.move_to(width,height-50)
        cr.line_to(width,height)
        cr.arc(width, height, 50, _180_DEG, _270_DEG)
        cr.fill()
        
        cr.stroke_preserve()

        cr.restore()

        return True

class HotCornerConfigurtion():
    def __init__(self, index, updateCallback):
        self.updateCallback = updateCallback
        self.index = index
        self.functionStore = Gtk.ListStore(str, str)
        self.functionStore.append(['disabled', _("Disabled")])
        self.functionStore.append(['expo', _("Expo")])
        self.functionStore.append(['scale', _("Scale")])
        self.functionStore.append(['custom', _("Custom")])
        
    def build(self):
        self.box = Gtk.VBox(3)
        
        self.functionCombo = Gtk.ComboBox.new_with_model(self.functionStore)
        self.functionCombo.set_entry_text_column(1)
        rendererText = Gtk.CellRendererText()
        self.functionCombo.pack_start(rendererText, True)
        self.functionCombo.add_attribute(rendererText, "text", 1)
        
        self.customEntry = Gtk.Entry()
        self.iconCheckbox = Gtk.CheckButton(_("Icon visible"))
        
        self.box.pack_start(self.functionCombo, True, True, 0)
        self.box.pack_start(self.customEntry, True, True, 0)
        self.box.pack_start(self.iconCheckbox, True, True, 0)
        
        self.functionCombo.connect('changed', self.on_widget_changed)
        self.customEntry.connect('changed', self.on_widget_changed)
        self.iconCheckbox.connect('toggled', self.on_widget_changed)
        
        self.functionCombo.show()
        self.iconCheckbox.show()
        self.customEntry.show()
        self.box.show()
        
        alignment = Gtk.Alignment()
        if self.index < 2:
            alignment.set(0, 0, 1, 0)
        else:
            alignment.set(0, 1, 1, 0)
        alignment.add(self.box)
        alignment.set_size_request(180, 50)
        
        return alignment
    
    def setValues(self, function, visible):
        hideIconCheckbox = False
        hideCustomEntry = True
        if function == "disabled":
            hideIconCheckbox = True
            self.functionCombo.set_active(0)
        elif function == "expo":
            self.functionCombo.set_active(1)
        elif function == "scale":
            self.functionCombo.set_active(2)
        else:
            hideCustomEntry = False
            self.functionCombo.set_active(3)
            if self.customEntry.get_text() != function:
                self.customEntry.set_text(function)
                
        if hideIconCheckbox:
            self.iconCheckbox.hide()
        else:
            self.iconCheckbox.show()
            
        if hideCustomEntry:
            self.customEntry.hide()
        else:
            self.customEntry.show()
            
        if self.iconCheckbox.get_active() != visible:
            self.iconCheckbox.set_active(visible)
        
    def on_widget_changed(self, widget):
        iter = self.functionCombo.get_active_iter()
        if iter != None:
            function = self.functionStore.get_value(iter, 0)
            if function == 'disabled':
                visible = False
                self.iconCheckbox.hide()
            else:
                visible = self.iconCheckbox.get_active()
                self.iconCheckbox.show()
                
            if function != 'custom':
                self.customEntry.hide()
            else:
                self.customEntry.show()
                function = self.customEntry.get_text()
            
            self.updateCallback(self.index, function, visible)
        
    
class HotCornerViewSidePage(SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box)

        self.corners = []
        for i in range(4):
            self.corners.append(HotCornerConfigurtion(i, self.onConfigChanged))
        
        self.settings = Gio.Settings.new('org.cinnamon')
        self.settings.connect('changed::overview-corner', self.on_settings_changed)
        oc_list = self.settings.get_strv("overview-corner")
        self.properties = []
        for item in oc_list:
            props = item.split(":")
            self.properties.append(props)

    def on_settings_changed(self, settings, key):
        oc_list = self.settings.get_strv("overview-corner")
        del self.properties[:]
        for item in oc_list:
            props = item.split(":")
            self.properties.append(props)
        self.update()

    def update(self):
        for corner in self.corners:
            function = ""
            prop = self.properties[corner.index]
            enabled = prop[1] == "true"
            visible = prop[2] == "true"
            if enabled:
                function = prop[0]
            else:
                function = "disabled"
            corner.setValues(function, visible)
            self.cornerDisplay.setCorner(corner.index, enabled)
        self.cornerDisplay.queue_draw()

    def build(self, advanced):
        # Clear all existing widgets
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        table = Gtk.Table(2, 3, False)
        table.set_row_spacings(5)
        table.set_col_spacings(5)

        self.cornerDisplay = HotCornerDisplay()
        table.attach(self.cornerDisplay, 1, 2, 0, 2)
        table.attach(self.corners[0].build(), 0, 1, 0, 1, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        table.attach(self.corners[1].build(), 2, 3, 0, 1, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        table.attach(self.corners[2].build(), 0, 1, 1, 2, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        table.attach(self.corners[3].build(), 2, 3, 1, 2, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        
        self.cornerDisplay.set_size_request(200, 250)
        
        self.content_box.pack_start(table, False, False, 2)

        # Signals
        self.content_box.show_all()
        self.on_settings_changed(self.settings, "overview-corner")
        
    def onConfigChanged(self, index, function, visible):
        self.cornerDisplay.setCorner(index, visible)
        self.cornerDisplay.queue_draw()
        
        props = self.properties[index]
        
        if function == 'disabled':
            props[0] = 'false'
            props[1] = 'false'
        else:
            props[0] = function
            props[1] = 'true'
        
        if visible:
            props[2] = 'true'
        else:
            props[2] = 'false'
        self.write_settings()

    def write_settings(self):
        oc_list = []
        for prop in self.properties:
            oc_list.append(":".join(prop))
        self.settings.set_strv("overview-corner", oc_list)

