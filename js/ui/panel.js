// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Applet = imports.ui.applet;
const DND = imports.ui.dnd;
const AppletManager = imports.ui.appletManager;
const Util = imports.misc.util;
const ModalDialog = imports.ui.modalDialog;
const Gtk = imports.gi.Gtk;

const BUTTON_DND_ACTIVATION_TIMEOUT = 250;

const ANIMATED_ICON_UPDATE_TIMEOUT = 100;
const SPINNER_ANIMATION_TIME = 0.2;

const AUTOHIDE_ANIMATION_TIME = 0.2;
const TIME_DELTA = 1500;

const APPLETS_DROP_ANIMATION_TIME = 0.2;

const PANEL_AUTOHIDE_KEY = "panels-autohide";
const PANEL_SHOW_DELAY_KEY = "panels-show-delay";
const PANEL_HIDE_DELAY_KEY = "panels-hide-delay";
const PANEL_HEIGHT_KEY = "panels-height";
const PANEL_RESIZABLE_KEY = "panels-resizable";
const PANEL_SCALE_TEXT_ICONS_KEY = "panels-scale-text-icons";

const DEFAULT_VALUES = {"panels-autohide": "false",
                        "panels-show-delay": "0",
                        "panels-hide-delay": "0",
                        "panels-height": "25",
                        "panels-resizable": "false",
                        "panels-scale-text-icons": "false"};
// To make sure the panel corners blend nicely with the panel,
// we draw background and borders the same way, e.g. drawing
// them as filled shapes from the outside inwards instead of
// using cairo stroke(). So in order to give the border the
// appearance of being drawn on top of the background, we need
// to blend border and background color together.
// For that purpose we use the following helper methods, taken
// from st-theme-node-drawing.c
function _norm(x) {
    return Math.round(x / 255);
}

function _over(srcColor, dstColor) {
    let src = _premultiply(srcColor);
    let dst = _premultiply(dstColor);
    let result = new Clutter.Color();

    result.alpha = src.alpha + _norm((255 - src.alpha) * dst.alpha);
    result.red = src.red + _norm((255 - src.alpha) * dst.red);
    result.green = src.green + _norm((255 - src.alpha) * dst.green);
    result.blue = src.blue + _norm((255 - src.alpha) * dst.blue);

    return _unpremultiply(result);
}

function _premultiply(color) {
    return new Clutter.Color({ red: _norm(color.red * color.alpha),
                               green: _norm(color.green * color.alpha),
                               blue: _norm(color.blue * color.alpha),
                               alpha: color.alpha });
};

function _unpremultiply(color) {
    if (color.alpha == 0)
        return new Clutter.Color();

    let red = Math.min((color.red * 255 + 127) / color.alpha, 255);
    let green = Math.min((color.green * 255 + 127) / color.alpha, 255);
    let blue = Math.min((color.blue * 255 + 127) / color.alpha, 255);
    return new Clutter.Color({ red: red, green: green,
                               blue: blue, alpha: color.alpha });
};


/**
 * PanelManager
 * 
 * @short_description: Manager of Cinnamon panels
 *
 * #PanelManager creates panels and startup and
 * provides methods for easier access of panels
 */
function PanelManager() {
    this._init();
}

PanelManager.prototype = {
    _init: function() {
        this.panels = [];
        this.panelsMeta = []; // Properties of panels in format [<monitor index>, <bottomPosition>]

        let panelProperties = global.settings.get_strv("panels-enabled");
        for (let i in panelProperties) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }

            let ID = parseInt(elements[0]);
            if (this.panels[ID]) {
                global.log("Multiple panels with same ID (" + ID + ") are found");
                continue;
            }

            this.panels.length = Math.max(this.panels.length, ID+1);
            this.panelsMeta.length = Math.max(this.panels.length, ID+1);

            let repeat = false;
            for (let i in this.panelsMeta) {
                if ((this.panelsMeta[i][0] == elements[1]) && (this.panelsMeta[i][1] == elements[2])) {
                    global.log("Conflicting panel definitions: " + panelProperties);
                    repeat = true;
                    break;
                }
            }

            if (repeat) continue;

            this.panels[ID] = new Panel(ID, parseInt(elements[1]), elements[2]=="bottom");
            this.panelsMeta[ID] = [elements[1], elements[2]];

        }
    },

    /**
     * disablePanels:
     *
     * Disables (hide and lock) all panels
     */
    disablePanels: function() {
        for (let i in this.panels) {
            if (this.panels[i])
                this.panels[i].disable();
        }
    },

    /**
     * enablePanels:
     *
     * Enables all panels
     */
    enablePanels: function() {
        for (let i in this.panels) {
            if (this.panels[i])
                this.panels[i].enable();
        }
    },

    /**
     * getPanelInMonitor:
     * @monitorIndex (integer): index of monitor
     *
     * Retrieves all the panels in the monitor of index @monitorIndex
     *
     * Returns: an array of panels
     */
    getPanelsInMonitor: function(monitorIndex) {
        let returnValue = [];
        for (let i in this.panels) {
            if (this.panels[i].monitorId == monitorIndex)
                returnValue.push(this.panels[i]);
        }
        return returnValue;
    },

    /**
     * getPanel:
     * @monitorIndex (integer): index of monitor
     * @bottomPosition (boolean): whether the bottom panel is wanted
     *
     * Gets a specific panel in monitor @monitorIndex (bottom panel if @bottomPosition is true)
     *
     * Returns: the panel required (null if panel not found)
     */
    getPanel: function(monitorIndex, bottomPosition) {
        for (let i in this.panels) {
            if (this.panels[i].monitorId == monitorIndex && this.panels[i].bottomPosition == bottomPosition)
                return this.panels[i];
        }
        return null;
    }
}

