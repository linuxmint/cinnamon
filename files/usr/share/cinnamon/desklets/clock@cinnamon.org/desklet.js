
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const CinnamonDesktop = imports.gi.CinnamonDesktop;

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
        
        this.clock = new CinnamonDesktop.WallClock();

        this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);
        this.settings.bind("date-format", "format");
        this.settings.bind("font-size", "size", this._onSettingsChanged);
        this.settings.bind("text-color", "color", this._onSettingsChanged);
        this.settings.bind("use-custom-format", "use_custom_format", this._onSettingsChanged);
        
        this._menu.addSettingsAction(_("Date and Time Settings"), "calendar")

        this._onSettingsChanged();
        this._updateDate();
    },

    _onSettingsChanged: function(){
        this._date.style="font-size: " + this.size + "pt;\ncolor: " + this.color;
        this._updateDate();
    },

    on_desklet_removed: function() {
        Mainloop.source_remove(this.timeout);
    },

    _updateDate: function(){
        let displayDate = new Date();
        
        if (this.use_custom_format) {
            let display_text = displayDate.toLocaleFormat(this.format);
            
            if (!display_text) {
                global.logError("Clock desklet: bad time format string - check your string.");
                display_text = "~CLOCK FORMAT ERROR~ " + now.toLocaleFormat("%l:%M %p");
            }
            this._date.set_text(display_text);
        }
        else {
            //RavetcoFX: The replace() is replacing all text from ", " and before with a hacky regular expression wildcard command
            //this makes it so the date from CinnamonDesktop.WallClock() does not display in the desklet's content box.
            this._date.set_text(this.clock.get_clock().replace(/^.+, /, "").capitalize());
        }
            
        this.timeout = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateDate));
    }
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}
