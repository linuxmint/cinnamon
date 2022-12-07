#!/usr/bin/python3

import sys
from ExtensionCore import ManageSpicesPage, DownloadSpicesPage
from SettingsWidgets import SidePage
from xapp.SettingsWidgets import SettingsStack
from Spices import Spice_Harvester
from gi.repository import GLib, Gtk, Gdk

class Module:
    name = "applets"
    comment = _("Manage Cinnamon applets")
    category = "prefs"

    def __init__(self, content_box):
        self.window = None
        self.sidePage = AppletsViewSidePage(content_box, self)

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Applets module")
            self.sidePage.load(self.window)

    def _setParentRef(self, window):
        self.window = window

class AppletsViewSidePage(SidePage):
    collection_type = "applet"

    def __init__(self, content_box, module):
        self.RemoveString = _("You can remove specific instances in panel edit mode via the context menu.")

        super(AppletsViewSidePage, self).__init__(_("Applets"), "cs-applets", _("applet"), content_box, module=module)

    def load(self, window):
        self.window = window

        self.spices = Spice_Harvester(self.collection_type, self.window)

        self.stack = SettingsStack()
        self.add_widget(self.stack)
        self.stack.expand = True

        manage_extensions_page = ManageAppletsPage(self, self.spices, window)
        self.stack.add_titled(manage_extensions_page, "installed", _("Manage"))

        download_applets_page = DownloadSpicesPage(self, self.collection_type, self.spices, window)
        self.stack.add_titled(download_applets_page, "more", _("Download"))

class ManageAppletsPage(ManageSpicesPage):
    directories = ["%s/.local/share/cinnamon/applets" % GLib.get_home_dir(), "/usr/share/cinnamon/applets"]
    collection_type = "applet"
    installed_page_title = _("Installed applets")
    instance_button_text = _("Add")
    remove_button_text = _("Remove")
    uninstall_button_text = _("Uninstall")
    restore_button_text = _("Reset all")

    def __init__(self, parent, spices, window):
        super(ManageAppletsPage, self).__init__(parent, self.collection_type, spices, window)

        self.panels = []
        self.current_panel_index = 0
        if len(sys.argv) > 1 and sys.argv[1][0:5] == "panel":
            self.panel_id = int(sys.argv[1][5:])
        else:
            self.panel_id = int(self.spices.settings.get_strv("panels-enabled")[0].split(":")[0])

        self.panel_select_buttons = Gtk.Box()
        self.panel_select_buttons.get_style_context().add_class("linked")
        self.previous_button = Gtk.Button(label=_("Previous Panel"))
        self.previous_button.set_no_show_all(True)
        self.previous_button.connect("clicked", self.previous_panel)
        self.panel_select_buttons.add(self.previous_button)
        self.next_button = Gtk.Button(label=_("Next Panel"))
        self.next_button.set_no_show_all(True)
        self.next_button.connect("clicked", self.next_panel)
        self.panel_select_buttons.add(self.next_button)
        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        size_group.add_widget(self.previous_button)
        size_group.add_widget(self.next_button)

        self.connect("map", self.restore_highlight)
        self.connect("unmap", self.remove_highlight)
        self.connect("destroy", self.remove_highlight)
        self.spices.settings.connect('changed::panels-enabled', self.panels_changed)
        self.panels_changed()

        self.top_box.pack_start(self.panel_select_buttons, False, False, 0)

    def previous_panel(self, *args):
        self.spices.send_proxy_signal('highlightPanel', '(ib)', self.panel_id, False)

        if self.current_panel_index - 1 >= 0:
            self.current_panel_index -= 1
        else:
            self.current_panel_index = len(self.panels) - 1
        self.panel_id = int(self.panels[self.current_panel_index].split(":")[0])

        self.spices.send_proxy_signal('highlightPanel', '(ib)', self.panel_id, True)

    def next_panel(self, widget):
        self.spices.send_proxy_signal('highlightPanel', '(ib)', self.panel_id, False)

        if self.current_panel_index + 1 < len(self.panels):
            self.current_panel_index += 1
        else:
            self.current_panel_index = 0
        self.panel_id = int(self.panels[self.current_panel_index].split(":")[0])

        self.spices.send_proxy_signal('highlightPanel', '(ib)', self.panel_id, True)

    def panels_changed(self, *args):
        self.panels = []
        n_mons = Gdk.Screen.get_default().get_n_monitors()

        # we only want to select panels that are on a connected screen
        current_panel_exists = False
        for panel in self.spices.settings.get_strv('panels-enabled'):
            panel_id, monitor, pos = panel.split(":")
            if int(monitor) < n_mons:
                if int(panel_id) == self.panel_id:
                    self.current_panel_index = len(self.panels)
                    current_panel_exists = True
                self.panels.append(panel)

        if not current_panel_exists:
            # looks like the currently selected panel was removed. We'll just select the first one
            self.current_panel_index = 0
            self.panel_id = int(self.panels[self.current_panel_index].split(":")[0])

        if len(self.panels) > 1:
            self.previous_button.show()
            self.next_button.show()
            # just in case, we'll make sure the current panel is highlighted
            self.restore_highlight()
        else:
            self.previous_button.hide()
            self.next_button.hide()
            # there's no point in highlighting if there's only one panel
            if current_panel_exists:
                self.remove_highlight()

    def remove_highlight(self, *args):
        self.spices.send_proxy_signal('highlightPanel', '(ib)', self.panel_id, False)

    def restore_highlight(self, *args):
        # there's no point in highlighting if there's only one panel
        if len(self.panels) > 1:
            self.spices.send_proxy_signal('highlightPanel', '(ib)', self.panel_id, True)

    def enable(self, uuid):
        self.spices.enable_extension(uuid, panel=self.panel_id)
