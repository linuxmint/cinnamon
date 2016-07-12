#!/usr/bin/env python2

import sys

from ExtensionCore import ExtensionSidePage


class Module:
    name = "applets"
    comment = _("Manage Cinnamon applets")
    category = "prefs"

    def __init__(self, content_box):
        self.sidePage = AppletsViewSidePage(_("Applets"), "cs-applets", _("applet"), content_box, "applet", self)

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Applets module"
            self.sidePage.load()

    def _setParentRef(self, window):
        self.sidePage.window = window

class AppletsViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, content_box, collection_type, module):
        self.RemoveString = _("You can remove specific instances in panel edit mode via the context menu.")
        ExtensionSidePage.__init__(self, name, icon, keywords, content_box, collection_type, module)

    def toSettingString(self, uuid, instanceId):
        panelno = "panel1"
        if len(sys.argv) > 2:
            if sys.argv[1] == "applets" and sys.argv[2][0:5] == "panel":
                panelno = sys.argv[2]
        return (panelno + ":right:0:%s:%d") % (uuid, instanceId)

    def fromSettingString(self, string):
        panel, side, position, uuid, instanceId = string.split(":")
        return uuid

    def getAdditionalPage(self):
        return None
