const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Interfaces = imports.misc.interfaces;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Cvc = imports.gi.Cvc;
const Tooltips = imports.ui.tooltips;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Slider = imports.ui.slider;

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";

// how long to show the output icon when volume is adjusted during media playback.
const OUTPUT_ICON_SHOW_TIME_SECONDS = 3;

/* global values */
let players_without_seek_support = ['spotify', 'totem', 'xplayer', 'gnome-mplayer', 'pithos',
    'smplayer'];
let players_with_seek_support = [
    'clementine', 'banshee', 'rhythmbox', 'rhythmbox3', 'pragha', 'quodlibet',
    'amarok', 'xnoise', 'gmusicbrowser', 'vlc', 'qmmp', 'deadbeef', 'audacious'];
/* dummy vars for translation */
let x = _("Playing");
x = _("Paused");
x = _("Stopped");

const VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */

const ICON_SIZE = 28;

const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";

class ControlButton {
    constructor(icon, tooltip, callback, small = false) {
        this.actor = new St.Bin();

        this.button = new St.Button();
        this.button.connect('clicked', callback);

        if(small)
            this.button.add_style_pseudo_class("small");

        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon
        });
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);

        this.tooltip = new Tooltips.Tooltip(this.button, tooltip);
    }

    getActor() {
        return this.actor;
    }

    setData(icon, tooltip) {
        this.icon.icon_name = icon;
        this.tooltip.set_text(tooltip);
    }

    setActive(status) {
        this.button.change_style_pseudo_class("active", status);
    }

    setEnabled(status) {
        this.button.change_style_pseudo_class("insensitive", !status);
        this.button.can_focus = status;
        this.button.reactive = status;
    }
}

class VolumeSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(applet, stream, tooltip, app_icon) {
        super(0);
        this.applet = applet;

        if(tooltip)
            this.tooltipText = tooltip + ": ";
        else
            this.tooltipText = "";

        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        this.connect("value-changed", () => this._onValueChanged());

        this.app_icon = app_icon;
        if (this.app_icon == null) {
            this.iconName = this.isMic ? "microphone-sensitivity-muted" : "audio-volume-muted";
            this.icon = new St.Icon({icon_name: this.iconName, icon_type: St.IconType.SYMBOLIC, icon_size: 16});
        }
        else {
            this.icon = new St.Icon({icon_name: this.app_icon, icon_type: St.IconType.FULLCOLOR, icon_size: 16});
        }

        this.removeActor(this._slider);
        this.addActor(this.icon, {span: 0});
        this.addActor(this._slider, {span: -1, expand: true});

        this.connectWithStream(stream);
    }

    connectWithStream(stream) {
        if (!stream) {
            this.actor.hide();
            this.stream = null;
        } else {
            this.actor.show();
            this.stream = stream;
            this.isMic = stream instanceof Cvc.MixerSource || stream instanceof Cvc.MixerSourceOutput;
            this.isOutputSink = stream instanceof Cvc.MixerSink;

            let mutedId = stream.connect("notify::is-muted", () => this._update());
            let volumeId = stream.connect("notify::volume", () => this._update());
            this.connect("destroy", () => {
                stream.disconnect(mutedId);
                stream.disconnect(volumeId);
            });
        }

        this._update();
    }

    _onValueChanged() {
        if (!this.stream) return;

        let muted;
        // Use the scaled volume max only for the main output
        let volume = this._value * (this.isOutputSink ? this.applet._volumeMax : this.applet._volumeNorm);

        if(this._value < 0.005) {
            volume = 0;
            muted = true;
        } else {
            muted = false;
            //100% is magnetic:
            if (volume != this.applet._volumeNorm && volume > this.applet._volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && volume < this.applet._volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
                volume = this.applet._volumeNorm;
        }
        this.stream.volume = volume;
        this.stream.push_volume();

        if(this.stream.is_muted !== muted)
            this.stream.change_is_muted(muted);

        if(!this._dragging)
            this.applet._notifyVolumeChange(this.stream);
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._value = Math.max(0, this._value - VOLUME_ADJUSTMENT_STEP/this.applet._volumeMax*this.applet._volumeNorm);
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._value = Math.min(1, this._value + VOLUME_ADJUSTMENT_STEP/this.applet._volumeMax*this.applet._volumeNorm);
        }

        this._slider.queue_repaint();
        this.tooltip.show();
        this.emit('value-changed', this._value);
    }

    _onKeyPressEvent(actor, event) {
        let key = event.get_key_symbol();
        if (key === Clutter.KEY_Right || key === Clutter.KEY_Left) {
            let delta = key === Clutter.KEY_Right ? VOLUME_ADJUSTMENT_STEP : -VOLUME_ADJUSTMENT_STEP;
            this._value = Math.max(0, Math.min(this._value + delta/this.applet._volumeMax*this.applet._volumeNorm, 1));
            this._slider.queue_repaint();
            this.emit('value-changed', this._value);
            this.emit('drag-end');
            return true;
        }
        return false;
    }


    _update() {
        // value: percentage of volume_max (set as value in the widget)
        // visible_value: percentage of volume_norm (shown to the user)
        // these only differ for the output, and only when the user changes the maximum volume
        let volume = (!this.stream || this.stream.is_muted) ? 0 : this.stream.volume;
        let value, visible_value, delta = VOLUME_ADJUSTMENT_STEP * this.applet._volumeMax / this.applet._volumeNorm;

        if (this.isOutputSink) {
            value = volume / this.applet._volumeMax;
            visible_value = volume / this.applet._volumeNorm;
            if (visible_value != 1 && visible_value > 1 - delta/2 && visible_value < 1 + delta/2) {
                visible_value = 1; // 100% is magnetic
                value = this.applet._volumeNorm / this.applet._volumeMax;
                this.applet._output.volume = this.applet._volumeNorm;
                this.applet._output.push_volume();
            }
        } else {
            visible_value = volume / this.applet._volumeNorm;
            value = visible_value
        }

        let percentage = Math.round(visible_value * 100) + "%";

        this.tooltip.set_text(this.tooltipText + percentage);
        if (this._dragging)
            this.tooltip.show();
        let iconName = this._volumeToIcon(value);
        if (this.app_icon == null) {
            this.icon.icon_name = iconName;
        }
        this.setValue(value);

        // send data to applet
        this.emit("values-changed", iconName, percentage);
    }

    _volumeToIcon(value) {
        let icon;
        if(value < 0.005) {
            icon = "muted";
        } else {
            let n = Math.floor(3 * value);
            if(n < 1)
                icon = "low";
            else if(n < 2)
                icon = "medium";
            else
                icon = "high";
        }
        return this.isMic? "microphone-sensitivity-" + icon : "audio-volume-" + icon;
    }
}

