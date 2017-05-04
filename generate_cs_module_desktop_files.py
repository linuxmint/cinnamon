#!/usr/bin/python2

DOMAIN = "cinnamon"
PATH = "/usr/share/locale"

import os, gettext, sys
sys.path.append('/usr/lib/linuxmint/common')
import additionalfiles

os.environ['LANGUAGE'] = "en_US.UTF-8"
gettext.install(DOMAIN, PATH)






import os
import glob
import polib
import sys
from gi.repository import GLib

try:
    sys.path.append('files/usr/share/cinnamon/cinnamon-settings/modules')
    sys.path.append('files/usr/share/cinnamon/cinnamon-settings/bin')
    mod_files = glob.glob('files/usr/share/cinnamon/cinnamon-settings/modules/*.py')
    mod_files.sort()
    if len(mod_files) is 0:
        raise Exception("No settings modules found!!")
    for i in range(len(mod_files)):
        mod_files[i] = mod_files[i].split('/')[-1]
        mod_files[i] = mod_files[i].split('.')[0]
        if mod_files[i][0:3] != "cs_":
            raise Exception("Settings modules must have a prefix of 'cs_' !!")
    modules = map(__import__, mod_files)
except Exception, detail:
    print detail
    sys.exit(1)


for i in range(len(modules)):
    try:
        mod = modules[i].Module(None)  

        if mod.category in ("admin"):
            category = "Settings;System;"
        else:
            category = "Settings;"

        formatted_keywords = mod.sidePage.keywords.replace(",", ";")
        formatted_keywords = formatted_keywords.replace(", ", ";")

        prefix = """[Desktop Entry]
Icon=%(icon)s
Exec=cinnamon-settings %(module)s
Type=Application
OnlyShowIn=X-Cinnamon;
Categories=Settings;
""" % {'module': mod.name, 'category': category, 'icon': mod.sidePage.icon}

        additionalfiles.generate(DOMAIN, PATH, "files/usr/share/applications/cinnamon-settings-%s.desktop" % mod.name, prefix, mod.sidePage.name, mod.comment, "", None, mod.sidePage.keywords)
        
    except:
        print "Failed to load module %s" % modules[i]
        import traceback
        traceback.print_exc()
