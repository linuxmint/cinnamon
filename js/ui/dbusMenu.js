// Copyright (C) 2011 Giovanni Campagna
// Copyright (C) 2013-2014 Jonas Kümmerlin <rgcjonas@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;

const PopupMenu = imports.ui.popupMenu;

// We list all the properties we know and use here, so we won' have to deal with unexpected type mismatches
const MandatedTypes = {
    'visible'           : GLib.VariantType.new("b"),
    'enabled'           : GLib.VariantType.new("b"),
    'label'             : GLib.VariantType.new("s"),
    'type'              : GLib.VariantType.new("s"),
    'children-display'  : GLib.VariantType.new("s"),
    'icon-name'         : GLib.VariantType.new("s"),
    'icon-data'         : GLib.VariantType.new("ay"),
    'toggle-type'       : GLib.VariantType.new("s"),
    'toggle-state'      : GLib.VariantType.new("i"),
    'action'            : GLib.VariantType.new("s"),
    'accel'             : GLib.VariantType.new("s"),
    'shortcut'          : GLib.VariantType.new("aas"),
};

const DefaultValues = {
    'visible'    : GLib.Variant.new_boolean(true),
    'enabled'    : GLib.Variant.new_boolean(true),
    'label'      : GLib.Variant.new_string(""),
    'type'       : GLib.Variant.new_string(""),
    'action'     : GLib.Variant.new_string(""),
    'accel'      : GLib.Variant.new_string("")
    // Elements not in here must return null
};

const DBusMenuIface =
    '<node> \
        <interface name="com.canonical.dbusmenu"> \
            <!-- Properties --> \
            <property name="Version" type="u" access="read" /> \
            <property name="TextDirection" type="s" access="read" /> \
            <property name="Status" type="s" access="read" /> \
            <property name="IconThemePath" type="as" access="read" /> \
            <!-- Functions --> \
            <method name="GetLayout"> \
                <arg type="i" name="parentId" direction="in" /> \
                <arg type="i" name="recursionDepth" direction="in" /> \
                <arg type="as" name="propertyNames" direction="in" /> \
                <arg type="u" name="revision" direction="out" /> \
                <arg type="(ia{sv}av)" name="layout" direction="out" /> \
            </method> \
            <method name="GetGroupProperties"> \
                <arg type="ai" name="ids" direction="in" /> \
                <arg type="as" name="propertyNames" direction="in" /> \
                <arg type="a(ia{sv})" name="properties" direction="out" /> \
            </method> \
            <method name="GetProperty"> \
                <arg type="i" name="id" direction="in" /> \
                <arg type="s" name="name" direction="in" /> \
                <arg type="v" name="value" direction="out" /> \
            </method> \
            <method name="Event"> \
                <arg type="i" name="id" direction="in" /> \
                <arg type="s" name="eventId" direction="in" /> \
                <arg type="v" name="data" direction="in" /> \
                <arg type="u" name="timestamp" direction="in" /> \
            </method> \
            <method name="EventGroup"> \
                <arg type="a(isvu)" name="events" direction="in" /> \
                <arg type="ai" name="idErrors" direction="out" /> \
            </method> \
            <method name="AboutToShow"> \
                <arg type="i" name="id" direction="in" /> \
                <arg type="b" name="needUpdate" direction="out" /> \
            </method> \
            <method name="AboutToShowGroup"> \
                <arg type="ai" name="ids" direction="in" /> \
                <arg type="ai" name="updatesNeeded" direction="out" /> \
                <arg type="ai" name="idErrors" direction="out" /> \
            </method> \
            <!-- Signals --> \
            <signal name="ItemsPropertiesUpdated"> \
                <arg type="a(ia{sv})" name="updatedProps" direction="out" /> \
                <arg type="a(ias)" name="removedProps" direction="out" /> \
            </signal> \
            <signal name="LayoutUpdated"> \
                <arg type="u" name="revision" direction="out" /> \
                <arg type="i" name="parent" direction="out" /> \
            </signal> \
            <signal name="ItemActivationRequested"> \
                <arg type="i" name="id" direction="out" /> \
                <arg type="u" name="timestamp" direction="out" /> \
            </signal> \
        </interface> \
    </node>';

const BusClientProxy = Gio.DBusProxy.makeProxyWrapper(DBusMenuIface);

/**
 * #PropertyStore:
 * @short_description: A Class to saves menu property values and handles type checking and defaults.
 */
