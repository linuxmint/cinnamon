// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const DBus = imports.dbus;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const Gvc = imports.gi.Gvc;
const Signals = imports.signals;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */

const VOLUME_NOTIFY_ID = 1;

function Indicator() {
    this._init.apply(this, arguments);
}

Indicator.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'audio-volume-muted', null);

        this._control = new Gvc.MixerControl({ name: 'GNOME Shell Volume Control' });
        this._control.connect('state-changed', Lang.bind(this, this._onControlStateChanged));
        this._control.connect('default-sink-changed', Lang.bind(this, this._readOutput));
        this._control.connect('default-source-changed', Lang.bind(this, this._readInput));
        this._control.connect('stream-added', Lang.bind(this, this._maybeShowInput));
        this._control.connect('stream-removed', Lang.bind(this, this._maybeShowInput));
        this._volumeMax = this._control.get_vol_max_norm();

        this._output = null;
        this._outputVolumeId = 0;
        this._outputMutedId = 0;
        this._outputTitle = new PopupMenu.PopupMenuItem(_("Volume"), { reactive: false });
        this._outputSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._outputSlider.connect('value-changed', Lang.bind(this, this._sliderChanged, '_output'));
        this._outputSlider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));
        this.menu.addMenuItem(this._outputTitle);
        this.menu.addMenuItem(this._outputSlider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._input = null;
        this._inputVolumeId = 0;
        this._inputMutedId = 0;
        this._inputTitle = new PopupMenu.PopupMenuItem(_("Microphone"), { reactive: false });
        this._inputSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._inputSlider.connect('value-changed', Lang.bind(this, this._sliderChanged, '_input'));
        this._inputSlider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));
        this.menu.addMenuItem(this._inputTitle);
        this.menu.addMenuItem(this._inputSlider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction(_("Sound Settings"), 'gnome-sound-panel.desktop');

        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        this._control.open();
    },

    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();
        let currentVolume = this._output.volume;

        if (direction == Clutter.ScrollDirection.DOWN) {
            let prev_muted = this._output.is_muted;
            this._output.volume = Math.max(0, currentVolume - this._volumeMax * VOLUME_ADJUSTMENT_STEP);
            if (this._output.volume < 1) {
                this._output.volume = 0;
                if (!prev_muted)
                    this._output.change_is_muted(true);
            }
            this._output.push_volume();
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._output.volume = Math.min(this._volumeMax, currentVolume + this._volumeMax * VOLUME_ADJUSTMENT_STEP);
            this._output.change_is_muted(false);
            this._output.push_volume();
        }

        this._notifyVolumeChange();
    },

    _onControlStateChanged: function() {
        if (this._control.get_state() == Gvc.MixerControlState.READY) {
            this._readOutput();
            this._readInput();
            this.actor.show();
        } else {
            this.actor.hide();
        }
    },

    _readOutput: function() {
        if (this._outputVolumeId) {
            this._output.disconnect(this._outputVolumeId);
            this._output.disconnect(this._outputMutedId);
            this._outputVolumeId = 0;
            this._outputMutedId = 0;
        }
        this._output = this._control.get_default_sink();
        if (this._output) {
            this._outputMutedId = this._output.connect('notify::is-muted', Lang.bind(this, this._mutedChanged, '_output'));
            this._outputVolumeId = this._output.connect('notify::volume', Lang.bind(this, this._volumeChanged, '_output'));
            this._mutedChanged (null, null, '_output');
            this._volumeChanged (null, null, '_output');
        } else {
            this._outputSlider.setValue(0);
            this.setIcon('audio-volume-muted-symbolic');
        }
    },

    _readInput: function() {
        if (this._inputVolumeId) {
            this._input.disconnect(this._inputVolumeId);
            this._input.disconnect(this._inputMutedId);
            this._inputVolumeId = 0;
            this._inputMutedId = 0;
        }
        this._input = this._control.get_default_source();
        if (this._input) {
            this._inputMutedId = this._input.connect('notify::is-muted', Lang.bind(this, this._mutedChanged, '_input'));
            this._inputVolumeId = this._input.connect('notify::volume', Lang.bind(this, this._volumeChanged, '_input'));
            this._mutedChanged (null, null, '_input');
            this._volumeChanged (null, null, '_input');
        } else {
            this._inputTitle.actor.hide();
            this._inputSlider.actor.hide();
        }
    },

    _maybeShowInput: function() {
        // only show input widgets if any application is recording audio
        let showInput = false;
        let recordingApps = this._control.get_source_outputs();
        if (this._input && recordingApps) {
            for (let i = 0; i < recordingApps.length; i++) {
                let outputStream = recordingApps[i];
                let id = outputStream.get_application_id();
                // but skip gnome-volume-control and pavucontrol
                // (that appear as recording because they show the input level)
                if (!id || (id != 'org.gnome.VolumeControl' && id != 'org.PulseAudio.pavucontrol')) {
                    showInput = true;
                    break;
                }
            }
        }
        if (showInput) {
            this._inputTitle.actor.show();
            this._inputSlider.actor.show();
        } else {
            this._inputTitle.actor.hide();
            this._inputSlider.actor.hide();
        }
    },

    _volumeToIcon: function(volume) {
        if (volume <= 0) {
            return 'audio-volume-muted';
        } else {
            let n = Math.floor(3 * volume / this._volumeMax) + 1;
            if (n < 2)
                return 'audio-volume-low';
            if (n >= 3)
                return 'audio-volume-high';
            return 'audio-volume-medium';
        }
    },

    _sliderChanged: function(slider, value, property) {
        if (this[property] == null) {
            log ('Volume slider changed for %s, but %s does not exist'.format(property, property));
            return;
        }
        let volume = value * this._volumeMax;
        let prev_muted = this[property].is_muted;
        if (volume < 1) {
            this[property].volume = 0;
            if (!prev_muted)
                this[property].change_is_muted(true);
        } else {
            this[property].volume = volume;
            if (prev_muted)
                this[property].change_is_muted(false);
        }
        this[property].push_volume();
    },

    _notifyVolumeChange: function() {
        global.cancel_theme_sound(VOLUME_NOTIFY_ID);
        global.play_theme_sound(VOLUME_NOTIFY_ID, 'audio-volume-change');
    },

    _mutedChanged: function(object, param_spec, property) {
        let muted = this[property].is_muted;
        let slider = this[property+'Slider'];
        slider.setValue(muted ? 0 : (this[property].volume / this._volumeMax));
        if (property == '_output') {
            if (muted)
                this.setIcon('audio-volume-muted');
            else
                this.setIcon(this._volumeToIcon(this._output.volume));
        }
    },

    _volumeChanged: function(object, param_spec, property) {
        this[property+'Slider'].setValue(this[property].volume / this._volumeMax);
        if (property == '_output' && !this._output.is_muted)
            this.setIcon(this._volumeToIcon(this._output.volume));
    }
};
