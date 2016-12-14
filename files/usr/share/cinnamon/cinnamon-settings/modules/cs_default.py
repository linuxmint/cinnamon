#!/usr/bin/python2

from GSettingsWidgets import *
from gi.repository import *

PREF_MEDIA_AUTORUN_NEVER = "autorun-never"
PREF_MEDIA_AUTORUN_X_CONTENT_START_APP = "autorun-x-content-start-app"
PREF_MEDIA_AUTORUN_X_CONTENT_IGNORE = "autorun-x-content-ignore"
PREF_MEDIA_AUTORUN_X_CONTENT_OPEN_FOLDER = "autorun-x-content-open-folder"

CUSTOM_ITEM_ASK = "cc-item-ask"
CUSTOM_ITEM_DO_NOTHING = "cc-item-do-nothing"
CUSTOM_ITEM_OPEN_FOLDER = "cc-item-open-folder"

MEDIA_HANDLING_SCHEMA = "org.cinnamon.desktop.media-handling"
TERMINAL_SCHEMA = "org.cinnamon.desktop.default-applications.terminal"

PREF_CONTENT_TYPE = 0
PREF_GEN_CONTENT_TYPE = 1
PREF_LABEL = 2

DEF_CONTENT_TYPE = 0
DEF_LABEL = 1
DEF_HEADING = 2

preferred_app_defs = [
    # 1st mimetype is to let us find apps
    # 2nd mimetype is to set default handler for (so we handle all of that type, not just a specific format)
    ( "x-scheme-handler/http",   "x-scheme-handler/http",      _("_Web") ),
    ( "x-scheme-handler/mailto", "x-scheme-handler/mailto",    _("_Mail") ),
    ( "application/msword",      "application/msword",       _("Documents") ),
    ( "text/plain",              "text/plain",               _("Plain Text") ),
    ( "audio/x-vorbis+ogg",      "audio",                    _("M_usic") ),
    ( "video/x-ogm+ogg",         "video",                    _("_Video") ),
    ( "image/jpeg",              "image",                    _("_Photos") ),
    ( "text/x-python",           "text/x-python",          _("Source Code") ),
]

mimetypes = {}
mimetypes["audio"]=[
  "audio/3gpp",
  "audio/aac",
  "audio/ac3",
  "audio/flac",
  "audio/m4a",
  "audio/midi",
  "audio/mp3",
  "audio/mp4",
  "audio/mp4a-latm",
  "audio/mpeg",
  "audio/mpeg3",
  "audio/mpg",
  "audio/ogg",
  "audio/vorbis",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-aac",
  "audio/x-aiff",
  "audio/x-flac",
  "audio/x-mp3",
  "audio/x-mpeg",
  "audio/x-mpeg-3",
  "audio/x-mpg",
  "audio/x-ms-asf",
  "audio/x-ms-wma",
  "audio/x-ogg",
  "audio/x-oggflac",
  "audio/x-vorbis",
  "audio/x-vorbis+ogg",
  "audio/x-wav",
  "audio/x-wavpack"
]

mimetypes["video"]=[
  "video/3gp",
  "video/3gpp",
  "video/divx",
  "video/flv",
  "video/mp4",
  "video/mp4v-es",
  "video/mpeg",
  "video/msvideo",
  "video/ogg",
  "video/quicktime",
  "video/vivo",
  "video/vnd.divx",
  "video/vnd.rn-realvideo",
  "video/webm",
  "video/x-anim",
  "video/x-avi",
  "video/x-flc",
  "video/x-fli",
  "video/x-flic",
  "video/x-flv",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-mng",
  "video/x-mpeg",
  "video/x-mpeg2",
  "video/x-ms-afs",
  "video/x-ms-asf",
  "video/x-ms-asx",
  "video/x-ms-wm",
  "video/x-ms-wmv",
  "video/x-ms-wvx",
  "video/x-ms-wvxvideo",
  "video/x-msvideo",
  "video/x-nsv",
  "video/x-ogm+ogg",
  "video/x-theora",
  "video/x-theora+ogg"
]

