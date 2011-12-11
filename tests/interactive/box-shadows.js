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


function addTestCase(inset, offsetX, offsetY, blur, spread) {
    let shadowStyle = 'box-shadow: ' + (inset ? 'inset ' : '') +
                      offsetX + 'px ' + offsetY + 'px ' + blur + 'px ' +
                      (spread > 0 ? (' ' + spread + 'px ') : '') +
                      'rgba(0,0,0,0.5);';
    let label = new St.Label({ style: 'border: 4px solid black;' +
                                      'border-radius: 5px;' +
                                      'background-color: white; ' +
                                      'padding: 5px;' +
                                      shadowStyle,
                               text: shadowStyle });
    box.add(label, { x_fill: false, y_fill: false } );
}

addTestCase (false, 3, 4, 0, 0);
addTestCase (false, 3, 4, 0, 4);
addTestCase (false, 3, 4, 4, 0);
addTestCase (false, 3, 4, 4, 4);
addTestCase (false, -3, -4, 4, 0);
addTestCase (false, 0, 0, 0, 4);
addTestCase (false, 0, 0, 4, 0);
addTestCase (true, 3, 4, 0, 0);
addTestCase (true, 3, 4, 0, 4);
addTestCase (true, 3, 4, 4, 0);
addTestCase (true, 3, 4, 4, 4);
addTestCase (true, -3, -4, 4, 0);
addTestCase (true, 0, 0, 0, 4);
addTestCase (true, 0, 0, 4, 0);

stage.show();
Clutter.main();
stage.destroy();
