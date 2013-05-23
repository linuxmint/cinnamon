// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const UI = imports.testcommon.ui;

UI.init();
let stage = Clutter.Stage.get_default();
stage.width = 640;
stage.height = 480;

let vbox = new St.BoxLayout({ width: stage.width,
                              height: stage.height,
                              style: 'background: #ffee88;' });
stage.add_actor(vbox);

let scroll = new St.ScrollView();
vbox.add(scroll, { expand: true });

let vbox = new St.BoxLayout({ vertical: true,
                              style: 'padding: 10px;'
                                     + 'spacing: 20px;' });
scroll.add_actor(vbox);

let contents = new St.Bin({ width: 1000, height: 1000,
                                   style_class: 'background-image background-repeat' });
vbox.add_actor(contents);


stage.show();
Clutter.main();
stage.destroy();
