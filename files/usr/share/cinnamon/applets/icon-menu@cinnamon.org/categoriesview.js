const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const XApp = imports.gi.XApp;
const St = imports.gi.St;
const {SignalManager} = imports.misc.signalManager;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const {scrollToButton} = require('./utils');

let buttonTimeoutId = null;
function clearButtonTimeout() {
    if (buttonTimeoutId) {
        clearTimeout(buttonTimeoutId);
        buttonTimeoutId = null;
    }
}

class CategoryButton {
    constructor(appThis, category_id, category_name, icon_name, gicon) {
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.disabled = false;
        //Note: When option "Activate categories on click" is on, then the this.has_focus === true category
        //is the one that has keyboard or mouse focus and is not necessarily the same as the currently
        //selected category (this.appThis.currentCategory)
        this.has_focus = false;
        this.id = category_id;
        this.actor = new St.BoxLayout({
            style_class: 'menu-category-button',
            reactive: true,
            accessible_role: Atk.Role.MENU_ITEM
        });

        //----icon
        if (icon_name) {
            this.icon = new St.Icon({
                icon_name: icon_name,
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.appThis.settings.categoryIconSize
            });
        } else {
            this.icon = new St.Icon({
                gicon: gicon,
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.appThis.settings.categoryIconSize
            });
        }
        if (this.appThis.settings.categoryIconSize > 0) {
            this.actor.add(this.icon, {x_fill: false, y_fill: false, y_align: St.Align.MIDDLE});
        }

        //---label
        this.category_name = category_name ? category_name : '';//is this needed?
        this.label = new St.Label({
            text: this.category_name,
            style_class: 'menu-category-button-label'
        });
        this.actor.add(this.label, {x_fill: false, y_fill: false, y_align: St.Align.MIDDLE});

        //---dnd
        this.actor._delegate = {
            handleDragOver: (source) => {
                if (!source.isDraggableCategory || source.id === this.id || this.appThis.searchActive) {
                    return DragMotionResult.NO_DROP;
                }
                this.appThis.display.categoriesView.resetAllCategoriesOpacity();
                this.actor.set_opacity(50);
                return DragMotionResult.MOVE_DROP;
            },
            acceptDrop: (source) => {
                if (!source.isDraggableCategory || source.id === this.id || this.appThis.searchActive) {
                    this.appThis.display.categoriesView.resetAllCategoriesOpacity();
                    return DragMotionResult.NO_DROP;
                }
                //move category to new position
                const categories = this.appThis.settings.categories.slice();
                const oldIndex = categories.indexOf(source.id);
                const newIndex = categories.indexOf(this.id);
                categories.splice(oldIndex, 1);
                categories.splice(newIndex, 0, source.id);
                this.appThis.settings.categories = categories;
                this.appThis.display.categoriesView.resetAllCategoriesOpacity();
                this.appThis.display.categoriesView.update();
                this.appThis.setActiveCategory(this.appThis.currentCategory);
                return true;
            },
            getDragActorSource: () => this.actor,
            _getDragActor: () => new Clutter.Clone({source: this.actor}),
            getDragActor: () => new Clutter.Clone({source: this.icon}),
            isDraggableCategory: true,
            id: this.id
        };
        this.draggable = makeDraggable(this.actor);

        // Connect signals
        this.signals.connect(this.draggable, 'drag-begin', () => this.actor.set_opacity(51));
        this.signals.connect(this.draggable, 'drag-cancelled', () => this.actor.set_opacity(255));
        this.signals.connect(this.draggable, 'drag-end', () =>
                                this.appThis.display.categoriesView.resetAllCategoriesOpacity());

        this.signals.connect(this.actor, 'enter-event', this.handleEnter.bind(this));
        this.signals.connect(this.actor, 'leave-event', this.handleMouseLeave.bind(this));
        this.signals.connect(this.actor, 'button-release-event', this._handleButtonRelease.bind(this));
    }

    setHighlight(on) {
        if (on) {
            if (!this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.add_style_pseudo_class('highlighted'); //'font-weight: bold;';
            }
        } else {
            if (this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.remove_style_pseudo_class('highlighted');
            }
        }
    }

    setButtonStyleNormal() {
        this.actor.set_style_class_name('menu-category-button');
        this.icon.set_opacity(255);//undo changes made in _setButtonStyleGreyed()
    }

    setButtonStyleSelected() {
        this.actor.set_style_class_name('menu-category-button-selected');
    }

    _setButtonStyleGreyed() {
        this.actor.set_style_class_name('menu-category-button-greyed');
        if (this.icon) {
            let icon_opacity = this.icon.get_theme_node().get_double('opacity');
            icon_opacity = Math.min(Math.max(0, icon_opacity), 1);
            if (icon_opacity) { // Don't set opacity to 0 if not defined
                this.icon.set_opacity(icon_opacity * 255);
            }
        }
    }

    selectCategory() {
        this.appThis.setActiveCategory(this.id);
    }

