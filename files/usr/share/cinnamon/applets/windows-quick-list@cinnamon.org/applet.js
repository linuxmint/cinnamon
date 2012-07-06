const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;

function MyApplet(metadata, orientation) {
	this._init(metadata, orientation);
};

MyApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

		try {
			Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_symbolic_name("windows-quick-list");
            this.set_applet_tooltip(_("All windows"));            
			
			
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menuManager.addMenu(this.menu);  						           
		}
		catch (e) {
			global.logError(e);
		}
	},
	
	updateMenu: function() {
		this.menu.removeAll();
		try {
			for ( let wks=0; wks<global.screen.n_workspaces; ++wks ) {
				// construct a list with all windows
				let workspace_name = Main.workspace_names[wks];
				let metaWorkspace = global.screen.get_workspace_by_index(wks);
				let windows = metaWorkspace.list_windows();				
				windows = windows.filter(
						function(w) {
							return !w.is_skip_taskbar();
							}
                                		);

				if(windows.length) {
					if(wks>0) {						
						this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
					}
					if(global.screen.n_workspaces>1) {					
						let item = new PopupMenu.PopupMenuItem(workspace_name);
						item.actor.reactive = false;
						item.actor.can_focus = false;
						item.label.add_style_class_name('popup-subtitle-menu-item');
						if(wks == global.screen.get_active_workspace().index()) {
							item.setShowDot(true);
						}
						this.menu.addMenuItem(item);
					}

					let tracker = Cinnamon.WindowTracker.get_default();

					for ( let i = 0; i < windows.length; ++i ) {
						let metaWindow = windows[i];
						let item = new PopupMenu.PopupMenuItem(windows[i].get_title());
						if(metaWindow.is_on_all_workspaces()) {
							item.label.add_style_class_name('window-sticky');
						}
						item.connect('activate', Lang.bind(this, function() { this.activateWindow(metaWorkspace, metaWindow); } ));
						item._window = windows[i];
						let app = tracker.get_window_app(item._window);
						item._icon = app.create_icon_texture(24);
        				item.addActor(item._icon, { align: St.Align.END });
						this.menu.addMenuItem(item);
					}
				}
			}
		} catch(e) {
			global.logError(e);			
		}		
	},

	activateWindow: function(metaWorkspace, metaWindow) {
		metaWorkspace.activate(global.get_current_time());
		metaWindow.unminimize(global.get_current_time());
		metaWindow.activate(global.get_current_time());
	},
	
	on_applet_clicked: function(event) {
		this.updateMenu();
		this.menu.toggle();    
	}
};

function main(metadata, orientation) {
	let myApplet = new MyApplet(metadata, orientation);
	return myApplet;
}
