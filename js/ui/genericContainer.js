const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

var GenericContainer = class GenericContainer extends St.Widget {
    _init(params, callbacks = {
        allocate: null,
        get_preferred_width: null,
        get_preferred_height: null
    }) {
        super._init(params);
        this.callbacks = callbacks;
    }

    vfunc_allocate(box, flags) {
        this.set_allocation(box, flags);
        if (!this.callbacks.allocate) return;
        let node = this.get_theme_node();
        if (node) {
            box = node.get_content_box(box);
        }
        this.callbacks.allocate(this, box, flags);
    }

    vfunc_get_preferred_width(forWidth) {
        let node = this.get_theme_node();
        if (node && this.callbacks.get_preferred_width) {
            let alloc = this.callbacks.get_preferred_width(this, forWidth);
            return node.adjust_preferred_width(...alloc);
        }
        return [0, 0];
    }

    vfunc_get_preferred_height(forHeight) {
        let node = this.get_theme_node();
        if (node && this.callbacks.get_preferred_height) {
            let alloc = this.callbacks.get_preferred_height(this, forHeight);
            return node.adjust_preferred_height(...alloc);
        }

        return [0, 0];
    }
}

GenericContainer = GObject.registerClass(GenericContainer);