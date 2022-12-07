const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Interfaces = imports.misc.interfaces;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;
const Gtk = imports.gi.Gtk;
const XApp = imports.gi.XApp;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;

const HORIZONTAL_STYLE = 'padding-left: 2px; padding-right: 2px; padding-top: 0; padding-bottom: 0';
const VERTICAL_STYLE = 'padding-left: 0; padding-right: 0; padding-top: 2px; padding-bottom: 2px';


class RecorderIcon {
    constructor(applet) {
        this.applet = applet;
        this.actor = new St.BoxLayout({
            style_class: "applet-box",
            reactive: false,
            visible: false,
            x_expand: true,
            y_expand: true
        });

        this.icon_holder = new St.Bin();
        this.iconSize = this.applet.getPanelIconSize(St.IconType.FULLCOLOR);

        this.actor.add_actor(this.icon_holder);

        this._indicator = new St.DrawingArea();
        this._indicator.connect("repaint", (area) => this._paint(area));
        this.icon_holder.add_actor(this._indicator);

        this._recordListenerId = Main.screenRecorder.connect("recording", () => this._recordingStateChanged());
        this._recordingStateChanged();
    }

    _recordingStateChanged() {
        this.actor.visible = Main.screenRecorder.recording;
        this._indicator.queue_repaint();
    }

    _paint(area) {
        let [width, height] = area.get_surface_size();
        let size = Math.max(width, height);
        let node = area.get_theme_node();
        let border = node.get_foreground_color();

        let cr = area.get_context();

        let color = new Clutter.Color({ red: 255, green: 0, blue: 0, alpha: 255 });
        Clutter.cairo_set_source_color(cr, color);

        cr.arc(
            width / 2,
            height / 2,
            size / 4.0,
            0.0,
            2.0 * Math.PI
        )

        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, border);
        cr.stroke();
        cr.$dispose();
    }

    refresh() {
        this.setOrientation(this.applet.orientation);
        this._indicator.set_size(this.iconSize, this.iconSize);
        this._indicator.queue_repaint();
    }

    setOrientation(orientation) {
        switch (orientation) {
            case St.Side.TOP:
            case St.Side.BOTTOM:
                this.actor.vertical = false;
                this.actor.remove_style_class_name("vertical");
                break;
            case St.Side.LEFT:
            case St.Side.RIGHT:
                this.actor.vertical = true;
                this.actor.add_style_class_name("vertical");
                break;
        }
    }

    destroy() {
        if (this._recordListenerId > 0) {
            Main.screenRecorder.disconnect(this._recordListenerId);
            this._recordListenerId = 0;
        }
    }
}

class XAppStatusIcon {
    constructor(applet, proxy) {
        this.name = proxy.get_name();
        this.applet = applet;
        this.proxy = proxy;

        this.iconName = null;

        this.actor = new St.BoxLayout({
            style_class: "applet-box",
            reactive: !global.settings.get_boolean('panel-edit-mode'),
            track_hover: true,
            // The systray use a layout manager, we need to fill the space of the actor
            // or otherwise the menu will be displayed inside the panel.
            x_expand: true,
            y_expand: true
        });

        this.icon_holder = new St.Bin();
        this.iconSize = this.applet.getPanelIconSize(St.IconType.FULLCOLOR);

        this.proxy.icon_size = this.iconSize;

        this.label = new St.Label({
            'y-align': St.Align.END,
        });

        this.actor.add_actor(this.icon_holder);
        this.actor.add_actor(this.label);

        this._tooltip = new Tooltips.PanelItemTooltip(this, "", applet.orientation);

        this.actor.connect('button-press-event', Lang.bind(this, this.onButtonPressEvent));
        this.actor.connect('button-release-event', Lang.bind(this, this.onButtonReleaseEvent));
        this.actor.connect('scroll-event', (...args) => this.onScrollEvent(...args));
        this.actor.connect('enter-event', Lang.bind(this, this.onEnterEvent));

        this._proxy_prop_change_id = this.proxy.connect('g-properties-changed', Lang.bind(this, this.on_properties_changed))

        this.refresh();
    }

