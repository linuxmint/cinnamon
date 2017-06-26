#!/usr/bin/python2

from gi.repository import Gtk, Gdk, GObject

FORBIDDEN_KEYVALS = [
    Gdk.KEY_Home,
    Gdk.KEY_Left,
    Gdk.KEY_Up,
    Gdk.KEY_Right,
    Gdk.KEY_Down,
    Gdk.KEY_Page_Up,
    Gdk.KEY_Page_Down,
    Gdk.KEY_End,
    Gdk.KEY_Tab,
    Gdk.KEY_KP_Enter,
    Gdk.KEY_Return,
    Gdk.KEY_space,
    Gdk.KEY_Mode_switch
]

class ButtonKeybinding(Gtk.TreeView):
    __gsignals__ = {
        'accel-edited': (GObject.SignalFlags.RUN_LAST, None, (str, str)),
        'accel-cleared': (GObject.SignalFlags.RUN_LAST, None, ())
    }

    __gproperties__ = {
        "accel-string": (str,
                         "accelerator string",
                         "Parseable accelerator string",
                         None,
                         GObject.PARAM_READWRITE)
    }

    def __init__(self):
        super(ButtonKeybinding, self).__init__()

        self.set_headers_visible(False)
        self.set_enable_search(False)
        self.set_hover_selection(True)

        self.entry_store = None
        self.accel_string = ""
        self.keybinding_cell = CellRendererKeybinding(a_widget=self)
        self.keybinding_cell.set_alignment(.5,.5)
        self.keybinding_cell.connect('accel-edited', self.on_cell_edited)
        self.keybinding_cell.connect('accel-cleared', self.on_cell_cleared)

        col = Gtk.TreeViewColumn("binding", self.keybinding_cell, accel_string=0)
        col.set_alignment(.5)

        self.append_column(col)

        self.keybinding_cell.set_property('editable', True)

        self.load_model()

        self.connect("focus-out-event", self.on_focus_lost)

    def on_cell_edited(self, cell, path, accel_string, accel_label):
        self.accel_string = accel_string
        self.emit("accel-edited", accel_string, accel_label)
        self.load_model()

    def on_cell_cleared(self, cell, path):
        self.accel_string = ""
        self.emit("accel-cleared")
        self.load_model()

    def on_focus_lost(self, widget, event):
        self.get_selection().unselect_all()

    def load_model(self):
        if self.entry_store:
            self.entry_store.clear()

        self.entry_store = Gtk.ListStore(str) # Accel string
        self.entry_store.append((self.accel_string,))

        self.set_model(self.entry_store)

    def do_get_property(self, prop):
        if prop.name == 'accel-string':
            return self.accel_string
        else:
            raise AttributeError('unknown property %s' % prop.name)

    def do_set_property(self, prop, value):
        if prop.name == 'accel-string':
            if value != self.accel_string:
                self.accel_string = value
                self.keybinding_cell.set_value(value)
        else:
            raise AttributeError('unknown property %s' % prop.name)

    def get_accel_string(self):
        return self.accel_string

    def set_accel_string(self, accel_string):
        self.accel_string = accel_string
        self.load_model()


