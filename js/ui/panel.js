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
const Cinnamon = imports.gi.Cinnamon;  // Cinnamon C libraries using GObject Introspection
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Signals = imports.signals;

const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const DND = imports.ui.dnd;
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

const PANEL_PEEK_TIME = 1500;

const EDIT_MODE_MIN_BOX_SIZE = 25;
const VALID_ICON_SIZE_VALUES = [-1, 0, 16, 22, 24, 32, 48];

/*** These are defaults for a new panel added */
const DEFAULT_PANEL_VALUES = {"panels-autohide": "false",
                        "panels-show-delay": "0",
                        "panels-hide-delay": "0",
                        "panels-height": "40"};

const DEFAULT_FULLCOLOR_ICON_SIZE_VALUES = {"left":   0,
                                            "center": 0,
                                            "right":  0};

const DEFAULT_SYMBOLIC_ICON_SIZE_VALUES = {"left":   28,
                                           "center": 28,
                                           "right":  28};
const MIN_SYMBOLIC_SIZE_PX = 10;
const MAX_SYMBOLIC_SIZE_PX = 50;

const DEFAULT_TEXT_SIZE_VALUES = {"left":   0.0,
                                  "center": 0.0,
                                  "right":  0.0};
const MIN_TEXT_SIZE_PTS = 6.0;
const MAX_TEXT_SIZE_PTS = 16.0;
/*** Defaults ***/

const PANEL_AUTOHIDE_KEY = "panels-autohide";
const PANEL_SHOW_DELAY_KEY = "panels-show-delay";
const PANEL_HIDE_DELAY_KEY = "panels-hide-delay";
const PANEL_HEIGHT_KEY = "panels-height";
const PANEL_ZONE_ICON_SIZES = "panel-zone-icon-sizes";
const PANEL_ZONE_SYMBOLIC_ICON_SIZES = "panel-zone-symbolic-icon-sizes";
const PANEL_ZONE_TEXT_SIZES = "panel-zone-text-sizes";

const Direction = {
    LEFT  : 0,
    RIGHT : 1
};

const CornerType = {
    topleft : 0,
    topright : 1,
    bottomleft : 2,
    bottomright : 3,
    dummy : 4
};

var PanelLoc = {
    top : 0,
    bottom : 1,
    left : 2,
    right : 3
};

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
 * heightsUsedMonitor:
 * @monitorIndex (integer): index of monitor
 * @listofpanels (array): array of panels
 *
 * Retrieves the heights used in horizontal panels on the monitor to that
 * vertical panels can be sized and positioned not to overlap them
 *
 * Returns: a two element array
 */

function heightsUsedMonitor (monitorIndex, listofpanels) {
    let toppanelHeight = 0;
    let bottompanelHeight = 0;

    for (let i = 0, len = listofpanels.length; i < len; i++) {
        if (listofpanels[i]) {
            if (listofpanels[i].monitorIndex == monitorIndex) {
                if (listofpanels[i].panelPosition == PanelLoc.top)
                    toppanelHeight = listofpanels[i].actor.height;
                else if (listofpanels[i].panelPosition == PanelLoc.bottom)
                    bottompanelHeight = listofpanels[i].actor.height;
            }
        }
    }
    return [toppanelHeight, bottompanelHeight];
};

/**
* getPanelLocFromName:
* @pname (char): panel type
*
* get the panel numeric type from its name in settings
*
* returns - panel type (integer)
*/
function getPanelLocFromName (pname) {
    let jj = PanelLoc.bottom;  // ensure something credible always returned even if supplied invalid data
    switch (pname) {
        case "bottom":
            jj = PanelLoc.bottom;
            break;
        case "top":
            jj = PanelLoc.top;
            break;
        case "left":
            jj = PanelLoc.left;
            break;
        case "right":
            jj = PanelLoc.right;
            break;
    }
    return(jj);
};

/**
 * toStandardIconSize:
 * @maxSize (integer): the maximum size of the icon
 *
 * Calculates the nearest standard icon size up to a maximum.
 *
 * Returns: an integer, the icon size
 */
function toStandardIconSize(maxSize) {
    maxSize = Math.floor(maxSize);
    if (maxSize < 22) return 16;
    else if (maxSize < 24) return 22;
    else if (maxSize < 32) return 24;
    else if (maxSize < 48) return 32;
    // Panel icons reach 32 at most with the largest panel, also on hidpi
    return 48;
}

