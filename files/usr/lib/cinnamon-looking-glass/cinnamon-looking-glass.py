#!/usr/bin/env python

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib
import dbus
import pageutils
import os
from dbus.mainloop.glib import DBusGMainLoop

class ResizeGrip(Gtk.Widget):
    def __init__(self, parent):
        Gtk.Widget.__init__(self)
        self.parentWindow = parent

    def do_realize(self):
        self.set_realized(True)
        
        allocation = self.get_allocation()

        attr = Gdk.WindowAttr()
        attr.window_type = Gdk.WindowType.CHILD
        attr.wclass = Gdk.WindowWindowClass.INPUT_OUTPUT
        attr.event_mask = self.get_events() | Gdk.EventMask.EXPOSURE_MASK | Gdk.EventMask.BUTTON_PRESS_MASK
        attr.x = 0
        attr.y = 0
        attr.width = allocation.width
        attr.height = allocation.height

        mask = Gdk.WindowAttributesType.X | Gdk.WindowAttributesType.Y
        window = Gdk.Window.new(self.get_parent_window(), attr, mask)
        self.set_window(window)

        window.set_user_data(self)
        style = self.get_style()
        style.set_background(window, Gtk.StateFlags.NORMAL)
        
        self.get_window().set_cursor(Gdk.Cursor(Gdk.CursorType.BOTTOM_SIDE))
        self.connect("draw", self.on_draw_event)

    def do_unrealize(self):
        self.get_window().destroy()

    def do_size_request(self, requisition):
        requisition.height = 5
        requisition.width = -1

    def do_get_preferred_width(self):
        req = Gtk.Requisition()
        self.do_size_request(req)
        return (req.width, req.width)

    def do_get_preferred_height(self):
        req = Gtk.Requisition()
        self.do_size_request(req)
        return (req.height, req.height)

    def do_size_allocate(self, allocation):
        if self.get_realized():
            self.get_window().move_resize(allocation.x, allocation.y, allocation.width, allocation.height)

    def on_draw_event(self, widget, ctx):
        width = self.get_window().get_width()
        height = self.get_window().get_height()
        # Draw a line at the bottom
        cr = self.get_window().cairo_create()
        cr.set_source_rgb(0.5, 0.5, 0.5)
        cr.rectangle(1, height-4, width-2, 1)
        cr.fill()

    def do_button_press_event(self, event):
        self.parentWindow.begin_resize_drag(Gdk.WindowEdge.SOUTH, event.button, int(event.x_root), int(event.y_root), event.time)
        return True

class CommandLine(Gtk.Entry):
    def __init__(self):
        Gtk.Entry.__init__(self)
        self.settings = Gio.Settings.new("org.cinnamon")
        self.history = self.settings.get_strv("looking-glass-history")
        self.historyPosition = -1
        self.lastText = ""
        self.connect('key_press_event', self.on_key_press_event)
        self.connect("populate-popup", self.populate_popup)

    def populate_popup(self, view, menu):
        menu.append(Gtk.SeparatorMenuItem())
        clear = Gtk.MenuItem("Clear History")
        clear.connect('activate', self.historyClear)
        menu.append(clear)
        menu.show_all()
        return False
        
    def on_key_press_event(self, widget, event):
        if event.keyval == Gdk.KEY_Up:
            self.historyPrev()
            return True
        if event.keyval == Gdk.KEY_Down:
            self.historyNext()
            return True
        if event.keyval == Gdk.KEY_Return:
            self.execute()
            return True

    def historyClear(self, menuItem):
        self.history = []
        self.historyPosition = -1
        self.lastText = ""
        self.settings.set_strv("looking-glass-history", self.history)
        
    def historyPrev(self):
        num = len(self.history)
        if self.historyPosition == 0 or num == 0:
            return
        if self.historyPosition == -1:
            self.historyPosition = num - 1
            self.lastText = self.get_text()
        else:
            self.historyPosition -= 1
        self.set_text(self.history[self.historyPosition])
        self.select_region(-1, -1) 
        
    def historyNext(self):
        if self.historyPosition == -1:
            return
        num = len(self.history)
        if self.historyPosition == num-1:
            self.historyPosition = -1
            self.set_text(self.lastText)
        else:
            self.historyPosition += 1
            self.set_text(self.history[self.historyPosition])
        self.select_region(-1, -1) 
        
    def execute(self):
        self.historyPosition = -1
        command = self.get_text()
        if command != "":
            num = len(self.history)
            if num == 0 or self.history[num-1] != command:
                self.history.append(command)
            self.set_text("")
            self.settings.set_strv("looking-glass-history", self.history)
            
            cinnamonDBus.lgEval(command)
   
