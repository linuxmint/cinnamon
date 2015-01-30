#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage

class Module:
    def __init__(self, content_box):
        keywords = _("applet")
        self.name = "applets"       
        self.comment = _("Manage Cinnamon applets")
        sidePage = AppletsViewSidePage(_("Applets"), "cs-applets", keywords, content_box, "applet", self)
        self.sidePage = sidePage
        self.category = "prefs"

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
        return ("panel1:right:0:%s:%d") % (uuid, instanceId)

    def fromSettingString(self, string):
        panel, side, position, uuid, instanceId = string.split(":")
        return uuid

    def getAdditionalPage(self):
        return None
