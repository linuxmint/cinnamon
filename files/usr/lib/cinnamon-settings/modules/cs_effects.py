#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("effects, fancy, window")
        advanced = True
        sidePage = SidePage(_("Effects"), "desktop-effects.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "effects"
        self.category = "appear"
        sidePage.add_widget(GSettingsCheckButton(_("Enable desktop effects"), "org.cinnamon", "desktop-effects", None))

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Enable desktop effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs", "org.cinnamon/desktop-effects"))
        sidePage.add_widget(box)

        # Destroy window effects
        transition_effects = []
        transition_effects.append(["easeInQuad", "easeInQuad"])
        transition_effects.append(["easeOutQuad", "easeOutQuad"])
        transition_effects.append(["easeInOutQuad", "easeInOutQuad"])        
        transition_effects.append(["easeInCubic", "easeInCubic"])
        transition_effects.append(["easeOutCubic", "easeOutCubic"])
        transition_effects.append(["easeInOutCubic", "easeInOutCubic"])        
        transition_effects.append(["easeInQuart", "easeInQuart"])
        transition_effects.append(["easeOutQuart", "easeOutQuart"])
        transition_effects.append(["easeInOutQuart", "easeInOutQuart"])        
        transition_effects.append(["easeInQuint", "easeInQuint"])
        transition_effects.append(["easeOutQuint", "easeOutQuint"])
        transition_effects.append(["easeInOutQuint", "easeInOutQuint"])        
        transition_effects.append(["easeInSine", "easeInSine"])
        transition_effects.append(["easeOutSine", "easeOutSine"])
        transition_effects.append(["easeInOutSine", "easeInOutSine"])        
        transition_effects.append(["easeInExpo", "easeInExpo"])
        transition_effects.append(["easeOutEXpo", "easeOutExpo"])
        transition_effects.append(["easeInOutExpo", "easeInOutExpo"])        
        transition_effects.append(["easeInCirc", "easeInCirc"])
        transition_effects.append(["easeOutCirc", "easeOutCirc"])
        transition_effects.append(["easeInOutCirc", "easeInOutCirc"])        
        transition_effects.append(["easeInElastic", "easeInElastic"])
        transition_effects.append(["easeOutElastic", "easeOutElastic"])
        transition_effects.append(["easeInOutElastic", "easeInOutElastic"])        
        transition_effects.append(["easeInBack", "easeInBack"])
        transition_effects.append(["easeOutBack", "easeOutBack"])
        transition_effects.append(["easeInOutBack", "easeInOutBack"])        
        transition_effects.append(["easeInBounce", "easeInBounce"])
        transition_effects.append(["easeOutBounce", "easeOutBounce"])
        transition_effects.append(["easeInOutBounce", "easeInOutBounce"])
        
        #CLOSING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Closing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-close-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-close-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-close-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box) 
        
        #MAPPING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Mapping windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-map-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-map-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-map-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)
        
        #MINIMIZING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Minimizing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["traditional", _("Traditional")], ["scale", _("Scale")], ["fade", _("Fade")]]
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-minimize-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-minimize-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-minimize-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)
        
        #MAXIMIZING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Maximizing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")]]        
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-maximize-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-maximize-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-maximize-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)
        
        #UNMAXIMIZING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Unmaximizing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")]]
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-unmaximize-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-unmaximize-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-unmaximize-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)

        sidePage.add_widget(GSettingsCheckButton(_("Enable fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade", None))


