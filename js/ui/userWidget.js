// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
//
// A widget showing the user avatar and name
/* exported UserWidget */

const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Params = imports.misc.params;

var AVATAR_ICON_SIZE = 64;

var Avatar = GObject.registerClass(
class Avatar extends Clutter.Actor {
    _init(user, params) {
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        params = Params.parse(params, {
            styleClass: 'user-icon',
            reactive: true,
            iconSize: AVATAR_ICON_SIZE,
        });

        super._init({
            layout_manager: new Clutter.BinLayout(),
            reactive: params.reactive,
            width: params.iconSize * themeContext.scaleFactor,
            height: params.iconSize * themeContext.scaleFactor,
        });

        this._styleClass = params.styleClass;
        this._iconSize = params.iconSize;
        this._user = user;
        this._iconFile = null;
        this._child = null;

        this.bind_property('reactive', this, 'can-focus',
            GObject.BindingFlags.SYNC_CREATE);

        // Monitor the scaling factor to make sure we recreate the avatar when needed.
        this._scaleFactorChangeId =
            themeContext.connect('notify::scale-factor', this.update.bind(this));

        // Monitor for changes to the icon file on disk
        this._textureCache = St.TextureCache.get_default();
        this._textureFileChangedId =
            this._textureCache.connect('texture-file-changed', this._onTextureFileChanged.bind(this));

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onHoverChanged() {
        if (!this._child)
            return;

        if (this._child.hover) {
            if (this._iconFile) {
                let effect = new Clutter.BrightnessContrastEffect();
                effect.set_brightness(0.2);
                effect.set_contrast(0.3);
                this._child.add_effect(effect);
            } else {
                this._child.add_style_class_name('highlighted');
            }
            this._child.add_accessible_state(Atk.StateType.FOCUSED);
        } else {
            if (this._iconFile) {
                this._child.clear_effects();
            } else {
                this._child.remove_style_class_name('highlighted');
            }
            this._child.remove_accessible_state(Atk.StateType.FOCUSED);
        }
    }

    _onStyleChanged() {
        let node = this._child.get_theme_node();
        let [found, iconSize] = node.lookup_length('icon-size', false);

        if (!found)
            return;

        let themeContext = St.ThemeContext.get_for_stage(global.stage);

        // node.lookup_length() returns a scaled value, but we need unscaled
        let newIconSize = iconSize / themeContext.scaleFactor;

        if (newIconSize !== this._iconSize) {
            this._iconSize = newIconSize;
            this.update();
        }
    }

    _onDestroy() {
        if (this._scaleFactorChangeId) {
            let themeContext = St.ThemeContext.get_for_stage(global.stage);
            themeContext.disconnect(this._scaleFactorChangeId);
            this._scaleFactorChangeId = 0;
        }

        if (this._textureFileChangedId) {
            this._textureCache.disconnect(this._textureFileChangedId);
            this._textureFileChangedId = 0;
        }
    }

    _onTextureFileChanged(cache, file) {
        if (this._iconFile && file.get_path() === this._iconFile) {
            this.update();
        }
    }

    setSensitive(sensitive) {
        this.reactive = sensitive;
    }

    setSize(size) {
        this._iconSize = size;
        this.update();
    }

    update() {
        let iconFile = null;
        if (this._user) {
            iconFile = this._user.get_icon_file();
            if (iconFile && !GLib.file_test(iconFile, GLib.FileTest.EXISTS))
                iconFile = null;
        }

        this._iconFile = iconFile;

        let { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        this.set_size(
            this._iconSize * scaleFactor,
            this._iconSize * scaleFactor);

        // Remove old child
        if (this._child) {
            this._child.destroy();
            this._child = null;
        }

        let size = this._iconSize * scaleFactor;

        if (iconFile) {
            this._child = new St.Bin({
                style_class: `${this._styleClass} user-avatar`,
                reactive: this.reactive,
                track_hover: this.reactive,
                width: size,
                height: size,
                style: `background-image: url("${iconFile}"); background-size: cover;`,
            });
        } else {
            this._child = new St.Bin({
                style_class: this._styleClass,
                reactive: this.reactive,
                track_hover: this.reactive,
                width: size,
                height: size,
                child: new St.Icon({
                    icon_name: 'xsi-avatar-default-symbolic',
                    icon_size: this._iconSize,
                }),
            });
        }

        this._child.set_important(true);
        this._child.connect('notify::hover', this._onHoverChanged.bind(this));
        this._child.connect('style-changed', this._onStyleChanged.bind(this));

        this.add_child(this._child);
    }
});

var UserWidget = GObject.registerClass(
class UserWidget extends St.BoxLayout {
    _init(user, orientation = Clutter.Orientation.HORIZONTAL) {
        // If user is null, that implies a username-based login authorization.
        this._user = user;

        let vertical = orientation == Clutter.Orientation.VERTICAL;
        let xAlign = vertical ? Clutter.ActorAlign.CENTER : Clutter.ActorAlign.START;
        let styleClass = vertical ? 'user-widget vertical' : 'user-widget horizontal';

        super._init({
            styleClass,
            vertical,
            xAlign,
        });

        this.connect('destroy', this._onDestroy.bind(this));

        this._avatar = new Avatar(user);
        this._avatar.x_align = Clutter.ActorAlign.CENTER;
        this.add_child(this._avatar);

        this._label = new St.Label({ style_class: 'user-widget-label' });
        this._label.y_align = Clutter.ActorAlign.CENTER;
        this.add_child(this._label);

        this._userLoadedId = this._user.connect('notify::is-loaded', this._updateUser.bind(this));
        this._userChangedId = this._user.connect('changed', this._updateUser.bind(this));

        if (this._user.is_loaded)
            this._updateUser();
    }

    _onDestroy() {
        if (this._userLoadedId != 0) {
            this._user.disconnect(this._userLoadedId);
            this._userLoadedId = 0;
        }

        if (this._userChangedId != 0) {
            this._user.disconnect(this._userChangedId);
            this._userChangedId = 0;
        }
    }

    _updateUser() {
        if (this._user.is_loaded)
            this._label.text = this._user.get_real_name();
        else
            this._label.text = '';

        this._avatar.update();
    }
});
