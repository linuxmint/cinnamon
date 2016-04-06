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

function MyDesklet(metadata, desklet_id){
    this._init(metadata, desklet_id);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, desklet_id){
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);


        this.metadata = metadata
        this.update_id = null;

        try {
            this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], this.instance_id);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "directory",
                                     "dir",
                                     this.on_setting_changed,
                                     null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                      "shuffle",
                                      "shuffle",
                                      this.on_setting_changed,
                                      null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "delay",
                                     "delay",
                                     this.on_setting_changed,
                                     null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "height",
                                     "height",
                                     this.on_setting_changed,
                                     null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "width",
                                     "width",
                                     this.on_setting_changed,
                                     null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "fade-delay",
                                     "fade_delay",
                                     this.on_setting_changed,
                                     null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "effect",
                                     "effect",
                                     this.on_setting_changed,
                                     null);
        } catch (e) {
            global.logError(e);
        }

        this.dir_monitor_id = null;
        this.dir_monitor = null;
        this.dir_file = null;


        this.setHeader(_("Photo Frame"));
        this._setup_dir_monitor();
        this.setup_display();
    },

    on_setting_changed: function() {
        if (this.update_id > 0)
            Mainloop.source_remove(this.update_id);
        this.update_id = null;
        this._setup_dir_monitor();
        if (this.currentPicture)
            this.currentPicture.destroy();
        this._photoFrame.destroy();
        this.setup_display();
    },

    _setup_dir_monitor: function() {
        if (this.dir_monitor_id && this.dir_monitor) {
            this.dir_monitor.disconnect(this.dir_monitor_id)
            this.dir_monitor_id = null
        }
        this.dir = this.dir.replace('~', GLib.get_home_dir())
        this.dir_file =  Gio.file_new_for_path(this.dir);
        this.dir_monitor = this.dir_file.monitor_directory(0, null, null);
        this.dir_monitor_id = this.dir_monitor.connect('changed', Lang.bind(this, this.on_setting_changed));
    },

    on_desklet_removed: function() {
        if (this.dir_monitor_id && this.dir_monitor) {
            this.dir_monitor.disconnect(this.dir_monitor_id)
            this.dir_monitor_id = null
        }

        if (this.update_id != 0) {
            Mainloop.source_remove(this.update_id);
            this.update_id = 0;
        }
    },

    _scan_dir: function(dir) {
        let dir_file = Gio.file_new_for_path(dir);
        let fileEnum = dir_file.enumerate_children('standard::type,standard::name', Gio.FileQueryInfoFlags.NONE, null);

        let info;
        while ((info = fileEnum.next_file(null)) != null) {
            let fileType = info.get_file_type();
            let fileName = dir + "/" + info.get_name();
            if (fileType != Gio.FileType.DIRECTORY) {
                this._images.push(fileName);
            } else {
                this._scan_dir(fileName);
            }
        }

        fileEnum.close(null);
    },


    setup_display: function() {
        this._photoFrame = new St.Bin({style_class: 'photoframe-box', x_align: St.Align.START});

        this._bin = new St.Bin();
        this._bin.set_size(this.width, this.height);

        this._images = [];
        this._photoFrame.set_child(this._bin);
        this.setContent(this._photoFrame);

        if (this.effect == "black-and-white") {
            let effect = new Clutter.DesaturateEffect();
            this._bin.add_effect(effect);
        } else if (this.effect == "sepia") {
            let color = new Clutter.Color();
            color.from_hls(17.0, 0.59, 0.40);
            let colorize_effect = new Clutter.ColorizeEffect(color);
            let contrast_effect = new Clutter.BrightnessContrastEffect();
            let desaturate_effect = new Clutter.DesaturateEffect();
            desaturate_effect.set_factor(0.41);
            contrast_effect.set_brightness(0.1, 0.1, 0.1);
            contrast_effect.set_contrast(0.1, 0.1, 0.1);
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
    },

    _update_loop: function(){
        this._update();
        this.update_id = Mainloop.timeout_add_seconds(this.delay, Lang.bind(this, this._update_loop));
    },

    _size_pic: function(image) {
        image.disconnect(image._notif_id);

        let height, width;
        let imageRatio = image.width/image.height;
        let frameRatio = this.width/this.height;

        if (imageRatio > frameRatio) {
            width = this.width;
            height = this.width / imageRatio;
        } else {
            height = this.height;
            width = this.height * imageRatio;
        }

        image.set_size(width, height);
    },

    _update: function(){       
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;
        try {
            let image_path;
            if (!this.shuffle){
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

            if (this.fade_delay > 0) {
                Tweener.addTween(this._bin,
                                 { opacity: 0,
                                   time: this.fade_delay,
                                   transition: 'easeInSine',
                                   onComplete: Lang.bind(this, function() {
                                                             this._bin.set_child(this.currentPicture);
                                                             Tweener.addTween(this._bin,
                                                                              { opacity: 255,
                                                                                time: this.fade_delay,
                                                                                transition: 'easeInSine'
                                                                              });
                                                         })
                                 });
            } else {
                this._bin.set_child(this.currentPicture);
            }
            if (old_pic)
                old_pic.destroy();
        } catch (e) {
            global.logError(e);
        } finally {
            this.updateInProgress = false;
        }       
    },

    on_desklet_clicked: function(event){  
        try {             
            if (event.get_button() == 1) {
                this._update();
            }
            else if (event.get_button() == 2) {     
                Util.spawnCommandLine("xdg-open " + this.currentPicture);                
            }            
        }
        catch (e) {
            global.logError(e);
	}
    },

    _loadImage: function(filePath) {
        try {
            let file = Gio.file_new_for_path(filePath);
            let uri = file.get_uri();

            let image = St.TextureCache.get_default().load_uri_async(uri, this.width, this.height);

            image._notif_id = image.connect("notify::size", Lang.bind(this, this._size_pic));

            return image;
        } catch (x) {
            // Probably a non-image is in the folder
            return null;
        }
    },
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}
