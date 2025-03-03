const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Main = imports.ui.main;
const Util = imports.misc.util;
const {SignalManager} = imports.misc.signalManager;
const {EllipsizeMode} = imports.gi.Pango;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const {
    wordWrap,
    getThumbnail_gicon,
    showTooltip,
    hideTooltipIfVisible,
    scrollToButton
} = require('./utils');
const DescriptionPlacement = Object.freeze({TOOLTIP: 0, UNDER: 1, NONE: 2});

class AppButton {
    constructor(appThis, app) {
        this.appThis = appThis;
        this.app = app;
        this.signals = new SignalManager(null);

        //----------ICON---------------------------------------------
        if (this.app.icon) { //isSearchResult(excl. emoji), isClearRecentsButton, isBackButton
            this.icon = this.app.icon;
        } else if (this.app.icon_filename) { //some of isSearchResult
            const gicon = new Gio.FileIcon({file: Gio.file_new_for_path(this.app.icon_filename)});
            this.icon = new St.Icon({gicon: gicon, icon_size: this.appThis.getAppIconSize()});
        } else if (this.app.gicon) { //isRecentFile, isFavoriteFile,
                                    //isFolderviewFile/Directory, some of isSearchResult
            let gicon = this.app.gicon;
            if (!this.app.isSearchResult) {
                gicon = getThumbnail_gicon(this.app.uri, this.app.mimeType) || gicon;
            }
            this.icon = new St.Icon({gicon: gicon, icon_size: this.appThis.getAppIconSize()});
        } else if (this.app.emoji) {//emoji search result
            this.icon = new St.Label({ style: 'color: white; font-size: ' +
                                            (Math.round(this.appThis.getAppIconSize() * 0.85)) + 'px;'});
            this.icon.get_clutter_text().set_text(this.app.emoji);
        } else if (this.app.isApplication) {//isApplication
            this.icon = this.app.create_icon_texture(this.appThis.getAppIconSize());
        } else if (this.app.iconFactory) {//isPlace
            this.icon = this.app.iconFactory(this.appThis.getAppIconSize());
            if (!this.icon) {
                this.icon = new St.Icon({icon_name: 'folder', icon_size: this.appThis.getAppIconSize()});
            }
        }
        if (!this.icon) {
            this.icon = new St.Icon({icon_name: 'dialog-error', icon_size: this.appThis.getAppIconSize()});
        }

        //--------Label------------------------------------
        this.label = new St.Label({ style_class: 'menu-application-button-label' });
        if (this.app.isClearRecentsButton) {
            this.label.style = 'font-weight: bold;';
        }
        //set label text
        let name = this.app.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let description = this.app.description ?
                            this.app.description.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';
        let markup = '<span>' + name + '</span>';
        if (this.appThis.settings.descriptionPlacement === DescriptionPlacement.UNDER && description) {
            markup += '\n<span size="small">' + description + '</span>';
        }
        const clutterText = this.label.get_clutter_text();
        clutterText.set_markup(markup);
        clutterText.ellipsize = EllipsizeMode.END;

        //-------------actor---------------------
        this.actor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            accessible_role: Atk.Role.MENU_ITEM
        });

        this.setGridButtonWidth();

        if (this.icon && this.appThis.getAppIconSize() > 0) {
            this.actor.add(this.icon, {
                x_fill: false,
                y_fill: false,
                x_align: St.Align.MIDDLE,
                y_align: St.Align.MIDDLE
            });
        }
        this.actor.add(this.label, {
            x_fill: false,
            y_fill: false,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });

        this._setNewAppHighlightClass();

        //----------dnd--------------
        
        if (this.app.isApplication) {
            //make apps drag targets (they only act as drag targets when currentCategory is favorite_apps)
            this.actor._delegate = {
                handleDragOver: (source) => {
                    if (source.isDraggableApp && source.id !== this.app.id &&
                                                    this.appThis.currentCategory === 'favorite_apps') {
                        this._resetAllAppsOpacity();
                        this.actor.set_opacity(40);
                        return DragMotionResult.MOVE_DROP;
                    }
                    return DragMotionResult.NO_DROP; },
                handleDragOut: () => {  this.actor.set_opacity(255); },
                acceptDrop: (source) => {
                    if (source.isDraggableApp && source.id !== this.app.id &&
                                                    this.appThis.currentCategory === 'favorite_apps') {
                        this.actor.set_opacity(255);
                        this.appThis.addFavoriteAppToPos(source.id, this.app.id);
                        return true;
                    } else {
                        this.actor.set_opacity(255);
                        return DragMotionResult.NO_DROP;
                    } }
            };
            
            // make apps draggable.
            Object.assign(this.actor._delegate, {
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                id: this.app.id,
                get_app_id: () => this.app.id, //used when eg. dragging to panel launcher
                isDraggableApp: true
            });

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());
            this.signals.connect(this.draggable, 'drag-end', () => this._resetAllAppsOpacity());
        }

        //make files and folders draggable
        if (this.app.isFolderviewFile || this.app.isDirectory || this.app.isRecentFile ) {
            this.actor._delegate = {
                handleDragOver: (source) => { return DragMotionResult.NO_DROP; },
                handleDragOut: () => {},
                acceptDrop: (source) => { return DragMotionResult.NO_DROP; },
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                id: this.app.id,
                get_app_id: () => this.app.id, //used when eg. dragging to panel launcher
                isDraggableFile: true,
                uri: this.app.uri
            };

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());
        }

        this.signals.connect(this.actor, 'button-release-event', this._handleButtonRelease.bind(this));
        this.signals.connect(this.actor, 'enter-event', this.handleEnter.bind(this));
        this.signals.connect(this.actor, 'leave-event', this.handleLeave.bind(this));
    }

    _setButtonStyleNormal() {
        this.has_focus = false;
        this.actor.set_style_class_name('menu-application-button');
    }

    _setButtonStyleSelected() {
        this.has_focus = true;
        this.actor.set_style_class_name('menu-application-button-selected');
    }

    _setNewAppHighlightClass() {
        if (this.app.newAppShouldHighlight) {
            if (!this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.add_style_pseudo_class('highlighted'); //'font-weight: bold;';
            }
        } else {
            if (this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.remove_style_pseudo_class('highlighted');
            }
        }
    }

    setGridButtonWidth() {
        this.actor.width = this.appThis.display.appsView.getGridValues().columnWidth;
    }

    handleEnter(actor, event) {
        if (this.appThis.display.contextMenu.isOpen ) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (event) {//mouse
            this.appThis.display.clearFocusedActors();
        } else {//keyboard navigation
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }
        this._setButtonStyleSelected();

        //------show tooltip
        if (this.appThis.settings.descriptionPlacement != DescriptionPlacement.TOOLTIP) {
            return Clutter.EVENT_STOP;
        }  
        
        let tooltipMarkup = '<span>' + wordWrap(this.app.name) + '</span>';
        if (this.app.description) {
            tooltipMarkup += '\n<span size="small">' + wordWrap(this.app.description) + '</span>';
        }
        tooltipMarkup = tooltipMarkup.replace(/&/g, '&amp;');
        
        let [x, y] = this.actor.get_transformed_position();
        let {width, height} = this.actor;
        
        x += Math.floor(width / 2);
        y += height + 8 * global.ui_scale;
        
        showTooltip(this.actor, x, y, true /*center tooltip on x*/, tooltipMarkup);
        return Clutter.EVENT_STOP;
    }

    handleLeave(actor, event) {
        if (this.appThis.display.contextMenu.isOpen) {
            return false;
        }
        this._setButtonStyleNormal();
        hideTooltipIfVisible();
    }

    _handleButtonRelease(actor, event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            if (this.appThis.display.contextMenu.isOpen) {
                this.appThis.display.contextMenu.close();
                this.appThis.display.clearFocusedActors();
                this.handleEnter();
            } else {
                this.activate(event);
            }
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_SECONDARY) {
            if (this.appThis.display.contextMenu.isOpen) {
                this.appThis.display.contextMenu.close();
                this.appThis.display.clearFocusedActors();
                this.handleEnter();
                return Clutter.EVENT_STOP;
            } else {
                if (this.app.isApplication || this.app.isFolderviewFile ||
                    this.app.isDirectory || this.app.isFavoriteFile ||
                    this.app.emoji || this.app.isRecentFile){
                    this.openContextMenu(event);
                }
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        if (this.app.isApplication) {
            if (this.app.newAppShouldHighlight) {
                this.app.newAppShouldHighlight = false;
                this._setNewAppHighlightClass();
                this.appThis.display.categoriesView.updateCategoriesShouldHighlight();
            }
            this.appThis.recentApps.add(this.app.id);
            this.app.open_new_window(-1);
            this.appThis.menu.close();
        } else if ((this.app.isDirectory && !this.app.isPlace) || this.app.isBackButton) {
            this.appThis.setActiveCategory(Gio.File.new_for_uri(this.app.uri).get_path());
            //don't menu.close()
        } else if (this.app.isFolderviewFile || this.app.isRecentFile ||
                   this.app.isFavoriteFile || (this.app.isDirectory && this.app.isPlace)) {
            try {
                Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                this.appThis.menu.close();
            } catch (e) {
                Main.notify(_('Error while opening file:'), e.message);
                //don't menu.close()
            }
        } else if (this.app.isClearRecentsButton) {
            this.appThis.recentApps.clear();
            this.appThis.recentManagerDefault.purge_items();
            this.appThis.setActiveCategory('recents');
            //don't menu.close
        } else if (this.app.isSearchResult || this.app.isPlace) {
            this.app.activate(this.app);
            this.appThis.menu.close();
        }
    }

    openContextMenu(e) {
        this._setButtonStyleSelected();
        hideTooltipIfVisible();
        this.appThis.display.contextMenu.openAppContextMenu(this.app, e, this.actor);
    }

    _resetAllAppsOpacity() {
        this.appThis.display.appsView.applicationsGridLayout.get_children().forEach(
                                                                child => child.set_opacity(255));
    }

    destroy() {
        this.signals.disconnectAllSignals();
        hideTooltipIfVisible();

        this.label.destroy();
        if (this.icon) {
            this.icon.destroy();
        }
        this.actor.destroy();
    }
}

