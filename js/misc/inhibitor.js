const GObject = imports.gi.GObject;
const GnomeSession = imports.misc.gnomeSession;

var INHIBIT_IDLE_FLAG = 8;
var INHIBIT_SLEEP_FLAG = 4;
const OWN_APP_ID = "inhibit@cinnamon.org";

// This is not a general-purpose inhibitor api, it is to allow the
// user to disable power management via something like the inhibit
// applet, and also gathers information on apps that have also
// created inhibitors.

const InhibitController = GObject.registerClass({
    Signals: {
        'status-changed': {},
    },
}, class InhibitController extends GObject.Object {
    _init() {
        super._init();

        this._sessionProxy = null;
        this._cookie = null;
        this._inhibited = false;
        this._syncing = false;
        this._sigAddedId = 0;
        this._sigRemovedId = 0;
        this._updating = false;
        this._refreshPending = false;
        this._consumers = 0;

        // External inhibitors grouped by appId.
        // Key: appId string, Value: { reasons: Map<objectPath, string> }
        this._externalInhibitors = {};

        GnomeSession.SessionManager((proxy, error) => {
            if (error) {
                global.logWarning(`InhibitController: Failed to connect to SessionManager: ${error}`);
                return;
            }

            this._sessionProxy = proxy;

            this._sigAddedId = this._sessionProxy.connectSignal(
                "InhibitorAdded", () => this._refresh()
            );

            this._sigRemovedId = this._sessionProxy.connectSignal(
                "InhibitorRemoved", () => this._refresh()
            );

            this._syncState();
            this._refresh();
        });
    }

    get ready() {
        return this._sessionProxy !== null;
    }

    get isInhibited() {
        return this._inhibited;
    }

    get inhibitedActions() {
        if (this._sessionProxy === null)
            return 0;

        return this._sessionProxy.InhibitedActions;
    }

    get externalInhibitors() {
        let result = [];

        for (let appId in this._externalInhibitors) {
            let entry = this._externalInhibitors[appId];
            let reasons = Array.from(entry.reasons.values())
                .map(r => r && r.trim())
                .filter(Boolean);
            reasons = Array.from(new Set(reasons));

            result.push({ appId, reasons });
        }

        return result;
    }

    get hasExternalInhibitors() {
        return Object.keys(this._externalInhibitors).length > 0;
    }

    register() {
        this._consumers++;
    }

    unregister() {
        if (this._consumers <= 0) {
            global.logWarning("InhibitController: unregister() called with no consumers");
            return;
        }

        this._consumers--;

        if (this._consumers === 0) {
            this._inhibited = false;
            this._syncState();
        }
    }

    inhibit() {
        if (this._inhibited)
            return;

        this._inhibited = true;
        this._syncState();
    }

    uninhibit() {
        if (!this._inhibited)
            return;

        this._inhibited = false;
        this._syncState();
    }

    _syncState() {
        if (this._syncing || this._sessionProxy === null)
            return;

        if (this._inhibited && this._cookie === null) {
            this._syncing = true;

            this._sessionProxy.InhibitRemote(
                OWN_APP_ID,
                0,
                "prevent idle functions like screen blanking and dimming",
                INHIBIT_IDLE_FLAG,
                (result, error) => {
                    this._syncing = false;

                    if (error) {
                        global.logWarning(`InhibitController: InhibitRemote failed: ${error}`);
                        this._inhibited = false;
                    } else {
                        this._cookie = result[0];
                    }

                    this.emit('status-changed');
                    this._syncState();
                }
            );
        } else if (!this._inhibited && this._cookie !== null) {
            this._syncing = true;
            let cookie = this._cookie;

            this._sessionProxy.UninhibitRemote(cookie, (result, error) => {
                this._syncing = false;

                if (error)
                    global.logWarning(`InhibitController: UninhibitRemote failed: ${error}`);
                // The only likely reason for failure would be the inhibitor is gone already,
                // so clear the cookie regardless of error and assume we're no longer inhibited.
                this._cookie = null;

                this.emit('status-changed');
                this._syncState();
            });
        }
    }

    _refresh() {
        if (this._sessionProxy === null)
            return;

        if (this._updating) {
            this._refreshPending = true;
            return;
        }

        this._updating = true;
        this._refreshPending = false;

        this._sessionProxy.GetInhibitorsRemote((result, error) => {
            if (error) {
                global.logWarning(`InhibitController: GetInhibitorsRemote failed: ${error}`);
                this._refreshDone();
                return;
            }

            let objectPaths = result[0];

            this._externalInhibitors = {};

            let pending = 0;

            for (let objectPath of objectPaths) {
                if (!objectPath)
                    continue;

                pending++;

                try {
                    this._fetchInhibitor(objectPath, () => {
                        pending--;
                        if (pending === 0)
                            this._refreshDone();
                    });
                } catch (e) {
                    global.logWarning(`InhibitController: Exception fetching inhibitor ${objectPath}: ${e}`);
                    pending--;
                    if (pending === 0)
                        this._refreshDone();
                }
            }

            if (pending === 0)
                this._refreshDone();
        });
    }

    _refreshDone() {
        this._updating = false;
        this.emit('status-changed');

        if (this._refreshPending)
            this._refresh();
    }

    vfunc_dispose() {
        this._inhibited = false;

        if (this._sessionProxy) {
            if (this._cookie !== null) {
                this._sessionProxy.UninhibitRemote(this._cookie);
                this._cookie = null;
            }

            if (this._sigAddedId) {
                this._sessionProxy.disconnectSignal(this._sigAddedId);
                this._sigAddedId = 0;
            }

            if (this._sigRemovedId) {
                this._sessionProxy.disconnectSignal(this._sigRemovedId);
                this._sigRemovedId = 0;
            }

            this._sessionProxy = null;
        }

        this._externalInhibitors = {};
        this._updating = false;
        this._refreshPending = false;

        super.vfunc_dispose();
    }

    _fetchInhibitor(objectPath, done) {
        GnomeSession.Inhibitor(objectPath, (inhibitorProxy, error) => {
            if (error) {
                global.logWarning(`InhibitController: Failed to create Inhibitor proxy for ${objectPath}: ${error}`);
                done();
                return;
            }

            inhibitorProxy.GetFlagsRemote((result, error) => {
                if (error) {
                    global.logWarning(`InhibitController: GetFlags failed for ${objectPath}: ${error}`);
                    done();
                    return;
                }

                let flags = result[0];

                if (!(flags & (INHIBIT_SLEEP_FLAG | INHIBIT_IDLE_FLAG))) {
                    done();
                    return;
                }

                inhibitorProxy.GetAppIdRemote((result, error) => {
                    if (error) {
                        global.logWarning(`InhibitController: GetAppId failed for ${objectPath}: ${error}`);
                        done();
                        return;
                    }

                    let appId = result[0];

                    if (appId === OWN_APP_ID) {
                        done();
                        return;
                    }

                    if (!(appId in this._externalInhibitors))
                        this._externalInhibitors[appId] = { reasons: new Map() };

                    inhibitorProxy.GetReasonRemote((result, error) => {
                        if (!error) {
                            let reason = result[0];
                            this._externalInhibitors[appId].reasons.set(objectPath, reason);
                        } else {
                            global.logWarning(`InhibitController: GetReason failed for ${objectPath}: ${error}`);
                        }
                        done();
                    });
                });
            });
        });
    }
});

let _controller = null;

function getController() {
    if (_controller === null)
        _controller = new InhibitController();

    return _controller;
}
