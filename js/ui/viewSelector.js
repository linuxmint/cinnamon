// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Main = imports.ui.main;
const Search = imports.ui.search;
const SearchDisplay = imports.ui.searchDisplay;
const ShellEntry = imports.ui.shellEntry;
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

        if (this.title.can_focus) {
            Main.ctrlAltTabManager.addGroup(this.title, name, a11yIcon);
        } else {
            Main.ctrlAltTabManager.addGroup(this.page, name, a11yIcon,
                                            { proxy: this.title,
                                              focusCallback: Lang.bind(this, this._a11yFocus) });
        }

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


function SearchTab() {
    this._init();
}

SearchTab.prototype = {
    __proto__: BaseTab.prototype,

    _init: function() {
        this.active = false;
        this._searchPending = false;
        this._searchTimeoutId = 0;

        this._searchSystem = new Search.SearchSystem();
        this._openSearchSystem = new Search.OpenSearchSystem();

        this._entry = new St.Entry({ name: 'searchEntry',
                                     /* Translators: this is the text displayed
                                        in the search entry when no search is
                                        active; it should not exceed ~30
                                        characters. */
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });
        ShellEntry.addContextMenu(this._entry);
        this._text = this._entry.clutter_text;
        this._text.connect('key-press-event', Lang.bind(this, this._onKeyPress));

        this._inactiveIcon = new St.Icon({ style_class: 'search-entry-icon',
                                           icon_name: 'edit-find',
                                           icon_type: St.IconType.SYMBOLIC });
        this._activeIcon = new St.Icon({ style_class: 'search-entry-icon',
                                         icon_name: 'edit-clear',
                                         icon_type: St.IconType.SYMBOLIC });
        this._entry.set_secondary_icon(this._inactiveIcon);

        this._iconClickedId = 0;

        this._searchResults = new SearchDisplay.SearchResults(this._searchSystem, this._openSearchSystem);
        BaseTab.prototype._init.call(this,
                                     this._entry,
                                     this._searchResults.actor,
                                     _("Search"),
                                     'edit-find');

        this._text.connect('text-changed', Lang.bind(this, this._onTextChanged));
        this._text.connect('key-press-event', Lang.bind(this, function (o, e) {
            // We can't connect to 'activate' here because search providers
            // might want to do something with the modifiers in activateSelected.
            let symbol = e.get_key_symbol();
            if (symbol == Clutter.Return || symbol == Clutter.KP_Enter) {
                if (this._searchTimeoutId > 0) {
                    Mainloop.source_remove(this._searchTimeoutId);
                    this._doSearch();
                }
                this._searchResults.activateSelected();
                return true;
            }
            return false;
        }));

        this._entry.connect('notify::mapped', Lang.bind(this, this._onMapped));

        global.stage.connect('notify::key-focus', Lang.bind(this, this._updateCursorVisibility));

        this._capturedEventId = 0;
    },

    hide: function() {
        BaseTab.prototype.hide.call(this);

        // Leave the entry focused when it doesn't have any text;
        // when replacing a selected search term, Clutter emits
        // two 'text-changed' signals, one for deleting the previous
        // text and one for the new one - the second one is handled
        // incorrectly when we remove focus
        // (https://bugzilla.gnome.org/show_bug.cgi?id=636341) */
        if (this._text.text != '')
            this._reset();
    },

    _reset: function () {
        this._text.text = '';

        global.stage.set_key_focus(null);

        this._text.set_cursor_visible(true);
        this._text.set_selection(0, 0);
    },

    _updateCursorVisibility: function() {
        let focus = global.stage.get_key_focus();
        this._text.set_cursor_visible(focus == this._text);
    },

    _onMapped: function() {
        if (this._entry.mapped) {
            // Enable 'find-as-you-type'
            this._capturedEventId = global.stage.connect('captured-event',
                                 Lang.bind(this, this._onCapturedEvent));
            this._text.set_cursor_visible(true);
            this._text.set_selection(0, 0);
        } else {
            // Disable 'find-as-you-type'
            if (this._capturedEventId > 0)
                global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }
    },

    addSearchProvider: function(provider) {
        this._searchSystem.registerProvider(provider);
        this._searchResults.createProviderMeta(provider);
    },

    removeSearchProvider: function(provider) {
        this._searchSystem.unregisterProvider(provider);
        this._searchResults.destroyProviderMeta(provider);
    },

    startSearch: function(event) {
        global.stage.set_key_focus(this._text);
        this._text.event(event, false);
    },

    // the entry does not show the hint
    _isActivated: function() {
        return this._text.text == this._entry.get_text();
    },

    _onTextChanged: function (se, prop) {
        let searchPreviouslyActive = this.active;
        this.active = this._entry.get_text() != '';
        this._searchPending = this.active && !searchPreviouslyActive;
        if (this._searchPending) {
            this._searchResults.startingSearch();
        }
        if (this.active) {
            this._entry.set_secondary_icon(this._activeIcon);

            if (this._iconClickedId == 0) {
                this._iconClickedId = this._entry.connect('secondary-icon-clicked',
                    Lang.bind(this, function() {
                        this._reset();
                    }));
            }
            this._activate();
        } else {
            if (this._iconClickedId > 0)
                this._entry.disconnect(this._iconClickedId);
            this._iconClickedId = 0;

            this._entry.set_secondary_icon(this._inactiveIcon);
            this.emit('search-cancelled');
        }
        if (!this.active) {
            if (this._searchTimeoutId > 0) {
                Mainloop.source_remove(this._searchTimeoutId);
                this._searchTimeoutId = 0;
            }
            return;
        }
        if (this._searchTimeoutId > 0)
            return;
        this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
    },

    _onKeyPress: function(entry, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.Up) {
            if (!this.active)
                return true;
            this._searchResults.selectUp(false);

            return true;
        } else if (symbol == Clutter.Down) {
            if (!this.active)
                return true;

            this._searchResults.selectDown(false);
            return true;
        } else if (symbol == Clutter.Escape) {
            if (this._isActivated()) {
                this._reset();
                return true;
            }
        }

        return false;
    },

    _onCapturedEvent: function(actor, event) {
        if (event.type() == Clutter.EventType.BUTTON_PRESS) {
            let source = event.get_source();
            if (source != this._text && this._text.text == '' &&
                !Main.layoutManager.keyboardBox.contains(source)) {
                // the user clicked outside after activating the entry, but
                // with no search term entered and no keyboard button pressed
                // - cancel the search
                this._reset();
            }
        }

        return false;
    },

    _doSearch: function () {
        this._searchTimeoutId = 0;
        let text = this._text.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '');
        this._searchResults.doSearch(text);

        return false;
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
        // holds both "normal" tab labels and the search entry. The former
        // is left aligned, the latter right aligned - unless the text
        // direction is RTL, in which case the order is reversed.
        this._tabBar = new Shell.GenericContainer();
        this._tabBar.connect('get-preferred-width',
                             Lang.bind(this, this._getPreferredTabBarWidth));
        this._tabBar.connect('get-preferred-height',
                             Lang.bind(this, this._getPreferredTabBarHeight));
        this._tabBar.connect('allocate',
                             Lang.bind(this, this._allocateTabBar));
        this.actor.add(this._tabBar);

        // Box to hold "normal" tab labels
        this._tabBox = new St.BoxLayout({ name: 'viewSelectorTabBar' });
        this._tabBar.add_actor(this._tabBox);

        // The searchArea just holds the entry
        this._searchArea = new St.Bin({ name: 'searchArea' });
        this._tabBar.add_actor(this._searchArea);

        // The page area holds the tab pages. Every page is given the
        // area's full allocation, so that the pages would appear on top
        // of each other if the inactive ones weren't hidden.
        this._pageArea = new Shell.Stack();
        this.actor.add(this._pageArea, { x_fill: true,
                                         y_fill: true,
                                         expand: true });

        this._tabs = [];
        this._activeTab = null;

        this._searchTab = new SearchTab();
        this._searchArea.set_child(this._searchTab.title);
        this._addTab(this._searchTab);

        this._searchTab.connect('search-cancelled', Lang.bind(this,
            function() {
                this._switchTab(this._activeTab);
            }));

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

        if (tab != this._searchTab) {
            tab.title.add_style_pseudo_class('selected');
            this._activeTab = tab;
            if (this._searchTab.visible) {
                this._searchTab.hide();
            }
        }

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

        let [searchMinWidth, searchNatWidth] = this._searchArea.get_preferred_width(-1);
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

        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = 0;
            childBox.x2 = searchNatWidth;
        } else {
            childBox.x1 = allocWidth - searchNatWidth;
            childBox.x2 = allocWidth;
        }
        this._searchArea.allocate(childBox, flags);

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function() {
                this.constrainY.offset = this.actor.y;
            }));
    },

    _onStageKeyPress: function(actor, event) {
        let modifiers = Shell.get_event_state(event);
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.Escape) {
            Main.overview.hide();
            return true;
        } else if (modifiers & Clutter.ModifierType.CONTROL_MASK) {
            if (symbol == Clutter.Page_Up) {
                if (!this._searchTab.active)
                    this._prevTab();
                return true;
            } else if (symbol == Clutter.Page_Down) {
                if (!this._searchTab.active)
                    this._nextTab();
                return true;
            }
        } else if (Clutter.keysym_to_unicode(symbol)) {
            this._searchTab.startSearch(event);
        }
        return false;
    },

    addSearchProvider: function(provider) {
        this._searchTab.addSearchProvider(provider);
    },

    removeSearchProvider: function(provider) {
        this._searchTab.removeSearchProvider(provider);
    }
};
Signals.addSignalMethods(ViewSelector.prototype);
