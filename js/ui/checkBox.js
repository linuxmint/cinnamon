const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Params = imports.misc.params;

const Lang = imports.lang;

var CheckBoxContainer = class {
    constructor() {
        this.actor = new Cinnamon.GenericContainer({ y_align: St.Align.MIDDLE });
        this.actor.connect('get-preferred-width',
                           Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height',
                           Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate',
                           Lang.bind(this, this._allocate));
        this.actor.connect('style-changed', Lang.bind(this,
            function() {
                let node = this.actor.get_theme_node();
                this._spacing = Math.round(node.get_length('spacing'));
            }));
        this.actor.request_mode = Clutter.RequestMode.HEIGHT_FOR_WIDTH;

        this._box = new St.Bin();
        this.actor.add_actor(this._box);

        this.label = new St.Label();
        this.label.clutter_text.set_line_wrap(false);
        this.label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this.actor.add_actor(this.label);

        this._spacing = 0;
    }

    _getPreferredWidth(actor, forHeight, alloc) {
        let node = this.actor.get_theme_node();
        forHeight = node.adjust_for_height(forHeight);

        let [minBoxWidth, natBoxWidth] = this._box.get_preferred_width(forHeight);
        let boxNode = this._box.get_theme_node();
        [minBoxWidth, natBoxWidth] = boxNode.adjust_preferred_width(minBoxWidth, natBoxWidth);

        let [minLabelWidth, natLabelWidth] = this.label.get_preferred_width(forHeight);
        let labelNode = this.label.get_theme_node();
        [minLabelWidth, natLabelWidth] = labelNode.adjust_preferred_width(minLabelWidth, natLabelWidth);

        let min = minBoxWidth + minLabelWidth + this._spacing;
        let nat = natBoxWidth + natLabelWidth + this._spacing;
        [min, nat] = node.adjust_preferred_width(min, nat);

        alloc.min_size = min;
        alloc.natural_size = nat;
    }

    _getPreferredHeight(actor, forWidth, alloc) {
        let [minBoxHeight, natBoxHeight] =
            this._box.get_preferred_height(-1);
        let [minLabelHeight, natLabelHeight] =
            this.label.get_preferred_height(-1);

        alloc.min_size = Math.max(minBoxHeight, minLabelHeight);
        alloc.natural_size = Math.max(natBoxHeight, natLabelHeight);
    }

    _allocate(actor, box, flags) {
        let availWidth = box.x2 - box.x1;
        let availHeight = box.y2 - box.y1;

        let childBox = new Clutter.ActorBox();
        let [minBoxWidth, natBoxWidth] =
            this._box.get_preferred_width(-1);
        let [minBoxHeight, natBoxHeight] =
            this._box.get_preferred_height(-1);
        childBox.x1 = box.x1;
        childBox.x2 = box.x1 + natBoxWidth;
        if (availHeight > natBoxHeight) childBox.y1 = box.y1 + (availHeight-natBoxHeight)/2;
        else childBox.y1 = box.y1;
        childBox.y2 = childBox.y1 + natBoxHeight;
        this._box.allocate(childBox, flags);

        let [minLabelWidth, natLabelWidth] =
            this.label.get_preferred_width(-1);
        let [minLabelHeight, natLabelHeight] =
            this.label.get_preferred_height(-1);
        childBox.x1 = box.x1 + natBoxWidth + this._spacing;
        childBox.x2 = childBox.x1 + availWidth - natBoxWidth - this._spacing;
        if (availHeight > natLabelHeight) childBox.y1 = box.y1 + (availHeight-natLabelHeight)/2;
        else childBox.y1 = box.y1;
        childBox.y2 = childBox.y1 + natLabelHeight;
        this.label.allocate(childBox, flags);
    }
}

var CheckBoxBase = class {
    constructor(checkedState, params) {
        this._params = { style_class: 'check-box',
                         button_mask: St.ButtonMask.ONE,
                         toggle_mode: true,
                         can_focus: true,
                         x_fill: true,
                         y_fill: true,
                         y_align: St.Align.MIDDLE };

        if (params != undefined) {
            this._params = Params.parse(params, this._params);
        }

        this.actor = new St.Button(this._params);
        this.actor._delegate = this;
        this.actor.checked = checkedState;
    }

    setToggleState(checkedState) {
        this.actor.checked = checkedState;
    }

    toggle() {
        this.setToggleState(!this.actor.checked);
    }

    destroy() {
        this.actor.destroy();
    }
}

var CheckButton = class extends CheckBoxBase {
    constructor(checkedState, params) {
        super(checkedState, params);
        this.checkmark = new St.Bin();
        this.actor.set_child(this.checkmark);
    }
}

var CheckBox = class extends CheckBoxBase {
    constructor(label, params, checkedState) {
        super(checkedState, params);

        this._container = new CheckBoxContainer();
        this.actor.set_child(this._container.actor);

        if (label)
            this.setLabel(label);
    }

    setLabel(label) {
        this._container.label.set_text(label);
    }

    getLabelActor() {
        return this._container.label;
    }
}

var CheckBox2 = GObject.registerClass(
class CheckBox2 extends St.Button {
    _init(label) {
        let container = new St.BoxLayout();
        super._init({
            style_class: 'check-box-2',
            important: true,
            child: container,
            button_mask: St.ButtonMask.ONE,
            toggle_mode: true,
            can_focus: true,
            x_fill: true,
            y_fill: true,
        });

        this._box = new St.Bin();
        this._box.set_y_align(Clutter.ActorAlign.START);
        container.add_actor(this._box);

        this._label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
        this._label.clutter_text.set_line_wrap(true);
        this._label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        container.add_actor(this._label);

        if (label)
            this.setLabel(label);
    }

    setLabel(label) {
        this._label.set_text(label);
    }

    getLabelActor() {
        return this._label;
    }
});
