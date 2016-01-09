// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;
const Params = imports.misc.params;

const LIST_ITEM_ICON_SIZE = 48;

/* ------ Common Utils ------- */
function _setLabelText(label, text) {
    if (text) {
        label.set_text(text);
        label.show();
    } else {
        label.set_text('');
        label.hide();
    }
}

function _setButtonsForChoices(dialog, choices) {
    let buttons = [];

    for (let idx = 0; idx < choices.length; idx++) {
        let button = idx;
        buttons.unshift({ label: choices[idx],
                          action: Lang.bind(dialog, function() {
                              dialog.emit('response', button);
                          })});
    }

    dialog.setButtons(buttons);
}

function _setLabelsForMessage(dialog, message) {
    let labels = message.split('\n');

    _setLabelText(dialog.subjectLabel, labels[0]);
    if (labels.length > 1)
        _setLabelText(dialog.descriptionLabel, labels[1]);
}

/* -------------------------------------------------------- */

function ListItem(app) {
    this._init(app);
}

ListItem.prototype = {
    _init: function(app) {
        this._app = app;

        let layout = new St.BoxLayout({ vertical: false});

        this.actor = new St.Button({ style_class: 'show-processes-dialog-app-list-item',
                                     can_focus: true,
                                     child: layout,
                                     reactive: true,
                                     x_align: St.Align.START,
                                     x_fill: true });

        this._icon = this._app.create_icon_texture(LIST_ITEM_ICON_SIZE);

        let iconBin = new St.Bin({ style_class: 'show-processes-dialog-app-list-item-icon',
                                   child: this._icon });
        layout.add(iconBin);

        this._nameLabel = new St.Label({ text: this._app.get_name(),
                                         style_class: 'show-processes-dialog-app-list-item-name' });
        let labelBin = new St.Bin({ y_align: St.Align.MIDDLE,
                                    child: this._nameLabel });
        layout.add(labelBin);

        this.actor.connect('clicked', Lang.bind(this, this._onClicked));
    },

    _onClicked: function() {
        this.emit('activate');
        this._app.activate();
    }
};
Signals.addSignalMethods(ListItem.prototype);

function CinnamonMountOperation(source, params) {
    this._init(source, params);
}

CinnamonMountOperation.prototype = {
    _init: function(source, params) {
        params = Params.parse(params, { reaskPassword: false });

        this._reaskPassword = params.reaskPassword;

        this._dialog = null;
        this._processesDialog = null;

        this.mountOp = new Cinnamon.MountOperation();

        this.mountOp.connect('ask-question',
                             Lang.bind(this, this._onAskQuestion));
        this.mountOp.connect('ask-password',
                             Lang.bind(this, this._onAskPassword));
        this.mountOp.connect('show-processes-2',
                             Lang.bind(this, this._onShowProcesses2));
        this.mountOp.connect('aborted',
                             Lang.bind(this, this._onAborted));

        this._icon = new St.Icon({ gicon: source.get_icon(),
                                   style_class: 'cinnamon-mount-operation-icon' });
    },

    _onAskQuestion: function(op, message, choices) {
        this._dialog = new CinnamonMountQuestionDialog(this._icon);

        this._dialog.connect('response',
                               Lang.bind(this, function(object, choice) {
                                   this.mountOp.set_choice(choice);
                                   this.mountOp.reply(Gio.MountOperationResult.HANDLED);

                                   this._dialog.close(global.get_current_time());
                                   this._dialog = null;
                               }));

        this._dialog.update(message, choices);
        this._dialog.open(global.get_current_time());
    },

    _onAskPassword: function(op, message) {
        this._notificationShowing = true;
        this._source = new CinnamonMountPasswordSource(message, this._icon, this._reaskPassword);

        this._source.connect('password-ready',
                             Lang.bind(this, function(source, password) {
                                 this.mountOp.set_password(password);
                                 this.mountOp.reply(Gio.MountOperationResult.HANDLED);

                                 this._notificationShowing = false;
                                 this._source.destroy();
                             }));

        this._source.connect('destroy',
                             Lang.bind(this, function() {
                                 if (!this._notificationShowing)
                                     return;

                                 this._notificationShowing = false;
                                 this.mountOp.reply(Gio.MountOperationResult.ABORTED);
                             }));
    },

    _onAborted: function(op) {
        if (!this._dialog)
            return;

        this._dialog.close(global.get_current_time());
        this._dialog = null;
    },

    _onShowProcesses2: function(op) {
        let processes = op.get_show_processes_pids();
        let choices = op.get_show_processes_choices();
        let message = op.get_show_processes_message();

        if (!this._processesDialog) {
            this._processesDialog = new CinnamonProcessesDialog(this._icon);
            this._dialog = this._processesDialog;

            this._processesDialog.connect('response', 
                                          Lang.bind(this, function(object, choice) {
                                              if (choice == -1) {
                                                  this.mountOp.reply(Gio.MountOperationResult.ABORTED);
                                              } else {
                                                  this.mountOp.set_choice(choice);
                                                  this.mountOp.reply(Gio.MountOperationResult.HANDLED);
                                              }

                                              this._processesDialog.close(global.get_current_time());
                                              this._dialog = null;
                                          }));
            this._processesDialog.open(global.get_current_time());
        }

        this._processesDialog.update(message, processes, choices);
    },
}

