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

const SETTINGS_SCHEMA = 'org.cinnamon.theme';
const SETTINGS_KEY = 'name';

const ThemeType = {
    SYSTEM: 1,
    PER_USER: 2
};

function ThemeView() {
    this._init();
}

ThemeView.prototype = {
    _init: function() {
    	
    	this._settings = new Gio.Settings({ schema: SETTINGS_SCHEMA });
    	this._changedId = this._settings.connect('changed::'+SETTINGS_KEY, Lang.bind(this, this._refresh));
    	
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
         
         this._refresh();                                                      
    },
    
    _refresh: function() {
    	this._grid.removeAll();
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
	        try {        
				this._loadTheme(child, type);
			}
			catch (e) {
				global.log('Could not load theme ' + name);
				global.log('' + e);
			}
	    }
	    fileEnum.close(null);
	},

	_loadThemes: function() {
		this._loadDefaultTheme();					
	    let systemDataDirs = GLib.get_system_data_dirs();
	    for (let i = 0; i < systemDataDirs.length; i++) {
	        let dirPath = systemDataDirs[i] + '/themes';
	        let dir = Gio.file_new_for_path(dirPath);
	        if (dir.query_exists(null))
	           this._loadThemesIn(dir, ThemeType.SYSTEM);
	    }
	    this._loadThemesIn(Gio.file_new_for_path(GLib.get_home_dir() + '/.themes'), ThemeType.PER_USER);
	},
	
	_loadDefaultTheme: function() {
	    let info;
	    let themeName = "Cinnamon";
		let themeType = _("Default theme");
		let themeDir = Gio.file_new_for_path("/usr/share/cinnamon/theme");		
		 			   	    
	    if (themeDir != null) {	  
	    	let thumbnail = themeDir.get_child('thumbnail.png');
	    	let icon = null;	    	
	    	if (thumbnail.query_exists(null)) {	    		
	    		icon = St.TextureCache.get_default().load_uri_sync(1, thumbnail.get_uri(), 256, 256);
	    	}
	    	else {
	    		try{
	    			let file = Gio.file_new_for_path("/usr/share/cinnamon/theme/thumbnail-generic.png");
           			let uri = file.get_uri();
	    			icon = St.TextureCache.get_default().load_uri_sync(1, uri, 256, 256);
	    		}
	    		catch (error) {
					log(error);	    			
	    		}
	    	}  	
	    	let theme = new St.Button({ style_class: 'theme-button', reactive: true });                                    
            let box = new St.BoxLayout({ style_class: 'theme-box', vertical: true });        	
        	if (icon != null) {
        		let iconBin = new St.Bin({ x_fill: true, y_fill: true });
        		iconBin.child = icon;
				box.add(iconBin, { x_fill: false, y_fill: false } );
        	}        	        	
            let label_name = new St.Label({ style_class: 'theme-name', text: themeName });            
            let bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(label_name);            
            box.add(bin);                        
            let label_type = new St.Label({ style_class: 'theme-type', text: themeType });
            bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(label_type);
            box.add(bin);                        
            theme.set_child(box);     
            theme.add_style_pseudo_class('active');             		    	    		      
        	this._grid.addItem(theme);
        	theme.connect('key-focus-in', Lang.bind(this, this._ensureIconVisible));	
        	theme.connect('clicked', Lang.bind(this, function() {
				this._settings.set_string(SETTINGS_KEY, '');                    	
			}));   		    	
	    }	         
	},
	
	_loadTheme: function(dir, type) {		
	    let info;
	    let themeName = dir.get_basename();	    
		let themeType = null;
		let themeDir = null;
		let cinnamonDir = dir.get_child('cinnamon');
		let gnomeshellDir = dir.get_child('gnome-shell');
		if (cinnamonDir.query_exists(null)) {
			themeType = _("Cinnamon Theme");
			themeDir = cinnamonDir;
		}
		else if (gnomeshellDir.query_exists(null)) {
			themeType = _("Gnome Shell Theme");
			themeDir = gnomeshellDir;
		}
		 			   	    
	    if (themeDir != null) {	 
	    	let thumbnail = null;
	    	try {	    		
	    		// Try to get the thumbnail from theme.json
		    	let jsonThemeFile = themeDir.get_child('theme.json');
		    	if (jsonThemeFile.query_exists(null)) {
		    		let content = Cinnamon.get_file_contents_utf8_sync(jsonThemeFile.get_path());
		    		let meta = JSON.parse(content);		    		
		    		if (meta['shell-theme']['thumbnail']) {
		    			thumbnail = themeDir.get_child(meta['shell-theme']['thumbnail']).get_uri();
		    		}
		    		else if  (meta['cinnamon-theme']['thumbnail']) {
		    			thumbnail = themeDir.get_child(meta['cinnamon-theme']['thumbnail']).get_uri();
		    		}
		    	}
	    	}
	    	catch (e) {
	    		log(e);
	    	}	
	    	if (thumbnail == null) {  
	    		// Try to get the thumbnail from thumbnail.png
	    		let thumbnailFile = themeDir.get_child('thumbnail.png');	    		    	
		    	if (thumbnailFile.query_exists(null)) {
		    		thumbnail = thumbnailFile.get_uri();
		    	}	    		
	    	}
	    	if (thumbnail == null) {
	    		// Otherwise use the default generic theme thumbnail
	    		thumbnail = Gio.file_new_for_path("/usr/share/cinnamon/theme/thumbnail-generic.png").get_uri();	    		
	    	}
	    		    	
	    	let icon = null;
	    	
    		try{	    			
    			icon = St.TextureCache.get_default().load_uri_sync(1, thumbnail, 256, 256);
    		}
    		catch (error) {
				log(error);	    			
    		}
	    	  	
	    	let theme = new St.Button({ style_class: 'theme-button', reactive: true });                                    
            let box = new St.BoxLayout({ style_class: 'theme-box', vertical: true });        	
        	if (icon != null) {
        		let iconBin = new St.Bin({ x_fill: true, y_fill: true });
        		iconBin.child = icon;
				box.add(iconBin, { x_fill: false, y_fill: false } );
        	}        	        	
            let label_name = new St.Label({ style_class: 'theme-name', text: themeName });            
            let bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(label_name);            
            box.add(bin);                        
            let label_type = new St.Label({ style_class: 'theme-type', text: themeType });
            bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(label_type);
            box.add(bin);                        
            theme.set_child(box);                  		    	    		      
        	this._grid.addItem(theme);
        	theme.connect('key-focus-in', Lang.bind(this, this._ensureIconVisible));	
        	theme.connect('clicked', Lang.bind(this, function() {
				this._settings.set_string(SETTINGS_KEY, themeName);                    	
			}));   		    	
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
    }    
};


