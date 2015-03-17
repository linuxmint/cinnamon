#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk
from gi.repository.Gtk import SizeGroup, SizeGroupMode


class Module:
    def __init__(self, content_box):
        keywords = _("windows, titlebar, edge, switcher, window list, attention, focus")
        sidePage = SidePage(_("Windows"), "cs-windows", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "windows"
        self.category = "prefs"
        self.comment = _("Manage window preferences")        

    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading Windows module"

            stack = SettingsStack()
            self.sidePage.add_widget(stack)

            self.stack_switcher = Gtk.StackSwitcher()
            self.stack_switcher.set_halign(Gtk.Align.CENTER)
            self.stack_switcher.set_stack(stack)
            self.stack_switcher.set_homogeneous(True)
            switch_container.pack_start(self.stack_switcher, True, True, 0)

            # Titlebar

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            stack.add_titled(vbox, "titlebar", _("Titlebar"))

            section = Section(_("Buttons"))
            
            section.add(TitleBarButtonsOrderSelector())
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Actions"))

            action_options = [["toggle-shade", _("Toggle Shade")], ["toggle-maximize", _("Toggle Maximize")],
                             ["toggle-maximize-horizontally", _("Toggle Maximize Horizontally")], ["toggle-maximize-vertically", _("Toggle Maximize Vertically")],
                             ["toggle-stuck", _("Toggle on all workspaces")], ["toggle-above", _("Toggle always on top")],
                             ["minimize", _("Minimize")], ["menu", _("Menu")], ["lower", _("Lower")], ["none", _("None")]]

            section.add(self._make_titlebar_action_group(_("Action on title bar double-click"),
                                                "org.cinnamon.desktop.wm.preferences", "action-double-click-titlebar",
                                                action_options))
            section.add(self._make_titlebar_action_group(_("Action on title bar middle-click"),
                                                "org.cinnamon.desktop.wm.preferences", "action-middle-click-titlebar",
                                                action_options))
            section.add(self._make_titlebar_action_group(_("Action on title bar right-click"),
                                                "org.cinnamon.desktop.wm.preferences", "action-right-click-titlebar",
                                                action_options))
       
            scroll_options = [["none", _("Nothing")],["shade", _("Shade and unshade")],["opacity", _("Adjust opacity")]]

            combo = self._make_titlebar_action_group(_("Action on title bar with mouse scroll"),
                                                      "org.cinnamon.desktop.wm.preferences", "action-scroll-titlebar",
                                                      scroll_options)
            opacity_spinner = GSettingsSpinButton(_("Minimum opacity:"), "org.cinnamon.desktop.wm.preferences", "min-window-opacity", None, 0, 100, 1, 1, _("%"))
            opacity_spinner.show_all()
            opacity_spinner.set_no_show_all(True)
            combo.pack_start(opacity_spinner, False, False, 2)
            self.wm_settings = Gio.Settings("org.cinnamon.desktop.wm.preferences")
            self.wm_settings.connect("changed::action-scroll-titlebar", self.update_spinner_visibility, opacity_spinner)
            self.update_spinner_visibility(self.wm_settings, "action-scroll-titlebar", opacity_spinner)
            section.add(combo)
            vbox.add(section)

            # Behavior

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            stack.add_titled(vbox, "behavior", _("Behavior"))

            section = Section(_("Window Focus"))

            focus_options = [["click", _("Click")], ["sloppy", _("Sloppy")], ["mouse", _("Mouse")]]
            section.add(self._make_combo_group(_("Window focus mode"), "org.cinnamon.desktop.wm.preferences", "focus-mode", focus_options))
            section.add(GSettingsCheckButton(_("Automatically raise focused windows"), "org.cinnamon.desktop.wm.preferences", "auto-raise", None))
            section.add(GSettingsCheckButton(_("Bring windows which require attention to the current workspace"), "org.cinnamon", "bring-windows-to-current-workspace", None))        
            section.add(GSettingsCheckButton(_("Prevent focus stealing"), "org.cinnamon", "prevent-focus-stealing", None))        
            section.add(GSettingsCheckButton(_("Attach dialog windows to their parent window's titlebar"), "org.cinnamon.muffin", "attach-modal-dialogs", None))
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Moving and Resizing Windows"))

            placement_options = [["automatic", _("Automatic")], ["pointer", _("Cursor")], ["manual", _("Manual")], ["center", _("Center")]]
            combo = self._make_combo_group(_("Location of newly opened windows"), "org.cinnamon.muffin", "placement-mode", placement_options)
            section.add(combo)
            special_key_options = [["", _("Disabled")], ["<Alt>", "<Alt>"],["<Super>", "<Super>"],["<Control>", "<Control>"]]
            combo = self._make_combo_group(_("Special key to move and resize windows"), "org.cinnamon.desktop.wm.preferences", "mouse-button-modifier", special_key_options)
            combo.set_tooltip_text(_("While the special key is pressed, windows can be dragged with the left mouse button and resized with the right mouse button."))
            section.add(combo)
            section.add(GSettingsSpinButton(_("Window drag/resize threshold"), "org.cinnamon.muffin", "resize-threshold", None, 1, 100, 1, 1, _("Pixels")))        
            vbox.add(section)

            # Alt Tab

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            stack.add_titled(vbox, "alttab", _("Alt-Tab"))

            section = Section(_("Alt-Tab"))  
            
            alttab_styles = [
                ["icons", _("Icons only")],
                ["thumbnails", _("Thumbnails only")],
                ["icons+thumbnails", _("Icons and thumbnails")],
                ["icons+preview", _("Icons and window preview")],
                ["preview", _("Window preview (no icons)")],
                ["coverflow", _("Coverflow (3D)")],
                ["timeline", _("Timeline (3D)")]
            ]
            alttab_styles_combo = self._make_combo_group(_("Alt-Tab switcher style"), "org.cinnamon", "alttab-switcher-style", alttab_styles)
            section.add(alttab_styles_combo)
            section.add(GSettingsCheckButton(_("Display the alt-tab switcher on the primary monitor instead of the active one"), "org.cinnamon", "alttab-switcher-enforce-primary-monitor", None))
            section.add(
                GSettingsSpinButton(
                    _("Delay before displaying the alt-tab switcher"),
                    "org.cinnamon", "alttab-switcher-delay", dep_key=None,
                    min=0, max=1000, step=50, page=150, 
                    units=_("milliseconds")))
            vbox.add(section)

        self.stack_switcher.show()

    def update_spinner_visibility(self, settings, key, widget):
        if settings.get_string(key) == "opacity":
            widget.show()
        else:
            widget.hide()

    def _make_titlebar_action_group(self, group_label, root, key, stuff):
        self.size_groups = getattr(self, "size_groups", [SizeGroup.new(SizeGroupMode.HORIZONTAL) for x in range(2)])
        
        box = Gtk.HBox()
        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.pack_start(label, False, False, 0)

        w = GSettingsComboBox("", root, key, None, stuff)
        self.size_groups[1].add_widget(w)
        box.pack_start(w, False, False, 4)
        
        return box

    def _make_combo_group(self, group_label, root, key, stuff):
        box = Gtk.HBox()

        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        box.pack_start(label, False, False, 2)

        w = GSettingsComboBox("", root, key, None, stuff)
        box.pack_start(w, False, False, 2)
        
        return box

class TitleBarButtonsOrderSelector(Gtk.Table):
    def __init__(self):
        self.schema = "org.cinnamon.muffin"
        self.key = "button-layout"
        
        super(TitleBarButtonsOrderSelector, self).__init__()
        
        self.settings = Gio.Settings.new(self.schema)        
        self.value = self.settings.get_string(self.key)
                
        try:
            left_items, right_items = self.value.split(":")
        except:
            left_items = right_items = ""
        if len(left_items) > 0:
            left_items = left_items.split(",")
        else:
            left_items = []
        if len(right_items) > 0:
            right_items = right_items.split(",")
        else:
            right_items = []
        
        label = Gtk.Label.new(_("Left side title bar buttons"))
        label.set_alignment(0, 0.5)
        self.attach(label, 0, 1, 0, 1, xoptions = Gtk.AttachOptions.FILL, yoptions=0, xpadding=2)
        left_side_box = Gtk.HBox()
        self.attach(left_side_box, 1, 2, 0, 1, yoptions=0, xpadding=2, ypadding=4)
        
        label = Gtk.Label.new(_("Right side title bar buttons"))
        label.set_alignment(0, 0.5)
        self.attach(label, 0, 1, 1, 2, xoptions = Gtk.AttachOptions.FILL, yoptions=0, xpadding=2)
        right_side_box = Gtk.HBox()
        self.attach(right_side_box, 1, 2, 1, 2, yoptions=0, xpadding=2, ypadding=4)
        
        self.left_side_widgets = []
        self.right_side_widgets = []
        for i in range(4):
            self.left_side_widgets.append(Gtk.ComboBox())
            self.right_side_widgets.append(Gtk.ComboBox())
        
        buttons = [
            ("", ""),
            ("menu", _("Menu")),
            ("close", _("Close")),
            ("minimize", _("Minimize")),
            ("maximize", _("Maximize")),
            ("stick", _("Sticky")),
            ("shade", _("Shade"))
        ]
        
        for i in self.left_side_widgets + self.right_side_widgets:
            if i in self.left_side_widgets:
                ref_list = left_items
                index = self.left_side_widgets.index(i)
            else:
                ref_list = right_items
                index = self.right_side_widgets.index(i)
            model = Gtk.ListStore(str, str)
            selected_iter = None
            for button in buttons:
                iter = model.insert_before(None, None)
                model.set_value(iter, 0, button[0])                
                model.set_value(iter, 1, button[1])
                if index < len(ref_list) and ref_list[index] == button[0]:
                    selected_iter = iter
            i.set_model(model)
            renderer_text = Gtk.CellRendererText()
            i.pack_start(renderer_text, True)
            i.add_attribute(renderer_text, "text", 1)
            if selected_iter is not None:
                i.set_active_iter(selected_iter)
            i.connect("changed", self.on_my_value_changed)
        
        for i in self.left_side_widgets:
            left_side_box.pack_start(i, False, False, 2)
        for i in self.right_side_widgets:
            right_side_box.pack_start(i, False, False, 2)
    
    def on_my_value_changed(self, widget):
        active_iter = widget.get_active_iter()
        if active_iter:
            new_value = widget.get_model()[active_iter][0]
        else:
            new_value = None
        left_items = []
        right_items = []
        for i in self.left_side_widgets + self.right_side_widgets:
            active_iter = i.get_active_iter()
            if active_iter:
                value = i.get_model()[i.get_active_iter()][0]
                if i != widget and value == new_value:
                    i.set_active_iter(None)
                elif value != "":
                    if i in self.left_side_widgets:
                        left_items.append(value)
                    else:
                        right_items.append(value)
        self.settings.set_string(self.key, ','.join(str(item) for item in left_items) + ':' + ','.join(str(item) for item in right_items))
