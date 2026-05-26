// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Flashspot = imports.ui.flashspot;
const Main = imports.ui.main;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Layout = imports.ui.layout;

const SELECT_WINDOW_VALID_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.UTILITY,
    Meta.WindowType.SPLASHSCREEN,
];

// Pulls the Gtk "rubberband" style class colors used by both area- and
// window-selection. Returns a Clutter.Color for the shading masks and a
// CSS-string for St.Widget borders.
function rubberbandStyle() {
    let path = new Gtk.WidgetPath();
    path.append_type(Gtk.IconView);
    let context = new Gtk.StyleContext();
    context.set_path(path);
    context.add_class('rubberband');

    let bg = context.get_background_color(Gtk.StateFlags.NORMAL);
    let maskColor = new Clutter.Color({
        red: bg.red * 255, green: bg.green * 255, blue: bg.blue * 255,
        alpha: bg.alpha * 255,
    });

    let bd = context.get_border_color(Gtk.StateFlags.NORMAL);
    let borderStyle = `border: 1px solid rgba(${Math.round(bd.red * 255)},${Math.round(bd.green * 255)},${Math.round(bd.blue * 255)},${bd.alpha});`;

    return { maskColor, borderStyle };
}

// Shades the stage everywhere except the rect passed to update(). Pass null
// to fully shade. The four mask actors are added to `parent` in z-order, so
// any actor added to the same parent after the shader (rubberband, OSD)
// renders on top of the masks.
class RegionShader {
    constructor(parent, color) {
        this._top    = new Clutter.Actor({ background_color: color });
        this._bottom = new Clutter.Actor({ background_color: color });
        this._left   = new Clutter.Actor({ background_color: color });
        this._right  = new Clutter.Actor({ background_color: color });
        parent.add_actor(this._top);
        parent.add_actor(this._bottom);
        parent.add_actor(this._left);
        parent.add_actor(this._right);
        this.update(null);
    }

    update(rect) {
        let stageW = global.stage.width;
        let stageH = global.stage.height;

        if (rect === null) {
            this._top.set_position(0, 0);
            this._top.set_size(stageW, stageH);
            this._bottom.set_size(0, 0);
            this._left.set_size(0, 0);
            this._right.set_size(0, 0);
            return;
        }

        let left   = Math.max(0, rect.x);
        let top    = Math.max(0, rect.y);
        let right  = Math.min(stageW, rect.x + rect.width);
        let bottom = Math.min(stageH, rect.y + rect.height);
        let strip  = Math.max(0, bottom - top);

        this._top.set_position(0, 0);
        this._top.set_size(stageW, top);

        this._bottom.set_position(0, bottom);
        this._bottom.set_size(stageW, Math.max(0, stageH - bottom));

        this._left.set_position(0, top);
        this._left.set_size(left, strip);

        this._right.set_position(right, top);
        this._right.set_size(Math.max(0, stageW - right), strip);
    }
}

const ScreenshotIface =
    '<node> \
        <interface name="org.cinnamon.Screenshot"> \
            <method name="ScreenshotArea"> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="ScreenshotWindow"> \
                <arg type="b" direction="in" name="include_shadow"/> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="ScreenshotWindowById"> \
                <arg type="t" direction="in" name="window_id"/> \
                <arg type="b" direction="in" name="include_shadow"/> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="Screenshot"> \
                <arg type="b" direction="in" name="include_cursor"/> \
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
            <method name="SelectWindow"> \
              <arg type="t" direction="out" name="window_id"/> \
            </method> \
            <method name="PickColor"> \
               <arg type="a{sv}" direction="out" name="result"/> \
            </method> \
        </interface> \
    </node>';

/*
 * This interface is specifically for cinnamon-screenshot purposes.
 * The screenshot calls are not asynchronous to the caller but
 * it allows us to be sure the png has been written prior to
 * completing the invocation.
 */

