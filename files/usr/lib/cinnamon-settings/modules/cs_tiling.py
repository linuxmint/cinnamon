#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk

class Module:
    def __init__(self, content_box):
        keywords = _("window, tile, flip, tiling, snap, snapping")
        advanced = False
        sidePage = SidePage(_("Window Tiling and Edge Flip"), "tiling.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "tiling"
        self.comment = _("Manage window tiling preferences")
        self.category = "prefs"

        sidePage.add_widget(GSettingsCheckButton(_("Enable Window Tiling and Snapping"), "org.cinnamon.muffin", "edge-tiling", None))
        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Tiling HUD visibility threshold"), "org.cinnamon.muffin", "tile-hud-threshold", "org.cinnamon.muffin/edge-tiling", 1, 300, 1, 1, _("Pixels")))
        sidePage.add_widget(box, True)

        box = IndentedHBox()
        modifiers = [["", "Disabled"],["Super", _("Super (Windows)")],["Alt", _("Alt")],["Shift", _("Shift")],["Control", _("Control")]]
        box.add(GSettingsComboBox(_("Modifier to use for toggling between tile and snap mode"), "org.cinnamon.muffin", "snap-modifier", "org.cinnamon.muffin/edge-tiling", modifiers))
        sidePage.add_widget(box, True)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Maximize, instead of tile, when dragging a window to the top edge"), "org.cinnamon.muffin", "tile-maximize", "org.cinnamon.muffin/edge-tiling"))
        sidePage.add_widget(box, True)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Prevent the snap on-screen-display from showing"), "org.cinnamon", "hide-snap-osd", "org.cinnamon.muffin/edge-tiling"))
        sidePage.add_widget(box, True)

        sidePage.add_widget(GSettingsCheckButton(_("Enable Edge Flip"), "org.cinnamon", "enable-edge-flip", None))
        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Edge Flip delay"), "org.cinnamon", "edge-flip-delay", "org.cinnamon/enable-edge-flip", 1, 3000, 1, 1, _("ms")))
        sidePage.add_widget(box, True)

        sidePage.add_widget(GSettingsCheckButton(_("Invert the left and right arrow key directions used to shift workspaces during a window drag"), "org.cinnamon.muffin", "invert-workspace-flip-direction", None))

        sidePage.add_widget(GSettingsCheckButton(_("Enable legacy window snapping (hold <Shift> while dragging a window)"), "org.cinnamon.muffin", "legacy-snap", None))
