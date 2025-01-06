// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;

function _setLabel(label, value) {
    label.set({
        text: value || '',
        visible: value !== null,
    });
}

var Dialog = GObject.registerClass(
class Dialog extends St.Widget {

    _init(parentActor, styleClass) {
        super._init({ layout_manager: new Clutter.BinLayout() });
        this.connect('destroy', this._onDestroy.bind(this));

        this._initialKeyFocus = null;
        this._initialKeyFocusDestroyId = 0;
        this._pressedKey = null;
        this._buttonKeys = {};
        this._createDialog();
        this.add_child(this._dialog);

        if (styleClass != null)
            this._dialog.add_style_class_name(styleClass);

        this._parentActor = parentActor;
        this._eventId = this._parentActor.connect('event', this._modalEventHandler.bind(this));
        this._parentActor.add_child(this);
    }

    _createDialog() {
        this._dialog = new St.BoxLayout({
            style_class: 'dialog',
            important: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: true
        });

        // modal dialogs are fixed width and grow vertically; set the request
        // mode accordingly so wrapped labels are handled correctly during
        // size requests.
        this._dialog.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
        this._dialog.request_mode = Clutter.RequestMode.HEIGHT_FOR_WIDTH;

        this.contentLayout = new St.BoxLayout({
            vertical: true,
            style_class: "dialog-content-box",
            important: true
        });
        this._dialog.add(this.contentLayout, {
            expand: true,
            x_fill: true,
            y_fill: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START
        });

        this.buttonLayout = new St.Widget ({
            style_class: "dialog-button-box",
            layout_manager: new Clutter.BoxLayout({
                homogeneous: true,
                spacing: 12,
            }),
        });
        this._dialog.add(this.buttonLayout, {
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
    }

    makeInactive() {
        if (this._eventId != 0)
            this._parentActor.disconnect(this._eventId);
        this._eventId = 0;

        this.buttonLayout.get_children().forEach(c => c.set_reactive(false));
    }

    _onDestroy() {
        this.makeInactive();
    }

    _modalEventHandler(actor, event) {
        if (event.type() == Clutter.EventType.KEY_PRESS) {
            this._pressedKey = event.get_key_symbol();
        } else if (event.type() == Clutter.EventType.KEY_RELEASE) {
            let pressedKey = this._pressedKey;
            this._pressedKey = null;

            let symbol = event.get_key_symbol();
            if (symbol != pressedKey)
                return Clutter.EVENT_PROPAGATE;

            let buttonInfo = this._buttonKeys[symbol];
            if (!buttonInfo)
                return Clutter.EVENT_PROPAGATE;

            let { button, action } = buttonInfo;

            if (action && button.reactive) {
                action();
                return Clutter.EVENT_STOP;
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _setInitialKeyFocus(actor) {
        if (this._initialKeyFocus)
            this._initialKeyFocus.disconnect(this._initialKeyFocusDestroyId);

        this._initialKeyFocus = actor;

        this._initialKeyFocusDestroyId = actor.connect('destroy', () => {
            this._initialKeyFocus = null;
            this._initialKeyFocusDestroyId = 0;
        });
    }

    get initialKeyFocus() {
        return this._initialKeyFocus || this;
    }

    addButton(buttonInfo) {
        let { label, action, key } = buttonInfo;
        let isDefault = buttonInfo['default'];
        let isDestructive = buttonInfo['destructive_action'];
        let keys;

        if (key)
            keys = [key];
        else if (isDefault)
            keys = [Clutter.KEY_Return, Clutter.KEY_KP_Enter, Clutter.KEY_ISO_Enter];
        else
            keys = [];

        let button = new St.Button({
            style_class: 'dialog-button',
            important: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: true,
            label: label
        });
        button.connect('clicked', () => action());

        buttonInfo['button'] = button;

        if (isDefault)
            button.add_style_pseudo_class('default');

        if (isDestructive)
            button.add_style_pseudo_class('destructive-action');

        if (this._initialKeyFocus == null || isDefault)
            this._setInitialKeyFocus(button);

        for (let i in keys)
            this._buttonKeys[keys[i]] = buttonInfo;

        this.buttonLayout.add_actor(button);

        return button;
    }

    clearButtons() {
        this.buttonLayout.destroy_all_children();
        this._buttonKeys = {};
    }
});

var MessageDialogContent = GObject.registerClass({
    Properties: {
        'title': GObject.ParamSpec.string(
            'title', 'title', 'title',
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
        'description': GObject.ParamSpec.string(
            'description', 'description', 'description',
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
    }
}, class MessageDialogContent extends St.BoxLayout {
    _init(params) {
        this._title = new St.Label({ style_class: 'message-dialog-title' });
        this._description = new St.Label({ style_class: 'message-dialog-description' });

        this._description.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._description.clutter_text.line_wrap = true;

        let defaultParams = {
            style_class: 'message-dialog-content',
            x_expand: true,
            vertical: true,
            important: true,
        };
        super._init(Object.assign(defaultParams, params));

        this.connect('notify::size', this._updateTitleStyle.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));

        this.add_child(this._title);
        this.add_child(this._description);
    }

    _onDestroy() {
        if (this._updateTitleStyleLater) {
            Meta.later_remove(this._updateTitleStyleLater);
            delete this._updateTitleStyleLater;
        }
    }

    get title() {
        return this._title.text;
    }

    get description() {
        return this._description.text;
    }

    _updateTitleStyle() {
        if (!this._title.mapped)
            return;

        this._title.ensure_style();
        const [, titleNatWidth] = this._title.get_preferred_width(-1);

        if (titleNatWidth > this.width) {
            if (this._updateTitleStyleLater)
                return;

            this._updateTitleStyleLater = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                this._updateTitleStyleLater = 0;
                this._title.add_style_class_name('lightweight');
                return GLib.SOURCE_REMOVE;
            });
        }

    }

    set title(title) {
        if (this._title.text === title)
            return;

        _setLabel(this._title, title);

        this._title.remove_style_class_name('lightweight');
        this._updateTitleStyle();

        this.notify('title');
    }

    set description(description) {
        if (this._description.text === description)
            return;

        _setLabel(this._description, description);
        this.notify('description');
    }
});

var ListSection = GObject.registerClass({
    Properties: {
        'title': GObject.ParamSpec.string(
            'title', 'title', 'title',
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
    },
}, class ListSection extends St.BoxLayout {
    _init(params) {
        this._title = new St.Label({ style_class: 'dialog-list-title' });

        this.list = new St.BoxLayout({
            style_class: 'dialog-list-box',
            vertical: true,
        });

        this._listScrollView = new St.ScrollView({
            style_class: 'dialog-list-scrollview',
            hscrollbar_policy: St.PolicyType.NEVER,
        });
        this._listScrollView.add_actor(this.list);

        super._init({
            style_class: 'dialog-list',
            x_expand: true,
            vertical: true,
            important: true,
            ...params,
        });

        this.label_actor = this._title;
        this.add_child(this._title);
        this.add_child(this._listScrollView);
    }

    get title() {
        return this._title.text;
    }

    set title(title) {
        _setLabel(this._title, title);
        this.notify('title');
    }
});

var ListSectionItem = GObject.registerClass({
    Properties: {
        'icon-actor': GObject.ParamSpec.object(
            'icon-actor', 'icon-actor', 'Icon actor',
            GObject.ParamFlags.READWRITE,
            Clutter.Actor.$gtype),
        'title': GObject.ParamSpec.string(
            'title', 'title', 'title',
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
        'description': GObject.ParamSpec.string(
            'description', 'description', 'description',
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
    },
}, class ListSectionItem extends St.BoxLayout{
    _init(params) {
        this._iconActorBin = new St.Bin();

        let textLayout = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._title = new St.Label({ style_class: 'dialog-list-item-title' });

        this._description = new St.Label({
            style_class: 'dialog-list-item-description',
        });

        textLayout.add_child(this._title);
        textLayout.add_child(this._description);

        super._init({
            style_class: 'dialog-list-item',
            important: true,
            ...params,
        });


        this.label_actor = this._title;
        this.add_child(this._iconActorBin);
        this.add_child(textLayout);
    }

    get iconActor() {
        return this._iconActorBin.get_child();
    }

    set iconActor(actor) {
        this._iconActorBin.set_child(actor);
        this.notify('icon-actor');
    }

    get title() {
        return this._title.text;
    }

    set title(title) {
        _setLabel(this._title, title);
        this.notify('title');
    }

    get description() {
        return this._description.text;
    }

    set description(description) {
        _setLabel(this._description, description);
        this.notify('description');
    }
});
