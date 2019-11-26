#!/usr/bin/python3
import getopt
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')

import os
import sys
from setproctitle import setproctitle
import config
sys.path.append(config.currentPath + "/bin")
import gettext
import json
import importlib.util
import traceback

from JsonSettingsWidgets import *
from ExtensionCore import find_extension_subdir
from gi.repository import Gtk, Gio, XApp

# i18n
gettext.install("cinnamon", "/usr/share/locale")

home = os.path.expanduser("~")

translations = {}

proxy = None

XLET_SETTINGS_WIDGETS = {
    "entry"             :   "JSONSettingsEntry",
    "textview"          :   "JSONSettingsTextView",
    "checkbox"          :   "JSONSettingsSwitch", # deprecated: please use switch instead
    "switch"            :   "JSONSettingsSwitch",
    "spinbutton"        :   "JSONSettingsSpinButton",
    "filechooser"       :   "JSONSettingsFileChooser",
    "scale"             :   "JSONSettingsRange",
    "radiogroup"        :   "JSONSettingsComboBox", # deprecated: please use combobox instead
    "combobox"          :   "JSONSettingsComboBox",
    "colorchooser"      :   "JSONSettingsColorChooser",
    "fontchooser"       :   "JSONSettingsFontButton",
    "soundfilechooser"  :   "JSONSettingsSoundFileChooser",
    "iconfilechooser"   :   "JSONSettingsIconChooser",
    "tween"             :   "JSONSettingsTweenChooser",
    "effect"            :   "JSONSettingsEffectChooser",
    "datechooser"       :   "JSONSettingsDateChooser",
    "timechooser"       :   "JSONSettingsTimeChooser",
    "keybinding"        :   "JSONSettingsKeybinding",
    "list"              :   "JSONSettingsList"
}

class XLETSettingsButton(Button):
    def __init__(self, info, uuid, instance_id):
        super(XLETSettingsButton, self).__init__(info["description"])
        self.uuid = uuid
        self.instance_id = instance_id
        self.xletCallback = str(info["callback"])

    def on_activated(self):
        proxy.activateCallback('(sss)', self.xletCallback, self.uuid, self.instance_id)

def translate(uuid, string):
    #check for a translation for this xlet
    if uuid not in translations:
        try:
            translations[uuid] = gettext.translation(uuid, home + "/.local/share/locale").gettext
        except IOError:
            try:
                translations[uuid] = gettext.translation(uuid, "/usr/share/locale").gettext
            except IOError:
                translations[uuid] = None

    #do not translate whitespaces
    if not string.strip():
        return string

    if translations[uuid]:
        result = translations[uuid](string)

        try:
            result = result.decode("utf-8")
        except:
            result = result

        if result != string:
            return result
    return _(string)

