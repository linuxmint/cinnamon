
import json
import datetime
from pageutils import *
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class LogEntry():
    def __init__(self, category, time, message):
        self.category = category
        self.time = int(time)
        self.timestr = datetime.datetime.fromtimestamp(self.time).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.message = message
        self.formattedText = "%s t=%s %s\n" % (category, self.timestr, message)

class LogView(Gtk.ScrolledWindow):
    def __init__(self):
        Gtk.ScrolledWindow.__init__(self)
        
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        
        textview = Gtk.TextView()
        textview.set_editable(False)
        self.add(textview)
        
        self.textbuffer = textview.get_buffer()
        self.log = []
        
        self.enabledTypes = {'info': True, 'debug': True, 'error': True, 'trace': False }
        
        #fixme: load all enabled types from gsettings
        #self.enabledTypes = {'info': False, 'debug': False, 'error': False, 'trace': False }
        #for key in data:
        #    self.enabledTypes[key] = True
        
        textview.connect('size-allocate', self.onTextViewSizeAllocate)
        self.getUpdates()
        
        cinnamonDBus.connect_to_signal("lgLogUpdate", self.getUpdates)

    def onTextViewSizeAllocate(self, widget, event, data=None):
        adj = widget.get_vadjustment()
        adj.set_value( adj.get_upper() - adj.get_page_size() )

    def append(self, category, time, message):
        self.log.append(LogEntry(category, time, message))
            
    def updateText(self):
        sb = []
        for entry in self.log:
            if(self.enabledTypes[entry.category]):
                sb.append(entry.formattedText)
        self.textbuffer.set_text(''.join(sb))
        
    def onButtonToggled(self, button, data):
        self.enabledTypes[data] = button.get_active()
        self.updateText()
        
    def getUpdates(self):
        success, json_data = cinnamonDBus.lgGetErrorStack()
        if success:
            try:
                data = json.loads(json_data)
                #fixme: check first timestamp to make sure we don't have a completely new log here.
                end = len(self.log)
                for item in data[end:]:
                    self.append(item["category"], float(item["timestamp"])*0.001, item["message"])
                self.updateText()                
            except Exception as e:
                print e

class ModulePage(WindowAndActionBars):
    def __init__(self):
        self.view = LogView()
        WindowAndActionBars.__init__(self, self.view)
        
        self.addToggleButton("info", "dialog-information", "Show/Hide Messages tagged as 'info'")
        self.addToggleButton("debug", "dialog-warning", "Show/Hide Messages tagged as 'debug'")
        self.addToggleButton("error", "dialog-error", "Show/Hide Messages tagged as 'error'")
        self.addToggleButton("trace", "dialog-question", "Show/Hide Messages tagged as 'trace'")

    def addToggleButton(self, logType, icon, tooltip):
        button = ImageToggleButton(icon)
        button.connect("toggled", self.view.onButtonToggled, logType)
        button.set_active(self.view.enabledTypes[logType])
        button.set_tooltip_text(tooltip)
        self.addToLeftBar(button, 1)
        
