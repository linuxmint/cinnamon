const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Dialog = imports.ui.dialog;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;

const Util = imports.misc.util;

const AudioDeviceSelectionIface = `
<node>
<interface name="org.Cinnamon.AudioDeviceSelection">
<method name="Open">
    <arg name="devices" direction="in" type="as" />
</method>
<method name="Close">
</method>
<signal name="DeviceSelected">
    <arg name="device" type="s" />
</signal>
</interface>
</node>`;

const AudioDevice = {
    HEADPHONES: 1 << 0,
    HEADSET:    1 << 1,
    MICROPHONE: 1 << 2,
};

const AudioDeviceSelectionDialog = GObject.registerClass({
    Signals: { 'device-selected': { param_types: [GObject.TYPE_UINT] }},
}, class AudioDeviceSelectionDialog extends ModalDialog.ModalDialog {
    _init(devices) {
        super._init({ styleClass: 'audio-device-selection-dialog' });

        this._deviceItems = {};

        this._buildLayout();

        if (devices & AudioDevice.HEADPHONES)
            this._addDevice(AudioDevice.HEADPHONES);
        if (devices & AudioDevice.HEADSET)
            this._addDevice(AudioDevice.HEADSET);
        if (devices & AudioDevice.MICROPHONE)
            this._addDevice(AudioDevice.MICROPHONE);

        if (this._selectionBox.get_n_children() < 2)
            throw new Error('Too few devices for a selection');
    }

    _buildLayout() {
        let content = new Dialog.MessageDialogContent({
            title: _('Select Audio Device'),
        });

        this._selectionBox = new St.BoxLayout({
            style_class: 'audio-selection-box',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        content.add_child(this._selectionBox);

        this.contentLayout.add_child(content);

        this.addButton({
            action: () => this.close(),
            label: _('Cancel'),
            key: Clutter.KEY_Escape,
            destructive_action: true,
        });

        this.addButton({
            action: this._openSettings.bind(this),
            label: _('Sound Settings'),
        });
    }

    _getDeviceLabel(device) {
        switch (device) {
        case AudioDevice.HEADPHONES:
            return _('Headphones');
        case AudioDevice.HEADSET:
            return _('Headset');
        case AudioDevice.MICROPHONE:
            return _('Microphone');
        default:
            return null;
        }
    }

     _getDeviceIcon(device) {
        switch (device) {
        case AudioDevice.HEADPHONES:
            return 'audio-headphones-symbolic';
        case AudioDevice.HEADSET:
            return 'audio-headset-symbolic';
        case AudioDevice.MICROPHONE:
            return 'audio-input-microphone-symbolic';
        default:
            return null;
        }
    }

    _addDevice(device) {
        const box = new St.BoxLayout({
            style_class: 'audio-selection-device-box',
            vertical: true,
        });
        box.connect('notify::height', () => {
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                box.width = box.height;
                return GLib.SOURCE_REMOVE;
            });
        });

        const icon = new St.Icon({
            style_class: 'audio-selection-device-icon',
            icon_name: this._getDeviceIcon(device),
        });
        box.add_child(icon);

        const label = new St.Label({
            style_class: 'audio-selection-device-label',
            text: this._getDeviceLabel(device),
            x_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(label);

        const button = new St.Button({
            style_class: 'audio-selection-device',
            can_focus: true,
            child: box,
        });
        this._selectionBox.add_child(button);

        button.connect('clicked', () => {
            this.emit('device-selected', device);
            this.close();
            Main.overview.hide();
        });
    }

     _openSettings() {
        Util.spawnCommandLine('cinnamon-settings sound');
        this.close();
    }
});

var AudioDeviceSelectionDBus = class AudioDeviceSelectionDBus {
    constructor() {
        this._audioSelectionDialog = null;

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(AudioDeviceSelectionIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/Cinnamon/AudioDeviceSelection');

        Gio.DBus.session.own_name('org.Cinnamon.AudioDeviceSelection', Gio.BusNameOwnerFlags.REPLACE, null, null);
    }

    _onDialogClosed() {
        this._audioSelectionDialog = null;
    }

    _onDeviceSelected(dialog, device) {
        let connection = this._dbusImpl.get_connection();
        let info = this._dbusImpl.get_info();
        const deviceName = Object.keys(AudioDevice)
            .filter(dev => AudioDevice[dev] === device)[0].toLowerCase();
        connection.emit_signal(
            this._audioSelectionDialog._sender,
            this._dbusImpl.get_object_path(),
            info ? info.name : null,
            'DeviceSelected',
            GLib.Variant.new('(s)', [deviceName]));
    }

    OpenAsync(params, invocation) {
        if (this._audioSelectionDialog) {
            invocation.return_value(null);
            return;
        }

        let [deviceNames] = params;
        let devices = 0;
        deviceNames.forEach(n => (devices |= AudioDevice[n.toUpperCase()]));

        let dialog;
        try {
            dialog = new AudioDeviceSelectionDialog(devices);
        } catch (e) {
            invocation.return_value(null);
            return;
        }
        dialog._sender = invocation.get_sender();

        dialog.connect('closed', this._onDialogClosed.bind(this));
        dialog.connect('device-selected',
            this._onDeviceSelected.bind(this));
        dialog.open();

        this._audioSelectionDialog = dialog;
        invocation.return_value(null);
    }

    CloseAsync(params, invocation) {
        if (this._audioSelectionDialog &&
            this._audioSelectionDialog._sender === invocation.get_sender())
            this._audioSelectionDialog.close();

        invocation.return_value(null);
    }
}
