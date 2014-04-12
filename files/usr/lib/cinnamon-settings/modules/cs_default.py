#!/usr/bin/env python

from SettingsWidgets import *

PREF_MEDIA_AUTORUN_NEVER = "autorun-never"
PREF_MEDIA_AUTORUN_X_CONTENT_START_APP = "autorun-x-content-start-app"
PREF_MEDIA_AUTORUN_X_CONTENT_IGNORE = "autorun-x-content-ignore"
PREF_MEDIA_AUTORUN_X_CONTENT_OPEN_FOLDER = "autorun-x-content-open-folder"

CUSTOM_ITEM_ASK = "cc-item-ask"
CUSTOM_ITEM_DO_NOTHING = "cc-item-do-nothing"
CUSTOM_ITEM_OPEN_FOLDER = "cc-item-open-folder"

MEDIA_HANDLING_SCHEMA = "org.cinnamon.desktop.media-handling"

PREF_CONTENT_TYPE = 0
PREF_GEN_CONTENT_TYPE = 1
PREF_LABEL = 2

DEF_CONTENT_TYPE = 0
DEF_LABEL = 1
DEF_HEADING = 2

preferred_app_defs = [
    # for web, we need to support text/html,
    # application/xhtml+xml and x-scheme-handler/https,
    # hence the "*" pattern
    ( "x-scheme-handler/http",   "x-scheme-handler/http",      _("_Web") ),
    ( "x-scheme-handler/mailto", "x-scheme-handler/mailto",    _("_Mail") ),
    ( "text/plain",              "text",                       _("Text") ), #TODO: Add mnemonic once we are out of M16 release to preserve i18n for now

    # 1st mimetype is to let us find apps
    # 2nd mimetype is to set default handler for (so we handle all of that type, not just a specific format)
    ( "audio/x-vorbis+ogg",      "audio",                    _("M_usic") ),
    ( "video/x-ogm+ogg",         "video",                    _("_Video") ),
    ( "image/jpeg",              "image",                    _("_Photos") )
]

removable_media_defs = [
    ( "x-content/audio-cdda",       _("CD _audio") ,     _("Select an application for audio CDs")),
    ( "x-content/video-dvd",        _("_DVD video"),     _("Select an application for video DVDs") ),
    ( "x-content/audio-player",     _("_Music player"),  _("Select an application to run when a music player is connected") ),
    ( "x-content/image-dcf",        _("_Photos"),        _("Select an application to run when a camera is connected") ),
    ( "x-content/unix-software",    _("_Software"),      _("Select an application for software CDs") )
]

other_defs = [
    # translators: these strings are duplicates of shared-mime-info
    # strings, just here to fix capitalization of the English originals.
    # If the shared-mime-info translation works for your language,
    # simply leave these untranslated.
    ( "x-content/audio-dvd",        _("audio DVD") ),
    ( "x-content/blank-bd",         _("blank Blu-ray disc") ),
    ( "x-content/blank-cd",         _("blank CD disc") ),
    ( "x-content/blank-dvd",        _("blank DVD disc") ),
    ( "x-content/blank-hddvd",      _("blank HD DVD disc") ),
    ( "x-content/video-bluray",     _("Blu-ray video disc") ),
    ( "x-content/ebook-reader",     _("e-book reader") ),
    ( "x-content/video-hddvd",      _("HD DVD video disc") ),
    ( "x-content/image-picturecd",  _("Picture CD") ),
    ( "x-content/video-svcd",       _("Super Video CD") ),
    ( "x-content/video-vcd",        _("Video CD") ),
    ( "x-content/win32-software",   _("Windows software") ),
    ( "x-content/software",         _("Software") )
]

class ColumnBox(Gtk.VBox):
    def __init__(self, title, content):
        super(ColumnBox, self).__init__()
        
        label = Gtk.Label.new("")
        label.set_markup('<b>%s\n</b>' % title)
        label.set_alignment(0.5, 0.5)
        
        self.set_homogeneous(False)
        self.pack_start(label, False, False, 6)
        self.pack_end(content, True, True, 0)

