#!/usr/bin/python3

""" Launch the cinnamon-settings utility, or a specific settings module

Usage:
    To open System Settings:
$ cinnamon-settings

    To open the settings of a particular module:
$ cinnamon-settings module_name

    To open the settings of an applet, a desklet or an extension downloaded by the user:
$ cinnamon-settings applets|desklets|extensions UUID
Example:
$ cinnamon-settings applets SpicesUpdate@claudiux

    To add a xlet on a specific panel:
$ cinnamon-settings applets|desklets|extensions panel1|panel2|panel3|panel4

    To open a particular tab of the settings of a module, use the '--tab=' or '-t' argument:
$ cinnamon-settings module_name --tab=x
or
$ cinnamon-settings module_name -t x
(where x is the tab name (e.g. download) or the tab number (e.g. 1))
Example:
$ cinnamon-settings applets --tab=download

    To open the 'download' tab of a type of Spices (applets, desklets, extensions, themes), sorting
    them by 'name', 'score', 'date' or 'installed', use the '--sort=' or '-s' argument:
$ cinnamon-settings applets|desklets|extensions|themes --tab=1 --sort=name|score|date|installed
or
$ cinnamon-settings applets|desklets|extensions|themes -t 1 -s name|score|date|installed
Example:
$ cinnamon-settings applets -t 1 -s date

Available modules, their tab names and corresponding numbers:
    "MODULE_NAME":  {"TAB_NAME": TAB_NUMBER, ... }
    "accessibility":{"visual": 0, "keyboard": 1, "typing": 2, "mouse": 3},
    "applets":      {"installed": 0, "more": 1, "download": 1},
    "backgrounds":  {"images": 0, "settings": 1},
    "default":      {"preferred": 0, "removable": 1},
    "desklets":     {"installed": 0, "more": 1, "download": 1, "general": 2},
    "effects":      {"effects": 0, "customize": 1},
    "extensions":   {"installed": 0, "more": 1, "download": 1},
    "keyboard":     {"typing": 0, "shortcuts": 1, "layouts": 2},
    "mouse":        {"mouse": 0, "touchpad": 1},
    "power":        {"power": 0, "batteries": 1, "brightness": 2},
    "screensaver":  {"settings": 0, "customize": 1},
    "sound":        {"output": 0, "input": 1, "sounds": 2, "applications": 3, "settings": 4},
    "themes":       {"themes": 0, "download": 1, "options": 2},
    "windows":      {"titlebar": 0, "behavior": 1, "alttab": 2},
    "workspaces":   {"osd": 0, "settings": 1}

Available types of sort, and corresponding numbers:
    "name":0, "score":1, "date":2, "installed":3
"""

import getopt
import os
import sys
import shutil

def usage():
    print("""Usage:
cinnamon-settings [MODULE [OPTIONS]] [HELP_OPTION]

Help option (HELP_OPTION):
    -h, --help              Displays help message (e.g. this message).

Module options:
    -t, --tab               Opens the specified tab (see list in manpage) of
                            module settings.

    -s, --sort              xlets modules option.
                            xlets are 'applets', 'desklets', 'extensions'
                            and 'themes'.
                            Sorts the xlets by:
                                'name' or 0
                                'score' or 1 (by default)
                                'date' or 2
                                'installed' or 3
                                'update' or 4
Example:
    $ cinnamon-settings applets -t download -s date

For complete description and examples, see the manpage: cinnamon-settings(1)
    """)
    exit(2)

opts = []
try:
    if len(sys.argv) > 1:
        opts = getopt.getopt(sys.argv[1:], "h", ["help"])[0]
except getopt.GetoptError:
    pass

for opt, arg in opts:
    if opt in ("-h", "--help"):
        usage()
        break

opts = []
try:
    if len(sys.argv) > 2:
        opts = getopt.getopt(sys.argv[2:], "t:s:", ["tab=", "sort="])[0]
except getopt.GetoptError:
    pass

optional_args = False
for opt, arg in opts:
    if opt in ("-t", "--tab", "-s", "--sort"):
        optional_args = True
        break

if len(sys.argv) > 1:
    module = sys.argv[1]
    if module in ("applets", "desklets", "extensions") and len(sys.argv) > 2 and sys.argv[2][0:5] != "panel":
        if not optional_args:
            os.execvp("/usr/share/cinnamon/cinnamon-settings/xlet-settings.py", (" ", module[0:-1]) + tuple(sys.argv[2:]))
        elif os.path.exists("/usr/share/cinnamon/cinnamon-settings/modules/cs_%s.py" % module):
            os.execvp("/usr/share/cinnamon/cinnamon-settings/cinnamon-settings.py", (" ",) + tuple(sys.argv[1:]))
    elif os.path.exists("/usr/share/cinnamon/cinnamon-settings/modules/cs_%s.py" % module):
        os.execvp("/usr/share/cinnamon/cinnamon-settings/cinnamon-settings.py", (" ",) + tuple(sys.argv[1:]))
    elif shutil.which("cinnamon-control-center"):
        os.execvp("/usr/share/cinnamon/cinnamon-settings/cinnamon-settings.py", (" ",) + tuple(sys.argv[1:]))
    elif shutil.which("gnome-control-center"):
        print ("Unknown module %s, calling gnome-control-center" % module)
        os.execvp("gnome-control-center", (" ",) + tuple(sys.argv[1:]))
    else:
        print ("Unknown module %s" % module)
        os.execvp("/usr/share/cinnamon/cinnamon-settings/cinnamon-settings.py", (" ",) + tuple(sys.argv[1:]))
else:
    os.execvp("/usr/share/cinnamon/cinnamon-settings/cinnamon-settings.py", (" ",) + tuple(sys.argv[1:]))
