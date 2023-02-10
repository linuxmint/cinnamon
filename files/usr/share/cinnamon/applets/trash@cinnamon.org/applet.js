const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
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

        this.trash_changed_timeout = 0;

        const vfs = Gio.Vfs.get_default()
        if (vfs.get_supported_uri_schemes().includes("trash")) {
            this._initContextMenu();

            this.trash_path = 'trash:///';
            this.trash_directory =  Gio.file_new_for_uri(this.trash_path);
            this._onTrashChange();
        } else {
            this.trash_directory = null;
            global.logWarning("trash@cinnamon.org: No trash support, disabling.")
            this.actor.hide();
        }
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

    on_applet_added_to_panel() {
        if (this.trash_directory == null) {
            return;
        }

        this.monitor = this.trash_directory.monitor_directory(0, null);
        this.monitor_changed_id = this.monitor.connect('changed', Lang.bind(this, this._onTrashChange));
    }

    on_applet_removed_from_panel() {
        if (this.trash_directory == null) {
            return;
        }

        if (this.monitor_changed_id > 0) {
            this.monitor.disconnect(this.monitor_changed_id);
            this.monitor_changed_id = 0;
        }

        this.moniitor = 0;
    }

    _openTrash() {
        Gio.app_info_launch_default_for_uri(this.trash_directory.get_uri(), null);
    }

    _onTrashChange() {
        if (this.trash_changed_timeout > 0) {
            Mainloop.source_remove(this.trash_changed_timeout);
            this.trash_changed_timeout = 0;
        }

        this.trash_changed_timeout = Mainloop.idle_add(Lang.bind(this, this._onTrashChangeTimeout), GLib.PRIORITY_LOW);
    }

    _onTrashChangeTimeout() {
        this.trash_changed_timeout = 0;
        const children = this.trash_directory.enumerate_children_async(
            'standard::*',
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_LOW,
            null,
            (...args) => this._enumerateChildrenCallback(...args)
        );

        return GLib.SOURCE_REMOVE;
    }

    _enumerateChildrenCallback(file, result) {
        try {
            const child_info = file.enumerate_children_finish(result);
            child_info.next_files_async(
                1,
                GLib.PRIORITY_LOW,
                null,
                (enumerator, res) => {
                    file = enumerator.next_files_finish(res);
                    if (file.length > 0) {
                        this.set_applet_icon_symbolic_name("user-trash-full");
                    } else {
                        this.set_applet_icon_symbolic_name("user-trash");
                    }
                }
            );
        } catch(e) {
            global.logWarning(`Could not check trash uri: ${e.message}`);
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
