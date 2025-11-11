const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Desklet = imports.ui.desklet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Settings = imports.ui.settings;

class CinnamonPhotoFrameDesklet extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);

        this.metadata = metadata;

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

        this._update_id = 0;
        this._loop_start_id = 0;

        this.setHeader(_('Photo Frame'));
        this._setup_dir_monitor();
        this.setup_display();
    }

    _remove_timers() {
        if (this._update_id != 0) {
            GLib.source_remove(this._update_id);
            this._update_id = 0;
        }

        if (this._loop_start_id != 0) {
            GLib.source_remove(this._loop_start_id);
            this._loop_start_id = 0;
        }
    }

    on_setting_changed() {
        this._remove_timers();
        this._setup_dir_monitor();
        if (this.currentPicture) {
            this.currentPicture.destroy();
        }
        this._photoFrame.destroy();
        this.setup_display();
    }

    _setup_dir_monitor() {
        if (this.dir_monitor_id != 0) {
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
            this.dir_file = Gio.file_new_for_path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES));
        } else {
            this.dir_file = Gio.file_new_for_uri(this.dir);
        }

        this.dir_monitor = this.dir_file.monitor_directory(0, null);
        this.dir_monitor_id = this.dir_monitor.connect('changed', Lang.bind(this, this.on_setting_changed));
    }

    on_desklet_removed() {
        if (this.dir_monitor_id && this.dir_monitor) {
            this.dir_monitor.disconnect(this.dir_monitor_id);
            this.dir_monitor_id = null;
        }

        this._remove_timers();
    }

    _scan_picture_dir(dir) {
        let fileEnum = dir.enumerate_children_async(
            'standard::type,standard::name,standard::is-hidden,standard::content-type',
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null, (obj, res) => {
                let enumerator = null;
                try {
                    enumerator = obj.enumerate_children_finish(res);
                } catch (e) {
                    global.logError("Could not read location for photoframe desklet", e);
                    return;
                }

                var next_files_complete = (obj, res) => {
                    let children;
                    try {
                        children = obj.next_files_finish(res);
                    } catch (e) {
                        global.logError(e);
                        enumerator.close(null);
                        return;
                    }

                    if (children.length == 0) {
                        enumerator.close(null);
                        return;
                    }

                    for (let child_info of children) {
                        if (child_info.get_is_hidden()) {
                            continue;
                        }

                        if (child_info.get_file_type() == Gio.FileType.DIRECTORY) {
                            this._scan_picture_dir(enumerator.get_child(child_info));
                        } else {
                            const content_type = child_info.get_content_type();

                            if (content_type == null || !St.TextureCache.get_default().can_load_mime_type(content_type))
                                continue;

                            this._addImage(enumerator.get_child(child_info).get_path());
                        }
                    }

                    enumerator.next_files_async(10, GLib.PRIORITY_LOW, null, next_files_complete);
                }

                enumerator.next_files_async(10, GLib.PRIORITY_LOW, null, next_files_complete);
            }
        );
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
            Clutter.Color.from_hls(color, 17.0, 0.59, 0.4);
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

        this.updateInProgress = false;
        this.currentPicture = null;

        this._scan_picture_dir(this.dir_file);
    }

    _addImage(path) {
        this._images.push(path);

        if (this._loop_start_id > 0) {
            GLib.source_remove(this._loop_start_id);
        }

        this._loop_start_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => this._update_loop());
    }

    _update_loop() {
        this._update();

        if (this._update_id != 0) {
            GLib.source_remove(this._update_id);
        }

        this._update_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.delay, () => this._update());

        this._loop_start_id = 0;
        return GLib.SOURCE_REMOVE;
    }

    _update() {
        let image_path;

        if (!this.shuffle) {
            image_path = this._images.shift();
            this._images.push(image_path);
        } else {
            image_path = this._images[Math.floor(Math.random() * this._images.length)];
        }

        if (image_path) {
            St.TextureCache.get_default().load_image_from_file_async(
                image_path,
                this.width, this.height,
                // FIXME: image_path should be the user_data arg of load_image_from_file_async,
                // not our callback binding, but we get a complaint about wrong number of args.
                // This seems to work but it ends up putting image_path as the first argument of
                // _nextImageLoaded instead of the last.
                // We need to pass the path so we have something to open if the user middle-clicks
                // the photo (to open it in a viewer).
                this._nextImageLoaded.bind(this, image_path)
            );
        }

        return GLib.SOURCE_CONTINUE;
    }

    _nextImageLoaded(image_path, cache, handle, actor) {
        if (actor == null) {
            this.updateInProgress = false;
            return;
        }

        let old_pic = this.currentPicture;
        this.currentPicture = actor;
        this.currentPicture.path = image_path;

        if (this.fade_delay > 0) {
            this._bin.ease({
                opacity: 0,
                duration: (this.fade_delay * 1000) / 2, // setting is sec, easing uses ms
                animationRequired: true,
                mode: Clutter.AnimationMode.EASE_IN_SINE,
                onComplete: () => {
                    this._bin.set_child(this.currentPicture);
                    
                    if (old_pic) {
                        old_pic.destroy();
                    }

                    this._bin.ease({
                        opacity: 255,
                        duration: (this.fade_delay * 1000) / 2,
                        animationRequired: true,
                        mode: Clutter.AnimationMode.EASE_IN_SINE
                    });
                }
            });
        } else {
            this._bin.set_child(this.currentPicture);

            if (old_pic) {
                old_pic.destroy();
            }
        }
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
}

function main(metadata, desklet_id) {
    return new CinnamonPhotoFrameDesklet(metadata, desklet_id);
}
