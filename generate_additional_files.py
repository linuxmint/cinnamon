#!/usr/bin/python

import os, gettext

DOMAIN = "cinnamon"
PATH = "/usr/share/cinnamon/locale"

def generate(filename, prefix, name, comment, suffix):
    gettext.install(DOMAIN, PATH)
    desktopFile = open(filename, "w")

    desktopFile.writelines(prefix)

    desktopFile.writelines("Name=%s\n" % name)
    for directory in sorted(os.listdir(PATH)):
        if os.path.isdir(os.path.join(PATH, directory)):
            try:
                language = gettext.translation(DOMAIN, PATH, languages=[directory])
                language.install()          
                desktopFile.writelines("Name[%s]=%s\n" % (directory, _(name)))
            except:
                pass

    desktopFile.writelines("Comment=%s\n" % comment)
    for directory in sorted(os.listdir(PATH)):
        if os.path.isdir(os.path.join(PATH, directory)):
            try:
                language = gettext.translation(DOMAIN, PATH, languages=[directory])
                language.install()                      
                desktopFile.writelines("Comment[%s]=%s\n" % (directory, _(comment)))
            except:
                pass

    desktopFile.writelines(suffix)

os.environ['LANG'] = "en"
gettext.install(DOMAIN, PATH)

prefix = """[Desktop Entry]
Exec=cinnamon-settings
Icon=preferences-system
Terminal=false
Type=Application
Categories=Settings;
StartupNotify=false
OnlyShowIn=GNOME;
Keywords=Preferences;Settings;
"""

generate("files/usr/share/applications/cinnamon-settings.desktop", prefix, _("System Settings"), _("Control Center"), "")

prefix = """[Desktop Entry]
Exec=cinnamon-settings-users
Icon=system-users
Terminal=false
Type=Application
Categories=System;Settings;
StartupNotify=false
OnlyShowIn=GNOME;
Keywords=Preferences;Settings;
"""

generate("files/usr/share/applications/cinnamon-settings-users.desktop", prefix, _("Users and Groups"), _("Add or remove users and groups"), "")