class CinnamonLog:
    def delete(self, widget, event=None):
        Gtk.main_quit()
        return False

    def __init__(self):
        self.window = Gtk.Window(Gtk.WindowType.TOPLEVEL)
        screen = self.window.get_screen()
        
        self.window.connect("delete_event", self.delete)

        self.window.set_border_width(0)
        self.window.set_decorated(False)
        self.window.set_skip_taskbar_hint(True)
        self.window.set_keep_above(True)
        self.window.set_default_size(screen.get_width(), 200)
        self.window.set_has_resize_grip(False)
        self.window.move(0,0)

        numRows = 3
        numColumns = 6
        table = Gtk.Table(numRows, numColumns, False)
        self.window.add(table)
        
        self.notebook = Gtk.Notebook()
        self.notebook.set_tab_pos(Gtk.PositionType.BOTTOM)
        self.notebook.show()
        self.notebook.set_show_border(True)
        self.notebook.set_show_tabs(True)

        self.pages = {}
        self.createPage("Evaluator", "results")
        self.createPage("Inspect", "inspect")
        self.createPage("Memory", "memory")
        self.createPage("Windows", "windows")
        self.createDummyPage("Applets")
        self.createDummyPage("Extensions")
        self.createPage("Log", "log")

        table.attach(self.notebook, 0, numColumns, 0, 1)
        
        column = 0
        pickerButton = pageutils.ImageButton("gtk-color-picker", Gtk.IconSize.SMALL_TOOLBAR)
        pickerButton.connect("clicked", self.onPickerClicked)
        table.attach(pickerButton, column, column+1, 1, 2, 0, 0, 2)
        column += 1
        table.attach(Gtk.Label("Exec:"), column, column+1, 1, 2, 0, 0, 3)
        column += 1
        table.attach(CommandLine(), column, column+1, 1, 2, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 3, 2)
        column += 1
        restartButton = Gtk.Button("Restart")
        restartButton.connect("clicked", self.onRestartClicked)
        table.attach(restartButton, column, column+1, 1, 2, 0, 0, 1)
        column += 1
        closeButton = Gtk.Button("X")
        closeButton.connect ('clicked', self.close_clicked)
        table.attach(closeButton, column, column+1, 1, 2, 0, 0, 1)
        
        sep = ResizeGrip(self.window)
        table.attach(sep, 0, numColumns, 2, 3, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 0, 0)
        
        self.window.show_all()
        self.activatePage("results")
        
    def onRestartClicked(self, widget):
        #fixme: gets killed when the python process ends, separate it!
        os.system("cinnamon --replace &")
         
    def onPickerClicked(self, widget):
        cinnamonDBus.lgStartInspector()

    def close_clicked(self, widget):
        Gtk.main_quit()
        
    def createDummyPage(self, text):
        label = Gtk.Label(text)
        self.notebook.append_page(Gtk.Label(""), label)
        
    def createPage(self, text, moduleName):
        module = __import__("page_%s" % moduleName)
        module.cinnamonDBus = cinnamonDBus
        module.cinnamonLog = self
        label = Gtk.Label(text)
        page = module.ModulePage()
        self.pages[moduleName] = page
        self.notebook.append_page(page, label)
        
    def activatePage(self, moduleName):
        page = self.notebook.page_num(self.pages[moduleName])
        self.notebook.set_current_page(page)

def createCinnamonDBusProxy():
    try:
        proxy = dbus.SessionBus().get_object("org.Cinnamon", "/org/Cinnamon")
        return proxy
    except dbus.exceptions.DBusException as e:
        print(e)
        return None

def main():
    Gtk.main()
    return 0

if __name__ == "__main__":
    GObject.type_register(ResizeGrip)
    DBusGMainLoop(set_as_default=True)
    
    global cinnamonDBus
    cinnamonDBus = createCinnamonDBusProxy()
    
    CinnamonLog()
    main()
