#!/usr/bin/env python

import sys
import os
import json
try:
    import polib
except:
    print """

    Module "polib" not available.

    Please install the package "python-polib" and try again

    """
    quit()


class Main:
    def __init__(self):
        if (len(sys.argv) < 2 or len(sys.argv) > 3) or \
           (len(sys.argv) == 2 and sys.argv[1] == "-js") or \
           (len(sys.argv) == 3 and sys.argv[1] != "-js"):
            print """
            Usage:

            cinnamon-json-makepot [-js] <potfile name>

            -js - Runs xgettext on any javascript files in your directory before
                  scanning the settings-schema.json file.  This allows you to generate
                  a .pot file for your entire applet at once.

            <potfile name> - name of the .pot file to work with.  This can be pre-existing,
            or the name of a new file to use.  If you leave off the .pot extension, it will
            be automatically appended to the file name.

            For instance:

            cinnamon-json-makepot myapplet

            Will generate a file called myapplet.pot, or append
            to a file of that name.  This can then be used by translators to be
            made into a po file.

            For example:

            msginit --locale=fr --input=myapplet.pot

            Will create "fr.po" for the French language.  A translator can use a utility
            such as poedit to add translations to this file, or edit the file manually.

            .po files can be added to a "po" folder in your applet's directory,
            and will be compiled and installed into the system when the applet is installed
            via Cinnamon Settings.
            """
            quit()

        if len(sys.argv) == 2:
            self.potname = sys.argv[1]
        else:
            self.potname = sys.argv[2]

        if not self.potname.endswith(".pot"):
            self.potname = self.potname + ".pot"

        self.domain = self.potname.replace(".pot", "")
        self.potpath = os.path.join(os.getcwd(), self.potname)

        if sys.argv[1] == "-js":
            try:
                import subprocess
                subprocess.call(["xgettext", "--version"])
            except OSError:
                print "xgettext not found, you may need to install the gettext package"
                exit()
            print " "
            print "Running xgettext on JavaScript files..."
            os.system("xgettext --language=C --keyword=_ --output=%s *.js" % (self.potname))

        self.current_parent_dir = ""

        append = False
        if os.path.exists(self.potpath):
            append = True

        if append:
            self.po = polib.pofile(self.potpath)
        else:
            self.po = polib.POFile()

        print "Scanning settings-schema.json..."
        self.scan_dirs()

        if append:
            self.po.save()
        else:
            self.po.save(fpath=self.potpath)

        print "Extraction complete"

    def scan_dirs(self):
        for root, subFolders, files in os.walk(os.getcwd(), topdown=False):
            for file in files:
                if file == "settings-schema.json":
                    fp = open(os.path.join(root, file))
                    raw = fp.read()
                    data = {}
                    data = json.loads(raw)
                    fp.close()
                    self.current_parent_dir = os.path.split(root)[1]
                    self.extract_strings(data)

    def extract_strings(self, data, parent=""):
        for key in data.keys():
            if key in ("description", "tooltip", "units"):
                comment = "%s->settings-schema.json->%s->%s" % (self.current_parent_dir, parent, key)
                entry = polib.POEntry(comment=comment)
                entry.msgid = data[key]
                self.po.append(entry)
            elif key in "options":
                opt_data = data[key]
                for option in opt_data.keys():
                    if opt_data[option] == "custom":
                        continue
                    comment = "%s->settings-schema.json->%s->%s" % (self.current_parent_dir, parent, key)
                    entry = polib.POEntry(comment=comment)
                    entry.msgid = option
                    self.po.append(entry)
            try:
                self.extract_strings(data[key], key)
            except AttributeError:
                pass

if __name__ == "__main__":
    Main()
