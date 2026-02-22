// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

// Used by sound applet and screensaver album art widget.
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const Interfaces = imports.misc.interfaces;

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";

var PlaybackStatus = {
    UNKNOWN: 'Unknown',
    PLAYING: 'Playing',
    PAUSED: 'Paused',
    STOPPED: 'Stopped'
};

let _mprisPlayerManager = null;

function getMprisPlayerManager() {
    if (_mprisPlayerManager === null) {
        _mprisPlayerManager = new MprisPlayerManager();
    }
    return _mprisPlayerManager;
}

var MprisPlayer = class MprisPlayer {
    constructor(busName, owner) {
        this._busName = busName;
        this._owner = owner;
        this._ready = false;
        this._closed = false;

        // D-Bus proxies
        this._mediaServer = null;       // org.mpris.MediaPlayer2
        this._mediaServerPlayer = null; // org.mpris.MediaPlayer2.Player
        this._prop = null;              // org.freedesktop.DBus.Properties

        this._propChangedId = 0;

        this._identity = null;
        this._desktopEntry = null;

        this._playbackStatus = PlaybackStatus.UNKNOWN;

        this._trackId = "";
        this._title = "";
        this._artist = "";
        this._album = "";
        this._artUrl = "";
        this._length = 0;

        this._canRaise = false;
        this._canQuit = false;
        this._canControl = false;
        this._canPlay = false;
        this._canPause = false;
        this._canGoNext = false;
        this._canGoPrevious = false;
        this._canSeek = false;

        this._initProxies();
    }

    _initProxies() {
        let proxiesAcquired = 0;
        let totalProxies = 3;

        let asyncReadyCb = (proxy, error, property) => {
            if (this._closed) return;

            if (error) {
                global.logWarning(`MprisPlayer: Error acquiring ${property} for ${this._busName}: ${error}`);
                return;
            }

            this[property] = proxy;
            proxiesAcquired++;

            if (proxiesAcquired === totalProxies) {
                this._onProxiesReady();
            }
        };

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_NAME,
            this._busName, (p, e) => asyncReadyCb(p, e, '_mediaServer'));

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_PLAYER_NAME,
            this._busName, (p, e) => asyncReadyCb(p, e, '_mediaServerPlayer'));

        Interfaces.getDBusPropertiesAsync(this._busName,
            MEDIA_PLAYER_2_PATH, (p, e) => asyncReadyCb(p, e, '_prop'));
    }

    _onProxiesReady() {
        if (this._closed) return;

        this._ready = true;

        // Get identity
        if (this._mediaServer.Identity) {
            this._identity = this._mediaServer.Identity;
        } else {
            let displayName = this._busName.replace('org.mpris.MediaPlayer2.', '');
            this._identity = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        }

        this._desktopEntry = this._mediaServer.DesktopEntry || null;

        // Cache initial capabilities
        this._updateCapabilities();

        // Connect to property changes
        this._propChangedId = this._prop.connectSignal('PropertiesChanged',
            (proxy, sender, [iface, props]) => {
                this._onPropertiesChanged(iface, props);
            });

        // Initial state read
        this._updateStatus(this._mediaServerPlayer.PlaybackStatus);
        this._updateMetadata(this._mediaServerPlayer.Metadata);

        this.emit('ready');
    }

    _onPropertiesChanged(iface, props) {
        if (this._closed) return;

        let metadataChanged = false;
        let statusChanged = false;
        let capabilitiesChanged = false;

        if (props.PlaybackStatus) {
            this._updateStatus(props.PlaybackStatus.unpack());
            statusChanged = true;
        }

        if (props.Metadata) {
            this._updateMetadata(props.Metadata.deep_unpack());
            metadataChanged = true;
        }

        if (props.CanGoNext !== undefined || props.CanGoPrevious !== undefined ||
            props.CanPlay !== undefined || props.CanPause !== undefined ||
            props.CanSeek !== undefined || props.CanControl !== undefined) {
            this._updateCapabilities();
            capabilitiesChanged = true;
        }

        if (props.Identity) {
            this._identity = props.Identity.unpack();
        }

        if (props.DesktopEntry) {
            this._desktopEntry = props.DesktopEntry.unpack();
        }

        if (props.CanRaise !== undefined) {
            this._canRaise = this._mediaServer.CanRaise || false;
        }

        if (props.CanQuit !== undefined) {
            this._canQuit = this._mediaServer.CanQuit || false;
        }

        if (metadataChanged) {
            this.emit('metadata-changed');
        }

        if (statusChanged) {
            this.emit('status-changed', this._playbackStatus);
        }

        if (capabilitiesChanged) {
            this.emit('capabilities-changed');
        }
    }

    _updateStatus(status) {
        if (!status) {
            this._playbackStatus = PlaybackStatus.UNKNOWN;
            return;
        }

        switch (status) {
            case 'Playing':
                this._playbackStatus = PlaybackStatus.PLAYING;
                break;
            case 'Paused':
                this._playbackStatus = PlaybackStatus.PAUSED;
                break;
            case 'Stopped':
                this._playbackStatus = PlaybackStatus.STOPPED;
                break;
            default:
                this._playbackStatus = PlaybackStatus.UNKNOWN;
        }
    }

    _updateMetadata(metadata) {
        if (!metadata) return;

        // Track ID
        if (metadata["mpris:trackid"]) {
            this._trackId = metadata["mpris:trackid"].unpack();
        } else {
            this._trackId = "";
        }

        // Length (in microseconds)
        if (metadata["mpris:length"]) {
            this._length = metadata["mpris:length"].unpack();
        } else {
            this._length = 0;
        }

        // Artist (can be string or array)
        if (metadata["xesam:artist"]) {
            switch (metadata["xesam:artist"].get_type_string()) {
                case 's':
                    this._artist = metadata["xesam:artist"].unpack();
                    break;
                case 'as':
                    this._artist = metadata["xesam:artist"].deep_unpack().join(", ");
                    break;
                default:
                    this._artist = "";
            }
            if (!this._artist) this._artist = "";
        } else {
            this._artist = "";
        }

        // Album
        if (metadata["xesam:album"]) {
            this._album = metadata["xesam:album"].unpack();
        } else {
            this._album = "";
        }

        // Title
        if (metadata["xesam:title"]) {
            this._title = metadata["xesam:title"].unpack();
        } else {
            this._title = "";
        }

        // Art URL
        if (metadata["mpris:artUrl"]) {
            this._artUrl = metadata["mpris:artUrl"].unpack();
        } else {
            this._artUrl = "";
        }
    }

    _updateCapabilities() {
        if (!this._mediaServer || !this._mediaServerPlayer) return;

        this._canRaise = this._mediaServer.CanRaise || false;
        this._canQuit = this._mediaServer.CanQuit || false;
        this._canControl = this._mediaServerPlayer.CanControl || false;
        this._canPlay = this._mediaServerPlayer.CanPlay || false;
        this._canPause = this._mediaServerPlayer.CanPause || false;
        this._canGoNext = this._mediaServerPlayer.CanGoNext || false;
        this._canGoPrevious = this._mediaServerPlayer.CanGoPrevious || false;
        this._canSeek = this._mediaServerPlayer.CanSeek || false;
    }

    // Identity accessors
    getBusName() {
        return this._busName;
    }

    getOwner() {
        return this._owner;
    }

    getIdentity() {
        return this._identity || "";
    }

    getDesktopEntry() {
        return this._desktopEntry;
    }

    isReady() {
        return this._ready;
    }

    // Capability accessors
    canRaise() {
        return this._canRaise;
    }

    canQuit() {
        return this._canQuit;
    }

    canControl() {
        return this._canControl;
    }

    canPlay() {
        return this._canPlay;
    }

    canPause() {
        return this._canPause;
    }

    canGoNext() {
        return this._canGoNext;
    }

    canGoPrevious() {
        return this._canGoPrevious;
    }

    canSeek() {
        return this._canSeek;
    }

    // Status accessors
    getPlaybackStatus() {
        return this._playbackStatus;
    }

    isPlaying() {
        return this._playbackStatus === PlaybackStatus.PLAYING;
    }

    isPaused() {
        return this._playbackStatus === PlaybackStatus.PAUSED;
    }

    isStopped() {
        return this._playbackStatus === PlaybackStatus.STOPPED;
    }

    // Metadata accessors
    getTitle() {
        return this._title;
    }

    getArtist() {
        return this._artist;
    }

    getAlbum() {
        return this._album;
    }

    getArtUrl() {
        return this._artUrl;
    }

    getProcessedArtUrl() {
        let url = this._artUrl;

        // Spotify uses open.spotify.com URLs that need rewriting to i.scdn.co
        if (this._identity && this._identity.toLowerCase() === 'spotify') {
            url = url.replace('open.spotify.com', 'i.scdn.co');
        }

        return url;
    }

    getTrackId() {
        return this._trackId;
    }

    getLength() {
        return this._length;
    }

    getLengthSeconds() {
        return this._length / 1000000;
    }

    // Playback controls
    play() {
        if (this._mediaServerPlayer && this._canPlay) {
            this._mediaServerPlayer.PlayRemote();
        }
    }

    pause() {
        if (this._mediaServerPlayer && this._canPause) {
            this._mediaServerPlayer.PauseRemote();
        }
    }

    playPause() {
        if (this._mediaServerPlayer) {
            this._mediaServerPlayer.PlayPauseRemote();
        }
    }

    stop() {
        if (this._mediaServerPlayer) {
            this._mediaServerPlayer.StopRemote();
        }
    }

    next() {
        if (this._mediaServerPlayer && this._canGoNext) {
            this._mediaServerPlayer.NextRemote();
        }
    }

    previous() {
        if (this._mediaServerPlayer && this._canGoPrevious) {
            this._mediaServerPlayer.PreviousRemote();
        }
    }

    seek(offset) {
        if (this._mediaServerPlayer && this._canSeek) {
            this._mediaServerPlayer.SeekRemote(offset);
        }
    }

    setPosition(trackId, position) {
        if (this._mediaServerPlayer && this._canSeek) {
            this._mediaServerPlayer.SetPositionRemote(trackId, position);
        }
    }

    // Player actions
    raise() {
        if (this._mediaServer && this._canRaise) {
            // Spotify workaround - it can't raise via D-Bus once closed
            if (this._identity && this._identity.toLowerCase() === 'spotify') {
                const Util = imports.misc.util;
                Util.spawn(['spotify']);
            } else {
                this._mediaServer.RaiseRemote();
            }
        }
    }

    quit() {
        if (this._mediaServer && this._canQuit) {
            this._mediaServer.QuitRemote();
        }
    }

    getMediaServerProxy() {
        return this._mediaServer;
    }

    getMediaServerPlayerProxy() {
        return this._mediaServerPlayer;
    }

    getPropertiesProxy() {
        return this._prop;
    }

    destroy() {
        this._closed = true;

        if (this._propChangedId && this._prop) {
            this._prop.disconnectSignal(this._propChangedId);
            this._propChangedId = 0;
        }

        this._mediaServer = null;
        this._mediaServerPlayer = null;
        this._prop = null;

        this.emit('closed');
    }
};
Signals.addSignalMethods(MprisPlayer.prototype);

