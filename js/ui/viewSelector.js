// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

function BaseTab(titleActor, pageActor, name, a11yIcon) {
    this._init(titleActor, pageActor, name, a11yIcon);
}

BaseTab.prototype = {
    _init: function(titleActor, pageActor, name, a11yIcon) {
        this.title = titleActor;
        this.page = new St.Bin({ child: pageActor,
                                 x_align: St.Align.START,
                                 y_align: St.Align.START,
                                 x_fill: true,
                                 y_fill: true,
                                 style_class: 'view-tab-page' });        

        this.visible = false;
    },

    show: function(animate) {
        this.visible = true;
        this.page.show();

        if (!animate)
            return;

        this.page.opacity = 0;
        Tweener.addTween(this.page,
                         { opacity: 255,
                           time: 0.1,
                           transition: 'easeOutQuad' });
    },

    hide: function() {
        this.visible = false;
        Tweener.addTween(this.page,
                         { opacity: 0,
                           time: 0.1,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this,
                               function() {
                                   this.page.hide();
                               })
                         });
    },

    _a11yFocus: function() {
        this._activate();
        this.page.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
    },

    _activate: function() {
        this.emit('activated');
    }
};
Signals.addSignalMethods(BaseTab.prototype);


function ViewTab(id, label, pageActor, a11yIcon) {
    this._init(id, label, pageActor, a11yIcon);
}

ViewTab.prototype = {
    __proto__: BaseTab.prototype,

    _init: function(id, label, pageActor, a11yIcon) {
        this.id = id;

        let titleActor = new St.Button({ label: label,
                                         style_class: 'view-tab-title' });
        titleActor.connect('clicked', Lang.bind(this, this._activate));

        BaseTab.prototype._init.call(this, titleActor, pageActor, label, a11yIcon);
    }
};

function ViewSelector() {
    this._init();
}