class Seeker extends Slider.Slider {
    constructor(mediaServerPlayer, props, playerName) {
        super(0, true);

        this.canSeek = true;
        this.status = 'Stopped';
        this._wantedSeekValue = 0;

        this._currentTime = 0;
        this._length = 0;
        this._trackid = "";

        this._timeoutId = 0;
        this._timerTicker = 0;

        this._mediaServerPlayer = mediaServerPlayer;
        this._prop = props;
        this._playerName = playerName;

        this.connect('drag-end', () => { this._setPosition() });
        this.connect('value-changed', () => {
            if(!this._dragging) // Update on scroll events
                this._setPosition();
        });

        this._seekChangedId = mediaServerPlayer.connectSignal('Seeked', (id, sender, value) => {
            // Seek value sent by the player
            if (value > 0) {
                this._setPosition(value);
            }
            // Seek initiated by the position slider
            else if (this._wantedSeekValue > 0) {
                // Some broken gstreamer players (Banshee) reports always 0
                // when the track is seeked so we set the position at the
                // value we set on the slider
                this._setPosition(this._wantedSeekValue);
            }
            else {
                // Some players send negative values (Rhythmbox).
                // Only positive values or zero are allowed.
                this._setPosition(0);
            }

            this._wantedSeekValue = 0;
        });

        this._getCanSeek();
    }

    play() {
        this.status = 'Playing';
        this._getCanSeek();
    }

    pause() {
        this.status = 'Paused';
        this._updateTimer();
    }

    stop() {
        this.status = 'Stopped';
        this._updateTimer();
    }

    setTrack(trackid, length) {
        this._trackid = trackid;
        this._length = length;
        this._currentTime = 0;
        this._updateValue();
    }

    _updateValue() {
        if (!this._dragging && this.canSeek) {
            if (this._length > 0 && this._currentTime > 0)
                this.setValue(this._currentTime / this._length);
            else
                this.setValue(0);
        }
    }

    _timerCallback() {
        if (this.status === 'Playing') {
            if (this._timerTicker < 10) {
                this._currentTime += 1;
                this._timerTicker++;
                this._updateValue();
            } else { // Sync every 10 ticks
                this._timerTicker = 0;
                this._getPosition();
            }
            return true;
        }

        return false;
    }

    _updateTimer() {
        if (this._timeoutId !== 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        if (this.status === 'Playing') {
            if (this.canSeek) {
                this._getPosition();
                this._timerTicker = 0;
                this._timeoutId = Mainloop.timeout_add_seconds(1, this._timerCallback.bind(this));
            }
        } else {
            if (this.status === 'Stopped')
                this._currentTime = 0;
            this._updateValue();
        }
    }

    _getCanSeek() {
        // Some players say they "CanSeek" but don't actually give their position over dbus
        if (players_without_seek_support.indexOf(this._playerName) > -1) {
            this._setCanSeek(false);
            return;
        }

        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'CanSeek', (position, error) => {
            if (!error)
                this._setCanSeek(position[0].get_boolean());
        });
    }

    _setCanSeek(seek) {
        let playback_rate = this._mediaServerPlayer.Rate;
        // Hide seek for non-standard speeds except: 0 may mean paused, Audacious returns null
        if (seek && (playback_rate === 1 || !playback_rate)) {
            this.canSeek = true;
            this.actor.show();
            this._updateTimer();
        } else {
            this.canSeek = false;
            this.actor.hide();
        }
    }

    _setPosition(value) {
        if(value >= 0) {
            this._currentTime = value / 1000000;
            this._updateValue();
        } else {
            let time = this._value * this._length * 1000000;
            this._wantedSeekValue = Math.round(time);
            this._mediaServerPlayer.SetPositionRemote(this._trackid, time);
        }
    }

    _getPosition() {
        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'Position', (position, error) => {
            if (!error)
                this._setPosition(position[0].get_int64());
        });
    }

    destroy() {
        if (this._timeoutId != 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._seekChangedId)
            this._mediaServerPlayer.disconnectSignal(this._seekChangedId);

        this.disconnectAll();
        this._mediaServerPlayer = null;
        this._prop = null;
    }
}

class StreamMenuSection extends PopupMenu.PopupMenuSection {
    constructor(applet, stream) {
        super();

        let iconName = stream.icon_name;
        let name = stream.name;

        // capitalize the stream name
        if (name.length > 2) {
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Trim stream name
        if(name.length > 20) {
            name = name.substring(0, 16) + "... ";
        }

        // Special cases
        if(name === "Banshee") {
            iconName = "banshee";
        }
        else if (name === "Spotify") {
            iconName = "spotify";
        }
        if(name === "VBox") {
            name = "Virtualbox";
            iconName = "virtualbox";
        }
        else if (iconName === "audio") {
            iconName = "audio-x-generic";
        }

        let slider = new VolumeSlider(applet, stream, name, iconName);
        this.addMenuItem(slider);
    }
}

class Player extends PopupMenu.PopupMenuSection {
    constructor(applet, busname, owner) {
        super();
        this._owner = owner;
        this._busName = busname;
        this._applet = applet;

        // We'll update this later with a proper name
        this._name = this._busName;

        let asyncReadyCb = (proxy, error, property) => {
            if (error)
                log(error);
            else {
                this[property] = proxy;
                this._dbus_acquired();
            }
        };

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_NAME,
                                              this._busName,
                                              (p, e) => asyncReadyCb(p, e, '_mediaServer'));

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_PLAYER_NAME,
                                              this._busName,
                                              (p, e) => asyncReadyCb(p, e, '_mediaServerPlayer'));

