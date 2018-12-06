const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

var GenericContainer = class GenericContainer extends St.Widget {
    _init(params = {}, callbacks = {
        allocate: null,
        get_preferred_width: null,
        get_preferred_height: null
    }) {
        super._init(params);
        this.callbacks = callbacks;
        this.node = null;
    }

    vfunc_allocate(box, flags) {
        this.set_allocation(box, flags);
        if (!this.node) this.node = this.get_theme_node();
        if (this.node) {
            box = this.node.get_content_box(box);
        }
        this.callbacks.allocate(box, flags);
    }

    vfunc_get_preferred_width(forWidth) {
        if (!this.node) this.node = this.get_theme_node();
        if (this.node && this.callbacks.get_preferred_width) {
            let [width, height] = this.callbacks.get_preferred_width(forWidth);
            return this.node.adjust_preferred_width(width, height);
        }
        return [0, 0];
    }

    vfunc_get_preferred_height(forHeight) {
        if (!this.node) this.node = this.get_theme_node();
        if (this.node && this.callbacks.get_preferred_height) {
            let [width, height] = this.callbacks.get_preferred_height(forHeight);
            return this.node.adjust_preferred_height(width, height);
        }
        return [0, 0];
    }
}

GenericContainer = GObject.registerClass(GenericContainer);