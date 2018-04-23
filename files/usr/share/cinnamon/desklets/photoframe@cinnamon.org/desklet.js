const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Desklet = imports.ui.desklet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const Settings = imports.ui.settings;

class CinnamonPhotoFrameDesklet extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);

        this.metadata = metadata;
        this.update_id = 0;

        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, this.instance_id);
        this.settings.bind('directory', 'dir', this.on_setting_changed);
        this.settings.bind('shuffle', 'shuffle', this.on_setting_changed);
        this.settings.bind('delay', 'delay', this.on_setting_changed);
        this.settings.bind('height', 'height', this.on_setting_changed);
        this.settings.bind('width', 'width', this.on_setting_changed);
        this.settings.bind('fade-delay', 'fade_delay', this.on_setting_changed);
        this.settings.bind('effect', 'effect', this.on_setting_changed);

        this.dir_monitor_id = 0;
        this.dir_monitor = null;
        this.dir_file = null;

        this.setHeader(_('Photo Frame'));
        this._setup_dir_monitor();
        this.setup_display();
    }

    on_setting_changed() {
        if (this.update_id != 0) {
            Mainloop.source_remove(this.update_id);
        }
        this.update_id = 0;
        this._setup_dir_monitor();
        if (this.currentPicture) {
            this.currentPicture.destroy();
        }
        this._photoFrame.destroy();
        this.setup_display();
    }

    _setup_dir_monitor() {
        if (this.dir_monitor_id != 0 && this.dir_monitor) {
            this.dir_monitor.disconnect(this.dir_monitor_id);
            this.dir_monitor_id = 0;
        }

        /* The widget used to choose the folder the images are drawn from
           was changed to use a URI instead of a path. This check is just
           to ensure that people upgrading cinnamon versions will get the
           existing path converted to a proper URI */
        if (this.dir.indexOf('://') === -1) {
            let file = Gio.file_new_for_path(this.dir);
            this.dir = file.get_uri();
        }

        if (this.dir === ' ') {
            let file = Gio.file_new_for_path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES));
            this.dir = file.get_uri();
        }

        this.dir_file = Gio.file_new_for_uri(this.dir);
        this.dir_monitor = this.dir_file.monitor_directory(0, null);
        this.dir_monitor_id = this.dir_monitor.connect('changed', Lang.bind(this, this.on_setting_changed));
    }

    on_desklet_removed() {
        if (this.dir_monitor_id && this.dir_monitor) {
            this.dir_monitor.disconnect(this.dir_monitor_id);
            this.dir_monitor_id = null;
        }

        if (this.update_id != 0) {
            Mainloop.source_remove(this.update_id);
            this.update_id = 0;
        }
    }

    _scan_dir(dir) {
        let dir_file = Gio.file_new_for_uri(dir);
        let fileEnum = dir_file.enumerate_children('standard::type,standard::name', Gio.FileQueryInfoFlags.NONE, null);

        let info;
        while ((info = fileEnum.next_file(null)) != null) {
            let fileType = info.get_file_type();
            let fileName = dir + '/' + info.get_name();
            if (fileType != Gio.FileType.DIRECTORY) {
                this._images.push(fileName);
            } else {
                this._scan_dir(fileName);
            }
        }

        fileEnum.close(null);
    }

    setup_display() {
        this._photoFrame = new St.Bin({style_class: 'photoframe-box', x_align: St.Align.START});

        this._bin = new St.Bin();
        this._bin.set_size(this.width, this.height);

        this._images = [];
        this._photoFrame.set_child(this._bin);
        this.setContent(this._photoFrame);

        if (this.effect == 'black-and-white') {
            let effect = new Clutter.DesaturateEffect();
            this._bin.add_effect(effect);
        } else if (this.effect == 'sepia') {
            let color = new Clutter.Color();
            color.from_hls(17.0, 0.59, 0.4);
            let colorize_effect = new Clutter.ColorizeEffect(color);
            let contrast_effect = new Clutter.BrightnessContrastEffect();
            let desaturate_effect = new Clutter.DesaturateEffect();
            desaturate_effect.set_factor(0.41);
            contrast_effect.set_brightness_full(0.1, 0.1, 0.1);
            contrast_effect.set_contrast_full(0.1, 0.1, 0.1);
            this._bin.add_effect(colorize_effect);
            this._bin.add_effect(contrast_effect);
            this._bin.add_effect(desaturate_effect);
        }

        if (this.dir_file.query_exists(null)) {
            this._scan_dir(this.dir);

            this.updateInProgress = false;
            this.currentPicture = null;

            this.update_id = 0;
            this._update_loop();
        }
    }

    _update_loop() {
        this._update();
        this.update_id = Mainloop.timeout_add_seconds(this.delay, Lang.bind(this, this._update_loop));
    }

    _size_pic(image) {
        image.disconnect(image._notif_id);

        let height, width;
        let imageRatio = image.width / image.height;
        let frameRatio = this.width / this.height;

        if (imageRatio > frameRatio) {
            width = this.width;
            height = this.width / imageRatio;
        } else {
            height = this.height;
            width = this.height * imageRatio;
        }

        image.set_size(width, height);
    }

    _update() {
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;
        let image_path;
        if (!this.shuffle) {
            image_path = this._images.shift();
            this._images.push(image_path);
        } else {
            image_path = this._images[Math.floor(Math.random() * this._images.length)];
        }

        if (!image_path) {
            this.updateInProgress = false;
            return;
        }

        let image = this._loadImage(image_path);

        if (image == null) {
            this.updateInProgress = false;
            return;
        }

        let old_pic = this.currentPicture;
        this.currentPicture = image;
        this.currentPicture.path = image_path;

        if (this.fade_delay > 0) {
            Tweener.addTween(this._bin, {
                opacity: 0,
                time: this.fade_delay,
                transition: 'easeInSine',
                onComplete: () => {
                    this._bin.set_child(this.currentPicture);
                    Tweener.addTween(this._bin, {
                        opacity: 255,
                        time: this.fade_delay,
                        transition: 'easeInSine'
                    });
                }
            });
        } else {
            this._bin.set_child(this.currentPicture);
        }
        if (old_pic) {
            old_pic.destroy();
        }

        this.updateInProgress = false;
    }

    on_desklet_clicked(event) {
        try {
            if (event.get_button() == 1) {
                this._update();
            } else if (event.get_button() == 2) {
                Util.spawn(['xdg-open', this.currentPicture.path]);
            }
        } catch (e) {
            global.logError(e);
        }
    }

    _loadImage(filePath) {
        try {
            let image = St.TextureCache.get_default().load_uri_async(filePath, this.width, this.height);

            image._notif_id = image.connect('notify::size', Lang.bind(this, this._size_pic));

            return image;
        } catch (x) {
            // Probably a non-image is in the folder
            return null;
        }
    }
}

function main(metadata, desklet_id) {
    return new CinnamonPhotoFrameDesklet(metadata, desklet_id);
}
