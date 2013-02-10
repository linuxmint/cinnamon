const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Config = imports.misc.config;

function SplashScreen() {
    this._init();
}

SplashScreen.prototype = {
    _init: function() {
        this._container = new Cinnamon.GenericContainer({ width: 0,
                                                     height: 0 });
        this._container.connect('allocate', Lang.bind(this, this._allocate));
        Main.uiGroup.add_actor(this._container);

        let eventHandler = new St.BoxLayout({ name: 'LookingGlassDialog',
                                              vertical: true,
                                              reactive: true });
        this._eventHandler = eventHandler;
        this._container.add_actor(eventHandler);
        this._titleText = new St.Label({text: 'Loading Cinnamon ' + Config.PACKAGE_VERSION + '\n', style: 'text-align: center;'});
        eventHandler.add(this._titleText, { expand: true });
        this._displayText = new St.Label({style: 'text-align: center;'});
        eventHandler.add(this._displayText, { expand: true });
        this._progessFrame = new St.BoxLayout({ clip_to_allocation: true,
                                    style: 'width: 200px; height: 15px; border: 1px solid #333333;' });
        this._progessBar = new St.Group({ clip_to_allocation: true,
                                    style: 'width: 0px; height: 15px; background-color: red;' });
        eventHandler.add(this._progessFrame, { expand: false });
        this._progessFrame.add(this._progessBar, { expand: false });
        
        this._lastSection = null;
        this._updatePrimaryMonitor();
        global.screen.connect('monitors-changed', Lang.bind(this, this._updatePrimaryMonitor));
        
        this._totalSections = 0;
        this._processedSections = 0;
    },
    
    _updatePrimaryMonitor: function() {
        let screen = global.screen;
        this.primaryMonitor = screen.get_monitor_geometry(screen.get_primary_monitor());
    },
    
    destroy: function() {
        Main.uiGroup.remove_actor(this._container);
        this._container.destroy();
    },

    _allocate: function(actor, box, flags) {
        if (!this._eventHandler)
            return;

        let primary = this.primaryMonitor;

        let [minWidth, minHeight, natWidth, natHeight] =
            this._eventHandler.get_preferred_size();

        let childBox = new Clutter.ActorBox();
        childBox.x1 = primary.x + Math.floor((primary.width - natWidth) / 2);
        childBox.x2 = childBox.x1 + natWidth;
        childBox.y1 = primary.y + Math.floor((primary.height - natHeight) / 2);
        childBox.y2 = childBox.y1 + natHeight;
        this._eventHandler.allocate(childBox, flags);
    },
    
    
    addSection: function(name, callback) {
        let section = {
            name: name,
            callback: callback
        };
        
        if(this._lastSection == null)
            this._firstSection = section;
        else
            this._lastSection.next = section;
        
        this._lastSection = section;
        this._totalSections++;
        return section;
    },

    runAllSections: function() {
        this._runNextSection(this._firstSection);
    },
    
    _runNextSection: function(section) {
        let progress = this._processedSections / this._totalSections;
        this._processedSections++;
        
        let width = Math.round(progress * this._progessFrame.get_width());
        let height = this._progessFrame.get_height();
        this._progessBar.style = 'width: ' + width + 'px; height: ' + height + 'px; background-color: #00bb00;';
        
        let t = new Date().getTime();
        if(this._time)
            global.log(this._lastSectionName + " took " + (t - this._time) + " ms");
        this._lastSectionName = section.name;
        this._time = t;
        
        this._displayText.set_text(section.name);

        section.callback();
        if(section.next) {
            Mainloop.timeout_add(10, Lang.bind(this, function() {
                this._runNextSection(section.next);
            }));
        } else {
            this.destroy();
        }
    }
};
