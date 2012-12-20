from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class ResultTextDialog(Gtk.Dialog):
    def __init__(self, title, text):
        Gtk.Dialog.__init__(self, title, None, 0,
            (Gtk.STOCK_CLOSE, Gtk.ResponseType.CLOSE))

        self.set_default_size(350, 70)

        label = Gtk.Label(text)
        label.set_selectable(True)

        self.connect("response", self.onResponse)
        self.connect("close", self.onClose)

        box = self.get_content_area()
        box.add(label)
        self.show_all()
        
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
        #self.rendererText.set_property('ellipsize', pango.ELLIPSIZE_END)

    def create_text_column(self, index, text):
        column = Gtk.TreeViewColumn(text, self.rendererText, text=index)
        column.set_sort_column_id(index)
        column.set_resizable(True)
        self.treeView.append_column(column)
        return column

class TableWindowAndActionBar(Gtk.Table):
    def __init__(self, window, numItems, xPadding=0, yPadding=0):
        Gtk.Table.__init__(self, 2, numItems + 1, False)
        self.attach(window, 0, numItems+1, 0, 1)
        
        self.numItems = numItems
        self.addedItems = 0
        self.xPadding = xPadding
        self.yPadding = yPadding

    def addToActionBar(self, widget):
        self.attach(widget, self.addedItems, self.addedItems+1, 1, 2, 0, 0, self.xPadding, self.yPadding)
        self.addedItems += 1
        if self.addedItems == self.numItems:
            self.attach(Gtk.Label(""), self.addedItems, self.addedItems+1, 1, 2, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, self.xPadding, self.yPadding)

class TableWindowAndActionBarLeft(Gtk.Table):
    def __init__(self, window, numItems, xPadding=0, yPadding=0):
        Gtk.Table.__init__(self, numItems + 1, 2, False)
        self.attach(window, 1, 2, 0, numItems+1)
        
        self.numItems = numItems
        self.addedItems = 0
        self.xPadding = xPadding
        self.yPadding = yPadding

    def addToActionBar(self, widget):
        self.attach(widget, 0, 1, self.addedItems, self.addedItems+1, 0, 0, self.xPadding, self.yPadding)
        self.addedItems += 1
        if self.addedItems == self.numItems:
            self.attach(Gtk.Label(""), 0, 1, self.addedItems, self.addedItems+1, 0, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, self.xPadding, self.yPadding)

def loadIcon(name, size=Gtk.IconSize.LARGE_TOOLBAR):
    theme = Gtk.IconTheme.get_default()    
    Success, width, height = Gtk.icon_size_lookup(size)                                                
    if theme.has_icon(name):
        return theme.load_icon(name, width, 0)
    return None
    
class ImageButton(Gtk.Button):
    def __init__(self, icon, size=Gtk.IconSize.LARGE_TOOLBAR):
        Gtk.Button.__init__(self)
        image = Gtk.Image()
        ico = loadIcon(icon, size)
        if ico is not None:
            image.set_from_gicon(ico, size)
        self.add(image)

class ImageToggleButton(Gtk.ToggleButton):
    def __init__(self, icon, size=Gtk.IconSize.LARGE_TOOLBAR):
        Gtk.ToggleButton.__init__(self)
        image = Gtk.Image()
        ico = loadIcon(icon, size)
        if ico is not None:
            image.set_from_gicon(ico, size)
        self.add(image)
