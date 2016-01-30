/**
 * FILE:panel.js
 * @short_description: The file responsible for managing panels
 *
 * This file is where everything about panels happens. #Main will create a
 * #PanelManager object, which is responsible for creating and moving panels.
 * There is also a %checkPanelUpgrade function used as a transition between the
 * old panel settings and the new panel settings.
 */
const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const DND = imports.ui.dnd;
const Gtk = imports.gi.Gtk;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const SignalManager = imports.misc.signalManager;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;

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
                        "panels-scale-text-icons": "true"};

const Direction = {
    LEFT  : 0,
    RIGHT : 1
}

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
 * calculateAllocation:
 * @leftMin (real): minimum width of left box
 * @leftNatural (real): natural width of left box
 * @centerMin (real): minimum width of center box
 * @centerNatural (real): natural width of center box
 * @rightMin (real): minimum width of right box
 * @rightNatural (real): natural width of right box
 * @alloc (real): total available width to allocate
 * @centerOccupied (boolean): whether the center box is occupied.
 *
 * Given the minimum and natural width requested by each box, this function
 * calculates how much width should actually allocated to each box. The
 * function returns two variables [@left, @right], which is the expected width
 * of each side.
 *
 * The expected outcome of the code is as follows:
 *
 * Assuming that the centerBox is filled, the primary objective is to center
 * the centerBox whenever possible. This will be done all the time unless doing
 * so requires some box's width to go under its minimum width.
 *
 * If we are centering the centerBox, there are two possible scenarios.
 * Firstly, if the centerBox can be perfectly centered while everything takes
 * their natural size, then everything will be allocated at least their natural
 * size such that the centerBox is centered, leftBox is left aligned, rightBox
 * is right aligned.
 *
 * Otherwise, we first allocate the minWidth to every box, and then distribute
 * the remaining space proportional to how much more space each box wants.
 * This is done in a way that ensures the leftWidth and rightWidth are equal.
 *
 * If it is not possible to center the centerBox, but there is enough space to
 * just allocate the boxes, the centerBox will be made as centered as possible
 * without making things go under their minWidth. This is achieved by making
 * the shorter box go to their min width, and distributing the remaining space
 * among the two other boxes.
 *
 * Finally, if there isn't even enough space to just put the things, the width
 * allocated is just proportional to the minimum width.
 *
 * In the cases where the centerBox is not occupied, a similar mechanism is
 * employed. If there is enough space for everything to get their natural
 * width, this will happen. Otherwise, we first allocate the minimum width and
 * then distribute the remaining space proportional to how much more space each
 * box wants. In the scenario where the isn't enough space to just allocate the
 * minimum width, we just allocate proportional to the minimum width.
 *
 * Returns (array): The left and right widths to be allocated.
 */
function calculateAllocation(leftMin, leftNatural, centerMin, centerNatural, rightMin, rightNatural, alloc, centerOccupied) {
    let totalMin = leftMin + centerMin + rightMin;
    let totalNatural = leftNatural + centerNatural + rightNatural;

    let sideMin = Math.max(leftMin, rightMin);
    let sideNatural = Math.max(leftNatural, rightNatural);
    let totalCentMin = centerMin + 2 * sideMin;
    let totalCentNatural = centerNatural + 2 * sideNatural;

    let left, right;

    if (centerOccupied) {
        if (totalCentNatural < alloc) {
            /* We can give everything their natural width and center will
             * still be centered. */
            left = (alloc - centerNatural) / 2;
            right = left;
        } else if (totalCentMin < alloc) {
            /* Center can be centered as without shrinking things too much.
             * First give everything the min they want, and they
             * distribute the remaining space proportional to how much the
             * regions want. */
            let totalRemaining = alloc - totalCentMin;
            let totalWant = totalCentNatural - totalCentMin;

            // totalWant != 0 or else totalCentNatural == totalCentMin
            left = sideMin + (sideNatural - sideMin) / totalWant * totalRemaining;
            right = left;
        } else if (totalMin < alloc) {
            /* There is enough space for min if we don't care about
             * centering. Make center things as center as possible */
            if (leftMin > rightMin) {
                left = leftMin;

                if (leftMin + centerNatural + rightNatural < alloc) {
                    right = alloc - leftMin - centerNatural;
                } else {
                    let totalRemaining = alloc - totalMin;
                    let totalWant = centerNatural + rightNatural - (centerMin + rightMin);

                    right = rightMin;
                    if (totalWant > 0)
                        right += (rightNatural - rightMin) / totalWant * totalRemaining;
                }
            } else {
                right = rightMin;

                if (rightMin + centerNatural + leftNatural < alloc) {
                    left = alloc - rightMin - centerNatural;
                } else {
                    let totalRemaining = alloc - totalMin;
                    let totalWant = centerNatural + leftNatural - (centerMin + leftMin);

                    left = leftMin;
                    if (totalWant > 0)
                        left += (leftNatural - rightMin) / totalWant * totalRemaining;
                }
            }
        } else {
            /* Scale everything down according to their min. */
            left = leftMin / totalMin * alloc;
            right = rightMin / totalMin * alloc;
        }
    } else {
        if (totalNatural < alloc) {
            /* Everything's fine. Allocate as usual. */
            left = leftNatural;
            right = rightNatural;
        } else if (totalMin < alloc) {
            /* There is enough space for min but not for natural.
             * Allocate the min and then divide the remaining space
             * according to how much more they want. */
            let totalRemaining = alloc - totalMin;
            let totalWant = totalNatural - totalMin;

            // totalWant != 0 or else totalMin == totalNatural
            left = leftMin + (leftNatural - leftMin) / totalWant * totalRemaining;
            right = rightMin + (rightNatural - rightMin) / totalWant * totalRemaining;
        } else {
            /* Scale everything down according to their min. */

            // totalMin != 0 or else totalMin < alloc
            left = leftMin / totalMin * alloc;
            right = rightMin / totalMin * alloc;
        }
    }
    return [Math.round(left), Math.round(right)];
}

