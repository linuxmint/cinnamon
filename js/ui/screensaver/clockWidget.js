// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const CinnamonDesktop = imports.gi.CinnamonDesktop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Pango = imports.gi.Pango;
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
        this._timeLabel.clutter_text.use_markup = true;
        this._timeLabel.clutter_text.line_wrap = true;
        this._timeLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this._timeLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.add_child(this._timeLabel);

        this._messageLabel = new St.Label({
            style_class: 'clock-message-label',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._messageLabel.clutter_text.use_markup = true;
        this._messageLabel.clutter_text.line_wrap = true;
        this._messageLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this._messageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.add_child(this._messageLabel);

        this._wallClock = new CinnamonDesktop.WallClock();
        this._wallClock.connect('notify::clock', this._updateClock.bind(this));

        this._setClockFormat();
        this._updateClock();
    }

    _setClockFormat() {
        let dateFormat = '';
        let timeFormat = '';

        if (this._settings.get_boolean('use-custom-format')) {
            dateFormat = this._settings.get_string('date-format') || '%A %B %-e';
            timeFormat = this._settings.get_string('time-format') || '%H:%M';
        } else {
            dateFormat = this._wallClock.get_default_date_format();
            timeFormat = this._wallClock.get_default_time_format();

            // %l is 12-hr hours, but it adds a space to 0-9, which looks bad
            // The '-' modifier tells the GDateTime formatter not to pad the value
            timeFormat = timeFormat.replace('%l', '%-l');
        }

        let timeFont = this._settings.get_string('font-time') || 'Ubuntu 64';
        let dateFont = this._settings.get_string('font-date') || 'Ubuntu 24';

        let format = '<b><span font_desc="' + timeFont + '" foreground="#FFFFFF">' + timeFormat + '</span></b>\n' +
                     '<b><span font_desc="' + dateFont + '" foreground="#FFFFFF">' + dateFormat + '</span></b>';

        this._wallClock.set_format_string(format);
    }

    _updateClock() {
        this._timeLabel.clutter_text.set_markup(this._wallClock.get_clock());

        let messageFont = this._settings.get_string('font-message') || 'Ubuntu 14';
        let markup = '';

        if (this._awayMessage && this._awayMessage !== '') {
            let userName = GLib.get_real_name();
            let escapedMessage = GLib.markup_escape_text(this._awayMessage, -1);
            markup = '<span font_desc="' + messageFont + '">' +
                     '<b><span foreground="#CCCCCC">' + escapedMessage + '</span></b>\n' +
                     '<b><span font_size="smaller" foreground="#ACACAC">  ~ ' + userName + '</span></b>' +
                     '</span>';
        } else {
            let defaultMessage = this._settings.get_string('default-message');
            if (defaultMessage && defaultMessage !== '') {
                let escapedMessage = GLib.markup_escape_text(defaultMessage, -1);
                markup = '<b><span font_desc="' + messageFont + '" foreground="#CCCCCC">' +
                         escapedMessage + '</span></b>';
            }
        }

        if (markup !== '') {
            this._messageLabel.clutter_text.set_markup(markup);
            this._messageLabel.visible = true;
        } else {
            this._messageLabel.visible = false;
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