class Subheading {
    constructor(appThis, subheadingText) {
        this.appThis = appThis;
        this.subheadingText = subheadingText;
        this.signals = new SignalManager(null);
        this.subheading = new St.Label({
            text: subheadingText,
            x_expand: true,
            reactive: true,
            accessible_role: Atk.Role.HEADING
        });
        this.subheadingBox = new St.BoxLayout({ style_class: 'menu-applications-subheading' });
        this.subheadingBox.add(this.subheading, {});
    }

    destroy(){
        this.signals.disconnectAllSignals();
        this.subheading.destroy();
        this.subheadingBox.destroy();
    }
}

/* Creates and populates the main applications view. Method populate_add() takes an array of app
 * objects and creates AppButton objs with .app as a property. These AppButton objs are then stored
 * in this.buttonStore[] array for later reuse otherwise new AppButton's would need to be created
 * each time a category is clicked on. Only the .actor property of the AppButton is used to populate
 * the actual GridLayout*/
class AppsView {
    constructor(appThis) {
        this.appThis = appThis;
        this.buttonStore = [];
        this.appsViewSignals = new SignalManager(null);

        this.applicationsGridBox = new St.Bin({
            style_class: 'menu-applications-grid-box',
            x_fill: true,
            y_fill: true
        });
        this.applicationsGridLayout = new Clutter.Actor({ layout_manager: new Clutter.GridLayout() });
        this.applicationsGridBox.set_child(this.applicationsGridLayout);
        this.headerText = new St.Label({ style_class: 'menu-applications-header-text' });
        this.applicationsBoxWrapper = new St.BoxLayout({
            style_class: 'menu-applications-inner-box',
            vertical: true
        });

        this.applicationsBoxWrapper.add(this.headerText, { x_fill: false, x_align: St.Align.MIDDLE });
        this.applicationsBoxWrapper.add(this.applicationsGridBox, {});
        this.applicationsBoxWrapper.add(this.applicationsListBox, {});
        // Add additional box with 0 padding as a workaround to bug github.com/linuxmint/cinnamon/issues/11760
        this.bugfixBox = new St.BoxLayout({ style: 'padding: 0px; margin: 0px; spacing: 0px;' });
        this.bugfixBox.add_actor(this.applicationsBoxWrapper);
        this.applicationsScrollBox = new St.ScrollView(
                                            { style_class: 'vfade menu-applications-scrollbox' });
        const vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
        this.appsViewSignals.connect(vscrollApplications, 'scroll-start',
                                                () => { this.appThis.menu.passEvents = true; });
        this.appsViewSignals.connect(vscrollApplications, 'scroll-stop',
                                                () => { this.appThis.menu.passEvents = false; });
        this.applicationsScrollBox.add_actor(this.bugfixBox);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.applicationsScrollBox.set_clip_to_allocation(true);
        this.applicationsScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.applicationsScrollBox.set_mouse_scrolling(true);
    }