class ButtonTable(Gtk.Table):
    def __init__(self, lines):
        super(ButtonTable, self).__init__(n_rows = lines, n_columns = 2, homogeneous = False)
        self.set_row_spacings(8)
        self.set_col_spacings(15)
        self.attach(Gtk.Label.new(""), 2, 3, 0, lines, Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL, 0, 0, 0)
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
        super(MnemonicLabel, self).__init__(label = "")
        self.set_text_with_mnemonic(text)
        
        self.set_alignment(1, 0.5)
        self.get_style_context().add_class("dim-label")
        self.set_mnemonic_widget(widget)

class DefaultAppChooserButton(Gtk.AppChooserButton):
    def __init__(self, content_type, gen_content_type):
        super(DefaultAppChooserButton, self).__init__(content_type=content_type)
        self.content_type = content_type
        self.generic_content_type = gen_content_type
        self.set_show_default_item(True)
        self.connect("changed", self.onChanged)

    def onChanged(self, button):
        info = button.get_app_info()
        if info:
            types = info.get_supported_types()
            for t in types:
                if self.generic_content_type in t:
                    if not info.set_as_default_for_type(t):
                        print "Failed to set '%s' as the default application for '%s'" % (info.get_name(), self.generic_content_type)
            if self.content_type == "x-scheme-handler/http":
                if info.set_as_default_for_type ("x-scheme-handler/https") == False:
                    print "Failed to set '%s' as the default application for '%s'" % (info.get_name(), "x-scheme-handler/https")

class CustomAppChooserButton(Gtk.AppChooserButton):
    def __init__(self, media_settings, content_type, heading=None):
        super(CustomAppChooserButton, self).__init__(content_type=content_type)
        self.media_settings = media_settings
        content_type = self.get_content_type()

        #fetch preferences for this content type
        (pref_start_app, pref_ignore, pref_open_folder) = self.getPreferences()
        pref_ask = not pref_start_app and not pref_ignore and not pref_open_folder

        info = self.get_app_info()

        #append the separator only if we have >= 1 apps in the chooser
        if info:
            self.append_separator()

        icon = Gio.ThemedIcon.new("gtk-dialog-question")
        self.append_custom_item(CUSTOM_ITEM_ASK, _("Ask what to do"), icon)
        icon = Gio.ThemedIcon.new("gtk-directory")
        self.append_custom_item(CUSTOM_ITEM_OPEN_FOLDER, _("Open folder"), icon)
        icon = Gio.ThemedIcon.new("gtk-cancel")
        self.append_custom_item(CUSTOM_ITEM_DO_NOTHING, _("Do nothing"), icon)

        self.set_show_dialog_item(True)
        self.set_heading(heading)

        if pref_ask:
            self.set_active_custom_item(CUSTOM_ITEM_ASK)
        elif pref_ignore:
            self.set_active_custom_item(CUSTOM_ITEM_DO_NOTHING)
        elif pref_open_folder:
            self.set_active_custom_item(CUSTOM_ITEM_OPEN_FOLDER)

        self.connect("changed", self.onChanged)
        self.connect("custom-item-activated", self.onCustomItemActivated)
        
    def onChanged(self, button):
        info = self.get_app_info()
        if info:
            content_type = self.get_content_type()
            self.setPreferences(True, False, False)
            info.set_as_default_for_type(content_type)

    def onCustomItemActivated(self, button, item):
        content_type = self.get_content_type()

        if item == CUSTOM_ITEM_ASK:
            self.setPreferences(False, False, False)
        elif item == CUSTOM_ITEM_OPEN_FOLDER:
            self.setPreferences(False, False, True)
        elif item == CUSTOM_ITEM_DO_NOTHING:
            self.setPreferences(False, True, False)
    
    def getPreference(self, settings_key):
        strv = self.media_settings.get_strv(settings_key)
        return strv != None and self.get_content_type() in strv
        
    def getPreferences(self):
        pref_start_app = self.getPreference( PREF_MEDIA_AUTORUN_X_CONTENT_START_APP)
        pref_ignore = self.getPreference(PREF_MEDIA_AUTORUN_X_CONTENT_IGNORE)
        pref_open_folder = self.getPreference(PREF_MEDIA_AUTORUN_X_CONTENT_OPEN_FOLDER)

        return (pref_start_app, pref_ignore, pref_open_folder)
        
    def setPreference(self, pref_value, settings_key):
        array = self.media_settings.get_strv(settings_key)
        content_type = self.get_content_type()
        array = [ v for v in array if v != content_type ]
        if pref_value:
            array.append(content_type)
        self.media_settings.set_strv(settings_key, array)
        
    def setPreferences(self, pref_start_app, pref_ignore, pref_open_folder):
        self.setPreference(pref_start_app, PREF_MEDIA_AUTORUN_X_CONTENT_START_APP)
        self.setPreference(pref_ignore, PREF_MEDIA_AUTORUN_X_CONTENT_IGNORE)
        self.setPreference(pref_open_folder, PREF_MEDIA_AUTORUN_X_CONTENT_OPEN_FOLDER)

