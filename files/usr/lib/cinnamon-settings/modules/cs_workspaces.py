#!/usr/bin/env python2

from SettingsWidgets import *

class Module:
    name = "workspaces"
    category = "prefs"
    comment = _("Manage workspace preferences")

    def __init__(self, content_box):
        keywords = _("workspace, osd, expo, monitor")
        sidePage = SidePage(_("Workspaces"), "cs-workspaces", keywords, content_box, module=self)
        self.sidePage = sidePage

    def shouldLoad(self):
        return True

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Workspaces module"

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # OSD

            page = SettingsPage()


            switch = GSettingsSwitch("", "org.cinnamon", "workspace-osd-visible")
            switch.label.set_markup("<b>%s</b>" % _("Enable workspace OSD"))
            switch.fill_row()
            page.add(switch)

            settings = page.add_reveal_section(_("On-Screen Display (OSD)"), "org.cinnamon", "workspace-osd-visible")

            spin = GSettingsSpinButton(_("Workspace OSD duration"), "org.cinnamon", "workspace-osd-duration", mini=0, maxi=2000, step=50, page=400, units=_("milliseconds"))
            settings.add_row(spin)

            spin = GSettingsSpinButton(_("Workspace OSD horizontal position"), "org.cinnamon", "workspace-osd-x", mini=0, maxi=100, step=5, page=50, units=_("percent of the monitor's width"))
            settings.add_row(spin)

            spin = GSettingsSpinButton(_("Workspace OSD vertical position"), "org.cinnamon", "workspace-osd-y", mini=0, maxi=100, step=5, page=50, units=_("percent of the monitor's height"))
            settings.add_row(spin)

            self.sidePage.stack.add_titled(page, "osd", _("OSD"))

            # Settings

            page = SettingsPage()

            settings = page.add_section(_("Miscellaneous Options"))

            switch = GSettingsSwitch(_("Allow cycling through workspaces"), "org.cinnamon.muffin", "workspace-cycle")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Only use workspaces on primary monitor (requires Cinnamon restart)"), "org.cinnamon.muffin", "workspaces-only-on-primary")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Display Expo view as a grid"), "org.cinnamon", "workspace-expo-view-as-grid")
            settings.add_row(switch)

            # Edge Flip doesn't work well, so it's there in gsettings, but we don't show it to users yet
            # switch = GSettingsSwitch(_("Enable Edge Flip"), "org.cinnamon", "enable-edge-flip")
            # settings.add_row(switch)
            # spin = GSettingsSpinButton(_("Edge Flip delay"), "org.cinnamon", "edge-flip-delay", mini=1, maxi=3000, units=_("ms"))
            # settings.add_reveal_row(spin, "org.cinnamon", "enable-edge-flip")

            switch = GSettingsSwitch(_("Invert the left and right arrow key directions used to shift workspaces during a window drag"), "org.cinnamon.muffin", "invert-workspace-flip-direction")
            settings.add_row(switch)

            self.sidePage.stack.add_titled(page, "settings", _("Settings"))
