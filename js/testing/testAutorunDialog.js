// Test helper - call from Looking Glass:
//   imports.testing.testAutorunDialog.show()
//   imports.testing.testAutorunDialog.show("My USB", "x-content/image-dcf")

const Gio = imports.gi.Gio;
const AutorunManager = imports.ui.autorunManager;

function show(mountName, contentType) {
    mountName = mountName || "Test USB Drive";
    contentType = contentType || "x-content/unix-software";

    let nextId = 1;
    let mount = {
        get_name() { return mountName; },
        can_eject() { return true; },
        get_root() { return Gio.File.new_for_path("/"); },
        connect() { return nextId++; },
        disconnect() {},
        eject_with_operation() {},
        unmount_with_operation() {},
    };

    let apps = [];
    let app = Gio.app_info_get_default_for_type("inode/directory", false);
    if (app)
        apps.push(app);

    let dialog = new AutorunManager.AutorunDialog(mount, apps, contentType);
    dialog.open();
    return dialog;
}
