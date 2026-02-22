// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GObject = imports.gi.GObject;

const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;

/**
 * AwayMessageDialog:
 *
 * A modal dialog that prompts the user for an away message before locking
 * the screen. Used when org.cinnamon.desktop.screensaver 'ask-for-away-message'
 * is enabled.
 */
var AwayMessageDialog = GObject.registerClass(
class AwayMessageDialog extends ModalDialog.ModalDialog {
    _init(callback) {
        super._init();

        this._callback = callback;

        let content = new Dialog.MessageDialogContent({
            title: _("Lock Screen"),
            description: _("Please type an away message for the lock screen")
        });
        this.contentLayout.add_child(content);

        this._entry = new St.Entry({
            style_class: 'prompt-dialog-password-entry',
            hint_text: _("Away message"),
            can_focus: true,
            x_expand: true
        });
        this.contentLayout.add_child(this._entry);

        this._entry.clutter_text.connect('activate', this._onLock.bind(this));
        this.setInitialKeyFocus(this._entry);

        // Buttons
        this.setButtons([
            {
                label: _("Cancel"),
                action: this._onCancel.bind(this),
                key: Clutter.KEY_Escape
            },
            {
                label: _("Lock"),
                action: this._onLock.bind(this),
                default: true
            }
        ]);
    }

    _onCancel() {
        this.close();
    }

    _onLock() {
        let message = this._entry.get_text();
        this.close();

        if (this._callback) {
            this._callback(message);
        }
    }
});
