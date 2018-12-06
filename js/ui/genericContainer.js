const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const {tryFn, find, each} = imports.misc.util;

let registered = [];

var newGObject = function newGObject(parent, params, callbacks = {
    allocate: null,
    get_preferred_width: null,
    get_preferred_height: null,
    queue_relayout: null
}) {
    let parentName = parent.name;
    let callbacksSignature = Object.keys(callbacks).sort().join(',');
    let Class = find(registered, function(item) {
        return item.parent === parentName
            && item.callbacks === callbacksSignature;
    });

    if (Class) {
        return new Class.klass(params, callbacks);
    } else {
        // Not all actors will use every vfunc, but just their definition existing will force a
        // trip to the JS context for every instance. Instead we will dynamically create a
        // class based on the callbacks specified, so only instances that have defined
        // vfunc callbacks will have their corresponding vfunc on the prototype. Then cache
        // the classes and index them uniquely based on the vfuncs they contain.
        // Because of the way GObject.registerClass works, we can't mutate the prototype
        // and add vfuncs later. After much trial and error, this is currently the best way to
        // get dynamically assigned vfuncs to work.
        let str = `
        return class ${parentName}_${Date.now()} extends parent {
            _init(params, callbacks) {
                super._init(params);
                this.callbacks = callbacks;
                this.node = null;
            }`

        each(callbacks, (value, key) => {
            if (key === 'allocate') {
                str += `
                vfunc_allocate(box, flags) {
                    this.set_allocation(box, flags);
                    if (!this.node) this.node = this.get_theme_node();
                    if (this.node) {
                        box = this.node.get_content_box(box);
                    }
                    this.callbacks.allocate(box, flags);
                }`
            } else if (key === 'get_preferred_width') {
                str += `
                vfunc_get_preferred_width(forWidth) {
                    if (!this.node) this.node = this.get_theme_node();
                    if (this.node) {
                        let [width, height] = this.callbacks.get_preferred_width(forWidth);
                        return this.node.adjust_preferred_width(width, height);
                    }
                    return super.vfunc_get_preferred_width(forWidth);
                }`
            } else if (key === 'get_preferred_height') {
                str += `
                vfunc_get_preferred_height(forHeight) {
                    if (!this.node) this.node = this.get_theme_node();
                    if (this.node) {
                        let [width, height] = this.callbacks.get_preferred_height(forHeight);
                        return this.node.adjust_preferred_height(width, height);
                    }
                    return super.vfunc_get_preferred_height(forHeight);
                }`
            } else {
                str += `
                vfunc_${key}(...args) {
                    this.callbacks.${key}(...args);
                    if (super.vfunc_${key}) return super.vfunc_${key}(...args);
                }`
            }
        });

        str += '}';
        Class = Function('parent', str).call(this, parent);
    }

    Class = GObject.registerClass(Class);

    registered.push({
        callbacks: callbacksSignature,
        parent: parentName,
        klass: Class
    });

    //global.log(registered)
    return new Class(params, callbacks);
}