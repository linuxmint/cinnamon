// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Config = imports.misc.config;
const Extension = imports.ui.extension;
const Flashspot = imports.ui.flashspot;
const Main = imports.ui.main;
const AppletManager = imports.ui.appletManager;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const SearchProviderManager = imports.ui.searchProviderManager;
const ModalDialog = imports.ui.modalDialog;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Tweener = imports.ui.tweener;

const ScreenshotIface =
    '<node> \
        <interface name="org.gnome.Shell.Screenshot"> \
            <method name="ScreenshotArea"> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="ScreenshotWindow"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="Screenshot"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="FlashArea"> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
            </method> \
            <method name="SelectArea"> \
              <arg type="i" direction="out" name="x"/> \
              <arg type="i" direction="out" name="y"/> \
              <arg type="i" direction="out" name="width"/> \
              <arg type="i" direction="out" name="height"/> \
            </method> \
            <method name="PickColor"> \
               <arg type="a{sv}" direction="out" name="result"/> \
            </method> \
        </interface> \
    </node>';

/*
 * This interface is specifically for gnome-screenshot purposes.
 * The screenshot calls are not asynchronous to the caller but
 * it allows us to be sure the png has been written prior to
 * completing the invocation.
 * 
 * The callback argument is unused.
 */

var ScreenshotService = class ScreenshotService {
    constructor() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(ScreenshotIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/gnome/Shell/Screenshot');

        Gio.DBus.session.own_name('org.gnome.Shell.Screenshot', Gio.BusNameOwnerFlags.REPLACE, null, null);
    }

    _onScreenshotComplete (obj, success, area, flash, filename, invocation=null) {
        if (success) {
            if (flash) {
                let flashspot = new Flashspot.Flashspot(area);
                flashspot.fire();
            }
        }

        let retval = GLib.Variant.new('(bs)', [success, filename]);
        invocation.return_value(retval);
    }

    ScreenshotAreaAsync(params, invocation) {
        let [x, y, width, height, flash, filename, callback] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_area(
            false,
            x * global.ui_scale,
            y * global.ui_scale,
            width * global.ui_scale,
            height * global.ui_scale,
            filename,
            Lang.bind(this, this._onScreenshotComplete, flash, filename, invocation)
        );
    }

    ScreenshotWindowAsync(params, invocation) {
        let [include_frame, include_cursor, flash, filename, callback] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_window(include_frame, include_cursor, filename,
            Lang.bind(this, this._onScreenshotComplete, flash, filename, invocation));
    }

    ScreenshotAsync(params, invocation) {
        let [include_cursor, flash, filename] = params

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot(include_cursor, filename,
            Lang.bind(this, this._onScreenshotComplete, flash, filename, invocation));
    }

    SelectAreaAsync(params, invocation) {
        let selectArea = new SelectArea();
        selectArea.show();
        selectArea.connect('finished', (selectArea, areaRectangle) => {
            if (areaRectangle && areaRectangle.width > 0 && areaRectangle.height > 0) {
                let x = areaRectangle.x / global.ui_scale;
                let y = areaRectangle.y / global.ui_scale;
                let w = areaRectangle.width / global.ui_scale;
                let h = areaRectangle.height / global.ui_scale;
                let retval = GLib.Variant.new('(iiii)', [x, y, w, h]);
                invocation.return_value(retval);
            } else {
                invocation.return_error_literal(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED,
                    "Operation was cancelled");
            }
        });
    }

    PickColorAsync(params, invocation) {
        let pickColor = new PickColor();

        try {
            pickColor.show();

            pickColor.connect('finished', (pickColor, point) => {
                if (point == null) {
                    // User cancelled (Escape)
                    invocation.return_error_literal(
                        Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED,
                        'Operation was cancelled');
                    return;
                }

                let x = point.x / global.ui_scale;
                let y = point.y / global.ui_scale;

                let screenshot = new Cinnamon.Screenshot();

                screenshot.pick_color(
                    point.x,
                    point.y,
                    (obj, success, color, inv=null) => {
                        let retval = GLib.Variant.new('(a{sv})', [{
                            color: GLib.Variant.new('(ddd)', [
                                color.red / 255.0,
                                color.green / 255.0,
                                color.blue / 255.0,
                            ]),
                        }]);

                        invocation.return_value(retval);
                    }
                );
            });
        } catch (e) {
            invocation.return_error_literal(
                Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED,
                'Operation was cancelled');
        }
    }

    FlashAreaAsync(params, invocation) {
        let [x, y, width, height] = params;

        let flashspot = new Flashspot.Flashspot({
            x: x * global.ui_scale,
            y: y * global.ui_scale,
            width: width * global.ui_scale,
            height: height * global.ui_scale
        });
        flashspot.fire();
        invocation.return_value(null);
    }
}

