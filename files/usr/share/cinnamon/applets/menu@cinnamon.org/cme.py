#!/usr/bin/python3

import sys
sys.path.append('/usr/share/cinnamon/cinnamon-menu-editor/')
from cme.MainWindow import CMEContent as Content

class MenuEditorPage(SettingsPage):
    def __init__(self, info, settings):
        SettingsPage.__init__(self)

        self.pack_start(Content(), True, True, 0)

