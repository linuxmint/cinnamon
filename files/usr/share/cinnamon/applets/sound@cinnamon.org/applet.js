const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const DBus = imports.dbus;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gvc = imports.gi.Gvc;
const Pango = imports.gi.Pango;
const Tooltips = imports.ui.tooltips;

const PropIFace = {
    name: 'org.freedesktop.DBus.Properties',
    signals: [{ name: 'PropertiesChanged',
                inSignature: 'a{sv}'}]
};

const MediaServer2IFace = {
    name: 'org.mpris.MediaPlayer2',
    methods: [{ name: 'Raise',
                inSignature: '',
                outSignature: '' },
              { name: 'Quit',
                inSignature: '',
                outSignature: '' }],
    properties: [{ name: 'CanRaise',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanQuit',
                   signature: 'b',
                   access: 'read'}],
};

const MediaServer2PlayerIFace = {
    name: 'org.mpris.MediaPlayer2.Player',
    methods: [{ name: 'PlayPause',
                inSignature: '',
                outSignature: '' },
              { name: 'Pause',
                inSignature: '',
                outSignature: '' },
              { name: 'Play',
                inSignature: '',
                outSignature: '' },
              { name: 'Stop',
                inSignature: '',
                outSignature: '' },
              { name: 'Next',
                inSignature: '',
                outSignature: '' },
              { name: 'Previous',
                inSignature: '',
                outSignature: '' },
              { name: 'SetPosition',
                inSignature: 'ox',
                outSignature: '' }],
    properties: [{ name: 'Metadata',
                   signature: 'a{sv}',
                   access: 'read'},
                 { name: 'Shuffle',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'Rate',
                   signature: 'd',
                   access: 'readwrite'},
                 { name: 'LoopStatus',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'Volume',
                   signature: 'd',
                   access: 'readwrite'},
                 { name: 'PlaybackStatus',
                   signature: 's',
                   access: 'read'},
                 { name: 'Position',
                   signature: 'x',
                   access: 'read'},
                 { name: 'CanGoNext',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanGoPrevious',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPlay',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPause',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanSeek',
                   signature: 'b',
                   access: 'read'}],
    signals: [{ name: 'Seeked',
                inSignature: 'x' }]
};

/* global values */
let icon_path = "/usr/share/cinnamon/theme/";
let compatible_players = [ "clementine", "mpd", "exaile", "banshee", "rhythmbox", "rhythmbox3", "pragha", "quodlibet", "guayadeque", "amarok", "googlemusicframe", "xbmc", "noise", "xnoise", "gmusicbrowser", "spotify", "audacious", "vlc", "beatbox", "songbird", "pithos", "gnome-mplayer", "nuvolaplayer", "qmmp" ];
let support_seek = [ "clementine", "banshee", "rhythmbox", "rhythmbox3", "pragha", "quodlibet", "amarok", "noise", "xnoise", "gmusicbrowser", "spotify", "vlc", "beatbox", "gnome-mplayer", "qmmp" ];
/* dummy vars for translation */
let x = _("Playing");
x = _("Paused");
x = _("Stopped");

const VOLUME_NOTIFY_ID = 1;
const VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */

const ICON_SIZE = 28;


function Prop() {
    this._init.apply(this, arguments);
}

Prop.prototype = {
    _init: function(owner) {
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    }
}
DBus.proxifyPrototype(Prop.prototype, PropIFace)

function MediaServer2() {
    this._init.apply(this, arguments);
}

MediaServer2.prototype = {
    _init: function(owner) {
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    },
    getRaise: function(callback) {
        this.GetRemote('CanRaise', Lang.bind(this,
            function(raise, ex) {
                if (!ex)
                    callback(this, raise);
            }));
    },
    getQuit: function(callback) {
        this.GetRemote('CanQuit', Lang.bind(this,
            function(quit, ex) {
                if (!ex)
                    callback(this, quit);
            }));
    }
}
DBus.proxifyPrototype(MediaServer2.prototype, MediaServer2IFace)