class SelectArea {
    constructor() {
        this._startX = -1;
        this._startY = -1;
        this._lastX = 0;
        this._lastY = 0;
        this._result = null;

        this.top_mask = null;
        this.bottom_mask = null;
        this.left_mask = null;
        this.right_mask = null;

        this.active = false;
        this.stage_event_id = 0;

        this._initRubberbandColors();

        this._group = new St.Widget(
            { 
                visible: false,
                reactive: true,
                x: 0,
                y: 0,
                layout_manager: new Clutter.FixedLayout()
            }
        );
        Main.uiGroup.add_actor(this._group);

        this._group.connect('button-press-event',
                            this._onButtonPress.bind(this));
        this._group.connect('button-release-event',
                            this._onButtonRelease.bind(this));
        this._group.connect('motion-event',
                            this._onMotionEvent.bind(this));

        let constraint = new Clutter.BindConstraint({ source: global.stage,
                                                      coordinate: Clutter.BindCoordinate.ALL });
        this._group.add_constraint(constraint);

        this._setupMasks();

        this._rubberband = new Clutter.Rectangle(
            {
                color: new Clutter.Color({ alpha: 0 }),
                has_border: true,
                border_width: 1,
                border_color: this._border
            }
        );

        this._group.add_actor(this._rubberband);
    }

    show() {
        if (!Main.pushModal(this._group))
            return;
        this._group.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

        global.set_cursor(Cinnamon.Cursor.CROSSHAIR);
        Main.uiGroup.set_child_above_sibling(this._group, null);
        this._group.visible = true;
    }

    _initRubberbandColors() {
        function colorFromRGBA(rgba) {
            return new Clutter.Color({ red: rgba.red * 255,
                                       green: rgba.green * 255,
                                       blue: rgba.blue * 255,
                                       alpha: rgba.alpha * 255 });
        }

        let path = new Gtk.WidgetPath();
        path.append_type(Gtk.IconView);

        let context = new Gtk.StyleContext();
        context.set_path(path);
        context.add_class('rubberband');

        this._background = colorFromRGBA(context.get_background_color(Gtk.StateFlags.NORMAL));
        this._border = colorFromRGBA(context.get_border_color(Gtk.StateFlags.NORMAL));
    }

    _setupMasks() {
        this.top_mask = new Clutter.Rectangle(
            {
                x: 0,
                y: 0,
                width: global.stage.width,
                height: global.stage.height,
                color: this._background
            }
        );
        this._group.add_actor(this.top_mask);

        this.bottom_mask = new Clutter.Rectangle(
            {
                x: 0,
                y: global.stage.height,
                width: global.stage.width,
                height: 0,
                color: this._background
            }
        );
        this._group.add_actor(this.bottom_mask);

        this.left_mask = new Clutter.Rectangle(
            {
                color: this._background
            }
        );
        this._group.add_actor(this.left_mask);

        this.right_mask = new Clutter.Rectangle(
            {
                color: this._background
            }
        );
        this._group.add_actor(this.right_mask);
    }

    _getGeometry() {
        return { x: Math.min(this._startX, this._lastX),
                 y: Math.min(this._startY, this._lastY),
                 width: Math.abs(this._startX - this._lastX),
                 height: Math.abs(this._startY - this._lastY) };
    }

    _onKeyPressEvent(object, keyPressEvent) {
        let modifiers = Cinnamon.get_event_state(keyPressEvent);
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        let symbol = keyPressEvent.get_key_symbol();
        if (symbol === Clutter.KEY_Escape && !(modifiers & ctrlAltMask)) {
            this._ungrab()
            return;
        }

        return Clutter.EVENT_STOP;
    }

    _onMotionEvent(actor, event) {
        if (this._startX == -1 || this._startY == -1)
            return Clutter.EVENT_PROPAGATE;

        [this._lastX, this._lastY] = event.get_coords();
        this._lastX = Math.floor(this._lastX);
        this._lastY = Math.floor(this._lastY);
        let geometry = this._getGeometry();

        this._rubberband.set_position(geometry.x, geometry.y);
        this._rubberband.set_size(geometry.width, geometry.height);

        this.top_mask.height = this._rubberband.y;

        this.bottom_mask.y = this._rubberband.y + this._rubberband.height;
        this.bottom_mask.height = global.stage.height - this.bottom_mask.y;

        this.left_mask.width = this._rubberband.x;
        this.left_mask.y = this._rubberband.y;
        this.left_mask.height = this._rubberband.height;

        this.right_mask.x = this._rubberband.x + this._rubberband.width;
        this.right_mask.width = global.stage.width - this.right_mask.x;
        this.right_mask.y = this._rubberband.y;
        this.right_mask.height = this._rubberband.height;

        return Clutter.EVENT_PROPAGATE;
    }

