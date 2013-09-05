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
        events.append([_("Starting Cinnamon:"), "login"])
        events.append([_("Switching workspace:"), "switch"])
        events.append([_("Mapping windows:"), "map"])
        events.append([_("Closing windows:"), "close"])        
        events.append([_("Minimizing windows:"), "minimize"])
        events.append([_("Maximizing windows:"), "maximize"])
        events.append([_("Unmaximizing windows:"), "unmaximize"])
        events.append([_("Tiling and snapping windows:"), "tile"])        
        events.append([_("Inserting a device:"), "plug"])
        events.append([_("Removing a device:"), "unplug"])
        
        for event in events:
            name = event[0]
            key = event[1]
            box = self._make_effect_group(name, key)
            sidePage.add_widget(box)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Changing the sound volume:"), "org.cinnamon.desktop.sound", "volume-sound-enabled", None))
        box.add(GSettingsFileChooser("", "org.cinnamon.desktop.sound", "volume-sound-file", "org.cinnamon.desktop.sound/volume-sound-enabled"))
        sidePage.add_widget(box)        

    def _make_effect_group(self, name, key):
        box = IndentedHBox()
        box.add(GSettingsCheckButton(name, "org.cinnamon.sounds", "%s-enabled" % key, None))
        box.add(GSettingsFileChooser("", "org.cinnamon.sounds", "%s-file" % key, "org.cinnamon.sounds/%s-enabled" % key))
        return box