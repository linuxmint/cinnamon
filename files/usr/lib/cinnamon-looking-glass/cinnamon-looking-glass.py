#!/usr/bin/env python

# Todo:
# - TextTag.invisible does not work nicely with scrollheight, find out why
#   - (Sometimes scrollbars think there is more or less to scroll than there actually is after showing/hiding entries in page_log.py)
# - if cinnamon --replace was called from Melange, it will be killed when this process is closed
#   - Currently only occurs when Melange is started by Geany.
# - List extensions that failed to load ?
# - Check for issues with multiple monitors
# - Add insert button to "simple types" inspect dialog ? is there actual use for these types inserted as results ?
# - Remove javascript version ?
# - Load all enabled log categories and window height from gsettings
# - Make CommandLine entry & history work more like a normal terminal
#   - When navigating through history and modifying a line
#   - When pressing ctrl + r, search history
#   - auto-completion ?

import os
import pyinotify
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib
import dbus, dbus.service, dbus.glib
from pageutils import *
from dbus.mainloop.glib import DBusGMainLoop

LG_DBUS_NAME = "org.Cinnamon.LookingGlass"
LG_DBUS_PATH = "/org/Cinnamon/LookingGlass"

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
        self.style = self.get_style()
        self.style.set_background(window, Gtk.StateFlags.NORMAL)

        self.get_window().set_cursor(Gdk.Cursor(Gdk.CursorType.BOTTOM_SIDE))
        self.connect("draw", self.onDraw)

    def do_unrealize(self):
        self.get_window().destroy()

    def do_size_request(self, requisition):
        requisition.height = 4
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
            self.queue_draw()

    def do_button_press_event(self, event):
        self.parentWindow.begin_resize_drag(Gdk.WindowEdge.SOUTH, event.button, int(event.x_root), int(event.y_root), event.time)
        return True

    def onDraw(self, widget, ctx):
        width = self.get_window().get_width()
        # Draw a line using the current theme
        cr = self.get_window().cairo_create()
        self.style.do_draw_hline(self.style, cr, Gtk.StateType.NORMAL, self, "", 1, width-2, 1)

class CommandLine(Gtk.Entry):
    def __init__(self):
        Gtk.Entry.__init__(self)
        self.settings = Gio.Settings.new("org.cinnamon")
        self.history = self.settings.get_strv("looking-glass-history")
        self.historyPosition = -1
        self.lastText = ""
        self.connect('key-press-event', self.onKeyPress)
        self.connect("populate-popup", self.populatePopup)

    def populatePopup(self, view, menu):
        menu.append(Gtk.SeparatorMenuItem())
        clear = Gtk.MenuItem("Clear History")
        clear.connect('activate', self.historyClear)
        menu.append(clear)
        menu.show_all()
        return False

    def onKeyPress(self, widget, event):
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

            dbusManager.cinnamonDBus.lgEval(command)

class NewLogDialog(Gtk.Dialog):
    def __init__(self, parent):
        Gtk.Dialog.__init__(self, "Add a new file watcher", parent, 0,
            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
             Gtk.STOCK_OK, Gtk.ResponseType.OK))

        self.set_default_size(150, 100)

        label = Gtk.Label("")
        label.set_markup("<span size='large'>Add File Watch:</span>\n\nPlease select a file to watch and a name for the tab\n")

        box = self.get_content_area()
        box.add(label)
        
        self.store = Gtk.ListStore(str, str)
        self.store.append(["glass.log", "~/.cinnamon/glass.log"])
        self.store.append(["custom", "<Select file>"])

        self.combo = Gtk.ComboBox.new_with_model(self.store)
        self.combo.connect("changed", self.onComboChanged)
        renderer_text = Gtk.CellRendererText()
        self.combo.pack_start(renderer_text, True)
        self.combo.add_attribute(renderer_text, "text", 1)
        
        table = Gtk.Table(2, 2, False)
        table.attach(Gtk.Label(label="File: ", halign=Gtk.Align.START), 0, 1, 0, 1)
        table.attach(self.combo, 1, 2, 0, 1)
        table.attach(Gtk.Label(label="Name: ", halign=Gtk.Align.START), 0, 1, 1, 2)
        self.entry = Gtk.Entry()
        table.attach(self.entry, 1, 2, 1, 2)
        
        self.filename = None
        box.add(table)
        self.show_all()
        
    def onComboChanged(self, combo):
        tree_iter = combo.get_active_iter()
        if tree_iter != None:
            model = combo.get_model()
            name, self.filename = model[tree_iter][:2]
            self.entry.set_text(name)
            if name == "custom":
                newFile = self.selectFile()
                if newFile is not None:
                    combo.set_active_iter(self.store.insert(1, ["user", newFile]))
                else:
                    combo.set_active(-1)
            return False
                    
    def isValid(self):
        return self.entry.get_text() != "" and self.filename != None and os.path.isfile(os.path.expanduser(self.filename))
        
    def getFile(self):
        return os.path.expanduser(self.filename)
        
    def getName(self):
        return self.entry.get_text()
        
    def selectFile(self):
        dialog = Gtk.FileChooserDialog("Please select a log file", self,
            Gtk.FileChooserAction.OPEN,
            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
             Gtk.STOCK_OPEN, Gtk.ResponseType.OK))

        filter_text = Gtk.FileFilter()
        filter_text.set_name("Text files")
        filter_text.add_mime_type("text/plain")
        dialog.add_filter(filter_text)

        filter_any = Gtk.FileFilter()
        filter_any.set_name("Any files")
        filter_any.add_pattern("*")
        dialog.add_filter(filter_any)
        
        response = dialog.run()
        result = None
        if response == Gtk.ResponseType.OK:
            result = dialog.get_filename()
        dialog.destroy()
        
        return result

