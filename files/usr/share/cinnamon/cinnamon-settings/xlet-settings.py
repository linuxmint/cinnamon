#!/usr/bin/python3

from bin import util
util.strip_syspath_locals()

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')

import os
import sys
from setproctitle import setproctitle
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin"))
import gettext
import json
import argparse
import importlib.util
import traceback
from pathlib import Path

from JsonSettingsWidgets import *
from ExtensionCore import find_extension_subdir
from gi.repository import Gtk, Gio, XApp, GLib

# i18n
gettext.install("cinnamon", "/usr/share/locale")

home = os.path.expanduser("~")
settings_dir = os.path.join(GLib.get_user_config_dir(), 'cinnamon', 'spices')
old_settings_dir = '%s/.cinnamon/configs/' % home

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
        except (AttributeError, UnicodeDecodeError):
            result = result

        if result != string:
            return result
    return _(string)

class MainWindow(object):
    def __init__(self, args):
        self.type = args.type
        self.uuid = args.uuid
        self.tab = 0
        self.instance_info = []
        self.instance_id = str(args.id)
        if args.tab is not None:
            self.tab = int(args.tab)

        self.selected_instance = None
        self.gsettings = Gio.Settings.new("org.cinnamon")
        self.monitors = {}
        self.g_directories = []
        self.custom_modules = {}
        if self.type == "applet": changed_key = "enabled-applets"
        elif self.type == "desklet": changed_key = "enabled-desklets"
        else: changed_key = None
        if changed_key:
            self.gsettings.connect("changed::" + changed_key, lambda *args: self.on_enabled_xlets_changed(changed_key, *args))

        self.load_xlet_data()
        self.build_window()
        self.load_instances()
        self.window.show_all()
        if self.instance_id and len(self.instance_info) > 1:
            for info in self.instance_info:
                if info["id"] == self.instance_id:
                    self.set_instance(info)
                    break
        else:
            self.set_instance(self.instance_info[0])
        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", None, self._on_proxy_ready, None)
        except dbus.exceptions.DBusException as e:
            print(e)

    def _on_proxy_ready (self, obj, result, data=None):
        global proxy
        proxy = Gio.DBusProxy.new_for_bus_finish(result)

        if not proxy.get_name_owner():
            proxy = None

        if proxy:
            self.highlight_xlet(self.selected_instance, True)

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
        toolbar.set_show_arrow(False)
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
        scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER)
        main_box.pack_start(scw, True, True, 0)
        self.instance_stack = Gtk.Stack()
        scw.add(self.instance_stack)

        if "icon" in self.xlet_meta:
            self.window.set_icon_name(self.xlet_meta["icon"])

        icon_path = os.path.join(self.xlet_dir, "icon.svg")
        if os.path.exists(icon_path):
            self.window.set_icon_from_file(icon_path)
        else:
            icon_path = os.path.join(self.xlet_dir, "icon.png")
            if os.path.exists(icon_path):
                self.window.set_icon_from_file(icon_path)

        self.window.set_title(translate(self.uuid, self.xlet_meta["name"]))

        def check_sizing(widget, data=None):
            natreq = self.window.get_preferred_size()[1]
            monitor = Gdk.Display.get_default().get_monitor_at_window(self.window.get_window())

            height = monitor.get_workarea().height
            if natreq.height > height - 100:
                self.window.resize(800, 600)
                scw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        self.window.connect("destroy", self.quit)
        self.window.connect("realize", check_sizing)
        self.prev_button.connect("clicked", self.previous_instance)
        self.next_button.connect("clicked", self.next_instance)

    def load_instances(self):
        path = Path(os.path.join(settings_dir, self.uuid))
        old_path = Path("%s/.cinnamon/configs/%s" % (home, self.uuid))
        for p in path, old_path:
            if not p.exists(): continue
            self.g_directories.append(Gio.File.new_for_path(str(p)))

        new_items = os.listdir(path) if path.exists() else []
        old_items = os.listdir(old_path) if old_path.exists() else []
        dir_items = sorted(new_items + old_items)
        shared_panels = json.loads(self.gsettings.get_string("shared-panels"))

        try:
            multi_instance = int(self.xlet_meta["max-instances"]) != 1
        except (KeyError, ValueError):
            multi_instance = False

        enabled = [x.split(":") for x in self.gsettings.get_strv('enabled-%ss' % self.type)]
        for item in dir_items:
            applet_info = {}
            # ignore anything that isn't json
            if item[-5:] != ".json":
                continue

            instance_id = item[0:-5]
            if not multi_instance and instance_id != self.uuid:
                continue # for single instance the file name should be [uuid].json

            if multi_instance:
                try:
                    int(instance_id)
                except (TypeError, ValueError):
                    traceback.print_exc()
                    continue # multi-instance should have file names of the form [instance-id].json

                instance_exists = False
                for definition in enabled:
                    if self.uuid in definition and instance_id in definition:
                        instance_exists = True
                        if self.type == "applet":
                            applet_info.update(
                                panel = int(definition[0].split("panel")[1]),
                                location = definition[1],
                                order = definition[2]
                            )
                        break

                if not instance_exists:
                    continue
            elif self.type == "applet":
                first = True
                for definition in enabled:
                    panel_id = int(definition[0].split("panel")[1])
                    if self.uuid not in definition or panel_id not in shared_panels: continue
                    if first:
                        applet_info.update(
                            panel = panel_id,
                            location = definition[1],
                            order = definition[2]
                        )
                        first = False
                    applet_info.setdefault("extra_infos", []).append({"panel": panel_id, "id": definition[-1]})

            config_path = os.path.join(path if item in new_items else old_path, item)
            self.create_settings_page(config_path, applet_info)

        if not self.instance_info:
            print(f"No instances were found for {self.uuid}. Exiting...")
            sys.exit()

        self.next_button.set_no_show_all(True)
        self.prev_button.set_no_show_all(True)
        self.show_prev_next_buttons() if self.has_multiple_instances() and not self.has_only_shared_instances()\
            else self.hide_prev_next_buttons()

    def create_settings_page(self, config_path, applet_info = {}):
        instance_id = os.path.basename(config_path)[:-5]
        if self.instance_stack.get_child_by_name(instance_id) is not None: return
        settings = JSONSettingsHandler(config_path, self.notify_dbus)
        settings.instance_id = instance_id
        instance_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.instance_stack.add_named(instance_box, instance_id)
        info = {"settings": settings, "id": instance_id}
        infos = [info]

        if applet_info:
            info.update(
                panel = applet_info["panel"],
                location = applet_info["location"],
                order = applet_info["order"]
            )
            for i, extra_info in enumerate(applet_info.get("extra_infos", [])):
                if i == 0:
                    info.update(extra_info)
                    continue
                info_copy = info.copy()
                info_copy.update(extra_info)
                infos.append(info_copy)

        self.instance_info.extend(infos)
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
                        except (KeyError, ValueError):
                            traceback.print_exc()
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

    def has_multiple_instances(self):
        return len(self.instance_info) > 1

    def has_only_shared_instances(self):
        if self.type != "applet": return False
        shared_panels = json.loads(self.gsettings.get_string("shared-panels"))
        first = self.instance_info[0]
        return all(
            info["panel"] in shared_panels
            and info["location"] == first["location"]
            and info["order"] == first["order"]
            for info in self.instance_info
        )

    def hide_prev_next_buttons(self):
        self.prev_button.hide()
        self.next_button.hide()

    def show_prev_next_buttons(self):
        self.prev_button.show()
        self.next_button.show()

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
                elif not isinstance(page, SettingsPage):
                    print('page is not of type SettingsPage')
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

        except KeyError:
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
            old_info = self.selected_instance
            new_info = info
            self.highlight_xlet(old_info, False)
            self.highlight_xlet(new_info, True)
        self.selected_instance = info

    def highlight_xlet(self, info, highlighted):
        try:
            proxy.highlightXlet('(ssb)', self.uuid, info["id"], highlighted)
        except:
            return

    def previous_instance(self, *args):
        self.get_next_instance(False)

    def next_instance(self, *args):
        self.get_next_instance()

    def get_next_instance(self, positive_direction = True):
        transition = Gtk.StackTransitionType.OVER_LEFT if positive_direction else Gtk.StackTransitionType.OVER_RIGHT
        self.instance_stack.set_transition_type(transition)
        step = 1 if positive_direction else -1
        start = self.instance_info.index(self.selected_instance)
        next_index = self.get_next_not_shared_index(start, step)
        self.set_instance(self.instance_info[next_index])

    def get_next_not_shared_index(self, start, step):
        next_index = (start + step) % len(self.instance_info)
        if self.type != "applet": return next_index
        shared_panels = json.loads(self.gsettings.get_string("shared-panels"))
        if self.selected_instance["panel"] in shared_panels and self.instance_info[next_index]["panel"] in shared_panels:
            current = self.selected_instance
            while next_index != start:
                info = self.instance_info[next_index]
                if (info["panel"] not in shared_panels
                    or info["location"] != current["location"]
                    or info["order"] != current["order"]
                ):
                    break
                next_index = (next_index + step) % len(self.instance_info)
                continue

        return next_index

    def on_enabled_xlets_changed(self, key, *args):
        """
        Args:
            key ("enabled-applets"|"enabled-desklets")
        """
        current_ids = {info["id"] for info in self.instance_info}
        new_ids = set()
        new_instances = {}
        added_instances = {}
        for definition in self.gsettings.get_strv(key):
            definition = definition.split(":")
            uuid, instance_id = (definition[-2], definition[-1]) if key == "enabled-applets"\
                else (definition[0], definition[1])
            if uuid != self.uuid: continue
            new_ids.add(instance_id)
            if self.type == "applet":
                new_instances[instance_id] = {
                    "panel": int(definition[0].split("panel")[1]),
                    "location": definition[1],
                    "order": definition[2]
                }
                if instance_id in current_ids: continue
                added_instances[instance_id] = new_instances[instance_id]

        added_ids = new_ids - current_ids

        removed_indices = []
        selected_removed_index = -1
        for i, info in enumerate(self.instance_info):
            if info["id"] in new_ids: continue
            removed_indices.append(i)
            if info == self.selected_instance: selected_removed_index = i

        if len(current_ids) + len(added_ids) == len(removed_indices):
            self.quit()
            return

        if self.type == "applet":
            for info in self.instance_info:
                updated = new_instances.get(info["id"], {})
                info.update(updated)

        for id in added_ids:
            for dir in self.g_directories:
                file = dir.get_child(id + ".json")
                if file.query_exists(None):
                    added_instance = added_instances.get(id)
                    if added_instance: self.create_new_settings_page(file.get_path(), **added_instance)
                    else: self.create_new_settings_page(file.get_path())
                    continue
                # Config files have not been added yet, need to monitor directories
                monitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, None)
                monitor.connect("changed", lambda *args: self.on_config_file_added(added_instances, *args))
                self.monitors.setdefault(id, []).append(monitor)

        if (selected_removed_index != -1):
            self.get_next_instance()

        for index in sorted(removed_indices, reverse=True):
            self.monitors.get(self.instance_info[index]["id"], []).clear()
            self.instance_stack.remove(self.instance_stack.get_child_by_name(self.instance_info[index]["id"]))
            self.instance_info.pop(index)

        if not self.has_multiple_instances() or self.has_only_shared_instances(): self.hide_prev_next_buttons()

    def on_config_file_added(self, added_instances, *args):
        file, event_type = args[1], args[-1]
        instance = file.get_basename()[:-5]
        if event_type != Gio.FileMonitorEvent.CHANGES_DONE_HINT : return
        if instance not in self.monitors: return
        for monitor in self.monitors[instance]: monitor.cancel()
        del self.monitors[instance]
        applet_info = added_instances.get(instance, {})
        self.create_new_settings_page(file.get_path(), applet_info)


    def create_new_settings_page(self, path, applet_info = {}):
        self.create_settings_page(path, applet_info)
        self.window.show_all()
        if self.has_multiple_instances() and not self.has_only_shared_instances(): self.show_prev_next_buttons()
        self.highlight_xlet(self.selected_instance, True)

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
            self.highlight_xlet(self.selected_instance, False)
        self.window.destroy()
        Gtk.main_quit()

if __name__ == "__main__":
    setproctitle("xlet-settings")
    import signal

    parser = argparse.ArgumentParser(
        description="xlet-settings - Configuration tool for Cinnamon xlets",
    )
    parser.add_argument("type", type=str, metavar="type", choices=("applet", "desklet", "extension"), help='The type of xlet to configure - applet, extension or desklet.')
    parser.add_argument("uuid", type=str, help="The UUID of the xlet")
    parser.add_argument("-i", "--id", type=int, default=None, metavar="instance_id", help="If a UUID is provided, this is the instance id.")
    parser.add_argument("-t", "--tab", type=int, default=None, metavar="tab_number", help="Tab index to open.")

    args = parser.parse_args()

    window = MainWindow(args)
    signal.signal(signal.SIGINT, window.quit)
    Gtk.main()