    populate(appList, headerText = null) {
        //too many actors in applicationsGridBox causes display errors, don't know why. Plus, it takes a long time
        if (appList.length > 1000) {
            appList.length = 1000; //truncate array
            headerText = _('Too many entries - showing first 1000 entries only');
        }
        this.populate_init(headerText);
        this.populate_add(appList, null);
        this.populate_finish();
    }

    populate_init(headerText = null) {
        this.clearApps();
        this.applicationsScrollBox.vscroll.adjustment.set_value(0);//scroll to top

        if (headerText) {
            this.headerText.set_text(headerText);
            this.headerText.show();
        } else {
            this.headerText.hide();
        }

        this.column = 0;
        this.rownum = 0;

        this.subheadings = [];
    }

    populate_add(appList, subheadingText = null) {
        const gridLayout = this.applicationsGridLayout.layout_manager;

        if (subheadingText) {
            if (this.column !== 0) {
                this.column = 0;
                this.rownum++;
            }

            const subheading = new Subheading(this.appThis, subheadingText);
            gridLayout.attach(
                subheading.subheadingBox,
                this.column,
                this.rownum,
                this.getGridValues().columns,
                1
            );
            this.rownum++;

            subheading.subheadingBox.show();
            this.subheadings.push(subheading);
        }

        appList.forEach(app => {
            let appButton = this.buttonStore.find(button => button.app === app);

            if (!appButton) {
                appButton = new AppButton(this.appThis, app);
                this.buttonStore.push(appButton);
            }
            appButton.setGridButtonWidth();// In case menu has been resized.
            gridLayout.attach(appButton.actor, this.column, this.rownum, 1, 1);
            appButton.actor.layout_column = this.column;//used for key navigation
            this.column++;

            if (this.column > this.getGridValues().columns - 1) {
                this.column = 0;
                this.rownum++;
            }

            appButton._setButtonStyleNormal();
        });
    }

