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
const XApp = imports.gi.XApp

class XAppStatusIcon {

    constructor(applet, proxy) {
        this.name = proxy.get_name();
        this.applet = applet;
        this.proxy = proxy;

        this.iconName = null;
        this.tooltipText = "";

        this.actor = new St.BoxLayout({
            style_class: 'applet-box',
            reactive: true,
            track_hover: true,
            // The systray use a layout manager, we need to fill the space of the actor
            // or otherwise the menu will be displayed inside the panel.
            x_expand: true,
            y_expand: true
        });

        if (applet.orientation == St.Side.LEFT || applet.orientation == St.Side.RIGHT) {
            this.actor.set_x_align(Clutter.ActorAlign.FILL);
            this.actor.set_y_align(Clutter.ActorAlign.END);
            this.actor.set_vertical(true);
        }

        this.icon = new St.Icon();
        this.label = new St.Label({'y-align': St.Align.END });

        this.actor.add_actor(this.icon);
        this.actor.add_actor(this.label);

        this.show_label = this.applet.orientation == St.Side.TOP || this.applet.orientation == St.Side.BOTTOM;
        this.label.visible = this.show_label;

        this.actor.connect('button-press-event', Lang.bind(this, this.onButtonPressEvent));
        this.actor.connect('button-release-event', Lang.bind(this, this.onButtonReleaseEvent));
        this.actor.connect('enter-event', Lang.bind(this, this.onEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this.onLeaveEvent));

        this._proxy_prop_change_id = this.proxy.connect('g-properties-changed', Lang.bind(this, this.on_properties_changed))

        this.setIconName(proxy.icon_name);
        this.setTooltipText(proxy.tooltip_text);
        this.setLabel(proxy.label);
        this.setVisible(proxy.visible);
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

    setIconName(iconName) {
        if (iconName) {
            if (iconName.match(/-symbolic/)) {
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

    refreshIcon() {
        // Called when the icon theme, or the panel size change..
        if (this.iconName) {
            this.icon.set_icon_name(this.iconName);
            this.icon.set_icon_size(this.applet.getPanelIconSize(this.icon.get_icon_type()));
            this.icon.show();
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
        if (this.show_label && label) {
            this.label.set_text(label);
            this.label.show();
        }
        else {
            this.label.hide();
        }
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

    onButtonPressEvent(actor, event) {
        this.applet.set_applet_tooltip("");
        let allocation = Cinnamon.util_get_transformed_allocation(actor);
        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        switch (this.applet.orientation) {
            case St.Side.BOTTOM:
                this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), Gtk.PositionType.BOTTOM, null, null);
                break;
            case St.Side.TOP:
                y = (allocation.y2 / global.ui_scale);
                this.proxy.call_button_press(x, allocation.y2, event.get_button(), event.get_time(), Gtk.PositionType.TOP, null, null);
                break;
            case St.Side.LEFT:
                x = (allocation.x2 / global.ui_scale);
                this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), Gtk.PositionType.LEFT, null, null);
                break;
            case St.Side.RIGHT:
                this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), Gtk.PositionType.RIGHT, null, null);
                break;
        }
        return true;
    }