/**
 * checkPanelUpgrade:
 *
 * Run from main, prior to PanelManager being initialized
 * this handles the one-time transition between panel implementations
 * to make this transition invisible to the user.  We will evaluate the
 * desktop-layout key, and pre-set applets-enabled and panels-enabled
 * appropriately.
 */
function checkPanelUpgrade()
{
    let oldLayout = global.settings.get_string("desktop-layout");

    let doIt = false;

    /* GLib >= 2.4 has get_user_value, use that if possible - this being null
     * indicates either the user never changed from the default "traditional"
     * panel layout, or else this upgrade has already been performed (since
     * with this set of patches, its default value goes from traditional to nothing.)
     * Either way, we don't need to do anything in this case.  With glib < 2.4,
     * we instead check if the value is set to "" - either by result of the new
     * default, or by this upgrade already having been run.
     */

    try {
        doIt = (global.settings.get_user_value("desktop-layout") != null)
    } catch (e) {
        doIt = (global.settings.get_string("desktop-layout") != "");
    }

    if (!doIt)
        return;

    switch (oldLayout) {
        case "flipped":
            global.settings.set_strv("panels-enabled", ["1:0:top"]);
            break;
        case "classic":
            global.settings.set_strv("panels-enabled", ["1:0:top", "2:0:bottom"]);
            break;
        case "traditional": /* Default (explicitly set) - no processing needed */
        default:
            break;
    }

    global.settings.reset("desktop-layout");
}

