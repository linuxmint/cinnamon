const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Gettext = imports.gettext.domain('cinnamon-applets');
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const _ = Gettext.gettext;
const SearchProviderManager = imports.ui.searchProviderManager;
const Clutter = imports.gi.Clutter;

const RESULT_TYPES_LABELS = 
{
    software: _("Software"),
    pictures: _("Pictures"),
    videos: _("Videos"),
    music: _("Music"),
    folders: _("Folders"),
    files: _("Other Files"),
    provider: _("Other Results")
}

function SearchProviderResultButton(applet, provider, result) {
    this._init(applet, provider, result);
}

SearchProviderResultButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(applet, provider, result) {
        this.provider = provider;
        this.result = result;
        this._applet = applet;

        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});
        
        this.icon = null;
        if (result.icon){
            this.icon = result.icon;
        }else if (result.icon_app){
            this.icon = result.icon_app.create_icon_texture(16);
        }else if (result.icon_filename){
            this.icon = new St.Icon({gicon: new Gio.FileIcon({file: Gio.file_new_for_path(result.icon_filename)}), icon_size: 16});
        }
        
        if (this.icon){
            this.addActor(this.icon);
        }

        this.label = new St.Label({ text: result.label });
        this.addActor(this.label);
        if (this.icon) {
            this.icon.realize();
        }
        this.label.realize();
        
        this.connect('activate', Lang.bind(this, this._on_activate));
    },
    
    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1){
            this.activate(event);
        }
        return true;
    },
    
    _on_activate: function(event) {
        try{
            this.provider.on_result_selected(this.result);
            this._applet._search_menu.close();
        }
        catch(e)
        {
            global.logError(e);
        }
    }
}

function ApplicationResultButton(applet, app)
{
    this._init(applet, app);
}

ApplicationResultButton.prototype = 
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(applet, app)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});
        
        this._app = app;
        this._applet = applet;
        
        this.icon = this._app.create_icon_texture(16);
        this.addActor(this.icon);
        this.name = this._app.get_name();
        this.label = new St.Label(
        {
            text: this.name
        });
        this.label.set_style("width: 180px;");
        this.addActor(this.label);
        this.icon.realize();
        this.label.realize();
        
        this.connect('activate', Lang.bind(this, this._on_activate));
    },
    
    _on_activate: function()
    {
        this._applet._search_menu.close();
        this._app.open_new_window(-1);
    }
}

function FileResultButton(applet, result, type)
{
    this._init(applet, result, type);
}

FileResultButton.prototype = 
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(applet, result, type, custom_label)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});
        
        this._filename = result["url"];
        this._applet = applet;
        
        try
        {
            let icon = Cinnamon.util_get_icon_for_uri(this._filename);
            if (icon)
            {
                this.icon = St.TextureCache.get_default().load_gicon(null, icon, 16);
            }
        }
        catch (e)
        {
        }
        if (!this.icon)
        {
            this.icon = new St.Icon(
            {
                icon_name: (type == "files" ? "text-x-preview" : "folder"),
                icon_size: 16,
                icon_type: St.IconType.FULLCOLOR
            });
        }
        this.addActor(this.icon);
        this.label = new St.Label(
        {
            text: (custom_label ? custom_label : decodeURIComponent(this._filename))
        });
        this.addActor(this.label);
        this.icon.realize();
        this.label.realize();
        
        this.connect('activate', Lang.bind(this, this._on_activate));
    },
    
    _on_activate: function()
    {
        this._applet._search_menu.close();
        Util.trySpawn(["xdg-open", this._filename]);
    }
}

function MusicResultButton(applet, result, type)
{
    this._init(applet, result, type);
}

MusicResultButton.prototype = 
{
    __proto__: FileResultButton.prototype,
    
    _init: function(applet, result, type)
    {
        var basename = result["url"].split("/");
        basename = decodeURIComponent(basename[basename.length - 1]);
        var label = (result["performer"] ? result["performer"] + " - " : "") + (result["musicAlbum"] ? result["musicAlbum"] + " - " : "") + (result["trackNumber"] ? result["trackNumber"] + " - " : "") + (result["title"] ? result["title"] : basename);
        FileResultButton.prototype._init.call(this, applet, result, type, label.trim());
    }
}

