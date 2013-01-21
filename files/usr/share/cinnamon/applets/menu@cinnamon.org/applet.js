const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const DocInfo = imports.misc.docInfo;

const ICON_SIZE = 16;
const MAX_FAV_ICON_SIZE = 32;
const CATEGORY_ICON_SIZE = 22;
const APPLICATION_ICON_SIZE = 22;
const MAX_RECENT_FILES = 20;

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();


let appsys = Cinnamon.AppSystem.get_default();

/* VisibleChildIterator takes a container (boxlayout, etc.)
 * and creates an array of its visible children and their index
 * positions.  We can then work thru that list without
 * mucking about with positions and math, just give a
 * child, and it'll give you the next or previous, or first or
 * last child in the list.
 *
 * We could have this object regenerate off a signal
 * every time the visibles have changed in our applicationBox,
 * but we really only need it when we start keyboard
 * navigating, so increase speed, we reload only when we
 * want to use it.
 */

function VisibleChildIterator(parent, container) {
    this._init(parent, container);
}

VisibleChildIterator.prototype = {
    _init: function(parent, container) {
        this.container = container;
        this._parent = parent;
        this._num_children = 0;
        this.reloadVisible();
    },

    reloadVisible: function() {
        this.visible_children = new Array();
        this.abs_index = new Array();
        let children = this.container.get_children();
        for (let i = 0; i < children.length; i++) {
            let child = children[i];
            if (child.visible) {
                this.visible_children.push(child);
                this.abs_index.push(i);
            }
        }
        this._num_children = this.visible_children.length;
    },

    getNextVisible: function(cur_child) {
        if (this.visible_children.indexOf(cur_child) == this._num_children-1)
            return cur_child;
        else
            return this.visible_children[this.visible_children.indexOf(cur_child)+1];
    },

    getPrevVisible: function(cur_child) {
        if (this.visible_children.indexOf(cur_child) == 0)
            return cur_child;
        else
            return this.visible_children[this.visible_children.indexOf(cur_child)-1];
    },

    getFirstVisible: function() {
        return this.visible_children[0];
    },

    getLastVisible: function() {
        return this.visible_children[this._num_children-1];
    },

    getNumVisibleChildren: function() {
        return this._num_children;
    },

    getAbsoluteIndexOfChild: function(child) {
        return this.abs_index[this.visible_children.indexOf(child)];
    }
};

function ApplicationContextMenuItem(appButton, label, action) {
    this._init(appButton, label, action);
}

ApplicationContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (appButton, label, action) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});

        this._appButton = appButton;
        this._action = action;
        this.label = new St.Label({ text: label });
        this.addActor(this.label);
    },

    activate: function (event) {
        switch (this._action){
            case "add_to_panel":
                let settings = new Gio.Settings({ schema: 'org.cinnamon' });
                let desktopFiles = settings.get_strv('panel-launchers');
                desktopFiles.push(this._appButton.app.get_id());
                settings.set_strv('panel-launchers', desktopFiles);
                break;
            case "add_to_desktop":
                let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
                let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH+"/"+this._appButton.app.get_id());
                try{
                    file.copy(destFile, 0, null, function(){});
                    // Need to find a way to do that using the Gio library, but modifying the access::can-execute attribute on the file object seems unsupported
                    Util.spawnCommandLine("chmod +x \""+USER_DESKTOP_PATH+"/"+this._appButton.app.get_id()+"\"");
                }catch(e){
                    global.log(e);
                }
                break;
            case "add_to_favorites":
                AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
                break;
            case "remove_from_favorites":
                AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
                break;
        }
        this._appButton.toggleMenu();
        return false;
    }

};


function SimpleButton(appsMenuButton, icon, buttonStyle, labelStyle, name, description) {
    this._init(appsMenuButton, icon, buttonStyle, labelStyle, name, description);
}

SimpleButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, icon, buttonStyle, labelStyle, name, description) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.appsMenuButton = appsMenuButton;
        this.name = name;
        this.description = description;
        this.buttonStyle = buttonStyle;
        this.actor.set_style_class_name(buttonStyle);
        this.actor._delegate = this;
        if(icon) {
            this.icon = icon;
            this.addActor(this.icon);
        }
        if(labelStyle) {
            this.label = new St.Label({ text: this.name, style_class: labelStyle });
            this.addActor(this.label);
        }
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
    }
};



function SearchableButton(appsMenuButton, icon, buttonStyle, labelStyle, name, description, searchTexts) {
    this._init(appsMenuButton, icon, buttonStyle, labelStyle, name, description, searchTexts);
}

SearchableButton.prototype = {
    __proto__: SimpleButton.prototype,

    _init: function(appsMenuButton, icon, buttonStyle, labelStyle, name, description, searchTexts) {
        SimpleButton.prototype._init.call(this, appsMenuButton, icon, buttonStyle, labelStyle, name, description);
        this.searchTexts = new Array();
        for(let i=0; i<searchTexts.length; i++) {
            let s = searchTexts[i];
            if(s && typeof(s) == 'string')
                this.searchTexts.push(s.toLowerCase());
        }
    },

    search: function(pattern) {
        this.searchScore = 0;
        // in theory this allows for better sorting
        let addScore = Math.pow(10, this.searchTexts.length);
        for(let i=0; i<this.searchTexts.length; i++) {
            let pos = this.searchTexts[i].indexOf(pattern);
            if(pos != -1) {
                this.searchScore += addScore;
                // extra score for beginning
                if(pos == 0)
                    this.searchScore += addScore/2;
            }
            addScore /= 10;
        }
        return this.searchScore > 0;
    }
};

function GenericApplicationButton(appsMenuButton, app, withMenu, buttonStyle, labelStyle, icon) {
    this._init(appsMenuButton, app, withMenu, buttonStyle, labelStyle, icon);
}

