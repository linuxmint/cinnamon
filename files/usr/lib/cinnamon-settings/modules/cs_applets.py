#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage

class Module:
    def __init__(self, content_box):
        keywords = _("applet")
        advanced = False
        self.name = "applets"
        # for i18n replacement in ExtensionCore.py
        noun = _("applet")
        pl_noun = _("applets")
        target = _("panel")
        sidePage = AppletsViewSidePage(_("Applets"), "applets.svg", keywords, advanced, content_box, "applet", noun, pl_noun, target)
        self.sidePage = sidePage

        self.category = "prefs"

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class AppletsViewSidePage (ExtensionSidePage):

    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target):
        self.RemoveString = _("You can remove specific instances in panel edit mode via the context menu.")
        ExtensionSidePage.__init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target)

    def toSettingString(self, uuid, instanceId):
        return ("panel1:right:0:%s:%d") % (uuid, instanceId)

    def fromSettingString(self, string):
        panel, side, position, uuid, instanceId = string.split(":")
        return uuid

    def getAdditionalPage(self):
        return None
