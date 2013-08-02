#!/usr/bin/env python

from SettingsWidgets import *

DEF_CONTENT_TYPE = 0
DEF_LABEL = 1
DEF_HEADING = 2
        
preferred_app_defs = [
    # for web, we need to support text/html,
    # application/xhtml+xml and x-scheme-handler/https,
    # hence the "*" pattern
    ( "x-scheme-handler/http",      _("_Web") ),
    ( "x-scheme-handler/mailto",    _("_Mail") ),
    ( "text/calendar",              _("_Calendar") ),
    ( "audio/x-vorbis+ogg",         _("M_usic") ),
    ( "video/x-ogm+ogg",            _("_Video") ),
    ( "image/jpeg",                 _("_Photos") )
]

class ColumnBox(Gtk.VBox):
    def __init__(self, title, content):
        super(ColumnBox, self).__init__()
        
        label = Gtk.Label("")
        label.set_markup('<b>%s\n</b>' % title)
        label.set_alignment(0.5, 0.5)
        
        self.set_homogeneous(False)
        self.pack_start(label, False, False, 0)
        self.pack_end(content, True, True, 0)

class ButtonTable(Gtk.Table):
    def __init__(self, lines):
        super(ButtonTable, self).__init__(lines, 2, False)
        self.set_row_spacings(8)
        self.set_col_spacings(15)
        self.attach(Gtk.Label(""), 2, 3, 0, lines, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 0, 0)
        self.row = 0
        
    def addRow(self, label, button):
        if label:
            label = MnemonicLabel(label, button)
            self.attach(label, 0, 1, self.row, self.row+1, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 0, 0)
        self.attach(button, 1, 2, self.row, self.row+1, Gtk.AttachOptions.FILL, 0, 0, 0)
        self.row += 1
        
    def forgetRow(self):
        self.row -= 1
    
class MnemonicLabel(Gtk.Label):
    def __init__(self, text, widget):
        super(MnemonicLabel, self).__init__("")
        self.set_text_with_mnemonic(text)
        
        self.set_alignment(1, 0.5)
        self.get_style_context().add_class("dim-label")
        self.set_mnemonic_widget(widget)

class DefaultAppChooserButton(Gtk.AppChooserButton):
    def __init__(self, content_type):
        super(DefaultAppChooserButton, self).__init__(content_type=content_type)
        self.content_type = content_type

        self.connect("changed", self.onChanged)
        self.set_show_default_item(True)
        
    def onChanged(self, button):
        info = button.get_app_info()
        if info:
            if not info.set_as_default_for_type(self.content_type):
                print "Failed to set '%s' as the default application for '%s'" % (info.get_name(), self.content_type)

            if self.content_type == "x-scheme-handler/http":
                if info.set_as_default_for_type ("x-scheme-handler/https") == False:
                    print "Failed to set '%s' as the default application for '%s'" % (info.get_name(), "x-scheme-handler/https")
        
class Module:
    def __init__(self, content_box):
        keywords = _("defaults, applications, programs, browser, email, calendar, music, videos, photos, images")
        advanced = False
        sidePage = SidePage(_("Default Applications"), "default-applications.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "default"
        self.category = "prefs"

        hbox = Gtk.HBox()
        hbox.set_homogeneous(True)
        sidePage.add_widget(hbox, False)
        hbox.pack_start(self.setupDefaultApps(), False, False, 0)

    def setupDefaultApps(self):
        table = ButtonTable(len(preferred_app_defs))
        
        for d in preferred_app_defs:
            table.addRow(d[DEF_LABEL], DefaultAppChooserButton(d[DEF_CONTENT_TYPE]))
        
        return ColumnBox(_("Default Applications"), table)