/**
 * MprisPlayerManager:
 * Singleton that discovers and tracks all MPRIS players on the session bus.
 *
 * Signals:
 *   - 'player-added': (player: MprisPlayer) New player appeared
 *   - 'player-removed': (busName: string, owner: string) Player disappeared
 */
var MprisPlayerManager = class MprisPlayerManager {
    constructor() {
        this._dbus = null;
        this._players = {};  // Keyed by owner
        this._ownerChangedId = 0;

        this._initDBus();
    }

    _initDBus() {
        Interfaces.getDBusAsync((proxy, error) => {
            if (error) {
                global.logError(`MprisPlayerManager: Failed to get D-Bus proxy: ${error}`);
                return;
            }

            this._dbus = proxy;

            let nameRegex = /^org\.mpris\.MediaPlayer2\./;

            this._dbus.ListNamesRemote((names) => {
                if (!names || !names[0]) return;

                for (let name of names[0]) {
                    if (nameRegex.test(name)) {
                        this._dbus.GetNameOwnerRemote(name, (owner) => {
                            if (owner && owner[0]) {
                                this._addPlayer(name, owner[0]);
                            }
                        });
                    }
                }
            });

            this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged',
                (proxy, sender, [name, oldOwner, newOwner]) => {
                    if (nameRegex.test(name)) {
                        if (newOwner && !oldOwner) {
                            this._addPlayer(name, newOwner);
                        } else if (oldOwner && !newOwner) {
                            this._removePlayer(name, oldOwner);
                        } else if (oldOwner && newOwner) {
                            this._changePlayerOwner(name, oldOwner, newOwner);
                        }
                    }
                });
        });
    }

    _addPlayer(busName, owner) {
        if (this._players[owner]) {
            return; // Already tracking this player
        }

        let player = new MprisPlayer(busName, owner);
        this._players[owner] = player;

        // Wait for player to be ready before emitting signal
        player.connect('ready', () => {
            this.emit('player-added', player);
        });
    }

    _removePlayer(busName, owner) {
        let player = this._players[owner];
        if (!player) return;

        delete this._players[owner];
        player.destroy();

        this.emit('player-removed', busName, owner);
    }

    _changePlayerOwner(busName, oldOwner, newOwner) {
        this._removePlayer(busName, oldOwner);
        this._addPlayer(busName, newOwner);
    }

    getPlayers() {
        return Object.values(this._players);
    }

    getPlayer(owner) {
        return this._players[owner] || null;
    }

    getPlayerByBusName(busName) {
        for (let player of Object.values(this._players)) {
            if (player.getBusName() === busName) {
                return player;
            }
        }
        return null;
    }

    getBestPlayer() {
        let firstControllable = null;

        for (let player of Object.values(this._players)) {
            if (!player.isReady()) continue;

            if (player.isPlaying()) {
                return player;
            }

            if (firstControllable === null && player.canControl()) {
                firstControllable = player;
            }
        }

        return firstControllable;
    }

    getPlayerCount() {
        return Object.keys(this._players).length;
    }

    hasPlayers() {
        return this.getPlayerCount() > 0;
    }

    destroy() {
        if (this._ownerChangedId && this._dbus) {
            this._dbus.disconnectSignal(this._ownerChangedId);
            this._ownerChangedId = 0;
        }

        for (let owner in this._players) {
            this._players[owner].destroy();
        }
        this._players = {};

        this._dbus = null;
    }
};
Signals.addSignalMethods(MprisPlayerManager.prototype);
