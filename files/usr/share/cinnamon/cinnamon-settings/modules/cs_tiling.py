#!/usr/bin/env python2

from SettingsWidgets import *


class Module:
    name = "tiling"
    comment = _("Manage window tiling preferences")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("window, tile, flip, tiling, snap, snapping")
        sidePage = SidePage(_("Window Tiling"), "cs-tiling", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Tiling module"

            page = SettingsPage()
            self.sidePage.add_widget(page)

            switch = GSettingsSwitch("", "org.cinnamon.muffin", "edge-tiling")
            switch.fill_row()
            switch.label.set_markup("<b>%s</b>" % _("Enable Window Tiling and Snapping"))
            page.add(switch)

            settings = page.add_reveal_section(_("Tiling and Snapping"), "org.cinnamon.muffin", "edge-tiling")

            settings.add_row(GSettingsSpinButton(_("Tiling HUD visibility threshold"), "org.cinnamon.muffin", "tile-hud-threshold", _("Pixels")))

            modifiers = [["", _("Disabled")],["Super", _("Super (Windows)")],["Alt", _("Alt")],["Shift", _("Shift")],["Control", _("Control")]]
            settings.add_row(GSettingsComboBox(_("Modifier to use for toggling between tile and snap mode"), "org.cinnamon.muffin", "snap-modifier", modifiers))

            settings.add_row(GSettingsSwitch(_("Maximize, instead of tile, when dragging a window to the top edge"), "org.cinnamon.muffin", "tile-maximize"))

            settings.add_row(GSettingsSwitch(_("Show snap on-screen-display"), "org.cinnamon", "show-snap-osd"))

            settings.add_row(GSettingsSwitch(_("Show tile heads-up-display"), "org.cinnamon", "show-tile-hud"))

            settings.add_row(GSettingsSwitch(_("Legacy window snapping (hold <Shift> while dragging a window)"), "org.cinnamon.muffin", "legacy-snap"))
