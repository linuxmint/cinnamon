AppLauncher.prototype = {
    __proto__: PopupMenu.PopupIconMenuItem.prototype,

    _init: function (label, command, icon) {
        PopupMenu.PopupIconMenuItem.prototype._init.call(this, label, icon, St.IconType.SYMBOLIC);

        this._command = command;
        this.connect('activate', Lang.bind(this, function() {
            Util.spawnCommandLine(this._command);
        }));
    },
};
// did this thanks to https://forums.linuxmint.com/viewtopic.php?p=2163518#p2163518 who had the same desire as me
