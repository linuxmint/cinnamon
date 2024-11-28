// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Dialog = imports.ui.dialog;
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const {BarLevel} = imports.ui.barLevel;
const {Separator} = imports.ui.separator;

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

const DIALOG_WIDTH = 800;
const DIALOG_HEIGHT = 300;

var EndSessionDialog = class {
    constructor(mode) {
        this._mode = mode;
        this._inhibited = false;
        this._settings = new Gio.Settings({ schema_id: 'org.cinnamon.SessionManager' });
        this._delay_duration = this._settings.get_int("quit-time-delay");
        this._current_time = this._delay_duration;
        this._progress_timer_id = 0;
        this._default_action = null;

        // persistent actors
        this._dialog = null;
        this._inhibitor_table = null;
        this._progress_label = null;
        this._progress_bar = null;

        this._dialog = new Dialog.Dialog(Main.uiGroup, 'end-session-dialog');
        global.focus_manager.add_group(this._dialog);
        Main.layoutManager.trackChrome(this._dialog);


        this._dialog_proxy = new Gio.DBusProxy(
            {
                g_connection: Gio.DBus.session,
                g_interface_name: "org.cinnamon.SessionManager.EndSessionDialog",
                g_interface_info: SessionDialogInfo,
                g_name: 'org.gnome.SessionManager',
                g_object_path: '/org/gnome/SessionManager',
                g_flags: Gio.DBusProxyFlags.DO_NOT_AUTO_START
            }
        );

        this._dialog_proxy.init(null);

        this._dialog_proxy.connect("g-signal", this._proxy_signal_received.bind(this));
        this._dialog_proxy.GetCapabilitiesRemote(this._get_capabilities_cb.bind(this));
    }

    _proxy_signal_received(proxy, sender, signal, params) {
        if (signal === "InhibitorsChanged") {
            const inhibitors = params.deep_unpack()[0];
            if (inhibitors && inhibitors.length > 0) {
                this._inhibited = true;
                this._present_inhibitor_info(inhibitors);
            } else {
                if (this._inhibited) {
                    this._dialog_proxy.IgnoreInhibitorsRemote();
                }
            }
        }
    }

    _add_cancel() {
        this._dialog.addButton({
            label: _("Cancel"),
            action: () => {
                this._dialog_proxy.CancelRemote();
            },
            key: Clutter.KEY_Escape
        });
    }

    _get_capabilities_cb(result, error) {
        if (error) {
            global.logError('Error getting capabilities: ' + error.message);
            return;
        }

        var [can_switch_user, can_stop, can_restart, can_hybrid_sleep, can_suspend, can_hibernate, can_logout] = result[0];
        var content = null;

        switch(this._mode) {
            case DialogMode.LOGOUT:
                if (can_switch_user) {
                    this._dialog.addButton({
                        label: _("Switch User"),
                        action: this._dialog_proxy.SwitchUserRemote.bind(this._dialog_proxy)
                    });
                }

                this._add_cancel()

                this._default_action = this._dialog_proxy.LogoutRemote.bind(this._dialog_proxy);
                this._dialog.addButton({
                    label: _("Log Out"),
                    action: this._default_action,
                    destructive_action: true,
                    default: true
                });

                content = new Dialog.MessageDialogContent({
                    title: _("Log Out?")
                });

                break;
            case DialogMode.SHUTDOWN:
                if (can_suspend) {
                    this._dialog.addButton({
                        label: _("Suspend"),
                        action: this._dialog_proxy.SuspendRemote.bind(this._dialog_proxy)
                    });
                }
                if (can_hibernate) {
                    this._dialog.addButton({
                        label: _("Hibernate"),
                        action: this._dialog_proxy.HibernateRemote.bind(this._dialog_proxy)
                    });
                }

                this._add_cancel();

                if (can_restart) {
                    this._dialog.addButton({
                        label: _("Restart"),
                        action: this._dialog_proxy.RestartRemote.bind(this._dialog_proxy),
                    });
                }
                if (can_stop) {
                    this._default_action = this._dialog_proxy.ShutdownRemote.bind(this._dialog_proxy);
                    this._dialog.addButton({
                        label: _("Shut Down"),
                        action: this._default_action,
                        destructive_action: true,
                        default: true,
                    });
                }

                content = new Dialog.MessageDialogContent({
                    title: _("Shut Down?")
                });

                break;
            case DialogMode.REBOOT:
                if (!can_restart) {
                    global.logError("Restart not available");
                    this._dialog_proxy.CancelRemote();
                    this.destroy();
                    return;
                }

                this._add_cancel();

                this._default_action = this._dialog_proxy.RestartRemote.bind(this._dialog_proxy);
                this._dialog.addButton({
                    label: _("Restart"),
                    action: this._default_action,
                    destructive_action: true,
                    default: true
                });

                content = new Dialog.MessageDialogContent({
                    title: _("Restart?")
                });

                break
        }

        this._dialog.contentLayout.add_child(content);

        if (this._settings.get_boolean("quit-delay-toggle")) {
            this._add_delay_timer();
        }

        this._position_dialog();
    }

    _position_dialog() {
        const monitor = Main.layoutManager.currentMonitor;

        this._dialog.set_position(
            monitor.x + Math.floor((monitor.width - this._dialog.width) / 2),
            monitor.y + Math.floor((monitor.height - this._dialog.height) / 2)
        );
    }

    _add_delay_timer() {
        this._progress_label = new St.Label();
        this._dialog.contentLayout.add_child(this._progress_label);

        this._progress_bar = new BarLevel({ style_class: "end-session-dialog-progress-bar", value: 1.0, maximum_value: 1.0 });
        this._dialog.contentLayout.add_child(this._progress_bar);

        this._update_progress();

        this._progress_timer_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, this._update_progress.bind(this));
    }

    _remove_delay_timer() {
        if (this._progress_timer_id) {
            GLib.source_remove(this._progress_timer_id);
            this._progress_timer_id = 0;
        }
    }

    _update_progress() {
        this._progress_bar.value = (this._current_time / this._delay_duration);

        if (this._current_time == 0) {
            if (this._default_action != null) {
                this._default_action();
            }

            this._progress_timer_id = 0;
            return GLib.SOURCE_REMOVE;
        }

        let text = "";

        switch(this._mode) {
            case DialogMode.LOGOUT:
                text = ngettext(
                    "You will be logged out in %d second.",
                    "You will be logged out in %d seconds.",
                    this._current_time).format(this._current_time);
                break;
            case DialogMode.SHUTDOWN:
                text = ngettext(
                    "The computer will shut down in %d second.",
                    "The computer will shut down in %d seconds.",
                    this._current_time).format(this._current_time);
                break;
            case DialogMode.REBOOT:
                text = ngettext(
                    "The computer will restart in %d second.",
                    "The computer will restart in %d seconds.",
                    this._current_time).format(this._current_time);
                break;
        }

        this._progress_label.set_text(text);

        this._current_time--;

        return GLib.SOURCE_CONTINUE;
    }

    _present_inhibitor_info(inhibitor_infos) {
        this._remove_delay_timer();

        this._dialog.clearButtons();
        this._dialog.contentLayout.remove_all_children();

        const content = new Dialog.MessageDialogContent({
            title: _("Some programs are still running"),
            description: _("Waiting for programs to finish. Interrupting these programs may cause you to lose work.")
        });
        this._dialog.contentLayout.add_child(content);

        const bin = new St.Bin({ style_class: "end-session-dialog-inhibitor-list-frame" });
        this._dialog.contentLayout.add_child(bin);

        this._inhibitor_table = new St.Table({ style_class: "end-session-dialog-inhibitor-list" });
        bin.set_child(this._inhibitor_table);

        let row = 0;


        const infos = inhibitor_infos;

        for (let i = 0; i < infos.length; i++) {
            const info = infos[i];
            const [name_str, gicon_str, reason_str, id] = info;

            try {
                const name = (name_str == "none") ? _("Unknown") : name_str;
                const app = new St.Label({ text: name });

                const reason = new St.Label({ text: reason_str, style_class: "end-session-dialog-inhibitor-list-reason" });
                reason.clutter_text.line_wrap = true;

                const gicon = Gio.Icon.new_for_string(gicon_str);
                const icon = new St.Icon({ gicon: gicon });

                this._inhibitor_table.add(app, {
                    row: row,
                    col: 0,
                    col_span: 1,
                    x_align: St.Align.START
                });

                this._inhibitor_table.add(reason, {
                    row: row,
                    col: 1,
                    col_span: 1,
                    x_expand: true,
                });

                row++;

                if (i < infos.length - 1) {
                    this._inhibitor_table.add(new Separator().actor, {
                        row: row,
                        col: 0,
                        col_span: 2,
                        x_expand: true
                    });

                    row++;
                }
            } catch (e) {
                global.logError(e);
            }
        }

        this._add_cancel();

        this._dialog.addButton({
            label: _("Ignore and continue"),
            action: this._dialog_proxy.IgnoreInhibitorsRemote.bind(this._dialog_proxy),
            destructive_action: true,
            default: true
        });
    }

    destroy() {
        this._remove_delay_timer()

        this._dialog_proxy = null;
        this._dialog.destroy();
        this._dialog = null;
    }
};

