// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const St = imports.gi.St;

const Calendar = imports.ui.calendar;
const UI = imports.testcommon.ui;

Gtk.init(null, null);

UI.init();
let stage = Clutter.Stage.get_default();
stage.width = stage.height = 400;
stage.show();

let vbox = new St.BoxLayout({ vertical: true,
                              width: stage.width,
                              height: stage.height,
                              style: 'padding: 10px; spacing: 10px; font: 15px sans-serif;' });
stage.add_actor(vbox);

let entry = new St.Entry({ style: 'border: 1px solid black;' });
vbox.add(entry,
         { expand: true,
           y_fill: false, y_align: St.Align.MIDDLE });
entry.grab_key_focus();

stage.show();
Clutter.main();
stage.destroy();