class OtherTypeDialog(Gtk.Dialog):
    def __init__(self, media_settings):
        super(OtherTypeDialog, self).__init__(title = _("Other Media"),
                                              transient_for = None,
                                              flags = 0)
        self.add_button(_("Close"), Gtk.ResponseType.OK)

        self.set_default_size(350, 100)
        
        self.media_settings = media_settings
        
        list_store = Gtk.ListStore(str, str)
        list_store.set_sort_column_id (1, Gtk.SortType.ASCENDING)
        self.type_combo = Gtk.ComboBox.new_with_model(list_store)
        self.application_combo = None
                
        content_types = Gio.content_types_get_registered()
        for content_type in content_types:
            if self.acceptContentType(content_type):
                list_store.append([self.getDescription(content_type), content_type])

        renderer = Gtk.CellRendererText()
        self.type_combo.pack_start(renderer, True)
        self.type_combo.add_attribute (renderer,"text", 0)

        self.type_combo.set_active(False)
        
        table = ButtonTable(2)
        table.addRow(_("_Type:"), self.type_combo)
        self.table = table
        
        self.vbox.pack_start(ColumnBox(_("Select how other media should be handled"), table), True, True, 6)
        
        self.vbox.show()

        self.type_combo.connect("changed", self.onTypeComboChanged)
              
    def acceptContentType(self, content_type):
        if not content_type.startswith("x-content/"):
            return False
        for d in removable_media_defs:
            if Gio.content_type_is_a(content_type, d[DEF_CONTENT_TYPE]):
                return False
        return True
        
    def getDescription(self, content_type):
        for d in other_defs:
            if content_type == d[DEF_CONTENT_TYPE]:
                s = d[DEF_LABEL]
                if s == _(s):
                    description = Gio.content_type_get_description(content_type)
                else:
                    description = s
                break

        if description == None:
            print "Content type '%s' is missing from the info panel" % content_type
            return Gio.content_type_get_description(content_type)
            
        return description
        
    def doShow(self, topLevel):
        self.set_transient_for(topLevel)
        self.set_modal(True)
        self.connect("response", self.onResponse)
        self.connect("delete-event", self.onDelete)
        self.onTypeComboChanged(self.type_combo)
        self.present()
        self.show_all()
    
    def onDelete(self, *args):
        return self.hide_on_delete()
        
    def doHide(self):
        self.hide()
        if self.application_combo != None:
            self.application_combo.destroy()
            self.application_combo = None
            self.table.forgetRow()

    def onResponse(self, dialog, response):
        self.doHide()
            
    def onTypeComboChanged(self, type_combo):
        iter = type_combo.get_active_iter()
        if not iter:
            return

        model = type_combo.get_model()
        if not model:
            return

        x_content_type = model.get_value(iter, 1)
        heading = model.get_value(iter, 0)

        action_container = Gtk.HBox()
        if self.application_combo != None:
            self.application_combo.destroy()
            self.table.forgetRow()

        self.application_combo = CustomAppChooserButton(self.media_settings, x_content_type, heading)
        self.application_combo.show()

        self.table.addRow(_("_Action:"), self.application_combo)

