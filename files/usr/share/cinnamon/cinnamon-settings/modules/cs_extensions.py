#!/usr/bin/python2

from ExtensionCore import ExtensionSidePage


class Module:
    name = "extensions"
    category = "prefs"
    comment = _("Manage your Cinnamon extensions")

    def __init__(self, content_box):
        keywords = _("extension, addon")
        sidePage = ExtensionViewSidePage(_("Extensions"), "cs-extensions", keywords, content_box, "extension", self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Extensions module"
            self.sidePage.load()

    def _setParentRef(self, window):
        self.sidePage.window = window


class ExtensionViewSidePage (ExtensionSidePage):
    def __init__(self, name, icon, keywords, content_box, collection_type, module):
        self.RemoveString = ""
        ExtensionSidePage.__init__(self, name, icon, keywords, content_box, collection_type, module)

    def toSettingString(self, uuid, instanceId):
        return uuid
