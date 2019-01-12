
const {Label} = imports.gi.St;
const {WallClock} = imports.gi.CinnamonDesktop;

const {Desklet} = imports.ui.desklet;
const {DeskletSettings} = imports.ui.settings;

class CinnamonClockDesklet extends Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);
        this._date = new Label({style_class: 'clock-desklet-label'});
        this.setContent(this._date);
        this.setHeader(_("Clock"));

        this.clock = new WallClock();
        this.clock_notify_id = 0;

        this.state = {};

        this.settings = new DeskletSettings(this.state, metadata.uuid, desklet_id, true);
        this.settings.promise.then(() => this.settingsInit());
    }

    settingsInit() {
        this.settings.bind('date-format', 'format');
        this.settings.bind('font-size', 'size', () => this._onSettingsChanged());
        this.settings.bind('text-color', 'color', () => this._onSettingsChanged());
        this.settings.bind('use-custom-format', 'use_custom_format', () => this._onSettingsChanged());

        this._menu.addSettingsAction(_('Date and Time Settings'), 'calendar');

        this._onSettingsChanged();

        if (this.clock_notify_id == 0) {
            this.clock_notify_id = this.clock.connect("notify::clock", () => this._clockNotify());
        }
    }

    _clockNotify(obj, pspec, data) {
        this._updateClock();
    }

    _onSettingsChanged() {
        this._date.style = `font-size:${this.state.size}pt;color:${this.state.color}`;
        this._updateFormatString();
        this._updateClock();
    }

    on_desklet_removed() {
        if (this.clock_notify_id > 0) {
            this.clock.disconnect(this.clock_notify_id);
            this.clock_notify_id = 0;
        }
        this.settings.finalize();
    }

    _updateFormatString() {
        if (this.state.use_custom_format) {
            if (!this.clock.set_format_string(this.state.format)) {
                global.logError("Clock desklet: bad format - check your string.");
                this.clock.set_format_string("~FORMAT ERROR~ %l:%M %p");
            }
        } else {
            this.clock.set_format_string(null);
        }
    }

    _updateClock() {
        if (this.state.use_custom_format) {
            this._date.set_text(this.clock.get_clock());
        } else {
            let default_format = this.clock.get_default_time_format();
            default_format = default_format.replace('%l', '%-l')

            this._date.set_text(this.clock.get_clock_for_format(default_format));
        }
    }
}

function main(metadata, desklet_id) {
    return new CinnamonClockDesklet(metadata, desklet_id);
}
