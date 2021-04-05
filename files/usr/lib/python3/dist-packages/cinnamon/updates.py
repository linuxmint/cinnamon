#!/usr/bin/python3

import os
import sys
import gi
import gettext

gi.require_version('Gtk', '3.0')

gettext.install("cinnamon", "/usr/share/locale", names=["ngettext"])

sys.path.append("/usr/share/cinnamon/cinnamon-settings/bin")
from Spices import Spice_Harvester

SPICE_TYPE_APPLET = "applet"
SPICE_TYPE_DESKLET = "desklet"
SPICE_TYPE_THEME = "theme"
SPICE_TYPE_EXTENSION = "extension"
SPICE_TYPES = [SPICE_TYPE_APPLET, SPICE_TYPE_DESKLET, SPICE_TYPE_THEME, SPICE_TYPE_EXTENSION]

class Update():

    def __init__(self, uuid, spice_type):
        self.uuid = uuid
        self.spice_type = spice_type

class UpdateManager():

    def __init__(self):
        self.harvesters = {}
        for spice_type in SPICE_TYPES:
            self.harvesters[spice_type] = Spice_Harvester(spice_type, None)

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
        updates = []
        harvester = self.harvesters[spice_type]
        harvester.refresh_cache()
        if harvester.are_updates_available():
            for uuid in harvester.updates_available:
                updates.append(Update(uuid, spice_type))
        return updates

    def upgrade(self, update):
        self.upgrade_uuid(update.uuid, update.spice_type)

    def upgrade_uuid(self, uuid, spice_type):
        harvester = self.harvesters[spice_type]
        harvester.install(uuid)


