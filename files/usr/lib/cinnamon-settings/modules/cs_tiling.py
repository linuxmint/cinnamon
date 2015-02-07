#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk

class Module:
    def __init__(self, content_box):
        keywords = _("window, tile, flip, tiling, snap, snapping")        
        sidePage = SidePage(_("Window Tiling and Edge Flip"), "cs-tiling", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "tiling"
        self.comment = _("Manage window tiling preferences")
        self.category = "prefs"        

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Tiling module"
            bg = SectionBg()        
            self.sidePage.add_widget(bg)
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            bg.add(vbox)

            section = Section(_("Tiling and Snapping Settings"))  
            section.add(GSettingsCheckButton(_("Enable Window Tiling and Snapping"), "org.cinnamon.muffin", "edge-tiling", None))
            section.add_indented(GSettingsSpinButton(_("Tiling HUD visibility threshold"), "org.cinnamon.muffin", "tile-hud-threshold", "org.cinnamon.muffin/edge-tiling", 1, 300, 1, 1, _("Pixels")))
            modifiers = [["", _("Disabled")],["Super", _("Super (Windows)")],["Alt", _("Alt")],["Shift", _("Shift")],["Control", _("Control")]]
            section.add_indented(GSettingsComboBox(_("Modifier to use for toggling between tile and snap mode"), "org.cinnamon.muffin", "snap-modifier", "org.cinnamon.muffin/edge-tiling", modifiers))
            section.add_indented(GSettingsCheckButton(_("Maximize, instead of tile, when dragging a window to the top edge"), "org.cinnamon.muffin", "tile-maximize", "org.cinnamon.muffin/edge-tiling"))
            section.add_indented(GSettingsCheckButton(_("Prevent the snap on-screen-display from showing"), "org.cinnamon", "hide-snap-osd", "org.cinnamon.muffin/edge-tiling"))
            section.add_indented(GSettingsCheckButton(_("Prevent the tile heads-up-display from showing"), "org.cinnamon", "hide-tile-hud", "org.cinnamon.muffin/edge-tiling"))
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
            
            section = Section(_("Edge Flip Settings"))  
            section.add(GSettingsCheckButton(_("Enable Edge Flip"), "org.cinnamon", "enable-edge-flip", None))
            section.add_indented(GSettingsSpinButton(_("Edge Flip delay"), "org.cinnamon", "edge-flip-delay", "org.cinnamon/enable-edge-flip", 1, 3000, 1, 1, _("ms")))
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
            
            section = Section(_("Miscellaneous Settings"))  
            section.add(GSettingsCheckButton(_("Invert the left and right arrow key directions used to shift workspaces during a window drag"), "org.cinnamon.muffin", "invert-workspace-flip-direction", None))
            section.add(GSettingsCheckButton(_("Enable legacy window snapping (hold <Shift> while dragging a window)"), "org.cinnamon.muffin", "legacy-snap", None))       
            vbox.add(section)

        

        

