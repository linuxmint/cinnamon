// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;

const SessionDialogInterface =
    "<node> \
      <interface name='org.cinnamon.SessionManager.EndSessionDialog'> \
        <method name='Suspend'/> \
        <method name='Hibernate'/> \
        <method name='Restart'/> \
        <method name='Shutdown'/> \
        <method name='SwitchUser'/> \
        <method name='Logout'/> \
        <method name='Cancel'/> \
        <method name='IgnoreInhibitors'/> \
        <method name='GetCapabilities'> \
          <arg type='(bbbbbbb)' name='capabilities' direction='out'/> \
        </method> \
        <signal name='InhibitorsChanged'> \
          <arg type='a(ssss)' name='capabilities'/> \
        </signal> \
      </interface> \
    </node>";

const SessionDialogInfo = Gio.DBusInterfaceInfo.new_for_xml(SessionDialogInterface);

const DialogMode = {
    REBOOT: 0,
    SHUTDOWN: 1,
    LOGOUT: 2
};

const ResponseCode = {
    SUSPEND: 1,
    HIBERNATE: 2,
    RESTART: 3,
    SWITCH_USER: 4,
    CANCEL: 5,
    LOGOUT: 6,
    SHUTDOWN: 7,
    CONTINUE: 8,
    NONE: 9
}

