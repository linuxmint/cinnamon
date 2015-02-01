#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import GObject, Notify

content = """
Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
Suspendisse eleifend, lacus ut tempor vehicula, lorem tortor \
suscipit libero, sit amet congue odio libero vitae lacus. \
Sed est nibh, lacinia ac magna non, blandit aliquet est. \
Mauris volutpat est vel lacinia faucibus. Pellentesque \
pulvinar eros at dolor pretium, eget hendrerit leo rhoncus. \
Sed nisl leo, posuere eget risus vel, euismod egestas metus. \
Praesent interdum, dui sit amet convallis rutrum, velit nunc \
sollicitudin erat, ac viverra leo eros in nulla. Morbi feugiat \
feugiat est. Nam non libero dolor. Duis egestas sodales massa \
sit amet lobortis. Donec sit amet nisi turpis. Morbi aliquet \
aliquam ullamcorper. 
"""

class Module:
    def __init__(self, content_box):
        keywords = _("notifications")
        sidePage = SidePage(_("Notifications"), "cs-notifications", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "notifications"
        self.comment = _("Notification preferences")
        self.category = "prefs"

    def on_module_selected(self):
        if self.loaded:
            return

        print "Loading notifications module"

        Notify.init("cinnamon-settings-notifications-test")

        bg = SectionBg()
        self.sidePage.add_widget(bg)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        bg.add(vbox)
            
        section = Section(_("Behaviour"))
        section.add(GSettingsCheckButton(_("Display notifications"), "org.cinnamon.desktop.notifications", "display-notifications", None))
        section.add(GSettingsCheckButton(_("Remove notifications after their timeout is reached"), "org.cinnamon.desktop.notifications", "remove-old", None))
        box = Gtk.HBox()
        box.pack_start(GSettingsSpinButton(_("Notification timeout"), "org.cinnamon.desktop.notifications", "timeout-time", None, 0, 3600000, 100, 100, _("ms")), False, False, 20)
        section.add_indented(box)
        box = Gtk.HBox()
        box.pack_start(GSettingsSpinButton(_("Critical notification timeout"), "org.cinnamon.desktop.notifications", "critical-timeout-time", None, 0, 3600000, 100, 100, _("ms")), False, False, 20)
        section.add_indented(box)
        vbox.add(section)
        
        vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)) 
        
        section = Section(_("Appearance"))

        section.add(GSettingsCheckButton(_("Have notifications fade out when hovered over"), "org.cinnamon.desktop.notifications", "fade-on-mouseover", None))
        box = Gtk.HBox()
        spinner = GSettingsSpinButton(_("Hover opacity"), "org.cinnamon.desktop.notifications", "fade-opacity", "org.cinnamon.desktop.notifications/fade-on-mouseover", 0, 100, 1, 1, _("%"))
        box.pack_start(spinner, False, False, 20)
        section.add_indented(box)
        
        vbox.add(section)
        
        vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        vbox.add(Gtk.Label(""))
        box = Gtk.HBox()
        button = Gtk.Button(label = _("Display a test notification"))
        button.connect("clicked", self.send_test)
        box.pack_start(button, True, True, 46)
        
        vbox.add(box)
    

    def send_test(self, widget):
        n = Notify.Notification.new("This is a test notification", content, "dialog-warning")
        n.show()
