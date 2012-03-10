// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Applet = imports.ui.applet;
const DND = imports.ui.dnd;
const AppletManager = imports.ui.appletManager;

const PANEL_ICON_SIZE = 24;
const PANEL_ICON_DEFAULT_SIZE = 22;

const BUTTON_DND_ACTIVATION_TIMEOUT = 250;

const ANIMATED_ICON_UPDATE_TIMEOUT = 100;
const SPINNER_ANIMATION_TIME = 0.2;

const STANDARD_STATUS_AREA_ORDER = [];
const STANDARD_STATUS_AREA_CINNAMON_IMPLEMENTATION = {};

const PANEL_HEIGHT = 25;
const AUTOHIDE_ANIMATION_TIME = 0.2;
const TIME_DELTA = 1500;

const GDM_STATUS_AREA_ORDER = ['display', 'powerMenu'];
const GDM_STATUS_AREA_CINNAMON_IMPLEMENTATION = {        
    'powerMenu': imports.gdm.powerMenu.PowerMenuButton
};

const APPLETS_DROP_ANIMATION_TIME = 0.2;

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

    setText: function(text) {
        let children = this.actor.get_children();
        for (let i = 0; i < children.length; i++)
            children[i].set_text(text);
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
        while (!children[index].visible && index >= 0)
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
        while (!children[index].visible && index < children.length)
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

function PanelContextMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

PanelContextMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    
    _init: function(launcher, orientation) {    
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();                    
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


function Panel(bottomPosition) {
    this._init(bottomPosition);
}

Panel.prototype = {
    _init : function(bottomPosition) {
    	
        this.bottomPosition = bottomPosition;
        
    	this._hidden = false;
        this._hidetime = 0;              
        this._hideable = global.settings.get_boolean("panel-autohide");
    	
        this.actor = new Cinnamon.GenericContainer({ name: 'panel',
                                                  reactive: true });
        this.actor._delegate = this;

        

        this._statusArea = {};

        Main.overview.connect('shown', Lang.bind(this, function () {
            this.actor.add_style_class_name('in-overview');
        }));
        Main.overview.connect('hiding', Lang.bind(this, function () {
            this.actor.remove_style_class_name('in-overview');
        }));

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

        if (this.actor.get_direction() == St.TextDirection.RTL)
            this._leftCorner = new PanelCorner(this._rightBox, St.Side.LEFT);
        else
            this._leftCorner = new PanelCorner(this._leftBox, St.Side.LEFT);

        this.actor.add_actor(this._leftCorner.actor);

        if (this.actor.get_direction() == St.TextDirection.RTL)
            this._rightCorner = new PanelCorner(this._leftBox, St.Side.RIGHT);
        else
            this._rightCorner = new PanelCorner(this._rightBox, St.Side.RIGHT);
        this.actor.add_actor(this._rightCorner.actor);

        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

            
        /* right */
        if (global.session_type == Cinnamon.SessionType.GDM) {
            this._status_area_order = GDM_STATUS_AREA_ORDER;
            this._status_area_cinnamon_implementation = GDM_STATUS_AREA_CINNAMON_IMPLEMENTATION;
        } else {
            this._status_area_order = STANDARD_STATUS_AREA_ORDER;
            this._status_area_cinnamon_implementation = STANDARD_STATUS_AREA_CINNAMON_IMPLEMENTATION;
        }

        //Main.statusIconDispatcher.connect('status-icon-added', Lang.bind(this, this._onTrayIconAdded));
        //Main.statusIconDispatcher.connect('status-icon-removed', Lang.bind(this, this._onTrayIconRemoved));        
                                        
        this.actor.connect('leave-event', Lang.bind(this, this._leavePanel));
        this.actor.connect('enter-event', Lang.bind(this, this._enterPanel));  
        global.settings.connect("changed::panel-autohide", Lang.bind(this, this._onPanelAutoHideChanged));   
        
        //let orientation = St.Side.TOP;
        //if (bottomPosition) {
        //    orientation = St.Side.BOTTOM;
        //}
        
        //this._context_menu = new PanelContextMenu(this, orientation);
        //this._menus.addMenu(this._context_menu);   
        //this._context_menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Add applet")));
        
        //this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent)); 
        
        this._setDNDstyle();
        global.settings.connect("changed::panel-edit-mode", Lang.bind(this, this._setDNDstyle));   
    },
    
    _setDNDstyle: function() {
        if (global.settings.get_boolean("panel-edit-mode")) {
            this._leftBox.add_style_pseudo_class('dnd');
            this._centerBox.add_style_pseudo_class('dnd');
            this._rightBox.add_style_pseudo_class('dnd');
        }
        else {
            this._leftBox.remove_style_pseudo_class('dnd');
            this._centerBox.remove_style_pseudo_class('dnd');
            this._rightBox.remove_style_pseudo_class('dnd');
        }
    },    
            
    _onButtonReleaseEvent: function (actor, event) {                      
        if (event.get_button()==1){
            if (this._context_menu.isOpen) {
                this._context_menu.toggle(); 
            }            
        }
        if (event.get_button()==3){            
            if (this._context_menu._getMenuItems().length > 0) {
                this._context_menu.toggle();			
            }
        }
        return true;
    },
        
    _onPanelAutoHideChanged: function() {  
    	this._hideable = global.settings.get_boolean("panel-autohide");
    	if (this._hidden == true && this._hideable == false) {
    		this._showPanel();
    	}
    	if (this._hidden == false && this._hideable == true) {
    		this._hidePanel();
    	}
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
              
        let sideWidth = allocWidth - rightNaturalWidth - centerNaturalWidth;

        let childBox = new Clutter.ActorBox();

        let leftBoxBoundary = 0;
        let rightBoxBoundary = 0;

        childBox.y1 = 0;
        childBox.y2 = allocHeight;        
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = allocWidth - Math.max(Math.min(Math.floor(sideWidth), leftNaturalWidth), 25);
            childBox.x2 = allocWidth;
            leftBoxBoundary = childBox.x1;
        } else {
            childBox.x1 = 0;
            childBox.x2 = Math.max(Math.min(Math.floor(sideWidth), leftNaturalWidth), 25); // Min size for zone is 25px
            leftBoxBoundary = childBox.x2;
        }        
        this._leftBox.allocate(childBox, flags);        

        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = 0;
            childBox.x2 = Math.max(rightNaturalWidth, 25);
            rightBoxBoundary = childBox.x2;
        } else {
            childBox.x1 = allocWidth - Math.max(rightNaturalWidth, 25); // Min size for zone is 25px
            childBox.x2 = allocWidth;
            rightBoxBoundary = childBox.x1;
        }
        this._rightBox.allocate(childBox, flags);
        
        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = rightBoxBoundary;
            childBox.x2 = leftBoxBoundary;
        } else {
            childBox.x1 = leftBoxBoundary;
            childBox.x2 = rightBoxBoundary;
        }
        this._centerBox.allocate(childBox, flags);

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

    startStatusArea: function() {
        for (let i = 0; i < this._status_area_order.length; i++) {
            let role = this._status_area_order[i];
            let constructor = this._status_area_cinnamon_implementation[role];
            if (!constructor) {
                // This icon is not implemented (this is a bug)
                continue;
            }

            let indicator = new constructor();
            this.addToStatusArea(role, indicator, i);
        }
    },

    _insertStatusItem: function(actor, position) {
        let children = this._rightBox.get_children();
        let i;
        for (i = children.length - 1; i >= 0; i--) {
            let rolePosition = children[i]._rolePosition;
            if (position > rolePosition) {
                this._rightBox.insert_actor(actor, i + 1);
                break;
            }
        }
        if (i == -1) {
            // If we didn't find a position, we must be first
            this._rightBox.insert_actor(actor, 0);
        }
        actor._rolePosition = position;
    },

    addToStatusArea: function(role, indicator, position) {
        if (this._statusArea[role])
            throw new Error('Extension point conflict: there is already a status indicator for role ' + role);

        if (!(indicator instanceof PanelMenu.Button))
            throw new TypeError('Status indicator must be an instance of PanelMenu.Button');

        if (!position)
            position = 0;
        this._insertStatusItem(indicator.actor, position);
        this._menus.addMenu(indicator.menu);

        this._statusArea[role] = indicator;
        let destroyId = indicator.connect('destroy', Lang.bind(this, function(emitter) {
            this._statusArea[role] = null;
            emitter.disconnect(destroyId);
        }));

        return indicator;
    },

    _onTrayIconAdded: function(o, icon, role) {
        if (this._status_area_cinnamon_implementation[role]) {
            // This icon is legacy, and replaced by a Cinnamon version
            // Hide it
            return;
        }
        
        let hiddenIcons = ["network", "power", "keyboard", "gnome-settings-daemon", "volume", "bluetooth", "battery", "a11y"];
        
        if (hiddenIcons.indexOf(role) != -1 ) {  
            // We've got an applet for that          
            return;
        }

        //icon.height = PANEL_ICON_SIZE;        
        let buttonBox = new PanelMenu.ButtonBox({ style_class: 'panel-status-button' });
        let box = buttonBox.actor;
        box.add_actor(icon);

        this._insertStatusItem(box, this._status_area_order.indexOf(role));
        
        let themeNode = buttonBox.actor.get_theme_node();
        if (!themeNode.get_length('height')) icon.height = PANEL_ICON_DEFAULT_SIZE;
        else icon.height = themeNode.get_length('height');
    },

    _onTrayIconRemoved: function(o, icon) {
        let box = icon.get_parent();
        if (box && box._delegate instanceof PanelMenu.ButtonBox)
            box.destroy();
    },
    
    _enterPanel: function() {
        this.isMouseOverPanel = true;
        this._showPanel();
    },

    _leavePanel:function() {
        this.isMouseOverPanel = false;
        this._hidePanel();
    }, 
    
    _showPanel: function() {
        if (this._hidden == false) return;
        
        // Force the panel to be on top (hack to correct issues when switching workspace)
        Main.layoutManager._windowsRestacked();
        
        if (this.bottomPosition) {        
            let params = { y: PANEL_HEIGHT - 1,
                           time: AUTOHIDE_ANIMATION_TIME + 0.1,
                           transition: 'easeOutQuad'
                         };
     
            Tweener.addTween(this._leftCorner.actor, params);
            Tweener.addTween(this._rightCorner.actor, params);

            Tweener.addTween(this.actor.get_parent(),
                         { y: Main.layoutManager.bottomMonitor.y + Main.layoutManager.bottomMonitor.height - PANEL_HEIGHT,
                           time: AUTOHIDE_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onUpdate: function() {
                               // Force the layout manager to update the input region
                               Main.layoutManager._chrome.updateRegions()
                           }
                         });

            params = { opacity: 255,
                       time: AUTOHIDE_ANIMATION_TIME+0.2,
                       transition: 'easeOutQuad'
                     };

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);
        }
        else {
            let params = { y: PANEL_HEIGHT - 1,
                       time: AUTOHIDE_ANIMATION_TIME + 0.1,
                       transition: 'easeOutQuad'
                     };
 
            Tweener.addTween(this._leftCorner.actor, params);
            Tweener.addTween(this._rightCorner.actor, params);

            Tweener.addTween(this.actor.get_parent(),
                         { y: Main.layoutManager.primaryMonitor.y,
                           time: AUTOHIDE_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onUpdate: function() {
                               // Force the layout manager to update the input region
                               Main.layoutManager._chrome.updateRegions()
                           }
                         });

            params = { opacity: 255,
                       time: AUTOHIDE_ANIMATION_TIME+0.2,
                       transition: 'easeOutQuad'
                     };

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);
        }

        this._hidden = false;
    },
    
    _hidePanel: function() {
        if (Main.overview.visible || this._hideable == false || global.menuStackLength > 0 || this.isMouseOverPanel) return;
        
        // Force the panel to be on top (hack to correct issues when switching workspace)
        Main.layoutManager._windowsRestacked();

        if (this.bottomPosition) {  
            Tweener.addTween(this.actor.get_parent(),
                         { y: Main.layoutManager.bottomMonitor.y + Main.layoutManager.bottomMonitor.height - 1,
                           time: AUTOHIDE_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onUpdate: function() {
                               // Force the layout manager to update the input region
                               Main.layoutManager._chrome.updateRegions()
                           }
                         });

            let params = { y: 0,
                           time: AUTOHIDE_ANIMATION_TIME,
                           transition: 'easeOutQuad'
                         };

            Tweener.addTween(this._leftCorner.actor, params);
            Tweener.addTween(this._rightCorner.actor, params);

            params = { opacity: 0,
                       time: AUTOHIDE_ANIMATION_TIME - 0.1,
                       transition: 'easeOutQuad'
                     };

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);
        }
        else {
            Tweener.addTween(this.actor.get_parent(),
                     { y: Main.layoutManager.primaryMonitor.y - PANEL_HEIGHT + 1,
                       time: AUTOHIDE_ANIMATION_TIME,
                       transition: 'easeOutQuad',
                       onUpdate: function() {
                           // Force the layout manager to update the input region
                           Main.layoutManager._chrome.updateRegions()
                       }
                     });

            let params = { y: 0,
                           time: AUTOHIDE_ANIMATION_TIME,
                           transition: 'easeOutQuad'
                         };

            Tweener.addTween(this._leftCorner.actor, params);
            Tweener.addTween(this._rightCorner.actor, params);

            params = { opacity: 0,
                       time: AUTOHIDE_ANIMATION_TIME - 0.1,
                       transition: 'easeOutQuad'
                     };

            Tweener.addTween(this._leftBox, params);
            Tweener.addTween(this._centerBox, params);
            Tweener.addTween(this._rightBox, params);
        }

        this._hidden = true;
    },

};
