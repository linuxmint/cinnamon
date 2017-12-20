#!/usr/bin/python3
#-*-indent-tabs-mode: nil-*-

import sys
import os.path

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gio

SCHEMAS = "org.cinnamon.desklets.launcher"
LAUNCHER_KEY = "launcher-list"

HOME_DIR = os.path.expanduser("~")+"/"
CUSTOM_LAUNCHERS_PATH = HOME_DIR + ".cinnamon/panel-launchers/"
EDITOR_DIALOG_UI_PATH = "/usr/share/cinnamon/desklets/launcher@cinnamon.org/editorDialog.ui"

class EditorDialog:
    def __init__(self, desklet_id=-1):
        self.launcher_settings = Gio.Settings.new(SCHEMAS)
        self.launcher_type = "Application"
        self.name = ""
        self.desklet_id = desklet_id

        if not desklet_id == -1:
            launcher_list = self.launcher_settings.get_strv(LAUNCHER_KEY)
            launcher = ""
            for item in launcher_list:
                if item.split(":")[0] == str(self.desklet_id):
                    launcher = item.split(":")[1][:-8]
                    break;

            self.name = launcher
            if self.name[:24] == "cinnamon-custom-launcher":
                self.launcher_type = "Custom Application"

        self.tree = Gtk.Builder()
        self.tree.add_from_file(EDITOR_DIALOG_UI_PATH)

        self.dialog = self.tree.get_object("dialog")
        self.launcher_type_combo_box = self.tree.get_object("launcher_type_combo_box")
        self.name_entry = self.tree.get_object("name_entry")
        self.title_entry = self.tree.get_object("title_entry")
        self.command_entry = self.tree.get_object("command_entry")
        self.icon_name_entry = self.tree.get_object("icon_name_entry")
        self.launcher_icon = self.tree.get_object("launcher_icon")

        self.name_entry.set_text(self.name)

        self.model = self.launcher_type_combo_box.get_model()
        self.citer = [self.model.get_iter_from_string("0"),self.model.get_iter_from_string("1")]

        self.launcher_type_combo_box.set_active_iter(self.citer[self.launcher_type_to_index(self.launcher_type)])
        self.update_sensitivity()
        self.set_fields_by_name()
        self.on_icon_changed(self.icon_name_entry.get_text())

        self.tree.connect_signals(self)

        self.dialog.show_all()
        self.dialog.connect("destroy", Gtk.main_quit)
        self.dialog.connect("key_release_event", self.on_key_release_event)
        Gtk.main()

    def launcher_type_to_index(self,launcher_type):
        if launcher_type == "Application":
            return 0
        elif launcher_type == "Custom Application":
            return 1

    def update_sensitivity(self):
        sensitive = True
        if (self.launcher_type == "Application"):
            sensitive = False

        self.name_entry.set_sensitive(not sensitive)
        self.title_entry.set_sensitive(sensitive)
        self.command_entry.set_sensitive(sensitive)
        self.icon_name_entry.set_sensitive(sensitive)
        if (self.launcher_type == "Application"):
            self.name_entry.grab_focus()
        else:
            self.title_entry.grab_focus()

    def on_launcher_type_combo_box_changed(self, widget):
        self.launcher_type = self.launcher_type_combo_box.get_active_text()
        self.update_sensitivity()
        self.on_name_changed(self.name_entry)

    def on_icon_changed(self, widget):
        self.launcher_icon.set_from_icon_name(self.icon_name_entry.get_text(), 48)

    def on_name_changed(self, widget):
        if (self.launcher_type == "Application"):
            self.set_fields_by_name()

    def set_fields_by_name(self):
        application = Application(self.name_entry.get_text() + ".desktop")
        if application.title:
            self.title_entry.set_text(application.title)
            self.command_entry.set_text(application.command)
            self.icon_name_entry.set_text(application.icon_name)

    def on_key_release_event(self, widget, event):
        if event.keyval == 65293: # Enter button
            self.on_edit_ok_clicked(widget)

    def on_edit_close_clicked(self, widget):
        self.dialog.destroy()

    def on_edit_ok_clicked(self, widget):
        if not self.name_entry.get_text():
            return None

        if (self.launcher_type == "Application"):
            launcher_name = self.name_entry.get_text() + ".desktop"
        elif (self.launcher_type == "Custom Application"):
            launcher_name = self.write_custom_application()

        enabled_desklets = None

        if self.desklet_id == -1: # Add new launcher
            settings = Gio.Settings.new("org.cinnamon")
            self.desklet_id = settings.get_int("next-desklet-id")
            settings.set_int("next-desklet-id", self.desklet_id + 1)

            enabled_desklets = settings.get_strv("enabled-desklets")
            enabled_desklets.append("launcher@cinnamon.org:%s:0:100" % self.desklet_id)

        launcher_list = self.launcher_settings.get_strv(LAUNCHER_KEY)

        # If the application is initiall set in the list, remove them all
        for item in launcher_list:
            if item.split(":")[0] == str(self.desklet_id):
                launcher_list.remove(item)

        launcher_list.append(str(self.desklet_id) + ":" + launcher_name)
        self.launcher_settings.set_strv(LAUNCHER_KEY, launcher_list)

        # Update desklets list now if new desklet is made
        if enabled_desklets:
            settings.set_strv("enabled-desklets", enabled_desklets)

        self.dialog.destroy()

    def get_custom_id(self):
        i = 1
        directory = Gio.file_new_for_path(CUSTOM_LAUNCHERS_PATH)
        if not directory.query_exists(None):
            directory.make_directory_with_parents(None)

        fileRec = Gio.file_parse_name(CUSTOM_LAUNCHERS_PATH + 'cinnamon-custom-launcher-' + str(i) + '.desktop')
        while fileRec.query_exists(None):
            i = i + 1
            fileRec = Gio.file_parse_name(CUSTOM_LAUNCHERS_PATH + 'cinnamon-custom-launcher-' + str(i) + '.desktop')

        return i;

    def write_custom_application(self):
        i = self.get_custom_id();

        file_name = "cinnamon-custom-launcher-" + str(i) + ".desktop"
        file_path = CUSTOM_LAUNCHERS_PATH + file_name

        title = self.title_entry.get_text()
        command = self.command_entry.get_text()
        icon_name = self.icon_name_entry.get_text()
        _file = open(file_path,"w+")

        write_list=["[Desktop Entry]\n","Type=Application\n", "Name=" + title + "\n","Exec=" + command + "\n","Icon=" + icon_name + "\n"]

        _file.writelines(write_list)
        _file.close()

        return file_name


