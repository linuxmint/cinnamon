// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*
 * Copyright 2011 Giovanni Campagna <scampa.giovanni@gmail.com>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const NetworkManager = imports.gi.NetworkManager;
const NMClient = imports.gi.NMClient;
const Pango = imports.gi.Pango;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;

function NetworkSecretDialog() {
    this._init.apply(this, arguments);
}

NetworkSecretDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(agent, requestId, connection, settingName, hints) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'polkit-dialog' });

        this._agent = agent;
        this._requestId = requestId;
        this._connection = connection;
        this._settingName = settingName;
        this._hints = hints;

        this._content = this._getContent();

        let mainContentBox = new St.BoxLayout({ style_class: 'polkit-dialog-main-layout',
                                                vertical: false });
        this.contentLayout.add(mainContentBox,
                               { x_fill: true,
                                 y_fill: true });

        let icon = new St.Icon({ icon_name: 'dialog-password-symbolic' });
        mainContentBox.add(icon,
                           { x_fill:  true,
                             y_fill:  false,
                             x_align: St.Align.END,
                             y_align: St.Align.START });

        let messageBox = new St.BoxLayout({ style_class: 'polkit-dialog-message-layout',
                                            vertical: true });
        mainContentBox.add(messageBox,
                           { y_align: St.Align.START });

        let subjectLabel = new St.Label({ style_class: 'polkit-dialog-headline',
                                            text: this._content.title });
        messageBox.add(subjectLabel,
                       { y_fill:  false,
                         y_align: St.Align.START });

        if (this._content.message != null) {
            let descriptionLabel = new St.Label({ style_class: 'polkit-dialog-description',
                                                  text: this._content.message,
                                                  // HACK: for reasons unknown to me, the label
                                                  // is not asked the correct height for width,
                                                  // and thus is underallocated
                                                  // place a fixed height to avoid overflowing
                                                  style: 'height: 3em'
                                                });
            descriptionLabel.clutter_text.line_wrap = true;

            messageBox.add(descriptionLabel,
                           { y_fill:  true,
                             y_align: St.Align.START,
                             expand: true });
        }

        let secretTable = new St.Table({ style_class: 'network-dialog-secret-table' });
        let initialFocusSet = false;
        let pos = 0;
        for (let i = 0; i < this._content.secrets.length; i++) {
            let secret = this._content.secrets[i];
            let label = new St.Label({ style_class: 'polkit-dialog-password-label',
                                       text: secret.label });

            let reactive = secret.key != null;

            secret.entry = new St.Entry({ style_class: 'polkit-dialog-password-entry',
                                          text: secret.value, can_focus: reactive,
                                          reactive: reactive });
            ShellEntry.addContextMenu(secret.entry,
                                      { isPassword: secret.password });

            if (secret.validate)
                secret.valid = secret.validate(secret);
            else // no special validation, just ensure it's not empty
                secret.valid = secret.value.length > 0;

            if (reactive) {
                if (!initialFocusSet) {
                    this.setInitialKeyFocus(secret.entry);
                    initialFocusSet = true;
                }

                secret.entry.clutter_text.connect('activate', Lang.bind(this, this._onOk));
                secret.entry.clutter_text.connect('text-changed', Lang.bind(this, function() {
                    secret.value = secret.entry.get_text();
                    if (secret.validate)
                        secret.valid = secret.validate(secret);
                    else
                        secret.valid = secret.value.length > 0;
                    this._updateOkButton();
                }));
            } else
                secret.valid = true;

            secretTable.add(label, { row: pos, col: 0, x_expand: false, x_fill: true, x_align: St.Align.START, y_align: St.Align.START });
            secretTable.add(secret.entry, { row: pos, col: 1, x_expand: true, x_fill: true, y_align: St.Align.END });
            pos++;

            if (secret.password)
                secret.entry.clutter_text.set_password_char('\u25cf');
        }

        messageBox.add(secretTable);

        this._okButton = { label:  _("Connect"),
                           action: Lang.bind(this, this._onOk),
                           key:    Clutter.KEY_Return,
                         };

        this.setButtons([{ label: _("Cancel"),
                           action: Lang.bind(this, this.cancel),
                           key:    Clutter.KEY_Escape,
                         },
                         this._okButton]);
    },

    _updateOkButton: function() {
        let valid = true;
        for (let i = 0; i < this._content.secrets.length; i++) {
            let secret = this._content.secrets[i];
            valid = valid && secret.valid;
        }

        this._okButton.button.reactive = valid;
        this._okButton.button.can_focus = valid;
        if (valid)
            this._okButton.button.remove_style_pseudo_class('disabled');
        else
            this._okButton.button.add_style_pseudo_class('disabled');
    },

    _onOk: function() {
        let valid = true;
        for (let i = 0; i < this._content.secrets.length; i++) {
            let secret = this._content.secrets[i];
            valid = valid && secret.valid;
            if (secret.key != null)
                this._agent.set_password(this._requestId, secret.key, secret.value);
        }

        if (valid) {
            this._agent.respond(this._requestId, false);
            this.close(global.get_current_time());
        }
        // do nothing if not valid
    },

    cancel: function() {
        this._agent.respond(this._requestId, true);
        this.close(global.get_current_time());
    },

    _validateWpaPsk: function(secret) {
        let value = secret.value;
        if (value.length == 64) {
            // must be composed of hexadecimal digits only
            for (let i = 0; i < 64; i++) {
                if (!((value[i] >= 'a' && value[i] <= 'f')
                      || (value[i] >= 'A' && value[i] <= 'F')
                      || (value[i] >= '0' && value[i] <= '9')))
                    return false;
            }
            return true;
        }

        return (value.length >= 8 && value.length <= 63);
    },

    _validateStaticWep: function(secret) {
        let value = secret.value;
        if (secret.wep_key_type == NetworkManager.WepKeyType.KEY) {
            if (value.length == 10 || value.length == 26) {
		for (let i = 0; i < value.length; i++) {
                    if (!((value[i] >= 'a' && value[i] <= 'f')
                          || (value[i] >= 'A' && value[i] <= 'F')
                          || (value[i] >= '0' && value[i] <= '9')))
                        return false;
		}
	    } else if (value.length == 5 || value.length == 13) {
		for (let i = 0; i < value.length; i++) {
                    if (!((value[i] >= 'a' && value[i] <= 'z')
                          || (value[i] >= 'A' && value[i] <= 'Z')))
                        return false;
                }
            } else
                return false;
	} else if (secret.wep_key_type == NetworkManager.WepKeyType.PASSPHRASE) {
	    if (value.length < 0 || value.length > 64)
	        return false;
	}
        return true;
    },

    _getWirelessSecrets: function(secrets, wirelessSetting) {
        let wirelessSecuritySetting = this._connection.get_setting_wireless_security();
        switch (wirelessSecuritySetting.key_mgmt) {
        // First the easy ones
        case 'wpa-none':
        case 'wpa-psk':
            secrets.push({ label: _("Password: "), key: 'psk',
                           value: wirelessSecuritySetting.psk || '',
                           validate: this._validateWpaPsk, password: true });
            break;
        case 'none': // static WEP
            secrets.push({ label: _("Key: "), key: 'wep-key' + wirelessSecuritySetting.wep_tx_keyidx,
                           value: wirelessSecuritySetting.get_wep_key(wirelessSecuritySetting.wep_tx_keyidx) || '',
                           wep_key_type: wirelessSecuritySetting.wep_key_type,
                           validate: this._validateStaticWep, password: true });
            break;
        case 'ieee8021x':
            if (wirelessSecuritySetting.auth_alg == 'leap') // Cisco LEAP
                secrets.push({ label: _("Password: "), key: 'leap-password',
                               value: wirelessSecuritySetting.leap_password || '', password: true });
            else // Dynamic (IEEE 802.1x) WEP
                this._get8021xSecrets(secrets);
            break;
        case 'wpa-eap':
            this._get8021xSecrets(secrets);
            break;
        default:
            log('Invalid wireless key management: ' + wirelessSecuritySetting.key_mgmt);
        }
    },

    _get8021xSecrets: function(secrets) {
        let ieee8021xSetting = this._connection.get_setting_802_1x();
        let phase2method;

        switch (ieee8021xSetting.get_eap_method(0)) {
        case 'md5':
        case 'leap':
        case 'ttls':
        case 'peap':
            // TTLS and PEAP are actually much more complicated, but this complication
            // is not visible here since we only care about phase2 authentication
            // (and don't even care of which one)
            secrets.push({ label: _("Username: "), key: null,
                           value: ieee8021xSetting.identity || '', password: false });
            secrets.push({ label: _("Password: "), key: 'password',
                           value: ieee8021xSetting.password || '', password: true });
            break;
        case 'tls':
            secrets.push({ label: _("Identity: "), key: null,
                           value: ieee8021xSetting.identity || '', password: false });
            secrets.push({ label: _("Private key password: "), key: 'private-key-password',
                           value: ieee8021xSetting.private_key_password || '', password: true });
            break;
        default:
            log('Invalid EAP/IEEE802.1x method: ' + ieee8021xSetting.get_eap_method(0));
        }
    },

    _getPPPoESecrets: function(secrets) {
        let pppoeSetting = this._connection.get_setting_pppoe();
        secrets.push({ label: _("Username: "), key: 'username',
                       value: pppoeSetting.username || '', password: false });
        secrets.push({ label: _("Service: "), key: 'service',
                       value: pppoeSetting.service || '', password: false });
        secrets.push({ label: _("Password: "), key: 'password',
                       value: pppoeSetting.password || '', password: true });
    },

    _getMobileSecrets: function(secrets, connectionType) {
        let setting;
        if (connectionType == 'bluetooth')
            setting = this._connection.get_setting_cdma() || this._connection.get_setting_gsm();
        else
            setting = this._connection.get_setting_by_name(connectionType);
        secrets.push({ label: _("Password: "), key: 'password',
                       value: setting.value || '', password: true });
    },

    _getContent: function() {
        let connectionSetting = this._connection.get_setting_connection();
        let connectionType = connectionSetting.get_connection_type();
        let wirelessSetting;
        let ssid;

        let content = { };
        content.secrets = [ ];

        switch (connectionType) {
        case '802-11-wireless':
            wirelessSetting = this._connection.get_setting_wireless();
            ssid = NetworkManager.utils_ssid_to_utf8(wirelessSetting.get_ssid());
            content.title = _("Authentication required by wireless network");
            content.message = _("Passwords or encryption keys are required to access the wireless network '%s'.").format(ssid);
            this._getWirelessSecrets(content.secrets, wirelessSetting);
            break;
        case '802-3-ethernet':
            content.title = _("Wired 802.1X authentication");
            content.message = null;
            content.secrets.push({ label: _("Network name: "), key: null,
                                   value: connectionSetting.get_id(), password: false });
            this._get8021xSecrets(content.secrets);
            break;
        case 'pppoe':
            content.title = _("DSL authentication");
            content.message = null;
            this._getPPPoESecrets(content.secrets);
            break;
        case 'gsm':
            if (this._hints.indexOf('pin') != -1) {
                let gsmSetting = this._connection.get_setting_gsm();
                content.title = _("PIN code required");
                content.message = _("PIN code is needed for the mobile broadband device");
                content.secrets.push({ label: _("PIN: "), key: 'pin',
                                       value: gsmSetting.pin || '', password: true });
            }
            // fall through
        case 'cdma':
        case 'bluetooth':
            content.title = _("Mobile broadband network password");
            content.message = _("A password is required to connect to '%s'.").format(connectionSetting.get_id());
            this._getMobileSecrets(content.secrets, connectionType);
            break;
        default:
            log('Invalid connection type: ' + connectionType);
        };

        return content;
    }
};

function NetworkAgent() {
    this._init.apply(this, arguments);
}

NetworkAgent.prototype = {
    _init: function() {
        this._native = new Shell.NetworkAgent({ auto_register: true,
                                                identifier: 'org.gnome.Shell.NetworkAgent' });

        this._dialogs = { };
        this._native.connect('new-request', Lang.bind(this, this._newRequest));
        this._native.connect('cancel-request', Lang.bind(this, this._cancelRequest));
    },

    _newRequest:  function(agent, requestId, connection, settingName, hints) {
        let dialog = new NetworkSecretDialog(agent, requestId, connection, settingName, hints);
        dialog.connect('destroy', Lang.bind(this, function() {
            delete this._dialogs[requestId];
        }));
        this._dialogs[requestId] = dialog;
        dialog.open(global.get_current_time());
    },

    _cancelRequest: function(agent, requestId) {
        this._dialogs[requestId].close(global.get_current_time());
        this._dialogs[requestId].destroy();
    }
};
