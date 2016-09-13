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
};

const CornerType = {
    topleft : 0,
    topright : 1,
    bottomleft : 2,
    bottomright : 3,
    dummy : 4
};

const PanelLoc = {
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

    for (let i in listofpanels) {
        if (listofpanels[i]) {
            if (listofpanels[i].monitorIndex == monitorIndex) {
                if (listofpanels[i].panelPosition == PanelLoc.top)
                    toppanelHeight = listofpanels[i].actor.height;
                if (listofpanels[i].panelPosition == PanelLoc.bottom)
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
        for (let i in panelProperties) {
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
        for (let i in panelProperties) {
            let elements = panelProperties[i].split(":");
            if (elements.length != 3) {
                global.log("Invalid panel definition: " + panelProperties[i]);
                continue;
            }
            let jj = getPanelLocFromName(elements[2]);  // panel orientation

            monitor = parseInt(elements[1]);

            panels_used[monitor][jj] =  true;

            stash[i] = [parseInt(elements[0]),monitor,jj]; // load what we are going to use to call loadPanel into an array
        }

        //
        // Ensure that any borders and shadow fall naturally when mixing horizontal and vertical panels.
        // The natural order to load panels so that the shadow on the panels falls correctly on other panels is bottom, sides, top
        //
        // Draw corners where necessary.  NB no corners necessary where there is no panel for a full screen window to butt up against.
        // logic for loading up panels in the right order and drawing corners relies on ordering by monitor
        // Corners will go on the left and right panels if there are any, else on the top and bottom
        // corner drawing parameters passed are left, right for horizontals, top, bottom for verticals.
        //
        // panel corners are optional and not used in many themes. However there is no measurable gain in trying to suppress them
        // if the theme does not have them

        for (let i = 0; i <= monitorCount; i++) {

            for (let j in stash) {
                let drawcorner = [false,false];
                if (stash[j][2] == PanelLoc.bottom && stash[j][1] == i) {
                    drawcorner[0] = (panels_used[i][2])? false : true;
                    drawcorner[1] = (panels_used[i][3])? false : true;
                    this._loadPanel(stash[j][0], stash[j][1], stash[j][2], drawcorner);
                }
            }
            let pleft;
            for (let j in stash) {
                if (stash[j][2] == PanelLoc.left && stash[j][1] == i)
                    pleft = this._loadPanel(stash[j][0], stash[j][1], stash[j][2], [true,true]);
            }
            let pright;
            for (let j in stash) {
                if (stash[j][2] == PanelLoc.right && stash[j][1] == i)
                    pright = this._loadPanel(stash[j][0], stash[j][1], stash[j][2], [true,true]);
            }
            for (let j in stash) {
                let drawcorner = [false,false];
                if (stash[j][2] == PanelLoc.top && stash[j][1] == i) {
                    drawcorner[0] = (panels_used[i][2])? false : true;
                    drawcorner[1] = (panels_used[i][3])? false : true;
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
        for (let i in this.panels) {
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
     * lowerActorBelowPanels:
     * @actor (ClutterActor): actor to stack below the panels
     *
     * Lowers actor to just under the panel actors
     */
    lowerActorBelowPanels: function(actor, group) {
        for (let i in this.panels) {
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

        for (let i in list) {
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
        for (let i in this.dummyPanels) {
            if (this.dummyPanels[i][0]) this.dummyPanels[i][0].destroy();
            if (this.dummyPanels[i][1]) this.dummyPanels[i][1].destroy();
            if (this.dummyPanels[i][2]) this.dummyPanels[i][2].destroy();
            if (this.dummyPanels[i][3]) this.dummyPanels[i][3].destroy();
            delete this.dummyPanels[i][0];
            delete this.dummyPanels[i][1];
            delete this.dummyPanels[i][2];
            delete this.dummyPanels[i][3];
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
     * @panelPosition (integer): where the panel is added
     *
     * Gets a specific panel in monitor @monitorIndex 
     *
     * Returns: the panel required (null if panel not found)
     */
    getPanel: function(monitorIndex, panelPosition) {
        for (let i in this.panels) {
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
        for (let i in metaList) {
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

        return panelList[ID];
    },

    _checkCanAdd: function() {
        let monitorCount = global.screen.get_n_monitors();
        let panelCount = monitorCount * 4;          // max of 4 panels on a monitor, one per edge

        for (let i in this.panelsMeta) {
            if (this.panelsMeta[i][0] >= monitorCount)  // Monitor does not exist
                continue;
            panelCount --;
        }

        if (this.canAdd != (panelCount != 0)) {
            this.canAdd = (panelCount != 0);
        }
    },

    _updateAllPointerBarriers: function() {
        for (let i in this.panels) {
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
        for (let i in this.panels)
            if (this.panels[i]) {
                this.panels[i].destroy();
                delete this.panels[i];
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
        for (let i in this.panels) {
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
        for (let i in panelProperties) {
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
        for (let i in panelProperties) {
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
            for (let j in stash) {
                let drawcorner = [false,false];
                if (stash[j][2] == PanelLoc.bottom && stash[j][1] == i) {
                    drawcorner[0] = (panels_used[i][2])? false : true;
                    drawcorner[1] = (panels_used[i][3])? false : true;
                    if (this.panels[stash[j][0]]) {  // panel will not have loaded if previous monitor disconnected etc.
                        this.panels[stash[j][0]].drawcorner = drawcorner;
                        this.panels[stash[j][0]].drawCorners(drawcorner);
                    }
                }
            }
            for (let j in stash) {
                if (stash[j][2] == PanelLoc.left && stash[j][1] == i) {
                    if (this.panels[stash[j][0]]) {
                        this.panels[stash[j][0]].drawcorner = [true,true];
                        this.panels[stash[j][0]].drawCorners([true,true]);
                    }
                }
            }
            for (let j in stash) {
                if (stash[j][2] == PanelLoc.right && stash[j][1] == i) {
                    if (this.panels[stash[j][0]]) {
                        this.panels[stash[j][0]].drawcorner = [true,true];
                        this.panels[stash[j][0]].drawCorners([true,true]);
                    }
                }
            }
            for (let j in stash) {
                let drawcorner = [false,false];
                if (stash[j][2] == PanelLoc.top && stash[j][1] == i) {
                    drawcorner[0] = (panels_used[i][2])? false : true;
                    drawcorner[1] = (panels_used[i][3])? false : true;
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
        let drawcorner = [false,false];

        for (let i in this.panelsMeta) {
            if (this.panelsMeta[i] && !this.panels[i]) { // If there is a meta but not a panel, i.e. panel could not create due to non-existent monitor, try again
                                                         // - the monitor may just have been reconnected
                if (this.panelsMeta[i][0] < monitorCount)  // just check that the monitor is there
                {
                    let panel = this._loadPanel(i, this.panelsMeta[i][0], this.panelsMeta[i][1], drawcorner);
                    if (panel)
                        AppletManager.loadAppletsOnPanel(panel);
                }
            } else if (this.panelsMeta[i][0] >= monitorCount) { // Monitor of the panel went missing.  Meta is [monitor,panel] array
                if (this.panels[i]) {
                    this.panels[i].destroy();
                    delete this.panels[i];
                }

            } else { // Nothing happens. Re-allocate panel
                this.panels[i]._moveResizePanel();
            }
        }

        if (this.addPanelMode) {
            this._destroyDummyPanels();
            this._showDummyPanels(this.dummyCallback);
        }

        for (let i in this.panels) {          // clear corners, then re add them
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

        while (this.dummyPanels.push([]) < monitorCount);   // Generate a 2D array of length monitorCount; Push returns new length of array

        for (let i in this.panelsMeta) {
            if (this.panelsMeta[i][0] >= monitorCount)      // Monitor does not exist
                continue;
            this.dummyPanels[this.panelsMeta[i][0]][this.panelsMeta[i][1]] = false; // every location where there is an actual existing panel is noted
        }

        for (let i = 0; i < monitorCount; i++) {
            for (let j = 0; j < 4; j++) {               // max of 4 panels per monitor - bottom. top, left, right
                if (this.dummyPanels[i][j] != false) {      // no panel there at the moment, so show a dummy
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
        let defaultheight = 25 * global.ui_scale;
        
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
        let button;

        if (rtlAwareContainer &&
            this._box.get_direction() == St.TextDirection.RTL) {
            if (this._side == St.Side.LEFT)
                side = St.Side.RIGHT;
            else if (this._side == St.Side.RIGHT)
                side = St.Side.LEFT;
        } // ?? why is there no similar logic for the LTR case ?

        if (side == St.Side.LEFT)
            button = this._findLeftmostButton(this._box);
        else if (side == St.Side.RIGHT)
            button = this._findRightmostButton(this._box);

        //
        // This section below is puzzling to me.  Appears to be linking the pseudo class of the corner
        // to the pseudo class of the closest applet.  Why ?  won't fire for vertical panels anyway
        // as these will have side set to TOP or BOTTOM
        //
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

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // separator line

    menu.addMenuItem(menu.troubleshootItem);

    let panelSettingsSection = new PopupMenu.PopupSubMenuMenuItem(_("Modify panel"));

    let menuItem = new PopupMenu.PopupIconMenuItem(_("Remove panel"), "list-remove", St.IconType.SYMBOLIC);  // submenu item remove panel
    menuItem.activate = Lang.bind(menu, function() {
        Main.panelManager.removePanel(panelId);
    });
    panelSettingsSection.menu.addMenuItem(menuItem);  

    menu.addPanelItem = new PopupMenu.PopupIconMenuItem(_("Add panel"), "list-add", St.IconType.SYMBOLIC); // submenu item add panel
    menu.addPanelItem.activate = Lang.bind(menu, function() {
        Main.panelManager.addPanelQuery();
        this.close();
    });
    panelSettingsSection.menu.addMenuItem(menu.addPanelItem);

    menu.movePanelItem = new PopupMenu.PopupIconMenuItem(_("Move panel"), "move", St.IconType.SYMBOLIC); // submenu item move panel
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
    panelSettingsSection.menu.addMenuItem(menu.copyAppletItem);  // submenu item copy applet config

    menu.pasteAppletItem = new PopupMenu.PopupIconMenuItem(_("Paste applet configuration"), "edit-paste", St.IconType.SYMBOLIC);
    menu.pasteAppletItem.activate = Lang.bind(menu, function() {
        let dialog = new ModalDialog.ConfirmDialog(
                _("Pasting applet configuration will remove all existing applets on this panel. Do you want to continue?") + "\n\n",
                Lang.bind(this, function() {
                    AppletManager.pasteAppletConfiguration(this.panelId);
                }));
        dialog.open();
    });
    panelSettingsSection.menu.addMenuItem(menu.pasteAppletItem); // submenu item paste applet config

    menu.clearAppletItem = new PopupMenu.PopupIconMenuItem(_("Clear all applets"), "edit-clear-all", St.IconType.SYMBOLIC);
    menu.clearAppletItem.activate = Lang.bind(menu, function() {
        let dialog = new ModalDialog.ConfirmDialog(
                _("Are you sure you want to clear all applets on this panel?") + "\n\n",
                Lang.bind(this, function() {
                    AppletManager.clearAppletConfiguration(this.panelId);
                }));
        dialog.open();
    });

    panelSettingsSection.menu.addMenuItem(menu.clearAppletItem);  // submenu item clear all applets

    menu.addMenuItem(panelSettingsSection);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

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

        let panelstyle = this._panelZone.get_parent().get_style_class_name();
        let vertical_panel = (panelstyle.contains("panel-left") || panelstyle.contains("panel-right")) ? true : false;       

        let pos = 0;

        if (vertical_panel) {
            for (var i in children){
                //if (children[i] == this._dragPlaceholder.actor) continue;
                if (y > children[i].get_allocation_box().y1 + children[i].height / 2) pos = i;
            }
        } else {
            for (var i in children){
                //if (children[i] == this._dragPlaceholder.actor) continue;
                if (x > children[i].get_allocation_box().x1 + children[i].width / 2) pos = i;
            }
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
            if (vertical_panel) {
                this._dragPlaceholder.child.set_width (10);
                this._dragPlaceholder.child.set_height (20);
            } else {
                this._dragPlaceholder.child.set_width (20);
                this._dragPlaceholder.child.set_height (10);
            }

            this._panelZone.insert_child_at_index(this._dragPlaceholder.actor,
                                                  this._dragPlaceholderPos);

            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }

        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) { 

        if (!(source instanceof Applet.Applet)) return false;

//
//  We want to ensure that applets placed in a panel can be shown correctly
//  If the applet is of type Icon Applet then should be fine
//  otherwise we look to see if it has declared itself suitable
//
        if (source instanceof Applet.IconApplet) {
            ;
        }
        else {
            let displaylayout = source.getDisplayLayout();
            let panelstyle = this._panelZone.get_parent().get_style_class_name();

            if ((panelstyle.contains("panel-left") || panelstyle.contains("panel-right"))
                &&
                displaylayout == Applet.DisplayLayout.HORIZONTAL) {
                    global.log("applet not suitable for panel");
                    return false;
            }
            else if ((panelstyle.contains("panel-top") || panelstyle.contains("panel-bottom"))
                &&
                displaylayout == Applet.DisplayLayout.VERTICAL) {
                    global.log("applet not suitable for panel");
                    return false;
            }
        }

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
 * @toppanelHeight (int): the height already taken on the screen by a top panel
 * @bottompanelHeight (int): the height already taken on the screen by a bottom panel
 * @drawcorner (array): [left, right] whether to draw corners alongside the panel
 *
 * @monitor (Meta.Rectangle): the geometry (bounding box) of the monitor
 * @panelPosition (integer): where the panel is on the screen 
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
        let horizontal_panel = (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) ? true : false;

        this._hidden = false;
        this._disabled = false;
        this._panelEditMode = false;
        this._autohideSettings = this._getProperty(PANEL_AUTOHIDE_KEY, "s");
        this._themeFontSize = null;
        this._destroyed = false;
        this._signalManager = new SignalManager.SignalManager(this);
        this.margin_top = 0;        // used by vertical panels
        this.margin_bottom = 0;     // ditto
        this.margin_left = 0;
        this.margin_right = 0;
        this._leftPanelBarrier = 0;
        this._rightPanelBarrier = 0;
        this._topPanelBarrier = 0;
        this._bottomPanelBarrier = 0;

        this.scaleMode = false;

        this.actor = new Cinnamon.GenericContainer({ name: 'panel', reactive: true });
        this.addPanelStyleClass(this.panelPosition);

        this.actor._delegate = this;

        this._menus = new PopupMenu.PopupMenuManager(this);

        if (horizontal_panel) {  // horizontal panels
            this._leftBox = new St.BoxLayout({ name: 'panelLeft', style_class: 'panelLeft'});
            this.actor.add_actor(this._leftBox);
            this._leftBoxDNDHandler = new PanelZoneDNDHandler(this._leftBox);

            this._centerBox = new St.BoxLayout({ name: 'panelCenter', style_class: 'panelCenter' });
            this.actor.add_actor(this._centerBox);
            this._centerBoxDNDHandler = new PanelZoneDNDHandler(this._centerBox);

            this._rightBox = new St.BoxLayout({ name: 'panelRight',  style_class: 'panelRight', align_end: true});
            this.actor.add_actor(this._rightBox);
            this._rightBoxDNDHandler = new PanelZoneDNDHandler(this._rightBox);

        } else {
            // vertical panels.  'leftBox' is at the top, 'rightBox' at the bottom.
            // nb align end property does not align to right side as for a box without 'vertical' set
            // - just orders applets from bottom rather than from top
            //
            // About the relative alignment of the panel contents when vertical ...  
            // using y_align: 3 (right) can cause allocation or json errors, so going without this on the 'rightBox' with a small 
            // central box (as the horizontal panels have their settings) the bottom icons come up towards the centre which looks dumb
            // 
            // Adding y_align: 2 (centre) on the central box kills the right click menu on the central box, but this can be 
            // worked around quite happily by adding a test on the actor to the pre-existing test on the parent of the actor 
            // in the button handling logic.  It also kills drag and drop if any box is empty, the workaround is to 
            // explicitly set the height.  Setting y_expand seems to align the contents to the top in this case, rather weird.
            //
            // Using x_align:2 also causes problems with a new, empty panel - seeming to stop the dndhandler working. There is a two part
            // workaround to this - in allocate to set heights if found to be zero, and the same in the set edit mode code.
            //
            // The approach taken is to
            // 1) keep the natural size of left and right (i.e. top and bottom) boxes, this means that the icons will cluster together
            //    at top and bottom of the panel respectively
            // 2) have a central box that can take all the space in between
            // 3) turn on central y-alignment for the central box
            // 4) there empty panel case is worked around with a kludge when setting edit mode to set box sizes explicitly if empty.
            //    - there is a similar work around in the allocate logic, but allocate may not get called without this kludge 
            //
            // The appearance of this looks reasonable - the icons in the boxes have sensible positioning
            // (css permitting). The central box  position will depend on the relative numbers of 
            // icons in the top and bottom boxes.
            //
            // Some workarounds for the side effects of the central alignment are needed.  
            //
            // a) allow the right click to work off the actor as well as its parent, this caters for the way that the central alignment
            //    seems to shrink the box down around its contents so as to expose the underlying panel.
            // b) set the height of the central box explicitly if found to be zero when in panel edit mode, and unset it otherwise.
            // c) set the sizes of zero height boxes explicitly when switching to edit mode to force an allocation to happen
            //

            if (this.panelPosition == PanelLoc.left) {   // left panel
                this._leftBox    = new St.BoxLayout({ name: 'panelLeft', style_class: 'panelLeft'});
                this._rightBox   = new St.BoxLayout({ name: 'panelLeft', style_class: 'panelLeft'});
            } else {
                this._leftBox    = new St.BoxLayout({ name: 'panelRight', style_class: 'panelRight'});
                this._rightBox   = new St.BoxLayout({ name: 'panelRight', style_class: 'panelRight'});
            }
            this._centerBox      = new St.BoxLayout({ name: 'panelCenter',  style_class: 'panelCenter'});
            this._set_vertical_panel_style();

            this.actor.add_actor(this._leftBox);
            this.actor.add_actor(this._centerBox);
            this.actor.add_actor(this._rightBox);

            this._leftBoxDNDHandler   = new PanelZoneDNDHandler(this._leftBox);
            this._centerBoxDNDHandler = new PanelZoneDNDHandler(this._centerBox);
            this._rightBoxDNDHandler  = new PanelZoneDNDHandler(this._rightBox);
        }

        this.drawCorners(drawcorner);

        this.addContextMenuToPanel(this.panelPosition);

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

        if (this._leftCorner)
            this.actor.add_actor(this._leftCorner.actor);
        if (this._rightCorner)
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

        if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) { // horizontal panels
            this._context_menu._boxPointer._container.connect('allocate', Lang.bind(this._context_menu._boxPointer, function(actor, box, flags){
                        this._xPosition = this._xpos;
                        this._shiftActor(); 
            }));
        } else {                           // vertical panels
            this._context_menu._boxPointer._container.connect('allocate', Lang.bind(this._context_menu._boxPointer, function(actor, box, flags){
                        this._yPosition = this._ypos;
                        this._shiftActor(); 
            }));
        }
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
     *
     * Destroys the panel
     */
    destroy: function() {
        if (this._destroyed) return;
        this._destroyed = true;    // set this early so that any routines triggered during
                                   // the destroy process can test it

        AppletManager.unloadAppletsOnPanel(this);
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
        if (!property) {
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
//
// For empty panels. If over left,right,center box then will not get here.
//
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
                    switch (this.panelPosition)
                    {
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
		    switch (this.panelPosition)
		    {
		        case PanelLoc.left:
		            panelLeft  = this.monitor.x;
		            panelRight = this.monitor.x + Math.floor(this.actor.width);
		            break;
		        case PanelLoc.right:
		            panelLeft  = this.monitor.x + this.monitor.width - Math.floor(this.actor.width);
		            panelRight = this.monitor.x + this.monitor.width-1;
		            break;
		        default:
		            global.log("updatePanelBarriers - unrecognised panel position "+panelPosition);
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

// This next section is a bit of a kludge
// For a new vertical panel 'allocate' may not get called when trying to drag an applet in, especially with central alignment.  
// This causes drop not to be available, meaning the panel can't be populated via this method.
// This section gives the boxes a minimum size to force an allocation

        if (this._panelEditMode == true && (this.panelPosition == PanelLoc.left || this.panelPosition == PanelLoc.right)) {
            if (this._centerBox.get_height() == 0) {
                this._centerBox.set_height(40);
            }
            if (this._leftBox.get_height() == 0) {
                this._leftBox.set_height(40);
            }
            if (this._rightBox.get_height() == 0) {
                this._rightBox.set_height(40);
            }
        }

        if (old_mode != this._panelEditMode) {
            this._processPanelAutoHide();
        }
    },

    _onButtonPressEvent: function (actor, event) {
        if (event.get_button() == 1) {
            if (this._context_menu.isOpen)
                this._context_menu.toggle();
        }
        if (event.get_button() == 3) {  // right click
            try {
                let [x, y] = event.get_coords();
                let xe = x;
                let ye = y;
                let target = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);

                // NB test on parent fails with centre aligned vertical box, but works for the test against the actor
                if (this._context_menu._getMenuItems().length > 0 &&
                   (target.get_parent() == this.actor || target == this.actor)) { 
                    this._context_menu.toggle();
                    if (!this._context_menu.isOpen)
                        return;

                    // This next section moves the context menu to the most appropriate position
                    // If the natural position for the context menu is off the panel or is cutting
                    // into the space taken up by another panel then it is moved inwards.

                    let monitor = Main.layoutManager.findMonitorForActor(this._context_menu._boxPointer.actor);

                    let topmargin=0;     // where we have mixed horizontal and vertical panels we want to avoid
                    let bottommargin=0;  // the popup menu overlapping any panel
                    let leftmargin=0;
                    let rightmargin=0;

                    let panels = Main.panelManager.getPanelsInMonitor(this.monitorIndex);

                    for (let panel of panels) {
                        if (panel.panelPosition == PanelLoc.top)
                            topmargin += panel.actor.height;
                        if (panel.panelPosition == PanelLoc.bottom)
                            bottommargin += panel.actor.height;
                        if (panel.panelPosition == PanelLoc.left)
                            leftmargin += panel.actor.width;
                        if (panel.panelPosition == PanelLoc.right)
                            rightmargin += panel.actor.width;
                    }

                    if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) { // top or bottom panels
                        x -= this._context_menu._boxPointer._arrowOrigin;

                        let mywidth = this._context_menu._boxPointer.actor.get_allocation_box().x2
                                     -this._context_menu._boxPointer.actor.get_allocation_box().x1;

                        if (x + mywidth - monitor.x > monitor.width - rightmargin) { // off right
                            x  = monitor.width + monitor.x - mywidth - rightmargin;
                            this._context_menu._boxPointer.setArrowOrigin(xe - x);
                        }
                        if (x < monitor.x + leftmargin) { // off left
                            x = monitor.x + leftmargin;
                            this._context_menu._boxPointer.setArrowOrigin(xe - leftmargin);
                        }
                        this._context_menu._boxPointer._xpos = Math.round(x);
                        this._context_menu._boxPointer._xPosition = this._context_menu._boxPointer._xpos;

                    } else {  // left or right panels
                        if (this.panelPosition == PanelLoc.left) {
                            x = monitor.x + this.actor.width;   // right hand edge of the left hand panel
                        }
                        else {
                            let mywidth = this._context_menu._boxPointer.actor.get_allocation_box().x2
                                     -this._context_menu._boxPointer.actor.get_allocation_box().x1;

                            x = monitor.x + monitor.width - this.actor.width - mywidth; //  left hand edge of the right hand panel
                        }
                        this._context_menu._boxPointer._xpos = Math.round(x);
                        this._context_menu._boxPointer._xPosition = this._context_menu._boxPointer._xpos;

                        y -= this._context_menu._boxPointer._arrowOrigin;

                        let myheight = this._context_menu._boxPointer.actor.get_allocation_box().y2
                                     - this._context_menu._boxPointer.actor.get_allocation_box().y1;

                        if (y + myheight - monitor.y > monitor.height - bottommargin) { // off bottom
                            y  = monitor.height + monitor.y - bottommargin - myheight;
                            this._context_menu._boxPointer.setArrowOrigin(ye - y);
                        }
                        if (y < monitor.y + topmargin) { // off top
                            y = monitor.y + topmargin;
                            this._context_menu._boxPointer.setArrowOrigin(ye - topmargin);
                        }

                        this._context_menu._boxPointer._ypos = Math.round(y);
                        this._context_menu._boxPointer._yPosition = this._context_menu._boxPointer._ypos;

                    }
                    this._context_menu._boxPointer._shiftActor();
                }
            } catch(e) {
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
     * _getScaledPanelHeight:
     *
     * Function to calculate the desired panel height
     *
     * returns : panelheight
     */
    _getScaledPanelHeight: function() {
        let panelHeight = 0;

        let panelResizable = this._getProperty(PANEL_RESIZABLE_KEY, "b");
        if (panelResizable) {
            panelHeight = this._getProperty(PANEL_HEIGHT_KEY, "i") * global.ui_scale;  // if manually scaled
        } else {
            let themeNode = this.actor.get_theme_node();
            panelHeight = themeNode.get_height();       // use theme value for height, note that this scales up with the ui_scale
            if (!panelHeight || panelHeight == 0) {     // no theme value, fall back to default
                panelHeight = 25 * global.ui_scale;
            }
        }

        return panelHeight;
    },

    /**
     * _moveResizePanel:
     *
     * Function to update the panel position and size according to settings
     * values.  Note that this is also called when the style changes.
     */
    _moveResizePanel: function() {

        if (this._destroyed)
            return false;

        this.monitor = global.screen.get_monitor_geometry(this.monitorIndex);
        let horizontal_panel = ((this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) ? true : false);

        let panelHeight = this._getScaledPanelHeight();
        this._setFont(panelHeight);

        let vertpanelHeight = 0;

        try {
            this.margin_top    = 0;
            this.margin_bottom = 0;
            this.margin_left   = 0;
            this.margin_right  = 0;
            let themeNode      = this.actor.get_theme_node();
            this.margin_top    = themeNode.get_length('margin-top');
            this.margin_bottom = themeNode.get_length('margin-bottom');
            this.margin_left   = themeNode.get_length('margin-left');
            this.margin_right  = themeNode.get_length('margin-right');
        } catch (e) {
            global.log(e);
        }
        //
        // set the height of the panel. To find the height available for the vertical panels we need to find out how
        // much has been used for the horizontal panels on this monitor.
        //
        this.toppanelHeight = 0;
        this.bottompanelHeight = 0;
        if (horizontal_panel) {
            this.actor.set_height(panelHeight); 
        } else {
            if (Main.panelManager)            // the panelManager has initialized
                [this.toppanelHeight, this.bottompanelHeight] = heightsUsedMonitor(this.monitorIndex, Main.panelManager.panels);
        
            vertpanelHeight = this.monitor.height - this.toppanelHeight - this.bottompanelHeight
                              - global.ui_scale*(this.margin_top + this.margin_bottom);
            this.actor.set_height(vertpanelHeight);
        }
        this._processPanelAutoHide();
        //
        // layouts set to be full width horizontal panels, and vertical panels set to use as much available space as is left 
        //
        // NB If you want to use margin to inset the panels within a monitor, then you can't just set it here
        // else full screen windows will then go right to the edge with the panels floating over
        //
        switch (this.panelPosition) {
            case PanelLoc.top:
                this.actor.set_size    (this.monitor.width - global.ui_scale*(this.margin_left+this.margin_right),
                                        panelHeight);
                this.actor.set_position(this.monitor.x + global.ui_scale*this.margin_left,
                                        this.monitor.y);
                break;
            case PanelLoc.bottom:
                this.actor.set_size    (this.monitor.width - global.ui_scale*(this.margin_left+this.margin_right),
                                        panelHeight);
                this.actor.set_position(this.monitor.x + global.ui_scale*this.margin_left,
                                        this.monitor.y + this.monitor.height - panelHeight);
                break;
            case PanelLoc.left:
                this.actor.set_size    (panelHeight,
                                        vertpanelHeight);
                this.actor.set_position(this.monitor.x,
                                        this.monitor.y + this.toppanelHeight + global.ui_scale*this.margin_top);
                break;
            case PanelLoc.right:
                this.actor.set_size    (panelHeight,
                                        vertpanelHeight);
                this.actor.set_position(this.monitor.x + this.monitor.width - panelHeight,
                                        this.monitor.y + this.toppanelHeight + global.ui_scale*this.margin_top);
                break;
            default:
                global.log("moveResizePanel - unrecognised panel position "+this.panelPosition);
        }
        this._updatePanelBarriers();   // only needed here for when this routine is called when the style changes

        //
        // If we are adjusting the heights of horizontal panels then the vertical ones on this monitor 
        // may need to be changed at the same time. 
        //
        if (horizontal_panel) {
            if (Main.panelManager) {            // the panelManager has initialized
                for (let i in Main.panelManager.panels) {
                    if (Main.panelManager.panels[i])
                        if ((Main.panelManager.panels[i].panelPosition == PanelLoc.left 
                        || Main.panelManager.panels[i].panelPosition == PanelLoc.right)
                        && Main.panelManager.panels[i].monitorIndex == this.monitorIndex)
                        Main.panelManager.panels[i]._moveResizePanel();
                }
            }
        }
        // AppletManager might not be initialized yet
        if (AppletManager.appletsLoaded)
            AppletManager.updateAppletPanelHeights(); 

        return true;
    },

    _set_orientation: function() {
    //
    // cater for the style/alignment for different panel orientations
    //
	if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom)
            this._set_horizontal_panel_style();
	else
            this._set_vertical_panel_style();
    },

    _set_vertical_panel_style: function() {

        if (this.panelPosition == PanelLoc.left) {
            this._leftBox.set_style_class_name('panelLeft');
            this._rightBox.set_style_class_name('panelLeft');
        } else {
            this._leftBox.set_style_class_name('panelRight');
            this._rightBox.set_style_class_name('panelRight');
        }
        this._rightBox.add_style_class_name('vertical');
        this._rightBox.set_align_end(false);
        this._rightBox.set_important(true);
        this._rightBox.set_vertical(true);
        this._rightBox.set_x_align(Clutter.ActorAlign.FILL);
        this._rightBox.set_x_expand(true);
        this._rightBox.set_y_align(Clutter.ActorAlign.END);

        this._leftBox.add_style_class_name('vertical');
        this._leftBox.set_important(true);
        this._leftBox.set_vertical(true);
        this._leftBox.set_x_align(Clutter.ActorAlign.FILL);
        this._leftBox.set_x_expand(true);
        this._leftBox.set_y_align(Clutter.ActorAlign.START);

        this._centerBox.add_style_class_name('vertical');
        this._centerBox.set_important(true);
        this._centerBox.set_vertical(true);
        this._centerBox.set_x_align(Clutter.ActorAlign.FILL);
        this._centerBox.set_y_align(Clutter.ActorAlign.CENTER); // if set to fill it snaps upwards
        this._centerBox.set_x_expand(true)
        this._centerBox.set_y_expand(true)
    },

    _set_horizontal_panel_style: function() {

        this._rightBox.remove_style_class_name('vertical');
        this._rightBox.set_vertical(false);
        this._rightBox.set_x_align(Clutter.ActorAlign.END);
        this._rightBox.set_y_align(Clutter.ActorAlign.CENTER);
        this._rightBox.set_align_end(true);

        this._leftBox.remove_style_class_name('vertical');
        this._leftBox.set_vertical(false);
        this._leftBox.set_x_align(Clutter.ActorAlign.START);
        this._leftBox.set_y_align(Clutter.ActorAlign.CENTER);

        this._centerBox.remove_style_class_name('vertical');
        this._centerBox.set_vertical(false);
        this._centerBox.set_x_align(Clutter.ActorAlign.CENTER);
        this._centerBox.set_y_align(Clutter.ActorAlign.CENTER);

        this._leftBox.set_style_class_name('panelLeft');
        this._rightBox.set_style_class_name('panelRight');
    },

    _setFont: function(panelHeight) {
        this.scaleMode = this._getProperty(PANEL_RESIZABLE_KEY, "b") && this._getProperty(PANEL_SCALE_TEXT_ICONS_KEY, "b");

        if (!this._themeFontSize) {
            let themeNode = this.actor.get_theme_node();
            this._themeFontSize = themeNode.get_length("font-size");
        }
        if (this.scaleMode) {
            let textheight = (panelHeight / Applet.DEFAULT_PANEL_HEIGHT) * Applet.PANEL_FONT_DEFAULT_HEIGHT;
            this.actor.set_style('font-size: ' + textheight / global.ui_scale + 'px;');
        } else {
            this.actor.set_style('font-size: ' + this._themeFontSize ? this._themeFontSize + 'px;' : '8.5pt;');
        }
    },

    _onScaleTextIconsChanged: function() {
        let panelHeight = this._getScaledPanelHeight();
        this._setFont(panelHeight);
        AppletManager.updateAppletPanelHeights(true);
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {

        alloc.min_size = -1;
        alloc.natural_size = -1;

        if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) {
            alloc.natural_size = Main.layoutManager.primaryMonitor.width;
        }
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {

        alloc.min_size = -1;
        alloc.natural_size = -1;

        if (this.panelPosition == PanelLoc.left || this.panelPosition == PanelLoc.right) {
            alloc.natural_size = Main.layoutManager.primaryMonitor.height;
            alloc.natural_size = alloc.natural_size - this.toppanelHeight - this.bottompanelHeight - this.margin_top - this.margin_bottom;
        }
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
     * Returns (array): The left and right widths to be allocated.
     */
    _calcBoxSizes: function(allocWidth, allocHeight, vertical) {
        let leftBoundary,rightBoundary = 0;
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
             * least width 25 so that things can be dropped into it */
        if (this._panelEditMode) {
            centerBoxOccupied  = true;
            centerMinWidth     = Math.max(centerMinWidth, 25);
            centerNaturalWidth = Math.max(centerNaturalWidth, 25);

            if (vertical) {  // a workaround if boxes in a vertical panel are emptied
                leftMinWidth     = Math.max(leftMinWidth, 25);
                leftNaturalWidth = Math.max(leftNaturalWidth, 25);
                rightMinWidth     = Math.max(rightMinWidth, 25);
                rightNaturalWidth = Math.max(rightNaturalWidth, 25);
            }
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
                if (vertical) {  // see comment in the routine called to create a new panel
                    leftWidth  = leftNaturalWidth;
                    rightWidth = rightNaturalWidth;
                } else {
                    /* center the central box and butt the left and right up to it. */
                    leftWidth  = (allocWidth - centerNaturalWidth) / 2;
                    rightWidth = leftWidth;
                }
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

        let leftBoundary  = Math.round(leftWidth);
        let rightBoundary = Math.round(allocWidth - rightWidth);

        if (this.actor.get_direction() == St.TextDirection.RTL) {
            leftBoundary  = allocWidth - leftWidth;
            rightBoundary = rightWidth;
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

    _setVertChildbox: function(childbox, y1, y2, y1_rtl, y2_rtl) {
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childbox.y1 = y1_rtl;
            childbox.y2 = y2_rtl;
        } else {
            childbox.y1 = y1;
            childbox.y2 = y2;
        }
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

        if (this.drawcorner[0]) {
            [cornerMinWidth, cornerWidth]   = this._leftCorner.actor.get_preferred_width(-1);
            [cornerMinHeight, cornerHeight] = this._leftCorner.actor.get_preferred_height(-1);
        }

        if (this.drawcorner[1]) {
            [cornerMinWidth, cornerWidth]   = this._rightCorner.actor.get_preferred_width(-1);
            [cornerMinHeight, cornerHeight] = this._rightCorner.actor.get_preferred_height(-1);
        }

        let allocHeight  = box.y2 - box.y1;
        let allocWidth   = box.x2 - box.x1;

        if (this.panelPosition == PanelLoc.left || this.panelPosition == PanelLoc.right) {

            [leftBoundary, rightBoundary] = this._calcBoxSizes(allocHeight, allocWidth, true); 
        
            let childBox = new Clutter.ActorBox();

            childBox.x1 = 0;
            childBox.x2 = allocWidth;
            this._setVertChildbox (childBox,0,leftBoundary,leftBoundary,allocHeight);
            this._leftBox.allocate(childBox, flags); //leftbox

            this._setVertChildbox (childBox,leftBoundary,rightBoundary,rightBoundary,leftBoundary);
            this._centerBox.allocate(childBox, flags);  //centerbox2

            this._setVertChildbox (childBox,rightBoundary,allocHeight,0,rightBoundary);
            this._rightBox.allocate(childBox, flags); // rightbox 

            // As using central y-align or x-align seems to result in zero size if the box is empty, force
            // to a defined size in edit mode if this happens
            // Force the width to max to stop the boxes shrinking in from the edge.  This needs resetting if the
            // panel orientation is moved to horizontal.  The logic in the horizontal case is analogous

            this._centerBox.set_width(allocWidth);
            this._leftBox.set_width(allocWidth);
            this._rightBox.set_width(allocWidth);
            this._centerBox.set_height(-1);
            this._leftBox.set_height(-1);
            this._rightBox.set_height(-1);

            if (this._panelEditMode) {
                if (this._centerBox.get_height() == 0) {
                   this._centerBox.set_height(rightBoundary - leftBoundary);
                }
                if (this._leftBox.get_height() == 0) {     // without this ...
                   this._leftBox.set_height(leftBoundary);
                }
                if (this._rightBox.get_height() == 0) {    // .. and this, the centre box contents will generally snap to the top in edit mode
                   this._rightBox.set_height(allocHeight - rightBoundary);
                }
            }

            // Corners are in response to a bit of optional css and are about painting corners just outside the panels so as to create a seamless 
            // visual impression for windows with curved corners 
            // So ... top left corner wants to be at the bottom left of the top panel. top right wants to be in the correspondingplace on the right 
            // Bottom left corner wants to be at the top left of the bottom panel.  bottom right in the corresponding place on the right
            // No panel, no corner necessary.
            // If there are vertical panels as well then we want to shift these in by the panel width
            // If there are vertical panels but no horizontal then the corners are top right and left to right of left panel, and same to left of right panel

            if (this.panelPosition == PanelLoc.left) { // left panel
                if (this.drawcorner[0]) {
                    this._setCornerChildbox(childBox, box.x2, box.x2+cornerWidth, box.y1, box.y1+cornerWidth);
                    this._leftCorner.actor.allocate(childBox, flags);
                }

                if (this.drawcorner[1]) {
                    this._setCornerChildbox(childBox, box.x2, box.x2+cornerWidth, box.y2-cornerHeight, box.y2);
                    this._rightCorner.actor.allocate(childBox, flags); 
                }
            }
            if (this.panelPosition == PanelLoc.right) {          // right panel
                if (this.drawcorner[0]) {
                    this._setCornerChildbox(childBox, box.x1-cornerWidth, box.x2, box.y1, box.y1+cornerWidth);
                    this._leftCorner.actor.allocate(childBox, flags); 
                }

                if (this.drawcorner[1]) {
                    this._setCornerChildbox(childBox, box.x1-cornerWidth, box.x2, box.y2-cornerHeight, box.y2);
                    this._rightCorner.actor.allocate(childBox, flags);
                }
            }
        } else {           // horizontal panel

            [leftBoundary, rightBoundary] = this._calcBoxSizes(allocWidth, allocHeight, false); 

            let childBox = new Clutter.ActorBox();

            childBox.y1 = 0;
            childBox.y2 = allocHeight;
            this._setHorizChildbox (childBox,0,leftBoundary,leftBoundary, allocWidth);
            this._leftBox.allocate(childBox, flags);

            this._setHorizChildbox (childBox,leftBoundary,rightBoundary,rightBoundary,leftBoundary);
            this._centerBox.allocate(childBox, flags);  //centerbox

            this._setHorizChildbox (childBox,rightBoundary,allocWidth,0,rightBoundary);
            this._rightBox.allocate(childBox, flags);

            this._centerBox.set_width(-1);
            this._leftBox.set_width(-1);
            this._rightBox.set_width(-1);
            this._centerBox.set_height(allocHeight);
            this._leftBox.set_height(allocHeight);
            this._rightBox.set_height(allocHeight);


            if (this._panelEditMode) {
                if (this._centerBox.get_width() == 0) { // a fallback
                   this._centerBox.set_width(40);
                }
            }

            if (this.panelPosition == PanelLoc.top) { // top panel
                if (this.drawcorner[0]) {
                    this._setCornerChildbox(childBox, 0, cornerWidth, allocHeight,allocHeight + cornerHeight );
                    this._leftCorner.actor.allocate(childBox, flags);
                }
                if (this.drawcorner[1]) {
                    this._setCornerChildbox(childBox, allocWidth - cornerWidth, allocWidth, allocHeight,allocHeight + cornerHeight );
                    this._rightCorner.actor.allocate(childBox, flags);
                }
            } else { // bottom
                if (this.drawcorner[0]) {
                    this._setCornerChildbox(childBox, 0,cornerWidth, box.y1 - cornerHeight, box.y2);
                    this._leftCorner.actor.allocate(childBox, flags);
                }
                if (this.drawcorner[1]) {
                    this._setCornerChildbox(childBox, allocWidth - cornerWidth, allocWidth, box.y1 - cornerHeight,box.y2 );
                    this._rightCorner.actor.allocate(childBox, flags);
                }
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
     * false = autohide, true = always show, intel = Intelligent
     */
    _updatePanelVisibility: function() {

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
                let y;

                /* Calculate the y instead of getting the actor y since the
                 * actor might be hidden*/
                switch (this.panelPosition) {
                    case PanelLoc.top:
                        y = this.monitor.y;
                        break;
                    case PanelLoc.bottom:
                        y = this.monitor.y + this.monitor.height - this.actor.height;
                        break;
                    case PanelLoc.left: 
                    case PanelLoc.right: 
                        y = this.monitor.y + this.toppanelHeight;
                        break;
                    default:
                        global.log("updatePanelVisibility - unrecognised panel position "+this.panelPosition);
                }

                let a = this.actor;
                let b = global.display.focus_window.get_compositor_private();
                /* Magic to check whether the panel position overlaps with the
                 * current focused window */
                this._shouldShow =
                    !(Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) &&
                      Math.max(y, b.y) < Math.min(y + a.height, b.y + b.height));
        } // end of switch on autohidesettings

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

        let animationTime = AUTOHIDE_ANIMATION_TIME;

        if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) { // horizontal panel, animation on y
            let height = this.actor.get_height();
            let y;
            switch (this.panelPosition) {
                case PanelLoc.top:
                    y = this.monitor.y; // target end position when y = 0
                    break;
                case PanelLoc.bottom:
                    y = this.monitor.y + this.monitor.height - height;
                    break;
            }

            // boxes
            this._leftBox.show();
            this._centerBox.show();
            this._rightBox.show();

            let jj;
            switch (this.panelPosition) {
                case PanelLoc.top: jj = this.monitor.y - height; break;
                case PanelLoc.bottom: jj = this.monitor.y + this.monitor.height; break; 
            }
            // panel
            Tweener.addTween(this.actor,
                            { y: y,
                            time: animationTime,
                            transition: 'easeOutQuad',
                            onUpdate: Lang.bind(this, function(origY, panelPosition) {
                                // Force the layout manager to update the input region
                                Main.layoutManager._chrome.updateRegions()

                                let height = Math.abs(this.actor.y - origY);
                                let y;
                                switch (panelPosition) {
                                    case PanelLoc.top:
                                        y = this.actor.height - height;
                                        break;
                                    case PanelLoc.bottom:
                                        y = 0;
                                        break;
                                }

                                this.actor.set_clip(0, y, this.monitor.width, height);
                            }),
                            onUpdateParams: [jj, this.panelPosition]
                            }); 
            // boxes - fade in as panel slides
            let params = { opacity: 255,
                           time: animationTime+0.2,
                           transition: 'easeOutQuad' };

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);
            // corners
            //let params = { y: height - 1,
            //                time: animationTime + 0.1,
            //                transition: 'easeOutQuad'
            //                };
            if (this._leftCorner) {
            //  this._leftCorner._repaint();
                //Tweener.addTween(this._leftCorner.actor, params);
            }
            if (this._rightCorner) {
            //  this._rightCorner._repaint();
                //Tweener.addTween(this._rightCorner.actor, params);
            }
        } else {  // vertical panel, animation on x
            let width = this.actor.get_width();
            let x;
            switch (this.panelPosition) {
                case PanelLoc.left: 
                    x = this.monitor.x; // target end position when x = 0
                    break;
                case PanelLoc.right: 
                    x = this.monitor.width - width + this.monitor.x;
                    break;
            }
            // corners
            //let params = { x: width - 1,
            //                time: animationTime + 0.1,
            //                transition: 'easeOutQuad'
            //                };

            // boxes
            this._leftBox.show();
            this._centerBox.show();
            this._rightBox.show();

            let jj;
            switch (this.panelPosition) {
                case PanelLoc.left: jj = this.monitor.x - width;
                case PanelLoc.right: jj = this.monitor.width + this.monitor.x;
            }
            // panel
            Tweener.addTween(this.actor,
                            { x: x,
                            time: animationTime,
                            transition: 'easeOutQuad',
                            onUpdate: Lang.bind(this, function(origX, panelPosition) {
                                // Force the layout manager to update the input region
                                Main.layoutManager._chrome.updateRegions()

                                let width = Math.abs(this.actor.x - origX);
                                let x;
                                switch (panelPosition) {
                                    case PanelLoc.left: 
                                        x = this.actor.width - width;
                                        break;
                                    case PanelLoc.right: 
                                        x = 0;
                                        break;
                                }
                                this.actor.set_clip(x, 0, width, this.monitor.height); 
                            }),
                            onUpdateParams: [jj, this.panelPosition]
                            }); 
            // boxes - fade in as panel slides
            let params = { opacity: 255,
                           time: animationTime + 0.2,
                           transition: 'easeOutQuad' };

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);
            if (this._leftCorner) {
                //this._leftCorner._repaint();
                //Tweener.addTween(this._leftCorner.actor, params);
            }
            if (this._rightCorner) {
                //this._rightCorner._repaint();
                //Tweener.addTween(this._rightCorner.actor, params);
            }
        }

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
        let animationTime = AUTOHIDE_ANIMATION_TIME;

        if (this.panelPosition == PanelLoc.top || this.panelPosition == PanelLoc.bottom) { // horizontal panels, animation on y
            let height = this.actor.get_height();
            let y;
            switch (this.panelPosition) {
                case PanelLoc.top:
                    y = this.monitor.y - height + 1;  // final position, note the +1 to leave a vestigial panel that can be entered to 
                    break;                // trigger showing the panel in autohide mode
                case PanelLoc.bottom:
                    y = this.monitor.y + this.monitor.height - 1;
                    break;
            }
            // panel        
            Tweener.addTween(this.actor, {
                y: y,
                time: animationTime,
                transition: 'easeOutQuad',
                onUpdate: Lang.bind(this, function(targetY, panelPosition) {
                    // Force the layout manager to update the input region
                    Main.layoutManager._chrome.updateRegions()

                    let height = Math.abs(this.actor.y - targetY) + 1;
                    let y;
                    switch (panelPosition) {
                        case PanelLoc.top:
                            y = this.actor.height - height;
                            break;
                        case PanelLoc.bottom:
                            y = 0;
                            break;
                    }

                    this.actor.set_clip(0, y, this.monitor.width, height);
                }),
                onComplete: Lang.bind(this, function() {
                    this._leftBox.hide();
                    this._centerBox.hide();
                    this._rightBox.hide();
                }),
                onUpdateParams: [y, this.panelPosition]
            });
        
            let params = { opacity: 0,
                           time: Math.max(0, animationTime - 0.1),
                           transition: 'easeOutQuad' };

            // corners
            //let params = { y: 0,
            //                time: animationTime,
            //                transition: 'easeOutQuad'
            //                };
    /*      if (this._leftCorner)
                Tweener.addTween(this._leftCorner.actor, params);
            if (this._rightCorner)
                Tweener.addTween(this._rightCorner.actor, params);
            // boxes - fade out as panel slides */

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);

        } else {  // vertical panels, animation on x
            let width = this.actor.get_width();
            let x;
            switch (this.panelPosition) {
                case PanelLoc.left:
                    x = this.monitor.x - width + 1;    // final position of vestigial panel, a one pixel strip at the edge
                    break;
                case PanelLoc.right: 
                    x = this.monitor.x + this.monitor.width - 1; 
                    break;
            }
            
            // panel
            Tweener.addTween(this.actor, {
                x: x,
                time: animationTime,
                transition: 'easeOutQuad',
                onUpdate: Lang.bind(this, function(targetX, panelPosition) {
                    // Force the layout manager to update the input region
                    Main.layoutManager._chrome.updateRegions()

                    let width = Math.abs(this.actor.x - targetX) + 1;  // note +1 to ensure one pixel remains at least after the clip
                    let x;
                    switch (panelPosition) {
                        case PanelLoc.left:
                            x = this.actor.width - width;
                            break;
                        case PanelLoc.right:
                            x = 0;
                         break;
                    }

                    this.actor.set_clip(x, 0, width, this.monitor.height);  //x offset of clip rectangle, y offset of clip rectangle, clip width, clip height
                }),
                onComplete: Lang.bind(this, function() {
                    this._leftBox.hide();
                    this._centerBox.hide();
                    this._rightBox.hide();
                }),
                onUpdateParams: [x, this.panelPosition]
            });

            let params = { opacity: 0,
                           time: Math.max(0, animationTime - 0.1),
                           transition: 'easeOutQuad' };
            // corners
            //let params = { x: 0,
            //                time: animationTime,
            //                transition: 'easeOutQuad'
            //                };
        /*  if (this._leftCorner)
                Tweener.addTween(this._leftCorner.actor, params);
            if (this._rightCorner)
                Tweener.addTween(this._rightCorner.actor, params);
            // boxes - fade out as panel slides */

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);
        }

        this._hidden = true;
    },
};