/**
 * #PanelManager
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
        this.canAdd = true; // Whether there is space for more panels to be added

        let panelProperties = global.settings.get_strv("panels-enabled");
        for (let i in panelProperties) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }

            this._loadPanel(parseInt(elements[0]), parseInt(elements[1]), elements[2]=="bottom");
        }

        this._setMainPanel();

        this.addPanelMode = false;

        this._panelsEnabledId = global.settings.connect("changed::panels-enabled", Lang.bind(this, this._onPanelsEnabledChanged));
        this._panelEditModeId = global.settings.connect("changed::panel-edit-mode", Lang.bind(this, this._onPanelEditModeChanged));
        this._monitorsChangedId = global.screen.connect("monitors-changed", Lang.bind(this, this._onMonitorsChanged));

        this._addOsd = new ModalDialog.InfoOSD(_("Select position of new panel. Esc to cancel."));
        this._moveOsd = new ModalDialog.InfoOSD(_("Select new position of panel. Esc to cancel."));
        this._addOsd.hide();
        this._moveOsd.hide();
 
        this._checkCanAdd();
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
     * setPanelsOpacity:
     * @opacity (int): opacity of panels
     *
     * Sets the opacity of all panels to @opacity
     */
    setPanelsOpacity: function(opacity) {
        for (let i in this.panels) {
            if (this.panels[i])
                this.panels[i].actor.opacity = opacity;
        }
    },

    /**
     * removePanel:
     * @panelId (int): Panel id of the panel to be removed
     *
     * Remove the panel from the list panels-enabled
     */
    removePanel: function(panelId) {
        let list = global.settings.get_strv("panels-enabled");
        for (let i in list) {
            if (list[i].split(":")[0] == panelId) {
                list.splice(i, 1);
                break;
            }
        }
        global.settings.set_strv("panels-enabled", list);
    },

    /**
     * addPanel:
     * @monitorIndex (integer): monitor to be added to
     * @bottomPosition (boolean): whether the panel is added to the bottom
     *
     * Adds a new panel to the specified position
     */
    addPanel: function(monitorIndex, bottomPosition) {
        let list = global.settings.get_strv("panels-enabled");
        let i = 0; // Start counting at 1 for compatibility

        // Magic: Keep recursing until there is a free panel id
        while (true)
            if (!this.panelsMeta[++i])
                break;

        // Add default values
        outerLoop:
        for (let key in DEFAULT_VALUES) {
            let settings = global.settings.get_strv(key);
            for (let j = 0; j < settings.length; j++){
                if (settings[j].split(":")[0] == i){
                    continue outerLoop;
                }
            }
            settings.push(i + ":" + DEFAULT_VALUES[key]);
            global.settings.set_strv(key, settings);
        }

        list.push(i + ":" + monitorIndex + ":" + (bottomPosition ? "bottom" : "top"));
        global.settings.set_strv("panels-enabled", list);

        // Delete all panel dummies
        if (this.addPanelMode)
            this._destroyDummyPanels();
    },

    /**
     * movePanel:
     * @monitorIndex (integer): monitor to be added to
     * @bottomPosition (boolean): whether the panel is added to the bottom
     *
     * Moves the panel of id this.moveId to the specified position
     */
    movePanel: function(monitorIndex, bottomPosition) {
        let list = global.settings.get_strv("panels-enabled");
        let i = -1;

        for (let i in list) {
            if (list[i].split(":")[0] == this.moveId) {
                list[i] = this.moveId + ":" + monitorIndex + ":" + (bottomPosition ? "bottom" : "top");
                break;
            }
        }

        global.settings.set_strv("panels-enabled", list);

        // Delete all panel dummies
        if (this.addPanelMode)
            this._destroyDummyPanels();
    },

    /**
     * _destroyDummyPanels:
     *
     * Destroys all panel dummies
     */
    _destroyDummyPanels: function() {
        for (let i in this.dummyPanels) {
            if (this.dummyPanels[i][0]) this.dummyPanels[i][0].destroy();
            if (this.dummyPanels[i][1]) this.dummyPanels[i][1].destroy();
            delete this.dummyPanels[i][0];
            delete this.dummyPanels[i][1];
        }
        this.addPanelMode = false;
        this._addOsd.hide();
        this._moveOsd.hide();
        if (Main.keybindingManager.bindings['close-add-panel'])
            Main.keybindingManager.removeHotKey('close-add-panel');
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
            if (this.panels[i].monitorIndex == monitorIndex)
                returnValue.push(this.panels[i]);
        }
        return returnValue;
    },

    /**
     * getPanels:
     *
     * Retrieves all panels
     *
     * Returns: an array of panels
     */

    getPanels: function() {
        return this.panels;
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
            if (!this.panels[i])
                continue;
            if (this.panels[i].monitorIndex == monitorIndex && this.panels[i].bottomPosition == bottomPosition)
                return this.panels[i];
        }
        return null;
    },

    /**
     * updatePanelsVisibility:
     *
     * Prompts every panel to update its visibility (show/hide). This is used
     * by WindowManager after window map/tile/etc animations, and after popup
     * menus close.
     */
    updatePanelsVisibility: function() {
        for (let i in this.panels) {
             if (!this.panels[i])
                 continue;
             this.panels[i]._updatePanelVisibility();
        }
    },

    /**
     * _loadPanel:
     * @ID (integer): panel id
     * @monitorIndex (integer): index of monitor of panel
     * @bottomPosition (boolean): whether the panel should be at the bottom or not
     * @panelList (array): (optional) the list in which the new panel should be appended to (not necessarily this.panels, c.f. _onPanelsEnabledChanged) Default: this.panels
     * @metaList(array): (optional) the list in which the new panel metadata should be appended to (not necessarily this.panelsMeta, c.f. _onPanelsEnabledChanged) Default: this.panelsMeta
     *
     * Loads a panel with the given properties and appends it to @panelList. @panelList is usually this.panels but is a different array when used by _onPanelsEnabledChanged.
     *
     * Returns (Panel.Panel): Panel created
     */
    _loadPanel: function(ID, monitorIndex, bottomPosition, panelList, metaList) {
        if (!panelList) panelList = this.panels;
        if (!metaList) metaList = this.panelsMeta;

        if (panelList[ID]) {
            global.log("Multiple panels with same ID (" + ID + ") are found");
            return null;
        }

        panelList.length = Math.max(panelList.length, ID+1);
        metaList.length = panelList.length;

        let repeat = false;
        for (let i in metaList) {
            if ((metaList[i][0] == monitorIndex) && (metaList[i][1] == bottomPosition) && i != ID) {
                global.log("Conflicting panel definitions: " + ID + ":" + monitorIndex + ":" + (bottomPosition ? "bottom" : "top" ));
                repeat = true;
                break;
            }
        }

        if (repeat) return null;

        metaList[ID] = [monitorIndex, bottomPosition];

        if (monitorIndex < 0 || monitorIndex >= global.screen.get_n_monitors()) {
            global.log("Monitor " + monitorIndex + " not found. Not creating panel");
            return null;
        }

        panelList[ID] = new Panel(ID, monitorIndex, bottomPosition);

        return panelList[ID];
    },

    _checkCanAdd: function() {
        let monitorCount = global.screen.get_n_monitors();
        let panelCount = monitorCount * 2;

        for (let i in this.panelsMeta) {
            if (this.panelsMeta[i][0] >= monitorCount) // Monitor does not exist
                continue;
            panelCount --;
        }
        if (this.canAdd != (panelCount != 0)) {
            this.canAdd = (panelCount != 0);
        }
    },

    _updateAllPointerBarriers: function() {
        this.panels.forEach(function(panel) {
            panel._updatePanelBarriers();
        });
    },

    _onPanelsEnabledChanged: function() {
        let newPanels = new Array(this.panels.length);
        let newMeta = new Array(this.panels.length);

        let panelProperties = global.settings.get_strv("panels-enabled");
        for (let i = 0; i < panelProperties.length; i ++) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }

            let ID = parseInt(elements[0]);

            // If panel is moved
            if (this.panels[ID]) {
                // Move panel object to newPanels
                newPanels[ID] = this.panels[ID];
                newMeta[ID] = [parseInt(elements[1]), elements[2]=="bottom"];
                this.panels[ID] = null;

                if (newMeta[ID][0] != this.panelsMeta[ID][0] || newMeta[ID][1] != this.panelsMeta[ID][1]) {
                    newPanels[ID].updatePosition(newMeta[ID][0], newMeta[ID][1]);
                    AppletManager.updateAppletsOnPanel(newPanels[ID]);
                }
            } else {
                let panel = this._loadPanel(ID, parseInt(elements[1]), elements[2]=="bottom", newPanels, newMeta);
                if (panel)
                    AppletManager.loadAppletsOnPanel(panel);
            }
        }

        // Destroy removed panels
        for (let i in this.panels)
            if (this.panels[i]) this.panels[i].destroy();

        this.panels = newPanels;
        this.panelsMeta = newMeta;

        this._setMainPanel();
        this._checkCanAdd();
        this._updateAllPointerBarriers();
    },

    _onMonitorsChanged: function() {
        let monitorCount = global.screen.get_n_monitors();
        for (let i in this.panelsMeta) {
            if (this.panelsMeta[i] && !this.panels[i]) { // If there is a meta but not a panel, i.e. panel could not create due to non-existent monitor, try again.
                let panel = this._loadPanel(i, this.panelsMeta[i][0], this.panelsMeta[i][1]);
                if (panel)
                    AppletManager.loadAppletsOnPanel(panel);
            } else if (this.panelsMeta[i][0] >= monitorCount) { // Monitor of the panel went missing
                this.panels[i].destroy();
                delete this.panels[i];
            } else { // Nothing happens. Re-allocate panel
                this.panels[i]._moveResizePanel();
            }
        }

        if (this.addPanelMode) {
            this._destroyDummyPanels();
            this._showDummyPanels(this.dummyCallback);
        }

        this._setMainPanel();
        this._checkCanAdd();
    },

    _onPanelEditModeChanged: function() {
        if (!global.settings.get_boolean("panel-edit-mode")) {
            if (this.addPanelMode)
                this._destroyDummyPanels();
        }
    },

    /**
     * addPanelQuery:
     *
     * Prompts user where to add the panel
     */
    addPanelQuery: function() {
        if (this.addPanelMode || !this.canAdd)
            return;

        this._showDummyPanels(Lang.bind(this, this.addPanel));
        this._addOsd.show();
    },

    /**
     * movePanelQuery:
     * @id (integer): the id of the panel to be moved
     *
     * Prompts user where to move the panel
     */
    movePanelQuery: function(id) {
        if (this.addPanelMode || !this.canAdd)
            return;

        this.moveId = id;
        this._showDummyPanels(Lang.bind(this, this.movePanel));
        this._moveOsd.show();
    },

    _showDummyPanels: function(callback) {
        let monitorCount = global.screen.get_n_monitors();
        this.dummyCallback = callback;
        this.dummyPanels = [];
        while (this.dummyPanels.push([]) < monitorCount); // Generate a 2D array of length monitorCount; Push returns new length of array

        for (let i in this.panelsMeta) {
            if (this.panelsMeta[i][0] >= monitorCount) // Monitor does not exist
                continue;
            this.dummyPanels[this.panelsMeta[i][0]][this.panelsMeta[i][1] ? 0 : 1] = false;
        }

        for (let i = 0; i < monitorCount; i++) {
            for (let j = 0; j < 2; j++) {
                if (this.dummyPanels[i][j] != false) {
                    this.dummyPanels[i][j] = new PanelDummy(i, j == 0, callback);
                }
            }
        }

        this.addPanelMode = true;
        Main.keybindingManager.addHotKey('close-add-panel', 'Escape', Lang.bind(this, function() {
            if (this.addPanelMode)
                this._destroyDummyPanels();
        }));

       return true;
    },

    // Set Main.panel so that applets that look for it don't break
    _setMainPanel: function() {
        for (let i = 0; i < this.panels.length; i++) {
            if (this.panels[i]) {
                Main.panel = this.panels[i];
                break;
            }
        }
    }
} 

