const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const PopupMenu = imports.ui.popupMenu;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;

const SettingsProps = {
    // key, type, defaultValue
    DELAY: ['delay', 'i', 5],
    DIRECTORY: ['directory', 's', '~/Pictures'],
    EFFECT: ['effect', 's', 'color'],
    FADE_DELAY: ['fade-delay', 'i', 300],
    HEIGHT: ['height', 'i', 200],
    QUALITY: ['quality', 'i', 2],
    SHUFFLE: ['shuffle', 'b', true],
    WIDTH: ['width', 'i', 300]
};

function MyDesklet(metadata, deskletId){
    this._init(metadata, deskletId);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, deskletId){
        Desklet.Desklet.prototype._init.call(this, metadata);

        this.metadata = metadata;

        this.setHeader(_("Photo Frame"));
        this.settings = new Gio.Settings({schema: 'org.cinnamon.desklets.photoframe'});

        this.deskletId = deskletId;

        this.delay = this.getSettings(SettingsProps.DELAY);
        this.directory = this.getSettings(SettingsProps.DIRECTORY);
        this.effect = this.getSettings(SettingsProps.EFFECT);
        this.fadeDelay = this.getSettings(SettingsProps.FADE_DELAY);
        this.shuffle = this.getSettings(SettingsProps.SHUFFLE);

        this.bindSettings(SettingsProps.EFFECT, 'this.effect', Lang.bind(this, this._setEffects));
        this.bindSettings(SettingsProps.DIRECTORY, 'this.directory', Lang.bind(this, this._setFiles));
        this.bindSettings(SettingsProps.SHUFFLE, 'this.shuffle', Lang.bind(this, this._setFiles));
        this.bindSettings(SettingsProps.HEIGHT, 'this._clutterTexture.height', null);
        this.bindSettings(SettingsProps.WIDTH, 'this._clutterBox.width', null);
        this.bindSettings(SettingsProps.DELAY, 'this.delay', null);
        this.bindSettings(SettingsProps.FADE_DELAY, 'this.fadeDelay', null);
        this.bindSettings(SettingsProps.QUALITY, 'this._clutterTexture.filter_quality', null);

        this._photoFrame = new St.Bin({style_class: 'photoframe-box', x_align: St.Align.START});
        this._binLayout = new Clutter.BinLayout();
        this._clutterBox = new Clutter.Box();
        this._clutterTexture = new Clutter.Texture({height: this.getSettings(SettingsProps.HEIGHT),
                                                    keep_aspect_ratio: true,
                                                    filter_quality: this.getSettings(SettingsProps.QUALITY)});
        this._clutterTexture.set_load_async(true);
        this._clutterBox.set_layout_manager(this._binLayout);
        this._clutterBox.set_width(this.getSettings(SettingsProps.WIDTH));
        this._clutterBox.add_actor(this._clutterTexture);
        this._photoFrame.set_child(this._clutterBox);
        this.setContent(this._photoFrame);

        this._setEffects();

        this._setFiles();

        this.updateInProgress = false;
        this.currentPicture = null;
        this._update_loop();

	this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	this._menu.addAction(_("Settings"), Lang.bind(this, function() {
							  Util.spawnCommandLine("/usr/share/cinnamon/desklets/photoframe@cinnamon.org/settings.py " + this.deskletId);
			     }));
    },

    _update_loop: function(){
        this._update();
        Mainloop.timeout_add_seconds(this.delay, Lang.bind(this, this._update_loop));
    },

    _update: function(){
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;
        try {
            let file;
            if (!this.shuffle){
                file = this._files.shift();
                if (file != undefined && GLib.file_test(file, GLib.FileTest.EXISTS)) {
                    this._files.push(file);
                }
            } else {
                file = this._files[parseInt(Math.random() * this._files.length)];
            }
            if (this.fadeDelay > 0) {
                Tweener.addTween(this._clutterTexture,
                                 { opacity: 0,
                                   time: this.fadeDelay/1000,
                                   transition: 'easeInSine',
                                   onComplete: Lang.bind(this, function() {
                                                             if (this._clutterTexture.set_from_file(file)) {
                                                                 this._photoFrame.set_child(this._clutterBox);
                                                             }
                                                             Tweener.addTween(this._clutterTexture, { opacity: 255,
                                                                                                      time: this.fadeDelay/1000,
                                                                                                      transition: 'easeInSine'
                                                                                                    });
                                                         })
                                 });
            } else {
                if (this._clutterTexture.set_from_file(file)) {
                    this._photoFrame.set_child(this._clutterBox);
                }
            }
            this.currentPicture = file;
        } catch (e) {
            global.logError(e);
        } finally {
            this.updateInProgress = false;
        }
    },

    _setEffects: function() {
        this._clutterTexture.clear_effects();
        if (this.effect == "black-and-white") {
            let effect = new Clutter.DesaturateEffect();
            this._clutterTexture.add_effect(effect);
        } else if (this.effect == "sepia") {
            let color = new Clutter.Color();
            color.from_hls(17.0, 0.59, 0.40);
            let colorize_effect = new Clutter.ColorizeEffect(color);
            let contrast_effect = new Clutter.BrightnessContrastEffect();
            let desaturate_effect = new Clutter.DesaturateEffect();
            desaturate_effect.set_factor(0.41);
            contrast_effect.set_brightness(0.1, 0.1, 0.1);
            contrast_effect.set_contrast(0.1, 0.1, 0.1);
            this._clutterTexture.add_effect(desaturate_effect);
            this._clutterTexture.add_effect(colorize_effect);
            this._clutterTexture.add_effect(contrast_effect);
        }
    },

    _setFiles: function() {
        this._files = new Array();

        let dir_path = this.directory;
        dir_path = dir_path.replace('~', GLib.get_home_dir());
        let dir = Gio.file_new_for_path(dir_path);
        if (dir.query_exists(null)) {
            let fileEnum = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = fileEnum.next_file(null)) != null) {
                let fileType = info.get_file_type();
                if (fileType != Gio.FileType.DIRECTORY) {
                    this._files.push(dir_path + "/" + info.get_name());
                }
            }
            fileEnum.close(null);
        }

        if (this.shuffle) {
            for(var j, x, i = this._files.length; i; ){
                j = parseInt(Math.random() * i);
                x = this._files[--i];
                this._files[i] = this._files[j];
                this._files[j] = x;
            }
        }
    },

    getSettings: function(props){
        if (!this.settings)
            return props[2];
        let variant = this.settings.get_value(props[0]);
        let dictionary = variant.lookup_value(this.deskletId, null);
        if (!dictionary) {
            let array = variant.unpack();
            // Unpack all values in the array
            for (let i in array) {
                array[i] = array[i].unpack();
            }
            array[this.deskletId] = props[2];
            let newVariant = GLib.Variant.new("a{s" + props[1] + "}", array);
            this.settings.set_value(props[0], newVariant);
            return props[2];
        }
        return dictionary.unpack();
    },

    bindSettings: function(props, variable, callback) {
        if (!this.settings)
            return;

        this.settings.connect("changed::" + props[0],
                              Lang.bind(this, function(settings, key, props, variable, callback) {
                                            let respond = false;
                                            let newSettings;
                                            if (!variable) {
                                                respond = true;
                                            } else {
                                                newSettings = this.getSettings(props);
                                                if (newSettings != eval(variable)) {
                                                    respond = true;
                                                }
                                            }

                                            if (respond) {
                                                if (variable) {
                                                    if (props[1] == "s")
                                                        newSettings = "\"" + newSettings + "\""; // Add quotes to the value if it is a string
                                                    eval(variable + '=' + newSettings);
                                                }
                                                if (callback)
                                                    callback();
                                            }
                                        }, props, variable, callback));
    },
    onDeskletClicked: function(event){
        if (event.get_button() == 1) {
            this._update();
        } else if (event.get_button() == 2) {
            Util.spawnCommandLine("xdg-open " + this.currentPicture);
        }
    }
};

function main(metadata, deskletId){
    let desklet = new MyDesklet(metadata, deskletId);
    return desklet;
}
