// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const UI = imports.testcommon.ui;

UI.init();
let stage = Clutter.Stage.get_default();

let hbox = new St.BoxLayout({ name: 'transition-container',
                              reactive: true,
                              track_hover: true,
                              width: stage.width,
                              height: stage.height,
                              style: 'padding: 10px;'
                                     + 'spacing: 10px;' });
stage.add_actor(hbox);

for (let i = 0; i < 5; i ++) {
    let label = new St.Label({ text: (i+1).toString(),
                               name: "label" + i,
                               style_class: 'transition-label',
                               reactive: true,
                               track_hover: true });

    hbox.add(label, { x_fill: false,
                      y_fill: false });
}

////////////////////////////////////////////////////////////////////////////////

stage.show();
Clutter.main();
