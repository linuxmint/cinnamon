#!/usr/bin/python3

from ExtensionCore import ManageSpicesPage, DownloadSpicesPage
from Spices import Spice_Harvester
from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *
from gi.repository import GLib, Gtk

class Module:
    comment = _("Manage your Cinnamon desklets")
    name = "desklets"
    category = "prefs"

    def __init__(self, content_box):
        self.window = None
        self.sidePage = DeskletsViewSidePage(content_box, self)

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Desklets module")
            self.sidePage.load(self.window)

    def _setParentRef(self, window):
        self.window = window

class DeskletsViewSidePage(SidePage):
    collection_type = "desklet"

    def __init__(self, content_box, module):
        self.RemoveString = _("You can remove specific instances from the desktop via that desklet's context menu")
        keywords = _("desklet, desktop, slideshow")

        super(DeskletsViewSidePage, self).__init__(_("Desklets"), "cs-desklets", keywords, content_box, module=module)

    def load(self, window):
        self.window = window

        self.spices = Spice_Harvester(self.collection_type, self.window)

        self.stack = SettingsStack()
        self.add_widget(self.stack)
        self.stack.expand = True

        manage_extensions_page = ManageDeskletsPage(self, self.spices, self.window)
        self.stack.add_titled(manage_extensions_page, 'installed', _("Manage"))

        download_desklets_page = DownloadSpicesPage(self, self.collection_type, self.spices, self.window)
        self.stack.add_titled(download_desklets_page, 'more', _("Download"))

        page = SettingsPage()
        self.stack.add_titled(page, 'general', _("General Settings"))

        settings = page.add_section(_("General Desklets Settings"))

        dec = [[0, _("No decoration")], [1, _("Border only")], [2, _("Border and header")]]
        widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        combo_box = GSettingsComboBox(_("Decoration of desklets"), "org.cinnamon", "desklet-decorations", dec, valtype=int)
        widget.pack_start(combo_box, False, False, 0)
        line1 = Gtk.Label()
        line1.set_markup("<i><small>%s</small></i>" % _("Note: Some desklets require the border/header to be always present"))
        line1.get_style_context().add_class("dim-label")
        widget.pack_start(line1, True, True, 0)
        line2 = Gtk.Label()
        line2.set_markup("<i><small>%s</small></i>" % _("Such requirements override the settings selected here"))
        line2.get_style_context().add_class("dim-label")
        widget.pack_start(line2, True, True, 0)
        settings.add_row(widget)

        settings.add_row(GSettingsSwitch(_("Snap desklets to grid"), "org.cinnamon", "desklet-snap"))
        settings.add_reveal_row(GSettingsSpinButton(_("Width of desklet snap grid"), "org.cinnamon", "desklet-snap-interval", "", 0, 100, 1, 5), "org.cinnamon", "desklet-snap")

        settings = page.add_section("")
        settings.add_row(GSettingsSwitch(_("Lock desklets in their current position"), "org.cinnamon", "lock-desklets"))

class ManageDeskletsPage(ManageSpicesPage):
    directories = ["%s/.local/share/cinnamon/desklets" % GLib.get_home_dir(), "/usr/share/cinnamon/desklets"]
    collection_type = "desklet"
    installed_page_title = _("Installed desklets")
    instance_button_text = _("Add")
    remove_button_text = _("Remove")
    uninstall_button_text = _("Uninstall")
    restore_button_text = _("Remove all")

    def __init__(self, parent, spices, window):
        super(ManageDeskletsPage, self).__init__(parent, self.collection_type, spices, window)
