const St = imports.gi.St;
const Lang = imports.lang;
const Applet = imports.ui.applet;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {        
        Applet.Applet.prototype._init.call(this, orientation);
        
        try {                    
            this.set_applet_tooltip(_("Switch workspace"));
            this.button = [];
            this._createButtons();
            global.screen.connect('notify::n-workspaces', Lang.bind(this, this._createButtons));
            global.window_manager.connect('switch-workspace', Lang.bind(this, this._updateButtons));                                                                                                                            
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        
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
            let index = i;
            this.button[i].connect('clicked', Lang.bind(this, function() {
                let metaWorkspace = global.screen.get_workspace_by_index(index);
                metaWorkspace.activate(global.get_current_time());
            }));
        }
    },

    _updateButtons: function() {
        for ( let i=0; i<this.button.length; ++i ) {
            if ( i == global.screen.get_active_workspace_index() ) {
                this.button[i].get_child().set_text((i+1).toString());
                this.button[i].add_style_pseudo_class('outlined');
            }
            else {
                this.button[i].get_child().set_text((i+1).toString());
                this.button[i].remove_style_pseudo_class('outlined');
            }
        }
    }
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