    onButtonReleaseEvent(actor, event) {
        let allocation = Cinnamon.util_get_transformed_allocation(actor);
        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        switch (this.applet.orientation) {
            case St.Side.BOTTOM:
                this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), Gtk.PositionType.BOTTOM, null, null);
                break;
            case St.Side.TOP:
                y = (allocation.y2 / global.ui_scale);
                this.proxy.call_button_release(x, allocation.y2, event.get_button(), event.get_time(), Gtk.PositionType.TOP, null, null);
                break;
            case St.Side.LEFT:
                x = (allocation.x2 / global.ui_scale);
                this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), Gtk.PositionType.LEFT, null, null);
                break;
            case St.Side.RIGHT:
                this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), Gtk.PositionType.RIGHT, null, null);
                break;
        }
        return true;
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
        this.actor.set_style_class_name('systray');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        let manager;
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            manager = new Clutter.BoxLayout( { spacing: 4,
                                               orientation: Clutter.Orientation.HORIZONTAL });
        } else {
            manager = new Clutter.BoxLayout( { spacing: 4,
                                               orientation: Clutter.Orientation.VERTICAL });
        }
        this.manager = manager;
        this.manager_container = new Clutter.Actor( { layout_manager: manager } );
        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        this.statusIcons = {};

        /* This doesn't really work 100% because applets get reloaded and we end up losing this
         * list. Not that big a deal in practice*/
        this.ignoredProxies = {};

        this.signalManager = new SignalManager.SignalManager(null);

        this.monitor = new XApp.StatusIconMonitor();
        this.signalManager.connect(this.monitor, "icon-added", this.addStatusIcon, this);
        this.signalManager.connect(this.monitor, "icon-removed", this.removeStatusIcon, this);

        this.signalManager.connect(Gtk.IconTheme.get_default(), 'changed', this.on_icon_theme_changed, this);
        this.signalManager.connect(global.settings, 'changed::panel-edit-mode', this.on_panel_edit_mode_changed, this);

        this.signalManager.connect(Main.systrayManager, "changed", this.onSystrayRolesChanged, this);
    }

    onSystrayRolesChanged() {
        let hiddenIcons = Main.systrayManager.getRoles();

        for (let i in this.statusIcons) {
            if (hiddenIcons.some(role => role === this.statusIcons[i].proxy.name)) {
                global.log(`Hiding XAppStatusIcon: ${this.statusIcons[i].proxy.name} (${i})`);

                let proxy = this.statusIcons[i].proxy;
                this.ignoredProxies[proxy.get_name()] = proxy;

                this.removeStatusIcon(this.monitor, this.statusIcons[i].proxy);
            }
        }

        for (let i in this.ignoredProxies) {
            if (!hiddenIcons.some(role => role === this.ignoredProxies[i].name)) {
                let proxy = this.ignoredProxies[i];

                delete this.ignoredProxies[i];

                global.log(`Restoring hidden XAppStatusIcon: ${this.statusIcons[i].proxy.name} (${i})`);

                this.addStatusIcon(this.monitor, proxy);
            }
        }
    }

    addStatusIcon(monitor, icon_proxy) {
        let proxy_name = icon_proxy.get_name();

        if (this.statusIcons[proxy_name]) {
            return;
        }

        let hiddenIcons = Main.systrayManager.getRoles();

        if (hiddenIcons.indexOf(icon_proxy.name) != -1 ) {
            global.log(`Hiding XAppStatusIcon: ${icon_proxy.name} (${proxy_name})`);

            this.ignoredProxies[proxy_name] = icon_proxy;
            return;
        }

        global.log(`Adding XAppStatusIcon: ${icon_proxy.name} (${proxy_name})`);

        let statusIcon = new XAppStatusIcon(this, icon_proxy);

        this.manager_container.insert_child_at_index(statusIcon.actor, 0);
        this.statusIcons[proxy_name] = statusIcon;
    }

    removeStatusIcon(monitor, icon_proxy) {
        let proxy_name = icon_proxy.get_name();

        if (!this.statusIcons[proxy_name]) {
            if (this.ignoredProxies[proxy_name]) {
                delete this.ignoredProxies[proxy_name];
            }

            return;
        }

        global.log(`Removing XAppStatusIcon: ${icon_proxy.name} (${proxy_name})`);

        this.manager_container.remove_child(this.statusIcons[proxy_name].actor);
        this.statusIcons[proxy_name].destroy();
        delete this.statusIcons[proxy_name];
    }

    refreshIcons() {
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.refreshIcon();
        }
    }

    on_panel_icon_size_changed(size) {
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
            this.manager.set_vertical(false);
        } else {
            this.manager.set_vertical(true);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonXAppStatusApplet(orientation, panel_height, instance_id);
}
