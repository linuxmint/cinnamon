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

const ICON_SIZE = 16;
const MAX_FAV_ICON_SIZE = 32;
const CATEGORY_ICON_SIZE = 22;
const APPLICATION_ICON_SIZE = 22;

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

let appsys = Cinnamon.AppSystem.get_default();

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
            for (var i in children){
                children[i].destroy();
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
        this.label = new St.Label({ text: this.app.get_name(), style_class: 'menu-application-button-label' });
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
        this.actor = new St.Button({ reactive: true, label: this.button_name, style_class: 'menu-application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: this.button_name, style_class: 'menu-application-button-label' });
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

function CategoryButton(app) {
    this._init(app);
}

CategoryButton.prototype = {
    _init: function(category) {
        var label;
if (category){
           let icon = category.get_icon();
           if (icon && icon.get_names)
               this.icon_name = icon.get_names().toString();
           else
               this.icon_name = "";
           label = category.get_name();
        }else label = _("All Applications");
        this.actor = new St.Button({ reactive: true, label: label, style_class: 'menu-category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: label, style_class: 'menu-category-button-label' });
        if (category && this.icon_name){
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
        this.actor = new St.Button({ reactive: true, label: _("Places"), style_class: 'menu-category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: _("Places"), style_class: 'menu-category-button-label' });
        this.icon = new St.Icon({icon_name: "folder", icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add_actor(this.label);
        this.actor.set_child(this.buttonbox);
    }
};
Signals.addSignalMethods(PlaceCategoryButton.prototype);

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
            this._selectedItemIndex = null;
            this._previousSelectedItemIndex = null;
            this._activeContainer = null;
            this._applicationsBoxWidth = 0;

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
            
            this.edit_menu_item = new Applet.MenuItem(_("Edit menu"), Gtk.STOCK_EDIT, Lang.bind(this, this._launch_editor));
            this._applet_context_menu.addMenuItem(this.edit_menu_item);
                                                                           
        }
        catch (e) {
            global.logError(e);
        }
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
		}
        else {
            this.actor.remove_style_pseudo_class('active');            
            if (this.searchActive) {
				this.resetSearch();
				this._select_category(null, this._allAppsCategoryButton);
			}
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
        
        if (symbol==Clutter.KEY_Super_L && this.menu.isOpen) {
            this.menu.close();
            return true;
        }

        if (this._activeContainer === null && symbol == Clutter.KEY_Up) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = children.length;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Down) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = -1;
        }else if (this._activeContainer === null) {
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
        }
        
        
        let children = this._activeContainer.get_children();
        
        if (children.length==0){
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
            children = this._activeContainer.get_children();
        }

        let index = this._selectedItemIndex;

        if (symbol == Clutter.KEY_Up) {
            if (this._activeContainer==this.applicationsBox) index = this._selectedItemIndex - 1 < 0 ? 0 : this._selectedItemIndex - 2;
            else index = this._selectedItemIndex - 1 < 0 ? 0 : this._selectedItemIndex - 1;
        } else if (symbol == Clutter.KEY_Down) {
            if (this._activeContainer==this.applicationsBox && this._selectedItemIndex!=-1) index = this._selectedItemIndex + 2 >= children.length ? children.length - 2 : this._selectedItemIndex + 2;
            else index = this._selectedItemIndex + 1 == children.length ? children.length - 1 : this._selectedItemIndex + 1;
        } else if (symbol == Clutter.KEY_Right && this._activeContainer === this.categoriesBox) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            index = 0;
            this._previousSelectedItemIndex = this._selectedItemIndex;
            this._selectedItemIndex = -1;
        } else if (symbol == Clutter.KEY_Left && this._activeContainer === this.applicationsBox && !this.searchActive) {
            this._clearSelections(this.applicationsBox);
            this._activeContainer = this.categoriesBox;
            children = this._activeContainer.get_children();
            index = this._previousSelectedItemIndex;
            this._selectedItemIndex = -1;
        } else if (this._activeContainer === this.applicationsBox && (symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
            let item_actor = children[this._selectedItemIndex];
            item_actor._delegate.activate();
            return true;
        } else {
            return false;
        }

        if (index == this._selectedItemIndex) {
            return true;
        }
        
        if (this._activeContainer==this.applicationsBox){
            if (index>=children.length-1) index = children.length-2;
        }else{
            if (index>=children.length) index = children.length-1;
        }

        this._selectedItemIndex = index;
        let item_actor = children[this._selectedItemIndex];

        if (!item_actor || item_actor === this.searchEntry) {
            return false;
        }

        item_actor._delegate.emit('enter-event');
        return true;
    },

    _addEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let parent = button.actor.get_parent();
            if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
                this._previousSelectedItemIndex = this._selectedItemIndex;
            }
            this._activeContainer = parent;
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
            actor.style_class = "menu-category-button";
        });
    },

    _onOpenStateToggled: function(menu, open) {
       if (open) {
           global.stage.set_key_focus(this.searchEntry);
           this._selectedItemIndex = null;
           this._activeContainer = null;
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
        this._applicationsButtons = new Array();
        this._applicationsBoxWidth = 0;
        
        //Remove all categories
    	this.categoriesBox.get_children().forEach(Lang.bind(this, function (child) {
            child.destroy();
        })); 
        
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
        
        this._select_category(null, this._allAppsCategoryButton);    
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
        var nextType;
        if (!top_dir) top_dir = dir;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
					var app = appsys.lookup_app_by_tree_entry(entry);
                    if (!app) app = appsys.lookup_settings_app_by_tree_entry(entry);
                 	if (!this.applicationsByCategory[top_dir.get_menu_id()]) this.applicationsByCategory[top_dir.get_menu_id()] = new Array();
					this.applicationsByCategory[top_dir.get_menu_id()].push(app);
				}
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                this._loadCategory(iter.get_directory(), top_dir);
            }
        }
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
         
        this.selectedAppBox = new St.BoxLayout({ style_class: 'menu-selected-app-box', vertical: true });
        this.selectedAppTitle = new St.Label({ style_class: 'menu-selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'menu-selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        section.actor.add_actor(this.selectedAppBox);
    },
    
    _clearApplicationsBox: function(selectedActor){
       let actors = this.applicationsBox.get_children();
		for (var i=0; i<actors.length; i++) {
			let actor = actors[i];
			this.applicationsBox.remove_actor(actor);
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
	       if (dir) this._displayButtons(this._listApplications(dir.get_menu_id()));
	       else this._displayButtons(this._listApplications(null));
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
    
    _displayButtons: function(apps, places){
         if (apps){
            for (var i=0; i<apps.length; i++) {
               let app = apps[i];
               if (!this._applicationsButtons[app]){
                  let applicationButton = new ApplicationButton(this, app);
                  applicationButton.actor.connect('realize', Lang.bind(this, this._onApplicationButtonRealized));
                  applicationButton.actor.connect('leave-event', Lang.bind(this, function() {
                     this.selectedAppTitle.set_text("");
                     this.selectedAppDescription.set_text("");
                  }));
                  this._addEnterEvent(applicationButton, Lang.bind(this, function() {
                      this.selectedAppTitle.set_text(applicationButton.app.get_name());
                      if (applicationButton.app.get_description()) this.selectedAppDescription.set_text(applicationButton.app.get_description());
                      else this.selectedAppDescription.set_text("");
                      this._clearSelections(this.applicationsBox);
                      applicationButton.actor.style_class = "menu-category-button-selected";
                      this._scrollToButton(applicationButton);
                  }));
                  this._applicationsButtons[app] = applicationButton;
               }
               this.applicationsBox.add_actor(this._applicationsButtons[app].actor);
               this.applicationsBox.add_actor(this._applicationsButtons[app].menu.actor);
            }
         }

         if (places){
            for (var i=0; i<places.length; i++) {
               let place = places[i];
               let button = new PlaceButton(this, place, place.name);
               this._addEnterEvent(button, Lang.bind(this, function() {
                   this._clearSelections(this.applicationsBox);
                   button.actor.style_class = "menu-category-button-selected";
                   this._scrollToButton(button);
               }));
               this.applicationsBox.add_actor(button.actor);
            }
         }
    },
     
     _select_places : function(button) {
         this.resetSearch();
		 this._clearApplicationsBox(button.actor);
               
         let bookmarks = this._listBookmarks();
         let devices = this._listDevices();
         this._displayButtons(null, bookmarks.concat(devices));
    },        
     
     _setCategoriesButtonActive: function(active) {         
         try{
             let categoriesButtons = this.categoriesBox.get_children();
             for (var i in categoriesButtons){
                 let button = categoriesButtons[i];
                 let icon = button._delegate.icon;
                 if (active){
                     button.remove_style_class_name("menu-category-button-greyed");
                     button.add_style_class_name("menu-category-button");
                 }else{
                     button.remove_style_class_name("menu-category-button");
                     button.add_style_class_name("menu-category-button-greyed");
                 }
             }
        }catch(e){
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
       var applist;
       if (category_menu_id) applist = this.applicationsByCategory[category_menu_id];
       else{
          applist = new Array();
          for (directory in this.applicationsByCategory) applist = applist.concat(this.applicationsByCategory[directory]);
       }
       
       var res;
       if (pattern){
          res = new Array();
          for (var i in applist){
             let app = applist[i];
             if (app.get_name().toLowerCase().indexOf(pattern)!=-1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1) || (app.get_id() && app.get_id().slice(0, -8).toLowerCase().indexOf(pattern)!=-1)) res.push(app);
          }
       }else res = applist;
       
       res.sort(function(a,b){
          return a.get_name().toLowerCase() > b.get_name().toLowerCase();
       });
       
       return res;
    },
    
    _doSearch: function(){
       this._searchTimeoutId = 0;
       let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
       if (pattern==this._previousSearchPattern) return false;
       this._previousSearchPattern = pattern;
       
       this._activeContainer = null;
       this._selectedItemIndex = null;
       this._previousSelectedItemIndex = null;
       
       // _listApplications returns all the applications when the search
       // string is zero length. This will happend if you type a space
       // in the search entry.
       if (pattern.length == 0) {
           return false;
       }

       var appResults = this._listApplications(null, pattern);
       
       var placesResults = new Array();
       
       var bookmarks = this._listBookmarks(pattern);
       for (var i in bookmarks) placesResults.push(bookmarks[i]);
       
       var devices = this._listDevices(pattern);
       for (var i in devices) placesResults.push(devices[i]);
       
       this._clearApplicationsBox();
       this._displayButtons(appResults, placesResults);
       
       let applicationsBoxChilren = this.applicationsBox.get_children();
       if (applicationsBoxChilren.length>0){
           this._activeContainer = this.applicationsBox;
           this._selectedItemIndex = 0;
           let item_actor = applicationsBoxChilren[this._selectedItemIndex];
           if (item_actor && item_actor !== this.searchEntry) {
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
