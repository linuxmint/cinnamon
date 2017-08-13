
const Lang = imports.lang;
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
        this.clock_notify_id = 0;

        this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);
        this.settings.bind("date-format", "format");
        this.settings.bind("font-size", "size", this._onSettingsChanged);
        this.settings.bind("text-color", "color", this._onSettingsChanged);
        this.settings.bind("use-custom-format", "use_custom_format", this._onSettingsChanged);
        
        this._menu.addSettingsAction(_("Date and Time Settings"), "calendar")
    },

    _clockNotify: function(obj, pspec, data) {
        this._updateClock();
    },

    _onSettingsChanged: function(){
        this._date.style="font-size: " + this.size + "pt;\ncolor: " + this.color;
        this._updateFormatString();
        this._updateClock();
    },

    on_desklet_added_to_desktop: function() {
        this._onSettingsChanged();

        if (this.clock_notify_id == 0) {
            this.clock_notify_id = this.clock.connect("notify::clock", () => this._clockNotify());
        }
    },

    on_desklet_removed: function() {
        if (this.clock_notify_id > 0) {
            this.clock.disconnect(this.clock_notify_id);
            this.clock_notify_id = 0;
        }
    },

    _updateFormatString: function() {
        if (this.use_custom_format) {
            if (!this.clock.set_format_string(this.format)) {
                global.logError("Clock desklet: bad format - check your string.");
                this.clock.set_format_string("~FORMAT ERROR~ %l:%M %p");
            }
        } else {
            this.clock.set_format_string(null);
        }
    },

    _updateClock: function(){
        if (this.use_custom_format) {
            this._date.set_text(this.clock.get_clock());
        } else {
            let default_format = this.clock.get_default_time_format();
            default_format = default_format.replace('%l', '%-l')

            this._date.set_text(this.clock.get_clock_for_format(default_format));
        }
    }
}

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}