class FileWatchHandler(pyinotify.ProcessEvent):
    def __init__(self, view):
        self.view = view
        
    def process_IN_CLOSE_WRITE(self, event):
        self.view.getUpdates()

    def process_IN_CREATE(self, event):
        self.view.getUpdates()

    def process_IN_DELETE(self, event):
        self.view.getUpdates()

    def process_IN_MODIFY(self, event):
        self.view.getUpdates()

class FileWatcherView(Gtk.ScrolledWindow):
    def __init__(self, filename):
        Gtk.ScrolledWindow.__init__(self)

        self.filename = filename
        self.changed = 0
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.textview = Gtk.TextView()
        self.textview.set_editable(False)
        self.add(self.textview)

        self.textbuffer = self.textview.get_buffer()

        self.show_all()
        self.getUpdates()
        
        handler = FileWatchHandler(self)
        wm = pyinotify.WatchManager()
        self.notifier = pyinotify.ThreadedNotifier(wm, handler)
        wdd = wm.add_watch(filename, pyinotify.IN_CLOSE_WRITE | pyinotify.IN_CREATE | pyinotify.IN_DELETE | pyinotify.IN_MODIFY)
        self.notifier.start()
        self.connect("destroy", self.onDestroy)
        self.connect("size-allocate", self.onSizeChanged)
        
    def onDestroy(self, widget):
        if self.notifier:
            self.notifier.stop()
            self.notifier = None
        
    def onSizeChanged(self, widget, bla):
        if self.changed > 0:
            end_iter = self.textbuffer.get_end_iter()
            self.textview.scroll_to_iter(end_iter, 0, False, 0, 0)
            self.changed -= 1

    def getUpdates(self):
        self.changed = 2 # onSizeChanged will be called twice, but only the second time is final
        self.textbuffer.set_text(open(self.filename, 'r').read())
                
class ClosableTabLabel(Gtk.Box):
    __gsignals__ = {
        "close-clicked": (GObject.SIGNAL_RUN_FIRST, GObject.TYPE_NONE, ()),
    }
    def __init__(self, label_text):
        Gtk.Box.__init__(self)
        self.set_orientation(Gtk.Orientation.HORIZONTAL)
        self.set_spacing(5)
        
        label = Gtk.Label(label_text)
        self.pack_start(label, True, True, 0)
        
        button = Gtk.Button()
        button.set_relief(Gtk.ReliefStyle.NONE)
        button.set_focus_on_click(False)
        button.add(Gtk.Image.new_from_stock(Gtk.STOCK_CLOSE, Gtk.IconSize.MENU))
        button.connect("clicked", self.button_clicked)
        data =  ".button {\n" \
                "-GtkButton-default-border : 0px;\n" \
                "-GtkButton-default-outside-border : 0px;\n" \
                "-GtkButton-inner-border: 0px;\n" \
                "-GtkWidget-focus-line-width : 0px;\n" \
                "-GtkWidget-focus-padding : 0px;\n" \
                "padding: 0px;\n" \
                "}"
        provider = Gtk.CssProvider()
        provider.load_from_data(data)
        button.get_style_context().add_provider(provider, 600) 
        self.pack_start(button, False, False, 0)
        
        self.show_all()
    
    def button_clicked(self, button, data=None):
        self.emit("close-clicked")

