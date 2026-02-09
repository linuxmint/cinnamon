// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, GObject, Pango, St } = imports.gi;

var Placeholder = GObject.registerClass({
    Properties: {
        'icon-name': GObject.ParamSpec.string(
            'icon-name', null, null,
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
        'title': GObject.ParamSpec.string(
            'title', null, null,
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
        'description': GObject.ParamSpec.string(
            'description', null, null,
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null),
    },
}, class Placeholder extends St.BoxLayout {
    _init(params) {
        this._icon = new St.Icon({
            style_class: 'placeholder-icon',
            icon_size: 64,
            icon_type: St.IconType.SYMBOLIC,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._title = new St.Label({
            style_class: 'placeholder-label',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._title.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._title.clutter_text.line_wrap = true;

        this._description = new St.Label({
            style_class: 'placeholder-description',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._description.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._description.clutter_text.line_wrap = true;

        super._init({
            style_class: 'placeholder',
            reactive: false,
            vertical: true,
            x_expand: true,
            y_expand: true,
            ...params,
        });

        this.add_child(this._icon);
        this.add_child(this._title);
        this.add_child(this._description);
    }

    get icon_name() {
        return this._icon.icon_name;
    }

    set icon_name(iconName) {
        if (this._icon.icon_name === iconName)
            return;

        this._icon.icon_name = iconName;
        this.notify('icon-name');
    }

    get title() {
        return this._title.text;
    }

    set title(title) {
        if (this._title.text === title)
            return;

        this._title.text = title;
        this.notify('title');
    }

    get description() {
        return this._description.text;
    }

    set description(description) {
        if (this._description.text === description)
            return;

        if (description === null)
            this._description.visible = false;
        else
            this._description.visible = true;

        this._description.text = description;
        this.notify('description');
    }
});