function MyApplet(orientation, panel_height, instanceId)
{
    this._init(orientation, panel_height, instanceId);
}

MyApplet.prototype =
{
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instanceId)
    {
        try
        {
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instanceId);
        
            menuItem = new Applet.MenuItem(_("Indexing Preferences"), null, Lang.bind(this, function(actor, event)
            {
                Util.spawnCommandLine('tracker-preferences');
            }));
            this._applet_context_menu.addMenuItem(menuItem);
            
            this.settings = new Settings.AppletSettings(this, "finder@cinnamon.org", instanceId);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "launch_shortcut",
                                     "launch_shortcut",
                                     this.on_launch_shortcut_changed,
                                     null);
                                     
            this.set_applet_icon_name("edit-find-symbolic");
            this.set_applet_tooltip(_("Search using search providers"));

            let menuManager = new PopupMenu.PopupMenuManager(this);
            this._search_menu = new Applet.AppletPopupMenu(this, orientation);
            menuManager.addMenu(this._search_menu);

            let section = new PopupMenu.PopupMenuSection();
            this._search_menu.addMenuItem(section);

            this.searchEntry = new St.Entry(
            {
                name: 'menu-search-entry',
                hint_text: _("Type to search..."),
                track_hover: true,
                can_focus: true
            });
            section.actor.set_style("padding: 10px;");
            this._searchInactiveIcon = new St.Icon(
            {
                style_class: 'menu-search-entry-icon',
                icon_name: 'edit-find',
                icon_type: St.IconType.SYMBOLIC
            });
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this._search_menu.actor.connect('key-release-event', Lang.bind(this, this._onKeyPress));

            section.actor.add_actor(this.searchEntry);
            
            this._scrollBox = new St.ScrollView(
            {
                x_fill: true,
                y_fill: false,
                y_align: St.Align.START
            });
            this._scrollBox.set_style("width: 500px;");
            this._search_menu.addActor(this._scrollBox);
            this._container = new St.BoxLayout(
            {
                vertical:true
            });
            this._scrollBox.add_actor(this._container);
            this._scrollBox.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
            this._scrollBox.set_auto_scrolling(true);

            this.searchEntryText = this.searchEntry.clutter_text;
            this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
            
            this._search_timer = null;
                        
            this._appSys = Cinnamon.AppSystem.get_default();
            
            this.on_launch_shortcut_changed();
        }
        catch(e)
        {
            global.logError(e);
        }
    },
    
    _onKeyPress: function(actor, event)
    {
        let symbol = event.get_key_symbol();
        if (symbol != Clutter.KEY_Up && symbol != Clutter.KEY_Down)
        {
            global.stage.set_key_focus(this.searchEntry);
        }
    },
    
    on_launch_shortcut_changed: function()
    {
        Main.keybindingManager.addHotKey("finder_launch", this.launch_shortcut, Lang.bind(this, this.launch));
    },

    _onSearchTextChanged: function(se, prop)
    {
        let searchString = this.searchEntry.get_text();

        if (searchString != "")
        {
            if (this._search_timer)
            {
                Mainloop.source_remove(this._search_timer);
                this._search_timer = null;
            }
            this._search_timer = Mainloop.timeout_add(300, Lang.bind(this, function()
            {
                this._search_timer = null;
                this._process_search(searchString);
            }));
        }
    },
    
    _process_search: function(searchString)
    {
        this._currentSearchString = searchString;
        var children = this._container.get_children();
        var result_type;
        for (var i in children)
        {
            children[i].destroy();
        }
        SearchProviderManager.launch_all(searchString, Lang.bind(this, function(provider, results, searchString){
            query_results = {};
            for (var i in results){
                result_type = (results[i].type ? results[i].type : 'provider');
                if (!query_results[result_type])
                {
                    query_results[result_type] = new Array();
                }
                results[i].type = 'provider';
                results[i].provider = provider;
                results[i].id = 'provider-' + results[i].id;
                results[i].id = 'provider-' + results[i].id;
                query_results[result_type].push(results[i]);
            }
            this._show_results(searchString, query_results);
        }, searchString));
    },
    
    _show_results: function(searchString, results)
    {
        if (searchString != this._currentSearchString)
        {
            return;
        }
        
        var results_buttons = {};
        let button;
        let this_results;
        var all_result_types = new Array();
        for (var result_type in results)
        {
            this_results = results[result_type];
            if (this_results.length > 0)
            {
                all_result_types.push(result_type);
                results_buttons[result_type] = new Array();
                for (var i in this_results)
                {
                    button = null;
                    switch (result_type)
                    {
                        case 'provider':
                            button = new SearchProviderResultButton(this, this_results[i]['provider'], this_results[i]);
                            break;
                        case "software":
                            var results_parts = this_results[i]["url"].split("/");
                            let app = this._appSys.lookup_app(results_parts[results_parts.length - 1].split(".desktop")[0] + ".desktop");
                            if (app)
                            {
                                let appinfo = app.get_app_info();
                                if (!appinfo || !appinfo.get_nodisplay())
                                {
                                    button = new ApplicationResultButton(this, app);
                                }
                            }
                            break;
                        case "music":
                            button = new MusicResultButton(this, this_results[i], result_type);
                            break;
                        case "pictures":
                        case "videos":
                        case "folders":
                        case "files":
                            button = new FileResultButton(this, this_results[i], result_type);
                            break;
                    }
                    if (button != null)
                    {
                        button.actor.connect("notify::hover", Lang.bind(this, this._scrollToButton));
                        button.actor.connect("key-focus-in", Lang.bind(this, this._scrollToButton));
                        if (result_type == 'provider')
                        {
                            if (!results_buttons['provider-' + SearchProviderManager.extensionMeta[this_results[i]['provider'].uuid].name])
                            {
                                all_result_types.push('provider-' + SearchProviderManager.extensionMeta[this_results[i]['provider'].uuid].name);
                                results_buttons['provider-' + SearchProviderManager.extensionMeta[this_results[i]['provider'].uuid].name] = new Array();
                            }
                            results_buttons['provider-' + SearchProviderManager.extensionMeta[this_results[i]['provider'].uuid].name].push(button);
                        }
                        else
                        {
                            results_buttons[result_type].push(button);
                        }
                    }
                }
            }
        }
        
        all_result_types.sort(function(a, b)
        {
            var order = ["software", "music", "pictures", "videos", "folders", "files", "provider"];
            return order.indexOf(a) - order.indexOf(b);
        });
        
        let this_results_buttons, label;
        for (var i in all_result_types)
        {
            result_type = all_result_types[i];
            this_results_buttons = results_buttons[result_type];
            if (this_results_buttons.length > 0)
            {
                if (this._container.get_children().length > 0)
                {
                    var separator = new PopupMenu.PopupSeparatorMenuItem();
                    this._container.add_actor(separator.actor);
                }
                if (result_type.substring(0, 9) == 'provider-')
                {
                    label = result_type.substring(9);
                }
                else
                {
                    label = RESULT_TYPES_LABELS[result_type];
                }
                var result_type_label = new PopupMenu.PopupMenuItem(label, 
                {
                    reactive: false,
                    hover: false,
                    sensitive: false,
                    focusOnHover: true
                });
                result_type_label.actor.set_style("font-weight: bold;");
                this._container.add_actor(result_type_label.actor);
                
                for (var i in this_results_buttons)
                {
                    this._container.add_actor(this_results_buttons[i].actor);
                }
            }
        }
    },

    on_applet_clicked: function(event)
    {
        if (event.get_button() == 1)
        {
            this.launch();
        }
    },
    
    launch: function()
    {
        this._search_menu.toggle();
        global.stage.set_key_focus(this.searchEntry);
        this.searchEntryText.set_selection(0, this.searchEntry.get_text().length);
    },
    
    _scrollToButton: function(button)
    {
        var current_scroll_value = this._scrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this._scrollBox.get_allocation_box().y2 - this._scrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.get_allocation_box().y1 - 10) new_scroll_value = button.get_allocation_box().y1 - 10;
        if (box_height + current_scroll_value < button.get_allocation_box().y2 + 10) new_scroll_value = button.get_allocation_box().y2-box_height + 10;
        if (new_scroll_value != current_scroll_value) this._scrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    }
}

function main(metadata, orientation, panel_height, instanceId)
{
    let myApplet = new MyApplet(orientation, panel_height, instanceId);
    return myApplet;
}