function AnimatedIcon(name, size) {
    this._init(name, size);
}

AnimatedIcon.prototype = {
    _init: function(name, size) {
        this.actor = new St.Bin({ visible: false });
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        this.actor.connect('notify::visible', Lang.bind(this, function() {
            if (this.actor.visible) {
                this._timeoutId = Mainloop.timeout_add(ANIMATED_ICON_UPDATE_TIMEOUT, Lang.bind(this, this._update));
            } else {
                if (this._timeoutId)
                    Mainloop.source_remove(this._timeoutId);
                this._timeoutId = 0;
            }
        }));

        this._timeoutId = 0;
        this._i = 0;
        this._animations = St.TextureCache.get_default().load_sliced_image (global.datadir + '/theme/' + name, size, size, null);
        this.actor.set_child(this._animations);
    },

    _update: function() {
        this._animations.hide_all();
        this._animations.show();
        if (this._i && this._i < this._animations.get_n_children())
            this._animations.get_child_at_index(this._i++).show();
        else {
            this._i = 1;
            if (this._animations.get_n_children())
                this._animations.get_child_at_index(0).show();
        }
        return true;
    },

    _onDestroy: function() {
        if (this._timeoutId)
            Mainloop.source_remove(this._timeoutId);
    }
};

function TextShadower() {
    this._init();
}

TextShadower.prototype = {
    _init: function() {
        this.actor = new Cinnamon.GenericContainer();
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        this._label = new St.Label();
        this.actor.add_actor(this._label);
        for (let i = 0; i < 4; i++) {
            let actor = new St.Label({ style_class: 'label-shadow' });
            actor.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            this.actor.add_actor(actor);
        }
        this._label.raise_top();
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        let [minWidth, natWidth] = this._label.get_preferred_width(forHeight);
        alloc.min_size = minWidth + 2;
        alloc.natural_size = natWidth + 2;
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        let [minHeight, natHeight] = this._label.get_preferred_height(forWidth);
        alloc.min_size = minHeight + 2;
        alloc.natural_size = natHeight + 2;
    },

    _allocate: function(actor, box, flags) {
        let children = this.actor.get_children();

        let availWidth = box.x2 - box.x1;
        let availHeight = box.y2 - box.y1;

        let [minChildWidth, minChildHeight, natChildWidth, natChildHeight] =
            this._label.get_preferred_size();

        let childWidth = Math.min(natChildWidth, availWidth - 2);
        let childHeight = Math.min(natChildHeight, availHeight - 2);

        for (let i = 0; i < children.length; i++) {
            let child = children[i];
            let childBox = new Clutter.ActorBox();
            // The order of the labels here is arbitrary, except
            // we know the "real" label is at the end because Clutter.Group
            // sorts by Z order
            switch (i) {
                case 0: // top
                    childBox.x1 = 1;
                    childBox.y1 = 0;
                    break;
                case 1: // right
                    childBox.x1 = 2;
                    childBox.y1 = 1;
                    break;
                case 2: // bottom
                    childBox.x1 = 1;
                    childBox.y1 = 2;
                    break;
                case 3: // left
                    childBox.x1 = 0;
                    childBox.y1 = 1;
                    break;
                case 4: // center
                    childBox.x1 = 1;
                    childBox.y1 = 1;
                    break;
            }
            childBox.x2 = childBox.x1 + childWidth;
            childBox.y2 = childBox.y1 + childHeight;
            child.allocate(childBox, flags);
        }
    }
};

function PanelCorner(panel, side) {
    this._init(panel, side);
}

