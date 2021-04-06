#!/usr/bin/python3

import os
import sys
import gi
import gettext

gi.require_version('Gtk', '3.0')

gettext.install("cinnamon", "/usr/share/locale", names=["ngettext"])

from . import _harvester
from ._harvester import SpiceUpdate

SPICE_TYPE_APPLET = "applet"
SPICE_TYPE_DESKLET = "desklet"
SPICE_TYPE_THEME = "theme"
SPICE_TYPE_EXTENSION = "extension"
SPICE_TYPES = [SPICE_TYPE_APPLET, SPICE_TYPE_DESKLET, SPICE_TYPE_THEME, SPICE_TYPE_EXTENSION]

class UpdateManager():
    def __init__(self):
        self.harvesters = {}
        for spice_type in SPICE_TYPES:
            self.harvesters[spice_type] = _harvester.Harvester(spice_type)

    def get_updates(self):
        updates = []
        for spice_type in SPICE_TYPES:
            updates += self.get_updates_of_type(spice_type)
        return updates

    def get_dummy_updates(self):
        updates = []
        updates.append(Update("hwmonitor@sylfurd", SPICE_TYPE_APPLET))
        updates.append(Update("qredshift@quintao", SPICE_TYPE_APPLET))
        updates.append(Update("redshift@marvel4u", SPICE_TYPE_APPLET))
        updates.append(Update("sysmonitor@orcus", SPICE_TYPE_APPLET))
        updates.append(Update("weather@mockturtl", SPICE_TYPE_APPLET))
        updates.append(Update("bbcwx@oak-wood.co.uk", SPICE_TYPE_APPLET))
        updates.append(Update("soundBox@scollins", SPICE_TYPE_DESKLET))
        return updates

    def get_updates_of_type(self, spice_type):
        harvester = self.harvesters[spice_type]
        harvester.refresh()
        return harvester.get_updates()

    def upgrade(self, update):
        self.upgrade_uuid(update.uuid, update.spice_type)

    def upgrade_uuid(self, uuid, spice_type):
        harvester = self.harvesters[spice_type]
        harvester.install(uuid)


