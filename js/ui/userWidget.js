// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
//
// A widget showing the user avatar and name
/* exported UserWidget */

const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Params = imports.misc.params;

var AVATAR_ICON_SIZE = 64;

// Directory for cached avatar copies (to bypass St's image caching)
// Using ~/.cache for persistence across reboots
const AVATAR_CACHE_DIR = GLib.build_filenamev([GLib.get_user_cache_dir(), 'cinnamon', 'avatars']);

// Maximum dimensions for avatar images (AccountsService has size limits)
const MAX_AVATAR_SIZE = 512;

var Avatar = GObject.registerClass(
class Avatar extends St.Bin {
    _init(user, params) {
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        params = Params.parse(params, {
            styleClass: 'user-icon',
            reactive: true,
            track_hover: true,
            iconSize: AVATAR_ICON_SIZE,
        });

        super._init({
            style_class: params.styleClass,
            reactive: params.reactive,
            width: params.iconSize * themeContext.scaleFactor,
            height: params.iconSize * themeContext.scaleFactor,
        });

        this.connect('notify::hover', this._onHoverChanged.bind(this));

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

    _onHoverChanged() {
        if (this.hover) {
            if (this.child) {
                this.child.add_style_class_name('highlighted');
            }
            else {
                let effect = new Clutter.BrightnessContrastEffect();
                effect.set_brightness(0.2);
                effect.set_contrast(0.3);
                this.add_effect(effect);
            }
            this.add_accessible_state(Atk.StateType.FOCUSED);
        } else {
            if (this.child) {
                this.child.remove_style_class_name('highlighted');
            }
            else {
                this.clear_effects();
            }
            this.remove_accessible_state(Atk.StateType.FOCUSED);
        }
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

    // Get a cache-busted path for the icon file
    // This copies (and optionally resizes) the file to ~/.cache to bypass St's image cache
    _getCacheBustedIconPath(iconFile) {
        // Only needed for AccountsService icons (same path, changing content)
        if (!iconFile.startsWith('/var/lib/AccountsService/icons/'))
            return iconFile;

        try {
            // Ensure cache directory exists
            let cacheDir = Gio.File.new_for_path(AVATAR_CACHE_DIR);
            if (!cacheDir.query_exists(null)) {
                cacheDir.make_directory_with_parents(null);
            }

            // Get file modification time for cache-busting
            let file = Gio.File.new_for_path(iconFile);
            let info = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
            let mtime = info.get_modification_date_time().to_unix();

            // Get username from path
            let username = GLib.path_get_basename(iconFile);

            // Create unique filename with timestamp
            let cachedPath = GLib.build_filenamev([AVATAR_CACHE_DIR, `${username}-${mtime}`]);

            // Check if cached file already exists
            let cachedFile = Gio.File.new_for_path(cachedPath);
            if (!cachedFile.query_exists(null)) {
                // Clean up old cached files for this user
                this._cleanOldCachedAvatars(username, cachedPath);

                // Load image with GdkPixbuf to check dimensions
                let pixbuf = GdkPixbuf.Pixbuf.new_from_file(iconFile);
                let width = pixbuf.get_width();
                let height = pixbuf.get_height();

                // If image is larger than MAX_AVATAR_SIZE, resize it
                if (width > MAX_AVATAR_SIZE || height > MAX_AVATAR_SIZE) {
                    // Calculate aspect-preserving dimensions
                    let scale = Math.min(MAX_AVATAR_SIZE / width, MAX_AVATAR_SIZE / height);
                    let newWidth = Math.floor(width * scale);
                    let newHeight = Math.floor(height * scale);

                    // Resize and save
                    let scaledPixbuf = pixbuf.scale_simple(newWidth, newHeight, GdkPixbuf.InterpType.BILINEAR);
                    scaledPixbuf.savev(cachedPath, 'png', [], []);
                } else {
                    // Image is small enough, just copy it
                    file.copy(cachedFile, Gio.FileCopyFlags.OVERWRITE, null, null);
                }
            }

            return cachedPath;
        } catch (e) {
            global.logError(`[UserWidget] Failed to create cached avatar: ${e}`);
            return iconFile;
        }
    }

    // Remove old cached avatars for a user (keep only the current one)
    _cleanOldCachedAvatars(username, keepPath) {
        try {
            let cacheDir = Gio.File.new_for_path(AVATAR_CACHE_DIR);
            let enumerator = cacheDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                let name = info.get_name();
                if (name.startsWith(username + '-')) {
                    let filePath = GLib.build_filenamev([AVATAR_CACHE_DIR, name]);
                    if (filePath !== keepPath) {
                        let file = Gio.File.new_for_path(filePath);
                        file.delete(null);
                    }
                }
            }
        } catch (e) {
            // Ignore cleanup errors
        }
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
            // Use cache-busted path to bypass St's image caching
            let displayPath = this._getCacheBustedIconPath(iconFile);
            this.child = null;
            this.add_style_class_name('user-avatar');
            this.style = `
                background-image: url("${displayPath}");
                background-size: cover;`;
        } else {
            this.style = null;
            this.child = new St.Icon({
                icon_name: 'xsi-avatar-default-symbolic',
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
        this.add(this._avatar, { x_fill: false });

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
