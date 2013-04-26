#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage

class Module:
    def __init__(self, content_box):
        keywords = _("desklet, desktop, slideshow")
        advanced = False
        self.name = "desklets"
        sidePage = DeskletsViewSidePage(_("Desklets"), "desklets.svg", keywords, advanced, content_box, "desklet", "desktop")
        self.sidePage = sidePage

        self.category = "prefs"

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class DeskletsViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, target):
        self.RemoveString = _("You can remove specific instances from the desktop via that desklet's context menu")
        ExtensionSidePage.__init__(self, name, icon, keywords, advanced, content_box, collection_type, target)

    def toSettingString(self, uuid, instanceId):
        return ("%s:%d:0:100") % (uuid, instanceId)

    def fromSettingString(self, string):
        uuid, instanceId, x, y = string.split(":")
        return uuid
