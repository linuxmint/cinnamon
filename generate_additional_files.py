#!/usr/bin/python3

import os
import gettext
from mintcommon import additionalfiles

DOMAIN = "cinnamon"
PATH = "/usr/share/locale"

os.environ['LANGUAGE'] = "en_US.UTF-8"
gettext.install(DOMAIN, PATH)

prefix = """[Desktop Entry]
Exec=cinnamon-settings
Icon=preferences-desktop
Terminal=false
Type=Application
Categories=Settings;
StartupNotify=false
OnlyShowIn=X-Cinnamon;
Keywords=Preferences;Settings;
"""

additionalfiles.generate(DOMAIN, PATH, "files/usr/share/applications/cinnamon-settings.desktop", prefix, _("System Settings"), _("Control Center"), "")

prefix = """[Desktop Entry]
Exec=cinnamon-settings-users
Icon=system-users
Terminal=false
Type=Application
Categories=System;Settings;
StartupNotify=false
OnlyShowIn=X-Cinnamon;
Keywords=Preferences;Settings;
"""

additionalfiles.generate(DOMAIN, PATH, "files/usr/share/applications/cinnamon-settings-users.desktop", prefix, _("Users and Groups"), _("Add or remove users and groups"), "")

prefix = """[Desktop Entry]
Exec=dbus-send --print-reply --dest=org.Cinnamon /org/Cinnamon org.Cinnamon.ToggleKeyboard
Icon=cinnamon-virtual-keyboard
Terminal=false
Type=Application
Categories=Utility;
OnlyShowIn=X-Cinnamon;
Keywords=onboard;keyboard;caribou;
"""

additionalfiles.generate(DOMAIN, PATH, "files/usr/share/applications/cinnamon-onscreen-keyboard.desktop", prefix, _("Virtual keyboard"), _("Turn on-screen keyboard on or off"), "")
