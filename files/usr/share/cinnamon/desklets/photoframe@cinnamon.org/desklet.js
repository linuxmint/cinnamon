const {
    file_new_for_path,
    file_new_for_uri,
    FileQueryInfoFlags,
    FileType
} = imports.gi.Gio;
const {
    BrightnessContrastEffect,
    Color,
    ColorizeEffect,
    DesaturateEffect
} = imports.gi.Clutter;
const {
    Align,
    Bin,
    TextureCache
} = imports.gi.St;
const {Desklet} = imports.ui.desklet;
const {get_user_special_dir, UserDirectory} = imports.gi.GLib;
const {addTween} = imports.ui.tweener;
const {spawn} = imports.misc.util;
const {DeskletSettings} = imports.ui.settings;

class CinnamonPhotoFrameDesklet extends Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);

        this.metadata = metadata;

        this.state = {};

        this.settings = new DeskletSettings(this.state, metadata.uuid, this.instance_id, true);
        this.settings.promise.then(() => this.settingsInit());
    }

    settingsInit() {
        this.settings.bind('directory', 'dir', () => this.on_setting_changed());
        this.settings.bind('shuffle', 'shuffle', () => this.on_setting_changed());
        this.settings.bind('delay', 'delay', () => this.on_setting_changed());
        this.settings.bind('height', 'height', () => this.on_setting_changed());
        this.settings.bind('width', 'width', () => this.on_setting_changed());
        this.settings.bind('fade-delay', 'fade_delay', () => this.on_setting_changed());
        this.settings.bind('effect', 'effect', () => this.on_setting_changed());

        this.dir_monitor_id = 0;
        this.dir_monitor = null;
        this.dir_file = null;

        this.setHeader(_('Photo Frame'));
        this._setup_dir_monitor();
        this.setup_display();
    }

    on_setting_changed() {
        this._setup_dir_monitor();
        if (this.currentPicture) {
            this.currentPicture.destroy();
        }
        this._photoFrame.destroy();
        this.setup_display();
    }

    _setup_dir_monitor() {
        let {dir} = this.state;

        if (this.dir_monitor_id != 0 && this.dir_monitor) {
            this.dir_monitor.disconnect(this.dir_monitor_id);
            this.dir_monitor_id = 0;
        }

        /* The widget used to choose the folder the images are drawn from
           was changed to use a URI instead of a path. This check is just
           to ensure that people upgrading cinnamon versions will get the
           existing path converted to a proper URI */
        if (dir.indexOf('://') === -1) {
            let file = file_new_for_path(dir);
            this.state.dir = file.get_uri();
        }

        if (dir === ' ') {
            let file = file_new_for_path(get_user_special_dir(UserDirectory.DIRECTORY_PICTURES));
            this.state.dir = file.get_uri();
        }

        this.dir_file = file_new_for_uri(dir);
        this.dir_monitor = this.dir_file.monitor_directory(0, null);
        this.dir_monitor_id = this.dir_monitor.connect('changed', () => this.on_setting_changed());
    }

    on_desklet_removed() {
        if (this.dir_monitor_id && this.dir_monitor) {
            this.dir_monitor.disconnect(this.dir_monitor_id);
            this.dir_monitor_id = null;
        }
    }

    _scan_dir(dir) {
        let dir_file = file_new_for_uri(dir);
        let fileEnum = dir_file.enumerate_children('standard::type,standard::name', FileQueryInfoFlags.NONE, null);

        let info;
        while ((info = fileEnum.next_file(null)) != null) {
            let fileType = info.get_file_type();
            let fileName = dir + '/' + info.get_name();
            if (fileType != FileType.DIRECTORY) {
                this._images.push(fileName);
            } else {
                this._scan_dir(fileName);
            }
        }

        fileEnum.close(null);
    }

    setup_display() {
        let {width, height, effect, dir} = this.state;

        this._photoFrame = new Bin({style_class: 'photoframe-box', x_align: Align.START});

        this._bin = new Bin();
        this._bin.set_size(width, height);

        this._images = [];
        this._photoFrame.set_child(this._bin);
        this.setContent(this._photoFrame);

        if (effect === 'black-and-white') {
            let effect = new DesaturateEffect();
            this._bin.add_effect(effect);
        } else if (effect === 'sepia') {
            let color = new Color();
            color.from_hls(17.0, 0.59, 0.4);
            let colorize_effect = new ColorizeEffect(color);
            let contrast_effect = new BrightnessContrastEffect();
            let desaturate_effect = new DesaturateEffect();
            desaturate_effect.set_factor(0.41);
            contrast_effect.set_brightness_full(0.1, 0.1, 0.1);
            contrast_effect.set_contrast_full(0.1, 0.1, 0.1);
            this._bin.add_effect(colorize_effect);
            this._bin.add_effect(contrast_effect);
            this._bin.add_effect(desaturate_effect);
        }

        if (this.dir_file.query_exists(null)) {
            this._scan_dir(dir);

            this.updateInProgress = false;
            this.currentPicture = null;

            this._update_loop();
        }
    }

    _update_loop() {
        this._update();
        setTimeout(() => this._update_loop(), this.state.delay * 1000);
    }

    _size_pic(image) {
        image.disconnect(image._notif_id);

        let {height, width} = this.state;
        let _width, _height;
        let imageRatio = image.width / image.height;
        let frameRatio = width / height;

        if (imageRatio > frameRatio) {
            _width = width;
            _height = width / imageRatio;
        } else {
            _height = height;
            _width = height * imageRatio;
        }

        image.set_size(_width, _height);
    }

    _update() {
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;
        let {shuffle, fade_delay} = this.state;
        let image_path;
        if (!shuffle) {
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

        if (fade_delay > 0) {
            addTween(this._bin, {
                opacity: 0,
                time: fade_delay,
                transition: 'easeInSine',
                onComplete: () => {
                    this._bin.set_child(this.currentPicture);
                    addTween(this._bin, {
                        opacity: 255,
                        time: fade_delay,
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
                spawn(['xdg-open', this.currentPicture.path]);
            }
        } catch (e) {
            global.logError(e);
        }
    }

    _loadImage(filePath) {
        try {
            let image = TextureCache.get_default().load_uri_async(filePath, this.state.width, this.state.height);

            image._notif_id = image.connect('notify::size', (i) => this._size_pic(i));

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
