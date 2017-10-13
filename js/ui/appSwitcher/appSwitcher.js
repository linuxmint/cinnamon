// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const Cinnamon = imports.gi.Cinnamon;

const CHECK_DESTROYED_TIMEOUT = 100;
const DISABLE_HOVER_TIMEOUT = 500; // milliseconds

function sortWindowsByUserTime(win1, win2) {
    let t1 = win1.get_user_time();
    let t2 = win2.get_user_time();
    let m1 = win1.minimized;
    let m2 = win2.minimized;
    if (m1 == m2) {
        return (t2 > t1) ? 1 : -1;   
    }
    else {
        return m1 ? 1 : -1;
    }    
}

function matchSkipTaskbar(win) {
    return !win.is_skip_taskbar();
}

function matchWmClass(win) {
    return win.get_wm_class() == this && !win.is_skip_taskbar();
}

function matchWorkspace(win) {
    return win.get_workspace() == this && !win.is_skip_taskbar();
}

function primaryModifier(mask) {
    if (mask == 0)
        return 0;

    let primary = 1;
    while (mask > 1) {
        mask >>= 1;
        primary <<= 1;
    }
    return primary;
}

function getWindowsForBinding(binding) {
    // Construct a list with all windows
    let windows = [];
    let windowActors = global.get_window_actors();
    for (let i in windowActors)
        windows.push(windowActors[i].get_meta_window());

    windows = windows.filter( Main.isInteresting );

    switch(binding.get_name()) {
        case 'switch-panels':
            // Switch between windows of all workspaces
            windows = windows.filter( matchSkipTaskbar );
            break;
        case 'switch-group':
            // Switch between windows of same application from all workspaces
            let focused = global.display.focus_window ? global.display.focus_window : windows[0];
            windows = windows.filter( matchWmClass, focused.get_wm_class() );
            break;
        default:
            // Switch between windows of current workspace
            this._showAllWorkspaces = global.settings.get_boolean("alttab-switcher-show-all-workspaces");
            if (!this._showAllWorkspaces) {
                windows = windows.filter( matchWorkspace, global.screen.get_active_workspace() );
            }
            break;
    }

    // Sort by user time
    windows.sort(sortWindowsByUserTime);
    
    return windows;
}

function AppSwitcher() {
    this._init.apply(this, arguments);
}

