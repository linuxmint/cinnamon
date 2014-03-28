#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage

class Module:
    def __init__(self, content_box):
        keywords = _("applet")
        self.name = "applets"
        # for i18n replacement in ExtensionCore.py
        noun = _("applet")
        pl_noun = _("applets")
        target = _("panel")
        self.comment = _("Manage Cinnamon applets")
        sidePage = AppletsViewSidePage(_("Applets"), "cs-applets", keywords, content_box, "applet", noun, pl_noun, target, self)
        self.sidePage = sidePage
        self.category = "prefs"

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Applets module"
            self.sidePage.load()

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class AppletsViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, content_box, collection_type, noun, pl_noun, target, module):
        self.RemoveString = _("You can remove specific instances in panel edit mode via the context menu.")
        ExtensionSidePage.__init__(self, name, icon, keywords, content_box, collection_type, noun, pl_noun, target, module)

    def toSettingString(self, uuid, instanceId):
        return ("panel1:right:0:%s:%d") % (uuid, instanceId)

    def fromSettingString(self, string):
        panel, side, position, uuid, instanceId = string.split(":")
        return uuid

    def getAdditionalPage(self):
        return None