    on_properties_changed(proxy, changed_props, invalidated_props) {
        let prop_names = changed_props.deep_unpack();

        if ('IconName' in prop_names) {
            this.setIconName(proxy.icon_name);
        }
        if ('TooltipText' in prop_names) {
            this.setTooltipText(proxy.tooltip_text);
        }
        if ('Label' in prop_names) {
            this.setLabel(proxy.label);
        }
        if ('Visible' in prop_names) {
            this.setVisible(proxy.visible);
        }
        if ('Name' in prop_names) {
            this.applet.sortIcons();
        }
        if ('PrimaryMenuIsOpen' in prop_names) {
            if (!proxy.primary_menu_is_open) {
                this.actor.sync_hover();
            }
        }
        if ('SecondaryMenuIsOpen' in prop_names) {
            if (!proxy.secondary_menu_is_open) {
                this.actor.sync_hover();
            }
        }
        return;
    }

    refresh() {
        this.setIconName(this.proxy.icon_name);
        this.setLabel(this.proxy.label);
        this.setTooltipText(this.proxy.tooltip_text);
        this.setVisible(this.proxy.visible);
        this.setOrientation(this.applet.orientation);

        this.actor.queue_relayout();
    }

    setOrientation(orientation) {
        switch (orientation) {
            case St.Side.TOP:
            case St.Side.BOTTOM:
                this.actor.vertical = false;
                this.actor.remove_style_class_name("vertical");
                break;
            case St.Side.LEFT:
            case St.Side.RIGHT:
                this.actor.vertical = true;
                this.actor.add_style_class_name("vertical");
                break;
        }
    }

    setIconName(iconName) {
        if (iconName) {
            let type, icon;

            if (iconName.match(/symbolic/)) {
                type = St.IconType.SYMBOLIC;
            }
            else {
                type = St.IconType.FULLCOLOR;
            }

            this.iconName = iconName;
            this.iconSize = this.applet.getPanelIconSize(type);
            this.proxy.icon_size = this.iconSize;

            // Assume symbolic icons would always be square/suitable for an StIcon.
            if (iconName.includes("/") && type != St.IconType.SYMBOLIC) {
                this.icon_loader_handle = St.TextureCache.get_default().load_image_from_file_async(
                    iconName,
                    /* If top/bottom panel, allow the image to expand horizontally,
                     * otherwise, restrict it to a square (but keep aspect ratio.) */
                    this.actor.vertical ? this.iconSize : -1,
                    this.iconSize,
                    (...args)=>this._onImageLoaded(...args)
                );

                return;
            }
            else {
                icon = new St.Icon( { "icon-type": type, "icon-size": this.iconSize, "icon-name": iconName });
                this.icon_holder.show();
                this.icon_holder.child = icon;
            }
        }
        else {
            this.iconName = null;
            this.icon_holder.hide();
        }
    }

    _onImageLoaded(cache, handle, actor, data=null) {
        if (handle !== this.icon_loader_handle) {
            global.logError(`xapp-status@cinnamon.org: Icon or image seems out of sync (${this.name}`);
            return;
        }

        this.icon_holder.child = actor;
        this.icon_holder.show();
    }

    setTooltipText(tooltipText) {
        if (tooltipText) {
            this._tooltip.preventShow = false;
        }
        else {
            tooltipText = "";
            this._tooltip.preventShow = true;
        }
        this._tooltip.set_markup(tooltipText);
        // If the tooltip is currently visible, then we might need to trigger a realignment of the tooltip after changing the text length
        if (this._tooltip.visible) {
           this._tooltip.hide();
           this._tooltip.show();
        }
    }

    setLabel(label) {
        if (label) {
            this.label.set_text(label);
        } else {
            this.label.set_text("");
        }

        this.show_label = (this.applet.orientation == St.Side.TOP || this.applet.orientation == St.Side.BOTTOM) &&
                           this.proxy.label.length > 0;

        this.label.visible = this.show_label;
    }

    setVisible(visible) {
        if (visible) {
            this.actor.show();
        }
        else {
            this.actor.hide();
        }
    }

    onEnterEvent(actor, event) {
        this._tooltip.preventShow = false;
    }

    getEventPositionInfo(actor) {
        let allocation = Cinnamon.util_get_transformed_allocation(actor);

        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        let w = Math.round((allocation.x2 - allocation.x1) / global.ui_scale)
        let h = Math.round((allocation.y2 - allocation.y1) / global.ui_scale)

        let final_x, final_y, final_o;

        switch (this.applet.orientation) {
            case St.Side.TOP:
                final_x = x;
                final_y = y + h;
                final_o = Gtk.PositionType.TOP;
                break;
            case St.Side.BOTTOM:
            default:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.BOTTOM;
                break;
            case St.Side.LEFT:
                final_x = x + w;
                final_y = y
                final_o = Gtk.PositionType.LEFT;
                break;
            case St.Side.RIGHT:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.RIGHT;
                break;
        }

        return [final_x, final_y, final_o];
    }

