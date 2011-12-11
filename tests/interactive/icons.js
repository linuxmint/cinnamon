// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const UI = imports.testcommon.ui;

UI.init();
let stage = Clutter.Stage.get_default();

stage.width = 400;
stage.height = 700;

let b = new St.BoxLayout({ vertical: true,
                           width: stage.width,
                           height: stage.height });
stage.add_actor(b);

function addTest(label, icon_props) {
    if (b.get_children().length > 0)
        b.add (new St.BoxLayout({ style: 'background: #cccccc; border: 10px transparent white; height: 1px; ' }));

    let hb = new St.BoxLayout({ vertical: false,
                                style: 'spacing: 10px;' });

    hb.add(new St.Label({ text: label }), { y_fill: false });
    hb.add(new St.Icon(icon_props));

    b.add(hb);
}

addTest("Symbolic",
        { icon_name: 'battery-full',
          icon_type: St.IconType.SYMBOLIC,
          icon_size: 48 });
addTest("Full color",
        { icon_name: 'battery-full',
          icon_type: St.IconType.FULLCOLOR,
          icon_size: 48 });
addTest("Default size",
        { icon_name: 'battery-full',
          icon_type: St.IconType.SYMBOLIC });
addTest("Size set by property",
        { icon_name: 'battery-full',
          icon_type: St.IconType.SYMBOLIC,
          icon_size: 32 });
addTest("Size set by style",
        { icon_name: 'battery-full',
          icon_type: St.IconType.SYMBOLIC,
          style: 'icon-size: 1em;' });
addTest("16px icon in 48px icon widget",
        { icon_name: 'battery-full',
          icon_type: St.IconType.SYMBOLIC,
          style: 'icon-size: 16px; width: 48px; height: 48px; border: 1px solid black;' });

function iconRow(icons, box_style) {
    let hb = new St.BoxLayout({ vertical: false, style: box_style });

    for each (let iconName in icons) {
        hb.add(new St.Icon({ icon_name: iconName,
                             icon_type: St.IconType.SYMBOLIC,
                             icon_size: 48 }));
    }

    b.add(hb);
}

let normalCss = 'background: white; color: black; padding: 10px 10px;';
let reversedCss = 'background: black; color: white; warning-color: #ffcc00; error-color: #ff0000; padding: 10px 10px;';

let batteryIcons = ['battery-full-charging',
                    'battery-full',
                    'battery-good',
                    'battery-low',
                    'battery-caution' ];

let volumeIcons = ['audio-volume-high',
                   'audio-volume-medium',
                   'audio-volume-low',
                   'audio-volume-muted' ];

iconRow(batteryIcons, normalCss);
iconRow(batteryIcons, reversedCss);
iconRow(volumeIcons, normalCss);
iconRow(volumeIcons, reversedCss);

stage.show();
Clutter.main();