        Interfaces.getDBusPropertiesAsync(this._busName,
                                          MEDIA_PLAYER_2_PATH,
                                          (p, e) => asyncReadyCb(p, e, '_prop'));

    }

    _dbus_acquired() {
        if (!this._prop || !this._mediaServerPlayer || !this._mediaServer)
            return;

        if (this._mediaServer.Identity) {
            this._name = this._mediaServer.Identity;
        } else {
            let displayName = this._busName.replace('org.mpris.MediaPlayer2.', '');
            this._name = displayName.capitalize();
        }

        let mainBox = new PopupMenu.PopupMenuSection();
        this.addMenuItem(mainBox);

        this.vertBox = new St.BoxLayout({ style_class: "sound-player", important: true, vertical: true });
        mainBox.addActor(this.vertBox, { expand: false });

        // Player info
        this._playerBox = new St.BoxLayout();
        this.playerIcon = new St.Icon({icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon"});
        this.playerLabel = new St.Label({
            y_expand: true, y_align: Clutter.ActorAlign.CENTER,
            x_expand: true, x_align: Clutter.ActorAlign.START
        });

        this._playerBox.add_actor(this.playerIcon);
        this._playerBox.add_actor(this.playerLabel);

        if (this._mediaServer.CanRaise) {
            this._showCanRaise();
        }
        if (this._mediaServer.CanQuit) {
            this._showCanQuit();
        }

        this.vertBox.add_actor(this._playerBox);

        // Cover Box (art + track info)
        this._trackCover = new St.Bin({x_align: St.Align.MIDDLE});
        this._trackCoverFile = this._trackCoverFileTmp = false;
        this.coverBox = new Clutter.Box();
        let l = new Clutter.BinLayout({x_align: Clutter.BinAlignment.FILL, y_align: Clutter.BinAlignment.END});
        this.coverBox.set_layout_manager(l);

        // Cover art
        this.cover = new St.Icon({icon_name: "media-optical", icon_size: 300, icon_type: St.IconType.FULLCOLOR});
        this.coverBox.add_actor(this.cover);

        // Track info (artist + title)
        this._artist = _("Unknown Artist");
        this._album = _("Unknown Album");
        this._title = _("Unknown Title");
        this.trackInfo = new St.BoxLayout({style_class: 'sound-player-overlay', important: true, vertical: true});
        let artistInfo = new St.BoxLayout();
        let artistIcon = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_name: "system-users", style_class: 'popup-menu-icon' });
        this.artistLabel = new St.Label({text:this._artist});
        artistInfo.add_actor(artistIcon);
        artistInfo.add_actor(this.artistLabel);
        let titleInfo = new St.BoxLayout();
        let titleIcon = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_name: "audio-x-generic", style_class: 'popup-menu-icon' });
        this.titleLabel = new St.Label({text:this._title});
        titleInfo.add_actor(titleIcon);
        titleInfo.add_actor(this.titleLabel);
        this.trackInfo.add_actor(artistInfo);
        this.trackInfo.add_actor(titleInfo);
        this.coverBox.add_actor(this.trackInfo);

        this._trackCover.set_child(this.coverBox);
        this.vertBox.add_actor(this._trackCover);

        // Playback controls
        let trackControls = new St.Bin({x_align: St.Align.MIDDLE});
        this._prevButton = new ControlButton("media-skip-backward",
                                             _("Previous"),
                                             () => this._mediaServerPlayer.PreviousRemote());
        this._playButton = new ControlButton("media-playback-start",
                                             _("Play"),
                                             () => this._mediaServerPlayer.PlayPauseRemote());
        this._stopButton = new ControlButton("media-playback-stop",
                                             _("Stop"),
                                             () => this._mediaServerPlayer.StopRemote());
        this._nextButton = new ControlButton("media-skip-forward",
                                             _("Next"),
                                             () => this._mediaServerPlayer.NextRemote());
        this.trackInfo.add_actor(trackControls);

        this.controls = new St.BoxLayout();
        if(St.Widget.get_default_direction () === St.TextDirection.RTL)
            this.controls.set_pack_start(true)

        this.controls.add_actor(this._prevButton.getActor());
        this.controls.add_actor(this._playButton.getActor());
        this.controls.add_actor(this._stopButton.getActor());
        this.controls.add_actor(this._nextButton.getActor());
        trackControls.set_child(this.controls);

        this._loopButton = new ControlButton("media-playlist-consecutive", _("Consecutive Playing"), () => this._toggleLoopStatus());
        this.controls.add_actor(this._loopButton.getActor());

        this._shuffleButton = new ControlButton("media-playlist-shuffle", _("No Shuffle"), () => this._toggleShuffle());
        this.controls.add_actor(this._shuffleButton.getActor());

        // Position slider
        this._seeker = new Seeker(this._mediaServerPlayer, this._prop, this._name.toLowerCase());
        this.vertBox.add_actor(this._seeker.actor);

        this._applet._updatePlayerMenuItems();

        this._setStatus(this._mediaServerPlayer.PlaybackStatus);
        this._setMetadata(this._mediaServerPlayer.Metadata);

        this._propChangedId = this._prop.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {
            if (props.PlaybackStatus)
                this._setStatus(props.PlaybackStatus.unpack());
            if (props.Metadata)
                this._setMetadata(props.Metadata.deep_unpack());
            if (props.CanGoNext || props.CanGoPrevious)
                this._updateControls();
            if (props.LoopStatus)
                this._setLoopStatus(props.LoopStatus.unpack());
            if (props.Shuffle)
                this._setShuffle(props.Shuffle.unpack());
            if (props.Identity) {
                this._name = props.Identity.unpack();
                this._applet._updatePlayerMenuItems();
            }
            if (props.CanRaise) {
                this._showCanRaise();
            }
            if (props.CanQuit) {
                this._showCanQuit();
            }
            if (props.DesktopEntry) {
                this._applet.passDesktopEntry(props.DesktopEntry.unpack());
            }
        });

        this._setLoopStatus(this._mediaServerPlayer.LoopStatus);
        this._setShuffle(this._mediaServerPlayer.Shuffle);

        if (this._mediaServer.DesktopEntry) {
            this._applet.passDesktopEntry(this._mediaServer.DesktopEntry);
        }
    }

    _showCanRaise() {
        let btn = new ControlButton("go-up", _("Open Player"), () => {
            if (this._name.toLowerCase() === "spotify") {
                // Spotify isn't able to raise via Dbus once its main UI is closed
                Util.spawn(['spotify']);
            }
            else {
                this._mediaServer.RaiseRemote();
            }
            this._applet.menu.close();
        }, true);
        this._playerBox.add_actor(btn.actor);
    }

    _showCanQuit() {
        let btn = new ControlButton("window-close", _("Quit Player"), () => {
            this._mediaServer.QuitRemote();
            this._applet.menu.close();
        }, true);
        this._playerBox.add_actor(btn.actor);
    }

    _setName(status) {
        this.playerLabel.set_text(this._name + " - " + _(status));
    }

    _updateControls() {
        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'CanGoNext', (value, error) => {
            let canGoNext = false;
            if (!error)
                canGoNext = value[0].unpack();
            this._nextButton.setEnabled(canGoNext);
        });

        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'CanGoPrevious', (value, error) => {
            let canGoPrevious = false;
            if (!error)
                canGoPrevious = value[0].unpack();
            this._prevButton.setEnabled(canGoPrevious);
        });
    }

    _setMetadata(metadata) {
        if (!metadata)
            return;

        let trackid = "";  // D-Bus path: A unique identity for this track
        if (metadata["mpris:trackid"]) {
            trackid = metadata["mpris:trackid"].unpack();
        }

        let trackLength = 0; // Track length in secs
        if (metadata["mpris:length"]) {
            trackLength = metadata["mpris:length"].unpack() / 1000000;
        }
        this._seeker.setTrack(trackid, trackLength);

        if (metadata["xesam:artist"]) {
            switch (metadata["xesam:artist"].get_type_string()) {
                case 's':
                    // smplayer sends a string
                    this._artist = metadata["xesam:artist"].unpack();
                    break;
                case 'as':
                    // others send an array of strings
                    this._artist = metadata["xesam:artist"].deep_unpack().join(", ");
                    break;
                default:
                    this._artist = _("Unknown Artist");
            }
            // make sure artist isn't empty
            if (!this._artist) this._artist = _("Unknown Artist");
        }
        else
            this._artist = _("Unknown Artist");

        this.artistLabel.set_text(this._artist);

        if (metadata["xesam:album"])
            this._album = metadata["xesam:album"].unpack();
        else
            this._album = _("Unknown Album");

        if (metadata["xesam:title"])
            this._title = metadata["xesam:title"].unpack();
        else
            this._title = _("Unknown Title");
        this.titleLabel.set_text(this._title);

        let change = false;
        if (metadata["mpris:artUrl"]) {
            let artUrl = metadata["mpris:artUrl"].unpack();
            if (this._trackCoverFile != artUrl) {
                this._trackCoverFile = artUrl;
                change = true;
            }
        }
        else {
            if (this._trackCoverFile != false) {
                this._trackCoverFile = false;
                change = true;
            }
        }

        if (change) {
            if (this._trackCoverFile) {
                let cover_path = "";
                if (this._trackCoverFile.match(/^http/)) {
                    if (!this._trackCoverFileTmp)
                        this._trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
                    Util.spawn_async(['wget', this._trackCoverFile, '-O', this._trackCoverFileTmp.get_path()], () => this._onDownloadedCover());
                }
                else if (this._trackCoverFile.match(/data:image\/(png|jpeg);base64,/)) {
                    if (!this._trackCoverFileTmp)
                        this._trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
                    const cover_base64 = this._trackCoverFile.split(',')[1];
                    const base64_decode = data => new Promise(resolve => resolve(GLib.base64_decode(data)));
                    if (!cover_base64) {
                        return;
                    }
                    base64_decode(cover_base64)
                    .then(decoded => {
                        this._trackCoverFileTmp.replace_contents(
                            decoded,
                            null,
                            false,
                            Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null
                        );
                        return this._trackCoverFileTmp.get_path();
                    })
                    .then(path => this._showCover(path));
                }
                else {
                    cover_path = decodeURIComponent(this._trackCoverFile);
                    cover_path = cover_path.replace("file://", "");
                    this._showCover(cover_path);
                }
            }
            else
                this._showCover(false);
        }
        this._applet.setAppletTextIcon(this, true);
    }

    _setStatus(status) {
        if (!status)
            return;
        this._playerStatus = status;
        if (status == "Playing") {
            this._playButton.setData("media-playback-pause", _("Pause"));
            this.playerIcon.set_icon_name("media-playback-start");
            this._applet.setAppletTextIcon(this, true);
            this._seeker.play();
        }
        else if (status == "Paused") {
            this._playButton.setData("media-playback-start", _("Play"));
            this.playerIcon.set_icon_name("media-playback-pause");
            this._applet.setAppletTextIcon(this, false);
            this._seeker.pause();
        }
        else if (status == "Stopped") {
            this._playButton.setData("media-playback-start", _("Play"));
            this.playerIcon.set_icon_name("media-playback-stop");
            this._applet.setAppletTextIcon(this, false);
            this._seeker.stop();
        } else {
            this._applet.setAppletTextIcon(this, false);
        }

        this._setName(status);
    }

    _toggleLoopStatus() {
        let mapping = {
            "None": "Playlist",
            "Playlist": "Track",
            "Track": "None"
        };

        this._mediaServerPlayer.LoopStatus = mapping[this._mediaServerPlayer.LoopStatus];
        this._setLoopStatus(this._mediaServerPlayer.LoopStatus);
    }

    _setLoopStatus(status) {
        this._loopButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.LoopStatus;

        if(status === "None")
            this._loopButton.setData("media-playlist-consecutive-symbolic", _("Consecutive Playing"));
        else if(status === "Track")
            this._loopButton.setData("media-playlist-repeat-song", _("Repeat Single"));
        else if(status === "Playlist")
            this._loopButton.setData("media-playlist-repeat", _("Repeat All"));

        this._loopButton.setActive(status !== "None");
    }

    _toggleShuffle() {
        this._mediaServerPlayer.Shuffle = !this._mediaServerPlayer.Shuffle;
    }

    _setShuffle(status) {
        this._shuffleButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.Shuffle;

        this._shuffleButton.setData("media-playlist-shuffle", status? _("Shuffle") : _("No Shuffle"));
        this._shuffleButton.setActive(status);
    }

    _onDownloadedCover() {
        let cover_path = this._trackCoverFileTmp.get_path();
        this._showCover(cover_path);
    }

    _showCover(cover_path) {
        this.coverBox.remove_actor(this.cover);
        if (! cover_path || ! GLib.file_test(cover_path, GLib.FileTest.EXISTS)) {
            this.cover = new St.Icon({style_class: 'sound-player-generic-coverart', important: true, icon_name: "media-optical", icon_size: 300, icon_type: St.IconType.FULLCOLOR});
            cover_path = null;
        }
        else {
            if (this._applet.keepAlbumAspectRatio) {
                this.cover = new Clutter.Texture({width: 300, keep_aspect_ratio: true, filter_quality: 2, filename: cover_path});
            }
            else {
                this.cover = new Clutter.Texture({width: 300, height: 300, keep_aspect_ratio: false, filter_quality: 2, filename: cover_path});
            }
        }
        this.coverBox.add_actor(this.cover);
        this.coverBox.set_child_below_sibling(this.cover, this.trackInfo);
        this._applet.setAppletTextIcon(this, cover_path);
    }

    onSettingsChanged() {
        this._loopButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.LoopStatus;
        this._shuffleButton.actor.visible = this._applet.extendedPlayerControl && this._mediaServerPlayer.Shuffle;
    }

    destroy() {
        this._seeker.destroy();
        if (this._prop)
            this._prop.disconnectSignal(this._propChangedId);

        PopupMenu.PopupMenuSection.prototype.destroy.call(this);
    }
}

