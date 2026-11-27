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

// The two-color background-gradient-* properties: must look as before
addTestCase('background-gradient-start/end',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: #f8f8f8;'
            + 'background-gradient-end: #b0b0b0;');

addTestCase('linear-gradient, two colors',
            'background-image: linear-gradient(#f8f8f8, #b0b0b0);');

// Clearlooks-style split: fade, a step at the middle, fade
addTestCase('split',
            'background-image: linear-gradient(to bottom, #f8f8f8,'
            + ' #e8e8e8 50%, #d4d4d4 50%, #b0b0b0);');

// Glass: darker to the middle, a step to the darkest, lighter again below
addTestCase('glass',
            'background-image: linear-gradient(to bottom, #c8d8f0,'
            + ' #9ab4dc 50%, #5a7cb0 50%, #88a4d0);');

addTestCase('step at 30%',
            'background-image: linear-gradient(#f8f8f8,'
            + ' #e8e8e8 30%, #c0c0c0 30%, #b0b0b0);');

// Translucent: the step must stay translucent, with no dark edges
addTestCase('translucent split',
            'background-image: linear-gradient(rgba(40, 40, 40, 0.5),'
            + ' rgba(40, 40, 40, 0.6) 50%, rgba(0, 0, 0, 0.75) 50%,'
            + ' rgba(0, 0, 0, 0.85));');

addTestCase('to right',
            'background-image: linear-gradient(to right, #f8f8f8,'
            + ' #e0e0e0 50%, #c0c0c0 50%, #a0a0a0);');

// Stops without positions are spread evenly
addTestCase('90deg, evenly spaced',
            'background-image: linear-gradient(90deg, red, yellow, lime, blue);');

addTestCase('to bottom right',
            'background-image: linear-gradient(to bottom right, white, #335599);');

// linear-gradient() wins over background-gradient-*, so a theme can give
// both for Cinnamon versions without linear-gradient(): should be glass
addTestCase('both given: linear-gradient wins',
            'background-gradient-direction: vertical;'
            + 'background-gradient-start: red;'
            + 'background-gradient-end: red;'
            + 'background-image: linear-gradient(to bottom, #c8d8f0,'
            + ' #9ab4dc 50%, #5a7cb0 50%, #88a4d0);');

// Radial gradients still use the background-gradient-* properties
addTestCase('radial (background-gradient-direction)',
            'background-gradient-direction: radial;'
            + 'background-gradient-start: white;'
            + 'background-gradient-end: #335599;');

stage.show();
Clutter.main();
stage.destroy();
