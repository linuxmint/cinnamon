// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Signals = imports.signals;
const Util = imports.misc.util;
const Config = imports.misc.config;
const Layout = imports.ui.layout;
const Overview = imports.ui.overview;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Meta = imports.gi.Meta;



const PANEL_ICON_SIZE = 24;
const PANEL_ICON_DEFAULT_SIZE = 22;

const BUTTON_DND_ACTIVATION_TIMEOUT = 250;

const ANIMATED_ICON_UPDATE_TIMEOUT = 100;
const SPINNER_ANIMATION_TIME = 0.2;

const STANDARD_STATUS_AREA_ORDER = ['keyboard', 'volume', 'bluetooth', 'network', 'battery'];
const STANDARD_STATUS_AREA_CINNAMON_IMPLEMENTATION = {    
    'volume': imports.ui.status.volume.Indicator,
    'battery': imports.ui.status.power.Indicator,
    'keyboard': imports.ui.status.keyboard.XKBIndicator    
};

const PANEL_HEIGHT = 25;
const AUTOHIDE_ANIMATION_TIME = 0.2;
const TIME_DELTA = 1500;

if (Config.HAVE_BLUETOOTH)
    STANDARD_STATUS_AREA_CINNAMON_IMPLEMENTATION['bluetooth'] = imports.ui.status.bluetooth.Indicator;

try {
    STANDARD_STATUS_AREA_CINNAMON_IMPLEMENTATION['network'] = imports.ui.status.network.NMApplet;
} catch(e) {
    log('NMApplet is not supported. It is possible that your NetworkManager version is too old');
}

const GDM_STATUS_AREA_ORDER = ['a11y', 'display', 'keyboard', 'volume', 'battery', 'powerMenu'];
const GDM_STATUS_AREA_CINNAMON_IMPLEMENTATION = {
    'a11y': imports.ui.status.accessibility.ATIndicator,
    'volume': imports.ui.status.volume.Indicator,
    'battery': imports.ui.status.power.Indicator,
    'keyboard': imports.ui.status.keyboard.XKBIndicator,
    'powerMenu': imports.gdm.powerMenu.PowerMenuButton
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
        this._animations = St.TextureCache.get_default().load_sliced_image (global.datadir + '/theme/' + name, size, size);
        this.actor.set_child(this._animations);
    },

    _update: function() {
        this._animations.hide_all();
        this._animations.show();
        if (this._i && this._i < this._animations.get_n_children())
            this._animations.get_nth_child(this._i++).show();
        else {
            this._i = 1;
            if (this._animations.get_n_children())
                this._animations.get_nth_child(0).show();
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

        if (!(children[index].has_style_class_name('panel-menu')) &&
            !(children[index].has_style_class_name('panel-button')))
            return this._findRightmostButton(children[index]);

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

        if (!(children[index].has_style_class_name('panel-menu')) &&
            !(children[index].has_style_class_name('panel-button')))
            return this._findLeftmostButton(children[index]);

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
        this._centerBox = new St.BoxLayout({ name: 'panelCenter' });
        this.actor.add_actor(this._centerBox);
        this._rightBox = new St.BoxLayout({ name: 'panelRight' });
        this.actor.add_actor(this._rightBox);

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

        Main.statusIconDispatcher.connect('status-icon-added', Lang.bind(this, this._onTrayIconAdded));
        Main.statusIconDispatcher.connect('status-icon-removed', Lang.bind(this, this._onTrayIconRemoved));        
                                        
        this.actor.connect('leave-event', Lang.bind(this, this._hidePanel));
        this.actor.connect('enter-event', Lang.bind(this, this._showPanel));  
        global.settings.connect("changed::panel-autohide", Lang.bind(this, this._onPanelAutoHideChanged));      
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

        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = allocWidth - Math.min(Math.floor(sideWidth), leftNaturalWidth);
            childBox.x2 = allocWidth;
        } else {
            childBox.x1 = 0;
            childBox.x2 = Math.min(Math.floor(sideWidth), leftNaturalWidth);
        }
        this._leftBox.allocate(childBox, flags);

        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = rightNaturalWidth;
            childBox.x2 = childBox.x1 + centerNaturalWidth;
        } else {
            childBox.x1 = allocWidth - centerNaturalWidth - rightNaturalWidth;
            childBox.x2 = childBox.x1 + centerNaturalWidth;
        }
        this._centerBox.allocate(childBox, flags);

        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = 0;
            childBox.x2 = rightNaturalWidth;
        } else {
            childBox.x1 = allocWidth - rightNaturalWidth;
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
        if (Main.overview.visible || this._hideable == false || global.menuStackLength > 0) return;
        
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
