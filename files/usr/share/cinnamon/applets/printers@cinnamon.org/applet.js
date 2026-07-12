const Applet = imports.ui.applet;
const CinnamonDesktop = imports.gi.CinnamonDesktop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const PRINTER_STATE_STOPPED = 5;

const JOB_STATE_PROCESSING = 5;
const JOB_STATE_CANCELED = 7;

// Maps IPP printer-state-reasons keywords to human-readable strings.
// Reasons use suffixes: -warning (needs attention), -report (informational),
// -error (critical). We strip the suffix for lookup.
const STATE_REASON_WARNINGS = {
    "media-empty": _("Out of paper"),
    "media-needed": _("Out of paper"),
    "media-jam": _("Paper jam"),
    "media-low": _("Low on paper"),
    "toner-empty": _("Out of toner or ink"),
    "toner-low": _("Low toner or ink"),
    "marker-supply-empty": _("Out of toner or ink"),
    "marker-supply-low": _("Low toner or ink"),
    "marker-supply-missing": _("Ink cartridge missing"),
    "cover-open": _("Cover open"),
    "door-open": _("Cover open"),
    "offline": _("Offline"),
    "connecting-to-device": _("Connecting..."),
    "cups-missing-filter": _("Missing print filter"),
    "paused": _("Paused"),
    "other": _("Printer error"),
};

function getPrinterWarning(stateReasons) {
    if (!stateReasons || stateReasons === "none")
        return null;

    const reasons = stateReasons.split(',');
    for (const reason of reasons) {
        const trimmed = reason.trim();
        if (trimmed === "none")
            continue;

        const suffixMatch = trimmed.match(/-(warning|error|report)$/);
        const base = suffixMatch ? trimmed.slice(0, -suffixMatch[0].length) : trimmed;
        const suffix = suffixMatch ? suffixMatch[1] : 'warning';
        const message = STATE_REASON_WARNINGS[base];

        if (message) {
            const icon = suffix === 'error' ? 'xsi-printer-error' : 'xsi-printer-warning';
            return { message, icon };
        }
    }

    return null;
}

// [icon | label ... | detail | button/blank icon | button/blank icon]
class PrinterMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(label, iconName, params) {
        super(params);

        this._table = new St.Table({ homogeneous: false, style_class: 'popup-printer-menu-item' });
        this.addActor(this._table, { span: -1, expand: true });

        this._icon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: iconName, icon_type: St.IconType.SYMBOLIC });
        this._table.add(this._icon, { row: 0, col: 0, x_fill: false, x_expand: false });

        this.label = new St.Label({ text: label });
        this._table.add(this.label, { row: 0, col: 1, x_fill: true, x_expand: true, x_align: St.Align.START });

        this._detail = new St.Label({ style_class: 'popup-inactive-menu-item' });
        this._table.add(this._detail, { row: 0, col: 2, x_fill: false, x_expand: false, x_align: St.Align.END });

        this._button1 = null;
        this._button2 = null;
    }

    setDetail(text) {
        this._detail.set_text(text);
    }

    setButton(slot, iconName, tooltip, callback) {
        let col = slot === 0 ? 3 : 4;
        let existing = slot === 0 ? this._button1 : this._button2;
        if (existing)
            existing.destroy();

        let widget;
        if (iconName) {
            let icon = new St.Icon({
                style_class: 'popup-menu-icon',
                icon_name: iconName,
                icon_type: St.IconType.SYMBOLIC
            });
            widget = new St.Button({ child: icon });
            if (tooltip)
                new Tooltips.Tooltip(widget, tooltip);
            widget.connect('clicked', callback);
        } else {
            widget = new St.Icon({
                style_class: 'popup-menu-icon',
                icon_name: 'xsi-empty-icon-symbolic',
                icon_type: St.IconType.SYMBOLIC
            });
        }

        this._table.add(widget, { row: 0, col: col, x_fill: false, x_expand: false });

        if (slot === 0)
            this._button1 = widget;
        else
            this._button2 = widget;
    }
}

class Printer {
    constructor(name, uri, state, stateReasons, accepting) {
        this.displayName = name.replaceAll('_', ' ');
        this.uri = uri;
        this.state = state;
        this.stateReasons = stateReasons;
        this.accepting = accepting;
        this.jobs = new Map();
    }
}

class CinnamonPrintersApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_tooltip(_("Printers"));
        this.set_applet_icon_symbolic_name('xsi-printer');

        let printersContextItem = new PopupMenu.PopupIconMenuItem(_("Printers"), 'xsi-printer', St.IconType.SYMBOLIC);
        printersContextItem.connect('activate', () => Util.spawn(['system-config-printer']));
        this._applet_context_menu.addMenuItem(printersContextItem);

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.connect('open-state-changed', (menu, open) => {
            if (!open && this._menuDirty) {
                this._menuDirty = false;
                this._scheduleMenuRebuild();
            }
        });
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind('show-icon', 'show_icon', this._updateVisibility.bind(this));

        this.signalManager = new SignalManager.SignalManager(null);
        this.signalManager.connect(global.settings, `changed::${PANEL_EDIT_MODE_KEY}`, this._updateVisibility, this);

        this._printers = new Map();
        this._hasPrinterConfig = false;
        this._cupsSubscription = null;
        this._rebuildId = 0;
        this._menuDirty = false;

        this._wallClock = new CinnamonDesktop.WallClock();

        this._cancellable = new Gio.Cancellable();
        Gio.DBus.session.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus',
            'org.freedesktop.DBus', 'ListActivatableNames',
            null, null, Gio.DBusCallFlags.NONE, -1, this._cancellable,
            (bus, result) => {
                try {
                    const [names] = bus.call_finish(result).deep_unpack();
                    this._hasPrinterConfig = names.includes('org.fedoraproject.Config.Printing');
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        return;
                }

                this._cupsSubscription = Gio.DBus.system.signal_subscribe(
                    null, 'org.cups.cupsd.Notifier', null,
                    '/org/cups/cupsd/Notifier', null,
                    Gio.DBusSignalFlags.NONE,
                    this._onCupsSignal.bind(this)
                );

                this._bootstrapPrinters();
            }
        );
    }

    on_applet_clicked() {
        if (!this.menu.isOpen) {
            if (this._rebuildId) {
                GLib.source_remove(this._rebuildId);
                this._rebuildId = 0;
            }
            this._menuDirty = false;
            this._rebuildMenu();
        }
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        if (this._cupsSubscription != null) {
            Gio.DBus.system.signal_unsubscribe(this._cupsSubscription);
            this._cupsSubscription = null;
        }
        if (this._rebuildId) {
            GLib.source_remove(this._rebuildId);
            this._rebuildId = 0;
        }
        this.signalManager.disconnectAllSignals();
        this._wallClock = null;
        this.settings.finalize();
    }

    _getOrCreatePrinter(name) {
        let printer = this._printers.get(name);
        if (!printer) {
            printer = new Printer(name, '', 0, 'none', true);
            this._printers.set(name, printer);
        }
        return printer;
    }

    _getJobCount() {
        let count = 0;
        for (const [, printer] of this._printers)
            count += printer.jobs.size;
        return count;
    }

    _bootstrapPrinters() {
        try {
            Util.spawn_async(['/usr/bin/lpstat', '-e'], (out) => {
                if (!out || !this._cancellable || this._cancellable.is_cancelled())
                    return;

                for (const name of out.trim().split('\n')) {
                    if (name.trim())
                        this._getOrCreatePrinter(name.trim());
                }

                this._updateApplet();
            });
        } catch (e) {
            global.logWarning(`printers@cinnamon.org: could not list printers: ${e.message}`);
        }
    }

    _onCupsSignal(connection, sender, path, iface, signalName, params) {
        let changed = false;
        let values;

        try {
            values = params.deep_unpack();
        } catch (e) {
            global.logError(`printers@cinnamon.org: failed to unpack signal '${signalName}': ${e}`);
            return;
        }
        // global.log(`printers@cinnamon: signal=${signalName} text="${values[0]}"`);

        switch (signalName) {
            case 'PrinterAdded':
            case 'PrinterModified':
            case 'PrinterRestarted':
            case 'PrinterStopped':
            case 'PrinterShutdown':
            case 'PrinterStateChanged':
            case 'PrinterFinishingsChanged':
            case 'PrinterMediaChanged':
                changed = this._onPrinterUpdate(values);
                break;
            case 'PrinterDeleted':
                changed = this._onPrinterDeleted(values);
                break;
            case 'JobCreated':
            case 'JobState':
            case 'JobConfigChanged':
            case 'JobProgress':
                changed = this._onJobUpdate(values);
                break;
            case 'JobCompleted':
            case 'JobStopped':
                changed = this._onJobRemoved(values);
                break;
            case 'ServerStarted':
            case 'ServerRestarted':
                this._printers.clear();
                this._bootstrapPrinters();
                changed = true;
                break;
            case 'ServerStopped':
                this._printers.clear();
                changed = true;
                break;
        }

        if (changed) {
            // global.log(`printers@cinnamon: updating applet (${signalName})`);
            this._updateApplet();
        }
    }

    _onPrinterUpdate(values) {
        const [text, uri, name, state, stateReasons, accepting] = values;
        if (!name)
            return false;

        const printer = this._getOrCreatePrinter(name);
        return this._updatePrinterState(printer, uri, state, stateReasons, accepting);
    }

    _onPrinterDeleted(values) {
        const [text, uri, name] = values;
        return this._printers.delete(name);
    }

    _updatePrinterState(printer, printerUri, printerState, printerStateReasons, accepting) {
        if (printer.state === printerState && printer.stateReasons === printerStateReasons && printer.accepting === accepting)
            return false;

        printer.uri = printerUri || printer.uri;
        printer.state = printerState;
        printer.stateReasons = printerStateReasons;
        printer.accepting = accepting;
        return true;
    }

    _onJobUpdate(values) {
        const [text, printerUri, printerName, printerState, printerStateReasons, accepting,
               jobId, jobState, jobStateReasons, jobName, impressions] = values;

        if (!printerName)
            return false;

        let changed = false;
        const printer = this._getOrCreatePrinter(printerName);

        if (this._updatePrinterState(printer, printerUri, printerState, printerStateReasons, accepting))
            changed = true;

        if (jobState >= JOB_STATE_CANCELED) {
            if (printer.jobs.delete(jobId))
                changed = true;
        } else {
            const existing = printer.jobs.get(jobId);
            if (!existing || existing.state !== jobState || existing.name !== (jobName || "")) {
                printer.jobs.set(jobId, {
                    name: jobName || "",
                    state: jobState,
                    stateReasons: jobStateReasons,
                    impressions,
                    timeCreated: existing ? existing.timeCreated : GLib.DateTime.new_now_local()
                });
                changed = true;
            }
        }

        return changed;
    }

    _onJobRemoved(values) {
        const [text, printerUri, printerName, printerState, printerStateReasons, accepting,
               jobId] = values;

        if (!printerName)
            return false;

        let changed = false;
        const printer = this._printers.get(printerName);

        if (printer) {
            if (this._updatePrinterState(printer, printerUri, printerState, printerStateReasons, accepting))
                changed = true;

            if (printer.jobs.delete(jobId))
                changed = true;
        }

        return changed;
    }

    _updateApplet() {
        const jobCount = this._getJobCount();

        this.set_applet_label(jobCount > 0 ? jobCount.toString() : '');

        let worstWarning = null;
        let hasStopped = false;
        for (const [, printer] of this._printers) {
            const warning = getPrinterWarning(printer.stateReasons);

            if (printer.state === PRINTER_STATE_STOPPED) {
                if (!hasStopped) {
                    const message = warning ? warning.message : _("Stopped");
                    worstWarning = { message: `${printer.displayName}: ${message}`, icon: 'xsi-printer-error' };
                    hasStopped = true;
                }
            } else if (warning && !hasStopped) {
                if (!worstWarning || warning.icon === 'xsi-printer-error')
                    worstWarning = { message: `${printer.displayName}: ${warning.message}`, icon: warning.icon };
            }
        }

        if (worstWarning) {
            this.set_applet_icon_symbolic_name(worstWarning.icon);
        } else if (jobCount > 0) {
            this.set_applet_icon_symbolic_name('xsi-printer-printing');
        } else {
            this.set_applet_icon_symbolic_name('xsi-printer');
        }

        if (worstWarning && worstWarning.message) {
            this.set_applet_tooltip(worstWarning.message);
        } else if (jobCount > 0) {
            this.set_applet_tooltip(ngettext("%d print job", "%d print jobs", jobCount).format(jobCount));
        } else {
            this.set_applet_tooltip(_("Printers"));
        }

        this._scheduleMenuRebuild();
        this._updateVisibility();
    }

    _updateVisibility() {
        const jobCount = this._getJobCount();
        const printerCount = this._printers.size;

        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY) ||
            this.show_icon === 'always' ||
            (this.show_icon === 'printers' && printerCount > 0) ||
            (this.show_icon === 'jobs' && jobCount > 0)) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
    }

    _scheduleMenuRebuild() {
        if (this.menu.isOpen) {
            this._menuDirty = true;
            return;
        }

        if (this._rebuildId)
            return;

        this._rebuildId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._rebuildId = 0;
            if (!this.menu.isOpen) {
                this._rebuildMenu();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _formatTime(dateTime) {
        return dateTime.format(this._wallClock.get_default_time_format());
    }

    _rebuildMenu() {
        this.menu.removeAll();

        if (this._printers.size === 0) {
            let printersItem = new PopupMenu.PopupIconMenuItem(_("Printers"), 'xsi-printer', St.IconType.SYMBOLIC);
            printersItem.connect('activate', () => Util.spawn(['system-config-printer']));
            this.menu.addMenuItem(printersItem);
        }

        let prevHadJobs = false;
        for (const [name, printer] of this._printers) {
            const warning = getPrinterWarning(printer.stateReasons);
            let iconName = 'xsi-emblem-documents';
            if (printer.state === PRINTER_STATE_STOPPED)
                iconName = 'xsi-printer-error';
            else if (warning)
                iconName = warning.icon;

            if (prevHadJobs || printer.jobs.size > 0)
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            prevHadJobs = printer.jobs.size > 0;

            let printerItem = new PrinterMenuItem(printer.displayName, iconName);
            printerItem.setButton(0, null, null, null);
            if (warning || printer.state === PRINTER_STATE_STOPPED || printer.jobs.size > 0)
                printerItem.label.add_style_class_name('popup-device-menu-item');
            printerItem.connect('activate', () => {
                Util.spawn(['system-config-printer', '--show-jobs', name]);
            });

            if (this._hasPrinterConfig) {
                printerItem.setButton(1, 'xsi-emblem-system', _("Show properties"), () => {
                    this.menu.close();
                    Gio.DBus.session.call(
                        'org.fedoraproject.Config.Printing',
                        '/org/fedoraproject/Config/Printing',
                        'org.fedoraproject.Config.Printing',
                        'PrinterPropertiesDialog',
                        new GLib.Variant('(us)', [0, name]),
                        null, Gio.DBusCallFlags.NONE, -1, null, null
                    );
                });
            } else {
                printerItem.setButton(1, null, null, null);
            }

            this.menu.addMenuItem(printerItem);

            if (warning) {
                let warningItem = new PopupMenu.PopupMenuItem(`  ${warning.message}`, { reactive: false });
                warningItem.actor.add_style_class_name('popup-inactive-menu-item');
                this.menu.addMenuItem(warningItem);
            }

            if (printer.jobs.size > 0)
                this._buildJobsSection(printer, name);
        }
    }

    _buildJobsSection(printer, printerName) {
        const printerJobs = [...printer.jobs.entries()];
        const firstJobProcessing = printerJobs[0][1].state === JOB_STATE_PROCESSING;

        for (let i = 0; i < printerJobs.length; i++) {
            const [jobId, job] = printerJobs[i];

            let displayName = job.name || _("Unknown");
            if (displayName.length > 30)
                displayName = displayName.substring(0, 30) + '...';

            let iconName = job.state === JOB_STATE_PROCESSING ? 'xsi-run' : 'xsi-empty-icon-symbolic';
            let item = new PrinterMenuItem(displayName, iconName, { activate: false });
            item.setDetail(this._formatTime(job.timeCreated));

            // send to front (queued jobs only, not first in queue when active)
            if (i > 0 && !(i === 1 && firstJobProcessing)) {
                let fullJobId = `${printerName}-${jobId}`;
                item.setButton(0, 'xsi-go-up', _("Send to the front"), () => {
                    this.menu.close();
                    Util.spawn(['lp', '-i', fullJobId, '-q', '100']);

                    const entries = [...printer.jobs.entries()];
                    const idx = entries.findIndex(([id]) => id === jobId);
                    if (idx < 0)
                        return;

                    let targetIdx = 0;
                    if (entries[0][1].state === JOB_STATE_PROCESSING)
                        targetIdx = 1;

                    if (idx > targetIdx) {
                        const [entry] = entries.splice(idx, 1);
                        entries.splice(targetIdx, 0, entry);
                        printer.jobs = new Map(entries);
                    }
                });
            } else {
                item.setButton(0, null, null, null);
            }

            item.setButton(1, 'xsi-edit-delete', _("Cancel job"), () => {
                this.menu.close();
                this._onCancelJob(jobId, displayName);
            });

            this.menu.addMenuItem(item);
        }

        if (printerJobs.length > 1) {
            const jobIds = printerJobs.map(([jobId]) => jobId);
            let cancelAll = new PrinterMenuItem(_("Cancel all jobs"), 'xsi-empty-icon-symbolic');
            cancelAll.setButton(0, null, null, null);
            cancelAll.setButton(1, 'xsi-edit-delete', null, () => {
                this.menu.close();
                this._onCancelAllJobs(jobIds);
            });
            cancelAll.connect('activate', () => this._onCancelAllJobs(jobIds));
            this.menu.addMenuItem(cancelAll);
        }
    }

    _onCancelJob(jobId, jobName) {
        let text = _("Do you want to cancel printing of '%s'?").format(jobName);
        new ModalDialog.ConfirmDialog(text, () => {
            Util.spawn(['cancel', jobId.toString()]);
        }).open();
    }

    _onCancelAllJobs(jobIds) {
        let text = _("Do you really want to cancel all jobs?");
        new ModalDialog.ConfirmDialog(text, () => {
            for (const jobId of jobIds) {
                Util.spawn(['cancel', jobId.toString()]);
            }
        }).open();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonPrintersApplet(metadata, orientation, panel_height, instance_id);
}