function PropertyStore() {
    this._init.apply(this, arguments);
}

PropertyStore.prototype = {

    _init: function(initProperties) {
        this._props = {};

        if (initProperties) {
            for (let i in initProperties) {
                this.set(i, initProperties[i]);
            }
        }
    },

    set: function(name, value) {
        if (name in MandatedTypes && value && value.is_of_type && !value.is_of_type(MandatedTypes[name]))
            global.logWarning("Cannot set property "+name+": type mismatch!");
        else if (value)
            this._props[name] = value;
        else
            delete this._props[name];
    },

    get: function(name) {
        if (name in this._props)
            return this._props[name];
        else if (name in DefaultValues)
            return DefaultValues[name];
        else
            return null;
    },

    // FIXME: This apparently be complex, and the same are handled better
    // in the original extension. The problem is the icons, the we can not
    // compare as a simple variant because is not. There are another way?
    compareNew: function(name, newValue) {
        if (!(name in MandatedTypes))
            return true; 
        if (name in MandatedTypes && newValue && newValue.is_of_type && !newValue.is_of_type(MandatedTypes[name]))
            return false;

        let oldValue = this.get(name);
        if (oldValue == newValue)
            return false;
        if (newValue && !oldValue || oldValue && !newValue)
            return true;

        let isOldContainer = oldValue.is_container();
        let isNewContainer = newValue.is_container();

        if ((!isOldContainer) && (!isNewContainer)) {
            return (oldValue.compare(newValue) != 0);
        } else if (isOldContainer != isNewContainer)
            return true;

        let oldArray = oldValue.deep_unpack();
        let newArray = newValue.deep_unpack();
        if (oldArray.length != newArray.length)
            return true;
        for (let child in oldArray) {
            if (!(child in newArray) || (oldArray[child] != newArray[child]))
                return true;
        }
        return false;
    },

    getString: function(propName) {
        let prop = this.getVariant(propName);
        return prop ? prop.get_string()[0] : null;
    },

    getVariant: function(propName) {
        return this.get(propName);
    },

    getBool: function(propName) {
        let prop  = this.getVariant(propName);
        return prop ? prop.get_boolean() : false;
    },

    getInt: function(propName) {
        let prop = this.getVariant(propName);
        return prop ? prop.get_int32() : 0;
    },

    setVariant: function(prop, value) {
        if (this.compareNew(prop, value)) {
            this.set(prop, value);
            return true;
        }
        return false;
    }
};

/**
 * #DbusMenuItem:
 * @short_description: Represents a single Dbus menu item.
 */
function DbusMenuItem() {
    this._init.apply(this, arguments);
}

