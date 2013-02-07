const AppletSettings = imports.ui.appletSettings;
const ExtensionSystem = imports.ui.extensionSystem;
const Extension = imports.ui.extension;

const BindingDirection = AppletSettings.BindingDirection;

function ExtensionSettings(xlet, uuid) {
    this._init(xlet, uuid);
}

ExtensionSettings.prototype = {
    __proto__: AppletSettings.AppletSettings.prototype,

    _init: function (xlet, uuid) {
        AppletSettings.AppletSettings.prototype._init.call(this, xlet, uuid, null, Extension.Type.EXTENSION, "Extension");
    },

    _get_is_multi_instance_xlet: function(uuid) {
        return false;
    }
};
