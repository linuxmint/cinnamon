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

            section = Section(_("Layout Options"))
            desktop_layouts = [["traditional", _("Traditional (panel at the bottom)")], ["flipped", _("Flipped (panel at the top)")], ["classic", _("Classic (panels at the top and at the bottom)")]]        
            desktop_layouts_combo = GSettingsComboBox(_("Panel layout"), "org.cinnamon", "desktop-layout", None, desktop_layouts)
            section.add(desktop_layouts_combo) 
            label = Gtk.Label()
            label.set_markup("<i><small>%s</small></i>" % _("Note: If you change the layout you will need to restart Cinnamon and Cinnamon Settings."))        
            label.get_style_context().add_class("dim-label")
            section.add(label)
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Auto Hide Options"))
            settings = Gio.Settings.new("org.cinnamon")
            layout_type = settings.get_string("desktop-layout")
            if layout_type != "classic":
                section.add(GSettingsCheckButton(_("Auto-hide panel"), "org.cinnamon", "panel-autohide", None))
                section.add_indented(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
                section.add_indented(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            else:
                section.add(GSettingsCheckButton(_("Auto-hide top panel"), "org.cinnamon", "panel-autohide", None))
                section.add_indented(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
                section.add_indented(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
                section.add(GSettingsCheckButton(_("Auto-hide bottom panel"), "org.cinnamon", "panel2-autohide", None))
                section.add_indented(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel2-show-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds")))
                section.add_indented(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel2-hide-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds")))
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Size Options"))
            section.add(GSettingsCheckButton(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panel-resizable", None))
            section.add_indented(GSettingsCheckButton(_("Allow Cinnamon to scale panel text and icons according to the panel heights"), "org.cinnamon", "panel-scale-text-icons", "org.cinnamon/panel-resizable"))
            slider = GSettingsRange(_("Top panel height:"), _("Smaller"), _("Larger"), 20, 50, False, "int", False, "org.cinnamon", "panel-top-height", "org.cinnamon/panel-resizable", adjustment_step = 1.0)
            slider.add_mark(25.0, Gtk.PositionType.TOP, None)
            section.add_indented_expand(slider)
            slider = GSettingsRange(_("Bottom panel height:"), _("Smaller"), _("Larger"), 20, 50, False, "int", False, "org.cinnamon", "panel-bottom-height", "org.cinnamon/panel-resizable", adjustment_step = 1.0)
            slider.add_mark(25.0, Gtk.PositionType.TOP, None)
            section.add_indented_expand(slider)
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
            hbox.set_border_width(6)
            hbox.add(GSettingsCheckButton(_("Panel edit mode"), "org.cinnamon", "panel-edit-mode", None))
            vbox.add(hbox)