const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;

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

            this._trackCover = new St.Bin({style_class: 'photoframe-box', x_align: St.Align.START});
            this._trackCover.set_child(new St.Icon({icon_name: "image-x-generic", icon_size: 220, icon_type: St.IconType.FULLCOLOR}));           
            this.setContent(this._trackCover);

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
        try {
            let file = this._files.shift();
            if (file != undefined) {
                global.logError("Loading file: " + file);
                this._files.push(file);
                let l = new Clutter.BinLayout();
                let b = new Clutter.Box();
                let c = new Clutter.Texture({height: this.metadata["height"], keep_aspect_ratio: true, filter_quality: this.metadata["quality"], filename: file});
                b.set_layout_manager(l);
                b.set_width(this.metadata["width"]);
                b.add_actor(c);
                this._trackCover.set_child(b);
            }
        }
        catch (e) {
            global.logError(e);
        }        
    },

    on_desklet_clicked: function(event){
        this._update();
    }
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata);
    return desklet;
}
