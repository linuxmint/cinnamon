const Applet = imports.ui.applet;

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        this.set_applet_icon_path(metadata.path + "/icon.png");
        this.actor.style = 'width:10px';
    },
}; 

function main(metadata, orientation) {
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}
