const Signals = imports.signals;


function SystrayManager() {
    this._init();
}

SystrayManager.prototype = {
    _init: function() {
        this._roles = [];
    },
    
    registerRole: function(role, id) {
        this._roles.push({role: role, id: id});
        this.emit("changed");
    },
    
    unregisterRole: function(role, id) {
        for (let i = this._roles.length - 1; i >= 0; i--) {
            if (this._roles[i].id == id && this._roles[i].role == role) {
                this._roles.splice(i, 1);
            }
        }
        this.emit("changed");
    },
    
    unregisterId: function(id) {
        for (let i = this._roles.length - 1; i >= 0; i--) {
            if (this._roles[i].id == id) {
                this._roles.splice(i, 1);
            }
        }
        this.emit("changed");
    },
    
    getRoles: function(id) {
        let roles = [];
        for (let i = 0; i < this._roles.length; i++) {
            roles.push(this._roles[i].role);
        }
        
        return roles;
    }
}
Signals.addSignalMethods(SystrayManager.prototype);