PanelCorner.prototype = {
    _init: function(box, side) {
        this._side = side;

        this._box = box;
        this._box.connect('style-changed', Lang.bind(this, this._boxStyleChanged));

        this.actor = new St.DrawingArea({ style_class: 'panel-corner' });
        this.actor.connect('style-changed', Lang.bind(this, this._styleChanged));
        this.actor.connect('repaint', Lang.bind(this, this._repaint));
    },

    _findRightmostButton: function(container) {
        if (!container.get_children)
            return null;

        let children = container.get_children();

        if (!children || children.length == 0)
            return null;

        // Start at the back and work backward
        let index = children.length - 1;
        while (index >= 0 && !children[index].visible)
            index--;

        if (index < 0)
            return null;

        return children[index];
    },

    _findLeftmostButton: function(container) {
        if (!container.get_children)
            return null;

        let children = container.get_children();

        if (!children || children.length == 0)
            return null;

        // Start at the front and work forward
        let index = 0;
        while (index < children.length && !children[index].visible)
            index++;

        if (index == children.length)
            return null;

        return children[index];
    },

    _boxStyleChanged: function() {
        let side = this._side;

        let rtlAwareContainer = this._box instanceof St.BoxLayout;
        if (rtlAwareContainer &&
            this._box.get_direction() == St.TextDirection.RTL) {
            if (this._side == St.Side.LEFT)
                side = St.Side.RIGHT;
            else if (this._side == St.Side.RIGHT)
                side = St.Side.LEFT;
        }

        let button;
        if (side == St.Side.LEFT)
            button = this._findLeftmostButton(this._box);
        else if (side == St.Side.RIGHT)
            button = this._findRightmostButton(this._box);

        if (button) {
            if (this._button && this._buttonStyleChangedSignalId) {
                this._button.disconnect(this._buttonStyleChangedSignalId);
                this._button.style = null;
            }

            this._button = button;

            button.connect('destroy', Lang.bind(this,
                function() {
                    if (this._button == button) {
                        this._button = null;
                        this._buttonStyleChangedSignalId = 0;
                    }
                }));

            // Synchronize the locate button's pseudo classes with this corner
            this._buttonStyleChangedSignalId = button.connect('style-changed', Lang.bind(this,
                function(actor) {
                    let pseudoClass = button.get_style_pseudo_class();
                    this.actor.set_style_pseudo_class(pseudoClass);
                }));

            // The corner doesn't support theme transitions, so override
            // the .panel-button default
            button.style = 'transition-duration: 0';
        }
    },

    _repaint: function() {
        let node = this.actor.get_theme_node();

        let cornerRadius = node.get_length("-panel-corner-radius");
        let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');
        let outerBorderWidth = node.get_length('-panel-corner-outer-border-width');

        let backgroundColor = node.get_color('-panel-corner-background-color');
        let innerBorderColor = node.get_color('-panel-corner-inner-border-color');
        let outerBorderColor = node.get_color('-panel-corner-outer-border-color');

        let cr = this.actor.get_context();
        cr.setOperator(Cairo.Operator.SOURCE);

        cr.moveTo(0, 0);
        if (this._side == St.Side.LEFT)
            cr.arc(cornerRadius,
                   innerBorderWidth + cornerRadius,
                   cornerRadius, Math.PI, 3 * Math.PI / 2);
        else
            cr.arc(0,
                   innerBorderWidth + cornerRadius,
                   cornerRadius, 3 * Math.PI / 2, 2 * Math.PI);
        cr.lineTo(cornerRadius, 0);
        cr.closePath();

        let savedPath = cr.copyPath();

        let over = _over(innerBorderColor,
                         _over(outerBorderColor, backgroundColor));
        Clutter.cairo_set_source_color(cr, over);
        cr.fill();

        let xOffsetDirection = this._side == St.Side.LEFT ? -1 : 1;
        let offset = outerBorderWidth;
        over = _over(innerBorderColor, backgroundColor);
        Clutter.cairo_set_source_color(cr, over);

        cr.save();
        cr.translate(xOffsetDirection * offset, - offset);
        cr.appendPath(savedPath);
        cr.fill();
        cr.restore();

        if (this._side == St.Side.LEFT)
            cr.rectangle(cornerRadius - offset, 0, offset, outerBorderWidth);
        else
            cr.rectangle(0, 0, offset, outerBorderWidth);
        cr.fill();

        offset = innerBorderWidth;
        Clutter.cairo_set_source_color(cr, backgroundColor);

        cr.save();
        cr.translate(xOffsetDirection * offset, - offset);
        cr.appendPath(savedPath);
        cr.fill();
        cr.restore();
    },

    _styleChanged: function() {
        let node = this.actor.get_theme_node();

        let cornerRadius = node.get_length("-panel-corner-radius");
        let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');

        this.actor.set_size(cornerRadius, innerBorderWidth + cornerRadius);
        this.actor.set_anchor_point(0, innerBorderWidth);
    }
};

function ConfirmDialog(){
    this._init();
}

ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: "Are you sure you want to restore all settings to default?\n\n"});
	this.contentLayout.add(label);

	this.setButtons([
	    {
		label: _("Yes"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("gsettings reset-recursively org.cinnamon");
                    global.reexec_self();
		})
	    },
	    {
		label: _("No"),
		action: Lang.bind(this, function(){
		    this.close();
		})
	    }
	]);
    },
};
function SettingsLauncher(label, keyword, icon, menu) {
    this._init(label, keyword, icon, menu);
}

SettingsLauncher.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (label, keyword, icon, menu) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._menu = menu;
        this._keyword = keyword;
        let table = new St.Table({ homogeneous: false,
                                      reactive: true });

        this.label = new St.Label({ text: label });
        this._icon = new St.Icon({icon_name: icon, icon_type: St.IconType.SYMBOLIC,
                                  style_class: 'popup-menu-icon' });

        table.add(this._icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.label.set_margin_left(6.0)

        this.addActor(table, { expand: true, span: 1, align: St.Align.START });
    },

    activate: function (event) {
    	this._menu.actor.hide();
        Util.spawnCommandLine("cinnamon-settings " + this._keyword);
        return true;
    }

};

