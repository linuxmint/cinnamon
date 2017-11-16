#!/usr/bin/python2

from ExtensionCore import ManageSpicesPage, DownloadSpicesPage
from SettingsWidgets import SidePage, SettingsStack
from Spices import Spice_Harvester
from gi.repository import GLib

class Module:
    name = "extensions"
    category = "prefs"
    comment = _("Manage your Cinnamon extensions")

    def __init__(self, content_box):
        self.window = None
        self.sidePage = ExtensionViewSidePage(content_box, self)

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Extensions module"
            self.sidePage.load(self.window)

    def _setParentRef(self, window):
        self.window = window

class ExtensionViewSidePage(SidePage):
    collection_type = "extension"

    def __init__(self, content_box, module):
        self.RemoveString = ""
        keywords = _("extension, addon")

        super(ExtensionViewSidePage, self).__init__(_("Extensions"), "cs-extensions", keywords, content_box, module=module)

    def load(self, window):
        self.window = window

        self.spices = Spice_Harvester(self.collection_type, self.window)

        self.stack = SettingsStack()
        self.add_widget(self.stack)
        self.stack.expand = True

        manage_extensions_page = ManageExtensionsPage(self, self.spices, window)
        self.stack.add_titled(manage_extensions_page, "installed", _("Manage"))

        download_extensions_page = DownloadSpicesPage(self, self.collection_type, self.spices, window)
        self.stack.add_titled(download_extensions_page, "more", _("Download"))

class ManageExtensionsPage(ManageSpicesPage):
    directories = ['/usr/share/cinnamon/extensions', ("%s/.local/share/cinnamon/extensions") % GLib.get_home_dir()]
    collection_type = "extension"
    installed_page_title = _("Installed extensions")
    instance_button_text = _("Enable")
    remove_button_text = _("Disable")
    uninstall_button_text = _("Uninstall")
    restore_button_text = _("Disable all")

    def __init__(self, parent, spices, window):
        super(ManageExtensionsPage, self).__init__(parent, self.collection_type, spices, window)
