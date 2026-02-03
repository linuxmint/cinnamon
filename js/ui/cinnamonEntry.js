const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const GObject = imports.gi.GObject;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Main = imports.ui.main;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;

var _EntryMenu = class extends PopupMenu.PopupMenu {
    constructor (entry, params) {
        super(entry, 0, St.Side.TOP)

        params = Params.parse(params, { isPassword: false });

        this.actor.add_style_class_name('entry-context-menu');

        this._entry = entry;
        this._clipboard = St.Clipboard.get_default();

        // Populate menu
        let item;
        item = new PopupMenu.PopupMenuItem(_("Copy"));
        item.connect('activate', this._onCopyActivated.bind(this));
        this.addMenuItem(item);
        this._copyItem = item;

        item = new PopupMenu.PopupMenuItem(_("Paste"));
        item.connect('activate', this._onPasteActivated.bind(this));
        this.addMenuItem(item);
        this._pasteItem = item;

        this._passwordItem = null;
        if (params.isPassword) {
            item = new PopupMenu.PopupMenuItem('');
            item.connect('activate', this._onPasswordActivated.bind(this));
            this.addMenuItem(item);
            this._passwordItem = item;
        }

        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
    }

    open() {
        this._updatePasteItem();
        this._updateCopyItem();
        if (this._passwordItem)
            this._updatePasswordItem();

        let [x, y] = Clutter.get_current_event().get_coords();

        // if x == 0 there was no event, this is probably from a keyboard menu key or shift-f10,
        // which already handled the move.
        if (x != 0) {
            this.shiftToPosition(x);
        }

        super.open();
    }

    _updateCopyItem() {
        let selection = this._entry.clutter_text.get_selection();
        this._copyItem.setSensitive(selection && selection != '');
    }

    _updatePasteItem() {
        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            this._pasteItem.setSensitive(text && text != '');
        });
    }

    _updatePasswordItem() {
        let textHidden = (this._entry.clutter_text.password_char);
        if (textHidden)
            this._passwordItem.label.set_text(_("Show Text"));
        else
            this._passwordItem.label.set_text(_("Hide Text"));
    }

    _onCopyActivated() {
        let selection = this._entry.clutter_text.get_selection();
        this._clipboard.set_text(St.ClipboardType.CLIPBOARD, selection);
    }

    _onPasteActivated() {
        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (!text)
                return;
            this._entry.clutter_text.delete_selection();
            let pos = this._entry.clutter_text.get_cursor_position();
            this._entry.clutter_text.insert_text(text, pos);
        });
    }

    _onPasswordActivated() {
        let visible = !!(this._entry.clutter_text.password_char);
        this._entry.clutter_text.set_password_char(visible ? '' : '\u25cf');
    }
};


function _setMenuAlignment(entry, stageX) {
    let [success, entryX, entryY] = entry.transform_stage_point(stageX, 0);
    if (success)
        entry._menu.setSourceAlignment(entryX / entry.width);
};

function _onClicked(actor, action) {
    let entry = actor._menu ? actor : actor.get_parent();

    if (entry._menu.isOpen) {
        entry._menu.close();
    } else if (action.get_button() == 3) {
        let [stageX, stageY] = action.get_coords();
        _setMenuAlignment(entry, stageX);
        entry._menu.open();

        // Stop event handling here, if it's a right-click; Depending on which actor received the
        // event (ClutterText or the StEntry) we may lose focus if it propagates. If that happens,
        // the selection is removed, so Copy will be clickable, but the clipboard will end up empty.
        return Clutter.EVENT_STOP;
    }

    return Clutter.EVENT_PROPAGATE;
};

function _onPopup(actor) {
    let entry = actor._menu ? actor : actor.get_parent();
    let [success, textX, textY, lineHeight] = entry.clutter_text.position_to_coords(-1);

    if (success) {
        let [x, y] = entry.clutter_text.get_transformed_position()

        entry._menu.shiftToPosition(x + textX);
    }

    entry._menu.open();
};

function addContextMenu(entry, params) {
    if (entry._menu)
        return;

    entry._menu = new _EntryMenu(entry, params);
    entry._menuManager = new PopupMenu.PopupMenuManager({ actor: entry });
    entry._menuManager.addMenu(entry._menu);

    // Add a click action to both the entry and its clutter_text; the former
    // so padding is included in the clickable area, the latter because the
    // event processing of ClutterText prevents event-bubbling.
    entry.connect('button-press-event', _onClicked);
    entry.clutter_text.connect('button-press-event', _onClicked);
    entry.connect('popup-menu', _onPopup);
}

var CapsLockWarning = GObject.registerClass(
class CapsLockWarning extends St.Label {
    _init(params) {
        let defaultParams = { style_class: 'prompt-dialog-error-label' };
        super._init(Object.assign(defaultParams, params));

        this.text = _('Caps lock is on');

        this.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.clutter_text.line_wrap = true;

        let seat = Clutter.get_default_backend().get_default_seat();
        this._keymap = seat.get_keymap();

        this.connect('notify::mapped', () => {
            if (this.is_mapped()) {
                this._stateChangedId = this._keymap.connect('state-changed',
                    () => this._sync(true));
            } else {
                this._keymap.disconnect(this._stateChangedId);
                this._stateChangedId = 0;
            }

            this._sync(false);
        });

        this.connect('destroy', () => {
            if (this._stateChangedId)
                this._keymap.disconnect(this._stateChangedId);
        });
    }

    _sync(animate) {
        let capsLockOn = this._keymap.get_caps_lock_state();

        this.remove_all_transitions();

        const { naturalHeightSet } = this;
        this.natural_height_set = false;
        let [, height] = this.get_preferred_height(-1);
        this.natural_height_set = naturalHeightSet;

        this.ease({
            height: capsLockOn ? height : 0,
            opacity: capsLockOn ? 255 : 0,
            duration: animate ? 200 : 0,
            onComplete: () => {
                if (capsLockOn)
                    this.height = -1;
            },
        });
    }
});
