const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_symbolic_name("user-trash");
            this.set_applet_tooltip(_("Trash"));

            this.trash_path = 'trash:///';
            this.trash_directory =  Gio.file_new_for_uri(this.trash_path);

            this._initContextMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },

    _initContextMenu: function () {
        this.open_item = new PopupMenu.PopupIconMenuItem(_("Open Trash"),
                Gtk.STOCK_OPEN,
                St.IconType.SYMBOLIC);
        this.open_item.connect('activate', Lang.bind(this, this._openTrash));
        this._applet_context_menu.addMenuItem(this.open_item);
    },

    on_applet_clicked: function(event) {
        this._openTrash();
    },

    _openTrash: function() {
        Gio.app_info_launch_default_for_uri(this.trash_directory.get_uri(), null);
    },

    on_orientation_changed: function (orientation) {
        this._initContextMenu();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
