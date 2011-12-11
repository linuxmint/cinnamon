// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const DND = imports.ui.dnd;
const IconGrid = imports.ui.iconGrid;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const Search = imports.ui.search;

const MAX_SEARCH_RESULTS_ROWS = 1;


function SearchResult(provider, metaInfo, terms) {
    this._init(provider, metaInfo, terms);
}

SearchResult.prototype = {
    _init: function(provider, metaInfo, terms) {
        this.provider = provider;
        this.metaInfo = metaInfo;
        this.actor = new St.Button({ style_class: 'search-result',
                                     reactive: true,
                                     x_align: St.Align.START,
                                     y_fill: true });
        this.actor._delegate = this;
        this._dragActorSource = null;

        let content = provider.createResultActor(metaInfo, terms);
        if (content == null) {
            content = new St.Bin({ style_class: 'search-result-content',
                                   reactive: true,
                                   track_hover: true });
            let icon = new IconGrid.BaseIcon(this.metaInfo['name'],
                                             { createIcon: this.metaInfo['createIcon'] });
            content.set_child(icon.actor);
            this._dragActorSource = icon.icon;
            this.actor.label_actor = icon.label;
        } else {
            if (content._delegate && content._delegate.getDragActorSource)
                this._dragActorSource = content._delegate.getDragActorSource();
        }
        this._content = content;
        this.actor.set_child(content);

        this.actor.connect('clicked', Lang.bind(this, this._onResultClicked));

        let draggable = DND.makeDraggable(this.actor);
        draggable.connect('drag-begin',
                          Lang.bind(this, function() {
                              Main.overview.beginItemDrag(this);
                          }));
        draggable.connect('drag-cancelled',
                          Lang.bind(this, function() {
                              Main.overview.cancelledItemDrag(this);
                          }));
        draggable.connect('drag-end',
                          Lang.bind(this, function() {
                              Main.overview.endItemDrag(this);
                          }));
    },

    setSelected: function(selected) {
        if (selected)
            this._content.add_style_pseudo_class('selected');
        else
            this._content.remove_style_pseudo_class('selected');
    },

    activate: function() {
        this.provider.activateResult(this.metaInfo.id);
        Main.overview.toggle();
    },

    _onResultClicked: function(actor) {
        this.activate();
    },

    getDragActorSource: function() {
        if (this._dragActorSource)
            return this._dragActorSource;
        // not exactly right, but alignment problems are hard to notice
        return this._content;
    },

    getDragActor: function(stageX, stageY) {
        return this.metaInfo['createIcon'](Main.overview.dashIconSize);
    },

    shellWorkspaceLaunch: function(params) {
        if (this.provider.dragActivateResult)
            this.provider.dragActivateResult(this.metaInfo.id, params);
        else
            this.provider.activateResult(this.metaInfo.id, params);
    }
};


function GridSearchResults(provider, grid) {
    this._init(provider, grid);
}

GridSearchResults.prototype = {
    __proto__: Search.SearchResultDisplay.prototype,

    _init: function(provider, grid) {
        Search.SearchResultDisplay.prototype._init.call(this, provider);
        this._grid = grid || new IconGrid.IconGrid({ rowLimit: MAX_SEARCH_RESULTS_ROWS,
                                                     xAlign: St.Align.START });
        this.actor = new St.Bin({ x_align: St.Align.START });

        this.actor.set_child(this._grid.actor);
        this.selectionIndex = -1;
        this._width = 0;
        this.actor.connect('notify::width', Lang.bind(this, function() {
            this._width = this.actor.width;
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function() {
                this._tryAddResults();
            }));
        }));
        this._notDisplayedResult = [];
        this._terms = [];
    },

    _tryAddResults: function() {
        let canDisplay = this._grid.childrenInRow(this._width) * MAX_SEARCH_RESULTS_ROWS
                         - this._grid.visibleItemsCount();

        for (let i = Math.min(this._notDisplayedResult.length, canDisplay); i > 0; i--) {
            let result = this._notDisplayedResult.shift();
            let meta = this.provider.getResultMeta(result);
            let display = new SearchResult(this.provider, meta, this._terms);
            this._grid.addItem(display.actor);
        }
    },

    getVisibleResultCount: function() {
        return this._grid.visibleItemsCount();
    },

    renderResults: function(results, terms) {
        // copy the lists
        this._notDisplayedResult = results.slice(0);
        this._terms = terms.slice(0);
        this._tryAddResults();
    },

    clear: function () {
        this._terms = [];
        this._notDisplayedResult = [];
        this._grid.removeAll();
        this.selectionIndex = -1;
    },

    selectIndex: function (index) {
        let nVisible = this.getVisibleResultCount();
        if (this.selectionIndex >= 0) {
            let prevActor = this._grid.getItemAtIndex(this.selectionIndex);
            prevActor._delegate.setSelected(false);
        }
        this.selectionIndex = -1;
        if (index >= nVisible)
            return false;
        else if (index < 0)
            return false;
        let targetActor = this._grid.getItemAtIndex(index);
        targetActor._delegate.setSelected(true);
        this.selectionIndex = index;
        return true;
    },

    activateSelected: function() {
        if (this.selectionIndex < 0)
            return;
        let targetActor = this._grid.getItemAtIndex(this.selectionIndex);
        targetActor._delegate.activate();
    }
};


