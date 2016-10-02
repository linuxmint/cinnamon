const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GConf = imports.gi.GConf;
const Main = imports.ui.main;
const Gdk = imports.gi.Gdk;

const A11Y_SCHEMA = 'org.cinnamon.desktop.a11y.keyboard';
const KEY_STICKY_KEYS_ENABLED = 'stickykeys-enable';
const KEY_BOUNCE_KEYS_ENABLED = 'bouncekeys-enable';
const KEY_SLOW_KEYS_ENABLED   = 'slowkeys-enable';
const KEY_MOUSE_KEYS_ENABLED  = 'mousekeys-enable';

const APPLICATIONS_SCHEMA = 'org.cinnamon.desktop.a11y.applications';

const DPI_LOW_REASONABLE_VALUE  = 50;
const DPI_HIGH_REASONABLE_VALUE = 500;

const DPI_FACTOR_LARGE   = 1.25;
const DPI_FACTOR_LARGER  = 1.5;
const DPI_FACTOR_LARGEST = 2.0;

const KEY_META_DIR       = '/apps/metacity/general';
const KEY_VISUAL_BELL = KEY_META_DIR + '/visual_bell';

const DESKTOP_INTERFACE_SCHEMA = 'org.cinnamon.desktop.interface';
const KEY_GTK_THEME      = 'gtk-theme';
const KEY_ICON_THEME     = 'icon-theme';
const KEY_TEXT_SCALING_FACTOR = 'text-scaling-factor';

const HIGH_CONTRAST_THEME = 'HighContrast';

const Keymap = Gdk.Keymap.get_default();

function MyApplet(metadata, orientation, panel_height, applet_id) {
    this._init(metadata, orientation, panel_height, applet_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("a11y", metadata.uuid);
            
            this.set_applet_icon_symbolic_name("preferences-desktop-accessibility");
            this.set_applet_tooltip(_("Accessibility"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
                                
            let client = GConf.Client.get_default();
            client.add_dir(KEY_META_DIR, GConf.ClientPreloadType.PRELOAD_ONELEVEL, null);

            let highContrast = this._buildHCItem();
            this.menu.addMenuItem(highContrast);

            let magnifier = this._buildItem(_("Zoom"), APPLICATIONS_SCHEMA,
                                                       'screen-magnifier-enabled');
            this.menu.addMenuItem(magnifier);

            let textZoom = this._buildFontItem();
            this.menu.addMenuItem(textZoom);

            let screenReader = this._buildItem(_("Screen Reader"), APPLICATIONS_SCHEMA,
                                                                  'screen-reader-enabled');
            this.menu.addMenuItem(screenReader);

            let screenKeyboard = this._buildItem(_("Screen Keyboard"), APPLICATIONS_SCHEMA,
                                                                       'screen-keyboard-enabled');
            this.menu.addMenuItem(screenKeyboard);

            let visualBell = this._buildItemGConf(_("Visual Alerts"), client, KEY_VISUAL_BELL);
            this.menu.addMenuItem(visualBell);

            let stickyKeys = this._buildItem(_("Sticky Keys"), A11Y_SCHEMA, KEY_STICKY_KEYS_ENABLED);
            this.menu.addMenuItem(stickyKeys);

            let slowKeys = this._buildItem(_("Slow Keys"), A11Y_SCHEMA, KEY_SLOW_KEYS_ENABLED);
            this.menu.addMenuItem(slowKeys);

            let bounceKeys = this._buildItem(_("Bounce Keys"), A11Y_SCHEMA, KEY_BOUNCE_KEYS_ENABLED);
            this.menu.addMenuItem(bounceKeys);

            let mouseKeys = this._buildItem(_("Mouse Keys"), A11Y_SCHEMA, KEY_MOUSE_KEYS_ENABLED);
            this.menu.addMenuItem(mouseKeys);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addSettingsAction(_("Universal Access Settings"), 'universal-access');

            this.a11y_settings = new Gio.Settings({ schema_id: A11Y_SCHEMA });

            this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._handleStateChange));
            this.set_applet_label('');

        }
        catch (e) {
            global.logError(e);
        }
    },

    _handleStateChange: function(actor, event) {
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
            this.set_applet_label(modifiers.join('+'));
        }
        else {
            this.set_applet_label('');
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _buildItemExtended: function(string, initial_value, writable, on_set) {
        let widget = new PopupMenu.PopupSwitchMenuItem(string, initial_value);
        if (!writable)
            widget.actor.reactive = false;
        else
            widget.connect('toggled', function(item) {
                on_set(item.state);
            });
        return widget;
    },

    _buildItemGConf: function(string, client, key) {
        function on_get() {
            return client.get_bool(key);
        }
        let widget = this._buildItemExtended(string,
            client.get_bool(key),
            client.key_is_writable(key),
            function(enabled) {
                client.set_bool(key, enabled);
            });
        return widget;
    },

    _buildItem: function(string, schema, key) {
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
    },

    _buildHCItem: function() {
        let settings = new Gio.Settings({ schema_id: DESKTOP_INTERFACE_SCHEMA });
        let gtkTheme = settings.get_string(KEY_GTK_THEME);
        let iconTheme = settings.get_string(KEY_ICON_THEME);
        let hasHC = (gtkTheme == HIGH_CONTRAST_THEME);
        let highContrast = this._buildItemExtended(
            _("High Contrast"),
            hasHC,
            settings.is_writable(KEY_GTK_THEME) && settings.is_writable(KEY_ICON_THEME),
            function (enabled) {
                if (enabled) {
                    settings.set_string(KEY_GTK_THEME, HIGH_CONTRAST_THEME);
                    settings.set_string(KEY_ICON_THEME, HIGH_CONTRAST_THEME);
                } else if(!hasHC) {
                    settings.set_string(KEY_GTK_THEME, gtkTheme);
                    settings.set_string(KEY_ICON_THEME, iconTheme);
                } else {
                    settings.reset(KEY_GTK_THEME);
                    settings.reset(KEY_ICON_THEME);
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
        return highContrast;
    },

    _buildFontItem: function() {
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
    },

    on_applet_removed_from_panel: function() {
        Main.systrayManager.unregisterRole("a11y", this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;      
}
