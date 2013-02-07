const AppletSettings = imports.ui.appletSettings;
const DeskletManager = imports.ui.deskletManager;
const Extension = imports.ui.extension;

const BindingDirection = AppletSettings.BindingDirection;

function DeskletSettings(xlet, uuid, instanceId) {
    this._init(xlet, uuid, instanceId);
}

DeskletSettings.prototype = {
    __proto__: AppletSettings.AppletSettings.prototype,

    _init: function (xlet, uuid, instanceId) {
        AppletSettings.AppletSettings.prototype._init.call(this, xlet, uuid, instanceId, Extension.Type.DESKLET, "Desklet");
    },

    _get_is_multi_instance_xlet: function(uuid) {
        let num = -1;
        num = DeskletManager.get_num_instances_for_desklet(uuid);
        return num > 1 || num == -1;
    }
};
