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

        self.textview = Gtk.TextView()
        self.textview.set_editable(False)
        self.add(self.textview)

        self.textbuffer = self.textview.get_buffer()

        self.log = []
        self.addedMessages = 0
        self.firstMessageTime = None

        self.enabledTypes = {'info': True, 'warning': True, 'error': True, 'trace': False }
        self.typeTags = {
            'info': self.textbuffer.create_tag("info", foreground="#1a6f18", invisible=self.enabledTypes["info"] != True, invisible_set=True),
            'warning': self.textbuffer.create_tag("warning", foreground="#c8bf33", invisible=self.enabledTypes["warning"] != True, invisible_set=True),
            'error': self.textbuffer.create_tag("error", foreground="#9f1313", invisible=self.enabledTypes["error"] != True, invisible_set=True),
            'trace': self.textbuffer.create_tag("trace", foreground="#18186f", invisible=self.enabledTypes["trace"] != True, invisible_set=True)
            }

        #todo: load all enabled types from gsettings
        #self.enabledTypes = {'info': False, 'warning': False, 'error': False, 'trace': False }
        #for key in data:
        #    self.enabledTypes[key] = True
        self.getUpdates()

        lookingGlassProxy.connect("LogUpdate", self.getUpdates)
        lookingGlassProxy.addStatusChangeCallback(self.onStatusChange)

    def append(self, category, time, message):
        entry = LogEntry(category, time, message)
        self.log.append(entry)
        return entry

    def onButtonToggled(self, button, data):
        self.textview.hide()
        active = button.get_active()
        self.enabledTypes[data] = active
        self.typeTags[data].props.invisible = active != True

        self.textbuffer.set_modified(True)
        #print self.textview.get_preferred_height()
        adj = self.get_vadjustment()
        #adj.set_upper(self.textview.get_allocated_height())
        self.textview.show()

    def onStatusChange(self, online):
        iter = self.textbuffer.get_end_iter()
        if online:
            entry = self.append("info", 0, "================ DBus connection established ===============")
        else:
            entry = self.append("warning", 0, "================ DBus connection lost ===============")
        self.textbuffer.insert_with_tags(iter, entry.formattedText, self.typeTags[entry.category])
        self.getUpdates()

    def getUpdates(self):
        success, data = lookingGlassProxy.GetErrorStack()
        if success:
            try:
                dataSize = len(data)
                if dataSize > 0:
                    # If this is a completely new log, start reading at the beginning
                    firstMessageTime = data[0]["timestamp"]
                    if self.addedMessages > dataSize or self.firstMessageTime != firstMessageTime:
                        self.firstMessageTime = firstMessageTime
                        self.addedMessages = 0

                    self.textview.hide()
                    iter = self.textbuffer.get_end_iter()
                    for item in data[self.addedMessages:]:
                        entry = self.append(item["category"], float(item["timestamp"])*0.001, item["message"])
                        self.textbuffer.insert_with_tags(iter, entry.formattedText, self.typeTags[entry.category])
                        self.addedMessages += 1
                    self.textview.show()
            except Exception as e:
                print e

class ModulePage(WindowAndActionBars):
    def __init__(self):
        self.view = LogView()
        WindowAndActionBars.__init__(self, self.view)

        self.addToggleButton("info", "dialog-information", "Show/Hide Messages tagged as 'info'")
        self.addToggleButton("warning", "dialog-warning", "Show/Hide Messages tagged as 'warning'")
        self.addToggleButton("error", "dialog-error", "Show/Hide Messages tagged as 'error'")
        self.addToggleButton("trace", "dialog-question", "Show/Hide Messages tagged as 'trace'")

    def addToggleButton(self, logType, icon, tooltip):
        button = ImageToggleButton(icon)
        button.connect("toggled", self.view.onButtonToggled, logType)
        button.set_active(self.view.enabledTypes[logType])
        button.set_tooltip_text(tooltip)
        self.addToLeftBar(button, 1)

