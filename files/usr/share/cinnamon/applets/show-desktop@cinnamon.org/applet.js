const Applet = imports.ui.applet;
const Main = imports.ui.main;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        this.set_applet_icon_name("user-desktop");
        this.set_applet_tooltip(_("Show desktop"));
    },
    
    on_applet_clicked: function(event) {
        global.screen.toggle_desktop(global.get_current_time());
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
