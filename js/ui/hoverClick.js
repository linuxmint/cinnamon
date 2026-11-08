// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Main = imports.ui.main;
const PopupDialog = imports.ui.popupDialog;
const PopupMenu = imports.ui.popupMenu;

const ICON_SIZE = 24;
const LOCK_ICON_SIZE = 16;
const DEFAULT_LAYOUT = ["vertical", "both"];

var HoverClickPalette = GObject.registerClass(
class HoverClickPalette extends PopupDialog.PopupDialog {
    _init() {
        super._init({
            styleClass: "hover-click-dialog",
            takesFocus: false,
            chromeParams: { visibleInFullscreen: true },
        });

        this.buttonLayout.hide();

        this._a11yMouseSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.mouse" });

        this.contentLayout.add_child(new St.Widget({ style_class: "hover-click-header" }));

        this._box = new St.BoxLayout({ style_class: "hover-click-box" });
        this.contentLayout.add_child(this._box);

        this._actionBox = new St.BoxLayout({ style_class: "hover-click-actions" });
        this._box.add_child(this._actionBox);

        this._actionButtons = new Map();
        this._addActionButton("single", _("Single Click"), "cinnamon-hc-single-click");
        this._addActionButton("double", _("Double Click"), "cinnamon-hc-double-click");
        this._addActionButton("drag", _("Drag"), "cinnamon-hc-drag-click");
        this._addActionButton("secondary", _("Secondary Click"), "cinnamon-hc-right-click");

        this._box.add_child(new St.Widget({ style_class: "hover-click-separator" }));

        this._lockButton = new St.Button({
            style_class: "hover-click-lock-button",
            child: new St.Icon({
                icon_name: "xsi-changes-prevent-symbolic",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: LOCK_ICON_SIZE,
            }),
            toggle_mode: true,
            can_focus: false,
            accessible_name: _("Lock the click type"),
        });
        this._a11yMouseSettings.bind("dwell-click-mode-lock", this._lockButton, "checked",
                                     Gio.SettingsBindFlags.DEFAULT);
        this._box.add_child(this._lockButton);

        this._menu = new PopupMenu.PopupMenu(this, St.Side.LEFT);
        this._menuManager = new PopupMenu.PopupMenuManager({ actor: this });
        this._menuManager.addMenu(this._menu);
        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();

        this._layoutItems = [];
        this._addLayoutItem(0, "vertical", _("Vertical"));
        this._addLayoutItem(0, "horizontal", _("Horizontal"));
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addLayoutItem(1, "both", _("Icons and text"));
        this._addLayoutItem(1, "icons", _("Icons"));
        this._addLayoutItem(1, "text", _("Text"));
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let closeItem = new PopupMenu.PopupMenuItem(_("Close"));
        closeItem.connect("activate", () => this.close());
        this._menu.addMenuItem(closeItem);

        this._menuPressed = false;
        this.connect("button-press-event", this._onButtonPress.bind(this));
        this.connect("button-release-event", this._onButtonRelease.bind(this));

        let actionChangedId = global.settings.connect("changed::hoverclick-action", this._syncAction.bind(this));
        let layoutChangedId = global.settings.connect("changed::hoverclick-layout", this._applyLayout.bind(this));
        let monitorsChangedId = Main.layoutManager.connect("monitors-changed", this._keepOnScreen.bind(this));

        this.connect("destroy", () => {
            global.settings.disconnect(actionChangedId);
            global.settings.disconnect(layoutChangedId);
            Main.layoutManager.disconnect(monitorsChangedId);
            this._menu.destroy();
        });

        this._syncAction();
        this._applyLayout();
    }

    _addActionButton(action, label, iconName) {
        let content = new St.BoxLayout({ vertical: true, style_class: "hover-click-button-box" });

        content._icon = new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.FULLCOLOR,
            icon_size: ICON_SIZE,
        });
        content.add_child(content._icon);

        content._label = new St.Label({ text: label, style_class: "hover-click-button-label" });
        content.add_child(content._label);

        let button = new St.Button({
            style_class: "hover-click-button",
            child: content,
            can_focus: false,
            accessible_name: label,
        });
        button.connect("clicked", () => global.settings.set_string("hoverclick-action", action));

        this._actionBox.add_child(button);
        this._actionButtons.set(action, button);
    }

    // A right-click while the menu is open only closes it: the menu grab
    // swallows the press, so we never see it and ignore the release.
    _onButtonPress(actor, event) {
        this._menuPressed = event.get_button() == Clutter.BUTTON_SECONDARY;
        return Clutter.EVENT_PROPAGATE;
    }

    _onButtonRelease(actor, event) {
        if (event.get_button() != Clutter.BUTTON_SECONDARY || !this._menuPressed)
            return Clutter.EVENT_PROPAGATE;

        this._menuPressed = false;
        this._menu.toggle();
        return Clutter.EVENT_STOP;
    }

    _addLayoutItem(index, value, label) {
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect("activate", () => {
            let layout = this._getLayout();
            layout[index] = value;
            global.settings.set_string("hoverclick-layout", layout.join("::"));
        });

        this._menu.addMenuItem(item);
        this._layoutItems.push({ item, index, value });
    }

    _getLayout() {
        let layout = global.settings.get_string("hoverclick-layout").split("::");
        return layout.length == 2 ? layout : [...DEFAULT_LAYOUT];
    }

    _syncAction() {
        let current = global.settings.get_string("hoverclick-action");

        for (let [action, button] of this._actionButtons)
            button.checked = action === current;
    }

    _applyLayout() {
        let layout = this._getLayout();
        let [orientation, style] = layout;
        let vertical = orientation !== "horizontal";

        this._box.vertical = vertical;
        this._actionBox.vertical = vertical;

        if (vertical) {
            this._box.add_style_class_name("vertical");
            this._box.remove_style_class_name("horizontal");
        } else {
            this._box.add_style_class_name("horizontal");
            this._box.remove_style_class_name("vertical");
        }

        let showIcons = style !== "text";
        let showLabels = style !== "icons";

        for (let button of this._actionButtons.values()) {
            button.child._icon.visible = showIcons;
            button.child._label.visible = showLabels;
        }

        for (let { item, index, value } of this._layoutItems)
            item.setOrnament(PopupMenu.OrnamentType.DOT, layout[index] === value);

        this._keepOnScreen();
    }

    _placeOnOpen() {
        this.opacity = 0;
        this.show();

        let [x, y] = global.settings.get_string("hoverclick-position").split("::").map(Number);

        if (Number.isInteger(x) && Number.isInteger(y)) {
            this._moveOnScreen(x, y);
        } else {
            let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
            this._moveOnScreen(workArea.x + Math.floor((workArea.width - this.width) / 2),
                               workArea.y + Math.floor((workArea.height - this.height) / 2));
        }
    }

    _moveOnScreen(x, y) {
        let monitorIndex = Main.layoutManager.monitors.findIndex(m =>
            x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height);

        if (monitorIndex < 0)
            monitorIndex = Main.layoutManager.primaryIndex;

        let workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);

        x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - this.width));
        y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - this.height));

        this.set_position(Math.round(x), Math.round(y));
    }

    _keepOnScreen() {
        if (this.state == PopupDialog.State.CLOSED)
            return;

        this._moveOnScreen(this.x, this.y);
    }

    _onDragEnd() {
        global.settings.set_string("hoverclick-position", `${Math.round(this.x)}::${Math.round(this.y)}`);
    }

    close() {
        this._menu.close();
        super.close();
    }
});
