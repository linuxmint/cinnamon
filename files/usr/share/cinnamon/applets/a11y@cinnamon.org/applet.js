const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;

const A11Y_KEYBOARD_SCHEMA = 'org.cinnamon.desktop.a11y.keyboard';
const A11Y_MOUSE_SCHEMA = 'org.cinnamon.desktop.a11y.mouse';
const KEY_STICKY_KEYS_ENABLED = 'stickykeys-enable';
const KEY_BOUNCE_KEYS_ENABLED = 'bouncekeys-enable';
const KEY_SLOW_KEYS_ENABLED   = 'slowkeys-enable';
const KEY_MOUSE_KEYS_ENABLED  = 'mousekeys-enable';
const KEY_SEC_CLICK_ENABLED = 'secondary-click-enabled';
const KEY_DWELL_CLICK_ENABLED = 'dwell-click-enabled';

const APPLICATIONS_SCHEMA = 'org.cinnamon.desktop.a11y.applications';

const DPI_FACTOR_LARGE   = 1.25;

const DESKTOP_INTERFACE_SCHEMA = 'org.cinnamon.desktop.interface';
const KEY_GTK_THEME      = 'gtk-theme';
const KEY_ICON_THEME     = 'icon-theme';
const KEY_TEXT_SCALING_FACTOR = 'text-scaling-factor';

const WM_PREFERENCES_SCHEMA  = 'org.cinnamon.desktop.wm.preferences';
const KEY_WM_THEME        = 'theme';

const HIGH_CONTRAST_THEME = 'HighContrast';

const Keymap = Gdk.Keymap.get_default();