function setHeightForPanel(panel) {
    let height;

    // for vertical panels use the width instead of the height
    if (panel.panelPosition > 1) height = panel.actor.get_width();
    else height = panel.actor.get_height();

    if (height < 20) height = 40;

    return height;
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
        this.dummyPanels = [];
        this.panelCount = 0;
        this.panels = [];
        this.panelsMeta = [];   // Properties of panels in format [<monitor index>, <panelPosition>]
        this.canAdd = true;     // Whether there is space for more panels to be added

        let editMode = global.settings.get_boolean("panel-edit-mode");
        if (editMode == true)
            global.settings.set_boolean("panel-edit-mode", false);  // don't start up in edit mode, can loop with empty vertical panels

        this._fullPanelLoad();

        this._setMainPanel();

        this.addPanelMode = false;

        this._panelsEnabledId   = global.settings.connect("changed::panels-enabled", Lang.bind(this, this._onPanelsEnabledChanged));
        this._panelEditModeId   = global.settings.connect("changed::panel-edit-mode", Lang.bind(this, this._onPanelEditModeChanged));
        this._monitorsChangedId = global.screen.connect("monitors-changed", Lang.bind(this, this._onMonitorsChanged));

        this._addOsd  = new ModalDialog.InfoOSD(_("Select position of new panel. Esc to cancel."));
        this._moveOsd = new ModalDialog.InfoOSD(_("Select new position of panel. Esc to cancel."));
        this._addOsd.hide();
        this._moveOsd.hide();

        this._checkCanAdd();
        this._updateAllPointerBarriers();
    },

    /**
     * #_fullPanelLoad
     *
     * @short_description: Does a full load of all panels
     *
     * #_fullPanelLoad loads all panels in order, and makes any adjustments to permit vertical panels to fit snugly
     *                 between horizontal ones
     */
    _fullPanelLoad : function () {

        let monitor = 0;
        let stash = [];     // panel id, monitor, panel type

        let monitorCount = -1;
        let panels_used = []; // [monitor] [top, bottom, left, right].  Used to keep track of which panel types are in use,
                              // as we need knowledge of the combinations in order to instruct the correct panel to create a corner

        let panelProperties = global.settings.get_strv("panels-enabled");
        //
        // First pass through just to count the monitors, as there is no ordering to rely on
        //
        for (let i = 0, len = panelProperties.length; i < len; i++) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }

            monitor = parseInt(elements[1]);
            if (monitor > monitorCount)
                monitorCount = monitor;
        }
        //
        // initialise the array that records which panels are used (so combinations can be used to select corners)
        //
        for (let i = 0; i <= monitorCount; i++) {
            panels_used.push([]);
            panels_used[i][0] = false;
            panels_used[i][1] = false;
            panels_used[i][2] = false;
            panels_used[i][3] = false;
        }
        //
        // set up the list of panels
        //
        for (let i = 0, len = panelProperties.length; i < len; i++) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }
            let jj = getPanelLocFromName(elements[2]);  // panel orientation

            monitor = parseInt(elements[1]);

            panels_used[monitor][jj] = true;

            stash[i] = [parseInt(elements[0]),monitor,jj]; // load what we are going to use to call loadPanel into an array
        }

        //
        // When using mixed horizontal and vertical panels draw the vertical panels first.
        // This is done so that when using a box shadow on the panel to create a border the border will be drawn over the
        // top of the vertical panel.
        //
        // Draw corners where necessary.  NB no corners necessary where there is no panel for a full screen window to butt up against.
        // logic for loading up panels in the right order and drawing corners relies on ordering by monitor
        // Corners will go on the left and right panels if there are any, else on the top and bottom
        // corner drawing parameters passed are left, right for horizontals, top, bottom for verticals.
        //
        // panel corners are optional and not used in many themes. However there is no measurable gain in trying to suppress them
        // if the theme does not have them

        for (let i = 0; i <= monitorCount; i++) {
            let pleft, pright;
            for (let j = 0, len = stash.length; j < len; j++) {
                let drawcorner = [false,false];
                if (stash[j][2] == PanelLoc.left && stash[j][1] == i) {
                    pleft = this._loadPanel(stash[j][0], stash[j][1], stash[j][2], [true,true]);
                }
                if (stash[j][2] == PanelLoc.right && stash[j][1] == i) {
                    pright = this._loadPanel(stash[j][0], stash[j][1], stash[j][2], [true,true]);
                }
                if (stash[j][2] == PanelLoc.bottom && stash[j][1] == i) {
                    drawcorner[0] = !(panels_used[i][2]);
                    drawcorner[1] = !(panels_used[i][3]);
                    this._loadPanel(stash[j][0], stash[j][1], stash[j][2], drawcorner);
                }
                if (stash[j][2] == PanelLoc.top && stash[j][1] == i) {
                    drawcorner[0] = !(panels_used[i][2]);
                    drawcorner[1] = !(panels_used[i][3]);
                    this._loadPanel(stash[j][0], stash[j][1], stash[j][2], drawcorner);
                }
            }
            //
            // if called in init, the calls in moveResizePanel that happen when panels are created will not
            // have found the heights available for vertical panels between horizontal panels, so calculate them now.
            //
            if (pleft || pright) {
                let toppheight;
                let botpheight;
                [toppheight,botpheight] = heightsUsedMonitor(i, this.panels);
                if (pleft) {
                    pleft.toppanelHeight = toppheight;
                    pleft.bottompanelHeight = botpheight;;
                }
                if (pright) {
                    pright.toppanelHeight = toppheight;
                    pright.bottompanelHeight = botpheight;
                }
            }
        }
        //
        // At this point all the panels are shown, so work through them and adjust
        // vertical panel heights so as to fit snugly between horizontal panels
        //
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (this.panels[i])
                if (this.panels[i].panelPosition == PanelLoc.left || this.panels[i].panelPosition == PanelLoc.right)
                    this.panels[i]._moveResizePanel();
        }
    },

   /**
     * disablePanels:
     *
     * Disables (hide and lock) all panels
     */
    disablePanels: function() {
        for (let i = 0, len = this.panels.length; i < len; i++) {
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
        for (let i = 0, len = this.panels.length; i < len; i++) {
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
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (this.panels[i])
                this.panels[i].actor.opacity = opacity;
        }
    },

    /**
     * lowerActorBelowPanels:
     * @actor (ClutterActor): actor to stack below the panels
     *
     * Lowers actor to just under the panel actors
     */
    lowerActorBelowPanels: function(actor, group) {
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (!this.panels[i])
                continue;
            Main.uiGroup.set_child_below_sibling(actor, this.panels[i].actor);
            break;
        }

        let prev = actor.get_previous_sibling();

        while (true) {
            if (prev && prev._delegate && prev._delegate instanceof Panel) {
                Main.uiGroup.set_child_below_sibling(actor, prev);
                prev = actor.get_previous_sibling();
                continue;
            } else
                break;
        }
    },

    /**
     * removePanel:
     * @panelId (int): Panel id of the panel to be removed
     *
     * Remove the panel from the list panels-enabled
     */
    removePanel: function(panelId) {
        this.panelCount -= 1;
        let list = global.settings.get_strv("panels-enabled");
        for (let i = 0, len = list.length; i < len; i++) {
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
     * @panelPosition (integer): where the panel is added
     *
     * Adds a new panel to the specified position
     */
    addPanel: function(monitorIndex, panelPosition) {
        let list = global.settings.get_strv("panels-enabled");
        let i = 0; // Start counting at 1 for compatibility

        // Magic: Keep recursing until there is a free panel id
        while (true)
            if (!this.panelsMeta[++i])
                break;

        // Add default values
        outerLoop:
        for (let key in DEFAULT_PANEL_VALUES) {
            let settings = global.settings.get_strv(key);
            for (let j = 0; j < settings.length; j++){
                if (settings[j].split(":")[0] == i){
                    continue outerLoop;
                }
            }
            settings.push(i + ":" + DEFAULT_PANEL_VALUES[key]);
            global.settings.set_strv(key, settings);
        }

        switch (panelPosition)
        {
            case PanelLoc.top:
                list.push(i + ":" + monitorIndex + ":" + "top");
                break;
            case PanelLoc.bottom:
                list.push(i + ":" + monitorIndex + ":" + "bottom");
                break;
            case PanelLoc.left:
                list.push(i + ":" + monitorIndex + ":" + "left");
                break;
            case PanelLoc.right:
                list.push(i + ":" + monitorIndex + ":" + "right");
                break;
            default:
                global.log("addPanel - unrecognised panel position "+panelPosition);
        }
        global.settings.set_strv("panels-enabled", list);

        // Delete all panel dummies
        if (this.addPanelMode)
            this._destroyDummyPanels();
    },

    /**
     * movePanel:
     * @monitorIndex (integer): monitor to be added to
     * @panelPosition (integer): where the panel is added
     *
     * Moves the panel of id this.moveId to the specified position
     */
    movePanel: function(monitorIndex, panelPosition) {
        let list = global.settings.get_strv("panels-enabled");
        let i = -1;

        for (let i = 0, len = list.length; i < len; i++) {
            if (list[i].split(":")[0] == this.moveId) {
                switch (panelPosition)
                {
                    case PanelLoc.top:
                        list[i] = this.moveId + ":" + monitorIndex + ":" + "top";
                        break;
                    case PanelLoc.bottom:
                        list[i] = this.moveId + ":" + monitorIndex + ":" + "bottom";
                        break;
                    case PanelLoc.left:
                        list[i] = this.moveId + ":" + monitorIndex + ":" + "left";
                        break;
                    case PanelLoc.right:
                        list[i] = this.moveId + ":" + monitorIndex + ":" + "right";
                        break;
                    default:
                    global.log("movePanel - unrecognised panel position "+panelPosition);
                }
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
        for (let i = 0, len = this.dummyPanels.length; i < len; i++) {
            let removedDummyPanelIndexes = [];
            for (let j = 0, len = this.dummyPanels[i].length; j < len; j++) {
                if (this.dummyPanels[i][j]) {
                    this.dummyPanels[i][j].destroy();
                    removedDummyPanelIndexes.push(j);
                }
            }
            for (let z = 0; z < removedDummyPanelIndexes.length; z++) {
                this.dummyPanels[i][removedDummyPanelIndexes[z]] = undefined;
                this.dummyPanels[i].splice(removedDummyPanelIndexes[z], 1);
            }
        }
        this.addPanelMode = false;
        this._addOsd.hide();
        this._moveOsd.hide();
        if (Main.keybindingManager.bindings['close-add-panel'])
            Main.keybindingManager.removeHotKey('close-add-panel');
    },

    /**
     * getPanelsInMonitor:
     * @monitorIndex (integer): index of monitor
     *
     * Retrieves all the panels in the monitor of index @monitorIndex
     *
     * Returns: an array of panels
     */
    getPanelsInMonitor: function(monitorIndex) {
        let returnValue = [];
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (this.panels[i] && this.panels[i].monitorIndex == monitorIndex)
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
     * @panelPosition (integer): where the panel is added
     *
     * Gets a specific panel in monitor @monitorIndex
     *
     * Returns: the panel required (null if panel not found)
     */
    getPanel: function(monitorIndex, panelPosition) {
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (!this.panels[i])
                continue;
            if (this.panels[i].monitorIndex == monitorIndex && this.panels[i].panelPosition == panelPosition)
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
        for (let i = 0, len = this.panels.length; i < len; i++) {
             if (!this.panels[i])
                 continue;
             this.panels[i]._updatePanelVisibility();
        }
    },

    /**
     * _loadPanel:
     * @ID (integer): panel id
     * @monitorIndex (integer): index of monitor of panel
     * @panelPosition (integer): where the panel should be
     * @drawcorner (array): whether to draw corners for [left, right]
     * @panelList (array): (optional) the list in which the new panel should be appended to (not necessarily this.panels, c.f. _onPanelsEnabledChanged) Default: this.panels
     * @metaList(array): (optional) the list in which the new panel metadata should be appended to (not necessarily this.panelsMeta, c.f. _onPanelsEnabledChanged)
     *                   Default: this.panelsMeta
     *
     * Loads a panel with the given properties and appends it to @panelList. @panelList is usually this.panels but is a different array when used by _onPanelsEnabledChanged.
     *
     * Returns (Panel.Panel): Panel created
     */
    _loadPanel: function(ID, monitorIndex, panelPosition, drawcorner, panelList, metaList) {

        if (!panelList) panelList = this.panels;
        if (!metaList) metaList = this.panelsMeta;

        if (panelList[ID]) {
            global.log("Multiple panels with same ID (" + ID + ") are found");
            return null;
        }

        panelList.length = Math.max(panelList.length, ID + 1);
        metaList.length = panelList.length;

        let repeat = false;
        for (let i = 0, len = metaList.length; i < len; i++) {
            if (!metaList[i]) {
                continue;
            }
            if ((metaList[i][0] == monitorIndex) && (metaList[i][1] == panelPosition) && i != ID) {
                switch (panelPosition)
                {
                    case PanelLoc.top:
                        global.log("Conflicting panel definitions: " + ID + ":" + monitorIndex + ":" + "top" );
                        break;
                    case PanelLoc.bottom:
                        global.log("Conflicting panel definitions: " + ID + ":" + monitorIndex + ":" + "bottom" );
                    break;
                    case PanelLoc.left:
                        global.log("Conflicting panel definitions: " + ID + ":" + monitorIndex + ":" + "left" );
                    break;
                    case PanelLoc.right:
                        global.log("Conflicting panel definitions: " + ID + ":" + monitorIndex + ":" + "right" );
                    break;
                    default:
                    global.log("loadPanel - unrecognised panel position "+panelPosition);
                }
                repeat = true;
                break;
            }
        }

        if (repeat) return null;

        metaList[ID] = [monitorIndex, panelPosition];  // Note:  metaList [i][0] is the monitor index, metaList [i][1] is the panelPosition

        if (monitorIndex < 0 || monitorIndex >= global.screen.get_n_monitors()) {
            global.log("Monitor " + monitorIndex + " not found. Not creating panel");
            return null;
        }
        let[toppheight,botpheight] = heightsUsedMonitor(monitorIndex, panelList);
        panelList[ID] = new Panel(ID, monitorIndex, panelPosition, toppheight, botpheight, drawcorner); // create a new panel
        this.panelCount += 1;

        return panelList[ID];
    },

    _checkCanAdd: function() {
        let monitorCount = global.screen.get_n_monitors();
        let panelCount = (monitorCount * 4) - this.panelCount;          // max of 4 panels on a monitor, one per edge

        this.canAdd = panelCount > 0;
    },

    _updateAllPointerBarriers: function() {
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (this.panels[i]) {
                this.panels[i]._updatePanelBarriers();
            }
        }
    },

    /**
     * _onPanelsEnabledChanged:
     *
     * This will be called whenever the panels-enabled settings key is changed
     * i.e. when panels are added, moved or removed.
     */
    _onPanelsEnabledChanged: function() {
        let newPanels = new Array(this.panels.length);
        let newMeta = new Array(this.panels.length);
        let drawcorner = [false,false];

        let panelProperties = global.settings.get_strv("panels-enabled");

        for (let i = 0; i < panelProperties.length; i ++) {

            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }

            let ID   = parseInt(elements[0]);       // each panel is stored as ID:monitor:panelposition
            let mon  = parseInt(elements[1]);
            let ploc = getPanelLocFromName(elements[2]);

            if (this.panels[ID]) {                  // If (existing) panel is moved

                newMeta[ID] = [mon, ploc];          //Note: meta [i][0] is the monitor  meta [i][1] is the panelposition

                newPanels[ID] = this.panels[ID];                       // Move panel object to newPanels
                this.panels[ID] = null;                                // avoids triggering the destroy logic that follows
                delete this.panels[ID];

                if (newMeta[ID][0] != this.panelsMeta[ID][0]           // monitor changed
                    ||
                    newMeta[ID][1] != this.panelsMeta[ID][1]) {        // or panel position changed

                    newPanels[ID].updatePosition(newMeta[ID][0], newMeta[ID][1]);

                    AppletManager.updateAppletsOnPanel(newPanels[ID]); // Asymmetrical applets such as panel launchers, systray etc.
                                                                       // need reorienting within the applet using their
                                                                         // on_orientation_changed function
                }
            } else {                                                       // new panel

                let panel = this._loadPanel(ID,
                                            mon,
                                            ploc,
                                            drawcorner,
                                            newPanels,
                                            newMeta);
                if (panel)
                     AppletManager.loadAppletsOnPanel(panel);
            }
        }

        // Destroy removed panels
        let removedPanelIndexes = [];
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (this.panels[i]) {
                this.panels[i].destroy();
                removedPanelIndexes.push(i);
            }
        }
        for (let i = 0, len = removedPanelIndexes.length; i < len; i++) {
            this.panels[i] = undefined;
            this.panels.splice(removedPanelIndexes[i], 1);
        }

        this.panels = newPanels;
        this.panelsMeta = newMeta;
        //
        // Adjust any vertical panel heights so as to fit snugly between horizontal panels
        // Scope for minor optimisation here, doesn't need to adjust verticals if no horizontals added or removed
        // or if any change from making space for panel dummys needs to be reflected.
        //
        // Draw any corners that are necessary.  Note that updatePosition will have stripped off corners
        // from moved panels, and the new panel is created without corners.  However unchanged panels may have corners
        // that might not be wanted now.  Easiest thing is to strip every existing corner off and re-add
        //
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (this.panels[i]) {
                if (this.panels[i].panelPosition == PanelLoc.left || this.panels[i].panelPosition == PanelLoc.right)
                    this.panels[i]._moveResizePanel();
                this.panels[i]._destroycorners();
            }
        }
        this._fullCornerLoad(panelProperties);

        this._setMainPanel();
        this._checkCanAdd();
        this._updateAllPointerBarriers();

        // If the user removed the last panel, pop up a dialog to ask if they want to open panel settings
        if (panelProperties.length == 0) {
            let lastPanelRemovedDialog = new ModalDialog.ConfirmDialog(
                _("You don't have any panels added.\nDo you want to open panel settings?"),
                Lang.bind(this, function() { Util.spawnCommandLine("cinnamon-settings panel"); }));
            lastPanelRemovedDialog.open();
        }
    },

    /**
     * _fullCornerLoad :
     * @panelProperties : panels-enabled settings string
     *
     * Load all corners
     */
    _fullCornerLoad: function(panelProperties) {
        let monitor = 0;
        let monitorCount = -1;
        let panels_used = []; // [monitor] [top, bottom, left, right].  Used to keep track of which panel types are in use,
                              // as we need knowledge of the combinations in order to instruct the correct panel to create a corner
        let stash = [];       // panel id, monitor, panel type

        //
        // First pass through just to count the monitors, as there is no ordering to rely on
        //
        for (let i = 0, len = panelProperties.length; i < len; i++) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }

            monitor = parseInt(elements[1]);
            if (monitor > monitorCount)
                monitorCount = monitor;
        }
        //
        // initialise the array that records which panels are used (so combinations can be used to select corners)
        //
        for (let i = 0; i <= monitorCount; i++) {
            panels_used.push([]);
            panels_used[i][0] = false;
            panels_used[i][1] = false;
            panels_used[i][2] = false;
            panels_used[i][3] = false;
        }
        //
        // set up the list of panels
        //
        for (let i = 0, len = panelProperties.length; i < len; i++) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }
            let monitor = parseInt(elements[1]);
            let jj = getPanelLocFromName(elements[2]);
            panels_used[monitor][jj] =  true;

            stash[i] = [parseInt(elements[0]),monitor,jj];
        }

        // draw corners on each monitor in turn.  Note that the panel.drawcorner
        // variable needs to be set so the allocation code runs as desired

        for (let i = 0; i <= monitorCount; i++) {
            for (let j = 0, len = stash.length; j < len; j++) {
                let drawcorner = [false, false];
                if (stash[j][2] == PanelLoc.bottom && stash[j][1] == i) {
                    drawcorner[0] = !(panels_used[i][2]);
                    drawcorner[1] = !(panels_used[i][3]);
                    if (this.panels[stash[j][0]]) {  // panel will not have loaded if previous monitor disconnected etc.
                        this.panels[stash[j][0]].drawcorner = drawcorner;
                        this.panels[stash[j][0]].drawCorners(drawcorner);
                    }
                }
                if (stash[j][2] == PanelLoc.left && stash[j][1] == i) {
                    if (this.panels[stash[j][0]]) {
                        this.panels[stash[j][0]].drawcorner = [true,true];
                        this.panels[stash[j][0]].drawCorners([true,true]);
                    }
                }
                if (stash[j][2] == PanelLoc.right && stash[j][1] == i) {
                    if (this.panels[stash[j][0]]) {
                        this.panels[stash[j][0]].drawcorner = [true,true];
                        this.panels[stash[j][0]].drawCorners([true,true]);
                    }
                }
                if (stash[j][2] == PanelLoc.top && stash[j][1] == i) {
                    drawcorner[0] = !(panels_used[i][2]);
                    drawcorner[1] = !(panels_used[i][3]);
                    if (this.panels[stash[j][0]]) {
                        this.panels[stash[j][0]].drawcorner = drawcorner;
                        this.panels[stash[j][0]].drawCorners(drawcorner);
                    }
                }
            }
        }
    },

    _onMonitorsChanged: function() {
        let monitorCount = global.screen.get_n_monitors();
        let drawcorner = [false, false];

        for (let i = 0, len = this.panelsMeta.length; i < len; i++) {
            if (!this.panelsMeta[i]) {
                continue;
            }
            if (!this.panels[i]) { // If there is a meta but not a panel, i.e. panel could not create due to non-existent monitor, try again
                                                         // - the monitor may just have been reconnected
                if (this.panelsMeta[i][0] < monitorCount)  // just check that the monitor is there
                {
                    let panel = this._loadPanel(i, this.panelsMeta[i][0], this.panelsMeta[i][1], drawcorner);
                    if (panel)
                        AppletManager.loadAppletsOnPanel(panel);
                }
            } else if (this.panelsMeta[i][0] >= monitorCount) { // Monitor of the panel went missing.  Meta is [monitor,panel] array
                if (this.panels[i]) {
                    this.panels[i].destroy(false); // destroy panel, but don't remove icon size settings
                    delete this.panels[i];
                    this.panelCount -= 1;
                }

            } else { // Nothing happens. Re-allocate panel
                this.panels[i]._monitorsChanged = true;
                this.panels[i]._moveResizePanel();
            }
        }

        if (this.addPanelMode) {
            this._destroyDummyPanels();
            this._showDummyPanels(this.dummyCallback);
        }

        // clear corners, then re add them
        for (let i = 0, len = this.panels.length; i < len; i++) {
            if (this.panels[i])
                this.panels[i]._destroycorners();
        }
        let panelProperties = global.settings.get_strv("panels-enabled");
        this._fullCornerLoad(panelProperties);

        this._setMainPanel();
        this._checkCanAdd();
        this._updateAllPointerBarriers();
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

    /**
     * _showDummyPanels:
     * @callback (): callback
     *
     * shows the dummy panels
     */
    _showDummyPanels: function(callback) {
        let monitorCount = global.screen.get_n_monitors();
        this.dummyCallback = callback;
        this.dummyPanels = [];

        while (this.dummyPanels.push([true, true, true, true]) < monitorCount); // 4 possible panels per monitor

        for (let i = 0, len = this.panelsMeta.length; i < len; i++) {
            if (!this.panelsMeta[i]) {
                continue;
            }
            if (this.panelsMeta[i][0] >= monitorCount) // Monitor does not exist
                continue;
            // there is an existing panel showing
            this.dummyPanels[this.panelsMeta[i][0]][this.panelsMeta[i][1]] = false;
        }

        for (let i = 0; i < monitorCount; i++) {
            for (let j = 0; j < 4; j++) {
                if (this.dummyPanels[i] && this.dummyPanels[i][j] == true) { // no panel there at the moment, so show a dummy
                    this.dummyPanels[i][j] = new PanelDummy(i, j, callback);
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
    },

    resetPanelDND: function() {
        for (let i = 0; i < this.panels.length; i++) {
            if (this.panels[i]) {
                this.panels[i].resetDNDZones();
            }
        }
    }

};  // end of panel manager

/**
 * #PanelDummy
 * @short_description: Dummy panels for users to select new position of panel
 *
 * #PanelDummy creates some boxes at possible panel locations for users to
 * select where to place their new panels
 */
function PanelDummy(monitorIndex, panelPosition, callback) {
    this._init(monitorIndex, panelPosition, callback);
}

PanelDummy.prototype = {
    _init: function(monitorIndex, panelPosition, callback) {
        this.monitorIndex = monitorIndex;
        this.panelPosition = panelPosition;
        this.callback = callback;
        this.monitor = global.screen.get_monitor_geometry(monitorIndex);
        let defaultheight = 40 * global.ui_scale;

        this.actor = new Cinnamon.GenericContainer({style_class: "panel-dummy", reactive: true, track_hover: true, important: true});

        Main.layoutManager.addChrome(this.actor, { addToWindowgroup: false });
        //
        // layouts set to be full width horizontal panels, and vertical panels set to use as much available space as is left
        //
        let tpanelHeight = 0;
        let bpanelHeight = 0;

        if (Main.panelManager) {
            [tpanelHeight, bpanelHeight] = heightsUsedMonitor(this.monitorIndex, Main.panelManager.panels);
        } else {
            tpanelHeight = defaultheight;
            bpanelHeight = defaultheight;
        }

        switch (panelPosition) {
            case PanelLoc.top:
                this.actor.set_size(this.monitor.width, defaultheight);
                this.actor.set_position(this.monitor.x,  this.monitor.y);
                break;
            case PanelLoc.bottom:
                this.actor.set_size(this.monitor.width, defaultheight);
                this.actor.set_position(this.monitor.x, this.monitor.y + this.monitor.height - defaultheight);
                break;
            case PanelLoc.left:
                this.actor.set_size( defaultheight,this.monitor.height - tpanelHeight - bpanelHeight);
                this.actor.set_position(this.monitor.x,  this.monitor.y + tpanelHeight);
                break;
            case PanelLoc.right:
                this.actor.set_size( defaultheight,this.monitor.height - tpanelHeight - bpanelHeight);
                this.actor.set_position(this.monitor.x + this.monitor.width - defaultheight, this.monitor.y + tpanelHeight);
                break;
            default:
                global.log("paneDummy - unrecognised panel position "+panelPosition);
        }

        this.actor.connect('button-press-event', Lang.bind(this, this._onClicked));
        this.actor.connect('enter-event', Lang.bind(this, this._onEnter));
        this.actor.connect('leave-event', Lang.bind(this, this._onLeave));
    },

    _onClicked: function() {
        this.callback(this.monitorIndex, this.panelPosition);
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
/* FIXME:  Find out if this TextShadower functionality below is actually used */

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
    /**
     * PanelCorner:
     * @box: the box in a panel the corner is associated with
     * @side: the side of the box a text or icon/text applet starts from (RTL or LTR driven)
     * @cornertype:  top left, bottom right etc.
     *
     * Sets up a panel corner
     *
     * The panel corners are there for a non-obvious reason.  They are used as the positioning points for small
     * drawing areas that use some optional css to draw small filled arcs (in the repaint function).  This allows
     * windows with rounded corners to be blended into the panels in some distros, gnome shell in particular.
     * In mint tiling and full screen removes any rounded window corners anyway, so this optional css is not there in
     * the main mint themes, and the corner/cairo functionality is unused in this case. Where the corners are used they will be
     * positioned so as to fill in the tiny gap at the corners of full screen windows, and if themed right they
     * will be invisble to the user, other than the window will appear to go right up to the corner when full screen
     */
function PanelCorner(box, side, cornertype) {
    this._init(box, side, cornertype);
}

PanelCorner.prototype = {
    _init: function(box, side, cornertype) {
        this._side = side;
        this._box = box;
        this._cornertype = cornertype;
        this.cornerRadius = 0;

        this.actor = new St.DrawingArea({ style_class: 'panel-corner' });

        this.actor.connect('style-changed', Lang.bind(this, this._styleChanged));
        this.actor.connect('repaint', Lang.bind(this, this._repaint));
    },

    _repaint: function() {
    //
    // This is all about painting corners just outside the panels so as to create a seamless visual impression for full screen windows
    // with curved corners that butt up against a panel.
    // So ... top left corner wants to be at the bottom left of the top panel. top right wants to be in the corresponding place on the right
    // Bottom left corner wants to be at the top left of the bottom panel.  bottom right in the corresponding place on the right.
    // No panel, no corner necessary.
    // If there are vertical panels as well then we want to shift these in by the panel width so if there are vertical panels but no horizontal
    // then the corners are top right and left to right of left panel, and same to left of right panel
    //
        if (this._cornertype == CornerType.dummy) return;

        let node = this.actor.get_theme_node();

        if (node) {
            let xOffsetDirection = 0;
            let yOffsetDirection = 0;

            let cornerRadius = node.get_length("-panel-corner-radius");
            let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');
            let outerBorderWidth = node.get_length('-panel-corner-outer-border-width');

            let backgroundColor = node.get_color('-panel-corner-background-color');
            let innerBorderColor = node.get_color('-panel-corner-inner-border-color');
            let outerBorderColor = node.get_color('-panel-corner-outer-border-color');

            // Save suitable offset directions for later use

            xOffsetDirection = (this._cornertype == CornerType.topleft || this._cornertype == CornerType.bottomleft)
                        ? -1 :  1;

            yOffsetDirection = (this._cornertype == CornerType.topleft || this._cornertype == CornerType.topright)
                        ? -1 : 1;

            let cr = this.actor.get_context();
            cr.setOperator(Cairo.Operator.SOURCE);
            cr.save();

            // Draw arc, lines and fill to create a concave triangle

            if (this._cornertype == CornerType.topleft) {
                cr.moveTo(0, 0);
                cr.arc( cornerRadius,
                        innerBorderWidth + cornerRadius,
                        cornerRadius,
                        Math.PI,
                        3 * Math.PI / 2);  //xc, yc, radius, angle from, angle to.  NB note small offset in y direction
                cr.lineTo(cornerRadius, 0);
            } else if (this._cornertype == CornerType.topright) {
                cr.moveTo(0, 0);
                cr.arc( 0,
                        innerBorderWidth + cornerRadius,
                        cornerRadius,
                        3 * Math.PI / 2,
                        2 * Math.PI);
                cr.lineTo(cornerRadius, 0);
            } else if (this._cornertype == CornerType.bottomleft) {
                cr.moveTo(0, cornerRadius);
                cr.lineTo(cornerRadius,cornerRadius);
                cr.lineTo(cornerRadius, cornerRadius-innerBorderWidth);
                cr.arc( cornerRadius,
                        -innerBorderWidth,
                        cornerRadius,
                        Math.PI/2,
                        Math.PI);
                cr.lineTo(0,cornerRadius);
            } else if (this._cornertype == CornerType.bottomright) {
                cr.moveTo(0,cornerRadius);
                cr.lineTo(cornerRadius, cornerRadius);
                cr.lineTo(cornerRadius, 0);
                cr.arc( 0,
                        -innerBorderWidth,
                        cornerRadius,
                        0,
                        Math.PI/2);
                cr.lineTo(0, cornerRadius);
            }

            cr.closePath();

            let savedPath = cr.copyPath();                   // save basic shape for reuse

            let over = _over(innerBorderColor,
                             _over(outerBorderColor, backgroundColor));  // colour inner over outer over background.
            Clutter.cairo_set_source_color(cr, over);
            cr.fill();

            over = _over(innerBorderColor, backgroundColor);             //colour inner over background
            Clutter.cairo_set_source_color(cr, over);

            // Draw basic shape with vertex shifted diagonally outwards by the border width

            let offset = outerBorderWidth;
            cr.translate(xOffsetDirection * offset, yOffsetDirection * offset);  // move by x,y
            cr.appendPath(savedPath);
            cr.fill();

            // Draw a small rectangle over the end of the arc on the inwards side
            // why ?  pre-existing code, reason for creating this squared off end to the shape is not clear.

            if (this._cornertype == CornerType.topleft)
                cr.rectangle(cornerRadius - offset,
                             0,
                             offset,
                             outerBorderWidth);  // x,y,width,height
            else if (this._cornertype == CornerType.topright)
                cr.rectangle(0,
                             0,
                             offset,
                             outerBorderWidth);
            else if (this._cornertype == CornerType.bottomleft)
                cr.rectangle(cornerRadius - offset,
                             cornerRadius - offset,
                             offset,
                             outerBorderWidth);
            else if (this._cornertype.bottomright)
                cr.rectangle(0,
                             cornerRadius - offset,
                             offset,
                             outerBorderWidth);
            cr.fill();
            offset = innerBorderWidth;
            Clutter.cairo_set_source_color(cr, backgroundColor);  // colour background

            // Draw basic shape with vertex shifted diagonally outwards by the border width, in background colour

            cr.translate(xOffsetDirection * offset, yOffsetDirection * offset);
            cr.appendPath(savedPath);
            cr.fill();
            cr.restore();

            cr.$dispose();

            // Trim things down to a neat and tidy box

            this.actor.set_clip(0,0,cornerRadius,cornerRadius);
        }
    },

    _styleChanged: function() {
        let node = this.actor.get_theme_node();

        let cornerRadius = node.get_length("-panel-corner-radius");
        let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');

        this.actor.set_size(cornerRadius, cornerRadius);
        this.actor.set_anchor_point(0, 0);

        // since the corners are a child actor of the panel, we need to account
        // for their size when setting the panel clip region. we keep track here
        // so the panel can easily check it.
        this.cornerRadius = cornerRadius;

        if (this._box.is_finalized()) return;
        // ugly hack: force the panel to reset its clip region since we just added
        // to the total allocation after it has already clipped to its own
        // allocation
        let panel = this._box.get_parent();
        // for some reason style-changed is called on destroy
        if (panel && panel._delegate)
            panel._delegate._setClipRegion(panel._delegate._hidden);
    }
}; // end of panel corner

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

function PanelContextMenu(launcher, orientation, panelId) {
    this._init(launcher, orientation, panelId);
}

PanelContextMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(launcher, orientation, panelId) {
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, orientation);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        this.panelId = panelId;

        let moreSettingsMenuItem = new SettingsLauncher(_("Panel settings"), "panel " + panelId, "emblem-system");
        this.addMenuItem(moreSettingsMenuItem);

        let applet_settings_item = new SettingsLauncher(_("Applets"), "applets panel" + panelId, "application-x-addon");
        this.addMenuItem(applet_settings_item);

        let menu = this;

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // separator line

        // Panel Edit mode
        let editMode = global.settings.get_boolean("panel-edit-mode");
        let panelEditMode = new PopupMenu.PopupSwitchMenuItem(_("Panel edit mode"), editMode);
        panelEditMode.connect('toggled', function(item) {
            global.settings.set_boolean("panel-edit-mode", item.state);
        });
        menu.addMenuItem(panelEditMode);        // menu item for panel edit mode
        global.settings.connect('changed::panel-edit-mode', function() {
            panelEditMode.setToggleState(global.settings.get_boolean("panel-edit-mode"));
        });


        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // separator line

        menu.movePanelItem = new PopupMenu.PopupIconMenuItem(_("Move"), "move", St.IconType.SYMBOLIC); // submenu item move panel
        menu.movePanelItem.activate = Lang.bind(menu, function() {
            Main.panelManager.movePanelQuery(this.panelId);
            this.close(true);
        });
        menu.addMenuItem(menu.movePanelItem);

        let menuItem = new PopupMenu.PopupIconMenuItem(_("Remove"), "list-remove", St.IconType.SYMBOLIC);  // submenu item remove panel
        menuItem.activate = Lang.bind(menu, function() {
            let confirm = new ModalDialog.ConfirmDialog(_("Are you sure you want to remove this panel?"),
                    function() {
                        Main.panelManager.removePanel(panelId);
                    });
            confirm.open();
        });
        menu.addMenuItem(menuItem);

        menu.addPanelItem = new PopupMenu.PopupIconMenuItem(_("Add a new panel"), "list-add", St.IconType.SYMBOLIC); // submenu item add panel
        menu.addPanelItem.activate = Lang.bind(menu, function() {
            Main.panelManager.addPanelQuery();
            this.close(true);
        });
        menu.addMenuItem(menu.addPanelItem);

        // menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // separator line


        // menu.copyAppletItem = new PopupMenu.PopupIconMenuItem(_("Copy applets"), "edit-copy", St.IconType.SYMBOLIC);
        // menu.copyAppletItem.activate = Lang.bind(menu, function() {
        //     AppletManager.copyAppletConfiguration(this.panelId);
        //     this.close(true);
        // });
        // menu.addMenuItem(menu.copyAppletItem);  // submenu item copy applet config

        // menu.pasteAppletItem = new PopupMenu.PopupIconMenuItem(_("Paste applets"), "edit-paste", St.IconType.SYMBOLIC);
        // menu.pasteAppletItem.activate = Lang.bind(menu, function() {
        //     let dialog = new ModalDialog.ConfirmDialog(
        //             _("Pasting applet configuration will remove all existing applets on this panel. Do you want to continue?") + "\n\n",
        //             Lang.bind(this, function() {
        //                 AppletManager.pasteAppletConfiguration(this.panelId);
        //             }));
        //     dialog.open();
        // });
        // menu.addMenuItem(menu.pasteAppletItem); // submenu item paste applet config

        // menu.clearAppletItem = new PopupMenu.PopupIconMenuItem(_("Clear all applets"), "edit-clear-all", St.IconType.SYMBOLIC);
        // menu.clearAppletItem.activate = Lang.bind(menu, function() {
        //     let dialog = new ModalDialog.ConfirmDialog(
        //             _("Are you sure you want to clear all applets on this panel?") + "\n\n",
        //             Lang.bind(this, function() {
        //                 AppletManager.clearAppletConfiguration(this.panelId);
        //             }));
        //     dialog.open();
        // });

        // menu.addMenuItem(menu.clearAppletItem);  // submenu item clear all applets

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // separator line

        menu.troubleshootItem = new PopupMenu.PopupSubMenuMenuItem(_("Troubleshoot"));
        menu.troubleshootItem.menu.addAction(_("Restart Cinnamon"), function(event) {
            global.reexec_self();
        });

        menu.troubleshootItem.menu.addAction(_("Looking Glass"), function(event) {
            Main.createLookingGlass().open();
        });

        menu.troubleshootItem.menu.addAction(_("Restore all settings to default"), function(event) {
            let confirm = new ModalDialog.ConfirmDialog(_("Are you sure you want to restore all settings to default?\n\n"),
                    function() {
                        Util.spawnCommandLine("gsettings reset-recursively org.cinnamon");
                        global.reexec_self();
                    });
            confirm.open();
        });

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // separator line
        menu.addMenuItem(menu.troubleshootItem);

        this.addMenuItem(new SettingsLauncher(_("System Settings"), "", "preferences-desktop"));
    },

    open: function(animate) {
        PopupMenu.PopupMenu.prototype.open.call(this, animate);

        this.movePanelItem.setSensitive(Main.panelManager.canAdd);
        this.addPanelItem.setSensitive(Main.panelManager.canAdd);
        // this.pasteAppletItem.setSensitive(AppletManager.clipboard.length != 0);

        let {definitions} = AppletManager;
        let nonEmpty = false;
        for (let i = 0, len = definitions.length; i < len; i++) {
            if (definitions[i] && definitions[i].panelId === this.panelId) {
                nonEmpty = true;
                break;
            }
        }
        //this.copyAppletItem.setSensitive(nonEmpty);
        //this.clearAppletItem.setSensitive(nonEmpty);
    }
}

function PanelZoneDNDHandler(panelZone, zoneString, panelId){
    this._init(panelZone, zoneString, panelId);
}

PanelZoneDNDHandler.prototype = {
    _init : function(panelZone, zoneString, panelId) {
        this._panelZone = panelZone;
        this._panelZone._delegate = this;
        this._zoneString = zoneString;
        this._panelId = panelId;
        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;

        this._origAppletCenters = null;
        this._origAppletPos = -1;

        this._panelZone.connect('leave-event', Lang.bind(this, this._handleLeaveEvent));
    },

    handleDragOver: function(source, actor, x, y, time) {

        if (!(source instanceof Applet.Applet)) return DND.DragMotionResult.NO_DROP;

        if (!this._hasSupportedLayout(source)) {
            return DND.DragMotionResult.NO_DROP;
        }

        let vertical_panel = this._panelZone.get_parent()._delegate.is_vertical;
        let children = this._panelZone.get_children();
        let horizontal_rtl = St.Widget.get_default_direction () === St.TextDirection.RTL && !vertical_panel;

        if (this._origAppletCenters == null) {
            this._origAppletCenters = [];
            this._origAppletPos = children.indexOf(source.actor);

            let j;

            for (j = 0; j < children.length; j++) {
                let allocation = children[j].get_allocation_box();
                let center = 0;
                if (vertical_panel) {
                    center = (allocation.y1 + allocation.y2) / 2;
                } else {
                    center = (allocation.x1 + allocation.x2) / 2;
                }

                this._origAppletCenters.push(center);
            }

            if(horizontal_rtl) {
                this._origAppletCenters.reverse();
            }
        }

        let dragPos = vertical_panel ? y : x;
        let pos = 0, i = 0;

        while (i < this._origAppletCenters.length && dragPos > this._origAppletCenters[i]) {
            i++;
        }

        if(horizontal_rtl) {
            pos = this._origAppletCenters.length - i;
        } else {
            pos = i;
        }

        if (pos != this._dragPlaceholderPos) {
            this._dragPlaceholderPos = pos;
            // Don't allow positioning before or after self

            if (this._origAppletPos != -1 && (pos == this._origAppletPos || pos == this._origAppletPos + 1)) {
                this._clearDragPlaceholder();
                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation

            if (this._dragPlaceholder) {
                this._panelZone.set_child_at_index(this._dragPlaceholder.actor,
                                                   this._dragPlaceholderPos);
            } else {
                this._dragPlaceholder = new DND.GenericDragPlaceholderItem();

                if (vertical_panel) {
                    this._dragPlaceholder.child.set_width (10 * global.ui_scale);
                    this._dragPlaceholder.child.set_height (20 * global.ui_scale);
                } else {
                    this._dragPlaceholder.child.set_width (20 * global.ui_scale);
                    this._dragPlaceholder.child.set_height (10 * global.ui_scale);
                }

                this._panelZone.insert_child_at_index(this._dragPlaceholder.actor,
                                                      this._dragPlaceholderPos);

                this._dragPlaceholder.animateIn();
            }
        }

        return DND.DragMotionResult.MOVE_DROP;
    },

    _handleLeaveEvent: function() {
        this._clearDragPlaceholder();
    },

    handleDragOut: function() {
        this._clearDragPlaceholder();
    },

    acceptDrop: function(source, actor, x, y, time) {
        this._origAppletCenters = null;

        if (!(source instanceof Applet.Applet)) return false;

        //  We want to ensure that applets placed in a panel can be shown correctly
        //  If the applet is of type Icon Applet then should be fine
        //  otherwise we look to see if it has declared itself suitable
        if (source instanceof Applet.TextIconApplet || !(source instanceof Applet.IconApplet)) {
            if (!this._hasSupportedLayout(source)) {
                    return false;
            }
        }

        let children = this._panelZone.get_children();
        let curAppletPos = 0;
        let insertAppletPos = 0;

        for (let i = 0, len = children.length; i < len; i++) {
            if (children[i]._delegate instanceof Applet.Applet){
                children[i]._applet._newOrder = curAppletPos;
                curAppletPos++;
            } else if (children[i] == this._dragPlaceholder.actor){
                insertAppletPos = curAppletPos;
                curAppletPos++;
            }
        }

        source.actor._applet._newOrder = insertAppletPos;
        source.actor._applet._newPanelLocation = this._panelZone;
        source.actor._applet._zoneString = this._zoneString;
        source.actor._applet._newPanelId = this._panelId;

        let sourcebox = source.actor._applet._panelLocation; /* this is the panel box providing the applet */

        this._clearDragPlaceholder();
        actor.destroy();
        AppletManager.saveAppletsPositions();

        /* this._panelZone is the panel box being dropped into. Note that the style class name will
           be something like 'panelLeft' or 'panelLeft vertical'*/

        if (this._panelZone.has_style_class_name("panelRight") || this._panelZone.has_style_class_name("panelLeft")) {
            this._panelZone.set_size(-1, -1);  /* kludge pt 2 - if the box being dropped into
                                                  has been set a fixed size then we need to let it adjust. */

        }

        if (sourcebox.has_style_class_name("panelRight") || sourcebox.has_style_class_name("panelLeft")) {
            children = sourcebox.get_children();

            if (children.length == 0) {         /* put back some minimum space if the source box is now empty */
                if (sourcebox.get_parent()._delegate.is_vertical) {
                    let height = sourcebox.get_height();
                    if (height < EDIT_MODE_MIN_BOX_SIZE * global.ui_scale)
                        sourcebox.set_height(EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
                } else {
                    let width = sourcebox.get_width();
                    if (width < EDIT_MODE_MIN_BOX_SIZE * global.ui_scale)
                        sourcebox.set_width(EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
                }
            }
        }

        return true;
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },

    _hasSupportedLayout: function(applet) {
        let layout = applet.getAllowedLayout();
        if (layout == Applet.AllowedLayout.BOTH) return true;
        if (applet instanceof Applet.IconApplet && !(applet instanceof Applet.TextIconApplet)) return true;
        if (layout == ((this._panelZone.get_parent()._delegate.is_vertical) ? Applet.AllowedLayout.VERTICAL : Applet.AllowedLayout.HORIZONTAL)) return true;
        return false;
    },

    reset: function() {
        this._origAppletCenters = null;
        this._origAppletPos = -1;
        this._clearDragPlaceholder();
    }
}

/**
 * #Panel:
 * @short_description: A panel object on the monitor
 *
 * @panelId (int): the id of the panel
 * @monitorIndex (int): the index of the monitor containing the panel
 * @toppanelHeight (int): the height already taken on the screen by a top panel
 * @bottompanelHeight (int): the height already taken on the screen by a bottom panel
 * @drawcorner (array): [left, right] whether to draw corners alongside the panel
 *
 * @monitor (Meta.Rectangle): the geometry (bounding box) of the monitor
 * @panelPosition (integer): where the panel is on the screen
 * @actor (Cinnamon.GenericContainer): the actor of the panel
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
function Panel(id, monitorIndex, panelPosition, toppanelHeight, bottompanelHeight, drawcorner) {
    this._init(id, monitorIndex, panelPosition, toppanelHeight, bottompanelHeight, drawcorner);
}

Panel.prototype = {
    _init : function(id, monitorIndex, panelPosition, toppanelHeight, bottompanelHeight, drawcorner) {

        this.panelId = id;
        this.drawcorner = drawcorner;
        this.monitorIndex = monitorIndex;
        this.monitor = global.screen.get_monitor_geometry(monitorIndex);
        this.panelPosition = panelPosition;
        this.toppanelHeight = toppanelHeight;
        this.bottompanelHeight = bottompanelHeight;

        this.is_vertical = (this.panelPosition == PanelLoc.left || this.panelPosition == PanelLoc.right);

        this._hidden = false;
        this._disabled = false;
        this._panelEditMode = false;
        this._autohideSettings = null;
        this._destroyed = false;
        this._positionChanged = false;
        this._monitorsChanged = false;
        this._signalManager = new SignalManager.SignalManager(null);
        this.height = 0;
        this.margin_top = 0;
        this.margin_bottom = 0;
        this.margin_left = 0;
        this.margin_right = 0;
        this._leftPanelBarrier = 0;
        this._rightPanelBarrier = 0;
        this._topPanelBarrier = 0;
        this._bottomPanelBarrier = 0;
        this._shadowBox = null;
        this._panelZoneSizes = this._createEmptyZoneSizes();
        this._peeking = false;

        this.themeSettings = new Gio.Settings({ schema_id: 'org.cinnamon.theme' });

        this.actor = new Cinnamon.GenericContainer({ name: 'panel', reactive: true });
        this.addPanelStyleClass(this.panelPosition);

        this.actor._delegate = this;

        this._menus = new PopupMenu.PopupMenuManager(this);

        this._leftBox    = new St.BoxLayout({ name: 'panelLeft', style_class: 'panelLeft', important: true });
        this._rightBox   = new St.BoxLayout({ name: 'panelRight', style_class: 'panelRight', important: true });
        this._centerBox  = new St.BoxLayout({ name: 'panelCenter',  style_class: 'panelCenter', important: true });

        if (this.is_vertical) {
            this._set_vertical_panel_style();
        } else {
            this._set_horizontal_panel_style();
        }

        this.actor.add_actor(this._leftBox);
        this.actor.add_actor(this._centerBox);
        this.actor.add_actor(this._rightBox);

        this._leftBoxDNDHandler   = new PanelZoneDNDHandler(this._leftBox, 'left', this.panelId);
        this._centerBoxDNDHandler = new PanelZoneDNDHandler(this._centerBox, 'center', this.panelId);
        this._rightBoxDNDHandler  = new PanelZoneDNDHandler(this._rightBox, 'right', this.panelId);

        this.drawCorners(drawcorner);

        this.addContextMenuToPanel(this.panelPosition);

        Main.layoutManager.addChrome(this.actor, { addToWindowgroup: false });
        this._moveResizePanel();
        this._onPanelEditModeChanged();
        this._processPanelAutoHide();

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
        this.actor.connect('style-changed', Lang.bind(this, this._moveResizePanel));
        this.actor.connect('leave-event', Lang.bind(this, this._leavePanel));
        this.actor.connect('enter-event', Lang.bind(this, this._enterPanel));
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        this.actor.connect('queue-relayout', () => this._setPanelHeight());

        this._signalManager.connect(global.settings, "changed::" + PANEL_AUTOHIDE_KEY, this._processPanelAutoHide, this);
        this._signalManager.connect(global.settings, "changed::" + PANEL_HEIGHT_KEY, this._moveResizePanel, this);
        this._signalManager.connect(global.settings, "changed::" + PANEL_ZONE_ICON_SIZES, this._onPanelZoneSizesChanged, this);
        this._signalManager.connect(global.settings, "changed::" + PANEL_ZONE_SYMBOLIC_ICON_SIZES, this._onPanelZoneSizesChanged, this);
        this._signalManager.connect(global.settings, "changed::" + PANEL_ZONE_TEXT_SIZES, this._onPanelZoneSizesChanged, this);
        this._signalManager.connect(global.settings, "changed::panel-edit-mode", this._onPanelEditModeChanged, this);
        this._signalManager.connect(global.settings, "changed::no-adjacent-panel-barriers", this._updatePanelBarriers, this);

        this._onPanelZoneSizesChanged();
    },

    drawCorners: function(drawcorner)
    {

        if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) {  // horizontal panels
            if (drawcorner[0]) { // left corner
                if (this.panelPosition == PanelLoc.top) {
                    if (this.actor.get_direction() == St.TextDirection.RTL)    // right to left text direction e.g. arabic
                        this._leftCorner = new PanelCorner(this._rightBox, St.Side.LEFT, CornerType.topleft);
                    else                            // left to right text direction
                        this._leftCorner = new PanelCorner(this._leftBox, St.Side.LEFT, CornerType.topleft);
                } else { // bottom panel
                    if (this.actor.get_direction() == St.TextDirection.RTL)   // right to left text direction e.g. arabic
                        this._leftCorner = new PanelCorner(this._rightBox, St.Side.LEFT, CornerType.bottomleft);
                    else                            // left to right text direction
                        this._leftCorner = new PanelCorner(this._leftBox, St.Side.LEFT, CornerType.bottomleft);
                }
            }
            if (drawcorner[1]) { // right corner
                if (this.panelPosition == PanelLoc.top) {
                    if (this.actor.get_direction() == St.TextDirection.RTL)    // right to left text direction e.g. arabic
                        this._rightCorner = new PanelCorner(this._leftBox, St.Side.RIGHT,CornerType.topright);
                    else                            // left to right text direction
                        this._rightCorner = new PanelCorner(this._rightBox, St.Side.RIGHT,CornerType.topright);
                } else { // bottom
                    if (this.actor.get_direction() == St.TextDirection.RTL)   // right to left text direction e.g. arabic
                        this._rightCorner = new PanelCorner(this._leftBox, St.Side.RIGHT,CornerType.bottomright);
                    else                            // left to right text direction
                        this._rightCorner = new PanelCorner(this._rightBox, St.Side.RIGHT,CornerType.bottomright);
                }
            }
        } else {  // vertical panels
            if (this.panelPosition == PanelLoc.left) {   // left panel
                if (drawcorner[0]) {
                    if (this.actor.get_direction() == St.TextDirection.RTL)    // right to left text direction
                        this._leftCorner = new PanelCorner(this._rightBox, St.Side.TOP, CornerType.topleft);
                    else
                        this._leftCorner = new PanelCorner(this._leftBox, St.Side.TOP, CornerType.topleft);
                }
                if (drawcorner[1])
                {
                    if (this.actor.get_direction() == St.TextDirection.RTL)    // right to left text direction
                        this._rightCorner = new PanelCorner(this._leftBox, St.Side.BOTTOM, CornerType.bottomleft);
                    else
                        this._rightCorner = new PanelCorner(this._rightBox, St.Side.BOTTOM, CornerType.bottomleft);
                }
            } else { // right panel
                if (drawcorner[0]) {
                    if (this.actor.get_direction() == St.TextDirection.RTL)   // right to left text direction
                        this._leftCorner = new PanelCorner(this._rightBox, St.Side.TOP, CornerType.topright);
                    else
                        this._leftCorner = new PanelCorner(this._leftBox, St.Side.TOP, CornerType.topright);
                }
                if (drawcorner[1]) {
                    if (this.actor.get_direction() == St.TextDirection.RTL)    // right to left text direction;
                        this._rightCorner = new PanelCorner(this._leftBox, St.Side.BOTTOM, CornerType.bottomright);
                    else
                        this._rightCorner = new PanelCorner(this._rightBox, St.Side.BOTTOM, CornerType.bottomright);
                }
            }
        }

        if (this.actor.is_finalized()) return;

        if (this._leftCorner && !this._leftCorner.actor.is_finalized())
            this.actor.add_actor(this._leftCorner.actor);
        if (this._rightCorner && !this._rightCorner.actor.is_finalized())
            this.actor.add_actor(this._rightCorner.actor);
    },

    _destroycorners: function()
    {
    if (this._leftCorner)
        this._leftCorner.actor.destroy();
    if (this._rightCorner)
        this._rightCorner.actor.destroy();
    this.drawcorner = [false,false];
    },

    /**
     * updatePosition:
     * @monitorIndex: integer, index of monitor
     * @panelPosition, integer, where the panel should be placed
     *
     * Moves the panel to the monitor @monitorIndex and position @panelPosition
     */
    updatePosition: function(monitorIndex, panelPosition) {
        this.monitorIndex = monitorIndex
        this.panelPosition = panelPosition;
        this._positionChanged = true;

        this.monitor = global.screen.get_monitor_geometry(monitorIndex);
        //
        // If there are any corners then remove them - they may or may not be required
        // in the new position, so we cannot just move them
        //
        this._destroycorners();

        this._set_orientation();

        this.addContextMenuToPanel(panelPosition);
        this.addPanelStyleClass(panelPosition);
        this._moveResizePanel();
    },

    /**
     * addContextMenuToPanel:
     * @panelPosition, integer
     *
     *  Adds a context menu to the panel
     */
    addContextMenuToPanel:  function(panelPosition) {
        switch (panelPosition)
        {
            case PanelLoc.top:
                this._context_menu = new PanelContextMenu(this, St.Side.TOP, this.panelId);
                break;
            case PanelLoc.bottom:
                this._context_menu = new PanelContextMenu(this, St.Side.BOTTOM, this.panelId);
                break;
            case PanelLoc.left:
                this._context_menu = new PanelContextMenu(this, St.Side.LEFT, this.panelId);
                break;
            case PanelLoc.right:
                this._context_menu = new PanelContextMenu(this, St.Side.RIGHT, this.panelId);
                break;
            default:
                global.log("addContextMenuToPanel - unrecognised panel position "+panelPosition);
        }
        this._menus.addMenu(this._context_menu);

        return;
    },

     /**
     * addPanelStyleClass:
     * @panelPosition, integer
     *
     *  Adds the panel style class.  NB the original #panel style class is kept
     */
    addPanelStyleClass:  function(panelPosition) {
        switch (panelPosition)
        {
            case PanelLoc.top:
                this.actor.remove_style_class_name('panel-bottom');
                this.actor.remove_style_class_name('panel-left');
                this.actor.remove_style_class_name('panel-right');
                this.actor.add_style_class_name('panel-top');
                break;
            case PanelLoc.bottom:
                this.actor.remove_style_class_name('panel-top');
                this.actor.remove_style_class_name('panel-left');
                this.actor.remove_style_class_name('panel-right');
                this.actor.add_style_class_name('panel-bottom');
                break;
            case PanelLoc.left:
                this.actor.remove_style_class_name('panel-bottom');
                this.actor.remove_style_class_name('panel-top');
                this.actor.remove_style_class_name('panel-right');
                this.actor.add_style_class_name('panel-left');
                break;
            case PanelLoc.right:
                this.actor.remove_style_class_name('panel-bottom');
                this.actor.remove_style_class_name('panel-left');
                this.actor.remove_style_class_name('panel-top');
                this.actor.add_style_class_name('panel-right');
                break;
            default:
                global.log("addPanelStyleClass - unrecognised panel position "+panelPosition);
        }
        return;
    },

    /**
     * destroy:
     * @removeIconSizes (boolean): (optional) whether to remove zone icon size settings. Default value is true.
     *
     * Destroys the panel
     */
    destroy: function(removeIconSizes = true) {
        if (this._destroyed) return;
        this._destroyed = true;    // set this early so that any routines triggered during
                                   // the destroy process can test it

        if (removeIconSizes) this._removeZoneIconSizes();
        // remove icon size settings if requested
        // settings should be removed except when panel is destroyed due to monitor change
        // this prevents settings from being reset every time a monitor is disconnected

        this._clearPanelBarriers();
        AppletManager.unloadAppletsOnPanel(this.panelId);
        this._context_menu.close();
        this._context_menu.destroy();

        this._leftBox.destroy();
        this._centerBox.destroy();
        this._rightBox.destroy();
        this._destroycorners();

        this.actor.destroy();

        this._signalManager.disconnectAllSignals()

        this._menus = null;
        this.monitor = null;

        return;
    },


    peekPanel: function() {
        if (!this._hidden || this._peeking)
            return;

        if (this._showHideTimer > 0) {
            Mainloop.source_remove(this._showHideTimer);
            this._showHideTimer = 0;
        }

        this._peeking = true;
        this._showPanel();

        Mainloop.timeout_add(PANEL_PEEK_TIME, () => {
            this._peeking = false;
            this._updatePanelVisibility();
            return false;
        });
    },

    /**
     * highlight:
     * @highlight (boolean): whether to turn on or off
     *
     * Turns on/off the highlight of the panel
     */
    highlight: function(highlight) {
        if (highlight == this.actor.has_style_pseudo_class('highlight'))
            return;

        this.actor.change_style_pseudo_class('highlight', highlight);

        if (highlight)
            this.peekPanel();
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
                property = values[i].split(":")[1];
                break;
            }
        }
        if (!property) {
            property = DEFAULT_PANEL_VALUES[key];
            values.push(this.panelId + ":" + property);
            global.settings.set_strv(key, values);
        }
        switch (type){
        case "b":
            return property == "true";
        case "i":
            return parseInt(property);
        default:
            return property;
        }
    },

    /**
     * _getJSONProperty
     * @key (string): name of gsettings key
     *
     * Gets the desired JSON encoded property of the panel from gsettings
     *
     * Returns: property required
     */
    _getJSONProperty: function(key){
        let json = global.settings.get_string(key);

        Util.tryFn(function() {
            json = JSON.parse(json);
        }, function(err) {
            err.message = `Failed to parse JSON property: \n${err.message}`;
            global.logError(err);
            json = null;
        });

        return json;
    },

    handleDragOver: function(source, actor, x, y, time) {
//
// For empty panels. If over left,right,center box then will not get here.
//
        this._enterPanel();
        if (this._dragShowId && this._dragShowId > 0)
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
        });  // end of bind

        this._dragShowId = Mainloop.timeout_add(500, leaveIfOut);

        return DND.DragMotionResult.NO_DROP;
    },
    /**
     * _updatePanelBarriers:
     *
     * https://cgit.freedesktop.org/cgit/?url=xorg/proto/fixesproto/plain/fixesproto.txt
     */
    _updatePanelBarriers: function() {

        this._clearPanelBarriers();

        if (this._destroyed)  // ensure we do not try to set barriers if panel is being destroyed
            return;
        if (this.monitorIndex < 0 || this.monitorIndex >= global.screen.get_n_monitors())  // skip panels that never got created
            return;

        let screen_width  = global.screen_width;
        let screen_height = global.screen_height;

        let noBarriers = global.settings.get_boolean("no-adjacent-panel-barriers");

        if (this.actor.height && this.actor.width) {

            let panelTop = 0;
            let panelBottom = 0;
            let panelLeft = 0;
            let panelRight = 0;

            if (!noBarriers) {   // barriers are required
                if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) {
                    switch (this.panelPosition) {
                        case PanelLoc.top:
                            panelTop    = this.monitor.y;
                            panelBottom = this.monitor.y + this.actor.height;
                            break;
                        case PanelLoc.bottom:
                            panelTop    = this.monitor.y + this.monitor.height - Math.floor(this.actor.height);
                            panelBottom = this.monitor.y + this.monitor.height -1;
                            break;
                    }
                    let x_coord = this.monitor.x + this.monitor.width - 1 - this.margin_right;
                    if (panelTop != panelBottom && x_coord >= 0)
                    {
                        if (screen_width > this.monitor.x + this.monitor.width - this.margin_right) {    // if there is a monitor to the right or panel offset into monitor
                            this._rightPanelBarrier = global.create_pointer_barrier( // permit moving in negative x direction for a right hand barrier
                                                  x_coord, panelTop,
                                                  x_coord, panelBottom,
                                                  4 /* BarrierNegativeX (value 1 << 2) */);
                        }

                        x_coord = this.monitor.x + this.margin_left;
                        if (x_coord > 0) {                                    // if there is a monitor to the left or panel offset into monitor
                            this._leftPanelBarrier = global.create_pointer_barrier(  // permit moving in positive x direction for a left hand barrier
                                                 x_coord, panelTop,
                                                 x_coord, panelBottom,
                                                 1 /* BarrierPositiveX   (value  1 << 0) */);
                        }
                    }
                } else {
                    switch (this.panelPosition) {
                        case PanelLoc.left:
                            panelLeft  = this.monitor.x;
                            panelRight = this.monitor.x + Math.floor(this.actor.width);
                            break;
                        case PanelLoc.right:
                            panelLeft  = this.monitor.x + this.monitor.width - Math.floor(this.actor.width);
                            panelRight = this.monitor.x + this.monitor.width-1;
                            break;
                        default:
                            global.log("updatePanelBarriers - unrecognised panel position "+this.panelPosition);
                    }
                    if (panelRight != panelLeft) {
                        let y_coord = this.monitor.y + Math.floor(this.toppanelHeight) + this.margin_top;
                        if (y_coord > 0) {                                  // if there is a monitor above or top of panel offset into monitor
                            this._topPanelBarrier = global.create_pointer_barrier( // permit moving in positive y direction for a top barrier
                                                panelLeft,  y_coord ,
                                                panelRight, y_coord ,
                                                2 /* BarrierPositiveY (value  1 << 1) */);
                        }
                        y_coord = this.monitor.y + this.monitor.height - Math.floor(this.bottompanelHeight)- this.margin_bottom -1;

                        if (screen_height > this.monitor.y + this.monitor.height         // if there is a monitor below
                            || this.bottompanelHeight > 0 || this.margin_bottom > 0) {   // or the bottom of the panel is offset into the monitor
                            this._bottomPanelBarrier = global.create_pointer_barrier( // permit moving in negative y direction for a bottom barrier
                                                   panelLeft,  y_coord,
                                                   panelRight, y_coord,
                                                   8 /* BarrierNegativeY (value 1 << 3) */);
                        }
                    }
                }
            } else {        // barriers are not required
                this._clearPanelBarriers();
            }
        } else {            // actor without width or height
            this._clearPanelBarriers();
        }
    },

    _clearPanelBarriers: function() {
        if (this._leftPanelBarrier)
            global.destroy_pointer_barrier(this._leftPanelBarrier);
        if (this._rightPanelBarrier)
            global.destroy_pointer_barrier(this._rightPanelBarrier);
        if (this._topPanelBarrier)
            global.destroy_pointer_barrier(this._topPanelBarrier);
        if (this._bottomPanelBarrier)
            global.destroy_pointer_barrier(this._bottomPanelBarrier);

        this._leftPanelBarrier = 0;
        this._rightPanelBarrier = 0;
        this._topPanelBarrier = 0;
        this._bottomPanelBarrier = 0;
    },

    _onPanelEditModeChanged: function() {
        let old_mode = this._panelEditMode;

        this._panelEditMode = global.settings.get_boolean("panel-edit-mode");
        this._leftBox.change_style_pseudo_class('dnd', this._panelEditMode);
        this._centerBox.change_style_pseudo_class('dnd', this._panelEditMode);
        this._rightBox.change_style_pseudo_class('dnd', this._panelEditMode);

        /* this next section is a bit of a kludge and should be reworked when
           someone can find a better way. The issue is that boxlayout left and right
           align can show no visible box when containing no applets.  This puts a
           fixed min size in to permit a drop to happen in edit mode, it turns on
           when selecting edit mode, and off when leaving.

           Note that setting up to use the full width does not work, it gets
           left alignment which doesn't seem to be able to be over-ridden,
           and the applet gets a whole box fill effect which is weird when dragging
           - perhaps x_fill etc. is turned on elsewhere  */

        if (this._panelEditMode) {
            if (this.is_vertical) {
                let height = this._rightBox.get_height();
                if (height < EDIT_MODE_MIN_BOX_SIZE * global.ui_scale)
                    this._rightBox.set_height(EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
                height = this._leftBox.get_height();
                if (height < EDIT_MODE_MIN_BOX_SIZE * global.ui_scale)
                    this._leftBox.set_height(EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
            } else {
                let width = this._rightBox.get_width();
                if (width < EDIT_MODE_MIN_BOX_SIZE * global.ui_scale)
                    this._rightBox.set_width(EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
                width = this._leftBox.get_width();
                if (width < EDIT_MODE_MIN_BOX_SIZE * global.ui_scale)
                    this._leftBox.set_width(EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
            }
        } else {
            this._rightBox.set_size(-1, -1);
            this._leftBox.set_size(-1, -1);
        }

        if (old_mode != this._panelEditMode) {
            this._updatePanelVisibility();
        }

        this.actor.queue_relayout();
    },

    _onButtonPressEvent: function (actor, event) {
        if (event.get_button() == 1) {
            if (this._context_menu.isOpen)
                this._context_menu.toggle();
        }
        if (event.get_button() == 3) {  // right click
            try {
                let [x, y] = event.get_coords();
                let target = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);

                // NB test on parent fails with centre aligned vertical box, but works for the test against the actor
                if (this._context_menu._getMenuItems().length > 0 &&
                   (target.get_parent() == this.actor || target == this.actor)) {
                    if (!this._context_menu.isOpen) {
                        switch (this.panelPosition) {
                            case PanelLoc.top:
                            case PanelLoc.bottom:
                                this._context_menu.shiftToPosition(x);
                                break;
                            case PanelLoc.left:
                            case PanelLoc.right:
                                this._context_menu.shiftToPosition(y);
                                break;
                        }
                    }

                    this._context_menu.toggle();
                }
            } catch(e) {
                global.log(e);
            }
        }
        return;
    },

    _onFocusChanged: function() {
        if (global.display.focus_window && this._focusWindow !== undefined &&
            this._focusWindow == global.display.focus_window.get_compositor_private())
            return;

        this._signalManager.disconnect("position-changed");
        this._signalManager.disconnect("size-changed");

        if (!global.display.focus_window)
            return;

        this._focusWindow = global.display.focus_window.get_compositor_private();
        this._signalManager.connect(this._focusWindow, "position-changed", this._updatePanelVisibility, this);
        this._signalManager.connect(this._focusWindow, "size-changed", this._updatePanelVisibility, this);
        this._updatePanelVisibility();
    },

    _processPanelAutoHide: function() {
        this._autohideSettings = this._getProperty(PANEL_AUTOHIDE_KEY, "s");

        if (this._autohideSettings == "intel") {
            this._signalManager.connect(global.display, "notify::focus-window", this._onFocusChanged, this);
            /* focus-window signal is emitted when the workspace change
             * animation starts. When the animation ends, we do the position
             * check again because the windows have moved. We cannot use
             * _onFocusChanged because _onFocusChanged does nothing when there
             * is no actual focus change. */
            this._signalManager.connect(global.window_manager, "switch-workspace-complete", this._updatePanelVisibility, this);
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
     * _getScaledPanelHeight:
     *
     * Function to calculate the desired panel height
     *
     * returns : panelheight
     */
    _getScaledPanelHeight: function() {
        let panelHeight = 0;
        panelHeight = this._getProperty(PANEL_HEIGHT_KEY, "i") * global.ui_scale;
        return panelHeight < 20 ? 40 : panelHeight;
    },

   /**
    * _setClipRegion:
    * @hidden: whether the panel should be clipped for hide
    * @offset: (optional): x or y position offset
    *
    * If @hidden is true the clip region is set to the one exposed strip of pixels
    * adjacent to the monitor edge. Otherwise, the clip region is set to the panel
    * size plus the shadow on the side of the panel opposite the monitor edge.
    *
    * @offset is only used during tweens. If provided, it is used to offset the
    * current position in order to calculate the exposed size.
    */
    _setClipRegion: function(hidden, offset) {
        let animating = typeof offset === "number";
        let isHorizontal = this.panelPosition == PanelLoc.top
                           || this.panelPosition == PanelLoc.bottom;

        // determine corners size so we can extend allocation when not
        // hiding or animating.
        let cornerRadius = 0;
        if (this._leftCorner && this._leftCorner.cornerRadius > 0) {
            cornerRadius = this._leftCorner.cornerRadius;
        } else if (this._rightCorner && this._rightCorner.cornerRadius > 0) {
            cornerRadius = this._rightCorner.cornerRadius;
        }

        // determine exposed amount of panel
        let exposedAmount;
        if (isHorizontal) {
            if (hidden)
                exposedAmount = animating ? Math.abs(this.actor.y - offset) + 1
                                          : 1;
            else
                exposedAmount = animating ? Math.abs(this.actor.y - offset)
                                          : this.actor.height;
        } else {
            if (hidden)
                exposedAmount = animating ? Math.abs(this.actor.x - offset) + 1
                                          : 1;
            else
                exposedAmount = animating ? Math.abs(this.actor.x - offset)
                                          : this.actor.width;
        }

        // determine offset & set clip
        // top/left panels: must offset by the hidden amount
        // bottom/right panels: if showing must offset by shadow size and corner radius
        // all panels: if showing increase exposedAmount by shadow size and corner radius

        // we use only the shadowbox x1 or y1 (offset) to determine shadow size
        // as some themes use an offset shadow to draw only on one side whereas
        // others have a shadow all around. using the offset should handle
        // both cases.
        if (isHorizontal) {
            let clipOffsetY = 0;
            if (this.panelPosition == PanelLoc.top) {
                clipOffsetY = this.actor.height - exposedAmount;
            } else {
                if (!hidden)
                    clipOffsetY = this._shadowBox.y1 - cornerRadius;
            }
            if (!hidden)
                exposedAmount += Math.abs(this._shadowBox.y1) + cornerRadius;
            this.actor.set_clip(0, clipOffsetY, this.actor.width, exposedAmount);
        } else {
            let clipOffsetX = 0;
            if (this.panelPosition == PanelLoc.left) {
                clipOffsetX = this.actor.width - exposedAmount;
            } else {
                if (!hidden)
                    clipOffsetX = this._shadowBox.x1 - cornerRadius;
            }
            if (!hidden)
                exposedAmount += Math.abs(this._shadowBox.x1) + cornerRadius;
            this.actor.set_clip(clipOffsetX, 0, exposedAmount, this.actor.height);
        }
        // Force the layout manager to update the input region
        Main.layoutManager.updateChrome()
    },

    /**
     * _moveResizePanel:
     *
     * Function to update the panel position, size, and clip region according to settings
     * values.  Note that this is also called when the style changes.
     */
    _moveResizePanel: function() {
        if (this._destroyed)
            return false;

        //
        // layouts set to be full width horizontal panels, and vertical panels set to use as much available space as is left
        //
        // NB If you want to use margin to inset the panels within a monitor, then you can't just set it here
        // else full screen windows will then go right to the edge with the panels floating over
        //
        this.monitor = global.screen.get_monitor_geometry(this.monitorIndex);
        let horizontal_panel = (!!((this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom)));

        // this stands for width on vertical panels, and height on horizontal panels
        let panelHeight = this._getScaledPanelHeight();

        // find heights used by horizontal panels to determine height available for vertical panels.
        // we need to check Main.panelManager because this can be called before it has initialized.
        this.toppanelHeight = 0;
        this.bottompanelHeight = 0;
        if (Main.panelManager && !horizontal_panel)
            [this.toppanelHeight, this.bottompanelHeight] = heightsUsedMonitor(this.monitorIndex, Main.panelManager.panels);
        // get shadow and margins
        let themeNode = this.actor.get_theme_node();

        // FIXME: inset shadows will probably break clipping.
        // I haven't seen a theme with inset panel shadows, but if there
        // are any then we need to just use the dummy shadow box in that case.
        let shadowBox;
        let shadow = themeNode.get_box_shadow();
        if (shadow) {
            shadowBox = new Clutter.ActorBox;
            let actorBox = new Clutter.ActorBox;
            shadow.get_box(actorBox, shadowBox);
        } else {
            // if we don't actually have a shadow, just create a dummy shadowBox
            shadowBox = {x1: 0, y1: 0, x2: 0, y2: 0};
        }

        let newMarginTop = 0;
        let newMarginBottom = 0;
        let newMarginLeft = 0;
        let newMarginRight = 0;
        try {
            newMarginTop    = themeNode.get_margin(St.Side.TOP);
            newMarginBottom = themeNode.get_margin(St.Side.BOTTOM);
            newMarginLeft   = themeNode.get_margin(St.Side.LEFT);
            newMarginRight  = themeNode.get_margin(St.Side.RIGHT);
        } catch (e) {
            global.log(e);
        }

        let panelChanged = false;

        let shadowChanged = !this._shadowBox
                            || shadowBox.x1 != this._shadowBox.x1
                            || shadowBox.x2 != this._shadowBox.x2
                            || shadowBox.y1 != this._shadowBox.y1
                            || shadowBox.y2 != this._shadowBox.y2;

        // if the shadow changed, we need to update the clip
        if (shadowChanged) {
            panelChanged = true;
            this._shadowBox = shadowBox;
        }

        // if the position changed, make sure the panel is showing
        // so it's more apparent that the panel moved successfully
        if (this._positionChanged) {
            panelChanged = true;
            this._positionChanged = false;
            this._hidden = false;
        }

        // if the monitors changed, force update in case the position needs updating
        if (this._monitorsChanged) {
            panelChanged = true;
            this._monitorsChanged = false;
        }

        // calculate new panel sizes.  NB margin is already scaled for hidpi
        let newVertPanelHeight = this.monitor.height - this.toppanelHeight - this.bottompanelHeight
                                 - (newMarginTop + newMarginBottom);
        let newHorizPanelWidth = this.monitor.width - (newMarginLeft + newMarginRight);

        // and determine if this panel's size changed
        if (horizontal_panel) {
            if (this.actor.width != newHorizPanelWidth || this.actor.height != panelHeight)
                panelChanged = true;
        } else {
            if (this.actor.width != panelHeight || this.actor.height != newVertPanelHeight)
                panelChanged = true;
        }

        if (panelChanged) {
            // remove any tweens that might be active for autohide
            Tweener.removeTweens(this.actor);

            this.margin_top = newMarginTop;
            this.margin_bottom = newMarginBottom;
            this.margin_left = newMarginLeft;
            this.margin_right = newMarginRight;

            // update size and determine position depending on hidden state
            let newX, newY;
            if (horizontal_panel) {
                newX = this.monitor.x;
                if (this.panelPosition == PanelLoc.top) {
                    newY = this._hidden ? this.monitor.y - panelHeight + 1
                                        : this.monitor.y;
                } else {
                    newY = this._hidden ? this.monitor.y + this.monitor.height - 1
                                        : this.monitor.y + this.monitor.height - panelHeight;
                }
                this.actor.set_size(newHorizPanelWidth, panelHeight);
            } else {
                newY = this.monitor.y + this.toppanelHeight;
                if (this.panelPosition == PanelLoc.left) {
                    newX = this._hidden ? this.monitor.x - panelHeight + 1
                                        : this.monitor.x;
                } else {
                    newX = this._hidden ? this.monitor.x + this.monitor.width - 1
                                        : this.monitor.x + this.monitor.width - panelHeight;
                }
                this.actor.set_size(panelHeight, newVertPanelHeight);
            }

            // update position and clip region
            this.actor.set_position(newX, newY)
            this._setClipRegion(this._hidden);

            // only needed here for when this routine is called when the style changes
            this._updatePanelBarriers();

            this._updatePanelVisibility();

            // If we are adjusting the heights of horizontal panels then the vertical ones on this monitor
            // need to be changed at the same time.
            if (Main.panelManager && horizontal_panel) {
                let panels = Main.panelManager.getPanelsInMonitor(this.monitorIndex);
                for (let p = 0, len = panels.length; p < len; p++) {
                    if (panels[p].panelPosition == PanelLoc.left || panels[p].panelPosition == PanelLoc.right)
                        panels[p]._moveResizePanel();
                }
            }

            // AppletManager might not be initialized yet
            if (AppletManager.appletsLoaded) this._setPanelHeight();
        }
        return true;
    },

    _set_orientation: function() {
        //
        // cater for the style/alignment for different panel orientations
        //
        if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) {
            this._set_horizontal_panel_style();
            this.is_vertical = false;
        }
        else {
            this._set_vertical_panel_style();
            this.is_vertical = true;
        }
    },

    _set_vertical_panel_style: function() {
        this._leftBox.add_style_class_name('vertical');
        this._leftBox.set_vertical(true);
        this._leftBox.set_x_align(Clutter.ActorAlign.FILL);
        this._leftBox.set_y_align(Clutter.ActorAlign.START);

        this._centerBox.add_style_class_name('vertical');
        this._centerBox.set_vertical(true);
        this._centerBox.set_x_align(Clutter.ActorAlign.FILL);
        this._centerBox.set_y_align(Clutter.ActorAlign.FILL);

        this._rightBox.add_style_class_name('vertical');
        this._rightBox.set_vertical(true);
        this._rightBox.set_x_align(Clutter.ActorAlign.FILL);
        this._rightBox.set_y_align(Clutter.ActorAlign.END);
    },

    _set_horizontal_panel_style: function() {
        this._leftBox.remove_style_class_name('vertical');
        this._leftBox.set_vertical(false);
        this._leftBox.set_x_align(Clutter.ActorAlign.START);
        this._leftBox.set_y_align(Clutter.ActorAlign.FILL);

        this._centerBox.remove_style_class_name('vertical');
        this._centerBox.set_vertical(false);
        this._centerBox.set_x_align(Clutter.ActorAlign.FILL);
        this._centerBox.set_y_align(Clutter.ActorAlign.FILL);

        this._rightBox.remove_style_class_name('vertical');
        this._rightBox.set_vertical(false);
        this._rightBox.set_x_align(Clutter.ActorAlign.END);
        this._rightBox.set_y_align(Clutter.ActorAlign.FILL);
    },

    _setPanelHeight: function() {
        let height = setHeightForPanel(this);
        if (height === this.height) return;

        this.height = height;

        // In case icon sizes are responding to panel height
        this._onPanelZoneSizesChanged();

        this.emit('size-changed', height);
    },

    _createEmptyZoneSizes: function() {
        let typeStruct = {
            "left" : 0,
            "center" : 0,
            "right" : 0
        };

        let sizes = {
            "fullcolor" : typeStruct,
            "symbolic" : typeStruct,
            "text" : typeStruct
        };

        return sizes;
    },

    _onPanelZoneSizesChanged: function(value, key) {
        if (this._destroyed) return;

        let changed = false;
        let oldZoneSizes = this._panelZoneSizes;

        let sizeSets = [
            ["fullcolor", PANEL_ZONE_ICON_SIZES, (a,b,c,d) => this._clampPanelZoneColorIconSize(a,b,c,d), DEFAULT_FULLCOLOR_ICON_SIZE_VALUES],
            ["symbolic", PANEL_ZONE_SYMBOLIC_ICON_SIZES, (a,b,c,d) => this._clampPanelZoneSymbolicIconSize(a,b,c,d), DEFAULT_SYMBOLIC_ICON_SIZE_VALUES],
            ["text", PANEL_ZONE_TEXT_SIZES, (a,b,c,d) => this._clampPanelZoneTextSize(a,b,c,d), DEFAULT_TEXT_SIZE_VALUES]
        ];

        /* Iterate thru the sizeSets to get our sizes for all 3 types */
        Util.each(sizeSets, (set, i) => {
            let [typeString, settingKey, getSizeFunc, defaults] = set;

            let settingsArray = this._getJSONProperty(settingKey);

            /* Temporarily disconnect setting handler, so we don't trigger for our own update */
            this._signalManager.disconnect("changed::" + settingKey);

            /* If one of the sizing key contains nothing, reset them to default before continuing */
            if (!settingsArray) {
                log(`Panel zone size settings invalid, resetting org.cinnamon "${settingKey}"`);
                global.settings.reset(settingKey);
                settingsArray = this._getJSONProperty(settingKey);
            }

            let haveSettings = false;

            /* Now, iterate thru the individual set's values (an individual setting key's array of panel sizes),
             * then compute their display sizes and stick them in this._panelZoneSizes for the current type. */
            Util.each(settingsArray, (sizes, i) => {
                if (sizes.panelId !== this.panelId) return;

                haveSettings = true;

                sizes.left = getSizeFunc(sizes, typeString, "left", defaults);
                sizes.center = getSizeFunc(sizes, typeString, "center", defaults);
                sizes.right = getSizeFunc(sizes, typeString, "right", defaults);

                let zoneCache = oldZoneSizes[typeString];

                if (sizes.left !== zoneCache.left ||
                    sizes.center !== zoneCache.center ||
                    sizes.right !== zoneCache.right) {
                    changed = true;
                }

                this._panelZoneSizes[typeString] = sizes;
            });

            /* If there are no settings for this panel (it's either new, or the settings key has been reset to defaults),
             * generate default display values for adding to this._panelZoneSizes, as well as a default item to add to
             * gsettings. */
            if (!haveSettings) {
                let panelHeight = this.height * global.ui_scale;

                let defaultForCache = {
                    "left": getSizeFunc(defaults, typeString, "left", null),
                    "center": getSizeFunc(defaults, typeString, "center", null),
                    "right": getSizeFunc(defaults, typeString, "right", null)
                };

                this._panelZoneSizes[typeString] = defaultForCache;

                let defaultSet = defaults;

                defaultSet["panelId"] = this.panelId;
                settingsArray.push(defaultSet);
                global.settings.set_string(settingKey, JSON.stringify(settingsArray));
           }

           this._signalManager.connect(global.settings, "changed::" + settingKey, this._onPanelZoneSizesChanged, this);
        });

        let zones = [
            [this._leftBox, "left"],
            [this._centerBox, "center"],
            [this._rightBox, "right"]
        ];

        Util.each(zones, (zone, i) => {
            let [actor, zoneString] = zone;

            let value = this._panelZoneSizes["text"][zoneString];

            if (value > 0.0) {
                actor.set_style("font-size: %.1fpt;".format(value));
            } else {
                actor.set_style(null);
            }
        });

        if (changed) this.emit('icon-size-changed');
    },

    _clampPanelZoneTextSize: function(panelZoneSizeSet, typeString, zoneString, defaults) {
        let iconSize = panelZoneSizeSet.maybeGet(zoneString);

        if (iconSize == undefined) {
            iconSize = defaults[zoneString];
        }

        if (iconSize !== 0.0) {
            return iconSize.clamp(MIN_TEXT_SIZE_PTS, MAX_TEXT_SIZE_PTS);
        }

        return iconSize;
    },

    _clampPanelZoneColorIconSize: function(panelZoneSizeSet, typeString, zoneString, defaults) {
        let iconSize = panelZoneSizeSet.maybeGet(zoneString);

        if (iconSize == undefined) {
            iconSize = defaults[zoneString];
        }

        let height = this.height / global.ui_scale;

        if (iconSize === -1) { // Legacy: Scale to panel size
            iconSize = height;
        } else if (iconSize === 0 || iconSize > height) { // To best fit within the panel size
            iconSize = toStandardIconSize(height);
        }

        return iconSize; // Always return a value above 0 or St will spam the log.
    },

    _clampPanelZoneSymbolicIconSize: function(panelZoneSizeSet, typeString, zoneString, defaults) {
        let iconSize = panelZoneSizeSet.maybeGet(zoneString);

        if (iconSize == undefined) {
            iconSize = defaults[zoneString];
        }

        let panelHeight = this.height / global.ui_scale;

        let new_size = iconSize.clamp(MIN_SYMBOLIC_SIZE_PX, Math.min(MAX_SYMBOLIC_SIZE_PX, panelHeight));
        return new_size;
    },

    getPanelZoneIconSize: function(locationLabel, iconType) {
        let zoneConfig = this._panelZoneSizes;
        let typeString = "fullcolor";

        if (iconType == St.IconType.SYMBOLIC) {
            typeString = "symbolic";
        }

        return this._panelZoneSizes[typeString][locationLabel];
    },

    _removeZoneIconSizes: function() {
        let sizeSets = [
            ["fullcolor", PANEL_ZONE_ICON_SIZES],
            ["symbolic", PANEL_ZONE_SYMBOLIC_ICON_SIZES],
            ["text", PANEL_ZONE_TEXT_SIZES]
        ];

        Util.each(sizeSets, (set, i) => {
            let [typeString, settingKey] = set;

            let settingsArray = this._getJSONProperty(settingKey);

            /* Temporarily disconnect setting handler, so we don't trigger for our own update */
            this._signalManager.disconnect("changed::" + settingKey);

            let zoneIndex = Util.findIndex(settingsArray, (obj) => {
                return obj.panelId === this.panelId;
            });

            if (zoneIndex >= 0) {
                settingsArray.splice(zoneIndex, 1);

                this._panelZoneSizes = null;

                global.settings.set_string(settingKey, JSON.stringify(settingsArray));

                this._signalManager.connect(global.settings, "changed::" + settingKey, this._onPanelZoneSizesChanged, this);
            }
        });

        global.log(`[Panel ${this.panelId}] Removing zone configuration`);
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {

        alloc.min_size = -1;
        alloc.natural_size = -1;

 /*       if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) {
            alloc.natural_size = Main.layoutManager.primaryMonitor.width;
        } */
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {

        alloc.min_size = -1;
        alloc.natural_size = -1;

/*        if (this.panelPosition == PanelLoc.left || this.panelPosition == PanelLoc.right) {
            alloc.natural_size = Main.layoutManager.primaryMonitor.height;
            alloc.natural_size = alloc.natural_size - this.toppanelHeight - this.bottompanelHeight - this.margin_top - this.margin_bottom;
        } */
    },

    /**
     * _calcBoxSizes:
     * @allocWidth (real): allocated total width
     * @allocHeight (real): allocated total height
     * @vertical (boolean): if on vertical panel
     *
     * Given the minimum and natural width requested by each box, this function
     * calculates how much width should actually allocated to each box. The
     * function returns two variables [@leftBoundary, @rightBoundary]
     *
     * The expected outcome of the code is as follows:
     *
     * Horizontal panels:
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
     * FIXME: consider replacing all of this with clutter constraints.  Fundamentally
     * we have three boxes constrained to be butted up against each other and to stretch
     * over the whole panel.  If the centre box is populated then it needs to be centred.
     * Any field has to be given a minimum size in edit mode to allow drag and drop.
     *
     * Returns (array): The left and right widths to be allocated.
     */
    _calcBoxSizes: function(allocWidth, allocHeight, vertical) {
        let leftBoundary, rightBoundary = 0;
        let leftMinWidth       = 0;
        let leftNaturalWidth   = 0;
        let rightMinWidth      = 0;
        let rightNaturalWidth  = 0;
        let centerMinWidth     = 0;
        let centerNaturalWidth = 0;

        if (vertical)
        {
            [leftMinWidth, leftNaturalWidth]     = this._leftBox.get_preferred_height(-1);
            [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_height(-1);
            [rightMinWidth, rightNaturalWidth]   = this._rightBox.get_preferred_height(-1);
        } else {
            [leftMinWidth, leftNaturalWidth]     = this._leftBox.get_preferred_width(-1);
            [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_width(-1);
            [rightMinWidth, rightNaturalWidth]   = this._rightBox.get_preferred_width(-1);
        }

        let centerBoxOccupied = this._centerBox.get_n_children() > 0;

        /* If panel edit mode, pretend central box is occupied and give it at
         * least a minimum width so that things can be dropped into it.
           Note that this has to be combined with the box being given Clutter.ActorAlign.FILL */
        if (this._panelEditMode) {
            centerBoxOccupied  = true;
            centerMinWidth     = Math.max(centerMinWidth, EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
            centerNaturalWidth = Math.max(centerNaturalWidth, EDIT_MODE_MIN_BOX_SIZE * global.ui_scale);
        }

        let totalMinWidth             = leftMinWidth + centerMinWidth + rightMinWidth;
        let totalNaturalWidth         = leftNaturalWidth + centerNaturalWidth + rightNaturalWidth;

        let sideMinWidth              = Math.max(leftMinWidth, rightMinWidth);
        let sideNaturalWidth          = Math.max(leftNaturalWidth, rightNaturalWidth);
        let totalCenteredMinWidth     = centerMinWidth + 2 * sideMinWidth;
        let totalCenteredNaturalWidth = centerNaturalWidth + 2 * sideNaturalWidth;

        let leftWidth, rightWidth;

        if (centerBoxOccupied) {
            if (totalCenteredNaturalWidth < allocWidth) {
                /* center the central box and butt the left and right up to it. */
                leftWidth  = (allocWidth - centerNaturalWidth) / 2;
                rightWidth = leftWidth;
            } else if (totalCenteredMinWidth < allocWidth) {
                /* Center can be centered as without shrinking things too much.
                 * First give everything the minWidth they want, and then
                 * distribute the remaining space proportional to how much the
                 * regions want. */
                let totalRemaining = allocWidth - totalCenteredMinWidth;
                let totalWant      = totalCenteredNaturalWidth - totalCenteredMinWidth;

                leftWidth = sideMinWidth + (sideNaturalWidth - sideMinWidth) / totalWant * totalRemaining;
                rightWidth = leftWidth;
            } else if (totalMinWidth < allocWidth) {
                /* There is enough space for minWidth if we don't care about
                 * centering. Make center things as center as possible */
                if (leftMinWidth > rightMinWidth) {
                    leftWidth = leftMinWidth;

                    if (leftMinWidth + centerNaturalWidth + rightNaturalWidth < allocWidth) {
                        rightWidth = allocWidth - leftMinWidth - centerNaturalWidth;
                    } else {
                        let totalRemaining = allocWidth - totalMinWidth;
                        let totalWant      = centerNaturalWidth + rightNaturalWidth - (centerMinWidth + rightMinWidth);

                        rightWidth = rightMinWidth;
                        if (totalWant > 0)
                            rightWidth += (rightNaturalWidth - rightMinWidth) / totalWant * totalRemaining;
                    }
                } else {
                    rightWidth = rightMinWidth;

                    if (rightMinWidth + centerNaturalWidth + leftNaturalWidth < allocWidth) {
                        leftWidth = allocWidth - rightMinWidth - centerNaturalWidth;
                    } else {
                        let totalRemaining = allocWidth - totalMinWidth;
                        let totalWant      = centerNaturalWidth + leftNaturalWidth - (centerMinWidth + leftMinWidth);

                        leftWidth = leftMinWidth;
                        if (totalWant > 0)
                            leftWidth += (leftNaturalWidth - leftMinWidth) / totalWant * totalRemaining;
                    }
                }
            } else {
                /* Scale everything down according to their minWidth. */
                leftWidth  = leftMinWidth / totalMinWidth * allocWidth;
                rightWidth = rightMinWidth / totalMinWidth * allocWidth;
            }
        } else {  // center box not occupied
            if (totalNaturalWidth < allocWidth) {
                /* Everything's fine. Allocate as usual. */
                if (vertical) {
                    leftWidth  = Math.max(leftNaturalWidth, leftMinWidth);
                    rightWidth = Math.max(rightNaturalWidth, rightMinWidth);
                } else {
                    leftWidth  = leftNaturalWidth;
                    rightWidth = rightNaturalWidth;
                }
            } else if (totalMinWidth < allocWidth) {
                /* There is enough space for minWidth but not for naturalWidth.
                 * Allocate the minWidth and then divide the remaining space
                 * according to how much more they want. */
                let totalRemaining = allocWidth - totalMinWidth;
                let totalWant      = totalNaturalWidth - totalMinWidth;

                leftWidth  = leftMinWidth + ((leftNaturalWidth - leftMinWidth) / totalWant) * totalRemaining;
                rightWidth = rightMinWidth + ((rightNaturalWidth - rightMinWidth) / totalWant) * totalRemaining;
            } else {
                /* Scale everything down according to their minWidth. */
                leftWidth  = leftMinWidth / totalMinWidth * allocWidth;
                rightWidth = rightMinWidth / totalMinWidth * allocWidth;
            }
        }

        leftBoundary  = Math.round(leftWidth);
        rightBoundary = Math.round(allocWidth - rightWidth);

        if (!vertical && (this.actor.get_direction() === St.TextDirection.RTL)) {
            leftBoundary  = Math.round(allocWidth - leftWidth);
            rightBoundary = Math.round(rightWidth);
        }

        return [leftBoundary, rightBoundary];
    },

    _setCornerChildbox: function(childbox, x1, x2, y1, y2) {
        childbox.x1 = x1;
        childbox.x2 = x2;
        childbox.y1 = y1;
        childbox.y2 = y2;
        return;
    },

    _setVertChildbox: function(childbox, y1, y2) {

        childbox.y1 = y1;
        childbox.y2 = y2;

        return;
    },

    _setHorizChildbox: function(childbox, x1, x2, x1_rtl, x2_rtl) {
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childbox.x1 = x1_rtl;
            childbox.x2 = x2_rtl;
        } else {
            childbox.x1 = x1;
            childbox.x2 = x2;
        }
        return;
    },

    _allocate: function(actor, box, flags) {

        let cornerMinWidth = 0;
        let cornerWidth = 0;
        let cornerMinHeight = 0;
        let cornerHeight = 0;

        let allocHeight  = box.y2 - box.y1;
        let allocWidth   = box.x2 - box.x1;

        /* Left, center and right panel sections will fit inside this box, which is
           equivalent to the CSS content-box (imaginary box inside borders and paddings) */
        let childBox = box.copy();

        /* The boxes are layout managers, so they rubber-band around their contents and have a few
           characteristics that they enforce on their contents.  Of particular note is that the alignment
           - LEFT, CENTER, RIGHT - is not independent of the fill as it probably ought to be, and that there
           is this hybrid FILL alignment that also comes with implied left alignment (probably locale dependent).
           Which is not a great problem when there is something in the box, but if there is nothing in the box and
           something other than FILL alignment is chosen, then the boxes will have no size allocated.
           Which is a bit of a bummer if you need to drag something into an empty box. So we need to work
           around this. That's a manual size set when turning on edit mode, combined with adjustments after drop.
           Note also that settings such as x_fill and y_fill only apply to the children of the box, not to the box itself */

        if (this.panelPosition == PanelLoc.left || this.panelPosition == PanelLoc.right) {

            /* Distribute sizes for the allocated height with points relative to
               the children allocation box, inside borders and paddings. */
            let [leftBoundary, rightBoundary] = this._calcBoxSizes(allocHeight, allocWidth, true);
            leftBoundary += box.y1;
            rightBoundary += box.y1;

            this._setVertChildbox (childBox, box.y1, leftBoundary);
            this._leftBox.allocate(childBox, flags);

            this._setVertChildbox (childBox, leftBoundary, rightBoundary);
            this._centerBox.allocate(childBox, flags);

            this._setVertChildbox (childBox, rightBoundary, box.y2);
            this._rightBox.allocate(childBox, flags);

            // Corners are in response to a bit of optional css and are about painting corners just outside the panels so as to create a seamless
            // visual impression for windows with curved corners
            // So ... top left corner wants to be at the bottom left of the top panel. top right wants to be in the correspondingplace on the right
            // Bottom left corner wants to be at the top left of the bottom panel.  bottom right in the corresponding place on the right
            // No panel, no corner necessary.
            // If there are vertical panels as well then we want to shift these in by the panel width
            // If there are vertical panels but no horizontal then the corners are top right and left to right of left panel,
            // and same to left of right panel

            if (this.drawcorner[0]) {
                [cornerMinWidth, cornerWidth]   = this._leftCorner.actor.get_preferred_width(-1);
                [cornerMinHeight, cornerHeight] = this._leftCorner.actor.get_preferred_height(-1);
                if (this.panelPosition === PanelLoc.left) { // left panel
                    this._setCornerChildbox(childBox, box.x2, box.x2+cornerWidth, 0, cornerWidth);
                } else { // right panel
                    this._setCornerChildbox(childBox, box.x1-cornerWidth, box.x1, 0, cornerWidth);
                }
                this._leftCorner.actor.allocate(childBox, flags);
            }

            if (this.drawcorner[1]) {
                [cornerMinWidth, cornerWidth]   = this._rightCorner.actor.get_preferred_width(-1);
                [cornerMinHeight, cornerHeight] = this._rightCorner.actor.get_preferred_height(-1);
                if (this.panelPosition === PanelLoc.left) { // left panel
                    this._setCornerChildbox(childBox, box.x2, box.x2+cornerWidth, this.actor.height-cornerHeight, this.actor.height);
                } else { // right panel
                    this._setCornerChildbox(childBox, box.x1-cornerWidth, box.x1, this.actor.height-cornerHeight, this.actor.height);
                }
                this._rightCorner.actor.allocate(childBox, flags);
            }

        } else {           // horizontal panel

            /* Distribute sizes for the allocated width with points relative to
               the children allocation box, inside borders and paddings. */
            let [leftBoundary, rightBoundary] = this._calcBoxSizes(allocWidth, allocHeight, false);
            leftBoundary += box.x1;
            rightBoundary += box.x1;

            this._setHorizChildbox (childBox, box.x1, leftBoundary, leftBoundary, box.x2);
            this._leftBox.allocate(childBox, flags);

            this._setHorizChildbox (childBox, leftBoundary, rightBoundary, rightBoundary, leftBoundary);
            this._centerBox.allocate(childBox, flags);

            this._setHorizChildbox (childBox, rightBoundary, box.x2, box.x1, rightBoundary);
            this._rightBox.allocate(childBox, flags);

            if (this.drawcorner[0]) {
                [cornerMinWidth, cornerWidth]   = this._leftCorner.actor.get_preferred_width(-1);
                [cornerMinHeight, cornerHeight] = this._leftCorner.actor.get_preferred_height(-1);
                if (this.panelPosition === PanelLoc.top) { // top panel
                    this._setCornerChildbox(childBox, 0, cornerWidth, box.y2, box.y2+cornerHeight);
                } else { // bottom panel
                    this._setCornerChildbox(childBox, 0, cornerWidth, box.y1-cornerHeight, box.y2);
                }
                this._leftCorner.actor.allocate(childBox, flags);
            }

            if (this.drawcorner[1]) {
                [cornerMinWidth, cornerWidth]   = this._rightCorner.actor.get_preferred_width(-1);
                [cornerMinHeight, cornerHeight] = this._rightCorner.actor.get_preferred_height(-1);
                if (this.panelPosition === PanelLoc.top) { // top panel
                  this._setCornerChildbox(childBox, this.actor.width-cornerWidth, this.actor.width, box.y2, box.y2+cornerHeight);
                } else { // bottom panel
                  this._setCornerChildbox(childBox, this.actor.width-cornerWidth, this.actor.width, box.y1-cornerHeight, box.y1);
                }
                this._rightCorner.actor.allocate(childBox, flags);
            }
        }
    },

    /**
     * _updatePanelVisibility:
     *
     * Checks whether the panel should show based on the autohide settings and
     * position of mouse/active window. It then calls the _queueShowHidePanel
     * function to show or hide the panel as necessary.
     *
     * true = autohide, false = always show, intel = Intelligent
     */
    _updatePanelVisibility: function() {
        if (this._panelEditMode || this._peeking)
            this._shouldShow = true;
        else {
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
                    let x, y;

                    /* Calculate the x or y instead of getting it from the actor since the
                    * actor might be hidden*/
                    switch (this.panelPosition) {
                        case PanelLoc.top:
                            y = this.monitor.y;
                            break;
                        case PanelLoc.bottom:
                            y = this.monitor.y + this.monitor.height - this.actor.height;
                            break;
                        case PanelLoc.left:
                            x = this.monitor.x;
                            break;
                        case PanelLoc.right:
                            x = this.monitor.x + this.monitor.width - this.actor.width;
                            break;
                        default:
                            global.log("updatePanelVisibility - unrecognised panel position "+this.panelPosition);
                    }

                    let a = this.actor;
                    let b = global.display.focus_window.get_compositor_private();
                    /* Magic to check whether the panel position overlaps with the
                    * current focused window */
                    if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) {
                        this._shouldShow = !(Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) &&
                                            Math.max(y, b.y) < Math.min(y + a.height, b.y + b.height));
                    } else {
                        this._shouldShow = !(Math.max(x, b.x) < Math.min(x + a.width, b.x + b.width) &&
                                            Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height));
                    }

            } // end of switch on autohidesettings
        }

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

        // setup panel tween - slide in from edge of monitor
        // if horizontal panel, animation on y. if vertical, animation on x.
        let isHorizontal = this.panelPosition == PanelLoc.top
                           || this.panelPosition == PanelLoc.bottom;
        let animationTime = AUTOHIDE_ANIMATION_TIME;
        let panelParams = { time: animationTime,
                            transition: 'easeOutQuad' };

        // set up original and destination positions and add tween
        // destination parameter
        let origPos, destPos;
        if (isHorizontal) {
            let height = this.actor.get_height();
            if (this.panelPosition == PanelLoc.top) {
                destPos = this.monitor.y;
                origPos = this.monitor.y - height;
            } else {
                destPos = this.monitor.y + this.monitor.height - height;
                origPos = this.monitor.y + this.monitor.height;
            }
            panelParams['y'] = destPos;
        } else {
            let width = this.actor.get_width();
            if (this.panelPosition == PanelLoc.left) {
                destPos = this.monitor.x;
                origPos = this.monitor.x - width;
            } else {
                destPos = this.monitor.width - width + this.monitor.x;
                origPos = this.monitor.width + this.monitor.x;
            }
            panelParams['x'] = destPos;
        }

        // setup onUpdate tween parameter to set the actor clip region during animation.
        panelParams['onUpdateParams'] = [origPos];
        panelParams['onUpdate'] =
            Lang.bind(this, function(origPos) { this._setClipRegion(false, origPos); });

        // setup boxes tween - fade in as panel slides
        let boxParams = { opacity: 255,
                          time: animationTime+0.2,
                          transition: 'easeOutQuad' };

        // show boxes and add tweens
        this._leftBox.show();
        this._centerBox.show();
        this._rightBox.show();
        Tweener.addTween(this.actor, panelParams);
        Tweener.addTween(this._leftBox, boxParams);
        Tweener.addTween(this._centerBox, boxParams);
        Tweener.addTween(this._rightBox, boxParams);

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
        if (this._destroyed) return;
        this._showHideTimer = 0;

        if ((this._shouldShow && !force) || global.menuStackLength > 0) return;

        // setup panel tween - slide out the monitor edge leaving one pixel
        // if horizontal panel, animation on y. if vertical, animation on x.
        let isHorizontal = this.panelPosition == PanelLoc.top
                         || this.panelPosition == PanelLoc.bottom;
        let animationTime = AUTOHIDE_ANIMATION_TIME;
        let panelParams = { time: animationTime,
                            transition: 'easeOutQuad' };

        // setup destination position and add tween destination parameter
        // remember to always leave a vestigial 1px strip or the panel
        // will become inaccessible
        let destPos;
        if (isHorizontal) {
            let height = this.actor.get_height();
            if (this.panelPosition == PanelLoc.top)
                destPos = this.monitor.y - height + 1;
            else
                destPos = this.monitor.y + this.monitor.height - 1;
            panelParams['y'] = destPos;
        } else {
            let width = this.actor.get_width();
            if (this.panelPosition == PanelLoc.left)
                destPos = this.monitor.x - width + 1;
            else
                destPos = this.monitor.x + this.monitor.width - 1;
            panelParams['x'] = destPos;
        }

        // setup onUpdate tween parameter to update the actor clip region during animation
        panelParams['onUpdateParams'] = [destPos];
        panelParams['onUpdate'] =
            Lang.bind(this, function(destPos) { this._setClipRegion(true, destPos); });

        // hide boxes after panel slides out
        panelParams['onComplete'] =
            Lang.bind(this, function() {
               this._leftBox.hide();
               this._centerBox.hide();
               this._rightBox.hide();
            });

        // setup boxes tween - fade out as panel slides out
        let boxParams = { opacity: 0,
                          time: Math.max(0, animationTime - 0.1),
                          transition: 'easeOutQuad' };

        // add all tweens
        Tweener.addTween(this.actor, panelParams);
        Tweener.addTween(this._leftBox, boxParams);
        Tweener.addTween(this._centerBox, boxParams);
        Tweener.addTween(this._rightBox, boxParams);

        this._hidden = true;
    },

    getIsVisible: function() {
        return this._shouldShow;
    },

    resetDNDZones: function() {
        this._leftBoxDNDHandler.reset();
        this._centerBoxDNDHandler.reset();
        this._rightBoxDNDHandler.reset();
    }
};

Signals.addSignalMethods(Panel.prototype);
