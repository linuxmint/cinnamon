#!/usr/bin/python3

# Todo:
# - TextTag.invisible does not work nicely with scrollheight, find out why
#   - (Sometimes scrollbars think there is more or less to scroll than there actually is after
#     showing/hiding entries in page_log.py)
# - Add insert button to "simple types" inspect dialog ? is there actual use for these types
#   inserted as results ?
# - Load all enabled log categories and window height from gsettings
# - Make CommandLine entry & history work more like a normal terminal
#   - When navigating through history and modifying a line
#   - When pressing ctrl + r, search history
#   - auto-completion ?

import os
import signal
import sys
import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
import pyinotify
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GObject, Gdk, GLib
from setproctitle import setproctitle

import pageutils
from lookingglass_proxy import LookingGlassProxy

signal.signal(signal.SIGINT, signal.SIG_DFL)

MELANGE_DBUS_NAME = "org.Cinnamon.Melange"
MELANGE_DBUS_PATH = "/org/Cinnamon/Melange"

class MenuButton(Gtk.Button):
    def __init__(self, text):
        Gtk.Button.__init__(self, text)
        self.menu = None
        self.connect("clicked", self.on_clicked)

    def set_popup(self, menu):
        self.menu = menu

    def on_clicked(self, widget):
        x, y, w, h = self.get_screen_coordinates()
        self.menu.popup(None, None, lambda menu, data: (x, y+h, True), None, 1, 0)

    def get_screen_coordinates(self):
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
    def __init__(self, exec_cb):
        Gtk.Entry.__init__(self)
        self.exec_cb = exec_cb
        self.settings = Gio.Settings.new("org.cinnamon")
        self.history = self.settings.get_strv("looking-glass-history")
        self.history_position = -1
        self.last_text = ""
        self.connect('key-press-event', self.on_key_press)
        self.connect("populate-popup", self.populate_popup)

    def populate_popup(self, view, menu):
        menu.append(Gtk.SeparatorMenuItem())
        clear = Gtk.MenuItem("Clear History")
        clear.connect('activate', self.history_clear)
        menu.append(clear)
        menu.show_all()
        return False

    def on_key_press(self, widget, event):
        if event.keyval == Gdk.KEY_Up:
            self.history_prev()
            return True
        if event.keyval == Gdk.KEY_Down:
            self.history_next()
            return True
        if event.keyval == Gdk.KEY_Return or event.keyval == Gdk.KEY_KP_Enter:
            self.execute()
            return True

    def history_clear(self, menu_item):
        self.history = []
        self.history_position = -1
        self.last_text = ""
        self.settings.set_strv("looking-glass-history", self.history)

    def history_prev(self):
        num = len(self.history)
        if self.history_position == 0 or num == 0:
            return
        if self.history_position == -1:
            self.history_position = num - 1
            self.last_text = self.get_text()
        else:
            self.history_position -= 1
        self.set_text(self.history[self.history_position])
        self.select_region(-1, -1)

    def history_next(self):
        if self.history_position == -1:
            return
        num = len(self.history)
        if self.history_position == num-1:
            self.history_position = -1
            self.set_text(self.last_text)
        else:
            self.history_position += 1
            self.set_text(self.history[self.history_position])
        self.select_region(-1, -1)

    def execute(self):
        self.history_position = -1
        command = self.get_text()
        if command != "":
            num = len(self.history)
            if num == 0 or self.history[num-1] != command:
                self.history.append(command)
            self.set_text("")
            self.settings.set_strv("looking-glass-history", self.history)

            self.exec_cb(command)


