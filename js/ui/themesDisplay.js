// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GMenu = imports.gi.GMenu;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Signals = imports.signals;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

const AppFavorites = imports.ui.appFavorites;
const DND = imports.ui.dnd;
const IconGrid = imports.ui.iconGrid;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const PopupMenu = imports.ui.popupMenu;
const Search = imports.ui.search;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;
const Params = imports.misc.params;

const MAX_APPLICATION_WORK_MILLIS = 75;
const MENU_POPUP_TIMEOUT = 600;
const SCROLL_TIME = 0.1;

const ThemeType = {
    SYSTEM: 1,
    PER_USER: 2
};

function ThemeView() {
    this._init();
}

ThemeView.prototype = {
    _init: function() {
        this._grid = new IconGrid.IconGrid({ xAlign: St.Align.START });
                
        let box = new St.BoxLayout({ vertical: true });
        box.add(this._grid.actor, { y_align: St.Align.START, expand: true });

        this.actor = new St.ScrollView({ x_fill: true,
                                         y_fill: false,
                                         y_align: St.Align.START,
                                         style_class: 'vfade' });
        this.actor.add_actor(box);
        this.actor.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.actor.connect('notify::mapped', Lang.bind(this,
            function() {
                if (!this.actor.mapped)
                    return;

                let adjustment = this.actor.vscroll.adjustment;
                let direction = Overview.SwipeScrollDirection.VERTICAL;
                Main.overview.setScrollAdjustment(adjustment, direction);

                // Reset scroll on mapping
                adjustment.value = 0;
            }));
        
        this._loadThemes();                                                
    },
       
    _loadThemesIn: function(dir, type) {
	    let fileEnum;
	    let file, info;
	    try {
	        fileEnum = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
	    } catch (e) {
	        global.logError('' + e);
	       return;
	    }
	
	    while ((info = fileEnum.next_file(null)) != null) {
	        let fileType = info.get_file_type();
	        if (fileType != Gio.FileType.DIRECTORY)
	            continue;
	        let name = info.get_name();
	        let child = dir.get_child(name);	        
	        this._loadTheme(child, type);
	    }
	    fileEnum.close(null);
	},

	_loadThemes: function() {
	    let systemDataDirs = GLib.get_system_data_dirs();
	    for (let i = 0; i < systemDataDirs.length; i++) {
	        let dirPath = systemDataDirs[i] + '/themes';
	        let dir = Gio.file_new_for_path(dirPath);
	        if (dir.query_exists(null))
	           this._loadThemesIn(dir, ThemeType.SYSTEM);
	    }
	    this._loadThemesIn(Gio.file_new_for_path(GLib.build_filenamev([global.userdatadir, 'themes'])), ThemeType.PER_USER);
	},
	
	_loadTheme: function(dir, type) {
	    let info;
	    let uuid = dir.get_basename();
	
	    let gnomeshellDir = dir.get_child('gnome-shell');
	    let cinnamonDir = dir.get_child('cinnamon');
	    if (gnomeshellDir.query_exists(null) || cinnamonDir.query_exists(null)) {	    	
	    	let theme = new St.Button({ style_class: 'theme-button', reactive: true });                                    
            let box = new St.BoxLayout({ style_class: 'theme-box', vertical: true });
        	let icon = new St.Icon({icon_name: "preferences-desktop-theme", icon_size: 48, icon_type: St.IconType.FULLCOLOR});
        	let iconBin = new St.Bin({ x_fill: true, y_fill: true });
        	iconBin.child = icon;
			box.add(iconBin, { x_fill: false, y_fill: false } );        	        	
            let label = new St.Label({ text: uuid });
            let bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(label);
            box.add(bin);                        
            theme.set_child(box);                  		    	    		      
        	this._grid.addItem(theme);
        	theme.connect('key-focus-in', Lang.bind(this, this._ensureIconVisible));	    		    	
	    }	         
	},

    _ensureIconVisible: function(icon) {
        let adjustment = this.actor.vscroll.adjustment;
        let [value, lower, upper, stepIncrement, pageIncrement, pageSize] = adjustment.get_values();

        let offset = 0;
        let vfade = this.actor.get_effect("vfade");
        if (vfade)
            offset = vfade.fade_offset;

        // If this gets called as part of a right-click, the actor
        // will be needs_allocation, and so "icon.y" would return 0
        let box = icon.get_allocation_box();

        if (box.y1 < value + offset)
            value = Math.max(0, box.y1 - offset);
        else if (box.y2 > value + pageSize - offset)
            value = Math.min(upper, box.y2 + offset - pageSize);
        else
            return;

        Tweener.addTween(adjustment,
                         { value: value,
                           time: SCROLL_TIME,
                           transition: 'easeOutQuad' });
    }
    
};

function ThemesDisplay() {
    this._init();
}

ThemesDisplay.prototype = {
    _init: function() {                
        this.actor = new ThemeView().actor;

       // this._workId = Main.initializeDeferredWork(this.actor, Lang.bind(this, this._redisplay));
    }

    //_redisplay: function() {
    //    this._view.refresh();
    //}
};


