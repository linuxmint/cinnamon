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
        sidePage = SidePage(_("Hot Corners"), "cs-overview", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.comment = _("Manage hotcorner settings")
        self.name = "hotcorner"
        self.category = "prefs"

    def on_module_selected(self):
        if not self.loaded:
            print "Loading HotCorner module"  

            self.corners = []
            for i in range(4):
                self.corners.append(HotCornerConfiguration(i, self.onConfigChanged))
            
            self.settings = Gio.Settings.new('org.cinnamon')
            self.settings.connect('changed::overview-corner', self.on_settings_changed)
            oc_list = self.settings.get_strv("overview-corner")
            self.properties = []
            for item in oc_list:
                props = item.split(":")
                self.properties.append(props)

            table = Gtk.Table.new(2, 3, False)
            table.set_row_spacings(5)
            table.set_col_spacings(5)

            self.cornerDisplay = HotCornerDisplay()
            table.attach(self.cornerDisplay, 1, 2, 0, 2)
            table.attach(self.corners[0].build(), 0, 1, 0, 1, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            table.attach(self.corners[1].build(), 2, 3, 0, 1, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            table.attach(self.corners[2].build(), 0, 1, 1, 2, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            table.attach(self.corners[3].build(), 2, 3, 1, 2, Gtk.AttachOptions.FILL, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            
            self.cornerDisplay.set_size_request(200, 250)
            
            self.sidePage.add_widget(table)
        
            self.on_settings_changed(self.settings, "overview-corner")
       
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
            function = prop[0]
            enabled = prop[1] == "true"
            visible = prop[2] == "true"
            isEnabled = False

            if prop[1] == "true":
                isEnabled = True
            elif prop[2] == "true":
                isEnabled = True
            else:
                isEnabled = False

            corner.setValues(function, visible, enabled)
            self.cornerDisplay.setCornerEnabled(corner.index, isEnabled)
        self.cornerDisplay.queue_draw()    
        
    def onConfigChanged(self, index, function, visible, enabled):
        self.cornerDisplay.queue_draw()
        
        props = self.properties[index]

        props[0] = function
    
        if enabled:
            props[1] = 'true'
        else:
            props[1] = 'false'

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
            cr.set_source_rgba(0.6, 0.72, 0.49, self.activeColor.alpha) #"0.6, 0.72, 0.49" is the Mint color
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
        self.functionStore = Gtk.ListStore(str, str)
        self.functionStore.append(['expo', _("Workspace Selector")]) #Expo
        self.functionStore.append(['scale', _("Window Selector")]) #Scale
        self.functionStore.append(['custom', _("Custom")])
        
    def build(self):
        self.box = Gtk.VBox.new(3, False)
        
        self.functionCombo = Gtk.ComboBox.new_with_model(self.functionStore)
        self.functionCombo.set_entry_text_column(1)
        rendererText = Gtk.CellRendererText()
        self.functionCombo.pack_start(rendererText, True)
        self.functionCombo.add_attribute(rendererText, "text", 1)
        
        self.iconCheckbox = Gtk.CheckButton()
        self.iconCheckbox.set_label(_("Icon visible"))
        self.hoverCheckbox = Gtk.CheckButton()
        self.hoverCheckbox.set_label(_("Hover enabled"))
        self.customEntry = Gtk.Entry()
        
        self.box.pack_start(self.functionCombo, True, True, 0)
        self.box.pack_start(self.customEntry, True, True, 0)
        self.box.pack_start(self.iconCheckbox, True, True, 0)
        self.box.pack_start(self.hoverCheckbox, True, True, 0)
        
        self.functionCombo.connect('changed', self.on_widget_changed)
        self.customEntry.connect('changed', self.on_widget_changed)
        self.iconCheckbox.connect('toggled', self.on_widget_changed)
        self.hoverCheckbox.connect('toggled', self.on_widget_changed)
        
        self.functionCombo.show()
        self.iconCheckbox.show()
        self.hoverCheckbox.show()
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
    
    def setValues(self, function, visible, enabled):
        hideCustomEntry = True
        
        if function == "expo":
            self.functionCombo.set_active(0)
        elif function == "scale":
            self.functionCombo.set_active(1)
        else:
            hideCustomEntry = False
            self.functionCombo.set_active(2)
            if self.customEntry.get_text() != function:
                self.customEntry.set_text(function)
            
        if hideCustomEntry:
            self.customEntry.hide()
        else:
            self.customEntry.show()
            
        if self.iconCheckbox.get_active() != visible:
            self.iconCheckbox.set_active(visible)
        if self.hoverCheckbox.get_active() != enabled:
            self.hoverCheckbox.set_active(enabled)
        
    def on_widget_changed(self, widget):
        iter = self.functionCombo.get_active_iter()
        if iter != None:
            function = self.functionStore.get_value(iter, 0)
            visible = self.iconCheckbox.get_active()
            enabled = self.hoverCheckbox.get_active()
                
            if function != 'custom':
                self.customEntry.hide()
            else:
                self.customEntry.show()
                function = self.customEntry.get_text()
            
            self.updateCallback(self.index, function, visible, enabled)
        
    


