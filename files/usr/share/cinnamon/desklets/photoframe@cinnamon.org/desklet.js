const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Desklet = imports.ui.desklet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;

function MyDesklet(metadata){
    this._init(metadata);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata){
        try {            
            Desklet.Desklet.prototype._init.call(this, metadata);

            this.metadata = metadata

            this.setHeader(_("Photo Frame"));

            this._photoFrame = new St.Bin({style_class: 'photoframe-box', x_align: St.Align.START});
            this._binLayout = new Clutter.BinLayout();
            this._clutterBox = new Clutter.Box();
            this._clutterTexture = new Clutter.Texture({height: this.metadata["height"], keep_aspect_ratio: true, filter_quality: this.metadata["quality"]});
            this._clutterTexture.set_load_async(true);
            this._clutterBox.set_layout_manager(this._binLayout);
            this._clutterBox.set_width(this.metadata["width"]);
            this._clutterBox.add_actor(this._clutterTexture);
            this._photoFrame.set_child(this._clutterBox);            
            this.setContent(this._photoFrame);

            if (this.metadata["effect"] == "black-and-white") {
                let effect = new Clutter.DesaturateEffect();
                this._clutterTexture.add_effect(effect);
            }
            else if (this.metadata["effect"] == "sepia") {
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

            this._files = new Array();

            let dir_path = this.metadata["directory"];
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
            
            if (this.metadata["shuffle"]) {
                for(var j, x, i = this._files.length; i; j = parseInt(Math.random() * i), x = this._files[--i], this._files[i] = this._files[j], this._files[j] = x);
            }
            
            this.updateInProgress = false;
            this.currentPicture = null;
            this._update_loop();
        }
        catch (e) {
            global.logError(e);
        }
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
            let file = this._files.shift();
            if (file != undefined && GLib.file_test(file, GLib.FileTest.EXISTS)) {                
                this._files.push(file);                
                if (this.metadata["fade-delay"] > 0) {
                    Tweener.addTween(this._clutterTexture, { opacity: 0,
                        time: this.metadata["fade-delay"],
                        transition: 'easeInSine',
                        onComplete: Lang.bind(this, function() {
                            if (this._clutterTexture.set_from_file(file)) {
                                this._photoFrame.set_child(this._clutterBox);                                
                            }                                    
                            Tweener.addTween(this._clutterTexture, { opacity: 255,
                                time: this.metadata["fade-delay"],
                                transition: 'easeInSine'
                            });
                        })
                    });
                }
                else {
                    if (this._clutterTexture.set_from_file(file)) {
                        this._photoFrame.set_child(this._clutterBox);
                    } 
                }
                this.currentPicture = file;
            }
        }
        catch (e) {
            global.logError(e);
        }
        finally {
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
    }
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata);
    return desklet;
}
