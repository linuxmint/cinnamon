#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("panel, height, bottom, top, autohide, size, traditional, layout")
        sidePage = SidePage(_("Panel"), "cs-panel", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "panel"
        self.category = "prefs"
        self.comment = _("Manage Cinnamon panel settings")

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Panel module"

            bg = SectionBg()        
            self.sidePage.add_widget(bg)
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            bg.add(vbox)

            vbox.add(self.first_widget())
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
            
            vbox.add(self.panel_height_widget())
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
            hbox.set_border_width(6)
            hbox.add(GSettingsCheckButton(_("Panel edit mode"), "org.cinnamon", "panel-edit-mode", None))
            vbox.add(hbox)
    
    def first_widget(self):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        section = Section(_("Layout Options"))
        desktop_layouts = [["traditional", _("Traditional (panel at the bottom)")], ["flipped", _("Flipped (panel at the top)")], ["classic", _("Classic (panels at the top and at the bottom)")]]        
        desktop_layouts_combo = GSettingsComboBox(_("Panel layout"), "org.cinnamon", "desktop-layout", None, desktop_layouts)
        section.add(desktop_layouts_combo) 
        label = Gtk.Label()
        label.set_markup("<i><small>%s</small></i>" % _("Note: If you change the layout you will need to restart Cinnamon and Cinnamon Settings."))        
        label.get_style_context().add_class("dim-label")
        section.add(label)
        box.add(section)
        box.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        
        section = Section(_("Auto Hide Options"))
        settings = Gio.Settings.new("org.cinnamon")
        self.layout_type = settings.get_string("desktop-layout")
        if self.layout_type != "classic":
            section.add(GSettingsCheckButton(_("Auto-hide panel"), "org.cinnamon", "panel-autohide", None))
            section.add_indented(self.make_combo_group(_("Show delay"), GSettingsSpinButton("", "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds"))))
            section.add_indented(self.make_combo_group(_("Hide delay"), GSettingsSpinButton("", "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds"))))
        else:
            section.add(GSettingsCheckButton(_("Auto-hide top panel"), "org.cinnamon", "panel-autohide", None))
            section.add_indented(self.make_combo_group(_("Show delay"), GSettingsSpinButton("", "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds"))))
            section.add_indented(self.make_combo_group(_("Hide delay"), GSettingsSpinButton("", "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds"))))
            section.add(GSettingsCheckButton(_("Auto-hide bottom panel"), "org.cinnamon", "panel2-autohide", None))
            section.add_indented(self.make_combo_group(_("Show delay"), GSettingsSpinButton("", "org.cinnamon", "panel2-show-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds"))))
            section.add_indented(self.make_combo_group(_("Hide delay"), GSettingsSpinButton("", "org.cinnamon", "panel2-hide-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds"))))
        box.add(section)
        return box
            
    def panel_height_widget(self):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        section = Section(_("Size Options"))
        section.add(GSettingsCheckButton(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panel-resizable", None))
        section.add_indented(GSettingsCheckButton(_("Scale text and icons according to the height"), "org.cinnamon", "panel-scale-text-icons", "org.cinnamon/panel-resizable"))
        if self.layout_type != "classic":
            section.add_indented(self.make_combo_group(_("Panel height"), GSettingsSpinButton("", "org.cinnamon", "panel-bottom-height", "org.cinnamon/panel-resizable",  0, 2000, 1, 5, _("pixels"))))
        else:
            section.add_indented(self.make_combo_group(_("Top panel height"), GSettingsSpinButton("", "org.cinnamon", "panel-top-height", "org.cinnamon/panel-resizable", 0, 2000, 1, 5, _("pixels"))))
            section.add_indented(self.make_combo_group(_("Bottom panel height"), GSettingsSpinButton("", "org.cinnamon", "panel-bottom-height", "org.cinnamon/panel-resizable",  0, 2000, 1, 5, _("pixels"))))
        label = Gtk.Label()
        label.set_markup("<i><small>%s</small></i>" % _("Default panel height is 25 pixels"))        
        label.get_style_context().add_class("dim-label")
        section.add_indented(label)
        box.add(section)
        return box
            
            
    def make_combo_group(self, string, widget):
        self.size_groups = getattr(self, "size_groups", [Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL) for x in range(2)])
        box = Gtk.Box()
        label = Gtk.Label()
        label.set_markup(string)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.pack_start(label, False, False, 0)
        self.size_groups[1].add_widget(widget)
        box.pack_start(widget, False, False, 15)
        return box
