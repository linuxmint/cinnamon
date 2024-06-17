#!/usr/bin/python3

from pathlib import Path
import sys

from ExtensionCore import ManageSpicesPage, DownloadSpicesPage
from Spices import Spice_Harvester
from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *
from gi.repository import GLib

class Module:
    comment = _("Manage your actions")
    name = "actions"
    category = "prefs"

    def __init__(self, content_box):
        self.window = None
        self.sidePage = ActionsViewSidePage(content_box, self)

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Actions module")
            self.sidePage.load(self.window)

    def _setParentRef(self, window):
        self.window = window


class ActionsViewSidePage(SidePage):
    collection_type = "action"

    def __init__(self, content_box, module):
        self.RemoveString = ""
        keywords = _("action")

        super().__init__(_("Actions"), "cs-actions", keywords,
                         content_box, module=module)

    def load(self, window):
        self.window = window

        self.spices = Spice_Harvester(self.collection_type, self.window)

        self.stack = SettingsStack()
        self.add_widget(self.stack)
        self.stack.expand = True

        manage_extensions_page = ManageActionsPage(self, self.spices, self.window)
        self.stack.add_titled(manage_extensions_page, 'installed', _("Manage"))

        download_actions_page = DownloadSpicesPage(self, self.collection_type, self.spices, self.window)
        self.stack.add_titled(download_actions_page, 'more', _("Download"))

        if GLib.find_program_in_path("nemo-action-layout-editor"):
            for dir in GLib.get_system_data_dirs():
                path = Path(dir).joinpath("nemo/layout-editor")
                if path.exists():
                    sys.path.append(str(path))
                    try:
                        import nemo_action_layout_editor
                        editor = nemo_action_layout_editor.NemoActionsOrganizer(self.window)
                        editor.props.margin_start = 80
                        editor.props.margin_end = 80
                        editor.props.margin_top = 15
                        editor.props.margin_bottom = 30
                        self.stack.add_titled(editor, 'editor', _("Layout"))

                        def on_window_delete(window, event, data=None):
                            if not editor.quit():
                                return True

                        self.window.connect("delete-event", on_window_delete)
                    except Exception as e:
                        print(e)
                    break

class ManageActionsPage(ManageSpicesPage):
    directories = [f"{GLib.get_home_dir()}/.local/share/nemo/actions"]
    collection_type = "action"
    instance_button_text = _("Enable")
    remove_button_text = _("Disable")
    installed_page_title = _("Installed actions")
    uninstall_button_text = _("Uninstall")
    restore_button_text = _("Remove all")

    def __init__(self, parent, spices, window):
        super().__init__(parent, self.collection_type, spices, window)
