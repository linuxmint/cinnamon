// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;

const Tweener = imports.ui.tweener;

const ANIMATION_TIME = 0.1;
const DISPLAY_TIMEOUT = 600;

const UP = -1;
const DOWN = 1;

function WorkspaceSwitcherPopup() {
    this._init();
}

WorkspaceSwitcherPopup.prototype = {
    _init : function() {
        this.actor = new St.Group({ reactive: true,
                                         x: 0,
                                         y: 0,
                                         width: global.screen_width,
                                         height: global.screen_height,
                                         style_class: 'workspace-switcher-group' });
        Main.uiGroup.add_actor(this.actor);

        this._container = new St.BoxLayout({ style_class: 'workspace-switcher-container' });
        this._list = new Shell.GenericContainer({ style_class: 'workspace-switcher' });
        this._itemSpacing = 0;
        this._childHeight = 0;
        this._childWidth = 0;
        this._list.connect('style-changed', Lang.bind(this, function() {
                                                        this._itemSpacing = this._list.get_theme_node().get_length('spacing');
                                                     }));

        this._list.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._list.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._list.connect('allocate', Lang.bind(this, this._allocate));
        this._container.add(this._list);

        this.actor.add_actor(this._container);

        this._redraw();

        this._position();

        this.actor.hide();

        this._timeoutId = Mainloop.timeout_add(DISPLAY_TIMEOUT, Lang.bind(this, this._onTimeout));
    },

    _getPreferredHeight : function (actor, forWidth, alloc) {
        let children = this._list.get_children();
        let primary = Main.layoutManager.primaryMonitor;

        let availHeight = primary.height;
        availHeight -= Main.panel.actor.height;
        availHeight -= this.actor.get_theme_node().get_vertical_padding();
        availHeight -= this._container.get_theme_node().get_vertical_padding();
        availHeight -= this._list.get_theme_node().get_vertical_padding();

        let height = 0;
        for (let i = 0; i < children.length; i++) {
            let [childMinHeight, childNaturalHeight] = children[i].get_preferred_height(-1);
            let [childMinWidth, childNaturalWidth] = children[i].get_preferred_width(childNaturalHeight);
            height += childNaturalHeight * primary.width / primary.height;
        }

        let spacing = this._itemSpacing * (global.screen.n_workspaces - 1);
        height += spacing;
        height = Math.min(height, availHeight);

        this._childHeight = (height - spacing) / global.screen.n_workspaces;

        alloc.min_size = height;
        alloc.natural_size = height;
    },

    _getPreferredWidth : function (actor, forHeight, alloc) {
        let primary = Main.layoutManager.primaryMonitor;
        this._childWidth = Math.round(this._childHeight * primary.width / primary.height);

        alloc.min_size = this._childWidth;
        alloc.natural_size = this._childWidth;
    },

    _allocate : function (actor, box, flags) {
        let children = this._list.get_children();
        let childBox = new Clutter.ActorBox();

        let y = box.y1;
        let prevChildBoxY2 = box.y1 - this._itemSpacing;
        for (let i = 0; i < children.length; i++) {
            childBox.x1 = box.x1;
            childBox.x2 = box.x1 + this._childWidth;
            childBox.y1 = prevChildBoxY2 + this._itemSpacing;
            childBox.y2 = Math.round(y + this._childHeight);
            y += this._childHeight + this._itemSpacing;
            prevChildBoxY2 = childBox.y2;
            children[i].allocate(childBox, flags);
        }
    },

    _redraw : function(direction, activeWorkspaceIndex) {
        this._list.destroy_children();

        for (let i = 0; i < global.screen.n_workspaces; i++) {
            let indicator = null;

           if (i == activeWorkspaceIndex && direction == UP)
               indicator = new St.Bin({ style_class: 'ws-switcher-active-up' });
           else if(i == activeWorkspaceIndex && direction == DOWN)
               indicator = new St.Bin({ style_class: 'ws-switcher-active-down' });
           else
               indicator = new St.Bin({ style_class: 'ws-switcher-box' });

           this._list.add_actor(indicator);

        }
    },

    _position: function() {
        let primary = Main.layoutManager.primaryMonitor;
        this._container.x = primary.x + Math.floor((primary.width - this._container.width) / 2);
        this._container.y = primary.y + Main.panel.actor.height +
                            Math.floor(((primary.height - Main.panel.actor.height) - this._container.height) / 2);
    },

    _show : function() {
        Tweener.addTween(this._container, { opacity: 255,
                                            time: ANIMATION_TIME,
                                            transition: 'easeOutQuad'
                                           });
        this._position();
        this.actor.show();
    },

    display : function(direction, activeWorkspaceIndex) {
        this._redraw(direction, activeWorkspaceIndex);
        if (this._timeoutId != 0)
            Mainloop.source_remove(this._timeoutId);
        this._timeoutId = Mainloop.timeout_add(DISPLAY_TIMEOUT, Lang.bind(this, this._onTimeout));
        this._show();
    },

    _onTimeout : function() {
        Mainloop.source_remove(this._timeoutId);
        this._timeoutId = 0;
        Tweener.addTween(this._container, { opacity: 0.0,
                                            time: ANIMATION_TIME,
                                            transition: 'easeOutQuad',
                                            onComplete: function() { this.actor.hide(); },
                                            onCompleteScope: this
                                           });
    }
};
