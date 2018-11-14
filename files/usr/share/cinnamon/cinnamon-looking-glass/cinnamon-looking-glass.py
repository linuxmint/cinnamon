#!/usr/bin/python3

# Todo:
# - TextTag.invisible does not work nicely with scrollheight, find out why
#   - (Sometimes scrollbars think there is more or less to scroll than there actually is after showing/hiding entries in page_log.py)
# - Add insert button to "simple types" inspect dialog ? is there actual use for these types inserted as results ?
# - Load all enabled log categories and window height from gsettings
# - Make CommandLine entry & history work more like a normal terminal
#   - When navigating through history and modifying a line
#   - When pressing ctrl + r, search history
#   - auto-completion ?

import sys
import os
import pyinotify
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GObject, Gdk, GLib
from dbus.mainloop.glib import DBusGMainLoop
import dbus, dbus.service
import pageutils
from lookingglass_proxy import LookingGlassProxy
import signal
signal.signal(signal.SIGINT, signal.SIG_DFL)

MELANGE_DBUS_NAME = "org.Cinnamon.Melange"
MELANGE_DBUS_PATH = "/org/Cinnamon/Melange"

class MenuButton(Gtk.Button):
    def __init__(self, text):
        Gtk.Button.__init__(self, text)
        self.connect("clicked", self.onClicked)

    def set_popup(self, menu):
        self.menu = menu

    def onClicked(self, widget):
        x, y, w, h = self.getScreenCoordinates()
        self.menu.popup(None, None, lambda menu, data: (x, y+h, True), None, 1, 0)

    def getScreenCoordinates(self):
        parent = self.get_parent_window()
        x, y = parent.get_root_origin()
        w = parent.get_width()
        h = parent.get_height()
        extents = parent.get_frame_extents()
        allocation = self.get_allocation()
        return (x + (extents.width-w)//2 + allocation.x,
                y + (extents.height-h)-(extents.width-w)//2 + allocation.y,
                allocation.width,
                allocation.height)

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
        if event.keyval == Gdk.KEY_Return or event.keyval == Gdk.KEY_KP_Enter:
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

            lookingGlassProxy.Eval(command)

    def doCrash(self):
        lookingGlassProxy.Eval("global.segfault()")


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
        self.updateId = 0
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
        # only update 2 times per second max
        # without this rate limiting, certain file modifications can cause a crash at Gtk.TextBuffer.set_text()
        if self.updateId == 0:
            self.updateId = GLib.timeout_add(500, self.update)

    def update(self):
        self.changed = 2 # onSizeChanged will be called twice, but only the second time is final
        self.textbuffer.set_text(open(self.filename, 'r').read())
        self.updateId = 0
        return False

