// -*- indent-tabs-mode: nil -*-
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;

function MyDesklet(metadata){
    this._init(metadata);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata){
        Desklet.Desklet.prototype._init.call(this, metadata);

        this.metadata = metadata;

        this.setHeader(_("Photo Frame"));

        this._photoFrame = new St.Bin({style_class: 'photoframe-box', x_align: St.Align.START});

        this._bin = new St.Bin();
        this._bin.set_size(this.metadata["width"], this.metadata["height"]);

        this._images = [];
        this._photoFrame.set_child(this._bin);
        this.setContent(this._photoFrame);

        if (this.metadata["effect"] == "black-and-white") {
            let effect = new Clutter.DesaturateEffect();
            this._bin.add_effect(effect);
        } else if (this.metadata["effect"] == "sepia") {
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

        let dir_path = this.metadata["directory"];
        dir_path = dir_path.replace('~', GLib.get_home_dir());
        let dir = Gio.file_new_for_path(dir_path);
        if (dir.query_exists(null)) {
            let fileEnum = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = fileEnum.next_file(null)) != null) {
                let fileType = info.get_file_type();
                if (fileType != Gio.FileType.DIRECTORY) {
                    this._loadImage(dir_path + "/" + info.get_name());
                }
            }
            fileEnum.close(null);
        }

        this.updateInProgress = false;
        this.currentPicture = null;
        this._update_loop();
    },

    _update_loop: function(){
        this._update();
        Mainloop.timeout_add_seconds(this.metadata["delay"], Lang.bind(this, this._update_loop));
    },

    _update: function(){
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;
        try {
            let image;
            if (!this.metadata["shuffle"]){
                image = this._images.shift();
                this._images.push(image);
            } else {
                image = this._images[Math.floor(Math.random() * this._images.length)];
            }

            if (image){
                this.currentPicture = image;
                if (this.metadata["fade-delay"] > 0) {
                    Tweener.addTween(this._bin,
                                     { opacity: 0,
                                       time: this.metadata["fade-delay"],
                                       transition: 'easeInSine',
                                       onComplete: Lang.bind(this, function() {
                                                                 this._bin.set_child(this.currentPicture);
                                                                 Tweener.addTween(this._bin,
                                                                                  { opacity: 255,
                                                                                    time: this.metadata["fade-delay"],
                                                                                    transition: 'easeInSine'
                                                                                  });
                                                             })
                                     });
                } else {
                    this._bin.set_child(this.currentPicture);
                }
                
            }
        }  catch (e) {
            global.logError(e);
        } finally {
            this.updateInProgress = false;
        }
    },

    _loadImage: function(filePath) {
        try {
            let file = Gio.file_new_for_path(filePath);
            let uri = file.get_uri();

            let image = St.TextureCache.get_default().load_uri_sync(St.TextureCachePolicy.FOREVER, uri, -1, -1);

            let frameRatio = this.metadata["height"]/this.metadata["width"];
            let imageRatio = image.height/image.width;

            let height, width;            
            if (frameRatio > imageRatio) {
                width = this.metadata["width"];
                height = width * imageRatio;
            } else {
                height = this.metadata["height"];
                width = height / imageRatio;
            }

            image.set_size(width, height);

            image._path = filePath;
            this._images.push(image);
        } catch (x) {
            // Do nothing. Probably a non-image is in the folder
        }
    },

    on_desklet_clicked: function(event){
        if (event.get_button() == 1) {
            this._update();
        } else if (event.get_button() == 2) {
            Util.spawnCommandLine("xdg-open " + this.currentPicture._path);
        }
    }
};

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata);
    return desklet;
}
