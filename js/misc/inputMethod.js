// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, GObject, Gtk, GLib, Gdk } = imports.gi;
const Main = imports.ui.main;

var InputMethod = GObject.registerClass(
class InputMethod extends Clutter.InputMethod {
    _init() {
        super._init();
        
        this._currentFocus = null;
        this._preeditStr = '';
        this._preeditPos = 0;
        this._preeditVisible = false;
        
        // Create GTK IM context for universal input method support
        // This supports nimf, fcitx, ibus, scim, xim, etc.
        this._imContext = new Gtk.IMMulticontext();
        
        // Connect GTK IM signals
        this._imContext.connect('commit', (context, text) => {
            if (this._currentFocus) {
                this.commit(text);
            }
        });
        
        this._imContext.connect('preedit-changed', () => {
            this._updatePreedit();
        });
        
        this._imContext.connect('retrieve-surrounding', () => {
            if (this._currentFocus) {
                let [text, cursor] = this._currentFocus.get_surrounding();
                this._imContext.set_surrounding(text, text.length, cursor);
            }
            return true;
        });
        
        this._imContext.connect('delete-surrounding', (context, offset, n_chars) => {
            if (this._currentFocus) {
                this.delete_surrounding(offset, n_chars);
            }
            return true;
        });
        
        // Create invisible window for IM context
        this._createIMWindow();
    }
    
    _createIMWindow() {
        // Create an invisible GDK window for the IM context
        // This is needed for some input methods to work properly
        let display = Gdk.Display.get_default();
        if (!display) {
            return;
        }
        
        // Use root window as client window
        let window = Gdk.get_default_root_window();
        if (window) {
            this._imContext.set_client_window(window);
        }
    }
    
    _updatePreedit() {
        let [str, attrs, pos] = this._imContext.get_preedit_string();
        
        this._preeditStr = str;
        this._preeditPos = pos;
        
        if (str && str.length > 0) {
            this._preeditVisible = true;
            // Set preedit with underline to show it's being composed
            this.set_preedit_text(str, pos, pos, Clutter.PreeditResetMode.CLEAR);
        } else {
            this._preeditVisible = false;
            this.set_preedit_text(null, 0, 0, Clutter.PreeditResetMode.CLEAR);
        }
    }
    
    vfunc_focus_in(focus) {
        this._currentFocus = focus;
        
        if (this._imContext) {
            this._imContext.focus_in();
            // Reset IM state for clean start
            this._imContext.reset();
        }
    }

    vfunc_focus_out() {
        if (this._imContext) {
            // Commit any pending preedit text
            if (this._preeditVisible) {
                this._imContext.reset();
                this._preeditVisible = false;
                this.set_preedit_text(null, 0, 0, Clutter.PreeditResetMode.CLEAR);
            }
            this._imContext.focus_out();
        }
        
        this._currentFocus = null;
    }

    vfunc_reset() {
        if (this._imContext) {
            this._imContext.reset();
            this._preeditStr = '';
            this._preeditPos = 0;
            this._preeditVisible = false;
            this.set_preedit_text(null, 0, 0, Clutter.PreeditResetMode.CLEAR);
        }
    }

    vfunc_set_cursor_location(rect) {
        if (this._imContext) {
            // Convert Clutter coordinates to GDK rectangle
            let gdkRect = new Gdk.Rectangle({
                x: Math.floor(rect.x),
                y: Math.floor(rect.y),
                width: Math.floor(rect.width),
                height: Math.floor(rect.height)
            });
            this._imContext.set_cursor_location(gdkRect);
        }
    }

    vfunc_set_surrounding(text, cursor, anchor) {
        if (this._imContext && text) {
            // GTK expects byte position, but we have character position
            let bytes = GLib.utf8_offset_to_pointer(text, cursor) - text;
            this._imContext.set_surrounding(text, text.length, bytes);
        }
    }

    vfunc_update_content_hints(hints) {
        // Store hints for potential future use
        this._hints = hints;
    }

    vfunc_update_content_purpose(purpose) {
        // Store purpose for potential future use  
        this._purpose = purpose;
        
        if (this._imContext) {
            // Map Clutter input purposes to GTK input purposes if possible
            let gtkPurpose = Gtk.InputPurpose.FREE_FORM;
            
            switch(purpose) {
                case Clutter.InputContentPurpose.ALPHA:
                    gtkPurpose = Gtk.InputPurpose.ALPHA;
                    break;
                case Clutter.InputContentPurpose.DIGITS:
                    gtkPurpose = Gtk.InputPurpose.DIGITS;
                    break;
                case Clutter.InputContentPurpose.NUMBER:
                    gtkPurpose = Gtk.InputPurpose.NUMBER;
                    break;
                case Clutter.InputContentPurpose.PHONE:
                    gtkPurpose = Gtk.InputPurpose.PHONE;
                    break;
                case Clutter.InputContentPurpose.URL:
                    gtkPurpose = Gtk.InputPurpose.URL;
                    break;
                case Clutter.InputContentPurpose.EMAIL:
                    gtkPurpose = Gtk.InputPurpose.EMAIL;
                    break;
                case Clutter.InputContentPurpose.NAME:
                    gtkPurpose = Gtk.InputPurpose.NAME;
                    break;
                case Clutter.InputContentPurpose.PASSWORD:
                    gtkPurpose = Gtk.InputPurpose.PASSWORD;
                    break;
            }
            
            // Note: GTK3 doesn't have set_input_purpose, this would need GTK4
            // For now we just store it
        }
    }

    vfunc_filter_key_event(event) {
        if (!this._imContext || !event) {
            return false;
        }
        
        // Convert Clutter event to GDK event for GTK IM context
        let gdkEvent = this._clutterEventToGdkEvent(event);
        if (!gdkEvent) {
            return false;
        }
        
        // Let the IM context handle the key event
        let handled = this._imContext.filter_keypress(gdkEvent);
        
        return handled;
    }
    
    _clutterEventToGdkEvent(clutterEvent) {
        // Get the GDK display
        let display = Gdk.Display.get_default();
        if (!display) {
            return null;
        }
        
        // Determine event type
        let eventType;
        if (clutterEvent.type() === Clutter.EventType.KEY_PRESS) {
            eventType = Gdk.EventType.KEY_PRESS;
        } else if (clutterEvent.type() === Clutter.EventType.KEY_RELEASE) {
            eventType = Gdk.EventType.KEY_RELEASE;
        } else {
            return null;
        }
        
        // Create GDK event
        let gdkEvent = new Gdk.EventKey();
        gdkEvent.type = eventType;
        gdkEvent.window = Gdk.get_default_root_window();
        gdkEvent.time = clutterEvent.get_time();
        gdkEvent.keyval = clutterEvent.get_key_symbol();
        gdkEvent.hardware_keycode = clutterEvent.get_key_code();
        gdkEvent.state = clutterEvent.get_state();
        
        // Set modifier state
        let state = 0;
        let modifiers = clutterEvent.get_state();
        
        if (modifiers & Clutter.ModifierType.SHIFT_MASK)
            state |= Gdk.ModifierType.SHIFT_MASK;
        if (modifiers & Clutter.ModifierType.CONTROL_MASK)
            state |= Gdk.ModifierType.CONTROL_MASK;
        if (modifiers & Clutter.ModifierType.MOD1_MASK)
            state |= Gdk.ModifierType.MOD1_MASK;
        if (modifiers & Clutter.ModifierType.MOD2_MASK)
            state |= Gdk.ModifierType.MOD2_MASK;
        if (modifiers & Clutter.ModifierType.MOD3_MASK)
            state |= Gdk.ModifierType.MOD3_MASK;
        if (modifiers & Clutter.ModifierType.MOD4_MASK)
            state |= Gdk.ModifierType.MOD4_MASK;
        if (modifiers & Clutter.ModifierType.MOD5_MASK)
            state |= Gdk.ModifierType.MOD5_MASK;
        
        gdkEvent.state = state;
        
        return gdkEvent;
    }
});