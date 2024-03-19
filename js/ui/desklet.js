//-*- indent-tabs-mode: nil-*-
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;
const Util = imports.misc.util;
const Flashspot = imports.ui.flashspot;

const DeskletManager = imports.ui.deskletManager;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Gettext = imports.gettext;


const RIGHT_PANEL_POPUP_ANIMATE_TIME = 0.5;
const DESKLET_DESTROY_TIME = 500;

/**
 * #Desklet
 * @short_description: Base desklet class to be inherited
 * @metadata (dictionary): Metadata of desklet
 * @actor (St.BoxLayout): Actor of desklet
 * @content (St.Bin): The actor containing the content of the actor
 * @instance_id (int): Instance id of the desklet
 *
 * #Desklet is a base class in which other desklets can inherit
 */
var Desklet = class Desklet {
    /**
     * _init:
     * @metadata (dictionary): the metadata of the desklet
     * @desklet_id (int): instance id of the desklet
     *
     * Constructor function
     */
    constructor() {
        return this._init.apply(this, arguments);
    }

    _init(metadata, desklet_id) {
        this.metadata = metadata;
        this.instance_id = desklet_id;
        this.actor = new St.BoxLayout({reactive: true, track_hover: true, vertical: true});

        this._header = new St.Bin({style_class: 'desklet-header'});
        this._header_label = new St.Label();
        this._header_label.set_text('Desklet');
        this._header.set_child(this._header_label);

        this.content = new St.Bin();

        this.actor.add_actor(this._header);
        this.actor.add_actor(this.content);

        this._updateDecoration();
        global.settings.connect('changed::desklet-decorations', Lang.bind(this, this._updateDecoration));

        this._menu = new PopupMenu.PopupMenu(this.actor, St.Side.LEFT);
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuManager.addMenu(this._menu);
        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();

        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));

        this._uuid = null;
        this._dragging = false;
        this._dragOffset = [0, 0];
        this.actor._desklet = this;
        this.actor._delegate = this;

        this._drag_end_ids = {"drag-end": 0, "drag-cancelled": 0};
        this._draggable = DND.makeDraggable(this.actor, {restoreOnSuccess: true}, Main.deskletContainer.actor);
    }

    /**
     * setHeader:
     * @header (string): the header of the desklet
     *
     * Sets the header text of the desklet to @header
     */
    setHeader(header){
        this._header_label.set_text(header);
    }

    /**
     * setContent:
     * @actor (Clutter.Actor): actor to be set as child
     * @params (dictionary): (optional) parameters to be sent. This argument
     * is ignored. Only kept for compatibility reasons
     *
     * Sets the content actor of the desklet as @actor
     */
    setContent(actor, params){
        this.content.set_child(actor);
    }

    /**
     * on_desklet_removed:
     *
     * Callback when desklet is removed. To be overridden by individual desklets
     */
    on_desklet_removed(deleteConfig) {
    }

    /**
     * on_desklet_reloaded:
     *
     * Callback when desklet is reloaded. To be overridden by individual desklets
     */
    on_desklet_reloaded() {
    }

    /**
     * destroy:
     *
     * Destroys the actor with an fading animation
     */
    destroy(deleteConfig) {
        this.actor.ease({
            opacity: 0,
            duration: DESKLET_DESTROY_TIME,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: () => {
                this.on_desklet_removed(deleteConfig);
                this.actor.destroy();
            }
        });

        this._menu.destroy();

        this._menu = null;
        this._menuManager = null;
        this.emit('destroy');
    }

    _updateDecoration(){
        let dec = global.settings.get_int('desklet-decorations');
        let preventDecorations = this.metadata['prevent-decorations'];
        if (preventDecorations == true){
            dec = 0;
        }

        switch(dec){
        case 0:
            this._header.hide();
            this.content.style_class = 'desklet';
            break;
        case 1:
            this._header.hide();
            this.content.style_class = 'desklet-with-borders';
            break;
        case 2:
            this._header.show();
            this.content.style_class = 'desklet-with-borders-and-header';
            break;
        }
    }

    on_desklet_clicked(event) {
        // Implemented by Desklets
    }

    on_desklet_added_to_desktop_internal(userEnabled) {
        if (userEnabled) {
            Mainloop.timeout_add(300, Lang.bind(this, function() {
                let [x, y] = this.actor.get_transformed_position();
                let [w, h] = this.actor.get_transformed_size();
                let flashspot = new Flashspot.Flashspot({ x : x, y : y, width: w, height: h});
                flashspot.fire();
                return false;
            }));
        }

        this.on_desklet_added_to_desktop(userEnabled);
    }

    /**
     * on_desklet_added_to_desktop:
     *
     * This function is called by deskletManager when the desklet is added to the desktop.
     *
     * This is meant to be overridden in individual applets.
     */
    on_desklet_added_to_desktop(userEnabled) {
    }

    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() == 3) {
            this._menu.toggle();
        } else {
            if (this._menu.isOpen) {
                this._menu.toggle();
            }
            this.on_desklet_clicked(event);
        }
    }

    _trackMouse() {
        if(!Main.layoutManager.isTrackingChrome(this.actor)) {
            Main.layoutManager.addChrome(this.actor, {doNotAdd: true});
            this._isTracked = true;
        }
    }

    _untrackMouse() {
        if(Main.layoutManager.isTrackingChrome(this.actor)) {
            Main.layoutManager.untrackChrome(this.actor);
            this._isTracked = false;
        }
    }

    _onRemoveDesklet(){
        DeskletManager.removeDesklet(this._uuid, this.instance_id);
    }

    finalizeContextMenu() {
        this.context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
        if (this._menu._getMenuItems().length > 0) {
            this._menu.addMenuItem(this.context_menu_separator);
        }

        this.context_menu_item_about = new PopupMenu.PopupMenuItem(_("About..."))
        this.context_menu_item_about.connect("activate", Lang.bind(this, this.openAbout));
        this._menu.addMenuItem(this.context_menu_item_about);

        if (!this._meta["hide-configuration"] && GLib.file_test(this._meta["path"] + "/settings-schema.json", GLib.FileTest.EXISTS)) {
            this.context_menu_item_configure = new PopupMenu.PopupMenuItem(_("Configure..."));
            this.context_menu_item_configure.connect("activate", Lang.bind(this, this.configureDesklet));
            this._menu.addMenuItem(this.context_menu_item_configure);
        }

        this.context_menu_item_remove = new PopupMenu.PopupMenuItem(_("Remove this desklet"));
        this.context_menu_item_remove.connect("activate", Lang.bind(this, function(actor, event) {
            if (Clutter.ModifierType.CONTROL_MASK & Cinnamon.get_event_state(event)) {
                this._onRemoveDesklet();
            } else {
                let dialog = new ModalDialog.ConfirmDialog(
                    _("Are you sure you want to remove '%s'?").format(this._(this._meta.name)),
                    () => this._onRemoveDesklet()
                );
                dialog.open();
            }
        }));
        this._menu.addMenuItem(this.context_menu_item_remove);
    }

    // translation
    _(str) {
        // look into the text domain first
        let translated = Gettext.dgettext(this._uuid, str);

        // if it looks translated, return the translation of the domain
        if (translated !== str)
            return translated;
        // else, use the default cinnamon domain
        return _(str);
    }

    /**
     * highlight:
     * @highlight (boolean): whether to turn on or off
     *
     * Turns on/off the highlight of the desklet
     */
    highlight(highlight) {
        this.content.change_style_pseudo_class("highlight", highlight);
    }

    openAbout() {
        Util.spawnCommandLine("xlet-about-dialog desklets " + this._uuid);
    }

    configureDesklet(tab=0) {
        Util.spawnCommandLine("xlet-settings desklet " + this._uuid + " -i " + this.instance_id + " -t " + tab);
    }
}
Signals.addSignalMethods(Desklet.prototype);
