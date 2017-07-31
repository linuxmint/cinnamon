from gi.repository import Gtk

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

        self.connect("response", self.onResponse)
        self.connect("close", self.onClose)

    def onClose(self, data=None):
        self.destroy()

    def onResponse(self, id, data=None):
        self.destroy()

class BaseListView(Gtk.ScrolledWindow):
    def __init__(self, store):
        Gtk.ScrolledWindow.__init__(self)
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.store = store
        self.treeView = Gtk.TreeView(self.store)

        self.add(self.treeView)
        self.rendererText = Gtk.CellRendererText()

    def createTextColumn(self, index, text):
        column = Gtk.TreeViewColumn(text, self.rendererText, text=index)
        column.set_sort_column_id(index)
        column.set_resizable(True)
        self.treeView.append_column(column)
        return column

class WindowAndActionBars(Gtk.Table):
    def __init__(self, window):
        Gtk.Table.__init__(self, 2, 2, False)

        self.bottom = Gtk.HBox()
        self.left = Gtk.VBox()

        self.attach(window, 1, 2, 0, 1)
        self.attach(self.left, 0, 1, 0, 1, 0, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        self.attach(self.bottom, 0, 2, 1, 2, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0)

    def addToLeftBar(self, widget, padding=0):
        self.left.set_border_width(2)
        self.left.pack_start(widget, False, False, padding)

    def addToBottomBar(self, widget, padding=0):
        self.bottom.set_border_width(2)
        self.bottom.pack_start(widget, False, False, padding)

def loadIcon(name, size=Gtk.IconSize.LARGE_TOOLBAR):
    theme = Gtk.IconTheme.get_default()
    success, width, height = Gtk.icon_size_lookup(size)
    if success and theme.has_icon(name):
        return theme.load_icon(name, width, 0)
    return None

class ImageButton(Gtk.Button):
    def __init__(self, iconName, size=Gtk.IconSize.LARGE_TOOLBAR):
        Gtk.Button.__init__(self)

        icon = loadIcon(iconName, size)

        if icon is not None:
            image = Gtk.Image()
            image.set_from_gicon(icon, size)
            self.add(image)

class ImageToggleButton(Gtk.ToggleButton):
    def __init__(self, iconName, size=Gtk.IconSize.LARGE_TOOLBAR):
        Gtk.ToggleButton.__init__(self)

        icon = loadIcon(iconName, size)

        if icon is not None:
            image = Gtk.Image()
            image.set_from_gicon(icon, size)
            self.add(image)