    handleEnter(actor, event) {
        //this method handles mouse and key events
        if (this.has_focus || this.disabled || this.appThis.display.contextMenu.isOpen) {
            return Clutter.EVENT_PROPAGATE;
        }
        //When "activate categories on click" is off, don't enter this button if mouse is moving
        //quickly towards appviews, i.e. badAngle === true.
        if (event && !this.appThis.settings.categoryClick && this.appThis.display.badAngle) {
            clearButtonTimeout();
            //badAngle now but check again in a short while
            buttonTimeoutId = setTimeout(
                () => {
                    this.appThis.display.updateMouseTracking();
                    this.handleEnter(actor, event);
                },
                this.appThis.display.TRACKING_TIME
            );
            return Clutter.EVENT_PROPAGATE;
        }

        this.appThis.display.categoriesView.allButtonsRemoveFocusAndHover();
        this.has_focus = true;

        if (event) {//mouse
            this.appThis.display.clearFocusedActors();
        } else {//keypress
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }

        // No need to continue if current category is already selected
        if (this.id === this.appThis.currentCategory) {
            return Clutter.EVENT_PROPAGATE;
        }
        clearButtonTimeout();
        if (this.appThis.settings.categoryClick) {
            this.actor.add_style_pseudo_class('hover');
        } else {
            this.selectCategory();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    handleMouseLeave(actor, event) {
        if (this.disabled || this.appThis.display.contextMenu.isOpen) {
            return false;
        }

        this.removeFocusAndHover();

        // return focus to currently active category
        this.appThis.display.categoriesView.setCategoryFocus(this.appThis.currentCategory);
    }

    removeFocusAndHover() {
        this.has_focus = false;

        if (this.actor.has_style_pseudo_class('hover')) {
            this.actor.remove_style_pseudo_class('hover');
        }

        clearButtonTimeout();
    }

    _handleButtonRelease(actor, event) {
        if (this.appThis.display.contextMenu.isOpen) {
            this.appThis.display.contextMenu.close();
            return Clutter.EVENT_STOP;
        }
        if (this.disabled) {
            return Clutter.EVENT_STOP;
        }

        const button = event.get_button();
        if (button === Clutter.BUTTON_PRIMARY && this.appThis.settings.categoryClick) {
            this.selectCategory();
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_SECONDARY) {
            if (this.actor.has_style_class_name('menu-category-button-hover')) {
                //Remove focus from this category button before opening it's context menu.
                //Todo: Ideally this button should retain focus style to indicate the button the
                //context menu was opened on.
                this.removeFocusAndHover();
            }
            this.openContextMenu(event);
            return Clutter.EVENT_STOP;
        }
    }

    openContextMenu(e) {
        this.appThis.display.contextMenu.openCategoryContextMenu(this.id, e, this.actor);
    }

    disable() {
        this._setButtonStyleGreyed();
        this.disabled = true;
        this.has_focus = false;
    }

    enable() {
        this.setButtonStyleNormal();
        this.disabled = false;
    }

    destroy() {
        this.signals.disconnectAllSignals();
        this.label.destroy();
        if (this.icon) {
            this.icon.destroy();
        }
        this.actor.destroy();
    }
}

/* Creates the categories box and array of CategoryButtons (this.buttons[]). Updates the categories and
 * populates the categoriesBox. */
class CategoriesView {
    constructor(appThis) {
        this.appThis = appThis;
        this.buttons = [];

        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box', vertical: true });
        this.groupCategoriesWorkspacesWrapper =
                                new St.BoxLayout({/*style: 'max-width: 185px;',*/ vertical: true });
        this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, { });

        this.groupCategoriesWorkspacesScrollBox =
                                new St.ScrollView({ style_class: 'vfade menu-categories-scrollbox' });
        this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);
        this.groupCategoriesWorkspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.groupCategoriesWorkspacesScrollBox.set_clip_to_allocation(true);
        this.groupCategoriesWorkspacesScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);
        if (!this.appThis.settings.showCategories) {
            this.groupCategoriesWorkspacesScrollBox.width = 0;
        }
    }

    update() {
        if (!this.appThis.settings.showCategories)
            return; // Not necessary but saves time since categories are hidden anyway.

        //Put all enabled categories into newButtons[] in default order by reusing the
        //buttons in this.buttons[] or by creating new CategoryButton.
        const newButtons = [];

        //Add 'All applications'
        let button = this.buttons.find(button => button.id === 'all');
        if (!button) {
            button = new CategoryButton(this.appThis, 'all', _('All applications'), 'cinnamon-all-applications', null);
        }
        newButtons.push(button);

        //Add other app categories
        this.appThis.apps.getDirs().forEach(dir => { 
            let button = this.buttons.find(button => button.id === dir.dirId);
            if (!button) {
                button = new CategoryButton(this.appThis, dir.dirId, dir.get_name(), null, dir.get_icon());
            }
            //highlight category if it contains a new app
            button.setHighlight(this.appThis.apps.dirHasNewApp(dir.dirId));
            newButtons.push(button);
        });
        
        //Add special categories
        const enableFavFiles = XApp.Favorites.get_default().get_favorites(null).length > 0;
        [
            [enableFavFiles, 'favorite_files', _('Favorites'), 'xapp-user-favorites'],
            [this.appThis.settings.showPlaces, 'places', _('Places'), 'folder'],
            [this.appThis.recentsEnabled, 'recents', _('Recent'), 'document-open-recent'],
            [this.appThis.settings.showFavAppsCategory, 'favorite_apps', _('Favorite apps'), 'emblem-favorite']
        ].forEach(param => {
            if (param[0]) {
                let button = this.buttons.find(button => button.id === param[1]);
                if (!button) {
                    button = new CategoryButton(this.appThis, param[1], param[2], param[3], null);
                }
                newButtons.push(button);
            }
        });

        //Add folder categories
        const folderCategories = this.appThis.settings.folderCategories.slice();
        let folderCategoriesChanged = false;
        folderCategories.forEach((folder, index) => {
            let button = this.buttons.find(button => button.id === folder);
            if (button) {
                newButtons.push(button);
            } else {
                const file = Gio.file_new_for_path(folder);
                try {//In case folder no longer exists.
                    const fileInfo = file.query_info('standard::icon', Gio.FileQueryInfoFlags.NONE, null);
                    const gicon = fileInfo.get_icon();
                    let displayName = file.get_basename();
                    if (displayName.length > 19) {
                        displayName = displayName.slice(0,17) + '...';
                    }
                    button = new CategoryButton(this.appThis, folder, displayName, null, gicon);
                    newButtons.push(button);
                } catch(e) {
                    global.log("gridmenu: Error creating folder category: " + folder + " ...skipping.");
                    //remove this error causing element from the array.
                    folderCategories.splice(index, 1);
                    folderCategoriesChanged = true;
                }
            }
        });
        if (folderCategoriesChanged) this.appThis.settings.folderCategories = folderCategories;

        //set user category order to default if none already
        if (this.appThis.settings.categories.length === 0) {
            this.appThis.settings.categories = newButtons.map(button => button.id);
        }

        // Normally, newButtons array contains the correct buttons in the right order. However, if the
        // category order is customised, we need to add any new buttons to the end of the customised list
        // and remove any deleted categories from the customised list.
        if (this._inSameOrder(this.appThis.settings.categories, newButtons.map(button => button.id))) {
            this.buttons = newButtons;
            this.appThis.settings.categories = newButtons.map(button => button.id);
        } else {
            //add new categories to end of user category order if not already included
            newButtons.forEach(newButton => {
                if (this.appThis.settings.categories.indexOf(newButton.id) === -1) {
                    this.appThis.settings.categories.push(newButton.id);
                }
            });

            //set this.buttons[] to newButtons[] in user prefered order
            this.buttons = [];
            this.appThis.settings.categories.forEach(buttonId => {
                const foundButton = newButtons.find(newButton => newButton.id === buttonId);
                if (foundButton && !this.buttons.find(button => button.id === buttonId)) {
                    this.buttons.push(foundButton);
                }
            });

            //replace user button order to remove unused ids.
            if (this.appThis.settings.categories.length > this.buttons.length) {
                this.appThis.settings.categories = this.buttons.map(button => button.id);
            }
        }

        //populate categoriesBox with buttons
        this.categoriesBox.remove_all_children();
        this.buttons.forEach(button => this.categoriesBox.add_actor(button.actor));
    }

    updateCategoriesShouldHighlight() {
        this.appThis.apps.getDirs().forEach(dir => {
            let button = this.buttons.find(button => button.id === dir.dirId);
            button.setHighlight(this.appThis.apps.dirHasNewApp(dir.dirId));
        });
    }

    _inSameOrder(a, b) {
        //Determine if two arrays of strings are in the same order ignoring any strings that are not in both.
        const setA = new Set(a);
        const setB = new Set(b);
        const cleanedA = a.filter(str => setB.has(str));
        const cleanedB = b.filter(str => setA.has(str));
        return cleanedA.join() === cleanedB.join();
    }

    setSelectedCategoryStyle(categoryId) {
        this.buttons.forEach(categoryButton => {
            if (categoryButton.id === categoryId) {
                categoryButton.setButtonStyleSelected();
            } else {
                categoryButton.setButtonStyleNormal();
            }
        });
    }

    setCategoryFocus(categoryId) {
        this.buttons.forEach(categoryButton => {
            if (categoryButton.id === categoryId) {
                categoryButton.has_focus = true;
            } else {
                categoryButton.has_focus = false;
            }
        });
    }

    allButtonsRemoveFocusAndHover() {
        this.buttons.forEach(button => button.removeFocusAndHover());
    }

    resetAllCategoriesOpacity() {
        this.buttons.forEach(button => button.actor.set_opacity(255));
    }

    destroy() {
        this.buttons.forEach(button => button.destroy());
        this.buttons = [];
        this.categoriesBox.destroy();
        this.groupCategoriesWorkspacesWrapper.destroy();
        this.groupCategoriesWorkspacesScrollBox.destroy();
    }
}

module.exports = {CategoriesView};
