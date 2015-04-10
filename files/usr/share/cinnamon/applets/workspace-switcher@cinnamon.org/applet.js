const St = imports.gi.St;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {        
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {
            this.actor.set_style_class_name("workspace-switcher-box");
            this.actor.connect('scroll-event', this.hook.bind(this));
            this.set_applet_tooltip(_("Switch workspace"));
            this.button = [];
            this._createButtons();
            global.screen.connect('notify::n-workspaces', Lang.bind(this, this._createButtons));
            global.window_manager.connect('switch-workspace', Lang.bind(this, this._updateButtons));   
            this.on_panel_edit_mode_changed();
            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));

            let expo = new PopupMenu.PopupIconMenuItem(_("Manage workspaces (Expo)"),
                    "view-grid-symbolic",
                    St.IconType.SYMBOLIC);
            expo.connect('activate', Lang.bind(this, function() {
                if (!Main.expo.animationInProgress)
                    Main.expo.toggle();
            }));
            this._applet_context_menu.addMenuItem(expo);
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        
    },
    
    on_panel_edit_mode_changed: function() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        for ( let i=0; i<this.button.length; ++i ) {
            this.button[i].reactive = reactive;            
        }
    }, 
    
    hook: function(actor, event){
        var direction = event.get_scroll_direction();
        if(direction==0) this.switch_workspace(-1);
        if(direction==1) this.switch_workspace(1);
    },
    
    switch_workspace: function(incremental){
        var index = global.screen.get_active_workspace_index();
        index += incremental;
        if(global.screen.get_workspace_by_index(index) != null) {
            global.screen.get_workspace_by_index(index).activate(global.get_current_time());
        }
    },
    
    _createButtons: function() {
        for ( let i=0; i<this.button.length; ++i ) {
            this.button[i].destroy();
        }

        this.button = [];
        for ( let i=0; i<global.screen.n_workspaces; ++i ) {
            this.button[i] = new St.Button({ name: 'workspaceButton',
                                     style_class: 'workspace-button',
                                     reactive: true });
            let text = '';
            if ( i == global.screen.get_active_workspace_index() ) {
                text = (i+1).toString();
                this.button[i].add_style_pseudo_class('outlined');
            }
            else {
                text = (i+1).toString();
            }
            let label = new St.Label({ text: text });
            this.button[i].set_child(label);
            this.actor.add(this.button[i]);
            if (this._scaleMode) {
                this.button[i].set_height(this._panelHeight);
            }
            let index = i;
            this.button[i].connect('button-release-event', Lang.bind(this, function() {
                let metaWorkspace = global.screen.get_workspace_by_index(index);
                metaWorkspace.activate(global.get_current_time());
            }));
        }
    },

    on_panel_height_changed: function() {
        this._createButtons();
    },

    _updateButtons: function() {
        for ( let i=0; i<this.button.length; ++i ) {
            this.button[i].get_child().set_text((i+1).toString());
            this.button[i].change_style_pseudo_class('outlined', i == global.screen.get_active_workspace_index());
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}