function SearchResults(searchSystem, openSearchSystem) {
    this._init(searchSystem, openSearchSystem);
}

SearchResults.prototype = {
    _init: function(searchSystem, openSearchSystem) {
        this._searchSystem = searchSystem;
        this._searchSystem.connect('search-updated', Lang.bind(this, this._updateCurrentResults));
        this._searchSystem.connect('search-completed', Lang.bind(this, this._updateResults));
        this._openSearchSystem = openSearchSystem;

        this.actor = new St.BoxLayout({ name: 'searchResults',
                                        vertical: true });

        this._content = new St.BoxLayout({ name: 'searchResultsContent',
                                           vertical: true });

        let scrollView = new St.ScrollView({ x_fill: true,
                                             y_fill: false,
                                             style_class: 'vfade' });
        scrollView.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrollView.add_actor(this._content);

        this.actor.add(scrollView, { x_fill: true,
                                     y_fill: false,
                                     expand: true,
                                     x_align: St.Align.START,
                                     y_align: St.Align.START });
        this.actor.connect('notify::mapped', Lang.bind(this,
            function() {
                if (!this.actor.mapped)
                    return;

                let adjustment = scrollView.vscroll.adjustment;
                let direction = Overview.SwipeScrollDirection.VERTICAL;
                Main.overview.setScrollAdjustment(adjustment, direction);
            }));

        this._statusText = new St.Label({ style_class: 'search-statustext' });
        this._content.add(this._statusText);
        this._selectedProvider = -1;
        this._providers = this._searchSystem.getProviders();
        this._providerMeta = [];
        this._providerMetaResults = {};
        for (let i = 0; i < this._providers.length; i++) {
            this.createProviderMeta(this._providers[i]);
            this._providerMetaResults[this.providers[i].title] = [];
        }
        this._searchProvidersBox = new St.BoxLayout({ style_class: 'search-providers-box' });
        this.actor.add(this._searchProvidersBox);

        this._openSearchProviders = [];
        this._openSearchSystem.connect('changed', Lang.bind(this, this._updateOpenSearchProviderButtons));
        this._updateOpenSearchProviderButtons();
    },

    _updateOpenSearchProviderButtons: function() {
        this._selectedOpenSearchButton = -1;
        for (let i = 0; i < this._openSearchProviders.length; i++)
            this._openSearchProviders[i].actor.destroy();
        this._openSearchProviders = this._openSearchSystem.getProviders();
        for (let i = 0; i < this._openSearchProviders.length; i++)
            this._createOpenSearchProviderButton(this._openSearchProviders[i]);
    },

    _updateOpenSearchButtonState: function() {
         for (let i = 0; i < this._openSearchProviders.length; i++) {
             if (i == this._selectedOpenSearchButton)
                 this._openSearchProviders[i].actor.add_style_pseudo_class('selected');
             else
                 this._openSearchProviders[i].actor.remove_style_pseudo_class('selected');
         }
    },

    _createOpenSearchProviderButton: function(provider) {
        let button = new St.Button({ style_class: 'dash-search-button',
                                     reactive: true,
                                     x_fill: true,
                                     y_align: St.Align.MIDDLE });
        let bin = new St.Bin({ x_fill: false,
                               x_align:St.Align.MIDDLE });
        button.connect('clicked', Lang.bind(this, function() {
            this._openSearchSystem.activateResult(provider.id);
        }));
        let title = new St.Label({ text: provider.name,
                                   style_class: 'dash-search-button-label' });

        button.label_actor = title;
        bin.set_child(title);
        button.set_child(bin);
        provider.actor = button;

        this._searchProvidersBox.add(button);
    },

    createProviderMeta: function(provider) {
        let providerBox = new St.BoxLayout({ style_class: 'search-section',
                                             vertical: true });
        let title = new St.Label({ style_class: 'search-section-header',
                                   text: provider.title });
        providerBox.add(title);

        let resultDisplayBin = new St.Bin({ style_class: 'search-section-results',
                                            x_fill: true,
                                            y_fill: true });
        providerBox.add(resultDisplayBin, { expand: true });
        let resultDisplay = provider.createResultContainerActor();
        if (resultDisplay == null) {
            resultDisplay = new GridSearchResults(provider);
        }
        resultDisplayBin.set_child(resultDisplay.actor);

        this._providerMeta.push({ provider: provider,
                                  actor: providerBox,
                                  resultDisplay: resultDisplay });
        this._content.add(providerBox);
    },

    destroyProviderMeta: function(provider) {
        for (let i=0; i < this._providerMeta.length; i++) {
            let meta = this._providerMeta[i];
            if (meta.provider == provider) {
                meta.actor.destroy();
                this._providerMeta.splice(i, 1);
                break;
            }
        }
    },

    _clearDisplay: function() {
        this._selectedProvider = -1;
        this._visibleResultsCount = 0;
        for (let i = 0; i < this._providerMeta.length; i++) {
            let meta = this._providerMeta[i];
            meta.resultDisplay.clear();
            meta.actor.hide();
        }
    },

    _clearDisplayForProvider: function(index) {
        let meta = this._providerMeta[index];
        meta.resultDisplay.clear();
        meta.actor.hide();
    },

    reset: function() {
        this._searchSystem.reset();
        this._statusText.hide();
        this._clearDisplay();
        this._selectedOpenSearchButton = -1;
        this._updateOpenSearchButtonState();
    },

    startingSearch: function() {
        this.reset();
        this._statusText.set_text(_("Searching..."));
        this._statusText.show();
    },

    doSearch: function (searchString) {
        this._searchSystem.updateSearch(searchString);
    },

    _metaForProvider: function(provider) {
        return this._providerMeta[this._providers.indexOf(provider)];
    },

    _updateCurrentResults: function(searchSystem, provider, results) {
        let terms = searchSystem.getTerms();
        let meta = this._metaForProvider(provider);
        meta.resultDisplay.clear();
        meta.actor.show();
        meta.resultDisplay.renderResults(results, terms);
        return true;
    },

    _updateResults: function(searchSystem, results) {
        if (results.length == 0) {
            this._statusText.set_text(_("No matching results."));
            this._statusText.show();
        } else {
            this._selectedOpenSearchButton = -1;
            this._updateOpenSearchButtonState();
            this._statusText.hide();
        }

        let terms = searchSystem.getTerms();
        this._openSearchSystem.setSearchTerms(terms);

        // To avoid CSS transitions causing flickering
        // of the selection when the first search result
        // stays the same, we hide the content while
        // filling in the results and setting the initial
        // selection.
        this._content.hide();

        for (let i = 0; i < results.length; i++) {
            let [provider, providerResults] = results[i];
            if (providerResults.length == 0) {
                this._clearDisplayForProvider(i);
            } else {
                this._providerMetaResults[provider.title] = providerResults;
                this._clearDisplayForProvider(i);
                let meta = this._metaForProvider(provider);
                meta.actor.show();
                meta.resultDisplay.renderResults(providerResults, terms);
            }
        }

        if (this._selectedOpenSearchButton == -1)
            this.selectDown(false);

        this._content.show();

        return true;
    },

    _modifyActorSelection: function(resultDisplay, up) {
        let success;
        let index = resultDisplay.getSelectionIndex();
        if (up && index == -1)
            index = resultDisplay.getVisibleResultCount() - 1;
        else if (up)
            index = index - 1;
        else
            index = index + 1;
        return resultDisplay.selectIndex(index);
    },

    selectUp: function(recursing) {
        if (this._selectedOpenSearchButton == -1) {
            for (let i = this._selectedProvider; i >= 0; i--) {
                let meta = this._providerMeta[i];
                if (!meta.actor.visible)
                    continue;
                let success = this._modifyActorSelection(meta.resultDisplay, true);
                if (success) {
                    this._selectedProvider = i;
                    return;
                }
            }
        }

        if (this._selectedOpenSearchButton == -1)
            this._selectedOpenSearchButton = this._openSearchProviders.length;
        this._selectedOpenSearchButton--;
        this._updateOpenSearchButtonState();
        if (this._selectedOpenSearchButton >= 0)
            return;

        if (this._providerMeta.length > 0 && !recursing) {
            this._selectedProvider = this._providerMeta.length - 1;
            this.selectUp(true);
        }
    },

    selectDown: function(recursing) {
        let current = this._selectedProvider;
        if (this._selectedOpenSearchButton == -1) {
            if (current == -1)
                current = 0;
            for (let i = current; i < this._providerMeta.length; i++) {
                let meta = this._providerMeta[i];
                if (!meta.actor.visible)
                    continue;
                 let success = this._modifyActorSelection(meta.resultDisplay, false);
                 if (success) {
                    this._selectedProvider = i;
                    return;
                 }
            }
        }
        this._selectedOpenSearchButton++;

        if (this._selectedOpenSearchButton < this._openSearchProviders.length) {
            this._updateOpenSearchButtonState();
            return;
        }

        this._selectedOpenSearchButton = -1;
        this._updateOpenSearchButtonState();

        if (this._providerMeta.length > 0 && !recursing) {
            this._selectedProvider = 0;
            this.selectDown(true);
        }
    },

    activateSelected: function() {
        if (this._selectedOpenSearchButton != -1) {
            let provider = this._openSearchProviders[this._selectedOpenSearchButton];
            this._openSearchSystem.activateResult(provider.id);
            Main.overview.hide();
            return;
        }

        let current = this._selectedProvider;
        if (current < 0)
            return;
        let meta = this._providerMeta[current];
        let resultDisplay = meta.resultDisplay;
        resultDisplay.activateSelected();
        Main.overview.hide();
    }
};