class NewLogDialog(Gtk.Dialog):
    def __init__(self, parent):
        Gtk.Dialog.__init__(self, "Add a new file watcher", parent, 0,
                            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                             Gtk.STOCK_OK, Gtk.ResponseType.OK))

        self.set_default_size(150, 100)

        label = Gtk.Label("")
        label.set_markup("<span size='large'>Add File Watch:</span>\n\n" +
                         "Please select a file to watch and a name for the tab\n")

        box = self.get_content_area()
        box.add(label)

        self.store = Gtk.ListStore(str, str)
        self.store.append(["custom", "<Select file>"])

        self.combo = Gtk.ComboBox.new_with_model(self.store)
        self.combo.connect("changed", self.on_combo_changed)
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

    def on_combo_changed(self, combo):
        tree_iter = combo.get_active_iter()
        if tree_iter is not None:
            model = combo.get_model()
            name, self.filename = model[tree_iter][:2]
            self.entry.set_text(name)
            if name == "custom":
                new_file = self.select_file()
                if new_file is not None:
                    combo.set_active_iter(self.store.insert(1, ["user", new_file]))
                else:
                    combo.set_active(-1)
            return False

    def is_valid(self):
        return (self.entry.get_text() != "" and
                self.filename is not None and
                os.path.isfile(os.path.expanduser(self.filename)))

    def get_file(self):
        return os.path.expanduser(self.filename)

    def get_text(self):
        return self.entry.get_text()

    def select_file(self):
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
    def my_init(self, view):
        self.view = view

    def process_IN_CLOSE_WRITE(self, event):
        self.view.get_updates()

    def process_IN_CREATE(self, event):
        self.view.get_updates()

    def process_IN_DELETE(self, event):
        self.view.get_updates()

    def process_IN_MODIFY(self, event):
        self.view.get_updates()

