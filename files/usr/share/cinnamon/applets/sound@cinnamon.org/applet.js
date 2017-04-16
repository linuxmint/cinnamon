const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Interfaces = imports.misc.interfaces;
const Util = imports.misc.util;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Cvc = imports.gi.Cvc;
const Pango = imports.gi.Pango;
const Tooltips = imports.ui.tooltips;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Slider = imports.ui.slider;

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";

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

function ControlButton() {
    this._init.apply(this, arguments);
}

ControlButton.prototype = {
    _init: function(icon, tooltip, callback, small = false) {
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
    },

    getActor: function() {
        return this.actor;
    },

    setData: function(icon, tooltip) {
        this.icon.icon_name = icon;
        this.tooltip.set_text(tooltip);
    },

    setActive: function(status){
        this.button.change_style_pseudo_class("active", status);
    },

    setEnabled: function(status){
        this.button.change_style_pseudo_class("disabled", !status);
        this.button.can_focus = status;
        this.button.reactive = status;
    }
}

function VolumeSlider(){
    this._init.apply(this, arguments);
}

VolumeSlider.prototype = {
    __proto__: PopupMenu.PopupSliderMenuItem.prototype,

    _init: function(applet, stream, tooltip, app_icon){
        PopupMenu.PopupSliderMenuItem.prototype._init.call(this, 0);
        this.applet = applet;

        if(tooltip)
            this.tooltipText = tooltip + ": ";
        else
            this.tooltipText = "";

        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        this.connect("value-changed", Lang.bind(this, this._onValueChanged));

        this.app_icon = app_icon;
        if (this.app_icon == null) {
            this.iconName = this.isMic ? "microphone-sensitivity-none" : "audio-volume-muted";
            this.icon = new St.Icon({icon_name: this.iconName, icon_type: St.IconType.SYMBOLIC, icon_size: 16});
        }
        else {
            this.icon = new St.Icon({icon_name: this.app_icon, icon_type: St.IconType.FULLCOLOR, icon_size: 16});
        }

        this.removeActor(this._slider);
        this.addActor(this.icon, {span: 0});
        this.addActor(this._slider, {span: -1, expand: true});

        this.connectWithStream(stream);
    },

    connectWithStream: function(stream){
        if(!stream){
            this.actor.hide();
            this.stream = null;
        } else {
            this.actor.show();
            this.stream = stream;
            this.isMic = stream instanceof Cvc.MixerSource || stream instanceof Cvc.MixerSourceOutput;

            let mutedId = stream.connect("notify::is-muted", Lang.bind(this, this._update));
            let volumeId = stream.connect("notify::volume", Lang.bind(this, this._update));
            this.connect("destroy", function(){
                stream.disconnect(mutedId);
                stream.disconnect(volumeId);
            });
        }

        this._update();
    },

    _onValueChanged: function(){
        if(!this.stream) return;

        let volume = this._value * this.applet._volumeMax, muted;

        if(this._value < .005){
            volume = 0;
            muted = true;
        } else {
            muted = false;
        }
        this.stream.volume = volume;
        this.stream.push_volume();

        if(this.stream.is_muted !== muted)
            this.stream.change_is_muted(muted);

        if(!this._dragging)
            this.applet._notifyVolumeChange(this.stream);
    },

    _update: function(){
        let value = (!this.stream || this.stream.is_muted)? 0 : this.stream.volume / this.applet._volumeMax;
        let percentage = Math.round(value * 100) + "%";

        this.tooltip.set_text(this.tooltipText + percentage);
        let iconName = this._volumeToIcon(value);
        if (this.app_icon == null) {
            this.icon.icon_name = iconName;
        }
        this.setValue(value);

        // send data to applet
        this.emit("values-changed", iconName, percentage);
    },

    _volumeToIcon: function(value){
        if(value < .005)
            return this.isMic? "microphone-sensitivity-none" : "audio-volume-muted";
        let n = Math.floor(3 * value), icon;
        if(n < 1)
            icon = "low";
        else if(n < 2)
            icon = "medium";
        else
            icon = "high";

        return this.isMic? "microphone-sensitivity-" + icon : "audio-volume-" + icon;
    }
}

function StreamMenuSection(){
    this._init.apply(this, arguments);
}