/**
 * #PanelDummy
 * @short_description: Dummy panels for users to select new position of panel
 *
 * #PanelDummy creates some boxes at possible panel locations for users to 
 * select where to place their new panels
 */
function PanelDummy(monitorIndex, bottomPosition, callback) {
    this._init(monitorIndex, bottomPosition, callback);
}

PanelDummy.prototype = {
    _init: function(monitorIndex, bottomPosition, callback) {
        this.monitorIndex = monitorIndex;
        this.bottomPosition = bottomPosition;
        this.callback = callback;
        this.monitor = global.screen.get_monitor_geometry(monitorIndex);
        
        this.actor = new Cinnamon.GenericContainer({style_class: "panel-dummy", reactive: true, track_hover: true, important: true});
        Main.layoutManager.addChrome(this.actor, { addToWindowgroup: false });

        this.actor.set_size(this.monitor.width, 25 * global.ui_scale);
        this.actor.set_position(this.monitor.x, bottomPosition ? this.monitor.y + this.monitor.height - (25 * global.ui_scale) : this.monitor.y);

        this.actor.connect('button-press-event', Lang.bind(this, this._onClicked));
        this.actor.connect('enter-event', Lang.bind(this, this._onEnter));
        this.actor.connect('leave-event', Lang.bind(this, this._onLeave));
    },

    _onClicked: function() {
        this.callback(this.monitorIndex, this.bottomPosition);
    },

    _onEnter: function() {
        this.actor.add_style_pseudo_class('entered');
        if (this.noStyle)
            this.actor.opacity = 160;
    },

    _onLeave: function() {
        this.actor.remove_style_pseudo_class('entered');
        if (this.noStyle)
            this.actor.opacity = 100;
    },

    /**
     * destroy:
     *
     * Destroys panel dummy actor
     */
    destroy: function() {
        this.actor.destroy();
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

        cr.$dispose();
    },

    _styleChanged: function() {
        let node = this.actor.get_theme_node();

        let cornerRadius = node.get_length("-panel-corner-radius");
        let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');

        this.actor.set_size(cornerRadius, innerBorderWidth + cornerRadius);
        this.actor.set_anchor_point(0, innerBorderWidth);
    }
};

function SettingsLauncher(label, keyword, icon) {
    this._init(label, keyword, icon);
}