ViewSelector.prototype = {
    _init : function() {
        this.actor = new St.BoxLayout({ name: 'viewSelector',
                                        vertical: true });

        // The tab bar is located at the top of the view selector and
        // holds "normal" tab labels.
        this._tabBar = new Cinnamon.GenericContainer();
  /*      this._tabBar.connect('get-preferred-width',
                             Lang.bind(this, this._getPreferredTabBarWidth));
        this._tabBar.connect('get-preferred-height',
                             Lang.bind(this, this._getPreferredTabBarHeight));
        this._tabBar.connect('allocate',
                             Lang.bind(this, this._allocateTabBar));*/
        this.actor.add(this._tabBar);

        // Box to hold "normal" tab labels
        this._tabBox = new St.BoxLayout({ name: 'viewSelectorTabBar' });
        this._tabBar.add_actor(this._tabBox);
        
        // The page area holds the tab pages. Every page is given the
        // area's full allocation, so that the pages would appear on top
        // of each other if the inactive ones weren't hidden.
        this._pageArea = new Cinnamon.Stack();
        this.actor.add(this._pageArea, { x_fill: true,
                                         y_fill: true,
                                         expand: true });

        this._tabs = [];
        this._activeTab = null;       

        Main.overview.connect('item-drag-begin',
                              Lang.bind(this, this._switchDefaultTab));

        this._stageKeyPressId = 0;
        Main.overview.connect('showing', Lang.bind(this,
            function () {
                this._switchDefaultTab();
                this._stageKeyPressId = global.stage.connect('key-press-event',
                                                             Lang.bind(this, this._onStageKeyPress));
            }));
        Main.overview.connect('hiding', Lang.bind(this,
            function () {
                this._switchDefaultTab();
                if (this._stageKeyPressId != 0) {
                    global.stage.disconnect(this._stageKeyPressId);
                    this._stageKeyPressId = 0;
                }
            }));

        // Public constraints which may be used to tie actors' height or
        // vertical position to the current tab's content; as the content's
        // height and position depend on the view selector's style properties
        // (e.g. font size, padding, spacing, ...) it would be extremely hard
        // and ugly to get these from the outside. While it would be possible
        // to use position and height properties directly, outside code would
        // need to ensure that the content is properly allocated before
        // accessing the properties.
        this.constrainY = new Clutter.BindConstraint({ source: this._pageArea,
                                                       coordinate: Clutter.BindCoordinate.Y });
        this.constrainHeight = new Clutter.BindConstraint({ source: this._pageArea,
                                                            coordinate: Clutter.BindCoordinate.HEIGHT });
    },

    _addTab: function(tab) {
        tab.page.hide();
        this._pageArea.add_actor(tab.page);
        tab.connect('activated', Lang.bind(this, function(tab) {
            this._switchTab(tab);
        }));
    },

    addViewTab: function(id, title, pageActor, a11yIcon) {
        let viewTab = new ViewTab(id, title, pageActor, a11yIcon);
        this._tabs.push(viewTab);
        this._tabBox.add(viewTab.title);
        this._addTab(viewTab);
    },

    _switchTab: function(tab) {
        let firstSwitch = this._activeTab == null;

        if (this._activeTab && this._activeTab.visible) {
            if (this._activeTab == tab)
                return;
            this._activeTab.title.remove_style_pseudo_class('selected');
            this._activeTab.hide();
        }

        
        tab.title.add_style_pseudo_class('selected');
        this._activeTab = tab;
        
        // Only fade when switching between tabs,
        // not when setting the initially selected one.
        if (!tab.visible)
            tab.show(!firstSwitch);

        // Pull a Meg Ryan:
        if (!firstSwitch && Main.overview.workspaces) {
            if (tab != this._tabs[0]) {
                Tweener.addTween(Main.overview.workspaces.actor,
                                 { opacity: 0,
                                   time: 0.1,
                                   transition: 'easeOutQuad',
                                   onComplete: Lang.bind(this,
                                       function() {
                                           Main.overview.workspaces.actor.hide();
                                           Main.overview.workspaces.actor.opacity = 255;
                                       })
                                });
            } else {
                Main.overview.workspaces.actor.opacity = 0;
                Main.overview.workspaces.actor.show();
                Tweener.addTween(Main.overview.workspaces.actor,
                                 { opacity: 255,
                                   time: 0.1,
                                   transition: 'easeOutQuad' });
            }
        }
    },

    switchTab: function(id) {
        for (let i = 0; i < this._tabs.length; i++)
            if (this._tabs[i].id == id) {
                this._switchTab(this._tabs[i]);
                break;
            }
    },

    _switchDefaultTab: function() {
        if (this._tabs.length > 0)
            this._switchTab(this._tabs[0]);
    },

    _nextTab: function() {
        if (this._tabs.length == 0 ||
            this._tabs[this._tabs.length - 1] == this._activeTab)
            return;

        for (let i = 0; i < this._tabs.length; i++)
            if (this._tabs[i] == this._activeTab) {
                this._switchTab(this._tabs[i + 1]);
                return;
            }
    },

    _prevTab: function() {
        if (this._tabs.length == 0 || this._tabs[0] == this._activeTab)
            return;

        for (let i = 0; i < this._tabs.length; i++)
            if (this._tabs[i] == this._activeTab) {
                this._switchTab(this._tabs[i - 1]);
                return;
            }
    },

    _getPreferredTabBarWidth: function(box, forHeight, alloc) {
        let children = box.get_children();
        for (let i = 0; i < children.length; i++) {
            let [childMin, childNat] = children[i].get_preferred_width(forHeight);
            alloc.min_size += childMin;
            alloc.natural_size += childNat;
        }
    },

    _getPreferredTabBarHeight: function(box, forWidth, alloc) {
        let children = box.get_children();
        for (let i = 0; i < children.length; i++) {
            let [childMin, childNatural] = children[i].get_preferred_height(forWidth);
            if (childMin > alloc.min_size)
                alloc.min_size = childMin;
            if (childNatural > alloc.natural_size)
                alloc.natural_size = childNatural;
        }
    },

    _allocateTabBar: function(container, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        
        let [barMinWidth, barNatWidth] = this._tabBox.get_preferred_width(-1);
        let childBox = new Clutter.ActorBox();
        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = allocWidth - barNatWidth;
            childBox.x2 = allocWidth;
        } else {
            childBox.x1 = 0;
            childBox.x2 = barNatWidth;
        }
        this._tabBox.allocate(childBox, flags);
   
        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function() {
                this.constrainY.offset = this.actor.y;
            }));
    },

    _onStageKeyPress: function(actor, event) {
        let modifiers = Cinnamon.get_event_state(event);
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.Escape) {
            Main.overview.hide();
            return true;
        } else if (modifiers & Clutter.ModifierType.CONTROL_MASK) {
            if (symbol == Clutter.Page_Up) {                
                this._prevTab();
                return true;
            } else if (symbol == Clutter.Page_Down) {                
                this._nextTab();
                return true;
            }
        } else if (Clutter.keysym_to_unicode(symbol)) {
            
        }
        return false;
    }

    
};
Signals.addSignalMethods(ViewSelector.prototype);
