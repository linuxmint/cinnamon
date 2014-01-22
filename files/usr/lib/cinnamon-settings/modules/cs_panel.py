#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("panel, height, bottom, top, autohide, size, traditional, layout")
        advanced = False
        sidePage = SidePage(_("Panel"), "panel.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "panel"
        self.category = "prefs"
        self.comment = _("Manage Cinnamon panel settings")

        desktop_layouts = [["traditional", _("Traditional (panel at the bottom)")], ["flipped", _("Flipped (panel at the top)")], ["classic", _("Classic (panels at the top and at the bottom)")]]        
        desktop_layouts_combo = GSettingsComboBox(_("Panel layout"), "org.cinnamon", "desktop-layout", None, desktop_layouts)
        sidePage.add_widget(desktop_layouts_combo) 
        label = Gtk.Label()
        label.set_markup("<i><small>%s</small></i>" % _("Note: If you change the layout you will need to restart Cinnamon and Cinnamon Settings."))
        sidePage.add_widget(label)

        settings = Gio.Settings.new("org.cinnamon")
        layout_type = settings.get_string("desktop-layout")
        if layout_type != "classic":
            sidePage.add_widget(GSettingsCheckButton(_("Auto-hide panel"), "org.cinnamon", "panel-autohide", None))
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box, True)
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box, True)
        else:
            sidePage.add_widget(GSettingsCheckButton(_("Auto-hide top panel"), "org.cinnamon", "panel-autohide", None))
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box, True)
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box, True)
            sidePage.add_widget(GSettingsCheckButton(_("Auto-hide bottom panel"), "org.cinnamon", "panel2-autohide", None))
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel2-show-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box, True)
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel2-hide-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box, True)

        sidePage.add_widget(GSettingsCheckButton(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panel-resizable", None), True)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Allow Cinnamon to scale panel text and icons according to the panel heights"), "org.cinnamon", "panel-scale-text-icons", "org.cinnamon/panel-resizable"))
        sidePage.add_widget(box, True)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Top panel height"), "org.cinnamon", "panel-top-height", "org.cinnamon/panel-resizable", 0, 2000, 1, 5, _("Pixels")))
        sidePage.add_widget(box, True)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Bottom panel height"), "org.cinnamon", "panel-bottom-height", "org.cinnamon/panel-resizable",  0, 2000, 1, 5, _("Pixels")))
        sidePage.add_widget(box, True)

        sidePage.add_widget(GSettingsCheckButton(_("Panel edit mode"), "org.cinnamon", "panel-edit-mode", None))