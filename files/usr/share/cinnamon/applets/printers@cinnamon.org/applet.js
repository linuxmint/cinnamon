const Applet = imports.ui.applet;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Util = imports.misc.util;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";
const APPLET_PATH = imports.ui.appletManager.appletMeta['printers@cinnamon.org'].path;


function formatBytes(bytesStr) {
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes) || bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    return value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }) + " " + sizes[i];
}


class CinnamonPrintersApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._cupsSignal = Gio.DBus.system.signal_subscribe(null, 'org.cups.cupsd.Notifier', null, '/org/cups/cupsd/Notifier', null, Gio.DBusSignalFlags.NONE, this.onCupsSignal.bind(this));

        this.set_applet_tooltip(_("Printers"));

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.connect('open-state-changed', Lang.bind(this, this.onMenuOpened));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind('show-icon', 'show_icon', this.update);

        this.panelEditModeHandler = global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._on_panel_edit_mode_changed));

        this.jobsCount = 0;
        this.printersCount = 0;
        this.printWarning = false;
        this.printStatus = '';
        this.updating = false;
        this.showLater = false;
        this.printers = [];
        this.jobs = [];
        this.set_applet_icon_symbolic_name('xsi-printer');
        this.update();
    }

    on_applet_clicked() {
        if(!this.menu.isOpen && this.updating) {
            this.showLater = true;
            return;
        }
        this.menu.toggle();
        if(!this.printWarning && !this.menu.isOpen) {
            this.update();
        }
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
        global.settings.disconnect(this.panelEditModeHandler);
    }

    _on_panel_edit_mode_changed () {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        } else {
            this.update();
        }
    }

    onCupsSignal() {
        if(this.printWarning) return;
        this.printWarning = true;
        Mainloop.timeout_add_seconds(3, Lang.bind(this, this.warningTimeout));
        this.update();
    }

    warningTimeout() {
        this.printWarning = false;
        this.update();
    }

    onMenuOpened() {
        if(this.sendSubMenu != null) {
            this.sendSubMenu.close();
            this.sendSubMenu.open();
        }
        if(this.cancelSubMenu != null) {
            this.cancelSubMenu.close();
            this.cancelSubMenu.open();
        }
        if(this.sendSubMenu != null) {
            this.sendSubMenu.close();
        }
    }

    onShowPrintersClicked() {
        Util.spawn(['system-config-printer']);
    }

    onShowJobsClicked(item) {
        Util.spawn(['system-config-printer', '--show-jobs', item.label.text]);
    }

    onCancelAllJobsClicked() {
        Util.spawn_async(['python3', APPLET_PATH + '/cancel-print-dialog.py', 'all'], Lang.bind(this, function(out) {
            if(out.trim() == "Cancel") {
                for(var n = 0; n < this.jobs.length; n++) {
                    Util.spawn(['cancel', this.jobs[n].job]);
                }
            }
        }));
    }

    onCancelJobClicked(item) {
        Util.spawn_async(['python3', APPLET_PATH + '/cancel-print-dialog.py'], Lang.bind(this, function(out) {
            if(out.trim() == "Cancel") {
                Util.spawn(['cancel', item.job]);
            }
        }));
    }

    onSendToFrontClicked(item) {
        Util.spawn(['lp', '-i', item.job, '-q 100']);
    }

    update() {
        if(this.updating || this.menu.isOpen) return;
        this.updating = true;
        this.jobsCount = 0;
        this.printersCount = 0;
        this.menu.removeAll();
        let printers = new PopupMenu.PopupIconMenuItem(_("Printers"), 'xsi-printer', St.IconType.SYMBOLIC);
        printers.connect('activate', Lang.bind(this, this.onShowPrintersClicked));
        this.menu.addMenuItem(printers);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);

        //Add Printers
        Util.spawn_async(['python3', APPLET_PATH + '/lpstat-a.py'], Lang.bind(this, function(out) {
            this.printers = [];
            Util.spawn_async(['/usr/bin/lpstat', '-d'], Lang.bind(this, function(out2) {//To check default printer
                if(out2.split(': ')[1] != undefined) {
                    out2 = out2.split(': ')[1].trim();
                } else {
                    out2 = 'no default';
                }
                out = out.split('\n');
                if(out.includes('No printers available!')) {
                    out = []
                }
                this.printersCount = out.length - 2;
                for(var n = 0; n < this.printersCount; n++) {
                    let printer = out[n].split(' ')[0].trim();
                    this.printers.push(printer);
                    let printerItem = new PopupMenu.PopupIconMenuItem(printer, 'xsi-emblem-documents', St.IconType.SYMBOLIC);
                    if(out2.toString() == printer.toString()) {
                        printerItem.addActor(new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'xsi-emblem-default', icon_type: St.IconType.SYMBOLIC }));
                    }
                    printerItem.connect('activate', Lang.bind(printerItem, this.onShowJobsClicked));
                    this.menu.addMenuItem(printerItem);
                }
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);

                //Add Jobs
                Util.spawn_async(['/usr/bin/lpstat', '-o'], Lang.bind(this, function(out) {
                    this.jobs = [];
                    //Cancel all Jobs
                    if(out.length > 0) {
                        let cancelAll = new PopupMenu.PopupIconMenuItem(_("Cancel all jobs"), 'xsi-edit-delete', St.IconType.SYMBOLIC);
                        cancelAll.connect('activate', Lang.bind(this, this.onCancelAllJobsClicked));
                        this.menu.addMenuItem(cancelAll);

                        let _cancelSubMenu = new PopupMenu.PopupSubMenuMenuItem(null);
                        _cancelSubMenu.actor.set_style_class_name('');
                        this.cancelSubMenu = _cancelSubMenu.menu;
                        this.menu.addMenuItem(_cancelSubMenu);
                    }
                    //Cancel Job
                    out = out.split(/\n/);
                    this.jobsCount = out.length - 1;
                    Util.spawn_async(['/usr/bin/lpq', '-a'], Lang.bind(this, function(out2) {
                        out2 = out2.replace(/\n/g, ' ').split(/\s+/);
                        let sendJobs = [];
                        for(var n = 0; n < out.length - 1; n++) {
                            let line = out[n].split(' ')[0].split('-');
                            let job = line.slice(-1)[0];
                            let printer = line.slice(0, -1).join('-');
                            let doc = out2[out2.indexOf(job) + 1];
                            let user = out2[out2.indexOf(job) - 1];
                            let size = formatBytes(out2[out2.indexOf(job) + 2]);
                            if(doc.length > 30) {
                                doc = doc + '...';
                            }
                            out2[out2.indexOf(job) + 1] = "used";
                            out2[out2.indexOf(job) + 2] = "used";
                            
                            let text = '(' + job + ') ' + _("'%s' on %s").format(doc, printer);
                            text = text + ' (' + size + ')' + _(" - by %s").format(user);
                            let jobItem = new PopupMenu.PopupIconMenuItem(text, 'xsi-edit-delete', St.IconType.SYMBOLIC);
                            if(out2[out2.indexOf(job) - 2] == 'active') {
                                jobItem.addActor(new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'xsi-printer-printing', icon_type: St.IconType.SYMBOLIC }));
                            } else {
                                jobItem.addActor(new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'xsi-time', icon_type: St.IconType.SYMBOLIC }));
                            }
                            jobItem.job = job;
                            jobItem.connect('activate', Lang.bind(jobItem, this.onCancelJobClicked));
                            this.cancelSubMenu.addMenuItem(jobItem);
                            this.jobs.push(jobItem);
                            if(out2[out2.indexOf(job) - 2] != 'active' && out2[out2.indexOf(job) - 2] != '1st') {
                                sendJobs.push(new PopupMenu.PopupIconMenuItem(text, 'xsi-go-up', St.IconType.SYMBOLIC));
                                sendJobs[sendJobs.length - 1].job = job;
                                sendJobs[sendJobs.length - 1].connect('activate', Lang.bind(sendJobs[sendJobs.length - 1], this.onSendToFrontClicked));
                            }
                        }

                        //Send to Front
                        if(sendJobs.length > 0) {
                            let _sendSubMenu = new PopupMenu.PopupSubMenuMenuItem(_("Send to front"));
                            this.sendSubMenu =_sendSubMenu.menu;
                            for(var i = 0; i < sendJobs.length; i++) {
                                this.sendSubMenu.addMenuItem(sendJobs[i]);
                            }
                            this.menu.addMenuItem(_sendSubMenu);
                        }
                        this.updating = false;
                        if(this.cancelSubMenu != null) {
                            this.cancelSubMenu.open();
                        }
                        if(this.showLater) {
                            this.showLater = false;
                            this.menu.open();
                        }

                        //Update Icon
                        if(this.jobsCount > 0) {
                            this.set_applet_label(this.jobsCount.toString());
                        } else {
                            this.set_applet_label('');
                        }
                        if(this.show_icon == 'always' || (this.show_icon == 'printers' && this.printersCount > 0) || (this.show_icon == 'jobs' && this.jobsCount > 0) || global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
                            this.actor.show();
                        } else {
                            this.actor.hide();
                        }
                        Util.spawn_async(['/usr/bin/lpstat', '-l'], Lang.bind(this, function(out) {
                            if(out != '') {
                                let printStatus = out.split('\n')[1].trim();
                                this.set_applet_tooltip(printStatus);
                            } else {
                                this.set_applet_tooltip(_("Printers"));
                            }
                            if(this.printWarning) {
                                this.set_applet_icon_symbolic_name('xsi-printer-warning');
                            } else if(this.jobsCount > 0) {
                                this.set_applet_icon_symbolic_name('xsi-printer-printing');
                            } else {
                                this.set_applet_icon_symbolic_name('xsi-printer');
                            }
                        }));
                    }))
                }))
            }))
        }))
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonPrintersApplet(metadata, orientation, panel_height, instance_id);
}
