const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;
 
function MyApplet(orientation) {
    this._init(orientation);
}
 
MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
 
    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);
 
        try {
            this.set_applet_icon_name("window-close");
            this.set_applet_tooltip(_("Click here to kill a misbehaving window"));
        }
        catch (e) {
            global.logError(e);
        }
     },
 
    on_applet_clicked: function(event) {
		GLib.spawn_command_line_async('notify-send --icon=application-exit XKILL \"Click on the misbehaving window to kill it\"');
        GLib.spawn_command_line_async('xkill');
    }
};
 
function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
