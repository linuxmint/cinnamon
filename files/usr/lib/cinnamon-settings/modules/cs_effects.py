#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository.Gtk import SizeGroup, SizeGroupMode

class Module:
    def __init__(self, content_box):
        keywords = _("effects, fancy, window")
        sidePage = SidePage(_("Effects"), "cs-desktop-effects", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "effects"
        self.category = "appear"
        self.comment = _("Control Cinnamon visual effects.")            

        # Destroy window effects
        self.transition_effects = [[effect] * 2 for effect in
                              ["easeInQuad",
                               "easeOutQuad",
                               "easeInOutQuad",
                               "easeInCubic",
                               "easeOutCubic",
                               "easeInOutCubic",
                               "easeInQuart",
                               "easeOutQuart",
                               "easeInOutQuart",
                               "easeInQuint",
                               "easeOutQuint",
                               "easeInOutQuint",
                               "easeInSine",
                               "easeOutSine",
                               "easeInOutSine",
                               "easeInExpo",
                               "easeOutExpo",
                               "easeInOutExpo",
                               "easeInCirc",
                               "easeOutCirc",
                               "easeInOutCirc",
                               "easeInElastic",
                               "easeOutElastic",
                               "easeInOutElastic",
                               "easeInBack",
                               "easeOutBack",
                               "easeInOutBack",
                               "easeInBounce",
                               "easeOutBounce",
                               "easeInOutBounce"]]              
      
    def on_module_selected(self):
        if not self.loaded:
            print "Loading Effects module"
            bg = SectionBg()        
            self.sidePage.add_widget(bg)
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            bg.add(vbox)

            section = Section(_("Enable Effects"))  
            section.add(GSettingsCheckButton(_("Enable desktop effects"), "org.cinnamon", "desktop-effects", None))
            section.add_indented(GSettingsCheckButton(_("Enable session startup animation"), "org.cinnamon", "startup-animation", "org.cinnamon/desktop-effects"))
            section.add_indented(GSettingsCheckButton(_("Enable desktop effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs", "org.cinnamon/desktop-effects"))
            section.add(GSettingsCheckButton(_("Enable fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade", None))
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Customize Effects"))
            #CLOSING WINDOWS
            effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
            section.add(self.make_effect_group(_("Closing windows:"), "close", effects))
            
            #MAPPING WINDOWS
            effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
            section.add(self.make_effect_group(_("Mapping windows:"), "map", effects))
            
            #MINIMIZING WINDOWS
            effects = [["none", _("None")], ["traditional", _("Traditional")], ["scale", _("Scale")], ["fade", _("Fade")]]
            section.add(self.make_effect_group(_("Minimizing windows:"), "minimize", effects))
            
            #MAXIMIZING WINDOWS
            effects = [["none", _("None")], ["scale", _("Scale")]]        
            section.add(self.make_effect_group(_("Maximizing windows:"), "maximize", effects))
            
            #UNMAXIMIZING WINDOWS
            effects = [["none", _("None")], ["scale", _("Scale")]]
            section.add(self.make_effect_group(_("Unmaximizing windows:"), "unmaximize", effects))

            #TILING WINDOWS
            effects = [["none", _("None")], ["scale", _("Scale")]]
            section.add(self.make_effect_group(_("Tiling and snapping windows:"), "tile", effects))
            
            vbox.add(section)

    def make_effect_group(self, group_label, key, effects):
        tmin, tmax, tstep, tdefault = (0, 2000, 50, 200)
        self.size_groups = getattr(self, "size_groups", [SizeGroup.new(SizeGroupMode.HORIZONTAL) for x in range(4)])
        root = "org.cinnamon"
        path = "org.cinnamon/desktop-effects"
        template = "desktop-effects-%s-%s"
        box = Gtk.HBox()
        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.add(label)
        w = GSettingsComboBox("", root, template % (key, "effect"), path, effects)
        self.size_groups[1].add_widget(w)
        box.add(w)
        w = GSettingsComboBox("", root, template % (key, "transition"), path, self.transition_effects)
        self.size_groups[2].add_widget(w)
        box.add(w)
        w = GSettingsSpinButton("", root, template % (key, "time"), path, tmin, tmax, tstep, tdefault, _("milliseconds"))
        self.size_groups[3].add_widget(w)
        box.add(w)
        return box
