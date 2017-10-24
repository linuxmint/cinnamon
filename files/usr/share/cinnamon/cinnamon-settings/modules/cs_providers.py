from ExtensionCore import ManageSpicesPage, DownloadSpicesPage
from SettingsWidgets import SidePage, SettingsStack
from Spices import Spice_Harvester
from gi.repository import GLib

class Module:
    name = "providers"
    category = "prefs"
    comment = _("Manage your Cinnamon search providers")

    def __init__(self, content_box):
        self.window = None
        self.sidePage = ProviderViewSidePage(content_box, self)

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Search Providers module"
            self.sidePage.load(self.window)

    def _setParentRef(self, window):
        self.window = window

class ProviderViewSidePage(SidePage):
    collection_type = "search-provider"

    def __init__(self, content_box, module):
        self.RemoveString = ""
        keywords = _("search, provider, search provider")

        super(ProviderViewSidePage, self).__init__(_("Search Providers"), "cs-providers", keywords, content_box, module=module)

    def load(self, window):
        self.window = window

        self.spices = Spice_Harvester(self.collection_type, self.window)

        self.stack = SettingsStack()
        self.add_widget(self.stack)
        self.stack.expand = True

        manage_extensions_page = ManageExtensionsPage(self, self.spices, window)
        self.stack.add_titled(manage_extensions_page, "installed", _("Manage search providers"))

class ManageExtensionsPage(ManageSpicesPage):
    directories = [("%s/.local/share/cinnamon/search_providers") % GLib.get_home_dir(), "/usr/share/cinnamon/search_providers"]
    collection_type = "search-provider"
    installed_page_title = _("Installed search providers")
    instance_button_text = _("Enable")
    remove_button_text = _("Disable")
    uninstall_button_text = _("Uninstall")
    restore_button_text = _("Disable all")

    def __init__(self, parent, spices, window):
        super(ManageExtensionsPage, self).__init__(parent, self.collection_type, spices, window)
