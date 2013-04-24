#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage

class Module:
    def __init__(self, content_box):
        keywords = _("applet")
        advanced = False
        self.name = "applets"
        sidePage = AppletsViewSidePage(_("Applets"), "applets.svg", keywords, advanced, content_box, "applet")
        self.sidePage = sidePage

        self.category = "prefs"

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class AppletsViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, advanced, content_box, collection_type):
        ExtensionSidePage.__init__(self, name, icon, keywords, advanced, content_box, collection_type)

    def toSettingString(self, uuid, instanceId):
        return ("panel1:right:0:%s:%d") % (uuid, instanceId)

    def fromSettingString(self, string):
        panel, side, position, uuid, instanceId = string.split(":")
        return uuid
