#!/usr/bin/python3

import os
import gettext
import glob
import sys

sys.path.append('/usr/lib/linuxmint/common')  # noqa
import additionalfiles

DOMAIN = "cinnamon"
PATH = "/usr/share/locale"

os.environ['LANGUAGE'] = "en_US.UTF-8"
gettext.install(DOMAIN, PATH)

try:
    sys.path.append('files/usr/share/cinnamon/cinnamon-settings')
    sys.path.append('files/usr/share/cinnamon/cinnamon-settings/modules')
    sys.path.append('files/usr/share/cinnamon/cinnamon-settings/bin')
    mod_files = glob.glob('files/usr/share/cinnamon/cinnamon-settings/modules/*.py')
    mod_files.sort()
    if len(mod_files) is 0:
        print("No settings modules found!!")
        sys.exit(1)

    mod_files = [x.split('/')[-1].split('.')[0] for x in mod_files]

    for mod_file in mod_files:
        if mod_file[0:3] != "cs_":
            raise Exception("Settings modules must have a prefix of 'cs_' !!")

    print(mod_files)
    modules = map(__import__, mod_files)
except Exception as detail:
    print(detail)
    sys.exit(1)

for module in modules:
    try:
        mod = module.Module(None)

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

    except Exception:
        print("Failed to load module %s" % module)
        import traceback
        traceback.print_exc()
