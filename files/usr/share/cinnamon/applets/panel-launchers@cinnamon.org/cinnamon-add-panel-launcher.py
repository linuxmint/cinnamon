#! /usr/bin/python -OOt

from gi.repository import Gtk
from gi.repository import Gdk
from gi.repository import Gio
from os.path import expanduser
from time import sleep as wait
import os
import os.path
import inspect
import sys
import gettext

gettext.install("cinnamon", "/usr/share/cinnamon/locale")
Settings = Gio.Settings.new("org.cinnamon")

_ = gettext.gettext

class Namespace: pass

iface = Namespace()

oldDesktopName = ""
newDesktopName = ""
appName = ""
appPath = ""
iconPath = ""

editMode = len(sys.argv) > 1
if editMode:
    oldDesktopName = sys.argv[1]
    appName = sys.argv[2]
    appPath = sys.argv[3]
    iconPath = sys.argv[4]

def updatePreviewIcon(name):
    global iface
    if os.path.exists(name):
        iface.preview_icon.set_from_file(name)
    else:
        iface.preview_icon.set_from_icon_name(name, 6)

def editOrAddLaunchers():
    makeLauncher()
    global Settings, desktopName
    desktopFiles = Settings.get_strv('panel-launchers')
    if not editMode:
        desktopFiles.append(newDesktopName)
    else:
        i = desktopFiles.index(oldDesktopName)
        if i >= 0:
            del desktopFiles[i]
            desktopFiles.insert(i, newDesktopName)
    Settings.set_strv('panel-launchers', desktopFiles)
    Gtk.main_quit(None)

def makeLauncher():
    global appName, appPath, iconPath, custom_launchers_path, newDesktopName
    description = _("Custom Launcher")
    i = 1
    dir = Gio.file_new_for_path(custom_launchers_path)
    if not dir.query_exists(None):
        dir.make_directory_with_parents(None)
    
    file = Gio.file_parse_name(custom_launchers_path + '/cinnamon-custom-launcher-' + str(i) + '.desktop')
    while file.query_exists(None):
        i = i + 1
        file = Gio.file_parse_name(custom_launchers_path + '/cinnamon-custom-launcher-' + str(i) + '.desktop')
    file = open(custom_launchers_path+ '/cinnamon-custom-launcher-' + str(i) + '.desktop', "w")
    
    desktopEntry = "[Desktop Entry]\nName=" + appName + "\nExec=" + appPath + "\nType=Application\n"
    desktopEntry = desktopEntry + "Description=" + description + "\n"
    if iconPath == "":
        iconPath = "application-x-executable"
    desktopEntry += "Icon=" + iconPath + "\n"    
    print desktopEntry
    file.write(desktopEntry)
    file.close()
    newDesktopName = 'cinnamon-custom-launcher-' + str(i) + '.desktop'

class Handler:
    def onDeleteWindow(self, *args):
        Gtk.main_quit(*args)

    def onAdd(self, button):
        global appPath, appName
        if appPath == "" or appName == "":
            return
        else:
            editOrAddLaunchers()
        
    def onIconPicked(self, *args):
        global iconPath, iface
        iconPath = iface.icon_picker.get_uri()[7:]
        iconPath = iconPath.strip().replace("%20", " ")
        iface.icon_path.set_text(iconPath)
        updatePreviewIcon(iconPath)
        
    def onAppPicked(self, *args):
        global appPath, iface
        appPath = iface.app_picker.get_uri()[7:]
        appPath = appPath.strip().replace(" ", "\ ").replace("%20", "\ ")
        iface.file_path.set_text(appPath)

    def onNameChanged(self, *args):
        global appName, iface
        appName = iface.app_name.get_text().strip()
        
    def onAppChanged(self, *args):
        global appPath, iface
        appPath = iface.file_path.get_text().strip()
        
    def onIconChanged(self, *args):
        global iconPath, iface
        iconPath = iface.icon_path.get_text().strip()
        updatePreviewIcon(iconPath)

builder = Gtk.Builder()

userhome = expanduser("~")
custom_launchers_path = userhome + "/.cinnamon/panel-launchers"

applet_dir = os.path.dirname(inspect.getfile(inspect.currentframe()))
builder.add_from_file(applet_dir + "/cinnamon-add-panel-launcher.glade")

window = builder.get_object("add-panel-launcher-dialog")
builder.connect_signals(Handler())

iface.add_button = builder.get_object("add_button")
iface.cancel_button = builder.get_object("cancel_button")
iface.preview_icon = builder.get_object("icon")
iface.app_name = builder.get_object("app_name")
iface.file_path = builder.get_object("app_path")
iface.icon_path = builder.get_object("icon_path")
iface.app_picker = builder.get_object("app_picker")
iface.icon_picker = builder.get_object("icon_picker")


# set static translations (labels, etc..)
builder.get_object("name_label").set_markup(_("Name"))
builder.get_object("application_label").set_markup(_("Application"))
builder.get_object("icon_label").set_markup(_("Icon"))
builder.get_object("cancel_button").set_label(_("Cancel"))
builder.get_object("add-panel-launcher-dialog").set_title(_("Add panel launcher..."))

if editMode:
    iface.app_name.set_text(appName)
    iface.file_path.set_text(appPath)
    iface.icon_path.set_text(iconPath)
    iface.add_button.set_label(_("Update"))
    updatePreviewIcon(iconPath)
else:
    iface.add_button.set_label(_("Add"))

window.show_all()
Gtk.main()