    _onButtonPress(actor, event) {
        if (this.active) {
            return Clutter.EVENT_STOP;
        }

        [this._startX, this._startY] = event.get_coords();
        this._startX = Math.floor(this._startX);
        this._startY = Math.floor(this._startY);
        this._rubberband.set_position(this._startX, this._startY);

        this.top_mask.height = this._startY;
        this.bottom_mask.y = this._startY;
        this.bottom_mask.height = global.stage.height - this._startY;

        this._lastX = this._startX;
        this._lastY = this._startY;

        this.active = true;

        this.stage_event_id = global.stage.connect("captured-event", (actor, event) => {
            if (Main.modalCount === 0)
                return false;

            if (event.type() === Clutter.EventType.BUTTON_RELEASE) {
                return this._onButtonRelease(actor, event);
            }

            return Clutter.EVENT_PROPAGATE;
        });
    }

    _onButtonRelease(actor, event) {
        this._result = this._getGeometry();
        Tweener.addTween(this._group,
                         { opacity: 0,
                           time: 0.1,
                           transition: 'easeOutQuad',
                           onComplete: () => {
                               this._ungrab();
                           }
                         });
        return Clutter.EVENT_PROPAGATE;
    }

    _ungrab() {
        this.active = false;

        if (this.stage_event_id > 0) {
            global.stage.disconnect(this.stage_event_id);
            this.stage_event_id = 0;
        }

        Main.popModal(this._group);
        global.unset_cursor();
        this.emit('finished', this._result);

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._group.destroy();
            return GLib.SOURCE_REMOVE;
        });
    }
};
Signals.addSignalMethods(SelectArea.prototype);

class PickColor {
    constructor() {
        this._pickX = -1;
        this._pickY = -1;
        this._result = null;

        this.active = false;
        this.stage_event_id = 0;

        this._group = new St.Widget(
            { 
                visible: false,
                reactive: true,
                x: 0,
                y: 0,
                layout_manager: new Clutter.FixedLayout()
            }
        );
        Main.uiGroup.add_actor(this._group);

        this._group.connect('button-press-event',
                            this._onButtonPress.bind(this));
        this._group.connect('button-release-event',
                            this._onButtonRelease.bind(this));

        let constraint = new Clutter.BindConstraint({ source: global.stage,
                                                      coordinate: Clutter.BindCoordinate.ALL });
        this._group.add_constraint(constraint);
    }

    show() {
        if (!Main.pushModal(this._group))
            return;
        this._group.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

        global.set_cursor(Cinnamon.Cursor.CROSSHAIR);
        Main.uiGroup.set_child_above_sibling(this._group, null);
        this._group.visible = true;
    }

    _getGeometry() {
        return { x: this._pickX,
                 y: this._pickY,
                 width: 1,
                 height: 1 };
    }

    _onKeyPressEvent(object, keyPressEvent) {
        let modifiers = Cinnamon.get_event_state(keyPressEvent);
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        let symbol = keyPressEvent.get_key_symbol();
        if (symbol === Clutter.KEY_Escape && !(modifiers & ctrlAltMask)) {
            this._ungrab()
            return;
        }

        return Clutter.EVENT_STOP;
    }

    _onButtonPress(actor, event) {
        if (this.active) {
            return Clutter.EVENT_STOP;
        }

        [this._pickX, this._pickY] = event.get_coords();
        this._pickX = Math.floor(this._pickX);
        this._pickY = Math.floor(this._pickY);

        this.active = true;

        this.stage_event_id = global.stage.connect("captured-event", (actor, event) => {
            if (Main.modalCount === 0)
                return false;

            if (event.type() === Clutter.EventType.BUTTON_RELEASE) {
                return this._onButtonRelease(actor, event);
            }

            return Clutter.EVENT_PROPAGATE;
        });
    }

    _onButtonRelease(actor, event) {
        this._result = this._getGeometry();
        Tweener.addTween(this._group,
                         { opacity: 0,
                           time: 0.1,
                           transition: 'easeOutQuad',
                           onComplete: () => {
                               this._ungrab();
                           }
                         });
        return Clutter.EVENT_PROPAGATE;
    }

    _ungrab() {
        this.active = false;

        if (this.stage_event_id > 0) {
            global.stage.disconnect(this.stage_event_id);
            this.stage_event_id = 0;
        }

        Main.popModal(this._group);
        global.unset_cursor();
        this.emit('finished', this._result);

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._group.destroy();
            return GLib.SOURCE_REMOVE;
        });
    }
};
Signals.addSignalMethods(PickColor.prototype);
