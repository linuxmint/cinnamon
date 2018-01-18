// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;

function WindowAttentionHandler() {
    this._init();
}

WindowAttentionHandler.prototype = {
    _init : function() {
        this._tracker = Cinnamon.WindowTracker.get_default();
        global.display.connect('window-demands-attention', Lang.bind(this, this._onWindowDemandsAttention));
    },

    _onWindowDemandsAttention : function(display, window) {
        // We don't want to show the notification when the window is already focused,
        // because this is rather pointless.
        // Some apps (like GIMP) do things like setting the urgency hint on the
        // toolbar windows which would result into a notification even though GIMP itself is
        // focused.
        // We are just ignoring the hint on skip_taskbar windows for now.
        // (Which is the same behaviour as with metacity + panel)

        if (!window || window.has_focus() || window.is_skip_taskbar()) {
            return;
        }

        let wmclass = window.get_wm_class();

        if (wmclass) {
            let ignored_classes = global.settings.get_strv("demands-attention-ignored-wm-classes");

            for (let i = 0; i < ignored_classes.length; i++) {
                if (wmclass.toLowerCase().includes(ignored_classes[i].toLowerCase())) {
                    return;
                }
            }
        }

        try {
            if (this._tracker.is_window_interesting(window)) {
                if (global.settings.get_boolean("bring-windows-to-current-workspace")) {
                    window.change_workspace(global.screen.get_active_workspace());
                }
                else {
                    if (global.screen.get_active_workspace().index() != window.get_workspace().index()) {
                        window.get_workspace().activate(global.get_current_time());
                    }
                }
                if (!global.settings.get_boolean("prevent-focus-stealing")) {
                    window.activate(global.get_current_time());
                }
            }
        }
        catch (e) {
            global.logError('Error showing window demanding attention', e);
        }
    }
};

function Source(app, window) {
    this._init(app, window);
}

Source.prototype = {
    __proto__ : MessageTray.Source.prototype,

    _init: function(app, window) {
        MessageTray.Source.prototype._init.call(this, app.get_name());
        this._window = window;
        this._app = app;
        this._setSummaryIcon(this.createNotificationIcon());

        this.signalIDs = [];
        this.signalIDs.push(this._window.connect('notify::demands-attention', Lang.bind(this, function() { this.destroy(); })));
        this.signalIDs.push(this._window.connect('focus', Lang.bind(this, function() { this.destroy(); })));
        this.signalIDs.push(this._window.connect('unmanaged', Lang.bind(this, function() { this.destroy(); })));

        this.connect('destroy', Lang.bind(this, this._onDestroy));
    },

    _onDestroy : function() {
        for(let i = 0; i < this.signalIDs.length; i++) {
           this._window.disconnect(this.signalIDs[i]);
        }
        this.signalIDs = [];
    },

    createNotificationIcon : function() {
        return this._app.create_icon_texture(this.ICON_SIZE);
    },

    open : function(notification) {
        Main.activateWindow(this._window);
        this.destroy();
    }
};