class MediaPlayerLauncher extends PopupMenu.PopupBaseMenuItem {
    constructor(app, menu) {
        super({});

        this._app = app;
        this._menu = menu;
        this.label = new St.Label({ text: app.get_name() });
        this.addActor(this.label);
        this._icon = app.create_icon_texture(ICON_SIZE);
        this.addActor(this._icon, { expand: false });
        this.connect("activate", (event) => this._onActivate(event));
    }

    _onActivate(event) {
        let _time = event.time;
        this._app.activate_full(-1, _time);
    }
}

class CinnamonSoundApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("showtrack", "showtrack", this.on_settings_changed);
        this.settings.bind("middleClickAction", "middleClickAction");
        this.settings.bind("horizontalScroll", "horizontalScroll")
        this.settings.bind("showalbum", "showalbum", this.on_settings_changed);
        this.settings.bind("truncatetext", "truncatetext", this.on_settings_changed);
        this.settings.bind("keepAlbumAspectRatio", "keepAlbumAspectRatio", this.on_settings_changed);
        this.settings.bind("hideSystray", "hideSystray", function() {
            if (this.hideSystray) this.registerSystrayIcons();
            else this.unregisterSystrayIcons();
        });

        this.settings.bind("playerControl", "playerControl", this.on_settings_changed);
        this.settings.bind("extendedPlayerControl", "extendedPlayerControl", function() {
            for(let i in this._players)
                this._players[i].onSettingsChanged();
        });

        this.settings.bind("_knownPlayers", "_knownPlayers");
        if (this.hideSystray) this.registerSystrayIcons();

        this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);

        this.settings.bind("tooltipShowVolume", "tooltipShowVolume", this.on_settings_changed);
        this.settings.bind("tooltipShowPlayer", "tooltipShowPlayer", this.on_settings_changed);
        this.settings.bind("tooltipShowArtistTitle", "tooltipShowArtistTitle", this.on_settings_changed);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._setKeybinding();

        this.set_applet_icon_symbolic_name('audio-x-generic');

        this._players = {};
        this._playerItems = [];
        this._activePlayer = null;

        Interfaces.getDBusAsync((proxy, error) => {
            if (error) {
                // ?? what else should we do if we fail completely here?
                throw error;
            }

            this._dbus = proxy;

            // player DBus name pattern
            let name_regex = /^org\.mpris\.MediaPlayer2\./;
            // load players
            this._dbus.ListNamesRemote((names) => {
                for (let n in names[0]) {
                    let name = names[0][n];
                    if (name_regex.test(name))
                        this._dbus.GetNameOwnerRemote(name, (owner) => this._addPlayer(name, owner[0]));
                }
            });

            // watch players
            this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged',
                (proxy, sender, [name, old_owner, new_owner]) => {
                    if (name_regex.test(name)) {
                        if (new_owner && !old_owner)
                            this._addPlayer(name, new_owner);
                        else if (old_owner && !new_owner)
                            this._removePlayer(name, old_owner);
                        else
                            this._changePlayerOwner(name, old_owner, new_owner);
                    }
                }
            );
        });

        this._control = new Cvc.MixerControl({ name: 'Cinnamon Volume Control' });
        this._control.connect('state-changed', (...args) => this._onControlStateChanged(...args));

        this._control.connect('output-added', (...args) => this._onDeviceAdded(...args, "output"));
        this._control.connect('output-removed', (...args) => this._onDeviceRemoved(...args, "output"));
        this._control.connect('active-output-update', (...args) => this._onDeviceUpdate(...args, "output"));

        this._control.connect('input-added', (...args) => this._onDeviceAdded(...args, "input"));
        this._control.connect('input-removed', (...args) => this._onDeviceRemoved(...args, "input"));
        this._control.connect('active-input-update', (...args) => this._onDeviceUpdate(...args, "input"));

        this._control.connect('stream-added', (...args) => this._onStreamAdded(...args));
        this._control.connect('stream-removed', (...args) => this._onStreamRemoved(...args));

        this._sound_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });
        this._volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
        this._volumeNorm = this._control.get_vol_max_norm();

        this._streams = [];
        this._devices = [];
        this._recordingAppsNum = 0;

        this._output = null;
        this._outputMutedId = 0;
        this._outputIcon = "audio-volume-muted";

        this._input = null;
        this._inputMutedId = 0;

        this._icon_name = '';
        this._icon_path = null;
        this._iconTimeoutId = 0;

        this.actor.connect('scroll-event', (...args) => this._onScrollEvent(...args));

        this.mute_out_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-volume-muted", St.IconType.SYMBOLIC);
        this.mute_in_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "microphone-sensitivity-none", St.IconType.SYMBOLIC);
        this._applet_context_menu.addMenuItem(this.mute_out_switch);
        this._applet_context_menu.addMenuItem(this.mute_in_switch);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._outputApplicationsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Applications"));
        this._selectOutputDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Output device"));
        this._applet_context_menu.addMenuItem(this._outputApplicationsMenu);
        this._applet_context_menu.addMenuItem(this._selectOutputDeviceItem);
        this._outputApplicationsMenu.actor.hide();
        this._selectOutputDeviceItem.actor.hide();

        this._inputSection = new PopupMenu.PopupMenuSection();
        this._inputVolumeSection = new VolumeSlider(this, null, _("Microphone"), null);
        this._inputVolumeSection.connect("values-changed", (...args) => this._inputValuesChanged(...args));
        this._selectInputDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Input device"));
        this._inputSection.addMenuItem(this._inputVolumeSection);
        this._inputSection.addMenuItem(this._selectInputDeviceItem);
        this._applet_context_menu.addMenuItem(this._inputSection);

        this._selectInputDeviceItem.actor.hide();
        this._inputSection.actor.hide();

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.mute_out_switch.connect('toggled', () => this._toggle_out_mute());
        this.mute_in_switch.connect('toggled', () => this._toggle_in_mute());

        this._control.open();

        this._volumeControlShown = false;

        this._showFixedElements();
        this.set_show_label_in_vertical_panels(false);
        this.set_applet_label(this._applet_label.get_text());

        let appsys = Cinnamon.AppSystem.get_default();
        appsys.connect("installed-changed", () => this._updateLaunchPlayer());

        if (this._volumeMax > this._volumeNorm) {
            this._outputVolumeSection.set_mark(this._volumeNorm / this._volumeMax);
        }

        this._sound_settings.connect("changed::" + MAXIMUM_VOLUME_KEY, () => this._on_sound_settings_change());
    }

    _setKeybinding() {
        Main.keybindingManager.addHotKey("sound-open-" + this.instance_id, this.keyOpen, Lang.bind(this, this._openMenu));
    }

    _on_sound_settings_change () {
        this._volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
        if (this._volumeMax > this._volumeNorm) {
            this._outputVolumeSection.set_mark(this._volumeNorm / this._volumeMax);
        }
        else {
            this._outputVolumeSection.set_mark(0);
        }
        this._outputVolumeSection._update();
    }

    on_settings_changed () {
        if(this.playerControl && this._activePlayer)
            this.setAppletTextIcon(this._players[this._activePlayer], true);
        else
            this.setAppletTextIcon();

        this._changeActivePlayer(this._activePlayer);
    }

    on_applet_removed_from_panel () {
        Main.keybindingManager.removeHotKey("sound-open-" + this.instance_id);
        if (this.hideSystray)
            this.unregisterSystrayIcons();
        if (this._iconTimeoutId) {
            Mainloop.source_remove(this._iconTimeoutId);
        }

        this._dbus.disconnectSignal(this._ownerChangedId);

        for(let i in this._players)
            this._players[i].destroy();
    }

    on_applet_clicked(event) {
        this._openMenu();
    }

    _openMenu() {
        this.menu.toggle();
    }

    _toggle_out_mute() {
        if (!this._output)
            return;

        if (this._output.is_muted) {
            this._output.change_is_muted(false);
            this.mute_out_switch.setToggleState(false);
        } else {
            this._output.change_is_muted(true);
            this.mute_out_switch.setToggleState(true);
        }
    }

    _toggle_in_mute() {
        if (!this._input)
            return;

        if (this._input.is_muted) {
            this._input.change_is_muted(false);
            this.mute_in_switch.setToggleState(false);
        } else {
            this._input.change_is_muted(true);
            this.mute_in_switch.setToggleState(true);
        }
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();
        let currentVolume = this._output.volume;

        if (direction == Clutter.ScrollDirection.DOWN) {
            let prev_muted = this._output.is_muted;
            this._output.volume = Math.max(0, currentVolume - this._volumeNorm * VOLUME_ADJUSTMENT_STEP);
            if (this._output.volume < 1) {
                this._output.volume = 0;
                if (!prev_muted)
                    this._output.change_is_muted(true);
            } else {
                // 100% is magnetic:
                if (this._output.volume!=this._volumeNorm && this._output.volume>this._volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && this._output.volume<this._volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
                    this._output.volume=this._volumeNorm;
            }
            this._output.push_volume();
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._output.volume = Math.min(this._volumeMax, currentVolume + this._volumeNorm * VOLUME_ADJUSTMENT_STEP);
            // 100% is magnetic:
            if (this._output.volume!=this._volumeNorm && this._output.volume>this._volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && this._output.volume<this._volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
                this._output.volume=this._volumeNorm;
            this._output.push_volume();
            this._output.change_is_muted(false);
        }
        else if (this.horizontalScroll) {
            if (direction == Clutter.ScrollDirection.LEFT) {
                this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote();
            }
            else {
                this._players[this._activePlayer]._mediaServerPlayer.NextRemote();
            }
        }

        this._applet_tooltip.show();

        this._notifyVolumeChange(this._output);
    }

    _onButtonPressEvent (actor, event) {
        let buttonId = event.get_button();

        //mute or play / pause players on middle click
        if (buttonId === 2) {
            if (this.middleClickAction === "mute") {
                this._toggle_out_mute();
                this._toggle_in_mute();
            } else if (this.middleClickAction === "out_mute")
                this._toggle_out_mute();
            else if (this.middleClickAction === "in_mute")
                this._toggle_in_mute();
            else if (this.middleClickAction === "player")
                this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote();
        } else if (buttonId === 8) { // previous and next track on mouse buttons 4 and 5 (8 and 9 by X11 numbering)
            this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote();
        } else if (buttonId === 9) {
            this._players[this._activePlayer]._mediaServerPlayer.NextRemote();
        } else {
            return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
        }
        return Clutter.EVENT_STOP;
    }

    setIcon(icon, source) {
        if (this._iconTimeoutId) {
            Mainloop.source_remove(this._iconTimeoutId);
            this._iconTimeoutId = null;
        }

        //save the icon
        if (source) {
            if (source === "output")
                this._outputIcon = icon;
            else
                this._playerIcon = [icon, source === "player-path"];
        }

        if (this.playerControl && this._activePlayer && this._playerIcon[0]) {
            if (source === "output") {
                //if we have an active player, but are changing the volume, show the output icon and after three seconds change back to the player icon
                this.set_applet_icon_symbolic_name(this._outputIcon);
                this._iconTimeoutId = Mainloop.timeout_add_seconds(OUTPUT_ICON_SHOW_TIME_SECONDS, () => {
                    this._iconTimeoutId = null;
                    this.setIcon();
                });
            } else {
                //if we have an active player and want to change the icon, change it immediately
                if (this._playerIcon[1])
                    this.set_applet_icon_path(this._playerIcon[0]);
                else
                    this.set_applet_icon_symbolic_name(this._playerIcon[0]);
            }
        } else {
            //if we have no active player show the output icon
            this.set_applet_icon_symbolic_name(this._outputIcon);
        }
    }

    setAppletIcon(player, path) {
        if (path) {
            if (path === true) {
                // Restore the icon path from the saved path.
                path = this._icon_path;
            } else {
                this._icon_path = path;
            }
        } else if (path === null) {
            // This track has no art, erase the saved path.
            this._icon_path = null;
        }

        if (this.showalbum) {
            if (path && player && (player === true || player._playerStatus == 'Playing')) {
                this.setIcon(path, "player-path");
            } else {
                this.setIcon('media-optical-cd-audio', 'player-name');
            }
        }
        else {
            this.setIcon('audio-x-generic', 'player-name');
        }
    }

    setAppletText(player) {
        let title_text = "";
        if (this.showtrack && player && player._playerStatus == 'Playing') {
            if (player._artist == "Unknown Artist") {
                title_text = player._title;
            }
            else {
                title_text = player._title + ' - ' + player._artist;
            }
            if (this.truncatetext < title_text.length) {
                title_text = title_text.substr(0, this.truncatetext) + "...";
            }
        }
        this.set_applet_label(title_text);
    }

    setAppletTextIcon(player, icon) {
        this.player = player;
        if (player && player._owner != this._activePlayer)
            return;
        this.setAppletIcon(player, icon);
        this.setAppletText(player);
        this.setAppletTooltip();
    }

    setAppletTooltip() {
        let tooltips = [];
        if (this.tooltipShowVolume) {
            tooltips.push(_("Volume") + ": " + this.volume);
        }
        if (this.player && this.player._owner == this._activePlayer) {
            if (this.tooltipShowPlayer) {
                tooltips.push(this.player._name + " - " + _(this.player._playerStatus));
            }
            if (this.tooltipShowArtistTitle) {
                if (this.player._artist != _("Unknown Artist")) {
                    tooltips.push(this.player._artist);
                }
                if (this._title != _("Unknown Title")) {
                    tooltips.push(this.player._title);
                }
            }
        }
        this.set_applet_tooltip(tooltips.join("\n"));
    }

    _isInstance(busName) {
        // MPRIS instances are in the form
        //   org.mpris.MediaPlayer2.name.instanceXXXX
        // ...except for VLC, which to this day uses
        //   org.mpris.MediaPlayer2.name-XXXX
        return busName.split('.').length > 4 ||
                /^org\.mpris\.MediaPlayer2\.vlc-\d+$/.test(busName);
    }

    _addPlayer(busName, owner) {
        if (this._players[owner]) {
            let prevName = this._players[owner]._busName;
            // HAVE: ADDING: ACTION:
            // master master reject, cannot happen
            // master instance upgrade to instance
            // instance master reject, duplicate
            // instance instance reject, cannot happen
            if (this._isInstance(busName) && !this._isInstance(prevName))
                this._players[owner]._busName = busName;
            else
                return;
        } else if (owner) {
            let player = new Player(this, busName, owner);

            // Add the player to the list of active players in GUI.
            // We don't have the org.mpris.MediaPlayer2 interface set up at this point,
            // add the player's busName as a placeholder until we can get its Identity.
            let item = new PopupMenu.PopupMenuItem(busName);
            item.activate = () => this._switchPlayer(player._owner);
            this._chooseActivePlayerItem.menu.addMenuItem(item);

            this._players[owner] = player;
            this._playerItems.push({ player: player, item: item });

            this._changeActivePlayer(owner);
            this._updatePlayerMenuItems();
            this.setAppletTextIcon();
        }
    }

    _switchPlayer(owner) {
        if(this._players[owner]) {
            // The player exists, switch to it
            this._changeActivePlayer(owner);
            this._updatePlayerMenuItems();
            this.setAppletTextIcon();
        } else {
            // The player doesn't seem to exist. Remove it from the players list
            this._removePlayerItem(owner);
            this._updatePlayerMenuItems();
        }
    }

    _removePlayerItem(owner) {
        // Remove the player from the player switching list
        for(let i = 0, l = this._playerItems.length; i < l; ++i) {
            let playerItem = this._playerItems[i];
            if(playerItem.player._owner === owner) {
                playerItem.item.destroy();
                this._playerItems.splice(i, 1);
                break;
            }
        }
    }

    _removePlayer(busName, owner) {
        if (this._players[owner] && this._players[owner]._busName == busName) {
            this._removePlayerItem(owner);

            this._players[owner].destroy();
            delete this._players[owner];

            if (this._activePlayer == owner) {
                //set _activePlayer to null if we have none now, or to the first value in the players list
                this._activePlayer = null;
                for (let i in this._players) {
                    this._changeActivePlayer(i);
                    break;
                }
            }
            this._updatePlayerMenuItems();
            this.setAppletTextIcon();
        }
    }

    _changePlayerOwner(busName, oldOwner, newOwner) {
        if (this._players[oldOwner] && busName == this._players[oldOwner]._busName) {
            this._players[newOwner] = this._players[oldOwner];
            this._players[newOwner]._owner = newOwner;
            delete this._players[oldOwner];
            if (this._activePlayer == oldOwner)
                this._activePlayer = newOwner;
        }
    }

    //will be called by an instance of #Player
    passDesktopEntry(entry) {
        //do we know already this player?
        for (let i = 0, l = this._knownPlayers.length; i < l; ++i) {
            if (this._knownPlayers[i] === entry)
                return;
        }
        //No, save it to _knownPlayers and update player list
        this._knownPlayers.push(entry);
        this._knownPlayers.save();
        this._updateLaunchPlayer();
    }

    _showFixedElements() {
        // The launch player list
        this._launchPlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Launch player"));
        this.menu.addMenuItem(this._launchPlayerItem);
        this._updateLaunchPlayer();

        // The list to use when switching between active players
        this._chooseActivePlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Choose player controls"));
        this._chooseActivePlayerItem.actor.hide();
        this.menu.addMenuItem(this._chooseActivePlayerItem);

        //between these two separators will be the player MenuSection (position 3)
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._outputVolumeSection = new VolumeSlider(this, null, _("Volume"), null);
        this._outputVolumeSection.connect("values-changed", (...args) => this._outputValuesChanged(...args));

        this.menu.addMenuItem(this._outputVolumeSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addSettingsAction(_("Sound Settings"), 'sound');
    }

    _updateLaunchPlayer() {
        let availablePlayers = [];

        let appsys = Cinnamon.AppSystem.get_default();
        //_knownPlayers is an array containing the paths of desktop files
        for(let i = 0, l = this._knownPlayers.length; i < l; ++i) {
            let app = appsys.lookup_app(this._knownPlayers[i] + ".desktop");
            if (app)
                availablePlayers.push(app);
        }

        this._launchPlayerItem.menu.removeAll();

        if (availablePlayers.length > 0) {
            for (var p = 0; p < availablePlayers.length; p++) {
                let playerApp = availablePlayers[p];
                let menuItem = new MediaPlayerLauncher(playerApp, this._launchPlayerItem.menu);
                this._launchPlayerItem.menu.addMenuItem(menuItem);
            }
        }

        if (!this.playerControl || !availablePlayers.length) {
            this._launchPlayerItem.actor.hide();
        }
    }

    _updatePlayerMenuItems() {
        if (this.playerControl && this._activePlayer) {
            this._launchPlayerItem.actor.show();
            this._chooseActivePlayerItem.actor.show();

            // Show a dot on the active player in the switching menu
            for (let i = 0, l = this._playerItems.length; i < l; ++i) {
                let playerItem = this._playerItems[i];

                playerItem.item.setLabel(playerItem.player._name);
                playerItem.item.setShowDot(playerItem.player._owner === this._activePlayer);
            }

            // Hide the switching menu if we only have at most one active player
            if(this._chooseActivePlayerItem.menu.numMenuItems <= 1) {
                this._chooseActivePlayerItem.actor.hide();
            }
        } else {
            if (this.playerControl && this._launchPlayerItem.menu.numMenuItems) {
                this._launchPlayerItem.actor.show();
            } else {
                this._launchPlayerItem.actor.hide();
                this._chooseActivePlayerItem.actor.hide();
            }
        }
    }

    _changeActivePlayer(player) {
        if (this._activePlayer)
            this.menu.box.remove_actor(this._players[this._activePlayer].actor);

        this._activePlayer = player;
        if (this.playerControl && this._activePlayer != null) {
            let menuItem = this._players[player];
            this.menu.addMenuItem(menuItem, 2);
        }

        this._updatePlayerMenuItems();
    }

    _notifyVolumeChange(stream) {
        Main.soundManager.playVolume('volume', stream.decibel);
    }

    _mutedChanged(object, param_spec, property) {
        if (property == "_output") {
            this.mute_out_switch.setToggleState(this._output.is_muted);
        } else if (property == "_input") {
            this.mute_in_switch.setToggleState(this._input.is_muted);
        }
    }

    _outputValuesChanged(actor, iconName, percentage) {
        this.setIcon(iconName, "output");
        this.mute_out_switch.setIconSymbolicName(iconName);
        this.volume = percentage;
        this.setAppletTooltip();
    }

    _inputValuesChanged(actor, iconName) {
        this.mute_in_switch.setIconSymbolicName(iconName);
    }

    _onControlStateChanged() {
        if (this._control.get_state() == Cvc.MixerControlState.READY) {
            this._readOutput();
            this._readInput();
            this.actor.show();
        } else {
            this.actor.hide();
        }
    }

    _readOutput() {
        if (this._outputMutedId) {
            this._output.disconnect(this._outputMutedId);
            this._outputMutedId = 0;
        }
        this._output = this._control.get_default_sink();
        if (this._output) {
            this._outputVolumeSection.connectWithStream(this._output);
            this._outputMutedId = this._output.connect('notify::is-muted', (...args) => this._mutedChanged(...args, '_output'));
            this._mutedChanged (null, null, '_output');
        } else {
            this.setIcon("audio-volume-muted-symbolic", "output");
        }
    }

    _readInput() {
        if (this._inputMutedId) {
            this._input.disconnect(this._inputMutedId);
            this._inputMutedId = 0;
        }
        this._input = this._control.get_default_source();
        if (this._input) {
            this._inputVolumeSection.connectWithStream(this._input);
            this._inputMutedId = this._input.connect('notify::is-muted', (...args) => this._mutedChanged(...args, '_input'));
            this._mutedChanged (null, null, '_input');
        } else {
            this._inputSection.actor.hide();
        }
    }

    _onDeviceAdded(control, id, type) {
        let device = this._control["lookup_" + type + "_id"](id);

        let item = new PopupMenu.PopupMenuItem(device.description);
        item.activate = () => this._control["change_" + type](device);

        let bin = new St.Bin({ x_align: St.Align.END, style_class: 'popup-inactive-menu-item' });
        let label = new St.Label({ text: device.origin });
        bin.add_actor(label);
        item.addActor(bin, { expand: true, span: -1, align: St.Align.END });

        let selectItem = this["_select" + type[0].toUpperCase() + type.slice(1) + "DeviceItem"];
        selectItem.menu.addMenuItem(item);
        //show the menu if we have more than two devices
        if(selectItem.menu.numMenuItems > 1)
            selectItem.actor.show();

        this._devices.push({id: id, type: type, item: item});
    }

    _onDeviceRemoved(control, id, type) {
        for (let i = 0, l = this._devices.length; i < l; ++i) {
            if (this._devices[i].type === type && this._devices[i].id === id) {
                let device = this._devices[i];
                if (device.item)
                    device.item.destroy();

                //hide submenu if showing them is unnecessary
                let selectItem = this["_select" + type[0].toUpperCase() + type.slice(1) + "DeviceItem"];
                if (selectItem.menu.numMenuItems <= 1)
                    selectItem.actor.hide();

                this._devices.splice(i, 1);
                break;
            }
        }
    }

    _onDeviceUpdate(control, id, type) {
        this["_read" + type[0].toUpperCase() + type.slice(1)]();

        for (let i = 0, l = this._devices.length; i < l; ++i) {
            if (this._devices[i].type === type)
                this._devices[i].item.setShowDot(id === this._devices[i].id);
        }
    }

    _onStreamAdded(control, id) {
        let stream = this._control.lookup_stream_id(id);
        let appId = stream.application_id;

        if (stream.is_virtual || appId === "org.freedesktop.libcanberra") {
            //sort out unwanted streams
            return;
        }

        if (stream instanceof Cvc.MixerSinkInput) {
            //for sink inputs, add a menuitem to the application submenu
            let item = new StreamMenuSection(this, stream);
            this._outputApplicationsMenu.menu.addMenuItem(item);
            this._outputApplicationsMenu.actor.show();
            this._streams.push({id: id, type: "SinkInput", item: item});
        } else if (stream instanceof Cvc.MixerSourceOutput) {
            //for source outputs, only show the input section
            this._streams.push({id: id, type: "SourceOutput"});
            if (this._recordingAppsNum++ === 0)
                this._inputSection.actor.show();
        }
    }

    _onStreamRemoved(control, id) {
        for (let i = 0, l = this._streams.length; i < l; ++i) {
            if(this._streams[i].id === id) {
                let stream = this._streams[i];
                if(stream.item)
                    stream.item.destroy();

                //hide submenus or sections if showing them is unnecessary
                if (stream.type === "SinkInput") {
                    if (this._outputApplicationsMenu.menu.numMenuItems === 0)
                        this._outputApplicationsMenu.actor.hide();
                } else if (stream.type === "SourceOutput") {
                    if(--this._recordingAppsNum === 0)
                        this._inputSection.actor.hide();
                }
                this._streams.splice(i, 1);
                break;
            }
        }
    }

    registerSystrayIcons() {
        for (let i = 0; i < players_with_seek_support.length; i++) {
            Main.systrayManager.registerRole(players_with_seek_support[i], this.metadata.uuid);
        }
        for (let i = 0; i < players_without_seek_support.length; i++) {
            Main.systrayManager.registerRole(players_without_seek_support[i], this.metadata.uuid);
        }
    }

    unregisterSystrayIcons() {
        Main.systrayManager.unregisterId(this.metadata.uuid);
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonSoundApplet(metadata, orientation, panel_height, instanceId);
}
