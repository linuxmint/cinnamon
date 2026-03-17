const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Util = imports.misc.util;


const PANEL_EDIT_MODE_KEY = "panel-edit-mode";
const APPLET_PATH = imports.ui.appletManager.appletMeta['printers@cinnamon.org'].path;



class CinnamonPrintersApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._cupsSignal = Gio.DBus.system.signal_subscribe(null, 'org.cups.cupsd.Notifier', null, '/org/cups/cupsd/Notifier', null, Gio.DBusSignalFlags.NONE, this.onCupsSignal.bind(this));

        this.set_applet_tooltip(_("Printers"));

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.connect('open-state-changed', () => this.onMenuOpened());

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind('show-icon', 'show_icon', this.update);

        this.panelEditModeHandler = global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, () => this._on_panel_edit_mode_changed());

        this.printWarning = false;
        this.updating = false;
        this.removed = false;
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
        this.removed = true;
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
        Mainloop.timeout_add_seconds(3, () => this.warningTimeout());
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
        let text = _("Do you really want to cancel all print jobs?");
        new ModalDialog.ConfirmDialog(text, () => {
            for(var n = 0; n < this.jobs.length; n++) {
                Util.spawn(['cancel', this.jobs[n].job]);
            }
        }).open();
    }

    onCancelJobClicked(item) {
        // Translators: string is the print job title or the job id
        let text = _("Do you want to cancel printing of '%s'?").format((item.doc && item.doc != "unknown")? item.doc : item.job.toString());
        new ModalDialog.ConfirmDialog(text, () => {
            Util.spawn(['cancel', item.job]);
        }).open();
    }

    onSendToFrontClicked(item) {
        Util.spawn(['lp', '-i', item.job, '-H', 'immediate']);
    }

    parseLpq(lpq_output) {
        var parsedData = {};
        lpq_output = lpq_output.split("\n");
        let line = [];
        let joined_line = [];

        for(var n = 0; n < lpq_output.length - 1; n++) {
            line = lpq_output[n].split(/\s+/);
            if (line.length < 5) continue;
            joined_line = [];
            joined_line.push(line[0]);
            joined_line.push(line[1]);
            joined_line.push(line.slice(3, -2).join(' '));
            joined_line.push(line[line.length-2]);
            parsedData[line[2]] = joined_line;
        }

        return parsedData;
    }

    handleError(message) {
        if(message.length>70) {
            message = message.slice(0, 70) + "...";
        }
        Mainloop.timeout_add_seconds(10, () => this.update());
        this.set_applet_label('');
        if(this.show_icon == 'always' || global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
            this.set_applet_tooltip(message.trim());
            this.set_applet_icon_symbolic_name('xsi-printer-error');
        } else {
            this.actor.hide();
        }
        this.menu.removeAll();
        let printers = new PopupMenu.PopupIconMenuItem(_("Printers"), 'xsi-printer', St.IconType.SYMBOLIC);
        printers.connect('activate', () => this.onShowPrintersClicked());
        this.menu.addMenuItem(printers);
    }

    update() {
        if(this.updating || this.menu.isOpen || this.removed) return;
        this.updating = true;
        this.menu.removeAll();
        let printers = new PopupMenu.PopupIconMenuItem(_("Printers"), 'xsi-printer', St.IconType.SYMBOLIC);
        printers.connect('activate', () => this.onShowPrintersClicked());
        this.menu.addMenuItem(printers);

        this.out1 = [];
        this.out2 = "";
        this.out3 = [];

        //Get available printers
        Util.spawnCommandLineAsyncIO('/usr/bin/lpstat -a', (stdout, stderr, exitCode) => {
            if(exitCode) {
                this.handleError(stderr);
                this.updating = false;
                return;
            }
            if(stdout.trim()) {
                this.out1 = stdout.trim().split('\n');
            }

            //Check default printer and add printers
            Util.spawnCommandLineAsyncIO('/usr/bin/lpstat -d', (stdout, stderr, exitCode) => {
                if(exitCode) {
                    this.handleError(stderr);
                    this.updating = false;
                    return;
                }
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);

                if(stdout.trim().split(': ')[1] != undefined) {
                    this.out2 = stdout.split(': ')[1].trim();
                } else {
                    this.out2 = 'no default';
                }
                
                this.printers = [];
                for(var n = 0; n < this.out1.length; n++) {
                    let printer = this.out1[n].split(' ')[0].trim();
                    this.printers.push(printer);
                    let printerItem = new PopupMenu.PopupIconMenuItem(printer, 'xsi-emblem-documents', St.IconType.SYMBOLIC);
                    if(this.out2.toString() == printer.toString()) {
                        printerItem.addActor(new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'xsi-emblem-default', icon_type: St.IconType.SYMBOLIC }));
                    }
                    printerItem.connect('activate', () => this.onShowJobsClicked(printerItem));
                    this.menu.addMenuItem(printerItem);
                }
                
                
                //Get job-list
                Util.spawnCommandLineAsyncIO('/usr/bin/lpstat -o', (stdout, stderr, exitCode) => {
                    if(exitCode) {
                        this.handleError(stderr);
                        this.updating = false;
                        return;
                    }

                    //Add cancel-all-action
                    if(stdout.trim() != "") {
                        this.out3 = stdout.trim().split("\n");
                        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
                        let cancelAll = new PopupMenu.PopupIconMenuItem(_("Cancel all jobs"), 'xsi-edit-delete', St.IconType.SYMBOLIC);
                        cancelAll.connect('activate', () => this.onCancelAllJobsClicked());
                        this.menu.addMenuItem(cancelAll);
                        
                        let _cancelSubMenu = new PopupMenu.PopupSubMenuMenuItem(null);
                        _cancelSubMenu.actor.set_style_class_name('');
                        this.cancelSubMenu = _cancelSubMenu.menu;
                        this.menu.addMenuItem(_cancelSubMenu);
                    }
                    
                    
                    //Get job-details
                    Util.spawnCommandLineAsyncIO('/usr/bin/lpq -a', (stdout, stderr, exitCode) => {
                        let lpq_present = false;
                        let jobInfo = [];
                        if(!exitCode) {
                            lpq_present = true;
                            jobInfo = this.parseLpq(stdout);
                        }

                        let sendJobs = [];
                        this.jobs = [];
                        for(var n = 0; n < this.out3.length; n++) {
                            let line = this.out3[n].split(' ')[0].split('-');
                            let job = line.slice(-1)[0];
                            let user = this.out3[n].split(' ')[1];
                            let printer = line.slice(0, -1).join('-');
                            let doc = "unknown";
                            let size = "unknown";
                            if (lpq_present) {
                                doc = jobInfo[job][2];
                                size = GLib.format_size(jobInfo[job][3]);
                            }
                            
                            if(doc.length > 28) {
                                doc = doc.slice(0, 28) + '...';
                            }
                            
                            // Translators: strings are job number, document name, printer name, size, username
                            // example: (23) 'README.md' on HP_Stupid_Tank_5100_series (44.0 KB) - by kevin
                            let text = _("(%s) '%s' on %s (%s) - by %s").format(job, doc, printer, size, user);
                            let jobItem = new PopupMenu.PopupIconMenuItem(text, 'xsi-edit-delete', St.IconType.SYMBOLIC);
                            if(lpq_present && jobInfo[job][0] == 'active') {
                                jobItem.addActor(new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'xsi-printer-printing', icon_type: St.IconType.SYMBOLIC }));
                            } else if (lpq_present) {
                                jobItem.addActor(new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'xsi-time', icon_type: St.IconType.SYMBOLIC }));
                            }
                            jobItem.job = job;
                            jobItem.doc = doc;
                            jobItem.connect('activate', () => this.onCancelJobClicked(jobItem));
                            this.cancelSubMenu.addMenuItem(jobItem);
                            this.jobs.push(jobItem);
                            if(lpq_present && jobInfo[job][0] != 'active' && jobInfo[job][0] != '1st') {
                                let item = new PopupMenu.PopupIconMenuItem(text, 'xsi-go-up', St.IconType.SYMBOLIC);
                                item.job = job;
                                item.connect('activate', () => this.onSendToFrontClicked(item));
                                sendJobs.push(item);
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
                        
                        if(this.cancelSubMenu != null) {
                            this.cancelSubMenu.open();
                        }
                        if(this.showLater) {
                            this.showLater = false;
                            this.menu.open();
                        }

                        //Update icon
                        Util.spawnCommandLineAsyncIO('/usr/bin/lpstat -l', (stdout, stderr, exitCode) => {
                            if(exitCode) {
                                if(stderr.length>70) {
                                    stderr = stderr.slice(0, 70) + "...";
                                }
                                this.set_applet_tooltip(stderr.trim());
                                return;
                            }

                            if(stdout.trim()) {
                                this.set_applet_tooltip(stdout.trim().split('\n')[1].trim());
                            } else {
                                this.set_applet_tooltip(_("Printers"));
                            }
                            if(this.printWarning) {
                                this.set_applet_icon_symbolic_name('xsi-printer-warning');
                            } else if(this.jobs.length > 0) {
                                this.set_applet_icon_symbolic_name('xsi-printer-printing');
                            } else {
                                this.set_applet_icon_symbolic_name('xsi-printer');
                            }
                        });
                        
                        //Update job count
                        if(this.jobs.length > 0) {
                            this.set_applet_label(this.jobs.length.toString());
                        } else {
                            this.set_applet_label('');
                        }
                        if(this.show_icon == 'always' || (this.show_icon == 'printers' && this.printers.length > 0) || (this.show_icon == 'jobs' && this.jobs.length > 0) || global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
                            this.actor.show();
                        } else {
                            this.actor.hide();
                        }
                        this.updating = false;
                    });
                });
            });
        });
    }
}


function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonPrintersApplet(metadata, orientation, panel_height, instance_id);
}
