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

box.add(new St.Label({ text: "Hello World",
                       style: 'border: 1px solid black; '
                              + 'padding: 5px;' }));

box.add(new St.Label({ text: "Hello Round World",
                       style: 'border: 3px solid green; '
                              + 'border-radius: 8px; '
                              + 'padding: 5px;' }));

box.add(new St.Label({ text: "Hello Background",
                       style: 'border: 3px solid green; '
                              + 'border-radius: 8px; '
                              + 'background: white; '
                              + 'padding: 5px;' }));

box.add(new St.Label({ text: "Hello Translucent Black Border",
                       style: 'border: 3px solid rgba(0, 0, 0, 0.4); '
                              + 'background: white; ' }));

box.add(new St.Label({ text: "Hello Translucent Background",
                       style: 'background: rgba(255, 255, 255, 0.3);' }));

box.add(new St.Label({ text: "Border, Padding, Content: 20px" }));

let b1 = new St.BoxLayout({ vertical: true,
                            style: 'border: 20px solid black; '
                                   + 'background: white; '
                                   + 'padding: 20px;' });
box.add(b1);

b1.add(new St.BoxLayout({ width: 20, height: 20,
                          style: 'background: black' }));

box.add(new St.Label({ text: "Translucent big blue border, with rounding",
                       style: 'border: 20px solid rgba(0, 0, 255, 0.2); '
                              + 'border-radius: 10px; '
                              + 'background: white; '
                              + 'padding: 10px;' }));

box.add(new St.Label({ text: "Transparent border",
                       style: 'border: 20px solid transparent; '
                              + 'background: white; '
                              + 'padding: 10px;' }));

box.add(new St.Label({ text: "Border Image",
                       style_class: "border-image",
                       style: "padding: 10px;" }));

box.add(new St.Label({ text: "Border Image with Gradient",
                       style_class: 'border-image-with-background-gradient',
                       style: "padding: 10px;"
                              + 'background-gradient-direction: vertical;' }));

box.add(new St.Label({ text: "Rounded, framed, shadowed gradients" }));

let framedGradients = new St.BoxLayout({ vertical: false,
                                         style: 'padding: 10px; spacing: 12px;' });
box.add(framedGradients);

function addGradientCase(direction, borderWidth, borderRadius, extra) {
    let gradientBox = new St.BoxLayout({ style_class: 'background-gradient',
                                         style: 'border: ' + borderWidth + 'px solid #8b0000;'
                                                + 'border-radius: ' + borderRadius + 'px;'
                                                + 'background-gradient-direction: ' + direction + ';'
                                                + 'width: 32px;'
                                                + 'height: 32px;'
                                                + extra });
    framedGradients.add(gradientBox, { x_fill: false, y_fill: false } );
}

addGradientCase ('horizontal', 0, 5,  'box-shadow: 0px 0px 0px 0px rgba(0,0,0,0.5);');
addGradientCase ('horizontal', 2, 5,  'box-shadow: 0px 2px 0px 0px rgba(0,255,0,0.5);');
addGradientCase ('horizontal', 5, 2,  'box-shadow: 2px 0px 0px 0px rgba(0,0,255,0.5);');
addGradientCase ('horizontal', 5, 20, 'box-shadow: 0px 0px 4px 0px rgba(255,0,0,0.5);');
addGradientCase ('vertical', 0, 5,    'box-shadow: 0px 0px 0px 4px rgba(0,0,0,0.5);');
addGradientCase ('vertical', 2, 5,    'box-shadow: 0px 0px 4px 4px rgba(0,0,0,0.5);');
addGradientCase ('vertical', 5, 2,    'box-shadow: -2px -2px 6px 0px rgba(0,0,0,0.5);');
addGradientCase ('vertical', 5, 20,   'box-shadow: -2px -2px 0px 6px rgba(0,0,0,0.5);');

box.add(new St.Label({ text: "Rounded, framed, shadowed images" }));

let framedImages = new St.BoxLayout({ vertical: false,
                                      style: 'padding: 10px; spacing: 6px;' });
box.add(framedImages);

function addBackgroundImageCase(borderWidth, borderRadius, width, height, extra) {
    let imageBox = new St.BoxLayout({ style_class: 'background-image',
                                      style: 'border: ' + borderWidth + 'px solid #8b8b8b;'
                                             + 'border-radius: ' + borderRadius + 'px;'
                                             + 'width: ' + width + 'px;'
                                             + 'height: ' + height + 'px;'
                                             + extra });
    framedImages.add(imageBox, { x_fill: false, y_fill: false } );
}

addBackgroundImageCase (0, 0, 32, 32, 'background-position: 2px 5px');
addBackgroundImageCase (0, 0, 16, 16, '-st-background-image-shadow: 1px 1px 4px 0px rgba(0,0,0,0.5); background-color: rgba(0,0,0,0)');
addBackgroundImageCase (0, 5, 32, 32, '-st-background-image-shadow: 0px 0px 0px 0px rgba(0,0,0,0.5);');
addBackgroundImageCase (2, 5, 32, 32, '-st-background-image-shadow: 0px 2px 0px 0px rgba(0,255,0,0.5);');
addBackgroundImageCase (5, 2, 32, 32, '-st-background-image-shadow: 2px 0px 0px 0px rgba(0,0,255,0.5);');
addBackgroundImageCase (5, 20, 32, 32, '-st-background-image-shadow: 0px 0px 4px 0px rgba(255,0,0,0.5);');
addBackgroundImageCase (0, 5, 48, 48, '-st-background-image-shadow: 0px 0px 0px 4px rgba(0,0,0,0.5);');
addBackgroundImageCase (5, 5, 48, 48, '-st-background-image-shadow: 0px 0px 4px 4px rgba(0,0,0,0.5);');
addBackgroundImageCase (0, 5, 64, 64, '-st-background-image-shadow: -2px -2px 6px 0px rgba(0,0,0,0.5);');
addBackgroundImageCase (5, 5, 64, 64, '-st-background-image-shadow: -2px -2px 0px 6px rgba(0,0,0,0.5);');
addBackgroundImageCase (0, 5, 32, 32, 'background-position: 2px 5px');

stage.show();
Clutter.main();
stage.destroy();
