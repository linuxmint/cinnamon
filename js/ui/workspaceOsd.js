// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Layout = imports.ui.layout;
const Main = imports.ui.main;

var ANIMATION_TIME = 100;
var DISPLAY_TIMEOUT = 600;


var WorkspaceOsd = GObject.registerClass(
class WorkspaceOsd extends Clutter.Actor {
    _init(monitorIndex) {
        super._init({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
        });

        this._monitorIndex = monitorIndex;

        this.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);

        let constraint = new Layout.MonitorConstraint({
            index: monitorIndex,
            work_area: true,
        });
        this.add_constraint(constraint);

        Main.uiGroup.add_actor(this);

        this._timeoutId = 0;

        this._vbox = new St.BoxLayout({
            style_class: 'workspace-switch-osd',
            important: true,
            vertical: true,
        });
        this.add_child(this._vbox);

        this._labelBin = new St.Bin();
        this._activeWorkspaceName = null;
        this._label = null;
        this._vbox.add_child(this._labelBin);

        this._list = new St.BoxLayout({
            style_class: 'workspace-switch-osd-indicator-box',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._vbox.add_child(this._list);

        this._redisplay();

        this.hide();

        let workspaceManager = global.workspace_manager;
        this._workspaceManagerSignals = [];
        this._workspaceManagerSignals.push(workspaceManager.connect('workspace-added',
                                                                    this._redisplay.bind(this)));
        this._workspaceManagerSignals.push(workspaceManager.connect('workspace-removed',
                                                                    this._redisplay.bind(this)));

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _redisplay() {
        if (!this._activeWorkspaceName)
            return;

        if (this._label !== null)
            this._label.destroy();

        this._label = new St.Label ({
            text: this._activeWorkspaceName,
        });

        this._labelBin.set_child(this._label);

        let workspaceManager = global.workspace_manager;

        this._list.destroy_all_children();

        for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            const indicator = new St.Bin({
                style_class: 'workspace-switch-osd-indicator',
            });

            if (i === this._activeWorkspaceIndex)
                indicator.add_style_pseudo_class('active');

            this._list.add_actor(indicator);
        }
    }

    display(activeWorkspaceIndex, workspaceName) {
        this._activeWorkspaceIndex = activeWorkspaceIndex;
        this._activeWorkspaceName = workspaceName;

        this._redisplay();
        if (this._timeoutId != 0)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISPLAY_TIMEOUT, this._onTimeout.bind(this));
        GLib.Source.set_name_by_id(this._timeoutId, '[cinnamon] this._onTimeout');

        const duration = this.visible ? 0 : ANIMATION_TIME;
        this.show();
        this.opacity = 0;
        this.ease({
            opacity: 255,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _onTimeout() {
        GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
        this.ease({
            opacity: 0.0,
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy(),
        });
        return GLib.SOURCE_REMOVE;
    }

    _onDestroy() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;

        let workspaceManager = global.workspace_manager;
        for (let i = 0; i < this._workspaceManagerSignals.length; i++)
            workspaceManager.disconnect(this._workspaceManagerSignals[i]);

        this._workspaceManagerSignals = [];
    }
});
