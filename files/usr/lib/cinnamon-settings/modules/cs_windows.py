#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk
from gi.repository.Gtk import SizeGroup, SizeGroupMode


class Module:
    def __init__(self, content_box):
        keywords = _("windows, titlebar, edge, switcher, window list, attention, focus")
        advanced = True
        sidePage = SidePage(_("Windows"), "windows.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "windows"
        self.category = "prefs"

        alttab_styles = [["icons", _("Icons only")],["icons+thumbnails", _("Icons and thumbnails")],["icons+preview", _("Icons and window preview")],["preview", _("Window preview (no icons)")],["coverflow", _("Coverflow (3D)")],["timeline", _("Timeline (3D)")]]
        alttab_styles_combo = self._make_combo_group(_("Alt-Tab switcher style"), "org.cinnamon", "alttab-switcher-style", alttab_styles)
        sidePage.add_widget(alttab_styles_combo)

        sidePage.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        
        sidePage.add_widget(self._make_combo_group(_("Action on title bar double-click"),
                                            "org.cinnamon.desktop.wm.preferences", "action-double-click-titlebar",
                                            [(i, i.replace("-", " ").title()) for i in ('toggle-shade', 'toggle-maximize', 'toggle-maximize-horizontally', 'toggle-maximize-vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(self._make_combo_group(_("Action on title bar middle-click"),
                                            "org.cinnamon.desktop.wm.preferences", "action-middle-click-titlebar",
                                            [(i, i.replace("-", " ").title()) for i in ('toggle-shade', 'toggle-maximize', 'toggle-maximize-horizontally', 'toggle-maximize-vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(self._make_combo_group(_("Action on title bar right-click"),
                                            "org.cinnamon.desktop.wm.preferences", "action-right-click-titlebar",
                                            [(i, i.replace("-", " ").title()) for i in ('toggle-shade', 'toggle-maximize', 'toggle-maximize-horizontally', 'toggle-maximize-vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(self._make_combo_group(_("Window focus mode"), 
                                            "org.cinnamon.desktop.wm.preferences", "focus-mode", 
                                            [(i, i.title()) for i in ("click","sloppy","mouse")]))
        sidePage.add_widget(GSettingsCheckButton(_("Automatically raises the focused window"), "org.cinnamon.desktop.wm.preferences", "auto-raise", None))                                   
        sidePage.add_widget(self._make_combo_group(_("Window click action modifier"), 
                                            "org.cinnamon.desktop.wm.preferences", "mouse-button-modifier", 
                                            [(i, i.title()) for i in ("","<Alt>","<Super>","<Control>")]))
                                    
        sidePage.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        
        sidePage.add_widget(TitleBarButtonsOrderSelector())

        sidePage.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
                
        sidePage.add_widget(GSettingsCheckButton(_("Enable mouse-wheel scrolling in Window List applet"), "org.cinnamon", "window-list-applet-scroll", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show an alert in the window list when a window from another workspace requires attention"), "org.cinnamon", "window-list-applet-alert", None))
        sidePage.add_widget(GSettingsCheckButton(_("Bring windows which require attention to the current workspace"), "org.cinnamon", "bring-windows-to-current-workspace", None))
        sidePage.add_widget(GSettingsCheckButton(_("Attach dialog windows to their parent window's titlebar"), "org.cinnamon.muffin", "attach-modal-dialogs", None), True)
        sidePage.add_widget(GSettingsCheckButton(_("Enforce displaying the alt-tab switcher on the primary monitor instead of the active one"), "org.cinnamon", "alttab-switcher-enforce-primary-monitor", None), True)
        
        sidePage.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        
        sidePage.add_widget(GSettingsSpinButton(_("Window drag/resize threshold"), "org.cinnamon.muffin", "resize-threshold", None, 1, 100, 1, 1, _("Pixels")), True)

    def _make_combo_group(self, group_label, root, key, stuff):
        self.size_groups = getattr(self, "size_groups", [SizeGroup(SizeGroupMode.HORIZONTAL) for x in range(2)])
        
        box = Gtk.HBox()
        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.pack_start(label, False, False, 0)

        w = GSettingsComboBox("", root, key, None, stuff)
        self.size_groups[1].add_widget(w)
        box.pack_start(w, False, False, 0)
        
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
        
        label = Gtk.Label(_("Left side title bar buttons"))
        label.set_alignment(0, 0.5)
        self.attach(label, 0, 1, 0, 1, xoptions = Gtk.AttachOptions.FILL, yoptions=0, xpadding=2)
        left_side_box = Gtk.HBox()
        self.attach(left_side_box, 1, 2, 0, 1, yoptions=0, xpadding=2, ypadding=4)
        
        label = Gtk.Label(_("Right side title bar buttons"))
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
            ("stick", _("Sticky"))
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