class CellRendererKeybinding(Gtk.CellRendererText):
    __gsignals__ = {
        'accel-edited': (GObject.SignalFlags.RUN_LAST, None, (str, str, str)),
        'accel-cleared': (GObject.SignalFlags.RUN_LAST, None, (str,))
    }

    __gproperties__ = {
        "accel-string": (str,
                         "accelerator string",
                         "Parseable accelerator string",
                         None,
                         GObject.PARAM_READWRITE)
    }

    def __init__(self, a_widget, accel_string=None):
        super(CellRendererKeybinding, self).__init__()
        self.connect("editing-started", self.editing_started)
        self.release_event_id = 0
        self.press_event_id = 0
        self.focus_id = 0

        self.a_widget = a_widget
        self.accel_string = accel_string

        self.path = None
        self.press_event = None
        self.teaching = False

        self.update_label()

    def do_get_property(self, prop):
        if prop.name == 'accel-string':
            return self.accel_string
        else:
            raise AttributeError('unknown property %s' % prop.name)

    def do_set_property(self, prop, value):
        if prop.name == 'accel-string':
            if value != self.accel_string:
                self.accel_string = value
                self.update_label()
        else:
            raise AttributeError('unknown property %s' % prop.name)

    def update_label(self):
        if not self.accel_string:
            text = _("unassigned")
        else:
            key, codes, mods = Gtk.accelerator_parse_with_keycode(self.accel_string)
            text = Gtk.accelerator_get_label_with_keycode(None, key, codes[0], mods)
        self.set_property("text", text)

    def set_value(self, accel_string=None):
        self.set_property("accel-string", accel_string)

    def editing_started(self, renderer, editable, path):
        if not self.teaching:
            self.path = path
            device = Gtk.get_current_event_device()
            if device.get_source() == Gdk.InputSource.KEYBOARD:
                self.keyboard = device
            else:
                self.keyboard = device.get_associated_device()

            self.keyboard.grab(self.a_widget.get_window(), Gdk.GrabOwnership.WINDOW, False,
                               Gdk.EventMask.KEY_PRESS_MASK | Gdk.EventMask.KEY_RELEASE_MASK,
                               None, Gdk.CURRENT_TIME)

            editable.set_text(_("Pick an accelerator"))
            self.accel_editable = editable

            self.release_event_id = self.accel_editable.connect( "key-release-event", self.on_key_release )
            self.press_event_id = self.accel_editable.connect( "key-press-event", self.on_key_press )
            self.focus_id = self.accel_editable.connect( "focus-out-event", self.on_focus_out )
            self.teaching = True
        else:
            self.ungrab()
            self.update_label()
            self.teaching = False

    def on_focus_out(self, widget, event):
        self.ungrab()

    def on_key_press(self, widget, event):
        if self.teaching:
            self.press_event = event.copy()
            return True

        return False

    def on_key_release(self, widget, event):
        self.ungrab()
        self.teaching = False
        event = self.press_event

        display = widget.get_display()

        keyval = 0
        group = event.group
        accel_mods = event.state

        # HACK: we don't want to use SysRq as a keybinding (but we do
        # want Alt+Print), so we avoid translation from Alt+Print to SysRq

        if event.keyval == Gdk.KEY_Sys_Req and \
           ((accel_mods & Gdk.ModifierType.MOD1_MASK) != 0):
            keyval = Gdk.KEY_Print
            consumed_modifiers = 0
        else:
            keymap = Gdk.Keymap.get_for_display(display)
            group_mask_disabled = False
            shift_group_mask = 0

            shift_group_mask = keymap.get_modifier_mask(Gdk.ModifierIntent.SHIFT_GROUP)

            retval, keyval, effective_group, level, consumed_modifiers = \
                   keymap.translate_keyboard_state(event.hardware_keycode, accel_mods, group)

            if group_mask_disabled:
                effective_group = 1

            if consumed_modifiers:
                consumed_modifiers &= ~shift_group_mask

        accel_key = Gdk.keyval_to_lower(keyval)
        if accel_key == Gdk.KEY_ISO_Left_Tab:
            accel_key = Gdk.KEY_Tab

        accel_mods &= Gtk.accelerator_get_default_mod_mask()

        if accel_mods == 0:
            if accel_key == Gdk.KEY_Escape:
                self.update_label()
                self.teaching = False
                self.path = None
                self.press_event = None
                return True
            elif accel_key == Gdk.KEY_BackSpace:
                self.teaching = False
                self.press_event = None
                self.set_value(None)
                self.emit("accel-cleared", self.path)
                self.path = None
                return True

        accel_string = Gtk.accelerator_name_with_keycode(None, accel_key, event.hardware_keycode, Gdk.ModifierType(accel_mods))
        accel_label = Gtk.accelerator_get_label_with_keycode(None, accel_key, event.hardware_keycode, Gdk.ModifierType(accel_mods))

        # print("Storing %s as %s" % (accel_label, accel_string))

        if (accel_mods == 0 or accel_mods == Gdk.ModifierType.SHIFT_MASK) and event.hardware_keycode != 0:
            if ((keyval >= Gdk.KEY_a                    and keyval <= Gdk.KEY_z)
            or  (keyval >= Gdk.KEY_A                    and keyval <= Gdk.KEY_Z)
            or  (keyval >= Gdk.KEY_0                    and keyval <= Gdk.KEY_9)
            or  (keyval >= Gdk.KEY_kana_fullstop        and keyval <= Gdk.KEY_semivoicedsound)
            or  (keyval >= Gdk.KEY_Arabic_comma         and keyval <= Gdk.KEY_Arabic_sukun)
            or  (keyval >= Gdk.KEY_Serbian_dje          and keyval <= Gdk.KEY_Cyrillic_HARDSIGN)
            or  (keyval >= Gdk.KEY_Greek_ALPHAaccent    and keyval <= Gdk.KEY_Greek_omega)
            or  (keyval >= Gdk.KEY_hebrew_doublelowline and keyval <= Gdk.KEY_hebrew_taf)
            or  (keyval >= Gdk.KEY_Thai_kokai           and keyval <= Gdk.KEY_Thai_lekkao)
            or  (keyval >= Gdk.KEY_Hangul               and keyval <= Gdk.KEY_Hangul_Special)
            or  (keyval >= Gdk.KEY_Hangul_Kiyeog        and keyval <= Gdk.KEY_Hangul_J_YeorinHieuh)
            or  keyval in FORBIDDEN_KEYVALS):
                dialog = Gtk.MessageDialog(None,
                                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                    Gtk.MessageType.ERROR,
                                    Gtk.ButtonsType.OK,
                                    None)
                dialog.set_default_size(400, 200)
                msg = _("\nThis key combination, \'<b>%s</b>\' cannot be used because it would become impossible to type using this key.\n\n")
                msg += _("Please try again with a modifier key such as Control, Alt or Super (Windows key) at the same time.\n")
                dialog.set_markup(msg % (accel_label))
                dialog.show_all()
                response = dialog.run()
                dialog.destroy()
                return True

        self.press_event = None
        self.set_value(accel_string)
        self.emit("accel-edited", self.path, accel_string, accel_label)
        self.path = None

        return True

    def ungrab(self):
        self.keyboard.ungrab(Gdk.CURRENT_TIME)
        if self.release_event_id > 0:
            self.accel_editable.disconnect(self.release_event_id)
            self.release_event_id = 0
        if self.press_event_id > 0:
            self.accel_editable.disconnect(self.press_event_id)
            self.press_event_id = 0
        if self.focus_id > 0:
            self.accel_editable.disconnect(self.focus_id)
            self.focus_id = 0
        try:
            self.accel_editable.editing_done()
            self.accel_editable.remove_widget()
        except:
            pass
