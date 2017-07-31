#!/usr/bin/python3

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')
import sys
sys.path.append('/usr/share/cinnamon/cinnamon-settings/bin')
import gettext
import json
from JsonSettingsWidgets import *
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
    def __init__(self, xlet_type, uuid, instance_id=None):
        self.type = xlet_type
        self.uuid = uuid
        self.selected_instance = None
        self.gsettings = Gio.Settings.new("org.cinnamon")

        self.load_xlet_data()
        self.build_window()
        self.load_instances()
        self.window.show_all()
        if instance_id and len(self.instance_info) > 1:
            for info in self.instance_info:
                if info["id"] == instance_id:
                    self.set_instance(info)
                    break

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

        restore_option = Gtk.MenuItem(_("Import from a file"))
        menu.append(restore_option)
        restore_option.connect("activate", self.restore)
        restore_option.show()

        backup_option = Gtk.MenuItem(_("Export to a file"))
        menu.append(backup_option)
        backup_option.connect("activate", self.backup)
        backup_option.show()

        reset_option = Gtk.MenuItem(_("Reset to defaults"))
        menu.append(reset_option)
        reset_option.connect("activate", self.reset)
        reset_option.show()

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
                for setting in settings_map.keys():
                    if setting == "__md5__":
                        continue
                    for key in settings_map[setting].keys():
                        if key in ("description", "tooltip", "units"):
                            try:
                                settings_map[setting][key] = translate(self.uuid, settings_map[setting][key])
                            except:
                                pass
                        elif key in "options":
                            new_opt_data = collections.OrderedDict()
                            opt_data = settings_map[setting][key]
                            for option in opt_data.keys():
                                if opt_data[option] == "custom":
                                    continue
                                new_opt_data[translate(self.uuid, option)] = opt_data[option]
                            settings_map[setting][key] = new_opt_data
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
            page = SettingsPage()
            page_stack.add_titled(page, page_key, translate(self.uuid, page_def["title"]))
            for section_key in page_def["sections"]:
                section_def = layout[section_key]
                section = page.add_section(translate(self.uuid, section_def["title"]))
                for key in section_def["keys"]:
                    item = settings_map[key]
                    settings_type = item["type"]
                    if settings_type == "button":
                        widget = XLETSettingsButton(item, self.uuid, info["id"])
                        section.add_row(widget)
                    elif settings_type == "label":
                        widget = Text(translate(self.uuid, item["description"]))
                        section.add_row(widget)
                    elif settings_type in XLET_SETTINGS_WIDGETS:
                        widget = globals()[XLET_SETTINGS_WIDGETS[settings_type]](key, info["settings"], item)
                        section.add_row(widget)

    def build_from_order(self, settings_map, info, box, first_key):
        page = SettingsPage()
        box.pack_start(page, True, True, 0)

        # if the first key is not of type 'header' or type 'section' we need to make a new section
        if first_key["type"] not in ("header", "section"):
            section = page.add_section(_("Settings for %s") % self.uuid)

        for key, item in settings_map.items():
            if key == "__md5__":
                continue
            if "type" in item.keys():
                settings_type = item["type"]
                if settings_type in ("header", "section"):
                    section = page.add_section(translate(self.uuid, item["description"]))
                elif settings_type == "button":
                    widget = XLETSettingsButton(item, self.uuid, info["id"])
                    section.add_row(widget)
                elif settings_type == "label":
                    widget = Text(translate(self.uuid, item["description"]))
                    section.add_row(widget)
                elif settings_type in XLET_SETTINGS_WIDGETS:
                    widget = globals()[XLET_SETTINGS_WIDGETS[settings_type]](key, info["settings"], item)
                    section.add_row(widget)

    def notify_dbus(self, handler, key, value):
        proxy.updateSetting('(ssss)', self.uuid, handler.instance_id, key, json.dumps(value))

    def set_instance(self, info):
        self.instance_stack.set_visible_child_name(info["id"])
        if "stack" in info:
            self.stack_switcher.set_stack(info["stack"])
            children = info["stack"].get_children()
            if len(children) > 1:
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

    def quit(self, *args):
        if proxy:
            proxy.highlightXlet('(ssb)', self.uuid, self.selected_instance["id"], False)

        self.window.destroy()
        Gtk.main_quit()

if __name__ == "__main__":
    import signal
    if len(sys.argv) < 3:
        print("Error: requres type and uuid")
        quit()
    xlet_type = sys.argv[1]
    if xlet_type not in ["applet", "desklet", "extension"]:
        print("Error: Invalid xlet type %s", sys.argv[1])
        quit()
    uuid = sys.argv[2]
    window = MainWindow(xlet_type, *sys.argv[2:])
    signal.signal(signal.SIGINT, window.quit)
    Gtk.main()
