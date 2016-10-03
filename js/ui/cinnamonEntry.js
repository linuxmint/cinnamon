const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const St = imports.gi.St;

const Main = imports.ui.main;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;


function _EntryMenu(entry, params) {
    this._init(entry, params);
};

_EntryMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(entry, params) {
        params = Params.parse (params, { isPassword: false });

        PopupMenu.PopupMenu.prototype._init.call(this, entry, St.Side.TOP);

        this.actor.add_style_class_name('entry-context-menu');

        this._entry = entry;
        this._clipboard = St.Clipboard.get_default();

        // Populate menu
        let item;
        item = new PopupMenu.PopupMenuItem(_("Copy"));
        item.connect('activate', Lang.bind(this, this._onCopyActivated));
        this.addMenuItem(item);
        this._copyItem = item;

        item = new PopupMenu.PopupMenuItem(_("Paste"));
        item.connect('activate', Lang.bind(this, this._onPasteActivated));
        this.addMenuItem(item);
        this._pasteItem = item;

        this._passwordItem = null;
        if (params.isPassword) {
            item = new PopupMenu.PopupMenuItem('');
            item.connect('activate', Lang.bind(this,
                                               this._onPasswordActivated));
            this.addMenuItem(item);
            this._passwordItem = item;
        }

        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
    },

    open: function() {
        this._updatePasteItem();
        this._updateCopyItem();
        if (this._passwordItem)
            this._updatePasswordItem();

        let direction = Gtk.DirectionType.TAB_FORWARD;
        if (!this.actor.navigate_focus(null, direction, false))
            this.actor.grab_key_focus();

        PopupMenu.PopupMenu.prototype.open.call(this);
    },

    _updateCopyItem: function() {
        let selection = this._entry.clutter_text.get_selection();
        this._copyItem.setSensitive(selection && selection != '');
    },

    _updatePasteItem: function() {
        this._clipboard.get_text(Lang.bind(this,
            function(clipboard, text) {
                this._pasteItem.setSensitive(text && text != '');
            }));
    },

    _updatePasswordItem: function() {
        let textHidden = (this._entry.clutter_text.password_char);
        if (textHidden)
            this._passwordItem.label.set_text(_("Show Text"));
        else
            this._passwordItem.label.set_text(_("Hide Text"));
    },

    _onCopyActivated: function() {
        let selection = this._entry.clutter_text.get_selection();
        this._clipboard.set_text(selection);
    },

    _onPasteActivated: function() {
        this._clipboard.get_text(Lang.bind(this,
            function(clipboard, text) {
                if (!text)
                    return;
                this._entry.clutter_text.delete_selection();
                let pos = this._entry.clutter_text.get_cursor_position();
                this._entry.clutter_text.insert_text(text, pos);
            }));
    },

    _onPasswordActivated: function() {
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
    }
};

function _onPopup(actor) {
    let entry = actor._menu ? actor : actor.get_parent();
    let [success, textX, textY, lineHeight] = entry.clutter_text.position_to_coords(-1);
    if (success)
        entry._menu.setSourceAlignment(textX / entry.width);
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