DbusMenuItem.prototype = {
    __proto__: PopupMenu.PopupMenuAbstractItem.prototype,

    // Will steal the properties object
    _init: function(id, childrenIds, properties, client) {
        PopupMenu.PopupMenuAbstractItem.prototype._init.call(this, id, childrenIds, this._createParameters(properties, client));
    },

    updatePropertiesAsVariant: function(properties) {
        let propStore = new PropertyStore(properties);
        if ("label" in properties)
            this.setLabel(propStore.getString("label").replace(/_([^_])/, "$1"));
        if ("accel" in properties)
            this.setAccel(this._getAccel(propStore.getString("accel")));
        if ("shortcut" in properties)
            this.setAccel(this._getShortcut(propStore.getVariant("shortcut")))
        if ("enabled" in properties)
            this.setSensitive(propStore.getBool("enabled"));
        if ("visible" in properties)
            this.setVisible(propStore.getBool("visible"));
        if ("toggle-type" in properties)
            this.setToggleType(propStore.getString("toggle-type"));
        if ("toggle-state" in properties)
            this.setToggleState(propStore.getInt("toggle-state"));
        if ("icon-name" in properties)
            this.setIconName(propStore.getString("icon-name"));
        if ("icon-data" in properties)
            this.setGdkIcon(this._getGdkIcon(propStore.getVariant("icon-data")));
        if (("children-display" in properties)||("type" in properties))
            this.setFactoryType(this._getFactoryType(propStore.getString('children-display'), propStore.getString('type')));
        if ("action" in properties)
            this.setAction(propStore.getString("action"));
        if ("param-type" in properties)
            this.setParamType(propStore.getVariant("param-type"));
    },

    getItemById: function(id) {
        return this._client.getItem(id);
    },

    handleEvent: function(event, params) {
        if (event in PopupMenu.FactoryEventTypes) {
            this._client.sendEvent(this._id, event, params, 0);
        }
    },

    // FIXME We really don't need the PropertyStore object, and some private function
    // could make a clean on our "unsave" variants.
    _createParameters: function(properties, client) {
        this._client = client;
        let propStore = new PropertyStore(properties);
        let params = {};
        if ("label" in properties)
            params.label = propStore.getString("label").replace(/_([^_])/, "$1");
        if ("accel" in properties)
            params.accel = this._getAccel(propStore.getString("accel"));
        if ("shortcut" in properties)
            this.setAccel(this._getShortcut(propStore.getVariant("shortcut")))
        if ("enabled" in properties)
            params.sensitive = propStore.getBool("enabled");
        if ("visible" in properties)
            params.visible = propStore.getBool("visible");
        if ("toggle-type" in properties)
            params.toggleType = propStore.getString("toggle-type");
        if ("toggle-state" in properties)
            params.toggleState = propStore.getInt("toggle-state");
        if ("icon-name" in properties)
            params.iconName = propStore.getString("icon-name");
        if ("icon-data" in properties)
            params.iconData = this._getGdkIcon(propStore.getVariant("icon-data"));
        if (("children-display" in properties)||("type" in properties))
            params.type = this._getFactoryType(propStore.getString('children-display'), propStore.getString('type'))
        if ("action" in properties)
            params.action = propStore.getString("action");
        if ("param-type" in properties)
            params.paramType = propStore.getVariant("param-type");
        return params;
    },

    _getAccel: function(accel_name) {
        if (accel_name) {
            [key, mods] = Gtk.accelerator_parse(accel_name);
            return Gtk.accelerator_get_label(key, mods);
        }
        return null;
    },

    _getShortcut: function(accel) {
        if (accel) {
            let keyArray = accel.deep_unpack();
            if (keyArray && keyArray[0]) {
                let accelName = "";
                let keySequence = keyArray[0];
                let len = keySequence.length;
                if ((len == 1)&&(keySequence[0].length == 1))
                    return keySequence[0];
                for (let pos in keySequence) {
                    let token = keySequence[pos];
                    if (pos <= len - 2)
                        accelName += "<" + token + ">";
                    else
                        accelName += this._kdeToGtkKey(token);
                }
                if (accelName == "<>")
                    accelName = "+";
                let [key, mods] = Gtk.accelerator_parse(accelName);
                let value = Gtk.accelerator_get_label(key, mods);
                if (!value)
                    value = accelName; 
                return value;
            }
        }
        return null;
    },

    //FIXME: We need to convert more keys to Gtk?
    _kdeToGtkKey: function(key) {
        let keyLower = key.toLowerCase();
        if (keyLower == "pgup")
            return "Page_Up";
        else if (keyLower == "pgdown")
            return "Page_Down";
        else if (keyLower == "esc")
            return "Escape";
        else if (keyLower == "ins")
            return "Insert";
        else if (keyLower == "del")
            return "Delete";
        else if (keyLower == "space")
            return "space";
        else if (keyLower == "backspace")
            return "BackSpace";
        else if (keyLower == "media stop")
            return "XF86AudioStop";
        else if (keyLower == "media play")
            return "XF86AudioPlay";
        return key;
    },

    _getFactoryType: function(child_display, child_type) {
        if ((child_display) || (child_type)) {
            if ((child_display == "rootmenu")||(this._id && this._id == this._client.getRootId()))
                return PopupMenu.FactoryClassTypes.RootMenuClass;
            if (child_display == "submenu")
                return PopupMenu.FactoryClassTypes.SubMenuMenuItemClass;
            else if (child_display == "section")
                return PopupMenu.FactoryClassTypes.MenuSectionMenuItemClass;
            else if (child_type == "separator")
                return PopupMenu.FactoryClassTypes.SeparatorMenuItemClass;
            return PopupMenu.FactoryClassTypes.MenuItemClass;
        }
        return null;
    },

    _getGdkIcon: function(value) {
        try {
            if (value) {
                let data = value.get_data_as_bytes()
                let stream = Gio.MemoryInputStream.new_from_bytes(data);
                return GdkPixbuf.Pixbuf.new_from_stream(stream, null);
            }
        } catch(e) {
            global.log("Error loading icon: " + e.message);
        }
        return null;
    },

    destroy: function() {
        if (this._client) {
            PopupMenu.PopupMenuAbstractItem.prototype.destroy.call(this);
            this._client = null;
        }
    }
};

