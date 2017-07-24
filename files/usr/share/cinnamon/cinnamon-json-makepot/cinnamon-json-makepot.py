#!/usr/bin/python2

import sys
import os
import json
import subprocess
import tempfile
from optparse import OptionParser

from gi.repository import GLib

try:
    import polib
except:
    print """

    Module "polib" not available.

    Please install the package "python-polib" and try again

    """
    quit()

home = os.path.expanduser("~")
locale_inst = '%s/.local/share/locale' % home


def remove_empty_folders(path):
    if not os.path.isdir(path):
        return

    # remove empty subfolders
    files = os.listdir(path)
    if len(files):
        for f in files:
            fullpath = os.path.join(path, f)
            if os.path.isdir(fullpath):
                remove_empty_folders(fullpath)

    # if folder empty, delete it
    files = os.listdir(path)
    if len(files) == 0:
        print "Removing empty folder:", path
        os.rmdir(path)


class Main:
    def __init__(self):

        usage = """
            Usage:

            cinnamon-json-makepot -i | -r | -k | [-js] <potfile name>

            -js, --js - Runs xgettext on any javascript files in your directory before
                  scanning the settings-schema.json file.  This allows you to generate
                  a .pot file for your entire applet at once.

                ***
                The following two options should only be run in your applet, desklet, or
                extension's directory
                ***

            -i, --install - Compiles and installs any .po files contained in a po folder
                  to the system locale store.  Use this option to test your translations
                  locally before uploading to Spices.  It will use the applet, desklet,
                  or extension UUID as the translation domain

            -r, --remove - The opposite of install, removes translations from the store.
                  Again, it uses the UUID to find the correct files to remove

            -k, --keyword - Change the variable name gettext is assigned to in your
                  javascript files. The default is _.

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

        parser = OptionParser(usage=usage)
        parser.add_option("-j", "--js", action="store_true", dest="js", default=False)
        parser.add_option("-i", "--install", action="store_true", dest="install", default=False)
        parser.add_option("-r", "--remove", action="store_true", dest="remove", default=False)
        parser.add_option("-k", "--keyword", type="str", dest="keyword", default="_")

        (options, args) = parser.parse_args()

        if options.install:
            self.do_install()

        if options.remove:
            self.do_remove()

        if not args:
            parser.print_help()
            quit()

        self.potname = args[0]

        if not self.potname.endswith(".pot"):
            self.potname = self.potname + ".pot"

        self.domain = self.potname.replace(".pot", "")
        self.potpath = os.path.join(os.getcwd(), self.potname)

        if options.js:
            try:
                import subprocess
                subprocess.call(["xgettext", "--version"])
            except OSError:
                print "xgettext not found, you may need to install the gettext package"
                quit()
            print " "
            print "Running xgettext on JavaScript files..."

            tmp = tempfile.NamedTemporaryFile(prefix="cinnamon-json-makepot-")
            try:
                os.system('find . -iname "*.js" > %s' % tmp.name)
            finally:
                os.system("xgettext --language=JavaScript --keyword=%s --output=%s --files-from=%s" % (
                    options.keyword,
                    self.potname,
                    tmp.name
                ))

        self.current_parent_dir = ""

        append = False
        if os.path.exists(self.potpath):
            append = True

        if append:
            self.po = polib.pofile(self.potpath)
        else:
            self.po = polib.POFile()

        print "Scanning metadata.json and settings-schema.json..."
        self.scan_dirs()

        if append:
            self.po.save()
        else:
            self.po.save(fpath=self.potpath)

        print "Extraction complete"
        quit()

    def get_uuid(self):
        try:
            file = open(os.path.join(os.getcwd(), "metadata.json"), 'r')
            raw_meta = file.read()
            file.close()
            md = json.loads(raw_meta)
            return md["uuid"]
        except Exception, detail:
            print "Failed to get UUID - missing, corrupt, or incomplete metadata.json file"
            print detail
            quit()

    def do_install(self):
        podir = os.path.join(os.getcwd(), "po")
        done_one = False
        for root, subFolders, files in os.walk(podir, topdown=False):
            for file in files:
                parts = os.path.splitext(file)
                if parts[1] == '.po':
                    this_locale_dir = os.path.join(locale_inst, parts[0], 'LC_MESSAGES')
                    GLib.mkdir_with_parents(this_locale_dir, 0755)
                    #print "/usr/bin/msgfmt -c %s -o %s" % (os.path.join(root, file), os.path.join(this_locale_dir, '%s.mo' % self.get_uuid()))
                    subprocess.call(["msgfmt", "-c", os.path.join(root, file), "-o", os.path.join(this_locale_dir, '%s.mo' % self.get_uuid())])
                    done_one = True
        if done_one:
            print "Install complete for domain: %s" % self.get_uuid()
        else:
            print "Nothing installed"
        quit()

    def do_remove(self):
        done_one = False
        if (os.path.exists(locale_inst)):
            i19_folders = os.listdir(locale_inst)
            for i19_folder in i19_folders:
                if os.path.isfile(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', "%s.mo" % self.get_uuid())):
                    done_one = True
                    os.remove(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', "%s.mo" % self.get_uuid()))
                remove_empty_folders(os.path.join(locale_inst, i19_folder))
        if done_one:
            print "Removal complete for domain: %s" % self.get_uuid()
        else:
            print "Nothing to remove"
        quit()

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
                elif file == "metadata.json":
                    fp = open(os.path.join(root, file))
                    data = json.load(fp)
                    fp.close()

                    self.current_parent_dir = os.path.split(root)[1]
                    self.extract_metadata_strings(data)


    def extract_strings(self, data, parent=""):
        for key in data.keys():
            if key in ("description", "tooltip", "units", "title"):
                comment = "%s->settings-schema.json->%s->%s" % (self.current_parent_dir, parent, key)
                self.save_entry(data[key], comment)
            elif key in "options":
                opt_data = data[key]
                for option in opt_data.keys():
                    if opt_data[option] == "custom":
                        continue
                    comment = "%s->settings-schema.json->%s->%s" % (self.current_parent_dir, parent, key)
                    self.save_entry(option, comment)
            elif key == "columns":
                columns = data[key]
                for i, col in enumerate(columns):
                    for col_key in col:
                        if col_key in ("title", "units"):
                            comment = "%s->settings-schema.json->%s->columns->%s" % (self.current_parent_dir, parent, col_key)
                            self.save_entry(col[col_key], comment)
            try:
                self.extract_strings(data[key], key)
            except AttributeError:
                pass

    def extract_metadata_strings(self, data):
        for key in data:
            if key in ("name", "description", "comments"):
                comment = "%s->metadata.json->%s" % (self.current_parent_dir, key)
                self.save_entry(data[key], comment)
            elif key == "contributors":
                comment = "%s->metadata.json->%s" % (self.current_parent_dir, key)

                values = data[key]
                if isinstance(values, basestring):
                    values = values.split(",")

                for value in values:
                    self.save_entry(value.strip(), comment)

    def save_entry(self, msgid, comment):
        try:
            msgid = msgid.encode("ascii")
        except UnicodeEncodeError:
            return

        if not msgid.strip():
            return

        entry = self.po.find(msgid)
        if entry:
            if comment not in entry.comment:
                if entry.comment:
                    entry.comment += "\n"
                entry.comment += comment
        else:
            entry = polib.POEntry(msgid = msgid, comment = comment)
            self.po.append(entry)

if __name__ == "__main__":
    Main()
