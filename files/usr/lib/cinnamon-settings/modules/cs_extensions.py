#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage

class Module:
    def __init__(self, content_box):
        keywords = _("extension, addon")
        advanced = True
        self.name = "extensions"
        sidePage = ExtensionViewSidePage(_("Extensions"), "extensions.svg", keywords, advanced, content_box, "extension", "Cinnamon")
        self.sidePage = sidePage

        self.category = "prefs"

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class ExtensionViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, target):
        self.RemoveString = ""
        ExtensionSidePage.__init__(self, name, icon, keywords, advanced, content_box, collection_type, target)

    def toSettingString(self, uuid, instanceId):
        return uuid

    def fromSettingString(self, string):
        return string
