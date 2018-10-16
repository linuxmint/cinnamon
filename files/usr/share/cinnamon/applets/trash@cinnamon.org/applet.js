const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const MESSAGE = _("Are you sure you want to delete all items from the trash?") + "\n" + _("This operation cannot be undone.");

class CinnamonTrashApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("user-trash");
        this.set_applet_tooltip(_("Trash"));

        this.trash_path = 'trash:///';
        this.trash_directory =  Gio.file_new_for_uri(this.trash_path);

        this._initContextMenu();

        this.trash_changed_timeout = 0;

        this._onTrashChange();

        this.monitor = this.trash_directory.monitor_directory(0, null);
        this.monitor.connect('changed', Lang.bind(this, this._onTrashChange));
    }

    _initContextMenu() {
        this.empty_item = new PopupMenu.PopupIconMenuItem(_("Empty Trash"),
                "list-remove",
                St.IconType.SYMBOLIC);
        this.empty_item.connect('activate', Lang.bind(this, this._emptyTrash));
        this._applet_context_menu.addMenuItem(this.empty_item);

        this.open_item = new PopupMenu.PopupIconMenuItem(_("Open Trash"),
                "document-open",
                St.IconType.SYMBOLIC);
        this.open_item.connect('activate', Lang.bind(this, this._openTrash));
        this._applet_context_menu.addMenuItem(this.open_item);
    }

    on_applet_clicked(event) {
        this._openTrash();
    }

    _openTrash() {
        Gio.app_info_launch_default_for_uri(this.trash_directory.get_uri(), null);
    }

    _onTrashChange() {
        if (this.trash_changed_timeout > 0) {
            Mainloop.source_remove(this.trash_changed_timeout);
            this.trash_changed_timeout = 0;
        }

        this.trash_changed_timeout = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._onTrashChangeTimeout));
    }

    _onTrashChangeTimeout() {
        this.trash_changed_timeout = 0;
        if (this.trash_directory.query_exists(null)) {
            let children = this.trash_directory.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
            if (children.next_file(null) == null) {
                this.set_applet_icon_symbolic_name("user-trash");
            } else {
                this.set_applet_icon_symbolic_name("user-trash-full");
            }
            children.close(null);
        }
    }

    _emptyTrash() {
        new ModalDialog.ConfirmDialog(MESSAGE, this._doEmptyTrash).open();
    }

    _doEmptyTrash() {
        Util.spawn(['gio', 'trash', '--empty']);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonTrashApplet(orientation, panel_height, instance_id);
}
