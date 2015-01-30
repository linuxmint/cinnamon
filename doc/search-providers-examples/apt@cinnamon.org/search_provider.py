# -*- coding=utf-8 -*-

import subprocess
import sys
import gettext
import json
import dbus

gettext.install("cinnamon", "/usr/share/locale")

if __name__ == "__main__":
    results = []
    packages = subprocess.check_output(["apt-cache", "search"] + sys.argv[1].split(" ")).splitlines()[:10]
    for p in packages:
        i = p.index(" - ")
        name = p[:i]
        description = p[i+3:]
        results.append({'id': name, 'label': _("Install package : ") + name, 'description': description})
    session_bus = dbus.SessionBus()
    dbus = session_bus.get_object("org.Cinnamon", "/org/Cinnamon")
    PushResults = dbus.get_dbus_method('PushSearchProviderResults', 'org.Cinnamon')
    PushResults('apt@cinnamon.org', sys.argv[1], json.dumps(results))
