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

let box = new St.BoxLayout({ vertical: true,
                             style: 'padding: 10px;'
                                    + 'spacing: 20px;' });
scroll.add_actor(box);

function addTestCase(radii, useGradient) {
    let background;
    if (useGradient)
        background = 'background-gradient-direction: vertical;'
                     + 'background-gradient-start: white;'
                     + 'background-gradient-end: gray;';
    else
        background = 'background: white;';

    box.add(new St.Label({ text: "border-radius:  " + radii + ";",
                           style: 'border: 1px solid black; '
                                  + 'border-radius: ' + radii + ';'
                                  + 'padding: 5px;' + background }),
                         { x_fill: false });
}

// uniform backgrounds
addTestCase(" 0px  5px 10px 15px", false);
addTestCase(" 5px 10px 15px  0px", false);
addTestCase("10px 15px  0px  5px", false);
addTestCase("15px  0px  5px 10px", false);

// gradient backgrounds
addTestCase(" 0px  5px 10px 15px", true);
addTestCase(" 5px 10px 15px  0px", true);
addTestCase("10px 15px  0px  5px", true);
addTestCase("15px  0px  5px 10px", true);

// border-radius reduction
// these should all take the cairo fallback,
// so don't bother testing w/ or w/out gradients.
addTestCase("200px 200px 200px 200px", false);
addTestCase("200px 200px 0px   200px", false);
addTestCase("999px 0px   999px 0px",   false);

stage.show();
Clutter.main();
stage.destroy();
