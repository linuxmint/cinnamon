const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const GnomeSession = imports.misc.gnomeSession;

const INHIBIT_IDLE_FLAG = 8;
const INHIBIT_SLEEP_FLAG = 4;

function InhibitSwitch(applet) {
    this._init(applet);
}

InhibitSwitch.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(applet) {

        this._applet = applet;

        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.label = new St.Label({ text: _("Power management") });

        this._statusIcon = new St.Icon({ style_class: 'popup-menu-icon',
                                           icon_type: St.IconType.SYMBOLIC,
                                           icon_name: "dialog-warning-symbolic",
                                          reactive: true});

        this._switch = new PopupMenu.Switch(true);

        this.addActor(this.label);
        this.addActor(this._statusIcon);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;

        this.actor.hide();
        this.tooltip = new Tooltips.Tooltip(this._statusIcon, "");

        this.sessionProxy = null;
        this.sessionCookie = null;
        this.sigAddedId = 0;
        this.sigRemovedId = 0;

        GnomeSession.SessionManager(Lang.bind(this, function(proxy, error) {
            if (error)
                return;

            this.sessionProxy = proxy;
            this.actor.show();
            this.updateStatus();
            this.propId = this.sessionProxy.connect("g-properties-changed",
                                                    Lang.bind(this, this.updateStatus));
        }));
    },

    activate: function(event) {
        if (this._switch.actor.mapped) {
            this._switch.toggle();
        }

        this.toggled(this._switch.state);

        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event, true);
    },

    updateStatus: function(o) {
        let current_state = this.sessionProxy.InhibitedActions;

        if (current_state & INHIBIT_IDLE_FLAG ||
            current_state & INHIBIT_SLEEP_FLAG) {
            this._applet.set_applet_icon_symbolic_name('inhibit-active');
            this._applet.set_applet_tooltip(_("Power management: inhibited"));
        } else {
            this._applet.set_applet_icon_symbolic_name('inhibit');
            this._applet.set_applet_tooltip(_("Power management: active"));
        }

        if (current_state >= INHIBIT_SLEEP_FLAG && !this.sessionCookie) {
            this.tooltip.set_text(_("Power management is already inhibited by another program"));
            this._applet.set_applet_tooltip(_("Power management: inhibited by another program"));
            this._statusIcon.set_opacity(255);
        } else {
            this.tooltip.set_text("");
            this._statusIcon.set_opacity(0);
        }
    },

    toggled: function(active) {
        if (!active && !this.sessionCookie) {
            this.sessionProxy.InhibitRemote("inhibit@cinnamon.org",
                                            0,
                                            "prevent idle functions like screen blanking and dimming",
                                            INHIBIT_IDLE_FLAG,
                                            Lang.bind(this, function(cookie) {
                                                this.sessionCookie = cookie;
                                                this.updateStatus();
                                            }));
        } else if (active && this.sessionCookie) {
            this.sessionProxy.UninhibitRemote(this.sessionCookie);
            this.sessionCookie = null;
            this.updateStatus();
        }
    },

    kill: function() {
        if (!this.sessionProxy)
            return;

        if (this.sessionCookie) {
            this.sessionProxy.UninhibitRemote(this.sessionCookie);
            this.sessionCookie = null;
        }

        this.sessionProxy.disconnect(this.propId);
    }
};

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}


MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

        this.metadata = metadata;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.inhibitSwitch = new InhibitSwitch(this);
        this.menu.addMenuItem(this.inhibitSwitch);

        this.set_applet_icon_symbolic_name('inhibit');
        this.set_applet_tooltip(_("Inhibit applet"));

        this.notif_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" });
        this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Notifications"), this.notif_settings.get_boolean("display-notifications"));

        this.notif_settings.connect('changed::display-notifications', Lang.bind(this, function() {
            this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
        }));
        this.notificationsSwitch.connect('toggled', Lang.bind(this, function() {
            this.notif_settings.set_boolean("display-notifications", this.notificationsSwitch.state);
        }));

        this.menu.addMenuItem(this.notificationsSwitch);
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this.inhibitSwitch.kill();
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
