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
                             style: 'spacing: 20px;' });
scroll.add_actor(box);

function addTestCase(borders, useGradient) {
    let background;
    if (useGradient)
        background = 'background-gradient-direction: vertical;'
                     + 'background-gradient-start: white;'
                     + 'background-gradient-end: gray;';
    else
        background = 'background: white;';

    let border_style = "border-top: " + borders[St.Side.TOP] + " solid black;\n" +
                       "border-right: " + borders[St.Side.RIGHT] + " solid black;\n" +
                       "border-bottom: " + borders[St.Side.BOTTOM] + " solid black;\n" +
                       "border-left: " + borders[St.Side.LEFT] + " solid black;";
    box.add(new St.Label({ text: border_style,
                           style: border_style
                                  + 'border-radius: 0px 5px 15px 25px;'
                                  + 'padding: 5px;' + background }),
                         { x_fill: false });
}

// uniform backgrounds
addTestCase([" 0px", " 5px", "10px", "15px"], false);
addTestCase([" 5px", "10px", "15px", " 0px"], false);
addTestCase(["10px", "15px", " 0px", " 5px"], false);
addTestCase(["15px", " 0px", " 5px", "10px"], false);

// gradient backgrounds
addTestCase([" 0px", " 5px", "10px", "15px"], true);
addTestCase([" 5px", "10px", "15px", " 0px"], true);
addTestCase(["10px", "15px", " 0px", " 5px"], true);
addTestCase(["15px", " 0px", " 5px", "10px"], true);

stage.show();
Clutter.main();
stage.destroy();