/**
 * #DBusClient:
 * @short_description: The client does the heavy lifting of actually reading layouts and distributing events.
 */
function DBusClient() {
    this._init.apply(this, arguments);
}

DBusClient.prototype = {

    _init: function(busName, busPath) {
        this._busName = busName;
        this._busPath = busPath;
        this._idLayoutUpdate = 0;
        this._shellMenu = null;
        // Will be set to true if a layout update is requested while one is already in progress
        // then the handler that completes the layout update will request another update
        this._flagLayoutUpdateRequired = false;
        this._flagLayoutUpdateInProgress = false;
        // Property requests are queued
        this._propertiesRequestedFor = []; // ids

        let initId = this.getRootId();

        this._items = {};
        this._items[initId] = new DbusMenuItem(initId, [],
            { 'children-display': GLib.Variant.new_string('rootmenu'), 'visible': GLib.Variant.new_boolean(false) }, this);

        this._startMainProxy();
    },

    getShellMenu: function() {
        return this._shellMenu;
    },

    setShellMenu: function(shellMenu) {
        this._shellMenu = shellMenu;
    },

    getRoot: function() {
        if (this._items)
            return this._items[this.getRootId()];
        return null;
    },

    getRootId: function() {
        return 0;
    },

    getItem: function(id) {
        if ((this._items)&&(id in this._items))
            return this._items[id];

        global.logWarning("trying to retrieve item for non-existing id "+id+" !?");
        return null;
    },

    // We don't need to cache and burst-send that since it will not happen that frequently
    sendAboutToShow: function(id) {
        if (this._proxyMenu) {
            this._proxyMenu.AboutToShowRemote(id, Lang.bind(this, function(result, error) {
                if (error)
                    global.logWarning("while calling AboutToShow: " + error);
                else if (result && result[0])
                    this._requestLayoutUpdate();
            }));
        }
    },

    sendEvent: function(id, event, params, timestamp) {
        if (this._proxyMenu) {
            if (!params)
                params = GLib.Variant.new_int32(0);
            this._proxyMenu.EventRemote(id, event, params, timestamp, 
                function(result, error) {}); // We don't care
            if (event == PopupMenu.FactoryEventTypes.opened)
                this.sendAboutToShow(id);
        }
    },

    _startMainProxy: function() {
        this._proxyMenu = new BusClientProxy(Gio.DBus.session, this._busName, this._busPath,
            Lang.bind(this, this._clientReady));
    },

    _requestLayoutUpdate: function() {
        if (this._idLayoutUpdate != 0)
            this._idLayoutUpdate = 0;
        if (this._flagLayoutUpdateInProgress)
            this._flagLayoutUpdateRequired = true;
        else
            this._beginLayoutUpdate();
    },

    _requestProperties: function(id) {
        // If we don't have any requests queued, we'll need to add one
        if (this._propertiesRequestedFor.length < 1)
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, this._beginRequestProperties));

        if (this._propertiesRequestedFor.filter(function(e) { return e === id; }).length == 0)
            this._propertiesRequestedFor.push(id);

    },

    _beginRequestProperties: function() {
        if (this._proxyMenu) {
            this._proxyMenu.GetGroupPropertiesRemote(this._propertiesRequestedFor, [],
                Lang.bind(this, this._endRequestProperties));
            this._propertiesRequestedFor = [];
        }
        return false;
    },

    _endRequestProperties: function(result, error) {
        if (error) {
            global.logWarning("Could not retrieve properties: " + error);
        } else if (this._items) {
            // For some funny reason, the result array is hidden in an array
            result[0].forEach(function([id, properties]) {
                if (!(id in this._items))
                    return;

                this._items[id].updatePropertiesAsVariant(properties);
            }, this);
        }
    },

    // Traverses the list of cached menu items and removes everyone that is not in the list
    // so we don't keep alive unused items
    _gcItems: function() {
        if (this._items) {
            let tag = new Date().getTime();

            let toTraverse = [ this.getRootId() ];
            while (toTraverse.length > 0) {
                let item = this.getItem(toTraverse.shift());
                item._dbusClientGcTag = tag;
                Array.prototype.push.apply(toTraverse, item.getChildrenIds());
            }

            for (let id in this._items)
                if (this._items[id]._dbusClientGcTag != tag)
                    delete this._items[id];
        }
    },

    // The original implementation will only request partial layouts if somehow possible
    // we try to save us from multiple kinds of race conditions by always requesting a full layout
    _beginLayoutUpdate: function() {
        // We only read the type property, because if the type changes after reading all properties,
        // the view would have to replace the item completely which we try to avoid
        if (this._proxyMenu) {
            this._proxyMenu.GetLayoutRemote(0, -1, [ 'type', 'children-display' ], Lang.bind(this, this._endLayoutUpdate));
            this._flagLayoutUpdateInProgress = true;
        }
        this._flagLayoutUpdateRequired = false;

    },

    _endLayoutUpdate: function(result, error) {
        if (error) {
            global.logWarning("While reading menu layout: " + error);
            return;
        }

        let [ revision, root ] = result;
        this._doLayoutUpdate(root);

        this._gcItems();

        if (this._flagLayoutUpdateRequired)
            this._beginLayoutUpdate();
        else
            this._flagLayoutUpdateInProgress = false;
    },

    _doLayoutUpdate: function(item) {
        let [ id, properties, children ] = item;
        if (this._items) {
            let childrenUnpacked = children.map(function(child) { return child.deep_unpack(); });
            let childrenIds = childrenUnpacked.map(function(child) { return child[0]; });

            // Make sure all our children exist
            childrenUnpacked.forEach(this._doLayoutUpdate, this);

            // Make sure we exist
            if (id in this._items) {
                // We do, update our properties if necessary
                this._items[id].updatePropertiesAsVariant(properties);

                // Make sure our children are all at the right place, and exist
                let oldChildrenIds = this._items[id].getChildrenIds();
                for (let i = 0; i < childrenIds.length; ++i) {
                    // Try to recycle an old child
                    let oldChild = -1;
                    for (let j = 0; j < oldChildrenIds.length; ++j) {
                        if (oldChildrenIds[j] == childrenIds[i]) {
                            oldChild = oldChildrenIds.splice(j, 1)[0];
                            break;
                        }
                    }

                    if (oldChild < 0) {
                        // No old child found, so create a new one!
                        this._items[id].addChild(i, childrenIds[i]);
                    } else {
                        // Old child found, reuse it!
                        this._items[id].moveChild(childrenIds[i], i);
                    }
                }

                // Remove any old children that weren't reused
                oldChildrenIds.forEach(function(child_id) {
                    this._items[id].removeChild(child_id); 
                }, this);
            } else {
                // We don't, so let's create us
                this._items[id] = new DbusMenuItem(id, childrenIds, properties, this);
                this._requestProperties(id);
            }
        }
        return id;
    },

    _clientReady: function(result, error) {
        if (error) {
            //FIXME: show message to the user?
            global.logWarning("Could not initialize menu proxy: " + error);
            return;
        }
        this._requestLayoutUpdate();

        // Listen for updated layouts and properties
        if (this._proxyMenu) {
            this._proxyMenu.connectSignal("LayoutUpdated", Lang.bind(this, this._onLayoutUpdated));
            this._proxyMenu.connectSignal("ItemsPropertiesUpdated", Lang.bind(this, this._onPropertiesUpdated));
        }
    },

    _onLayoutUpdated: function(proxy, sender, items) {
        if (this._idLayoutUpdate == 0) {
            this._idLayoutUpdate = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE,
                Lang.bind(this, this._requestLayoutUpdate));
        }
    },

    _onPropertiesUpdated: function(proxy, name, [changed, removed]) {
        if (this._items) {
            changed.forEach(function([id, properties]) {
                if (!(id in this._items))
                    return;

                this._items[id].updatePropertiesAsVariant(properties);
            }, this);
            removed.forEach(function([id, propNames]) {
                if (!(id in this._items))
                    return;

                let properties = {};            
                propNames.forEach(function(propName) {
                    properties[propName] = null;
                }, this);
                this._items[id].updatePropertiesAsVariant(properties);
            }, this);
        }
    },

    destroy: function() {
        if (this._proxyMenu) {
            Signals._disconnectAll.apply(this._proxyMenu);
            this._proxyMenu = null;
            let root = this.getRoot();
            root.destroy();
            this._items = null;
        }
    }
};