    populate_finish() {
        this.currentGridViewColumnCount = this.getGridValues().columns;
    }

    focusFirstItem() {
        const buttons = this.getActiveButtons();
        if (buttons[0] && !buttons[0].has_focus) {
            this.appThis.display.clearFocusedActors();
            buttons[0].handleEnter();
        }
    }

    resizeGrid() {
        this.applicationsGridBox.hide();//for performance

        const newcolumnCount = this.getGridValues().columns;
        if (this.currentGridViewColumnCount === newcolumnCount) {
            //Number of columns are the same so just adjust button widths only.
            this.applicationsGridLayout.get_children().forEach(actor => {
                if (actor.has_style_class_name('menu-application-button') ||
                        actor.has_style_class_name('menu-application-button-selected')) {
                    actor.width = this.getGridValues().columnWidth;
                }
            });
        } else {//Rearrange buttons to fit new number of columns.
            this.applicationsGridBox.hide();//
            const buttons = this.applicationsGridLayout.get_children();
            this.applicationsGridLayout.remove_all_children();
            let column = 0;
            let rownum = 0;
            const gridLayout = this.applicationsGridLayout.layout_manager;
            const newColumnWidth = this.getGridValues().columnWidth;
            buttons.forEach(actor => {
                if (actor.has_style_class_name('menu-application-button') ||
                    actor.has_style_class_name('menu-application-button-selected')) {
                    actor.width = newColumnWidth;
                    gridLayout.attach(actor, column, rownum, 1, 1);
                    actor.layout_column = column;//used for key navigation
                    column++;
                    if (column > newcolumnCount - 1) {
                        column = 0;
                        rownum++;
                    }
                } else { //subheading label
                    if (column !== 0) {
                        column = 0;
                        rownum++;
                    }
                    gridLayout.attach(actor, column, rownum, newcolumnCount, 1);
                    rownum++;
                }
            });
            this.applicationsGridBox.show();
        }

        this.applicationsGridBox.show();
        this.currentGridViewColumnCount = newcolumnCount;
    }

    getGridValues() {
        const gridBoxUsableWidth = this.appThis.display.currentGridBoxUsableWidth;
        const minColumnWidth = Math.max(140, this.appThis.getAppIconSize() * 1.2);
        const columns = Math.floor(gridBoxUsableWidth / (minColumnWidth * global.ui_scale));
        const columnWidth = Math.floor(gridBoxUsableWidth / columns);
        
        return {columnWidth: columnWidth, columns: columns};
    }

    getActiveButtons() {
        const activeButtons = [];
        this.applicationsGridLayout.get_children().forEach(child => {
            const foundButton = this.buttonStore.find(button => button.actor === child);
            if (foundButton) {
                activeButtons.push(foundButton);
            }
        });
        return activeButtons;
    }

    clearApps() {
        this.clearAppsViewFocusedActors();

        //destroy subheading labels
        if(this.subheadings){
            this.subheadings.forEach(subheading => subheading.destroy());
        }
        this.subheadings = [];

        this.applicationsGridLayout.remove_all_children();
    }

    clearAppsViewFocusedActors() {
        this.getActiveButtons().forEach(button => { if (button.has_focus) button.handleLeave(); });
    }

    buttonStoreCleanup() {
        //delete all buttons which won't be reused
        const buttonStore = this.buttonStore.filter(button => {
            if (button.app.deleteAfterUse) {
                button.destroy();
                return false;
            } else {
                return true;
            } });
        this.buttonStore = buttonStore;
    }

    destroy() {
        this.appsViewSignals.disconnectAllSignals();
        this.headerText.destroy();
        this.applicationsGridBox.destroy();
        this.applicationsGridLayout.destroy();
        this.applicationsBoxWrapper.destroy();
        this.applicationsScrollBox.destroy();
        this.buttonStore.forEach(button => { if (button) button.destroy(); });
        this.buttonStore = [];
    }
}

module.exports = {AppsView};
