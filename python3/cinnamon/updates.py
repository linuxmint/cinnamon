#!/usr/bin/python3

import os
import sys
import gi
import gettext

gi.require_version('Gtk', '3.0')

gettext.install("cinnamon", "/usr/share/locale", names=["ngettext"])

from . import harvester
from .harvester import SpiceUpdate

SPICE_TYPE_APPLET = "applet"
SPICE_TYPE_DESKLET = "desklet"
SPICE_TYPE_THEME = "theme"
SPICE_TYPE_EXTENSION = "extension"
SPICE_TYPES = [SPICE_TYPE_APPLET, SPICE_TYPE_DESKLET, SPICE_TYPE_THEME, SPICE_TYPE_EXTENSION]

class UpdateManager():
    def __init__(self):
        self.harvesters = {}
        for spice_type in SPICE_TYPES:
            self.harvesters[spice_type] = harvester.Harvester(spice_type)

    def get_updates(self):
        updates = []
        for spice_type in SPICE_TYPES:
            updates += self.get_updates_of_type(spice_type)
        return updates

    def refresh_all_caches(self):
        for spice_type in SPICE_TYPES:
            self.refresh_cache_for_type(spice_type)

    def refresh_cache_for_type(self, spice_type):
        harvester = self.harvesters[spice_type]
        return harvester.refresh()

    def get_updates_of_type(self, spice_type):
        harvester = self.harvesters[spice_type]
        return harvester.get_updates()

    def upgrade(self, update):
        self.upgrade_uuid(update.uuid, update.spice_type)

    def upgrade_uuid(self, uuid, spice_type):
        harvester = self.harvesters[spice_type]
        harvester.install(uuid)

    def spice_is_enabled(self, update):
        return self.harvesters[update.spice_type].get_enabled(update.uuid) > 0