var ScreenshotService = class ScreenshotService {
    constructor() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(ScreenshotIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/cinnamon/Screenshot');

        Gio.DBus.session.own_name('org.cinnamon.Screenshot', Gio.BusNameOwnerFlags.REPLACE, null, null);
    }

    _onScreenshotComplete (obj, success, area, filename, invocation=null) {
        if (success) {
            let flashspot = new Flashspot.Flashspot(area);
            flashspot.fire();
        }

        let retval = GLib.Variant.new('(bs)', [success, filename]);
        invocation.return_value(retval);
    }

    ScreenshotAreaAsync(params, invocation) {
        let [x, y, width, height, include_cursor, filename] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_area(
            include_cursor,
            x * global.ui_scale,
            y * global.ui_scale,
            width * global.ui_scale,
            height * global.ui_scale,
            filename,
            (obj, success, area) => this._onScreenshotComplete(obj, success, area, filename, invocation)
        );
    }

    ScreenshotWindowAsync(params, invocation) {
        let [include_shadow, include_cursor, filename] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_window(include_shadow, include_cursor, filename,
            (obj, success, area) => this._onScreenshotComplete(obj, success, area, filename, invocation));
    }

    ScreenshotWindowByIdAsync(params, invocation) {
        let [window_id, include_shadow, include_cursor, filename] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_window_by_id(window_id, include_shadow, include_cursor, filename,
            (obj, success, area) => this._onScreenshotComplete(obj, success, area, filename, invocation));
    }

    ScreenshotAsync(params, invocation) {
        let [include_cursor, filename] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot(include_cursor, filename,
            (obj, success, area) => this._onScreenshotComplete(obj, success, area, filename, invocation));
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

    SelectWindowAsync(params, invocation) {
        let selectWindow = new SelectWindow();
        selectWindow.show();
        selectWindow.connect('finished', (sw, window) => {
            if (window === null) {
                invocation.return_error_literal(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED,
                    "Operation was cancelled");
                return;
            }
            let retval = GLib.Variant.new('(t)', [window.get_id()]);
            invocation.return_value(retval);
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

        this.active = false;
        this.stage_event_id = 0;

        let { maskColor, borderStyle } = rubberbandStyle();

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

        this._shader = new RegionShader(this._group, maskColor);

        this._rubberband = new St.Widget({ style: borderStyle });
        this._group.add_actor(this._rubberband);
    }

    show() {
        if (!Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.NONE,
                            () => this._ungrab()))
            return;
        this._group.connect('key-press-event', (o, e) => this._onKeyPressEvent(o, e));

        global.set_cursor(Cinnamon.Cursor.CROSSHAIR);
        Main.uiGroup.set_child_above_sibling(this._group, null);
        this._group.visible = true;
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
        this._shader.update(geometry);

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
        this._shader.update({ x: this._startX, y: this._startY, width: 0, height: 0 });

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
        this._group.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
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
        if (!Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.NONE,
                            () => this._ungrab()))
            return;
        this._group.connect('key-press-event', (o, e) => this._onKeyPressEvent(o, e));

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
        this._group.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
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

class SelectWindow {
    constructor() {
        this._result = null;
        this._hoverWindow = null;

        let { maskColor } = rubberbandStyle();

        this._group = new St.Widget({
            visible: false,
            reactive: true,
            x: 0,
            y: 0,
            layout_manager: new Clutter.FixedLayout()
        });
        Main.uiGroup.add_actor(this._group);

        this._group.connect('button-press-event', this._onButtonPress.bind(this));
        this._group.connect('motion-event', this._onMotionEvent.bind(this));

        let constraint = new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL
        });
        this._group.add_constraint(constraint);

        this._shader = new RegionShader(this._group, maskColor);

        this._osdContainer = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            reactive: false,
        });
        this._osdContainer.add_constraint(new Layout.MonitorConstraint({
            primary: true,
            work_area: true,
        }));

        this._osd = new St.BoxLayout({
            style_class: 'media-keys-osd',
            important: true,
            style: 'margin-top: 40px;',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
        });
        this._osd.add_child(new St.Label({
            text: _("Select a window — press Esc to cancel"),
            y_align: Clutter.ActorAlign.CENTER,
        }));

        this._osdContainer.add_child(this._osd);
        this._group.add_actor(this._osdContainer);
    }

    show() {
        if (!Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.NONE,
                            () => this._ungrab()))
            return;
        this._group.connect('key-press-event', this._onKeyPressEvent.bind(this));

        global.set_cursor(Cinnamon.Cursor.CROSSHAIR);
        Main.uiGroup.set_child_above_sibling(this._group, null);
        this._group.visible = true;

        this._syncHover();
    }

    _syncHover() {
        let window = this._pointerWindowIfValid();
        this._hoverWindow = window;
        this._shader.update(window !== null ? window.get_frame_rect() : null);
    }

    _onKeyPressEvent(object, keyPressEvent) {
        let modifiers = Cinnamon.get_event_state(keyPressEvent);
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        let symbol = keyPressEvent.get_key_symbol();
        if (symbol === Clutter.KEY_Escape && !(modifiers & ctrlAltMask)) {
            this._result = null;
            this._ungrab();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_STOP;
    }

    _pointerWindowIfValid() {
        let window = global.display.get_pointer_window(null);
        if (window === null)
            return null;
        if (SELECT_WINDOW_VALID_TYPES.indexOf(window.get_window_type()) === -1)
            return null;
        return window;
    }

    _onMotionEvent(actor, event) {
        this._syncHover();
        return Clutter.EVENT_PROPAGATE;
    }

    _onButtonPress(actor, event) {
        let window = this._pointerWindowIfValid();
        if (window === null)
            return Clutter.EVENT_STOP;

        this._result = window;
        this._group.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._ungrab();
            }
        });

        return Clutter.EVENT_STOP;
    }

    _ungrab() {
        Main.popModal(this._group);
        global.unset_cursor();
        this.emit('finished', this._result);

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._group.destroy();
            return GLib.SOURCE_REMOVE;
        });
    }
};
Signals.addSignalMethods(SelectWindow.prototype);
