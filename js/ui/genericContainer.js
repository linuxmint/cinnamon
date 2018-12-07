const {registerClass} = imports.gi.GObject;
const {find, each} = imports.misc.util;

let registered = [];

var newGObject = function newGObject(parent, params, callbacks = {
    allocate: null,
    get_preferred_width: null,
    get_preferred_height: null,
    queue_relayout: null
}) {
    let parentName = parent.name;
    let callbacksSignature = Object.keys(callbacks).sort().join('_');
    let name = `${parentName}_${callbacksSignature}`;
    let Class;

    Class = find(registered, function(item) {
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
        // We need to generate a class from the function constructor because GObject uses the
        // class name for identification.
        let str = `
        return class ${name} extends parent {
            _init(params, callbacks) {
                super._init(params);
                this.callbacks = callbacks;
                this._node = null;
                this.lastWidth = [0, 0];
                this.lastHeight = [0, 0];
            }
        }`
        Class = Function('parent', str).call(this, parent);

        each(callbacks, (value, key) => {
            if (key === 'allocate') {
                Class.prototype.vfunc_allocate = function vfunc_allocate(box, flags) {
                    this.set_allocation(box, flags);
                    if (!this.node) this.node = this.get_theme_node(); // always returns a node during allocation
                    this.callbacks.allocate(this.node.get_content_box(box), flags);
                };
            } else if (key === 'get_preferred_width') {
                Class.prototype.vfunc_get_preferred_width = function vfunc_get_preferred_width(forWidth) {
                    if (!this.node) this.node = this.get_theme_node();
                    let [min, nat] = this.callbacks.get_preferred_width(forWidth);
                    return this.node.adjust_preferred_width(min, nat);
                };
            } else if (key === 'get_preferred_height') {
                Class.prototype.vfunc_get_preferred_height = function vfunc_get_preferred_height(forHeight) {
                    if (!this.node) this.node = this.get_theme_node();
                    let [min, nat] = this.callbacks.get_preferred_height(forHeight);
                    return this.node.adjust_preferred_height(min, nat);
                };
            } else { // Generic vfunc support
                let prop = `vfunc_${key}`;
                // Better to check this once than at every invocation
                Object.defineProperty(Class.prototype, prop, {
                    value(...args) {
                        this.callbacks[key](...args);
                        if (parent.prototype[prop]) return parent.prototype[prop].call(this, ...args);
                    }
                });
            }
        });
    }

    Class = registerClass({GTypeName: name}, Class);

    registered.push({
        callbacks: callbacksSignature,
        parent: parentName,
        klass: Class
    });

    //global.log(registered)
    return new Class(params, callbacks);
}