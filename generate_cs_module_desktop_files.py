#!/usr/bin/python

import os
import glob
import polib
import sys
from gi.repository import GLib


try:
    sys.path.append('files/usr/lib/cinnamon-settings/modules')
    sys.path.append('files/usr/lib/cinnamon-settings/bin')
    mod_files = glob.glob('files/usr/lib/cinnamon-settings/modules/*.py')
    mod_files.sort()
    if len(mod_files) is 0:
        raise Exception("No settings modules found!!")
    for i in range(len(mod_files)):
        mod_files[i] = mod_files[i].split('/')[5]
        mod_files[i] = mod_files[i].split('.')[0]
        if mod_files[i][0:3] != "cs_":
            raise Exception("Settings modules must have a prefix of 'cs_' !!")
    modules = map(__import__, mod_files)
except Exception, detail:
    print detail
    sys.exit(1)


DESKTOP_GROUP = "Desktop Entry"

DESKTOP_KEY_NAME = "Name"
DESKTOP_KEY_COMMENT = "Comment"
DESKTOP_KEY_EXEC = "Exec"
DESKTOP_KEY_ICON = "Icon"
DESKTOP_KEY_CATEGORIES = "Categories"
DESKTOP_KEY_TYPE = "Type"
DESKTOP_KEY_ONLY_SHOW_IN = "OnlyShowIn"

DESKTOP_TYPE_APPLICATION = "Application"

class KeyFile:
    def __init__(self, mod):
        self.kf_name = "cinnamon-settings-%s.desktop" % (mod.name)
        self.kf = GLib.KeyFile()
        self.kf.set_string(DESKTOP_GROUP, DESKTOP_KEY_NAME, mod.sidePage.name)
        try:
            self.kf.set_string(DESKTOP_GROUP, DESKTOP_KEY_COMMENT, mod.comment)
        except:
            pass
        self.kf.set_string(DESKTOP_GROUP, DESKTOP_KEY_ICON, "/usr/lib/cinnamon-settings/data/icons/%s" % (mod.sidePage.icon))
        self.kf.set_string(DESKTOP_GROUP, DESKTOP_KEY_EXEC, "cinnamon-settings %s" % (mod.name))

        self.kf.set_string(DESKTOP_GROUP, DESKTOP_KEY_TYPE, DESKTOP_TYPE_APPLICATION)
        self.kf.set_string_list(DESKTOP_GROUP, DESKTOP_KEY_ONLY_SHOW_IN, ("GNOME",))

        if mod.category in ("hardware", "admin"):
            self.kf.set_string_list(DESKTOP_GROUP, DESKTOP_KEY_CATEGORIES, ("Settings","System"))
        else:
            self.kf.set_string_list(DESKTOP_GROUP, DESKTOP_KEY_CATEGORIES, ("Settings",))


class Main:
    def __init__(self):
        self.keyfiles = []

        for i in range(len(modules)):
            try:
                mod = modules[i].Module(None)
                keyfile = KeyFile(mod)
                self.keyfiles.append(keyfile)
            except:
                print "Failed to load module %s" % modules[i]
                import traceback
                traceback.print_exc()

        self.mo_files = {}

        if len(self.keyfiles) > 0:
            for root, subFolders, files in os.walk("/usr/share/cinnamon/locale"):
                for file in files:
                    if file == "cinnamon.mo":
                        path, junk = os.path.split(root)
                        path, locale = os.path.split(path)
                        self.mo_files[locale] = polib.mofile(os.path.join(root, file))

        if len(self.mo_files) > 0:
            for locale in self.mo_files.keys():
                for entry in self.mo_files[locale]:
                    self.check_name(locale, entry)
            for locale in self.mo_files.keys():
                for entry in self.mo_files[locale]:
                    self.check_comment(locale, entry)

        for kf in self.keyfiles:
            action_path = os.path.join("files", "usr", "share", "applications", kf.kf_name)
            outstring, length = kf.kf.to_data()
            if os.path.exists(action_path):
                os.remove(action_path)
            outfile = open(action_path, 'w')
            outfile.write(outstring)
            outfile.close()

        print "Cinnamon settings desktop file generation complete."

    def check_name(self, locale, entry):
        if entry.msgstr != '':
            for kf in self.keyfiles:
                try:
                    name = kf.kf.get_string(DESKTOP_GROUP, DESKTOP_KEY_NAME)
                    if name == entry.msgid:
                        kf.kf.set_locale_string(DESKTOP_GROUP, DESKTOP_KEY_NAME, locale, entry.msgstr)
                except GLib.GError:
                    pass

    def check_comment(self, locale, entry):
        if entry.msgstr != '':
            for kf in self.keyfiles:
                try:
                    name = kf.kf.get_string(DESKTOP_GROUP, DESKTOP_KEY_COMMENT)
                    if name == entry.msgid:
                        kf.kf.set_locale_string(DESKTOP_GROUP, DESKTOP_KEY_COMMENT, locale, entry.msgstr)
                except GLib.GError:
                    pass

if __name__ == "__main__":
    Main()