var EndSessionDialog = GObject.registerClass(
class EndSessionDialog extends ModalDialog.ModalDialog {
    _init(mode) {
        super._init({
            styleClass: 'end-session-dialog',
        });

        this._mode = mode;
        this._inhibited = false;
        this._settings = new Gio.Settings({ schema_id: 'org.cinnamon.SessionManager' });
        this._currentTime = this._settings.get_int('quit-time-delay');
        this._progressTimerId = 0;
        this._defaultAction = null;

        this._messageDialogContent = new Dialog.MessageDialogContent();
        this._messageDialogContent.description = " ";
        this.contentLayout.add_child(this._messageDialogContent);

        this._applicationsSection = new Dialog.ListSection({
            title: _("Some applications are busy or have unsaved work."),
        });
        this.contentLayout.add_child(this._applicationsSection);
        this._applicationsSection.visible = false;

        this._dialogProxy = new Gio.DBusProxy({
            g_connection: Gio.DBus.session,
            g_interface_name: "org.cinnamon.SessionManager.EndSessionDialog",
            g_interface_info: SessionDialogInfo,
            g_name: 'org.gnome.SessionManager',
            g_object_path: '/org/gnome/SessionManager',
            g_flags: Gio.DBusProxyFlags.DO_NOT_AUTO_START
        });

        this._dialogProxy.init(null);

        this._dialogProxy.connect("g-signal", this._proxySignalReceived.bind(this));
        this._dialogProxy.GetCapabilitiesRemote(this._getCapabilities.bind(this));
    }

    _proxySignalReceived(proxy, sender, signal, params) {
        if (signal === "InhibitorsChanged") {
            const inhibitors = params.deep_unpack()[0];
            if (inhibitors && inhibitors.length > 0) {
                this._inhibited = true;
                this._presentInhibitorInfo(inhibitors);
            } else {
                if (this._inhibited) {
                    this._dialogProxy.IgnoreInhibitorsRemote();
                }
            }
        }
    }

    _addCancel() {
        this.addButton({
            label: _("Cancel"),
            action: () => {
                this._dialogProxy.CancelRemote();
            },
            key: Clutter.KEY_Escape
        });
    }

    _getCapabilities(result, error) {
        if (error) {
            global.logError('Error getting capabilities: ' + error.message);
            return;
        }

        var [canSwitchUser, canStop, canRestart, canHybridSleep, canSuspend, canHibernate, canLogout] = result[0];
        var content = null;
        let button;

        switch(this._mode) {
            case DialogMode.LOGOUT:
                this._addCancel();

                if (canSwitchUser) {
                    this.addButton({
                        label: _("Switch User"),
                        action: this._dialogProxy.SwitchUserRemote.bind(this._dialogProxy)
                    });
                }

                this._defaultAction = this._dialogProxy.LogoutRemote.bind(this._dialogProxy);
                button = this.addButton({
                    label: _("Log Out"),
                    action: this._defaultAction,
                    destructive_action: true,
                    default: true
                });
                button.grab_key_focus();

                this._messageDialogContent.title = _("Log Out");

                break;
            case DialogMode.SHUTDOWN:
                this._addCancel();

                if (canSuspend) {
                    this.addButton({
                        label: _("Suspend"),
                        action: () => {
                            this._dialogProxy.SuspendRemote();
                            this.close();
                        },
                    });
                }

                if (canHibernate) {
                    this.addButton({
                        label: _("Hibernate"),
                        action: this._dialogProxy.HibernateRemote.bind(this._dialogProxy)
                    });
                }

                if (canRestart) {
                    this.addButton({
                        label: _("Restart"),
                        action: this._dialogProxy.RestartRemote.bind(this._dialogProxy),
                    });
                }

                if (canStop) {
                    this._defaultAction = this._dialogProxy.ShutdownRemote.bind(this._dialogProxy);
                    button = this.addButton({
                        label: _("Shut Down"),
                        action: this._defaultAction,
                        destructive_action: true,
                        default: true,
                    });
                    button.grab_key_focus();
                }

                this._messageDialogContent.title = _("Shut Down");

                break;
            case DialogMode.REBOOT:
                this._addCancel();

                if (!canRestart) {
                    global.logError("Restart not available");
                    this._dialogProxy.CancelRemote();
                    this.destroy();
                    return;
                }

                this._defaultAction = this._dialogProxy.RestartRemote.bind(this._dialogProxy);
                button = this.addButton({
                    label: _("Restart"),
                    action: this._defaultAction,
                    destructive_action: true,
                    default: true
                });
                button.grab_key_focus();

                this._messageDialogContent.title = _("Restart");

                break;
        }

        if (this._settings.get_boolean("quit-delay-toggle")) {
            this._addDelayTimer();
        }
    }

    _addDelayTimer() {
        this._updateProgress();

        this._progressTimerId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, 1000, this._updateProgress.bind(this));
    }

    _removeDelayTimer() {
        if (this._progressTimerId) {
            GLib.source_remove(this._progressTimerId);
            this._progressTimerId = 0;
        }
    }

    _updateProgress() {
        if (this._currentTime == 0) {
            if (this._defaultAction != null) {
                this._defaultAction();
            }

            this._progressTimerId = 0;
            return GLib.SOURCE_REMOVE;
        }

        let text = "";

        switch(this._mode) {
            case DialogMode.LOGOUT:
                text = ngettext(
                    "You will be logged out in %d second.",
                    "You will be logged out in %d seconds.",
                    this._currentTime).format(this._currentTime);
                break;
            case DialogMode.SHUTDOWN:
                text = ngettext(
                    "The computer will shut down in %d second.",
                    "The computer will shut down in %d seconds.",
                    this._currentTime).format(this._currentTime);
                break;
            case DialogMode.REBOOT:
                text = ngettext(
                    "The computer will restart in %d second.",
                    "The computer will restart in %d seconds.",
                    this._currentTime).format(this._currentTime);
                break;
        }

        this._messageDialogContent.description = text;
        this._currentTime--;

        return GLib.SOURCE_CONTINUE;
    }

    _presentInhibitorInfo(inhibitorInfos) {
        this._removeDelayTimer();
        this.clearButtons();
        this._messageDialogContent.description = null;

        const infos = inhibitorInfos;

        for (let i = 0; i < infos.length; i++) {
            const info = infos[i];
            const [nameStr, giconStr, reasonStr, id] = info;

            try {
                const name = (nameStr == "none") ? _("Unknown") : nameStr;
                const iconName = (giconStr == 'none') ? ('application-x-executable') : giconStr;

                const gicon = Gio.Icon.new_for_string(iconName);
                const icon = new St.Icon({ gicon: gicon });

                let item = new Dialog.ListSectionItem({
                    icon_actor: icon,
                    title: name,
                    description: reasonStr,
                });

                this._applicationsSection.list.add_child(item);
                this._applicationsSection.visible = true;
            } catch (e) {
                global.logError(e);
            }
        }

        this._addCancel();

        let button = this.addButton({
            label: _("Ignore and continue"),
            action: this._dialogProxy.IgnoreInhibitorsRemote.bind(this._dialogProxy),
            destructive_action: true,
            default: true
        });
        button.grab_key_focus();
    }

    close() {
        super.close();

        this._removeDelayTimer();
        this._dialogProxy = null;
    }
});
