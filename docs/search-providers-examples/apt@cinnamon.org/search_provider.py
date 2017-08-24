# -*- coding=utf-8 -*-

import subprocess
import sys
import gettext
import json

gettext.install("cinnamon", "/usr/share/locale")

if __name__ == "__main__":
    results = []
    packages = subprocess.check_output(["apt-cache", "search"] + sys.argv[1].split(" ")).splitlines()[:10]
    for p in packages:
        i = p.index(" - ")
        name = p[:i]
        description = p[i+3:]
        results.append({'id': name, 'label': _("Install package : ") + name, 'description': description})

    print json.dumps(results)