function populateSettingsMenu(menu, panelId) {

    menu.troubleshootItem = new PopupMenu.PopupSubMenuMenuItem(_("Troubleshoot ..."), true);
    menu.troubleshootItem.menu.addAction(_("Restart Cinnamon"), function(event) {
        global.reexec_self();
    });

    menu.troubleshootItem.menu.addAction(_("Looking Glass"), function(event) {
        Main.createLookingGlass().open();
    });

    menu.troubleshootItem.menu.addAction(_("Restore all settings to default"), function(event) {
        let confirm = new ConfirmDialog();
        confirm.open();
    });

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    
    menu.addMenuItem(menu.troubleshootItem);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Auto-hide Panel
    let values = global.settings.get_strv(PANEL_AUTOHIDE_KEY);
    let property;
    for (let i = 0; i < values.length; i++){
        if (values[i].split(":")[0]==panelId){
            property=values[i].split(":")[1];
            break;
        }
    }
    if (!property){
        property = DEFAULT_VALUES[PANEL_AUTOHIDE_KEY];
        values.push(this.panelID + ":" + property);
        global.settings.set_strv(PANEL_AUTOHIDE_KEY, values);
    }
    let autoHidePanel = new PopupMenu.PopupSwitchMenuItem(_("Auto-hide panel"), property == "true");
    autoHidePanel.connect('toggled', function(item) {
        let values = global.settings.get_strv(PANEL_AUTOHIDE_KEY);
        let property;
        for (let i = 0; i < values.length; i++){
            if (values[i].split(":")[0] == panelId){
                values[i] = panelId + ":" + (item.state ? "true" : "false");
                break;
            }
        }
        global.settings.set_strv(PANEL_AUTOHIDE_KEY, values);
    });

    menu.addMenuItem(autoHidePanel);
    global.settings.connect('changed::' + PANEL_AUTOHIDE_KEY, function() {
        let values = global.settings.get_strv(PANEL_AUTOHIDE_KEY);
        let property;
        for (let i = 0; i < values.length; i++){
            if (values[i].split(":")[0]==panelId){
                property=values[i].split(":")[1];
                break;
            }
        }
        autoHidePanel.setToggleState(property == "true");
    });

    // Panel Edit mode
    let editMode = global.settings.get_boolean("panel-edit-mode");
    let panelEditMode = new PopupMenu.PopupSwitchMenuItem(_("Panel edit mode"), editMode);
    panelEditMode.connect('toggled', function(item) {
        global.settings.set_boolean("panel-edit-mode", item.state);
    });
    menu.addMenuItem(panelEditMode);
    global.settings.connect('changed::panel-edit-mode', function() {
        panelEditMode.setToggleState(global.settings.get_boolean("panel-edit-mode"));
    });
}

function PanelContextMenu(launcher, orientation, panelId) {
    this._init(launcher, orientation, panelId);
}

PanelContextMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(launcher, orientation, panelId) {
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();

        let applet_settings_item = new SettingsLauncher(_("Add applets to the panel"), "applets panel" + panelId, "list-add", this);
        this.addMenuItem(applet_settings_item);

        let menuItem = new SettingsLauncher(_("Panel settings"), "panel " + panelId, "emblem-system", this);
        this.addMenuItem(menuItem);

        let menuItem = new SettingsLauncher(_("Themes"), "themes", "applications-graphics", this);
        this.addMenuItem(menuItem);

        let menuSetting = new SettingsLauncher(_("All settings"), "", "preferences-system", this);
        this.addMenuItem(menuSetting);

        populateSettingsMenu(this, panelId);
    }
}

function PanelZoneDNDHandler(panelZone){
    this._init(panelZone);
}