class CinnamonLog(dbus.service.Object):
    def __init__ (self):
        self.window = None
        dbus.service.Object.__init__ (self, dbusManager.sessionBus, LG_DBUS_PATH, LG_DBUS_NAME)

    @dbus.service.method (LG_DBUS_NAME, in_signature='', out_signature='')
    def show(self):
        if self.window is not None:
            if self.window.get_visible():
                self.window.hide()
            else:
                self.window.present()
                self.window.move(0,0)
                self.window.focus()
        else:
            self.run()
            Gtk.main()

    def run(self):
        self.window = Gtk.Window(Gtk.WindowType.TOPLEVEL)
        screen = self.window.get_screen()

        self.window.set_border_width(0)
        self.window.set_decorated(False)
        self.window.set_skip_taskbar_hint(True)
        self.window.set_keep_above(True)
        self.window.set_default_size(screen.get_width(), 200)
        self.window.set_has_resize_grip(False)
        self.window.move(0,0)

        self.window.connect("delete_event", self.onDelete)
        self.window.connect("key-press-event", self.onKeyPress)

        numRows = 3
        numColumns = 6
        table = Gtk.Table(numRows, numColumns, False)
        self.window.add(table)

        self.notebook = Gtk.Notebook()
        self.notebook.set_tab_pos(Gtk.PositionType.BOTTOM)
        self.notebook.show()
        self.notebook.set_show_border(True)
        self.notebook.set_show_tabs(True)

        label = Gtk.Label("Melange")
        label.set_markup("<u>Melange - Cinnamon Debugger</u> ")
        label.show()
        self.notebook.set_action_widget(label, Gtk.PackType.END)

        self.pages = {}
        self.createPage("Results", "results")
        self.createPage("Inspect", "inspect")
        self.createPage("Memory", "memory")
        self.createPage("Windows", "windows")
        self.createPage("Extensions", "extensions")
        self.createPage("Log", "log")

        table.attach(self.notebook, 0, numColumns, 0, 1)

        column = 0
        pickerButton = ImageButton("gtk-color-picker", Gtk.IconSize.SMALL_TOOLBAR)
        pickerButton.connect("clicked", self.onPickerClicked)
        table.attach(pickerButton, column, column+1, 1, 2, 0, 0, 2)
        column += 1

        table.attach(Gtk.Label("Exec:"), column, column+1, 1, 2, 0, 0, 3)
        column += 1

        table.attach(CommandLine(), column, column+1, 1, 2, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 3, 2)
        column += 1

        global statusLabel
        statusLabel = Gtk.Label("Status")
        statusLabel.set_markup(" <span foreground='red'>[ Cinnamon is OFFLINE! ]</span> ")
        statusLabel.set_tooltip_text("The connection to cinnamon is broken")
        table.attach(statusLabel, column, column+1, 1, 2, 0, 0, 1)
        column += 1

        actionButton = self.createActionButton()
        table.attach(actionButton, column, column+1, 1, 2, 0, 0, 1)

        grip = ResizeGrip(self.window)
        table.attach(grip, 0, numColumns, 2, 3, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 0, 0)

        self.window.show_all()
        self.activatePage("results")
        setStatus(True)

    def createMenuItem(self, text, callback):
        item = Gtk.MenuItem(text)
        item.connect("activate", callback)
        return item

    def createActionButton(self):
        menu = Gtk.Menu()
        menu.append(self.createMenuItem('Add File Watcher', self.onAddFileWatcher))
        menu.append(Gtk.SeparatorMenuItem())
        menu.append(self.createMenuItem('Restart Cinnamon', self.onRestartClicked))
        menu.append(self.createMenuItem('Reset Cinnamon Settings', self.onResetClicked))
        menu.append(Gtk.SeparatorMenuItem())
        menu.append(self.createMenuItem('About Melange', self.onAboutClicked))
        menu.append(self.createMenuItem('Quit', self.onExitClicked))
        menu.show_all()

        button = Gtk.MenuButton(u"Actions \u25BE")
        button.set_popup(menu)
        return button

    def onAddFileWatcher(self, menuItem):
        dialog = NewLogDialog(self.window)
        response = dialog.run()

        if response == Gtk.ResponseType.OK and dialog.isValid():
            label = ClosableTabLabel(dialog.getName())
            content = FileWatcherView(dialog.getFile())
            content.show()
            label.connect("close-clicked", self.onCloseTab, content)
            self.notebook.append_page(content, label)
            self.notebook.set_current_page(self.notebook.get_n_pages()-1)

        dialog.destroy()
        
    def onCloseTab(self, label, content):
        self.notebook.remove_page(self.notebook.page_num(content))
        content.destroy()
        
    def onRestartClicked(self, menuItem):
        #todo: gets killed when the python process ends, separate it!
        os.system("cinnamon --replace &")

    def onAboutClicked(self, menuItem):
        dialog = Gtk.MessageDialog(self.window, 0,
                                   Gtk.MessageType.QUESTION, Gtk.ButtonsType.CLOSE);

        dialog.set_title("About Melange")
        dialog.set_markup("<b>Melange</b> is a GTK3 alternative to the built-in javascript debugger <i>Looking Glass</i>"
                           + "\n\nPressing <i>Escape</i> while Melange has focus will hide the window."
                           +"\nIf you want to exit Melange, use ALT+F4 or the <u>Actions</u> menu button."
                           + "\n\nIf you defined a hotkey for Melange, pressing it while Melange is visible it will be hidden.")

        dialog.run()
        dialog.destroy()

    def onExitClicked(self, menuItem):
        Gtk.main_quit()

    def onResetClicked(self, menuItem):
        dialog = Gtk.MessageDialog(self.window, 0,
                                   Gtk.MessageType.WARNING, Gtk.ButtonsType.YES_NO,
                                   "Reset all cinnamon settings to default?")
        dialog.set_title("Warning: Trying to reset all cinnamon settings!")

        response = dialog.run()
        dialog.destroy()
        if response == Gtk.ResponseType.YES:
            os.system("gsettings reset-recursively org.cinnamon &")

    def onKeyPress(self, widget, event=None):
        if event.keyval == Gdk.KEY_Escape:
            self.window.hide()

    def onDelete(self, widget, event=None):
        Gtk.main_quit()
        return False

    def onPickerClicked(self, widget):
        dbusManager.cinnamonDBus.lgStartInspector()
        self.window.hide()

    def createDummyPage(self, text, description):
        label = Gtk.Label(text)
        self.notebook.append_page(Gtk.Label(description), label)

    def createPage(self, text, moduleName):
        module = __import__("page_%s" % moduleName)
        module.dbusManager = dbusManager
        module.cinnamonLog = self
        label = Gtk.Label(text)
        page = module.ModulePage()
        self.pages[moduleName] = page
        self.notebook.append_page(page, label)

    def activatePage(self, moduleName):
        self.window.present()
        page = self.notebook.page_num(self.pages[moduleName])
        self.notebook.set_current_page(page)

