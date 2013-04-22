const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

function MyDesklet(metadata){
    this._init(metadata);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata){
        Desklet.Desklet.prototype._init.call(this, metadata);
        this._date = new St.Label({style_class: "clock-desklet-label"});
        this.setContent(this._date);
        this.setHeader(_("Clock"));
        this._dateSettings = new Gio.Settings({schema: 'org.cinnamon.desklets.clock'});
        this._dateSettings.connect("changed::font-size", Lang.bind(this, this._onFontSizeChanged));
        this._onFontSizeChanged();
        this._updateDate();
    },

    _onFontSizeChanged: function(){
        this._date.style="font-size: " + this._dateSettings.get_int("font-size") + "pt";
    },

    on_desklet_removed: function() {
	Mainloop.source_remove(this.timeout);
    },

    _updateDate: function(){
        let dateFormat = this._dateSettings.get_string('date-format');
        let displayDate = new Date();
        this._date.set_text(displayDate.toLocaleFormat(dateFormat));
        this.timeout = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateDate));
    }
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}