PanelZoneDNDHandler.prototype = {
    _init : function(panelZone) {
        this._panelZone = panelZone;
        this._panelZone._delegate = this;
        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (!(source instanceof Applet.Applet)) return DND.DragMotionResult.NO_DROP;

        let children = this._panelZone.get_children();
        let appletPos = children.indexOf(source.actor);

        let pos = 0;

        for (var i in children){
            //if (children[i] == this._dragPlaceholder.actor) continue;
            if (x > children[i].get_allocation_box().x1 + children[i].width / 2) pos = i;
        }

        if (pos != this._dragPlaceholderPos) {
            this._dragPlaceholderPos = pos;

            // Don't allow positioning before or after self
            if (appletPos != -1 && pos == appletPos) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy',
                        Lang.bind(this, function() {
                            this._animatingPlaceholdersCount--;
                        }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width (20);
            this._dragPlaceholder.child.set_height (10);
            this._panelZone.insert_actor(this._dragPlaceholder.actor,
                                        this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }

        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) {
        if (!(source instanceof Applet.Applet)) return false;

        let children = this._panelZone.get_children();
        let curAppletPos = 0;
        let insertAppletPos;
        for (var i in children){
            if (children[i]._delegate instanceof Applet.Applet){
                children[i]._applet._newOrder = curAppletPos;
                curAppletPos++;
            }else if (children[i] == this._dragPlaceholder.actor){
                insertAppletPos = curAppletPos;
                curAppletPos++;
            }
        }
        source.actor._applet._newOrder = insertAppletPos;
        source.actor._applet._newPanelLocation = this._panelZone;
        this._clearDragPlaceholder();
        actor.destroy();
        AppletManager.saveAppletsPositions();
        return true;
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    }
}


function Panel(id, monitorId, bottomPosition) {
    this._init(id, monitorId, bottomPosition);
}

Panel.prototype = {
    _init : function(id, monitorId, bottomPosition) {
        this.panelId = id;
        this.monitorId = monitorId;
        this.monitor = global.screen.get_monitor_geometry(monitorId);
        this.bottomPosition = bottomPosition;

    	this._hidden = false;
        this._disabled = false;
        this._panelEditMode = false;
        this._hidetime = 0;
        this._hideable = this._getProperty(PANEL_AUTOHIDE_KEY, "b")
        this._hideTimer = 0;
        this._showTimer = 0;
        this._themeFontSize = null;
        this.scaleMode = false;

        this.actor = new Cinnamon.GenericContainer({ name: 'panel',
                                                  reactive: true });
        this.actor._delegate = this;

        if (this._getProperty(PANEL_RESIZABLE_KEY, "b")) {
            this.actor.set_height(this._getProperty(PANEL_HEIGHT_KEY, "i") * global.ui_scale);
        }

        this._menus = new PopupMenu.PopupMenuManager(this);

        this._leftBox = new St.BoxLayout({ name: 'panelLeft' });
        this.actor.add_actor(this._leftBox);
        this._leftBoxDNDHandler = new PanelZoneDNDHandler(this._leftBox);
        this._centerBox = new St.BoxLayout({ name: 'panelCenter' });
        this.actor.add_actor(this._centerBox);
        this._centerBoxDNDHandler = new PanelZoneDNDHandler(this._centerBox);
        this._rightBox = new St.BoxLayout({ name: 'panelRight' });
        this.actor.add_actor(this._rightBox);
        this._rightBoxDNDHandler = new PanelZoneDNDHandler(this._rightBox);

        if (this.actor.get_direction() == St.TextDirection.RTL) {
            this._leftCorner = new PanelCorner(this._rightBox, St.Side.LEFT);
            this._rightCorner = new PanelCorner(this._leftBox, St.Side.RIGHT);
        } else {
            this._leftCorner = new PanelCorner(this._leftBox, St.Side.LEFT);
            this._rightCorner = new PanelCorner(this._rightBox, St.Side.RIGHT);
        }

        this.actor.add_actor(this._leftCorner.actor);
        this.actor.add_actor(this._rightCorner.actor);

        if (this.bottomPosition)
            this.actor.add_style_class_name('panel-bottom')
        else
            this.actor.add_style_class_name('panel-top')

        /* right */
        this._status_area_order = [];
        this._status_area_cinnamon_implementation = {};

        this._context_menu = new PanelContextMenu(this, bottomPosition ? St.Side.BOTTOM: St.Side.TOP, id);
        this._menus.addMenu(this._context_menu);
        
        this._context_menu._boxPointer._container.connect('allocate', Lang.bind(this._context_menu._boxPointer, function(actor, box, flags){
                    this._xPosition = this._xpos;
                    this._shiftActor();
        }));

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
        this.actor.connect('style-changed', Lang.bind(this, this._moveResizePanel));
        this.actor.connect('parent-set', Lang.bind(this, this._onPanelEditModeChanged));
        this.actor.connect('leave-event', Lang.bind(this, this._leavePanel));
        this.actor.connect('enter-event', Lang.bind(this, this._enterPanel));
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        global.settings.connect("changed::" + PANEL_AUTOHIDE_KEY, Lang.bind(this, this._processPanelAutoHide));
        global.settings.connect("changed::" + PANEL_HEIGHT_KEY, Lang.bind(this, this._moveResizePanel));
        global.settings.connect("changed::" + PANEL_RESIZABLE_KEY, Lang.bind(this, this._moveResizePanel));
        global.settings.connect("changed::" + PANEL_SCALE_TEXT_ICONS_KEY, Lang.bind(this, this._onScaleTextIconsChanged));
        global.settings.connect("changed::panel-edit-mode", Lang.bind(this, this._onPanelEditModeChanged));

        global.screen.connect("monitors-changed", Lang.bind(this, this._moveResizePanel));

        /* Generate panelbox */
        this._leftPanelBarrier = 0;
        this._rightPanelBarrier = 0;
        this.panelBox = new St.BoxLayout({ name: 'panelBox',
                                           vertical: true });
        Main.layoutManager.addChrome(this.panelBox, { addToWindowgroup: false });
        this.panelBox.connect('allocation-changed', Lang.bind(this, this._updatePanelBarriers));
        this.panelBox.add_actor(this.actor)

        this._moveResizePanel();
    },

    /**
     * highlight:
     * @highlight (boolean): whether to turn on or off
     *
     * Turns on/off the highlight of the panel
     */
    highlight: function(highlight) {
        if (highlight)
            this.actor.add_style_pseudo_class('highlight');
        else
            this.actor.remove_style_pseudo_class('highlight');
    },

    isHideable: function() {
        return this._hideable;
    },
    
    /**
     * _getProperty
     * @key (string): name of gsettings key
     * @type (string): (optional) type of data requested. "b" for boolean, "i" for integer. Default value is string
     *
     * Gets the desired property of the panel from gsettings
     *
     * Returns: property required
     */
    _getProperty: function(key, type){
        let values = global.settings.get_strv(key);
        let property;
        for (let i = 0; i < values.length; i++){
            if (values[i].split(":")[0]==this.panelId){
                property=values[i].split(":")[1];
                break;
            }
        }
        if (!property){
            property = DEFAULT_VALUES[key];
            values.push(this.panelId + ":" + property);
            global.settings.set_strv(key, values);
        }
        switch (type){
        case "b":
            return property=="true";
        case "i":
            return parseInt(property);
        default:
            return property;
        }
    },

    _updatePanelBarriers: function() {
        if (this._leftPanelBarrier)
            global.destroy_pointer_barrier(this._leftPanelBarrier);
        if (this._rightPanelBarrier)
            global.destroy_pointer_barrier(this._rightPanelBarrier);

        if (this.panelBox.height) {
            let panelTop = (this.bottomPosition ? this.monitor.y + this.monitor.height - this.panelBox.height : this.monitor.y);
            let panelBottom = (this.bottomPosition ? this.monitor.y + this.monitor.height : this.monitor.y + this.panelBox.height);

            this._leftPanelBarrier = global.create_pointer_barrier(
                this.monitor.x, panelTop,
                this.monitor.x, panelBottom,
                1 /* BarrierPositiveX */);

            this._rightPanelBarrier = global.create_pointer_barrier(
                this.monitor.x + this.monitor.width - 1, panelTop,
                this.monitor.x + this.monitor.width - 1, panelBottom,
                4 /* BarrierNegativeX */);
        } else {
            this._leftPanelBarrier = 0;
            this._rightPanelBarrier = 0;
        }
    },

    _onPanelEditModeChanged: function() {
        let old_mode = this._panelEditMode;
        if (global.settings.get_boolean("panel-edit-mode")) {
            this._panelEditMode = true;
            this._leftBox.add_style_pseudo_class('dnd');
            this._centerBox.add_style_pseudo_class('dnd');
            this._rightBox.add_style_pseudo_class('dnd');
        }
        else {
            this._panelEditMode = false;
            this._leftBox.remove_style_pseudo_class('dnd');
            this._centerBox.remove_style_pseudo_class('dnd');
            this._rightBox.remove_style_pseudo_class('dnd');
        }

        if (old_mode != this._panelEditMode) {
            this._processPanelAutoHide();
        }
    },

    _onButtonPressEvent: function (actor, event) {
        if (event.get_button()==1){
            if (this._context_menu.isOpen) {
                this._context_menu.toggle();
            }
        }
        if (event.get_button()==3){
            try {
            let [x, y] = event.get_coords();
            let target = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);
            if (this._context_menu._getMenuItems().length > 0 && target.get_parent() == this.actor) { 
                this._context_menu.toggle();
                if (!this._context_menu.isOpen) {
                    return;
                }

                x -= this._context_menu._boxPointer._arrowOrigin;

                let monitor = Main.layoutManager.findMonitorForActor(this._context_menu._boxPointer.actor);

                let mywidth = this._context_menu._boxPointer.actor.get_allocation_box().x2-this._context_menu._boxPointer.actor.get_allocation_box().x1;//Width of menu

                if (x + mywidth - monitor.x > monitor.width) {
                    x  = monitor.width + monitor.x - mywidth;
                }
                if (x < monitor.x) {
                    x = monitor.x;
                }
                this._context_menu._boxPointer._xpos = Math.round(x);
                this._context_menu._boxPointer._xPosition = this._context_menu._boxPointer._xpos;
                this._context_menu._boxPointer._shiftActor();
            }
        }
        catch(e) {
            global.log(e);
        }
        }
        return;
    },
        
    _processPanelAutoHide: function() {  
        this._hideable = this._getProperty(PANEL_AUTOHIDE_KEY, "b") && !this._panelEditMode;
        // Show a glimpse of the panel irrespective of the new setting,
        // in order to force a region update.
        // Techically, this should not be necessary if the function is called
        // when auto-hide is in effect and is not changing, but experience
        // shows that not flashing the panels may lead to "phantom panels"
        // where the panels should be if auto-hide was on.
        this._hidePanel(true); // force hide
        this._showPanel();

        if (this._hideable) {
            this._hidePanel();
        }
        Main.layoutManager._chrome.modifyActorParams(this.panelBox, { affectsStruts: !this._hideable });
    },

    _moveResizePanel: function() {
        this.monitor = global.screen.get_monitor_geometry(this.monitorId);

        let panelHeight;

        let panelResizable = this._getProperty(PANEL_RESIZABLE_KEY, "b");
        if (panelResizable) {
            panelHeight = this._getProperty(PANEL_HEIGHT_KEY, "i") * global.ui_scale;
        } else {
            let themeNode = this.actor.get_theme_node();
            panelHeight = themeNode.get_length("height");
            if (!panelHeight || panelHeight == 0) {
                panelHeight = 25 * global.ui_scale;
            }
        }

        if (!this._themeFontSize) {
            let themeNode = this.actor.get_theme_node();
            this._themeFontSize = themeNode.get_length("font-size");
        }

        this.scaleMode = this._getProperty(PANEL_RESIZABLE_KEY, "b") && this._getProperty(PANEL_SCALE_TEXT_ICONS_KEY, "b");
        if (this.scaleMode) {
            let textheight = (panelHeight / (Applet.DEFAULT_PANEL_HEIGHT * global.ui_scale) * (Applet.PANEL_FONT_DEFAULT_HEIGHT * global.ui_scale));
            this.actor.set_style('font-size: ' + textheight / global.ui_scale + 'px;');
        } else {
            this.actor.set_style('font-size: ' + this._themeFontSize / global.ui_scale + 'px;');
        }
        this.actor.set_height(panelHeight);
        this._processPanelAutoHide();

        this.panelBox.set_size(this.monitor.width, panelHeight);
        this.panelBox.set_position(this.monitor.x, this.bottomPosition ? this.monitor.y + this.monitor.height - panelHeight : this.monitor.y);

        // AppletManager might not be initialized yet
        if (AppletManager.enabledApplets)
            AppletManager.updateAppletPanelHeights();
    },

    _onScaleTextIconsChanged: function() {
        let panelHeight = this._getProperty(PANEL_HEIGHT_KEY, "i");
        this.scaleMode = this._getProperty(PANEL_RESIZABLE_KEY, "b") && this._getProperty(PANEL_SCALE_TEXT_ICONS_KEY, "b");

        if (!this._themeFontSize) {
            let themeNode = this.actor.get_theme_node();
            this._themeFontSize = themeNode.get_length("font-size");
        }
        if (this.scaleMode) {
            let textheight = (panelHeight / Applet.DEFAULT_PANEL_HEIGHT) * Applet.PANEL_FONT_DEFAULT_HEIGHT;
            this.actor.set_style('font-size: ' + textheight + 'px;');
        } else {
            this.actor.set_style('font-size: ' + this._themeFontSize ? this._themeFontSize + 'px;' : '8.5pt;');
        }
        AppletManager.updateAppletPanelHeights(true);
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        alloc.min_size = -1;
        alloc.natural_size = Main.layoutManager.primaryMonitor.width;
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        // We don't need to implement this; it's forced by the CSS
        alloc.min_size = -1;
        alloc.natural_size = -1;
    },

    _allocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;

        let [leftMinWidth, leftNaturalWidth] = this._leftBox.get_preferred_width(-1);
        let [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_width(-1);
        let [rightMinWidth, rightNaturalWidth] = this._rightBox.get_preferred_width(-1);

        let leftWidth = Math.max(leftNaturalWidth, 25);
        let centerWidth = centerMinWidth;
        let rightWidth = Math.max(rightNaturalWidth, 25);

        let space_needed = leftWidth + centerWidth + rightWidth;
        if (space_needed <= allocWidth) {
            // If we've more space than we need, expand the center zone
            let space_left = allocWidth - space_needed;
            centerWidth = centerWidth + space_left;
        }
        else {
            let space_missing = space_needed - allocWidth;
            // If there isn't enough space, reduce the size of the largest zone (likely to contain more shrinkable content)
            if (leftWidth >= centerWidth && leftWidth >= rightWidth) {
                leftWidth = Math.max(leftWidth - space_missing, leftMinWidth);
            }
            else if (centerWidth >= rightWidth) {
                centerWidth = Math.max(centerWidth - space_missing, centerMinWidth);
            }
            else {
                rightWidth = Math.max(rightWidth - space_missing, rightMinWidth);
            }
        }

        let leftBoundary = leftWidth;
        let rightBoundary = allocWidth - rightWidth;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            leftBoundary = allocWidth - leftWidth;
            rightBoundary = rightWidth;
        }

        let childBox = new Clutter.ActorBox();

        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = leftBoundary;
            childBox.x2 = allocWidth;
        } else {
            childBox.x1 = 0;
            childBox.x2 = leftBoundary;
        }
        this._leftBox.allocate(childBox, flags);

        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = rightBoundary;
            childBox.x2 = leftBoundary;
        } else {
            childBox.x1 = leftBoundary;
            childBox.x2 = rightBoundary;
        }
        this._centerBox.allocate(childBox, flags);

        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = 0;
            childBox.x2 = rightBoundary;
        } else {
            childBox.x1 = rightBoundary;
            childBox.x2 = allocWidth;
        }
        this._rightBox.allocate(childBox, flags);

        let [cornerMinWidth, cornerWidth] = this._leftCorner.actor.get_preferred_width(-1);
        let [cornerMinHeight, cornerHeight] = this._leftCorner.actor.get_preferred_width(-1);
        childBox.x1 = 0;
        childBox.x2 = cornerWidth;
        childBox.y1 = allocHeight;
        childBox.y2 = allocHeight + cornerHeight;
        this._leftCorner.actor.allocate(childBox, flags);

        [cornerMinWidth, cornerWidth] = this._rightCorner.actor.get_preferred_width(-1);
        [cornerMinHeight, cornerHeight] = this._rightCorner.actor.get_preferred_width(-1);
        childBox.x1 = allocWidth - cornerWidth;
        childBox.x2 = allocWidth;
        childBox.y1 = allocHeight;
        childBox.y2 = allocHeight + cornerHeight;
        this._rightCorner.actor.allocate(childBox, flags);
    },
    
    _clearTimers: function() {
        if (this._showTimer) {
            Mainloop.source_remove(this._showTimer);
            this._showTimer = 0;
        }
        if (this._hideTimer) {
            Mainloop.source_remove(this._hideTimer);
            this._hideTimer = 0;
        }
    },
    
    _enterPanel: function() {
        this.isMouseOverPanel = true;
        this._clearTimers();
        let showDelay = this._getProperty(PANEL_SHOW_DELAY_KEY, "i");
        if (showDelay > 0) {
            this._showTimer = Mainloop.timeout_add(showDelay, Lang.bind(this, this._showPanel));
        }
        else {
            this._showPanel();
        }
    },

    _leavePanel:function() {
        this.isMouseOverPanel = false;
        this._clearTimers();
        let hideDelay = this._getProperty(PANEL_HIDE_DELAY_KEY, "i");
        if (hideDelay > 0 && !this._disabled) {
            this._hideTimer = Mainloop.timeout_add(hideDelay, Lang.bind(this, this._hidePanel));
        }
        else {
            this._hidePanel();
        }
    }, 

    enable: function() {
        this._disabled = false;
        this.actor.show();
        Tweener.addTween(this.actor, {
            opacity: 255, 
            time: AUTOHIDE_ANIMATION_TIME, 
            transition: 'easeOutQuad'
        });
    }, 
    
    disable: function() {
        this._disabled = true;
        this._leavePanel();
        Tweener.addTween(this.actor, {
            opacity: 0, 
            time: AUTOHIDE_ANIMATION_TIME, 
            transition: 'easeOutQuad', 
            onComplete: this.actor.hide
        });
    }, 
    
    _showPanel: function() {
        this._clearTimers();

        if (this._disabled) return;

        if (!this._hidden) return;

        if (Main.lookingGlass != null && Main.lookingGlass._open) {
            return;
        }

        // Force the panel to be on top (hack to correct issues when switching workspace)
        Main.layoutManager._windowsRestacked();

        let height = this.actor.get_height();
        let animationTime = AUTOHIDE_ANIMATION_TIME;
        let y = this.bottomPosition ? this.monitor.y + this.monitor.height - height : this.monitor.y

        let params = { y: height - 1,
                        time: animationTime + 0.1,
                        transition: 'easeOutQuad'
                        };

        Tweener.addTween(this._leftCorner.actor, params);
        Tweener.addTween(this._rightCorner.actor, params);

        Tweener.addTween(this.actor.get_parent(),
                        { y: y,
                        time: animationTime,
                        transition: 'easeOutQuad',
                        onUpdate: Lang.bind(this, function(origY, bottomPosition) {
                            // Force the layout manager to update the input region
                            Main.layoutManager._chrome.updateRegions()

                            let height = Math.abs(this.actor.get_parent().y - origY);
                            let y = bottomPosition? 0 : this.actor.height - height;

                            this.actor.set_clip(0, y, this.monitor.width, height);
                        }),
                        onUpdateParams: [this.bottomPosition ? this.monitor.y + this.monitor.height : this.monitor.y - height, this.bottomPosition]
                        });

        params = { opacity: 255,
                    time: animationTime+0.2,
                    transition: 'easeOutQuad'
                    };

        Tweener.addTween(this._leftBox, params);
        Tweener.addTween(this._centerBox, params);
        Tweener.addTween(this._rightBox, params);

        this._hidden = false;
    },

    _hidePanel: function(force) {
        this._clearTimers();

        if ((!this._hideable && !force) || global.menuStackLength > 0 || this.isMouseOverPanel) return;

        // Force the panel to be on top (hack to correct issues when switching workspace)
        Main.layoutManager._windowsRestacked();

        let height = this.actor.get_height();
        let animationTime = AUTOHIDE_ANIMATION_TIME;
        let y = this.bottomPosition ? this.monitor.y + this.monitor.height - 1 : this.monitor.y - height + 1;
        
        Tweener.addTween(this.actor.get_parent(), { 
            y: y,
            time: animationTime,
            transition: 'easeOutQuad',
            onUpdate: Lang.bind(this, function(targetY, bottomPosition) {
                // Force the layout manager to update the input region
                Main.layoutManager._chrome.updateRegions()

                let height = Math.abs(this.actor.get_parent().y - targetY) + 1;
                let y = bottomPosition ? 0 : this.actor.height - height;

                this.actor.set_clip(0, y, this.monitor.width, height);
            }),
            onUpdateParams: [y, this.bottomPosition]
        });

        let params = { y: 0,
                        time: animationTime,
                        transition: 'easeOutQuad'
                        };

        Tweener.addTween(this._leftCorner.actor, params);
        Tweener.addTween(this._rightCorner.actor, params);

        params = { opacity: 0,
                    time: Math.max(0, animationTime - 0.1),
                    transition: 'easeOutQuad'
                    };

        Tweener.addTween(this._leftBox, params);
        Tweener.addTween(this._centerBox, params);
        Tweener.addTween(this._rightBox, params);

        this._hidden = true;
    },

};