class Module:
    def __init__(self, content_box):
        keywords = _("media, defaults, applications, programs, removable, browser, email, calendar, music, videos, photos, images, cd, autostart, autoplay")
        sidePage = SidePage(_("Preferred Applications"), "cs-default-applications", keywords, content_box, 330, module=self)
        self.sidePage = sidePage
        self.name = "default"
        self.category = "prefs"

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Default module"

            self.tabs = []
            self.notebook = Gtk.Notebook()
            self.viewbox1 = Gtk.VBox()
            self.viewbox2 = Gtk.VBox()
            
            default = Gtk.ScrolledWindow()
            default.add_with_viewport(self.viewbox1)
            
            media = Gtk.ScrolledWindow()
            media.add_with_viewport(self.viewbox2)
            
            self.notebook.append_page(default, Gtk.Label.new(_("Preferred Applications")))
            self.notebook.append_page(media, Gtk.Label.new(_("Removable Media")))

            widget = self.setupDefaultApps()
            self.viewbox1.pack_start(widget, False, False, 2)

            widget = self.setupMedia()
            self.viewbox2.pack_start(widget, False, False, 2)                        

            self.notebook.expand = True
            self.sidePage.add_widget(self.notebook)
            

    def setupDefaultApps(self):
        table = ButtonTable(len(preferred_app_defs))
        term_entryd = GSettingsEntry("", "org.cinnamon.desktop.default-applications.terminal", "exec", None)
        
        for d in preferred_app_defs:
            table.addRow(d[PREF_LABEL], DefaultAppChooserButton(d[PREF_CONTENT_TYPE], d[PREF_GEN_CONTENT_TYPE]))
        #TODO: Add a combobox selector (2.4?)
        table.addRow(_("Terminal"), term_entryd)

        return ColumnBox(_("Select preferred applications for file types"), table)

    def onMoreClicked(self, button):
        self.other_type_dialog.doShow(button.get_toplevel())

    def setupMedia(self):
        self.media_settings = Gio.Settings.new(MEDIA_HANDLING_SCHEMA)
        
        self.other_type_dialog = OtherTypeDialog(self.media_settings)
        
        hbox = Gtk.VBox()
        hbox.set_border_width(6)
        hboxToggle = Gtk.VBox()        
        hbox.add(hboxToggle)

        table = ButtonTable(len(removable_media_defs)+1)
        hboxToggle.add(table)
        
        for d in removable_media_defs:
            table.addRow(d[DEF_LABEL], CustomAppChooserButton(self.media_settings, d[DEF_CONTENT_TYPE], d[DEF_HEADING]))

        more = Gtk.Button.new_with_mnemonic(_("_Other Media..."))
        more.connect("clicked", self.onMoreClicked)
        table.addRow(None, more)

        never = Gtk.CheckButton.new_with_mnemonic(_("_Never prompt or start programs on media insertion"))
        hbox.pack_start(never, False, False, 2)
        self.media_settings.bind(PREF_MEDIA_AUTORUN_NEVER, never, "active", Gio.SettingsBindFlags.DEFAULT)
        self.media_settings.bind(PREF_MEDIA_AUTORUN_NEVER, hboxToggle, "sensitive", Gio.SettingsBindFlags.INVERT_BOOLEAN)

        return ColumnBox(_("Select how media should be handled"), hbox)
