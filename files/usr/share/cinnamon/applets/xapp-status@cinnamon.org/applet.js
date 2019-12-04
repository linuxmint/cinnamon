const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Interfaces = imports.misc.interfaces;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager;
const Gtk = imports.gi.Gtk;
const XApp = imports.gi.XApp;
const GLib = imports.gi.GLib;

const HORIZONTAL_STYLE = 'padding-left: 2px; padding-right: 2px; padding-top: 0; padding-bottom: 0';
const VERTICAL_STYLE = 'padding-left: 0; padding-right: 0; padding-top: 2px; padding-bottom: 2px';

class XAppStatusIcon {

    constructor(applet, proxy) {
        this.name = proxy.get_name();
        this.applet = applet;
        this.proxy = proxy;

        this.iconName = null;
        this.tooltipText = "";

        this.actor = new St.BoxLayout({
            style_class: "applet-box",
            reactive: true,
            track_hover: true,
            // The systray use a layout manager, we need to fill the space of the actor
            // or otherwise the menu will be displayed inside the panel.
            x_expand: true,
            y_expand: true
        });

        this.icon = new St.Icon();

        this.label = new St.Label({
            'y-align': St.Align.END,
        });

        this.actor.add_actor(this.icon);
        this.actor.add_actor(this.label);

        this.actor.connect('button-press-event', Lang.bind(this, this.onButtonPressEvent));
        this.actor.connect('button-release-event', Lang.bind(this, this.onButtonReleaseEvent));
        this.actor.connect('enter-event', Lang.bind(this, this.onEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this.onLeaveEvent));

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
            if (iconName.match(/symbolic/)) {
                this.icon.set_icon_type(St.IconType.SYMBOLIC);
            }
            else {
                this.icon.set_icon_type(St.IconType.FULLCOLOR);
            }

            this.iconName = iconName;
            this.icon.set_icon_size(this.applet.getPanelIconSize(this.icon.get_icon_type()));

            if (iconName.includes("/")) {
                let file = Gio.File.new_for_path(iconName);

                let gicon = Gio.FileIcon.new(file);

                this.icon.set_gicon(gicon);
            }
            else {
                this.icon.set_icon_name(iconName);
            }

            this.icon.show();
        }
        else {
            this.iconName = null;
            this.icon.hide();
        }
    }

    setTooltipText(tooltipText) {
        if (tooltipText) {
            this.tooltipText = tooltipText;
        }
        else {
            this.tooltipText = "";
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
        this.applet.set_applet_tooltip(this.tooltipText);
    }

    onLeaveEvent(actor, event) {
        this.applet.set_applet_tooltip("");
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
        this.applet.set_applet_tooltip("");

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

    destroy() {
        this.proxy.disconnect(this._proxy_prop_change_id);
        this._proxy_prop_change_id = 0;
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

        this.statusIcons = {};

        /* This doesn't really work 100% because applets get reloaded and we end up losing this
         * list. Not that big a deal in practice*/
        this.ignoredProxies = {};

        this.signalManager = new SignalManager.SignalManager(null);

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
    }

    onMonitorIconAdded(monitor, icon_proxy) {
        let proxy_name = icon_proxy.get_name();

        if (this.statusIcons[proxy_name]) {
            return;
        }

        if (this.shouldIgnoreStatusIcon(icon_proxy)) {
            global.log(`Hiding XAppStatusIcon (we have an applet): ${icon_proxy.name}`);
            this.ignoreStatusIcon(icon_proxy);

            return;
        }

        global.log(`Adding XAppStatusIcon: ${icon_proxy.name} (${proxy_name})`);
        this.addStatusIcon(icon_proxy);
    }

    onMonitorIconRemoved(monitor, icon_proxy) {
        let proxy_name = icon_proxy.get_name();

        if (!this.statusIcons[proxy_name]) {
            if (this.ignoredProxies[proxy_name]) {
                delete this.ignoredProxies[proxy_name];
            }

            return;
        }

        global.log(`Removing XAppStatusIcon: ${icon_proxy.name} (${proxy_name})`);
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
        let proxy_name = icon_proxy.get_name();

        let statusIcon = new XAppStatusIcon(this, icon_proxy);

        this.manager_container.insert_child_at_index(statusIcon.actor, 0);
        this.statusIcons[proxy_name] = statusIcon;

        this.sortIcons();
    }

    removeStatusIcon(icon_proxy) {
        let proxy_name = icon_proxy.get_name();

        if (!this.statusIcons[proxy_name]) {
            return;
        }

        this.manager_container.remove_child(this.statusIcons[proxy_name].actor);
        this.statusIcons[proxy_name].destroy();
        delete this.statusIcons[proxy_name];

        this.sortIcons();
    }

    ignoreStatusIcon(icon_proxy) {
        let proxy_name = icon_proxy.get_name();

        if (this.ignoredProxies[proxy_name]) {
            return;
        }

        this.ignoredProxies[proxy_name] = icon_proxy;
    }

    shouldIgnoreStatusIcon(icon_proxy) {
        let hiddenIcons = Main.systrayManager.getRoles();

        if (hiddenIcons.indexOf(icon_proxy.name) != -1 ) {
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

        return GLib.utf8_collate(a.proxy.name, b.proxy.name);
    }

    sortIcons() {
        let icon_list = []

        for (let i in this.statusIcons) {
            icon_list.push(this.statusIcons[i]);
        }

        icon_list.sort(this._sortFunc);
        icon_list.reverse()

        for (let icon of icon_list) {
            this.manager_container.set_child_at_index(icon.actor, 0);
        }
    }

    refreshIcons() {
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.refresh();
        }
    }

    icon_size_changed() {
        this.refreshIcons();
    }

    on_icon_theme_changed() {
        this.refreshIcons();
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