GenericApplicationButton.prototype = {
    __proto__: SearchableButton.prototype,

    _init: function(appsMenuButton, app, withMenu, buttonStyle, labelStyle, icon) {
        this.app = app;
        let appId = app.get_id() ? app.get_id().slice(0, -8) : '';

        SearchableButton.prototype._init.call(this,
            appsMenuButton, icon,
            buttonStyle, labelStyle,
            app.get_name(), app.get_description(),
            [app.get_name(), app.get_description(), appId]);

        this.withMenu = withMenu;
        if (this.withMenu){
            this.menu = new PopupMenu.PopupSubMenu(this.actor);
            this.menu.actor.set_style_class_name('menu-context-menu');
            this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
        }
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
        if (event.get_button()==3){
            if (this.withMenu && !this.menu.isOpen)
                this.appsMenuButton.closeApplicationsContextMenus(this.app, true);
            this.toggleMenu();
        }
        return true;
    },

    activate: function(event) {
        this.app.open_new_window(-1);
        this.appsMenuButton.menu.close();
    },

    closeMenu: function() {
        if (this.withMenu) this.menu.close();
    },

    toggleMenu: function() {
        if (!this.withMenu) return;

        if (!this.menu.isOpen){
            let children = this.menu.box.get_children();
            for (var i in children) {
                this.menu.box.remove_actor(children[i]);
            }
            let menuItem;
            menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel");
            this.menu.addMenuItem(menuItem);
            if (USER_DESKTOP_PATH){
                menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop");
                this.menu.addMenuItem(menuItem);
            }
            if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
                menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites");
                this.menu.addMenuItem(menuItem);
            }else{
                menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites");
                this.menu.addMenuItem(menuItem);
            }
        }
        this.menu.toggle();
    },

    _subMenuOpenStateChanged: function() {
        if (this.menu.isOpen) this.appsMenuButton._scrollToButton(this.menu);
    }
}

function ApplicationButton(appsMenuButton, app) {
    this._init(appsMenuButton, app);
}

ApplicationButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function(appsMenuButton, app) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true, 'menu-application-button', 'menu-application-button-label', app.create_icon_texture(APPLICATION_ICON_SIZE));
        this.category = new Array();

        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
    },

    getDragActor: function() {
        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let nbFavorites = favorites.length;
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7*monitorHeight) / nbFavorites;
        let icon_size = 0.6*real_size;
        if (icon_size>MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;
        return this.app.create_icon_texture(icon_size);
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    }
};

function PlaceButton(appsMenuButton, place, name) {
    this._init(appsMenuButton, place, name);
}

PlaceButton.prototype = {
    __proto__: SearchableButton.prototype,

    _init: function(appsMenuButton, place, name) {
        this.place = place;
        let description = place.id.slice(16);

        SearchableButton.prototype._init.call(this,
            appsMenuButton, place.iconFactory(APPLICATION_ICON_SIZE),
            'menu-application-button', 'menu-application-button-label',
            name, description,
            [name, description]);
    },

    activate: function(event) {
        this.place.launch();
        this.appsMenuButton.menu.close();
    }
};

function RecentButton(appsMenuButton, file) {
    this._init(appsMenuButton, file);
}

RecentButton.prototype = {
    __proto__: SearchableButton.prototype,

    _init: function(appsMenuButton, file) {
        this.file = file;
        let description = file.uri.slice(7);

        SearchableButton.prototype._init.call(this,
            appsMenuButton, file.createIcon(APPLICATION_ICON_SIZE),
            'menu-application-button', 'menu-application-button-label',
            file.name, description,
            [file.name, description]);
    },

    activate: function(event) {
        Gio.app_info_launch_default_for_uri(this.file.uri, global.create_app_launch_context());
        this.appsMenuButton.menu.close();
    }
};

function RecentClearButton(appsMenuButton) {
    this._init(appsMenuButton);
}

RecentClearButton.prototype = {
    __proto__: SearchableButton.prototype,

    _init: function(appsMenuButton) {
        let name = _("Clear list");
        let description = _("Clear recent history");
        SearchableButton.prototype._init.call(this,
            appsMenuButton, new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, icon_size: APPLICATION_ICON_SIZE }),
            'menu-application-button', 'menu-application-button-label',
            name, description,
            [name, description]);
    },

    activate: function(event) {
        this.appsMenuButton.menu.close();
        let GtkRecent = new Gtk.RecentManager();
        GtkRecent.purge_items();
    }
};

function CategoryButton(name, iconName) {
    this._init(name, iconName);
}

CategoryButton.prototype = {
    __proto__: SimpleButton.prototype,

    _init: function(name, iconName) {
        let description = name;
        let icon = !iconName ? null : new St.Icon({icon_name: iconName, icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        SimpleButton.prototype._init.call(this,
            null, icon,
            'menu-category-button', 'menu-category-button-label',
            name, description);
    }
};

function AppCategoryButton(category) {
    this._init(category);
}

AppCategoryButton.prototype = {
    __proto__: CategoryButton.prototype,

    _init: function(category) {
        let iconName = null;
        let name = null;

        if (category) {
            let categoryIcon = category.get_icon();
            if (categoryIcon && categoryIcon.get_names)
                iconName = categoryIcon.get_names().toString();

            name = category.get_name();
        } else {
            name = _("All Applications");
        }
        CategoryButton.prototype._init.call(this, name, iconName);
    }
};

function FavoritesButton(appsMenuButton, app, nbFavorites) {
    this._init(appsMenuButton, app, nbFavorites);
}

FavoritesButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function(appsMenuButton, app, nbFavorites) {
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7*monitorHeight) / nbFavorites;
        let icon_size = 0.6*real_size;
        if (icon_size>MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;

        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, false, 'menu-favorites-button', null, app.create_icon_texture(icon_size));
        this.actor.style = "padding-top: "+(icon_size/3)+"px;padding-bottom: "+(icon_size/3)+"px; margin:auto;"

        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
    },

    getDragActor: function() {
        return new Clutter.Clone({ source: this.actor });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    }
};

function SystemButton(appsMenuButton, icon, nbFavorites) {
    this._init(appsMenuButton, icon, nbFavorites);
}

SystemButton.prototype = {
    _init: function(appsMenuButton, icon, nbFavorites, name, description) {
        this.actor = new St.Button({ reactive: true, style_class: 'menu-favorites-button' });
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7*monitorHeight) / nbFavorites;
        let icon_size = 0.6*real_size;
        if (icon_size>MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;
        this.actor.style = "padding-top: "+(icon_size/3)+"px;padding-bottom: "+(icon_size/3)+"px; margin:auto;"
        let iconObj = new St.Icon({icon_name: icon, icon_size: icon_size, icon_type: St.IconType.FULLCOLOR});
        this.actor.set_child(iconObj);

        this.name = name;
        this.description = description;
    }
};


function CategoriesApplicationsBox() {
    this._init();
}

CategoriesApplicationsBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout();
        this.actor._delegate = this;
    },

    acceptDrop : function(source, actor, x, y, time) {
        if (source instanceof FavoritesButton){
            source.actor.destroy();
            actor.destroy();
            AppFavorites.getAppFavorites().removeFavorite(source.app.get_id());
            return true;
        }
        return false;
    }
}

