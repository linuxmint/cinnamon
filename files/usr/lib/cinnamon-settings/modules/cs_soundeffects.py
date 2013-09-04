#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("sound, effects, sounds, effect")
        advanced = True
        sidePage = SidePage(_("Sound Effects"), "sound-effects.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "sound-effects"
        self.category = "appear"            

        events = []
        events.append([_("Switching workspace:"), "switch"])
        events.append([_("Closing windows:"), "close"])
        events.append([_("Mapping windows:"), "map"])
        events.append([_("Minimizing windows:"), "minimize"])
        events.append([_("Maximizing windows:"), "maximize"])
        events.append([_("Unmaximizing windows:"), "unmaximize"])
        events.append([_("Tiling and snapping windows:"), "tile"])
        events.append([_("Logging in:"), "login"])
        events.append([_("Logging out:"), "logout"])

        for event in events:
            name = event[0]
            key = event[1]
            box = self._make_effect_group(name, key)
            sidePage.add_widget(box)


    def _make_effect_group(self, name, key):
        box = IndentedHBox()        
        w = GSettingsCheckButton(name, "org.cinnamon.sounds", "%s-enabled" % key, None)            
        box.add(w)
        w = GSettingsFileChooser("", "org.cinnamon.sounds", "%s-file" % key, "org.cinnamon.sounds/%s-enabled" % key)            
        box.add(w)
        return box