function MediaServer2Player() {
    this._init.apply(this, arguments);
}

MediaServer2Player.prototype = {
    _init: function(owner) {
        this._owner = owner;
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    },
    getMetadata: function(callback) {
        this.GetRemote('Metadata', Lang.bind(this,
            function(metadata, ex) {
                if (!ex)
                    callback(this, metadata);
            }));
    },
    getPlaybackStatus: function(callback) {
        this.GetRemote('PlaybackStatus', Lang.bind(this,
            function(status, ex) {
                if (!ex)
                    callback(this, status);
            }));
    },
    getRate: function(callback) {
        this.GetRemote('Rate', Lang.bind(this,
            function(rate, ex) {
                if (!ex)
                    callback(this, rate);
            }));
    },
    getPosition: function(callback) {
        this.GetRemote('Position', Lang.bind(this,
            function(position, ex) {
                if (!ex)
                    callback(this, position);
            }));
    },
    setPosition: function(value) {
        this.SetRemote('Position', value);
    },
    getShuffle: function(callback) {
        this.GetRemote('Shuffle', Lang.bind(this,
            function(shuffle, ex) {
                if (!ex)
                    callback(this, shuffle);
            }));
    },
    setShuffle: function(value) {
        this.SetRemote('Shuffle', value);
    },
    getVolume: function(callback) {
        this.GetRemote('Volume', Lang.bind(this,
            function(volume, ex) {
                if (!ex)
                    callback(this, volume);
            }));
    },
    setVolume: function(value) {
        this.SetRemote('Volume', parseFloat(value));
    },
    getRepeat: function(callback) {
        this.GetRemote('LoopStatus', Lang.bind(this,
            function(repeat, ex) {
                if (!ex) {
                    if (repeat == "None")
                        repeat = false
                    else
                        repeat = true
                    callback(this, repeat);
                }
            }));
    },
    setRepeat: function(value) {
        if (value)
            value = "Playlist"
        else
            value = "None"
        this.SetRemote('LoopStatus', value);
    },
    getCanSeek: function(callback) {
        this.GetRemote('CanSeek', Lang.bind(this,
            function(canSeek, err) {
                if (!err) {
                    callback(this, canSeek);
                }
            }));
    }
}
DBus.proxifyPrototype(MediaServer2Player.prototype, MediaServer2PlayerIFace)

function TrackInfo() {
    this._init.apply(this, arguments);
}

TrackInfo.prototype = {
    _init: function(label, icon) {
        this.actor = new St.BoxLayout({style_class: 'sound-track-info'});
        this.label = new St.Label({text: label.toString()});
        this.icon = new St.Icon({icon_name: icon.toString()});
        this.actor.add_actor(this.icon);
        this.actor.add_actor(this.label);
    },
    getActor: function() {
        return this.actor;
    },
    setLabel: function(label) {
        this.label.text = label;
    },
    getLabel: function() {
        return this.label.text.toString();
    },
    hide: function() {
        this.actor.hide();
    },
    show: function() {
        this.actor.show();
    },
};

function ControlButton() {
    this._init.apply(this, arguments);
}

ControlButton.prototype = {
    _init: function(icon, callback) {
        this.actor = new St.Bin({style_class: 'sound-button-container'});
        this.button = new St.Button({ style_class: 'sound-button' });
        this.button.connect('clicked', callback);
        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            icon_size: 16,
            style_class: 'sound-button-icon',
        });
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);        
    },
    getActor: function() {
        return this.actor;
    },
    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },
}

function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, image, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout({style_class: style});
        this.actor.add_style_pseudo_class('active');
        if (icon) {
            this.icon = new St.Icon({icon_name: icon});
        }
        if (image) {
            this.icon = new St.Bin();
            this.icon.set_child(this._getIconImage(image));
        }
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },

    setText: function(text) {
        this.text.text = text;
    },

    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },

    setImage: function(image) {
        this.icon.set_child(this._getIconImage(image));
    },

    // retrieve an icon image
    _getIconImage: function(icon_name) {
         let icon_file = icon_path + icon_name + ".svg";
         let file = Gio.file_new_for_path(icon_file);
         let icon_uri = file.get_uri();

         return St.TextureCache.get_default().load_uri_async(icon_uri, 16, 16);
    },
}

