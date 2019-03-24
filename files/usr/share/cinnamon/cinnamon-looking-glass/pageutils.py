#!/usr/bin/python3

from gi.repository import Gtk

# truncate a string to single line 121 char max with ellipsis
def shorten_value(value):
    changed = False
    trunc_pos = value.find("\n")
    if trunc_pos >= 0:
        changed = True
        value = value[:trunc_pos]

    if len(value) > 120:
        changed = True
        value = value[:120]

    if changed:
        value += "..."

    return value

class ResultTextDialog(Gtk.Dialog):
    def __init__(self, title, text):
        Gtk.Dialog.__init__(self, title, None, 0,
                            (Gtk.STOCK_CLOSE, Gtk.ResponseType.CLOSE))

        self.set_default_size(350, 70)

        label = Gtk.Label(text)
        label.set_selectable(True)

        box = self.get_content_area()
        box.add(label)
        self.show_all()

        self.connect("response", self.on_response)
        self.connect("close", self.on_close)

    def on_close(self, data=None):
        self.destroy()

    def on_response(self, response_id, data=None):
        self.destroy()

class BaseListView(Gtk.ScrolledWindow):
    def __init__(self, store):
        Gtk.ScrolledWindow.__init__(self)
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.store = store
        self.tree_view = Gtk.TreeView(self.store)

        self.add(self.tree_view)
        self.renderer_text = Gtk.CellRendererText()

    def create_text_column(self, index, text):
        column = Gtk.TreeViewColumn(text, self.renderer_text, text=index)
        column.set_sort_column_id(index)
        column.set_resizable(True)
        self.tree_view.append_column(column)
        return column

class WindowAndActionBars(Gtk.Table):
    def __init__(self, window):
        Gtk.Table.__init__(self, 2, 2, False)

        self.bottom = Gtk.HBox()
        self.left = Gtk.VBox()

        self.attach(window, 1, 2, 0, 1)
        self.attach(self.left, 0, 1, 0, 1, 0, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        self.attach(self.bottom, 0, 2, 1, 2, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0)

    def add_to_left_bar(self, widget, padding=0):
        self.left.set_border_width(2)
        self.left.pack_start(widget, False, False, padding)

    def add_to_bottom_bar(self, widget, padding=0):
        self.bottom.set_border_width(2)
        self.bottom.pack_start(widget, False, False, padding)

class ImageButton(Gtk.Button):
    def __init__(self, icon_name, size=Gtk.IconSize.MENU):
        Gtk.Button.__init__(self)

        image = Gtk.Image.new_from_icon_name(icon_name, size)
        self.add(image)

class ImageToggleButton(Gtk.ToggleButton):
    def __init__(self, icon_name, size=Gtk.IconSize.MENU):
        Gtk.ToggleButton.__init__(self)

        image = Gtk.Image.new_from_icon_name(icon_name, size)
        self.add(image)