def setStatus(status):
    if status:
        statusLabel.hide()
    else:
        statusLabel.show()

class DBusManager:
    def __init__ (self):
        self.sessionBus = dbus.SessionBus ()
        self.dbus = prox = self.createSessionDBusProxy("org.freedesktop.DBus", "/org/freedesktop/DBus")
        self.dbus.connect_to_signal("NameOwnerChanged", self.onNameOwnerChanged)

        self.cinnamonSignals = []
        self.cinnamonReconnectCallback = []
        self.initCinnamonProxy()

    def initCinnamonProxy(self):
        self.cinnamonDBus = self.createSessionDBusProxy("org.Cinnamon", "/org/Cinnamon")
        for callback in self.cinnamonReconnectCallback:
            callback()
        for name, callback in self.cinnamonSignals:
            self.cinnamonDBus.connect_to_signal(name, callback)

    def addReconnectCallback(self, callback):
        self.cinnamonReconnectCallback.append(callback)

    def connectToCinnamonSignal(self, name, callback):
        self.cinnamonDBus.connect_to_signal(name, callback)
        self.cinnamonSignals.append((name, callback))

    def createSessionDBusProxy(self, name, path):
        try:
            proxy = self.sessionBus.get_object(name, path)
            return proxy
        except dbus.exceptions.DBusException as e:
            print(e)
            return None

    def onNameOwnerChanged(self, name, old, new):
        if name == "org.Cinnamon":
            if new == "":
                print "Cinnamon offline"
                setStatus(False)
            else:
                print "Cinnamon online"
                setStatus(True)
                self.initCinnamonProxy()

if __name__ == "__main__":
    GObject.type_register(ResizeGrip)
    DBusGMainLoop(set_as_default=True)

    global dbusManager
    dbusManager = DBusManager()

    request = dbusManager.sessionBus.request_name(LG_DBUS_NAME, dbus.bus.NAME_FLAG_DO_NOT_QUEUE)
    if request != dbus.bus.REQUEST_NAME_REPLY_EXISTS:
        app = CinnamonLog()
    else:
        object = dbusManager.sessionBus.get_object(LG_DBUS_NAME, LG_DBUS_PATH)
        app = dbus.Interface(object, LG_DBUS_NAME)

    app.show()
