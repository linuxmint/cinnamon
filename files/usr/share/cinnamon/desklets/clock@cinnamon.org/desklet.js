
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;

function MyDesklet(metadata, desklet_id){
    this._init(metadata, desklet_id);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, desklet_id){
        Desklet.Desklet.prototype._init.call(this, metadata);
        this._date = new St.Label({style_class: "clock-desklet-label"});
        this.setContent(this._date);
        this.setHeader(_("Clock"));

        this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);

        this.settings.bindProperty(Settings.BindingDirection.IN,
                                   "date-format",
                                   "format",
                                   function() {},
                                   null);

	this.settings.bindProperty(Settings.BindingDirection.IN,
				   "font-size",
				   "size",
				   this._onSettingsChanged,
				   null);

        this._onSettingsChanged();
        this._updateDate();
    },


    _onSettingsChanged: function(){
        this._date.style="font-size: " + this.size + "pt";
    },

    on_desklet_removed: function() {
	Mainloop.source_remove(this.timeout);
    },

    _updateDate: function(){
        let displayDate = new Date();
        this._date.set_text(displayDate.toLocaleFormat(this.format));
        this.timeout = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateDate));
    }
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}