class FileWatcherView(Gtk.ScrolledWindow):
    def __init__(self, filename):
        Gtk.ScrolledWindow.__init__(self)

        self.filename = filename
        self.changed = 0
        self.update_id = 0
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.textview = Gtk.TextView()
        self.textview.set_editable(False)
        self.add(self.textview)

        self.textbuffer = self.textview.get_buffer()

        self.show_all()
        self.get_updates()

        handler = FileWatchHandler(view=self)
        watch_manager = pyinotify.WatchManager()
        self.notifier = pyinotify.ThreadedNotifier(watch_manager, handler)
        watch_manager.add_watch(filename, (pyinotify.IN_CLOSE_WRITE |
                                           pyinotify.IN_CREATE |
                                           pyinotify.IN_DELETE |
                                           pyinotify.IN_MODIFY))
        self.notifier.start()
        self.connect("destroy", self.on_destroy)
        self.connect("size-allocate", self.on_size_changed)

    def on_destroy(self, widget):
        if self.notifier:
            self.notifier.stop()
            self.notifier = None

    def on_size_changed(self, widget, bla):
        if self.changed > 0:
            end_iter = self.textbuffer.get_end_iter()
            self.textview.scroll_to_iter(end_iter, 0, False, 0, 0)
            self.changed -= 1

    def get_updates(self):
        # only update 2 times per second max
        # without this rate limiting, certain file modifications can cause
        # a crash at Gtk.TextBuffer.set_text()
        if self.update_id == 0:
            self.update_id = GLib.timeout_add(500, self.update)

    def update(self):
        self.changed = 2 # on_size_changed will be called twice, but only the second time is final
        self.textbuffer.set_text(open(self.filename, 'r').read())
        self.update_id = 0
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
    def __init__(self):
        self.lg_proxy = LookingGlassProxy()
        # The status label is shown iff we are not okay
        self.lg_proxy.add_status_change_callback(lambda x: self.status_label.set_visible(not x))

        self.window = None
        self._minimized = False
        self.run()

        dbus.service.Object.__init__(self, dbus.SessionBus(), MELANGE_DBUS_PATH, MELANGE_DBUS_NAME)

    @dbus.service.method(MELANGE_DBUS_NAME, in_signature='', out_signature='')
    def show(self):
        if self.window.get_visible():
            if self._minimized:
                self.window.present()
            else:
                self.window.hide()
        else:
            self.show_and_focus()

    @dbus.service.method(MELANGE_DBUS_NAME, in_signature='', out_signature='')
    def hide(self):
        self.window.hide()

    @dbus.service.method(MELANGE_DBUS_NAME, in_signature='', out_signature='b')
    def getVisible(self):
        return self.window.get_visible()

    @dbus.service.method(MELANGE_DBUS_NAME, in_signature='', out_signature='')
    def doInspect(self):
        if self.lg_proxy:
            self.lg_proxy.StartInspector()
            self.window.hide()

    def show_and_focus(self):
        self.window.show_all()
        self.lg_proxy.refresh_status()
        self.command_line.grab_focus()

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

        self.window.connect("delete_event", self.on_delete)
        self.window.connect("key-press-event", self.on_key_press)
        self._minimized = False
        self.window.connect("window-state-event", self.on_window_state)

        num_rows = 3
        num_columns = 6
        table = Gtk.Table(n_rows=num_rows, n_columns=num_columns, homogeneous=False)
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
        self.custom_pages = {}
        self.create_page("Results", "results")
        self.create_page("Inspect", "inspect")
        self.create_page("Windows", "windows")
        self.create_page("Extensions", "extensions")
        self.create_page("Log", "log")

        table.attach(self.notebook, 0, num_columns, 0, 1)

        column = 0
        picker_button = pageutils.ImageButton("color-select-symbolic")
        picker_button.set_tooltip_text("Select an actor to inspect")
        picker_button.connect("clicked", self.on_picker_clicked)
        table.attach(picker_button, column, column+1, 1, 2, 0, 0, 2)
        column += 1

        full_gc = pageutils.ImageButton("user-trash-full-symbolic")
        full_gc.set_tooltip_text("Invoke garbage collection")
        # ignore signal arg
        full_gc.connect('clicked', lambda source: self.lg_proxy.FullGc())
        table.attach(full_gc, column, column+1, 1, 2, 0, 0, 2)
        column += 1

        self.command_line = CommandLine(self.lg_proxy.Eval)
        self.command_line.set_tooltip_text("Evaluate javascript")
        table.attach(self.command_line,
                     column,
                     column + 1,
                     1,
                     2,
                     Gtk.AttachOptions.EXPAND | Gtk.AttachOptions.FILL,
                     0,
                     3,
                     2)
        column += 1

        self.status_label = Gtk.Label(label="Status")
        self.status_label.set_markup(" <span foreground='red'>[ Cinnamon is OFFLINE! ]</span> ")
        self.status_label.set_tooltip_text("The connection to cinnamon is broken")
        self.status_label.set_no_show_all(True)
        table.attach(self.status_label, column, column+1, 1, 2, 0, 0, 1)
        column += 1

        box = Gtk.HBox()
        settings = Gio.Settings(schema="org.cinnamon.desktop.keybindings")
        arr = settings.get_strv("looking-glass-keybinding")
        if len(arr) > 0:
            # only the first mapped keybinding
            [accel_key, mask] = Gtk.accelerator_parse(arr[0])
            if accel_key == 0 and mask == 0:
                # failed to parse, fallback to plain accel string
                label = Gtk.Label(label=arr[0])
            else:
                label = Gtk.Label(label=Gtk.accelerator_get_label(accel_key, mask))
            label.set_tooltip_text("Toggle shortcut")
            box.pack_start(label, False, False, 3)

        action_button = self.create_action_button()
        box.pack_start(action_button, False, False, 3)

        table.attach(box, column, column+1, 1, 2, 0, 0, 1)

        self.activate_page("results")
        self.status_label.hide()
        self.window.set_focus(self.command_line)

    def create_menu_item(self, text, callback):
        item = Gtk.MenuItem(label=text)
        item.connect("activate", callback)
        return item

    def create_action_button(self):
        restart_func = lambda junk: os.system("nohup cinnamon --replace > /dev/null 2>&1 &")
        crash_func = lambda junk: self.lg_proxy.Eval("global.segfault()")

        menu = Gtk.Menu()
        menu.append(self.create_menu_item('Add File Watcher', self.on_add_file_watcher))
        menu.append(Gtk.SeparatorMenuItem())
        menu.append(self.create_menu_item('Restart Cinnamon', restart_func))
        menu.append(self.create_menu_item('Crash Cinnamon', crash_func))
        menu.append(self.create_menu_item('Reset Cinnamon Settings', self.on_reset_clicked))
        menu.append(Gtk.SeparatorMenuItem())
        menu.append(self.create_menu_item('About Melange', self.on_about_clicked))
        menu.append(self.create_menu_item('Quit', self.on_delete))
        menu.show_all()

        button = Gtk.MenuButton(label="Actions \u25BE")
        button.set_popup(menu)
        return button

    def on_add_file_watcher(self, menu_item):
        dialog = NewLogDialog(self.window)
        response = dialog.run()

        if response == Gtk.ResponseType.OK and dialog.is_valid():
            label = ClosableTabLabel(dialog.get_text())
            content = FileWatcherView(dialog.get_file())
            content.show()
            label.connect("close-clicked", self.on_close_tab, content)
            self.custom_pages[label] = content
            self.notebook.append_page(content, label)
            self.notebook.set_current_page(self.notebook.get_n_pages()-1)

        dialog.destroy()

    def on_close_tab(self, label, content):
        self.notebook.remove_page(self.notebook.page_num(content))
        content.destroy()
        del self.custom_pages[label]

    def on_about_clicked(self, menu_item):
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

    def on_reset_clicked(self, menu_item):
        dialog = Gtk.MessageDialog(self.window, 0,
                                   Gtk.MessageType.WARNING, Gtk.ButtonsType.YES_NO,
                                   "Reset all cinnamon settings to default?")
        dialog.set_title("Warning: Trying to reset all cinnamon settings!")

        response = dialog.run()
        dialog.destroy()
        if response == Gtk.ResponseType.YES:
            os.system("gsettings reset-recursively org.cinnamon &")

    def on_key_press(self, widget, event=None):
        if event.keyval == Gdk.KEY_Escape:
            self.window.hide()

    def on_delete(self, widget=None, event=None):
        tmp_pages = self.custom_pages.copy()
        for label, content in tmp_pages.items():
            self.on_close_tab(label, content)
        Gtk.main_quit()
        return False

    def on_window_state(self, widget, event):
        if event.new_window_state & Gdk.WindowState.ICONIFIED:
            self._minimized = True
        else:
            self._minimized = False

    def on_picker_clicked(self, widget):
        self.lg_proxy.StartInspector()
        self.window.hide()

    def create_dummy_page(self, text, description):
        label = Gtk.Label(label=text)
        self.notebook.append_page(Gtk.Label(label=description), label)

    def create_page(self, text, module_name):
        module = __import__("page_%s" % module_name)
        module.lg_proxy = self.lg_proxy
        module.melangeApp = self
        label = Gtk.Label(label=text)
        page = module.ModulePage(self)
        self.pages[module_name] = page
        self.notebook.append_page(page, label)

    def activate_page(self, module_name):
        page = self.notebook.page_num(self.pages[module_name])
        self.notebook.set_current_page(page)

def main():
    setproctitle("cinnamon-looking-glass")
    DBusGMainLoop(set_as_default=True)

    session_bus = dbus.SessionBus()
    request = session_bus.request_name(MELANGE_DBUS_NAME, dbus.bus.NAME_FLAG_DO_NOT_QUEUE)
    if request != dbus.bus.REQUEST_NAME_REPLY_EXISTS:
        app = MelangeApp()
    else:
        dbus_obj = session_bus.get_object(MELANGE_DBUS_NAME, MELANGE_DBUS_PATH)
        app = dbus.Interface(dbus_obj, MELANGE_DBUS_NAME)

    daemon = len(sys.argv) == 2 and sys.argv[1] == "daemon"
    inspect = len(sys.argv) == 2 and sys.argv[1] == "inspect"

    if inspect:
        app.doInspect()
    elif not daemon:
        app.show()

    Gtk.main()

if __name__ == "__main__":
    main()
