const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const St = imports.gi.St;

class NightLightSwitch extends Applet.IconApplet {
  constructor(metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);

    this.gsettings = Gio.Settings.new("org.cinnamon.settings-daemon.plugins.color");
    this.nightLightEnabled = this.gsettings.get_boolean("night-light-enabled");
    this.connectColorID = this.gsettings.connect("changed", () => this.set_icon());
    this.set_icon();

    let items = this._applet_context_menu._getMenuItems();
    if (this.context_menu_item_configure == null) {
      this.context_menu_item_configure = new PopupMenu.PopupIconMenuItem(_("Configure..."),
        "xsi-preferences",
        St.IconType.SYMBOLIC);
      this.context_menu_item_configure.connect('activate',
        () => { Util.spawnCommandLineAsync("cinnamon-settings nightlight"); }
      );
    }
    if (items.indexOf(this.context_menu_item_configure) == -1) {
      this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
    }
  }

  on_applet_clicked() {
    this.gsettings.set_boolean("night-light-enabled", !this.nightLightEnabled);
    this.set_icon();
  }

  set_icon() {
    this.nightLightEnabled = this.gsettings.get_boolean("night-light-enabled");
    if (this.nightLightEnabled) {
      this.set_applet_icon_symbolic_name("nightlight-symbolic");
    } else {
      this.set_applet_icon_symbolic_name("nightlight-disabled-symbolic");
    }
  }

  on_applet_removed_from_panel() {
    this.gsettings.disconnect(this.connectColorID);
  }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new NightLightSwitch(metadata, orientation, panel_height, instance_id);
}
