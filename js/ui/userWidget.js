// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
//
// A widget showing the user avatar and name
/* exported UserWidget */

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Params = imports.misc.params;

var AVATAR_ICON_SIZE = 64;

var Avatar = GObject.registerClass(
class Avatar extends St.Bin {
    _init(user, params) {
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        params = Params.parse(params, {
            styleClass: 'user-icon',
            reactive: false,
            iconSize: AVATAR_ICON_SIZE,
        });

        super._init({
            style_class: params.styleClass,
            reactive: params.reactive,
            width: params.iconSize * themeContext.scaleFactor,
            height: params.iconSize * themeContext.scaleFactor,
        });

        this.set_important(true);
        this._iconSize = params.iconSize;
        this._user = user;

        this.bind_property('reactive', this, 'track-hover',
            GObject.BindingFlags.SYNC_CREATE);
        this.bind_property('reactive', this, 'can-focus',
            GObject.BindingFlags.SYNC_CREATE);

        // Monitor the scaling factor to make sure we recreate the avatar when needed.
        this._scaleFactorChangeId =
            themeContext.connect('notify::scale-factor', this.update.bind(this));

        this.connect('destroy', this._onDestroy.bind(this));
    }

    vfunc_style_changed() {
        super.vfunc_style_changed();

        let node = this.get_theme_node();
        let [found, iconSize] = node.lookup_length('icon-size', false);

        if (!found)
            return;

        let themeContext = St.ThemeContext.get_for_stage(global.stage);

        // node.lookup_length() returns a scaled value, but we
        // need unscaled
        this._iconSize = iconSize / themeContext.scaleFactor;
        this.update();
    }

    _onDestroy() {
        if (this._scaleFactorChangeId) {
            let themeContext = St.ThemeContext.get_for_stage(global.stage);
            themeContext.disconnect(this._scaleFactorChangeId);
            delete this._scaleFactorChangeId;
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

        let { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        this.set_size(
            this._iconSize * scaleFactor,
            this._iconSize * scaleFactor);

        if (iconFile) {
            this.child = null;
            this.add_style_class_name('user-avatar');
            this.style = `
                background-image: url("${iconFile}");
                background-size: cover;`;
        } else {
            this.style = null;
            this.child = new St.Icon({
                icon_name: 'avatar-default-symbolic',
                icon_size: this._iconSize,
            });
        }
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
