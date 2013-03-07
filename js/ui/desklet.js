//-*- indent-tabs-mode: nil-*-
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;

const DeskletManager = imports.ui.deskletManager;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Tweener = imports.ui.tweener;


const RIGHT_PANEL_POPUP_ANIMATE_TIME = 0.5;
const DESKLET_DESTROY_TIME = 0.5;

/**
 * Desklet
 *
 * @short_description: Base class of desklets
 *
 * #Desklet is a base class in which other desklets
 * can inherit
 */
function Desklet(metadata, desklet_id){
    this._init(metadata, desklet_id);
}

Desklet.prototype = {
    _init: function(metadata, desklet_id){
        this.metadata = metadata;
        this.instance_id = desklet_id;
        this.actor = new St.BoxLayout({reactive: true, track_hover: true, vertical: true});

        this._header = new St.Bin({style_class: 'desklet-header'});
        this._header_label = new St.Label();
        this._header_label.set_text('Desklet');
        this._header.set_child(this._header_label);

        this.content = new St.Bin();

        this.actor.add_actor(this._header);
        this.actor.add_actor(this.content);

        this._updateDecoration();
        global.settings.connect('changed::desklet-decorations', Lang.bind(this, this._updateDecoration));

        this._menu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.LEFT, 0);
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuManager.addMenu(this._menu);
        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();

        this._menu.addAction(_("Remove this desklet"), Lang.bind(this, this._onRemoveDesklet));

        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.actor.connect('notify::hover', Lang.bind(this, this._onHover));

        this._uuid = null;
        this._dragging = false;
        this._dragOffset = [0, 0];
        this.actor._desklet = this;
        this.actor._delegate = this;

        this._draggable = DND.makeDraggable(this.actor, {restoreOnSuccess: true}, Main.deskletContainer.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, function(){
                                                            global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
                                                            Main.layoutManager.untrackChrome(this.actor);
                                                        }));
        this._draggable.connect('drag-end', function(){
                                    global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
                                });
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
        let dec = global.settings.get_int('desklet-decorations');
        let preventDecorations = this.metadata['prevent-decorations'];
        if (preventDecorations == true){
            dec = 0;
        }
                      
        switch(dec){
        case 0:
            this._header.hide();    
            this.content.style_class = 'desklet';        
            break;
        case 1:
            this._header.hide();            
            this.content.style_class = 'desklet-with-borders';
            break;
        case 2:
            this._header.show();
            this.content.style_class = 'desklet-with-borders-and-header';
            break;
        }
    },
        
    on_desklet_clicked: function(event) {
        // Implemented by Desklets        
    },

    _onButtonReleaseEvent: function(actor, event){        
        if (event.get_button() == 3) {
            this._menu.toggle();
        }
        else {
            if (this._menu.isOpen) {
                this._menu.toggle();
            }
            this.on_desklet_clicked(event);
        }
    },

    _onHover: function(){
        if (!this._draggable._dragInProgress){
            this._draggable.inhibit = this._hasMouseWindow();
            if (this._draggable.inhibit) {
                Main.layoutManager.untrackChrome(this.actor);
                Mainloop.timeout_add(200, Lang.bind(this, this._checkHover)); // notify::hover no longer works when actor is untracked. Constantly check if the actor should be freed
            }
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
        DeskletManager.removeDesklet(this._uuid, this.instance_id);
    },

    getDragActor: function(){
        return this.actor;
    }
};
Signals.addSignalMethods(Desklet.prototype);
