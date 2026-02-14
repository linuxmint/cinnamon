// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const CinnamonDesktop = imports.gi.CinnamonDesktop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const ScreensaverWidget = imports.ui.screensaver.screensaverWidget;

const SCREENSAVER_SCHEMA = 'org.cinnamon.desktop.screensaver';

var ClockWidget = GObject.registerClass(
class ClockWidget extends ScreensaverWidget.ScreensaverWidget {
    _init(awayMessage) {
        super._init({
            style_class: 'clock-widget',
            vertical: true,
            x_expand: false,
            y_expand: false
        });

        this.setAwakePosition(0, St.Align.START, St.Align.MIDDLE);

        this._settings = new Gio.Settings({ schema_id: SCREENSAVER_SCHEMA });
        this._awayMessage = awayMessage;
        this._showClock = this._settings.get_boolean('show-clock');

        this._timeLabel = new St.Label({
            style_class: 'clock-time-label',
            x_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this._timeLabel);

        this._dateLabel = new St.Label({
            style_class: 'clock-date-label',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._dateLabel.clutter_text.line_wrap = true;
        this.add_child(this._dateLabel);

        this._messageLabel = new St.Label({
            style_class: 'clock-message-label',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._messageLabel.clutter_text.line_wrap = true;
        this.add_child(this._messageLabel);

        this._messageAuthor = new St.Label({
            style_class: 'clock-message-author',
            x_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this._messageAuthor);

        this._wallClock = new CinnamonDesktop.WallClock();
        this._wallClock.connect('notify::clock', this._updateClock.bind(this));

        this._setClockFormat();
        this._updateClock();
    }

    _setClockFormat() {
        if (this._settings.get_boolean('use-custom-format')) {
            this._dateFormat = this._settings.get_string('date-format') || '%A %B %-e';
            this._timeFormat = this._settings.get_string('time-format') || '%H:%M';
        } else {
            this._dateFormat = this._wallClock.get_default_date_format();
            this._timeFormat = this._wallClock.get_default_time_format();

            // %l is 12-hr hours, but it adds a space to 0-9, which looks bad
            // The '-' modifier tells the GDateTime formatter not to pad the value
            this._timeFormat = this._timeFormat.replace('%l', '%-l');
        }

        this._wallClock.set_format_string(this._timeFormat);
    }

    _updateClock() {
        this._timeLabel.text = this._wallClock.get_clock();

        let now = GLib.DateTime.new_now_local();
        this._dateLabel.text = now.format(this._dateFormat);

        if (this._awayMessage && this._awayMessage !== '') {
            this._messageLabel.text = this._awayMessage;
            this._messageAuthor.text = `  ~ ${GLib.get_real_name()}`;
            this._messageLabel.visible = true;
            this._messageAuthor.visible = true;
        } else {
            let defaultMessage = this._settings.get_string('default-message');
            if (defaultMessage && defaultMessage !== '') {
                this._messageLabel.text = defaultMessage;
                this._messageLabel.visible = true;
            } else {
                this._messageLabel.visible = false;
            }
            this._messageAuthor.visible = false;
        }
    }

    setAwayMessage(message) {
        this._awayMessage = message;
        this._updateClock();
    }

    shouldShowInSleepMode() {
        return this._showClock;
    }

    onScreensaverActivated() {
        if (!this._showClock) {
            this.hide();
        }
    }

    onAwake() {
        this.show();
    }

    onSleep() {
        if (!this._showClock) {
            this.hide();
        }
    }

    destroy() {
        if (this._wallClock) {
            this._wallClock.run_dispose();
            this._wallClock = null;
        }

        if (this._tzMonitor) {
            this._tzMonitor.cancel();
            this._tzMonitor = null;
        }

        super.destroy();
    }
});