StreamMenuSection.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function(applet, stream){
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        let iconName = stream.icon_name;
        let name = stream.name;

        // capitalize the stream name
        if (name.length > 2) {
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Trim stream name
        if(name.length > 16) {
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

function Player() {
    this._init.apply(this, arguments);
}

Player.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function(applet, busname, owner) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);
        this.showPosition = true;
        this._owner = owner;
        this._busName = busname;
        this._applet = applet;
        this._name = this._busName.split('.')[3];
        this._songLength = 0;

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_NAME,
                                              this._busName,
                                              Lang.bind(this, function(proxy, error) {
                                                  if (error) {
                                                      log(error);
                                                  } else {
                                                      this._mediaServer = proxy;
                                                      this._dbus_acquired();
                                                  }
                                              }));

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_PLAYER_NAME,
                                              this._busName,
                                              Lang.bind(this, function(proxy, error) {
                                                  if (error) {
                                                      log(error)
                                                  } else {
                                                      this._mediaServerPlayer = proxy;
                                                      this._dbus_acquired();
                                                  }
                                              }));

        Interfaces.getDBusPropertiesAsync(this._busName,
                                          MEDIA_PLAYER_2_PATH,
                                          Lang.bind(this, function(proxy, error) {
                                              if (error) {
                                                  log(error)
                                              } else {
                                                  this._prop = proxy;
                                                  this._dbus_acquired();
                                              }
                                          }));
    },

    _dbus_acquired: function() {
        if (!this._prop || !this._mediaServerPlayer || !this._mediaServer)
            return;

        let mainBox = new PopupMenu.PopupMenuSection;
        this.addMenuItem(mainBox);

        this.vertBox = new St.BoxLayout({ style_class: "sound-player", important: true, vertical: true });
        mainBox.addActor(this.vertBox, { expand: false });

        // Player info
        let playerBox = new St.BoxLayout();
        this.playerIcon = new St.Icon({icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon"});
        this.playerLabel = new St.Label({y_expand: true, y_align: Clutter.ActorAlign.CENTER});
        playerBox.add_actor(this.playerIcon, { expand: true, x_fill: false, x_align: St.Align.START });
        playerBox.add_actor(this.playerLabel, { expand: true, x_fill: false, x_align: St.Align.START });

        if (this._mediaServer.CanRaise) {
            let btn = new ControlButton("go-up", _("Open Player"), Lang.bind(this, function(){
                if (this._name === "spotify") {
                    // Spotify isn't able to raise via Dbus once its main UI is closed
                    Util.spawn(['spotify']);
                }
                else {
                    this._mediaServer.RaiseRemote();
                }
                this._applet.menu.close();
            }), true);
            playerBox.add_actor(btn.actor, { expand: true, x_fill: false, x_align: St.Align.END });
        }
        if (this._mediaServer.CanQuit) {
            let btn = new ControlButton("window-close", _("Quit Player"), Lang.bind(this, function(){
                this._mediaServer.QuitRemote();
                this._applet.menu.close();
            }), true);
            playerBox.add_actor(btn.actor, { expand: true, x_fill: false, x_align: St.Align.END });
        }

        this.vertBox.add_actor(playerBox, {expand: false, x_fill: false});

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
        this._prevButton = new ControlButton("media-skip-backward", _("Previous"), Lang.bind(this, function(){
            this._mediaServerPlayer.PreviousRemote();
        }));
        this._playButton = new ControlButton("media-playback-start", _("Play"), Lang.bind(this, function(){
            this._mediaServerPlayer.PlayPauseRemote();
        }));
        this._stopButton = new ControlButton("media-playback-stop", _("Stop"), Lang.bind(this, function(){
            this._mediaServerPlayer.StopRemote();
        }));
        this._nextButton = new ControlButton("media-skip-forward", _("Next"), Lang.bind(this, function(){
            this._mediaServerPlayer.NextRemote();
        }));
        this.trackInfo.add_actor(trackControls);
        this.controls = new St.BoxLayout();
        this.controls.add_actor(this._prevButton.getActor());
        this.controls.add_actor(this._playButton.getActor());
        this.controls.add_actor(this._stopButton.getActor());
        this.controls.add_actor(this._nextButton.getActor());
        trackControls.set_child(this.controls);
        if(this._mediaServerPlayer.LoopStatus){
            this._loopButton = new ControlButton("media-playlist-consecutive", _("Consecutive Playing"), Lang.bind(this, this._toggleLoopStatus));
            this._loopButton.actor.visible = this._applet.extendedPlayerControl;
            this.controls.add_actor(this._loopButton.getActor());

            this._setLoopStatus(this._mediaServerPlayer.LoopStatus);
        }
        if(this._mediaServerPlayer.Shuffle !== undefined){
            this._shuffleButton = new ControlButton("media-playlist-shuffle", _("No Shuffle"), Lang.bind(this, this._toggleShuffle));
            this._shuffleButton.actor.visible = this._applet.extendedPlayerControl;
            this.controls.add_actor(this._shuffleButton.getActor());

            this._setShuffle(this._mediaServerPlayer.Shuffle);
        }

        // Position slider
        this._positionSlider = new Slider.Slider(0, true);
        this._seeking = false;
        this._positionSlider.connect('drag-begin', Lang.bind(this, function(item) {
            this._seeking = true;
        }));
        this._positionSlider.connect('drag-end', Lang.bind(this, function(item) {
            this._seeking = false;
            this._setPosition("slider");
        }));
        this._positionSlider.connect('value-changed', Lang.bind(this, function(item) {
            //update the label virtually if we are seeking, else set the value (scroll event)
            if(!this._seeking)
                this._setPosition("slider");
        }));
        this.vertBox.add_actor(this._positionSlider.actor);

        this._applet._updatePlayerMenuItems();

        /* these players don't support seek */
        if (!this._getCanSeek() || this._mediaServerPlayer.Rate != 1) {
            this.showPosition = false;
            this._positionSlider.actor.hide();
        }

        this._timeoutId = 0;

        this._setStatus(this._mediaServerPlayer.PlaybackStatus);
        this._trackId = {};
        this._setMetadata(this._mediaServerPlayer.Metadata);
        this._currentTime = 0;
        this._timerTicker = 0;
        this._wantedSeekValue = 0;
        this._updatePositionSlider();

        this._mediaServerPlayerId = this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(id, sender, value) {
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
            // Seek value send by the player
            else
                this._setPosition(value);

            this._wantedSeekValue = 0;
        }));

        this._propChangedId = this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
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
        }));

        //get the desktop entry and pass it to the applet
        this._prop.GetRemote(MEDIA_PLAYER_2_NAME, "DesktopEntry", Lang.bind(this, function(value){
            this._applet.passDesktopEntry(value[0].unpack());
        }));

        this._getPosition();
    },

    _getName: function() {
        return this._name.charAt(0).toUpperCase() + this._name.slice(1);
    },


    _setName: function(status) {
        this.playerLabel.set_text(this._getName() + " - " + _(status));
    },

    _updateControls: function() {
        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'CanGoNext',
                             Lang.bind(this, function(value, err) {
                                let canGoNext = true;
                                if (!err)
                                    canGoNext = value[0].unpack();
                                this._nextButton.setEnabled(canGoNext);
                                })
                            );

        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'CanGoPrevious',
                             Lang.bind(this, function(value, err) {
                                let canGoPrevious = true;
                                if (!err)
                                    canGoPrevious = value[0].unpack();
                                this._prevButton.setEnabled(canGoPrevious);
                                })
                            );
    },

    _updatePositionSlider: function(position) {
        this._canSeek = this._getCanSeek();

        if (this._songLength == 0 || position == false)
            this._canSeek = false
    },

    _setPosition: function(value) {
        if(value === "slider"){
            let time = this._positionSlider._value * this._songLength;
            this._wantedSeekValue = Math.round(time * 1000000);
            this._mediaServerPlayer.SetPositionRemote(this._trackObj, time * 1000000);
        }
        else if (value == null && this._playerStatus != 'Stopped') {
            this._updatePositionSlider(false);
        }
        else {
            this._currentTime = value / 1000000;
            this._updateTimer();
        }
    },

    _getPosition: function() {
        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'Position', Lang.bind(this, function(position, ex) {
            if (!ex) {
                this._setPosition(position[0].get_int64());
            }
        }));
    },

    _getCanSeek: function() {
        let can_seek = true;
        this._prop.GetRemote(MEDIA_PLAYER_2_PLAYER_NAME, 'CanSeek', Lang.bind(this, function(position, ex) {
            if (!ex) {
                can_seek = position[0].get_boolean();
            }
        }));
        // Some players say they "CanSeek" but don't actually give their position over dbus (spotify for instance)
        for (let i = 0; i < players_without_seek_support.length; i++) {
            if (players_without_seek_support[i] === this._name) {
                can_seek = false;
                break;
            }
        }
        return can_seek;
    },

    _setMetadata: function(metadata) {
        if (!metadata)
            return;
        if (metadata["mpris:length"]) {
            this._stopTimer();
            if (this._playerStatus == "Playing")
                this._runTimer();
            // song length in secs
            this._songLength = metadata["mpris:length"].unpack() / 1000000;
        }
        else {
            this._songLength = 0;
            this._stopTimer();
        }
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

        if (metadata["mpris:trackid"]) {
            this._trackObj = metadata["mpris:trackid"].unpack();
        }

        let change = false;
        if (metadata["mpris:artUrl"]) {
            let artUrl = metadata["mpris:artUrl"].unpack();
            if ( this._name === "spotify" ) {
                artUrl = artUrl.replace("/thumb/", "/300/"); // Spotify 0.9.x
                artUrl = artUrl.replace("/image/", "/300/"); // Spotify 0.27.x
            }
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
                    this._hideCover();
                    let cover = Gio.file_new_for_uri(decodeURIComponent(this._trackCoverFile));
                    this._trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
                    Util.spawn_async(['wget', this._trackCoverFile, '-O', this._trackCoverFileTmp.get_path()], Lang.bind(this, this._onDownloadedCover));
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
    },

    _setStatus: function(status) {
        if (!status)
            return;
        this._updatePositionSlider();
        this._playerStatus = status;
        if (status == "Playing") {
            this._playButton.setData("media-playback-pause", _("Pause"));
            this.playerIcon.set_icon_name("media-playback-start");
            this._applet.setAppletTextIcon(this, true);
            this._runTimer();
        }
        else if (status == "Paused") {
            this._playButton.setData("media-playback-start", _("Play"));
            this.playerIcon.set_icon_name("media-playback-pause");
            this._applet.setAppletTextIcon(this, false);
            this._pauseTimer();
        }
        else if (status == "Stopped") {
            this._playButton.setData("media-playback-start", _("Play"));
            this.playerIcon.set_icon_name("media-playback-stop");
            this._applet.setAppletTextIcon(this, false);
            this._stopTimer();
        } else {
            this._applet.setAppletTextIcon(this, false);
        }

        this._setName(status);
    },

    _toggleLoopStatus: function(){
        let mapping = {
            "None": "Playlist",
            "Playlist": "Track",
            "Track": "None"
        };

        this._mediaServerPlayer.LoopStatus = mapping[this._mediaServerPlayer.LoopStatus];
        this._setLoopStatus(this._mediaServerPlayer.LoopStatus);
    },

    _setLoopStatus: function(status){
        if(status === "None")
            this._loopButton.setData("media-playlist-consecutive-symbolic", _("Consecutive Playing"));
        else if(status === "Track")
            this._loopButton.setData("media-playlist-repeat-song", _("Repeat Single"));
        else if(status === "Playlist")
            this._loopButton.setData("media-playlist-repeat", _("Repeat All"));

        this._loopButton.setActive(status !== "None");
    },

    _toggleShuffle: function(){
        this._mediaServerPlayer.Shuffle = !this._mediaServerPlayer.Shuffle;
    },

    _setShuffle: function(status){
        this._shuffleButton.setData("media-playlist-shuffle", status? _("Shuffle") : _("No Shuffle"));
        this._shuffleButton.setActive(status);
    },

    _updateTimer: function() {
        if (!this._seeking && this.showPosition && this._canSeek) {
            if (!isNaN(this._currentTime) && !isNaN(this._songLength) && this._currentTime > 0)
                this._positionSlider.setValue(this._currentTime / this._songLength);
            else
                this._positionSlider.setValue(0);
        }
    },

    _runTimerCallback: function() {
        if (this._playerStatus == 'Playing') {
            if (this._timerTicker < 10) {
                this._currentTime += 1;
                this._timerTicker++;
                this._updateTimer();
            } else {
                this._getPosition();
                this._timerTicker = 0;
            }
            return true;
        }

        return false;
    },

    _runTimer: function() {
        if (this._canSeek) {
            if (this._timeoutId != 0) {
                Mainloop.source_remove(this._timeoutId);
                this._timeoutId = 0;
            }

            if (this._playerStatus == 'Playing') {
                this._getPosition();
                this._timerTicker = 0;
                this._timeoutId = Mainloop.timeout_add(1000, Lang.bind(this, this._runTimerCallback));
            }
        }
    },

    _pauseTimer: function() {
        if (this._timeoutId != 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._updateTimer();
    },

    _stopTimer: function() {
        this._currentTime = 0;
        this._pauseTimer();
        this._updateTimer();
    },

    _onDownloadedCover: function() {
        let cover_path = this._trackCoverFileTmp.get_path();
        this._showCover(cover_path);
    },

    _hideCover: function() {
        /*Tweener.addTween(this.trackCoverContainer, { opacity: 0,
            time: 0.3,
            transition: 'easeOutCubic',
        });*/
    },

    _showCover: function(cover_path) {
        /*Tweener.addTween(this._trackCover, { opacity: 0,
            time: 0.3,
            transition: 'easeOutCubic',
            onComplete: Lang.bind(this, function() {*/
                this.coverBox.remove_actor(this.cover);
                if (! cover_path || ! GLib.file_test(cover_path, GLib.FileTest.EXISTS)) {
                    this.cover = new St.Icon({style_class: 'sound-player-generic-coverart', important: true, icon_name: "media-optical", icon_size: 300, icon_type: St.IconType.FULLCOLOR});
                    cover_path = null;
                }
                else {
                    this.cover = new Clutter.Texture({width: 300, keep_aspect_ratio: true, filter_quality: 2, filename: cover_path});
                }
                this.coverBox.add_actor(this.cover);
                this.coverBox.set_child_below_sibling(this.cover, this.trackInfo);
                this._applet.setAppletTextIcon(this, cover_path);



                /*Tweener.addTween(this._trackCover, { opacity: 255,
                    time: 0.3,
                    transition: 'easeInCubic'
                });
            })
        });*/
    },

    onSettingsChanged: function(){
        this._loopButton.actor.visible = this._applet.extendedPlayerControl;
        this._shuffleButton.actor.visible = this._applet.extendedPlayerControl;
    },

    destroy: function() {
        if (this._timeoutId != 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._mediaServerPlayer)
            this._mediaServerPlayer.disconnectSignal(this._mediaServerPlayerId);
        if (this._prop)
            this._prop.disconnectSignal(this._propChangedId);

        PopupMenu.PopupMenuSection.prototype.destroy.call(this);
    }

}

function MediaPlayerLauncher(app, menu) {
    this._init(app, menu);
}

MediaPlayerLauncher.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (app, menu) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._app = app;
        this._menu = menu;
        this.label = new St.Label({ text: app.get_name() });
        this.addActor(this.label);
        this._icon = app.create_icon_texture(ICON_SIZE);
        this.addActor(this._icon, { expand: false });
        this.connect("activate", Lang.bind(this, this._onActivate));
    },

    _onActivate: function(actor, event, keepMenu) {
        this._app.activate_full(-1, event.get_time());
    }
};

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.metadata = metadata;
            this.orientation = orientation;
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            this.settings.bind("showtrack", "showtrack", this.on_settings_changed);
            this.settings.bind("middleClickAction", "middleClickAction");
            this.settings.bind("showalbum", "showalbum", this.on_settings_changed);
            this.settings.bind("truncatetext", "truncatetext", this.on_settings_changed);
            this.settings.bind("hideSystray", "hideSystray", function() {
                if (this.hideSystray) this.registerSystrayIcons();
                else this.unregisterSystrayIcons();
            });

            this.settings.bind("playerControl", "playerControl", this.on_settings_changed);
            this.settings.bind("extendedPlayerControl", "extendedPlayerControl", function(){
                for(let i in this._players)
                    this._players[i].onSettingsChanged();
            });

            this.settings.bind("_knownPlayers", "_knownPlayers");
            if (this.hideSystray) this.registerSystrayIcons();

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.set_applet_icon_symbolic_name('audio-x-generic');

            this._players = {};
            this._playerItems = [];
            this._activePlayer = null;

            Interfaces.getDBusAsync(Lang.bind(this, function (proxy, error) {
                this._dbus = proxy;

                // player DBus name pattern
                let name_regex = /^org\.mpris\.MediaPlayer2\./;
                // load players
                this._dbus.ListNamesRemote(Lang.bind(this,
                    function(names) {
                        for (let n in names[0]) {
                            let name = names[0][n];
                            if (name_regex.test(name)) {
                                this._dbus.GetNameOwnerRemote(name, Lang.bind(this,
                                    function(owner) {
                                        this._addPlayer(name, owner);
                                    }
                                ));
                            }
                        }
                    }
                ));

                // watch players
                this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged', Lang.bind(this,
                    function(proxy, sender, [name, old_owner, new_owner]) {
                        if (name_regex.test(name)) {
                            if (new_owner && !old_owner)
                                this._addPlayer(name, new_owner);
                            else if (old_owner && !new_owner)
                                this._removePlayer(name, old_owner);
                            else
                                this._changePlayerOwner(name, old_owner, new_owner);
                        }
                    }
                ));
            }));

            this._control = new Cvc.MixerControl({ name: 'Cinnamon Volume Control' });
            this._control.connect('state-changed', Lang.bind(this, this._onControlStateChanged));

            this._control.connect('output-added', Lang.bind(this, this._onDeviceAdded, "output"));
            this._control.connect('output-removed', Lang.bind(this, this._onDeviceRemoved, "output"));
            this._control.connect('active-output-update', Lang.bind(this, this._onDeviceUpdate, "output"));

            this._control.connect('input-added', Lang.bind(this, this._onDeviceAdded, "input"));
            this._control.connect('input-removed', Lang.bind(this, this._onDeviceRemoved, "input"));
            this._control.connect('active-input-update', Lang.bind(this, this._onDeviceUpdate, "input"));

            this._control.connect('stream-added', Lang.bind(this, this._onStreamAdded));
            this._control.connect('stream-removed', Lang.bind(this, this._onStreamRemoved));

            this._volumeMax = 1*this._control.get_vol_max_norm(); // previously was 1.5*this._control.get_vol_max_norm();, but we'd need a little mark on the slider to make it obvious to the user we're going over 100%..
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

            this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

            this.mute_out_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-volume-muted", St.IconType.SYMBOLIC);
            this.mute_in_switch = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "microphone-sensitivity-none", St.IconType.SYMBOLIC);
            this._applet_context_menu.addMenuItem(this.mute_out_switch);
            this._applet_context_menu.addMenuItem(this.mute_in_switch);

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);

            this._outputApplicationsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Applications"));
            this._selectOutputDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Output device"));
            this._applet_context_menu.addMenuItem(this._outputApplicationsMenu);
            this._applet_context_menu.addMenuItem(this._selectOutputDeviceItem);
            this._outputApplicationsMenu.actor.hide();
            this._selectOutputDeviceItem.actor.hide();

            this._inputSection = new PopupMenu.PopupMenuSection;
            this._inputVolumeSection = new VolumeSlider(this, null, _("Microphone"), null);
            this._inputVolumeSection.connect("values-changed", Lang.bind(this, this._inputValuesChanged));
            this._selectInputDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Input device"));
            this._inputSection.addMenuItem(this._inputVolumeSection);
            this._inputSection.addMenuItem(this._selectInputDeviceItem);
            this._applet_context_menu.addMenuItem(this._inputSection);

            this._selectInputDeviceItem.actor.hide();
            this._inputSection.actor.hide();

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);

            this.mute_out_switch.connect('toggled', Lang.bind(this, this._toggle_out_mute));
            this.mute_in_switch.connect('toggled', Lang.bind(this, this._toggle_in_mute));

            this._control.open();

            this._volumeControlShown = false;

            this._showFixedElements();
            this.updateLabelVisible();

            let appsys = Cinnamon.AppSystem.get_default();
            appsys.connect("installed-changed", Lang.bind(this, this._updateLaunchPlayer));
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_settings_changed : function() {
        if(this.playerControl && this._activePlayer)
            this.setAppletTextIcon(this._players[this._activePlayer], true);
        else
            this.setAppletTextIcon();

        this._changeActivePlayer(this._activePlayer);
    },

    on_applet_removed_from_panel : function() {
        if (this.hideSystray)
            this.unregisterSystrayIcons();
        if (this._iconTimeoutId) {
            Mainloop.source_remove(this._iconTimeoutId);
        }

        this._dbus.disconnectSignal(this._ownerChangedId);

        for(let i in this._players)
            this._players[i].destroy();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _toggle_out_mute: function() {
        if (this._output.is_muted) {
            this._output.change_is_muted(false);
            this.mute_out_switch.setToggleState(false);
        } else {
            this._output.change_is_muted(true);
            this.mute_out_switch.setToggleState(true);
        }
    },

    _toggle_in_mute: function() {
        if (this._input.is_muted) {
            this._input.change_is_muted(false);
            this.mute_in_switch.setToggleState(false);
        } else {
            this._input.change_is_muted(true);
            this.mute_in_switch.setToggleState(true);
        }
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
            this._output.push_volume();
            this._output.change_is_muted(false);
        }

        this._notifyVolumeChange(this._output);
    },

    _onButtonPressEvent: function (actor, event) {
        let buttonId = event.get_button();

        //mute or play / pause players on middle click
        if (buttonId === 2) {
            if (this.middleClickAction === "mute")
                this._toggle_out_mute();
            else if (this.middleClickAction === "player")
                this._players[this._activePlayer]._mediaServerPlayer.PlayPauseRemote();
        } else if (buttonId === 8) { // previous and next track on mouse buttons 4 and 5 (8 and 9 by X11 numbering)
            this._players[this._activePlayer]._mediaServerPlayer.PreviousRemote();
        } else if (buttonId === 9) {
            this._players[this._activePlayer]._mediaServerPlayer.NextRemote();
        }

        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    },

    setIcon: function(icon, source) {
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
                this._iconTimeoutId = Mainloop.timeout_add(3000, Lang.bind(this, function() {
                    this._iconTimeoutId = null;

                    this.setIcon();
                }));
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
    },

    setAppletIcon: function(player, path) {
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
    },

    updateLabelVisible: function() {
        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    },

    setAppletText: function(player) {
        let title_text = "";
        if (this.showtrack && player && player._playerStatus == 'Playing') {
            title_text = player._title + ' - ' + player._artist;
            if (this.truncatetext < title_text.length) {
                title_text = title_text.substr(0, this.truncatetext) + "...";
            }
        }
        this.set_applet_label(title_text);
        this.updateLabelVisible();
    },

    setAppletTextIcon: function(player, icon) {
        if (player && player._owner != this._activePlayer)
            return;
        this.setAppletIcon(player, icon);
        this.setAppletText(player);
    },

    _isInstance: function(busName) {
        // MPRIS instances are in the form
        //   org.mpris.MediaPlayer2.name.instanceXXXX
        // ...except for VLC, which to this day uses
        //   org.mpris.MediaPlayer2.name-XXXX
        return busName.split('.').length > 4 ||
                /^org\.mpris\.MediaPlayer2\.vlc-\d+$/.test(busName);
    },

    _addPlayer: function(busName, owner) {
        let position;
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

            // Add the player to the list of active players in GUI
            let item = new PopupMenu.PopupMenuItem(player._getName());
            item.activate = Lang.bind(this, function() { this._switchPlayer(player._owner); });
            this._chooseActivePlayerItem.menu.addMenuItem(item);

            this._players[owner] = player;
            this._playerItems.push({ player: player, item: item });

            this._changeActivePlayer(owner);
            this._updatePlayerMenuItems();
            this.setAppletTextIcon();
        }
    },

    _switchPlayer: function(owner) {
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
    },

    _removePlayerItem: function(owner) {
        // Remove the player from the player switching list
        for(let i = 0, l = this._playerItems.length; i < l; ++i) {
            let playerItem = this._playerItems[i];
            if(playerItem.player._owner === owner) {
                playerItem.item.destroy();
                this._playerItems.splice(i, 1);
                break;
            }
        }
    },

    _removePlayer: function(busName, owner) {
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
    },

    _changePlayerOwner: function(busName, oldOwner, newOwner) {
        if (this._players[oldOwner] && busName == this._players[oldOwner]._busName) {
            this._players[newOwner] = this._players[oldOwner];
            this._players[newOwner]._owner = newOwner;
            delete this._players[oldOwner];
            if (this._activePlayer == oldOwner)
                this._activePlayer = newOwner;
        }
    },

    //will be called by an instance of #Player
    passDesktopEntry: function(entry){
        //do we know already this player?
        for (let i = 0, l = this._knownPlayers.length; i < l; ++i) {
            if (this._knownPlayers[i] === entry)
                return
        }
        //No, save it to _knownPlayers and update player list
        this._knownPlayers.push(entry);
        this._knownPlayers.save();
        this._updateLaunchPlayer();
    },

    _showFixedElements: function() {
        // The list to use when switching between active players
        this._chooseActivePlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Choose player controls"));
        this._chooseActivePlayerItem.actor.hide();
        this.menu.addMenuItem(this._chooseActivePlayerItem);

        // The launch player list
        this._launchPlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Launch player"));
        this.menu.addMenuItem(this._launchPlayerItem);
        this._updateLaunchPlayer();

        //between these two separators will be the player MenuSection (position 3)
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
        this._outputVolumeSection = new VolumeSlider(this, null, _("Volume"), null);
        this._outputVolumeSection.connect("values-changed", Lang.bind(this, this._outputValuesChanged));

        this.menu.addMenuItem(this._outputVolumeSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);

        this.menu.addSettingsAction(_("Sound Settings"), 'sound');
    },

    _updateLaunchPlayer: function() {
        let availablePlayers = [];

        let appsys = Cinnamon.AppSystem.get_default();
        //_knownPlayers is an array containing the paths of desktop files
        for(let i = 0, l = this._knownPlayers.length; i < l; ++i){
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
        } else {
            this._launchPlayerItem.actor.hide();
        }
    },

    _updatePlayerMenuItems: function() {
        if (this.playerControl && this._activePlayer) {
            this._launchPlayerItem.actor.hide();
            this._chooseActivePlayerItem.actor.show();

            // Show a dot on the active player in the switching menu
            for (let i = 0, l = this._playerItems.length; i < l; ++i) {
                let playerItem = this._playerItems[i];
                playerItem.item.setShowDot(playerItem.player._owner === this._activePlayer);
            }

            // Hide the switching menu if we only have at most one active player
            if(this._chooseActivePlayerItem.menu.numMenuItems <= 1) {
                this._chooseActivePlayerItem.actor.hide();
            }
        } else {
            if (this._launchPlayerItem.menu.numMenuItems) {
                this._launchPlayerItem.actor.show();
            } else {
                this._launchPlayerItem.actor.hide();
            }
        }
    },

    _changeActivePlayer: function(player) {
        if (this._activePlayer)
            this.menu.box.remove_actor(this._players[this._activePlayer].actor);

        this._activePlayer = player;
        if (this.playerControl)
            this.menu.addMenuItem(this._players[player], 1);
        this._updatePlayerMenuItems();
    },

    _notifyVolumeChange: function(stream) {
        Main.soundManager.playVolume('volume', stream.decibel);
    },

    _mutedChanged: function(object, param_spec, property) {
        if (property == "_output") {
            this.mute_out_switch.setToggleState(this._output.is_muted);
        } else if (property == "_input") {
            this.mute_in_switch.setToggleState(this._input.is_muted);
        }
    },

    _outputValuesChanged: function(actor, iconName, percentage) {
        this.setIcon(iconName, "output");
        this.mute_out_switch.setIconSymbolicName(iconName);
        this.set_applet_tooltip(_("Volume") + ": " + percentage);
    },

    _inputValuesChanged: function(actor, iconName) {
        this.mute_in_switch.setIconSymbolicName(iconName);
    },

    _onControlStateChanged: function() {
        if (this._control.get_state() == Cvc.MixerControlState.READY) {
            this._readOutput();
            this._readInput();
            this.actor.show();
        } else {
            this.actor.hide();
        }
    },

    _readOutput: function() {
        if (this._outputMutedId) {
            this._output.disconnect(this._outputMutedId);
            this._outputMutedId = 0;
        }
        this._output = this._control.get_default_sink();
        if (this._output) {
            this._outputVolumeSection.connectWithStream(this._output);
            this._outputMutedId = this._output.connect('notify::is-muted', Lang.bind(this, this._mutedChanged, '_output'));
            this._mutedChanged (null, null, '_output');
        } else {
            this.setIcon("audio-volume-muted-symbolic", "output");
        }
    },

    _readInput: function() {
        if (this._inputMutedId) {
            this._input.disconnect(this._inputMutedId);
            this._inputMutedId = 0;
        }
        this._input = this._control.get_default_source();
        if (this._input) {
            this._inputVolumeSection.connectWithStream(this._input);
            this._inputMutedId = this._input.connect('notify::is-muted', Lang.bind(this, this._mutedChanged, '_input'));
            this._mutedChanged (null, null, '_input');
        } else {
            this._inputSection.actor.hide();
        }
    },

    _onDeviceAdded: function(control, id, type){
        let device = this._control["lookup_" + type + "_id"](id);

        let item = new PopupMenu.PopupMenuItem(device.description);
        item.activate = Lang.bind(this, function(){
            this._control["change_" + type](device);
        });

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
    },

    _onDeviceRemoved: function(control, id, type){
        for (let i = 0, l = this._devices.length; i < l; ++i){
            if (this._devices[i].type === type && this._devices[i].id === id) {
                let device = this._devices[i];
                if (device.item)
                    device.item.destroy();

                //hide submenu if showing them is unnecessary
                let selectItem = this["_select" + type[0].toUpperCase() + type.slice(1) + "DeviceItem"];
                if(selectItem.menu.numMenuItems <= 1)
                        selectItem.actor.hide();

                this._devices.splice(i, 1);
                break;
            }
        }
    },

    _onDeviceUpdate: function(control, id, type){
        this["_read" + type[0].toUpperCase() + type.slice(1)]();

        for (let i = 0, l = this._devices.length; i < l; ++i) {
            if (this._devices[i].type === type)
                this._devices[i].item.setShowDot(id === this._devices[i].id);
        }
    },

    _onStreamAdded: function(control, id){
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
    },

    _onStreamRemoved: function(control, id){
        for (let i = 0, l = this._streams.length; i < l; ++i) {
            if(this._streams[i].id === id){
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
    },

    registerSystrayIcons: function() {
        for (let i = 0; i < players_with_seek_support.length; i++) {
            Main.systrayManager.registerRole(players_with_seek_support[i], this.metadata.uuid);
        }
        for (let i = 0; i < players_without_seek_support.length; i++) {
            Main.systrayManager.registerRole(players_without_seek_support[i], this.metadata.uuid);
        }
    },

    unregisterSystrayIcons: function() {
        Main.systrayManager.unregisterId(this.metadata.uuid);
    },

    on_orientation_changed: function(orientation) {
        this.orientation = orientation;
        this.updateLabelVisible();
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
