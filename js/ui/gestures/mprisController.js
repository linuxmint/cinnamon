// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

// TODO: Have both the sound applet and gestures use this?
const Interfaces = imports.misc.interfaces;

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_IFACE_NAME = "org.mpris.MediaPlayer2.Player";

var Player = class {
    constructor(controller, bus_name, owner) {
        this.controller = controller;
        this.bus_name = bus_name;
        this.owner = owner;

        this.player_control = null;
        this.prop_handler = null;
        this.prop_changed_id = 0;

        this.can_control = false;
        this.is_playing = false;
        this.can_play = false;
        this.can_pause = false;
        this.can_go_next = false;
        this.can_go_previous = false;

        let async_ready_cb = (proxy, error, property) => {
            if (error)
                log(error);
            else {
                this[property] = proxy;
                this.dbus_acquired();
            }
        };

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_PLAYER_IFACE_NAME,
                                              this.bus_name,
                                              (p, e) => async_ready_cb(p, e, 'player_control'));

        Interfaces.getDBusPropertiesAsync(this.bus_name,
                                          MEDIA_PLAYER_2_PATH,
                                          (p, e) => async_ready_cb(p, e, 'prop_handler'));
    }

    dbus_acquired() {
        if (!this.prop_handler || !this.player_control)
            return;

        this.prop_changed_id = this.prop_handler.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {
            if (iface !== MEDIA_PLAYER_2_PLAYER_IFACE_NAME) {
                return;
            }

            this.update_from_props(Object.keys(props));
        });

        this.update();
    }

    update() {
        this.update_from_props(null);
    }

    update_from_props(prop_names) {
        if (!prop_names || prop_names.CanControl) {
            this.prop_handler.GetRemote(MEDIA_PLAYER_2_PLAYER_IFACE_NAME, 'CanControl', (value, error) => {
                if (!error)
                    this.can_control = value[0].unpack();
            });
        }

        if (!prop_names || prop_names.PlaybackStatus)
            this.prop_handler.GetRemote(MEDIA_PLAYER_2_PLAYER_IFACE_NAME, 'PlaybackStatus', (value, error) => {
                if (!error)
                    this.is_playing = ["Playing", "Paused"].includes(value[0].unpack());
            });

        if (!prop_names || prop_names.CanGoNext)
            this.prop_handler.GetRemote(MEDIA_PLAYER_2_PLAYER_IFACE_NAME, 'CanGoNext', (value, error) => {
                if (!error)
                    this.can_go_next = value[0].unpack();
            });

        if (!prop_names || prop_names.CanGoPrevious)
            this.prop_handler.GetRemote(MEDIA_PLAYER_2_PLAYER_IFACE_NAME, 'CanGoPrevious', (value, error) => {
                if (!error)
                    this.can_go_previous = value[0].unpack();
            });

        if (!prop_names || prop_names.CanPlay)
            this.prop_handler.GetRemote(MEDIA_PLAYER_2_PLAYER_IFACE_NAME, 'CanPlay', (value, error) => {
                if (!error)
                    this.can_play = value[0].unpack();
            });

        if (!prop_names || prop_names.CanPause)
            this.prop_handler.GetRemote(MEDIA_PLAYER_2_PLAYER_IFACE_NAME, 'CanPause', (value, error) => {
                if (!error)
                    this.can_pause = value[0].unpack();
            });
    }

    toggle_play() {
        if (!this.can_control) {
            return;
        }

        // Should we rely on the CanPlay/Pause properties or just try?
        this.player_control.PlayPauseRemote();
    }

    next_track() {
        if (!this.can_control) {
            return;
        }
        if (!this.can_go_next) {
            return;
        }

        this.player_control.NextRemote();
    }

    previous_track() {
        if (!this.can_control) {
            return;
        }

        if (!this.can_go_previous) {
            return;
        }

        this.player_control.PreviousRemote();
    }

    destroy() {
        if (this.prop_handler != null) {
            this.prop_handler.disconnectSignal(this.prop_changed_id);
            this.prop_changed_id = 0;
        }

        this.prop_handler = null;
        this.player_control = null;
    }
}

var MprisController = class {
    constructor() {
        this._dbus = null;

        this._players = {};
        this._active_player = null;
        this._owner_changed_id = 0;

        Interfaces.getDBusAsync((proxy, error) => {
            if (error) {
                global.logError(error);
                return;
            }

            this._dbus = proxy;

            // player DBus name pattern
            let name_regex = /^org\.mpris\.MediaPlayer2\./;
            // load players
            this._dbus.ListNamesRemote((names) => {
                for (let n in names[0]) {
                    let name = names[0][n];
                    if (name_regex.test(name))
                        this._dbus.GetNameOwnerRemote(name, (owner) => this._add_player(name, owner[0]));
                }
            });

            // watch players
            this._owner_changed_id = this._dbus.connectSignal('NameOwnerChanged',
                (proxy, sender, [name, old_owner, new_owner]) => {
                    if (name_regex.test(name)) {
                        if (new_owner && !old_owner)
                            this._add_player(name, new_owner);
                        else if (old_owner && !new_owner)
                            this._remove_player(name, old_owner);
                        else
                            this._change_player_owner(name, old_owner, new_owner);
                    }
                }
            );
        });
    }

    _is_instance(busName) {
        // MPRIS instances are in the form
        //   org.mpris.MediaPlayer2.name.instanceXXXX
        // ...except for VLC, which to this day uses
        //   org.mpris.MediaPlayer2.name-XXXX
        return busName.split('.').length > 4 ||
                /^org\.mpris\.MediaPlayer2\.vlc-\d+$/.test(busName);
    }

    _add_player(bus_name, owner) {
        if (this._players[owner]) {
            let prev_name = this._players[owner].bus_name;
            // HAVE: ADDING: ACTION:
            // master master reject, cannot happen
            // master instance upgrade to instance
            // instance master reject, duplicate
            // instance instance reject, cannot happen
            if (this._isInstance(bus_name) && !this._isInstance(prev_name)) {
                this._players[owner].bus_name = bus_name;
                this._players[owner].update();
            }
            else {
                return;
            }
        } else if (owner) {
            let player = new Player(this, bus_name, owner);

            this._players[owner] = player;

            // newest becomes active
            this._active_player = owner;
        }
    }

    _remove_player(bus_name, owner) {
        if (this._players[owner] && this._players[owner].bus_name == bus_name) {
            this._players[owner].destroy();
            delete this._players[owner];

            if (this._active_player == owner) {
                //set _activePlayer to null if we have none now, or to the first value in the players list
                this._active_player = null;
                this._update_active_player();
            }
        }
    }

    _change_player_owner(bus_name, old_owner, new_owner) {
        if (this._players[old_owner] && bus_name == this._players[old_owner].bus_name) {
            this._players[new_owner] = this._players[old_owner];
            this._players[new_owner].owner = new_owner;
            delete this._players[old_owner];
            if (this._active_player == old_owner)
                this._active_player = new_owner;
            this._players[new_owner].update();
        }
    }

    get_player() {
        let player = this._active_player;

        if (player == null) {
            for (let name in this._players) {
                let maybe_player = this._players[name];

                if (maybe_player.is_playing || maybe_player.can_control) {
                    player = name;
                    break;
                }
            }
        } 

        return this._players[player];
    }
}