SettingsLauncher.prototype = {
    __proto__: PopupMenu.PopupIconMenuItem.prototype,

    _init: function (label, keyword, icon) {
        PopupMenu.PopupIconMenuItem.prototype._init.call(this, label, icon, St.IconType.SYMBOLIC);

        this._keyword = keyword;
        this.connect('activate', Lang.bind(this, function() {
            Util.spawnCommandLine("cinnamon-settings " + this._keyword);
        }));
    },
};

function populateSettingsMenu(menu, panelId) {

    menu.troubleshootItem = new PopupMenu.PopupSubMenuMenuItem(_("Troubleshoot"));
    menu.troubleshootItem.menu.addAction(_("Restart Cinnamon"), function(event) {
        global.reexec_self();
    });

    menu.troubleshootItem.menu.addAction(_("Looking Glass"), function(event) {
        Main.createLookingGlass().open();
    });

    menu.troubleshootItem.menu.addAction(_("Restore all settings to default"), function(event) {
        let confirm = new ModalDialog.ConfirmDialog("Are you sure you want to restore all settings to default?\n\n",
                function() {
                    Util.spawnCommandLine("gsettings reset-recursively org.cinnamon");
                    global.reexec_self();
                });
        confirm.open();
    });

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    menu.addMenuItem(menu.troubleshootItem);

    let panelSettingsSection = new PopupMenu.PopupSubMenuMenuItem(_("Modify panel"));

    let menuItem = new PopupMenu.PopupIconMenuItem(_("Remove panel"), "list-remove", St.IconType.SYMBOLIC);
    menuItem.activate = Lang.bind(menu, function() {
        Main.panelManager.removePanel(panelId);
    });
    panelSettingsSection.menu.addMenuItem(menuItem);

    menu.addPanelItem = new PopupMenu.PopupIconMenuItem(_("Add panel"), "list-add", St.IconType.SYMBOLIC);
    menu.addPanelItem.activate = Lang.bind(menu, function() {
        Main.panelManager.addPanelQuery();
        this.close();
    });
    panelSettingsSection.menu.addMenuItem(menu.addPanelItem);

    menu.movePanelItem = new PopupMenu.PopupIconMenuItem(_("Move panel"), "move", St.IconType.SYMBOLIC);
    menu.movePanelItem.activate = Lang.bind(menu, function() {
        Main.panelManager.movePanelQuery(this.panelId);
        this.close();
    });
    panelSettingsSection.menu.addMenuItem(menu.movePanelItem);

    menu.copyAppletItem = new PopupMenu.PopupIconMenuItem(_("Copy applet configuration"), "edit-copy", St.IconType.SYMBOLIC);
    menu.copyAppletItem.activate = Lang.bind(menu, function() {
        AppletManager.copyAppletConfiguration(this.panelId);
        this.close();
    });
    panelSettingsSection.menu.addMenuItem(menu.copyAppletItem);

    menu.pasteAppletItem = new PopupMenu.PopupIconMenuItem(_("Paste applet configuration"), "edit-paste", St.IconType.SYMBOLIC);
    menu.pasteAppletItem.activate = Lang.bind(menu, function() {
        let dialog = new ModalDialog.ConfirmDialog(
                _("Pasting applet configuration will remove all existing applets on this panel. Do you want to continue?") + "\n\n",
                Lang.bind(this, function() {
                    AppletManager.pasteAppletConfiguration(this.panelId);
                }));
        dialog.open();
    });
    panelSettingsSection.menu.addMenuItem(menu.pasteAppletItem);

    menu.clearAppletItem = new PopupMenu.PopupIconMenuItem(_("Clear all applets"), "edit-clear-all", St.IconType.SYMBOLIC);
    menu.clearAppletItem.activate = Lang.bind(menu, function() {
        let dialog = new ModalDialog.ConfirmDialog(
                _("Are you sure you want to clear all applets on this panel?") + "\n\n",
                Lang.bind(this, function() {
                    AppletManager.clearAppletConfiguration(this.panelId);
                }));
        dialog.open();
    });
    panelSettingsSection.menu.addMenuItem(menu.clearAppletItem);

    menu.addMenuItem(panelSettingsSection);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

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
        this.panelId = panelId;

        let applet_settings_item = new SettingsLauncher(_("Add applets to the panel"), "applets panel" + panelId, "list-add");
        this.addMenuItem(applet_settings_item);

        let menuItem = new SettingsLauncher(_("Panel settings"), "panel " + panelId, "emblem-system");
        this.addMenuItem(menuItem);

        let menuItem = new SettingsLauncher(_("Themes"), "themes", "applications-graphics");
        this.addMenuItem(menuItem);

        let menuSetting = new SettingsLauncher(_("All settings"), "", "preferences-system");
        this.addMenuItem(menuSetting);

        populateSettingsMenu(this, panelId);
    },

    open: function(animate) {
        PopupMenu.PopupMenu.prototype.open.call(this, animate);

        this.movePanelItem.setSensitive(Main.panelManager.canAdd);
        this.addPanelItem.setSensitive(Main.panelManager.canAdd);
        this.pasteAppletItem.setSensitive(AppletManager.clipboard.length != 0);

        let defs = AppletManager.enabledAppletDefinitions.idMap;
        let nonEmpty = false;
        for (let i in defs) {
            if (defs[i].panelId == this.panelId) {
                nonEmpty = true;
                break;
            }
        }
        this.copyAppletItem.setSensitive(nonEmpty);
        this.clearAppletItem.setSensitive(nonEmpty);
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
            this._panelZone.insert_child_at_index(this._dragPlaceholder.actor,
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

/**
 * #Panel:
 * @short_description: A panel object on the monitor
 *
 * @panelId (int): the id of the panel
 * @monitorIndex (int): the index of the monitor containing the panel
 * @monitor (Meta.Rectangle): the geometry (bounding box) of the monitor
 * @bottomPosition (boolean): whether the panel is at the bottom of the screen
 * @actor (Cinnamon.GenericContainer): the actor of the panel
 * @scaleMode (boolean): whether the applets should scale with the panel
 *
 * @_leftBox (St.BoxLayout): the box containing all the applets in the left region
 * @_centerBox (St.BoxLayout): the box containing all the applets in the center region
 * @_rightBox (St.BoxLayout): the box containing all the applets in the right region
 * @_hidden (boolean): whether the panel is currently hidden
 * @_disabled (boolean): whether the panel is disabled
 * @_panelEditMode (boolean): whether the panel edit mode is on
 * @_context_menu (Panel.PanelContextMenu): the context menu of the panel
 *
 * This represents a panel on the screen.
 */
function Panel(id, monitorIndex, bottomPosition) {
    this._init(id, monitorIndex, bottomPosition);
}

Panel.prototype = {
    _init : function(id, monitorIndex, bottomPosition) {
        this.panelId = id;
        this.monitorIndex = monitorIndex;
        this.monitor = global.screen.get_monitor_geometry(monitorIndex);
        this.bottomPosition = bottomPosition;

    	this._hidden = false;
        this._disabled = false;
        this._panelEditMode = false;
        this._autohideSettings = this._getProperty(PANEL_AUTOHIDE_KEY, "s");
        this._themeFontSize = null;
        this._destroyed = false;
        this._signalManager = new SignalManager.SignalManager(this);

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
        this._rightBox = new St.BoxLayout({ name: 'panelRight', align_end: true});
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

        this._context_menu = new PanelContextMenu(this, bottomPosition ? St.Side.BOTTOM: St.Side.TOP, id);
        this._menus.addMenu(this._context_menu);

        this._context_menu._boxPointer._container.connect('allocate', Lang.bind(this._context_menu._boxPointer, function(actor, box, flags){
                    this._xPosition = this._xpos;
                    this._shiftActor();
        }));

        this._leftPanelBarrier = 0;
        this._rightPanelBarrier = 0;
        Main.layoutManager.addChrome(this.actor, { addToWindowgroup: false });
        this._moveResizePanel();
        this._onPanelEditModeChanged();

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
        this.actor.connect('style-changed', Lang.bind(this, this._moveResizePanel));
        this.actor.connect('leave-event', Lang.bind(this, this._leavePanel));
        this.actor.connect('enter-event', Lang.bind(this, this._enterPanel));
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        this._signalManager.connect(global.settings, "changed::" + PANEL_AUTOHIDE_KEY, this._processPanelAutoHide);
        this._signalManager.connect(global.settings, "changed::" + PANEL_HEIGHT_KEY, this._moveResizePanel);
        this._signalManager.connect(global.settings, "changed::" + PANEL_RESIZABLE_KEY, this._moveResizePanel);
        this._signalManager.connect(global.settings, "changed::" + PANEL_SCALE_TEXT_ICONS_KEY, this._onScaleTextIconsChanged);
        this._signalManager.connect(global.settings, "changed::panel-edit-mode", this._onPanelEditModeChanged);
        this._signalManager.connect(global.settings, "changed::no-adjacent-panel-barriers", this._updatePanelBarriers);

    },

    /**
     * updatePosition:
     * @monitorIndex: integer, index of monitor
     * @bottomPosition, boolean, whether it should be placed at bottom
     *
     * Moves the panel to the monitor @monitorIndex and position @bottomPosition
     */
    updatePosition: function(monitorIndex, bottomPosition) {
        this.monitorIndex = monitorIndex
        this.bottomPosition = bottomPosition;

        this.monitor = global.screen.get_monitor_geometry(monitorIndex);
        this._moveResizePanel();
        this._context_menu = new PanelContextMenu(this, bottomPosition ? St.Side.BOTTOM: St.Side.TOP, this.panelId);
        this._menus.addMenu(this._context_menu);
        this._context_menu._boxPointer._container.connect('allocate', Lang.bind(this._context_menu._boxPointer, function(actor, box, flags){
                    this._xPosition = this._xpos;
                    this._shiftActor();
        }));

        if (this.bottomPosition)
            this.actor.set_style_class_name('panel-bottom')
        else
            this.actor.set_style_class_name('panel-top')
    },

    /**
     * destroy:
     *
     * Destroys the panel
     */
    destroy: function() {
        if (this._destroyed) return;

        AppletManager.unloadAppletsOnPanel(this);
        this._context_menu.close();
        this._context_menu.destroy();

        this._leftBox.destroy();
        this._centerBox.destroy();
        this._rightBox.destroy();

        this._rightCorner.actor.destroy();
        this._leftCorner.actor.destroy();

        this.actor.destroy();

        this._signalManager.disconnectAllSignals()

        this._menus = null;
        this.monitor = null;

        this._destroyed = true;
        return;
    },

    /**
     * highlight:
     * @highlight (boolean): whether to turn on or off
     *
     * Turns on/off the highlight of the panel
     */
    highlight: function(highlight) {
        this.actor.change_style_pseudo_class('highlight', highlight);
    },

    /**
     * isHideable:
     *
     * Returns: whether the panel can be hidden (auto-hide or intellihide)
     */
    isHideable: function() {
        return this._autohideSettings != "false";
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

    handleDragOver: function(source, actor, x, y, time) {
        this._enterPanel();
        if (this._dragShowId > 0)
            Mainloop.source_remove(this._dragShowId);

        let leaveIfOut = Lang.bind(this, function() {
            this._dragShowId = 0;
            let [x, y, whatever] = global.get_pointer();
            this.actor.sync_hover();
            if (this.actor.x < x && x < this.actor.x + this.actor.width &&
                this.actor.y < y && y < this.actor.y + this.actor.height) {
                return true;
            } else {
                this._leavePanel();
                return false;
            }
        });

        this._dragShowId = Mainloop.timeout_add(500, leaveIfOut);
        return DND.DragMotionResult.NO_DROP;
    },

    _updatePanelBarriers: function() {
        if (this._leftPanelBarrier)
            global.destroy_pointer_barrier(this._leftPanelBarrier);
        if (this._rightPanelBarrier)
            global.destroy_pointer_barrier(this._rightPanelBarrier);

        let noBarriers = global.settings.get_boolean("no-adjacent-panel-barriers");

        if (this.actor.height) {
            let panelTop = (this.bottomPosition ? this.monitor.y + this.monitor.height - this.actor.height : this.monitor.y);
            let panelBottom = (this.bottomPosition ? this.monitor.y + this.monitor.height : this.monitor.y + this.actor.height);

            if (!noBarriers) {
                this._rightPanelBarrier = global.create_pointer_barrier(
                    this.monitor.x + this.monitor.width - 1, panelTop,
                    this.monitor.x + this.monitor.width - 1, panelBottom,
                    4 /* BarrierNegativeX */);

                this._leftPanelBarrier = global.create_pointer_barrier(
                    this.monitor.x, panelTop,
                    this.monitor.x, panelBottom,
                    1 /* BarrierPositiveX */);
            } else {
                this._rightPanelBarrier = 0;
                this._leftPanelBarrier = 0;
            }
        } else {
            this._leftPanelBarrier = 0;
            this._rightPanelBarrier = 0;
        }
    },

    _onPanelEditModeChanged: function() {
        let old_mode = this._panelEditMode;

        this._panelEditMode = global.settings.get_boolean("panel-edit-mode");
        this._leftBox.change_style_pseudo_class('dnd', this._panelEditMode);
        this._centerBox.change_style_pseudo_class('dnd', this._panelEditMode);
        this._rightBox.change_style_pseudo_class('dnd', this._panelEditMode);

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

    _onFocusChanged: function() {
        if (global.display.focus_window &&
            this._focusWindow == global.display.focus_window.get_compositor_private())
            return;

        this._signalManager.disconnect("position-changed");
        this._signalManager.disconnect("size-changed");

        if (!global.display.focus_window)
            return;

        this._focusWindow = global.display.focus_window.get_compositor_private();
        this._signalManager.connect(this._focusWindow, "position-changed", this._updatePanelVisibility);
        this._signalManager.connect(this._focusWindow, "size-changed", this._updatePanelVisibility);
        this._updatePanelVisibility();
    },

    _processPanelAutoHide: function() {  
        this._autohideSettings = this._getProperty(PANEL_AUTOHIDE_KEY, "s");

        if (this._autohideSettings == "intel") {
            this._signalManager.connect(global.display, "notify::focus-window", this._onFocusChanged);
            /* focus-window signal is emitted when the workspace change
             * animation starts. When the animation ends, we do the position
             * check again because the windows have moved. We cannot use
             * _onFocusChanged because _onFocusChanged does nothing when there
             * is no actual focus change. */
            this._signalManager.connect(global.window_manager, "switch-workspace-complete", this._updatePanelVisibility);
            this._onFocusChanged();
        } else {
            this._signalManager.disconnect("notify::focus-window");
            this._signalManager.disconnect("switch-workspace-complete");
            this._signalManager.disconnect("position-changed");
            this._signalManager.disconnect("size-changed");
        }

        this._updatePanelVisibility();

        Main.layoutManager._chrome.modifyActorParams(this.actor, { affectsStruts: this._autohideSettings == "false" });
    },

    /**
     * _moveResizePanel:
     *
     * Function to update the panel position and size according to settings
     * values.
     */
    _moveResizePanel: function() {
        if (this._destroyed) return false;
        this.monitor = global.screen.get_monitor_geometry(this.monitorIndex);

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

        this.actor.set_size(this.monitor.width, panelHeight);
        this.actor.set_position(this.monitor.x, this.bottomPosition ? this.monitor.y + this.monitor.height - panelHeight : this.monitor.y);

        // AppletManager might not be initialized yet
        if (AppletManager.appletsLoaded)
            AppletManager.updateAppletPanelHeights();

        return true;
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

        let centerBoxOccupied = this._centerBox.get_n_children() > 0;

        /* If panel edit mode, pretend central box is occupied and give it at
         * least width 25 so that things can be dropped into it */
        if (this._panelEditMode) {
            centerBoxOccupied = true;
            centerMinWidth = Math.max(centerMinWidth, 25);
            centerNaturalWidth = Math.max(centerNaturalWidth, 25);
        }

        let [leftWidth, rightWidth] = calculateAllocation(
                leftMinWidth  , leftNaturalWidth,
                centerMinWidth, centerNaturalWidth,
                rightMinWidth , rightNaturalWidth,
                allocWidth, centerBoxOccupied);

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

        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = rightBoundary;
            childBox.x2 = leftBoundary;
        } else {
            childBox.x1 = leftBoundary;
            childBox.x2 = rightBoundary;
        }
        this._centerBox.allocate(childBox, flags);

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

        this._updatePanelBarriers();
    },

    /**
     * _updatePanelVisibility:
     *
     * Checks whether the panel should show based on the autohide settings and
     * position of mouse/active window. It then calls the _queueShowHidePanel
     * function to show or hide the panel as necessary.
     */
    _updatePanelVisibility: function() {
        // false = autohide, true = always show, intel = Intelligent
        switch (this._autohideSettings) {
        case "false":
            this._shouldShow = true;
            break;
        case "true":
            this._shouldShow = this._mouseEntered;
            break;
        default:
            if (this._mouseEntered || !global.display.focus_window ||
                global.display.focus_window.get_window_type() == Meta.WindowType.DESKTOP) {
                this._shouldShow = true;
                break;
            }

            if (global.display.focus_window.get_monitor() != this.monitorIndex) {
                this._shouldShow = false;
                break;
            }

            /* Calculate the y instead of getting the actor y since the
             * actor might be hidden*/
            let y = this.bottomPosition ?
                 this.monitor.y + this.monitor.height - this.actor.height :
                 this.monitor.y;

            let a = this.actor;
            let b = global.display.focus_window.get_compositor_private();
            /* Magic to check whether the panel position overlaps with the
             * current focused window */
            this._shouldShow =
                !(Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) &&
                  Math.max(y, b.y) < Math.min(y + a.height, b.y + b.height));
        }

        if (this._panelEditMode)
            this._shouldShow = true;

        this._queueShowHidePanel();
    },

    /**
     * _queueShowHidePanel:
     *
     * Makes the panel show or hide after a delay specified by
     * panels-show-delay and panels-hide-delay.
     */
    _queueShowHidePanel: function() {
        if (this._showHideTimer) {
            Mainloop.source_remove(this._showHideTimer);
            this._showHideTimer = 0;
        }

        /* Use a timeout_add even if delay is 0 to avoid "flashing" of panel.
         * Otherwise, if, say hideDelay is 0 and showDelay is 1000, when you
         * move over an applet, leave and enter events are fired consecutively.
         * Then the leave-event causes the panel hides instantly, causing a
         * further leave-event (since the mouse actually left the panel), which
         * clears the showPanel timer, and the panel won't show up again. If a
         * timeout_add is used for showDelay, the hide timeout will be cancelled
         * by the coming enter-event, and the panel remains open. */
        if (this._shouldShow) {
            let showDelay = this._getProperty(PANEL_SHOW_DELAY_KEY, "i");
            this._showHideTimer = Mainloop.timeout_add(showDelay, Lang.bind(this, this._showPanel))
        } else {
            let hideDelay = this._getProperty(PANEL_HIDE_DELAY_KEY, "i");
            this._showHideTimer = Mainloop.timeout_add(hideDelay, Lang.bind(this, this._hidePanel))
        }
    },
    
    _enterPanel: function() {
        this._mouseEntered = true;
        this._updatePanelVisibility();
    },

    _leavePanel:function() {
        this._mouseEntered = false;
        this._updatePanelVisibility();
    }, 

    /**
     * disable:
     *
     * Disables the panel by settings the opacity to 0 and hides if autohide is
     * enable. The actor is then hidden after the animation.
     */
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

    /**
     * enable:
     *
     * Reverses the effects of the disable function.
     */
    enable: function() {
        this._disabled = false;
        this.actor.show();
        Tweener.addTween(this.actor, {
            opacity: 255,
            time: AUTOHIDE_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });
    },

    /**
     * _showPanel:
     *
     * A function to force the panel to show. This has no effect if the panel
     * is disabled.
     */
    _showPanel: function() {
        this._showHideTimer = 0;

        if (this._disabled) return;

        if (!this._hidden) return;

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

        this._leftBox.show();
        this._centerBox.show();
        this._rightBox.show();

        Tweener.addTween(this.actor,
                        { y: y,
                        time: animationTime,
                        transition: 'easeOutQuad',
                        onUpdate: Lang.bind(this, function(origY, bottomPosition) {
                            // Force the layout manager to update the input region
                            Main.layoutManager._chrome.updateRegions()

                            let height = Math.abs(this.actor.y - origY);
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

    /**
     * _hidePanel:
     * @force (boolean): whether or not to force the hide.
     *
     * This hides the panel unless this._shouldShow is false. This behaviour is
     * overridden if the @force argument is set to true. However, the panel
     * will always not be hidden if a menu is open, regardless of the value of
     * @force.
     */
    _hidePanel: function(force) {
        this._showHideTimer = 0;

        if ((this._shouldShow && !force) || global.menuStackLength > 0) return;

        // Force the panel to be on top (hack to correct issues when switching workspace)
        Main.layoutManager._windowsRestacked();

        let height = this.actor.get_height();
        let animationTime = AUTOHIDE_ANIMATION_TIME;
        let y = this.bottomPosition ? this.monitor.y + this.monitor.height - 1 : this.monitor.y - height + 1;
        
        Tweener.addTween(this.actor, {
            y: y,
            time: animationTime,
            transition: 'easeOutQuad',
            onUpdate: Lang.bind(this, function(targetY, bottomPosition) {
                // Force the layout manager to update the input region
                Main.layoutManager._chrome.updateRegions()

                let height = Math.abs(this.actor.y - targetY) + 1;
                let y = bottomPosition ? 0 : this.actor.height - height;

                this.actor.set_clip(0, y, this.monitor.width, height);
            }),
            onComplete: Lang.bind(this, function() {
                this._leftBox.hide();
                this._centerBox.hide();
                this._rightBox.hide();
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