class ClosableTabLabel(Gtk.Box):
    __gsignals__ = {
        "close-clicked": (GObject.SignalFlags.RUN_FIRST, GObject.TYPE_NONE, ()),
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
        self.pack_start(button, False, False, 0)

        self.show_all()

    def button_clicked(self, button, data=None):
        self.emit("close-clicked")

class MelangeApp(dbus.service.Object):
    def __init__ (self):
        global lookingGlassProxy
        lookingGlassProxy = LookingGlassProxy()
        self.lookingGlassProxy = lookingGlassProxy
        # The status label is shown iff we are not okay
        lookingGlassProxy.addStatusChangeCallback(lambda x: self.statusLabel.set_visible(not x))

        self.window = None
        self.run()

        dbus.service.Object.__init__ (self, dbus.SessionBus (), MELANGE_DBUS_PATH, MELANGE_DBUS_NAME)

    @dbus.service.method (MELANGE_DBUS_NAME, in_signature='', out_signature='')
    def show(self):
        if self.window.get_visible():
            if self._minimized:
                self.window.present()
            else:
                self.window.hide()
        else:
            self.showAndFocus()

    @dbus.service.method (MELANGE_DBUS_NAME, in_signature='', out_signature='')
    def hide(self):
        self.window.hide()

    @dbus.service.method (MELANGE_DBUS_NAME, in_signature='', out_signature='b')
    def getVisible(self):
        return self.window.get_visible()

    @dbus.service.method (MELANGE_DBUS_NAME, in_signature='', out_signature='')
    def doInspect(self):
        if self.lookingGlassProxy:
            self.lookingGlassProxy.StartInspector()
            self.window.hide()

    def showAndFocus(self):
        self.window.show_all()
        self.lookingGlassProxy.refreshStatus()
        self.commandline.grab_focus()

    def run(self):
        self.window = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
        self.window.set_title("Melange")
        self.window.set_icon_name("system-search")
        self.window.set_default_size(1000, 400)
        self.window.set_position(Gtk.WindowPosition.MOUSE)

        # I can't think of a way to reliably detect if the window
        # is active to determine if we need to present or hide
        # in show(). Since the window briefly loses focus during
        # shortcut press we'd be unable to detect it at that time.
        # Keeping the window on top ensures the window is never
        # obscured so we can just hide if visible.
        self.window.set_keep_above(True)

        self.window.connect("delete_event", self.onDelete)
        self.window.connect("key-press-event", self.onKeyPress)
        self._minimized = False
        self.window.connect("window-state-event", self.onWindowState)

        numRows = 3
        numColumns = 6
        table = Gtk.Table(n_rows=numRows, n_columns=numColumns, homogeneous=False)
        table.set_margin_start(6)
        table.set_margin_end(6)
        table.set_margin_top(6)
        table.set_margin_bottom(6)
        self.window.add(table)

        self.notebook = Gtk.Notebook()
        self.notebook.set_tab_pos(Gtk.PositionType.BOTTOM)
        self.notebook.show()
        self.notebook.set_show_border(True)
        self.notebook.set_show_tabs(True)

        label = Gtk.Label(label="Melange")
        label.set_markup("<u>Melange - Cinnamon Debugger</u> ")
        label.show()
        self.notebook.set_action_widget(label, Gtk.PackType.END)

        self.pages = {}
        self.customPages = {}
        self.createPage("Results", "results")
        self.createPage("Inspect", "inspect")
        # self.createPage("Memory", "memory") - TODO: re-implement get_memory_info from cjs
        self.createPage("Windows", "windows")
        self.createPage("Extensions", "extensions")
        self.createPage("Log", "log")

        table.attach(self.notebook, 0, numColumns, 0, 1)

        column = 0
        pickerButton = pageutils.ImageButton("color-select-symbolic")
        pickerButton.set_tooltip_text("Select an actor to inspect")
        pickerButton.connect("clicked", self.onPickerClicked)
        table.attach(pickerButton, column, column+1, 1, 2, 0, 0, 2)
        column += 1

        fullGc = pageutils.ImageButton("user-trash-full-symbolic")
        fullGc.set_tooltip_text("Invoke garbage collection")
        # ignore signal arg
        fullGc.connect ('clicked', lambda source: lookingGlassProxy.FullGc())
        table.attach(fullGc, column, column+1, 1, 2, 0, 0, 2)
        column += 1

        self.commandline = CommandLine()
        self.commandline.set_tooltip_text("Evaluate javascript")
        table.attach(self.commandline, column, column+1, 1, 2, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 3, 2)
        column += 1

        self.statusLabel = Gtk.Label(label="Status")
        self.statusLabel.set_markup(" <span foreground='red'>[ Cinnamon is OFFLINE! ]</span> ")
        self.statusLabel.set_tooltip_text("The connection to cinnamon is broken")
        self.statusLabel.set_no_show_all(True)
        table.attach(self.statusLabel, column, column+1, 1, 2, 0, 0, 1)
        column += 1

        box = Gtk.HBox()
        settings = Gio.Settings(schema="org.cinnamon.desktop.keybindings")
        arr = settings.get_strv("looking-glass-keybinding")
        if len(arr) > 0:
            # only the first mapped keybinding
            [accelKey, mask] = Gtk.accelerator_parse(arr[0])
            if accelKey == 0 and mask == 0:
                # failed to parse, fallback to plain accel string
                label = Gtk.Label(label=arr[0])
            else:
                label = Gtk.Label(label=Gtk.accelerator_get_label(accelKey, mask))
            label.set_tooltip_text("Toggle shortcut")
            box.pack_start(label, False, False, 3)

        actionButton = self.createActionButton()
        box.pack_start(actionButton, False, False, 3)

        table.attach(box, column, column+1, 1, 2, 0, 0, 1)

        self.activatePage("results")
        self.statusLabel.hide()
        self.window.set_focus(self.commandline)

    def createMenuItem(self, text, callback):
        item = Gtk.MenuItem(label=text)
        item.connect("activate", callback)
        return item

    def createActionButton(self):
        menu = Gtk.Menu()
        menu.append(self.createMenuItem('Add File Watcher', self.onAddFileWatcher))
        menu.append(Gtk.SeparatorMenuItem())
        menu.append(self.createMenuItem('Restart Cinnamon', lambda x: os.system("nohup cinnamon --replace > /dev/null 2>&1 &")))
        menu.append(self.createMenuItem('Crash Cinnamon', lambda x: self.commandline.doCrash()))
        menu.append(self.createMenuItem('Reset Cinnamon Settings', self.onResetClicked))
        menu.append(Gtk.SeparatorMenuItem())
        menu.append(self.createMenuItem('About Melange', self.onAboutClicked))
        menu.append(self.createMenuItem('Quit', self.onDelete))
        menu.show_all()

        button = Gtk.MenuButton(label="Actions \u25BE")
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
            self.customPages[label] = content
            self.notebook.append_page(content, label)
            self.notebook.set_current_page(self.notebook.get_n_pages()-1)

        dialog.destroy()

    def onCloseTab(self, label, content):
        self.notebook.remove_page(self.notebook.page_num(content))
        content.destroy()
        del self.customPages[label]

    def onAboutClicked(self, menuItem):
        dialog = Gtk.MessageDialog(self.window, 0,
                                   Gtk.MessageType.QUESTION, Gtk.ButtonsType.CLOSE)

        dialog.set_title("About Melange")
        dialog.set_markup("""\
<b>Melange</b> is a GTK3 alternative to the built-in javascript debugger <i>Looking Glass</i>

Pressing <i>Escape</i> while Melange has focus will hide the window.
If you want to exit Melange, use ALT+F4 or the <u>Actions</u> menu button.

If you defined a hotkey for Melange, pressing it while Melange is visible it will be hidden.""")

        dialog.run()
        dialog.destroy()

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

    def onDelete(self, widget=None, event=None):
        tmpPages = self.customPages.copy()
        for label, content in tmpPages.items():
            self.onCloseTab(label, content)
        Gtk.main_quit()
        return False

    def onWindowState(self, widget, event):
        if event.new_window_state & Gdk.WindowState.ICONIFIED:
            self._minimized = True
        else:
            self._minimized = False

    def onPickerClicked(self, widget):
        self.lookingGlassProxy.StartInspector()
        self.window.hide()

    def createDummyPage(self, text, description):
        label = Gtk.Label(label=text)
        self.notebook.append_page(Gtk.Label(label=description), label)

    def createPage(self, text, moduleName):
        module = __import__("page_%s" % moduleName)
        module.lookingGlassProxy = self.lookingGlassProxy
        module.melangeApp = self
        label = Gtk.Label(label=text)
        page = module.ModulePage(self)
        self.pages[moduleName] = page
        self.notebook.append_page(page, label)

    def activatePage(self, moduleName):
        page = self.notebook.page_num(self.pages[moduleName])
        self.notebook.set_current_page(page)

if __name__ == "__main__":
    DBusGMainLoop(set_as_default=True)

    sessionBus = dbus.SessionBus ()
    request = sessionBus.request_name(MELANGE_DBUS_NAME, dbus.bus.NAME_FLAG_DO_NOT_QUEUE)
    if request != dbus.bus.REQUEST_NAME_REPLY_EXISTS:
        app = MelangeApp()
    else:
        object = sessionBus.get_object(MELANGE_DBUS_NAME, MELANGE_DBUS_PATH)
        app = dbus.Interface(object, MELANGE_DBUS_NAME)

    daemon = len(sys.argv) == 2 and sys.argv[1] == "daemon"
    inspect = len(sys.argv) == 2 and sys.argv[1] == "inspect"

    if inspect:
        app.doInspect()
    elif not daemon:
        app.show()

    Gtk.main()
