#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage

class Module:
    def __init__(self, content_box):
        keywords = _("extension, addon")
        advanced = True
        self.name = "extensions"
        self.comment = _("Manage your Cinnamon extensions")
        # for i18n replacement in ExtensionCore.py
        noun = _("extension")
        pl_noun = _("extensions")
        # we do not translate Cinnamon
        target = "Cinnamon"
        sidePage = ExtensionViewSidePage(_("Extensions"), "extensions.svg", keywords, advanced, content_box, "extension", noun, pl_noun, target)
        self.sidePage = sidePage

        self.category = "prefs"

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class ExtensionViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target):
        self.RemoveString = ""
        ExtensionSidePage.__init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target)

    def toSettingString(self, uuid, instanceId):
        return uuid

    def fromSettingString(self, string):
        return string

    def getAdditionalPage(self):
        return None