class CinnamonA11YApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.metadata = metadata;
            Main.systrayManager.registerTrayIconReplacement("a11y", metadata.uuid);

            this.set_applet_icon_symbolic_name("preferences-desktop-accessibility");
            this.set_applet_tooltip(_("Accessibility"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            let highContrast = this._buildHCItem();
            this.menu.addMenuItem(highContrast);

            let magnifier = this._buildItem(_("Zoom"), APPLICATIONS_SCHEMA,
                                                       'screen-magnifier-enabled');
            this.menu.addMenuItem(magnifier);

            let textZoom = this._buildFontItem();
            this.menu.addMenuItem(textZoom);

            if (GLib.file_test("/usr/bin/orca", GLib.FileTest.EXISTS)) {
                let screenReader = this._buildItem(_("Screen Reader"), APPLICATIONS_SCHEMA,
                                                                      'screen-reader-enabled');
                this.menu.addMenuItem(screenReader);
            }

            let screenKeyboard = this._buildItem(_("Screen Keyboard"), APPLICATIONS_SCHEMA,
                                                                       'screen-keyboard-enabled');
            this.menu.addMenuItem(screenKeyboard);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let stickyKeys = this._buildItem(_("Sticky Keys"), A11Y_KEYBOARD_SCHEMA, KEY_STICKY_KEYS_ENABLED);
            this.menu.addMenuItem(stickyKeys);

            let slowKeys = this._buildItem(_("Slow Keys"), A11Y_KEYBOARD_SCHEMA, KEY_SLOW_KEYS_ENABLED);
            this.menu.addMenuItem(slowKeys);

            let bounceKeys = this._buildItem(_("Bounce Keys"), A11Y_KEYBOARD_SCHEMA, KEY_BOUNCE_KEYS_ENABLED);
            this.menu.addMenuItem(bounceKeys);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let mouseKeys = this._buildItem(_("Mouse Keys"), A11Y_KEYBOARD_SCHEMA, KEY_MOUSE_KEYS_ENABLED);
            this.menu.addMenuItem(mouseKeys);

            let simClick = this._buildItem(_("Simulated secondary click"), A11Y_MOUSE_SCHEMA, KEY_SEC_CLICK_ENABLED);
            this.menu.addMenuItem(simClick);

            let hoverClick = this._buildItem(_("Hover click"), A11Y_MOUSE_SCHEMA, KEY_DWELL_CLICK_ENABLED);
            this.menu.addMenuItem(hoverClick);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addSettingsAction(_("Universal Access Settings"), 'universal-access');

            this.a11y_settings = new Gio.Settings({ schema_id: A11Y_KEYBOARD_SCHEMA });

            this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._handleStateChange));
            this.set_show_label_in_vertical_panels(false);
            this.hide_applet_label(true);

        }
        catch (e) {
            global.logError(e);
        }
    }

    _handleStateChange(actor, event) {
        if (this.a11y_settings.get_boolean(KEY_STICKY_KEYS_ENABLED)) {
            let state = Keymap.get_modifier_state();
            let modifiers = [];
            if (state & Gdk.ModifierType.LOCK_MASK)
                modifiers.push('Lock');
            if (state & Gdk.ModifierType.CONTROL_MASK)
                modifiers.push('Ctrl');
            if (state & Gdk.ModifierType.MOD4_MASK)
                modifiers.push('Super');
            if (state & Gdk.ModifierType.SUPER_MASK)
                modifiers.push('Super');
            if (state & Gdk.ModifierType.META_MASK)
                modifiers.push('Meta');
            if (state & Gdk.ModifierType.ALT_MASK)
                modifiers.push('Alt');
            if (state & Gdk.ModifierType.MOD5_MASK)
                modifiers.push('Alt Gr');
            if (state & Gdk.ModifierType.SHIFT_MASK)
                modifiers.push('Shift');
            if (state & Gdk.ModifierType.MOD1_MASK)
                modifiers.push('Alt');
            if (state & Gdk.ModifierType.MOD2_MASK)
                modifiers.push('Mod2');
            if (state & Gdk.ModifierType.MOD3_MASK)
                modifiers.push('Mod3');
            let keystring = modifiers.join('+');

            this.set_applet_label(keystring);
            this.set_applet_tooltip(keystring);
            this._applet_tooltip.show();
        } else {
            this.reset_tooltip();
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    reset_tooltip () {
        this.set_applet_tooltip(_("Accessibility"));
        this._applet_tooltip.hide();
    }

    _buildItemExtended(string, initial_value, writable, on_set) {
        let widget = new PopupMenu.PopupSwitchMenuItem(string, initial_value);
        if (!writable)
            widget.actor.reactive = false;
        else
            widget.connect('toggled', function(item) {
                on_set(item.state);
            });
        return widget;
    }

    _buildItem(string, schema, key) {
        let settings = new Gio.Settings({ schema_id: schema });
        let widget = this._buildItemExtended(string,
            settings.get_boolean(key),
            settings.is_writable(key),
            function(enabled) {
                return settings.set_boolean(key, enabled);
            });
        settings.connect('changed::'+key, function() {
            widget.setToggleState(settings.get_boolean(key));
        });
        return widget;
    }

    _buildHCItem() {
        let settings = new Gio.Settings({ schema_id: DESKTOP_INTERFACE_SCHEMA });
        let settingsWM = new Gio.Settings({ schema_id: WM_PREFERENCES_SCHEMA });
        let gtkTheme = settings.get_string(KEY_GTK_THEME);
        let iconTheme = settings.get_string(KEY_ICON_THEME);
        let wmTheme = settingsWM.get_string(KEY_WM_THEME);
        let hasHC = (gtkTheme == HIGH_CONTRAST_THEME);
        let highContrast = this._buildItemExtended(
            _("High Contrast"),
            hasHC,
            settings.is_writable(KEY_GTK_THEME) && settings.is_writable(KEY_ICON_THEME) && settingsWM.is_writable(KEY_WM_THEME),
            function (enabled) {
                if (enabled) {
                    settings.set_string(KEY_GTK_THEME, HIGH_CONTRAST_THEME);
                    settings.set_string(KEY_ICON_THEME, HIGH_CONTRAST_THEME);
                    settingsWM.set_string(KEY_WM_THEME, HIGH_CONTRAST_THEME);
                } else if(!hasHC) {
                    settings.set_string(KEY_GTK_THEME, gtkTheme);
                    settings.set_string(KEY_ICON_THEME, iconTheme);
                    settingsWM.set_string(KEY_WM_THEME, wmTheme);
                } else {
                    settings.reset(KEY_GTK_THEME);
                    settings.reset(KEY_ICON_THEME);
                    settingsWM.reset(KEY_WM_THEME);
                }
            });
        settings.connect('changed::' + KEY_GTK_THEME, function() {
            let value = settings.get_string(KEY_GTK_THEME);
            if (value == HIGH_CONTRAST_THEME) {
                highContrast.setToggleState(true);
            } else {
                highContrast.setToggleState(false);
                gtkTheme = value;
            }
        });
        settings.connect('changed::' + KEY_ICON_THEME, function() {
            let value = settings.get_string(KEY_ICON_THEME);
            if (value != HIGH_CONTRAST_THEME)
                iconTheme = value;
        });
        settingsWM.connect('changed::' + KEY_WM_THEME, function() {
            let value = settingsWM.get_string(KEY_WM_THEME);
            if (value != HIGH_CONTRAST_THEME)
                wmTheme = value;
        });
        return highContrast;
    }

    _buildFontItem() {
        let settings = new Gio.Settings({ schema_id: DESKTOP_INTERFACE_SCHEMA });

        let factor = settings.get_double(KEY_TEXT_SCALING_FACTOR);
        let initial_setting = (factor > 1.0);
        let widget = this._buildItemExtended(_("Large Text"),
            initial_setting,
            settings.is_writable(KEY_TEXT_SCALING_FACTOR),
            function (enabled) {
                if (enabled)
                    settings.set_double(KEY_TEXT_SCALING_FACTOR,
                                        DPI_FACTOR_LARGE);
                else
                    settings.reset(KEY_TEXT_SCALING_FACTOR);
            });
        settings.connect('changed::' + KEY_TEXT_SCALING_FACTOR, function() {
            let factor = settings.get_double(KEY_TEXT_SCALING_FACTOR);
            let active = (factor > 1.0);
            widget.setToggleState(active);
        });
        return widget;
    }

    on_applet_removed_from_panel() {
        Main.systrayManager.unregisterTrayIconReplacement(this.metadata.uuid);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonA11YApplet(metadata, orientation, panel_height, instance_id);
}
