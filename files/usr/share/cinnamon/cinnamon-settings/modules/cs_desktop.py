#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

DESKTOP_SCHEMA = "org.nemo.desktop"
LAYOUT_KEY = "desktop-layout"
ORPHANS_KEY = "show-orphaned-desktop-icons"

DESKTOPS_ON_PRIMARY = "true::false"
DESKTOPS_ON_ALL = "true::true"
DESKTOPS_ON_NON_PRIMARY = "false::true"
DESKTOPS_ON_NONE = "false::false"


class Module:
    name = "desktop"
    category = "prefs"
    comment = _("Manage your desktop icons")

    def __init__(self, content_box):
        keywords = _("desktop, home, button, trash")
        sidePage = SidePage(_("Desktop"), "cs-desktop", keywords, content_box,
                            module=self)
        self.sidePage = sidePage

    def _loadCheck(self):
        have_nemo = False

        try:
            import gi
            gi.require_version('Nemo', '3.0')

            from gi.repository import Nemo

            if Nemo.DesktopPreferences:
                have_nemo = True
        except ImportError:
            pass
        except AttributeError:
            pass
        except ValueError:
            pass

        return have_nemo

    def on_module_selected(self):
        if self.loaded:
            return

        print("Loading Desktop module")
        from gi.repository import Nemo

        page = Nemo.DesktopPreferences()

        page.set_margin_top(15)
        page.set_margin_bottom(15)
        page.set_margin_start(80)
        page.set_margin_end(80)

        self.sidePage.add_widget(page)