AppSwitcher.prototype = {
    _init: function(binding) {
        this._initialDelayTimeoutId = null;
        this._binding = binding;
        this._windows = getWindowsForBinding(binding);
        
        this._haveModal = false;
        this._destroyed = false;
        this._motionTimeoutId = 0;
        this._checkDestroyedTimeoutId = 0;
        this._currentIndex = this._windows.indexOf(global.display.focus_window);
        if (this._currentIndex < 0) {
            this._currentIndex = 0;
        }
        this._modifierMask = primaryModifier(binding.get_mask());

        this._tracker = Cinnamon.WindowTracker.get_default();
        this._windowManager = global.window_manager;

        this._dcid = this._windowManager.connect('destroy', Lang.bind(this, this._windowDestroyed));
        this._mcid = this._windowManager.connect('map', Lang.bind(this, this._activateSelected));
        
        this._enforcePrimaryMonitor = global.settings.get_boolean("alttab-switcher-enforce-primary-monitor");
        this._updateActiveMonitor();
    },

    _setupModal: function() {
        this._haveModal = Main.pushModal(this.actor);
        if (!this._haveModal) {
            // Probably someone else has a pointer grab, try again with keyboard only
            this._haveModal = Main.pushModal(this.actor, global.get_current_time(), Meta.ModalOptions.POINTER_ALREADY_GRABBED);
        }
        if (!this._haveModal)
            this._activateSelected();
        else {
            // Initially disable hover so we ignore the enter-event if
            // the switcher appears underneath the current pointer location
            this._disableHover();
        
            this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
            this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));
            this.actor.connect('scroll-event', Lang.bind(this, this._scrollEvent));
            this.actor.connect('button-press-event', Lang.bind(this, this.destroy));

            // There's a race condition; if the user released Alt before
            // we got the grab, then we won't be notified. (See
            // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
            // details) So we check now. (Have to do this after updating
            // selection.)
            let [x, y, mods] = global.get_pointer();
            if (!(mods & this._modifierMask)) {
                this._activateSelected();
                return false;
            }
        
            // We delay showing the popup so that fast Alt+Tab users aren't
            // disturbed by the popup briefly flashing.
            let delay = global.settings.get_int("alttab-switcher-delay");
            this._initialDelayTimeoutId = Mainloop.timeout_add(delay, Lang.bind(this, this._show));
        }
        return this._haveModal;
    },
    
    _popModal: function() {
        if (this._haveModal) {
            Main.popModal(this.actor);
            this._haveModal = false;
        }
    },

    _show: function() {
        throw new Error("Abstract method _show not implemented");
    },
    
    _hide: function() {
        throw new Error("Abstract method _hide not implemented");
    },

    _onDestroy: function() {
        throw new Error("Abstract method _onDestroy not implemented");
    },

    _createList: function() {
        throw new Error("Abstract method _createList not implemented");
    },

    _updateList: function() {
        throw new Error("Abstract method _updateList not implemented");
    },

    _selectNext: function() {
        throw new Error("Abstract method _selectNext not implemented");
    },

    _selectPrevious: function() {
        throw new Error("Abstract method _selectPrevious not implemented");
    },

    _onWorkspaceSelected: function() {
        throw new Error("Abstract method _onWorkspaceSelected not implemented");
    },

    _checkSwitchTime: function() {
        return true;
    },
    
    _setCurrentWindow: function(window) {
    },

    _next: function() {
        if(this._windows.length <= 1) {
            this._currentIndex = 0;
            this._updateList(0);
        } else {
            this.actor.set_reactive(false);
            this._selectNext();
            this.actor.set_reactive(true);
        }
        this._setCurrentWindow(this._windows[this._currentIndex]);
    },

    _previous: function() {
        if(this._windows.length <= 1) {
            this._currentIndex = 0;
            this._updateList(0);
        } else {
            this.actor.set_reactive(false);
            this._selectPrevious();
            this.actor.set_reactive(true);
        }
        this._setCurrentWindow(this._windows[this._currentIndex]);
    },
    
    _select: function(index) {
        this._currentIndex = index;
        this._setCurrentWindow(this._windows[this._currentIndex]);
    },

    _updateActiveMonitor: function() {
        this._activeMonitor = null;
        if (!this._enforcePrimaryMonitor)
            this._activeMonitor = Main.layoutManager.currentMonitor;
        if (!this._activeMonitor)
            this._activeMonitor = Main.layoutManager.primaryMonitor;

        return this._activeMonitor;
    },

    _keyPressEvent: function(actor, event) {
        let event_state = Cinnamon.get_event_state(event);
        
        this._disableHover();
        
        // Switch workspace
        if(event_state & Clutter.ModifierType.CONTROL_MASK) {
            switch(event.get_key_symbol()) {
                case Clutter.Right:
                    if (this._switchWorkspace(1))
                        return true;
                    break;
                case Clutter.Left:
                    if (this._switchWorkspace(-1))
                        return true;
                    break;
            }
        }
        
        // Extra keys
        switch(event.get_key_symbol()) {
            case Clutter.Escape:
                // Esc -> Close switcher
                this.destroy();
                return true;
                
            case Clutter.Return:
                // Enter -> Select active window
                this._activateSelected();
                return true;

            case Clutter.d:
            case Clutter.D:
                // D -> Show desktop
                this._showDesktop();
                return true;

            case Clutter.q:
            case Clutter.Q:
                // Q -> Close window
                this._windows[this._currentIndex].delete(global.get_current_time());
                this._checkDestroyedTimeoutId = Mainloop.timeout_add(CHECK_DESTROYED_TIMEOUT,
                        Lang.bind(this, this._checkDestroyed, this._windows[this._currentIndex]));
                return true;

            case Clutter.Right:
            case Clutter.Down:
                // Right/Down -> navigate to next preview
                if(this._checkSwitchTime())
                    this._next();
                return true;

            case Clutter.Left:
            case Clutter.Up:
                // Left/Up -> navigate to previous preview
                if(this._checkSwitchTime())
                    this._previous();
                return true;
        }

        // Default alt-tab
        let action = global.display.get_keybinding_action(event.get_key_code(), event_state);
        switch(action) {
            case Meta.KeyBindingAction.SWITCH_GROUP:
            case Meta.KeyBindingAction.SWITCH_WINDOWS:
            case Meta.KeyBindingAction.SWITCH_PANELS:
                if(this._checkSwitchTime()) {
                    // shift -> backwards
                    if(event_state & Clutter.ModifierType.SHIFT_MASK)
                        this._previous();
                    else
                        this._next();
                }
                return true;
            case Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD:
            case Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD:
            case Meta.KeyBindingAction.SWITCH_PANELS_BACKWARD:
                if(this._checkSwitchTime())
                    this._previous();
                return true;
        }

        return true;
    },

    _keyReleaseEvent: function(actor, event) {
        let [x, y, mods] = global.get_pointer();
        let state = mods & this._modifierMask;

        if (state == 0) {
            if (this._initialDelayTimeoutId !== 0)
                this._currentIndex = (this._currentIndex + 1) % this._windows.length;
            this._activateSelected();
        }

        return true;
    },

    // allow navigating by mouse-wheel scrolling
    _scrollEvent: function(actor, event) {
        if(this._checkSwitchTime()) {
            actor.set_reactive(false);
            if (event.get_scroll_direction() == Clutter.ScrollDirection.UP)
                this._previous();
            else
                this._next();
            actor.set_reactive(true);
        }
        return true;
    },

    _disableHover : function() {
        this._mouseActive = false;

        if (this._motionTimeoutId != 0)
            Mainloop.source_remove(this._motionTimeoutId);

        this._motionTimeoutId = Mainloop.timeout_add(DISABLE_HOVER_TIMEOUT, Lang.bind(this, this._mouseTimedOut));
    },

    _mouseTimedOut : function() {
        this._motionTimeoutId = 0;
        this._mouseActive = true;
    },
    
    _switchWorkspace: function(direction) {
        if (global.screen.n_workspaces < 2)
            return false;

        let current = global.screen.get_active_workspace_index();
        let nextIndex = (global.screen.n_workspaces + current + direction) % global.screen.n_workspaces;
        let workspace = global.screen.get_workspace_by_index(nextIndex);
        workspace.activate(global.get_current_time());
        if (current == global.screen.get_active_workspace_index())
            return false;
            
        Main.wm.showWorkspaceOSD();
        this._onWorkspaceSelected(workspace);
        return true;
    },

    _windowDestroyed: function(wm, actor) {
        this._removeDestroyedWindow(actor.meta_window);
    },

    _checkDestroyed: function(window) {
        this._checkDestroyedTimeoutId = 0;
        this._removeDestroyedWindow(window);
    },

    _removeDestroyedWindow: function(window) {
        for (let i in this._windows) {
            if (window == this._windows[i]) {
                if (this._windows.length == 1)
                    this.destroy();
                else {
                    this._windows.splice(i, 1);
                    if (this._previews && this._previews[i]) {
                        this._previews[i].destroy();
                        this._previews.splice(i, 1);
                    }
                    if (i < this._currentIndex)
                        this._currentIndex--;
                    else
                        this._currentIndex %= this._windows.length;
                    
                    this._updateList(0);
                    this._setCurrentWindow(this._windows[this._currentIndex]);
                }

                return;
            }
        }
    },

    _activateSelected: function() {
        Main.activateWindow(this._windows[this._currentIndex], global.get_current_time());
        if (!this._destroyed)
            this.destroy();
    },

    _showDesktop: function() {
        for (let i in this._windows) {
            if (!this._windows[i].minimized)
                this._windows[i].minimize();
        }
        this.destroy();
    },

    destroy: function() {
        this._destroyed = true;
        this._popModal();
        
        if (this._initialDelayTimeoutId !== 0)
            this._destroyActors();
        else
            this._hide();
            
        if(this._initialDelayTimeoutId !== null && this._initialDelayTimeoutId > 0) {
            Mainloop.source_remove(this._initialDelayTimeoutId);
            this._initialDelayTimeoutId = 0;
        }
        this._onDestroy();
        
        this._windows = null;
        if (this._motionTimeoutId != 0) {
            Mainloop.source_remove(this._motionTimeoutId);
            this._motionTimeoutId = 0;
        }
        if (this._checkDestroyedTimeoutId != 0) {
            Mainloop.source_remove(this._checkDestroyedTimeoutId);
            this._checkDestroyedTimeoutId = 0;
        }
        
        this._windowManager.disconnect(this._dcid);
        this._windowManager.disconnect(this._mcid);
    }
};