mimetypes["text/x-python"] = [
    'text/x-chdr', 'text/x-csrc', 'text/x-c++hdr', 'text/x-c++src', 'text/x-java',
    'text/x-dsrc', 'text/x-pascal', 'text/x-perl', 'text/x-python', 'application/x-php',
    'application/x-httpd-php3', 'application/x-httpd-php4', 'application/x-httpd-php5',
    'application/xml', 'text/x-sql', 'text/x-diff', 'application/x-ruby',
    'application/x-shellscript', 'application/javascript', 'text/x-makefile', 'text/css',
    'text/turtle', 'text/x-fortran', 'text/yaml', 'application/x-m4', 'text/x-vb', 'text/x-csharp'
]

mimetypes["application/msword"] = [
    'application/msword', 'application/vnd.oasis.opendocument.text',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text-template', 'application/rtf',
    'application/vnd.stardivision.writer', 'application/vnd.wordperfect',
    'application/vnd.ms-works', 'application/x-abiword',
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
        self.set_mnemonic_widget(widget)

class DefaultAppChooserButton(Gtk.AppChooserButton):
    def __init__(self, content_type, gen_content_type):
        super(DefaultAppChooserButton, self).__init__(content_type=content_type)
        self.content_type = content_type
        self.generic_content_type = gen_content_type
        self.set_show_default_item(True)
        self.set_show_dialog_item(True)
        self.connect("changed", self.onChanged)

    def onChanged(self, button):
        info = button.get_app_info()
        print "%s: " % info.get_name()
        if info:
            supported_mimetypes = info.get_supported_types()
            hardcoded_mimetypes = None
            if self.generic_content_type in mimetypes.keys():
                hardcoded_mimetypes = mimetypes[self.generic_content_type]

            set_mimes = []

            # Assign mimes which the app officially supports
            if supported_mimetypes is not None:
                for t in sorted(supported_mimetypes):
                    if t.startswith(self.generic_content_type):
                        if info.set_as_default_for_type (t):
                            print "  Set as default for supported %s" % t
                            set_mimes.append(t)
                        else:
                            print "  Failed to set as default application for '%s'" % t

            # Also assign mimes hardcoded in the mimetypes hashtable
            if hardcoded_mimetypes is not None:
                for t in sorted(hardcoded_mimetypes):
                    if t not in set_mimes:
                        if info.set_as_default_for_type (t):
                            print "  Set as default for hardcoded %s" % t
                        else:
                            print "  Failed to set as default application for '%s'" % t

            #Web
            if self.content_type == "x-scheme-handler/http":
                if info.set_as_default_for_type ("x-scheme-handler/https") == False:
                    print "  Failed to set '%s' as the default application for '%s'" % (info.get_name(), "x-scheme-handler/https")

class DefaultTerminalButton(Gtk.AppChooserButton): #TODO: See if we can get this to change the x-terminal-emulator default to allow it to be a more global change rather then just cinnamon/nemo
    def __init__(self):
        super(DefaultTerminalButton, self).__init__()
        self.connect("changed", self.onChanged)

        apps = Gio.app_info_get_all()
        self.this_item = []
        self.active_items = []
        self.settings = Gio.Settings.new(TERMINAL_SCHEMA)
        self.key_value = self.settings.get_string("exec")
        count_up = 0

        while (self.this_item is not None and count_up < len(apps)):
            self.this_item = apps[count_up]
            cat_val = Gio.DesktopAppInfo.get_categories(self.this_item)
            exec_val = Gio.DesktopAppInfo.get_string(self.this_item, "Exec")
            name_val = Gio.DesktopAppInfo.get_string(self.this_item, "Name")
            icon_val = Gio.DesktopAppInfo.get_string(self.this_item, "Icon")
            #terminals don't have mime types, so we check for "TerminalEmulator" under the "Category" key in desktop files
            if (cat_val is not None and "TerminalEmulator" in cat_val):
                #this crazy if statement makes sure remaining desktop file info is not empty, then prevents root terminals from showing, then prevents repeating terminals from trying to being added which leave a blank space and Gtk-WARNING's
                if (exec_val is not None and name_val is not None and icon_val is not None and not "gksu" in exec_val and exec_val not in self.active_items):
                    self.append_custom_item(exec_val, name_val, Gio.ThemedIcon.new(icon_val))
                    self.active_items.append(exec_val)
                    if (self.key_value == exec_val):
                        self.set_active_custom_item(self.key_value)
            count_up += 1

    def onChanged(self, button):
        index_num = button.get_active()
        command_key = self.active_items[index_num]
        self.settings.set_string("exec", command_key)

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

        icon = Gio.ThemedIcon.new("dialog-question")
        self.append_custom_item(CUSTOM_ITEM_ASK, _("Ask what to do"), icon)
        icon = Gio.ThemedIcon.new("folder")
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
    name = "default"
    category = "prefs"
    comment = _("Preferred Applications")

    def __init__(self, content_box):
        keywords = _("media, defaults, applications, programs, removable, browser, email, calendar, music, videos, photos, images, cd, autostart, autoplay")
        sidePage = SidePage(_("Preferred Applications"), "cs-default-applications", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Default module"

            self.media_settings = Gio.Settings.new(MEDIA_HANDLING_SCHEMA)
            self.other_type_dialog = OtherTypeDialog(self.media_settings)

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Preferred applications

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "preferred", _("Preferred applications"))


            settings = page.add_section(_("Preferred applications"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            for d in preferred_app_defs:
                widget = SettingsWidget()
                button = DefaultAppChooserButton(d[PREF_CONTENT_TYPE], d[PREF_GEN_CONTENT_TYPE])
                label = MnemonicLabel(d[PREF_LABEL], button)
                size_group.add_widget(button)
                widget.pack_start(label, False, False, 0)
                widget.pack_end(button, False, False, 0)
                #Hide button if there are no apps
                if not button.get_active():
                    settings.add_row(widget)

            widget = SettingsWidget()
            button = DefaultTerminalButton()
            label = MnemonicLabel(_("Te_rminal"), button)
            size_group.add_widget(button)
            widget.pack_start(label, False, False, 0)
            widget.pack_end(button, False, False, 0)
            settings.add_row(widget)

            # Removable media

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "removable", _("Removable media"))

            switch = InvertedSwitch("", MEDIA_HANDLING_SCHEMA, PREF_MEDIA_AUTORUN_NEVER)
            switch.label.set_markup("<b>%s</b>" % _("Prompt or start programs on media insertion"))
            switch.fill_row()
            page.add(switch)

            settings = SettingsBox(_("Removable media"))
            switch.revealer.add(settings)
            page.pack_start(switch.revealer, False, False, 0)

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            for d in removable_media_defs:
                widget = SettingsWidget()
                button = CustomAppChooserButton(self.media_settings, d[DEF_CONTENT_TYPE], d[DEF_HEADING])
                label = MnemonicLabel(d[PREF_LABEL], button)
                size_group.add_widget(button)
                widget.pack_start(label, False, False, 0)
                widget.pack_end(button, False, False, 0)
                settings.add_row(widget)

            button = Button(_("_Other Media..."), self.onMoreClicked)
            settings.add_row(button)

    def onMoreClicked(self, widget):
        self.other_type_dialog.doShow(widget.get_toplevel())

class InvertedSwitch(SettingsWidget):
    def __init__(self, label, schema, key):
        self.key = key
        super(InvertedSwitch, self).__init__()

        self.revealer = SettingsRevealer()

        self.content_widget = Gtk.Switch()
        self.content_widget.connect("notify::active", self.on_my_value_changed)
        self.label = Gtk.Label(label)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.settings = Gio.Settings.new(schema)
        self.content_widget.set_active(not (self.settings.get_boolean(self.key)))

    def on_my_value_changed(self, widget, gparam):
        active = widget.get_active()

        self.settings.set_boolean(self.key, not active)
        self.revealer.set_reveal_child(active)