    onButtonPressEvent(actor, event) {
        this._tooltip.hide();
        this._tooltip.preventShow = true;

        if (event.get_button() == Clutter.BUTTON_SECONDARY && event.get_state() & Clutter.ModifierType.CONTROL_MASK) {
            return Clutter.EVENT_PROPAGATE;
        }

        let [x, y, o] = this.getEventPositionInfo(actor);

        this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onButtonReleaseEvent(actor, event) {
        let [x, y, o] = this.getEventPositionInfo(actor);

        this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction != Clutter.ScrollDirection.SMOOTH) {
            let x_dir = XApp.ScrollDirection.UP;
            let delta = 0;

            if (direction == Clutter.ScrollDirection.UP) {
                x_dir = XApp.ScrollDirection.UP;
                delta = -1;
            } else if (direction == Clutter.ScrollDirection.DOWN) {
                x_dir = XApp.ScrollDirection.DOWN;
                delta = 1;
            } else if (direction == Clutter.ScrollDirection.LEFT) {
                x_dir = XApp.ScrollDirection.LEFT;
                delta = -1;
            } else if (direction == Clutter.ScrollDirection.RIGHT) {
                x_dir = XApp.ScrollDirection.RIGHT;
                delta = 1;
            }

            this.proxy.call_scroll(delta, x_dir, event.get_time(), null, null);
        }

        return Clutter.EVENT_STOP;
    }

    destroy() {
        this.proxy.disconnect(this._proxy_prop_change_id);
        this._proxy_prop_change_id = 0;
        this._tooltip.destroy();
    }
}

class CinnamonXAppStatusApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.manager_container = new St.BoxLayout( { vertical: false, style: HORIZONTAL_STYLE });
        } else {
            this.manager_container = new St.BoxLayout( { vertical: true, style: VERTICAL_STYLE });
        }

        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        this._recording_indicator = new RecorderIcon(this);
        this.manager_container.add_actor(this._recording_indicator.actor);

        this.statusIcons = {};

        /* This doesn't really work 100% because applets get reloaded and we end up losing this
         * list. Not that big a deal in practice*/
        this.ignoredProxies = {};

        this.signalManager = new SignalManager.SignalManager(null);
        this._scaleUpdateId = 0;

        this.monitor = new XApp.StatusIconMonitor();
        this.signalManager.connect(this.monitor, "icon-added", this.onMonitorIconAdded, this);
        this.signalManager.connect(this.monitor, "icon-removed", this.onMonitorIconRemoved, this);

        this.signalManager.connect(Gtk.IconTheme.get_default(), 'changed', this.on_icon_theme_changed, this);
        this.signalManager.connect(global.settings, 'changed::panel-edit-mode', this.on_panel_edit_mode_changed, this);

        this.signalManager.connect(Main.systrayManager, "changed", this.onSystrayRolesChanged, this);

        /* HACK - the built-in on_panel_icon_size_changed() call only sends if the type (symbolic, fullcolor)
         * of the icon size matches the last type used by the applet.  Since this applet can contain both
         * types, listen to the panel signal directly, so we always receive the update. */
        this.signalManager.connect(this.panel, "icon-size-changed", this.icon_size_changed, this);
        this.signalManager.connect(global, "scale-changed", this.ui_scale_changed, this);
    }

    getKey(icon_proxy) {
        let proxy_name = icon_proxy.get_name();
        let proxy_path = icon_proxy.get_object_path()

        return proxy_name + proxy_path;
    }

    onMonitorIconAdded(monitor, icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (this.statusIcons[key]) {
            return;
        }

        if (this.shouldIgnoreStatusIcon(icon_proxy)) {
            global.log(`Hiding XAppStatusIcon (we have an applet): ${icon_proxy.name}`);
            this.ignoreStatusIcon(icon_proxy);

            return;
        }

        global.log(`Adding XAppStatusIcon: ${icon_proxy.name} (${key})`);
        this.addStatusIcon(icon_proxy);
    }

    onMonitorIconRemoved(monitor, icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (!this.statusIcons[key]) {
            if (this.ignoredProxies[key]) {
                delete this.ignoredProxies[key];
            }

            return;
        }

        global.log(`Removing XAppStatusIcon: ${icon_proxy.name} (${key})`);
        this.removeStatusIcon(icon_proxy);
    }

    onSystrayRolesChanged() {
        let hiddenIcons = Main.systrayManager.getRoles();

        for (let i in this.statusIcons) {
            let icon_proxy = this.statusIcons[i].proxy;

            if (this.shouldIgnoreStatusIcon(icon_proxy)) {
                global.log(`Hiding XAppStatusIcon (we have an applet): ${icon_proxy.name} (${i})`);
                this.removeStatusIcon(icon_proxy);
                this.ignoreStatusIcon(icon_proxy);
            }
        }

        for (let i in this.ignoredProxies) {
            let icon_proxy = this.ignoredProxies[i];

            if (!this.shouldIgnoreStatusIcon(icon_proxy)) {
                delete this.ignoredProxies[i];

                global.log(`Restoring hidden XAppStatusIcon (native applet gone): ${icon_proxy.name} (${i})`);
                this.addStatusIcon(icon_proxy);
            }
        }
    }

    addStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);
        let statusIcon = new XAppStatusIcon(this, icon_proxy);

        this.manager_container.insert_child_at_index(statusIcon.actor, 0);
        this.statusIcons[key] = statusIcon;

        this.sortIcons();
    }

    removeStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (!this.statusIcons[key]) {
            return;
        }

        this.manager_container.remove_child(this.statusIcons[key].actor);
        this.statusIcons[key].destroy();
        delete this.statusIcons[key];

        this.sortIcons();
    }

    ignoreStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (this.ignoredProxies[key]) {
            return;
        }

        this.ignoredProxies[key] = icon_proxy;
    }

    shouldIgnoreStatusIcon(icon_proxy) {
        let hiddenIcons = Main.systrayManager.getRoles();

        let name = icon_proxy.name.toLowerCase();

        if (hiddenIcons.indexOf(name) != -1 ) {
            return true;
        }

        return false;
    }

    _sortFunc(a, b) {
        let asym = a.proxy.icon_name.includes("-symbolic");
        let bsym = b.proxy.icon_name.includes("-symbolic");

        if (asym && !bsym) {
            return 1;
        }

        if (bsym && !asym) {
            return -1;
        }

        return GLib.utf8_collate(a.proxy.name.replace("org.x.StatusIcon.", "").toLowerCase(),
                                 b.proxy.name.replace("org.x.StatusIcon.", "").toLowerCase());
    }

    sortIcons() {
        this.onSystrayRolesChanged();

        let icon_list = []

        for (let i in this.statusIcons) {
            icon_list.push(this.statusIcons[i]);
        }

        icon_list.sort(this._sortFunc);
        icon_list.reverse()

        for (let icon of icon_list) {
            this.manager_container.set_child_at_index(icon.actor, 0);
        }

        this.manager_container.set_child_at_index(this._recording_indicator.actor, -1);
    }

    refreshIcons() {
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.refresh();
        }

        this._recording_indicator.refresh();
    }

    icon_size_changed() {
        this.refreshIcons();
    }

    on_icon_theme_changed() {
        this.refreshIcons();
    }

    ui_scale_changed() {
        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
        }

        this._scaleUpdateId = Mainloop.timeout_add(1500, () => {
            this.refreshIcons();

            this._scaleUpdateId = 0;
            return GLib.SOURCE_REMOVE;
        })
    }

    on_applet_removed_from_panel() {
        this.signalManager.disconnectAllSignals();

        for (let key in this.statusIcons) {
            this.statusIcons[key].destroy();
            delete this.statusIcons[key];
        };

        for (let key in this.ignoredProxies) {
            delete this.ignoredProxies[key];
        };

        this._recording_indicator.actor.destroy();
        this._recording_indicator = null;

        this.monitor = null;
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.actor.reactive = reactive;
        }
    }

    on_orientation_changed(newOrientation) {
        this.orientation = newOrientation;

        if (newOrientation == St.Side.TOP || newOrientation == St.Side.BOTTOM) {
            this.manager_container.vertical = false;
            this.manager_container.style = HORIZONTAL_STYLE;
        } else {
            this.manager_container.vertical = true;
            this.manager_container.style = VERTICAL_STYLE;
        }

        this.refreshIcons();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonXAppStatusApplet(orientation, panel_height, instance_id);
}