function Player() {
    this._init.apply(this, arguments);
}

Player.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function(system_status_button, owner) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this.showPosition = true; // @todo: Get from settings
        this._owner = owner;
        this._system_status_button = system_status_button;
        this._name = this._owner.split('.')[3];
        this._mediaServerPlayer = new MediaServer2Player(owner);
        this._mediaServer = new MediaServer2(owner);
        this._prop = new Prop(owner);

        this._playerInfo = new TextImageMenuItem(this._getName(), false, "player-stopped", "left", "popup-menu-item");
        this.addMenuItem(this._playerInfo);

        this._trackCoverFile = this._trackCoverFileTmp = false;
        this._trackCover = new St.Bin({style_class: 'sound-track-cover', x_align: St.Align.START});
        this._trackCover.set_child(new St.Icon({icon_name: "media-optical-cd-audio", icon_size: 220, icon_type: St.IconType.FULLCOLOR}));
        this._trackInfosTop = new St.Bin({style_class: 'sound-track-infos', x_align: St.Align.START});
        this._trackInfosBottom = new St.Bin({style_class: 'sound-track-infos', x_align: St.Align.START});
        this._trackControls = new St.Bin({style_class: 'sound-playback-control', x_align: St.Align.MIDDLE});

        let mainBox = new St.BoxLayout({style_class: 'sound-track-box', vertical: true});
        mainBox.add_actor(this._trackInfosTop)
        mainBox.add_actor(this._trackCover);
        mainBox.add_actor(this._trackInfosBottom);

        this.addActor(mainBox);

        this.infos_top = new St.BoxLayout({vertical: true});
        this.infos_bottom = new St.BoxLayout({vertical: true});
        this._artist = new TrackInfo(_("Unknown Artist"), "system-users");
        this._album = new TrackInfo(_("Unknown Album"), "media-optical");
        this._title = new TrackInfo(_("Unknown Title"), "audio-x-generic");
        this._time = new TrackInfo("0:00 / 0:00", "document-open-recent");
        this.infos_top.add_actor(this._artist.getActor());
        this.infos_bottom.add_actor(this._album.getActor());
        this.infos_top.add_actor(this._title.getActor());

        this._trackInfosTop.set_child(this.infos_top);
        this._trackInfosBottom.set_child(this.infos_bottom);

        this._prevButton = new ControlButton('media-skip-backward',
            Lang.bind(this, function () { this._mediaServerPlayer.PreviousRemote(); }));
        this._prevButtonTooltip = new Tooltips.Tooltip(this._prevButton.button, _("Previous"));
        this._playButton = new ControlButton('media-playback-start',
            Lang.bind(this, function () { this._mediaServerPlayer.PlayPauseRemote(); }));
        this._playButtonTooltip = new Tooltips.Tooltip(this._playButton.button, _("Play"));
        this._stopButton = new ControlButton('media-playback-stop',
            Lang.bind(this, function () { this._mediaServerPlayer.StopRemote(); }));
        this._stopButtonTooltip = new Tooltips.Tooltip(this._stopButton.button, _("Stop"));
        this._nextButton = new ControlButton('media-skip-forward',
            Lang.bind(this, function () { this._mediaServerPlayer.NextRemote(); }));
        this._nextButtonTooltip = new Tooltips.Tooltip(this._nextButton.button, _("Next"));

        this.controls = new St.BoxLayout();
        this.controls.add_actor(this._prevButton.getActor());
        this.controls.add_actor(this._playButton.getActor());
        this.controls.add_actor(this._stopButton.getActor());
        this.controls.add_actor(this._nextButton.getActor());
        this._trackControls.set_child(this.controls);
        this.addActor(this._trackControls);

        this._seekControls = new St.Bin({style_class: 'sound-seek', x_align: St.Align.START});
        this.seekControls = new St.BoxLayout({style_class: 'sound-seek-box'});
        this.seekControls.add_actor(this._time.getActor());

        this._positionSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._positionSlider.connect('value-changed', Lang.bind(this, function(item) {
            let time = item._value * this._songLength;
            this._time.setLabel(this._formatTime(time) + " / " + this._formatTime(this._songLength));
        }));
        this._positionSlider.connect('drag-end', Lang.bind(this, function(item) {
            let time = item._value * this._songLength;
            this._time.setLabel(this._formatTime(time) + " / " + this._formatTime(this._songLength));
            this._wantedSeekValue = Math.round(time * 1000000);
            this._mediaServerPlayer.SetPositionRemote(this._trackObj, time * 1000000);
        }));

        this.sliderBin = new St.Bin({style_class: 'sound-seek-slider'});
        this.sliderBin.set_child(this._positionSlider.actor);
        this.seekControls.add_actor(this.sliderBin);
        this._seekControls.set_child(this.seekControls);
        this.addActor(this._seekControls);

        this._mediaServer.getRaise(Lang.bind(this, function(sender, raise) {
            if (raise) {
                this._raiseButton = new ControlButton('go-up',
                    Lang.bind(this, function () { this._mediaServer.RaiseRemote(); this._system_status_button.menu.actor.hide(); }));
                this._raiseButtonTooltip = new Tooltips.Tooltip(this._raiseButton.button, _("Open Player"));
                this.controls.add_actor(this._raiseButton.getActor());
            }
        }));

        this._mediaServer.getQuit(Lang.bind(this, function(sender, quit) {
            if (quit) {
                this._quitButton = new ControlButton('window-close',
                    Lang.bind(this, function () { this._mediaServer.QuitRemote(); }));
                this.controls.add_actor(this._quitButton.getActor());
                this._quitButtonTooltip = new Tooltips.Tooltip(this._quitButton.button, _("Quit Player"));
            }
        }));

        /* this players don't support seek */
        if (support_seek.indexOf(this._name) == -1) {
            this._time.hide();
            this.showPosition = false;
            this._positionSlider.actor.hide();
        }
        this._getStatus();
        this._trackId = {};
        this._getMetadata();
        this._currentTime = 0;
        this._getPosition();
        this._wantedSeekValue = 0;
        this._updatePositionSlider();

        this._prop.connect('PropertiesChanged', Lang.bind(this, function(sender, iface, value) {
            if (value["PlaybackStatus"])
                this._setStatus(iface, value["PlaybackStatus"]);
            if (value["Metadata"])
                this._setMetadata(iface, value["Metadata"]);
            //qmmp
            if(sender._dbusBusName == 'org.mpris.MediaPlayer2.qmmp') {
                if (value["playbackStatus"])
                    this._setStatus(iface, value["playbackStatus"]);
                if (value["metadata"])
                    this._setMetadata(sender, value["metadata"]);
            } 
        }));

        this._mediaServerPlayer.connect('Seeked', Lang.bind(this, function(sender, value) {
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

        Mainloop.timeout_add(1000, Lang.bind(this, this._getPosition));
    },

    _getName: function() {
        return this._name.charAt(0).toUpperCase() + this._name.slice(1);
    },


    _setName: function(status) {
        this._playerInfo.setText(this._getName() + " - " + _(status));
    },

    _updatePositionSlider: function(position) {
        this._mediaServerPlayer.getCanSeek(Lang.bind(this, function(sender, canSeek) {
            this._canSeek = canSeek;
            
            if (this._songLength == 0 || position == false)
                this._canSeek = false

            // Clem: The following code was commented out. When the next song started, it resulted in hiding the sound menu, making it hard for the user to repeatedly click on the next song button.
            // There's probably a better fix and this was not tested with players which don't support seeking, but it fixes the regression created by the slider (apparently when the slider is hidden it closes the menu)
            // if (this._playerStatus == "Playing" && this._canSeek && this.showPosition)
            //     this._positionSlider.actor.show();
            // else
            //     this._positionSlider.actor.hide();
        }));
    },

    _setPosition: function(value) {
        if (value == null && this._playerStatus != 'Stopped') {
            this._updatePositionSlider(false);
        }
        else {
            this._currentTime = value / 1000000;
            this._updateTimer();
        }
    },

    _getPosition: function() {
        this._mediaServerPlayer.getPosition(Lang.bind(this, function(sender, value) {
            this._setPosition(value);
        }));
    },

    _setMetadata: function(sender, metadata) {
        if (metadata["mpris:length"]) {
            // song length in secs
            this._songLength = metadata["mpris:length"] / 1000000;
            // FIXME upstream
            if (this._name == "quodlibet")
                this._songLength = metadata["mpris:length"] / 1000;
            // reset timer
            this._stopTimer();
            if (this._playerStatus == "Playing")
                this._runTimer();
        }
        else {
            this._songLength = 0;
            this._stopTimer();
        }
        if (metadata["xesam:artist"])
            this._artist.setLabel(metadata["xesam:artist"].toString());
        else
            this._artist.setLabel(_("Unknown Artist"));
        if (metadata["xesam:album"])
            this._album.setLabel(metadata["xesam:album"].toString());
        else
            this._album.setLabel(_("Unknown Album"));
        if (metadata["xesam:title"])
            this._title.setLabel(metadata["xesam:title"].toString());
        else
            this._title.setLabel(_("Unknown Title"));
        
        if (metadata["mpris:trackid"]) {
            this._trackObj = metadata["mpris:trackid"];
        }

        let change = false;
        if (metadata["mpris:artUrl"]) {
            if (this._trackCoverFile != metadata["mpris:artUrl"].toString()) {
                this._trackCoverFile = metadata["mpris:artUrl"].toString();
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
                    if (!this._trackCoverFileTmp)
                        this._trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
                    cover.read_async(null, null, Lang.bind(this, this._onReadCover));
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
    },

    _getMetadata: function() {
        this._mediaServerPlayer.getMetadata(Lang.bind(this,
            this._setMetadata
        ));
    },

    _setStatus: function(sender, status) {
        this._updatePositionSlider();
        this._playerStatus = status;
        if (status == "Playing") {
            this._playButton.setIcon("media-playback-pause");
            this._runTimer();
        }
        else if (status == "Paused") {
            this._playButton.setIcon("media-playback-start");
            this._pauseTimer();
        }
        else if (status == "Stopped") {
            this._playButton.setIcon("media-playback-start");
            this._stopTimer();
        }

        this._playerInfo.setImage("player-" + status.toLowerCase());
        this._setName(status);
    },

    _getStatus: function() {
        this._mediaServerPlayer.getPlaybackStatus(Lang.bind(this,
            this._setStatus
        ));
    },

    _updateRate: function() {
        this._mediaServerPlayer.getRate(Lang.bind(this, function(sender, rate) {
            this._rate = rate;
        }));
    },

    _updateTimer: function() {
        if (this.showPosition && this._canSeek) {
            if (!isNaN(this._currentTime) && !isNaN(this._songLength) && this._currentTime > 0)
                this._positionSlider.setValue(this._currentTime / this._songLength);
            else
                this._positionSlider.setValue(0);
        }
        this._time.setLabel(this._formatTime(this._currentTime) + " / " + this._formatTime(this._songLength));
    },

    _runTimer: function() {
        if (this._playerStatus == 'Playing') {
            this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._runTimer));
            this._currentTime += 1;
            this._updateTimer();
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

    _formatTime: function(s) {
        let ms = s * 1000;
        let msSecs = (1000);
        let msMins = (msSecs * 60);
        let msHours = (msMins * 60);
        let numHours = Math.floor(ms/msHours);
        let numMins = Math.floor((ms - (numHours * msHours)) / msMins);
        let numSecs = Math.floor((ms - (numHours * msHours) - (numMins * msMins))/ msSecs);
        if (numSecs < 10)
            numSecs = "0" + numSecs.toString();
        if (numMins < 10 && numHours > 0)
            numMins = "0" + numMins.toString();
        if (numHours > 0)
            numHours = numHours.toString() + ":";
        else
            numHours = "";
        return numHours + numMins.toString() + ":" + numSecs.toString();
    },

    _onReadCover: function(cover, result) {
        let inStream = cover.read_finish(result);
        let outStream = this._trackCoverFileTmp.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null, null);
        outStream.splice_async(inStream, Gio.OutputStreamSpliceFlags.CLOSE_TARGET, 0, null, Lang.bind(this, this._onSavedCover));
    },

    _onSavedCover: function(outStream, result) {
        outStream.splice_finish(result, null);
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
                if (! cover_path || ! GLib.file_test(cover_path, GLib.FileTest.EXISTS)) {
                    this._trackCover.set_child(new St.Icon({icon_name: "media-optical-cd-audio", icon_size: 210, icon_type: St.IconType.FULLCOLOR}));
                }
                else {
                    let l = new Clutter.BinLayout();
                    let b = new Clutter.Box();
                    let c = new Clutter.Texture({height: 210, keep_aspect_ratio: true, filter_quality: 2, filename: cover_path});
                    b.set_layout_manager(l);
                    b.set_width(230);
                    b.add_actor(c);
                    this._trackCover.set_child(b);
                }
                /*Tweener.addTween(this._trackCover, { opacity: 255,
                    time: 0.3,
                    transition: 'easeInCubic'
                });
            })
        });*/
    },

    setIcon: function(icon) {
       if (this._system_status_button._nbPlayers()==0)
         this._system_status_button.setIcon(icon);
       else
         this._system_status_button.setIcon('audio-x-generic');
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
    },

    activate: function (event) {
    	this._menu.actor.hide();
        this._app.activate_full(-1, event.get_time());
        return true;
    }

};

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.set_applet_icon_symbolic_name('audio-x-generic');

            // menu not showed by default
            this._players = {};
            // watch players
            for (var p=0; p<compatible_players.length; p++) {
                DBus.session.watch_name('org.mpris.MediaPlayer2.'+compatible_players[p], false,
                    Lang.bind(this, this._addPlayer),
                    Lang.bind(this, this._removePlayer)
                );
            }

            this._control = new Gvc.MixerControl({ name: 'Cinnamon Volume Control' });
            this._control.connect('state-changed', Lang.bind(this, this._onControlStateChanged));
            this._control.connect('default-sink-changed', Lang.bind(this, this._readOutput));
            this._control.connect('default-source-changed', Lang.bind(this, this._readInput));
            this._control.connect('stream-added', Lang.bind(this, this._maybeShowInput));
            this._control.connect('stream-removed', Lang.bind(this, this._maybeShowInput));
            this._volumeMax = 1*this._control.get_vol_max_norm(); // previously was 1.5*this._control.get_vol_max_norm();, but we'd need a little mark on the slider to make it obvious to the user we're going over 100%..

            this._output = null;
            this._outputVolumeId = 0;
            this._outputMutedId = 0;

            this._input = null;
            this._inputVolumeId = 0;
            this._inputMutedId = 0;

            this._icon_name = '';

            this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

            this.mute_out_switch = new PopupMenu.PopupSwitchMenuItem(_("Mute output"), false);
            this.mute_in_switch = new PopupMenu.PopupSwitchMenuItem(_("Mute input"), false);
            this._applet_context_menu.addMenuItem(this.mute_out_switch);
            this._applet_context_menu.addMenuItem(this.mute_in_switch);
            this.mute_out_switch.connect('toggled', Lang.bind(this, this._toggle_out_mute));
            this.mute_in_switch.connect('toggled', Lang.bind(this, this._toggle_in_mute));

            this._control.open();

            this._volumeControlShown = false;

            this._showFixedElements();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_removed_from_panel : function() {
        if (this._iconTimeoutId) {
            Mainloop.source_remove(this._iconTimeoutId);
        }
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
            this._output.change_is_muted(false);
            this._output.push_volume();
        }

        this._notifyVolumeChange();
    },

    _onButtonReleaseEvent: function (actor, event) {
        Applet.IconApplet.prototype._onButtonReleaseEvent.call(this, actor, event);

        if (event.get_button() == 2) {
            if (this._output.is_muted)
                this._output.change_is_muted(false);
            else {
                this._output.change_is_muted(true);
            }

            this._output.push_volume();
        }

        return true;
    },

    setIconName: function(icon) {
        this._icon_name = icon;
        this.set_applet_icon_symbolic_name(icon);
        if (this._nbPlayers()>0) {
            if (this._iconTimeoutId) {
                Mainloop.source_remove(this._iconTimeoutId);
            }
            this._iconTimeoutId = Mainloop.timeout_add(3000, Lang.bind(this, function() {
                this._iconTimeoutId = null;
                this.set_applet_icon_symbolic_name(this['_output'].is_muted ? 'audio-volume-muted' : 'audio-x-generic');
            }));
        }
    },

    _nbPlayers: function() {
        return Object.keys(this._players).length;
    },

    _addPlayer: function(owner) {
        // ensure menu is empty
        this._cleanup();
        this._volumeControlShown = false;
        this._players[owner] = new Player(this, owner);
        this.menu.addMenuItem(this._players[owner]);
        this.menu.emit('players-loaded', true);

        this._showFixedElements();

        this.setIconName(this._icon_name);

        this._readOutput();
    },

    _removePlayer: function(owner) {
        delete this._players[owner];
        this._cleanup();
        this._volumeControlShown = false;
        for (owner in this._players) {
            this._addPlayer(owner);
        }
        this.menu.emit('players-loaded', true);

        this._showFixedElements();

        this.setIconName(this._icon_name);

        this._readOutput();
    },

    _cleanup: function() {
        if (this._outputTitle) this._outputTitle.destroy();
        if (this._outputSlider) this._outputSlider.destroy();
        if (this._inputTitle) this._inputTitle.destroy();
        if (this._inputSlider) this._inputSlider.destroy();
        this.menu.removeAll();
     },

    _showFixedElements: function() {
        if (this._volumeControlShown) return;
        this._volumeControlShown = true;

        if (this._nbPlayers()==0){
        	this._availablePlayers = new Array();
            let appsys = Cinnamon.AppSystem.get_default();
            let allApps = appsys.get_all();
            let listedDesktopFiles = new Array();
            for (let y=0; y<allApps.length; y++) {
            	let app = allApps[y];
            	let entry = app.get_tree_entry();
            	let path = entry.get_desktop_file_path();
            	for (var p=0; p<compatible_players.length; p++) {
                    let desktopFile = compatible_players[p]+".desktop";
            		if (path.indexOf(desktopFile) != -1 && listedDesktopFiles.indexOf(desktopFile) == -1) {
                		this._availablePlayers.push(app);
                        listedDesktopFiles.push(desktopFile);
            		}
           		}
            }

            if (this._availablePlayers.length > 0){
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                this._launchPlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Launch player..."));

                for (var p=0; p<this._availablePlayers.length; p++){
                    let playerApp = this._availablePlayers[p];
                    let menuItem = new MediaPlayerLauncher(playerApp, this._launchPlayerItem.menu);
                    this._launchPlayerItem.menu.addMenuItem(menuItem);
                }

                this.menu.addMenuItem(this._launchPlayerItem);
            }
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._outputTitle = new TextImageMenuItem(_("Volume"), "audio-volume-high", false, "right", "sound-volume-menu-item");
        this._outputSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._outputSlider.connect('value-changed', Lang.bind(this, this._sliderChanged, '_output'));
        this._outputSlider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));
        this.menu.addMenuItem(this._outputTitle);
        this.menu.addMenuItem(this._outputSlider);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._inputTitle = new PopupMenu.PopupMenuItem(_("Microphone"), { reactive: false });
        this._inputSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._inputSlider.connect('value-changed', Lang.bind(this, this._sliderChanged, '_input'));
        this._inputSlider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));
        this.menu.addMenuItem(this._inputTitle);
        this.menu.addMenuItem(this._inputSlider);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction(_("Sound Settings"), 'sound');

        this._selectDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Output device..."));
        this.menu.addMenuItem(this._selectDeviceItem);

        if (this._showInput){
           this._inputTitle.actor.show();
           this._inputSlider.actor.show();
        }else{
           this._inputTitle.actor.hide();
           this._inputSlider.actor.hide();
        }

        this._volumeChanged (null, null, '_output');
        this._volumeChanged (null, null, '_input');
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
            if (muted) {
                this.setIconName('audio-volume-muted');
                this._outputTitle.setIcon('audio-volume-muted');
                this.set_applet_tooltip(_("Volume") + ": 0%");
                this._outputTitle.setText(_("Volume") + ": 0%");
                this.mute_out_switch.setToggleState(true);
            } else {
                this.setIconName(this._volumeToIcon(this._output.volume));
                this._outputTitle.setIcon(this._volumeToIcon(this._output.volume));
                this.set_applet_tooltip(_("Volume") + ": " + Math.floor(this._output.volume / this._volumeMax * 100) + "%");
                this._outputTitle.setText(_("Volume") + ": " + Math.floor(this._output.volume / this._volumeMax * 100) + "%");
                this.mute_out_switch.setToggleState(false);
            }
        } else if (property == '_input') {
            if (muted) {
                this.mute_in_switch.setToggleState(true);
            } else {
                this.mute_in_switch.setToggleState(false);
            }
        }
    },

    _volumeChanged: function(object, param_spec, property) {
        if (this[property] == null) return;

        this[property+'Slider'].setValue(this[property].volume / this._volumeMax);
        if (property == '_output' && !this._output.is_muted) {
            this._outputTitle.setIcon(this._volumeToIcon(this._output.volume));
            this.setIconName(this._volumeToIcon(this._output.volume));
            this.set_applet_tooltip(_("Volume") + ": " + Math.floor(this._output.volume / this._volumeMax * 100) + "%");
            this._outputTitle.setText(_("Volume") + ": " + Math.floor(this._output.volume / this._volumeMax * 100) + "%");
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
            let sinks = this._control.get_sinks();
	        this._selectDeviceItem.menu.removeAll();
	        for (let i = 0; i < sinks.length; i++) {
	        	let sink = sinks[i];
	        	let menuItem = new PopupMenu.PopupMenuItem(sink.get_description());
	        	if (sinks[i].get_id() == this._output.get_id()) {
	        		menuItem.setShowDot(true);
	        	}
	        	menuItem.connect('activate', Lang.bind(this, function() {
	        		log('Changing default sink to ' + sink.get_description());
	                this._control.set_default_sink(sink);
	            }));
	            this._selectDeviceItem.menu.addMenuItem(menuItem);
	        }
        } else {
            this._outputSlider.setValue(0);
            this.setIconName('audio-volume-muted-symbolic');
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
        this._showInput = false;
        let recordingApps = this._control.get_source_outputs();
        if (this._input && recordingApps) {
            for (let i = 0; i < recordingApps.length; i++) {
                let outputStream = recordingApps[i];
                let id = outputStream.get_application_id();
                // but skip gnome-volume-control and pavucontrol
                // (that appear as recording because they show the input level)
                if (!id || (id != 'org.gnome.VolumeControl' && id != 'org.PulseAudio.pavucontrol')) {
                    this._showInput = true;
                    break;
                }
            }
        }
        if (this._showInput) {
            this._inputTitle.actor.show();
            this._inputSlider.actor.show();
        } else {
            this._inputTitle.actor.hide();
            this._inputSlider.actor.hide();
        }
    }

};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;
}
