const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;

function MyApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {
            Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_symbolic_name("show-desktop");
            this.set_applet_tooltip(_("Show desktop"));
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        global.screen.toggle_desktop(global.get_current_time());
    }
};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(metadata, orientation, panel_height);
    return myApplet;
}
