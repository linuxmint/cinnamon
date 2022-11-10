#! /usr/bin/python3

"""
Close dialog spawned by cinnamon (closeDialog.js) that prompts the user to kill a hung window.
"""
import signal
import gettext

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')

from gi.repository import GLib, Gtk, Gdk, XApp, Gio

signal.signal(signal.SIGINT, signal.SIG_DFL)

gettext.install("cinnamon", "/usr/share/locale", names=["ngettext"])

KEY_ACTION = "hoverclick-action"
KEY_GEOMETRY = "hoverclick-geometry"
KEY_LAYOUT = "hoverclick-layout"

class HoverClickWindow(XApp.GtkWindow):
    def __init__(self):
        XApp.GtkWindow.__init__(self, type_hint=Gdk.WindowTypeHint.UTILITY)

        self.set_keep_above(True)
        self.stick()
        self.set_title(_("Hover click"))
        self.set_default_size(1, 1)
        self.set_icon_name("input-mouse")

        # default position - utility windows normally spawn at screen 0,0
        primary = Gdk.Display.get_default().get_primary_monitor()
        workarea = primary.get_workarea()
        self.move(workarea.x + workarea.width / 2, workarea.y + workarea.height / 2)

        self.orientation = None
        self.button_style = None
        self.buttons = []
        self.popup = None

        self.settings = Gio.Settings(schema_id="org.cinnamon")

        self.mainbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, margin=4)
        self.add(self.mainbox)

        self.button_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, homogeneous=True)
        self.mainbox.pack_start(self.button_box, True, True, 0)

        self.action = self.settings.get_string("hoverclick-action")

        self.doing_setup = True

        self.last_button = None
        self.start_button = None
        def make_button(label, icon_name, action):
            button = Gtk.RadioButton(label=label,
                                      image=Gtk.Image(icon_name=icon_name, no_show_all=True),
                                      image_position=Gtk.PositionType.TOP,
                                      relief=Gtk.ReliefStyle.NONE,
                                      always_show_image=False,
                                      draw_indicator=False)

            button._saved_label = label

            if self.action == action:
                self.start_button = button

            button.connect("toggled", self.action_changed, action)
            button.connect("button-press-event", self.on_button_press_event)

            if self.last_button is not None:
                button.join_group(self.last_button)
            else:
                self.last_button = button

            self.buttons.append(button)

            return button

        self.single_click_button = make_button(_("Single Click"), "cinnamon-hc-single-click", "single")
        self.button_box.pack_start(self.single_click_button, True, True, 0)
        self.double_click_button = make_button(_("Double Click"), "cinnamon-hc-double-click", "double")
        self.button_box.pack_start(self.double_click_button, True, True, 0)
        self.drag_button = make_button(_("Drag"), "cinnamon-hc-drag-click", "drag")
        self.button_box.pack_start(self.drag_button, True, True, 0)
        self.right_click_button = make_button(_("Secondary Click"), "cinnamon-hc-right-click", "secondary")
        self.button_box.pack_start(self.right_click_button, True, True, 0)

        if self.start_button is not None:
            self.start_button.set_active(True)

        self.update_layout()
        self.setup_menu()
        self.position_window()

        self.doing_setup = False

        self.show_all()
        self.settings.connect("changed::hoverclick-layout", self.update_layout)
        self.connect("delete-event", self.exit)
        GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGTERM, self.exit)

    def action_changed(self, button, action):
        if self.doing_setup:
            return

        if not button.get_active():
            return

        self.settings.set_string("hoverclick-action", action)

    def on_button_press_event(self, button, event):
        had_button, button = event.get_button()

        if button == Gdk.BUTTON_SECONDARY:
            self.menu.popup_at_pointer(event)

        return Gdk.EVENT_PROPAGATE

    def update_layout(self, *args):
        layout = self.settings.get_string("hoverclick-layout")

        try:
            orientation, button_style = layout.split("::", maxsplit=2)
        except Exception as e:
            print("Could not load user layout from settings: ", e)

        if orientation != self.orientation:
            if orientation == "vertical":
                self.button_box.set_orientation(Gtk.Orientation.VERTICAL)
            elif orientation == "horizontal":
                self.button_box.set_orientation(Gtk.Orientation.HORIZONTAL)
            self.orientation = orientation
            # snap size
            self.resize(1, 1)

        if button_style != self.button_style:
            if button_style == "icons":
                self.show_icons(True)
                self.show_labels(False)
            elif button_style == "text":
                self.show_icons(False)
                self.show_labels(True)
            else:
                self.show_icons(True)
                self.show_labels(True)
            self.button_style = button_style
            self.resize(1, 1)

    def show_icons(self, show):
        for button in self.buttons:
            button.set_always_show_image(show)
            button.get_image().set_visible(show)

    def show_labels(self, show):
        for button in self.buttons:
            # set label doesn't allow None, and will not 'hide' the label if it's only an empty string
            button.props.label = button._saved_label if show else None

    def setup_menu(self):
        self.menu = Gtk.Menu()
        self.menu.attach_to_widget(self)

        text = Gtk.RadioMenuItem.new_with_mnemonic(None, _("_Text"))
        text.props.active = self.button_style == "text"
        self.menu.append(text)

        icons = Gtk.RadioMenuItem.new_with_mnemonic(text.get_group(), _("_Icons"))
        icons.props.active = self.button_style == "icons"
        self.menu.append(icons)

        both = Gtk.RadioMenuItem.new_with_mnemonic(text.get_group(), _("_Both"))
        both.props.active = self.button_style == "both"
        self.menu.append(both)

        text.connect("activate", self.change_buttons, "text")
        icons.connect("activate", self.change_buttons, "icons")
        both.connect("activate", self.change_buttons, "both")

        self.menu.append(Gtk.SeparatorMenuItem())

        horiz = Gtk.RadioMenuItem.new_with_mnemonic(None, _("_Horizontal"))
        horiz.props.active = self.orientation == "horizontal"
        self.menu.append(horiz)

        vert = Gtk.RadioMenuItem.new_with_mnemonic(horiz.get_group(), _("_Vertical"))
        vert.props.active = self.orientation == "vertical"
        self.menu.append(vert)

        horiz.connect("activate", self.change_orientation, "horizontal")
        vert.connect("activate", self.change_orientation, "vertical")

        self.menu.show_all()

    def change_buttons(self, menu, style):
        try:
            orientation, old_style = self.settings.get_string("hoverclick-layout").split("::", maxsplit=2)
        except Exception as e:
            print("Could not change user button style: ", e)
            return

        if style != old_style:
            new_layout = "%s::%s" % (orientation, style)
            self.settings.set_string("hoverclick-layout", new_layout)

    def change_orientation(self, menu, orientation):
        try:
            old_orientation, button_style = self.settings.get_string("hoverclick-layout").split("::", maxsplit=2)
        except Exception as e:
            print("Could not change user button style: ", e)
            return

        if orientation != old_orientation:
            new_layout = "%s::%s" % (orientation, button_style)
            self.settings.set_string("hoverclick-layout", new_layout)

    def position_window(self):
        pos_str = self.settings.get_string("hoverclick-position")

        try:
            x, y = pos_str.split("::", maxsplit=2)
            self.move(int(x), int(y))
        except:
            pass

    def store_position(self):
        x, y = self.get_position()
        self.settings.set_string("hoverclick-position", "%d::%d" % (x, y))

    def exit(self, *args):
        self.store_position()
        self.destroy()
        Gtk.main_quit()

if __name__ == "__main__":
    window = HoverClickWindow()
    Gtk.main()

    # Make sure position is updated
    Gio.Settings.sync()

    exit(0)
