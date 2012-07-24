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
        this._appButton.actor.grab_key_focus();
        this._appButton.toggleMenu();
        return false;
    }

};

function GenericApplicationButton(appsMenuButton, app) {
    this._init(appsMenuButton, app);
}

GenericApplicationButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,
    
    _init: function(appsMenuButton, app, withMenu) {
        this.app = app;
        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        
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
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true);

        this.actor.add_style_class_name('menu-application-button');
        this.icon = this.app.create_icon_texture(APPLICATION_ICON_SIZE);
        this.addActor(this.icon);
        this.name = this.app.get_name();
        this.label = new St.Label({ text: this.name, style_class: 'menu-application-button-label' });
        this.addActor(this.label);
        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
    },
    
    get_app_id: function() {
        return this.app.get_id();
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
Signals.addSignalMethods(ApplicationButton.prototype);

function PlaceButton(appsMenuButton, place, button_name) {
    this._init(appsMenuButton, place, button_name);
}

PlaceButton.prototype = {
    _init: function(appsMenuButton,place, button_name) {
        this.place = place;
        this.button_name = button_name;
        this.actor = new St.Button({ reactive: true, style_class: 'menu-application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: this.button_name, style_class: 'menu-place-cat-button-label' });
        this.icon = place.iconFactory(APPLICATION_ICON_SIZE);
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add_actor(this.label);
        this.actor.set_child(this.buttonbox);
        this.actor.connect('clicked', Lang.bind(this, function() {
            this.place.launch();
            appsMenuButton.menu.close();
        }));
    }
};
Signals.addSignalMethods(PlaceButton.prototype);

function RecentButton(appsMenuButton, file) {
    this._init(appsMenuButton, file);
}

RecentButton.prototype = {
    _init: function(appsMenuButton, file) {
        this.file = file;
        this.button_name = this.file.name;
        this.actor = new St.Button({ reactive: true, style_class: 'menu-application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: this.button_name, style_class: 'menu-place-cat-button-label' });
        this.icon = file.createIcon(APPLICATION_ICON_SIZE);
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add_actor(this.label);
        this.actor.set_child(this.buttonbox);
        this.actor.connect('clicked', Lang.bind(this, function() {
            Gio.app_info_launch_default_for_uri(this.file.uri, global.create_app_launch_context());
            appsMenuButton.menu.close();
            }));
    }
};
Signals.addSignalMethods(RecentButton.prototype);

function RecentClearButton(appsMenuButton) {
    this._init(appsMenuButton);
}

RecentClearButton.prototype = {
    _init: function(appsMenuButton) {
        this.button_name = _("Clear list");
        this.actor = new St.Button({ reactive: true, style_class: 'menu-application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: this.button_name, style_class: 'menu-place-cat-button-label' });
        let icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, icon_size: APPLICATION_ICON_SIZE });
        this.buttonbox.add_actor(icon);
        this.buttonbox.add_actor(this.label);
        this.actor.set_child(this.buttonbox);
        this.actor.connect('clicked', Lang.bind(this, function() {
            appsMenuButton.menu.close();
            let GtkRecent = new Gtk.RecentManager();
            GtkRecent.purge_items();
            }));
    }
};
Signals.addSignalMethods(RecentClearButton.prototype);

function CategoryButton(app) {
    this._init(app);
}

CategoryButton.prototype = {
    _init: function(category) {
        var label;
        if (category) {
            let icon = category.get_icon();
            if (icon && icon.get_names)
                this.icon_name = icon.get_names().toString();
            else
                this.icon_name = "";
            label = category.get_name();
        } else
            label = _("All Applications");
        this.actor = new St.Button({ reactive: true, style_class: 'menu-category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: label, style_class: 'menu-place-cat-button-label' });
        if (category && this.icon_name) {
            this.icon = new St.Icon({icon_name: this.icon_name, icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
            this.buttonbox.add_actor(this.icon);
        }
        this.buttonbox.add_actor(this.label);
        this.actor.set_child(this.buttonbox);
        //this.actor.set_tooltip_text(category.get_name());
    }
};
Signals.addSignalMethods(CategoryButton.prototype);

function PlaceCategoryButton(app) {
    this._init(app);
}

PlaceCategoryButton.prototype = {
    _init: function(category) {
        this.actor = new St.Button({ reactive: true, style_class: 'menu-category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: _("Places"), style_class: 'menu-place-cat-button-label' });
        this.icon = new St.Icon({icon_name: "folder", icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add_actor(this.label);
        this.actor.set_child(this.buttonbox);
    }
};
Signals.addSignalMethods(PlaceCategoryButton.prototype);

function RecentCategoryButton(app) {
    this._init(app);
}

RecentCategoryButton.prototype = {
    _init: function(category) {
        this.actor = new St.Button({ reactive: true, style_class: 'menu-category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: _("Recent Files"), style_class: 'menu-place-cat-button-label' });
        this.icon = new St.Icon({icon_name: "folder-recent", icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add_actor(this.label);
        this.actor.set_child(this.buttonbox);
    }
};
Signals.addSignalMethods(RecentCategoryButton.prototype);



function FavoritesButton(appsMenuButton, app, nbFavorites) {
    this._init(appsMenuButton, app, nbFavorites);
}

FavoritesButton.prototype = {
    __proto__: GenericApplicationButton.prototype,
    
    _init: function(appsMenuButton, app, nbFavorites) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app);        
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7*monitorHeight) / nbFavorites;
        let icon_size = 0.6*real_size;
        if (icon_size>MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;
        this.actor.style = "padding-top: "+(icon_size/3)+"px;padding-bottom: "+(icon_size/3)+"px; margin:auto;"

        this.actor.add_style_class_name('menu-favorites-button');
        this.addActor(app.create_icon_texture(icon_size));  
        
        this._draggable = DND.makeDraggable(this.actor);     
        this.isDraggableApp = true;
    },
    
    get_app_id: function() {
        return this.app.get_id();
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
    _init: function(appsMenuButton, icon, nbFavorites) {
        this.actor = new St.Button({ reactive: true, style_class: 'menu-favorites-button' });        
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7*monitorHeight) / nbFavorites;
        let icon_size = 0.6*real_size;
        if (icon_size>MAX_FAV_ICON_SIZE) icon_size = MAX_FAV_ICON_SIZE;
        this.actor.style = "padding-top: "+(icon_size/3)+"px;padding-bottom: "+(icon_size/3)+"px; margin:auto;"
        let iconObj = new St.Icon({icon_name: icon, icon_size: icon_size, icon_type: St.IconType.FULLCOLOR});
        this.actor.set_child(iconObj);             
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

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation);
        
        try {                    
            this.set_applet_tooltip(_("Menu"));
                                    
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);   
                        
            this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
            this.showRecent = global.settings.get_boolean("menu-show-recent");
            global.settings.connect("changed::menu-show-recent", Lang.bind(this, function() {
                this.showRecent = global.settings.get_boolean("menu-show-recent");
                this._refreshApps();
            }));
            this.showPlaces = global.settings.get_boolean("menu-show-places");
            global.settings.connect("changed::menu-show-places", Lang.bind(this, function() {
                this.showPlaces = global.settings.get_boolean("menu-show-places");
                this._refreshApps();
            }));
            let openOnHover = global.settings.get_boolean("activate-menu-applet-on-hover");
            if (openOnHover)
                this._openMenuId = this.actor.connect('enter-event', Lang.bind(this, this.openMenu));

            global.settings.connect("changed::activate-menu-applet-on-hover", Lang.bind(this, function() {
                let openOnHover = global.settings.get_boolean("activate-menu-applet-on-hover");
                if (openOnHover)
                    this._openMenuId = this.actor.connect('enter-event', Lang.bind(this, this.openMenu));
                else
                    this.actor.disconnect(this._openMenuId);
            }));
                        
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
            this._searchTimeoutId = 0;
            this._searchIconClickedId = 0;
            this._applicationsButtons = new Array();
            this._favoritesButtons = new Array();
            this._placesButtons = new Array();
            this._selectedItemIndex = null;
            this._previousSelectedItemIndex = null;
            this._previousSelectedActor = null;
            this._activeContainer = null;
            this._activeActor = null;
            this._applicationsBoxWidth = 0;
            
            this.RecentManager = new DocInfo.DocManager();

            this._display();
            appsys.connect('installed-changed', Lang.bind(this, this._refreshApps));
            AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshFavs));

            this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));  
            
            
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
            Main.placesManager.connect('places-updated', Lang.bind(this, this._refreshApps));
            this.RecentManager.connect('changed', Lang.bind(this, this._refreshApps));

            this.edit_menu_item = new Applet.MenuItem(_("Edit menu"), Gtk.STOCK_EDIT, Lang.bind(this, this._launch_editor));
            this._applet_context_menu.addMenuItem(this.edit_menu_item);
            let settings_menu_item = new Applet.MenuItem(_("Menu settings"), null, function() {
                Util.spawnCommandLine("cinnamon-settings menu");
            });
            this._applet_context_menu.addMenuItem(settings_menu_item);
            this.actor.map();
            
        }
        catch (e) {
            global.logError(e);
        }
    },

    openMenu: function() {
        this.menu.open(true);
    },

    on_orientation_changed: function (orientation) {
        this.menu.destroy();
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        
        this.menu.actor.add_style_class_name('menu-background');
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));
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
            this.actor.add_style_pseudo_class('active');
            this._select_category(null, this._allAppsCategoryButton);
	} else {
            this.actor.remove_style_pseudo_class('active');            
            if (this.searchActive) {
		this.resetSearch();
	    }
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
            this._previousSelectedItemIndex = null;
            this._previousSelectedActor = null;
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

        let index = this._selectedItemIndex;   

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
                item_actor = this.appBoxIter.getPrevVisible(this.applicationsBox.get_child_at_index(index));
                index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            } else {
                item_actor = this.catBoxIter.getPrevVisible(this._activeActor)
                index = this.catBoxIter.getAbsoluteIndexOfChild(item_actor);
            }
        } else if (symbol == Clutter.KEY_Down) {
            if (this._activeContainer==this.applicationsBox) {
                item_actor = this.appBoxIter.getNextVisible(this.applicationsBox.get_child_at_index(index));
                index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            } else {
                item_actor = this.catBoxIter.getNextVisible(this._activeActor)
                index = this.catBoxIter.getAbsoluteIndexOfChild(item_actor);
            }
        } else if (symbol == Clutter.KEY_Right && (this._activeContainer !== this.applicationsBox)) {
            item_actor = this.appBoxIter.getFirstVisible();
            index = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
        } else if (symbol == Clutter.KEY_Left && this._activeContainer === this.applicationsBox && !this.searchActive) {
            this._clearSelections(this.applicationsBox);
            item_actor = (this._previousSelectedActor != null) ? this._previousSelectedActor : this.catBoxIter.getFirstVisible();
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
                this._previousSelectedItemIndex = this._selectedItemIndex;
                this._previousSelectedActor = this._activeActor;
            }
            this._activeContainer = parent;
            this._activeActor = button.actor;
            let children = this._activeContainer.get_children();
            for (let i=0, l=children.length; i<l; i++) {
                if (button.actor === children[i]) {
                    this._selectedItemIndex = i;
                }
            };
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },

    _clearSelections: function(container) {
        container.get_children().forEach(function(actor) {
            if (!(actor instanceof St.BoxLayout))
                actor.style_class = "menu-category-button";
        });
    },

    _onOpenStateToggled: function(menu, open) {
       if (open) {
           global.stage.set_key_focus(this.searchEntry);
           this._selectedItemIndex = null;
           this._activeContainer = null;
           this._activeActor = null;
           let monitorHeight = Main.layoutManager.primaryMonitor.height;
           let applicationsBoxHeight = this.applicationsBox.get_allocation_box().y2-this.applicationsBox.get_allocation_box().y1;
           let scrollBoxHeight = (this.leftBox.get_allocation_box().y2-this.leftBox.get_allocation_box().y1)                                    
                                    -(this.searchBox.get_allocation_box().y2-this.searchBox.get_allocation_box().y1);           
           // if (scrollBoxHeight < (0.2*monitorHeight)  &&  (scrollBoxHeight < applicationsBoxHeight)) {
             //    scrollBoxHeight = Math.min(0.2*monitorHeight, applicationsBoxHeight);
            // }
            this.applicationsScrollBox.style = "height: "+scrollBoxHeight+"px;";
       } else {
           this.closeApplicationsContextMenus(null, false);
           //this.resetSearch();
           //this._clearSelections(this.categoriesBox);
           //this._clearSelections(this.applicationsBox);
       }
    },
    
    _refreshApps : function() {
        this.applicationsBox.destroy_all_children();
        this._applicationsButtons = new Array();
        this._placesButtons = new Array();
        this._recentButtons = new Array();
        this._applicationsBoxWidth = 0;
        //Remove all categories
    	this.categoriesBox.destroy_all_children();
        
        this._allAppsCategoryButton = new CategoryButton(null);
             this._allAppsCategoryButton.actor.connect('clicked', Lang.bind(this, function() {
            this._select_category(null, this._allAppsCategoryButton);
         }));
         this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function() {
             if (!this.searchActive) {
                 this._allAppsCategoryButton.isHovered = true;
                 Tweener.addTween(this, {
                        time: this.hover_delay,
                        onComplete: function () {
                            if (this._allAppsCategoryButton.isHovered) {
                                this._select_category(null, this._allAppsCategoryButton);
                            }
                        }
                 });
            }
         }));
         this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function () {
            this._allAppsCategoryButton.isHovered = false;
         }));
         this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);

        let trees = [appsys.get_tree(), appsys.get_settings_tree()];

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
                    this.applicationsByCategory[dir.get_menu_id()] = new Array();
                    this._loadCategory(dir);
                    if (this.applicationsByCategory[dir.get_menu_id()].length>0){
                       let categoryButton = new CategoryButton(dir);
                       categoryButton.actor.connect('clicked', Lang.bind(this, function() {
                         this._select_category(dir, categoryButton);
                      }));
                      this._addEnterEvent(categoryButton, Lang.bind(this, function() {
                          if (!this.searchActive) {
                             categoryButton.isHovered = true;
                             Tweener.addTween(this, {
                                time: this.hover_delay,
                                onComplete: function () {
                                    if (categoryButton.isHovered) {
                                        this._select_category(dir, categoryButton);
                                    }
                                }
                             });
                          }
                      }));
                      categoryButton.actor.connect('leave-event', function () {
                            categoryButton.isHovered = false;
                      });
                      this.categoriesBox.add_actor(categoryButton.actor);
                    }
                }
            } 
        }
        // Sort apps and add to applicationsBox
        this._applicationsButtons.sort(function(a, b) {
            let sr = a.app.get_name().toLowerCase() > b.app.get_name().toLowerCase();
            return sr;
        });

        for (let i = 0; i < this._applicationsButtons.length; i++) {
            this.applicationsBox.add_actor(this._applicationsButtons[i].actor);
            this._applicationsButtons[i].actor.realize();
            this.applicationsBox.add_actor(this._applicationsButtons[i].menu.actor);
        }

        // Now generate Places category and places buttons and add to the list
        if (this.showPlaces) {
            this.placesButton = new PlaceCategoryButton();
            this.placesButton.actor.connect('clicked', Lang.bind(this, function() {
                this._select_places(this.placesButton);
                }));
            this._addEnterEvent(this.placesButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.placesButton.isHovered = true;
                    Tweener.addTween(this, {
                        time: this.hover_delay,
                        onComplete: function () {
                            if (this.placesButton.isHovered) {
                                this._select_places(this.placesButton);
                            }
                        }
                    });
                }
            }));
            this.placesButton.actor.connect('leave-event', Lang.bind(this, function () {
                this.placesButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this.placesButton.actor);

            let bookmarks = this._listBookmarks();
            let devices = this._listDevices();
            let places = bookmarks.concat(devices);
            for (var i = 0; i < places.length; i++) {
                let place = places[i];
                let button = new PlaceButton(this, place, place.name);
                this._addEnterEvent(button, Lang.bind(this, function() {
                        this._clearSelections(this.applicationsBox);
                        button.actor.style_class = "menu-category-button-selected";
                        this._scrollToButton(button);
                        }));
                this._placesButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
            }
        }
        // Now generate recent category and recent files buttons and add to the list
        if (this.showRecent) {
            this.recentButton = new RecentCategoryButton();
            this.recentButton.actor.connect('clicked', Lang.bind(this, function() {
                this._select_recent(this.recentButton);
            }));
            this._addEnterEvent(this.recentButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.recentButton.isHovered = true;
                    Tweener.addTween(this, {
                        time: this.hover_delay,
                        onComplete: function () {
                            if (this.recentButton.isHovered) {
                                this._select_recent(this.recentButton);
                            }
                        }
                    });
                }
            }));
            this.recentButton.actor.connect('leave-event', Lang.bind(this, function () {
                this.recentButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this.recentButton.actor);

            for (let id = 0; id < 15 && id < this.RecentManager._infosByTimestamp.length; id++) {
                let button = new RecentButton(this, this.RecentManager._infosByTimestamp[id]);
                this._addEnterEvent(button, Lang.bind(this, function() {
                        this._clearSelections(this.applicationsBox);
                        button.actor.style_class = "menu-category-button-selected";
                        this._scrollToButton(button);
                        }));
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
            }
            if (this.RecentManager._infosByTimestamp.length > 0) {
                let button = new RecentClearButton(this);
                this._addEnterEvent(button, Lang.bind(this, function() {
                        this._clearSelections(this.applicationsBox);
                        button.actor.style_class = "menu-category-button-selected";
                        this._scrollToButton(button);
                        }));
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
            }
        }

        this._clearApplicationsBox();
        this._setCategoriesButtonActive(!this.searchActive);
    },

    _refreshFavs : function() {
    	//Remove all favorites
    	this.leftBox.get_children().forEach(Lang.bind(this, function (child) {
            child.destroy();
        }));
        
        let favoritesBox = new FavoritesBox();
        this.leftBox.add_actor(favoritesBox.actor, { y_align: St.Align.END, y_fill: false });
    	 
        //Load favorites again
        this._favoritesButtons = new Array();
        let launchers = global.settings.get_strv('favorite-apps');
        let appSys = Cinnamon.AppSystem.get_default();
        let j = 0;
        for ( let i = 0; i < launchers.length; ++i ) {
            let app = appSys.lookup_app(launchers[i]);
            if (!app) app = appSys.lookup_settings_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(this, app, launchers.length + 3); // + 3 because we're adding 3 system buttons at the bottom
                this._favoritesButtons[app] = button;
                favoritesBox.actor.add_actor(button.actor, { y_align: St.Align.END, y_fill: false });
                button.actor.connect('enter-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text(button.app.get_name());
                   if (button.app.get_description()) this.selectedAppDescription.set_text(button.app.get_description());
                   else this.selectedAppDescription.set_text("");
                }));
                button.actor.connect('leave-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text("");
                   this.selectedAppDescription.set_text("");
                }));
                ++j;
            }
        }
        
        //Separator
	if (launchers.length!=0){
            let separator = new PopupMenu.PopupSeparatorMenuItem();
            this.leftBox.add_actor(separator.actor, { y_align: St.Align.END, y_fill: false });                   
        }

        //Lock screen
        let button = new SystemButton(this, "gnome-lockscreen", launchers.length + 3);        
        button.actor.connect('enter-event', Lang.bind(this, function() {
				this.selectedAppTitle.set_text(_("Lock screen"));
				this.selectedAppDescription.set_text(_("Lock the screen"));				
			}));
		button.actor.connect('leave-event', Lang.bind(this, function() {
				this.selectedAppTitle.set_text("");
				this.selectedAppDescription.set_text("");
			}));        
        button.actor.connect('clicked', Lang.bind(this, function() {            
            this.menu.close();
            this._screenSaverProxy.LockRemote();
        }));
        
        this.leftBox.add_actor(button.actor, { y_align: St.Align.END, y_fill: false });                  
        
        //Logout button
        let button = new SystemButton(this, "gnome-logout", launchers.length + 3);        
        button.actor.connect('enter-event', Lang.bind(this, function() {
				this.selectedAppTitle.set_text(_("Logout"));
				this.selectedAppDescription.set_text(_("Leave the session"));				
			}));
		button.actor.connect('leave-event', Lang.bind(this, function() {
				this.selectedAppTitle.set_text("");
				this.selectedAppDescription.set_text("");
			}));        
        button.actor.connect('clicked', Lang.bind(this, function() {            
            this.menu.close();
            this._session.LogoutRemote(0);
        }));
        
        this.leftBox.add_actor(button.actor, { y_align: St.Align.END, y_fill: false }); 
                        
        //Shutdown button
        let button = new SystemButton(this, "gnome-shutdown", launchers.length + 3);        
        button.actor.connect('enter-event', Lang.bind(this, function() {
				this.selectedAppTitle.set_text(_("Quit"));
				this.selectedAppDescription.set_text(_("Shutdown the computer"));				
			}));
		button.actor.connect('leave-event', Lang.bind(this, function() {
				this.selectedAppTitle.set_text("");
				this.selectedAppDescription.set_text("");
			}));        
        button.actor.connect('clicked', Lang.bind(this, function() {            
            this.menu.close();
            this._session.ShutdownRemote();
        }));
        
        this.leftBox.add_actor(button.actor, { y_align: St.Align.END, y_fill: false });                
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
                    if (!app)
                        app = appsys.lookup_settings_app_by_tree_entry(entry);
                    dupe = this.find_dupe(app);
                    if (!dupe) {
                        let applicationButton = new ApplicationButton(this, app);
                        applicationButton.actor.connect('realize', Lang.bind(this, this._onApplicationButtonRealized));
                        applicationButton.actor.connect('leave-event', Lang.bind(this, function() {
                            this.selectedAppTitle.set_text("");
                            this.selectedAppDescription.set_text("");
                            }));
                        this._addEnterEvent(applicationButton, Lang.bind(this, function() {
                            this.selectedAppTitle.set_text(applicationButton.app.get_name());
                            if (applicationButton.app.get_description())
                                this.selectedAppDescription.set_text(applicationButton.app.get_description());
                            else
                                this.selectedAppDescription.set_text("");
                            this._clearSelections(this.applicationsBox);
                            applicationButton.actor.style_class = "menu-category-button-selected";
                            this._scrollToButton(applicationButton);
                            }));
                        this._applicationsButtons.push(applicationButton);
                        this.applicationsByCategory[dir.get_menu_id()].push(app.get_name());
                    } else {
                        this.applicationsByCategory[dir.get_menu_id()].push(app.get_name());
                    }
		}
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                this._loadCategory(iter.get_directory(), top_dir);
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
        
        let leftPane = new St.BoxLayout({ vertical: true });
                  
        this.leftBox = new St.BoxLayout({ style_class: 'menu-favorites-box', vertical: true });        
        
        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();            
                                       
        leftPane.add_actor(this.leftBox, { y_align: St.Align.END, y_fill: false });        
        
        let rightPane = new St.BoxLayout({ vertical: true });
        
        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });
        rightPane.add_actor(this.searchBox);
        
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

        this.categoriesApplicationsBox = new CategoriesApplicationsBox();
        rightPane.add_actor(this.categoriesApplicationsBox.actor);
        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box', vertical: true });
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });
        
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
                     
        this._refreshFavs();
                                                          
        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-box', vertical:false });       
                
        this.mainBox.add_actor(leftPane, { span: 1 });
        this.mainBox.add_actor(rightPane, { span: 1 });
        
        section.actor.add_actor(this.mainBox);
        
	this.applicationsByCategory = {};
        this._refreshApps();

        this.selectedAppBox = new St.BoxLayout({ style_class: 'menu-selected-app-box', vertical: true });
        this.selectedAppTitle = new St.Label({ style_class: 'menu-selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'menu-selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        section.actor.add_actor(this.selectedAppBox);
        this.appBoxIter = new VisibleChildIterator(this, this.applicationsBox);
        this.catBoxIter = new VisibleChildIterator(this, this.categoriesBox);
    },
    
    _clearApplicationsBox: function(selectedActor){
        let actors = this.applicationsBox.get_children();
        for (var i=0; i<actors.length; i++) {
            let actor = actors[i];
            actor.hide();
        }
        let actors = this.categoriesBox.get_children();
        for (var i=0; i<actors.length; i++){
            let actor = actors[i];
            if (this.searchActive) actor.style_class = "menu-category-button-greyed";
            else if (actor==selectedActor) actor.style_class = "menu-category-button-selected";
            else actor.style_class = "menu-category-button";
         }
    },
    
    _select_category : function(dir, categoryButton) {
        this.resetSearch();
        this._clearApplicationsBox(categoryButton.actor);
        if (dir)
            this._displayButtons(this._listApplications(dir.get_menu_id()));
        else
            this._displayButtons(this._listApplications(null));
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
            this.applicationsBox.set_width(this._applicationsBoxWidth);
        }
    },
    
    _displayButtons: function(apps, places, recent){
        if (apps) {
            if (apps[0] == "all") {
                for (let i = 0; i < this._applicationsButtons.length; i++) {
                    this._applicationsButtons[i].actor.show();
                }
            } else {
                for (let i = 0; i < this._applicationsButtons.length; i++) {
                    if (apps.indexOf(this._applicationsButtons[i].name) != -1) {
                        this._applicationsButtons[i].actor.show();
                    } else {
                        this._applicationsButtons[i].actor.hide();
                    }
                }
            }
        }
        if (places) {
            if (places == -1) {
                for (let i = 0; i < this._placesButtons.length; i++) {
                    this._placesButtons[i].actor.show();
                }
            } else {
                for (let i = 0; i < this._placesButtons.length; i++) {
                    if (places.indexOf(this._placesButtons[i].button_name) != -1) {
                        this._placesButtons[i].actor.show();
                    } else {
                        this._placesButtons[i].actor.hide();
                    }
                }
            }
        } else {
            for (let i = 0; i < this._placesButtons.length; i++) {
                this._placesButtons[i].actor.hide();
            }
        }
        if (recent) {
            if (recent == -1) {
                for (let i = 0; i < this._recentButtons.length; i++) {
                    this._recentButtons[i].actor.show();
                }
            } else {
                for (let i = 0; i < this._recentButtons.length; i++) {
                    if (recent.indexOf(this._recentButtons[i].button_name) != -1) {
                        this._recentButtons[i].actor.show();
                    } else {
                        this._recentButtons[i].actor.hide();
                    }
                }
            }
        } else {
            for (let i = 0; i < this._recentButtons.length; i++) {
                this._recentButtons[i].actor.hide();
            }
        }
    },
     
    _select_places : function(button) {
        this.resetSearch();
	this._clearApplicationsBox(button.actor);
        this._displayButtons(null, -1);
    },        
     
    _select_recent : function(button) {
        this.resetSearch();
        this._clearApplicationsBox(button.actor);
        this._displayButtons(null, null, -1);
    },
    
    _setCategoriesButtonActive: function(active) {         
        try {
            let categoriesButtons = this.categoriesBox.get_children();
            for (var i in categoriesButtons) {
                let button = categoriesButtons[i];
                let icon = button._delegate.icon;
                if (active){
                    button.remove_style_class_name("menu-category-button-greyed");
                    button.add_style_class_name("menu-category-button");
                } else {
                     button.remove_style_class_name("menu-category-button");
                     button.add_style_class_name("menu-category-button-greyed");
                }
             }
        } catch (e) {
            global.log(e);
        }
     },
     
     resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        this._setCategoriesButtonActive(true);
        global.stage.set_key_focus(this.searchEntry);
     },
     
     _onSearchTextChanged: function (se, prop) {
        this._clearSelections(this.categoriesBox);
        this._clearSelections(this.applicationsBox);
        this.searchActive = this.searchEntry.get_text() != '';
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
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;

            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this._setCategoriesButtonActive(true);
        }
        if (!this.searchActive) {
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
    
    _listBookmarks: function(pattern){
       let bookmarks = Main.placesManager.getBookmarks();
       var res = new Array();
       for (let id = 0; id < bookmarks.length; id++) {
          if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(bookmarks[id]);
       }
       return res;
    },
    
    _listDevices: function(pattern){
       let devices = Main.placesManager.getMounts();
       var res = new Array();
       for (let id = 0; id < devices.length; id++) {
          if (!pattern || devices[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(devices[id]);
       }
       return res;
    },
    
    _listApplications: function(category_menu_id, pattern){

        var applist = new Array();
        if (category_menu_id) {
            applist = this.applicationsByCategory[category_menu_id];
        } else {
            applist.push('all');
        }
        let res;
        if (pattern){
            res = new Array();
            for (var i in this._applicationsButtons) {
                let app = this._applicationsButtons[i].app;
                if (app.get_name().toLowerCase().indexOf(pattern)!=-1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1) ||
                        (app.get_id() && app.get_id().slice(0, -8).toLowerCase().indexOf(pattern)!=-1)) res.push(app.get_name());
            }
        } else res = applist;
        return res;
    },
    
    _doSearch: function(){
        this._searchTimeoutId = 0;
        let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
        if (pattern==this._previousSearchPattern) return false;
        this._previousSearchPattern = pattern;
        this._activeContainer = null;
        this._activeActor = null;
        this._selectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        this._previousSelectedActor = null;
       
       // _listApplications returns all the applications when the search
       // string is zero length. This will happend if you type a space
       // in the search entry.
        if (pattern.length == 0) {
            return false;
        }

        var appResults = this._listApplications(null, pattern);
        var placesResults = new Array();
        var bookmarks = this._listBookmarks(pattern);
        for (var i in bookmarks)
            placesResults.push(bookmarks[i].name);
        var devices = this._listDevices(pattern);
        for (var i in devices)
            placesResults.push(devices[i].name);
        var recentResults = new Array();
        for (let i = 0; i < this._recentButtons.length; i++) {
            if (!(this._recentButtons[i] instanceof RecentClearButton) && this._recentButtons[i].button_name.toLowerCase().indexOf(pattern) != -1)
                recentResults.push(this._recentButtons[i].button_name);
        }

        this._clearApplicationsBox();

        this._displayButtons(appResults, placesResults, recentResults);
       
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

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
