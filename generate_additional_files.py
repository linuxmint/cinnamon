#!/usr/bin/python3

import os
import gettext
from mintcommon import additionalfiles

DOMAIN = "cinnamon"
PATH = "/usr/share/locale"

os.environ['LANGUAGE'] = "en_US.UTF-8"
gettext.install(DOMAIN, PATH)

prefix = """[Desktop Entry]
Exec=env WEBKIT_DISABLE_COMPOSITING_MODE=1 cinnamon-settings
Icon=preferences-desktop
Terminal=false
Type=Application
Categories=Settings;
StartupNotify=false
OnlyShowIn=X-Cinnamon;
"""

additionalfiles.generate(DOMAIN, PATH, "files/usr/share/applications/cinnamon-settings.desktop", prefix,
    _("System Settings"),
    _("Control Center"),
    "",
    keywords=_("Preferences,Settings"))

prefix = """[Desktop Entry]
Exec=cinnamon-settings-users
Icon=system-users
Terminal=false
Type=Application
Categories=System;Settings;
StartupNotify=false
OnlyShowIn=X-Cinnamon;
"""

additionalfiles.generate(DOMAIN, PATH, "files/usr/share/applications/cinnamon-settings-users.desktop", prefix,
    _("Users and Groups"),
    _("Add or remove users and groups"),
    "",
    keywords=_("Preferences,Settings,Users,Groups"))

prefix = """[Desktop Entry]
Exec=cinnamon-dbus-command ToggleKeyboard
Icon=cinnamon-virtual-keyboard
Terminal=false
Type=Application
Categories=Utility;
OnlyShowIn=X-Cinnamon;
"""

additionalfiles.generate(DOMAIN, PATH, "files/usr/share/applications/cinnamon-onscreen-keyboard.desktop", prefix,
    _("Virtual keyboard"),
    _("Turn on-screen keyboard on or off"),
    "",
    keywords=_("onboard,keyboard,caribou"))

SCREENSHOT_DESKTOP = "files/usr/share/applications/cinnamon-screenshot.desktop"

prefix = """[Desktop Entry]
Exec=cinnamon-screenshot --interactive
Terminal=false
Type=Application
Icon=applets-screenshooter
StartupNotify=true
Categories=GTK;Utility;
OnlyShowIn=X-Cinnamon;
Actions=screen-shot;window-shot;area-shot;
"""

additionalfiles.generate(DOMAIN, PATH, SCREENSHOT_DESKTOP, prefix,
    _("Screenshot"),
    _("Save images of your screen or individual windows"),
    "",
    keywords=_("snapshot,capture,print,screenshot"))

additionalfiles.generate(DOMAIN, PATH, SCREENSHOT_DESKTOP, "\n[Desktop Action screen-shot]\n",
    _("Take a Screenshot of the Whole Screen"),
    None,
    "Exec=cinnamon-screenshot\n",
    append=True)

additionalfiles.generate(DOMAIN, PATH, SCREENSHOT_DESKTOP, "\n[Desktop Action window-shot]\n",
    _("Take a Screenshot of the Current Window"),
    None,
    "Exec=cinnamon-screenshot -w\n",
    append=True)

additionalfiles.generate(DOMAIN, PATH, SCREENSHOT_DESKTOP, "\n[Desktop Action area-shot]\n",
    _("Take a Screenshot of an Area"),
    None,
    "Exec=cinnamon-screenshot -a\n",
    append=True)
