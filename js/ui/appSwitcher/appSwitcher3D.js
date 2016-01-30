// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;

const AppSwitcher = imports.ui.appSwitcher.appSwitcher;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const INITIAL_DELAY_TIMEOUT = 150;
const CHECK_DESTROYED_TIMEOUT = 100;
const TRANSITION_TYPE = 'easeOutQuad';
const ICON_SIZE = 64;
const ICON_SIZE_BIG = 128;
const ICON_TITLE_SPACING = 10;
const PREVIEW_SCALE = 0.5;

const TITLE_POSITION = 7/8; // percent position
const ANIMATION_TIME = 0.25; // seconds
const SWITCH_TIME_DELAY = 100; // milliseconds
const DIM_FACTOR = 0.4; // percent

function AppSwitcher3D() {
    this._init.apply(this, arguments);
}

AppSwitcher3D.prototype = {
    __proto__: AppSwitcher.AppSwitcher.prototype,
    
    _init: function() {
        AppSwitcher.AppSwitcher.prototype._init.apply(this, arguments);

        this._windowTitle = null;
        this._icon = null;
        this._lastTime = 0;

        this._background = Meta.BackgroundActor.new_for_screen(global.screen);
        this._background.hide();
        global.overlay_group.add_actor(this._background);

        // create a container for all our widgets
        this.actor = new St.Widget({ visible: true, reactive: true, });
        this.actor.hide();
        this.previewActor = new St.Widget({ visible: true, reactive: true, });
        this.actor.add_actor(this.previewActor);
        
        Main.uiGroup.add_actor(this.actor);

        this._setupModal();
    },

    _show: function() {
        this._enableMonitorFix();
        
        let monitor = this._activeMonitor;
        this.actor.set_position(monitor.x, monitor.y);
        this.actor.set_size(monitor.width, monitor.height);

        // create previews
        this._createList();

        // hide windows and show Coverflow actors
        global.window_group.hide();
        this.actor.show();
        this._background.show();

        Main.panelManager.panels.forEach(function(panel) { panel.actor.set_reactive(false); });

        Tweener.addTween(this._background, {
            dim_factor: DIM_FACTOR,
            time: ANIMATION_TIME,
            transition: TRANSITION_TYPE
        });

        this._initialDelayTimeoutId = 0;

        this._next();
    },
    
    _hidePreviews: function(endOpacity) {
        let monitor = this._activeMonitor;
        
        // preview windows
        let currentWorkspace = global.screen.get_active_workspace();
        for (let i in this._previews) {
            let preview = this._previews[i];
            let metaWin = this._windows[i];
            let compositor = this._windows[i].get_compositor_private();

            if (i != this._currentIndex)
                preview.lower_bottom();
            let rotation_vertex_x = 0.0;
            if (preview.get_anchor_point_gravity() == Clutter.Gravity.EAST) {
                rotation_vertex_x = preview.width / 2;
            } else if (preview.get_anchor_point_gravity() == Clutter.Gravity.WEST) {
                rotation_vertex_x = -preview.width / 2;
            }
            preview.move_anchor_point_from_gravity(compositor.get_anchor_point_gravity());
            preview.rotation_center_y = new Clutter.Vertex({ x: rotation_vertex_x, y: 0.0, z: 0.0 });

            Tweener.addTween(preview, {
                opacity: (!metaWin.minimized && metaWin.get_workspace() == currentWorkspace
                    || metaWin.is_on_all_workspaces()) ? endOpacity : 0,
                x: ((metaWin.minimized) ? 0 : compositor.x) - monitor.x,
                y: ((metaWin.minimized) ? 0 : compositor.y) - monitor.y,
                width: (metaWin.minimized) ? 0 : compositor.width,
                height: (metaWin.minimized) ? 0 : compositor.height,
                rotation_angle_y: 0.0,
                time: ANIMATION_TIME,
                transition: TRANSITION_TYPE,
                onComplete: Lang.bind(preview, preview.destroy),
            });
        }
    },
    
    _hide: function() {
        this._hidePreviews(255);
        
        // window title and icon
        if(this._windowTitle) {
            this._windowTitle.hide();
            this._applicationIconBox.hide();
        }

        // panels
        Main.panelManager.panels.forEach(function(panel) { panel.actor.set_reactive(true); });

        // background
        Tweener.removeTweens(this._background);
        Tweener.addTween(this._background, {
            dim_factor: 1.0,
            time: ANIMATION_TIME,
            transition: TRANSITION_TYPE,
            onComplete: Lang.bind(this, this._destroyActors),
        });
        this._disableMonitorFix();
    },

    _checkSwitchTime: function() {
        let t = new Date().getTime();
        if(t - this._lastTime < SWITCH_TIME_DELAY)
            return false;

        this._lastTime = t;
        return true;
    },

    _onWorkspaceSelected: function() {
        this._hidePreviews(0);
        
        this._windows = AppSwitcher.getWindowsForBinding(this._binding);
        this._currentIndex = this._windows.indexOf(global.display.focus_window);
        
        // create previews
        this._createList();
        this._next();
    },

    _createList: function() {
        let monitor = this._activeMonitor;
        let currentWorkspace = global.screen.get_active_workspace();
        
        this._previews = [];
        
        for (let i in this._windows) {
            let metaWin = this._windows[i];
            let compositor = this._windows[i].get_compositor_private();
            if (compositor) {
                let texture = compositor.get_texture();
                let [width, height] = texture.get_size();

                let scale = 1.0;
                let previewWidth = monitor.width * PREVIEW_SCALE;
                let previewHeight = monitor.height * PREVIEW_SCALE;
                if (width > previewWidth || height > previewHeight)
                    scale = Math.min(previewWidth / width, previewHeight / height);

                let preview = new St.Button({
                    opacity: (!metaWin.minimized && metaWin.get_workspace() == currentWorkspace || metaWin.is_on_all_workspaces()) ? 255 : 0,
                    reactive: true,
                    anchor_gravity: Clutter.Gravity.CENTER,
                    x: ((metaWin.minimized) ? 0 : compositor.x + compositor.width / 2) - monitor.x,
                    y: ((metaWin.minimized) ? 0 : compositor.y + compositor.height / 2) - monitor.y
                });

                preview.target_width = Math.round(width * scale);
                preview.target_height = Math.round(height * scale);
                preview.target_width_side = preview.target_width * 2/3;
                preview.target_height_side = preview.target_height;

                
                preview.set_child(new Clutter.Clone({ source: texture }));
                preview.metaWindow = metaWin;
                preview.connect('clicked', Lang.bind(this, this._cloneClicked));

                this._previews.push(preview);
                this.previewActor.add_actor(preview);
            }
        }
        
        this._adaptClones();
    },
    
    _adaptClones: function() {
    },

    _cloneClicked: function(actor) {
        this._currentIndex = this._previews.indexOf(actor);
        this._activateSelected();
    },
    
    _setCurrentWindow: function(window) {
        let monitor = this._activeMonitor;

        // window title label
        if (this._windowTitle) {
            Tweener.addTween(this._windowTitle, {
                opacity: 0,
                time: ANIMATION_TIME,
                transition: TRANSITION_TYPE,
                onComplete: Lang.bind(this.actor, this.actor.remove_actor, this._windowTitle),
            });
        }

        this._windowTitle = new St.Label({
            style_class: 'switcher-list',
            text: this._windows[this._currentIndex].get_title(),
            opacity: 0
        });

        // ellipsize if title is too long
        this._windowTitle.set_style("max-width:" + (monitor.width - 200) + "px;font-size: 14px;font-weight: bold; padding: 14px;");
        this._windowTitle.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        this.actor.add_actor(this._windowTitle);
        Tweener.addTween(this._windowTitle, {
            opacity: 255,
            time: ANIMATION_TIME,
            transition: TRANSITION_TYPE,
        });
        
        let cx = Math.round((monitor.width + (ICON_SIZE * global.ui_scale) + (ICON_TITLE_SPACING * global.ui_scale)) / 2);
        let cy = Math.round(monitor.height * TITLE_POSITION);
        
        this._windowTitle.x = cx - Math.round(this._windowTitle.get_width()/2);
        this._windowTitle.y = cy - Math.round(this._windowTitle.get_height()/2);

        // window icon
        if (this._applicationIconBox) {
            Tweener.addTween(this._applicationIconBox, {
                opacity: 0,
                time: ANIMATION_TIME,
                transition: TRANSITION_TYPE,
                onComplete: Lang.bind(this.actor, this.actor.remove_actor, this._applicationIconBox),
            });
        }

        let app = this._tracker.get_window_app(this._windows[this._currentIndex]);
        this._icon = app ? app.create_icon_texture(ICON_SIZE) : null;

        if (!this._icon) {
            this._icon = new St.Icon({
                icon_name: 'applications-other',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: ICON_SIZE
            });
        }

        this._applicationIconBox = new St.Bin({
            style_class: 'window-iconbox',
            opacity: 0,
            x: Math.round(this._windowTitle.x - (ICON_SIZE * global.ui_scale) - (ICON_TITLE_SPACING * global.ui_scale)),
            y: Math.round(cy - (ICON_SIZE * global.ui_scale) / 2 )
        });

        this._applicationIconBox.add_actor(this._icon);
        this.actor.add_actor(this._applicationIconBox);
        Tweener.addTween(this._applicationIconBox, {
            opacity: 255,
            time: ANIMATION_TIME,
            transition: TRANSITION_TYPE,
        });
    },

    _destroyActors: function() {
        global.overlay_group.remove_actor(this._background);
        Main.uiGroup.remove_actor(this.actor);
        this.actor.destroy();

        // show all window actors
        global.window_group.show();
    },

    _onDestroy: function() {
        this._windowTitle = null;
        this._icon = null;
        this._applicationIconBox = null;
        this._previews = null;
    },
    
    _enableMonitorFix: function() {
        if(global.screen.get_n_monitors() < 2)
            return;
        
        this._monitorFix = true;
        this._oldWidth = global.stage.width;
        this._oldHeight = global.stage.height;
        
        let width = 2 * (this._activeMonitor.x + this._activeMonitor.width/2);
        let height = 2 * (this._activeMonitor.y + this._activeMonitor.height/2);
        
        global.stage.set_size(width, height);
    },
    
    _disableMonitorFix: function() {
        if(this._monitorFix) {
            global.stage.set_size(this._oldWidth, this._oldHeight);
            this._monitorFix = false;
        }
    }
};
