#!/usr/bin/env python

import sys
try:
    sys.path.append('/usr/lib/cinnamon-menu-editor')
except Exception, detail:
    print detail

from SettingsWidgets import *
from cme import util
from cme.MainWindow import MainWindow
from cme.MenuEditor import MenuEditor

try:
    from cme import config
    datadir = config.pkgdatadir
    version = config.VERSION
except:
    datadir = '.'
    version = '0.9'

gettext.bindtextdomain(config.GETTEXT_PACKAGE, config.localedir)
gettext.textdomain(config.GETTEXT_PACKAGE)
_ = gettext.gettext

class Module:
    def __init__(self, content_box):
        keywords = _("menu, desktop, alacarte")
        advanced = False
        sidePage = SidePage(_("Menu Editor"), "menu.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "menu"
        self.category = "prefs"

        iconHbox = Gtk.HBox()
        #iconHbox.pack_start(GSettingsFileChooser(_("Icon"), "org.cinnamon", "menu-icon", None, True), False, False, 0)
        #iconHbox.pack_start(GSettingsEntry(_("Text"), "org.cinnamon", "menu-text", None), False, False, 20)
        #sidePage.add_widget(iconHbox)
                
        #sidePage.add_widget(GSettingsCheckButton(_("Show bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        #sidePage.add_widget(GSettingsCheckButton(_("Show recent files"), "org.cinnamon", "menu-show-recent", None))
        #sidePage.add_widget(GSettingsCheckButton(_("Enable auto-scrolling in application list"), "org.cinnamon", "menu-enable-autoscroll", None))
                
        #sidePage.add_widget(GSettingsCheckButton(_("Open menu when I move my mouse over it"), "org.cinnamon", "activate-menu-applet-on-hover", None), True)
        #sidePage.add_widget(GSettingsCheckButton(_("Enable filesystem path entry in search box"), "org.cinnamon", "menu-search-filesystem", None), True)
        #sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")), True)
    
        mew = MenuEditorWidget(datadir, version)
        self.sidePage.add_widget(mew.vbox, True)
        mew.vbox.show_all()

class MenuEditorWidget(MainWindow):

    def __init__(self, datadir, version):
        self.file_path = datadir
        self.version = version
        self.editor = MenuEditor()
        self.editor.tree.connect("changed", self.menuChanged)

        self.tree = Gtk.Builder()
        self.tree.set_translation_domain(config.GETTEXT_PACKAGE)
        self.tree.add_from_file('/usr/lib/cinnamon-menu-editor/cinnamon-menu-editor1.ui')
        self.tree.connect_signals(self)

        self.setupMenuTree()
        self.setupItemTree()

        self.tree.get_object('edit_delete').set_sensitive(False)
        self.tree.get_object('edit_properties').set_sensitive(False)
        self.tree.get_object('edit_cut').set_sensitive(False)
        self.tree.get_object('edit_copy').set_sensitive(False)
        self.tree.get_object('edit_paste').set_sensitive(False)
        self.tree.get_object('move_up_button').set_sensitive(False)
        self.tree.get_object('move_down_button').set_sensitive(False)
        self.cut_copy_buffer = None
        self.file_id = None
        self.last_tree = None

        self.vbox = self.tree.get_object('mainbox')
        self.run()

    def run(self):
        self.loadMenus()
