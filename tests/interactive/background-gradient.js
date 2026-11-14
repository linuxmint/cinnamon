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
                              style: 'padding: 10px; background: #ffee88;'
                            });
stage.add_actor(vbox);

let scroll = new St.ScrollView();
vbox.add(scroll, { expand: true });

let box = new St.BoxLayout({ vertical: true,
                             style: 'spacing: 10px;' });
scroll.add_actor(box);

function addTestCase(description, gradient) {
    box.add(new St.Label({ text: description,
                           style: 'border: 1px solid #555;'
                                  + 'border-radius: 6px;'
                                  + 'padding: 12px 20px;'
                                  + gradient }),
            { x_fill: false });
}

// No middle stops: must look exactly as before
addTestCase('two stops',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: #f8f8f8;'
            + 'background-gradient-end: #b0b0b0;');

// Clearlooks-style split: fade, step at the middle, fade
addTestCase('split',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: #f8f8f8;'
            + 'background-gradient-middle-start: #e8e8e8;'
            + 'background-gradient-middle-end: #d4d4d4;'
            + 'background-gradient-end: #b0b0b0;');

// Glass: darker to the middle, step to darkest, lighter again below
addTestCase('glass',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: #c8d8f0;'
            + 'background-gradient-middle-start: #9ab4dc;'
            + 'background-gradient-middle-end: #5a7cb0;'
            + 'background-gradient-end: #88a4d0;');

// One middle color only: three stops, no step
addTestCase('middle-start only',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: white;'
            + 'background-gradient-middle-start: #ff8888;'
            + 'background-gradient-end: white;');

// Step moved off center
addTestCase('split at 30%',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: #f8f8f8;'
            + 'background-gradient-middle-start: #e8e8e8;'
            + 'background-gradient-middle-end: #c0c0c0;'
            + 'background-gradient-end: #b0b0b0;'
            + 'background-gradient-middle-position: 30%;');

// Translucent: the step must stay translucent, with no dark edges
addTestCase('translucent split',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: rgba(40, 40, 40, 0.5);'
            + 'background-gradient-middle-start: rgba(40, 40, 40, 0.6);'
            + 'background-gradient-middle-end: rgba(0, 0, 0, 0.75);'
            + 'background-gradient-end: rgba(0, 0, 0, 0.85);');

addTestCase('horizontal split',
            'background-gradient-direction: horizontal;'
            + 'background-gradient-start: #f8f8f8;'
            + 'background-gradient-middle-start: #e0e0e0;'
            + 'background-gradient-middle-end: #c0c0c0;'
            + 'background-gradient-end: #a0a0a0;');

addTestCase('radial split',
            'background-gradient-direction: radial;'
            + 'background-gradient-start: white;'
            + 'background-gradient-middle-start: #ccddff;'
            + 'background-gradient-middle-end: #6688cc;'
            + 'background-gradient-end: #335599;');

stage.show();
Clutter.main();
stage.destroy();
