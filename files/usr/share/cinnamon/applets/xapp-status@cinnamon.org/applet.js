const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Interfaces = imports.misc.interfaces;
const Applet = imports.ui.applet;
const Main = imports.ui.main;

class XAppStatusIcon {
    constructor(applet, busname, owner) {

        this.owner = owner;
        this.busName = busname;
        this.applet = applet;

        this.tooltipText = "";
        this.icon_size = applet.getPanelIconSize(St.IconType.FULLCOLOR);

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

        this.actor.connect('button-press-event', Lang.bind(this, this.onButtonPressEvent));
        this.actor.connect('button-release-event', Lang.bind(this, this.onButtonReleaseEvent));
        this.actor.connect('enter-event', Lang.bind(this, this.onEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this.onLeaveEvent));

        Interfaces.getDBusProxyWithOwnerAsync("org.x.StatusIcon",
                                              this.busName,
                                              Lang.bind(this, function(proxy, error) {
                                                  if (error) {
                                                      global.logError(error);
                                                  } else {
                                                      this.proxy = proxy;
                                                      this.on_dbus_acquired();
                                                  }


                                              }));

        Interfaces.getDBusPropertiesAsync(this.busName,
                                          "/org/x/StatusIcon",
                                          Lang.bind(this, function(proxy, error) {
                                              if (error) {
                                                  global.logError(error);
                                              } else {
                                                  this.property_proxy = proxy;
                                                  this.on_dbus_acquired();
                                              }
                                          }));
    }

    on_dbus_acquired() {
        if (!this.property_proxy || !this.proxy)
            return;

        global.log("Adding XAppStatusIcon: " + this.proxy.Name + " (" + this.busName + ")");

        this.setIconName(this.proxy.IconName);
        this.setTooltipText(this.proxy.TooltipText);
        this.setLabel(this.proxy.Label);
        this.setVisible(this.proxy.Visible);

        this.propertyChangedId = this.property_proxy.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, properties]) {
            if (properties.IconName)
                this.setIconName(properties.IconName.unpack());
            if (properties.TooltipText)
                this.setTooltipText(properties.TooltipText.unpack());
            if (properties.Label)
                this.setLabel(properties.Label.unpack());
            if (properties.Visible)
                this.setVisible(properties.Visible.unpack());
        }));
    }

    setIconName(iconName) {
        if (iconName) {
          if (iconName.match(/-symbolic$/)) {
            this.icon.set_icon_type(St.IconType.SYMBOLIC);
          }
          else {
            this.icon.set_icon_type(St.IconType.FULLCOLOR);
          }
          this.icon.set_icon_name(iconName);
          this.icon.set_icon_size(this.icon_size);
          this.icon.show();
        }
        else {
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
      if (event.get_button() == 3) {
        return true;
      }
      return false;
    }

    onButtonReleaseEvent(actor, event) {
      if (event.get_button() == 1) {
          this.proxy.LeftClickRemote(event.x, event.y, event.get_time(), event.get_button());
      }
      else if (event.get_button() == 2) {
          this.proxy.MiddleClickRemote(event.x, event.y, event.get_time(), event.get_button());
      }
      else if (event.get_button() == 3) {
          this.proxy.RightClickRemote(event.x, event.y, event.get_time(), event.get_button());
          return true;
      }
      return false;
    }

    destroy() {
        if (this.property_proxy)
            this.property_proxy.disconnectSignal(this.propertyChangedId);
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

        Gio.bus_own_name(Gio.BusType.SESSION,
                         "org.x.StatusApplet.PID-" + global.get_pid(),
                         Gio.BusNameOwnerFlags.NONE,
                         null,
                         null,
                         null);

        Interfaces.getDBusAsync(Lang.bind(this, function (proxy, error) {
            this.dbus = proxy;

            // Find all the XApp Status Icons on DBus
            let name_regex = /^org\.x\.StatusIcon\./;
            this.dbus.ListNamesRemote(Lang.bind(this,
                function(names) {
                    for (let n in names[0]) {
                        let name = names[0][n];
                        if (name_regex.test(name)) {
                            this.dbus.GetNameOwnerRemote(name, Lang.bind(this,
                                function(owner) {
                                    this.addStatusIcon(name, owner);
                                }
                            ));
                        }
                    }
                }
            ));

            // Listen on DBUS in case some of them go, or new ones appear
            this.ownerChangedId = this.dbus.connectSignal('NameOwnerChanged', Lang.bind(this,
                function(proxy, sender, [name, old_owner, new_owner]) {
                    if (name_regex.test(name)) {
                        if (new_owner && !old_owner)
                            this.addStatusIcon(name, new_owner);
                        else if (old_owner && !new_owner)
                            this.removeStatusIcon(name, old_owner);
                        else
                            this.changeStatusIconOwner(name, old_owner, new_owner);
                    }
                }
            ));
        }));

    }

    addStatusIcon(busName, owner) {
        if (this.statusIcons[owner]) {
            let prevName = this.statusIcons[owner].busName;
            if (this._isInstance(busName) && !this._isInstance(prevName))
                this.statusIcons[owner].busName = busName;
            else
                return;
        } else if (owner) {
            let statusIcon = new XAppStatusIcon(this, busName, owner);
            this.manager_container.insert_child_at_index(statusIcon.actor, 0);
            this.statusIcons[owner] = statusIcon;
        }
    }

    removeStatusIcon(busName, owner) {
        if (this.statusIcons[owner] && this.statusIcons[owner].busName == busName) {
            this.manager_container.remove_child(this.statusIcons[owner].actor);
            this.statusIcons[owner].destroy();
            delete this.statusIcons[owner];
        }
    }

    changeStatusIconOwner(busName, oldOwner, newOwner) {
        if (this.statusIcons[oldOwner] && busName == this.statusIcons[oldOwner].busName) {
            this.statusIcons[newOwner] = this.statusIcons[oldOwner];
            this.statusIcons[newOwner].owner = newOwner;
            delete this.statusIcons[oldOwner];
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonXAppStatusApplet(orientation, panel_height, instance_id);
}