class Application:
    def __init__(self, file_name):
        self.file_name = file_name
        self._path = None
        self.icon_name = None
        self.title = None
        self.command = None

        if (os.path.exists(CUSTOM_LAUNCHERS_PATH + file_name)):
            self._path = CUSTOM_LAUNCHERS_PATH + file_name
        elif (os.path.exists("/usr/share/applications/" + file_name)):
            self._path = "/usr/share/applications/" + file_name

        if self._path:
            self._file = open(self._path, "r")
            while self._file:
                line = self._file.readline()
                if len(line)==0:
                    break

                if (line.find("Name") == 0 and (not "[" in line)):
                    self.title = line.replace("Name","").replace("=","").replace("\n","")

                if (line.find("Icon") == 0):
                    self.icon_name = line.replace("Icon","").replace(" ","").replace("=","").replace("\n","")

                if (line.find("Exec") == 0):
                    self.command = line.replace("Exec","").replace("=","").replace("\n","")

                if self.icon_name and self.title and self.command:
                    break

            if not self.icon_name:
                self.icon_name = "application-x-executable"
            if not self.title:
                self.title = "Application"
            if not self.command:
                self.command = ""
            self._file.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        dialog = EditorDialog(sys.argv[1])
    else:
        dialog = EditorDialog()
