//-*- indent-tabs-mode: nil-*-
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;

const DeskletManager = imports.ui.deskletManager;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Tweener = imports.ui.tweener;


const RIGHT_PANEL_POPUP_ANIMATE_TIME = 0.5;
const DESKLET_DESTROY_TIME = 0.5;

const ENABLED_DESKLETS_KEY = 'enabled-desklets';
const DESKLET_SNAP_KEY = 'desklet-snap';
const DESKLET_SNAP_INTERVAL_KEY = 'desklet-snap-interval';

let dragPlaceholder = new St.Bin({style_class: 'desklet-drag-placeholder'});
dragPlaceholder.hide();
Mainloop.idle_add(function() {
                      Main.uiGroup.add_actor(dragPlaceholder);
                  });
/**
 * Desklet
 *
 * @short_description: Base class of desklets
 *
 * #Desklet is a base class in which other desklets
 * can inherit
 */
function Desklet(metadata){
    this._init(metadata);
}

Desklet.prototype = {
    _init: function(metadata){
        this.metadata = metadata;

        this.actor = new St.BoxLayout({reactive: true, track_hover: true, vertical: true});

        this._header = new St.Bin({style_class: 'desklet-header'});
        this._header_label = new St.Label();
        this._header_label.set_text('Desklet');
        this._header.set_child(this._header_label);

        this.content = new St.Bin();

        this.actor.add_actor(this._header);
        this.actor.add_actor(this.content);

        this._updateDecoration();
        global.settings.connect('changed::desklets-minimum-decoration', Lang.bind(this, this._updateDecoration));

        this._menu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.LEFT, 0);
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuManager.addMenu(this._menu);
        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();

        this._menu.addAction(_("Remove this desklet"), Lang.bind(this, this._onRemoveDesklet));

        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.actor.connect('notify::hover', Lang.bind(this, this._onHover));

        this._uuid = null;
        this._deskletId = null;
        this.actor._desklet = this;
        this.actor._delegate = this;

        this._inhibitDrag = true;

        this._dragInProgress = false;
        this._dragStartX = null;
        this._dragStartY = null;
        this._dragOffsetX = null;
        this._dragOffsetY = null;
        this._onEventId = null;

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

        Main.layoutManager.addChrome(this.actor, {doNotAdd: true});
    },

    /**
     * setHeader:
     * @header: the header of the desklet
     *
     * Sets the header text of the desklet to @header
     */
    setHeader: function(header){
        this._header_label.set_text(header);
    },

    /**
     * setContent:
     * @actor: actor to be set as child
     * @params: (optional) parameters to be sent
     *
     * Sets the content actor of the desklet as @actor
     */
    setContent: function(actor, params){
        this.content.set_child(actor, params);
    },

    /**
     * destroy:
     *
     * Destroys the actor with an fading animation
     */
    destroy: function(){
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           transition: 'linear',
                           time: DESKLET_DESTROY_TIME,
                           onComplete: Lang.bind(this, function(){
                               this.actor.destroy();
                           })});
        this._menu.destroy();

        this._menu = null;
        this._menuManager = null;
        this.emit('destroy');
    },

    _updateDecoration: function(){
        let dec = global.settings.get_int('desklets-minimum-decoration');
        let localMin = this.metadata['minimum-decoration'];
        if (localMin){
            dec = Math.max(dec, localMin);
        }

        switch(dec){
        case 2:
            this._header.show();
            this.content.remove_style_pseudo_class('no-header');
            this.content.style_class = 'desklet-box';
            break;
        case 1:
            this._header.hide();
            this.content.style_class = 'desklet-box';
            this.content.add_style_pseudo_class('no-header');
            break;
        case 0:
            this._header.hide();
            this.content.style_class = null;
            break;
        }
    },
        
    on_desklet_clicked: function(event) {
        // Implemented by Desklets        
    },

    _onButtonReleaseEvent: function(actor, event){        
        if (event.get_button() == 3) {
            this._menu.toggle();
        } else {
            if (this._menu.isOpen) {
                this._menu.toggle();
            }
            this.on_desklet_clicked(event);
        }

    },

    _onHover: function(){
        if (this._dragInProgress)
            return;
        this._canDrag = !this._hasMouseWindow();
        if (!this._canDrag) {
            Main.layoutManager.untrackChrome(this.actor);
            Mainloop.timeout_add(200, Lang.bind(this, this._checkHover)); // notify::hover no longer works when actor is untracked. Constantly check if the actor should be freed
        }
    },

    _checkHover: function() {
        if(this._hasMouseWindow()) {
            Mainloop.timeout_add(200, Lang.bind(this, this._checkHover));
            return;
        }
        Main.layoutManager.addChrome(this.actor, {doNotAdd: true});
        return;
    },

    _hasMouseWindow: function(){
        let dummy = new Meta.Window(); // meta_screen_get_mouse_window requires a non-null not_this_one
        let window = global.screen.get_mouse_window(dummy);
        if (!window)
            return false;
        if (window.window_type == Meta.WindowType.DESKTOP)
            return false;
        return true;
    },

    _onRemoveDesklet: function(){
        DeskletManager.removeDesklet(this._uuid, this._desklet_id);
    },

    _onButtonPress: function(actor, event) {
        if (!this._canDrag)
            return;
        if (event.get_button() != 1)
            return;
        if (Tweener.getTweenCount(this.actor))
            return;

        this._grabActor();
        
        let [stageX, stageY] = event.get_coords();
        this._dragStartX = stageX;
        this._dragStartY = stageY;
    },


    _onEvent: function(actor, event) {
        switch (event.type()) {
        case Clutter.EventType.BUTTON_RELEASE:
            if (this._dragInProgress) {
                this._dropActor(event);
                return true;
            } else {
                this._ungrabActor();
                return false;
            }
            break;
        case Clutter.EventType.MOTION:
            if (this._dragInProgress) {
                return this._updateDragPosition(event);
            } else {
                return this._maybeStartDrag(event);
            }
            break;
        case Clutter.EventType.LEAVE:
            if (this._dragInProgress) {
                // Force the actor to follow the mouse
                return this._updateDragPosition(event);
            }
            break;
        default:
            return false;
        }

    },

    _grabActor: function() {
        Clutter.grab_pointer(this.actor);
        this._onEventId = this.actor.connect('event', Lang.bind(this, this._onEvent));
    },

    _ungrabActor: function() {
        Clutter.ungrab_pointer();
        if (this._onEventId) {
            this.actor.disconnect(this._onEventId);
            this._onEventId = null;
        }
    },

    _dropActor: function(event) {
        this._dragInProgress = false;

        let [dropX, dropY] = event.get_coords();

        // Update GSettings
        let enabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);
        for (let i = 0; i < enabledDesklets.length; i++){
            let definition = enabledDesklets[i];
            let elements = definition.split(":");
            if (elements[0] == this._uuid &&
                elements[1] == this._deskletId) {
                if (global.settings.get_boolean(DESKLET_SNAP_KEY)){
                    elements[2] = dragPlaceholder.x;
                    elements[3] = dragPlaceholder.y;
                } else {
                    elements[2] = dropX;
                    elements[3] = dropY;
                }
                enabledDesklets[i] = elements.join(":");
            }
        }
        global.settings.set_strv(ENABLED_DESKLETS_KEY, enabledDesklets);

        Main.uiGroup.remove_actor(this.actor);
        Main.deskletContainer.add_actor(this.actor);
        Main.layoutManager.addChrome(this.actor, {doNotAdd: true});

        dragPlaceholder.hide();

        this._ungrabActor();

        global.unset_cursor();
        global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
    },

    _updateDragPosition: function(stageX, stageY) {
        this.actor.set_position(stageX + this._dragOffsetX,
                                stageY + this._dragOffsetY);

        global.set_cursor(Cinnamon.Cursor.DND_MOVE);

        // If snap-to-grid is not enabled, we're done here. Continue otherwise
        if (!global.settings.get_boolean(DESKLET_SNAP_KEY))
            return true;

        let interval = global.settings.get_int(DESKLET_SNAP_INTERVAL_KEY);
        dragPlaceholder.set_position(Math.floor(this.actor.x/interval)*interval,
                                     Math.floor(this.actor.y/interval)*interval);
        dragPlaceholder.set_size(this.actor.width, this.actor.height);
        dragPlaceholder.show();

        return true;
    },

    _maybeStartDrag: function(event) {
        let [stageX, stageY] = event.get_coords();

        let threshold = Gtk.Settings.get_default().gtk_dnd_drag_threshold;
        if (Math.abs(stageX - this._dragStartX) > threshold ||
            Math.abs(stageY - this._dragStartY) > threshold) {
            this._startDrag();
            this._updateDragPosition(stageX, stageY);
        }

        return true;
    },

    _startDrag: function () {
        // Move actor to Main.uiGroup so that it is on top
        Main.layoutManager.untrackChrome(this.actor);
        Main.deskletContainer.remove_actor(this.actor);
        Main.uiGroup.add_actor(this.actor);

        global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);

        this._dragInProgress = true;

        global.set_cursor(Cinnamon.Cursor.DND_IN_DRAG);

        this._dragOffsetX = this.actor.x - this._dragStartX;
        this._dragOffsetY = this.actor.y - this._dragStartY;
    }
};
Signals.addSignalMethods(Desklet.prototype);