class MainWindow(object):
    def __init__(self, xlet_type, uuid, *instance_id):
        ## Respecting preview implementation, add the possibility to open a specific tab (if there
        ## are multiple layouts) and/or a specific instance settings (if there are multiple
        ## instances of a xlet).
        ## To do this, two new arguments:
        ##   -t <n> or --tab=<n>, where <n> is the tab index (starting at 0).
        ##   -i <id> or --id=<id>, where <id> is the id of the instance.
        ## Examples, supposing there are two instances of Cinnamenu@json applet, with ids '210' and
        ## '235' (uncomment line 144 containing print("self.instance_info =", self.instance_info)
        ## to know all instances ids):
        ## (Please note that cinnamon-settings is the one offered in #8333)
        ## cinnamon-settings applets Cinnamenu@json         # opens first tab in first instance
        ## cinnamon-settings applets Cinnamenu@json '235'   # opens first tab in '235' instance
        ## cinnamon-settings applets Cinnamenu@json 235     # idem
        ## cinnamon-settings applets Cinnamenu@json -t 1 -i 235  # opens 2nd tab in '235' instance
        ## cinnamon-settings applets Cinnamenu@json --tab=1 --id=235  # idem
        ## cinnamon-settings applets Cinnamenu@json --tab=1 # opens 2nd tab in first instance
        ## (Also works with 'xlet-settings applet' instead of 'cinnamon-settings applets'.)

        #print("instance_id =", instance_id)
        self.tab = 0
        opts = []
        try:
            instance_id = int(instance_id[0])
        except:
            instance_id = None
            try:
                if len(sys.argv) > 3:
                    opts = getopt.getopt(sys.argv[3:], "t:i:", ["tab=", "id="])[0]
            except getopt.GetoptError:
                pass
            if len(sys.argv) > 4:
                try:
                    instance_id = int(sys.argv[4])
                except ValueError:
                    instance_id = None
        #print("opts =", opts)
        for opt, arg in opts:
            if opt in ("-t", "--tab"):
                if arg.isdecimal():
                    self.tab = int(arg)
            elif opt in ("-i", "--id"):
                if arg.isdecimal():
                    instance_id = int(arg)
        if instance_id:
            instance_id = str(instance_id)
        #print("self.tab =", self.tab)
        #print("instance_id =", instance_id)
        self.type = xlet_type
        self.uuid = uuid
        self.selected_instance = None
        self.gsettings = Gio.Settings.new("org.cinnamon")
        self.custom_modules = {}

        self.load_xlet_data()
        self.build_window()
        self.load_instances()
        #print("self.instance_info =", self.instance_info)
        self.window.show_all()
        if instance_id and len(self.instance_info) > 1:
            for info in self.instance_info:
                if info["id"] == instance_id:
                    self.set_instance(info)
                    break
        else:
            self.set_instance(self.instance_info[0])
        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", None, self._on_proxy_ready, None)
        except dbus.exceptions.DBusException as e:
            print(e)

    def _on_proxy_ready (self, object, result, data=None):
        global proxy
        proxy = Gio.DBusProxy.new_for_bus_finish(result)

        if not proxy.get_name_owner():
            proxy = None

        if proxy:
            proxy.highlightXlet('(ssb)', self.uuid, self.selected_instance["id"], True)

    def load_xlet_data (self):
        self.xlet_dir = "/usr/share/cinnamon/%ss/%s" % (self.type, self.uuid)
        if not os.path.exists(self.xlet_dir):
            self.xlet_dir = "%s/.local/share/cinnamon/%ss/%s" % (home, self.type, self.uuid)

        if os.path.exists("%s/metadata.json" % self.xlet_dir):
            raw_data = open("%s/metadata.json" % self.xlet_dir).read()
            self.xlet_meta = json.loads(raw_data)
        else:
            print("Could not find %s metadata for uuid %s - are you sure it's installed correctly?" % (self.type, self.uuid))
            quit()

    def build_window(self):
        self.window = XApp.GtkWindow()
        self.window.set_default_size(800, 600)
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.window.add(main_box)

        toolbar = Gtk.Toolbar()
        toolbar.get_style_context().add_class("primary-toolbar")
        main_box.add(toolbar)

        toolitem = Gtk.ToolItem()
        toolitem.set_expand(True)
        toolbar.add(toolitem)
        toolbutton_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        toolitem.add(toolbutton_box)
        instance_button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        instance_button_box.get_style_context().add_class("linked")
        toolbutton_box.pack_start(instance_button_box, False, False, 0)

        self.prev_button = Gtk.Button.new_from_icon_name('go-previous-symbolic', Gtk.IconSize.BUTTON)
        self.prev_button.set_tooltip_text(_("Previous instance"))
        instance_button_box.add(self.prev_button)

        self.next_button = Gtk.Button.new_from_icon_name('go-next-symbolic', Gtk.IconSize.BUTTON)
        self.next_button.set_tooltip_text(_("Next instance"))
        instance_button_box.add(self.next_button)

        self.stack_switcher = Gtk.StackSwitcher()
        toolbutton_box.set_center_widget(self.stack_switcher)

        self.menu_button = Gtk.MenuButton()
        image = Gtk.Image.new_from_icon_name("open-menu-symbolic", Gtk.IconSize.BUTTON)
        self.menu_button.add(image)
        self.menu_button.set_tooltip_text(_("More options"))
        toolbutton_box.pack_end(self.menu_button, False, False, 0)

        menu = Gtk.Menu()
        menu.set_halign(Gtk.Align.END)

        restore_option = Gtk.MenuItem(label=_("Import from a file"))
        menu.append(restore_option)
        restore_option.connect("activate", self.restore)
        restore_option.show()

        backup_option = Gtk.MenuItem(label=_("Export to a file"))
        menu.append(backup_option)
        backup_option.connect("activate", self.backup)
        backup_option.show()

        reset_option = Gtk.MenuItem(label=_("Reset to defaults"))
        menu.append(reset_option)
        reset_option.connect("activate", self.reset)
        reset_option.show()

        separator = Gtk.SeparatorMenuItem()
        menu.append(separator)
        separator.show()

        reload_option = Gtk.MenuItem(label=_("Reload %s") % self.uuid)
        menu.append(reload_option)
        reload_option.connect("activate", self.reload_xlet)
        reload_option.show()

        self.menu_button.set_popup(menu)

        scw = Gtk.ScrolledWindow()
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        main_box.pack_start(scw, True, True, 0)
        self.instance_stack = Gtk.Stack()
        scw.add(self.instance_stack)

        if "icon" in self.xlet_meta:
            self.window.set_icon_name(self.xlet_meta["icon"])
        else:
            icon_path = os.path.join(self.xlet_dir, "icon.png")
            if os.path.exists(icon_path):
                self.window.set_icon_from_file(icon_path)
        self.window.set_title(translate(self.uuid, self.xlet_meta["name"]))

        self.window.connect("destroy", self.quit)
        self.prev_button.connect("clicked", self.previous_instance)
        self.next_button.connect("clicked", self.next_instance)

    def load_instances(self):
        self.instance_info = []
        path = "%s/.cinnamon/configs/%s" % (home, self.uuid)
        instances = 0
        dir_items = sorted(os.listdir(path))
        try:
            multi_instance = int(self.xlet_meta["max-instances"]) != 1
        except (KeyError, ValueError):
            multi_instance = False

        for item in dir_items:
            # ignore anything that isn't json
            if item[-5:] != ".json":
                continue

            instance_id = item[0:-5]
            if not multi_instance and instance_id != self.uuid:
                continue # for single instance the file name should be [uuid].json

            if multi_instance:
                try:
                    int(instance_id)
                except:
                    continue # multi-instance should have file names of the form [instance-id].json

                instance_exists = False
                enabled = self.gsettings.get_strv('enabled-%ss' % self.type)
                for deninition in enabled:
                    if uuid in deninition and instance_id in deninition.split(':'):
                        instance_exists = True
                        break

                if not instance_exists:
                    continue

            settings = JSONSettingsHandler(os.path.join(path, item), self.notify_dbus)
            settings.instance_id = instance_id
            instance_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.instance_stack.add_named(instance_box, instance_id)

            info = {"settings": settings, "id": instance_id}
            self.instance_info.append(info)

            settings_map = settings.get_settings()
            first_key = next(iter(settings_map.values()))

            try:
                for setting in settings_map:
                    if setting == "__md5__":
                        continue
                    for key in settings_map[setting]:
                        if key in ("description", "tooltip", "units"):
                            try:
                                settings_map[setting][key] = translate(self.uuid, settings_map[setting][key])
                            except:
                                pass
                        elif key in "options":
                            new_opt_data = collections.OrderedDict()
                            opt_data = settings_map[setting][key]
                            for option in opt_data:
                                if opt_data[option] == "custom":
                                    continue
                                new_opt_data[translate(self.uuid, option)] = opt_data[option]
                            settings_map[setting][key] = new_opt_data
                        elif key in "columns":
                            columns_data = settings_map[setting][key]
                            for column in columns_data:
                                column["title"] = translate(self.uuid, column["title"])
            finally:
                # if a layout is not explicitly defined, generate the settings
                # widgets based on the order they occur
                if first_key["type"] == "layout":
                    self.build_with_layout(settings_map, info, instance_box, first_key)
                else:
                    self.build_from_order(settings_map, info, instance_box, first_key)

                if self.selected_instance is None:
                    self.selected_instance = info
                    if "stack" in info:
                        self.stack_switcher.set_stack(info["stack"])

            instances += 1

        if instances < 2:
            self.prev_button.set_no_show_all(True)
            self.next_button.set_no_show_all(True)

    def build_with_layout(self, settings_map, info, box, first_key):
        layout = first_key

        page_stack = SettingsStack()
        box.pack_start(page_stack, True, True, 0)
        self.stack_switcher.show()
        info["stack"] = page_stack

        for page_key in layout["pages"]:
            page_def = layout[page_key]
            if page_def['type'] == 'custom':
                page = self.create_custom_widget(page_def, info['settings'])
                if page is None:
                    continue
                elif not isinstance(widget, SettingsPage):
                    print('widget is not of type SettingsPage')
                    continue
            else:
                page = SettingsPage()
                for section_key in page_def["sections"]:
                    section_def = layout[section_key]
                    if 'dependency' in section_def:
                        revealer = JSONSettingsRevealer(info['settings'], section_def['dependency'])
                        section = page.add_reveal_section(translate(self.uuid, section_def["title"]), revealer=revealer)
                    else:
                        section = page.add_section(translate(self.uuid, section_def["title"]))
                    for key in section_def["keys"]:
                        item = settings_map[key]
                        settings_type = item["type"]
                        if settings_type == "button":
                            widget = XLETSettingsButton(item, self.uuid, info["id"])
                        elif settings_type == "label":
                            widget = Text(translate(self.uuid, item["description"]))
                        elif settings_type == 'custom':
                            widget = self.create_custom_widget(item, key, info['settings'])
                            if widget is None:
                                continue
                            elif not isinstance(widget, SettingsWidget):
                                print('widget is not of type SettingsWidget')
                                continue
                        elif settings_type in XLET_SETTINGS_WIDGETS:
                            widget = globals()[XLET_SETTINGS_WIDGETS[settings_type]](key, info["settings"], item)
                        else:
                            continue

                        if 'dependency' in item:
                            revealer = JSONSettingsRevealer(info['settings'], item['dependency'])
                            section.add_reveal_row(widget, revealer=revealer)
                        else:
                            section.add_row(widget)
            page_stack.add_titled(page, page_key, translate(self.uuid, page_def["title"]))

    def build_from_order(self, settings_map, info, box, first_key):
        page = SettingsPage()
        box.pack_start(page, True, True, 0)

        # if the first key is not of type 'header' or type 'section' we need to make a new section
        if first_key["type"] not in ("header", "section"):
            section = page.add_section(_("Settings for %s") % self.uuid)

        for key, item in settings_map.items():
            if key == "__md5__":
                continue
            if "type" in item:
                settings_type = item["type"]
                if settings_type in ("header", "section"):
                    if 'dependency' in item:
                        revealer = JSONSettingsRevealer(info['settings'], item['dependency'])
                        section = page.add_reveal_section(translate(self.uuid, item["description"]), revealer=revealer)
                    else:
                        section = page.add_section(translate(self.uuid, item["description"]))
                    continue

                if settings_type == "button":
                    widget = XLETSettingsButton(item, self.uuid, info["id"])
                elif settings_type == "label":
                    widget = Text(translate(self.uuid, item["description"]))
                elif settings_type == 'custom':
                    widget = self.create_custom_widget(item, key, info['settings'])
                    if widget is None:
                        continue
                    elif not isinstance(widget, SettingsWidget):
                        print('widget is not of type SettingsWidget')
                        continue
                elif settings_type in XLET_SETTINGS_WIDGETS:
                    widget = globals()[XLET_SETTINGS_WIDGETS[settings_type]](key, info["settings"], item)
                else:
                    continue

                if 'dependency' in item:
                    revealer = JSONSettingsRevealer(info['settings'], item['dependency'])
                    section.add_reveal_row(widget, revealer=revealer)
                else:
                    section.add_row(widget)

    def create_custom_widget(self, info, *args):
        file_name = info['file']
        widget_name = info['widget']
        file_path = os.path.join(find_extension_subdir(self.xlet_dir), file_name)

        try:
            if file_name not in self.custom_modules:
                spec = importlib.util.spec_from_file_location(self.uuid.replace('@', '') + '.' + file_name.split('.')[0], file_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                self.custom_modules[file_name] = module

        except Exception as e:
            traceback.print_exc()
            print('problem loading custom widget')
            return None

        return getattr(self.custom_modules[file_name], widget_name)(info, *args)

    def notify_dbus(self, handler, key, value):
        proxy.updateSetting('(ssss)', self.uuid, handler.instance_id, key, json.dumps(value))

    def set_instance(self, info):
        self.instance_stack.set_visible_child_name(info["id"])
        if "stack" in info:
            self.stack_switcher.set_stack(info["stack"])
            children = info["stack"].get_children()
            if len(children) > 1:
                if self.tab in range(len(children)):
                    info["stack"].set_visible_child(children[self.tab])
                else:
                    info["stack"].set_visible_child(children[0])
        if proxy:
            proxy.highlightXlet('(ssb)', self.uuid, self.selected_instance["id"], False)
            proxy.highlightXlet('(ssb)', self.uuid, info["id"], True)
        self.selected_instance = info

    def previous_instance(self, *args):
        self.instance_stack.set_transition_type(Gtk.StackTransitionType.OVER_RIGHT)
        index = self.instance_info.index(self.selected_instance)
        self.set_instance(self.instance_info[index-1])

    def next_instance(self, *args):
        self.instance_stack.set_transition_type(Gtk.StackTransitionType.OVER_LEFT)
        index = self.instance_info.index(self.selected_instance)
        if index == len(self.instance_info) - 1:
            index = 0
        else:
            index +=1
        self.set_instance(self.instance_info[index])

    def unpack_args(self, props):
        args = {}

    def backup(self, *args):
        dialog = Gtk.FileChooserDialog(_("Select or enter file to export to"),
                                       None,
                                       Gtk.FileChooserAction.SAVE,
                                       (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                        Gtk.STOCK_SAVE, Gtk.ResponseType.ACCEPT))
        dialog.set_do_overwrite_confirmation(True)
        filter_text = Gtk.FileFilter()
        filter_text.add_pattern("*.json")
        filter_text.set_name(_("JSON files"))
        dialog.add_filter(filter_text)

        response = dialog.run()

        if response == Gtk.ResponseType.ACCEPT:
            filename = dialog.get_filename()
            if ".json" not in filename:
                filename = filename + ".json"
            self.selected_instance["settings"].save_to_file(filename)

        dialog.destroy()

    def restore(self, *args):
        dialog = Gtk.FileChooserDialog(_("Select a JSON file to import"),
                                       None,
                                       Gtk.FileChooserAction.OPEN,
                                       (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                        Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
        filter_text = Gtk.FileFilter()
        filter_text.add_pattern("*.json")
        filter_text.set_name(_("JSON files"))
        dialog.add_filter(filter_text)

        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.selected_instance["settings"].load_from_file(filename)

        dialog.destroy()

    def reset(self, *args):
        self.selected_instance["settings"].reset_to_defaults()

    def reload_xlet(self, *args):
        if proxy:
            proxy.ReloadXlet('(ss)', self.uuid, self.type.upper())

    def quit(self, *args):
        if proxy:
            proxy.highlightXlet('(ssb)', self.uuid, self.selected_instance["id"], False)

        self.window.destroy()
        Gtk.main_quit()

if __name__ == "__main__":
    setproctitle("xlet-settings")
    import signal
    if len(sys.argv) < 3:
        print("Error: requires type and uuid")
        quit()
    xlet_type = sys.argv[1]
    if xlet_type not in ["applet", "desklet", "extension"]:
        print("Error: Invalid xlet type %s", sys.argv[1])
        quit()
    uuid = sys.argv[2]
    window = MainWindow(xlet_type, *sys.argv[2:])
    signal.signal(signal.SIGINT, window.quit)
    Gtk.main()