function FavoritesBox() {
    this._init();
}

FavoritesBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ vertical: true });
        this.actor._delegate = this;

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },

    handleDragOver : function(source, actor, x, y, time) {
        let app = source.app;

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed() || (!(source instanceof FavoritesButton) && app.get_id() in AppFavorites.getAppFavorites().getFavoriteMap()))
            return DND.DragMotionResult.NO_DROP;

        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;

        let favPos = favorites.indexOf(app);

        let children = this.actor.get_children();
        let numChildren = children.length;
        let boxHeight = this.actor.height;

        // Keep the placeholder out of the index calculation; assuming that
        // the remove target has the same size as "normal" items, we don't
        // need to do the same adjustment there.
        if (this._dragPlaceholder) {
            boxHeight -= this._dragPlaceholder.actor.height;
            numChildren--;
        }

        let pos = Math.round(y * numFavorites / boxHeight);

        if (pos != this._dragPlaceholderPos && pos <= numFavorites) {
            if (this._animatingPlaceholdersCount > 0) {
                let appChildren = children.filter(function(actor) {
                    return (actor._delegate instanceof FavoritesButton);
                });
                this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
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
            this._dragPlaceholder.child.set_width (source.actor.height);
            this._dragPlaceholder.child.set_height (source.actor.height);
            this.actor.insert_actor(this._dragPlaceholder.actor,
                                   this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }

        let srcIsFavorite = (favPos != -1);

        if (srcIsFavorite)
            return DND.DragMotionResult.MOVE_DROP;

        return DND.DragMotionResult.COPY_DROP;
    },

    // Draggable target interface
    acceptDrop : function(source, actor, x, y, time) {
        let app = source.app;

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed()) {
            return false;
        }

        let id = app.get_id();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let srcIsFavorite = (id in favorites);

        let favPos = 0;
        let children = this.actor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;

            if (!(children[i]._delegate instanceof FavoritesButton)) continue;

            let childId = children[i]._delegate.app.get_id();
            if (childId == id)
                continue;
            if (childId in favorites)
                favPos++;
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function () {
                let appFavorites = AppFavorites.getAppFavorites();
                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);
                return false;
            }));

        return true;
    }
}

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,
    
    _init: function(orientation, panel_height) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height);

        this.set_applet_tooltip(_("Menu"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        
        this._connectSetting("menu-show-recent", "showRecent", Lang.bind(this, this._refreshRecent));
        this._connectSetting("menu-show-places", "showPlaces", Lang.bind(this, this._refreshPlaces));
        this._connectSetting("menu-show-favorites", "showFavorites", Lang.bind(this, this._refreshFavs));
        this._connectSetting("menu-show-system-buttons", "showSystemButtons", Lang.bind(this, this._refreshFavs));
        this._connectSetting("menu-show-appinfo-title", "showAppInfoTitle", Lang.bind(this, this._refreshAppInfo));
        this._connectSetting("menu-show-appinfo-description", "showAppInfoDescription", Lang.bind(this, this._refreshAppInfo));
        this._connectSetting("menu-use-multiline-appinfo", "useMultilineAppInfoDescription", Lang.bind(this, this._refreshAppInfo));
        this._connectSetting("menu-align-appinfo-right", "alignAppInfoRight", Lang.bind(this, this._refreshAppInfo));
        this._connectSetting("menu-flip-search-appinfo", "flipSearchAppInfo", Lang.bind(this, this._refreshFlipSearchAppInfo));
        
        let updateActivateOnHover = Lang.bind(this, function() {
            if (this._openMenuId) {
                this.actor.disconnect(this._openMenuId);
                this._openMenuId = 0;
            }
            let openOnHover = global.settings.get_boolean("activate-menu-applet-on-hover");
            if (openOnHover) {
                this._openMenuId = this.actor.connect('enter-event', Lang.bind(this, this.openMenu));
            }
        });
        updateActivateOnHover();
        global.settings.connect("changed::activate-menu-applet-on-hover", updateActivateOnHover);

        this.menu.actor.add_style_class_name('menu-background');
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

        this._updateIcon();

        global.settings.connect("changed::menu-icon", Lang.bind(this, function() {
            this._updateIcon();
        }));

        this.set_applet_label(_("Menu"));
        let menuLabel = global.settings.get_string("menu-text");
        if (menuLabel != "Menu") {
            this.set_applet_label(menuLabel);
        }
        global.settings.connect("changed::menu-text", Lang.bind(this, function() {
                this.set_applet_label(global.settings.get_string("menu-text"));
            }));
        this._searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                           icon_name: 'edit-find',
                                           icon_type: St.IconType.SYMBOLIC });
        this._searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                         icon_name: 'edit-clear',
                                         icon_type: St.IconType.SYMBOLIC });
        this._searchIconClickedId = 0;
        this._applicationsButtons = new Array();
        this._favoritesButtons = new Array();
        this._placesButtons = new Array();
        this._recentButtons = new Array();
        this._selectedItemIndex = null;
        this._previousTreeItemIndex = null;
        this._previousSelectedActor = null;
        this._previousTreeSelectedActor = null;
        this._activeContainer = null;
        this._activeActor = null;
        this._applicationsBoxWidth = 0;
        this.menuIsOpening = false;
        this._refresh = {places: true, recent: true, apps: true};

        this.RecentManager = new DocInfo.DocManager();

        this._display();
        appsys.connect('installed-changed', Lang.bind(this, this._refreshApps));
        AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshFavs));

        this.hover_delay = global.settings.get_int("menu-hover-delay") / 1000;
        global.settings.connect("changed::menu-hover-delay", Lang.bind(this, function() {
                this.hover_delay = global.settings.get_int("menu-hover-delay") / 1000;
        }));

        global.display.connect('overlay-key', Lang.bind(this, function(){
            try{
                this.menu.toggle();
            }
            catch(e) {
                global.logError(e);
            }
        }));
        Main.placesManager.connect('places-updated', Lang.bind(this, this._refreshPlaces));
        this.RecentManager.connect('changed', Lang.bind(this, this._refreshRecent));

        this.edit_menu_item = new Applet.MenuItem(_("Edit menu"), Gtk.STOCK_EDIT, Lang.bind(this, this._launch_editor));
        this._applet_context_menu.addMenuItem(this.edit_menu_item);
        let settings_menu_item = new Applet.MenuItem(_("Menu settings"), null, function() {
            Util.spawnCommandLine("cinnamon-settings menu");
        });
        this._applet_context_menu.addMenuItem(settings_menu_item);
    },

    _connectSetting: function(configKey, varKey, refreshCallback) {
        this[varKey] = global.settings.get_boolean(configKey);
        
        global.settings.connect("changed::" + configKey, Lang.bind(this, function() {
            this[varKey] = global.settings.get_boolean(configKey);
            
            if(refreshCallback) {
                refreshCallback();
            }
        }));
    },

    openMenu: function() {
        if(!this._applet_context_menu.actor.visible)
            this.menu.open(true);
    },

    on_orientation_changed: function (orientation) {
        this.menu.destroy();
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.menu.actor.add_style_class_name('menu-background');
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        this._display();
    },

    _launch_editor: function() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    },

    _onOpenStateChanged: function(menu, open) {
        if (open) {
            this.menuIsOpening = true;
            this.actor.add_style_pseudo_class('active');
            global.stage.set_key_focus(this.searchEntry);
            this._selectedItemIndex = null;
            this._activeContainer = null;
            this._activeActor = null;
            let scrollBoxHeight = 200;
            if(this.showSystemButtons || this.showFavorites) {
                scrollBoxHeight = (this.leftBox.get_allocation_box().y2-this.leftBox.get_allocation_box().y1) -
                                     (this.searchBox.get_allocation_box().y2-this.searchBox.get_allocation_box().y1);
            }
            this.applicationsScrollBox.style = "height: "+scrollBoxHeight+"px;";
            this._refreshApplicationsBox();
            this._select_category(null, this._allAppsCategoryButton);
        } else {
            this.actor.remove_style_pseudo_class('active');
            if (this.searchActive) {
                this.resetSearch();
            }
            this._updateAppInfo("", "");
            this._previousTreeItemIndex = null;
            this._previousTreeSelectedActor = null;
            this._previousSelectedActor = null;
            this.closeApplicationsContextMenus(null, false);
            this._clearAllSelections();
        }
    },

    destroy: function() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    },

    _updateIcon: function(){
        let icon_file = global.settings.get_string("menu-icon");
        try{
           this.set_applet_icon_path(icon_file);
        }catch(e){
           global.log("WARNING : Could not load icon file \""+icon_file+"\" for menu button");
        }
    },

    _onMenuKeyPress: function(actor, event) {

        let symbol = event.get_key_symbol();
        let item_actor;
        let index = 0;
        this.appBoxIter.reloadVisible();
        this.catBoxIter.reloadVisible();

        if (symbol==Clutter.KEY_Super_L && this.menu.isOpen) {
            this.menu.close();
            return true;
        }
        index = this._selectedItemIndex;

        if (this._activeContainer === null && symbol == Clutter.KEY_Up) {
            this._activeContainer = this.applicationsBox;
            item_actor = this.appBoxIter.getLastVisible();
            index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Down) {
            this._activeContainer = this.applicationsBox;
            item_actor = this.appBoxIter.getFirstVisible();
            index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
        } else if (symbol == Clutter.KEY_Up) {
            if (this._activeContainer==this.applicationsBox) {
                this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                item_actor = this.appBoxIter.getPrevVisible(this._previousSelectedActor);
                index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            } else {
                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                this._previousSelectedActor._delegate.isHovered = false;
                item_actor = this.catBoxIter.getPrevVisible(this._activeActor)
                index = this.catBoxIter.getAbsoluteIndexOfChild(item_actor);
            }
        } else if (symbol == Clutter.KEY_Down) {
            if (this._activeContainer==this.applicationsBox) {
                this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                item_actor = this.appBoxIter.getNextVisible(this._previousSelectedActor);
                index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            } else {
                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                this._previousSelectedActor._delegate.isHovered = false;
                item_actor = this.catBoxIter.getNextVisible(this._activeActor)
                index = this.catBoxIter.getAbsoluteIndexOfChild(item_actor);
            }
        } else if (symbol == Clutter.KEY_Right && (this._activeContainer !== this.applicationsBox)) {
            item_actor = this.appBoxIter.getFirstVisible();
            index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
        } else if (symbol == Clutter.KEY_Left && this._activeContainer === this.applicationsBox && !this.searchActive) {
            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
            item_actor = (this._previousTreeSelectedActor != null) ? this._previousTreeSelectedActor : this.catBoxIter.getFirstVisible();
            index = this.catBoxIter.getAbsoluteIndexOfChild(item_actor);
        } else if (this._activeContainer === this.applicationsBox && (symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
            item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);
            item_actor._delegate.activate();
            return true;
        } else {
            return false;
        }

        this._selectedItemIndex = index;
        if (!item_actor || item_actor === this.searchEntry) {
            return false;
        }
        item_actor._delegate.emit('enter-event');
        return true;
    },

    _addEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let parent = button.actor.get_parent();
            if (this._activeContainer !== this.applicationsBox && parent !== this._activeContainer) {
                this._previousTreeItemIndex = this._selectedItemIndex;
                this._previousTreeSelectedActor = this._activeActor;
                this._previousSelectedActor = null;
            }
            if (this._previousTreeSelectedActor && this._activeContainer !== this.categoriesBox &&
                    parent !== this._activeContainer && button !== this._previousTreeSelectedActor) {
                this._previousTreeSelectedActor.style_class = "menu-category-button";
            }
            if (parent != this._activeContainer) {
                parent._vis_iter.reloadVisible();
            }
            let _maybePreviousActor = this._activeActor;
            if (_maybePreviousActor && this._activeContainer === this.applicationsBox) {
                this._previousSelectedActor = _maybePreviousActor;
                this._clearPrevAppSelection();
            }
            if (parent === this.categoriesBox && !this.searchActive) {
                this._previousSelectedActor = _maybePreviousActor;
                this._clearPrevCatSelection();
            }
            this._activeContainer = parent;
            this._activeActor = button.actor;
            this._selectedItemIndex = this._activeContainer._vis_iter.getAbsoluteIndexOfChild(this._activeActor);
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },

    _clearPrevAppSelection: function(actor) {
        if (this._previousSelectedActor && this._previousSelectedActor != actor) {
            this._previousSelectedActor.style_class = "menu-application-button";
        }
    },

    _clearPrevCatSelection: function(actor) {
        if (this._previousSelectedActor && this._previousSelectedActor != actor) {
            this._previousSelectedActor.style_class = "menu-category-button";
        }
    },

    _removeButtons: function(buttons) {
        for (let i = 0; i < buttons.length; i++) {
            let button = buttons[i];
            if(button.actor.get_parent()) {
                this.applicationsBox.remove_actor(button.actor);
                if(button instanceof ApplicationButton) {
                    this.applicationsBox.remove_actor(button.menu.actor);
                }
            }
        }
    },
    _resortButtons: function(bySearchScore) {
        let allListButtons = this._applicationsButtons.slice().concat(this._placesButtons).concat(this._recentButtons);
        this._removeButtons(allListButtons);
        
        // Sort apps and add to applicationsBox
        if(bySearchScore) {
            allListButtons.sort(function(a, b) {
                let sr = b.searchScore - a.searchScore;
                if(sr == 0)
                    sr = a.name.toLowerCase() > b.name.toLowerCase();
                return sr;
            });
        } else {
            allListButtons.sort(function(a, b) {
                let sr = a.name.toLowerCase() > b.name.toLowerCase();
                return sr;
            });
        }
        for (let i = 0; i < allListButtons.length; i++) {
            let button = allListButtons[i];
            this.applicationsBox.add_actor(button.actor);
            if(button instanceof ApplicationButton) {
                button.actor.realize();
                this.applicationsBox.add_actor(button.menu.actor);
            }
        }
    },
    
    _refreshPlaces : function() {
        this._refresh.places = true;
    },
    
    _refreshRecent : function() {
        this._refresh.recent = true;
    },
    
    _refreshApps : function() {
        this._refresh.apps = true;
    },
    
    _refreshApplicationsBox : function() {
        let refreshApps = this._refresh.apps;
        let refreshPlaces = this._refresh.places;
        let refreshRecent = this._refresh.recent;
        this._refresh.apps = false;
        this._refresh.places = false;
        this._refresh.recent = false;
        
        if(refreshApps == false && refreshPlaces == false && refreshRecent == false)
            return;
        
        //Remove all applications and categories
        this._removeButtons(this._applicationsButtons);
        this._removeButtons(this._placesButtons);
        this._removeButtons(this._recentButtons);
        this.categoriesBox.destroy_all_children();
        
        this._allAppsCategoryButton = new AppCategoryButton(null);
        this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function() {
            if (!this.searchActive) {
                this._allAppsCategoryButton.isHovered = true;
                if (this.hover_delay > 0) {
                    Tweener.addTween(this, {
                           time: this.hover_delay,
                           onComplete: function () {
                               if (this._allAppsCategoryButton.isHovered) {
                                   this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                                   this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
                                   this._select_category(null, this._allAppsCategoryButton);
                               } else {
                                   this._allAppsCategoryButton.actor.style_class = "menu-category-button";
                               }
                           }
                    });
                } else {
                    this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                    this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
                    this._select_category(null, this._allAppsCategoryButton);
                }
            }
         }));

        this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function () {
           if (!this.searchActive) {
               this._allAppsCategoryButton.actor.style_class = "menu-category-button";
           }
           this._previousSelectedActor = this._allAppsCategoryButton.actor;
           this._allAppsCategoryButton.isHovered = false;
        }));
        this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);

        if(refreshApps) {
            for (let i = 0; i < this._applicationsButtons.length; i++) {
                let button = this._applicationsButtons[i];
                button.menu.actor.destroy();
                button.actor.destroy();
            }
            this._applicationsButtons = new Array();
            this._applicationsBoxWidth = 0;
        }
        
        let trees = [appsys.get_tree()];

        for (var i in trees) {
            let tree = trees[i];
            let root = tree.get_root_directory();

            let iter = root.iter();
            let nextType;
            while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
                if (nextType == GMenu.TreeItemType.DIRECTORY) {
                    let dir = iter.get_directory();
                    if (dir.get_is_nodisplay())
                        continue;
                    if(refreshApps) {
                        this.applicationsByCategory[dir.get_menu_id()] = new Array();
                        this._loadCategory(dir);
                    }
                    if (this.applicationsByCategory[dir.get_menu_id()].length>0){
                        let categoryButton = new AppCategoryButton(dir);
                        this._addEnterEvent(categoryButton, Lang.bind(this, function() {
                            if (!this.searchActive) {
                                categoryButton.isHovered = true;
                                if (this.hover_delay > 0) {
                                    Tweener.addTween(this, {
                                            time: this.hover_delay,
                                            onComplete: function () {
                                                if (categoryButton.isHovered) {
                                                    categoryButton.actor.style_class = "menu-category-button-selected";
                                                    this._clearPrevCatSelection(categoryButton.actor);
                                                    this._select_category(dir, categoryButton);
                                                } else {
                                                    categoryButton.actor.style_class = "menu-category-button";
                                                }
                                            }
                                    });
                                } else {
                                    categoryButton.actor.style_class = "menu-category-button-selected";
                                    this._clearPrevCatSelection(categoryButton.actor);
                                    this._select_category(dir, categoryButton);
                                }
                            }
                        }));
                      categoryButton.actor.connect('leave-event', Lang.bind(this, function () {
                            if (!this.searchActive) {
                                categoryButton.actor.style_class = "menu-category-button";
                            }
                            this._previousSelectedActor = categoryButton.actor;
                            categoryButton.isHovered = false;
                      }));
                      this.categoriesBox.add_actor(categoryButton.actor);
                    }
                }
            }
        }
        
        // Now generate Places category and places buttons and add to the list
        if (this.showPlaces) {
            this.placesButton = new CategoryButton(_("Places"), "folder");
            this._addEnterEvent(this.placesButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.placesButton.isHovered = true;
                    Tweener.addTween(this, {
                        time: this.hover_delay,
                        onComplete: function () {
                            if (this.placesButton.isHovered) {
                                this.placesButton.actor.style_class = "menu-category-button-selected";
                                this._clearPrevCatSelection(this.placesButton);
                                this._displayButtons(null, this._applicationsButtons);
                                this._displayButtons(-1, this._placesButtons);
                                this._displayButtons(null, this._recentButtons);
                            }
                        }
                    });
                }
            }));
            this.placesButton.actor.connect('leave-event', Lang.bind(this, function () {
                if (!this.searchActive) {
                    this.placesButton.actor.style_class = "menu-category-button";
                }
                this._previousSelectedActor = this.placesButton.actor;
                this.placesButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this.placesButton.actor);

            if (refreshPlaces) {
                for (let i = 0; i < this._placesButtons.length; i++)
                    this._placesButtons[i].actor.destroy();
                
                this._placesButtons = new Array();

                let bookmarks = Main.placesManager.getBookmarks().slice();
                let places = bookmarks.concat(Main.placesManager.getMounts());
                for (var i = 0; i < places.length; i++) {
                    let place = places[i];
                    let button = new PlaceButton(this, place, place.name);
                    this._addEnterEvent(button, Lang.bind(this, this._enterButton, button));
                    button.actor.connect('leave-event', Lang.bind(this, this._leaveButton, button));
                    this._placesButtons.push(button);
                }
            }
        }

        // Now generate recent category and recent files buttons and add to the list
        if (this.showRecent) {
            this.recentButton = new CategoryButton(_("Recent Files"), "folder-recent");
            this._addEnterEvent(this.recentButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.recentButton.isHovered = true;
                    Tweener.addTween(this, {
                        time: this.hover_delay,
                        onComplete: function () {
                            if (this.recentButton.isHovered) {
                                this.recentButton.actor.style_class = "menu-category-button-selected";
                                this._clearPrevCatSelection(this.recentButton.actor);
                                this._displayButtons(null, this._applicationsButtons);
                                this._displayButtons(null, this._placesButtons);
                                this._displayButtons(-1, this._recentButtons);
                            }
                        }
                    });
                }
            }));
            this.recentButton.actor.connect('leave-event', Lang.bind(this, function () {
                if (!this.searchActive) {
                    this.recentButton.actor.style_class = "menu-category-button";
                }
                this._previousSelectedActor = this.recentButton.actor;
                this.recentButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this.recentButton.actor);
            
            if (refreshRecent) {
                for (let i = 0; i < this._recentButtons.length; i++)
                    this._recentButtons[i].actor.destroy();
                this._recentButtons = new Array();

                for (let id = 0; id < MAX_RECENT_FILES && id < this.RecentManager._infosByTimestamp.length; id++) {
                    let button = new RecentButton(this, this.RecentManager._infosByTimestamp[id]);
                    this._addEnterEvent(button, Lang.bind(this, this._enterButton, button));
                    button.actor.connect('leave-event', Lang.bind(this, this._leaveButton, button));
                    this._recentButtons.push(button);
                }
                if (this.RecentManager._infosByTimestamp.length > 0) {
                    let button = new RecentClearButton(this);
                    this._addEnterEvent(button, Lang.bind(this, this._enterButton, button));
                    button.actor.connect('leave-event', Lang.bind(this, this._leaveButton, button));
                    this._recentButtons.push(button);
                }
            }
        }
        
        this._resortButtons(false);
        
        this._setCategoriesButtonActive(!this.searchActive);
    },

    _enterButton: function(button) {
        this._updateAppInfo(button.name, button.description);
        
        this._clearPrevAppSelection(button.actor);
        button.actor.style_class = button.buttonStyle + "-selected";
        this._scrollToButton(button);
    },

    _leaveButton: function(a, b, button) {
        this._updateAppInfo("", "");
        
        this._previousSelectedActor = button.actor;
        button.actor.style_class = button.buttonStyle;
    },

    _enterSideButton: function(button) {
        this._updateAppInfo(button.name, button.description);
    },

    _leaveSideButton: function(a, b, button) {
        this._updateAppInfo("", "");
    },

    _refreshAppInfo: function() {
        this.selectedAppBox.visible = (this.showAppInfoTitle || this.showAppInfoDescription);
        this.selectedAppDescription.visible = this.showAppInfoDescription;
        this.selectedAppTitle.visible = this.showAppInfoTitle;
        this.selectedAppDescription.clutter_text.set_line_wrap(this.useMultilineAppInfoDescription);
        this.selectedAppDescription.style = this.alignAppInfoRight ? 'text-align:right;' : 'text-align:left;';
        this.selectedAppTitle.style = this.selectedAppDescription.style;
    },

    _refreshFlipSearchAppInfo: function() {
        if(!this.flipSearchAppInfo)
            this.searchBox.reparent(this.topRightPane);
        else
            this.searchBox.reparent(this.bottomRightPane);
            
        if(this.flipSearchAppInfo)
            this.selectedAppBox.reparent(this.topPane);
        else
            this.selectedAppBox.reparent(this.bottomPane);
        
        
        let showLeftPane = (this.showSystemButtons || this.showFavorites);
        let scrollBoxHeight = 200;
        if(showLeftPane) {
            scrollBoxHeight = (this.leftBox.get_allocation_box().y2-this.leftBox.get_allocation_box().y1) -
                                 (this.searchBox.get_allocation_box().y2-this.searchBox.get_allocation_box().y1);
        }
        this.applicationsScrollBox.style = "height: "+scrollBoxHeight+"px;";
    },
    
    _refreshFavs : function() {
        //Remove all favorites
        this.leftBox.get_children().forEach(Lang.bind(this, function (child) {
            child.destroy();
        }));

        let numFavorites = 0;

        this.leftPane.visible = (this.showFavorites || this.showSystemButtons);
        
        if(this.showFavorites) {
            let favoritesBox = new FavoritesBox();
            this.leftBox.add_actor(favoritesBox.actor, { y_align: St.Align.END, y_fill: false });

            //Load favorites again
            this._favoritesButtons = new Array();
            let launchers = global.settings.get_strv('favorite-apps');
            let appSys = Cinnamon.AppSystem.get_default();
            let j = 0;
            numFavorites = launchers.length;

            for ( let i = 0; i < launchers.length; ++i ) {
                let app = appSys.lookup_app(launchers[i]);
                if (app) {
                    let button = new FavoritesButton(this, app, launchers.length + 3); // + 3 because we're adding 3 system buttons at the bottom
                    this._favoritesButtons[app] = button;
                    favoritesBox.actor.add_actor(button.actor, { y_align: St.Align.END, y_fill: false });
                    button.actor.connect('enter-event', Lang.bind(this, this._enterSideButton, button));
                    button.actor.connect('leave-event', Lang.bind(this, this._leaveSideButton, button));
                    ++j;
                }
            }
        }

        if(this.showSystemButtons) {
            //Separator
            if (numFavorites > 0){
                numFavorites++;
                let separator = new PopupMenu.PopupSeparatorMenuItem();
                this.leftBox.add_actor(separator.actor, { y_align: St.Align.END, y_fill: false });
            }

            //Lock screen
            let button = new SystemButton(this, "gnome-lockscreen", numFavorites + 3, _("Lock screen"), _("Lock the screen"));
            button.actor.connect('enter-event', Lang.bind(this, this._enterSideButton, button));
            button.actor.connect('leave-event', Lang.bind(this, this._leaveSideButton, button));
            button.actor.connect('clicked', Lang.bind(this, function() {
                this.menu.close();
                this._screenSaverProxy.LockRemote();
            }));

            this.leftBox.add_actor(button.actor, { y_align: St.Align.END, y_fill: false });

            //Logout button
            button = new SystemButton(this, "gnome-logout", numFavorites + 3, _("Logout"), _("Leave the session"));
            button.actor.connect('enter-event', Lang.bind(this, this._enterSideButton, button));
            button.actor.connect('leave-event', Lang.bind(this, this._leaveSideButton, button));
            button.actor.connect('clicked', Lang.bind(this, function() {
                this.menu.close();
                this._session.LogoutRemote(0);
            }));

            this.leftBox.add_actor(button.actor, { y_align: St.Align.END, y_fill: false });

            //Shutdown button
            button = new SystemButton(this, "gnome-shutdown", numFavorites + 3, _("Quit"), _("Shutdown the computer"));
            button.actor.connect('enter-event', Lang.bind(this, this._enterSideButton, button));
            button.actor.connect('leave-event', Lang.bind(this, this._leaveSideButton, button));
            button.actor.connect('clicked', Lang.bind(this, function() {
                this.menu.close();
                this._session.ShutdownRemote();
            }));

            this.leftBox.add_actor(button.actor, { y_align: St.Align.END, y_fill: false });
        }
    },

    _loadCategory: function(dir, top_dir) {
        var iter = dir.iter();
        var dupe = false;
        var nextType;
        if (!top_dir) top_dir = dir;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    var app = appsys.lookup_app_by_tree_entry(entry);
                    dupe = this.find_dupe(app);
                    if (!dupe) {
                        let applicationButton = new ApplicationButton(this, app);
                        applicationButton.actor.connect('realize', Lang.bind(this, this._onApplicationButtonRealized));
                        applicationButton.actor.connect('leave-event', Lang.bind(this, this._leaveButton, applicationButton));
                        this._addEnterEvent(applicationButton, Lang.bind(this, this._enterButton, applicationButton));
                        this._applicationsButtons.push(applicationButton);
                        applicationButton.category.push(top_dir.get_menu_id());
                        this.applicationsByCategory[top_dir.get_menu_id()].push(app.get_name());
                    } else {
                        for (let i = 0; i < this._applicationsButtons.length; i++) {
                            if (this._applicationsButtons[i].app == app) {
                                this._applicationsButtons[i].category.push(dir.get_menu_id());
                            }
                        }
                        this.applicationsByCategory[dir.get_menu_id()].push(app.get_name());
                    }
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                this.applicationsByCategory[subdir.get_menu_id()] = new Array();
                this._loadCategory(subdir, top_dir);
            }
        }
    },

    find_dupe: function(app) {
        let ret = false;
        for (let i = 0; i < this._applicationsButtons.length; i++) {
            if (app == this._applicationsButtons[i].app) {
                ret = true;
                break;
            }
        }
        return ret;
    },

    _scrollToButton: function(button) {
        var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.applicationsScrollBox.get_allocation_box().y2-this.applicationsScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1-10) new_scroll_value = button.actor.get_allocation_box().y1-10;
        if (box_height+current_scroll_value < button.actor.get_allocation_box().y2+10) new_scroll_value = button.actor.get_allocation_box().y2-box_height+10;
        if (new_scroll_value!=current_scroll_value) this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },

    _display : function() {
        this._activeContainer = null;
        this._activeActor = null;
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        
        // Prepare search box
        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });
        this.searchEntry = new St.Entry({ name: 'menu-search-entry',
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchBox.add_actor(this.searchEntry);
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._previousSearchPattern = "";

        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        let rightPane = new St.BoxLayout({ style_class: 'menu-right-pane', vertical: true });
        
        this.topRightPane = new St.BoxLayout({ vertical: true });
        rightPane.add_actor(this.topRightPane);

        this.categoriesApplicationsBox = new CategoriesApplicationsBox();
        rightPane.add_actor(this.categoriesApplicationsBox.actor);
        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box', vertical: true });
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });

        this.a11y_settings = new Gio.Settings({ schema: "org.gnome.desktop.a11y.applications" });
        this.a11y_settings.connect("changed::screen-magnifier-enabled", Lang.bind(this, this._updateVFade));
        this._updateVFade();

        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start',
                        Lang.bind(this, function() {
                                      this.menu.passEvents = true;
                                  }));
        vscroll.connect('scroll-stop',
                        Lang.bind(this, function() {
                                      this.menu.passEvents = false;
                                  }));

        this.applicationsBox = new St.BoxLayout({ style_class: 'menu-applications-box', vertical:true });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.actor.add_actor(this.categoriesBox);
        this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);

        this.applicationsByCategory = {};

        this.bottomRightPane = new St.BoxLayout({ vertical: true });
        rightPane.add_actor(this.bottomRightPane);
        
        this.selectedAppBox = new St.BoxLayout({ style_class: 'menu-selected-app-box', vertical: true });

        this.selectedAppTitle = new St.Label({ style_class: 'menu-selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'menu-selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);

        this.topPane = new St.BoxLayout({ vertical: true });
        section.actor.add_actor(this.topPane);
        
        this.leftPane = new St.BoxLayout({ style_class: 'menu-left-pane', vertical: true });
        this.leftPane.visible = (this.showFavorites || this.showSystemButtons);
        this.leftBox = new St.BoxLayout({ style_class: 'menu-favorites-box', vertical: true });
        this.leftPane.add_actor(this.leftBox, { y_align: St.Align.END, y_fill: false });

        this._refreshFavs();

        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-box', vertical:false });

        this.mainBox.add_actor(this.leftPane, { span: 1 });
        this.mainBox.add_actor(rightPane, { span: 1 });

        section.actor.add_actor(this.mainBox);

        this.bottomPane = new St.BoxLayout({ vertical: true });
        section.actor.add_actor(this.bottomPane);
        
        this._refreshAppInfo();
        this._refreshFlipSearchAppInfo();
        
        this.appBoxIter = new VisibleChildIterator(this, this.applicationsBox);
        this.applicationsBox._vis_iter = this.appBoxIter;
        this.catBoxIter = new VisibleChildIterator(this, this.categoriesBox);
        this.categoriesBox._vis_iter = this.catBoxIter;
        Mainloop.idle_add(Lang.bind(this, function() {
            this._clearAllSelections();
        }));
    },

    _updateVFade: function() {
        let mag_on = this.a11y_settings.get_boolean("screen-magnifier-enabled");
        if (mag_on) {
            this.applicationsScrollBox.style_class = "menu-applications-scrollbox";
        } else {
            this.applicationsScrollBox.style_class = "vfade menu-applications-scrollbox";
        }
    },

    _clearAllSelections: function() {
        let actors = this.applicationsBox.get_children();
        for (var i=0; i<actors.length; i++) {
            let actor = actors[i];
            actor.style_class = "menu-application-button";
            actor.hide();
        }
        actors = this.categoriesBox.get_children();
        for (var i=0; i<actors.length; i++){
            let actor = actors[i];
            actor.style_class = "menu-category-button";
            actor.show();
        }
    },

    _select_category : function(dir, categoryButton) {
        let category = 'all';
        if (dir && dir.get_menu_id())
            category = dir.get_menu_id();
        this._displayAppButtonsForCategory(category);
        this.closeApplicationsContextMenus(null, false);
    },

    closeApplicationsContextMenus: function(excludeApp, animate) {
        for (var app in this._applicationsButtons){
            if (app!=excludeApp && this._applicationsButtons[app].menu.isOpen){
                if (animate)
                    this._applicationsButtons[app].toggleMenu();
                else
                    this._applicationsButtons[app].closeMenu();
            }
        }
    },

    _onApplicationButtonRealized: function(actor) {
        if (actor.get_width() > this._applicationsBoxWidth){
            this._applicationsBoxWidth = actor.get_width();
            this.applicationsBox.set_width(this._applicationsBoxWidth + 20);
        }
    },

    _displayAppButtonsForCategory: function(appCategory){
        this._displayButtons(null, this._placesButtons);
        this._displayButtons(null, this._recentButtons);
        if (appCategory == "all") {
            this._displayButtons(-1, this._applicationsButtons);
        } else {
            this._applicationsButtons.forEach( function (item, index) {
                if (item.category.indexOf(appCategory) != -1) {
                    if (!item.actor.visible) {
                        item.actor.show();
                    }
                } else {
                    if (item.actor.visible) {
                        item.actor.hide();
                    }
                }
            });
        }
    },

    _displayButtons: function(nameList, buttonList){
        if(nameList == null) {
            buttonList.forEach( function (item, index) {
                if (item.actor.visible)
                    item.actor.hide();
            });
        }
        else if (nameList == -1) {
            buttonList.forEach( function (item, index) {
                if (!item.actor.visible)
                    item.actor.show();
            });
        } else {
            buttonList.forEach( function (item, index) {
                if (nameList.indexOf(item.name) != -1) {
                    if (!item.actor.visible)
                        item.actor.show();
                }
                else if (item.actor.visible)
                        item.actor.hide();
            });
        }
    },

    _setCategoriesButtonActive: function(active) {
        try {
            let categoriesButtons = this.categoriesBox.get_children();
            for (var i in categoriesButtons) {
                let button = categoriesButtons[i];
                if (active){
                    button.set_style_class_name("menu-category-button");
                } else {
                    button.set_style_class_name("menu-category-button-greyed");
                }
             }
        } catch (e) {
            global.log(e);
        }
     },

     resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        this._clearAllSelections();
        this._resortButtons(false);
        this._setCategoriesButtonActive(true);
        global.stage.set_key_focus(this.searchEntry);
     },

     _onSearchTextChanged: function (se, prop) {
        if (this.menuIsOpening) {
            this.menuIsOpening = false;
            return;
        } else {
            this.searchActive = this.searchEntry.get_text() != '';
            this._clearAllSelections();
            if (this.searchActive) {
                this.searchEntry.set_secondary_icon(this._searchActiveIcon);
                if (this._searchIconClickedId == 0) {
                    this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked',
                        Lang.bind(this, function() {
                            this.resetSearch();
                            this._select_category(null, this._allAppsCategoryButton);
                        }));
                }
                this._setCategoriesButtonActive(false);
                this._doSearch();
            } else {
                if (this._searchIconClickedId > 0)
                    this.searchEntry.disconnect(this._searchIconClickedId);
                this._searchIconClickedId = 0;
                this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
                this._resortButtons(false);
                this._setCategoriesButtonActive(true);
                this._select_category(null, this._allAppsCategoryButton);
            }
        }
    },

    _listButtons: function(buttons, pattern) {
        let res = new Array();
        if (pattern){
            for (var i in buttons) {
                if (buttons[i].search(pattern))
                    res.push(buttons[i].name);
            }
        }
        return res;
    },
    
    _updateAppInfo: function(name, description) {
        if(this.selectedAppTitle)
            this.selectedAppTitle.set_text(name);
        if(this.selectedAppDescription)
            this.selectedAppDescription.set_text(description ? description : "");
    },

    _doSearch: function(){
        let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
        if (pattern==this._previousSearchPattern) return false;
        this._previousSearchPattern = pattern;
        this._activeContainer = null;
        this._activeActor = null;
        this._selectedItemIndex = null;
        this._previousTreeItemIndex = null;
        this._previousTreeSelectedActor = null;
        this._previousSelectedActor = null;

       // _listButtons returns all the applications when the search
       // string is zero length. This will happend if you type a space
       // in the search entry.
        if (pattern.length == 0) {
            this._updateAppInfo("", "");
            return false;
        }

        var appResults = this._listButtons(this._applicationsButtons, pattern);
        var placesResults = !this.showPlaces ? null : this._listButtons(this._placesButtons, pattern);
        var recentResults = !this.showRecent ? null : this._listButtons(this._recentButtons, pattern);

        this._resortButtons(true);
        this._displayButtons(appResults, this._applicationsButtons);
        this._displayButtons(placesResults, this._placesButtons);
        this._displayButtons(recentResults, this._recentButtons);
        if(appResults.length == 0 && placesResults.length == 0 && recentResults.length == 0) {
            this._updateAppInfo("", "");
        }

        this.appBoxIter.reloadVisible();
        if (this.appBoxIter.getNumVisibleChildren() > 0) {
            let item_actor = this.appBoxIter.getFirstVisible();
            this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            this._activeContainer = this.applicationsBox;
            if (item_actor && item_actor != this.searchEntry) {
                item_actor._delegate.emit('enter-event');
            }
        }
        return false;
    }
};

function main(metadata, orientation, panel_height) {
    return new MyApplet(orientation, panel_height);
}