function CinnamonMountQuestionDialog(icon) {
    this._init(icon);
}

CinnamonMountQuestionDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(icon) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'mount-question-dialog' });

        let mainContentLayout = new St.BoxLayout();
        this.contentLayout.add(mainContentLayout, { x_fill: true,
                                                    y_fill: false });

        this._iconBin = new St.Bin({ child: icon });
        mainContentLayout.add(this._iconBin,
                              { x_fill:  true,
                                y_fill:  false,
                                x_align: St.Align.END,
                                y_align: St.Align.MIDDLE });

        let messageLayout = new St.BoxLayout({ vertical: true });
        mainContentLayout.add(messageLayout,
                              { y_align: St.Align.START });

        this.subjectLabel = new St.Label({ style_class: 'mount-question-dialog-subject' });

        messageLayout.add(this.subjectLabel,
                          { y_fill:  false,
                            y_align: St.Align.START });

        this.descriptionLabel = new St.Label({ style_class: 'mount-question-dialog-description' });
        this.descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.descriptionLabel.clutter_text.line_wrap = true;

        messageLayout.add(this.descriptionLabel,
                          { y_fill:  true,
                            y_align: St.Align.START });
    },

    update: function(message, choices) {
        _setLabelsForMessage(this, message);
        _setButtonsForChoices(this, choices);
    }
}
Signals.addSignalMethods(CinnamonMountQuestionDialog.prototype);

function CinnamonMountPasswordSource(message, icon, reaskPassword) {
    this._init(message, icon, reaskPassword);
}

CinnamonMountPasswordSource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function(message, icon, reaskPassword) {
        let strings = message.split('\n');
        MessageTray.Source.prototype._init.call(this, strings[0]);

        this._notification = new CinnamonMountPasswordNotification(this, strings, icon, reaskPassword);

        // add ourselves as a source, and popup the notification
        if (Main.messageTray) Main.messageTray.add(this);
        this.notify(this._notification);
    },
}
Signals.addSignalMethods(CinnamonMountPasswordSource.prototype);

function CinnamonMountPasswordNotification(source, strings, icon, reaskPassword) {
    this._init(source, strings, icon, reaskPassword);
}

CinnamonMountPasswordNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, strings, icon, reaskPassword) {
        MessageTray.Notification.prototype._init.call(this, source,
                                                      strings[0], null,
                                                      { customContent: true,
                                                        icon: icon });

        // set the notification to transient and urgent, so that it
        // expands out
        this.setTransient(true);
        this.setUrgency(MessageTray.Urgency.CRITICAL);

        if (strings[1])
            this.addBody(strings[1]);

        if (reaskPassword) {
            let label = new St.Label({ style_class: 'mount-password-reask',
                                       text: _("Wrong password, please try again") });

            this.addActor(label);
        }

        this._responseEntry = new St.Entry({ style_class: 'mount-password-entry',
                                             can_focus: true });
        this.setActionArea(this._responseEntry);

        this._responseEntry.clutter_text.connect('activate',
                                                 Lang.bind(this, this._onEntryActivated));
        this._responseEntry.clutter_text.set_password_char('\u25cf'); // U+25CF is the unicode BLACK CIRCLE

        this._responseEntry.grab_key_focus();
    },

    _onEntryActivated: function() {
        let text = this._responseEntry.get_text();
        if (text == '')
            return;

        this.source.emit('password-ready', text);
    }
}

function CinnamonProcessesDialog(icon) {
    this._init(icon);
}

CinnamonProcessesDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(icon) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'show-processes-dialog' });

        let mainContentLayout = new St.BoxLayout();
        this.contentLayout.add(mainContentLayout, { x_fill: true,
                                                    y_fill: false });

        this._iconBin = new St.Bin({ child: icon });
        mainContentLayout.add(this._iconBin,
                              { x_fill:  true,
                                y_fill:  false,
                                x_align: St.Align.END,
                                y_align: St.Align.MIDDLE });

        let messageLayout = new St.BoxLayout({ vertical: true });
        mainContentLayout.add(messageLayout,
                              { y_align: St.Align.START });

        this.subjectLabel = new St.Label({ style_class: 'show-processes-dialog-subject' });

        messageLayout.add(this.subjectLabel,
                          { y_fill:  false,
                            y_align: St.Align.START });

        this.descriptionLabel = new St.Label({ style_class: 'show-processes-dialog-description' });
        this.descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.descriptionLabel.clutter_text.line_wrap = true;

        messageLayout.add(this.descriptionLabel,
                          { y_fill:  true,
                            y_align: St.Align.START });

        let scrollView = new St.ScrollView({ style_class: 'show-processes-dialog-app-list'});
        scrollView.set_policy(Gtk.PolicyType.NEVER,
                              Gtk.PolicyType.AUTOMATIC);
        this.contentLayout.add(scrollView,
                               { x_fill: true,
                                 y_fill: true });
        scrollView.hide();

        this._applicationList = new St.BoxLayout({ vertical: true });
        scrollView.add_actor(this._applicationList,
                             { x_fill:  true,
                               y_fill:  true,
                               x_align: St.Align.START,
                               y_align: St.Align.MIDDLE });

        this._applicationList.connect('actor-added',
                                      Lang.bind(this, function() {
                                          if (this._applicationList.get_children().length == 1)
                                              scrollView.show();
                                      }));

        this._applicationList.connect('actor-removed',
                                      Lang.bind(this, function() {
                                          if (this._applicationList.get_children().length == 0)
                                              scrollView.hide();
                                      }));
    },

    _setAppsForPids: function(pids) {
        // remove all the items
        this._applicationList.destroy_all_children();

        pids.forEach(Lang.bind(this, function(pid) {
            let tracker = Cinnamon.WindowTracker.get_default();
            let app = tracker.get_app_from_pid(pid);

            if (!app)
                return;

            let item = new ListItem(app);
            this._applicationList.add(item.actor, { x_fill: true });

            item.connect('activate',
                         Lang.bind(this, function() {
                             // use -1 to indicate Cancel
                             this.emit('response', -1);
                         }));
        }));
    },

    update: function(message, processes, choices) {
        this._setAppsForPids(processes);
        _setLabelsForMessage(this, message);
        _setButtonsForChoices(this, choices);
    }
}
Signals.addSignalMethods(CinnamonProcessesDialog.prototype);
